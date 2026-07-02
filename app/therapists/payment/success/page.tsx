import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import GaConversion from "@/app/components/GaConversion";
import { getCompletedPaymentAmount } from "@/app/lib/verify-payment";

export const metadata: Metadata = { title: "התשלום התקבל | טיפול חכם" };

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ pid?: string }>;
}) {
  const { pid } = await searchParams;
  // Only fire the GA4 conversion for a real, completed subscription payment — a
  // direct / bookmarked / refreshed visit must not fake one. Use the actual
  // charged amount so a promo (₪90) doesn't report as the regular ₪140.
  const paidAmount = await getCompletedPaymentAmount(pid, "subscription");

  return (
    <main
      className="mx-auto max-w-lg px-5 py-20 text-center"
      dir="rtl"
      style={{ fontFamily: "'Heebo', sans-serif" }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;700;800&display=swap');`}</style>

      {paidAmount != null && (
        <GaConversion
          event="therapist_subscription"
          dedupeKey={`ga_therapist_subscription_${pid}`}
          params={{ value: paidAmount, currency: "ILS", transaction_id: pid }}
        />
      )}

      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
        <CheckCircle2 size={40} className="text-green-600" />
      </div>

      <h1 className="text-2xl font-extrabold text-stone-900 mb-3">התשלום התקבל בהצלחה!</h1>
      <p className="text-stone-600 leading-7 mb-8">
        המנוי למסלול המקודם הופעל. מעכשיו הפרופיל שלך יופיע במערכת ההתאמה החכמה
        ותקבל/י סטטיסטיקות מתקדמות על הפונים אליך.
      </p>

      <Link
        href="/therapists/dashboard"
        className="inline-block rounded-xl px-8 py-3 text-sm font-bold text-white transition hover:opacity-95"
        style={{ background: "linear-gradient(135deg,#0F5468,#1A7A96)" }}
      >
        לדשבורד שלי
      </Link>
    </main>
  );
}
