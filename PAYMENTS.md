# מערכת הסליקה — מנטליטיקס

מסמך עזר למפתחים. עודכן לאחרונה: 2026-05-11.

---

## 1. סקירה כללית

האתר משלב **סליקה אוטומטית** דרך Sumit (חברת חשבוניות + סליקה ישראלית, על תשתית UPay). יש שני סוגי תשלום:

| סוג | מחיר בסיס | מנגנון | קוד רלוונטי |
|-----|-----------|---------|--------------|
| שאלון מטופלים | ₪30 + 18% מע"מ = ₪35.40 | חד-פעמי, אחרי 6 שאלונים חינמיים | `chargeQuizPayment` |
| מנוי מטפלים | ₪120 + 18% מע"מ = ₪141.60 | חודשי מתחדש (הוראת קבע) | `createSubscription` |

**מאז 2026-05-11:** המערכת עברה מ-Morning+Grow ל-Sumit. הסיבה: Morning לא תומכים ב-API לחיוב מחזורי merchant-initiated. כל זכר ל-Morning נמחק מהקוד (חוץ משמות עמודות `morning_token_id` ו-`morning_document_id` שנשמרו כדי לחסוך migration).

---

## 2. שירותים חיצוניים

### Sumit
- **דשבורד:** https://app.sumit.co.il
- **API:** https://api.sumit.co.il
- **Swagger:** https://app.sumit.co.il/help/developers/swagger/index.html (דורש login)
- **CompanyID:** 1892690233
- **תיעוד עזרה:** https://help.sumit.co.il/he
- **תמיכה:** דרך הצ'אט בדשבורד

### UPay (תשתית הסליקה של Sumit)
- **תעריפים:** 1.4% עמלת סליקה (תשלום יומי) + 0.2% מסמך חסר + 2.5₪ ל-3DS לעסקה
- **דמי הקמה/חודש:** אפס
- **דשבורד:** https://www.upay.co.il
- **תמיכה:** support@upay.co.il | 03-8008729

---

## 3. ארכיטקטורה — זרימת תשלום

### תשלום ראשון (מטפל נרשם למנוי)

```
Browser (checkout/page.tsx)
    │
    ├─ POST /api/payments/sumit-config (GET CompanyID + PublicKey)
    │
    ├─ POST https://api.sumit.co.il/creditguy/vault/tokenizesingleusejson/
    │   ├─ Payload: { Credentials: {CompanyID, APIPublicKey}, CardNumber, ExpYear, ExpMonth, CVV, CitizenID }
    │   └─ Response: { Data: { SingleUseToken } }  ← הכרטיס לא נוגע בשרת שלנו
    │
    └─ POST /api/payments/create-subscription
        │   Body: { singleUseToken, firstName, lastName, phone, email }
        │   Header: Authorization: Bearer <supabase JWT>
        │
        ├─ Validate, rate-limit, race-prevent (60-second pending window)
        ├─ INSERT INTO payments (status='pending')
        ├─ Call Sumit /billing/recurring/charge
        │   └─ Charges card + creates standing order (Sumit's server-side cron handles renewals)
        ├─ Lookup RecurringItem.ID via listRecurringForCustomer (Sumit response doesn't include it directly)
        ├─ UPSERT subscriptions (status='active', morning_token_id = recurring item ID)
        ├─ UPDATE therapists SET status='paying'
        └─ UPDATE payments SET status='completed'
```

### חיוב חודשי חוזר

**אין קוד שלנו.** Sumit מחייבת אוטומטית בכל חודש בתאריך שנקבע (לרוב יום-חודש כמו ההצטרפות). שולחת חשבונית במייל ללקוח. רושמת בדשבורד שלהם.

### סנכרון יומי

```
Cron @ 06:30 → /api/cron/sumit-status-sync
    │
    └─ For each active subscription locally:
        ├─ Call listRecurringForCustomer(externalIdentifier=therapist_id)
        ├─ Find the matching recurring item by ID
        ├─ If Status !== 0 (no longer active at Sumit):
        │     - subscriptions.status = 'cancelled'
        │     - therapists.status = 'approved' (demoted)
        └─ Else: refresh current_period_end from Date_NextBilling
```

### ביטול ע"י אדמין

```
Admin clicks "Demote to approved" in /admin/therapists
    │
    └─ PATCH /api/admin-therapists  { id, status: "approved" }
        ├─ If active subscription exists with morning_token_id:
        │     └─ Call Sumit /billing/recurring/cancel
        │         ├─ Success: subscriptions.status = 'cancelled'
        │         └─ Failure: return 502, NO local change
        │              ("בטלו ידנית ב-Sumit UI לפני שינוי הסטטוס")
        └─ UPDATE therapists SET status='approved', manually_promoted=false
```

