"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";

// מסך "מצאנו את הפרופיל שלך" - מוצג כשמשתמש מחובר שכתובת המייל שלו תואמת
// פרופיל חי (משלם/מאושר) שעדיין לא קושר לחשבון. בלי המסך הזה המטפל היה
// רואה טופס ריק וממלא הכל מחדש (או מתייאש). הקישור עצמו נעשה ידנית ע"י
// הצוות - מטעמי אבטחה (מייל ההרשמה אינו מאומת) - והמערכת כבר שלחה התראה.

export default function PendingLinkNotice({ name }: { name: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12" dir="rtl"
      style={{ fontFamily: "'Heebo', sans-serif", background: "var(--surface)" }}>
      <div className="w-full max-w-md rounded-3xl border border-[#E8E0D8] bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "var(--teal-pale)" }}>
          <ShieldCheck size={30} style={{ color: "var(--teal)" }} />
        </div>
        <h1 className="text-2xl font-black text-stone-900">מצאנו את הפרופיל שלך 👋</h1>
        <p className="mt-3 leading-7 text-stone-600">
          הפרופיל של <span className="font-bold text-stone-800">{name}</span> כבר קיים ופעיל במערכת -
          אין צורך למלא את הפרטים מחדש.
        </p>
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 text-right">
          מטעמי אבטחה, חיבור של חשבון כניסה חדש לפרופיל קיים נעשה באישור הצוות.
          <strong> הודענו לצוות ברגע זה</strong> - הקישור יושלם בהקדם (בדרך כלל תוך
          מספר שעות), ואז כניסה חוזרת תוביל ישר לפרופיל שלך.
        </p>
        <p className="mt-4 text-sm leading-6 text-stone-500">
          רוצים לזרז? כתבו לנו:{" "}
          <a href="mailto:admin@getmentalytics.com" className="font-bold underline" style={{ color: "var(--teal-dark)" }}>
            admin@getmentalytics.com
          </a>
        </p>
        <p className="mt-6">
          <Link href="/" className="text-sm font-bold hover:underline" style={{ color: "var(--teal)" }}>
            ← חזרה לדף הבית
          </Link>
        </p>
      </div>
    </main>
  );
}
