"use client";

// מקורות תנועה - הגרסה המצומצמת של דשבורד השיווק (בקשת המשתמש, 19/9/2026).
// הטבלה המפורטת נשארת ב-/admin/attribution; כאן שורה אחת לכל מקור, בסדר שבו
// חושבים עליהם: מה שמשלמים עליו, מה שמגיע לבד, ומה שצומח (AI, מפורק לפי עוזר).
//
// יחידת הספירה היא **מבקר** (דפדפן), לא אירוע - כדי שמקור עם מעט מבקרים שגולשים
// הרבה לא ייראה גדול ממקור עם הרבה מבקרים של עמוד אחד. הנתונים מגיעים מ-RPC
// admin_traffic_sources, שמזהה AI גם בשורות שנרשמו לפני שהערוץ נוסף (4/9/2026),
// ולכן עד תחילת אוקטובר המספר כאן גבוה במעט מזה שבטבלה המפורטת.

export type TrafficSourceRow = {
  key: string;
  sessions: number;
  prev_sessions: number;
  quiz: number;
  contact_sessions: number;
  contact_clicks: number;
};
export type TrafficAiRow = Omit<TrafficSourceRow, "key"> & { assistant: string };
export type TrafficPeriod = {
  days: number;
  sources: TrafficSourceRow[];
  ai: TrafficAiRow[];
  referrers: { host: string; sessions: number }[];
};

type Group = { id: string; label: string; keys: string[]; color: string; hint?: string };

// הסדר הוא סדר התצוגה. צבע = זהות המקור, והוא זהה בנקודה ובפס; ה-AI בסגול של
// הקו ב-/admin/seo, כדי ששני המסכים ידברו באותה שפה.
const MAIN: Group[] = [
  { id: "google_paid", label: "גוגל ממומן", keys: ["google_paid"], color: "#2563EB" },
  { id: "google_organic", label: "גוגל אורגני", keys: ["google_organic"], color: "#0284C7" },
  { id: "ai", label: "עוזרי AI", keys: ["ai"], color: "#7C3AED" },
  { id: "referral", label: "אתרים מפנים", keys: ["referral"], color: "#D49018" },
  { id: "direct", label: "כניסות ישירות", keys: ["direct"], color: "#78716C", hint: "הקלדת כתובת, סימנייה, או אפליקציה שלא מעבירה מפנה" },
  { id: "taboola", label: "טאבולה", keys: ["taboola_paid"], color: "#EA580C" },
  { id: "meta", label: "פייסבוק ואינסטגרם", keys: ["meta_paid", "meta_organic"], color: "#4F46E5" },
];
// מוצגים רק כשיש בהם תנועה בתקופה - אחרת הם רעש.
const EXTRA: Group[] = [
  { id: "whatsapp", label: "וואטסאפ", keys: ["whatsapp"], color: "#16A34A" },
  { id: "email", label: "קישור ממייל", keys: ["email"], color: "#0D9488" },
  { id: "search_other", label: "מנועי חיפוש אחרים", keys: ["search_other"], color: "#0891B2", hint: "Bing, DuckDuckGo ודומיהם" },
  { id: "tiktok", label: "טיקטוק", keys: ["tiktok_paid", "tiktok_organic"], color: "#BE185D" },
  { id: "unknown", label: "לא מזוהה", keys: ["unknown", "other"], color: "#A8A29E", hint: "אירועים בלי ערוץ, או תיוג קמפיין שאינו מוכר" },
];

const ASSISTANTS: { key: string; label: string; always: boolean }[] = [
  { key: "chatgpt", label: "ChatGPT", always: true },
  { key: "gemini", label: "Gemini", always: true },
  { key: "claude", label: "Claude", always: true },
  { key: "perplexity", label: "Perplexity", always: true },
  { key: "copilot", label: "Copilot", always: false },
  { key: "other", label: "עוזר אחר", always: false },
];

type Agg = { sessions: number; prev: number; quiz: number; contactSessions: number; contactClicks: number };
const ZERO: Agg = { sessions: 0, prev: 0, quiz: 0, contactSessions: 0, contactClicks: 0 };

