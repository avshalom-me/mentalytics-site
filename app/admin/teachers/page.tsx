"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import HelpTip from "../components/HelpTip";
import { gmailSearchUrl } from "@/app/lib/crm";
import {
  TEACHER_LISTING_STATES,
  TEACHER_PRICE_GROSS,
  TEACHER_TRIAL_DAYS,
  listingStateLabel,
  subjectLabel,
  gradeGroupLabel,
  qualificationLabel,
  qualificationAllowsRemedial,
} from "@/app/lib/teacher-options";

// ניהול המורים של המענה הלימודי. עמוד נפרד מעמוד המטפלים בכוונה: מחזור
// חיים אחר (ניסיון → תשלום), אוצר מילים אחר, ובלי שום נגיעה בטבלת המטפלים.

type Stats = { impressions_30d: number; contacts_30d: number; impressions_total: number; contacts_total: number; last_contact_at: string | null };
type Teacher = {
  id: string;
  created_at: string;
  full_name: string;
  email: string;
  phone: string | null;
  gender: string | null;
  slug: string | null;
  subjects: string[];
  remedial: boolean;
  grade_groups: string[];
  regions: string[];
  online: boolean;
  languages: string[];
  price_text: string | null;
  bio: string | null;
  qualification: string | null;
  institution: string | null;
  qualification_year: number | null;
  teaching_certificate: boolean;
  experience_years: number | null;
  certificate_path: string | null;
  photo_url: string | null;
  declared_no_record: boolean;
  listing_state: string;
  approved_at: string | null;
  trial_ends_at: string | null;
  paying_since: string | null;
  paused_until: string | null;
  reject_reason: string | null;
  admin_note: string | null;
  sumit_recurring_id: string | null;
  sumit_first_charge_on: string | null;
  sumit_cancelled_at: string | null;
  signup_channel: string | null;
  signup_utm_campaign: string | null;
  signup_source: string;
  edit_url: string;
  pay_url: string;
  stats: Stats;
};

