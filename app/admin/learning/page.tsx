"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import HelpTip from "../components/HelpTip";
import { gmailSearchUrl } from "@/app/lib/crm";
import { ALL_REGIONS, CITY_TO_REGION } from "@/app/lib/regions";
import { MISSING_ITEMS, type MissingKey } from "@/app/lib/teacher-care";
import {
  TEACHER_FREE_LISTING,
  TEACHER_LISTING_STATES,
  TEACHER_SUBJECTS,
  expertiseLabel,
  focusesBySubject,
  gradeGroupLabel,
  lessonSettingsText,
  listingStateLabel,
  qualificationAllowsRemedial,
  qualificationLabel,
  qualificationNeedsCertificate,
  subjectLabel,
} from "@/app/lib/teacher-options";
import EditTeacherModal from "./EditTeacherModal";
import TeacherCrmPanel from "./TeacherCrmPanel";
import { btn, btnDanger, btnGold, btnPrimary, daysSince, fmtDate, getJson, inputCls, patchTeacher, type CareDraft, type Teacher } from "./shared";

// רשימת המורים של ענף לימוד חכם: לשוניות, חיפוש ומסננים, וכרטיס לכל מורה
// עם אותם אלמנטים כמו אצל המטפלים (הבעלים, 6/11/2026: "באותו אופן בדיוק"):
// מספרים לפי חלון, מד שלמות ומה חסר, הטיוטות שהמערכת הכינה (עריכה ושליחה
// בלחיצה), עריכת הפרופיל, הודעה חופשית, העלאת תמונה ותעודה, הקפאה, ארכיון,
// ופס CRM (ציר זמן, הערות, משימות). המודל חינמי: אין כאן תשלום בכלל.

const TABS: { key: string; label: string; states?: string[] }[] = [
  { key: "care", label: "דורש טיפול" },
  { key: "pending", label: "ממתינים לאישור", states: ["pending"] },
  { key: "listed", label: "מוצגים", states: ["trial", "paying"] },
  { key: "archived", label: "ארכיון", states: ["archived"] },
  { key: "rejected", label: "נדחו", states: ["rejected"] },
  { key: "all", label: "הכול", states: TEACHER_LISTING_STATES.map((s) => s.key) },
];
const DRAFT_LABELS: Record<string, string> = { certificate_request: "בקשת תעודה", photo_request: "בקשת תמונה", profile_completion: "השלמת פרופיל", founding_note: "מייל למורים הראשונים" };
const MISSING_KEYS = Object.keys(MISSING_ITEMS) as MissingKey[];

const needsCare = (t: Teacher) => t.drafts.length > 0 || !!t.care.hint || (t.listing_state === "pending" && daysSince(t.created_at) >= 3);

function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

