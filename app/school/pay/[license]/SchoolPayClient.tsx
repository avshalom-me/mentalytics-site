"use client";

import { useEffect, useState } from "react";
import { LICENSE_KINDS, labelOf, type PaymentDetails } from "@/app/lib/schools-crm";

// דף התשלום של בית ספר עבור רישיון לשאלון היועצות. בית הספר מגיע לכאן
// מהקישור שנשלח לו, רואה מה לשלם ובוחר איך: העברה בנקאית (הדרך הרגילה
// במוסדות חינוך), כרטיס אשראי (פרטי הכרטיס עוברים ישירות ל-Sumit, כמו בשאר
// עמודי התשלום), או המחאה. העברה והמחאה נרשמות באדמין כשהכסף מגיע; חיוב
// בכרטיס נרשם מיד, ואם זה התשלום הראשון הרישיון מופעל וקוד הגישה מוצג כאן.

const SUMIT_TOKENIZE_URL = "https://api.sumit.co.il/creditguy/vault/tokenizesingleusejson/";

type Payment = { id: string; seq: number; amount_gross: number; due_date: string | null; status: string; received_at: string | null; method: string | null };
type Page = {
  license: { id: string; kind: string; status: string; school_year: string; start_date: string; end_date: string; price_gross: number; price_net: number; vat: number; schedule_kind: string };
  school: { name: string; symbol: string | null };
  payments: Payment[];
  next: Payment | null;
  open: boolean;
  details: PaymentDetails;
};
type SumitConfig = { companyId: number; publicKey: string };
type SumitTokenizeResponse = { Status: number; UserErrorMessage?: string | null; Data: { SingleUseToken?: string } | null };
type Done = { amount_gross: number; seq: number; license_active: boolean; access_code?: string };

function hebDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${Number(d)}.${Number(m)}.${y}`;
}
const shekel = (n: number) => `${n.toLocaleString("he-IL", { maximumFractionDigits: 2 })} ש"ח`;

function reportFailure(stage: "config" | "tokenize" | "charge" | "exception", message: string) {
  fetch("/api/payment-client-error", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: "school_pay", stage, message }),
    keepalive: true,
  }).catch(() => {});
}

