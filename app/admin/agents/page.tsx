"use client";

import { useEffect, useState } from "react";

// עמוד השליטה בסוכנים - נבנה מחדש 20/8/26 לפי בקשת המשתמש:
//
//   - לכל סוכן רובריקה מלוא-הרוחב בראש העמוד. לחיצה פותחת את הפרטים של
//     הסוכן הזה בלבד - שאר הסוכנים נשארים שורות סגורות.
//   - בתוך כל סוכן, אותם שלושה חלקים תמיד: "ממתין לך עכשיו" (ההמלצות),
//     "הסקירה האחרונה" (מה נבדק ומה יצא), ו"מה נעשה בעבר" (היסטוריה).
//   - כל סוכן פותח בהסבר בשפה פשוטה מה הוא עושה ואיך לקרוא את המספרים.
//   - גרף עמודות קטן לכל סוכן: התוצרים בכל ריצה לאורך זמן.
//
// עקרון קבוע: שום סוכן לא שולח מייל ולא מבצע פעולה בלי לחיצה מפורשת כאן.

// ─────────────────────────────── טיפוסים ───────────────────────────────

type AgentRun = {
  id: string;
  agent: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "ok" | "empty" | "error";
  mode: string | null;
  summary: string | null;
  error: string | null;
  // מספר אחד לריצה, לגרף: כמה תוצרים הריצה מצאה (ממצאים / פערים / טיוטות;
  // אצל שומר הלילה - כמה בדיקות נכשלו). null = לריצה אין מדד.
  metric: number | null;
};

type LatestDetailsMap = Record<string, { started_at: string; details: unknown }>;

type Prospect = {
  id: string;
  name: string;
  source: "places" | "internal_lead" | "manual";
  city: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  email: string | null;
  gaps_in_region: number;
  contacted_at: string | null;
  answer: "yes" | "no" | "maybe" | null;
  notes: string | null;
  obstacles: string | null;
  draft_subject: string | null;
  draft_body: string | null;
  draft_sent_at: string | null;
};

type GiftCandidate = {
  therapist_id: string;
  full_name: string;
  email: string;
  draft: string;
};

type ActionPayload = {
  region?: string;
  treatment?: string;
  gift_months?: number;
  subject?: string;
  candidates?: GiftCandidate[];
  // טיוטת נדנוד למרכז
  center_id?: string;
  center_name?: string;
  to?: string;
  draft?: string;
  track?: string;
  missing?: string[];
  blocked_on_us?: string[];
  severity?: string;
};

type PendingAction = {
  id: string;
  agent: string;
  action_type: string;
  kind?: "action" | "finding";
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  entity_label: string | null;
  payload: ActionPayload | null;
  created_at: string;
};

type ResolvedAction = {
  id: string;
  agent: string;
  action_type?: string;
  kind?: string;
  title: string;
  status: string;
  status_changed_at: string | null;
  resolution_note?: string | null;
};

type DigestSection = {
  key: string;
  label: string;
  count: number;
  urgent: boolean;
  lines: string[];
  link: string;
};

type DigestPreview = {
  empty: boolean;
  sections: DigestSection[];
  ai_summary: string | null;
  recipients: string[];
};

type LatestDigest = {
  started_at: string;
  status: string;
  sections: DigestSection[];
  ai_summary: string | null;
};

type WatchdogCheck = {
  key: string;
  label?: string;
  ok: boolean;
  skipped?: boolean;
  detail: string;
  ms: number;
};

type WatchdogRun = { checks: WatchdogCheck[]; failures: number };

type SupplyGap = {
  key: string;
  region: string;
  treatment: string;
  events: number;
  candidates: GiftCandidate[];
};

type WaitingGap = { region: string; treatment: string; sentAt: string };

type GapsRun = {
  gift_gaps: SupplyGap[];
  recruit_gaps: SupplyGap[];
  waiting_gaps: WaitingGap[];
};

type AdsRun = {
  configured: boolean;
  findings: { key: string; severity: string; title: string; detail: string }[];
  campaigns: { name: string; utm: string | null; cost: number; clicks: number; contacts: number; cpl: number | null }[];
  spend_mtd: number;
  budget_pace: { expected: number; actual: number } | null;
};

type ConversionsPreview = {
  configured: boolean;
  actions_ready: boolean;
  pending: { payment_id: string; payment_type: string; value_ils: number; paid_at: string; click_id_kind: string }[];
};

// ─────────────────────────── קריאות לשרת ───────────────────────────────

async function postAgents(action: string, extra?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch("/api/admin-agents", {
    method: action === "resolve" ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(action === "resolve" ? extra : { action, ...extra }),
  });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || j.ok !== true) {
    throw new Error(String(j.error ?? `שגיאה (${res.status})`));
  }
  return j;
}

// ───────────────────────── רישום הסוכנים ────────────────────────────────
// כל מה שהעמוד יודע על סוכן יושב כאן. סוכן חדש = אובייקט אחד נוסף.

type AgentMeta = {
  key: string;
  icon: string;
  label: string;
  runAction: string; // שם הפעולה ב-POST
  runLabel: string;
  // מה הסוכן עושה - שפה פשוטה, בלי מונחים טכניים.
  desc: string;
  // איך לקרוא את מה שמוצג - ההסברים שביקש המשתמש.
  howToRead: string[];
  schedule: string;
  chartLabel: string;
  // גרף שבו אפס = טוב (שומר הלילה): עמודות שאינן אפס נצבעות אדום.
  chartGoodWhenZero?: boolean;
  // איפה עוד רואים את הממצאים של הסוכן.
  home?: { href: string; label: string };
};

