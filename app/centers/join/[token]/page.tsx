import type { Metadata } from "next";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { centerPricing } from "@/app/lib/center-pricing";
import CenterJoinForm, { type CenterOffer } from "./CenterJoinForm";

// דף הצטרפות למרכז טיפולי — נפתח מהקישור הסודי שהאדמין שולח עם הצעת המחיר.
// server component: טוען את ההצעה לפי ה-token בצד השרת בלבד (הטבלה סגורה
// ל-service_role), ומעביר לטופס רק את מה שהמרכז אמור לראות.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "הצטרפות מרכז טיפולי | טיפול חכם",
  description: "הצטרפות מרכזים טיפוליים לפלטפורמת טיפול חכם",
  robots: { index: false, follow: false }, // קישור פרטי — לא לאינדוקס
};

export default async function CenterJoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const { data: center } = await supabaseAdmin
    .from("therapy_center_accounts")
    .select("id, name, contact_name, status, price_per_therapist, therapist_count, gift_months, billing_starts_at")
    .eq("token", token)
    .maybeSingle();

  if (!center) {
    return (
      <Shell>
        <div className="rounded-3xl border border-stone-200 bg-white p-10 text-center shadow-sm">
          <div className="text-4xl mb-3">🔗</div>
          <h1 className="text-xl font-black text-stone-900 mb-2">הקישור אינו תקף</h1>
          <p className="text-sm leading-6 text-stone-600">
            ייתכן שההצעה עודכנה או שהקישור הועתק חלקית.<br />
            פנו אלינו ונשלח לכם קישור מעודכן: <a href="mailto:admin@getmentalytics.com" className="font-bold underline">admin@getmentalytics.com</a>
          </p>
        </div>
      </Shell>
    );
  }

  if (center.status === "active") {
    return (
      <Shell>
        <div className="rounded-3xl border border-green-200 bg-green-50 p-10 text-center shadow-sm">
          <div className="text-4xl mb-3">✅</div>
          <h1 className="text-xl font-black text-stone-900 mb-2">המנוי של {center.name} פעיל</h1>
          <p className="text-sm leading-6 text-stone-600">
            פרטי התשלום נקלטו בהצלחה{center.billing_starts_at ? ` — החיוב הראשון ב-${new Date(center.billing_starts_at + "T00:00:00").toLocaleDateString("he-IL")}` : ""}.
            <br />לשאלות: <a href="mailto:admin@getmentalytics.com" className="font-bold underline">admin@getmentalytics.com</a>
          </p>
        </div>
      </Shell>
    );
  }

  if (center.status === "cancelled") {
    return (
      <Shell>
        <div className="rounded-3xl border border-stone-200 bg-white p-10 text-center shadow-sm">
          <div className="text-4xl mb-3">⏸️</div>
          <h1 className="text-xl font-black text-stone-900 mb-2">ההצעה הזו כבר אינה בתוקף</h1>
          <p className="text-sm leading-6 text-stone-600">
            נשמח להכין לכם הצעה מעודכנת — כתבו לנו: <a href="mailto:admin@getmentalytics.com" className="font-bold underline">admin@getmentalytics.com</a>
          </p>
        </div>
      </Shell>
    );
  }

  const pricePerTherapist = Number(center.price_per_therapist) || 0;
  const therapistCount = Math.floor(Number(center.therapist_count) || 0);

  // הצעה שעדיין לא תומחרה (טיוטה שנשלחה בטעות) — לא מציגים טופס תשלום.
  if (pricePerTherapist <= 0 || therapistCount <= 0) {
    return (
      <Shell>
        <div className="rounded-3xl border border-stone-200 bg-white p-10 text-center shadow-sm">
          <div className="text-4xl mb-3">📝</div>
          <h1 className="text-xl font-black text-stone-900 mb-2">ההצעה בהכנה</h1>
          <p className="text-sm leading-6 text-stone-600">
            נשלים את פרטי ההצעה ונחזור אליכם. לשאלות:{" "}
            <a href="mailto:admin@getmentalytics.com" className="font-bold underline">admin@getmentalytics.com</a>
          </p>
        </div>
      </Shell>
    );
  }

  const p = centerPricing(pricePerTherapist, therapistCount);

  const offer: CenterOffer = {
    token,
    name: center.name,
    contact_name: center.contact_name,
    gift_months: center.gift_months ?? 0,
    price_per_therapist: p.pricePerTherapist,
    therapist_count: p.therapistCount,
    per_therapist_with_vat: p.perTherapistWithVat,
    monthly_total: p.monthlyTotal,
    monthly_total_with_vat: p.monthlyTotalWithVat,
    vat_pct: p.vatPct,
  };

  return (
    <Shell>
      <CenterJoinForm offer={offer} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="mx-auto max-w-2xl px-5 py-10 pb-24 min-h-screen"
      dir="rtl"
      style={{ fontFamily: "'Heebo', sans-serif" }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700;800;900&display=swap');`}</style>
      <div className="mb-8 text-center">
        {/* מקור האמת ללוגו הוא קובץ ה-SVG עצמו — לא לשחזר אותו בקוד */}
        <img src="/logo.svg" alt="טיפול חכם" style={{ height: "48px", width: "auto", display: "inline-block" }} />
      </div>
      {children}
    </main>
  );
}
