"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Suspense } from "react";

function Inner() {
  const params = useSearchParams();
  const quizType = params.get("type") || "adults";
  const quizPath = quizType === "kids" ? "/quiz/kids" : "/quiz/adults";

  return (
    <main
      className="mx-auto max-w-lg px-5 py-20 text-center"
      dir="rtl"
      style={{ fontFamily: "'Heebo', sans-serif" }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;700;800&display=swap');`}</style>

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
        style={{ background: "linear-gradient(135deg,#0F5468,#1A7A96)" }}
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
