import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import GaConversion from "@/app/components/GaConversion";
import { isCompletedPayment } from "@/app/lib/verify-payment";

export const metadata: Metadata = { title: "התשלום התקבל" };

export default async function QuizPaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; pid?: string }>;
}) {
  const sp = await searchParams;
  const quizType = sp.type === "kids" ? "kids" : "adults";
  const quizPath = quizType === "kids" ? "/kids" : "/adults";
  // Only fire the ₪30 GA4 conversion for a real, completed quiz payment - a
  // direct / bookmarked / refreshed visit must not fake one.
  const verified = await isCompletedPayment(sp.pid, "quiz");

  return (
    <main
      className="mx-auto max-w-lg px-5 py-20 text-center"
      dir="rtl"
      style={{ fontFamily: "'Heebo', sans-serif" }}
    >

      {verified && (
        <GaConversion
          event="patient_payment"
          dedupeKey={`ga_patient_payment_${sp.pid}`}
          params={{ value: 30, currency: "ILS", quiz_type: quizType, transaction_id: sp.pid }}
        />
      )}

      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
        <CheckCircle2 size={40} className="text-green-600" />
      </div>

      <h1 className="text-2xl font-extrabold text-stone-900 mb-3">התשלום התקבל!</h1>
      <p className="text-stone-600 leading-7 mb-8">
        תודה! עכשיו אפשר להמשיך למלא את השאלון ולקבל התאמה מדויקת למטפל/ת.
      </p>

      <Link
        href={quizPath}
        className="inline-block rounded-xl px-8 py-3 text-sm font-bold text-white transition hover:opacity-95"
        style={{ background: "linear-gradient(135deg,var(--teal-dark),var(--teal))" }}
      >
        המשך לשאלון
      </Link>
    </main>
  );
}
