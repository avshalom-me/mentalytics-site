# תוכנית יישום — דו"ח סטטיסטי למטפלים ממומנים

> **מטרה:** הרחבת הדו"ח שמקבל מטפל במסלול מקודם, לכלול 4 מדדים חדשים + שכבת AI. המסמך הזה מכסה שלב א' (הכול עד כולל UI) — שלב ה-AI יתוכנן בנפרד.

## יעדי המוצר

| # | מדד | מצב נוכחי | אחרי היישום |
|---|---|---|---|
| 1 | צפיות/לחיצות | ✅ קיים ב-`therapist_profile_views` + `therapist_contact_clicks` | — |
| 2 | סוגי מטופלים שפנו | ❌ לא נשמר קונטקסט | ✅ קטגוריות אנונימיות: issue, age_band, gender |
| 3 | אזורים של צופים | ❌ לא נשמר | ✅ region מהשאלון, 5 אזורים |
| 4 | % צפייה ללא לחיצה | ⚠️ אפשר לחשב אבל לא מוצג | ✅ conversion rate לפרופיל |

## עקרונות מנחים

- **פרטיות קודם כל**: רק קטגוריות רחבות, לעולם לא ערכים גולמיים. אכיפת k-anonymity (≥5 תצפיות) ברמת הצגה.
- **רק למסלול מקודם**: הדו"ח המורחב זמין ל-`status = 'paying'` בלבד. לא מחשבים אם לא צריך.
- **אין PII**: לא שומרים IP, לא שומרים שם/מייל, לא שומרים תשובות טקסט חופשי. רק enum-im.
- **Idempotent tracking**: צפייה חוזרת של אותו user לאותו פרופיל ב-30 דק' = אחת, למניעת ניפוח.
- **Non-breaking**: כל העמודות החדשות `nullable`. צפיות קיימות לא מאבדות ערך.

---

## שלב 1 — Migration (DB schema)

**קובץ:** `supabase/migrations/YYYYMMDD_stats_context.sql` (ליצור)

### 1a. הרחבת `therapist_profile_views`

```sql
ALTER TABLE therapist_profile_views
  ADD COLUMN viewer_region       text,
  ADD COLUMN viewer_issue        text,
  ADD COLUMN viewer_age_band     text,
  ADD COLUMN viewer_gender       text,
  ADD COLUMN match_score         int,
  ADD COLUMN session_id          text;

CREATE INDEX IF NOT EXISTS idx_profile_views_therapist_date
  ON therapist_profile_views (therapist_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_views_therapist_region
  ON therapist_profile_views (therapist_id, viewer_region);
CREATE INDEX IF NOT EXISTS idx_profile_views_therapist_issue
  ON therapist_profile_views (therapist_id, viewer_issue);
```

**ערכים חוקיים (אוכפים באפליקציה, לא ב-DB):**

| עמודה | ערכים |
|---|---|
| `viewer_region` | `north`, `center`, `jerusalem`, `south`, `sharon`, `online` |
| `viewer_issue` | `anxiety`, `depression`, `relationship`, `family`, `trauma`, `adhd`, `eating`, `addiction`, `grief`, `identity`, `child`, `other` (≈12 קטגוריות — ליישר עם הקטגוריות שכבר קיימות בשאלון) |
| `viewer_age_band` | `18-30`, `31-45`, `46-60`, `60+`, `child` |
| `viewer_gender` | `m`, `f`, `other`, `null` |
| `match_score` | 0-100, `null` בצפייה מ-directory |
| `session_id` | hash של browser fingerprint + IP (לצורך dedup בלבד, לא לזיהוי) |

### 1b. טבלת cache ל-insights

```sql
CREATE TABLE therapist_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  month_start date NOT NULL,
  stats_json jsonb NOT NULL,
  ai_narrative text,          -- יתמלא בשלב ה-AI בלבד
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (therapist_id, month_start)
);

CREATE INDEX idx_therapist_insights_lookup ON therapist_insights (therapist_id, month_start DESC);
```

**למה cache?** הסטטיסטיקה לא משתנה בתוך חודש, ה-AI יקר → מחשבים פעם בחודש (cron) ומגישים מיידית מה-cache.

### 1c. RLS

```sql
ALTER TABLE therapist_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Therapists see own insights"
  ON therapist_insights FOR SELECT
  USING (therapist_id IN (SELECT id FROM therapists WHERE user_id = auth.uid()));
```

העמודות החדשות ב-`therapist_profile_views` אינן חשופות ל-client — הגישה אליהן רק דרך `supabaseAdmin` ב-API.

---

## שלב 2 — Tracking: לכידת קונטקסט בצפייה

### 2a. עדכון `TrackView.tsx`

**קובץ:** [`app/therapists/[id]/TrackView.tsx`](app/therapists/[id]/TrackView.tsx)

