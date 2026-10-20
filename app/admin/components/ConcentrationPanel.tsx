"use client";

import { useState } from "react";
import { treatmentLabel } from "@/app/lib/treatment-parts";
import {
  FREEZE_DAYS,
  HOT_MIN_PEOPLE,
  CONCENTRATION_WINDOW_DAYS,
  ONLINE_REGION,
  type ConcentrationSummary,
  type FreezeCandidate,
} from "@/app/lib/contact-concentration";

// ריכוז פניות ובדיקת ההקפאה, בעמוד סוכן פערי ההיצע (20/10/26).
//
// שתי רשימות: איפה מעט מטפלים מקבלים את רוב הפניות (ואם יצאה משם הצעת מתנה
// לתור), ומי היה מוקפא לשבוע ולמה כן או לא. ההקפאה כאן אינה אוטומטית: כפתור
// לכל מי שעבר את כל הבדיקות, והוא קורא לאותה פעולה כמו הכפתור בעמוד המטפלים
// (applyMatchPause, עם כל ההגנות שלה).

const SOURCE_LABEL: Record<string, string> = {
  paid: "משלם/ת",
  trial: "קידום במתנה",
  manual: "קידום ידני",
  gift_trial: "בחודשי המתנה",
  center: "דרך מרכז",
};

function whereLabel(region: string): string {
  return region === ONLINE_REGION ? "אונליין" : region;
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <details className="rounded-xl border border-stone-200 bg-stone-50/60">
      <summary className="cursor-pointer select-none px-4 py-2 text-xs font-black text-stone-500 hover:text-stone-700">
        {title}
        <span className="font-normal text-stone-400"> ({count})</span>
      </summary>
      <div className="rounded-b-xl border-t border-stone-200 bg-white px-4 py-3">{children}</div>
    </details>
  );
}

export default function ConcentrationPanel({
  concentration,
  freeze,
}: {
  concentration: ConcentrationSummary[];
  freeze: FreezeCandidate[];
}) {
  const [frozen, setFrozen] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function freezeOne(c: FreezeCandidate) {
    if (
      !window.confirm(
        `להקפיא את ${c.name} מתוצאות השאלון ל-${FREEZE_DAYS} ימים?\n` +
          `הפרופיל נשאר במאגר ובעמודי הערים כרגיל, לא נשלחת שום הודעה, והחיוב לא משתנה.`
      )
    ) {
      return;
    }
    setBusy(c.id);
    setError("");
    try {
      const res = await fetch("/api/admin-therapists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: c.id, action: "set_match_pause", days: FREEZE_DAYS, reason: "ריכוז פניות" }),
      });
      const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; match_paused_until?: string } | null;
      if (!res.ok || !j?.ok) {
        setError(j?.error || `ההקפאה לא בוצעה (שגיאה ${res.status}).`);
        return;
      }
      setFrozen((prev) => ({ ...prev, [c.id]: j.match_paused_until ?? "" }));
    } catch {
      setError("ההקפאה לא בוצעה: אין חיבור לשרת. נסו שוב.");
    } finally {
      setBusy(null);
    }
  }

  const safeCount = freeze.filter((f) => f.safe).length;

  return (
    <div className="space-y-2">
      <Section title="ריכוז פניות - מעט מטפלים מקבלים את רוב הפניות" count={concentration.length}>
        {concentration.length === 0 ? (
          <p className="text-xs text-stone-500">אין כרגע חיתוך שבו מעט מטפלים מקבלים את רוב הפניות.</p>
        ) : (
          <ul className="space-y-2 text-xs text-stone-600">
            {concentration.map((c) => (
              <li key={`${c.region}|${c.treatment}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-bold text-stone-800">
                  🔥 {c.treatment} · {whereLabel(c.region)}
                </span>
                <span>
                  {c.slicePeople} פונים, {c.hotPeople} מהם אצל: {c.hot.map((h) => `${h.name} (${h.people})`).join(", ")}
                </span>
                <span className="text-stone-400">
                  · {c.covering === 1 ? "מקודם/ת אחד/ת בחיתוך" : `${c.covering} מקודמים בחיתוך`}
                  {c.idle > 0 ? `, ${c.idle} בלי אף פנייה` : ""}
                </span>
                <span className={c.offered ? "font-bold text-[#2A6462]" : "text-stone-400"}>
                  {c.offered ? "· הצעת מתנה בתור למעלה" : "· בלי הצעה (אין מועמד חינמי מתאים, או שכבר יש שם פער/הצעה ממתינה)"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`הקפאה לשבוע - בדיקה, שום דבר לא מוקפא אוטומטית`} count={safeCount}>
        <p className="mb-2 text-xs text-stone-500">
          מי שקיבל/ה {HOT_MIN_PEOPLE} פונים ומעלה ב-{CONCENTRATION_WINDOW_DAYS} יום. בטוח להקפיא רק כשבכל אזור ותחום
          שהמטפל/ת משרת/ת נשארים מספיק מקודמים פעילים לאותה קבוצת גיל, שאינם עמוסים בעצמם.
        </p>
        {error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{error}</p>}
        {freeze.length === 0 ? (
          <p className="text-xs text-stone-500">אין מטפל/ת עם {HOT_MIN_PEOPLE} פונים ומעלה בחלון.</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {freeze.map((f) => {
              const done = f.id in frozen;
              return (
                <li key={f.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>{f.safe ? "✅" : "⛔"}</span>
                  <span className="font-bold text-stone-800">{f.name}</span>
                  <span className="text-stone-400">
                    {SOURCE_LABEL[f.promotionSource ?? ""] ?? f.promotionSource ?? ""} · {f.people} פונים ({f.matchPeople} מהשאלון)
                  </span>
                  <span className={f.safe ? "text-stone-600" : "text-red-700"}>
                    {f.safe
                      ? f.weakest
                        ? `· נשארות ${f.weakest.alternatives} חלופות לפחות (${treatmentLabel(f.weakest.treatment)} · ${whereLabel(f.weakest.region)})`
                        : ""
                      : `· ${f.blockedReason}`}
                  </span>
                  {f.safe &&
                    (done ? (
                      <span className="font-bold text-[#2A6462]">
                        ❄️ הוקפא/ה
                        {frozen[f.id]
                          ? ` עד ${new Date(frozen[f.id]).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" })}`
                          : ""}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => freezeOne(f)}
                        disabled={busy !== null}
                        className="rounded-full border border-[#C2DFDE] bg-[#EAF4F3] px-3 py-1 font-bold text-[#2A6462] hover:bg-[#C2DFDE] disabled:opacity-50"
                      >
                        {busy === f.id ? "מקפיא/ה..." : `❄️ הקפא/י ${FREEZE_DAYS} ימים`}
                      </button>
                    ))}
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}
