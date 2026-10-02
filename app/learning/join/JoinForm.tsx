"use client";

import { useState } from "react";
import { getAttribution } from "@/app/lib/attribution";
import { usePageView } from "@/app/lib/useTrack";
import TeacherProfileFields, { EMPTY_TEACHER_FORM, toApiPayload, type TeacherForm } from "../TeacherProfileFields";

// טופס ההצטרפות: שמירה (JSON) ואז העלאת תעודה ותמונה לפי הטוקן שחזר. בלי
// חשבון - הטוקן הוא הקישור האישי, ומוצג על המסך בסיום (עד שתבנית מייל
// האישור תאושר, המסך הוא המקום היחיד שהמורה רואה אותו).

export default function JoinForm() {
  usePageView("learning-join", "teacher");
  const [form, setForm] = useState<TeacherForm>(EMPTY_TEACHER_FORM);
  const [cert, setCert] = useState<File | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [noRecord, setNoRecord] = useState(false);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ token: string; existing: boolean; uploads: string[] } | null>(null);

  async function upload(token: string, type: "certificate" | "photo", file: File): Promise<string | null> {
    const fd = new FormData();
    fd.append("token", token);
    fd.append("type", type);
    fd.append("file", file);
    try {
      const r = await fetch("/api/teachers/upload", { method: "POST", body: fd });
      const j = await r.json();
      return j.ok ? null : `${type === "certificate" ? "התעודה" : "התמונה"}: ${j.error || "ההעלאה נכשלה"}`;
    } catch {
      return `${type === "certificate" ? "התעודה" : "התמונה"}: ההעלאה נכשלה`;
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.subjects.length === 0) return setError("יש לבחור לפחות תחום הוראה אחד");
    if (form.grade_groups.length === 0) return setError("יש לבחור לפחות שכבת גיל אחת");
    if (!form.qualification) return setError("יש לבחור הכשרה");
    if (!form.online && form.regions.length === 0) return setError("יש לבחור לפחות עיר אחת, או לסמן אונליין");
    if (!cert) return setError("יש לצרף תעודה או אישור הכשרה (PDF / תמונה)");
    if (!noRecord || !terms) return setError("יש לאשר את שתי ההצהרות");
    setBusy(true);
    try {
      const res = await fetch("/api/teachers/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...toApiPayload(form), declared_no_record: true, accepted_terms: true, ...(getAttribution() ?? {}) }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "השמירה נכשלה");
      const uploads: string[] = [];
      if (!j.existing) {
        const c = await upload(j.token, "certificate", cert);
        if (c) uploads.push(c);
        if (photo) {
          const p = await upload(j.token, "photo", photo);
          if (p) uploads.push(p);
        }
      }
      setDone({ token: j.token, existing: !!j.existing, uploads });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    const editUrl = `${window.location.origin}/learning/edit/${encodeURIComponent(done.token)}`;
    return (
      <section className="rounded-3xl border border-[var(--teal-mid)] bg-[var(--teal-pale)] p-6 sm:p-8">
        <h2 className="mb-3 text-2xl font-black text-[var(--teal-dark)]">{done.existing ? "הפרופיל שלך כבר קיים" : "ההרשמה נקלטה"}</h2>
        <p className="mb-4 leading-7 text-[var(--text)]">
          {done.existing
            ? "כבר קיים פרופיל עם המייל הזה. הנה הקישור האישי שלו:"
            : "נאמת את ההכשרה מול התעודה שצירפת, ונעדכן במייל כשהפרופיל יאושר ויתחיל להופיע להורים. בינתיים, זה הקישור האישי שלך לעדכון הפרופיל ולצפייה בנתונים - הוא מחליף סיסמה, שמרו אותו:"}
        </p>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <code className="flex-1 overflow-x-auto rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-xs" dir="ltr">{editUrl}</code>
          <button type="button" onClick={() => navigator.clipboard?.writeText(editUrl)} className="rounded-full border border-[var(--teal)] px-4 py-2 text-sm font-bold text-[var(--teal-dark)]">
            העתקה
          </button>
        </div>
        <a href={editUrl} className="inline-block rounded-full bg-[var(--teal)] px-6 py-2.5 text-sm font-bold text-white">לפרופיל שלי ←</a>
        {done.uploads.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            {done.uploads.join(" · ")} - אפשר להעלות שוב מתוך הפרופיל.
          </div>
        )}
      </section>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6 rounded-3xl border border-[var(--line)] bg-white p-6 sm:p-8">
      <h2 className="text-xl font-black text-[var(--text)]">טופס הצטרפות</h2>
      <TeacherProfileFields form={form} setForm={setForm} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-bold text-[var(--text-2)]">תעודה / אישור הכשרה * <span className="font-normal text-[var(--muted)]">(PDF, JPG, PNG; לא מוצג להורים)</span></label>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setCert(e.target.files?.[0] ?? null)} className="text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-bold text-[var(--text-2)]">תמונה <span className="font-normal text-[var(--muted)]">(מומלץ; מוצגת להורים)</span></label>
          <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} className="text-sm" />
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 text-sm leading-6">
        <label className="flex items-start gap-2">
          <input type="checkbox" className="mt-1" checked={noRecord} onChange={(e) => setNoRecord(e.target.checked)} />
          <span>אני מצהיר/ה שאין לי הרשעה פלילית, ואין מניעה חוקית לעבודתי עם קטינים. ידוע לי שהפרופיל יוסר מיד אם יתברר אחרת.</span>
        </label>
        <label className="flex items-start gap-2">
          <input type="checkbox" className="mt-1" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
          <span>
            קראתי ואני מסכים/ה ל<a href="/terms" target="_blank" className="underline">תנאי השימוש</a> ול<a href="/privacy" target="_blank" className="underline">מדיניות הפרטיות</a>. הפרטים שמסרתי נכונים; טיפול חכם רשאית לאמת אותם מול המוסד המעניק. אני מורה עצמאי/ת, וההתקשרות עם ההורים היא ביני לבינם.
          </span>
        </label>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <button type="submit" disabled={busy} className="w-full rounded-full bg-[var(--teal)] px-8 py-4 text-lg font-bold text-white transition hover:bg-[var(--teal-dark)] disabled:opacity-50 sm:w-auto">
        {busy ? "שומרים..." : "הצטרפות - ללא תשלום וללא כרטיס אשראי"}
      </button>
    </form>
  );
}
