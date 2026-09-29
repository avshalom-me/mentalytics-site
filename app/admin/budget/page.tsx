"use client";

import { useEffect, useState } from "react";
import {
  LEARNING_DAYS,
  MIN_DAILY,
  NOISE_SEEKERS,
  hebrewMonth,
  type BudgetCampaignPlan,
  type BudgetDecision,
  type BudgetProjection,
} from "@/app/lib/budget-agent";
import {
  CURRENCIES,
  PLATFORMS,
  platformLabel,
  type PlatformSpendRow,
  type PlatformWindow,
} from "@/app/lib/ads-platforms";

type Platforms = {
  rows: PlatformSpendRow[];
  last30: PlatformWindow[];
  month: PlatformWindow[];
  window: { from: string; to: string };
};

type Data = {
  today: string;
  month: string;
  ceiling: { value: number; since: string } | null;
  cplTarget: { value: number; since: string } | null;
  sentence: string;
  projection: BudgetProjection;
  /** The last day with Google spend in the database. */
  adsDataThrough: string | null;
  platforms: Platforms;
};

function nis(n: number | null | undefined): string {
  return n == null ? "—" : `₪${Math.round(n).toLocaleString("he-IL")}`;
}

function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthTitle(month: string): string {
  return `${hebrewMonth(month)} ${month.slice(0, 4)}`;
}

// The Google Ads script posts yesterday's spend at about 05:00 every night, so
// the newest day in the data is normally yesterday (the day before, before
// 05:00). Older than that means a night was missed.
const ADS_DATA_STALE_DAYS = 2;

function daysSince(day: string, today: string): number {
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86_400_000);
}

function shortDate(day: string): string {
  const [, m, d] = day.split("-").map(Number);
  return `${d}/${m}`;
}

const DECISION: Record<BudgetDecision, { label: string; cls: string }> = {
  keep: { label: "ללא שינוי", cls: "bg-emerald-50 border-emerald-200 text-emerald-800" },
  reduce: { label: "הורדה", cls: "bg-amber-50 border-amber-200 text-amber-800" },
  pause: { label: "השהיה", cls: "bg-red-50 border-red-200 text-red-700" },
  report: { label: "לידיעה", cls: "bg-stone-50 border-stone-200 text-stone-500" },
};

