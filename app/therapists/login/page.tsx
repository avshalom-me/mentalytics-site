"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";

function TherapistLoginContent() {
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "register" ? "register" : "login";
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showRegisterHint, setShowRegisterHint] = useState(false);
  const [success, setSuccess] = useState("");

  // Sync mode if query changes (e.g. user clicks a different entry point)
  useEffect(() => {
    const q = searchParams.get("mode");
    if (q === "register" || q === "login") setMode(q);
  }, [searchParams]);

  async function handleGoogleLogin() {
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) setError(error.message);
    setLoading(false);
  }

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError("המייל או הסיסמא שגויים");
        setShowRegisterHint(true);
      } else {
        window.location.href = "/therapists/dashboard";
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/therapists/dashboard` },
      });
      if (error) {
        setError(error.message);
      } else {
        setSuccess("נשלח אליך מייל אימות — אנא אשר את כתובת המייל לפני הכניסה.");
      }
    }
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-[#f0ece4] flex items-center justify-center px-4" dir="rtl"
      style={{ fontFamily: "'Heebo', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');`}</style>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.svg.png" alt="טיפול חכם" className="mx-auto mb-4 h-14 w-auto" />
          <h1 className="text-2xl font-black text-[#1a3a5c]">
            {mode === "register" ? "הרשמה למטפלים" : "כניסה למטפלים"}
          </h1>
          <p className="text-stone-600 text-sm mt-1">
            {mode === "register" ? "יצירת חשבון חדש — ללא עלות" : "ניהול הפרופיל המקצועי שלך"}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-[#E8E0D8] p-8">
          {/* Google */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-700 hover:bg-stone-50 transition disabled:opacity-50 mb-6"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            המשך עם Google
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-stone-200" />
            </div>
            <div className="relative flex justify-center text-xs text-stone-400">
              <span className="bg-white px-3">או עם מייל וסיסמא</span>
            </div>
          </div>

          {/* Email/Password */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-1">כתובת מייל</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm outline-none focus:border-[#2e7d8c]"
                placeholder="your@email.com"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-1">סיסמא</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm outline-none focus:border-[#2e7d8c]"
                placeholder="לפחות 6 תווים"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-700 font-semibold">{error}</p>
                {showRegisterHint && mode === "login" && (
                  <p className="text-sm text-red-700 mt-2">
                    עדיין לא נרשמת למערכת?{" "}
                    <button
                      type="button"
                      onClick={() => { setMode("register"); setError(""); setShowRegisterHint(false); }}
                      className="font-bold underline hover:text-red-900"
                    >
                      לחצ/י כאן להרשמה
                    </button>
                  </p>
                )}
              </div>
            )}
            {success && <p className="text-sm text-emerald-600">{success}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#2e7d8c] py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "..." : mode === "login" ? "כניסה" : "הרשמה"}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-stone-500">
            {mode === "login" ? (
              <>אין לך חשבון?{" "}
                <button type="button" onClick={() => { setMode("register"); setError(""); setShowRegisterHint(false); }} className="text-[#2e7d8c] font-semibold hover:underline">
                  הרשמה
                </button>
              </>
            ) : (
              <>יש לך חשבון?{" "}
                <button type="button" onClick={() => { setMode("login"); setError(""); setShowRegisterHint(false); }} className="text-[#2e7d8c] font-semibold hover:underline">
                  כניסה
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </main>
  );
}

export default function TherapistLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f0ece4]" />}>
      <TherapistLoginContent />
    </Suspense>
  );
}
