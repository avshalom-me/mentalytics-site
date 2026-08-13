"use client";

import Link from "next/link";
import { Building2 } from "lucide-react";

// מסך "החשבון הזה מנהל מרכז" - מוצג כשמנהל/ת מרכז טיפולי מגיע/ה לאזור
// המטפלים עם חשבון הפורטל. אותו חשבון Supabase משמש לשני האזורים, וקודם לכן
// המסלול הזה יצר שורת מטפל עצמאית חדשה, הציג טופס ריק, ובסוף הציע לשלם על
// מנוי שהמרכז כבר שילם עליו (מכון הכרה, 10/8/2026).
//
// פרופיל מטפל אישי למנהל/ת מרכז נוצר דרך הפורטל - הזמנה עצמית במייל - כך
// שהפרופיל משויך למרכז, נכלל במכסה, ומדלג על בחירת המסלול.

export default function CenterOwnerNotice({ name }: { name: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12" dir="rtl"
      style={{ fontFamily: "'Heebo', sans-serif", background: "var(--surface)" }}>
      <div className="w-full max-w-md rounded-3xl border border-[#E8E0D8] bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "var(--teal-pale)" }}>
          <Building2 size={30} style={{ color: "var(--teal)" }} />
        </div>
        <h1 className="text-2xl font-black text-stone-900">החשבון הזה מנהל מרכז 🏢</h1>
        <p className="mt-3 leading-7 text-stone-600">
          החשבון שאיתו נכנסת מנהל את{" "}
          <span className="font-bold text-stone-800">{name}</span>. ניהול הפרופילים, הסטטיסטיקות
          והמנוי נמצאים בפורטל המרכזים.
        </p>
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 text-right">
          <strong>רוצה גם פרופיל מטפל/ת אישי?</strong> אפשר להזמין את עצמך מהפורטל
          (&quot;הזמנת המטפלים שלכם במייל&quot;). כך הפרופיל משויך למרכז ונכלל במנוי שכבר שילמת
          עליו - בלי תשלום נוסף ובלי בחירת מסלול.
        </p>
        <p className="mt-6">
          <Link href="/centers/dashboard"
            className="inline-block rounded-full px-6 py-3 text-sm font-bold text-white transition hover:opacity-90"
            style={{ background: "var(--teal, #3D8C8A)" }}>
            לפורטל המרכזים ←
          </Link>
        </p>
        <p className="mt-4 text-sm leading-6 text-stone-500">
          נראה לך שזו טעות? כתבו לנו:{" "}
          <a href="mailto:admin@getmentalytics.com" className="font-bold underline" style={{ color: "var(--teal-dark)" }}>
            admin@getmentalytics.com
          </a>
        </p>
      </div>
    </main>
  );
}
