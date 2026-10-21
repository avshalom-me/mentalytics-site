"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { supabase } from "@/app/lib/supabaseClient";

// כניסה לפורטל השותפה של ענף בתי הספר: מייל וסיסמה (Supabase Auth). אין כאן
// הרשמה: משתמשת נוצרת רק מהאדמין, עם קישור חד-פעמי להגדרת סיסמה. גם איפוס
// סיסמה עובר דרך הבעלים, שמפיק קישור חדש; המערכת לא שולחת מייל.

function LoginContent() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [forgot, setForgot] = useState(false);
  const resetDone = params.get("reset") === "success";

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) window.location.href = "/partner/schools/overview";
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setError("המייל או הסיסמה שגויים.");
      setLoading(false);
      return;
    }
    window.location.href = "/partner/schools/overview";
  }

  return (
    <main dir="rtl" className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-5 py-12">
      <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-sm">
        <h1 className="text-center text-2xl font-black text-stone-900">כניסה לפורטל בתי הספר</h1>
        <p className="mt-1 text-center text-sm text-stone-500">ענף שאלון היועצות, טיפול חכם</p>
        {resetDone && (
          <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-center text-sm font-semibold text-green-800">
            הסיסמה נשמרה. אפשר להיכנס.
          </div>
        )}
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-stone-700">מייל</span>
            <input type="email" required dir="ltr" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-[var(--teal)]" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-stone-700">סיסמה</span>
            <input type="password" required dir="ltr" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-[var(--teal)]" />
          </label>
          <button type="submit" disabled={loading} className="w-full rounded-full bg-[#3D8C8A] py-3 text-base font-bold text-white hover:bg-[#2A6462] disabled:opacity-50">
            {loading ? <Loader2 size={18} className="inline animate-spin" /> : "כניסה"}
          </button>
          {error && <p className="text-center text-sm text-red-600">{error}</p>}
        </form>
        <div className="mt-5 text-center text-sm">
          {forgot ? (
            <p className="leading-6 text-stone-600">לקבלת קישור חדש להגדרת סיסמה פונים לאבשלום. הקישור מגיע ממנו ישירות.</p>
          ) : (
            <button type="button" onClick={() => setForgot(true)} className="text-stone-400 hover:underline">
              שכחתי סיסמה
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

export default function PartnerLoginPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center" dir="rtl">טוען...</div>}>
      <LoginContent />
    </Suspense>
  );
}
