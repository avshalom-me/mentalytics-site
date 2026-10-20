"use client";

import { useState } from "react";
import { treatmentLabel } from "@/app/lib/treatment-parts";
import {
  FREEZE_DAYS,
  FREEZE_CHECK_EVERY_DAYS,
  HOT_MIN_PEOPLE,
  CONCENTRATION_WINDOW_DAYS,
  regionDisplay,
  type ConcentrationSummary,
  type FreezeCandidate,
} from "@/app/lib/contact-concentration";

// ריכוז פניות וההקפאה השקטה, בעמוד סוכן פערי ההיצע (20/10/26).
//
// ConcentrationPanel - שתי רשימות לקריאה: איפה מעט מטפלים מקבלים את רוב
// הפניות (ואם יצאה משם הצעת מתנה לתור), ומי עמוס/ה ולמה מותר או אסור להקפיא.
// אין כאן כפתור: ההקפאה היא "חצי-אוטומטית" (הבעלים) - פעם בשבועיים עולה לתור
// הצעה לכל מי שעומד/ת בכל הכללים, וההקפאה עצמה רק מהכרטיס שלה בתור
// (FreezeProposalCard), כדי שיהיה לה מסלול אחד.

const SOURCE_LABEL: Record<string, string> = {
  paid: "משלם/ת",
  trial: "קידום במתנה",
  manual: "קידום ידני",
  gift_trial: "בחודשי המתנה",
  center: "דרך מרכז",
};

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
                  🔥 {c.treatment} · {regionDisplay(c.region)}
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

      <Section title="עמוסים - מי מותר להקפיא לשבוע ולמה" count={safeCount}>
        <p className="mb-2 text-xs text-stone-500">
          מי שקיבל/ה {HOT_MIN_PEOPLE} פונים ומעלה ב-{CONCENTRATION_WINDOW_DAYS} יום. הצעה להקפאה שקטה עולה לתור פעם
          ב-{FREEZE_CHECK_EVERY_DAYS} יום, רק למי שמסומן/ת ✅; ההקפאה עצמה רק בלחיצה על ההצעה, ושם הכול נבדק שוב.
        </p>
        {freeze.length === 0 ? (
          <p className="text-xs text-stone-500">אין מטפל/ת עם {HOT_MIN_PEOPLE} פונים ומעלה בחלון.</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {freeze.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>{f.safe ? "✅" : "⛔"}</span>
                <span className="font-bold text-stone-800">{f.name}</span>
                <span className="text-stone-400">
                  {SOURCE_LABEL[f.promotionSource ?? ""] ?? f.promotionSource ?? ""} · {f.people} פונים ({f.matchPeople} מהשאלון)
                </span>
                <span className={f.safe ? "text-stone-600" : "text-red-700"}>
                  {f.safe
                    ? f.weakest
                      ? `· נשארות ${f.weakest.alternatives} חלופות לפחות (${treatmentLabel(f.weakest.treatment)} · ${regionDisplay(f.weakest.region)})`
                      : ""
                    : `· ${f.blockedReason}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

// כרטיס ההצעה להקפאה בתור. הלחיצה שולחת את מזהה ההצעה ואת מזהה המטפל/ת;
// השרת מוודא שההצעה ממתינה ושייכת לאותו מטפל/ת, מריץ שוב את כל הבדיקות על
// הנתונים של עכשיו, ורק אז מקפיא (contact-concentration-freeze.ts).
export function FreezeProposalCard({
  id,
  therapistId,
  title,
  body,
  onDone,
  onDismiss,
  dismissing,
}: {
  id: string;
  therapistId: string;
  title: string;
  body: string | null;
  onDone: (message: string) => void;
  onDismiss: () => void;
  dismissing: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function freeze() {
    if (
      !window.confirm(
        `${title}\n\nהקפאה ל-${FREEZE_DAYS} ימים מתוצאות השאלון בלבד. הפרופיל נשאר במאגר ובעמודי הערים, ` +
          `החיוב לא משתנה, ולא נשלחת שום הודעה. לפני ההקפאה כל הבדיקות ירוצו שוב.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin-agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "concentration_freeze", id, therapist_id: therapistId }),
      });
      const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; match_paused_until?: string } | null;
      if (!res.ok || !j?.ok) {
        setError(j?.error || `ההקפאה לא בוצעה (שגיאה ${res.status}).`);
        return;
      }
      const until = j.match_paused_until
        ? new Date(j.match_paused_until).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" })
        : "";
      onDone(`❄️ הוקפא/ה מתוצאות השאלון${until ? ` עד ${until}` : ""}, בלי מייל.`);
    } catch {
      setError("ההקפאה לא בוצעה: אין חיבור לשרת. נסו שוב.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#C2DFDE] bg-white p-4">
      <h3 className="mb-1 text-sm font-black text-stone-900">❄️ {title}</h3>
      {body && <p className="text-sm leading-6 whitespace-pre-line text-stone-600">{body}</p>}
      {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={freeze}
          disabled={busy || dismissing}
          className="rounded-full bg-[#2e7d8c] px-4 py-1.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "בודק/ת ומקפיא/ה..." : `❄️ הקפא/י ${FREEZE_DAYS} ימים (שקט, בלי מייל)`}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          disabled={busy || dismissing}
          className="rounded-full border border-stone-300 px-4 py-1.5 text-sm font-bold text-stone-600 hover:bg-stone-50 disabled:opacity-50"
        >
          ✕ לא עכשיו
        </button>
      </div>
    </div>
  );
}
