"use client";

import { useEffect, useState } from "react";

/**
 * "לאן הלכו הפניות" - which therapists received contact clicks, on which plan,
 * and through which route.
 *
 * The split by route is the whole point and must never be collapsed. On
 * 26/8/2026 the organic aggregate said 85% of contact clicks went to free
 * therapists, which reads as the regional fallback flooding results. Split by
 * route, free therapists took 20 of 21 clicks on their OWN profile pages -
 * traffic they brought via name searches - and 1 of 8 through the matcher.
 * The same number, told two ways, supports opposite decisions.
 *
 * Three routes, and they answer different questions:
 *   match     - from the matcher's results. Paying therapists only (plus the
 *               regional fallback), so this is the column that scores the engine.
 *   directory - straight off a card in a listing, without opening the profile.
 *               The directory lists FREE therapists too, so its mix differs.
 *   profile   - on the therapist's own page, usually their own name traffic.
 * `unaccounted` below is a guard: if these ever stop summing to the total, the
 * table says so instead of quietly under-reporting.
 */

type Row = {
  therapist_id: string;
  full_name: string;
  plan: "paid" | "center" | "trial" | "free";
  campaign: string | null;
  clicks: number;
  clicks_all_channels: number;
  from_match: number;
  from_directory: number;
  from_profile: number;
  from_other: number;
  whatsapp: number;
  phone: number;
  email: number;
  site_message: number;
  last_click: string;
};

const PLAN_LABEL: Record<Row["plan"], string> = {
  paid: "משלם",
  center: "מרכז",
  trial: "מתנה/ניסיון",
  free: "חינמי",
};
const PLAN_STYLE: Record<Row["plan"], string> = {
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  center: "bg-sky-50 text-sky-700 border-sky-200",
  trial: "bg-amber-50 text-amber-700 border-amber-200",
  free: "bg-stone-100 text-stone-600 border-stone-300",
};

const PERIODS: { key: string; label: string }[] = [
  { key: "2d", label: "יומיים" },
  { key: "month", label: "30 יום" },
  { key: "all", label: "סה\"כ" },
];

