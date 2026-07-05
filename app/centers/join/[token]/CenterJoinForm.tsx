"use client";

import { useState } from "react";
import { Loader2, ShieldCheck, Gift, CheckCircle2, ArrowLeft } from "lucide-react";

// טופס הצטרפות ותשלום למרכז טיפולי. בחירת מסלול (אם הוצעו כמה) + פרטי
// אשראי. הכרטיס עובר טוקניזציה בדפדפן ישירות מול Sumit — כמו בצ'קאאוט של
// מטפלים (app/therapists/checkout) — ולשרת שלנו מגיע רק SingleUseToken.

export type CenterOffer = {
  token: string;
  name: string;
  contact_name: string | null;
  gift_months: number;
  plans: { key: string; title: string; monthly_price: number; features: string[]; total_with_vat: number }[];
  vat_pct: number;
};

const SUMIT_TOKENIZE_URL = "https://api.sumit.co.il/creditguy/vault/tokenizesingleusejson/";

interface SumitTokenizeResponse {
  Status: number;
  UserErrorMessage: string | null;
  Data: { SingleUseToken?: string } | null;
}

function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 19);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function giftLabel(n: number): string {
  if (n === 1) return "החודש הראשון במתנה";
  if (n === 2) return "החודשיים הראשונים במתנה";
  return `${n} החודשים הראשונים במתנה`;
}