function num(n: number) {
  return n.toLocaleString("he-IL");
}
function share(part: number, whole: number): string {
  if (whole <= 0 || part <= 0) return "0%";
  const p = (100 * part) / whole;
  return p < 1 ? "<1%" : `${Math.round(p)}%`;
}
function rate(part: number, whole: number): string {
  if (whole <= 0) return "";
  const p = (100 * part) / whole;
  return `${p < 10 ? p.toFixed(1) : Math.round(p)}%`;
}

function sumKeys(rows: TrafficSourceRow[], keys: string[]): Agg {
  return rows
    .filter((r) => keys.includes(r.key))
    .reduce<Agg>(
      (a, r) => ({
        sessions: a.sessions + r.sessions,
        prev: a.prev + r.prev_sessions,
        quiz: a.quiz + r.quiz,
        contactSessions: a.contactSessions + r.contact_sessions,
        contactClicks: a.contactClicks + r.contact_clicks,
      }),
      ZERO,
    );
}

// השינוי מול התקופה הקודמת באותו אורך. שני מקרי קצה שבהם אחוז מטעה:
// מתחת ל-5 מבקרים בתקופה הקודמת הוא רעש ("+300%" משניים לשמונה), ולכן מוצג
// ההפרש עצמו; ומעל פי 3 הוא מספר שאי אפשר לקרוא ("2857%" כשטאבולה עלתה
// מ-7 ל-207), ולכן מוצג "פי N".
function Change({ cur, prev }: { cur: number; prev: number }) {
  if (cur === 0 && prev === 0) return <span className="text-stone-300">-</span>;
  if (prev === 0) return <span className="font-bold text-green-700">חדש</span>;
  const diff = cur - prev;
  if (diff === 0) return <span className="text-stone-400">ללא שינוי</span>;
  const up = diff > 0;
  const ratio = cur / prev;
  const body =
    prev < 5 ? <span dir="ltr">{`${up ? "+" : "-"}${num(Math.abs(diff))}`}</span>
    : ratio >= 3 ? `פי ${ratio < 10 ? ratio.toFixed(1).replace(/\.0$/, "") : Math.round(ratio)}`
    : `${Math.abs(Math.round((100 * diff) / prev))}%`;
  return (
    <span className={`whitespace-nowrap font-bold ${up ? "text-green-700" : "text-red-600"}`} title={`בתקופה הקודמת: ${num(prev)}`}>
      {up ? "▲" : "▼"} {body}
    </span>
  );
}

