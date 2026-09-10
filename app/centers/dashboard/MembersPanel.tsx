"use client";

import { useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { UserPlus, Loader2, ShieldCheck } from "lucide-react";

// צוות הניהול: מי יכול להיכנס לפורטל הזה. כל חבר מחזיק את מלוא ההרשאות.
// מקבל את הרשימה מהתשובה הראשית של הפורטל (בלי קריאה נוספת בטעינה), ומרענן
// אותה מהתשובה של כל פעולה - אותו דפוס כמו InvitePanel.

type Member = { user_id: string; email: string | null; created_at: string; is_primary: boolean; is_me: boolean };

// readOnly: הצפייה מהאדמין ("צפייה בתור מרכז"). אין שם סשן של המרכז, ולכן
// כל פעולה הייתה נכשלת ב-401 וזורקת את האדמין ל-/centers/login. הפאנל היה
// מוסתר שם לגמרי, וזה בדיוק מה שהכשיל את התמיכה: מנהלת של מרכז אמרה שאין
// מקום להזין מייל, ומהאדמין אי אפשר היה לראות מה היא רואה כדי להפריך. עכשיו
// הרשימה מוצגת בלי הטופס ובלי כפתורי ההסרה.
export default function MembersPanel({ initial, readOnly = false }: { initial: Member[]; readOnly?: boolean }) {
  const [members, setMembers] = useState<Member[]>(initial);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  async function authed(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = "/centers/login"; return null; }
    return session.access_token;
  }

  async function call(method: "POST" | "DELETE", payload: Record<string, unknown>) {
    const token = await authed();
    if (!token) return;
    setBusy(true); setErr(""); setMsg("");
    try {
      const res = await fetch("/api/center-portal/members", {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!j.ok) { setErr(j.error ?? "שגיאה"); return; }
      setMembers(j.members ?? []);
      setMsg(method === "POST" ? `${payload.email} נוסף/ה לצוות` : "החבר/ה הוסר/ה");
      if (method === "POST") setEmail("");
    } catch {
      setErr("שגיאת רשת");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-8 rounded-2xl border border-stone-200 bg-white p-5">
      <div className="mb-1 flex items-center gap-2">
        <ShieldCheck size={18} className="text-[var(--teal)]" />
        <h2 className="text-base font-black text-stone-800">צוות הניהול</h2>
      </div>
      <p className="mb-4 text-sm leading-6 text-stone-600">
        מי יכול להיכנס לפורטל הזה ולערוך את המרכז ואת המטפלים. כל חבר צוות מקבל את אותן הרשאות.
        כדי להוסיף מישהו, הוא נרשם קודם ב-<a href="/centers/login" className="font-semibold text-[var(--teal-dark)] underline">כניסה / הרשמה למרכזים</a> עם הכתובת שלו, ואז מזינים אותה כאן.
      </p>

      <ul className="mb-4 divide-y divide-stone-100 rounded-xl border border-stone-200">
        {members.map((m) => (
          <li key={m.user_id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <div className="min-w-0">
              <span className="font-semibold text-stone-800" dir="ltr">{m.email ?? "(ללא כתובת)"}</span>
              {m.is_me && <span className="ms-2 text-xs text-stone-400">(אתם)</span>}
              {m.is_primary && (
                <span className="ms-2 rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-teal-700">חשבון ראשי</span>
              )}
            </div>
            {!m.is_primary && !readOnly && (
              <button
                type="button"
                disabled={busy}
                onClick={() => { if (confirm(`להסיר את ${m.email ?? "החבר/ה"} מצוות הניהול? הגישה לפורטל תיחסם מיד.`)) call("DELETE", { user_id: m.user_id }); }}
                className="shrink-0 text-xs font-semibold text-stone-400 hover:text-red-600 disabled:opacity-50"
              >
                הסרה
              </button>
            )}
          </li>
        ))}
      </ul>

      {readOnly ? (
        <p className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-2.5 text-xs text-stone-500">
          בצפייה מהאדמין הטופס מוסתר. המרכז עצמו רואה כאן שדה מייל וכפתור &quot;הוספה לצוות&quot;.
        </p>
      ) : (
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => { e.preventDefault(); if (email.trim()) call("POST", { email: email.trim() }); }}
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="כתובת המייל שאיתה נרשם/ה"
          dir="ltr"
          className="min-w-0 flex-1 rounded-full border border-stone-200 px-4 py-2 text-sm outline-none focus:border-[var(--teal)]"
        />
        <button
          type="submit"
          disabled={busy || !email.trim()}
          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--teal)] px-5 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
          הוספה לצוות
        </button>
      </form>
      )}

      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      {msg && <p className="mt-2 text-sm text-teal-700">{msg}</p>}
      <p className="mt-3 text-[11.5px] leading-5 text-stone-400">
        החשבון הראשי הוא זה שהקים את המרכז ואינו ניתן להסרה מכאן, כדי שאף אחד לא יינעל בחוץ. לשינויו כתבו לנו.
      </p>
    </section>
  );
}
