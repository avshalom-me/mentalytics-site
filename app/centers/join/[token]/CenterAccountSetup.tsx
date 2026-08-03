"use client";

import { useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { KeyRound, Loader2 } from "lucide-react";

// הקמת חשבון ניהול מיד אחרי התשלום — בלי להמתין לקישור ידני של אדמין.
// ההוכחה היא הטוקן הסודי של ההצעה (שדרכו גם שולם): נרשמים/מתחברים, ואז
// /api/centers/claim-account מקשר את החשבון למרכז ומעביר ישר לפורטל.
//
// שני מצבים: "new" (ברירת מחדל — בוחרים סיסמה חדשה) ו-"existing" — כשמתברר
// שהמייל כבר רשום (למשל בעל מרכז שנרשם בעבר כמטפל): המסך מסביר שצריך את
// הסיסמה הקיימת ומציע איפוס במקום, בלי "הסיסמה שגויה" מבלבל.

export default function CenterAccountSetup({ token, centerName, defaultEmail }: {
  token: string;
  centerName: string;
  defaultEmail?: string;
}) {
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    const mail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) { setError("כתובת מייל לא תקינה"); return; }
    if (password.length < 6) { setError("סיסמה באורך 6 תווים לפחות"); return; }
    setLoading(true);

    try {
      // מצב "new": ניסיון הרשמה; מייל שכבר רשום מחזיר בכוונה משתמש בלי session
      // (הגנת מניית-מיילים של Supabase) — ואז מנסים התחברות עם הסיסמה שהוזנה.
      let session = mode === "new"
        ? (await supabase.auth.signUp({ email: mail, password })).data.session
        : null;
      if (!session) {
        const { data: signIn } = await supabase.auth.signInWithPassword({ email: mail, password });
        session = signIn.session ?? null;
      }
      if (!session) {
        if (mode === "new") {
          // המייל קיים והסיסמה שהוקלדה היא לא הסיסמה שלו — מעבר למצב "חשבון קיים".
          setMode("existing");
          setPassword("");
          setError("");
        } else {
          setError("הסיסמה שגויה — נסו שוב, או שלחו קישור איפוס למטה.");
        }
        setLoading(false);
        return;
      }

      const res = await fetch("/api/centers/claim-account", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ token }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "הקישור נכשל — פנו אלינו: admin@getmentalytics.com");
        setLoading(false);
        return;
      }
      window.location.href = "/centers/dashboard/profile";
    } catch {
      setError("שגיאת רשת — נסו שוב");
      setLoading(false);
    }
  }

  // איפוס דרך עמוד האיפוס המשותף; ctx=center מחזיר בסיום ל-/centers/login.
  async function sendReset() {
    setError("");
    const mail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) { setError("כתובת מייל לא תקינה"); return; }
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(mail, {
      redirectTo: `${window.location.origin}/therapists/reset-password?ctx=center`,
    });
    if (resetErr) setError("שליחת קישור האיפוס נכשלה — נסו שוב בעוד רגע");
    else setResetSent(true);
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-6 max-w-md rounded-2xl border border-[#D8E4E8] bg-white p-5 text-right shadow-sm">
      <p className="text-sm font-black text-stone-900">
        <KeyRound size={15} className="ml-1 inline" style={{ color: "var(--teal)" }} />
        {mode === "new" ? `עוד צעד אחד — חשבון הניהול של ${centerName}` : "נמצא חשבון קיים — נתחבר אליו"}
      </p>
      {mode === "new" ? (
        <p className="mt-1 mb-4 text-xs leading-6 text-stone-600">
          בחרו סיסמה וייכנסו ישר לפורטל: מילוי פרופיל המרכז, לוגו, צוות ותמונות — והכל עולה לאוויר אחרי אישור קצר שלנו.
        </p>
      ) : (
        <p className="mt-1 mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-6 text-amber-900">
          לכתובת <span className="font-mono font-bold" dir="ltr">{email.trim()}</span> כבר קיים חשבון בטיפול חכם
          (למשל אם נרשמתם בעבר כמטפל/ת). הזינו את <strong>הסיסמה הקיימת</strong> של החשבון —
          או שלחו קישור איפוס למטה. אפשר גם להזין למעלה כתובת מייל אחרת לחשבון חדש.
        </p>
      )}
      <label className="mb-1 block text-xs font-semibold text-stone-700">אימייל לכניסה לפורטל</label>
      <input type="email" value={email} dir="ltr" required
        onChange={(e) => { setEmail(e.target.value); if (mode === "existing") { setMode("new"); setResetSent(false); } }}
        className="mb-3 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-[var(--teal)]" />
      <label className="mb-1 block text-xs font-semibold text-stone-700">
        {mode === "new" ? "סיסמה חדשה (6 תווים לפחות)" : "הסיסמה הקיימת של החשבון"}
      </label>
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" required minLength={6}
        className="mb-4 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-[var(--teal)]" />
      <button type="submit" disabled={loading}
        className="w-full rounded-full py-2.5 text-sm font-bold text-white transition hover:opacity-95 disabled:opacity-50"
        style={{ background: "linear-gradient(135deg,var(--teal-dark),var(--teal))" }}>
        {loading ? <Loader2 size={16} className="inline animate-spin" /> : mode === "new" ? "יצירת חשבון וכניסה לפורטל ←" : "התחברות וכניסה לפורטל ←"}
      </button>
      {mode === "existing" && !resetSent && (
        <button type="button" onClick={sendReset}
          className="mt-2 w-full rounded-full border border-stone-300 py-2 text-xs font-bold text-stone-600 hover:bg-stone-50">
          שכחתי סיסמה — שלחו לי קישור איפוס למייל
        </button>
      )}
      {resetSent && (
        <p className="mt-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-center text-xs leading-5 text-green-800">
          ✓ קישור איפוס נשלח למייל (בדקו גם בספאם). אחרי קביעת הסיסמה החדשה —
          חזרו לעמוד הזה (הקישור שבמייל &quot;ברוכים הבאים&quot;) כדי להשלים את חיבור החשבון למרכז.
        </p>
      )}
      {error && <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-center text-xs text-red-700">{error}</p>}
    </form>
  );
}
