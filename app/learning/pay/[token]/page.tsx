"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { usePageView } from "@/app/lib/useTrack";

// הסדרת התשלום של מורה: 60 ש"ח לחודש כולל מע"מ, ללא התחייבות. פרטי הכרטיס
// עוברים ישירות ל-Sumit (טוקן חד-פעמי) - אותו מסלול כמו הצ'ק-אאוט של
// המטפלים ושל מסלול ההזמנה. כשהניסיון עוד רץ, החיוב הראשון נדחה לסופו.

const SUMIT_TOKENIZE_URL = "https://api.sumit.co.il/creditguy/vault/tokenizesingleusejson/";

type Offer = {
  teacher_name: string;
  listing_state: string;
  trial_ends_at: string | null;
  first_charge_date: string;
  deferred: boolean;
  amount_gross: number;
  already_paying: boolean;
  can_pay: boolean;
};
type SumitConfig = { companyId: string; publicKey: string };
type SumitTokenizeResponse = { Status: number; UserErrorMessage?: string; Data: { SingleUseToken?: string } | null };

function hebDate(iso: string): string {
  return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
}

function reportFailure(stage: string, message: string) {
  fetch("/api/payment-client-error", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: "teacher_pay", stage: stage === "gate" ? "exception" : stage, message: `${stage}: ${message}` }),
    keepalive: true,
  }).catch(() => {});
}

export default function TeacherPayPage() {
  usePageView("learning-pay", "teacher");
  const params = useParams<{ token: string }>();
  const token = decodeURIComponent(params?.token ?? "");
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
  const [done, setDone] = useState<{ first_charge_date: string; deferred: boolean } | null>(null);

  useEffect(() => {
    fetch(`/api/teachers/subscribe?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setOffer(j as Offer);
        else {
          setGateError(j.error || "הקישור אינו תקף");
          reportFailure("gate", j.error || "unknown");
        }
      })
      .catch(() => setGateError("שגיאה בבדיקת הקישור"))
      .finally(() => setChecking(false));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
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
        throw new Error(tok.UserErrorMessage || "פרטי הכרטיס לא תקינים. בדקו את המספר, התוקף וה-CVV ונסו שוב.");
      }
      const res = await fetch("/api/teachers/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, singleUseToken: tok.Data.SingleUseToken, phone }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        reportFailure("subscribe", `status ${res.status} ${j.error ?? ""}`);
        throw new Error(j.error || "ההרשמה נכשלה");
      }
      setDone({ first_charge_date: j.first_charge_date, deferred: !!j.deferred });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "שגיאה";
      if (!/^(שגיאה בטעינת מערכת|פרטי הכרטיס לא תקינים)/.test(msg)) reportFailure("exception", msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const wrap = "min-h-screen bg-white px-5 py-12";
  const inner = "mx-auto max-w-xl";
  const field = "w-full rounded-xl border border-[#DDE9E8] px-4 py-3 text-base outline-none focus:border-[#3D8C8A]";
  const editUrl = `/learning/edit/${encodeURIComponent(token)}`;

  if (checking) return <div className={wrap} dir="rtl"><div className={inner}><p className="text-sm text-[#6B807E]">בודקים את הקישור...</p></div></div>;
  if (gateError || !offer) {
    return (
      <div className={wrap} dir="rtl">
        <div className={inner}>
          <h1 className="mb-3 text-2xl font-black text-[#131F1E]">הקישור אינו תקף</h1>
          <p className="leading-7 text-[#3E5250]">{gateError}</p>
        </div>
      </div>
    );
  }
  if (done) {
    return (
      <div className={wrap} dir="rtl">
        <div className={inner}>
          <h1 className="mb-3 text-2xl font-black text-[#131F1E]">התשלום הוסדר</h1>
          <p className="mb-4 leading-7 text-[#3E5250]">הוראת הקבע נפתחה. חשבונית נשלחת אוטומטית בכל חיוב.</p>
          <div className="rounded-2xl border border-[#DDE9E8] bg-[#F7FAF9] p-5 leading-7 text-[#3E5250]">
            החיוב הראשון: <strong>{hebDate(done.first_charge_date)}</strong>{done.deferred ? " - בסוף תקופת הניסיון, לא היום." : "."} ביטול בכל שלב בהודעת מייל אלינו.
          </div>
          <a href={editUrl} className="mt-6 inline-block rounded-full bg-[#3D8C8A] px-7 py-3 text-base font-black text-white hover:bg-[#2A6462]">לפרופיל ולנתונים שלי</a>
        </div>
      </div>
    );
  }
  if (!offer.can_pay) {
    return (
      <div className={wrap} dir="rtl">
        <div className={inner}>
          <h1 className="mb-3 text-2xl font-black text-[#131F1E]">{offer.already_paying ? "התשלום כבר מוסדר" : "עדיין אין מה להסדיר"}</h1>
          <p className="leading-7 text-[#3E5250]">
            {offer.already_paying ? "קיימת כבר הוראת קבע פעילה. לשינוי או לביטול - בהודעת מייל אלינו." : "הפרופיל עדיין ממתין לאימות ההכשרה. נעדכן במייל כשיאושר."}
          </p>
          <a href={editUrl} className="mt-6 inline-block text-sm font-bold text-[#2A6462] underline">לפרופיל שלי</a>
        </div>
      </div>
    );
  }

  return (
    <div className={wrap} dir="rtl">
      <div className={inner}>
        <h1 className="mb-2 text-3xl font-black text-[#131F1E]">הסדרת התשלום - {offer.amount_gross} ש״ח לחודש כולל מע״מ</h1>
        <p className="mb-6 leading-7 text-[#3E5250]">שלום {offer.teacher_name}. ללא התחייבות, ביטול בכל עת.</p>
        <div className="mb-8 rounded-2xl border border-[#C2DFDE] bg-[#EAF4F3] p-5">
          <div className="mb-3 text-sm font-black text-[#2A6462]">מה בדיוק קורה</div>
          <ul className="space-y-2 leading-7 text-[#131F1E]">
            <li>הכרטיס נשמר אצל ספק הסליקה (Sumit) ולא עובר דרכנו.</li>
            <li>
              החיוב הראשון: <strong>{hebDate(offer.first_charge_date)}</strong>
              {offer.deferred ? " - בסוף תקופת הניסיון. עד אז לא ייגבה דבר." : "."} אחר כך בכל חודש, {offer.amount_gross} ש״ח כולל מע״מ, עם חשבונית במייל.
            </li>
            <li>ביטול בכל שלב בהודעת מייל אלינו. {offer.deferred ? `אם תבטל/י לפני ${hebDate(offer.first_charge_date)}, לא ייגבה תשלום כלל.` : ""}</li>
            <li>הפרופיל ממשיך להופיע להורים כל עוד המנוי פעיל{offer.listing_state === "expired" ? ", וחוזר למאגר מיד עם ההסדרה" : ""}.</li>
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
            {loading ? "מסדירים..." : offer.deferred ? "הסדרה - ללא חיוב היום" : "הסדרת התשלום"}
          </button>
          <p className="text-center text-sm text-[#6B807E]">פרטי הכרטיס נשמרים ישירות אצל ספק הסליקה ולא עוברים דרכנו.</p>
        </form>
      </div>
    </div>
  );
}
