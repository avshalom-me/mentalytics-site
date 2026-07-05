"use client";

import { Printer } from "lucide-react";

// כפתור הדפסה/שמירה כ-PDF לעמוד ההסבר למרכזים. מוסתר בהדפסה עצמה (print:hidden).
export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="print:hidden inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-5 py-2.5 text-sm font-bold text-stone-700 transition hover:bg-stone-50"
    >
      <Printer size={16} /> הורדה כ-PDF / הדפסה
    </button>
  );
}
