"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabaseClient";
import { ArrowRight, Loader2, ExternalLink } from "lucide-react";
import PublicPageEditor, { type PublicPage } from "../PublicPageEditor";

// אזור העריכה של המרכז - מקביל ל"עריכת פרטים אישיים" של מטפל: הדשבורד הראשי
// נשאר סטטיסטיקה ונתונים, וכל השינויים והעריכות מרוכזים כאן.
//   מסלול 2 (מרכז כישות): גם פרופיל ההתאמות (רובריקת המרכז) + העמוד הציבורי.
//   מסלול 1: העמוד הציבורי (מטפלים נערכים מרשימת המטפלים בדשבורד).

type ProfileData = {
  center: {
    name: string;
    status: string;
    billing_track?: string | null;
    entity?: { id: string; status: string; admin_approved: boolean; matching_filled?: boolean } | null;
    public_page: PublicPage;
  };
};

export default function CenterProfileEditPage() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/centers/login";
        return;
      }
      try {
        const res = await fetch("/api/center-portal", { headers: { Authorization: `Bearer ${session.access_token}` } });
        const json = await res.json();
        if (res.status === 401) {
          setError("החשבון שלכם עדיין לא מקושר למרכז - פנו אלינו: admin@getmentalytics.com");
        } else if (!json.ok) {
          setError(json.error ?? "שגיאה בטעינת הנתונים");
        } else {
          setData(json);
        }
      } catch {
        setError("שגיאת רשת");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center" dir="rtl"><Loader2 size={28} className="animate-spin text-[var(--teal)]" /></div>;
  }

  if (error || !data) {
    return (
      <main className="mx-auto max-w-md px-5 py-20 text-center" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
        <div className="rounded-3xl border border-stone-200 bg-white p-8">
          <p className="text-sm leading-7 text-stone-700">{error || "שגיאה"}</p>
          <Link href="/centers/dashboard" className="mt-4 inline-block text-sm font-bold underline" style={{ color: "var(--teal)" }}>← חזרה לפורטל</Link>
        </div>
      </main>
    );
  }

  const { center } = data;
  const isEntity = center.billing_track === "center_entity";
  const slug = center.public_page.slug;

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>

      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-stone-900">עריכת הפרופיל - {center.name}</h1>
          <p className="mt-1 text-xs text-stone-500">
            כאן מרוכזים כל השינויים והעריכות של פרטי המרכז. שינויים בעמוד הציבורי עולים מיד לאוויר.
          </p>
        </div>
        <Link href="/centers/dashboard" className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-stone-300 px-4 py-1.5 text-sm font-semibold text-stone-600 hover:bg-stone-50">
          <ArrowRight size={15} /> לפורטל
        </Link>
      </div>

      {/* מסלול 2 - פרופיל ההתאמות של המרכז */}
      {isEntity && (
        <section className={`mb-6 rounded-2xl border p-5 ${center.entity?.matching_filled === false ? "border-2 border-amber-300 bg-amber-50" : "border-stone-200 bg-white"}`}>
          <h2 className="mb-1 text-base font-black text-stone-800">🎯 פרופיל ההתאמות - סוגי הטיפול של המרכז</h2>
          {center.entity?.matching_filled === false && (
            <p className="mb-2 rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-bold text-amber-900">
              ⚠️ עדיין לא סומנו סוגי טיפול - המרכז לא יופיע בהתאמות עד שימולאו.
            </p>
          )}
          <p className="mb-4 text-sm leading-6 text-stone-600">
            תחומי הטיפול, קבוצות הגיל, השפות והאזורים שלפיהם המרכז מוצג למטופלים במערכת ההתאמות.
          </p>
          {center.entity ? (
            <div className="flex flex-wrap items-center gap-3">
              <Link href={`/centers/dashboard/therapists/${center.entity.id}`}
                className="inline-block rounded-full px-5 py-2 text-sm font-bold text-white transition hover:opacity-95"
                style={{ background: "linear-gradient(135deg,var(--teal-dark),var(--teal))" }}>
                ✏️ עריכת פרופיל ההתאמות
              </Link>
              {center.entity.admin_approved && center.entity.status === "paying" ? (
                <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-bold text-green-800">✓ מוצג בהתאמות</span>
              ) : center.status !== "active" ? (
                <span className="rounded-full border border-stone-200 bg-stone-100 px-3 py-1 text-xs text-stone-500">יופיע בהתאמות לאחר הפעלת המנוי ואישור הפרופיל</span>
              ) : (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">ממתין לאישור צוות טיפול חכם</span>
              )}
            </div>
          ) : (
            <p className="text-sm text-amber-700">הפרופיל בהכנה - אם הכפתור אינו מופיע, פנו אלינו: admin@getmentalytics.com</p>
          )}
        </section>
      )}

      {/* העמוד הציבורי - לוגו, צוות, גלריה ופרטי המרכז */}
      {center.status === "active" ? (
        <PublicPageEditor initial={center.public_page} isEntity={isEntity} />
      ) : (
        <section className="rounded-2xl border border-stone-200 bg-stone-50 p-5 text-sm leading-6 text-stone-600">
          עריכת העמוד הציבורי (לוגו, צוות, גלריה ותיאור) תיפתח עם הפעלת המנוי.
        </section>
      )}

      {slug && (
        <p className="mt-2 text-xs text-stone-500">
          תצוגה חיה:{" "}
          <a href={`/centers/${slug}`} target="_blank" className="inline-flex items-center gap-1 font-bold text-teal-700 underline">
            /centers/{slug} <ExternalLink size={11} />
          </a>
        </p>
      )}
    </main>
  );
}