const AGENTS: AgentMeta[] = [
  {
    key: "daily_digest",
    icon: "☀️",
    label: "בקר הבוקר",
    runAction: "digest_preview",
    runLabel: "הפק דוח עכשיו",
    desc: "עובר כל בוקר על מה שקרה ביממה האחרונה - פניות חדשות, תשלומים, תקלות ומשימות פתוחות - ומרכז הכול לדוח קצר אחד, כדי שלא תצטרך לעבור עמוד-עמוד.",
    howToRead: [
      "הדוח מוצג כאן בעמוד בלבד. שום מייל לא נשלח אליך (ההחלטה שלך: להיכנס ולקרוא כאן).",
      "כל סקציה בדוח היא קישור לעמוד המתאים באדמין, שם מטפלים בפריטים עצמם.",
    ],
    schedule: "רץ אוטומטית כל בוקר ב-08:00",
    chartLabel: "כמה פריטים היו בדוח בכל בוקר",
  },
  {
    key: "watchdog",
    icon: "🌙",
    label: "שומר הלילה",
    runAction: "watchdog_run",
    runLabel: "הרץ בדיקות עכשיו",
    desc: "בודק כל לילה שהאתר באמת עובד: שהעמודים נטענים, שהשאלונים מחזירים תוצאות, שמנוע ההתאמה עונה, ושכל שאר הסוכנים רצים בזמן. כמו טכנאי שעובר על המערכת כשכולם ישנים.",
    howToRead: [
      "\"תקין\" = הבדיקה עברה. \"דולג\" = הבדיקה לא רלוונטית כרגע (למשל סוכן שכובה בכוונה) - זו לא תקלה.",
      "בדיקה שנכשלת פותחת התראה שמוצגת כאן, ונסגרת מעצמה ברגע שהבדיקה חוזרת לעבור.",
    ],
    schedule: "רץ אוטומטית כל לילה ב-05:30",
    chartLabel: "כמה בדיקות נכשלו בכל ריצה (אפס = לילה שקט)",
    chartGoodWhenZero: true,
  },
  {
    key: "supply_gaps",
    icon: "⚖️",
    label: "פערי היצע",
    runAction: "supply_gaps_run",
    runLabel: "נתח פערים עכשיו",
    desc: "מאתר חיתוכים של אזור וסוג טיפול שבהם מטופלים חיפשו ולא היה מספיק מטפלים להציע להם. כשיש מטפל חינמי מתאים - מנסח טיוטת הצעת קידום; כשאין אף אחד - מסמן שכדאי לגייס שם.",
    howToRead: [
      "\"הצעת מתנה\" = יש מטפל חינמי מתאים, והסוכן ניסח לו טיוטה. אתה קורא, מתקן ולוחץ לשלוח - רק אז יוצא מייל.",
      "\"פער גיוס\" = אין לנו אף מטפל מתאים בחיתוך. זו רשימת המקומות שבהם שווה לפרסם גיוס.",
      "\"ממתין לתשובה\" = כבר נשלחה הצעה בחיתוך הזה, ולא מציעים שוב עד שיעברו 21 יום.",
      "מטפל שקיבל הצעה לא יקבל עוד אחת במשך חצי שנה, גם אם החיתוך חוזר.",
    ],
    schedule: "רץ אוטומטית כל יום ראשון ב-08:30",
    chartLabel: "כמה פערים (מתנה + גיוס) נמצאו בכל ריצה",
    home: { href: "/admin/supply-demand", label: "עמוד היצע וביקוש" },
  },
  {
    key: "center_nudge",
    icon: "🏥",
    label: "סוכן המרכזים",
    runAction: "center_nudge_run",
    runLabel: "נסח טיוטות עכשיו",
    desc: "עוקב אחרי המוכנות של המרכזים הטיפוליים לפי המסלול שכל אחד רכש, ומנסח טיוטת תזכורת למרכז שחסר לו משהו - איוש מטפלים במסלול לפי-מטפלים, הגדרות ההתאמה במסלול מרכז-כישות.",
    howToRead: [
      "כל טיוטה ממתינה לך כאן. אתה קורא, מתקן ולוחץ לשלוח - שום מייל לא יוצא לבד.",
      "דבר שתקוע אצלנו (מטפל שממתין לאישור שלנו) מוצג לך, אבל לא נכנס למייל למרכז.",
      "מרכז לא מקבל יותר מתזכורת אחת בשלושה שבועות, ומרכז חדש מקבל שבוע להתארגן לפני הראשונה.",
    ],
    schedule: "רץ אוטומטית כל בוקר ב-10:30",
    chartLabel: "כמה טיוטות נוסחו בכל ריצה",
    home: { href: "/admin/centers", label: "עמוד המרכזים" },
  },
  {
    key: "ads",
    icon: "📣",
    label: "סוכן הפרסום",
    runAction: "ads_run",
    runLabel: "נטר פרסום עכשיו",
    desc: "קורא כל בוקר את נתוני Google Ads: כמה הוצאנו, כמה לחיצות ליצירת קשר יצאו מזה ובאיזה מחיר - ומתריע כשקמפיין שורף כסף בלי תוצאות או בלי מדידה תקינה.",
    howToRead: [
      "\"עלות ללחיצת פנייה\" = כמה שילמנו בגוגל על כל לחיצה של מטופל על וואטסאפ/טלפון של מטפל. מעל ₪250 - הסוכן מתריע.",
      "\"קמפיין בלי utm\" = קמפיין שמוציא כסף ואי אפשר לדעת מה הוא מביא, כי חסר לו תיוג מדידה.",
      "הסוכן קורא בלבד - הוא לא משנה שום דבר בחשבון הפרסום. השהיה או תיקון נעשים ידנית בגוגל.",
    ],
    schedule: "רץ אוטומטית כל בוקר ב-07:00",
    chartLabel: "כמה ממצאי פרסום היו בכל ריצה",
    home: { href: "/admin/ads", label: "עמוד הפרסום" },
  },
  {
    key: "conversions",
    icon: "📈",
    label: "המרות לגוגל",
    runAction: "conversions_preview",
    runLabel: "בדוק מצב",
    desc: "אמור לדווח לגוגל על תשלומים שהגיעו מפרסום, כדי שהאלגוריתם ילמד לכוון לקהל שמשלם. כרגע רדום בכוונה: הוחלט שגוגל מביא מטופלים (שלא משלמים לנו) והלקוחות המשלמים יגיעו ממטא - אז אין לו עדיין מה לדווח.",
    howToRead: [
      "\"אין תשלומים עם מזהה קליק\" = המצב התקין היום. הסוכן יתעורר כשיהיה פרסום במטא.",
      "כפתור ההקמה בחשבון גוגל לא הופעל, וגם לא צריך - עד שיהיה מה לדווח.",
    ],
    schedule: "רץ אוטומטית כל בוקר ב-06:00 (ומחזיר \"אין חדש\")",
    chartLabel: "",
  },
  {
    key: "finance",
    icon: "💰",
    label: "סוכן הכספים",
    runAction: "finance_run",
    runLabel: "התאם חיובים עכשיו",
    desc: "משווה כל בוקר בין מי שמקבל שירות לבין מי שמחויב עליו - מטפלים ומרכזים - ומתריע על כל פער: מקודם בלי חיוב, מחויב בלי קידום, חידוש שלא נגבה, וערבות החזר שלא קוימה.",
    howToRead: [
      "כל ממצא הוא פער בין שתי מערכות: מה שרשום אצלנו מול מה שקורה בסליקה (Sumit). התיקון תמיד ידני - הסוכן רק מצביע.",
      "\"על סמך לחיצות בלבד\" = מטפל שנחשב כמי שקיבל פניות, אבל אף מטופל לא שלח לו הודעה שמורה באתר - רק לחיצות וואטסאפ/טלפון שאי אפשר להוכיח.",
      "ממצא נסגר מעצמו ברגע שהפער נסגר במציאות.",
    ],
    schedule: "רץ אוטומטית כל בוקר ב-10:15, אחרי סנכרון הסליקה",
    chartLabel: "כמה פערי גבייה נמצאו בכל ריצה",
    chartGoodWhenZero: true,
    home: { href: "/admin/finance", label: "עמוד הכספים" },
  },
  {
    key: "retention",
    icon: "🤝",
    label: "שימור מטפלים",
    runAction: "retention_run",
    runLabel: "סרוק סיכונים עכשיו",
    desc: "מזהה לקוח משלם שנמצא במסלול לביטול - לפני שהוא מבטל: מי שלא קיבל אף לחיצת פנייה בחודש, מי שהלחיצות אצלו צנחו, ומי שמתקרב לסוף חלון המתנה בלי תוצאות.",
    howToRead: [
      "\"יש חשיפה ואין המרה\" = מטופלים רואים את הפרופיל אבל לא פונים - כנראה משהו בפרופיל עצמו (תמונה, טקסט).",
      "\"גם החשיפה נמוכה\" = הבעיה בביקוש בחיתוך שלו, לא בפרופיל - שווה הצלבה מול פערי ההיצע.",
      "שום מייל לא נשלח למטפלים האלה. ההחלטה שלך: מיילי ביצועים רק מזכירים לחלשים לבטל.",
    ],
    schedule: "רץ אוטומטית כל בוקר ב-07:45",
    chartLabel: "כמה מטפלים בסיכון נמצאו בכל ריצה",
    chartGoodWhenZero: true,
  },
];

AGENTS.push({
  key: "center_prospects",
  icon: "🧭",
  label: "איתור מכונים",
  runAction: "prospects_run",
  runLabel: "עדכן רשימה עכשיו",
  desc: "בונה ומתחזק רשימת מרכזים טיפוליים שאפשר להפוך ללקוחות: קודם מרכזים שכבר קיבלו מאיתנו הצעה ולא סגרו, ואחריהם מכונים שנמצאו בחיפוש Google באזורים שבהם חסרים לנו מטפלים. בכל ריצה הרשימה מתעדכנת - נוספים חדשים, והקיימים מרועננים בלי לגעת במעקב שלך.",
  howToRead: [
    "הרשימה היא רשימת שיחות. הטור \"פערים באזור\" הוא הדירוג: כמה חוסרים המרכז הזה יכול לסגור.",
    "\"ליד חם\" = מרכז שכבר ביקש מאיתנו הצעה ולא סגר. אלה תמיד בראש - אין טעם לחייג למכון חדש כשמישהו שכבר התעניין ממתין.",
    "סמן \"פנינו\" אחרי שיחה, ואז אפשר לבחור מה ענו ולכתוב הערות ומכשולים. הכול נשמר מיד.",
    "מייל למכון לא נשלח אוטומטית לעולם (חוק הספאם). כפתור הטיוטה נפתח רק אחרי שסימנת שפנית ולא קיבלת תשובה.",
  ],
  schedule: "רץ אוטומטית כל יום שני ב-12:00",
  chartLabel: "כמה מועמדים חדשים נמצאו בכל ריצה",
});

const AGENT_BY_KEY = new Map(AGENTS.map((a) => [a.key, a]));

function agentLabel(agent: string): string {
  return AGENT_BY_KEY.get(agent)?.label ?? agent;
}

// שמות הבדיקות של שומר הלילה בשפה פשוטה. ב-details נשמר רק המפתח הטכני,
// והמשתמש ביקש במפורש פחות ז'רגון.
const WATCHDOG_LABELS: Record<string, string> = {
  page_home: "עמוד הבית נטען",
  page_adults: "עמוד שאלון המבוגרים נטען",
  page_kids: "עמוד שאלון הילדים נטען",
  sitemap: "מפת האתר לגוגל תקינה",
  robots: "קובץ ההנחיות לגוגל תקין",
  api_questions_adults: "שאלות שאלון המבוגרים נטענות",
  api_questions_kids: "שאלות שאלון הילדים נטענות",
  api_score_adults: "מנוע הניקוד למבוגרים עונה",
  api_score_kids: "מנוע הניקוד לילדים עונה",
  api_match_region: "מנוע ההתאמה לפי אזור עונה",
  api_match_online: "מנוע ההתאמה אונליין עונה",
  db_event_constraint: "אירועי האנליטיקה תואמים למאגר",
  cron_daily_digest: "בקר הבוקר רץ בזמן",
  cron_ads: "סוכן הפרסום רץ בזמן",
  cron_conversions: "סוכן ההמרות רץ בזמן",
  cron_finance: "סוכן הכספים רץ בזמן",
  cron_retention: "סוכן השימור רץ בזמן",
  cron_supply_gaps: "סוכן פערי ההיצע רץ השבוע",
  cron_weekly_report: "הדוח השבועי נוצר",
  cron_monthly_report: "הדוח החודשי נוצר",
};

const RUN_STATUS: Record<string, { label: string; cls: string }> = {
  ok: { label: "תקין", cls: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  empty: { label: "אין חדש", cls: "bg-stone-50 border-stone-200 text-stone-500" },
  error: { label: "שגיאה", cls: "bg-red-50 border-red-200 text-red-700" },
  running: { label: "רץ...", cls: "bg-blue-50 border-blue-200 text-blue-700" },
};

// ─────────────────────────── עזרי תצוגה ─────────────────────────────────

function fmtDateTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  });
}

// "לפני 3 שעות" - קריא יותר מחותמת מלאה בכל השורות המשניות.
function relTime(iso: string | null): string {
  if (!iso) return "";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "עכשיו";
  if (mins < 60) return `לפני ${mins} דק'`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours === 1 ? "לפני שעה" : `לפני ${hours} שעות`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "אתמול";
  return `לפני ${days} ימים`;
}