export default function CenterJoinForm({ offer }: { offer: CenterOffer }) {
  const [planKey, setPlanKey] = useState(offer.plans.length === 1 ? offer.plans[0].key : "");
  const [payerName, setPayerName] = useState("");
  const [payerEmail, setPayerEmail] = useState("");
  const [payerPhone, setPayerPhone] = useState("");
  const [companyNumber, setCompanyNumber] = useState("");

  const [cardNumber, setCardNumber] = useState("");
  const [expMonth, setExpMonth] = useState("");
  const [expYear, setExpYear] = useState("");
  const [cvv, setCvv] = useState("");
  const [citizenId, setCitizenId] = useState("");

  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ billing_starts_at: string | null } | null>(null);

  const plan = offer.plans.find((p) => p.key === planKey) ?? null;
  const cardDigits = cardNumber.replace(/\s/g, "");
  const canSubmit =
    plan &&
    payerName.trim() &&
    payerEmail.trim() &&
    payerPhone.trim() &&
    cardDigits.length >= 13 &&
    expMonth.length === 2 &&
    expYear.length === 4 &&
    cvv.length >= 3 &&
    citizenId.length >= 5 &&
    agreed;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || loading || !plan) return;
    setLoading(true);
    setError("");

    try {
      // 1) מפתחות ציבוריים של Sumit
      const cfgRes = await fetch("/api/payments/sumit-config");
      if (!cfgRes.ok) {
        setError("שגיאה בטעינת מערכת התשלום. נסו שוב בעוד מספר רגעים.");
        setLoading(false);
        return;
      }
      const cfg: { companyId: number; publicKey: string } = await cfgRes.json();

      // 2) טוקניזציה של הכרטיס ישירות מול Sumit
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
        setError(tok.UserErrorMessage || "פרטי הכרטיס לא תקינים. בדקו את המספר, התוקף וה-CVV ונסו שוב.");
        setLoading(false);
        return;
      }

      // 3) יצירת המנוי בשרת שלנו
      const res = await fetch("/api/centers/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: offer.token,
          plan_key: plan.key,
          payer_name: payerName.trim(),
          payer_email: payerEmail.trim(),
          payer_phone: payerPhone.trim(),
          company_number: companyNumber.trim(),
          singleUseToken: tok.Data.SingleUseToken,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "שגיאה בעיבוד התשלום. נסו שוב.");
        setLoading(false);
        return;
      }
      setDone({ billing_starts_at: data.billing_starts_at ?? null });
    } catch {
      setError("שגיאה בלתי צפויה. בדקו את החיבור לאינטרנט ונסו שוב.");
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-3xl border border-green-200 bg-green-50 p-10 text-center shadow-sm">
        <CheckCircle2 size={44} className="mx-auto mb-3 text-green-600" />
        <h1 className="text-2xl font-black text-stone-900 mb-2">ברוכים הבאים! 🎉</h1>
        <p className="text-sm leading-7 text-stone-700 max-w-md mx-auto">
          פרטי התשלום של <strong>{offer.name}</strong> נקלטו בהצלחה והמנוי פעיל.
          {done.billing_starts_at ? (
            <>
              <br />
              <Gift size={14} className="inline ml-1 text-green-700" />
              {giftLabel(offer.gift_months)} — החיוב הראשון יתבצע רק ב-
              <strong>{new Date(done.billing_starts_at + "T00:00:00").toLocaleDateString("he-IL")}</strong>.
            </>
          ) : (
            <><br />קבלה על החיוב הראשון נשלחה למייל שהזנתם.</>
          )}
          <br />ניצור אתכם קשר להשלמת קליטת המטפלים של המרכז.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* פתיח */}
      <div className="text-center mb-8">
        <p className="text-sm font-semibold tracking-widest uppercase mb-2" style={{ color: "var(--teal)" }}>
          טיפול חכם — למרכזים טיפוליים
        </p>
        <h1 className="text-3xl font-black text-stone-900 leading-tight">
          הצעה עבור {offer.name}
        </h1>
        {offer.contact_name && (
          <p className="mt-1 text-sm text-stone-500">לידי {offer.contact_name}</p>
        )}
        {offer.gift_months > 0 && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold"
            style={{ background: "var(--gold-pale)", color: "var(--gold-dark)", border: "1px solid #E8DCC8" }}>
            <Gift size={15} />
            {giftLabel(offer.gift_months)}
          </div>
        )}
      </div>

      {/* מסלולים */}
      <div className={`grid gap-4 mb-8 ${offer.plans.length > 1 ? "sm:grid-cols-2" : ""}`}>
        {offer.plans.map((p) => {
          const selected = planKey === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setPlanKey(p.key)}
              className="rounded-3xl border-2 p-6 text-right transition-all"
              style={{
                borderColor: selected ? "var(--teal)" : "var(--line)",
                background: selected ? "var(--teal-pale)" : "#fff",
                boxShadow: selected ? "0 8px 24px rgba(61,140,138,.15)" : "none",
              }}
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="text-lg font-black text-stone-900">{p.title}</h2>
                {offer.plans.length > 1 && (
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full border-2"
                    style={{ borderColor: selected ? "var(--teal)" : "#d6d3d1", background: selected ? "var(--teal)" : "#fff" }}
                  >
                    {selected && <span className="h-2 w-2 rounded-full bg-white" />}
                  </span>
                )}
              </div>
              <div className="mb-4">
                <span className="text-3xl font-black" style={{ color: "var(--teal-dark)" }}>
                  ₪{p.monthly_price.toLocaleString("he-IL")}
                </span>
                <span className="text-sm text-stone-500"> + מע&quot;מ / חודש</span>
                <div className="text-xs text-stone-400 mt-0.5">₪{p.total_with_vat.toLocaleString("he-IL")} כולל מע&quot;מ</div>
              </div>
              {p.features.length > 0 && (
                <ul className="space-y-1.5">
                  {p.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm leading-6 text-stone-700">
                      <span className="mt-0.5 font-bold" style={{ color: "var(--teal)" }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
              )}
            </button>
          );
        })}
      </div>

      {/* טופס תשלום */}
      <form onSubmit={handleSubmit} className="rounded-3xl border border-[#E8E0D8] bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-black text-stone-900">פרטי המשלם</h2>

        <Field label="שם המרכז / העסק לחשבונית *">
          <input type="text" required value={payerName} onChange={(e) => setPayerName(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-[var(--teal)] outline-none"
            placeholder={offer.name} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="ח.פ / עוסק מורשה">
            <input type="text" inputMode="numeric" value={companyNumber}
              onChange={(e) => setCompanyNumber(e.target.value.replace(/\D/g, "").slice(0, 9))}
              className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-[var(--teal)] outline-none" dir="ltr" />
          </Field>
          <Field label="טלפון *">
            <input type="tel" required value={payerPhone} onChange={(e) => setPayerPhone(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-[var(--teal)] outline-none" dir="ltr" placeholder="0521234567" />
          </Field>
        </div>

        <Field label="אימייל לחשבוניות *">
          <input type="email" required value={payerEmail} onChange={(e) => setPayerEmail(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-[var(--teal)] outline-none" dir="ltr" placeholder="office@center.co.il" />
        </Field>

        <hr className="border-stone-200" />
        <h2 className="text-lg font-black text-stone-900">פרטי תשלום</h2>

        <Field label="מספר כרטיס *">
          <input type="text" inputMode="numeric" autoComplete="cc-number" required value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-[var(--teal)] outline-none" dir="ltr"
            placeholder="1234 5678 9012 3456" />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="חודש *">
            <input type="text" inputMode="numeric" autoComplete="cc-exp-month" required maxLength={2} value={expMonth}
              onChange={(e) => setExpMonth(e.target.value.replace(/\D/g, "").slice(0, 2))}
              className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-[var(--teal)] outline-none" dir="ltr" placeholder="MM" />
          </Field>
          <Field label="שנה *">
            <input type="text" inputMode="numeric" autoComplete="cc-exp-year" required maxLength={4} value={expYear}
              onChange={(e) => setExpYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-[var(--teal)] outline-none" dir="ltr" placeholder="YYYY" />
          </Field>
          <Field label="CVV *">
            <input type="text" inputMode="numeric" autoComplete="cc-csc" required maxLength={4} value={cvv}
              onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-[var(--teal)] outline-none" dir="ltr" placeholder="123" />
          </Field>
        </div>

        <Field label='ת"ז בעל/ת הכרטיס *'>
          <input type="text" inputMode="numeric" required maxLength={9} value={citizenId}
            onChange={(e) => setCitizenId(e.target.value.replace(/\D/g, "").slice(0, 9))}
            className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-[var(--teal)] outline-none" dir="ltr" placeholder="123456789" />
        </Field>

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 h-4 w-4 flex-shrink-0 accent-[var(--teal)]" />
          <span className="text-xs leading-5 text-stone-700">
            אני מאשר/ת את{" "}
            <a href="/billing-policy" target="_blank" className="underline font-bold">תקנון הרכישה</a>{" "}
            ואת החיוב החודשי המתחדש{plan ? ` של ₪${plan.monthly_price.toLocaleString("he-IL")} + מע"מ` : ""} עד לביטול
            {offer.gift_months > 0 ? `, החל מתום תקופת המתנה (${giftLabel(offer.gift_months)})` : ""}.
          </span>
        </label>

        <button
          type="submit"
          disabled={!canSubmit || loading}
          className="w-full rounded-full px-6 py-3.5 text-base font-bold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,var(--teal-dark),var(--teal))", boxShadow: "0 8px 20px rgba(45,100,98,.25)" }}
        >
          {loading ? (
            <Loader2 size={18} className="inline animate-spin" />
          ) : offer.gift_months > 0 ? (
            <>שמירת פרטי תשלום — ללא חיוב היום<ArrowLeft size={16} className="inline mr-2" /></>
          ) : plan ? (
            <>חיוב מאובטח — ₪{plan.total_with_vat.toLocaleString("he-IL")}<ArrowLeft size={16} className="inline mr-2" /></>
          ) : (
            "בחרו מסלול למעלה"
          )}
        </button>

        {error && <p className="text-sm text-red-600 text-center">{error}</p>}
      </form>

      <div className="mt-5 rounded-2xl p-3.5 flex items-start gap-3" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        <ShieldCheck size={16} style={{ color: "var(--teal-dark)" }} className="mt-0.5 flex-shrink-0" />
        <p className="text-xs text-stone-600 leading-5">
          התשלום מעובד באופן מאובטח על ידי Sumit. פרטי כרטיס האשראי נשלחים ישירות אליהם דרך חיבור מוצפן
          ואינם נשמרים באתר שלנו. ניתן לבטל את המנוי בכל עת.
        </p>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-stone-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