export default function BudgetPage() {
  const [month, setMonth] = useState<string | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Bumped after an invoice is added or removed, to reload the whole report.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`/api/admin-budget${month ? `?month=${month}` : ""}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setData(j);
        else setError(j.error || "שגיאה בטעינה");
      })
      .catch(() => setError("שגיאה בטעינה"))
      .finally(() => setLoading(false));
  }, [month, version]);

  const shown = data?.month ?? month;
  const p = data?.projection;

  return (
    <div className="min-h-screen bg-stone-50" dir="rtl">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-black text-stone-900">תקציב פרסום</h1>
          {shown && (
            <div className="flex items-center gap-2 text-sm">
              <button
                onClick={() => setMonth(shiftMonth(shown, -1))}
                className="rounded-full border border-stone-200 bg-white px-3 py-1 font-bold text-stone-600 hover:bg-stone-100"
                aria-label="החודש הקודם"
              >
                →
              </button>
              <span className="min-w-28 text-center font-black text-stone-800">{monthTitle(shown)}</span>
              <button
                onClick={() => setMonth(shiftMonth(shown, 1))}
                className="rounded-full border border-stone-200 bg-white px-3 py-1 font-bold text-stone-600 hover:bg-stone-100"
                aria-label="החודש הבא"
              >
                ←
              </button>
            </div>
          )}
        </div>
        <p className="mb-6 text-sm text-stone-500">
          התקרה החודשית, התקציבים שמוגדרים היום בגוגל, והצעת חלוקה. המלצה בלבד: שום דבר כאן לא משנה תקציב בגוגל אדס.
        </p>

        {loading && <p className="text-sm text-stone-400">טוען…</p>}
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {data && p && !loading && (
          <>
            <div className="mb-6 rounded-2xl border border-teal-200 bg-teal-50 p-5">
              <p className="text-lg font-bold leading-relaxed text-teal-900">{data.sentence}</p>
            </div>

            {data.adsDataThrough && daysSince(data.adsDataThrough, data.today) > ADS_DATA_STALE_DAYS && (
              <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                נתוני ההוצאה מגוגל אדס מגיעים רק עד {shortDate(data.adsDataThrough)}: הסנכרון הלילי לא הגיע כמה לילות.
                הסקריפט שולח בכל לילה 30 יום אחורה, כך שהריצה הבאה משלימה את החסר.
              </div>
            )}

            {p.overCeiling && (
              <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
                ⚠ הקמפיינים המוגנים והחדשים לבדם עוברים את התקרה. צריך להוריד הגנה, או להעלות את התקרה.
              </div>
            )}

            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Card
                label={`תקרה ל${hebrewMonth(p.month)}`}
                value={data.ceiling ? nis(data.ceiling.value) : "לא הוגדרה"}
                sub={
                  !data.ceiling
                    ? "בלי תקרה אין הצעת חלוקה"
                    : p.otherMonthCost > 0
                      ? `לפני מע״מ; ${nis(p.otherMonthCost)} כבר בפלטפורמות אחרות, לגוגל ${nis(p.googleCeiling)}`
                      : `לפני מע״מ, בתוקף מ-${monthTitle(data.ceiling.since)}`
                }
                accent
              />
              <Card
                label="התקציבים בגוגל היום"
                value={nis(p.current.monthly)}
                sub={`${nis(p.current.daily)} ליום × ${p.daysInMonth} ימים`}
                tone={p.googleCeiling != null && p.current.monthly > p.googleCeiling ? "text-red-600" : undefined}
              />
              <Card
                label="לפי ההצעה"
                value={nis(p.plan.monthly)}
                sub={`${nis(p.plan.daily)} ליום · כ-${p.plan.seekers} פונים${p.plan.cpl != null ? ` · ${nis(p.plan.cpl)} לפונה` : ""}`}
              />
              <Card
                label="30 הימים האחרונים"
                value={nis(p.lastMonth.cost)}
                sub={`${p.lastMonth.seekers} פונים · ${nis(p.lastMonth.cpl)} לפונה${
                  data.cplTarget ? ` (יעד ${nis(data.cplTarget.value)})` : ""
                }${p.lastMonth.byPlatform.length ? " · כל הפלטפורמות" : ""}`}
              />
            </div>

            <CampaignTable campaigns={p.campaigns} />

            <Protections campaigns={p.campaigns} />

            <PlatformSpend platforms={data.platforms} onChanged={() => setVersion((v) => v + 1)} />

            <div className="rounded-2xl border border-stone-200 bg-white p-4 text-xs leading-relaxed text-stone-500">
              <div className="mb-1 font-bold text-stone-700">איך ההצעה נבנית</div>
              <ol className="list-decimal space-y-0.5 ps-5">
                <li>קמפיין מוגן, וקמפיין שעוד לא מלאו לו {LEARNING_DAYS} יום מההוצאה הראשונה, נשארים בתקציב שיש להם.</li>
                <li>
                  השאר מדורגים לפי עלות לפונה: 30 הימים האחרונים כשיש מאחוריהם לפחות {NOISE_SEEKERS} פונים, אחרת 60 הימים.
                </li>
                <li>
                  מהזול ליקר, כל קמפיין נשאר בתקציב של היום כל עוד התקרה מאפשרת. זה שעל הגבול מקבל את מה שנשאר, אם זה לפחות ₪
                  {MIN_DAILY} ליום. השאר, וכל קמפיין בלי פונה אחד ב-60 יום, מועמדים להשהיה. אף תקציב לא עולה מעל מה שמוגדר היום.
                </li>
              </ol>
              <p className="mt-2">
                פונה = סשן אחד שלחץ ליצירת קשר עם מטפל/ת ממודעה בגוגל. עלויות לפני מע״מ, כפי שגוגל מדווחת (סנכרון לילי
                {data.adsDataThrough ? `, נתונים עד ${shortDate(data.adsDataThrough)}` : ""}
                ). התקציבים "היום" הם מה שמוגדר בגוגל לפי הסנכרון האחרון. טאבולה ומטא נספרים רק מהחשבוניות שבטבלה
                &quot;פרסום מחוץ לגוגל&quot;, והתקרה חלה על כל הפרסום יחד.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Card({ label, value, sub, accent, tone }: { label: string; value: string; sub?: string; accent?: boolean; tone?: string }) {
  return (
    <div className={`rounded-xl border p-3 ${accent ? "border-teal-200 bg-teal-50" : "border-stone-200 bg-white"}`}>
      <div className="text-xs text-stone-500">{label}</div>
      <div className={`text-xl font-black ${tone ?? (accent ? "text-teal-700" : "text-stone-900")}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-stone-400">{sub}</div>}
    </div>
  );
}