function Collapse({
  title,
  count,
  defaultOpen,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="rounded-xl border border-stone-200 bg-stone-50/60">
      <summary className="cursor-pointer select-none px-4 py-2 text-xs font-black text-stone-500 hover:text-stone-700">
        {title}
        {count != null && <span className="font-normal text-stone-400"> ({count})</span>}
      </summary>
      <div className="border-t border-stone-200 bg-white px-4 py-3 rounded-b-xl">{children}</div>
    </details>
  );
}

// גרף עמודות קטן, בלי ספריות: התוצרים בכל ריצה, מהישן (ימין) לחדש (שמאל).
function MiniBars({
  points,
  label,
  goodWhenZero,
}: {
  points: { at: string; value: number }[];
  label: string;
  goodWhenZero?: boolean;
}) {
  if (points.length < 3) return null;
  const shown = points.slice(-16);
  const max = Math.max(...shown.map((p) => p.value), 1);
  const W = 15;
  const GAP = 5;
  const H = 56;
  const width = shown.length * (W + GAP) - GAP;
  return (
    <div>
      <div className="mb-2 text-xs font-black text-stone-500">{label}</div>
      <div className="overflow-x-auto">
        <svg width={width} height={H + 18} role="img" aria-label={label} style={{ direction: "ltr" }}>
          {shown.map((p, i) => {
            const h = Math.max(2, Math.round((p.value / max) * H));
            const bad = goodWhenZero && p.value > 0;
            return (
              <g key={i}>
                <rect
                  x={i * (W + GAP)}
                  y={H - h}
                  width={W}
                  height={h}
                  rx={3}
                  fill={bad ? "#DC2626" : p.value === 0 ? "#D6D3D1" : "#3D8C8A"}
                >
                  <title>{`${fmtDateTime(p.at)} · ${p.value}`}</title>
                </rect>
                <text x={i * (W + GAP) + W / 2} y={H + 13} textAnchor="middle" fontSize="9" fill="#78716C">
                  {p.value}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-stone-400">
        <span>{fmtDateTime(shown[0].at)}</span>
        <span>{fmtDateTime(shown[shown.length - 1].at)}</span>
      </div>
    </div>
  );
}

// ─────────────────────── כרטיסי שליחה (ללא שינוי) ───────────────────────

// כרטיס טיוטת הנדנוד למרכז: הסוכן ניסח, אתה קורא ומתקן, ואתה שולח.
function CenterNudgeCard({
  action,
  onSent,
  onDismiss,
  dismissing,
  open,
  onToggle,
}: {
  action: PendingAction;
  onSent: (msg: string) => void;
  onDismiss: () => void;
  dismissing: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const p = action.payload ?? {};
  const [subject, setSubject] = useState(p.subject ?? "");
  const [draft, setDraft] = useState(p.draft ?? "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const centerName = p.center_name ?? action.entity_label ?? "המרכז";
  const to = p.to ?? "";

  async function send() {
    if (
      !window.confirm(
        `לשלוח עכשיו את הנדנוד אל ${centerName} (${to})?\n\nהמייל יוצא מיד, בדיוק כפי שהוא מופיע כאן.`
      )
    ) {
      return;
    }
    setSending(true);
    setError("");
    try {
      const j = await postAgents("center_nudge_send", {
        id: action.id,
        center_id: p.center_id ?? "",
        subject,
        body: draft,
      });
      onSent(`הנדנוד נשלח אל ${j.center_name ?? centerName} (${j.email ?? to})`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "השליחה נכשלה");
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-sky-200 bg-white px-4 py-2.5">
        <span className="text-sm font-bold text-stone-800">🏥 {centerName}</span>
        <span className="flex-1 truncate text-xs text-stone-400">
          {p.track ? `${p.track} · ` : ""}
          {(p.missing ?? []).slice(0, 2).join(" · ")}
        </span>
        <button
          onClick={onToggle}
          className="shrink-0 rounded-full border border-[#3D8C8A] px-3 py-1 text-xs font-bold text-[#2A6462] hover:bg-[#EAF4F3]"
        >
          פתח וערוך ▼
        </button>
        <button
          onClick={onDismiss}
          disabled={dismissing}
          className="shrink-0 text-xs text-stone-400 underline hover:text-stone-600 disabled:opacity-50"
        >
          דחה
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-sky-200 bg-white p-5">
      <div className="mb-1 flex items-start justify-between gap-3">
        <h3 className="text-sm font-black text-stone-900">🏥 {centerName}</h3>
        <div className="flex shrink-0 items-center gap-2">
          {p.track && (
            <span className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-0.5 text-xs font-bold text-stone-500">
              {p.track}
            </span>
          )}
          <button onClick={onToggle} className="text-xs font-bold text-stone-400 hover:text-stone-700">
            סגור ▲
          </button>
        </div>
      </div>
      <p className="mb-3 text-xs text-stone-400">נמען: {to || "לא נמצאה כתובת"}</p>

      {(p.blocked_on_us ?? []).length > 0 && (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="text-xs font-black text-amber-800">תקוע אצלנו - לא נכנס למייל</div>
          <ul className="mt-1 list-inside list-disc text-xs text-amber-800">
            {(p.blocked_on_us ?? []).map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      <label className="mb-1 block text-xs font-black text-stone-400">נושא</label>
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        disabled={sending}
        className="mb-3 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm disabled:opacity-50"
      />

      <label className="mb-1 block text-xs font-black text-stone-400">גוף המייל (ניתן לעריכה)</label>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        disabled={sending}
        rows={16}
        className="w-full rounded-xl border border-stone-300 p-3 text-sm leading-6 disabled:opacity-50"
      />

      {error && (
        <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={send}
          disabled={sending || dismissing || !to || !draft.trim()}
          className="rounded-full bg-[#2e7d8c] px-4 py-1.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
        >
          {sending ? "שולח..." : "📤 שלח למרכז"}
        </button>
        <button
          onClick={onDismiss}
          disabled={sending || dismissing}
          className="rounded-full border border-stone-300 px-4 py-1.5 text-sm font-bold text-stone-600 hover:bg-stone-50 disabled:opacity-50"
        >
          ✕ דחה
        </button>
      </div>
    </div>
  );
}

// כרטיס הצעת המתנה: בחירת נמען מבין המועמדים, עריכת הטיוטה, ושליחה בפועל.
function GiftOfferCard({
  action,
  onSent,
  onDismiss,
  dismissing,
  open,
  onToggle,
}: {
  action: PendingAction;
  onSent: (msg: string) => void;
  onDismiss: () => void;
  dismissing: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const candidates: GiftCandidate[] = (action.payload?.candidates ?? []).map((c) => ({
    ...c,
    draft: c.draft ?? "",
  }));
  const [selectedId, setSelectedId] = useState(candidates[0]?.therapist_id ?? "");
  const [subject, setSubject] = useState(action.payload?.subject ?? "הצעת קידום במתנה לחודשיים - טיפול חכם");
  const [draft, setDraft] = useState(candidates[0]?.draft ?? "");
  const [edited, setEdited] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const selected = candidates.find((c) => c.therapist_id === selectedId) ?? null;

  function pickCandidate(c: GiftCandidate) {
    if (c.therapist_id === selectedId) return;
    if (edited && !window.confirm(`להחליף את הנמען ל${c.full_name}? הטיוטה תוחלף בטיוטה שלו/ה והעריכות שלך יאבדו.`)) {
      return;
    }
    setSelectedId(c.therapist_id);
    setDraft(c.draft);
    setEdited(false);
    setError("");
  }

  async function send() {
    if (!selected) return;
    if (
      !window.confirm(
        `לשלוח עכשיו את הצעת הקידום במתנה אל ${selected.full_name} (${selected.email})?\n\nהמייל יוצא מיד. הקידום עצמו לא יינתן אוטומטית - הוא מוענק ידנית אחרי שהמטפל משיב.`
      )
    ) {
      return;
    }
    setSending(true);
    setError("");
    try {
      const j = await postAgents("gift_offer_send", {
        id: action.id,
        therapist_id: selected.therapist_id,
        subject,
        body: draft,
      });
      const left = Array.isArray(j.remaining) ? (j.remaining as string[]) : [];
      const days = typeof j.reoffer_after_days === "number" ? j.reoffer_after_days : null;
      onSent(
        `ההצעה נשלחה אל ${selected.full_name} (${selected.email})` +
          (left.length > 0
            ? ` · ${left.join(", ")} נשמרו לגיבוי${
                days ? ` ויוצעו מחדש בעוד ${days} יום אם לא תגיע תשובה` : ""
              }`
            : "")
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "השליחה נכשלה");
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-white px-4 py-2.5">
        <span className="text-sm font-bold text-stone-800">🎁 {action.title}</span>
        <span className="flex-1 truncate text-xs text-stone-400">
          {candidates.length
            ? `${candidates.length} מועמדים · ${candidates[0].full_name}${candidates.length > 1 ? " ואחרים" : ""}`
            : "אין מועמדים בהצעה הזו"}
        </span>
        <button
          onClick={onToggle}
          className="shrink-0 rounded-full border border-[#3D8C8A] px-3 py-1 text-xs font-bold text-[#2A6462] hover:bg-[#EAF4F3]"
        >
          פתח וערוך ▼
        </button>
        <button
          onClick={onDismiss}
          disabled={dismissing}
          className="shrink-0 text-xs text-stone-400 underline hover:text-stone-600 disabled:opacity-50"
        >
          דחה
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-emerald-200 bg-white p-5">
      <div className="mb-1 flex items-start justify-between gap-3">
        <h3 className="text-sm font-black text-stone-900">🎁 {action.title}</h3>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-0.5 text-xs font-bold text-stone-500">
            {agentLabel(action.agent)}
          </span>
          <button onClick={onToggle} className="text-xs font-bold text-stone-400 hover:text-stone-700">
            סגור ▲
          </button>
        </div>
      </div>
      {action.body && <p className="mb-3 text-sm leading-6 text-stone-600 whitespace-pre-line">{action.body}</p>}

      {candidates.length === 0 ? (
        <p className="text-sm text-amber-700">
          אין מועמדים בהצעה הזו - היא נוצרה לפני שמסלול השליחה קיים. אפשר לדחות ולהריץ ניתוח פערים מחדש.
        </p>
      ) : (
        <>
          <div className="mb-3">
            <div className="mb-1 text-xs font-black text-stone-400">נמען</div>
            <div className="flex flex-wrap gap-2">
              {candidates.map((c) => (
                <button
                  key={c.therapist_id}
                  onClick={() => pickCandidate(c)}
                  disabled={sending}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${
                    c.therapist_id === selectedId
                      ? "border-[#3D8C8A] bg-[#EAF4F3] text-[#2A6462]"
                      : "border-stone-300 text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  {c.full_name}
                  <span className="font-normal text-stone-400"> · {c.email}</span>
                </button>
              ))}
            </div>
          </div>

          <label className="mb-1 block text-xs font-black text-stone-400">נושא</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={sending}
            className="mb-3 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm disabled:opacity-50"
          />

          <label className="mb-1 block text-xs font-black text-stone-400">גוף המייל (ניתן לעריכה)</label>
          <textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setEdited(true);
            }}
            disabled={sending}
            rows={12}
            className="w-full rounded-xl border border-stone-300 p-3 text-sm leading-6 disabled:opacity-50"
          />

          {!draft.trim() && (
            <p className="mt-2 text-xs text-amber-700">
              אין טיוטה להצעה הזו (היא נוצרה לפני מסלול השליחה). אפשר לכתוב טקסט כאן, או לדחות ולהריץ
              ניתוח פערים מחדש כדי לקבל טיוטה מנוסחת.
            </p>
          )}

          {error && (
            <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={send}
              disabled={sending || dismissing || !selected || !draft.trim()}
              className="rounded-full bg-[#2e7d8c] px-5 py-1.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
            >
              {sending ? "שולח..." : "📤 שלח הצעה"}
            </button>
            <button
              onClick={onDismiss}
              disabled={sending || dismissing}
              className="rounded-full border border-stone-300 px-4 py-1.5 text-sm font-bold text-stone-600 hover:bg-stone-50 disabled:opacity-50"
            >
              ✕ דחה
            </button>
            <span className="text-xs text-stone-400">
              המייל יוצא רק מהלחיצה הזו. הקידום עצמו מוענק ידנית מעמוד המטפלים אחרי תשובה.
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// טבלת מועמדים - רשימת השיחות. עריכה נשמרת מיד, בלי כפתור שמירה: זו
// טבלת עבודה שמתעדכנת תוך כדי שיחת טלפון, ולא טופס.
function ProspectTable({
  rows,
  onChanged,
  onNotify,
}: {
  rows: Prospect[];
  onChanged: (rows: Prospect[]) => void;
  onNotify: (msg: string, isError?: boolean) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [draftFor, setDraftFor] = useState<string | null>(null);
  const [draft, setDraft] = useState<{
    subject: string;
    body: string;
    email: string;
    source: "ai" | "template";
    facts: string[];
    note: string | null;
  }>({ subject: "", body: "", email: "", source: "template", facts: [], note: null });

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(id);
    try {
      const j = await postAgents("prospect_update", { id, ...body });
      if (Array.isArray(j.prospects)) onChanged(j.prospects as Prospect[]);
    } catch (e) {
      onNotify(e instanceof Error ? e.message : "העדכון נכשל", true);
    } finally {
      setBusy(null);
    }
  }

  async function makeDraft(p: Prospect) {
    setBusy(p.id);
    try {
      const j = await postAgents("prospect_draft", { id: p.id });
      setDraft({
        subject: String(j.subject ?? ""),
        body: String(j.body ?? ""),
        email: p.email ?? "",
        source: j.source === "ai" ? "ai" : "template",
        facts: Array.isArray(j.facts) ? (j.facts as string[]) : [],
        note: typeof j.note === "string" ? j.note : null,
      });
      setDraftFor(p.id);
    } catch (e) {
      onNotify(e instanceof Error ? e.message : "יצירת הטיוטה נכשלה", true);
    } finally {
      setBusy(null);
    }
  }

  async function sendDraft(p: Prospect) {
    if (!window.confirm(`לשלוח את הפנייה אל ${p.name} (${draft.email})?\n\nהמייל יוצא מיד, בדיוק כפי שהוא כאן.`))
      return;
    setBusy(p.id);
    try {
      const j = await postAgents("prospect_send", { id: p.id, ...draft });
      onNotify(`הפנייה נשלחה אל ${j.name ?? p.name} (${j.email ?? draft.email})`);
      setDraftFor(null);
      const refreshed = await postAgents("prospect_update", { id: p.id });
      if (Array.isArray(refreshed.prospects)) onChanged(refreshed.prospects as Prospect[]);
    } catch (e) {
      onNotify(e instanceof Error ? e.message : "השליחה נכשלה", true);
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-stone-400">
        הרשימה ריקה. הרץ את הסוכן כדי לבנות אותה - הוא יתחיל מהמרכזים שכבר קיבלו הצעה ולא סגרו.
      </p>
    );
  }

  const answerChip = (p: Prospect) => {
    const opts: { v: "yes" | "no" | "maybe"; label: string; cls: string }[] = [
      { v: "yes", label: "כן", cls: "bg-emerald-600 text-white" },
      { v: "maybe", label: "?", cls: "bg-amber-500 text-white" },
      { v: "no", label: "לא", cls: "bg-stone-500 text-white" },
    ];
    return (
      <div className="flex gap-1">
        {opts.map((o) => (
          <button
            key={o.v}
            onClick={() => patch(p.id, { answer: p.answer === o.v ? null : o.v })}
            disabled={busy === p.id || !p.contacted_at}
            title={p.contacted_at ? "" : "סמנו קודם שפניתם"}
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold disabled:opacity-40 ${
              p.answer === o.v ? o.cls : "border border-stone-300 bg-white text-stone-500 hover:bg-stone-50"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-stone-200">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-xs text-stone-500">
              <th className="p-2 text-right font-bold">מרכז</th>
              <th className="p-2 text-right font-bold">טלפון</th>
              <th className="p-2 text-center font-bold">פערים באזור</th>
              <th className="p-2 text-center font-bold">פנינו</th>
              <th className="p-2 text-center font-bold">ענו</th>
              <th className="p-2 text-right font-bold">הערות</th>
              <th className="p-2 text-right font-bold">מכשולים</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className={`border-b border-stone-100 ${p.answer === "no" ? "opacity-50" : ""}`}>
                <td className="p-2 align-top">
                  <div className="flex items-center gap-1.5">
                    {p.source === "internal_lead" && (
                      <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-black text-red-700">
                        ליד חם
                      </span>
                    )}
                    <span className="font-bold text-stone-800">{p.name}</span>
                  </div>
                  <div className="text-xs text-stone-400">
                    {[p.city, p.address].filter(Boolean).join(" · ").slice(0, 60)}
                  </div>
                  {p.website && (
                    <a href={p.website} target="_blank" rel="noopener noreferrer" className="text-xs text-[#2A6462] underline">
                      אתר
                    </a>
                  )}
                </td>
                <td className="whitespace-nowrap p-2 align-top text-stone-600">
                  {p.phone ? <a href={`tel:${p.phone}`} className="font-bold text-[#2A6462]">{p.phone}</a> : "-"}
                </td>
                <td className="p-2 text-center align-top">
                  {p.gaps_in_region > 0 ? (
                    <span className="rounded-full bg-[#EAF4F3] px-2 py-0.5 text-xs font-black text-[#2A6462]">
                      {p.gaps_in_region}
                    </span>
                  ) : (
                    <span className="text-xs text-stone-300">-</span>
                  )}
                </td>
                <td className="p-2 text-center align-top">
                  <input
                    type="checkbox"
                    checked={!!p.contacted_at}
                    disabled={busy === p.id}
                    onChange={(e) => patch(p.id, { contacted: e.target.checked })}
                    className="h-4 w-4 accent-[#2e7d8c]"
                  />
                </td>
                <td className="p-2 align-top">{answerChip(p)}</td>
                <td className="p-2 align-top">
                  <input
                    defaultValue={p.notes ?? ""}
                    onBlur={(e) => e.target.value !== (p.notes ?? "") && patch(p.id, { notes: e.target.value })}
                    placeholder="מה נאמר"
                    className="w-40 rounded-lg border border-stone-200 px-2 py-1 text-xs"
                  />
                </td>
                <td className="p-2 align-top">
                  <input
                    defaultValue={p.obstacles ?? ""}
                    onBlur={(e) => e.target.value !== (p.obstacles ?? "") && patch(p.id, { obstacles: e.target.value })}
                    placeholder="מה חוסם"
                    className="w-36 rounded-lg border border-stone-200 px-2 py-1 text-xs"
                  />
                </td>
                <td className="whitespace-nowrap p-2 align-top">
                  {p.draft_sent_at ? (
                    <span className="text-[11px] text-stone-400">מייל נשלח</span>
                  ) : p.contacted_at && !p.answer ? (
                    <button
                      onClick={() => makeDraft(p)}
                      disabled={busy === p.id}
                      className="rounded-full border border-stone-300 px-2.5 py-1 text-[11px] font-bold text-stone-600 hover:bg-stone-50 disabled:opacity-50"
                    >
                      טיוטה
                    </button>
                  ) : null}
                  <button
                    onClick={() => patch(p.id, { dismissed: true })}
                    disabled={busy === p.id}
                    className="ms-1 text-[11px] text-stone-400 underline hover:text-stone-600"
                  >
                    הסר
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {draftFor && (
        <div className="rounded-2xl border border-sky-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-sm font-black text-stone-800">
              טיוטת פנייה - {rows.find((r) => r.id === draftFor)?.name}
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  draft.source === "ai"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-stone-100 text-stone-600"
                }`}
              >
                {draft.source === "ai" ? "נכתב ב-AI" : "תבנית קבועה"}
              </span>
            </h4>
            <button onClick={() => setDraftFor(null)} className="text-xs text-stone-400 underline">
              סגור
            </button>
          </div>
          {draft.source === "ai" && (
            <div className="mb-3 rounded-xl border-2 border-amber-400 bg-amber-50 p-4">
              <p className="text-sm font-black text-amber-900">
                ⚠️ הטיוטה הזו נכתבה על ידי AI אחרי קריאת האתר של המכון - חובה לאמת כל פרט לפני שליחה
              </p>
              <p className="mt-1 text-xs leading-5 text-amber-800">
                מודל שפה יכול לטעות בפרט או להסיק דבר שלא נאמר. עברו על המשפט האישי מול האתר שלהם,
                ותקנו כל מה שלא מדויק. הטקסט יוצא בשמך.
              </p>
              {draft.facts.length > 0 && (
                <div className="mt-2">
                  <div className="text-xs font-black text-amber-900">הפרטים שהמודל לקח מהאתר - אלה מה שצריך לאמת:</div>
                  <ul className="mt-1 list-inside list-disc text-xs text-amber-800">
                    {draft.facts.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {draft.note && (
            <p className="mb-3 rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs text-stone-500">
              {draft.note}
            </p>
          )}
          <p className="mb-3 text-xs text-amber-700">
            מייל קר לעסק מוסדר בחוק הספאם. שלח רק אם ניסית להשיג אותם בטלפון ולא הצלחת, ורק אחרי שקראת את
            הטקסט.
          </p>
          <label className="mb-1 block text-xs font-black text-stone-400">כתובת המייל (יש להשלים ידנית)</label>
          <input
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            placeholder="info@example.co.il"
            className="mb-2 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
          />
          <label className="mb-1 block text-xs font-black text-stone-400">נושא</label>
          <input
            value={draft.subject}
            onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
            className="mb-2 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
          />
          <label className="mb-1 block text-xs font-black text-stone-400">גוף המייל</label>
          <textarea
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            rows={14}
            className="w-full rounded-xl border border-stone-300 p-3 text-sm leading-6"
          />
          <button
            onClick={() => {
              const p = rows.find((r) => r.id === draftFor);
              if (p) sendDraft(p);
            }}
            disabled={busy === draftFor || !draft.email.includes("@")}
            className="mt-3 rounded-full bg-[#2e7d8c] px-5 py-1.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            שלח פנייה
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────── העמוד ──────────────────────────────────

export default function AgentsPage() {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [latestDetails, setLatestDetails] = useState<LatestDetailsMap>({});
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [placesReady, setPlacesReady] = useState(true);
  const [pending, setPending] = useState<PendingAction[]>([]);
  const [resolved, setResolved] = useState<ResolvedAction[]>([]);
  const [latestDigest, setLatestDigest] = useState<LatestDigest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionMsg, setActionMsg] = useState("");

  // הסוכן שפתוח כרגע - אחד בלבד, כל השאר שורות סגורות (בקשת המשתמש 20/8).
  const [selected, setSelected] = useState<string | null>(null);
  const [openOffer, setOpenOffer] = useState<string | null>(null);
  const [openNudge, setOpenNudge] = useState<string | null>(null);
  const [busyAgent, setBusyAgent] = useState<string | null>(null);

  // תוצרי הרצה ידנית - מוצגים ב"סקירה האחרונה" של הסוכן שהורץ.
  const [preview, setPreview] = useState<DigestPreview | null>(null);
  const [watchdog, setWatchdog] = useState<WatchdogRun | null>(null);
  const [gaps, setGaps] = useState<GapsRun | null>(null);
  const [ads, setAds] = useState<AdsRun | null>(null);
  const [conv, setConv] = useState<ConversionsPreview | null>(null);
  const [runError, setRunError] = useState("");

  const LEGACY_INFO_TYPES = ["recruit_gap", "alert"];
  const isFinding = (a: PendingAction) =>
    a.kind ? a.kind === "finding" : LEGACY_INFO_TYPES.includes(a.action_type);

  function load() {
    setLoading(true);
    setError("");
    fetch("/api/admin-agents")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          setRuns(j.runs ?? []);
          setLatestDetails(j.latest_details ?? {});
          setProspects(j.prospects ?? []);
          setPlacesReady(j.places_configured !== false);
          setPending(j.pending_actions ?? []);
          setResolved(j.resolved_actions ?? []);
          setLatestDigest(j.latest_digest ?? null);
        } else setError(j.error || "שגיאה בטעינה");
      })
      .catch(() => setError("שגיאה בטעינה"))
      .finally(() => setLoading(false));
  }

  // הסוכן הנבחר נשמר בכתובת (?agent=) - רענון או קישור חוזרים לאותו מקום.
  useEffect(() => {
    load();
    const fromUrl = new URLSearchParams(window.location.search).get("agent");
    // תמיד יש סוכן פתוח: הטאבים למעלה הם הניווט, והמסך הוא דף הסוכן.
    setSelected(fromUrl && AGENT_BY_KEY.has(fromUrl) ? fromUrl : "daily_digest");
  }, []);

  function selectAgent(key: string | null) {
    setSelected(key);
    setRunError("");
    const url = new URL(window.location.href);
    if (key) url.searchParams.set("agent", key);
    else url.searchParams.delete("agent");
    window.history.replaceState(null, "", url.toString());
  }

  // הרצה ידנית של סוכן. פותחת את הפאנל שלו - מי שמריץ רוצה לראות תוצאה.
  async function runAgent(meta: AgentMeta) {
    selectAgent(meta.key);
    setBusyAgent(meta.key);
    setRunError("");
    setActionMsg("");
    setActionError("");
    try {
      const j = await postAgents(meta.runAction);
      if (meta.key === "daily_digest") setPreview(j as unknown as DigestPreview);
      if (meta.key === "watchdog") setWatchdog(j as unknown as WatchdogRun);
      if (meta.key === "supply_gaps") setGaps(j as unknown as GapsRun);
      if (meta.key === "ads") setAds(j as unknown as AdsRun);
      if (meta.key === "conversions") setConv(j as unknown as ConversionsPreview);
      load();
    } catch (e) {
      setRunError(e instanceof Error ? e.message : "ההרצה נכשלה");
    } finally {
      setBusyAgent(null);
    }
  }

  async function conversionsSetup() {
    if (
      !window.confirm(
        "להקים בחשבון Google Ads שתי פעולות המרה (רכישת שאלון, מנוי מטפל)? זו פעולה חד-פעמית בחשבון הפרסום."
      )
    )
      return;
    setBusyAgent("conversions");
    setRunError("");
    try {
      await postAgents("conversions_setup");
      setActionMsg("פעולות ההמרה קיימות בחשבון ✓");
      load();
    } catch (e) {
      setRunError(e instanceof Error ? e.message : "שגיאה בהקמה");
    } finally {
      setBusyAgent(null);
    }
  }

  async function resolveAction(id: string, status: "approved" | "dismissed" | "pending") {
    setBusyId(id);
    setActionError("");
    setActionMsg("");
    try {
      await postAgents("resolve", { id, status });
      load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "הפעולה נכשלה");
      load();
    } finally {
      setBusyId(null);
    }
  }

  async function dismissMany(items: PendingAction[], what: string) {
    if (items.length === 0) return;
    if (
      !window.confirm(
        `לנקות ${items.length} ${what}?\n\nלא נשלח שום מייל. מה שעדיין רלוונטי ייווצר מחדש בריצה הבאה של הסוכן.`
      )
    )
      return;
    setBulkBusy(true);
    setActionError("");
    setActionMsg("");
    try {
      const j = await postAgents("resolve", { ids: items.map((f) => f.id), status: "dismissed" });
      setActionMsg(`${j.dismissed ?? 0} נוקו מהתור`);
      load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "הניקוי נכשל");
      load();
    } finally {
      setBulkBusy(false);
    }
  }

  // ─────────────────────── תצוגות פנימיות ────────────────────────────────

  function StatusChip({ run }: { run: AgentRun | undefined }) {
    if (!run) return <span className="text-[11px] text-stone-400">טרם רץ</span>;
    const st = RUN_STATUS[run.status] ?? RUN_STATUS.running;
    return (
      <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${st.cls}`}>{st.label}</span>
    );
  }

  // הסקירה האחרונה: מה שנשמר מהריצה התקינה האחרונה, מוצג בשפה של בני אדם.
  function LastReview({ meta }: { meta: AgentMeta }) {
    const stored = latestDetails[meta.key];
    const d = (stored?.details ?? null) as Record<string, unknown> | null;
    const when = stored ? `נכון ל-${fmtDateTime(stored.started_at)}` : "";

    // בקר הבוקר - הדוח המלא האחרון.
    if (meta.key === "daily_digest") {
      const src = preview ?? latestDigest;
      if (!src) return <p className="text-sm text-stone-400">עדיין אין דוח - אפשר להפיק עכשיו.</p>;
      const sections = (src.sections ?? []) as DigestSection[];
      return (
        <div className="space-y-3">
          {"started_at" in src && (
            <p className="text-xs text-stone-400">הדוח האחרון נוצר {relTime((src as LatestDigest).started_at)}</p>
          )}
          {src.ai_summary && (
            <div className="rounded-xl border border-teal-100 bg-[#EAF4F3] p-3 text-sm leading-6 text-stone-700">
              {src.ai_summary}
            </div>
          )}
          {sections.length === 0 && <p className="text-sm text-stone-400">אין פריטים - בוקר שקט.</p>}
          {sections.map((s) => (
            <div key={s.key} className="rounded-xl border border-stone-200 bg-white p-3">
              <a href={s.link} className="text-sm font-black text-stone-800 hover:underline">
                {s.urgent ? "🔴 " : ""}
                {s.label} ({s.count})
              </a>
              <ul className="mt-1 space-y-0.5">
                {s.lines.slice(0, 6).map((l, i) => (
                  <li key={i} className="text-xs leading-5 text-stone-500">
                    {l}
                  </li>
                ))}
                {s.lines.length > 6 && <li className="text-xs text-stone-400">ועוד {s.lines.length - 6}...</li>}
              </ul>
            </div>
          ))}
        </div>
      );
    }

    // שומר הלילה - כל הבדיקות, עם השמות הפשוטים.
    if (meta.key === "watchdog") {
      const checks: WatchdogCheck[] =
        watchdog?.checks ??
        ((Array.isArray(d?.checks) ? (d?.checks as WatchdogCheck[]) : []) || []);
      if (checks.length === 0) return <p className="text-sm text-stone-400">עדיין אין ריצה - אפשר להריץ עכשיו.</p>;
      const failed = checks.filter((c) => !c.ok && !c.skipped);
      const skipped = checks.filter((c) => c.skipped);
      const passed = checks.filter((c) => c.ok && !c.skipped);
      return (
        <div className="space-y-2">
          <p className="text-sm text-stone-600">
            {failed.length === 0
              ? `כל ${passed.length} הבדיקות עברו ✓`
              : `${failed.length} בדיקות נכשלו מתוך ${checks.length}`}
            {skipped.length > 0 && ` · ${skipped.length} דולגו`}
            {when && <span className="text-xs text-stone-400"> · {when}</span>}
          </p>
          {failed.map((c) => (
            <div key={c.key} className="rounded-xl border border-red-200 bg-red-50 p-3">
              <div className="text-sm font-bold text-red-700">✗ {c.label ?? WATCHDOG_LABELS[c.key] ?? c.key}</div>
              <div className="text-xs text-red-600">{c.detail}</div>
            </div>
          ))}
          <Collapse title="כל הבדיקות" count={checks.length}>
            <ul className="space-y-1">
              {checks.map((c) => (
                <li key={c.key} className="flex items-baseline gap-2 text-sm">
                  <span>{c.skipped ? "⊘" : c.ok ? "✓" : "✗"}</span>
                  <span className={c.skipped ? "text-stone-400" : c.ok ? "text-stone-600" : "font-bold text-red-700"}>
                    {c.label ?? WATCHDOG_LABELS[c.key] ?? c.key}
                  </span>
                  {c.skipped && <span className="text-xs text-stone-400">({c.detail})</span>}
                </li>
              ))}
            </ul>
          </Collapse>
        </div>
      );
    }

    // פערי היצע - מהריצה הידנית (עשיר) או מהשמור.
    if (meta.key === "supply_gaps") {
      if (gaps) {
        return (
          <div className="space-y-2 text-sm">
            <p className="text-stone-600">
              🎁 {gaps.gift_gaps.length} הצעות מתנה · 🧲 {gaps.recruit_gaps.length} פערי גיוס · ⏳{" "}
              {gaps.waiting_gaps.length} ממתינים לתשובה
            </p>
            {gaps.recruit_gaps.length > 0 && (
              <Collapse title="איפה כדאי לגייס (אין לנו אף מטפל מתאים)" count={gaps.recruit_gaps.length}>
                <ul className="space-y-1 text-xs text-stone-600">
                  {gaps.recruit_gaps.map((g) => (
                    <li key={g.key}>
                      {g.treatment} · {g.region} · {g.events} מטופלים חיפשו
                    </li>
                  ))}
                </ul>
              </Collapse>
            )}
          </div>
        );
      }
      const gift = Array.isArray(d?.gift) ? (d?.gift as { region: string; treatment: string; events: number }[]) : [];
      const recruit = Array.isArray(d?.recruit)
        ? (d?.recruit as { region: string; treatment: string; events: number }[])
        : [];
      const waiting = Array.isArray(d?.waiting) ? (d?.waiting as WaitingGap[]) : [];
      if (!stored) return <p className="text-sm text-stone-400">עדיין אין ריצה - אפשר להריץ עכשיו.</p>;
      return (
        <div className="space-y-2 text-sm">
          <p className="text-stone-600">
            🎁 {gift.length} הצעות מתנה · 🧲 {recruit.length} פערי גיוס · ⏳ {waiting.length} ממתינים לתשובה
            <span className="text-xs text-stone-400"> · {when}</span>
          </p>
          {recruit.length > 0 && (
            <Collapse title="איפה כדאי לגייס (אין לנו אף מטפל מתאים)" count={recruit.length}>
              <ul className="space-y-1 text-xs text-stone-600">
                {recruit.map((g, i) => (
                  <li key={i}>
                    {g.treatment} · {g.region} · {g.events} מטופלים חיפשו
                  </li>
                ))}
              </ul>
            </Collapse>
          )}
          {waiting.length > 0 && (
            <Collapse title="הצעות שכבר נשלחו וממתינות לתשובה" count={waiting.length}>
              <ul className="space-y-1 text-xs text-stone-600">
                {waiting.map((w, i) => (
                  <li key={i}>
                    {w.treatment} · {w.region} · נשלח {relTime(w.sentAt)}
                  </li>
                ))}
              </ul>
            </Collapse>
          )}
        </div>
      );
    }

    // סוכן המרכזים.
    if (meta.key === "center_nudge") {
      if (!stored) return <p className="text-sm text-stone-400">עדיין אין ריצה - אפשר להריץ עכשיו.</p>;
      const proposals = Array.isArray(d?.proposals) ? (d?.proposals as { center: string; subject: string }[]) : [];
      const skipped = Array.isArray(d?.skipped) ? (d?.skipped as unknown[]) : [];
      return (
        <div className="space-y-2 text-sm">
          <p className="text-stone-600">
            {proposals.length > 0
              ? `${proposals.length} טיוטות נוסחו בריצה האחרונה`
              : "אף מרכז לא היה צריך תזכורת בריצה האחרונה"}
            <span className="text-xs text-stone-400"> · {when}</span>
          </p>
          {proposals.length > 0 && (
            <ul className="space-y-1 text-xs text-stone-600">
              {proposals.map((p, i) => (
                <li key={i}>🏥 {p.center} - {p.subject}</li>
              ))}
            </ul>
          )}
          {skipped.length > 0 && (
            <p className="text-xs text-stone-400">{skipped.length} מרכזים דולגו (שלמים, טריים מדי, או שכבר קיבלו לאחרונה).</p>
          )}
        </div>
      );
    }

    // סוכן הפרסום.
    if (meta.key === "ads") {
      const campaigns = ads?.campaigns ?? (Array.isArray(d?.campaigns) ? (d?.campaigns as AdsRun["campaigns"]) : []);
      const spend = ads?.spend_mtd ?? (typeof d?.spend_mtd === "number" ? (d?.spend_mtd as number) : null);
      const findingsList =
        ads?.findings ??
        (Array.isArray(d?.findings) ? (d?.findings as { title: string; severity?: string }[]) : []);
      if (!stored && !ads) return <p className="text-sm text-stone-400">עדיין אין ריצה - אפשר להריץ עכשיו.</p>;
      return (
        <div className="space-y-2 text-sm">
          <p className="text-stone-600">
            {spend != null && <>הוצאה החודש: ₪{Math.round(spend).toLocaleString("he-IL")} · </>}
            {findingsList.length > 0 ? `${findingsList.length} ממצאים` : "אין ממצאים - הקמפיינים בגבולות היעד"}
            {when && <span className="text-xs text-stone-400"> · {when}</span>}
          </p>
          {findingsList.length > 0 && (
            <ul className="space-y-1 text-xs text-stone-600">
              {findingsList.map((f, i) => (
                <li key={i}>
                  {f.severity === "high" ? "🔴" : "🟡"} {f.title}
                </li>
              ))}
            </ul>
          )}
          {campaigns.length > 0 && (
            <Collapse title="קמפיינים (7 ימים)" count={campaigns.length}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-400">
                      <th className="py-1 pe-2 text-right font-semibold">קמפיין</th>
                      <th className="px-2 text-center font-semibold">עלות</th>
                      <th className="px-2 text-center font-semibold">לחיצות</th>
                      <th className="px-2 text-center font-semibold">לחיצות פנייה</th>
                      <th className="px-2 text-center font-semibold">עלות ללחיצת פנייה</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((c, i) => (
                      <tr key={i} className="border-b border-stone-100">
                        <td className="py-1 pe-2 font-semibold text-stone-700">{c.name}</td>
                        <td className="px-2 text-center">₪{Math.round(c.cost)}</td>
                        <td className="px-2 text-center">{c.clicks}</td>
                        <td className="px-2 text-center">{c.contacts}</td>
                        <td className="px-2 text-center">{c.cpl == null ? "-" : `₪${Math.round(c.cpl)}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Collapse>
          )}
        </div>
      );
    }

    // המרות לגוגל.
    if (meta.key === "conversions") {
      const ready = conv?.actions_ready ?? (d?.actions_ready === true);
      return (
        <div className="space-y-2 text-sm">
          <p className="text-stone-600">
            {conv
              ? conv.pending.length > 0
                ? `${conv.pending.length} תשלומים ממתינים לדיווח`
                : "אין תשלומים חדשים עם מזהה קליק - אין מה לדווח (זה המצב התקין היום)"
              : stored
                ? `הריצה האחרונה: אין מה לדווח (המצב התקין היום) · ${when}`
                : "עדיין אין ריצה."}
          </p>
          <p className="text-xs text-stone-400">
            פעולות ההמרה בחשבון גוגל: {ready ? "קיימות ✓" : "טרם הוקמו (בכוונה - אין עדיין מה לדווח)"}
          </p>
          <button
            onClick={conversionsSetup}
            disabled={busyAgent === "conversions"}
            className="rounded-full border border-stone-300 px-3 py-1 text-xs font-bold text-stone-500 hover:bg-stone-50 disabled:opacity-50"
          >
            הקם פעולות המרה בחשבון (חד-פעמי)
          </button>
        </div>
      );
    }

    // כספים / שימור - ממצאים + מה נבדק.
    const findingsList = Array.isArray(d?.findings) ? (d?.findings as { title: string; severity?: string }[]) : [];
    const checked = d?.checked;
    if (!stored) return <p className="text-sm text-stone-400">עדיין אין ריצה - אפשר להריץ עכשיו.</p>;
    return (
      <div className="space-y-2 text-sm">
        <p className="text-stone-600">
          {findingsList.length > 0 ? `${findingsList.length} ממצאים` : "לא נמצאו פערים - הכול תקין ✓"}
          {typeof checked === "number" && ` · נבדקו ${checked} מקודמים`}
          {checked != null && typeof checked === "object" && (
            <>
              {" "}
              · נבדקו {(checked as Record<string, number>).therapists ?? "?"} מטפלים,{" "}
              {(checked as Record<string, number>).subscriptions ?? "?"} מנויים,{" "}
              {(checked as Record<string, number>).centers ?? "?"} מרכזים
            </>
          )}
          <span className="text-xs text-stone-400"> · {when}</span>
        </p>
        {findingsList.length > 0 && (
          <ul className="space-y-1 text-xs text-stone-600">
            {findingsList.slice(0, 10).map((f, i) => (
              <li key={i}>
                {f.severity === "high" ? "🔴" : "🟡"} {f.title}
              </li>
            ))}
            {findingsList.length > 10 && <li className="text-stone-400">ועוד {findingsList.length - 10}...</li>}
          </ul>
        )}
      </div>
    );
  }

  // מה נעשה בעבר: הכרעות ושליחות של הסוכן הזה + סטטיסטיקת ריצות.
  function PastWork({ meta }: { meta: AgentMeta }) {
    // שליחות בפועל קודמות לדחיות: ביום עמוס הסוכן דוחה עשרות ממצאים
    // אוטומטית, והם היו קוברים את הדבר החשוב באמת - מה נשלח.
    const all = resolved.filter((r) => r.agent === meta.key);
    const mine = [...all.filter((r) => r.status === "executed"), ...all.filter((r) => r.status !== "executed")];
    const myRuns = runs.filter((r) => r.agent === meta.key);
    const errors = myRuns.filter((r) => r.status === "error").length;
    const icon = (s: string) => (s === "executed" ? "📤" : s === "approved" ? "✓" : "✕");
    return (
      <div className="space-y-2">
        <p className="text-xs text-stone-400">
          {myRuns.length > 0
            ? `${myRuns.length} ריצות נרשמו ביומן${errors > 0 ? ` · ${errors} נכשלו` : " · בלי שגיאות"}`
            : "עדיין לא נרשמו ריצות"}
        </p>
        {mine.length === 0 ? (
          <p className="text-sm text-stone-400">
            עדיין לא בוצעו פעולות דרך הסוכן הזה - כל מה שיישלח או יוכרע יופיע כאן.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {mine.slice(0, 12).map((r) => (
              <li key={r.id} className="flex items-baseline justify-between gap-3 border-b border-stone-100 pb-1.5 text-sm last:border-0">
                <span className={r.status === "executed" ? "font-semibold text-stone-700" : "text-stone-500"}>
                  {icon(r.status)} {r.resolution_note || r.title}
                </span>
                <span className="shrink-0 text-xs text-stone-400">{relTime(r.status_changed_at)}</span>
              </li>
            ))}
            {mine.length > 12 && <li className="text-xs text-stone-400">ועוד {mine.length - 12}...</li>}
          </ul>
        )}
        <p className="text-[11px] text-stone-400">📤 נשלח בפועל · ✓ אושר · ✕ נדחה (דחייה אינה שולחת דבר)</p>
      </div>
    );
  }

  // ההמלצות של הסוכן עכשיו: פעולות (כרטיסים) + ממצאים (רשימה).
  function AgentQueue({ meta }: { meta: AgentMeta }) {
    // סוכן איתור המכונים: "ממתין לך" הוא רשימת השיחות עצמה, לא תור הצעות.
    if (meta.key === "center_prospects") {
      return (
        <>
          {!placesReady && (
            <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <span className="font-black">חיפוש המכונים באינטרנט כבוי.</span> חסר המפתח{" "}
              <code className="rounded bg-amber-100 px-1">GOOGLE_PLACES_API_KEY</code> בהגדרות Vercel, ולכן
              הסוכן עובד כרגע על הלידים הפנימיים בלבד. אחרי הוספת המפתח הוא יתחיל למלא את הרשימה.
            </div>
          )}
        <ProspectTable
          rows={prospects}
          onChanged={setProspects}
          onNotify={(msg, isErr) => {
            if (isErr) {
              setActionError(msg);
              setActionMsg("");
            } else {
              setActionMsg(msg);
              setActionError("");
            }
          }}
        />
        </>
      );
    }
    const mine = pending.filter((a) => a.agent === meta.key);
    const acts = mine.filter((a) => !isFinding(a));
    const finds = mine.filter(isFinding);
    if (mine.length === 0) {
      return <p className="text-sm text-stone-400">אין המלצות פתוחות כרגע - כשהסוכן ימצא משהו, זה יופיע כאן.</p>;
    }
    return (
      <div className="space-y-3">
        {acts.length > 3 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => dismissMany(acts, "הצעות")}
              disabled={bulkBusy}
              className="rounded-full border border-stone-300 px-4 py-1.5 text-xs font-bold text-stone-600 hover:bg-stone-50 disabled:opacity-50"
            >
              {bulkBusy ? "מנקה..." : `✕ נקה את כל ${acts.length} ההצעות`}
            </button>
            <span className="text-xs text-stone-400">בלי לשלוח כלום. מה שרלוונטי יחזור בריצה הבאה.</span>
          </div>
        )}
        <div className="space-y-2">
          {acts.map((a) =>
            a.action_type === "center_nudge" ? (
              <CenterNudgeCard
                key={a.id}
                action={a}
                open={openNudge === a.id}
                onToggle={() => setOpenNudge(openNudge === a.id ? null : a.id)}
                dismissing={busyId === a.id}
                onSent={(msg) => {
                  setActionMsg(msg);
                  setActionError("");
                  load();
                }}
                onDismiss={() => resolveAction(a.id, "dismissed")}
              />
            ) : a.action_type === "gift_offer" ? (
              <GiftOfferCard
                key={a.id}
                action={a}
                open={openOffer === a.id}
                onToggle={() => setOpenOffer(openOffer === a.id ? null : a.id)}
                dismissing={busyId === a.id}
                onSent={(msg) => {
                  setActionMsg(msg);
                  setActionError("");
                  load();
                }}
                onDismiss={() => resolveAction(a.id, "dismissed")}
              />
            ) : (
              <div key={a.id} className="rounded-2xl border border-stone-200 bg-white p-4">
                <div className="mb-1 flex items-start justify-between gap-3">
                  <h3 className="text-sm font-black text-stone-900">{a.title}</h3>
                </div>
                {a.entity_label && <p className="mb-1 text-xs text-stone-400">{a.entity_label}</p>}
                {a.body && <p className="text-sm leading-6 text-stone-600 whitespace-pre-line">{a.body}</p>}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => resolveAction(a.id, "approved")}
                    disabled={busyId === a.id}
                    className="rounded-full bg-[#2e7d8c] px-4 py-1.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    ✓ אשר
                  </button>
                  <button
                    onClick={() => resolveAction(a.id, "dismissed")}
                    disabled={busyId === a.id}
                    className="rounded-full border border-stone-300 px-4 py-1.5 text-sm font-bold text-stone-600 hover:bg-stone-50 disabled:opacity-50"
                  >
                    ✕ דחה
                  </button>
                </div>
              </div>
            )
          )}
        </div>

        {finds.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-black text-stone-700">ממצאים לידיעה ({finds.length})</span>
              <button
                onClick={() => dismissMany(finds, "ממצאים")}
                disabled={bulkBusy}
                className="text-xs font-bold text-stone-500 underline hover:text-stone-700 disabled:opacity-50"
              >
                נקה הכול
              </button>
            </div>
            <ul className="space-y-1.5">
              {finds.slice(0, 10).map((f) => (
                <li key={f.id} className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <span className="font-bold text-stone-700">{f.title}</span>
                    {f.body && <span className="block text-xs leading-5 text-stone-500">{f.body}</span>}
                  </div>
                  <button
                    onClick={() => resolveAction(f.id, "dismissed")}
                    disabled={busyId === f.id || bulkBusy}
                    className="shrink-0 text-xs text-stone-400 underline hover:text-stone-600 disabled:opacity-50"
                  >
                    דחה
                  </button>
                </li>
              ))}
              {finds.length > 10 && <li className="text-xs text-stone-500">ועוד {finds.length - 10}...</li>}
            </ul>
            <p className="mt-2 text-[11px] text-stone-500">
              ממצא הוא מידע, לא משימה: הוא נסגר מעצמו כשהמצב שיצר אותו משתנה, ודחייה רק מסתירה אותו.
            </p>
          </div>
        )}

        {meta.home && (
          <p className="text-xs text-stone-400">
            הממצאים מוצגים גם ב<a href={meta.home.href} className="font-bold text-[#2A6462] underline">{meta.home.label}</a>, ליד הנתונים שהם מדברים עליהם.
          </p>
        )}
      </div>
    );
  }

  function AgentDetail({ meta }: { meta: AgentMeta }) {
    const myRuns = runs.filter((r) => r.agent === meta.key);
    const last = myRuns[0];
    const errorsCount = myRuns.filter((r) => r.status === "error").length;
    const chartPoints = myRuns
      .filter((r) => r.metric != null)
      .map((r) => ({ at: r.started_at, value: r.metric as number }))
      .reverse();
    const acts =
      meta.key === "center_prospects"
        ? prospects.filter((p) => !p.contacted_at).length
        : pending.filter((a) => a.agent === meta.key && !isFinding(a)).length;
    return (
      <div className="space-y-5">
        {/* כותרת דף הסוכן */}
        <div className="rounded-2xl border border-stone-200 bg-white p-6">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-4xl leading-none">{meta.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-black text-stone-900">{meta.label}</h2>
                <StatusChip run={last} />
                {last && (
                  <span className="text-sm text-stone-400">ריצה אחרונה: {relTime(last.started_at)}</span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-stone-500">{meta.schedule}</p>
            </div>
            <button
              onClick={() => runAgent(meta)}
              disabled={busyAgent === meta.key}
              className="rounded-full bg-stone-800 px-6 py-2.5 text-base font-bold text-white hover:bg-stone-700 disabled:opacity-50"
            >
              {busyAgent === meta.key ? "רץ..." : meta.runLabel}
            </button>
          </div>
          <p className="mt-4 max-w-3xl text-base leading-7 text-stone-700">{meta.desc}</p>
          <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-4">
            <div className="mb-1.5 text-xs font-black text-stone-500">איך לקרוא את מה שמוצג כאן</div>
            <ul className="space-y-1.5">
              {meta.howToRead.map((h, i) => (
                <li key={i} className="text-sm leading-6 text-stone-600">
                  💡 {h}
                </li>
              ))}
            </ul>
          </div>
          {last?.summary && (
            <p className="mt-3 text-sm text-stone-500">
              <span className="font-bold text-stone-600">תמצית הריצה האחרונה:</span> {last.summary}
            </p>
          )}
        </div>

        {runError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{runError}</div>
        )}

        {/* ממתין לך עכשיו */}
        <section className="rounded-2xl border border-stone-200 bg-white p-6">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-black text-stone-900">
            📥 ממתין לך עכשיו
            {acts > 0 && (
              <span className="rounded-full bg-[#2e7d8c] px-2.5 py-0.5 text-sm font-bold text-white">{acts}</span>
            )}
          </h3>
          <AgentQueue meta={meta} />
        </section>

        {/* סקירה אחרונה + גרף, זה לצד זה במסך רחב */}
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-2xl border border-stone-200 bg-white p-6">
            <h3 className="mb-4 text-lg font-black text-stone-900">🔎 הסקירה האחרונה</h3>
            <LastReview meta={meta} />
          </section>
          <section className="rounded-2xl border border-stone-200 bg-white p-6">
            <h3 className="mb-4 text-lg font-black text-stone-900">📊 לאורך זמן</h3>
            {meta.chartLabel && chartPoints.length >= 3 ? (
              <MiniBars points={chartPoints} label={meta.chartLabel} goodWhenZero={meta.chartGoodWhenZero} />
            ) : (
              <p className="text-sm text-stone-400">
                {meta.chartLabel
                  ? "עוד אין מספיק ריצות לגרף - הוא יופיע אחרי כמה ימים."
                  : "לסוכן הזה אין כרגע מדד מספרי להצגה."}
              </p>
            )}
            <p className="mt-3 text-xs text-stone-400">
              {myRuns.length > 0
                ? `${myRuns.length} ריצות נרשמו ביומן${errorsCount > 0 ? ` · ${errorsCount} נכשלו` : " · בלי שגיאות"}`
                : "עדיין לא נרשמו ריצות."}
            </p>
          </section>
        </div>

        {/* מה נעשה בעבר */}
        <section className="rounded-2xl border border-stone-200 bg-white p-6">
          <h3 className="mb-4 text-lg font-black text-stone-900">🗂️ מה נעשה בעבר</h3>
          <PastWork meta={meta} />
        </section>

        <Collapse title="יומן הריצות המלא של הסוכן" count={myRuns.length}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-stone-200 text-stone-400">
                  <th className="py-1 pe-2 text-right font-semibold">מתי</th>
                  <th className="px-2 text-right font-semibold">סטטוס</th>
                  <th className="px-2 text-right font-semibold">סיכום</th>
                </tr>
              </thead>
              <tbody>
                {myRuns.slice(0, 20).map((r) => {
                  const st = RUN_STATUS[r.status] ?? RUN_STATUS.running;
                  return (
                    <tr key={r.id} className="border-b border-stone-100">
                      <td className="whitespace-nowrap py-1.5 pe-2 text-stone-500">{fmtDateTime(r.started_at)}</td>
                      <td className="px-2">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${st.cls}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-2 text-stone-600">
                        {r.error ? <span className="text-red-600">{r.error}</span> : r.summary}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Collapse>
      </div>
    );
  }

  // ─────────────────────────────── רינדור ─────────────────────────────────

  const totalActionable = pending.filter((a) => !isFinding(a)).length;
  const selectedMeta = selected ? AGENT_BY_KEY.get(selected) : undefined;

  return (
    <div className="min-h-screen bg-stone-50" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="mb-1 text-2xl font-black text-stone-900">סוכנים אוטונומיים</h1>
        <p className="mb-5 text-sm text-stone-500">
          כל סוכן רץ לבד לפי לוח הזמנים שלו. בחר סוכן למעלה כדי לפתוח את הדף שלו.{" "}
          <span className="font-bold">שום מייל לא יוצא ושום פעולה לא מתבצעת בלי לחיצה שלך.</span>
          {totalActionable > 0 && (
            <span className="font-bold text-[#2A6462]"> כרגע {totalActionable} הצעות ממתינות לך.</span>
          )}
        </p>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}
        {actionError && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {actionError}
          </div>
        )}
        {actionMsg && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            ✓ {actionMsg}
          </div>
        )}
        {loading && runs.length === 0 && <p className="mb-4 text-sm text-stone-400">טוען...</p>}

        {/* סרגל הסוכנים - טאבים לרוחב. לחיצה מחליפה את הדף שמתחת. */}
        <div className="mb-6 flex flex-wrap gap-2">
          {AGENTS.map((meta) => {
            const last = runs.find((r) => r.agent === meta.key);
            const mine = pending.filter((a) => a.agent === meta.key);
            const acts =
              meta.key === "center_prospects"
                ? prospects.filter((p) => !p.contacted_at).length
                : mine.filter((a) => !isFinding(a)).length;
            const finds = meta.key === "center_prospects" ? 0 : mine.length - acts;
            const isSel = selected === meta.key;
            return (
              <button
                key={meta.key}
                onClick={() => selectAgent(meta.key)}
                title={`${meta.label}${last ? ` · ${relTime(last.started_at)}` : ""}`}
                className={`relative flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-bold transition-colors ${
                  isSel
                    ? "border-stone-800 bg-stone-800 text-white shadow-sm"
                    : "border-stone-200 bg-white text-stone-700 hover:border-stone-400"
                }`}
              >
                <span className="text-lg leading-none">{meta.icon}</span>
                <span>{meta.label}</span>
                {acts > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[11px] font-black leading-none ${
                      isSel ? "bg-white text-stone-900" : "bg-[#2e7d8c] text-white"
                    }`}
                  >
                    {acts}
                  </span>
                )}
                {/* נקודת מצב: אדום = הריצה האחרונה נכשלה, ענבר = יש ממצאים */}
                {last?.status === "error" ? (
                  <span className="h-2 w-2 rounded-full bg-red-500" title="הריצה האחרונה נכשלה" />
                ) : finds > 0 && acts === 0 ? (
                  <span className="h-2 w-2 rounded-full bg-amber-400" title={`${finds} ממצאים`} />
                ) : null}
              </button>
            );
          })}
        </div>

        {/* דף הסוכן הנבחר */}
        {selectedMeta && <AgentDetail meta={selectedMeta} />}

        {/* הסבר המודל - זמין תמיד, מקופל */}
        <div className="mt-6">
          <Collapse title="איך העמוד הזה עובד">
            <ul className="space-y-1.5 text-sm leading-6 text-stone-600">
              <li>🕐 כל סוכן רץ אוטומטית לפי הלוח שלו (מוצג בדף שלו), ואפשר גם להריץ ידנית בכל רגע.</li>
              <li>
                📥 כשסוכן מנסח טיוטה או מוצא משהו שדורש החלטה - מופיע מספר על הטאב שלו למעלה. פתח, קרא,
                ותחליט.
              </li>
              <li>🟡 נקודה ענברית על טאב = יש ממצאים לידיעה. הם נסגרים מעצמם כשהמצב משתנה, ואין חובה לטפל.</li>
              <li>🔴 נקודה אדומה על טאב = הריצה האחרונה של הסוכן נכשלה.</li>
              <li>📤 מייל יוצא אך ורק מלחיצת &quot;שלח&quot; שלך על טיוטה שקראת. דחייה לעולם לא שולחת כלום.</li>
            </ul>
          </Collapse>
        </div>
      </div>
    </div>
  );
}
