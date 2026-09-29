"use client";

import Link from "next/link";
import Image from "next/image";

// מה שמבקר רואה כשעמוד לא הצליח להיבנות - בפועל כמעט תמיד בסיס נתונים שלא
// ענה בזמן. עד 29/9/2026 לא היה עמוד כזה: שגיאה כזו הפכה בשקט ל"מטפל לא
// נמצא" או לרשימה ריקה, וכך 58 פרופילים של מטפלים פעילים ענו "לא נמצא"
// במשך שש שעות. עכשיו השגיאה נזרקת (ראו app/therapists/[id]/page.tsx
// ו-app/lib/therapist-directory.ts), ומי שנתקל בה מקבל את האמת: תקלה זמנית.
// "לנסות שוב" טוען את העמוד מחדש מהשרת. reset() לבדו מצייר מחדש רק בדפדפן,
// ושגיאה של רכיב שרת דורשת בקשה חדשה לשרת.
export default function ErrorPage() {
  return (
    <main className="mx-auto max-w-xl px-5 py-24 text-center" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <Image src="/logo.svg" alt="טיפול חכם" width={64} height={64} className="mx-auto mb-6" />
      <h1 className="text-3xl font-black text-stone-900 mb-3">העמוד לא נטען הפעם</h1>
      <p className="text-stone-500 leading-7 mb-8">
        זו תקלה זמנית אצלנו, והיא חולפת בדרך כלל תוך דקות ספורות. אפשר לנסות שוב עכשיו או לחזור בעוד רגע.
      </p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white"
          style={{ background: "linear-gradient(135deg,var(--teal-dark),var(--teal))" }}
        >
          לנסות שוב
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-stone-300 px-6 py-3 text-sm font-bold text-stone-700 hover:bg-stone-100"
        >
          חזרה לדף הבית
        </Link>
      </div>
    </main>
  );
}
