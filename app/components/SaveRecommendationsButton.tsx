"use client";

import { useState } from "react";
import { getAttribution } from "@/app/lib/attribution";
import { getOrCreateSessionId } from "@/app/lib/session";
import { trackMatchSaved } from "@/app/lib/useTrack";

// "שמרו את ההמלצות" - קישור קבוע למסך ההמלצות, לפני שנבחר מטפל.
//
// אח של SaveMatchesButton, בשלב מוקדם יותר. הצורך נמדד ב-17/8/2026: 28%
// ממסיימי השאלון קוראים את ההמלצות 206 שניות בממוצע ועוזבים בלי לחפש מטפל -
// לא נטישה מתוך חוסר עניין, אלא אנשים שקראו לעומק והלכו לחשוב. הקישור השמור
// הקיים נוצר רק אחרי החיפוש, כלומר אחרי הנקודה שבה הם כבר לא נמצאים.
//
// ההבדל מכפתור ה-PDF שלצדו: ה-PDF הוא קובץ סטטי, ומי שרוצה להמשיך מתחיל את
// השאלון מאפס. הקישור מחזיר למסך שממנו יצאו, ושומר את הייחוס לקמפיין - כך
// שפנייה שתקרה בעוד שבוע עדיין תיזקף למודעה שהביאה אותם.
//
// נשמרות תוויות הטיפול בלבד, לא ממצאי השאלון (ראו המיגרציה) - הקישור נשלח
// בוואטסאפ ועלול לעבור הלאה.

export default function SaveRecommendationsButton({
  treatments,
  quizType,
}: {
  treatments: string[];
  quizType: "adults" | "kids";
}) {
  const [state, setState] = useState<"idle" | "loading" | "copied" | "error">("idle");
  const clean = [...new Set(treatments.map((t) => t.trim()).filter(Boolean))].slice(0, 8);
  if (clean.length === 0) return null;

  async function createToken(): Promise<string | null> {
    try {
      const res = await fetch("/api/match-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recommended_treatments: clean,
          quiz_type: quizType,
          session_id: getOrCreateSessionId(),
          ...(getAttribution() ?? {}),
        }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return typeof json?.token === "string" ? json.token : null;
    } catch {
      return null;
    }
  }

  async function run(then: (url: string) => void) {
    if (state === "loading") return;
    setState("loading");
    const token = await createToken();
    if (!token) {
      setState("error");
      setTimeout(() => setState("idle"), 3000);
      return;
    }
    trackMatchSaved(quizType, token, clean.length);
    then(`https://www.mentalytics.co.il/match/${token}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() =>
          run((url) => {
            const list = clean.map((t, i) => `${i + 1}. ${t}`).join("\n");
            const msg = `ההמלצות שלי מטיפול חכם 💚\n${list}\n\nלהמשך ומציאת מטפל/ת:\n${url}`;
            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
            setState("idle");
          })
        }
        disabled={state === "loading"}
        className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ background: "#128C42" }}
      >
        {state === "loading" ? "רגע..." : "💬 שלחו לעצמכם בוואטסאפ"}
      </button>
      <button
        type="button"
        onClick={() =>
          run(async (url) => {
            try {
              await navigator.clipboard.writeText(url);
              setState("copied");
              setTimeout(() => setState("idle"), 2500);
            } catch {
              setState("idle");
            }
          })
        }
        disabled={state === "loading"}
        className="inline-flex items-center gap-1.5 rounded-xl border-[1.5px] px-4 py-2 text-sm font-bold transition-colors disabled:opacity-60"
        style={{ borderColor: "var(--teal-mid)", color: "var(--teal-dark)" }}
      >
        {state === "copied" ? "✓ הקישור הועתק" : "🔗 העתקת קישור"}
      </button>
      {state === "error" && <span className="text-xs text-red-600">לא הצלחנו לשמור, נסו שוב</span>}
    </div>
  );
}
