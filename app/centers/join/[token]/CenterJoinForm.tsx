"use client";

import { useState } from "react";
import { Loader2, ShieldCheck, Gift, CheckCircle2, ArrowLeft, Sparkles, BarChart3, MapPin, Activity, Users, LayoutDashboard } from "lucide-react";

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
        <div className="mx-auto mt-6 max-w-md rounded-2xl border border-[#D8E4E8] bg-[#F0F7FA] p-4 text-right">
          <p className="text-sm font-bold text-stone-800">
            <LayoutDashboard size={15} className="ml-1 inline" style={{ color: "var(--teal)" }} />
            פורטל ניהול המרכז
          </p>
          <p className="mt-1 text-xs leading-6 text-stone-600">
            להיכנס לפורטל, לצפות בפרופילי המטפלים ובסטטיסטיקות המרוכזות —{" "}
            <a href="/centers/login?mode=register" className="font-bold underline">הירשמו כאן</a>{" "}
            עם המייל <span className="font-mono">{payerEmail}</span>.
          </p>
        </div>
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

      {/* מה כלול בכל מנוי — קבוע לכל ההצעות */}
      <StandardBenefits giftMonths={offer.gift_months} />

      {/* מסלול/י המנוי */}
      <h2 className="text-lg font-black text-stone-900 mb-3">{offer.plans.length > 1 ? "בחירת מסלול" : "המנוי שלכם"}</h2>
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
          ואינם נשמרים באתר שלנו. ניתן לבטל את המנוי בכל עת — כולל במהלך חודשי המתנה.
        </p>
      </div>
    </>
  );
}

// מה שכל מנוי מרכז כולל — תוכן קבוע (לא תלוי בהצעה הספציפית), כדי שכל מרכז
// יראה את הערך המלא: כניסה למערכת ההתאמות, דוח סטטיסטיקות מפורט, וביטול חופשי.
function StandardBenefits({ giftMonths }: { giftMonths: number }) {
  const statCards: { icon: typeof BarChart3; color: string; title: string; body: string }[] = [
    { icon: BarChart3, color: "#0F5468", title: "כמה אנשים ראו אתכם — באמת", body: "סך צפיות בפרופילי המרכז, כמה אנשים שונים (לא חזרות), כמה פנו בפועל, ואחוז ההמרה מצפייה לפנייה." },
    { icon: MapPin, color: "#1A7A96", title: "מאיזו גיאוגרפיה מגיעים", body: "מרכז, השרון, ירושלים, חיפה, צפון, דרום או אונליין — היכן נמצא הביקוש האמיתי לשירותים שלכם." },
    { icon: Activity, color: "#8B2E0A", title: "עם איזה קשיים פונים", body: "רגשי, זוגי, התמכרות, תפקודי, התפתחות אישית, טיפול מיני, הדרכת הורים ועוד — פילוח שמראה למה מחפשים דווקא אתכם." },
    { icon: Users, color: "#2A5C3A", title: "גילאים ומגדר של הפונים", body: "התפלגות לפי טווחי גיל (18-30, 31-45, 46-60, 60+) ומגדר — מי הקהל שלכם ואיך לפנות אליו נכון." },
  ];
  return (
    <div className="mb-8 space-y-4">
      <div className="rounded-3xl border border-[#E8E0D8] bg-white p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-stone-900">
          <Sparkles size={18} style={{ color: "var(--teal)" }} /> מה כולל המנוי
        </h2>
        <div className="space-y-3">
          <BenefitRow
            icon={Users}
            title="כניסה מלאה למערכת ההתאמות החכמה"
            body="מטופלים שממלאים את שאלון ההתאמה מופנים למטפלי המרכז לפי סוג הטיפול, אזור, גיל, שפה והעדפות — פניות מדויקות, לא סתם חשיפה."
          />
          <BenefitRow
            icon={LayoutDashboard}
            title="פורטל ניהול מרכזי משלכם"
            body="חשבון כניסה משלכם עם גישה לכל פרופילי המטפלים של המרכז במקום אחד, וסטטיסטיקות מרוכזות של כל המרכז — לא צריך להיכנס לכל מטפל בנפרד."
          />
          <BenefitRow
            icon={ShieldCheck}
            title="אפשרות לסיים את ההתקשרות בכל עת"
            body={`אין התחייבות לתקופה. אפשר לבטל את המנוי בכל שלב${giftMonths > 0 ? " — כולל במהלך חודשי המתנה" : ""}, בלי קנסות ובלי בירוקרטיה.`}
          />
        </div>
      </div>

      <div className="rounded-3xl border border-[#E8E0D8] bg-white p-6">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase"
          style={{ background: "#8B2E0A15", color: "#8B2E0A", border: "1px solid #8B2E0A33" }}>
          <BarChart3 size={12} /> דוח סטטיסטיקות חודשי
        </div>
        <h3 className="mb-2 text-base font-black text-stone-900">
          איזה סוגי מטופלים מחפשים את המרכז שלכם — ובאזור שלכם
        </h3>
        <p className="mb-5 text-sm leading-7 text-stone-600">
          דוח חודשי שחושף מאיפה מגיעים הפונים, מה הם באמת מחפשים, ולמה חלק לא יוצרים קשר — תוך שמירה מוחלטת על אנונימיות המטופלים.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {statCards.map(({ icon: Icon, color, title, body }, i) => (
            <div key={i} className="flex gap-3 rounded-2xl border border-[#E8E0D8] bg-[#FCFBF9] p-4">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: `${color}15` }}>
                <Icon size={18} style={{ color }} />
              </div>
              <div>
                <h4 className="mb-0.5 text-sm font-bold text-stone-900">{title}</h4>
                <p className="text-xs leading-5 text-stone-600">{body}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-xl p-3" style={{ background: "#F0F7FA", border: "1px solid #D8E4E8" }}>
          <ShieldCheck size={15} style={{ color: "#0F5468" }} className="mt-0.5 flex-shrink-0" />
          <p className="text-xs leading-5 text-stone-600">
            <strong>שמירה מוחלטת על פרטיות:</strong> הנתונים מוצגים רק ברמת קבוצות גדולות. אין שום דרך לזהות מטופל ספציפי.
          </p>
        </div>
      </div>
    </div>
  );
}

function BenefitRow({ icon: Icon, title, body }: { icon: typeof Users; title: string; body: string }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--teal-pale)" }}>
        <Icon size={18} style={{ color: "var(--teal)" }} />
      </div>
      <div>
        <h3 className="mb-0.5 text-sm font-bold text-stone-900">{title}</h3>
        <p className="text-xs leading-5 text-stone-600">{body}</p>
      </div>
    </div>
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