### ביטול ע"י לקוח (אין כפתור עצמי כרגע)

מטפל פונה למייל/טלפון של החברה (tpool406@gmail.com / 052-790-6335) → אדמין מבטל דרך התהליך לעיל.

---

## 4. מפת קבצים

### לקוח Sumit (server-side)
| קובץ | מטרה |
|------|------|
| `app/lib/sumit.ts` | לקוח API: chargeQuizPayment, createSubscription, cancelSubscription, listRecurringForCustomer. כל הקריאות עוברות `api()` helper שמעטף Credentials + מטפל ב-Status envelope. |

### API endpoints
| Route | מטרה | אימות |
|-------|------|--------|
| `app/api/payments/sumit-config/route.ts` | GET → מחזיר CompanyID + APIPublicKey ל-frontend | אף אחד (ערכים ציבוריים) |
| `app/api/payments/create-quiz-payment/route.ts` | POST → חיוב חד-פעמי לשאלון | Fingerprint + IP-based rate limit |
| `app/api/payments/create-subscription/route.ts` | POST → חיוב + הוראת קבע | Bearer JWT של Supabase + therapist_id rate limit |
| `app/api/cron/sumit-status-sync/route.ts` | GET → סנכרון יומי | Bearer CRON_SECRET |
| `app/api/cron/cleanup-pending-payments/route.ts` | GET → ניקוי payments stale (>24h pending → failed) | Bearer CRON_SECRET |

### Frontend
| קובץ | מטרה |
|------|------|
| `app/therapists/checkout/page.tsx` | טופס מנוי מטפל (פרטים + כרטיס + tokenize + charge) |
| `app/components/QuizPaymentBlock.tsx` | טופס תשלום שאלון |
| `app/therapists/payment/success/page.tsx` | עמוד תודה אחרי מנוי |
| `app/therapists/payment/failure/page.tsx` | עמוד שגיאה |
| `app/quiz/payment-success/page.tsx` | עמוד תודה אחרי שאלון |
| `app/quiz/payment-failure/page.tsx` | עמוד שגיאה |

### Admin
| קובץ | מטרה |
|------|------|
| `middleware.ts` | מגן על `/admin/*` ו-`/api/admin-*` ב-HTTP Basic Auth (timingSafeEqual) |
| `app/api/admin-therapists/route.ts` | GET/PATCH/DELETE — שינוי סטטוס מטפל. ה-PATCH מבטל אוטומטית ב-Sumit אם המטפל בתשלום |
| `app/admin/therapists/page.tsx` | UI לאדמין לניהול מטפלים |

### Policies (מוצג למשתמש)
| קובץ | מטרה |
|------|------|
| `app/billing-policy/page.tsx` | תקנון הרכישה (15 סעיפים) |
| `app/terms/page.tsx` | תנאי שימוש |
| `app/privacy/page.tsx` | מדיניות פרטיות |
| `app/layout.tsx` | פוטר עם פרטי חברה |

---

## 5. סכמת DB (Supabase)

