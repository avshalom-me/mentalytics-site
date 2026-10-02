"use client";

import { useEffect, useState } from "react";

// ההרשמה לתשלום של מורה: 60 ש"ח לחודש כולל מע"מ, ללא התחייבות. המורה מגיע/ה
// לכאן מהמייל של יום 85 (דרך הקישור האישי, ששם עוגייה) או מהפרופיל. פרטי
// הכרטיס עוברים ישירות ל-Sumit (טוקן חד-פעמי) - אותו מסלול כמו הצ'ק-אאוט של
// המטפלים. כשהניסיון עוד רץ, החיוב הראשון נדחה ליום האחרון שלו.

const SUMIT_TOKENIZE_URL = "https://api.sumit.co.il/creditguy/vault/tokenizesingleusejson/";

type Offer = {
  teacher_name: string;
  listing_state: string;
  first_charge_date: string;
  deferred: boolean;
  amount_gross: number;
  already_subscribed: boolean;
  can_pay: boolean;
};
type SumitConfig = { companyId: string; publicKey: string };
type SumitTokenizeResponse = { Status: number; UserErrorMessage?: string; Data: { SingleUseToken?: string } | null };

function hebDate(isoDate: string): string {
  return new Date(`${isoDate.slice(0, 10)}T12:00:00Z`).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem", day: "numeric", month: "long", year: "numeric" });
}

// דיווח כשל מצד הדפדפן, כמו בשאר עמודי התשלום: בלעדיו הרשמה שנשברה אצל
// המורה (חוסם פרסומות שחוסם את Sumit, למשל) לא משאירה שום עקבה.
function reportFailure(stage: "config" | "tokenize" | "subscribe" | "exception", message: string) {
  fetch("/api/payment-client-error", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: "teacher_pay", stage, message }),
    keepalive: true,
  }).catch(() => {});
}

