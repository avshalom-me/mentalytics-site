"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import HelpTip from "../components/HelpTip";
import { gmailSearchUrl } from "@/app/lib/crm";
import {
  TEACHER_LISTING_STATES,
  TEACHER_PRICE_GROSS,
  TEACHER_TRIAL_DAYS,
  TEACHER_PAY_EMAIL_DAY,
  listingStateLabel,
  subjectLabel,
  gradeGroupLabel,
  qualificationLabel,
  qualificationAllowsRemedial,
} from "@/app/lib/teacher-options";
import { trialDaysLeft } from "@/app/lib/teacher-trial";
import { TEACHER_EMAIL_PREVIEWS } from "@/app/lib/teacher-email-templates";
import { TEACHER_RECRUITMENT_CHANNELS, teacherCampaign, teacherJoinUrl } from "@/app/lib/teacher-recruitment";

// ניהול המורים של המענה הלימודי. עמוד נפרד מעמוד המטפלים בכוונה: מחזור
// חיים אחר (ניסיון → הרשמה לתשלום → ארכיון), אוצר מילים אחר, ובלי שום
// נגיעה בטבלת המטפלים.

type Stats = { impressions_30d: number; contacts_30d: number; profile_views_30d: number; impressions_total: number; contacts_total: number; last_contact_at: string | null };
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
  has_certificate: boolean;
  photo_url: string | null;
  declared_no_record: boolean;
  listing_state: string;
  approved_at: string | null;
  trial_ends_at: string | null;
  trial_ending_notified_at: string | null;
  trial_last_day_notified_at: string | null;
  archived_at: string | null;
  paying_since: string | null;
  paused_until: string | null;
  reject_reason: string | null;
  sumit_recurring_id: string | null;
  sumit_first_charge_on: string | null;
  sumit_cancelled_at: string | null;
  pay_viewed_at: string | null;
  pay_view_count: number;
  signup_channel: string | null;
  signup_utm_campaign: string | null;
  signup_source: string;
  edit_url: string;
  pay_url: string;
  stats: Stats;
};
type Note = { id: string; body: string; author: string | null; created_at: string };
type DemandRow = { subject: string; remedial: boolean; region: string; searches: number; empty_searches: number; avg_returned: number };

const TABS: { key: string; label: string; states: string[] }[] = [
  { key: "pending", label: "ממתינים לאישור", states: ["pending"] },
  { key: "listed", label: "מוצגים (ניסיון + משלמים)", states: ["trial", "paying"] },
  { key: "archived", label: "ארכיון", states: ["archived"] },
  { key: "rejected", label: "נדחו", states: ["rejected"] },
  { key: "all", label: "הכול", states: TEACHER_LISTING_STATES.map((s) => s.key) },
];

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem", day: "numeric", month: "numeric", year: "2-digit" });
}

const btn = "rounded-full border border-stone-200 px-3 py-1 text-xs font-bold text-stone-600 hover:bg-stone-100 disabled:opacity-50";

