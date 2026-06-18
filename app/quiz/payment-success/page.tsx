"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Suspense } from "react";
import GaConversion from "@/app/components/GaConversion";

function Inner() {
  const params = useSearchParams();
  const quizType = params.get("type") || "adults";
  const quizPath = quizType === "kids" ? "/kids" : "/adults";

  return (
    <main
      className="mx-auto max-w-lg px-5 py-20 text-center"
      dir="rtl"
      style={{ fontFamily: "'Heebo', sans-serif" }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;700;800&display=swap');`}</style>

      {/* GA4 conversion: patient paid for quiz access (₪30, ex-VAT). */}
      <GaConversion
        event="patient_payment"
        dedupeKey="ga_patient_payment"
        params={{ value: 30, currency: "ILS", quiz_type: quizType }}
      />

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

export default function QuizPaymentSuccessPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
