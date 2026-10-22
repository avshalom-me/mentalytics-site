"use client";

import { useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";

// קביעת סיסמה בפורטל השותפה. forced: הכניסה הראשונה עם סיסמה זמנית שהבעלים
// נתן (must_change_password ב-user_metadata, app/api/admin-schools/partners).
// בלי forced: "שינוי סיסמה" מתפריט הצד. אותה פעולה בשני המקרים: הסיסמה
// מתעדכנת והסימון יורד.

export default function ChangePassword({ forced, onDone }: { forced?: boolean; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const field = "w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-[var(--teal)]";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("הסיסמה צריכה לכלול לפחות 8 תווים.");
    if (password !== confirm) return setError("שתי הסיסמאות אינן זהות.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password, data: { must_change_password: false } });
    setBusy(false);
    if (error) {
      setError(/same|different/i.test(error.message) ? "זו הסיסמה הנוכחית. בוחרים סיסמה אחרת." : "שמירת הסיסמה נכשלה. אפשר לנסות שוב.");
      return;
    }
    setDone(true);
    window.setTimeout(onDone, 1200);
  }

  return (
    <main dir="rtl" className="mx-auto max-w-md px-5 py-12">
      <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-black text-stone-900">{forced ? "ברוכה הבאה. בוחרים סיסמה" : "שינוי סיסמה"}</h1>
        <p className="mt-2 text-sm leading-6 text-stone-500">
          {forced
            ? "נכנסת עם סיסמה זמנית. לפני שממשיכים, בוחרים סיסמה משלך לפורטל. היא נפרדת מהסיסמה של המייל."
            : "הסיסמה לפורטל בתי הספר. היא נפרדת מהסיסמה של המייל."}
        </p>
        {done ? (
          <p className="mt-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-center text-sm font-semibold text-green-800">הסיסמה נשמרה.</p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-stone-700">סיסמה חדשה</span>
              <input type="password" dir="ltr" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={field} placeholder="לפחות 8 תווים" />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-stone-700">שוב, לאימות</span>
              <input type="password" dir="ltr" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className={field} />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={busy} className="w-full rounded-full bg-[#3D8C8A] py-3 text-base font-bold text-white hover:bg-[#2A6462] disabled:opacity-50">
              {busy ? "שומר..." : "שמירת הסיסמה"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
