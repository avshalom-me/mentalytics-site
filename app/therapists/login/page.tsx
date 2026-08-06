"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import Link from "next/link";
import { BarChart2, ShieldCheck, Users, LogIn, UserPlus, MailCheck } from "lucide-react";
import { NEWSLETTER_CONSENT_TEXT, NEWSLETTER_CONSENT_VERSION } from "@/app/lib/consent";

type Mode = "login" | "register" | "reset";

// עמודה אחת ממורכזת: הבחירה "כבר רשומ/ה? / חדש/ה כאן?" יושבת ישירות מעל
// הטופס, באותו כרטיס. (בפריסה הקודמת - שני פאנלים זה לצד זה - לחיצה על
// הבחירה בפאנל הימני החליפה טאב בפאנל השמאלי, ואנשים לא שמו לב שמשהו השתנה.)
//
// פרמטרי ה-URL נקראים מ-window אחרי mount (ולא דרך useSearchParams) - כך אין
// צורך בגבול Suspense סביב העמוד כולו, שנצפה נתקע על ה-fallback הריק.

function TherapistLoginContent() {
  const [mode, setMode] = useState<Mode>("login");
  const [plan, setPlan] = useState<string | null>(null);
  const [resetDone, setResetDone] = useState(false);
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
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("mode") === "register") setMode("register");
    setPlan(sp.get("plan"));
    // Arriving from a completed password reset (all sessions were revoked there).
    setResetDone(sp.get("reset") === "success");
  }, []);

  const resetSuccess = resetDone && mode === "login";

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
    <main className="min-h-screen flex items-center justify-center px-5 py-10" dir="rtl"
      style={{ fontFamily: "'Heebo', sans-serif", background: "linear-gradient(155deg, #0D3836 0%, #1B5A56 55%, #2A7470 100%)" }}>
      <style>{`
        .pro-input:focus { outline: none; border-color: #3D8C8A; box-shadow: 0 0 0 3px rgba(61,140,138,.12); }
        .google-btn:hover { background: #f8f8f8; }
        .choice-btn:hover { border-color: #C2DFDE !important; }
      `}</style>

      <div style={{ width: "100%", maxWidth: "440px" }}>
        {/* לוגו מעל הכרטיס */}
        <div style={{ textAlign: "center", marginBottom: "18px" }}>
          <Link href="/">
            <div style={{ display: "inline-block", background: "rgba(255,255,255,.12)", backdropFilter: "blur(8px)", borderRadius: "14px", padding: "8px 14px", border: "1px solid rgba(255,255,255,.18)" }}>
              <img src="/logo-temp.png" alt="טיפול חכם" style={{ height: "40px", width: "auto", display: "block" }} />
            </div>
          </Link>
        </div>

        <div style={{ background: "white", borderRadius: "22px", padding: "28px 26px", boxShadow: "0 24px 70px rgba(0,0,0,.28)" }}>
          <h1 style={{ fontSize: "21px", fontWeight: 900, color: "var(--text)", textAlign: "center", marginBottom: "4px" }}>
            ברוכים הבאים, אנשי המקצוע
          </h1>
          <p style={{ fontSize: "13.5px", color: "var(--muted)", textAlign: "center", marginBottom: "20px" }}>
            {mode === "reset" ? "נשלח אליך קישור לקביעת סיסמא חדשה" : "פאנל הניהול המקצועי של טיפול חכם"}
          </p>

          {/* הבחירה והטופס באותו כרטיס - הבחירה מחליפה את הטופס שמתחתיה ממש */}
          {mode !== "reset" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "22px" }}>
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="choice-btn"
                style={{
                  borderRadius: "14px", padding: "14px 12px", cursor: "pointer", textAlign: "center",
                  fontFamily: "inherit", transition: "all .15s",
                  background: mode === "login" ? "var(--teal-pale)" : "white",
                  border: mode === "login" ? "2px solid var(--teal)" : "2px solid #E5E7EB",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", marginBottom: "3px" }}>
                  <LogIn size={16} style={{ color: mode === "login" ? "var(--teal-dark)" : "#9CA3AF" }} />
                  <span style={{ fontSize: "14.5px", fontWeight: 800, color: mode === "login" ? "var(--teal-dark)" : "var(--text-2)" }}>כבר רשומ/ה?</span>
                </div>
                <div style={{ fontSize: "12px", color: mode === "login" ? "var(--teal-dark)" : "var(--muted)" }}>כניסה לפאנל שלך</div>
              </button>
              <button
                type="button"
                onClick={() => switchMode("register")}
                className="choice-btn"
                style={{
                  borderRadius: "14px", padding: "14px 12px", cursor: "pointer", textAlign: "center",
                  fontFamily: "inherit", transition: "all .15s",
                  background: mode === "register" ? "var(--gold-pale)" : "white",
                  border: mode === "register" ? "2px solid var(--gold)" : "2px solid #E5E7EB",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", marginBottom: "3px" }}>
                  <UserPlus size={16} style={{ color: mode === "register" ? "var(--gold-dark)" : "#9CA3AF" }} />
                  <span style={{ fontSize: "14.5px", fontWeight: 800, color: mode === "register" ? "var(--gold-dark)" : "var(--text-2)" }}>חדש/ה כאן?</span>
                </div>
                <div style={{ fontSize: "12px", color: mode === "register" ? "var(--gold-dark)" : "var(--muted)" }}>הצטרפות ללא עלות</div>
              </button>
            </div>
          )}

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
                  cursor: "pointer", transition: "background .15s", marginBottom: "18px", fontFamily: "inherit",
                }}
              >
                <svg style={{ width: "20px", height: "20px" }} viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                {mode === "register" ? "הרשמה עם Google" : "כניסה עם Google"}
              </button>

              {/* Divider */}
              <div style={{ position: "relative", marginBottom: "18px" }}>
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
                  placeholder={mode === "register" ? "בחרו סיסמא - לפחות 6 תווים" : "הסיסמא שלך"}
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
        </div>

        {/* פס אמון על הרקע הכהה */}
        <div style={{ marginTop: "22px", display: "flex", flexDirection: "column", gap: "10px" }}>
          {[
            { Icon: Users, text: "מטופלים מופנים אליך על בסיס התאמה מדויקת" },
            { Icon: BarChart2, text: "אנליטיקות מתקדמות על פרופיל הפונים באזורך" },
            { Icon: ShieldCheck, text: "פלטפורמה בנויה על ידי פסיכולוגים קליניים" },
          ].map(({ Icon, text }, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "9px" }}>
              <Icon size={14} style={{ color: "#7DD4CE", flexShrink: 0 }} />
              <p style={{ fontSize: "12.5px", color: "rgba(255,255,255,.65)" }}>{text}</p>
            </div>
          ))}
        </div>

        <p style={{ marginTop: "18px", textAlign: "center" }}>
          <Link href="/therapists/join" style={{ fontSize: "12.5px", color: "rgba(255,255,255,.55)" }} className="hover:text-white">
            לפרטים מלאים על ההצטרפות והמסלולים ←
          </Link>
          <span style={{ color: "rgba(255,255,255,.3)", margin: "0 10px" }}>·</span>
          <Link href="/" style={{ fontSize: "12.5px", color: "rgba(255,255,255,.55)" }} className="hover:text-white">
            ← חזרה לדף הבית
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function TherapistLoginPage() {
  return <TherapistLoginContent />;
}