export default function SchoolPayClient({ licenseId }: { licenseId: string }) {
  const [page, setPage] = useState<Page | null>(null);
  const [loadError, setLoadError] = useState("");
  const [checking, setChecking] = useState(true);
  const [done, setDone] = useState<Done | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/school-pay/${encodeURIComponent(licenseId)}`, { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (cancelled) return;
        if (r.ok && j?.ok) setPage(j as Page);
        else setLoadError(j?.error || "הקישור אינו תקין, או שהרישיון אינו קיים.");
      })
      .catch(() => {
        if (!cancelled) setLoadError("לא הצלחנו לטעון את פרטי התשלום. אפשר לרענן את העמוד.");
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [licenseId]);

  const wrap = "min-h-screen bg-white px-5 py-12";
  const inner = "mx-auto max-w-2xl";

  if (checking) return <div className={wrap} dir="rtl"><div className={inner}><p className="text-sm text-[var(--muted)]">טוען...</p></div></div>;
  if (loadError || !page) {
    return (
      <div className={wrap} dir="rtl">
        <div className={inner}>
          <h1 className="mb-3 text-2xl font-black text-[var(--text)]">הקישור אינו תקין</h1>
          <p className="leading-7 text-[var(--text-2)]">{loadError || "הרישיון אינו קיים."} לקבלת קישור חדש אפשר לפנות לצוות טיפול חכם.</p>
        </div>
      </div>
    );
  }

  const { license, school, payments, next, details } = page;
  const schoolLine = school.symbol ? `${school.name} (סמל מוסד ${school.symbol})` : school.name;

  if (done) {
    return (
      <div className={wrap} dir="rtl">
        <div className={inner}>
          <h1 className="mb-3 text-2xl font-black text-[var(--text)]">התשלום התקבל</h1>
          <p className="mb-4 leading-7 text-[var(--text-2)]">
            {shekel(done.amount_gross)} עבור {schoolLine}. חשבונית מס/קבלה נשלחת למייל שצוין.
          </p>
          {done.license_active && done.access_code ? (
            <div className="rounded-2xl border border-[var(--teal-mid)] bg-[var(--teal-pale)] p-5">
              <div className="text-sm font-black text-[var(--teal-dark)]">הרישיון הופעל. קוד הגישה של בית הספר:</div>
              <div dir="ltr" className="my-3 text-center text-3xl font-black tracking-[0.3em] text-[var(--text)]">{done.access_code}</div>
              <p className="text-sm leading-6 text-[var(--text-2)]">
                להעביר ליועצת. מקלידים אותו פעם אחת בכל מכשיר בכתובת mentalytics.co.il/school, והשאלון נפתח עד {hebDate(license.end_date)}.
                הקוד נשמר גם אצלנו: אפשר לקבל אותו שוב מצוות טיפול חכם.
              </p>
            </div>
          ) : (
            <p className="leading-7 text-[var(--text-2)]">הרישיון של בית הספר ממשיך כרגיל.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={wrap} dir="rtl">
      <div className={inner}>
        <h1 className="mb-2 text-3xl font-black text-[var(--text)]">תשלום עבור רישיון לשאלון היועצות</h1>
        <p className="mb-6 leading-7 text-[var(--text-2)]">
          {schoolLine}. רישיון {labelOf(LICENSE_KINDS, license.kind)} לשנת הלימודים {license.school_year}, מ-{hebDate(license.start_date)} עד {hebDate(license.end_date)}.
        </p>

        <section className="mb-8 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-sm font-black text-[var(--text-2)]">סך הרישיון</div>
            <div className="text-2xl font-black text-[var(--text)]">{shekel(license.price_gross)} <span className="text-sm font-bold text-[var(--muted)]">כולל מע&quot;מ</span></div>
          </div>
          <div className="mt-1 text-sm text-[var(--muted)]">{shekel(license.price_net)} לפני מע&quot;מ, {shekel(license.vat)} מע&quot;מ.</div>
          <table className="mt-4 w-full text-sm">
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-t border-[var(--line)]">
                  <td className="py-2 font-bold text-[var(--text)]">{payments.length > 1 ? `תשלום ${p.seq} מתוך ${payments.length}` : "תשלום אחד"}</td>
                  <td className="py-2 text-[var(--text-2)]">{shekel(p.amount_gross)}</td>
                  <td className="py-2 text-[var(--text-2)]">{p.due_date ? `עד ${hebDate(p.due_date)}` : ""}</td>
                  <td className="py-2 text-end">
                    {p.status === "received" ? (
                      <span className="rounded-full bg-[var(--teal-pale)] px-3 py-1 text-xs font-bold text-[var(--teal-dark)]">התקבל {hebDate(p.received_at)}</span>
                    ) : p.status === "expected" ? (
                      <span className="rounded-full bg-[var(--gold-pale)] px-3 py-1 text-xs font-bold text-[var(--gold-dark)]">{next?.id === p.id ? "לתשלום" : "בהמשך"}</span>
                    ) : (
                      <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs font-bold text-[var(--muted)]">{p.status === "refunded" ? "הוחזר" : "בוטל"}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {!page.open ? (
          <p className="leading-7 text-[var(--text-2)]">הרישיון הזה אינו פתוח לתשלום. לשאלות אפשר לפנות לצוות טיפול חכם{details.contact_email ? ` ב-${details.contact_email}` : ""}.</p>
        ) : !next ? (
          <p className="leading-7 text-[var(--text-2)]">{payments.length === 0 ? "לרישיון הזה אין תשלום." : "כל התשלומים של הרישיון התקבלו. תודה."}</p>
        ) : (
          <PayOptions licenseId={licenseId} next={next} total={payments.length} details={details} schoolLine={schoolLine} onDone={setDone} />
        )}

        <section className="mt-10 border-t border-[var(--line)] pt-6 text-sm leading-6 text-[var(--muted)]">
          <p>
            חשבונית מס/קבלה מונפקת עם קבלת התשלום. בית ספר שרוכש דרך הגפ&quot;ן משלם לפי כללי משרד החינוך, לאחר קבלת השירות; מסמכי הספק
            (אישור ניהול ספרים, ניכוי מס במקור ופרטי חשבון) נמסרים לפי בקשה.
          </p>
          {details.company_number && <p className="mt-2">{details.payee ? `${details.payee}, ` : ""}ח.פ. {details.company_number}.</p>}
        </section>
      </div>
    </div>
  );
}

function PayOptions({ licenseId, next, total, details, schoolLine, onDone }: { licenseId: string; next: Payment; total: number; details: PaymentDetails; schoolLine: string; onDone: (d: Done) => void }) {
  const [method, setMethod] = useState<"transfer" | "card" | "check">("transfer");
  const tab = (key: typeof method, label: string) => (
    <button
      type="button"
      onClick={() => setMethod(key)}
      className={`rounded-full px-5 py-2 text-sm font-bold transition ${method === key ? "bg-[var(--teal)] text-white" : "border border-[var(--line)] text-[var(--text-2)] hover:border-[var(--teal)]"}`}
    >
      {label}
    </button>
  );
  const hasBank = !!(details.payee && details.bank_name && details.bank_account);

  return (
    <section>
      <h2 className="mb-1 text-xl font-black text-[var(--text)]">
        לתשלום עכשיו: {shekel(next.amount_gross)}
        {total > 1 ? <span className="text-base font-bold text-[var(--muted)]"> (תשלום {next.seq} מתוך {total})</span> : null}
      </h2>
      <p className="mb-4 text-sm text-[var(--text-2)]">{next.due_date ? `מועד התשלום: עד ${hebDate(next.due_date)}.` : ""} בוחרים איך לשלם:</p>
      <div className="mb-5 flex flex-wrap gap-2">
        {tab("transfer", "העברה בנקאית")}
        {tab("card", "כרטיס אשראי")}
        {tab("check", "המחאה")}
      </div>

      {method === "transfer" && (
        <div className="rounded-2xl border border-[var(--line)] p-5 leading-7 text-[var(--text-2)]">
          {hasBank ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="font-bold text-[var(--text)]">לזכות</dt><dd>{details.payee}</dd>
              <dt className="font-bold text-[var(--text)]">בנק</dt><dd>{details.bank_name}{details.bank_branch ? `, סניף ${details.bank_branch}` : ""}</dd>
              <dt className="font-bold text-[var(--text)]">חשבון</dt><dd dir="ltr" className="text-start">{details.bank_account}</dd>
              {details.iban && (<><dt className="font-bold text-[var(--text)]">IBAN</dt><dd dir="ltr" className="text-start">{details.iban}</dd></>)}
            </dl>
          ) : (
            <p>פרטי חשבון הבנק נשלחים לבית הספר יחד עם דרישת התשלום{details.contact_email ? `, ואפשר לבקש אותם ב-${details.contact_email}` : ""}.</p>
          )}
          <p className="mt-3">
            באסמכתא של ההעברה כותבים את שם בית הספר{schoolLine.includes("סמל") ? " וסמל המוסד" : ""}. אחרי ההעברה, אישור ההעברה נשלח
            {details.contact_email ? ` ל-${details.contact_email}` : " אלינו במייל"}; עם קבלת הכסף מונפקת חשבונית מס/קבלה
            {next.seq === 1 ? ", והרישיון מופעל: קוד הגישה נמסר לבית הספר." : "."}
          </p>
        </div>
      )}

      {method === "check" && (
        <div className="rounded-2xl border border-[var(--line)] p-5 leading-7 text-[var(--text-2)]">
          <p>המחאה לפקודת {details.payee || "החברה (השם המלא נמסר עם דרישת התשלום)"}, על סך {shekel(next.amount_gross)}.</p>
          <p className="mt-2">{details.check_address ? `למשלוח: ${details.check_address}.` : "כתובת למשלוח נמסרת עם דרישת התשלום."} חשבונית מס/קבלה מונפקת עם קבלת ההמחאה{next.seq === 1 ? ", ואז הרישיון מופעל וקוד הגישה נמסר לבית הספר." : "."}</p>
        </div>
      )}

      {method === "card" && <CardForm licenseId={licenseId} amount={next.amount_gross} onDone={onDone} />}
    </section>
  );
}

function CardForm({ licenseId, amount, onDone }: { licenseId: string; amount: number; onDone: (d: Done) => void }) {
  const [payerName, setPayerName] = useState("");
  const [payerEmail, setPayerEmail] = useState("");
  const [payerPhone, setPayerPhone] = useState("");
  const [card, setCard] = useState("");
  const [expMonth, setExpMonth] = useState("");
  const [expYear, setExpYear] = useState("");
  const [cvv, setCvv] = useState("");
  const [citizenId, setCitizenId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const field = "w-full rounded-xl border border-[var(--line)] px-4 py-3 text-base outline-none focus:border-[var(--teal)]";
  const label = "mb-1 block text-sm font-bold text-[var(--text-2)]";

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
        throw new Error("שגיאה בטעינת מערכת התשלום. אפשר לנסות שוב בעוד כמה רגעים.");
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
        throw new Error(tok.UserErrorMessage || "פרטי הכרטיס לא תקינים. בודקים את המספר, התוקף וה-CVV ומנסים שוב.");
      }
      const res = await fetch(`/api/school-pay/${encodeURIComponent(licenseId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ singleUseToken: tok.Data.SingleUseToken, payerName, payerEmail, payerPhone }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        reportFailure("charge", `status ${res.status} ${j.error ?? ""}`);
        reported = true;
        throw new Error(j.error || "החיוב לא הושלם.");
      }
      onDone(j as Done);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "שגיאה";
      if (!reported) reportFailure("exception", msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-[var(--line)] p-5">
      <p className="text-sm leading-6 text-[var(--text-2)]">חיוב חד-פעמי של {shekel(amount)}. פרטי הכרטיס נשמרים אצל ספק הסליקה (Sumit) ולא עוברים דרכנו. חשבונית מס/קבלה נשלחת למייל שלמטה.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="sp-name" className={label}>שם המשלם/ת</label>
          <input id="sp-name" value={payerName} onChange={(e) => setPayerName(e.target.value)} autoComplete="name" required className={field} />
        </div>
        <div>
          <label htmlFor="sp-email" className={label}>מייל לחשבונית</label>
          <input id="sp-email" dir="ltr" type="email" value={payerEmail} onChange={(e) => setPayerEmail(e.target.value)} autoComplete="email" required className={field} />
        </div>
      </div>
      <div>
        <label htmlFor="sp-card" className={label}>מספר כרטיס</label>
        <input id="sp-card" dir="ltr" value={card} onChange={(e) => setCard(e.target.value)} name="cardnumber" autoComplete="cc-number" inputMode="numeric" required className={field} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label htmlFor="sp-month" className={label}>חודש</label>
          <input id="sp-month" dir="ltr" value={expMonth} onChange={(e) => setExpMonth(e.target.value)} name="ccmonth" autoComplete="cc-exp-month" inputMode="numeric" placeholder="12" required className={field} />
        </div>
        <div>
          <label htmlFor="sp-year" className={label}>שנה</label>
          <input id="sp-year" dir="ltr" value={expYear} onChange={(e) => setExpYear(e.target.value)} name="ccyear" autoComplete="cc-exp-year" inputMode="numeric" placeholder="2030" required className={field} />
        </div>
        <div>
          <label htmlFor="sp-cvv" className={label}>CVV</label>
          <input id="sp-cvv" dir="ltr" value={cvv} onChange={(e) => setCvv(e.target.value)} name="cvc" autoComplete="cc-csc" inputMode="numeric" required className={field} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="sp-id" className={label}>ת&quot;ז של בעל/ת הכרטיס</label>
          <input id="sp-id" dir="ltr" value={citizenId} onChange={(e) => setCitizenId(e.target.value)} autoComplete="off" inputMode="numeric" required className={field} />
        </div>
        <div>
          <label htmlFor="sp-phone" className={label}>טלפון</label>
          <input id="sp-phone" dir="ltr" value={payerPhone} onChange={(e) => setPayerPhone(e.target.value)} autoComplete="tel" inputMode="tel" className={field} />
        </div>
      </div>
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <button type="submit" disabled={loading} className="w-full rounded-full bg-[var(--teal)] px-8 py-4 text-lg font-bold text-white transition hover:bg-[var(--teal-dark)] disabled:opacity-50">
        {loading ? "רגע..." : `לתשלום ${shekel(amount)}`}
      </button>
    </form>
  );
}
