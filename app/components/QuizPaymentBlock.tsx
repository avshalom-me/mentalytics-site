"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { getFingerprint } from "@/app/lib/fingerprint";

export default function QuizPaymentBlock({ quizType }: { quizType: "adults" | "kids" }) {
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handlePay() {
    setLoading(true);
    setError("");
    try {
      const fp = await getFingerprint();
      const res = await fetch("/api/payments/create-quiz-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fp, quizType }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError("שגיאה ביצירת התשלום. ניתן לנסות שוב בעוד מספר רגעים.");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("שגיאה בלתי צפויה. נסו שוב.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6" dir="rtl">
      <div className="text-5xl mb-4">🔒</div>
      <h2 className="text-2xl font-black text-stone-900 mb-3">הגעת למגבלת השימוש החינמי</h2>
      <p className="text-stone-600 leading-7 max-w-sm mb-6">
        ניתן למלא את השאלון עד 3 פעמים ללא תשלום.<br />
        להמשך מילוי — תשלום חד־פעמי בסך ₪30 + מע&quot;מ.
      </p>

      <div className="w-full max-w-sm space-y-4">
        <label className="flex items-start gap-2.5 cursor-pointer text-right">
          <input
            type="checkbox"
            checked={agreed}
            onChange={e => setAgreed(e.target.checked)}
            className="mt-1 h-4 w-4 flex-shrink-0 accent-[#0F5468]"
          />
          <span className="text-xs leading-5 text-[#1a4a5c]">
            בלחיצה על תשלום אני מאשר/ת את{" "}
            <Link href="/billing-policy" target="_blank" className="underline font-bold hover:text-[#0F5468]">
              תקנון הרכישה
            </Link>
            {" "}ואת{" "}
            <Link href="/privacy" target="_blank" className="underline font-bold hover:text-[#0F5468]">
              מדיניות הפרטיות
            </Link>
          </span>
        </label>

        <button
          onClick={handlePay}
          disabled={!agreed || loading}
          className="block w-full text-center rounded-xl px-6 py-3 text-sm font-bold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#0F5468,#1A7A96)", boxShadow: "0 4px 12px rgba(15,84,104,.25)" }}
        >
          {loading ? (
            <Loader2 size={16} className="inline animate-spin" />
          ) : (
            "תשלום ₪30 + מע\"מ והמשך לשאלון"
          )}
        </button>

        {error && <p className="text-xs text-red-600 text-center">{error}</p>}

        <p className="text-[11px] leading-5 text-stone-500">
          התשלום מאובטח ומבוצע דרך חברת הסליקה Grow / Morning. התשלום מאפשר שימוש חד־פעמי בשאלון.
        </p>
      </div>
    </div>
  );
}
