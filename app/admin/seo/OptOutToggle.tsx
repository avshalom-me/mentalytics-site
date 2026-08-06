"use client";

import { useEffect, useState } from "react";
import { setTrackingOptOut, trackingOptedOut } from "@/app/lib/track-optout";

// "אל תספור אותי" - מכבה את שליחת אירועי המדידה מהדפדפן הנוכחי. הדגל יושב
// ב-localStorage באותו origin, ולכן הפעלה כאן חלה גם על האתר הציבורי.
// לכל דפדפן/מכשיר בנפרד, ולא שורד גלישה פרטית או ניקוי אחסון.

export default function OptOutToggle() {
  const [on, setOn] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setOn(trackingOptedOut());
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <div className={`rounded-2xl border p-4 ${on ? "border-teal-300 bg-teal-50/60" : "border-stone-200 bg-white"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-stone-800">
            {on ? "✓ הדפדפן הזה לא נספר במדידות" : "הגלישה שלך נספרת כרגע במדידות"}
          </p>
          <p className="mt-0.5 text-xs leading-5 text-stone-500">
            כניסות שלך מגוגל לבדיקות מתערבבות בנתוני המבקרים. הכיבוי חל על הדפדפן הזה בלבד
            (כולל האתר הציבורי) - צריך להפעיל אותו בכל מכשיר בנפרד, והוא לא שורד גלישה פרטית
            או ניקוי אחסון.
          </p>
        </div>
        <button
          onClick={() => { const next = !on; setTrackingOptOut(next); setOn(next); }}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${
            on ? "border border-stone-300 bg-white text-stone-600 hover:bg-stone-50"
               : "bg-stone-800 text-white hover:bg-stone-700"}`}
        >
          {on ? "החזר אותי לספירה" : "אל תספור אותי"}
        </button>
      </div>
    </div>
  );
}
