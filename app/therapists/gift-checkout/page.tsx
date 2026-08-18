"use client";

import { useEffect, useState } from "react";

// עמוד ההצטרפות במסלול ההזמנה: חודשיים ראשונים ללא תשלום, ואחריהם המנוי
// הרגיל. נפתח רק עם קישור אישי תקף - בלעדיו אין כאן טופס בכלל.
//
// פרטי הכרטיס לא עוברים דרך השרת שלנו: הם נשלחים ישירות ל-Sumit שמחזיר
// טוקן חד-פעמי, וזה מה שנשלח אלינו. אותו מסלול בדיוק כמו הצ'ק-אאוט הרגיל.

const SUMIT_TOKENIZE_URL = "https://api.sumit.co.il/creditguy/vault/tokenizesingleusejson/";

type Offer = {
  therapist_name: string;
  treatment: string | null;
  region: string | null;
  gift_months: number;
  first_charge_date: string;
  amount: number;
};

type SumitConfig = { companyId: string; publicKey: string };
type SumitTokenizeResponse = {
  Status: number;
  UserErrorMessage?: string;
  Data: { SingleUseToken?: string } | null;
};

function hebDate(iso: string): string {
  return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
}

export default function GiftCheckoutPage() {
  const [token, setToken] = useState("");
  const [offer, setOffer] = useState<Offer | null>(null);
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
  const [done, setDone] = useState<{ first_charge_date: string } | null>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token") ?? "";
    setToken(t);
    fetch(`/api/payments/gift-trial-subscription?token=${encodeURIComponent(t)}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setOffer(j as Offer);
        else setGateError(j.error || "הקישור אינו תקף");
      })
      .catch(() => setGateError("שגיאה בבדיקת הקישור"))
      .finally(() => setChecking(false));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const cardDigits = card.replace(/\D/g, "");
      const cfgRes = await fetch("/api/payments/sumit-config");
      if (!cfgRes.ok) throw new Error("שגיאה בטעינת מערכת התשלום. נסו שוב בעוד מספר רגעים.");
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
        throw new Error(
          tok.UserErrorMessage || "פרטי הכרטיס לא תקינים. בדקו את המספר, התוקף וה-CVV ונסו שוב."
        );
      }

      const res = await fetch("/api/payments/gift-trial-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, singleUseToken: tok.Data.SingleUseToken, phone }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "ההרשמה נכשלה");
      setDone({ first_charge_date: j.first_charge_date });
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setLoading(false);
    }
  }

  const wrap = "min-h-screen bg-white px-5 py-12";
  const inner = "mx-auto max-w-xl";

  if (checking) {
    return (
      <div className={wrap} dir="rtl">
        <div className={inner}>
          <p className="text-sm text-[#6B807E]">בודקים את הקישור...</p>
        </div>
      </div>
    );
  }

  if (gateError || !offer) {
    return (
      <div className={wrap} dir="rtl">
        <div className={inner}>
          <h1 className="mb-3 text-2xl font-black text-[#131F1E]">הקישור אינו תקף</h1>
          <p className="mb-6 leading-7 text-[#3E5250]">{gateError}</p>
          <p className="text-sm text-[#6B807E]">
            המסלול הזה נפתח רק דרך קישור אישי שנשלח במייל. אם קיבלתם קישור ותוקפו פג, השיבו לאותו
            מייל ונשלח קישור חדש.
          </p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className={wrap} dir="rtl">
        <div className={inner}>
          <h1 className="mb-3 text-2xl font-black text-[#131F1E]">ההצטרפות הושלמה</h1>
          <p className="mb-4 leading-7 text-[#3E5250]">
            הפרופיל שלך נכנס למערכת ההתאמות ויוצג למטופלים מתאימים כבר עכשיו.
          </p>
          <div className="rounded-2xl border border-[#DDE9E8] bg-[#F7FAF9] p-5 leading-7 text-[#3E5250]">
            החיוב הראשון: <strong>{hebDate(done.first_charge_date)}</strong>. שבוע לפני התאריך הזה
            יישלח אליך מייל תזכורת. ביטול בכל שלב בהודעת מייל אלינו.
          </div>
        </div>
      </div>
    );
  }

  const field =
    "w-full rounded-xl border border-[#DDE9E8] px-4 py-3 text-base outline-none focus:border-[#3D8C8A]";

  return (
    <div className={wrap} dir="rtl">
      <div className={inner}>
        <h1 className="mb-2 text-3xl font-black text-[#131F1E]">
          הצטרפות לקידום - {offer.gift_months} חודשים ראשונים ללא תשלום
        </h1>
        <p className="mb-6 leading-7 text-[#3E5250]">
          שלום {offer.therapist_name}, זהו קישור אישי שנשלח אליך בעקבות הפער שזיהינו
          {offer.treatment ? ` בתחום ${offer.treatment}` : ""}
          {offer.region ? ` באזור ${offer.region}` : ""}.
        </p>

        {/* קופסת ההבהרה - מה בדיוק קורה ומתי. זו ההתחייבות שהובטחה במייל,
            ולכן היא מופיעה כאן מעל כפתור התשלום ולא בהערת שוליים. */}
        <div className="mb-8 rounded-2xl border border-[#C2DFDE] bg-[#EAF4F3] p-5">
          <ul className="space-y-2 leading-7 text-[#131F1E]">
            <li>הקידום מתחיל היום, והפרופיל נכנס למערכת ההתאמות מיד.</li>
            <li>
              החיוב הראשון: <strong>{hebDate(offer.first_charge_date)}</strong>, בסך {offer.amount} ש"ח
              + מע"מ לחודש.
            </li>
            <li>שבוע לפני התאריך הזה יישלח אליך מייל תזכורת.</li>
            <li>
              ביטול בכל שלב בהודעת מייל אלינו. אם תבטל/י לפני {hebDate(offer.first_charge_date)}, לא
              ייגבה תשלום כלל.
            </li>
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

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-[#3D8C8A] px-8 py-4 text-lg font-bold text-white transition hover:bg-[#2A6462] disabled:opacity-50"
          >
            {loading ? "מצטרפים..." : "הצטרפות - ללא חיוב היום"}
          </button>
          <p className="text-center text-sm text-[#6B807E]">
            לא ייגבה תשלום היום. פרטי הכרטיס נשמרים ישירות אצל ספק הסליקה ולא עוברים דרכנו.
          </p>
        </form>
      </div>
    </div>
  );
}
