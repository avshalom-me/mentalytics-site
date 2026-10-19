"use client";

import { useState } from "react";
import { CONTACT_ROLES } from "@/app/lib/schools-crm";

// טופס בקשת הגישה של בית ספר לשאלון (ב-/counselors#access). שולח ל-
// /api/school-access-request, שפותח בענף בתי הספר בית ספר, איש קשר, עסקה ומשימה
// לבעלים. אין כאן שדה על תלמידים: רק מי פונה ומאיזה בית ספר. השדה "website"
// הוא מלכודת לבוטים (אדם לא רואה אותו ולא ממלא אותו).

const MAX_MESSAGE = 1000;

const FIELD =
  "w-full rounded-2xl border bg-white px-4 py-3 text-base outline-none transition-colors focus:border-[var(--teal)]";
const FIELD_STYLE = { borderColor: "var(--line)", color: "var(--text)" } as const;

type Form = {
  school_name: string;
  city: string;
  symbol: string;
  contact_name: string;
  role: string;
  phone: string;
  email: string;
  message: string;
};

const EMPTY: Form = { school_name: "", city: "", symbol: "", contact_name: "", role: "counselor", phone: "", email: "", message: "" };

export default function AccessRequestForm() {
  const [form, setForm] = useState<Form>(EMPTY);
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/school-access-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, website }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(typeof data.error === "string" && data.error ? data.error : "לא הצלחנו לשלוח את הפנייה. אפשר לנסות שוב.");
        return;
      }
      setDone(true);
    } catch {
      setError("לא הצלחנו לשלוח את הפנייה. אפשר לנסות שוב.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div role="status" className="mt-8 rounded-2xl p-6" style={{ background: "var(--teal-pale)", border: "1px solid var(--teal-mid)" }}>
        <p className="font-extrabold" style={{ color: "var(--teal-dark)" }}>
          קיבלנו את הפנייה. נחזור אליך בימים הקרובים עם הפרטים.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-8 rounded-2xl bg-white p-6" style={{ border: "1px solid var(--line)" }}>
      <h3 className="text-lg font-extrabold" style={{ color: "var(--teal-dark)" }}>בקשה לגישה לבית הספר</h3>
      <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
        הפרטים הם של בית הספר ושל מי שפונה בשמו. לא מזינים כאן שום פרט על תלמידים.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold" style={{ color: "var(--text)" }}>שם בית הספר</span>
          <input
            type="text"
            required
            maxLength={120}
            autoComplete="organization"
            value={form.school_name}
            onChange={set("school_name")}
            className={FIELD}
            style={FIELD_STYLE}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold" style={{ color: "var(--text)" }}>עיר</span>
          <input
            type="text"
            required
            maxLength={60}
            autoComplete="address-level2"
            value={form.city}
            onChange={set("city")}
            className={FIELD}
            style={FIELD_STYLE}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold" style={{ color: "var(--text)" }}>
            סמל מוסד <span className="font-normal" style={{ color: "var(--muted)" }}>(אם ידוע)</span>
          </span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={9}
            autoComplete="off"
            dir="ltr"
            value={form.symbol}
            onChange={set("symbol")}
            className={`${FIELD} text-end`}
            style={FIELD_STYLE}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold" style={{ color: "var(--text)" }}>שם איש הקשר</span>
          <input
            type="text"
            required
            maxLength={80}
            autoComplete="name"
            value={form.contact_name}
            onChange={set("contact_name")}
            className={FIELD}
            style={FIELD_STYLE}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold" style={{ color: "var(--text)" }}>תפקיד</span>
          <select value={form.role} onChange={set("role")} className={FIELD} style={FIELD_STYLE}>
            {CONTACT_ROLES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold" style={{ color: "var(--text)" }}>טלפון</span>
          <input
            type="tel"
            required
            maxLength={20}
            autoComplete="tel"
            dir="ltr"
            value={form.phone}
            onChange={set("phone")}
            className={`${FIELD} text-end`}
            style={FIELD_STYLE}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-sm font-bold" style={{ color: "var(--text)" }}>מייל</span>
          <input
            type="email"
            required
            maxLength={120}
            autoComplete="email"
            dir="ltr"
            value={form.email}
            onChange={set("email")}
            className={`${FIELD} text-end`}
            style={FIELD_STYLE}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-sm font-bold" style={{ color: "var(--text)" }}>
            הודעה <span className="font-normal" style={{ color: "var(--muted)" }}>(לא חובה)</span>
          </span>
          <textarea
            rows={4}
            maxLength={MAX_MESSAGE}
            value={form.message}
            onChange={set("message")}
            className={`${FIELD} resize-y leading-relaxed`}
            style={FIELD_STYLE}
          />
        </label>
      </div>

      {/* מלכודת לבוטים: מחוץ למסך, בלי פוקוס ובלי הכרזה לקורא מסך. */}
      <div aria-hidden="true" style={{ position: "absolute", insetInlineStart: "-9999px", width: 1, height: 1, overflow: "hidden" }}>
        <label>
          אתר
          <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>

      <div aria-live="polite">
        {error && <p className="mt-5 text-sm font-bold text-red-700">{error}</p>}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center justify-center rounded-full px-8 py-4 text-base font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ background: "var(--teal-dark)" }}
        >
          {busy ? "שולחים..." : "שליחת הבקשה"}
        </button>
        <span className="text-sm" style={{ color: "var(--muted)" }}>מענה בימים הקרובים, במייל או בטלפון.</span>
      </div>
    </form>
  );
}