export default function TrafficSourcesPanel({ t, periodLabel }: { t: TrafficPeriod | null | undefined; periodLabel: string }) {
  if (!t) {
    return (
      <div className="mb-5 rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="text-base font-black text-stone-800">מקורות תנועה</h2>
        <p className="mt-1 text-xs text-stone-500">הנתון לא נטען כרגע. הטבלה המפורטת זמינה ב&quot;מקורות לידים&quot;.</p>
      </div>
    );
  }

  const rows = [...MAIN, ...EXTRA]
    .map((g) => ({ g, a: sumKeys(t.sources, g.keys), extra: EXTRA.includes(g) }))
    .filter((r) => !r.extra || r.a.sessions > 0 || r.a.contactClicks > 0);
  const total = rows.reduce<Agg>(
    (s, r) => ({
      sessions: s.sessions + r.a.sessions,
      prev: s.prev + r.a.prev,
      quiz: s.quiz + r.a.quiz,
      contactSessions: s.contactSessions + r.a.contactSessions,
      contactClicks: s.contactClicks + r.a.contactClicks,
    }),
    ZERO,
  );
  const maxSessions = Math.max(1, ...rows.map((r) => r.a.sessions));
  const firstExtra = rows.findIndex((r) => r.extra);

  const aiByKey = new Map(t.ai.map((a) => [a.assistant, a]));
  const aiTotal = sumKeys(t.sources, ["ai"]).sessions;
  const assistants = ASSISTANTS.filter((a) => a.always || (aiByKey.get(a.key)?.sessions ?? 0) > 0);
  const metaPaid = sumKeys(t.sources, ["meta_paid"]).sessions;
  const metaOrganic = sumKeys(t.sources, ["meta_organic"]).sessions;

  return (
    <div className="mb-5 rounded-2xl border border-stone-200 bg-white p-5">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-black text-stone-800">מקורות תנועה</h2>
        <span className="text-xs text-stone-500">
          {num(total.sessions)} מבקרים · {periodLabel} ·{" "}
          <a href="/admin/attribution" className="font-semibold text-[#2A6462] underline decoration-[#C2DFDE] underline-offset-2 hover:text-[#1d4847]">
            לטבלה המפורטת
          </a>
        </span>
      </div>
      <p className="mb-4 text-xs text-stone-500">
        מאיפה הגיעו המבקרים, כמה מהם סיימו שאלון וכמה לחצו ליצירת קשר עם מטפל. השינוי הוא מול {periodLabel} שקדמו.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-[11px] font-semibold text-stone-400">
              <th className="border-b border-stone-200 pb-2 text-start font-semibold">מקור</th>
              <th className="border-b border-stone-200 pb-2 text-start font-semibold" style={{ width: "38%" }}>מבקרים</th>
              <th className="border-b border-stone-200 pb-2 text-end font-semibold">שינוי</th>
              <th className="border-b border-stone-200 pb-2 text-end font-semibold" title="מבקרים שהשלימו שאלון התאמה בתקופה">סיימו שאלון</th>
              <th className="border-b border-stone-200 pb-2 text-end font-semibold" title="מבקרים שלחצו ליצירת קשר עם מטפל (וואטסאפ, טלפון או הודעה)">יצרו קשר</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ g, a }, i) => {
              const isAi = g.id === "ai";
              const isReferral = g.id === "referral";
              const sub =
                g.id === "meta" && metaPaid > 0
                  ? `ממומן ${num(metaPaid)} · אורגני ${num(metaOrganic)}`
                  : isReferral && t.referrers.length > 0
                    ? t.referrers.map((r) => `${r.host} ${num(r.sessions)}`).join(" · ")
                    : g.hint;
              return [
                firstExtra === i && (
                  <tr key="extra-divider">
                    <td colSpan={5} className="pb-1 pt-3 text-[11px] font-semibold text-stone-400">מקורות נוספים</td>
                  </tr>
                ),
                <tr key={g.id} className={isAi ? "bg-[#F5F3FF]" : undefined}>
                  <td className={`border-b border-stone-100 py-2.5 pe-3 align-top ${isAi ? "rounded-s-xl ps-2" : ""}`}>
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: g.color }} />
                      <span className="font-bold text-stone-800">{g.label}</span>
                    </div>
                    {sub && (
                      <div className="ms-[18px] mt-0.5 text-[11px] leading-4 text-stone-400" dir={isReferral && t.referrers.length > 0 ? "ltr" : undefined}
                        style={isReferral && t.referrers.length > 0 ? { textAlign: "end" } : undefined}>
                        {sub}
                      </div>
                    )}
                  </td>
                  <td className="border-b border-stone-100 py-2.5 pe-4 align-top">
                    <div className="flex items-center gap-2">
                      <span className="w-12 shrink-0 text-base font-black tabular-nums text-stone-900">{num(a.sessions)}</span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-stone-100">
                        <div className="h-full rounded-full" style={{ width: `${(100 * a.sessions) / maxSessions}%`, background: g.color, minWidth: a.sessions > 0 ? 3 : 0 }} />
                      </div>
                      <span className="w-9 shrink-0 text-end text-[11px] tabular-nums text-stone-400">{share(a.sessions, total.sessions)}</span>
                    </div>
                  </td>
                  <td className="border-b border-stone-100 py-2.5 text-end align-top text-xs tabular-nums"><Change cur={a.sessions} prev={a.prev} /></td>
                  <td className="border-b border-stone-100 py-2.5 text-end align-top tabular-nums text-stone-700">
                    {a.quiz > 0 ? <>{num(a.quiz)} <span className="text-[11px] text-stone-400">{rate(a.quiz, a.sessions)}</span></> : <span className="text-stone-300">-</span>}
                  </td>
                  <td className={`border-b border-stone-100 py-2.5 text-end align-top tabular-nums text-stone-700 ${isAi ? "rounded-e-xl pe-2" : ""}`}
                    title={a.contactClicks > 0 ? `${num(a.contactClicks)} לחיצות ליצירת קשר` : undefined}>
                    {a.contactSessions > 0 ? <><strong className="text-stone-900">{num(a.contactSessions)}</strong> <span className="text-[11px] text-stone-400">{rate(a.contactSessions, a.sessions)}</span></> : <span className="text-stone-300">-</span>}
                  </td>
                </tr>,
                isAi &&
                  assistants.map((as, j) => {
                    const r = aiByKey.get(as.key);
                    const s = r?.sessions ?? 0;
                    const lastSub = j === assistants.length - 1;
                    return (
                      <tr key={`ai-${as.key}`} className="text-xs">
                        <td className={`py-1 pe-3 ps-7 ${lastSub ? "border-b border-stone-100 pb-2.5" : ""}`}>
                          <span className={s > 0 ? "font-semibold text-stone-700" : "text-stone-400"}>
                            <span className="me-1.5 text-stone-300">↳</span>{as.label}
                          </span>
                        </td>
                        <td className={`py-1 pe-4 ${lastSub ? "border-b border-stone-100 pb-2.5" : ""}`}>
                          <span className={`inline-block w-12 tabular-nums ${s > 0 ? "font-bold text-stone-800" : "text-stone-300"}`}>{num(s)}</span>
                          {s > 0 && aiTotal > 0 && <span className="text-[11px] text-stone-400">{share(s, aiTotal)} מה-AI</span>}
                        </td>
                        <td className={`py-1 text-end tabular-nums ${lastSub ? "border-b border-stone-100 pb-2.5" : ""}`}>
                          <Change cur={s} prev={r?.prev_sessions ?? 0} />
                        </td>
                        <td className={`py-1 text-end tabular-nums text-stone-600 ${lastSub ? "border-b border-stone-100 pb-2.5" : ""}`}>
                          {(r?.quiz ?? 0) > 0 ? num(r!.quiz) : <span className="text-stone-300">-</span>}
                        </td>
                        <td className={`py-1 text-end tabular-nums text-stone-600 ${lastSub ? "border-b border-stone-100 pb-2.5" : ""}`}>
                          {(r?.contact_sessions ?? 0) > 0 ? num(r!.contact_sessions) : <span className="text-stone-300">-</span>}
                        </td>
                      </tr>
                    );
                  }),
              ];
            })}
            <tr className="text-sm">
              <td className="pt-3 font-black text-stone-800">סה״כ</td>
              <td className="pt-3 pe-4"><span className="text-base font-black tabular-nums text-stone-900">{num(total.sessions)}</span></td>
              <td className="pt-3 text-end text-xs tabular-nums"><Change cur={total.sessions} prev={total.prev} /></td>
              <td className="pt-3 text-end tabular-nums font-bold text-stone-800">
                {num(total.quiz)} <span className="text-[11px] font-normal text-stone-400">{rate(total.quiz, total.sessions)}</span>
              </td>
              <td className="pt-3 text-end tabular-nums font-bold text-stone-800" title={`${num(total.contactClicks)} לחיצות ליצירת קשר`}>
                {num(total.contactSessions)} <span className="text-[11px] font-normal text-stone-400">{rate(total.contactSessions, total.sessions)}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-[11px] leading-5 text-stone-400">
        מבקר = דפדפן שנראה בתקופה עם המקור הזה. דפדפן שהגיע בתקופה משני מקורות נספר בשניהם, ולכן הסה״כ הוא סכום השורות.
        &quot;יצרו קשר&quot; סופר מבקרים ולא לחיצות - מספר הלחיצות מופיע בריחוף. עוזרי AI: ChatGPT מסמן את הקישורים שלו ולכן מזוהה תמיד;
        ביקור מעוזר אחר שנפתח בלי מפנה נרשם כ&quot;כניסה ישירה&quot;, ותשובות ה-AI של גוגל נרשמות כגוגל אורגני.
      </p>
    </div>
  );
}
