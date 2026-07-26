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
  "מוצר קיים - מחפש קהל / שיתוף פעולה",
];

export default function DevelopersForm() {
  const [form, setForm] = useState<FormState>({
    name: "", email: "", phone: "", role: "", stage: "", description: "", link: "",
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
      setErrorMsg(err?.message || "שגיאה בשליחה. נסו שוב או פנו ב-admin@getmentalytics.com");
    }
  }

  if (status === "success") {
    return (
      <div style={{
        background: "linear-gradient(135deg, var(--teal-pale), var(--gold-pale))",
        border: "1px solid var(--teal-mid)",
        borderRadius: "24px",
        padding: "56px 40px",
        textAlign: "center",
        boxShadow: "0 4px 0 var(--teal-mid), 0 12px 40px rgba(61,140,138,.1)",
      }}>
        <div style={{
          margin: "0 auto 20px",
          width: "64px", height: "64px",
          borderRadius: "20px",
          background: "linear-gradient(135deg, #3D8C8A, #2A6462)",
          boxShadow: "0 8px 28px rgba(61,140,138,.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <CheckCircle2 size={32} color="white" />
        </div>
        <h3 style={{ fontSize: "1.6rem", fontWeight: 900, color: "var(--teal-dark)", marginBottom: "12px" }}>
          תודה! קיבלנו את הפנייה
        </h3>
        <p style={{ color: "var(--text-2)", lineHeight: 1.8, maxWidth: "44ch", margin: "0 auto" }}>
          אנחנו נחזור אליכם בקרוב כדי להבין יחד את הרעיון, את השלב שבו הוא נמצא, ואיך אפשר לקדם אותו.
        </p>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .dev-input {
          width: 100%;
          border-radius: 12px;
          border: 1.5px solid var(--line);
          background: white;
          padding: 12px 16px;
          font-size: 15px;
          font-family: 'Heebo', sans-serif;
          color: var(--text);
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
          outline: none;
        }
        .dev-input::placeholder { color: var(--faint); }
        .dev-input:focus {
          border-color: var(--teal);
          box-shadow: 0 0 0 3px rgba(61,140,138,.14);
        }
        .dev-input option { background: white; color: var(--text); }
      `}</style>

      <form onSubmit={onSubmit} style={{
        background: "linear-gradient(155deg, var(--teal-pale) 0%, #ffffff 55%, var(--gold-pale) 100%)",
        border: "1.5px solid var(--teal-mid)",
        borderRadius: "24px",
        boxShadow: "0 4px 0 var(--teal-mid), 0 16px 48px rgba(61,140,138,.1)",
        overflow: "hidden",
      }}>

        {/* Colorful header strip */}
        <div style={{
          background: "linear-gradient(120deg, #2A6462 0%, #3D8C8A 50%, #D49018 100%)",
          padding: "20px 32px",
          display: "flex", alignItems: "center", gap: "12px",
        }}>
          <Send size={18} color="white" style={{ opacity: .85 }} />
          <span style={{ color: "white", fontWeight: 700, fontSize: "15px", letterSpacing: ".02em" }}>
            ספרו לנו על הרעיון
          </span>
        </div>

        {/* Fields */}
        <div style={{ padding: "28px 32px 32px", display: "flex", flexDirection: "column", gap: "20px" }}>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
            <div>
              <label htmlFor="dev-name" style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 700, color: "var(--text-2)" }}>
                שם מלא *
              </label>
              <input id="dev-name" type="text" required value={form.name}
                onChange={(e) => update("name", e.target.value)}
                className="dev-input" placeholder="ישראל ישראלי" />
            </div>
            <div>
              <label htmlFor="dev-email" style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 700, color: "var(--text-2)" }}>
                מייל *
              </label>
              <input id="dev-email" type="email" required value={form.email}
                onChange={(e) => update("email", e.target.value)}
                className="dev-input" placeholder="you@example.com" dir="ltr" />
            </div>
            <div>
              <label htmlFor="dev-phone" style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 700, color: "var(--text-2)" }}>
                טלפון
              </label>
              <input id="dev-phone" type="tel" value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                className="dev-input" placeholder="050-0000000" dir="ltr" />
            </div>
            <div>
              <label htmlFor="dev-link" style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 700, color: "var(--text-2)" }}>
                קישור / אתר (אופציונלי)
              </label>
              <input id="dev-link" type="url" value={form.link}
                onChange={(e) => update("link", e.target.value)}
                className="dev-input" placeholder="https://..." dir="ltr" />
            </div>
            <div>
              <label htmlFor="dev-role" style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 700, color: "var(--text-2)" }}>
                תפקיד / רקע
              </label>
              <select id="dev-role" value={form.role}
                onChange={(e) => update("role", e.target.value)}
                className="dev-input">
                <option value="">בחרו...</option>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="dev-stage" style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 700, color: "var(--text-2)" }}>
                שלב הרעיון
              </label>
              <select id="dev-stage" value={form.stage}
                onChange={(e) => update("stage", e.target.value)}
                className="dev-input">
                <option value="">בחרו...</option>
                {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="dev-desc" style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 700, color: "var(--text-2)" }}>
              תיאור הרעיון (אופציונלי)
            </label>
            <textarea id="dev-desc" rows={5} value={form.description}
              onChange={(e) => update("description", e.target.value)}
              className="dev-input"
              style={{ resize: "vertical" }}
              placeholder="ספרו על הרעיון: מה הוא פותר, למי הוא מיועד, מה השלב הנוכחי, ומה תרצו ליצור איתנו..." />
          </div>

          {status === "error" && (
            <div style={{
              display: "flex", alignItems: "flex-start", gap: "8px",
              borderRadius: "12px", border: "1px solid #FCA5A5",
              background: "#FEF2F2", padding: "12px 16px",
              fontSize: "14px", color: "#B91C1C",
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={status === "submitting"}
            style={{
              width: "100%",
              background: "linear-gradient(120deg, #2A6462 0%, #3D8C8A 45%, #D49018 100%)",
              backgroundSize: "200% 200%",
              borderRadius: "50px",
              padding: "14px 24px",
              fontSize: "16px",
              fontWeight: 700,
              color: "white",
              border: "none",
              cursor: status === "submitting" ? "not-allowed" : "pointer",
              opacity: status === "submitting" ? 0.65 : 1,
              boxShadow: "0 6px 28px rgba(61,140,138,.4)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              fontFamily: "'Heebo', sans-serif",
              transition: "filter 0.25s ease, transform 0.25s ease",
            }}
          >
            {status === "submitting" ? (
              <><Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />שולח...</>
            ) : (
              <><Send size={18} />שלח</>
            )}
          </button>

          <p style={{ textAlign: "center", fontSize: "12px", color: "var(--muted)" }}>
            הפרטים יישלחו ישירות לצוות טיפול חכם. אנחנו לא משתפים את הרעיון שלכם עם אף גורם חיצוני.
          </p>
        </div>
      </form>
    </>
  );
}
