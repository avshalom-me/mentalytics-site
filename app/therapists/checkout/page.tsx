"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { getClickIds } from "@/app/lib/attribution";

// Sumit's Vault API: card data goes from the browser directly to Sumit, never
// through our server. PCI scope is effectively SAQ-A. The "json" variant of
// the endpoint accepts JSON bodies (the plain one expects jQuery-style
// form-encoded data via their JS SDK).
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

// Strip non-digits and group every 4 for readability while typing.
function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 19);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function CheckoutForm() {
  const searchParams = useSearchParams();
  const isNewSignup = searchParams.get("mode") === "register";

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

  useEffect(() => {
    async function prefill() {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const sb = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const {
          data: { session },
        } = await sb.auth.getSession();
        if (!session) return;

        const { data: therapist } = await sb
          .from("therapists")
          .select("full_name, email, phone")
          .eq("user_id", session.user.id)
          .single();

        if (therapist) {
          const parts = (therapist.full_name || "").split(" ");
          setFirstName(parts[0] || "");
          setLastName(parts.slice(1).join(" ") || "");
          setEmail(therapist.email || session.user.email || "");
          setPhone(therapist.phone || "");
        } else if (session.user.email) {
          setEmail(session.user.email);
        }
      } catch {}
    }
    prefill();
  }, []);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || loading) return;
    setLoading(true);
    setError("");

    try {
      const { createClient } = await import("@supabase/supabase-js");
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const {
        data: { session },
      } = await sb.auth.getSession();

      if (!session) {
        setError("יש להתחבר תחילה");
        setLoading(false);
        return;
      }

      // 1) Fetch Sumit's public credentials.
      const cfgRes = await fetch("/api/payments/sumit-config");
      if (!cfgRes.ok) {
        setError("שגיאה בטעינת מערכת התשלום. נסה/י שוב בעוד מספר רגעים.");
        setLoading(false);
        return;
      }
      const cfg: SumitConfig = await cfgRes.json();

      // 2) Tokenize the card directly with Sumit (card data never touches our server).
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
            "פרטי הכרטיס לא תקינים. בדוק/י את המספר, התוקף וה-CVV ונסה/י שוב."
        );
        setLoading(false);
        return;
      }
      const singleUseToken = tok.Data.SingleUseToken;

      // 3) Charge + create standing order on our server (using the private API key).
      const res = await fetch("/api/payments/create-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          singleUseToken,
          ...(getClickIds() ?? {}),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        const msg =
          data.error === "already subscribed"
            ? "כבר יש לך מנוי פעיל"
            : data.error === "payment provider error"
              ? "החיוב נדחה ע\"י חברת האשראי. בדוק/י פרטים או נסה/י כרטיס אחר."
              : "שגיאה בעיבוד התשלום. נסה/י שוב.";
        setError(msg);
        setLoading(false);
        return;
      }

      window.location.href = `/therapists/payment/success?pid=${data.paymentId ?? ""}`;
    } catch {
      setError("שגיאה בלתי צפויה. בדוק/י את החיבור לאינטרנט ונסה/י שוב.");
      setLoading(false);
    }
  }

  return (
    <main
      className="mx-auto max-w-lg px-5 py-10 pb-20"
      dir="rtl"
      style={{ fontFamily: "'Heebo', sans-serif" }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');`}</style>

      <Link
        href={isNewSignup ? "/therapists/register" : "/therapists/dashboard"}
        className="text-sm text-stone-500 hover:text-[#0F5468] hover:underline"
      >
        ← חזרה
      </Link>

      <h1 className="mt-6 text-2xl font-extrabold text-stone-900 mb-1">
        סיכום הזמנה — מסלול מקודם
      </h1>

      <div className="mt-4 rounded-xl border border-[#E8E0D8] bg-white p-4">
        <div className="flex justify-between items-center">
          <span className="font-bold text-stone-800">מנוי חודשי — מסלול מקודם</span>
          <span className="font-black text-[#0F5468]">&#8362;140 + מע&quot;מ</span>
        </div>
        <p className="text-xs text-stone-500 mt-1">חיוב חודשי מתחדש. ניתן לבטל בכל עת.</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <h2 className="text-lg font-bold text-stone-900">פרטי הלקוח</h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-1">שם פרטי *</label>
            <input
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
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
              onChange={(e) => setLastName(e.target.value)}
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
            onChange={(e) => setPhone(e.target.value)}
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
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-[#0F5468] focus:ring-1 focus:ring-[#0F5468] outline-none"
            dir="ltr"
            placeholder="email@example.com"
          />
        </div>

        <hr className="border-stone-200" />

        <h2 className="text-lg font-bold text-stone-900">פרטי תשלום</h2>

        <div>
          <label className="block text-sm font-semibold text-stone-700 mb-1">מספר כרטיס *</label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="cc-number"
            required
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
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
              onChange={(e) => setExpMonth(e.target.value.replace(/\D/g, "").slice(0, 2))}
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
              onChange={(e) => setExpYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
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
              onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-[#0F5468] focus:ring-1 focus:ring-[#0F5468] outline-none"
              dir="ltr"
              placeholder="123"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-stone-700 mb-1">
            ת&quot;ז בעל/ת הכרטיס *
          </label>
          <input
            type="text"
            inputMode="numeric"
            required
            maxLength={9}
            value={citizenId}
            onChange={(e) => setCitizenId(e.target.value.replace(/\D/g, "").slice(0, 9))}
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
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 h-4 w-4 flex-shrink-0 accent-[#0F5468]"
          />
          <span className="text-xs leading-5 text-stone-700">
            אני מאשר/ת את{" "}
            <Link
              href="/billing-policy"
              target="_blank"
              className="underline font-bold hover:text-[#0F5468]"
            >
              תקנון הרכישה
            </Link>{" "}
            ואת החיוב החודשי המתחדש של ₪140 + מע&quot;מ עד לביטול.
          </span>
        </label>

        <button
          type="submit"
          disabled={!canSubmit || loading}
          className="w-full rounded-xl px-6 py-3.5 text-sm font-bold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            background: "linear-gradient(135deg,#0F5468,#1A7A96)",
            boxShadow: "0 4px 12px rgba(15,84,104,.25)",
          }}
        >
          {loading ? (
            <Loader2 size={16} className="inline animate-spin" />
          ) : (
            <>
              חיוב מאובטח — ₪165.20
              <ArrowLeft size={16} className="inline mr-2" />
            </>
          )}
        </button>

        {error && <p className="text-xs text-red-600 text-center">{error}</p>}
      </form>

      <div
        className="mt-5 rounded-xl p-3.5 flex items-start gap-3"
        style={{ background: "#F0F7FA", border: "1px solid #D8E4E8" }}
      >
        <ShieldCheck size={16} style={{ color: "#0F5468" }} className="mt-0.5 flex-shrink-0" />
        <p className="text-xs text-stone-600 leading-5">
          התשלום מעובד באופן מאובטח על ידי Sumit. פרטי כרטיס האשראי שלך נשלחים
          ישירות אליהם דרך חיבור מוצפן ואינם נשמרים באתר שלנו.
        </p>
      </div>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <main
          className="mx-auto max-w-lg px-5 py-10 text-center"
          dir="rtl"
          style={{ fontFamily: "'Heebo', sans-serif" }}
        >
          <Loader2 size={24} className="inline animate-spin text-[#0F5468]" />
        </main>
      }
    >
      <CheckoutForm />
    </Suspense>
  );
}