export default function LearningTeachersPage() {
  const [rows, setRows] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("care");
  const [q, setQ] = useState("");
  const [fSubject, setFSubject] = useState("");
  const [fRegion, setFRegion] = useState("");
  const [fRemedial, setFRemedial] = useState(false);
  const [fMissing, setFMissing] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [win, setWin] = useState<"30" | "total">("30");
  const [busy, setBusy] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [messaging, setMessaging] = useState<Teacher | null>(null);
  const [draftEdits, setDraftEdits] = useState<Record<string, { subject: string; body: string }>>({});

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    getJson<{ teachers: Teacher[] }>("/api/admin-teachers")
      .then((j) => (j.ok ? setRows(j.teachers) : setError(j.error || "שגיאה בטעינה")))
      .catch(() => setError("שגיאה בטעינה"))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    load();
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t && TABS.some((x) => x.key === t)) setTab(t);
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { care: rows.filter(needsCare).length };
    for (const t of TABS) if (t.states) c[t.key] = rows.filter((r) => t.states!.includes(r.listing_state)).length;
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const def = TABS.find((t) => t.key === tab);
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (def?.states && !def.states.includes(r.listing_state)) return false;
      if (tab === "care" && !needsCare(r)) return false;
      if (term && !`${r.full_name} ${r.email} ${r.phone ?? ""}`.toLowerCase().includes(term)) return false;
      if (fSubject && !r.subjects.includes(fSubject)) return false;
      if (fRegion === "אונליין" ? !r.online : fRegion && !r.regions.some((c) => (CITY_TO_REGION[c] ?? c) === fRegion)) return false;
      if (fRemedial && !r.remedial) return false;
      if (fMissing && !r.care.missing.includes(fMissing as MissingKey)) return false;
      return true;
    });
  }, [rows, tab, q, fSubject, fRegion, fRemedial, fMissing]);
  const hasFilter = !!(q || fSubject || fRegion || fRemedial || fMissing);

  async function act(id: string, action: string, extra: Record<string, unknown> = {}) {
    setBusy(id);
    try {
      const r = await patchTeacher(id, action, extra);
      if (!r.ok) return r;
      if (r.mail && r.mail.status !== "sent") alert(`הפעולה בוצעה, אבל המייל לא נשלח: ${r.mail.status}${r.mail.error ? ` (${r.mail.error})` : ""}`);
      load();
      return r;
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
    const text = sendEmail ? `לאשר את ${t.full_name} ולהציג אותו/ה להורים? יישלח מייל אישור עם הקישור האישי.` : `לאשר את ${t.full_name} בלי לשלוח מייל?`;
    if (!confirm(text)) return;
    let r = await act(t.id, "approve", { send_email: sendEmail });
    if (!r.ok && !t.has_certificate && qualificationNeedsCertificate(t.qualification) && confirm(`${r.error}\n\nלאשר בכל זאת, בלי תעודה?`)) {
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
    if (!confirm(`למחוק את ${t.full_name} לצמיתות, כולל הקבצים וההיסטוריה?`)) return;
    setBusy(t.id);
    try {
      const r = await fetch(`/api/admin-teachers?id=${encodeURIComponent(t.id)}`, { method: "DELETE" });
      const j = await r.json().catch(() => null);
      if (!j?.ok) alert(j?.error || `המחיקה נכשלה (${r.status})`);
      load();
    } finally {
      setBusy(null);
    }
  }
  async function openCert(t: Teacher) {
    const j = await getJson<{ url: string }>(`/api/admin-teachers?cert_for=${encodeURIComponent(t.id)}`);
    if (!j.ok) return alert(j.error || "אין תעודה");
    window.open(j.url, "_blank", "noopener");
  }
  async function upload(t: Teacher, type: "photo" | "certificate") {
    const file = await pickFile(type === "photo" ? "image/*" : "application/pdf,image/jpeg,image/png");
    if (!file) return;
    setBusy(t.id);
    try {
      const fd = new FormData();
      fd.set("id", t.id);
      fd.set("type", type);
      fd.set("file", file);
      const r = await fetch("/api/admin-teachers/upload", { method: "POST", body: fd });
      const j = await r.json().catch(() => null);
      if (!j?.ok) alert(j?.error || (r.status === 413 ? "הקובץ גדול מדי להעלאה מכאן. אפשר לבקש מהמורה להעלות מהקישור האישי." : `ההעלאה נכשלה (${r.status})`));
      load();
    } finally {
      setBusy(null);
    }
  }
  async function sendDraft(t: Teacher, d: CareDraft) {
    const e = draftEdits[d.id] ?? { subject: d.payload.subject, body: d.payload.body };
    if (!confirm(`לשלוח ל-${t.full_name} את המייל "${e.subject}"?`)) return;
    const r = await act(t.id, "draft_send", { draft_id: d.id, subject: e.subject, body: e.body });
    if (!r.ok) alert(r.error);
  }
  const copy = (text: string) => navigator.clipboard?.writeText(text).then(() => alert("הועתק"));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-1 flex items-center gap-2">
        <h1 className="text-2xl font-black text-stone-900">מורים</h1>
        <HelpTip id="teachers" />
      </div>
      <p className="mb-4 text-sm text-stone-500">
        {TEACHER_FREE_LISTING ? "המאגר חינם למורים, בלי מחיר עתידי. אישור מציג את המורה להורים בלי תאריך סיום. " : ""}
        תעודה נדרשת ונבדקת רק להכשרה בהוראה מתקנת, בחינוך מיוחד או בלקויות למידה; שאר הפרטים לפי הצהרת המורה.
      </p>

      {/* מסננים, כמו אצל המטפלים */}
      <div className="mb-4 rounded-2xl border border-stone-200 bg-white p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => setShowFilters(!showFilters)} className="text-sm font-bold text-stone-700 hover:text-stone-900">
              {showFilters ? "▾ סגירת מסננים" : "▸ מסננים"}
            </button>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-stone-400">📊 מדדים:</span>
              {(["30", "total"] as const).map((k) => (
                <button key={k} type="button" onClick={() => setWin(k)} className={`rounded-full px-2.5 py-0.5 font-bold ${win === k ? "bg-stone-800 text-white" : "border border-stone-300 text-stone-500 hover:bg-stone-50"}`}>
                  {k === "30" ? "30 יום" : "סה״כ"}
                </button>
              ))}
            </div>
          </div>
          {hasFilter && (
            <button type="button" onClick={() => { setQ(""); setFSubject(""); setFRegion(""); setFRemedial(false); setFMissing(""); }} className="text-xs text-red-500 hover:underline">
              ניקוי הכול
            </button>
          )}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש לפי שם, מייל או טלפון" className={inputCls} />
        {showFilters && (
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            <select value={fSubject} onChange={(e) => setFSubject(e.target.value)} className={inputCls}>
              <option value="">כל התחומים</option>
              {TEACHER_SUBJECTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <select value={fRegion} onChange={(e) => setFRegion(e.target.value)} className={inputCls}>
              <option value="">כל האזורים</option>
              {ALL_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              <option value="אונליין">אונליין</option>
            </select>
            <select value={fMissing} onChange={(e) => setFMissing(e.target.value)} className={inputCls}>
              <option value="">שלמות הפרופיל: הכול</option>
              {MISSING_KEYS.map((k) => <option key={k} value={k}>חסר: {MISSING_ITEMS[k].label.split(" (")[0]}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input type="checkbox" checked={fRemedial} onChange={(e) => setFRemedial(e.target.checked)} /> רק הוראה מתקנת
            </label>
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)} className={`rounded-full border px-3 py-1.5 text-sm font-bold ${tab === t.key ? "border-stone-800 bg-stone-800 text-white" : "border-stone-200 bg-white text-stone-600 hover:bg-stone-100"}`}>
            {t.label} ({counts[t.key] ?? rows.length})
          </button>
        ))}
      </div>

      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading && rows.length === 0 && <p className="text-sm text-stone-400">טוען...</p>}
      {!loading && visible.length === 0 && (
        <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center text-sm text-stone-400">
          {tab === "care" ? "אין כרגע משהו שדורש טיפול." : "אין מורים בסינון הזה."}
        </div>
      )}

      <div className="space-y-3">
        {visible.map((t) => {
          const st = TEACHER_LISTING_STATES.find((s) => s.key === t.listing_state);
          const open = openId === t.id;
          const listed = t.listing_state === "trial" || t.listing_state === "paying";
          const remedialOk = qualificationAllowsRemedial(t.qualification);
          const paused = !!t.paused_until && new Date(t.paused_until) > new Date();
          const isBusy = busy === t.id;
          const contacts = win === "30" ? t.stats.contacts_30d : t.stats.contacts_total;
          const impressions = win === "30" ? t.stats.impressions_30d : t.stats.impressions_total;
          const pct = Math.round((t.care.done / t.care.total) * 100);
          return (
            <div key={t.id} className="rounded-2xl border border-stone-200 bg-white p-4">
              <div className="flex flex-wrap items-start gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.photo_url || (t.gender === "נקבה" ? "/avatar-female.svg" : "/avatar-male.svg")} alt="" className="h-16 w-16 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-black text-stone-900">{t.full_name}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${st?.cls ?? ""}`}>{listingStateLabel(t.listing_state)}</span>
                    {t.remedial && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">הוראה מתקנת</span>}
                    {paused && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-bold text-stone-600">❄️ מוקפא/ת עד {fmtDate(t.paused_until)}</span>}
                    {qualificationNeedsCertificate(t.qualification)
                      ? t.has_certificate
                        ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">✓ תעודה</span>
                        : <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">חסרה תעודה</span>
                      : <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-bold text-stone-500">לפי הצהרה</span>}
                    {t.care.hint === "hinted" && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">כותב/ת על הוראה מתקנת, בלי תעודה</span>}
                  </div>
                  <div className="mt-1 text-xs text-stone-600">
                    {t.subjects.map(subjectLabel).join(", ")} · {t.grade_groups.map(gradeGroupLabel).join(", ")} · {t.regions.join(", ") || (t.online ? "אונליין" : "-")}
                    {t.online && t.regions.length ? " · גם אונליין" : ""}
                  </div>
                  <div className="mt-0.5 text-xs text-stone-500">
                    {qualificationLabel(t.qualification)}
                    {t.institution ? ` (${t.institution}${t.qualification_year ? `, ${t.qualification_year}` : ""})` : ""}
                    {t.experience_years != null ? ` · ${t.experience_years} שנות ניסיון` : ""}
                    {t.price_text ? ` · ${t.price_text}` : ""}
                  </div>
                  <div className="mt-0.5 text-xs text-stone-400">
                    נרשם/ה {fmtDate(t.created_at)}
                    {t.signup_utm_source ? ` · ${t.signup_utm_source}` : t.signup_channel ? ` · ${t.signup_channel}` : ""}
                    {t.approved_at && ` · אושר/ה ${fmtDate(t.approved_at)}`}
                    {t.archived_at && t.listing_state === "archived" && ` · בארכיון מ-${fmtDate(t.archived_at)}`}
                    {t.reject_reason && ` · סיבת דחייה: ${t.reject_reason}`}
                  </div>
                  {/* מד שלמות: מה חסר, בלשון של המורה */}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="inline-flex h-1.5 w-24 overflow-hidden rounded-full bg-stone-100"><span className="bg-[#3D8C8A]" style={{ width: `${pct}%` }} /></span>
                    <span className="font-bold text-stone-600">פרופיל מלא ב-{t.care.done} מתוך {t.care.total}</span>
                    {t.care.missing.map((k) => (
                      <span key={k} className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-500">חסר: {MISSING_ITEMS[k].label.split(" (")[0]}</span>
                    ))}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-black text-stone-800">{contacts}</div>
                  <div className="text-[11px] text-stone-400">פניות {win === "30" ? "ב-30 יום" : "סה״כ"}</div>
                  <div className="mt-1 text-xs text-stone-500">{impressions} חשיפות · {t.stats.profile_views_30d} צפיות בפרופיל</div>
                  {impressions > 0 && <div className="text-[11px] text-stone-400">{Math.round((contacts / impressions) * 100)}% המרה</div>}
                </div>
              </div>

              {/* הטיוטות שהמערכת הכינה: עריכה ושליחה בלחיצה */}
              {t.drafts.length > 0 && (
                <div className="mt-3 space-y-2">
                  {t.drafts.map((d) => {
                    const e = draftEdits[d.id] ?? { subject: d.payload.subject, body: d.payload.body };
                    const setE = (patch: Partial<typeof e>) => setDraftEdits((prev) => ({ ...prev, [d.id]: { ...e, ...patch } }));
                    return (
                      <div key={d.id} className="rounded-xl border border-[#F0D9A8] bg-[#FDF6E3] p-3">
                        <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-black text-[#A87010]">טיוטה: {DRAFT_LABELS[d.action_type] ?? d.action_type}</span>
                          <span className="text-stone-500">{d.title}</span>
                          <span className="ms-auto text-stone-400">הוכנה {fmtDate(d.created_at)}</span>
                        </div>
                        <input value={e.subject} onChange={(ev) => setE({ subject: ev.target.value })} className={`${inputCls} mb-1.5 text-xs font-bold`} />
                        <textarea value={e.body} onChange={(ev) => setE({ body: ev.target.value })} rows={6} className={`${inputCls} text-xs leading-5`} />
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button type="button" disabled={isBusy} onClick={() => sendDraft(t, d)} className={btnGold}>שליחה ל-{t.full_name}</button>
                          <button type="button" disabled={isBusy} onClick={() => run(t.id, "draft_dismiss", { draft_id: d.id }, "לדחות את הטיוטה? היא לא תחזור 30 יום.")} className={btn}>דחיית הטיוטה</button>
                          <span className="self-center text-[11px] text-stone-400">הברכה, הקישור האישי והחתימה &quot;צוות לימוד חכם&quot; נוספים אוטומטית.</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {(t.listing_state === "pending" || t.listing_state === "rejected") && (
                  <>
                    <button type="button" disabled={isBusy} onClick={() => approve(t, true)} className={btnPrimary}>✓ אישור + מייל</button>
                    <button type="button" disabled={isBusy} onClick={() => approve(t, false)} className={btn}>אישור בלי מייל</button>
                  </>
                )}
                {t.listing_state === "archived" && (
                  <button type="button" disabled={isBusy} onClick={() => run(t.id, "approve", { send_email: false }, `להחזיר את ${t.full_name} למאגר?`)} className={btnPrimary}>החזרה למאגר</button>
                )}
                {(t.listing_state === "pending" || listed) && (
                  <button type="button" disabled={isBusy} onClick={() => reject(t)} className={btnDanger}>דחייה</button>
                )}
                {listed && (
                  <>
                    <button type="button" disabled={isBusy} onClick={() => run(t.id, "unapprove", {}, `להחזיר את ${t.full_name} לממתינים? הפרופיל יירד מהמאגר בלי מייל.`)} className={btn}>החזרה לממתינים</button>
                    {paused ? (
                      <button type="button" disabled={isBusy} onClick={() => run(t.id, "unpause")} className={btn}>שחרור הקפאה</button>
                    ) : (
                      <button type="button" disabled={isBusy} onClick={() => { const d = Number(prompt("להקפיא לכמה ימים? (לא מוצג/ת להורים, בלי הודעה למורה)", "14")); if (d > 0) void run(t.id, "pause", { days: d }); }} className={btn}>❄️ הקפאה</button>
                    )}
                    <button type="button" disabled={isBusy} onClick={() => run(t.id, "archive", {}, `להעביר את ${t.full_name} לארכיון? הפרופיל יפסיק להופיע להורים.`)} className={btn}>ארכיון</button>
                  </>
                )}
                {(t.remedial || remedialOk) && (
                  <button type="button" disabled={isBusy} onClick={() => run(t.id, "set_remedial", { remedial: !t.remedial })} className={btn} title="מסומן = מוצע גם להמלצות של הוראה מתקנת">
                    {t.remedial ? "הסרת סימון הוראה מתקנת" : "סימון הוראה מתקנת"}
                  </button>
                )}
                <button type="button" disabled={isBusy} onClick={() => setEditing(t)} className={btn}>✏️ עריכה</button>
                <button type="button" disabled={isBusy} onClick={() => setMessaging(t)} className={btn}>✉️ הודעה</button>
                <button type="button" disabled={isBusy} onClick={() => upload(t, "photo")} className={btn}>{t.has_photo ? "החלפת תמונה" : "העלאת תמונה"}</button>
                <button type="button" disabled={isBusy} onClick={() => upload(t, "certificate")} className={btn}>{t.has_certificate ? "החלפת תעודה" : "העלאת תעודה"}</button>
                {t.has_certificate && <button type="button" onClick={() => openCert(t)} className={btn}>תעודה ↗</button>}
                {t.slug && listed && !paused && (
                  <a href={`/learning/t/${encodeURIComponent(t.slug)}?from=admin`} target="_blank" rel="noopener noreferrer" className={btn}>פרופיל ↗</a>
                )}
                <button type="button" onClick={() => copy(t.edit_url)} className={btn} title="הקישור האישי של המורה. מי שמחזיק בו יכול לערוך את הפרופיל.">העתקת הקישור האישי</button>
                {listed && <button type="button" disabled={isBusy} onClick={() => run(t.id, "resend_approval", {}, "לשלוח שוב את מייל האישור?")} className={btn}>מייל אישור שוב</button>}
                <a href={gmailSearchUrl(t.email)} target="_blank" rel="noopener noreferrer" className={btn}>ג׳ימייל ↗</a>
                <button type="button" onClick={() => setOpenId(open ? null : t.id)} className={btn}>{open ? "סגירה" : "פרטים והיסטוריה"}</button>
                <button type="button" disabled={isBusy} onClick={() => remove(t)} className="ms-auto rounded-full px-3 py-1 text-xs font-bold text-red-400 hover:bg-red-50 disabled:opacity-50">מחיקה</button>
              </div>

              {open && (
                <>
                  <div className="mt-3 grid gap-1 rounded-xl bg-stone-50 p-3 text-xs text-stone-600 sm:grid-cols-2">
                    <div><b>מייל:</b> {t.email} · <b>טלפון:</b> {t.phone || "-"}</div>
                    <div><b>שפות:</b> {t.languages?.join(", ")} · <b>שיעור:</b> {lessonSettingsText(t) || "-"}</div>
                    <div><b>ניסיון מוצהר:</b> {(t.expertise ?? []).map((k) => expertiseLabel(k, true)).join(", ") || "-"}</div>
                    <div><b>מוקדי הוראה:</b> {focusesBySubject(t.subjects, t.focuses ?? []).map((g) => `${g.label}: ${g.focuses.join(", ")}`).join("; ") || "-"}</div>
                    <div><b>הצהרת היעדר הרשעה:</b> {t.declared_no_record ? "כן" : "לא"} · <b>מקור:</b> {t.signup_source}{t.signup_utm_campaign ? ` · ${t.signup_utm_campaign}` : ""}</div>
                    <div><b>פנייה אחרונה:</b> {fmtDate(t.stats.last_contact_at)}</div>
                    {t.bio && <div className="whitespace-pre-line rounded-lg bg-white p-2 text-stone-700 sm:col-span-2">{t.bio}</div>}
                  </div>
                  <TeacherCrmPanel teacherId={t.id} teacherName={t.full_name} email={t.email} onChange={load} />
                </>
              )}
            </div>
          );
        })}
      </div>

      {editing && <EditTeacherModal teacher={editing} onClose={() => setEditing(null)} onSaved={load} />}
      {messaging && <MessageModal teacher={messaging} onClose={() => setMessaging(null)} onSent={load} />}
    </div>
  );
}

/** הודעה חופשית למורה, כמו "שלח הודעה" אצל המטפלים. הקישור האישי והחתימה נוספים אוטומטית. */
function MessageModal({ teacher, onClose, onSent }: { teacher: Teacher; onClose: () => void; onSent: () => void }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  async function send() {
    if (!subject.trim() || !body.trim()) return alert("צריך נושא ותוכן");
    if (!confirm(`לשלוח ל-${teacher.full_name} (${teacher.email})?`)) return;
    setBusy(true);
    try {
      const r = await patchTeacher(teacher.id, "send_message", { subject: subject.trim(), body: body.trim() });
      if (!r.ok) return alert(r.error || "השליחה נכשלה");
      onSent();
      onClose();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="fixed inset-0 z-[120] overflow-y-auto bg-black/40 p-4" dir="rtl" onClick={onClose}>
      <div className="mx-auto my-10 max-w-xl rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-1 text-lg font-black text-stone-900">הודעה ל-{teacher.full_name}</h2>
        <p className="mb-4 text-xs text-stone-500">נשלחת מ-noreply, עם &quot;שלום {teacher.full_name.split(" ")[0]},&quot; בפתיחה, הקישור האישי בסוף וחתימת &quot;צוות לימוד חכם&quot;. נרשמת בציר הזמן.</p>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="נושא" className={`${inputCls} mb-2`} />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} placeholder="תוכן ההודעה. שורה ריקה מפרידה בין פסקאות." className={inputCls} />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btn}>ביטול</button>
          <button type="button" disabled={busy} onClick={send} className={btnPrimary}>{busy ? "שולח..." : "שליחה"}</button>
        </div>
      </div>
    </div>
  );
}
