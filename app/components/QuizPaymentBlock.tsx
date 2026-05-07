"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, ShieldCheck } from "lucide-react";
import { getFingerprint } from "@/app/lib/fingerprint";

export default function QuizPaymentBlock({ quizType }: { quizType: "adults" | "kids" }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canSubmit =
    firstName.trim() &&
    lastName.trim() &&
    phone.trim() &&
    email.trim() &&
    agreed;

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    try {
      const fp = await getFingerprint();
      const res = await fetch("/api/payments/create-quiz-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fp,
          quizType,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          email: email.trim(),
        }),
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
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 py-10" dir="rtl">
      <div className="text-5xl mb-4">🔒</div>
      <h2 className="text-2xl font-black text-stone-900 mb-3 text-center">הגעת למגבלת השימוש החינמי</h2>
      <p className="text-stone-600 leading-7 max-w-sm mb-6 text-center">
        ניתן למלא את השאלון עד 6 פעמים ללא תשלום.<br />
        להמשך מילוי — תשלום חד־פעמי בסך ₪30 + מע&quot;מ.
      </p>

      <form onSubmit={handlePay} className="w-full max-w-sm space-y-4">
        <h3 className="text-base font-bold text-stone-900">פרטי הלקוח</h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-1">שם פרטי *</label>
            <input
              type="text"
              required
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-[#0F5468] focus:ring-1 focus:ring-[#0F5468] outline-none"
              placeholder="ישראל"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-1">שם משפחה *</label>
            <input
              type="text"
              required
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-[#0F5468] focus:ring-1 focus:ring-[#0F5468] outline-none"
              placeholder="ישראלי"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-stone-700 mb-1">טלפון *</label>
          <input
            type="tel"
            required
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-[#0F5468] focus:ring-1 focus:ring-[#0F5468] outline-none"
            dir="ltr"
            placeholder="0521234567"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-stone-700 mb-1">אימייל *</label>
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-[#0F5468] focus:ring-1 focus:ring-[#0F5468] outline-none"
            dir="ltr"
            placeholder="email@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-stone-700 mb-1">מדינה</label>
          <input
            type="text"
            value="ישראל"
            disabled
            className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-500"
          />
        </div>

        <div className="rounded-xl p-3 flex items-start gap-2.5" style={{ background: "#F0F7FA", border: "1px solid #D8E4E8" }}>
          <ShieldCheck size={16} style={{ color: "#0F5468" }} className="mt-0.5 flex-shrink-0" />
          <p className="text-[11px] leading-5 text-stone-700">
            הפרטים משמשים אך ורק להפקת חשבונית כנדרש בחוק ואינם נשמרים אצלנו במערכת. <strong>תוכן השאלון והתוצאות נשארים אנונימיים</strong> ואינם מקושרים לפרטים אלה.
          </p>
        </div>

        <hr className="border-stone-200" />

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={e => setAgreed(e.target.checked)}
            className="mt-1 h-4 w-4 flex-shrink-0 accent-[#0F5468]"
          />
          <span className="text-xs leading-5 text-[#1a4a5c]">
            אני מאשר/ת את{" "}
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
          type="submit"
          disabled={!canSubmit || loading}
          className="block w-full text-center rounded-xl px-6 py-3 text-sm font-bold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#0F5468,#1A7A96)", boxShadow: "0 4px 12px rgba(15,84,104,.25)" }}
        >
          {loading ? (
            <Loader2 size={16} className="inline animate-spin" />
          ) : (
            "מעבר לתשלום מאובטח — ₪30 + מע\"מ"
          )}
        </button>

        {error && <p className="text-xs text-red-600 text-center">{error}</p>}

        <p className="text-[11px] leading-5 text-stone-500 text-center">
          התשלום מאובטח ומבוצע דרך חברת הסליקה Grow / Morning. פרטי כרטיס האשראי אינם נשמרים באתר שלנו.
        </p>
      </form>
    </div>
  );
}