function CampaignTable({ campaigns }: { campaigns: BudgetCampaignPlan[] }) {
  return (
    <div className="mb-6 overflow-x-auto rounded-2xl border border-stone-200 bg-white">
      <table className="w-full min-w-[860px] text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-xs text-stone-400">
            <th className="px-3 py-2.5 text-start font-bold">קמפיין</th>
            <th className="px-3 py-2.5 text-start font-bold">ליום היום</th>
            <th className="px-3 py-2.5 text-start font-bold">מוצע</th>
            <th className="px-3 py-2.5 text-start font-bold">החלטה</th>
            <th className="px-3 py-2.5 text-start font-bold">30 יום</th>
            <th className="px-3 py-2.5 text-start font-bold">לפונה 30 / 60</th>
            <th className="px-3 py-2.5 text-start font-bold" title="מתוך הפונים ב-60 יום: כמה פנו למטפל/ת משלם/ת, וכמה למטפל/ת בניסיון">
              למשלמים · בניסיון
            </th>
            <th className="px-3 py-2.5 text-start font-bold">צפי פונים</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <tr key={c.googleName} className={`border-b border-stone-100 last:border-b-0 ${c.inPlan ? "" : "text-stone-400"}`}>
              <td className="px-3 py-2.5">
                <div className="font-bold text-stone-800">{c.googleName}</div>
                <div className="flex flex-wrap gap-1 text-[11px]">
                  <span className="text-stone-400">{c.utmCampaign}</span>
                  {!c.active && <span className="text-stone-400">· מושהה</span>}
                  {c.isProtected && (
                    <span
                      className="rounded-full bg-sky-50 px-1.5 text-sky-800"
                      title={`מוגן: נשאר בתקציב שלו בכל חלוקה. ${c.protectedReason ?? ""}${
                        c.protectedUntil ? ` (עד ${shortDate(c.protectedUntil)})` : ""
                      }`}
                    >
                      🛡️ מוגן
                    </span>
                  )}
                  {c.learning && <span className="rounded-full bg-lime-50 px-1.5 text-lime-800">🌱 בלמידה</span>}
                  {c.noisy && (
                    <span className="rounded-full bg-stone-100 px-1.5 text-stone-500" title={`פחות מ-${NOISE_SEEKERS} פונים מאחורי העלות לפונה`}>
                      מעט נתונים
                    </span>
                  )}
                </div>
              </td>
              <td className="px-3 py-2.5">{c.inPlan ? nis(c.dailyBudget) : c.budgetType === "total" ? "תקציב כולל" : "—"}</td>
              <td className="px-3 py-2.5 font-bold">{c.inPlan ? nis(c.proposedDaily) : "—"}</td>
              <td className="px-3 py-2.5">
                <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${DECISION[c.decision].cls}`}>
                  {DECISION[c.decision].label}
                </span>
              </td>
              <td className="px-3 py-2.5 text-xs">
                {nis(c.cost30)} · {c.seekers30} פונים
              </td>
              <td className="px-3 py-2.5 text-xs">
                {nis(c.cpl30)} / {nis(c.cpl60)}
              </td>
              <td className="px-3 py-2.5 text-xs">
                {c.paidSeekers60} · {c.trialSeekers60}
              </td>
              <td className="px-3 py-2.5 text-xs">
                {!c.inPlan || c.proposedDaily === 0
                  ? "—"
                  : c.projectedSeekers == null
                    ? "אין עדיין נתונים"
                    : `כ-${Math.round(c.projectedSeekers)}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Protections({ campaigns }: { campaigns: BudgetCampaignPlan[] }) {
  const list = campaigns.filter((c) => c.isProtected);
  return (
    <div className="mb-6 rounded-2xl border border-sky-100 bg-white p-4">
      <div className="mb-1 text-sm font-black text-stone-700">🛡️ קמפיינים מוגנים</div>
      <div className="mb-3 space-y-1 text-sm leading-relaxed text-stone-600">
        <p>
          <b>מה זה אומר:</b> ההצעה האוטומטית לא נוגעת בקמפיין מוגן. הוא נשאר בתקציב שמוגדר לו היום, גם כשהעלות לפונה שלו
          גבוהה, וגם כשבגללו קמפיינים זולים ממנו מקבלים פחות.
        </p>
        <p>
          <b>למה צריך את זה:</b> ההצעה מדרגת לפי עלות לפונה בלבד. היא לא יודעת שבאזור מסוים יש מרכז או מטפל שמשלמים לנו
          ומקבלים פניות רק מהקמפיין הזה. הגנה היא הדרך להכניס את הידיעה הזו לחישוב, עם הסיבה.
        </p>
        <p>
          <b>עד מתי:</b> להגנה יש תאריך סיום, ואחריו הקמפיין חוזר להיות מדורג כמו כולם. הוספה או הסרה של הגנה נעשות כרגע
          ידנית, לא מהעמוד הזה.
        </p>
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-stone-400">כרגע אין קמפיין מוגן.</p>
      ) : (
        <ul className="space-y-1 text-sm text-stone-700">
          {list.map((c) => (
            <li key={c.googleName}>
              <b>{c.googleName}</b>: {c.protectedReason}
              <span className="text-stone-400">
                {c.protectedUntil ? ` · עד ${shortDate(c.protectedUntil)}` : " · עד שיבוטל"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type SpendForm = {
  platform: string;
  campaign_key: string;
  period_start: string;
  period_end: string;
  amount: string;
  currency: string;
  vat: string;
  fx_rate: string;
  source_ref: string;
  note: string;
};

const EMPTY_FORM: SpendForm = {
  platform: "meta",
  campaign_key: "",
  period_start: "",
  period_end: "",
  amount: "",
  currency: "USD",
  vat: "",
  fx_rate: "",
  source_ref: "",
  note: "",
};

const INPUT = "w-full rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-sm";

// Spend outside Google. Entered by hand from the invoices, never read from the
// platforms' own accounts (the owner's decision, 30/9/2026).
function PlatformSpend({ platforms, onChanged }: { platforms: Platforms; onChanged: () => void }) {
  const [form, setForm] = useState<SpendForm>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (k: keyof SpendForm) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function add() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin-ads-platforms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      const j = await res.json();
      if (!j.ok) {
        setMsg(j.error || "השמירה נכשלה");
        return;
      }
      setForm((f) => ({ ...EMPTY_FORM, platform: f.platform, currency: f.currency }));
      onChanged();
    } catch {
      setMsg("השמירה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: PlatformSpendRow) {
    if (!row.id) return;
    if (!window.confirm(`למחוק את השורה של ${platformLabel(row.platform)} (${row.period_start} עד ${row.period_end})?`)) return;
    const res = await fetch("/api/admin-ads-platforms", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id }),
    });
    const j = await res.json().catch(() => ({ ok: false }));
    if (!j.ok) setMsg(j.error || "המחיקה נכשלה");
    else onChanged();
  }

  const foreign = form.currency !== "ILS";

  return (
    <div className="mb-6 rounded-2xl border border-stone-200 bg-white p-4">
      <div className="mb-1 text-sm font-black text-stone-700">📄 פרסום מחוץ לגוגל - לפי חשבוניות</div>
      <p className="mb-3 text-sm leading-relaxed text-stone-600">
        אין כאן חיבור לחשבון של טאבולה או של מטא, וגם לא יהיה: ההוצאה נכנסת רק מהחשבוניות והקבלות שלהן. מזינים את הסכום
        לפני מע״מ ואת התקופה שהוא מכסה. דולרים ואירו מומרים לפי השער היציג של בנק ישראל ביום האחרון של התקופה, והשער נשמר
        עם השורה.
      </p>

      {platforms.last30.length > 0 && (
        <ul className="mb-3 space-y-0.5 text-sm text-stone-700">
          {platforms.last30.map((w) => (
            <li key={w.platform}>
              <b>{w.label}</b>, 30 הימים האחרונים ({shortDate(platforms.window.from)}-{shortDate(platforms.window.to)}):{" "}
              {nis(w.cost)} · {w.seekers} פונים{w.cpl != null ? ` · ${nis(w.cpl)} לפונה` : ""}
            </li>
          ))}
        </ul>
      )}

      {platforms.rows.length > 0 ? (
        <div className="mb-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-xs">
            <thead>
              <tr className="border-b border-stone-200 text-stone-400">
                <th className="px-2 py-1.5 text-start font-bold">פלטפורמה</th>
                <th className="px-2 py-1.5 text-start font-bold">תקופה</th>
                <th className="px-2 py-1.5 text-start font-bold">סכום (לפני מע״מ)</th>
                <th className="px-2 py-1.5 text-start font-bold">בשקלים</th>
                <th className="px-2 py-1.5 text-start font-bold">חשבונית</th>
                <th className="px-2 py-1.5 text-start font-bold"></th>
              </tr>
            </thead>
            <tbody>
              {platforms.rows.map((r) => (
                <tr key={r.id} className="border-b border-stone-100 last:border-b-0">
                  <td className="px-2 py-1.5">
                    <b>{platformLabel(r.platform)}</b>
                    {r.campaign_key && <span className="text-stone-400"> · {r.campaign_key}</span>}
                  </td>
                  <td className="px-2 py-1.5">
                    {shortDate(r.period_start)}-{shortDate(r.period_end)}
                  </td>
                  <td className="px-2 py-1.5">
                    {Number(r.amount_orig).toLocaleString("he-IL")} {r.currency}
                    {r.currency !== "ILS" && <span className="text-stone-400"> × {Number(r.fx_rate)}</span>}
                  </td>
                  <td className="px-2 py-1.5 font-bold">{nis(Number(r.amount_ils))}</td>
                  <td className="px-2 py-1.5 text-stone-500" title={r.note ?? ""}>
                    {r.source_ref ?? "—"}
                  </td>
                  <td className="px-2 py-1.5">
                    <button onClick={() => remove(r)} className="text-stone-400 hover:text-red-600" aria-label="מחיקה">
                      🗑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mb-4 text-sm text-stone-400">עוד לא הוזנה אף חשבונית.</p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="text-xs text-stone-500">
          פלטפורמה
          <select className={INPUT} value={form.platform} onChange={set("platform")}>
            {PLATFORMS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-stone-500">
          מתאריך
          <input type="date" className={INPUT} value={form.period_start} onChange={set("period_start")} />
        </label>
        <label className="text-xs text-stone-500">
          עד תאריך
          <input type="date" className={INPUT} value={form.period_end} onChange={set("period_end")} />
        </label>
        <label className="text-xs text-stone-500">
          קמפיין (לא חובה)
          <input className={INPUT} value={form.campaign_key} onChange={set("campaign_key")} placeholder="למשל tab-tlv" />
        </label>
        <label className="text-xs text-stone-500">
          סכום לפני מע״מ
          <input type="number" min="0" step="0.01" className={INPUT} value={form.amount} onChange={set("amount")} />
        </label>
        <label className="text-xs text-stone-500">
          מטבע
          <select className={INPUT} value={form.currency} onChange={set("currency")}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-stone-500">
          מע״מ בחשבונית (לא חובה)
          <input type="number" min="0" step="0.01" className={INPUT} value={form.vat} onChange={set("vat")} />
        </label>
        <label className="text-xs text-stone-500">
          מספר חשבונית / מקור
          <input className={INPUT} value={form.source_ref} onChange={set("source_ref")} />
        </label>
        {foreign && (
          <label className="text-xs text-stone-500">
            שער ידני (רק אם בנק ישראל לא זמין)
            <input type="number" min="0" step="0.0001" className={INPUT} value={form.fx_rate} onChange={set("fx_rate")} />
          </label>
        )}
        <label className="col-span-2 text-xs text-stone-500 sm:col-span-3">
          הערה
          <input className={INPUT} value={form.note} onChange={set("note")} />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={add}
          disabled={busy || !form.amount || !form.period_start || !form.period_end}
          className="rounded-full bg-stone-800 px-5 py-2 text-sm font-bold text-white hover:bg-stone-700 disabled:opacity-40"
        >
          {busy ? "שומר…" : "הוספת חשבונית"}
        </button>
        {msg && <span className="text-sm text-red-600">{msg}</span>}
      </div>
    </div>
  );
}
