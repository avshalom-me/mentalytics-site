"use client";

import { useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { KeyRound, Loader2 } from "lucide-react";

// הקמת חשבון ניהול מיד אחרי התשלום — בלי להמתין לקישור ידני של אדמין.
// ההוכחה היא הטוקן הסודי של ההצעה (שדרכו גם שולם): נרשמים/מתחברים, ואז
// /api/centers/claim-account מקשר את החשבון למרכז ומעביר ישר לפורטל.

export default function CenterAccountSetup({ token, centerName, defaultEmail }: {
  token: string;
  centerName: string;
  defaultEmail?: string;
}) {
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    const mail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) { setError("כתובת מייל לא תקינה"); return; }
    if (password.length < 6) { setError("סיסמה באורך 6 תווים לפחות"); return; }
    setLoading(true);

    try {
      // הרשמה; אם המייל כבר רשום — התחברות עם הסיסמה שהוזנה.
      let session = (await supabase.auth.signUp({ email: mail, password })).data.session;
      if (!session) {
        const { data: signIn, error: signInErr } = await supabase.auth.signInWithPassword({ email: mail, password });
        if (signInErr || !signIn.session) {
          setError("המייל כבר רשום אך הסיסמה שגויה — נסו שוב, או אפסו סיסמה בעמוד הכניסה.");
          setLoading(false);
          return;
        }
        session = signIn.session;
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

  return (
    <form onSubmit={submit} className="mx-auto mt-6 max-w-md rounded-2xl border border-[#D8E4E8] bg-white p-5 text-right shadow-sm">
      <p className="text-sm font-black text-stone-900">
        <KeyRound size={15} className="ml-1 inline" style={{ color: "var(--teal)" }} />
        עוד צעד אחד — חשבון הניהול של {centerName}
      </p>
      <p className="mt-1 mb-4 text-xs leading-6 text-stone-600">
        בחרו סיסמה וייכנסו ישר לפורטל: מילוי פרופיל המרכז, לוגו, צוות ותמונות — והכל עולה לאוויר אחרי אישור קצר שלנו.
      </p>
      <label className="mb-1 block text-xs font-semibold text-stone-700">אימייל לכניסה לפורטל</label>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" required
        className="mb-3 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-[var(--teal)]" />
      <label className="mb-1 block text-xs font-semibold text-stone-700">סיסמה (6 תווים לפחות)</label>
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" required minLength={6}
        className="mb-4 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-[var(--teal)]" />
      <button type="submit" disabled={loading}
        className="w-full rounded-full py-2.5 text-sm font-bold text-white transition hover:opacity-95 disabled:opacity-50"
        style={{ background: "linear-gradient(135deg,var(--teal-dark),var(--teal))" }}>
        {loading ? <Loader2 size={16} className="inline animate-spin" /> : "יצירת חשבון וכניסה לפורטל ←"}
      </button>
      {error && <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-center text-xs text-red-700">{error}</p>}
    </form>
  );
}
