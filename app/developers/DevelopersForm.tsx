"use client";

import { useState } from "react";
import { Send, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

type FormState = {
  name: string;
  email: string;
  phone: string;
  role: string;
  stage: string;
  description: string;
  link: string;
};

const ROLES = [
  "פסיכולוג / עובד סוציאלי / מטפל / מאבחן",
  "איש חינוך / הוראה מתקנת",
  "מפתח / מהנדס תוכנה",
  "חוקר / סטודנט מתקדם",
  "יזם",
  "בעל תוכנה / כלי קיים",
  "אחר",
];

const STAGES = [
  "רעיון ראשוני",
  "באפיון",
  "בפיתוח",
  "מוצר קיים — מחפש קהל / שיתוף פעולה",
];

export default function DevelopersForm() {
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    phone: "",
    role: "",
    stage: "",
    description: "",
    link: "",
  });
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      setStatus("error");
      setErrorMsg("יש למלא שם ומייל");
      return;
    }
    setStatus("submitting");
    setErrorMsg("");
    try {
      const res = await fetch("/api/developers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "שגיאה בשליחה");
      setStatus("success");
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err?.message || "שגיאה בשליחה. נסו שוב או פנו ב-tpool406@gmail.com");
    }
  }

  if (status === "success") {
    return (
      <div className="dev-glass-card text-center p-10">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ background: "linear-gradient(135deg,#10B981,#22D3EE)", boxShadow: "0 8px 32px rgba(34,211,238,.4)" }}>
          <CheckCircle2 size={32} color="white" />
        </div>
        <h3 className="text-2xl font-extrabold dev-gradient-text">תודה! קיבלנו את הפנייה</h3>
        <p className="mt-3 text-stone-300 leading-7">
          אנחנו נחזור אליכם בקרוב כדי להבין יחד את הרעיון, את השלב שבו הוא נמצא, ואיך אפשר לקדם אותו.
        </p>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-stone-500 backdrop-blur transition focus:border-[#A78BFA] focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#A78BFA]/40";

  const labelClass = "mb-1.5 block text-sm font-semibold text-stone-200";

  return (
    <form onSubmit={onSubmit} className="dev-glass-card p-6 md:p-8 space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="dev-name">שם מלא *</label>
          <input
            id="dev-name"
            type="text"
            required
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            className={inputClass}
            placeholder="ישראל ישראלי"
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="dev-email">מייל *</label>
          <input
            id="dev-email"
            type="email"
            required
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            className={inputClass}
            placeholder="you@example.com"
            dir="ltr"
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="dev-phone">טלפון</label>
          <input
            id="dev-phone"
            type="tel"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            className={inputClass}
            placeholder="050-0000000"
            dir="ltr"
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="dev-link">קישור / אתר (אופציונלי)</label>
          <input
            id="dev-link"
            type="url"
            value={form.link}
            onChange={(e) => update("link", e.target.value)}
            className={inputClass}
            placeholder="https://..."
            dir="ltr"
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="dev-role">תפקיד / רקע</label>
          <select
            id="dev-role"
            value={form.role}
            onChange={(e) => update("role", e.target.value)}
            className={inputClass}
          >
            <option value="" style={{ background: "#0F1729", color: "#9CA3AF" }}>בחרו...</option>
            {ROLES.map((r) => (
              <option key={r} value={r} style={{ background: "#0F1729", color: "#FFFFFF" }}>{r}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="dev-stage">שלב הרעיון</label>
          <select
            id="dev-stage"
            value={form.stage}
            onChange={(e) => update("stage", e.target.value)}
            className={inputClass}
          >
            <option value="" style={{ background: "#0F1729", color: "#9CA3AF" }}>בחרו...</option>
            {STAGES.map((s) => (
              <option key={s} value={s} style={{ background: "#0F1729", color: "#FFFFFF" }}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="dev-desc">תיאור הרעיון (אופציונלי)</label>
        <textarea
          id="dev-desc"
          rows={6}
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          className={inputClass}
          placeholder="ספרו על הרעיון: מה הוא פותר, למי הוא מיועד, מה השלב הנוכחי, ומה תרצו ליצור איתנו..."
        />
      </div>

      {status === "error" && (
        <div className="flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
          <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="dev-cta-btn group relative w-full overflow-hidden rounded-xl px-6 py-4 text-base font-bold text-white transition disabled:opacity-60"
      >
        <span className="relative z-10 inline-flex items-center justify-center gap-2">
          {status === "submitting" ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              שולח...
            </>
          ) : (
            <>
              <Send size={18} />
              שלח
            </>
          )}
        </span>
      </button>

      <p className="text-center text-xs text-stone-400">
        הפרטים יישלחו ישירות לצוות טיפול חכם. אנחנו לא משתפים את הרעיון שלכם עם אף גורם חיצוני.
      </p>
    </form>
  );
}
