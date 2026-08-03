"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { Mail, Loader2 } from "lucide-react";

// הזמנת מטפלים במייל (מסלול 1): המנהל מזין כתובות, כל מטפל מקבל קישור אישי
// וממלא את הפרופיל בעצמו. הפאנל מציג את סטטוס ההזמנות ומאפשר שליחה חוזרת/ביטול.

type Invite = { id: string; email: string; invited_at: string; used_at: string | null; therapist_id: string | null };

export default function InvitePanel({ quota, linkedCount }: { quota: number; linkedCount: number }) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [emailsText, setEmailsText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function authed(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = "/centers/login"; return null; }
    return session.access_token;
  }

  async function load() {
    const token = await authed();
    if (!token) return;
    try {
      const res = await fetch("/api/center-portal/invites", { headers: { Authorization: `Bearer ${token}` } });
      const j = await res.json();
      if (j.ok) setInvites(j.invites);
    } catch { /* שקט - הפאנל משני */ }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function post(payload: Record<string, unknown>) {
    const token = await authed();
    if (!token) return { ok: false };
    setBusy(true); setErr(""); setMsg("");
    try {
      const res = await fetch("/api/center-portal/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!j.ok) setErr(j.error ?? "שגיאה");
      else await load();
      return j;
    } catch {
      setErr("שגיאת רשת");
      return { ok: false };
    } finally {
      setBusy(false);
    }
  }

  async function sendInvites() {
    const emails = emailsText.split(/[\n,;]+/).map((e) => e.trim()).filter(Boolean);
    if (emails.length === 0) { setErr("הזינו כתובת מייל אחת לפחות"); return; }
    const j = await post({ action: "invite", emails });
    if (j.ok) {
      setEmailsText("");
      setMsg(`נשלחו ${j.sent} הזמנות${(j.failed as string[])?.length ? ` · נכשלו: ${(j.failed as string[]).join(", ")}` : ""}`);
    }
  }

  const open = invites.filter((i) => !i.used_at);
  const room = quota > 0 ? Math.max(0, quota - linkedCount - open.length) : null;

  return (
    <section className="mb-8 rounded-2xl border border-stone-200 bg-white p-5">
      <h2 className="mb-1 flex items-center gap-2 text-base font-black text-stone-800">
        <Mail size={17} style={{ color: "var(--teal)" }} /> הזמנת המטפלים שלכם במייל
      </h2>
      <p className="mb-4 text-sm leading-6 text-stone-600">
        הזינו את כתובות המייל של מטפלי המרכז - כל מטפל/ת יקבל/תקבל קישור אישי וימלא/תמלא את הפרופיל בעצמו/ה
        (כ-5 דקות). הפרופיל נכנס לאישור קצר שלנו ואז למערכת ההתאמות, משויך למרכז.
        {room !== null && <span className="font-semibold text-stone-500"> נותר מקום ל-{room} הזמנות במנוי.</span>}
      </p>

      <div className="flex flex-wrap items-start gap-2">
        <textarea
          value={emailsText}
          onChange={(e) => setEmailsText(e.target.value)}
          rows={2}
          placeholder={"מייל אחד בכל שורה (או מופרדים בפסיק):\ntherapist1@example.com, therapist2@example.com"}
          className="min-w-[260px] flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-[var(--teal)]"
          dir="ltr"
        />
        <button onClick={sendInvites} disabled={busy || (room !== null && room <= 0)}
          className="rounded-full px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-95 disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,var(--teal-dark),var(--teal))" }}>
          {busy ? <Loader2 size={15} className="inline animate-spin" /> : "📨 שליחת הזמנות"}
        </button>
      </div>
      {msg && <p className="mt-2 text-sm font-semibold text-green-700">{msg}</p>}
      {err && <p className="mt-2 text-sm font-semibold text-red-600">{err}</p>}

      {invites.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {invites.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-100 bg-stone-50 px-3 py-2 text-sm">
              <span className="font-semibold text-stone-700" dir="ltr">{i.email}</span>
              <span className="flex items-center gap-2 text-xs">
                {i.used_at ? (
                  <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 font-bold text-green-800">✓ הפרופיל מולא</span>
                ) : (
                  <>
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 font-bold text-amber-800">
                      ⏳ נשלחה {new Date(i.invited_at).toLocaleDateString("he-IL")}
                    </span>
                    <button onClick={() => post({ action: "resend", id: i.id })} disabled={busy}
                      className="text-stone-500 underline hover:text-stone-700 disabled:opacity-40">שליחה חוזרת</button>
                    <button onClick={() => post({ action: "revoke", id: i.id })} disabled={busy}
                      className="text-red-500 underline hover:text-red-700 disabled:opacity-40">ביטול</button>
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