- הקומפוננטה תקבל props נוספים: `viewerContext?: { region, issue, age_band, gender, match_score }`
- אם לא-undefined — שולחת אותם ל-API. אחרת שולחת בלי (directory).
- `session_id`: נוצר מ-`localStorage` (אם לא קיים — sha256 של fingerprint + timestamp). לא שמיש לזיהוי — רק dedup.

### 2b. העברת הקונטקסט מדף ה-match

**קובץ:** [`app/therapists/[id]/page.tsx`](app/therapists/[id]/page.tsx)

הדף מקבל `source` מ-search params. צריך להוסיף:
- `from=match` → גם `region`, `issue`, `age`, `gender`, `score` מ-query string
- הערכים מנורמלים ל-enum (בצד השרת לפני הטרנספר ל-Client component)

**קובץ:** [`app/adults/page.tsx`](app/adults/page.tsx) + [`app/kids/page.tsx`](app/kids/page.tsx)

הקישור מרשימת התאמות → דף פרופיל. כרגע: `/therapists/{id}?from=match`.
**שינוי:** הוספת querystring עם הקונטקסט:
```
/therapists/{id}?from=match&r=center&i=anxiety&a=31-45&g=f&s=87
```
קצר ואנונימי. ה-querystring מגיע כבר מהשאלון שהמטופל מילא — לא דורש קריאה נוספת.

### 2c. עדכון `POST /api/track-view/route.ts`

**קובץ:** [`app/api/track-view/route.ts`](app/api/track-view/route.ts)

- מקבל בנוסף: `viewer_region`, `viewer_issue`, `viewer_age_band`, `viewer_gender`, `match_score`, `session_id`
- **ולידציה מחמירה:** כל ערך חייב להיות בתוך enum. מחוץ לזה → `null` (לא לזרוק 400, להמשיך לאסוף view בסיסי).
- Rate limiter הקיים נשאר.
- Dedup: אם קיים רשומה עם אותו `session_id` + `therapist_id` ב-30 דק' אחרונות — לא להכניס חדש.

---

## שלב 3 — API: endpoint סטטיסטיקה מורחב

### 3a. עדכון `GET /api/therapist-stats/route.ts`

**קובץ:** [`app/api/therapist-stats/route.ts`](app/api/therapist-stats/route.ts)

הוספת בלוק חדש ל-response, רק ל-`paying`:

```typescript
result.enriched = {
  by_region: [
    { region: "center", views: 34, clicks: 8, ctr: 23.5 },
    { region: "sharon", views: 12, clicks: 4, ctr: 33.3 },
    // k-anon: אזור עם <5 צפיות מוצמד ל"אחר"
  ],
  by_issue: [
    { issue: "anxiety", views: 28, clicks: 9, ctr: 32.1 },
    // ...
  ],
  by_age_band: [...],
  conversion: {
    total_views: 120,
    unique_sessions: 89,      // לפי session_id
    contacted: 22,
    no_click_rate: 75.3       // %, (views - clicks) / views
  },
  data_quality: {
    enough_data: true,         // false אם < 20 צפיות בתקופה
    period_days: 30
  }
};
```

### 3b. פונקציה מרכזית: `computeEnrichedStats(therapistId, sinceDate)`

**קובץ חדש:** `app/lib/therapist-stats.ts`

- קוראת את כל ה-views ב-range עם ה-enrichment columns
- מקבצת לפי region/issue/age
- **אוכפת k-anonymity**: קבוצה עם < 5 צפיות → מוצמדת ל-`"other"` (או מוסתרת לגמרי אם זו הקבוצה היחידה)
- מחשבת CTR = clicks באותה תקופה / views באותה תקופה (JOIN לפי `session_id` אם אפשר, אחרת proxy גס לפי therapist_id בלבד)
- מחזירה אובייקט סטרוקטורלי, מוכן להצגה + להזנת AI בשלב הבא

---

## שלב 4 — UI: פאנל חדש בדשבורד

**קובץ:** [`app/therapists/dashboard/page.tsx`](app/therapists/dashboard/page.tsx)

### 4a. מיקום

מתחת לבלוק ההשוואה (אחרי `ContactStats`), רק כש-`profile.status === "paying"`. תחת כותרת: **"ניתוח מעמיק של הפניות שלך"**.

### 4b. קומפוננטות חדשות

**קובץ חדש:** `app/therapists/dashboard/EnrichedStatsPanel.tsx`
- מקבל את ה-`enriched` object מה-API
- 4 sub-panels:
  1. **"מאיפה פונים אליך"** — bar chart אופקי, אזור × צפיות, עם CTR כ-badge
  2. **"מי פונה אליך"** — pie/donut של issue categories
  3. **"גילאים עיקריים"** — bar chart גילאים
  4. **"המרה"** — number card גדול: "מתוך 120 צפיות, 22 פנו אליך (18%)"
