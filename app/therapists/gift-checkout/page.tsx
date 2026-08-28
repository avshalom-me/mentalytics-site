"use client";

import { useEffect, useState } from "react";
import { usePageView } from "@/app/lib/useTrack";

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
  expires_at: string;
  amount: number;
};

type SumitConfig = { companyId: string; publicKey: string };
type SumitTokenizeResponse = {
  Status: number;
  UserErrorMessage?: string;
  Data: { SingleUseToken?: string } | null;
};

// דיווח כשל מצד הדפדפן. בלעדיו הצטרפות שנשברה אצל המטפל לא משאירה שום
// עקבה בשרת, ואי אפשר להבדיל בין "אף אחד לא ניסה" ל"מישהו ניסה ונשבר".
// אותו מסלול בדיוק שנבנה להצטרפות מרכזים אחרי שני אירועים כאלה.
function reportFailure(stage: "gate" | "config" | "tokenize" | "subscribe" | "exception", message: string) {
  const safeStage = stage === "gate" ? "exception" : stage;
  fetch("/api/payment-client-error", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: "gift_join", stage: safeStage, message: `${stage}: ${message}` }),
    keepalive: true,
  }).catch(() => {});
}

function hebDate(iso: string): string {
  return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
}

// כמה נשאר עד סגירת הקישור. ביום האחרון נכון לומר שעות ולא "0 ימים".
function timeLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "פג";
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "פחות משעה";
  if (hours < 24) return `${hours} שעות`;
  const days = Math.round(hours / 24);
  return days === 1 ? "יום אחד" : `${days} ימים`;
}

export default function GiftCheckoutPage() {
  // מי בכלל פתח את הקישור. בלי זה "אף אחד לא נרשם" הוא נתון חסר משמעות:
  // אי אפשר לדעת אם המייל לא נפתח, או שהעמוד נפתח והמסלול נשבר.
  usePageView("gift-checkout", "therapist");
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
        else {
          setGateError(j.error || "הקישור אינו תקף");
          reportFailure("gate", j.reason || j.error || "unknown");
        }
      })
      .catch(() => {
        setGateError("שגיאה בבדיקת הקישור");
        reportFailure("gate", "fetch failed");
      })
      .finally(() => setChecking(false));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const cardDigits = card.replace(/\D/g, "");
      const cfgRes = await fetch("/api/payments/sumit-config");
      if (!cfgRes.ok) {
        reportFailure("config", `status ${cfgRes.status}`);
        throw new Error("שגיאה בטעינת מערכת התשלום. נסו שוב בעוד מספר רגעים.");
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
        reportFailure("tokenize", `status ${tok.Status} ${tok.UserErrorMessage ?? ""}`);
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
      if (!res.ok || !j.ok) {
        reportFailure("subscribe", `status ${res.status} ${j.error ?? ""}`);
        throw new Error(j.error || "ההרשמה נכשלה");
      }
      setDone({ first_charge_date: j.first_charge_date });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "שגיאה";
      // ענף שלא דיווח בעצמו (חריגת רשת, חוסם פרסומות שחסם את Sumit).
      if (!/^(שגיאה בטעינת מערכת|פרטי הכרטיס לא תקינים)/.test(msg)) reportFailure("exception", msg);
      setError(msg);
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
          {/* הצעד הבא הוא לראות את הפרופיל המקודם ואת הנתונים שלו. בלי
              הכפתור הזה המסך היה מסתיים בלי שום מקום ללכת אליו. */}
          <a
            href="/therapists/dashboard"
            className="mt-6 inline-block rounded-full bg-[#3D8C8A] px-7 py-3 text-base font-black text-white hover:bg-[#2A6462]"
          >
            לאזור האישי והסטטיסטיקות שלי
          </a>
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

        {/* מועד הסגירה. מעל קופסת התנאים ולא בתוכה: זו מגבלה שנאכפת בקוד
            (הקישור מפסיק לעבוד), ולכן היא צריכה להיקרא לפני שממלאים כרטיס. */}
        <div className="mb-4 rounded-2xl border border-[#E8CE94] bg-[#FDF6E3] px-5 py-3 leading-7 text-[#131F1E]">
          ההצעה תקפה עד <strong>{hebDate(offer.expires_at)}</strong> - נותרו{" "}
          {timeLeft(offer.expires_at)}. אחרי המועד הזה הקישור נסגר, ואפשר לבקש חדש בתשובה
          לאותו מייל.
        </div>

        {/* קופסת ההבהרה - מה בדיוק קורה ומתי. זו ההתחייבות שהובטחה במייל,
            ולכן היא מופיעה כאן מעל כפתור התשלום ולא בהערת שוליים. */}
        <div className="mb-8 rounded-2xl border border-[#C2DFDE] bg-[#EAF4F3] p-5">
          <div className="mb-3 text-sm font-black text-[#2A6462]">מה מקבלים, ובאילו תנאים</div>
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