export default function AdminTeachersPage() {
  const [rows, setRows] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("pending");
  const [busy, setBusy] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, Note[]>>({});
  const [newNote, setNewNote] = useState("");
  const [demand, setDemand] = useState<DemandRow[] | null>(null);
  const [panel, setPanel] = useState<"" | "demand" | "channels" | "emails">("");

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

  const loadNotes = useCallback((id: string) => {
    fetch(`/api/admin-teachers?notes_for=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((j) => j.ok && setNotes((prev) => ({ ...prev, [id]: j.notes })))
      .catch(() => {});
  }, []);

  function togglePanel(p: "demand" | "channels" | "emails") {
    setPanel(panel === p ? "" : p);
    if (p === "demand" && demand === null) {
      fetch("/api/admin-teachers?demand=1&days=30")
        .then((r) => r.json())
        .then((j) => setDemand(j.ok ? j.demand : []))
        .catch(() => setDemand([]));
    }
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[r.listing_state] = (c[r.listing_state] ?? 0) + 1;
    return c;
  }, [rows]);
  const visible = useMemo(() => {
    const states = TABS.find((t) => t.key === tab)?.states ?? [];
    return rows.filter((r) => states.includes(r.listing_state));
  }, [rows, tab]);
  const signupsByCampaign = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) if (r.signup_utm_campaign) c[r.signup_utm_campaign] = (c[r.signup_utm_campaign] ?? 0) + 1;
    return c;
  }, [rows]);

  async function act(id: string, action: string, extra: Record<string, unknown> = {}): Promise<{ ok: boolean; error?: string }> {
    setBusy(id);
    try {
      const r = await fetch("/api/admin-teachers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, ...extra }),
      });
      const j = await r.json();
      if (!j.ok) return { ok: false, error: j.error || "הפעולה נכשלה" };
      if (j.mail && j.mail.status !== "sent") alert(`הפעולה בוצעה, אבל המייל לא נשלח: ${j.mail.status}${j.mail.error ? ` (${j.mail.error})` : ""}`);
      load();
      if (openId === id) loadNotes(id);
      return { ok: true };
    } finally {
      setBusy(null);
    }
  }
  async function run(id: string, action: string, extra: Record<string, unknown> = {}, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    const r = await act(id, action, extra);
    if (!r.ok) alert(r.error);
  }

  async function approve(t: Teacher, sendEmail: boolean) {
    const text = sendEmail
      ? `לאשר את ${t.full_name} ולהתחיל ${TEACHER_TRIAL_DAYS} ימי ניסיון? יישלח מייל אישור עם הקישור האישי.`
      : `לאשר את ${t.full_name} ולהתחיל ${TEACHER_TRIAL_DAYS} ימי ניסיון, בלי לשלוח מייל?`;
    if (!confirm(text)) return;
    let r = await act(t.id, "approve", { send_email: sendEmail });
    if (!r.ok && !t.has_certificate && confirm(`${r.error}\n\nלאשר בכל זאת, בלי תעודה?`)) {
      r = await act(t.id, "approve", { send_email: sendEmail, without_certificate: true });
    }
    if (!r.ok) alert(r.error);
  }

  async function reject(t: Teacher) {
    const reason = prompt(`סיבת הדחייה של ${t.full_name} (אפשר להשאיר ריק):`);
    if (reason === null) return;
    const sendEmail = confirm("לשלוח למורה מייל על הדחייה, עם הסיבה? (ביטול = לדחות בלי מייל)");
    const r = await act(t.id, "reject", { reason, send_email: sendEmail });
    if (!r.ok) alert(r.error);
  }

  async function remove(t: Teacher) {
    if (!confirm(`למחוק את ${t.full_name} לצמיתות, כולל הקבצים וההיסטוריה? (הוראת קבע פעילה ב-Sumit חוסמת מחיקה)`)) return;
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

  async function addNote(id: string) {
    const text = newNote.trim();
    if (!text) return;
    const r = await act(id, "add_note", { note: text });
    if (r.ok) setNewNote("");
    else alert(r.error);
  }

  const copy = (text: string) => navigator.clipboard?.writeText(text).then(() => alert("הועתק"));
  const site = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-1 flex items-center gap-2">
          <h1 className="text-2xl font-black text-stone-900">מורים - מענה לימודי</h1>
          <HelpTip id="teachers" />
        </div>
        <p className="mb-4 text-sm text-stone-500">
          {TEACHER_TRIAL_DAYS} ימי ניסיון מהאישור, בלי תשלום. ביום ה-{TEACHER_PAY_EMAIL_DAY} יוצא מייל להרשמה ({TEACHER_PRICE_GROSS} ש"ח לחודש כולל מע"מ), ביום האחרון מייל נוסף,
          ולמחרת מי שלא נרשם/ה עובר/ת לארכיון. המורים מוצגים רק בתוצאות שאלון הילדים.
        </p>

        <div className="mb-4 flex flex-wrap gap-2">
          <button onClick={() => togglePanel("demand")} className={`${btn} ${panel === "demand" ? "bg-stone-200" : "bg-white"}`}>📊 ביקוש: מה הורים מחפשים</button>
          <button onClick={() => togglePanel("channels")} className={`${btn} ${panel === "channels" ? "bg-stone-200" : "bg-white"}`}>🧲 ערוצי גיוס וקישורי הצטרפות</button>
          <button onClick={() => togglePanel("emails")} className={`${btn} ${panel === "emails" ? "bg-stone-200" : "bg-white"}`}>✉️ המיילים שהמורים מקבלים</button>
        </div>

        {panel === "demand" && (
          <div className="mb-5 rounded-2xl border border-stone-200 bg-white p-4">
            <div className="mb-2 text-sm font-black text-stone-800">חיפושי מורים ב-30 הימים האחרונים</div>
            <p className="mb-3 text-xs text-stone-500">כל חיפוש של הורה מתוך תוצאות השאלון. "חזרו ריקים" = לא נמצא אף מורה. זו הרשימה שלפיה כדאי לגייס: תחום ואזור שמחפשים בהם ואין בהם מורים.</p>
            {demand === null && <p className="text-xs text-stone-400">טוען…</p>}
            {demand !== null && demand.length === 0 && <p className="text-xs text-stone-400">עדיין לא נרשמו חיפושים.</p>}
            {demand !== null && demand.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-400">
                      <th className="px-2 py-1.5 text-start font-bold">תחום</th>
                      <th className="px-2 py-1.5 text-start font-bold">סוג</th>
                      <th className="px-2 py-1.5 text-start font-bold">אזור</th>
                      <th className="px-2 py-1.5 text-start font-bold">חיפושים</th>
                      <th className="px-2 py-1.5 text-start font-bold">חזרו ריקים</th>
                      <th className="px-2 py-1.5 text-start font-bold">ממוצע תוצאות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {demand.map((d, i) => (
                      <tr key={i} className="border-b border-stone-100 last:border-b-0">
                        <td className="px-2 py-1.5 font-bold text-stone-700">{d.subject === "-" ? "כללי" : subjectLabel(d.subject)}</td>
                        <td className="px-2 py-1.5 text-stone-600">{d.remedial ? "הוראה מתקנת" : "תגבור"}</td>
                        <td className="px-2 py-1.5 text-stone-600">{d.region}</td>
                        <td className="px-2 py-1.5 font-bold text-stone-800">{d.searches}</td>
                        <td className={`px-2 py-1.5 font-bold ${Number(d.empty_searches) > 0 ? "text-red-600" : "text-stone-400"}`}>{d.empty_searches}</td>
                        <td className="px-2 py-1.5 text-stone-600">{d.avg_returned}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {panel === "channels" && (
          <div className="mb-5 rounded-2xl border border-stone-200 bg-white p-4">
            <div className="mb-2 text-sm font-black text-stone-800">ערוצי גיוס</div>
            <p className="mb-3 text-xs leading-5 text-stone-500">
              לכל ערוץ קישור הצטרפות משלו. מורה שנרשם/ת דרכו נספר/ת כאן, וכך רואים איזה ערוץ מביא הרשמות. הפנייה היא אישית, לרכזי התוכניות ולמנהלי הקהילות - לא דיוור למורים שלא ביקשו.
            </p>
            <div className="space-y-2">
              {TEACHER_RECRUITMENT_CHANNELS.map((c) => (
                <div key={c.key} className="flex flex-wrap items-center gap-2 border-b border-stone-100 pb-2 text-xs last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-stone-800">{c.name}</span>
                    <span className="text-stone-500"> · {c.note}</span>
                  </div>
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 font-bold text-stone-700">{signupsByCampaign[teacherCampaign(c.key)] ?? 0} הרשמות</span>
                  {c.url && <a href={c.url} target="_blank" rel="noopener noreferrer" className={btn}>לאתר ↗</a>}
                  <button onClick={() => copy(teacherJoinUrl(c, site))} className={btn}>העתקת קישור ההצטרפות</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {panel === "emails" && (
          <div className="mb-5 rounded-2xl border border-stone-200 bg-white p-4">
            <div className="mb-2 text-sm font-black text-stone-800">המיילים, כפי שהם נשלחים</div>
            <p className="mb-3 text-xs text-stone-500">תצוגה עם מורה לדוגמה. שום דבר לא נשלח מכאן.</p>
            <div className="flex flex-wrap gap-2">
              {TEACHER_EMAIL_PREVIEWS.map((p) => (
                <a key={p.key} href={`/api/admin-teachers?preview=${p.key}`} target="_blank" rel="noopener noreferrer" className={btn}>{p.label} ↗</a>
              ))}
            </div>
          </div>
        )}

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
        {loading && rows.length === 0 && <p className="text-sm text-stone-400">טוען…</p>}
        {!loading && visible.length === 0 && (
          <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center text-sm text-stone-400">אין מורים בסינון הזה.</div>
        )}

        <div className="space-y-3">
          {visible.map((t) => {
            const st = TEACHER_LISTING_STATES.find((s) => s.key === t.listing_state);
            const left = t.trial_ends_at ? trialDaysLeft(t.trial_ends_at) : null;
            const open = openId === t.id;
            const remedialOk = qualificationAllowsRemedial(t.qualification);
            const activeSumit = !!t.sumit_recurring_id && !t.sumit_cancelled_at;
            const paused = !!t.paused_until && new Date(t.paused_until) > new Date();
            const isBusy = busy === t.id;
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
                      {paused && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-bold text-stone-600">❄️ מוקפא/ת עד {fmtDate(t.paused_until)}</span>}
                      {!t.has_certificate && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">בלי תעודה</span>}
                    </div>
                    <div className="mt-1 text-xs text-stone-600">
                      {t.subjects.map(subjectLabel).join(", ")} · {t.grade_groups.map(gradeGroupLabel).join(", ")} · {t.regions.join(", ") || "-"}
                      {t.online ? " · אונליין" : ""}
                    </div>
                    <div className="mt-0.5 text-xs text-stone-500">
                      {qualificationLabel(t.qualification)}
                      {t.institution ? ` (${t.institution}${t.qualification_year ? `, ${t.qualification_year}` : ""})` : ""}
                      {t.experience_years != null ? ` · ${t.experience_years} שנות ניסיון` : ""}
                      {t.teaching_certificate ? " · תעודת הוראה" : ""}
                      {t.remedial && !remedialOk && <span className="font-bold text-red-700"> · מסומן/ת הוראה מתקנת בלי הכשרה מתאימה</span>}
                    </div>
                    <div className="mt-0.5 text-xs text-stone-400">
                      נרשם/ה {fmtDate(t.created_at)}
                      {t.signup_utm_campaign ? ` · ${t.signup_utm_campaign}` : t.signup_channel ? ` · ${t.signup_channel}` : ""}
                      {t.trial_ends_at && t.listing_state === "trial" && ` · ניסיון עד ${fmtDate(t.trial_ends_at)}${left != null ? ` (${left > 0 ? `${left} ימים` : left === 0 ? "היום האחרון" : "נגמר"})` : ""}`}
                      {t.trial_ending_notified_at && ` · מייל יום ${TEACHER_PAY_EMAIL_DAY} נשלח ${fmtDate(t.trial_ending_notified_at)}`}
                      {t.trial_last_day_notified_at && ` · מייל היום האחרון נשלח ${fmtDate(t.trial_last_day_notified_at)}`}
                      {t.pay_view_count > 0 && ` · פתח/ה את עמוד ההרשמה ${t.pay_view_count} פעמים (${fmtDate(t.pay_viewed_at)})`}
                      {t.archived_at && t.listing_state === "archived" && ` · בארכיון מ-${fmtDate(t.archived_at)}`}
                      {t.sumit_first_charge_on && activeSumit && ` · חיוב ראשון ${fmtDate(`${t.sumit_first_charge_on}T12:00:00Z`)}`}
                      {t.reject_reason && ` · סיבת דחייה: ${t.reject_reason}`}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-black text-stone-800">
                      {t.stats?.contacts_30d ?? 0}
                      <span className="text-xs font-bold text-stone-400"> / {t.stats?.contacts_total ?? 0}</span>
                    </div>
                    <div className="text-[11px] text-stone-400">פניות 30 יום / סה"כ</div>
                    <div className="mt-1 text-xs text-stone-500">{t.stats?.impressions_30d ?? 0} הופעות ב-30 יום</div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {(t.listing_state === "pending" || t.listing_state === "rejected") && (
                    <>
                      <button disabled={isBusy} onClick={() => approve(t, true)} className="rounded-full bg-emerald-700 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-50">✓ אישור + מייל</button>
                      <button disabled={isBusy} onClick={() => approve(t, false)} className={btn}>אישור בלי מייל</button>
                    </>
                  )}
                  {t.listing_state === "archived" && (
                    <button disabled={isBusy} onClick={() => run(t.id, "approve", { send_email: false }, `להחזיר את ${t.full_name} למאגר עם ${TEACHER_TRIAL_DAYS} ימי ניסיון חדשים?`)} className="rounded-full bg-emerald-700 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-50">החזרה למאגר (ניסיון חדש)</button>
                  )}
                  {(t.listing_state === "pending" || t.listing_state === "trial") && !activeSumit && (
                    <button disabled={isBusy} onClick={() => reject(t)} className="rounded-full border border-red-200 px-3 py-1 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">דחייה</button>
                  )}
                  {(t.listing_state === "trial" || t.listing_state === "archived") && !activeSumit && (
                    <button disabled={isBusy} onClick={() => { const d = Number(prompt("להאריך את הניסיון בכמה ימים? שני המיילים של סוף הניסיון יישלחו שוב לקראת התאריך החדש.", "30")); if (d > 0) void run(t.id, "extend_trial", { days: d }); }} className={btn}>+ הארכת ניסיון</button>
                  )}
                  {(t.listing_state === "trial" || t.listing_state === "paying") &&
                    (paused ? (
                      <button disabled={isBusy} onClick={() => run(t.id, "unpause")} className={btn}>שחרור הקפאה</button>
                    ) : (
                      <button disabled={isBusy} onClick={() => { const d = Number(prompt("להקפיא לכמה ימים? (לא מוצג/ת להורים, בלי הודעה למורה)", "14")); if (d > 0) void run(t.id, "pause", { days: d }); }} className={btn}>❄️ הקפאה</button>
                    ))}
                  {t.listing_state === "trial" && !activeSumit && (
                    <>
                      <button disabled={isBusy} onClick={() => run(t.id, "mark_paying", {}, "לסמן כמשלם/ת ידנית (בלי הוראת קבע ב-Sumit)?")} className="rounded-full border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">סימון משלם/ת ידני</button>
                      <button disabled={isBusy} onClick={() => run(t.id, "archive", {}, `להעביר את ${t.full_name} לארכיון עכשיו? הפרופיל יפסיק להופיע להורים.`)} className={btn}>לארכיון</button>
                    </>
                  )}
                  {t.listing_state === "paying" && !activeSumit && (
                    <button disabled={isBusy} onClick={() => run(t.id, "revoke_paying", {}, "להסיר את הסימון כמשלם/ת?")} className={btn}>הסרת סימון משלם/ת</button>
                  )}
                  {activeSumit && (
                    <button disabled={isBusy} onClick={() => run(t.id, "cancel_subscription", {}, `לבטל את הוראת הקבע ${t.sumit_recurring_id} ב-Sumit? ${left != null && left > 0 ? "המורה יחזור/תחזור לניסיון עד סופו." : "המורה יעבור/תעבור לארכיון."}`)} className="rounded-full border border-red-200 px-3 py-1 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">ביטול הוראת קבע</button>
                  )}
                  {(t.remedial || remedialOk) && (
                    <button disabled={isBusy} onClick={() => run(t.id, "set_remedial", { remedial: !t.remedial })} className={btn} title="מסומן = מוצע גם להמלצות של הוראה מתקנת">
                      {t.remedial ? "הסרת סימון הוראה מתקנת" : "סימון הוראה מתקנת"}
                    </button>
                  )}
                  {t.has_certificate && <button onClick={() => openCert(t)} className={btn}>תעודה ↗</button>}
                  {t.slug && (t.listing_state === "trial" || t.listing_state === "paying") && !paused && (
                    <a href={`/learning/t/${encodeURIComponent(t.slug)}`} target="_blank" rel="noopener noreferrer" className={btn}>פרופיל ↗</a>
                  )}
                  <button onClick={() => copy(t.edit_url)} className={btn} title="הקישור האישי של המורה לפרופיל. מי שמחזיק בו יכול לערוך את הפרופיל.">העתקת הקישור האישי</button>
                  {(t.listing_state === "trial" || t.listing_state === "archived") && !activeSumit && (
                    <button onClick={() => copy(t.pay_url)} className={btn}>העתקת קישור ההרשמה לתשלום</button>
                  )}
                  {t.trial_ends_at && (t.listing_state === "trial" || t.listing_state === "paying") && (
                    <button disabled={isBusy} onClick={() => run(t.id, "resend_approval", {}, "לשלוח שוב את מייל האישור?")} className={btn}>מייל אישור שוב</button>
                  )}
                  <a href={gmailSearchUrl(t.email)} target="_blank" rel="noopener noreferrer" className={btn}>ג'ימייל ↗</a>
                  <button onClick={() => { const next = open ? null : t.id; setOpenId(next); setNewNote(""); if (next) loadNotes(next); }} className={btn}>{open ? "סגירה" : "פרטים והיסטוריה"}</button>
                  <button disabled={isBusy} onClick={() => remove(t)} className="ms-auto rounded-full px-3 py-1 text-xs font-bold text-red-400 hover:bg-red-50 disabled:opacity-50">מחיקה</button>
                </div>

                {open && (
                  <div className="mt-3 grid gap-3 rounded-xl bg-stone-50 p-3 text-xs sm:grid-cols-2">
                    <div className="space-y-1 text-stone-600">
                      <div><b>מייל:</b> {t.email} · <b>טלפון:</b> {t.phone || "-"}</div>
                      <div><b>שפות:</b> {t.languages?.join(", ")} · <b>מחיר:</b> {t.price_text || "-"}</div>
                      <div><b>הצהרת היעדר הרשעה:</b> {t.declared_no_record ? "כן" : "לא"} · <b>מקור:</b> {t.signup_source}</div>
                      {t.bio && <div className="whitespace-pre-line rounded-lg bg-white p-2 text-stone-700">{t.bio}</div>}
                      <div className="text-stone-400">
                        פנייה אחרונה: {fmtDate(t.stats?.last_contact_at ?? null)} · הופעות סה"כ {t.stats?.impressions_total ?? 0} · צפיות בפרופיל ב-30 יום {t.stats?.profile_views_30d ?? 0}
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 font-bold text-stone-600">היסטוריה והערות</div>
                      <div className="mb-2 flex gap-1.5">
                        <input value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="הערה פנימית חדשה" className="min-w-0 flex-1 rounded-lg border border-stone-200 px-2 py-1 text-xs" />
                        <button disabled={isBusy || !newNote.trim()} onClick={() => addNote(t.id)} className={btn}>הוספה</button>
                      </div>
                      <div className="max-h-48 space-y-1 overflow-y-auto">
                        {(notes[t.id] ?? []).length === 0 && <div className="text-stone-400">אין רשומות.</div>}
                        {(notes[t.id] ?? []).map((n) => (
                          <div key={n.id} className="rounded-lg bg-white p-2 text-stone-700">
                            <span className="text-stone-400">{fmtDate(n.created_at)} · {n.author === "admin" ? "הערה" : "מערכת"}: </span>
                            {n.body}
                          </div>
                        ))}
                      </div>
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