### `payments`
| עמודה | טיפוס | תיאור |
|--------|------|--------|
| `id` | uuid PK | |
| `payment_type` | enum: `'quiz'` / `'subscription'` / `'subscription_renewal'` | |
| `reference_id` | text | למנוי: `therapist_id`; לשאלון: `fp:<fingerprint>` |
| `amount` | numeric | סכום בסיס (ללא מע"מ). 30 או 120 |
| `status` | enum: `'pending'` / `'completed'` / `'failed'` / `'refunded'` | |
| `metadata` | jsonb | שם, מייל, טלפון, fingerprint, ip לטרסיביליות |
| `morning_document_id` | text | **שם legacy** — שומר Sumit DocumentID. UNIQUE constraint |
| `created_at` | timestamptz | |

### `subscriptions`
| עמודה | טיפוס | תיאור |
|--------|------|--------|
| `id` | uuid PK | |
| `therapist_id` | uuid FK | UNIQUE — מטפל יכול להיות עם רק מנוי אחד |
| `status` | enum: `'active'` / `'cancelled'` / `'past_due'` | |
| `current_period_start` | timestamptz | |
| `current_period_end` | timestamptz | מסונכרן יומית מ-Sumit's `Date_NextBilling` |
| `morning_token_id` | text | **שם legacy** — שומר Sumit `RecurringItem.ID` |
| `updated_at` | timestamptz | |

### `therapists` (עמודות תשלום-רלוונטיות)
| עמודה | טיפוס | משמעות |
|--------|------|--------|
| `status` | text | `'pending'` → `'approved'` → `'paying'` (או `'rejected'`) |
| `promotion_source` | text NULL | מקור הקידום: `'paid'` (Sumit), `'manual'` (אדמין ידני), `'trial'` (ידני עם תפוגה), `NULL` (לא מקודם) |
| `promoted_since` | timestamptz NULL | מתי הופך paying |
| `promoted_until` | timestamptz NULL | תאריך תפוגה לקידום זמני (`trial` / `manual`). NULL = אינסופי |
| `manually_promoted` | boolean | **legacy** — מסונכרן אך לא בשימוש בקוד החדש. יוסר ב-migration עתידי |

### `therapist_audit_log` (חדש מ-2026-05-13)
| עמודה | תיאור |
|--------|--------|
| `id` | uuid PK |
| `therapist_id` | uuid FK |
| `actor_type` | `'admin'` / `'self'` / `'sumit'` / `'cron'` / `'system'` |
| `actor_id` | text NULL |
| `action` | text — לדוגמה `'status_change:approved->paying'` |
| `before_state` | jsonb |
| `after_state` | jsonb |
| `reason` | text NULL |
| `created_at` | timestamptz |

נכתב לכל שינוי סטטוס/קידום. שימושי למעקב אחרי "מי שינה מתי ולמה" ולתשובה ללקוח שמטעין שינוי בטעות.

### `quiz_usage` (הגבלת שאלונים)
| עמודה | תיאור |
|--------|--------|
| `ip` | string — שם מטעה: כולל גם `fp:<hash>` וגם IP |
| `quiz_type` | `'adults'` / `'kids'` |
| `count` | integer — כמה שאלונים נעשו |

הקוד ב-`/api/usage/check` לוקח MAX מבין IP-row ל-fingerprint-row לבדיקת מגבלה. תשלום נספר כקרדיט נוסף מעל הגג של 6 חינמיים.

### Migrations
היסטוריה של schema changes נמצאת ב-`supabase_migration_payments.sql` ו-`supabase/migrations/20260507_payments_security.sql`. **לא לערוך אותם** — רק להוסיף חדשים.

---

## 6. Environment Variables

ב-Vercel: Settings → Environment Variables. כל אחד מוגדר ב-Production + Preview.

### Sumit (הסליקה החיה)
| משתנה | תפקיד | חשיפה |
|--------|-------|--------|
| `SUMIT_COMPANY_ID` | `1892690233` (חשבון העסק ב-Sumit) | ציבורי (נחשף ל-browser דרך sumit-config) |
| `SUMIT_API_KEY` | מפתח פרטי לכל קריאת backend | סודי ⚠️ |
| `SUMIT_API_PUBLIC_KEY` | מפתח ציבורי לטוקניזציה מהדפדפן | ציבורי |

### Cron security
| משתנה | תפקיד |
|--------|-------|
| `CRON_SECRET` | Bearer token שמאמת ש-cron requests מגיעות מ-Vercel cron, לא מבחוץ |

### Supabase
| משתנה | תפקיד |
|--------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL של פרויקט Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | מפתח לקריאה מ-browser (RLS מגן על מה שאסור) |
| `SUPABASE_SERVICE_ROLE_KEY` | מפתח בעל הרשאות מלאות לשרת. עוקף RLS |

### Misc
| משתנה | תפקיד |
|--------|-------|
| `RESEND_API_KEY` | שליחת מיילים (טופס יצירת קשר) |
| `OPENAI_API_KEY` | סוכן AI לסיכום חיבור מטפל-מטופל |
| `ADMIN_USERNAME` | אדמין UI |
| `ADMIN_PASSWORD` | אדמין UI. ⚠️ סיסמה נוכחית חלשה — מומלץ להחליף למחרוזת אקראית 32+ תווים |

---

## 7. Cron jobs (מוגדר ב-`vercel.json`)

| Path | Schedule | מטרה |
|------|----------|------|
| `/api/cron/cleanup-pending-payments` | `15 6 * * *` | מסמן payments תקועים יותר מ-24 שעות כ-`'failed'` |
| `/api/cron/sumit-status-sync` | `0 * * * *` (כל שעה) | מסנכרן סטטוס subscriptions מ-Sumit ל-DB **+** מוריד trials שפג תוקפם **+** שולח מייל ללקוח |
| `/api/cron/weekly-report` | `0 6 * * 0` | דוח שבועי לאדמין (לא קשור לתשלומים) |
| `/api/cron/monthly-admin-report` | `30 6 1 * *` | דוח חודשי (לא קשור לתשלומים) |

הקרון הישן `charge-subscriptions` (שחייב חודשית בעצמו) **הוסר** — Sumit מטפלת בזה. אם תוסיף קרון חדש: Vercel hobby tier מוגבל ל-2 cron schedules; כרגע יש 4, יתכן שעוברים את הגבול והם רצים בסבב או בעיכוב.

---

## 8. הוראות הפעלה — תרחישים נפוצים

### לבטל מנוי של מטפל
1. דשבורד אדמין → `/admin/therapists` → מצא את המטפל
2. שנה סטטוס ל-`approved`
3. הקוד יקרא ל-Sumit cancelSubscription אוטומטית
4. אם נכשל — 502 חזרה, יש לבטל ידנית ב-Sumit UI:
   - Sumit dashboard → סליקת אשראי → חיובים שנשלחו / הוראות קבע
   - מצא את ההוראה (חפש לפי שם הלקוח או ID)
   - לחץ ביטול

### להחזיר כסף ללקוח
1. Sumit dashboard → מסמכים → חפש את המסמך לפי תאריך/לקוח
2. פתח את המסמך → "זיכוי" / "ביטול מסמך"
3. סמן את הסכום (אפשר חלקי או מלא)
4. אישור — Sumit מחזירה אוטומטית לכרטיס דרך UPay

### לעדכן את ה-DB ידנית אחרי החזר
```sql
UPDATE payments SET status = 'refunded' WHERE id = '<payment-uuid>';
```
(לא חובה לפיצ'רים שלנו, אבל טוב לתחקיר עתידי.)

### לקדם מטפל חינם (manual / trial)
1. אדמין → `/admin/therapists` → לחץ "★ שדרג למקודם"
2. **תיפתח חלונית prompt** עם שאלה על תאריך תפוגה:
   - **השאר ריק** → קידום ידני ללא תפוגה (`promotion_source='manual'`)
   - **הזן תאריך עתידי** (YYYY-MM-DD) → trial עם תפוגה (`promotion_source='trial'`, `promoted_until=date`). הקרון השעתי יוריד אוטומטית בתאריך הזה ויישלח למטפל מייל
3. **אין חיוב בפועל** — לא דרך Sumit, לא דרך DB
4. **אם המטפל היה משלם** — הקוד מבטל אוטומטית ב-Sumit ועובר לקידום הידני

### להוריד מטפל ידני חזרה
1. אדמין → סטטוס ל-`approved`
2. הקוד יבדוק אם יש subscription פעיל ב-Sumit (לרוב לא יהיה אצל manual/trial)
3. אם כן (היה משלם אמיתי) — Sumit cancel + DB update
4. **המטפל יקבל מייל אוטומטי** ("ההטבה שלך הסתיימה / החיוב נכשל / קידום הסתיים")
5. שורת audit log נוצרת

---

## 9. בדיקות

### בדיקה ידנית של חיוב חדש (₪141.60 לכיס שלך)

1. הורד את עצמך זמנית: `UPDATE therapists SET status='approved', manually_promoted=false WHERE id=<your-id>`
2. דפדפן incognito → התחבר כמטפל → דשבורד → "שדרוג למסלול המקודם"
3. ב-checkout: מלא פרטים אישיים + פרטי כרטיס אמיתי
4. לחץ "חיוב מאובטח — ₪141.60"
5. וודא:
   - הפנייה ל-`/therapists/payment/success`
   - DB: `payments.status='completed'`, `subscriptions.status='active'`, `morning_token_id` לא null
   - Sumit: דשבורד מציג את העסקה
6. נקה: ביטול ב-Sumit UI + `UPDATE therapists SET ... עם הערכים המקוריים`

### בדיקה אוטומטית (סקריפט node)

לאמת שהאינטגרציה ל-Sumit עובדת ללא תשלום:
```bash
node -e "
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const get = k => (env.split('\n').find(l => l.startsWith(k+'=')) || '').slice(k.length+1).trim();
const companyId = parseInt(get('SUMIT_COMPANY_ID'));
const apiKey = get('SUMIT_API_KEY');

(async () => {
  const r = await fetch('https://api.sumit.co.il/billing/recurring/listforcustomer/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      Credentials: { CompanyID: companyId, APIKey: apiKey },
      Customer: { ExternalIdentifier: 'test-' + Date.now(), SearchMode: 0 },
      IncludeInactive: false
    })
  });
  console.log(await r.json());
})();
"
```
מצופה: `{ Status: 0, Data: { RecurringItems: [] } }`.

---

## 10. Troubleshooting

### "Missing Credentials (CompanyID/PublicAPIKey are missing)"
ב-`/creditguy/vault/tokenizesingleuse/` (ללא json). השתמש ב-`/tokenizesingleusejson/` שמקבל JSON body.

### "Customer item not found" בקריאה ל-cancel
הקוד נכון אבל ייתכן שצריך פרמטר נוסף שלא מתועד ב-Swagger. אם זה ממשיך — לפנות ל-Sumit support. בינתיים, אדמין יכול לבטל ידנית ב-UI.

### חשבונית לא הגיעה למייל אחרי חיוב מנוי
ה-flag `UpdateCustomerByEmail: true` ב-recurring/charge קריטי — בלעדיו Sumit לא שולחת. בקובץ sumit.ts כבר מוגדר. אם זה חוזר — בדוק שהמייל של הלקוח באמת מגיע ל-Customer record ב-Sumit.

### Webhook (אם תפעיל בעתיד)
Sumit לא דוחפים webhooks לאירועי תשלום ישירות. הם כן תומכים ב"Card view triggers" — מערכת CRM שלהם מאפשרת ליצור "תצוגה" שמסננת לפי קריטריון, וכל פעם שכרטיס לקוח נכנס/יוצא מהתצוגה — webhook נשלח. רחוק מאידיאלי לאירועי תשלום. ראה https://help.sumit.co.il/he/articles/11577644.

### Sumit החזירה Status שאינו 0
תוצאה של `api()` היא throw. ראה `app/lib/sumit.ts:60` — הודעת השגיאה כוללת `UserErrorMessage` או `TechnicalErrorDetails`. בלוגים של Vercel.

---

## 11. בעיות ידועות (Followup)

| | תיאור | חומרה |
|---|--------|--------|
| F1 | `cancelSubscription` API — סכימה לא אומתה חיים (החזיר "Customer item not found" בבדיקה). הקוד הקיים הוא ההשערה הסבירה לפי Swagger. | 🟠 |
| F2 | כפתור ביטול עצמי למטפל בדשבורד שלו. כיום ביטול דרך מייל/טלפון לחברה. | 🟡 |
| F3 | מטפל manually_promoted לא יכול לעבור לתשלום אמיתי (`create-subscription` חוסם כל `status='paying'` בלי לבדוק `manually_promoted`). | 🟡 |
| F4 | אין הודעות מייל אוטומטיות על שינויי סטטוס (Resend מותקן, רק לא משתמשים בו פה). | 🟡 |
| F5 | Rate limit `new Map()` לא עמיד ב-cold start של Vercel serverless. לעבור ל-Vercel KV / Supabase counter בעתיד. | 🟡 |
| F6 | סיסמת אדמין `naomi2026` חלשה. לעבור ל-Supabase Auth עם role בעתיד. | 🟠 |
| F7 | שמות עמודות `morning_token_id` ו-`morning_document_id` שורדים מהאינטגרציה הישנה. אפשר לבצע migration לשמות עם `sumit_*` בעתיד. | 🟡 |

---

## 12. היסטוריה

### עד מאי 2026 — Morning + Grow
- Morning: חשבוניות + סליקה
- Grow: אישור Bank-side (audit)
- חיוב חודשי דרך Morning's tokens API — **לא עבד.** Morning לא תומכים ב-merchant-initiated recurring דרך API (תיעוד שלהם: ראה ארכיב הצ'אט מ-2026-05-10 עם תמיכת Morning).
- נשלחו תשלומים ראשונים בהצלחה, אבל החיוב החודשי לא יקרה לעולם → המודל העסקי לא תקין.

### 11.5.2026 — מעבר ל-Sumit
- בחירה: Sumit (המלצת רו"ח, all-in-one, API לטוקנים + מחזורי)
- בדיקת ייצור: חיוב ₪141.60 לכרטיס של בעלים → הוראת קבע ID 1895650730 נוצרה
- צפוי חיוב חודשי ב-11.6.2026 (אמורה לאמת את המעבר הסופית)

### 11.5.2026 — סקירת אבטחה
- מספר תיקונים (timing-safe Basic Auth, race-prevention, name sanitization, admin demote → Sumit cancel)

---

## 13. אנשי קשר

- **Sumit support:** דרך הצ'אט בדשבורד
- **UPay support:** support@upay.co.il | 03-8008729
- **רו"ח:** (להוסיף — לא נשמר במסמכים)
- **כתובת עסק:** (כפי שמופיע ב-footer ובתקנון)
- **טלפון/מייל עסקי (לבקשות ביטול/החזר מלקוחות):** tpool406@gmail.com | 052-790-6335
