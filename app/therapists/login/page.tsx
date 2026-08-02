"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import Link from "next/link";
import { BarChart2, ShieldCheck, Users, LogIn, UserPlus, MailCheck } from "lucide-react";
import { NEWSLETTER_CONSENT_TEXT, NEWSLETTER_CONSENT_VERSION } from "@/app/lib/consent";

type Mode = "login" | "register" | "reset";

function TherapistLoginContent() {
  const searchParams = useSearchParams();
  const initialMode: Mode = searchParams.get("mode") === "register" ? "register" : "login";
  const plan = searchParams.get("plan");
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showRegisterHint, setShowRegisterHint] = useState(false);
  const [success, setSuccess] = useState("");
  const [signupPending, setSignupPending] = useState(false);
  // Marketing-email opt-in, captured only at registration. Unchecked by default
  // (explicit consent). Stored on the auth user's metadata at sign-up and
  // applied to the therapist row + consent_events audit server-side.
  const [newsletterConsent, setNewsletterConsent] = useState(false);

  useEffect(() => {
    const q = searchParams.get("mode");
    if (q === "register" || q === "login") setMode(q);
  }, [searchParams]);

  // Arriving from a completed password reset (all sessions were revoked there).
  // Derived straight from the URL - not via state - so it can't be lost to
  // remounts during hydration.
  const resetSuccess = searchParams.get("reset") === "success" && mode === "login";

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setSuccess("");
    setShowRegisterHint(false);
  }

  const dashboardUrl = plan === "promoted"
    ? "/therapists/dashboard?upgrade=promoted"
    : "/therapists/dashboard";

  async function handleGoogleLogin() {
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback${plan === "promoted" ? "?plan=promoted" : ""}`,
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

    if (mode === "reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/therapists/reset-password`,
      });
      if (error) {
        setError("שליחת קישור האיפוס נכשלה. נסו שוב בעוד רגע.");
      } else {
        setSuccess("שלחנו אליך קישור לאיפוס הסיסמא. בדוק/י את תיבת המייל (כולל ספאם).");
      }
      setLoading(false);
      return;
    }

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError("המייל או הסיסמא שגויים");
        setShowRegisterHint(true);
      } else {
        window.location.href = dashboardUrl;
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback${plan === "promoted" ? "?plan=promoted" : ""}`,
          // Persisted on the auth user; the server reads it when the therapist
          // row is first created and writes newsletter_consent + a consent_events
          // audit row. Only true when the therapist explicitly ticked the box.
          data: newsletterConsent
            ? { newsletter_consent: true, newsletter_consent_version: NEWSLETTER_CONSENT_VERSION }
            : {},
        },
      });
      if (error) {
        // Don't surface raw Supabase error text (English, and can leak internal
        // detail). Map the one actionable case; everything else stays generic.
        setError(
          /already|registered|exists/i.test(error.message)
            ? "כתובת המייל הזו כבר רשומה במערכת - אפשר להתחבר או לאפס סיסמא."
            : "ההרשמה נכשלה. נסו שוב בעוד רגע."
        );
      } else if (data.session) {
        // Email confirmation is disabled → the user is signed in immediately.
        window.location.href = dashboardUrl;
      } else {
        // Email confirmation still required → show a clear "check your email" screen.
        setSignupPending(true);
      }
    }
    setLoading(false);
  }

  // ─── Clear success screen after sign-up (fallback when email confirmation is on) ───
  if (signupPending) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 py-12" dir="rtl"
        style={{ fontFamily: "'Heebo', sans-serif", background: "var(--surface)" }}>
        <div className="w-full max-w-md rounded-3xl border border-[#E8E0D8] bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "var(--teal-pale)" }}>
            <MailCheck size={30} style={{ color: "var(--teal)" }} />
          </div>
          <h1 className="text-2xl font-black text-stone-900">כמעט סיימנו!</h1>
          <p className="mt-3 leading-7 text-stone-600">
            שלחנו מייל אימות לכתובת<br />
            <span className="font-bold text-stone-800">{email}</span>
          </p>
          <p className="mt-3 leading-7 text-stone-500 text-sm">
            לחצ/י על הקישור במייל כדי לאשר את החשבון ולהיכנס. אם המייל לא הגיע - בדוק/י בתיקיית הספאם.
          </p>
          <button
            onClick={() => { setSignupPending(false); switchMode("login"); }}
            className="mt-7 text-sm font-bold hover:underline"
            style={{ color: "var(--teal)" }}
          >
            ← חזרה לכניסה
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <style>{`
        .pro-input:focus { outline: none; border-color: #3D8C8A; box-shadow: 0 0 0 3px rgba(61,140,138,.12); }
        .google-btn:hover { background: #f8f8f8; }
      `}</style>

      {/* ─── RIGHT: Brand panel with a clear registered / new split ─── */}
      <div
        className="hidden lg:flex flex-col justify-between flex-1 p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(155deg, #0D3836 0%, #1B5A56 55%, #2A7470 100%)" }}
      >
        {/* Decorative arcs */}
        <svg
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", opacity: 0.07 }}
          viewBox="0 0 600 800" fill="none" preserveAspectRatio="xMidYMid slice"
        >
          <circle cx="500" cy="100" r="280" stroke="white" strokeWidth="60" />
          <circle cx="80" cy="700" r="200" stroke="white" strokeWidth="40" />
        </svg>
        <div style={{ position: "absolute", top: 0, right: 0, left: 0, height: "3px", background: "linear-gradient(90deg, transparent, #D49018, transparent)" }} />

        {/* Logo */}
        <div>
          <Link href="/">
            <div style={{ display: "inline-block", background: "rgba(255,255,255,.12)", backdropFilter: "blur(8px)", borderRadius: "14px", padding: "8px 14px", border: "1px solid rgba(255,255,255,.18)" }}>
              <img src="/logo-temp.png" alt="טיפול חכם" style={{ height: "44px", width: "auto", display: "block" }} />
            </div>
          </Link>
        </div>

        {/* Center: two clear entry paths */}
        <div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            background: "rgba(212,144,24,.18)", border: "1px solid rgba(212,144,24,.35)",
            borderRadius: "50px", padding: "5px 14px", marginBottom: "24px",
          }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#D49018", display: "inline-block", flexShrink: 0 }} />
            <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#F4C96A", textTransform: "uppercase", letterSpacing: ".14em" }}>
              פאנל מקצועי
            </span>
          </div>

          <h2 style={{ fontSize: "clamp(1.5rem, 2.3vw, 2.2rem)", fontWeight: 900, color: "white", lineHeight: 1.2, letterSpacing: "-.02em", marginBottom: "28px" }}>
            ברוכים הבאים,<br />
            <span style={{ color: "#7DD4CE" }}>אנשי המקצוע</span>
          </h2>

          {/* Registered users card */}
          <button
            onClick={() => switchMode("login")}
            className="w-full text-right transition"
            style={{
              borderRadius: "16px", padding: "18px 20px", marginBottom: "14px", cursor: "pointer",
              background: mode === "login" ? "rgba(255,255,255,.16)" : "rgba(255,255,255,.06)",
              border: mode === "login" ? "1.5px solid rgba(125,212,206,.7)" : "1px solid rgba(255,255,255,.14)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "11px", background: "rgba(125,212,206,.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <LogIn size={19} style={{ color: "#7DD4CE" }} />
              </div>
              <div>
                <div style={{ fontSize: "15.5px", fontWeight: 800, color: "white" }}>כבר רשומ/ה?</div>
                <div style={{ fontSize: "13px", color: "rgba(255,255,255,.65)", marginTop: "2px" }}>כניסה לפאנל הניהול שלך ←</div>
              </div>
            </div>
          </button>

          {/* New users card */}
          <button
            onClick={() => switchMode("register")}
            className="w-full text-right transition"
            style={{
              borderRadius: "16px", padding: "18px 20px", cursor: "pointer",
              background: mode === "register" ? "rgba(255,255,255,.16)" : "rgba(255,255,255,.06)",
              border: mode === "register" ? "1.5px solid rgba(244,201,106,.7)" : "1px solid rgba(255,255,255,.14)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "11px", background: "rgba(244,201,106,.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <UserPlus size={19} style={{ color: "#F4C96A" }} />
              </div>
              <div>
                <div style={{ fontSize: "15.5px", fontWeight: 800, color: "white" }}>חדש/ה כאן?</div>
                <div style={{ fontSize: "13px", color: "rgba(255,255,255,.65)", marginTop: "2px" }}>פתיחת חשבון והצטרפות - ללא עלות ←</div>
              </div>
            </div>
          </button>

          <Link href="/therapists/join" style={{ display: "inline-block", marginTop: "20px", fontSize: "13px", color: "rgba(255,255,255,.55)" }}
            className="hover:text-white">
            לפרטים מלאים על ההצטרפות והמסלולים ←
          </Link>
        </div>

        {/* Bottom: trust strip */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {[
            { Icon: Users, text: "מטופלים מופנים אליך על בסיס התאמה מדויקת" },
            { Icon: BarChart2, text: "אנליטיקות מתקדמות על פרופיל הפונים באזורך" },
            { Icon: ShieldCheck, text: "פלטפורמה בנויה על ידי פסיכולוגים קליניים" },
          ].map(({ Icon, text }, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Icon size={15} style={{ color: "#7DD4CE", flexShrink: 0 }} />
              <p style={{ fontSize: "12.5px", color: "rgba(255,255,255,.6)" }}>{text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ─── LEFT: Form panel ─── */}
      <div className="w-full lg:w-[440px] flex flex-col justify-center px-8 py-12" style={{ background: "white", minHeight: "100vh" }}>
        {/* Mobile logo */}
        <div className="lg:hidden mb-8 text-center">
          <Link href="/">
            <img src="/logo-temp.png" alt="טיפול חכם" style={{ height: "44px", width: "auto", margin: "0 auto" }} />
          </Link>
        </div>

        <div style={{ maxWidth: "360px", width: "100%", margin: "0 auto" }}>

          {/* Segmented toggle: clear login / register split */}
          {mode !== "reset" && (
            <div style={{ display: "flex", background: "var(--surface-2)", borderRadius: "14px", padding: "5px", marginBottom: "26px" }}>
              <button
                type="button"
                onClick={() => switchMode("login")}
                style={{
                  flex: 1, borderRadius: "10px", padding: "10px", fontSize: "14.5px", fontWeight: 800,
                  border: "none", cursor: "pointer", fontFamily: "inherit", transition: "all .18s",
                  background: mode === "login" ? "white" : "transparent",
                  color: mode === "login" ? "var(--teal-dark)" : "var(--muted)",
                  boxShadow: mode === "login" ? "0 1px 4px rgba(0,0,0,.08)" : "none",
                }}
              >
                כניסה
              </button>
              <button
                type="button"
                onClick={() => switchMode("register")}
                style={{
                  flex: 1, borderRadius: "10px", padding: "10px", fontSize: "14.5px", fontWeight: 800,
                  border: "none", cursor: "pointer", fontFamily: "inherit", transition: "all .18s",
                  background: mode === "register" ? "white" : "transparent",
                  color: mode === "register" ? "var(--teal-dark)" : "var(--muted)",
                  boxShadow: mode === "register" ? "0 1px 4px rgba(0,0,0,.08)" : "none",
                }}
              >
                הרשמה
              </button>
            </div>
          )}

          {/* Title */}
          <div style={{ marginBottom: "24px" }}>
            <h1 style={{ fontSize: "24px", fontWeight: 900, color: "var(--text)", marginBottom: "5px" }}>
              {mode === "register" ? "יצירת חשבון חדש" : mode === "reset" ? "איפוס סיסמא" : "שלום, מטפל/ת"}
            </h1>
            <p style={{ fontSize: "14px", color: "var(--muted)" }}>
              {mode === "register"
                ? "הצטרפות ללא עלות - תוך דקות"
                : mode === "reset"
                ? "נשלח אליך קישור לקביעת סיסמא חדשה"
                : "כניסה לפאנל הניהול המקצועי"}
            </p>
          </div>

          {mode !== "reset" && (
            <>
              {/* Google */}
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="google-btn"
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                  borderRadius: "12px", border: "1px solid #E5E7EB", background: "white",
                  padding: "11px 16px", fontSize: "14px", fontWeight: 600, color: "#374151",
                  cursor: "pointer", transition: "background .15s", marginBottom: "20px", fontFamily: "inherit",
                }}
              >
                <svg style={{ width: "20px", height: "20px" }} viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                המשך עם Google
              </button>

              {/* Divider */}
              <div style={{ position: "relative", marginBottom: "20px" }}>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center" }}>
                  <div style={{ width: "100%", borderTop: "1px solid #E5E7EB" }} />
                </div>
                <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
                  <span style={{ background: "white", padding: "0 12px", fontSize: "12px", color: "#9CA3AF" }}>או עם מייל וסיסמא</span>
                </div>
              </div>
            </>
          )}

          {/* Form */}
          <form onSubmit={handleEmailAuth} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--text-2)", marginBottom: "6px" }}>
                כתובת מייל
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pro-input"
                style={{ width: "100%", borderRadius: "10px", border: "1px solid #E5E7EB", padding: "10px 14px", fontSize: "14px", fontFamily: "inherit", boxSizing: "border-box", transition: "border-color .15s" }}
                placeholder="your@email.com"
              />
            </div>

            {mode !== "reset" && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-2)" }}>סיסמא</label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => switchMode("reset")}
                      style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--teal)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
                      className="hover:underline"
                    >
                      שכחת סיסמא?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="pro-input"
                  style={{ width: "100%", borderRadius: "10px", border: "1px solid #E5E7EB", padding: "10px 14px", fontSize: "14px", fontFamily: "inherit", boxSizing: "border-box", transition: "border-color .15s" }}
                  placeholder="לפחות 6 תווים"
                />
              </div>
            )}

            {error && (
              <div style={{ borderRadius: "10px", border: "1px solid #FCA5A5", background: "#FEF2F2", padding: "12px 14px" }}>
                <p style={{ fontSize: "13px", color: "#B91C1C", fontWeight: 600 }}>{error}</p>
                {showRegisterHint && mode === "login" && (
                  <p style={{ fontSize: "13px", color: "#B91C1C", marginTop: "6px" }}>
                    עדיין לא נרשמת?{" "}
                    <button
                      type="button"
                      onClick={() => switchMode("register")}
                      style={{ fontWeight: 700, textDecoration: "underline", background: "none", border: "none", cursor: "pointer", color: "#B91C1C", fontFamily: "inherit" }}
                    >
                      לחצ/י כאן להרשמה
                    </button>
                  </p>
                )}
              </div>
            )}
            {(success || resetSuccess) && (
              <div style={{ borderRadius: "10px", border: "1px solid #6EE7B7", background: "#ECFDF5", padding: "12px 14px" }}>
                <p style={{ fontSize: "13px", color: "#065F46", fontWeight: 600 }}>
                  {success || "הסיסמא עודכנה בהצלחה - אפשר להתחבר עם הסיסמא החדשה."}
                </p>
              </div>
            )}

            {mode === "register" && (
              <label style={{ display: "flex", alignItems: "flex-start", gap: "9px", cursor: "pointer", marginTop: "2px" }}>
                <input
                  type="checkbox"
                  checked={newsletterConsent}
                  onChange={(e) => setNewsletterConsent(e.target.checked)}
                  style={{ marginTop: "2px", width: "16px", height: "16px", accentColor: "var(--teal)", flexShrink: 0 }}
                />
                <span style={{ fontSize: "12.5px", lineHeight: 1.6, color: "var(--text-2)" }}>
                  {NEWSLETTER_CONSENT_TEXT}
                </span>
              </label>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%", borderRadius: "12px", padding: "12px", fontSize: "15px", fontWeight: 700, color: "white",
                background: loading ? "#9CA3AF" : "var(--teal)", border: "none", cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "inherit", transition: "background .18s, transform .15s", marginTop: "4px",
              }}
              className="hover:bg-[var(--teal-dark)] active:scale-[.98]"
            >
              {loading ? "..." : mode === "login" ? "כניסה לפאנל" : mode === "reset" ? "שליחת קישור לאיפוס" : "יצירת חשבון"}
            </button>
          </form>

          {/* Reset: back to login */}
          {mode === "reset" && (
            <p style={{ marginTop: "20px", textAlign: "center", fontSize: "14px", color: "var(--muted)" }}>
              <button type="button" onClick={() => switchMode("login")}
                style={{ fontWeight: 700, color: "var(--teal)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
                className="hover:underline">
                ← חזרה לכניסה
              </button>
            </p>
          )}

          {/* Back link */}
          <p style={{ marginTop: "32px", textAlign: "center" }}>
            <Link href="/" style={{ fontSize: "12.5px", color: "var(--faint)", transition: "color .18s" }} className="hover:text-[var(--muted)]">
              ← חזרה לדף הבית
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

export default function TherapistLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: "white" }} />}>
      <TherapistLoginContent />
    </Suspense>
  );
}
