"use client";

import { useState } from "react";
import { therapistPath } from "@/app/lib/therapist-url";

// "Add a link to your profile" tool — turns the backlink ask into a button.
// Every therapist linking to their profile from their personal website is a
// relevant dofollow backlink for the domain AND makes their own name-search
// land here — a genuine win-win, framed as such. (Facebook/Instagram links are
// nofollow and worthless for SEO — the copy nudges toward personal sites.)

export default function ProfileLinkPromo({ therapistId, fullName }: { therapistId: string; fullName: string }) {
  const [copied, setCopied] = useState<"url" | "html" | null>(null);

  const url = `https://www.mentalytics.co.il${therapistPath(therapistId, fullName)}`;
  // Quotes in a name would break the copied attribute — escape for the snippet.
  const safeName = fullName.replace(/"/g, "&quot;");
  const html = `<a href="${url}" title="${safeName} — פרופיל בטיפול חכם">הפרופיל המקצועי שלי בטיפול חכם</a>`;

  async function copy(kind: "url" | "html", text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2500);
    } catch {
      /* clipboard blocked — the text is visible and selectable anyway */
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-[#E8E0D8] bg-white p-6">
      <h2 className="text-lg font-extrabold text-stone-900">קדמו את הפרופיל שלכם בגוגל 🔗</h2>
      <p className="mt-2 text-sm leading-7 text-stone-600">
        יש לכם אתר אישי? הוסיפו בו קישור לפרופיל שלכם בטיפול חכם. זה מחזק את הדירוג של הפרופיל
        בגוגל — כך שמטופלים שמחפשים את <strong>השם שלכם</strong> מגיעים לעמוד מקצועי ומעודכן עם
        כפתורי יצירת קשר. <span className="text-stone-500">(קישור מאתר אישי עוזר לקידום; שיתוף בפייסבוק/אינסטגרם מוסיף חשיפה, אך לא משפיע על גוגל.)</span>
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <p className="text-xs font-bold text-stone-500 mb-1">כתובת הפרופיל שלכם</p>
          <div className="flex items-center gap-2">
            <code dir="ltr" className="flex-1 overflow-x-auto whitespace-nowrap rounded-xl bg-stone-50 border border-stone-200 px-3 py-2 text-xs text-stone-700">
              {url}
            </code>
            <button
              type="button"
              onClick={() => copy("url", url)}
              className="shrink-0 rounded-full px-4 py-2 text-xs font-bold text-white transition hover:opacity-90"
              style={{ background: "var(--teal, #3D8C8A)" }}
            >
              {copied === "url" ? "✓ הועתק" : "העתקת קישור"}
            </button>
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-stone-500 mb-1">קוד HTML מוכן להדבקה באתר שלכם</p>
          <div className="flex items-center gap-2">
            <code dir="ltr" className="flex-1 overflow-x-auto whitespace-nowrap rounded-xl bg-stone-50 border border-stone-200 px-3 py-2 text-xs text-stone-700">
              {html}
            </code>
            <button
              type="button"
              onClick={() => copy("html", html)}
              className="shrink-0 rounded-full px-4 py-2 text-xs font-bold transition hover:bg-[var(--teal-pale)]"
              style={{ border: "1.5px solid var(--teal, #3D8C8A)", color: "var(--teal-dark, #2A6462)" }}
            >
              {copied === "html" ? "✓ הועתק" : "העתקת קוד"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
