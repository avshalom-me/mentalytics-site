"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/app/lib/supabaseClient";
import { Building2, Loader2, MailCheck } from "lucide-react";

// כניסת מרכזים טיפוליים לפורטל הניהול. חשבון Supabase Auth נפרד (כמו מטפלים),
// עם המייל שאיתו נשלחה ההצעה — כדי שהחשבון הפעיל יזוהה אוטומטית בכניסה
// הראשונה (claim-by-email ב-/api/center-portal).

type Mode = "login" | "register" | "reset";

function CenterLoginContent() {
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>(params.get("mode") === "register" ? "register" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [signupPending, setSignupPending] = useState(false);

  // אם כבר מחוברים — ישר לדשבורד.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) window.location.href = "/centers/dashboard";
    });
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setSuccess("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (mode === "reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/therapists/reset-password`,
      });
      setError(error ? "שליחת הקישור נכשלה. נסו שוב." : "");
      if (!error) setSuccess("שלחנו קישור לאיפוס סיסמה. בדקו את תיבת המייל (כולל ספאם).");
      setLoading(false);
      return;
    }

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError("המייל או הסיסמה שגויים");
      else window.location.href = "/centers/dashboard";
      setLoading(false);
      return;
    }

    // register
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/centers/dashboard` },
    });
    if (error) {
      setError(
        /already|registered|exists/i.test(error.message)
          ? "כתובת המייל כבר רשומה — אפשר להתחבר או לאפס סיסמה."
          : "ההרשמה נכשלה. נסו שוב.",
      );
    } else if (data.session) {
      window.location.href = "/centers/dashboard";
    } else {
      setSignupPending(true);
    }
    setLoading(false);
  }

  if (signupPending) {
    return (
      <Shell>
        <div className="rounded-3xl border border-[#E8E0D8] bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "var(--teal-pale)" }}>
            <MailCheck size={30} style={{ color: "var(--teal)" }} />
          </div>
          <h1 className="text-2xl font-black text-stone-900">כמעט סיימנו!</h1>
          <p className="mt-3 leading-7 text-stone-600">שלחנו מייל אימות ל<span className="font-bold">{email}</span></p>
          <p className="mt-3 text-sm leading-7 text-stone-500">לחצו על הקישור במייל כדי לאשר ולהיכנס.</p>
          <button onClick={() => { setSignupPending(false); switchMode("login"); }} className="mt-6 text-sm font-bold" style={{ color: "var(--teal)" }}>← חזרה לכניסה</button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="rounded-3xl border border-[#E8E0D8] bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "var(--teal-pale)" }}>
            <Building2 size={26} style={{ color: "var(--teal)" }} />
          </div>
          <h1 className="text-2xl font-black text-stone-900">
            {mode === "login" ? "כניסת מרכזים טיפוליים" : mode === "register" ? "הרשמת מרכז לפורטל" : "איפוס סיסמה"}
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            {mode === "register" ? "הירשמו עם המייל שאיתו קיבלתם את ההצעה" : "פורטל הניהול של המרכז"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-stone-700">אימייל</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-[var(--teal)] outline-none" dir="ltr" placeholder="office@center.co.il" />
          </div>
          {mode !== "reset" && (
            <div>
              <label className="mb-1 block text-sm font-semibold text-stone-700">סיסמה</label>
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-[var(--teal)] outline-none" dir="ltr" placeholder="לפחות 6 תווים" />
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full rounded-full py-3 text-base font-bold text-white transition hover:opacity-95 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,var(--teal-dark),var(--teal))" }}>
            {loading ? <Loader2 size={18} className="inline animate-spin" /> : mode === "login" ? "כניסה" : mode === "register" ? "הרשמה" : "שליחת קישור איפוס"}
          </button>

          {error && <p className="text-center text-sm text-red-600">{error}</p>}
          {success && <p className="text-center text-sm text-green-700">{success}</p>}
        </form>

        <div className="mt-6 space-y-1.5 text-center text-sm">
          {mode === "login" && (
            <>
              <p className="text-stone-500">אין עדיין גישה? <button onClick={() => switchMode("register")} className="font-bold" style={{ color: "var(--teal)" }}>הרשמה עם מייל המרכז</button></p>
              <p><button onClick={() => switchMode("reset")} className="text-stone-400 hover:underline">שכחתי סיסמה</button></p>
            </>
          )}
          {mode !== "login" && (
            <p><button onClick={() => switchMode("login")} className="font-bold" style={{ color: "var(--teal)" }}>← חזרה לכניסה</button></p>
          )}
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-stone-400">
        עדיין לא לקוחות? <Link href="/centers" className="underline">מידע על המסלול למרכזים</Link>
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700;800;900&display=swap');`}</style>
      {children}
    </main>
  );
}

export default function CenterLoginPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center" dir="rtl">טוען…</div>}>
      <CenterLoginContent />
    </Suspense>
  );
}
