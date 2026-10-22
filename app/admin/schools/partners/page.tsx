"use client";

import { useCallback, useEffect, useState } from "react";
import { btnGhost, btnPrimary, cardCls, errText, getJson, hebStamp, inputCls } from "../shared";

// שותפות הענף: מי נכנסת לפורטל /partner. יצירה נותנת סיסמה זמנית, והבעלים
// מעביר אותה בעצמו (וואטסאפ מתאים: אין כאן קישור שהתצוגה המקדימה של וואטסאפ
// יכולה לנצל לפני הלחיצה, מה שקרה ב-22/10/2026). בכניסה הראשונה הפורטל מבקש
// ממנה לקבוע סיסמה משלה. המערכת לא שולחת מייל. אותו כפתור משמש לאיפוס.

type Partner = { user_id: string; name: string; email: string; active: boolean; created_at: string };

export default function SchoolPartnersPage() {
  const [rows, setRows] = useState<Partner[]>([]);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  // סיסמה זמנית שהופקה עכשיו (password ריק = נוספה עם חשבון קיים, בלי סיסמה זמנית).
  const [issued, setIssued] = useState<{ who: string; email: string; password: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const j = await getJson<{ partners: Partner[] }>("/api/admin-schools/partners");
      setRows(j.partners);
      setError("");
    } catch (e) {
      setError(errText(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function run(key: string, body: Record<string, unknown>, who: string): Promise<boolean> {
    setBusy(key);
    setError("");
    try {
      const r = await fetch("/api/admin-schools/partners", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      // מייל של חשבון קיים: מאשרים במפורש, ואז היא נכנסת עם הסיסמה שכבר יש לה.
      if (r.status === 409 && j.existing && body.action === "create") {
        setBusy(null);
        const ok = window.confirm(
          `כבר קיים באתר ${j.account ?? "חשבון"} עם המייל ${String(body.email)}.\n\nאם זה החשבון של ${who}, אשרו: היא תיכנס לפורטל עם הסיסמה שכבר יש לה.\nאם זה לא החשבון שלה, בטלו ובדקו את המייל.`,
        );
        return ok ? run(key, { ...body, confirm_existing: true }, who) : false;
      }
      if (!r.ok || !j.ok) throw new Error(j.error || "שגיאה");
      if (j.password) setIssued({ who, email: String(body.email ?? rows.find((x) => x.user_id === body.user_id)?.email ?? ""), password: j.password });
      else if (j.existing) setIssued({ who, email: String(body.email ?? ""), password: "" });
      await load();
      return true;
    } catch (e) {
      setError(errText(e));
      return false;
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="p-6" dir="rtl">
      <h1 className="text-2xl font-black text-stone-900">שותפות הענף</h1>
      <p className="mt-1 text-sm text-stone-500">
        מי נכנסת לפורטל בתי הספר בכתובת mentalytics.co.il/partner. היא רואה רק את ענף בתי הספר: מבט על, בתי ספר, צינור, רישיונות ותשלומים, משימות והערות של הענף. לא את דף הבנק ולא את שאר ה-CRM. מייל הכניסה אפשר להחליף בכל עת (&quot;שינוי מייל&quot;), בלי לאבד סיסמה או היסטוריה.
      </p>
      {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {issued && !issued.password && (
        <div className="mt-4 rounded-2xl border border-[#C2DFDE] bg-[#EAF4F3] p-4 text-sm">
          <div className="font-bold text-[#2A6462]">{issued.who} נוספה לפורטל עם החשבון הקיים שלה.</div>
          <p className="mt-1 text-stone-600">היא נכנסת ב-mentalytics.co.il/partner עם המייל והסיסמה שכבר יש לה באתר.</p>
          <button type="button" className={`${btnGhost} mt-2`} onClick={() => setIssued(null)}>סגירה</button>
        </div>
      )}
      {issued && issued.password && (
        <div className="mt-4 rounded-2xl border border-[#C2DFDE] bg-[#EAF4F3] p-4 text-sm">
          <div className="font-bold text-[#2A6462]">סיסמה זמנית עבור {issued.who}</div>
          <p className="mt-1 text-stone-600">
            שולחים לה בעצמך את הכתובת, המייל והסיסמה. בכניסה הראשונה הפורטל יבקש ממנה לקבוע סיסמה משלה. הסיסמה מוצגת רק עכשיו; אם תאבד, מפיקים חדשה.
          </p>
          <div className="mt-2 grid gap-1 rounded-xl bg-white p-3 text-sm" dir="ltr">
            <div>mentalytics.co.il/partner</div>
            <div>{issued.email}</div>
            <div className="font-mono text-base font-bold tracking-wider">{issued.password}</div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className={btnGhost}
              onClick={() => navigator.clipboard.writeText(`כניסה לפורטל בתי הספר: mentalytics.co.il/partner
מייל: ${issued.email}
סיסמה זמנית: ${issued.password}`).catch(() => {})}
            >
              העתקת ההודעה
            </button>
            <button type="button" className={btnGhost} onClick={() => setIssued(null)}>סגירה</button>
          </div>
        </div>
      )}

      <form
        className={`${cardCls} mt-5 grid gap-3 sm:grid-cols-3`}
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run("create", { action: "create", name, email }, name)) {
            setName("");
            setEmail("");
          }
        }}
      >
        <label className="text-sm">
          <span className="mb-1 block font-bold text-stone-700">שם (כפי שיופיע ביומן ובמשימות)</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} required />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-bold text-stone-700">מייל לכניסה</span>
          <input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} required />
        </label>
        <div className="flex items-end">
          <button type="submit" disabled={busy !== null} className={btnPrimary}>{busy === "create" ? "יוצר..." : "הוספה וסיסמה זמנית"}</button>
        </div>
      </form>

      <div className="mt-5 space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-stone-500">עדיין אין שותפות.</p>
        ) : (
          rows.map((p) => (
            <div key={p.user_id} className={`${cardCls} flex flex-wrap items-center justify-between gap-3`}>
              <div>
                <div className="font-black text-stone-900">
                  {p.name}
                  {!p.active && <span className="ms-2 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-bold text-stone-500">מושבתת</span>}
                </div>
                <div className="text-sm text-stone-500" dir="ltr">{p.email}</div>
                <div className="text-xs text-stone-400">נוספה {hebStamp(p.created_at)}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy !== null}
                  className={btnGhost}
                  onClick={() => {
                    if (!window.confirm(`להפיק ל${p.name} סיסמה זמנית חדשה? הסיסמה הנוכחית שלה תפסיק לעבוד, ובכניסה הבאה היא תקבע סיסמה משלה.`)) return;
                    void run(`pw:${p.user_id}`, { action: "password", user_id: p.user_id }, p.name);
                  }}
                >
                  {busy === `pw:${p.user_id}` ? "מפיק..." : "סיסמה זמנית חדשה"}
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  className={btnGhost}
                  onClick={() => {
                    const next = window.prompt(`המייל החדש לכניסה של ${p.name} (הסיסמה נשארת). אם זה חשבון שמשמש אותה גם במקום אחר באתר, גם שם המייל יתחלף:`, p.email);
                    if (next && next.trim() && next.trim().toLowerCase() !== p.email) void run(`email:${p.user_id}`, { action: "email", user_id: p.user_id, email: next.trim() }, p.name);
                  }}
                >
                  {busy === `email:${p.user_id}` ? "מעדכן..." : "שינוי מייל"}
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  className={btnGhost}
                  onClick={() => {
                    if (p.active && !window.confirm(`להשבית את הגישה של ${p.name} לפורטל?`)) return;
                    void run(`toggle:${p.user_id}`, { action: "toggle", user_id: p.user_id, active: !p.active }, p.name);
                  }}
                >
                  {p.active ? "השבתת גישה" : "החזרת גישה"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