export default function ContactDestinations({
  channel,
  title,
  note,
  showCampaign = false,
}: {
  /** "google_organic" | "google_paid" | undefined for every channel */
  channel?: string;
  title: string;
  note?: string;
  /** paid views group by campaign; organic has none */
  showCampaign?: boolean;
}) {
  const [period, setPeriod] = useState("month");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setRows(null);
    setErr(null);
    const q = new URLSearchParams({ period });
    if (channel) q.set("channel", channel);
    fetch(`/api/admin-contact-destinations?${q}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d.ok) setRows(d.rows as Row[]);
        else setErr(d.error ?? "שגיאה");
      })
      .catch((e) => alive && setErr(String(e)));
    return () => {
      alive = false;
    };
  }, [period, channel]);

  const total = rows?.reduce((s, r) => s + r.clicks, 0) ?? 0;
  const viaMatch = rows?.reduce((s, r) => s + r.from_match, 0) ?? 0;
  const viaDirectory = rows?.reduce((s, r) => s + r.from_directory, 0) ?? 0;
  const viaProfile = rows?.reduce((s, r) => s + r.from_profile, 0) ?? 0;
  const viaOther = rows?.reduce((s, r) => s + r.from_other, 0) ?? 0;
  // The headline that matters: of clicks the MATCHER produced, how many reached
  // someone we are paid for. Profile clicks are the therapist's own name traffic
  // and say nothing about the matcher. "center" counts as paying - those seats
  // are bought by a paying centre, and excluding them silently undercounts.
  const matchPaid =
    rows?.filter((r) => r.plan === "paid" || r.plan === "center").reduce((s, r) => s + r.from_match, 0) ?? 0;
  // The three routes must account for every click; if they ever do not, say so
  // rather than showing a table whose columns quietly fail to add up.
  const unaccounted = total - (viaMatch + viaDirectory + viaProfile + viaOther);
  // clicks_all_channels repeats across a therapist's campaign rows - summing the
  // column would double count, so total it over distinct therapists.
  const allChannels = rows
    ? [...new Map(rows.map((r) => [r.therapist_id, r.clicks_all_channels])).values()].reduce((a, b) => a + b, 0)
    : 0;
  const scopeLabel = channel === "google_paid" ? "גוגל בתשלום" : channel === "google_organic" ? "אורגני" : "כל הערוצים";

  return (
    <section className="mb-8 rounded-2xl border border-stone-200 bg-white p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-black text-stone-700">{title}</h2>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded-md border px-2.5 py-0.5 text-xs font-semibold ${
                period === p.key
                  ? "border-stone-700 bg-stone-700 text-white"
                  : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {note && <p className="mb-3 text-xs text-stone-500">{note}</p>}

      {err && <p className="text-sm text-red-600">שגיאה: {err}</p>}
      {!err && rows === null && <p className="text-sm text-stone-400">טוען...</p>}

      {rows !== null && rows.length === 0 && (
        <p className="text-sm text-stone-500">אין לחיצות ליצירת קשר בתקופה הזו.</p>
      )}

      {rows !== null && rows.length > 0 && (
        <>
          <div className="mb-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-md border border-stone-200 bg-stone-50 px-2.5 py-1 font-semibold text-stone-700">
              {total} לחיצות ב{scopeLabel}
            </span>
            {channel && allChannels > total && (
              <span className="rounded-md border border-stone-300 bg-white px-2.5 py-1 font-semibold text-stone-500">
                לאותם מטפלים, בכל הערוצים: {allChannels}
              </span>
            )}
            <span className="rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1 font-semibold text-teal-800">
              דרך השאלון: {viaMatch}
            </span>
            <span className="rounded-md border border-stone-200 bg-white px-2.5 py-1 font-semibold text-stone-600">
              דרך המאגר: {viaDirectory}
            </span>
            <span className="rounded-md border border-stone-200 bg-white px-2.5 py-1 font-semibold text-stone-600">
              דרך הפרופיל: {viaProfile}
            </span>
            {viaOther > 0 && (
              <span className="rounded-md border border-stone-200 bg-white px-2.5 py-1 font-semibold text-stone-600">
                מקור אחר: {viaOther}
              </span>
            )}
            {unaccounted !== 0 && (
              <span className="rounded-md border border-red-300 bg-red-50 px-2.5 py-1 font-bold text-red-700">
                לא מסתכם: {unaccounted}
              </span>
            )}
            {viaMatch > 0 && (
              <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-800">
                מתוך השאלון, למשלמים: {matchPaid} מתוך {viaMatch}
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-right text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-xs text-stone-500">
                  <th className="py-2 font-semibold">מטפל/ת</th>
                  <th className="py-2 font-semibold">מסלול</th>
                  {showCampaign && <th className="py-2 font-semibold">קמפיין</th>}
                  <th className="py-2 font-semibold">לחיצות</th>
                  {channel && <th className="py-2 font-semibold">מתוך הכל</th>}
                  <th className="py-2 font-semibold">מהשאלון</th>
                  <th className="py-2 font-semibold">מהמאגר</th>
                  <th className="py-2 font-semibold">מהפרופיל</th>
                  <th className="py-2 font-semibold">איך</th>
                  <th className="py-2 font-semibold">אחרונה</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.therapist_id}-${r.campaign ?? ""}`} className="border-b border-stone-100">
                    <td className="py-2 font-semibold text-stone-800">{r.full_name}</td>
                    <td className="py-2">
                      <span className={`rounded border px-1.5 py-0.5 text-[11px] font-bold ${PLAN_STYLE[r.plan]}`}>
                        {PLAN_LABEL[r.plan]}
                      </span>
                    </td>
                    {showCampaign && (
                      <td className="py-2 text-xs text-stone-600">
                        {r.campaign ?? "-"}
                        {/* A recruitment campaign (therapist-*) targets THERAPISTS. A
                            patient contact attributed to one means a recruitment
                            visitor browsed the patient site - same flag the campaigns
                            table already carries, so the two cannot be read differently. */}
                        {r.campaign?.startsWith("therapist") && (
                          <span className="mr-1.5 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                            גיוס
                          </span>
                        )}
                      </td>
                    )}
                    <td className="py-2 font-bold text-stone-800">{r.clicks}</td>
                    {channel && (
                      <td className="py-2 text-xs text-stone-400" title="סך הלחיצות של המטפל/ת בכל הערוצים באותה תקופה">
                        {r.clicks_all_channels}
                      </td>
                    )}
                    <td className="py-2 font-semibold text-teal-700">{r.from_match || "-"}</td>
                    <td className="py-2 text-stone-500">{r.from_directory || "-"}</td>
                    <td className="py-2 text-stone-500">{r.from_profile || "-"}</td>
                    <td className="py-2 text-xs text-stone-500">
                      {[
                        r.whatsapp ? `וואטסאפ ${r.whatsapp}` : null,
                        r.phone ? `טלפון ${r.phone}` : null,
                        r.email ? `מייל ${r.email}` : null,
                        r.site_message ? `טופס ${r.site_message}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </td>
                    <td className="py-2 text-xs text-stone-400">
                      {new Date(r.last_click).toLocaleDateString("he-IL")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-[11px] leading-5 text-stone-400">
            אלה <strong>לחיצות ליצירת קשר</strong>, לא פניות שהתקבלו בפועל. שלושה מסלולים, והם
            אומרים דברים שונים: <strong>מהשאלון</strong> היא לחיצה מתוך תוצאות ההתאמה - זו העמודה
            שמודדת את המנוע, ומנוע ההתאמה מציג משלמים בלבד (למעט גיבוי אזורי).
            <strong> מהמאגר</strong> היא לחיצה ישירות מכרטיס ברשימה, בלי כניסה לפרופיל - והמאגר מציג
            גם מטפלים חינמיים. <strong>מהפרופיל</strong> היא לחיצה בעמוד המטפל/ת, ולרוב מגיעה מחיפוש
            שם שהמטפל/ת הביא/ה בעצמו/ה.
            {channel && (
              <>
                {" "}
                <strong>הטבלה מסוננת ל{scopeLabel} בלבד</strong>, ולכן המספר כאן קטן ממה שמופיע בעמוד
                המטפל/ת, שסופר את כל הערוצים. עמודת &quot;מתוך הכל&quot; היא סך הלחיצות של אותו/ה מטפל/ת
                בכל הערוצים באותה תקופה - היא חוזרת על עצמה בין שורות קמפיין, ואין לסכם אותה.
              </>
            )}
          </p>
        </>
      )}
    </section>
  );
}