export default function TeacherPayPage() {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [gateError, setGateError] = useState("");
  const [checking, setChecking] = useState(true);
  const [card, setCard] = useState("");
  const [expMonth, setExpMonth] = useState("");
  const [expYear, setExpYear] = useState("");
  const [cvv, setCvv] = useState("");
  const [citizenId, setCitizenId] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ first_charge_date: string; deferred: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/teachers/subscribe")
      .then(async (r) => {
        if (r.status === 401) {
          setSignedOut(true);
          return;
        }
        const j = await r.json();
        if (j.ok) setOffer(j as Offer);
        else setGateError(j.error || "שגיאה בטעינה");
      })
      .catch(() => setGateError("שגיאה בטעינה"))
      .finally(() => setChecking(false));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    let reported = false;
    try {
      const cfgRes = await fetch("/api/payments/sumit-config");
      if (!cfgRes.ok) {
        reportFailure("config", `status ${cfgRes.status}`);
        reported = true;
        throw new Error("שגיאה בטעינת מערכת התשלום. נסו שוב בעוד מספר רגעים.");
      }
      const cfg: SumitConfig = await cfgRes.json();
      const tokRes = await fetch(SUMIT_TOKENIZE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Credentials: { CompanyID: cfg.companyId, APIPublicKey: cfg.publicKey },
          CardNumber: card.replace(/\D/g, ""),
          ExpirationMonth: parseInt(expMonth, 10),
          ExpirationYear: parseInt(expYear, 10),
          CVV: cvv,
          CitizenID: citizenId,
        }),
      });
      const tok = (await tokRes.json()) as SumitTokenizeResponse;
      if (tok.Status !== 0 || !tok.Data?.SingleUseToken) {
        reportFailure("tokenize", `status ${tok.Status} ${tok.UserErrorMessage ?? ""}`);
        reported = true;
        throw new Error(tok.UserErrorMessage || "פרטי הכרטיס לא תקינים. בדקו את המספר, התוקף וה-CVV ונסו שוב.");
      }
      const res = await fetch("/api/teachers/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ singleUseToken: tok.Data.SingleUseToken, phone }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        reportFailure("subscribe", `status ${res.status} ${j.error ?? ""}`);
        reported = true;
        throw new Error(j.error || "ההרשמה נכשלה");
      }
      setDone({ first_charge_date: j.first_charge_date, deferred: !!j.deferred });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "שגיאה";
      // ענף שלא דיווח בעצמו (חריגת רשת, חוסם פרסומות שחסם את Sumit).
      if (!reported) reportFailure("exception", msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const wrap = "min-h-screen bg-white px-5 py-12";
  const inner = "mx-auto max-w-xl";
  const field = "w-full rounded-xl border border-[#DDE9E8] px-4 py-3 text-base outline-none focus:border-[#3D8C8A]";

  if (checking) return <div className={wrap} dir="rtl"><div className={inner}><p className="text-sm text-[#6B807E]">טוען...</p></div></div>;
  if (signedOut) {
    return (
      <div className={wrap} dir="rtl">
        <div className={inner}>
          <h1 className="mb-3 text-2xl font-black text-[#131F1E]">הכניסה היא דרך הקישור האישי</h1>
          <p className="mb-5 leading-7 text-[#3E5250]">עמוד ההרשמה נפתח מהקישור האישי שנשלח אליך במייל. אפשר לקבל אותו שוב:</p>
          <a href="/learning/me" className="inline-block rounded-full bg-[#3D8C8A] px-7 py-3 text-base font-black text-white hover:bg-[#2A6462]">לקבלת הקישור במייל</a>
        </div>
      </div>
    );
  }
  if (gateError || !offer) {
    return <div className={wrap} dir="rtl"><div className={inner}><p className="leading-7 text-red-700">{gateError || "שגיאה בטעינה"}</p></div></div>;
  }
  if (done) {
    return (
      <div className={wrap} dir="rtl">
        <div className={inner}>
          <h1 className="mb-3 text-2xl font-black text-[#131F1E]">ההרשמה הושלמה</h1>
          <p className="mb-4 leading-7 text-[#3E5250]">הפרופיל שלך ממשיך להופיע להורים. חשבונית נשלחת במייל בכל חיוב.</p>
          <div className="rounded-2xl border border-[#DDE9E8] bg-[#F7FAF9] p-5 leading-7 text-[#3E5250]">
            החיוב הראשון: <strong>{hebDate(done.first_charge_date)}</strong>{done.deferred ? " - בסוף תקופת הניסיון, לא היום." : "."} ביטול בכל שלב, בהודעת מייל ל-admin@getmentalytics.com.
          </div>
          <a href="/learning/me" className="mt-6 inline-block rounded-full bg-[#3D8C8A] px-7 py-3 text-base font-black text-white hover:bg-[#2A6462]">לפרופיל ולנתונים שלי</a>
        </div>
      </div>
    );
  }
  if (!offer.can_pay) {
    return (
      <div className={wrap} dir="rtl">
        <div className={inner}>
          <h1 className="mb-3 text-2xl font-black text-[#131F1E]">{offer.already_subscribed ? "ההרשמה כבר הושלמה" : "עדיין אין מה להסדיר"}</h1>
          <p className="leading-7 text-[#3E5250]">
            {offer.already_subscribed
              ? "קיימת כבר הוראת קבע פעילה. לשינוי או לביטול - בהודעת מייל ל-admin@getmentalytics.com."
              : "הפרופיל עדיין ממתין לאימות ההכשרה. נעדכן במייל כשיאושר."}
          </p>
          <a href="/learning/me" className="mt-6 inline-block text-sm font-bold text-[#2A6462] underline">לפרופיל שלי</a>
        </div>
      </div>
    );
  }

  const archived = offer.listing_state === "archived";
  return (
    <div className={wrap} dir="rtl">
      <div className={inner}>
        <h1 className="mb-2 text-3xl font-black text-[#131F1E]">
          {archived ? "הפעלת הפרופיל מחדש" : "המשך ההופעה במאגר"} - {offer.amount_gross} ש״ח לחודש כולל מע״מ
        </h1>
        <p className="mb-6 leading-7 text-[#3E5250]">שלום {offer.teacher_name}. ללא התחייבות, ביטול בכל עת.</p>
        <div className="mb-8 rounded-2xl border border-[#C2DFDE] bg-[#EAF4F3] p-5">
          <div className="mb-3 text-sm font-black text-[#2A6462]">מה בדיוק קורה</div>
          <ul className="space-y-2 leading-7 text-[#131F1E]">
            <li>
              החיוב הראשון: <strong>{hebDate(offer.first_charge_date)}</strong>
              {offer.deferred ? " - בסוף תקופת הניסיון. עד אז לא נגבה דבר." : " - היום."} אחר כך בכל חודש, {offer.amount_gross} ש״ח כולל מע״מ, עם חשבונית במייל.
            </li>
            <li>
              ביטול בכל שלב, בהודעת מייל אלינו.{offer.deferred ? ` ביטול לפני ${hebDate(offer.first_charge_date)} - ולא ייגבה תשלום כלל.` : ""}
            </li>
            <li>{archived ? "הפרופיל חוזר למאגר ומוצג להורים מיד עם ההרשמה." : "הפרופיל ממשיך להופיע להורים כל עוד המנוי פעיל."}</li>
            <li>פרטי הכרטיס נשמרים אצל ספק הסליקה (Sumit) ולא עוברים דרכנו.</li>
          </ul>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-bold text-[#3E5250]">מספר כרטיס</label>
            <input value={card} onChange={(e) => setCard(e.target.value)} name="cardnumber" autoComplete="cc-number" inputMode="numeric" required className={field} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-sm font-bold text-[#3E5250]">חודש</label>
              <input value={expMonth} onChange={(e) => setExpMonth(e.target.value)} name="ccmonth" autoComplete="cc-exp-month" inputMode="numeric" placeholder="12" required className={field} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-[#3E5250]">שנה</label>
              <input value={expYear} onChange={(e) => setExpYear(e.target.value)} name="ccyear" autoComplete="cc-exp-year" inputMode="numeric" placeholder="2030" required className={field} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-[#3E5250]">CVV</label>
              <input value={cvv} onChange={(e) => setCvv(e.target.value)} name="cvc" autoComplete="cc-csc" inputMode="numeric" required className={field} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-bold text-[#3E5250]">תעודת זהות</label>
              <input value={citizenId} onChange={(e) => setCitizenId(e.target.value)} name="citizenId" autoComplete="off" inputMode="numeric" required className={field} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-[#3E5250]">טלפון</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} name="tel" autoComplete="tel" inputMode="tel" className={field} />
            </div>
          </div>
          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <button type="submit" disabled={loading} className="w-full rounded-full bg-[#3D8C8A] px-8 py-4 text-lg font-bold text-white transition hover:bg-[#2A6462] disabled:opacity-50">
            {loading ? "רגע..." : offer.deferred ? "הרשמה - ללא חיוב היום" : "הרשמה"}
          </button>
        </form>
      </div>
    </div>
  );
}
