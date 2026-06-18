"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, ShieldCheck } from "lucide-react";
import { getFingerprint } from "@/app/lib/fingerprint";
import { getClickIds } from "@/app/lib/attribution";

// The "json" variant accepts JSON bodies; the plain endpoint expects
// jQuery-style form-encoded data (used by Sumit's official JS SDK).
const SUMIT_TOKENIZE_URL = "https://api.sumit.co.il/creditguy/vault/tokenizesingleusejson/";

interface SumitConfig {
  companyId: number;
  publicKey: string;
}

interface SumitTokenizeResponse {
  Status: number;
  UserErrorMessage: string | null;
  TechnicalErrorDetails: string | null;
  Data: { SingleUseToken?: string } | null;
}

function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 19);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

export default function QuizPaymentBlock({ quizType }: { quizType: "adults" | "kids" }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [cardNumber, setCardNumber] = useState("");
  const [expMonth, setExpMonth] = useState("");
  const [expYear, setExpYear] = useState("");
  const [cvv, setCvv] = useState("");
  const [citizenId, setCitizenId] = useState("");

  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const cardDigits = cardNumber.replace(/\s/g, "");
  const canSubmit =
    firstName.trim() &&
    lastName.trim() &&
    phone.trim() &&
    email.trim() &&
    cardDigits.length >= 13 &&
    expMonth.length === 2 &&
    expYear.length === 4 &&
    cvv.length >= 3 &&
    citizenId.length >= 5 &&
    agreed;

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || loading) return;
    setLoading(true);
    setError("");
    try {
      const fp = await getFingerprint();

      const cfgRes = await fetch("/api/payments/sumit-config");
      if (!cfgRes.ok) {
        setError("שגיאה בטעינת מערכת התשלום. נסו שוב.");
        setLoading(false);
        return;
      }
      const cfg: SumitConfig = await cfgRes.json();

      const tokRes = await fetch(SUMIT_TOKENIZE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Credentials: { CompanyID: cfg.companyId, APIPublicKey: cfg.publicKey },
          CardNumber: cardDigits,
          ExpirationMonth: parseInt(expMonth, 10),
          ExpirationYear: parseInt(expYear, 10),
          CVV: cvv,
          CitizenID: citizenId,
        }),
      });
      const tok = (await tokRes.json()) as SumitTokenizeResponse;
      if (tok.Status !== 0 || !tok.Data?.SingleUseToken) {
        setError(
          tok.UserErrorMessage ||
            "פרטי הכרטיס לא תקינים. בדקו את המספר, התוקף וה-CVV ונסו שוב."
        );
        setLoading(false);
        return;
      }

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
          singleUseToken: tok.Data.SingleUseToken,
          ...(getClickIds() ?? {}),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(
          data.error === "payment provider error"
            ? "החיוב נדחה ע\"י חברת האשראי. בדקו פרטים או נסו כרטיס אחר."
            : "שגיאה בעיבוד התשלום. נסו שוב בעוד מספר רגעים."
        );
        setLoading(false);
        return;
      }
      window.location.href = `/quiz/payment-success?type=${quizType}`;
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

        <div className="rounded-xl p-3 flex items-start gap-2.5" style={{ background: "#F0F7FA", border: "1px solid #D8E4E8" }}>
          <ShieldCheck size={16} style={{ color: "#0F5468" }} className="mt-0.5 flex-shrink-0" />
          <p className="text-[11px] leading-5 text-stone-700">
            הפרטים משמשים אך ורק להפקת חשבונית כנדרש בחוק ואינם נשמרים אצלנו במערכת. <strong>תוכן השאלון והתוצאות נשארים אנונימיים</strong> ואינם מקושרים לפרטים אלה.
          </p>
        </div>

        <hr className="border-stone-200" />

        <h3 className="text-base font-bold text-stone-900">פרטי תשלום</h3>

        <div>
          <label className="block text-sm font-semibold text-stone-700 mb-1">מספר כרטיס *</label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="cc-number"
            required
            value={cardNumber}
            onChange={e => setCardNumber(formatCardNumber(e.target.value))}
            className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-[#0F5468] focus:ring-1 focus:ring-[#0F5468] outline-none"
            dir="ltr"
            placeholder="1234 5678 9012 3456"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-1">חודש *</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="cc-exp-month"
              required
              maxLength={2}
              value={expMonth}
              onChange={e => setExpMonth(e.target.value.replace(/\D/g, "").slice(0, 2))}
              className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-[#0F5468] focus:ring-1 focus:ring-[#0F5468] outline-none"
              dir="ltr"
              placeholder="MM"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-1">שנה *</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="cc-exp-year"
              required
              maxLength={4}
              value={expYear}
              onChange={e => setExpYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-[#0F5468] focus:ring-1 focus:ring-[#0F5468] outline-none"
              dir="ltr"
              placeholder="YYYY"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-1">CVV *</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="cc-csc"
              required
              maxLength={4}
              value={cvv}
              onChange={e => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-[#0F5468] focus:ring-1 focus:ring-[#0F5468] outline-none"
              dir="ltr"
              placeholder="123"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-stone-700 mb-1">ת&quot;ז בעל/ת הכרטיס *</label>
          <input
            type="text"
            inputMode="numeric"
            required
            maxLength={9}
            value={citizenId}
            onChange={e => setCitizenId(e.target.value.replace(/\D/g, "").slice(0, 9))}
            className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-[#0F5468] focus:ring-1 focus:ring-[#0F5468] outline-none"
            dir="ltr"
            placeholder="123456789"
          />
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
            "חיוב מאובטח — ₪35.40"
          )}
        </button>

        {error && <p className="text-xs text-red-600 text-center">{error}</p>}

        <p className="text-[11px] leading-5 text-stone-500 text-center">
          התשלום מאובטח ומבוצע דרך חברת הסליקה Sumit. פרטי כרטיס האשראי נשלחים ישירות אליהם דרך חיבור מוצפן ואינם נשמרים באתר שלנו.
        </p>
      </form>
    </div>
  );
}