const TABS: { key: string; label: string; states: string[] }[] = [
  { key: "pending", label: "ממתינים לאישור", states: ["pending"] },
  { key: "listed", label: "מוצגים (ניסיון + משלמים)", states: ["trial", "paying"] },
  { key: "expired", label: "פג / מוקפא", states: ["expired", "paused"] },
  { key: "rejected", label: "נדחו", states: ["rejected"] },
  { key: "all", label: "הכול", states: TEACHER_LISTING_STATES.map((s) => s.key) },
];

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}.${String(d.getFullYear()).slice(2)}`;
}
function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

export default function AdminTeachersPage() {
  const [rows, setRows] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("pending");
  const [busy, setBusy] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    fetch("/api/admin-teachers")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setRows(j.teachers);
        else setError(j.error || "שגיאה בטעינה");
      })
      .catch(() => setError("שגיאה בטעינה"))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[r.listing_state] = (c[r.listing_state] ?? 0) + 1;
    return c;
  }, [rows]);
  const visible = useMemo(() => {
    const states = TABS.find((t) => t.key === tab)?.states ?? [];
    return rows.filter((r) => states.includes(r.listing_state));
  }, [rows, tab]);

  async function act(id: string, action: string, extra: Record<string, unknown> = {}, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(id);
    try {
      const r = await fetch("/api/admin-teachers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, ...extra }),
      });
      const j = await r.json();
      if (!j.ok) alert(j.error || "הפעולה נכשלה");
      else if (j.mail && j.mail.status !== "sent") alert(`הפעולה בוצעה. המייל: ${j.mail.status}${j.mail.error ? ` (${j.mail.error})` : ""}`);
      load();
    } finally {
      setBusy(null);
    }
  }

  async function remove(t: Teacher) {
    if (!confirm(`למחוק את ${t.full_name} לצמיתות? (הוראת קבע פעילה ב-Sumit חוסמת מחיקה)`)) return;
    setBusy(t.id);
    try {
      const r = await fetch(`/api/admin-teachers?id=${encodeURIComponent(t.id)}`, { method: "DELETE" });
      const j = await r.json();
      if (!j.ok) alert(j.error || "המחיקה נכשלה");
      load();
    } finally {
      setBusy(null);
    }
  }

  async function openCert(t: Teacher) {
    const r = await fetch(`/api/admin-teachers?cert_for=${encodeURIComponent(t.id)}`);
    const j = await r.json();
    if (!j.ok) return alert(j.error || "אין תעודה");
    window.open(j.url, "_blank", "noopener");
  }

  const copy = (text: string) => navigator.clipboard?.writeText(text).then(() => alert("הועתק"));

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-1 flex items-center gap-2">
          <h1 className="text-2xl font-black text-stone-900">מורים - מענה לימודי</h1>
          <HelpTip id="teachers" />
        </div>
        <p className="mb-5 text-sm text-stone-500">
          {TEACHER_TRIAL_DAYS} ימי ניסיון מהאישור, ואז {TEACHER_PRICE_GROSS} ש"ח לחודש כולל מע"מ. מוצגים רק בתוצאות שאלון הילדים; אין להם שום משטח באתר הראשי.
          {" "}<a href="/learning/join" target="_blank" className="font-bold text-stone-700 underline">טופס ההצטרפות ↗</a>
        </p>

        <div className="mb-4 flex flex-wrap gap-2">
          {TABS.map((t) => {
            const n = t.states.reduce((a, s) => a + (counts[s] ?? 0), 0);
            return (
              <button key={t.key} onClick={() => setTab(t.key)} className={`rounded-full border px-3 py-1.5 text-sm font-bold ${tab === t.key ? "border-stone-800 bg-stone-800 text-white" : "border-stone-200 bg-white text-stone-600 hover:bg-stone-100"}`}>
                {t.label} ({n})
              </button>
            );
          })}
        </div>

        {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {loading && <p className="text-sm text-stone-400">טוען…</p>}
        {!loading && visible.length === 0 && (
          <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center text-sm text-stone-400">אין מורים בסינון הזה.</div>
        )}

        <div className="space-y-3">
          {visible.map((t) => {
            const st = TEACHER_LISTING_STATES.find((s) => s.key === t.listing_state);
            const left = daysLeft(t.trial_ends_at);
            const open = openId === t.id;
            const remedialOk = qualificationAllowsRemedial(t.qualification);
            const activeSumit = !!t.sumit_recurring_id && !t.sumit_cancelled_at;
            return (
              <div key={t.id} className="rounded-2xl border border-stone-200 bg-white p-4">
                <div className="flex flex-wrap items-start gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.photo_url || (t.gender === "נקבה" ? "/avatar-female.svg" : "/avatar-male.svg")} alt="" className="h-14 w-14 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-black text-stone-900">{t.full_name}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${st?.cls ?? ""}`}>{listingStateLabel(t.listing_state)}</span>
                      {t.remedial && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">הוראה מתקנת</span>}
                      {activeSumit && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">הוראת קבע {t.sumit_recurring_id}</span>}
                      {t.paused_until && new Date(t.paused_until) > new Date() && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-bold text-stone-600">❄️ עד {fmtDate(t.paused_until)}</span>}
                      {!t.certificate_path && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">בלי תעודה</span>}
                    </div>
                    <div className="mt-1 text-xs text-stone-600">
                      {t.subjects.map(subjectLabel).join(", ")} · {t.grade_groups.map(gradeGroupLabel).join(", ")} · {t.regions.join(", ") || "-"}{t.online ? " · אונליין" : ""}
                    </div>
                    <div className="mt-0.5 text-xs text-stone-500">
                      {qualificationLabel(t.qualification)}{t.institution ? ` (${t.institution}${t.qualification_year ? `, ${t.qualification_year}` : ""})` : ""}{t.experience_years != null ? ` · ${t.experience_years} שנות ניסיון` : ""}{t.teaching_certificate ? " · תעודת הוראה" : ""}
                      {t.remedial && !remedialOk && <span className="font-bold text-red-700"> · סומן/ה הוראה מתקנת בלי הכשרה מתאימה</span>}
                    </div>
                    <div className="mt-0.5 text-xs text-stone-400">
                      נרשם/ה {fmtDate(t.created_at)}{t.signup_utm_campaign ? ` · ${t.signup_utm_campaign}` : t.signup_channel ? ` · ${t.signup_channel}` : ""}
                      {t.trial_ends_at && ` · ניסיון עד ${fmtDate(t.trial_ends_at)}${left != null && t.listing_state === "trial" ? ` (${left >= 0 ? `${left} ימים` : "נגמר"})` : ""}`}
                      {t.sumit_first_charge_on && ` · חיוב ראשון ${fmtDate(t.sumit_first_charge_on)}`}
                      {t.reject_reason && ` · סיבת דחייה: ${t.reject_reason}`}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-black text-stone-800">{t.stats?.contacts_30d ?? 0}<span className="text-xs font-bold text-stone-400"> / {t.stats?.contacts_total ?? 0}</span></div>
                    <div className="text-[11px] text-stone-400">פניות 30 יום / סה"כ</div>
                    <div className="mt-1 text-xs text-stone-500">{t.stats?.impressions_30d ?? 0} הופעות ב-30 יום</div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {t.listing_state === "pending" && (
                    <button disabled={busy === t.id} onClick={() => act(t.id, "approve", { send_email: confirm("לשלוח למורה מייל אישור עם הקישור האישי? (ביטול = לאשר בלי מייל)") }, undefined)} className="rounded-full bg-emerald-700 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-50">
                      ✓ אישור והתחלת ניסיון
                    </button>
                  )}
                  {(t.listing_state === "pending" || t.listing_state === "trial") && (
                    <button disabled={busy === t.id} onClick={() => { const reason = prompt("סיבת הדחייה (יישלח למורה רק אם תאשרו בשאלה הבאה):") ?? ""; if (reason === null) return; act(t.id, "reject", { reason, send_email: confirm("לשלוח למורה מייל דחייה?") }); }} className="rounded-full border border-red-200 px-3 py-1 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">
                      דחייה
                    </button>
                  )}
                  {(t.listing_state === "rejected" || t.listing_state === "expired") && (
                    <button disabled={busy === t.id} onClick={() => act(t.id, "approve", { send_email: confirm("לשלוח למורה מייל אישור?") })} className="rounded-full bg-emerald-700 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-50">
                      {t.listing_state === "expired" ? "החזרה לניסיון" : "אישור בכל זאת"}
                    </button>
                  )}
                  {(t.listing_state === "trial" || t.listing_state === "expired") && (
                    <button disabled={busy === t.id} onClick={() => { const d = Number(prompt("להאריך את הניסיון בכמה ימים?", "30")); if (d > 0) act(t.id, "extend_trial", { days: d }); }} className="rounded-full border border-stone-200 px-3 py-1 text-xs font-bold text-stone-600 hover:bg-stone-100 disabled:opacity-50">
                      + הארכת ניסיון
                    </button>
                  )}
                  {(t.listing_state === "trial" || t.listing_state === "paying") && (
                    t.paused_until && new Date(t.paused_until) > new Date()
                      ? <button disabled={busy === t.id} onClick={() => act(t.id, "unpause")} className="rounded-full border border-stone-200 px-3 py-1 text-xs font-bold text-stone-600 hover:bg-stone-100">שחרור הקפאה</button>
                      : <button disabled={busy === t.id} onClick={() => { const d = Number(prompt("להקפיא לכמה ימים? (לא מוצג/ת, בלי הודעה)", "14")); if (d > 0) act(t.id, "pause", { days: d }); }} className="rounded-full border border-stone-200 px-3 py-1 text-xs font-bold text-stone-600 hover:bg-stone-100">❄️ הקפאה</button>
                  )}
                  {t.listing_state === "trial" && !activeSumit && (
                    <button disabled={busy === t.id} onClick={() => act(t.id, "mark_paying", {}, "לסמן כמשלם/ת ידנית (בלי הוראת קבע ב-Sumit)?")} className="rounded-full border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-50">סימון משלם/ת ידני</button>
                  )}
                  {t.listing_state === "paying" && !activeSumit && (
                    <button disabled={busy === t.id} onClick={() => act(t.id, "revoke_paying", {}, "להסיר את הסימון כמשלם/ת?")} className="rounded-full border border-stone-200 px-3 py-1 text-xs font-bold text-stone-600 hover:bg-stone-100">הסרת סימון משלם/ת</button>
                  )}
                  {activeSumit && (
                    <button disabled={busy === t.id} onClick={() => act(t.id, "cancel_subscription", {}, `לבטל את הוראת הקבע ${t.sumit_recurring_id} ב-Sumit? המורה ${left != null && left > 0 ? "יחזור/תחזור לניסיון" : "יורד/ת מהמאגר"}.`)} className="rounded-full border border-red-200 px-3 py-1 text-xs font-bold text-red-700 hover:bg-red-50">ביטול הוראת קבע</button>
                  )}
                  <button disabled={busy === t.id} onClick={() => act(t.id, "set_remedial", { remedial: !t.remedial })} className="rounded-full border border-stone-200 px-3 py-1 text-xs font-bold text-stone-600 hover:bg-stone-100" title="מסומן = מוצע גם להמלצות הוראה מתקנת">
                    {t.remedial ? "ביטול סימון הוראה מתקנת" : "סימון הוראה מתקנת"}
                  </button>
                  {t.certificate_path && <button onClick={() => openCert(t)} className="rounded-full border border-stone-200 px-3 py-1 text-xs font-bold text-stone-600 hover:bg-stone-100">תעודה ↗</button>}
                  {t.slug && (t.listing_state === "trial" || t.listing_state === "paying") && <a href={`/learning/t/${encodeURIComponent(t.slug)}`} target="_blank" rel="noopener noreferrer" className="rounded-full border border-stone-200 px-3 py-1 text-xs font-bold text-stone-600 hover:bg-stone-100">פרופיל ↗</a>}
                  <button onClick={() => copy(t.edit_url)} className="rounded-full border border-stone-200 px-3 py-1 text-xs font-bold text-stone-500 hover:bg-stone-100">העתקת קישור עריכה</button>
                  <button onClick={() => copy(t.pay_url)} className="rounded-full border border-stone-200 px-3 py-1 text-xs font-bold text-stone-500 hover:bg-stone-100">העתקת קישור תשלום</button>
                  {t.trial_ends_at && <button disabled={busy === t.id} onClick={() => act(t.id, "resend_approval", {}, "לשלוח שוב את מייל האישור?")} className="rounded-full border border-stone-200 px-3 py-1 text-xs font-bold text-stone-500 hover:bg-stone-100">מייל אישור שוב</button>}
                  <a href={gmailSearchUrl(t.email)} target="_blank" rel="noopener noreferrer" className="rounded-full border border-stone-200 px-3 py-1 text-xs font-bold text-stone-500 hover:bg-stone-100">ג'ימייל ↗</a>
                  <button onClick={() => setOpenId(open ? null : t.id)} className="rounded-full border border-stone-200 px-3 py-1 text-xs font-bold text-stone-500 hover:bg-stone-100">{open ? "סגירה" : "פרטים והערות"}</button>
                  <button disabled={busy === t.id} onClick={() => remove(t)} className="ms-auto rounded-full px-3 py-1 text-xs font-bold text-red-400 hover:bg-red-50">מחיקה</button>
                </div>

                {open && (
                  <div className="mt-3 grid gap-3 rounded-xl bg-stone-50 p-3 text-xs sm:grid-cols-2">
                    <div className="space-y-1 text-stone-600">
                      <div><b>מייל:</b> {t.email} · <b>טלפון:</b> {t.phone || "-"}</div>
                      <div><b>שפות:</b> {t.languages?.join(", ")} · <b>מחיר:</b> {t.price_text || "-"}</div>
                      <div><b>הצהרת היעדר הרשעה:</b> {t.declared_no_record ? "כן" : "לא"} · <b>מקור:</b> {t.signup_source}</div>
                      {t.bio && <div className="whitespace-pre-line rounded-lg bg-white p-2 text-stone-700">{t.bio}</div>}
                      <div className="text-stone-400">פנייה אחרונה: {fmtDate(t.stats?.last_contact_at ?? null)} · הופעות סה"כ {t.stats?.impressions_total ?? 0}</div>
                    </div>
                    <div>
                      <label className="mb-1 block font-bold text-stone-600">הערת אדמין (פנימית)</label>
                      <textarea value={noteDraft[t.id] ?? t.admin_note ?? ""} onChange={(e) => setNoteDraft({ ...noteDraft, [t.id]: e.target.value })} rows={4} className="w-full rounded-lg border border-stone-200 p-2 text-xs" />
                      <button disabled={busy === t.id} onClick={() => act(t.id, "set_note", { note: noteDraft[t.id] ?? t.admin_note ?? "" })} className="mt-1 rounded-full border border-stone-300 px-3 py-1 text-xs font-bold text-stone-700 hover:bg-stone-100">שמירת הערה</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