- אם `data_quality.enough_data === false` → placeholder: "עדיין לא נאספו מספיק נתונים — נציג ניתוח כשתקבל לפחות 20 צפיות. החזרה בעוד X ימים"

### 4c. עיצוב

- תואם לדשבורד הקיים: `bg-white`, `border-[#E8E0D8]`, `shadow-sm`, rounded-2xl
- גרפים: `recharts` (קל, כבר נפוץ ב-Next) או SVG פשוט
- RTL מלא, כל הטקסטים עברית, מספרים עם פסיקים (`.toLocaleString("he-IL")`)

---

## שלב 5 — גידור עלויות ואפי-ראוטינג

- ✅ Rate limiter ב-`track-view` (קיים — 60/דקה/IP) מגן מהזרקת data
- ✅ Validation enum קפדנית = ואקסין נגד זיהום ה-DB
- ✅ Cache חודשי (`therapist_insights`) → עומס החישוב פעם בחודש למטפל
- ⚠️ **לבדוק cost ב-Supabase:** אינדקסים נוספים על טבלה שגדלה = לבחון ב-6 חודשים

---

## שלב 6 — Backfill

**לא נדרש.** העמודות החדשות הן nullable, צפיות היסטוריות ייכנסו ל-bucket "לא ידוע" ובסופו של דבר יצברו ייחוס חדש. אם נרצה בעתיד — ניתן לשחזר חלקית מ-user-agent + timestamp מצטלב עם quiz events, אבל זה לא בעדיפות.

---

## Task breakdown (סדר ביצוע)

| # | משימה | קבצים | זמן משוער |
|---|---|---|---|
| 1 | Migration SQL | `supabase/migrations/...sql` | 30 דק' |
| 2 | עדכון `track-view` API + validation | `app/api/track-view/route.ts` | 45 דק' |
| 3 | עדכון `TrackView.tsx` + session_id | `app/therapists/[id]/TrackView.tsx` | 30 דק' |
| 4 | העברת קונטקסט מ-adults/kids ל-profile | `app/{adults,kids}/page.tsx` + `app/therapists/[id]/page.tsx` | 1.5 שעות |
| 5 | `therapist-stats.ts` — `computeEnrichedStats` | `app/lib/therapist-stats.ts` (חדש) | 2 שעות |
| 6 | הרחבת `GET /api/therapist-stats` | `app/api/therapist-stats/route.ts` | 30 דק' |
| 7 | `EnrichedStatsPanel` + גרפים | `app/therapists/dashboard/EnrichedStatsPanel.tsx` (חדש) | 3 שעות |
| 8 | חיבור לדשבורד + loading/empty states | `app/therapists/dashboard/page.tsx` | 45 דק' |
| 9 | QA ידני: זרימה end-to-end, בדיקת k-anon | — | 1 שעה |

**סה"כ:** ~10-11 שעות עבודה.

---

## שלב 7 (נפרד, אחרי) — שכבת AI

להזכיר: לא נכלל בשלב א' הזה. מה שצריך להיות מוכן כדי שהוספת AI תהיה cheap:

- ✅ `therapist_insights.ai_narrative` (כבר יוצר ב-migration)
- ✅ `computeEnrichedStats` מחזיר JSON נקי, מובנה — מזין ישר ל-prompt
- ✅ cron חודשי קיים ב-[`app/api/cron/monthly-report/route.ts`](app/api/cron/monthly-report/route.ts) — ניתן להרחיב

בשלב ההוא נחליט:
- Claude Haiku 4.5 (מומלץ — ~$0.001/מטפל/חודש) או Sonnet אם רוצים איכות טקסט גבוהה יותר
- בעברית בלבד, 3-4 משפטים, פורמט קבוע
- prompt template + guardrails (לא להמציא מספרים שלא בקלט, לא לחשוף identifiable details גם אם הופיעו)

---

## דגלים אדומים לשקול לפני התחלה

1. **enum ל-issue** — צריך ליישר ל-categories הקיימות בשאלון. עדיף לייצא מ-`app/lib/questionnaire-score.ts` קבוע משותף.
2. **session_id**: localStorage נוח אבל נמחק ב-incognito → dedup פחות יעיל. זה OK — לא קריטי לדיוק 100%.
3. **k-anon threshold 5** — יכול להרגיש לעיתים מחמיר. אפשר להתחיל ב-3 ולהחמיר אם רואים בעיות. להחליט מראש.
4. **Migration on production** — יש לוודא שאין locks ארוכים. טבלת views עשויה להיות גדולה. `ADD COLUMN` עם default NULL — מהיר, לא משכפל שורות.
