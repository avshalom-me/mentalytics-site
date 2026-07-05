"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabaseClient";

export default function ResetPasswordPage() {
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // עמוד איפוס משותף למטפלים ולמרכזים. ctx=center מגיע מקישור האיפוס של
  // /centers/login ומנתב את היעד בסיום בחזרה לסביבת המרכזים.
  const isCenter =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("ctx") === "center";
  const loginPath = isCenter ? "/centers/login" : "/therapists/login";

  useEffect(() => {
    async function init() {
      // The recovery link may arrive as a PKCE `code` param or as a hash token.
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      if (code) {
        await supabase.auth.exchangeCodeForSession(code).catch(() => {});
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setReady(true);
        setChecking(false);
        return;
      }
      // Give Supabase a moment to process a hash-based recovery token.
      const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
        if (s) { setReady(true); setChecking(false); }
      });
      setTimeout(async () => {
        const { data: { session: s } } = await supabase.auth.getSession();
        if (s) setReady(true);
        setChecking(false);
        sub.subscription.unsubscribe();
      }, 1500);
    }
    init();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) { setError("הסיסמא חייבת לכלול לפחות 6 תווים."); return; }
    if (password !== confirm) { setError("הסיסמאות אינן תואמות."); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setDone(true);
    // Revoke ALL sessions (this one included): if the reset was prompted by a
    // compromised account, an attacker's existing token must die with the old
    // password. The user signs back in once with the new password.
    try { await supabase.auth.signOut({ scope: "global" }); } catch { /* best-effort */ }
    setTimeout(() => { window.location.href = `${loginPath}?reset=success`; }, 1500);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12" dir="rtl"
      style={{ fontFamily: "'Heebo', sans-serif", background: "var(--surface)" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');
        .pro-input:focus { outline: none; border-color: #3D8C8A; box-shadow: 0 0 0 3px rgba(61,140,138,.12); }
      `}</style>

      <div className="w-full max-w-md rounded-3xl border border-[#E8E0D8] bg-white p-9 shadow-sm">
        <h1 className="text-2xl font-black text-stone-900 mb-1">קביעת סיסמא חדשה</h1>

        {checking ? (
          <p className="mt-4 text-stone-500">מאמת את הקישור...</p>
        ) : done ? (
          <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-4 text-center">
            <p className="text-sm font-bold text-green-800">הסיסמא עודכנה בהצלחה!</p>
            <p className="mt-1 text-sm text-green-700">מעבירים אותך להתחברות עם הסיסמא החדשה...</p>
          </div>
        ) : !ready ? (
          <div className="mt-4">
            <p className="text-sm text-stone-600 leading-7">
              הקישור לאיפוס אינו תקף או שפג תוקפו. נא לבקש קישור חדש.
            </p>
            <Link href={loginPath}
              className="mt-5 inline-block rounded-xl px-5 py-2.5 text-sm font-bold text-white"
              style={{ background: "var(--teal)" }}>
              חזרה לכניסה
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <p className="text-sm text-stone-500">בחר/י סיסמא חדשה לחשבון שלך.</p>
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-1.5">סיסמא חדשה</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
                className="pro-input w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm"
                placeholder="לפחות 6 תווים" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-1.5">אימות סיסמא</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6}
                className="pro-input w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm"
                placeholder="הקלד/י שוב" />
            </div>
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm font-semibold text-red-700">{error}</p>
              </div>
            )}
            <button type="submit" disabled={loading}
              className="w-full rounded-xl py-3 text-sm font-bold text-white disabled:opacity-60"
              style={{ background: "var(--teal)" }}>
              {loading ? "שומר..." : "עדכון סיסמא וכניסה"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
