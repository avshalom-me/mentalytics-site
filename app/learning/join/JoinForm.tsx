"use client";

import { useState } from "react";
import { getAttribution } from "@/app/lib/attribution";
import TeacherProfileFields, { EMPTY_TEACHER_FORM, toApiPayload, type TeacherForm } from "../TeacherProfileFields";
import { uploadTeacherCertificate, uploadTeacherPhoto } from "../teacher-upload-client";
import { teachesInPerson } from "@/app/lib/teacher-options";

// טופס ההצטרפות: שמירה (JSON), ואז העלאת התעודה והתמונה. בלי חשבון - השרת
// מזהה את המורה בעוגייה שהוא שם בתשובת ההרשמה, והקישור האישי נשלח במייל
// ומוצג פעם אחת כאן, במסך הסיום.

type Done = { link: string | null; existing: boolean; uploads: string[] };

export default function JoinForm() {
  const [form, setForm] = useState<TeacherForm>(EMPTY_TEACHER_FORM);
  const [cert, setCert] = useState<File | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [noRecord, setNoRecord] = useState(false);
  const [terms, setTerms] = useState(false);
  // מלכודת לבוטים: שדה שאדם לא רואה ולא ממלא.
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Done | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.subjects.length === 0) return setError("יש לבחור לפחות תחום הוראה אחד");
    if (form.grade_groups.length === 0) return setError("יש לבחור לפחות שכבת גיל אחת");
    if (!form.qualification) return setError("יש לבחור הכשרה");
    if (form.lesson_settings.length === 0) return setError("יש לבחור איפה מתקיים השיעור");
    if (teachesInPerson(form.lesson_settings) && form.regions.length === 0) return setError("יש לבחור לפחות עיר אחת לשיעורים פנים אל פנים");
    if (!cert) return setError("יש לצרף תעודה או אישור הכשרה (PDF או תמונה)");
    if (!noRecord || !terms) return setError("יש לאשר את שתי ההצהרות");
    setBusy(true);
    try {
      const res = await fetch("/api/teachers/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...toApiPayload(form), declared_no_record: true, accepted_terms: true, website, ...(getAttribution() ?? {}) }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "השמירה נכשלה");
      const uploads: string[] = [];
      if (!j.existing) {
        const c = await uploadTeacherCertificate(cert);
        if (c) uploads.push(`התעודה: ${c}`);
        if (photo) {
          const p = await uploadTeacherPhoto(photo);
          if (p) uploads.push(`התמונה: ${p}`);
        }
      }
      setDone({ link: typeof j.link === "string" ? j.link : null, existing: !!j.existing, uploads });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setBusy(false);
    }
  }

  if (done?.existing) {
    return (
      <section className="rounded-3xl border border-[var(--teal-mid)] bg-[var(--teal-pale)] p-6 sm:p-8">
        <h2 className="mb-3 text-2xl font-black text-[var(--teal-dark)]">כבר קיים פרופיל עם המייל הזה</h2>
        <p className="leading-7 text-[var(--text)]">
          שלחנו את הקישור האישי לפרופיל לכתובת המייל הרשומה. אם המייל לא מגיע תוך כמה דקות, כדאי לבדוק בתיקיית הספאם.
          מטעמי אבטחה הקישור נשלח לכל היותר פעם ביממה - אם כבר ביקשת אותו היום, הוא נמצא במייל הקודם.
        </p>
      </section>
    );
  }

  if (done) {
    return (
      <section className="rounded-3xl border border-[var(--teal-mid)] bg-[var(--teal-pale)] p-6 sm:p-8">
        <h2 className="mb-3 text-2xl font-black text-[var(--teal-dark)]">ההרשמה נקלטה</h2>
        <p className="mb-4 leading-7 text-[var(--text)]">
          נאמת את ההכשרה מול התעודה שצירפת, ונעדכן במייל כשהפרופיל יאושר ויתחיל להופיע להורים. שלחנו אליך מייל עם קישור
          אישי לפרופיל. הוא מחליף סיסמה, ולכן כדאי לשמור אותו.
        </p>
        <a href="/learning/me" className="inline-block rounded-full bg-[var(--teal)] px-6 py-2.5 text-sm font-bold text-white">לפרופיל שלי ←</a>
        {done.link && (
          <details className="mt-4 text-sm text-[var(--text-2)]">
            <summary className="cursor-pointer font-bold">המייל לא הגיע? הקישור האישי, להעתקה</summary>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="flex-1 overflow-x-auto rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-xs" dir="ltr">{done.link}</code>
              <button type="button" onClick={() => navigator.clipboard?.writeText(done.link ?? "")} className="rounded-full border border-[var(--teal)] px-4 py-2 text-sm font-bold text-[var(--teal-dark)]">
                העתקה
              </button>
            </div>
          </details>
        )}
        {done.uploads.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
            {done.uploads.map((u) => <p key={u}>{u}</p>)}
            <p className="mt-1 font-bold">אפשר להעלות שוב מתוך הפרופיל. בלי תעודה לא נוכל לאשר אותו.</p>
          </div>
        )}
      </section>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6 rounded-3xl border border-[var(--line)] bg-white p-6 sm:p-8">
      <h2 className="text-xl font-black text-[var(--text)]">טופס הצטרפות</h2>
      <TeacherProfileFields form={form} setForm={setForm} />

      {/* מוסתר מבני אדם ומקוראי מסך; בוט שממלא כל שדה נופל כאן. */}
      <div aria-hidden="true" style={{ position: "absolute", insetInlineStart: "-9999px", width: 1, height: 1, overflow: "hidden" }}>
        <label>
          אתר
          <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="tj-cert" className="mb-1 block text-sm font-bold text-[var(--text-2)]">
            תעודה / אישור הכשרה * <span className="font-normal text-[var(--muted)]">(PDF, JPG, PNG; לא מוצג להורים)</span>
          </label>
          <input id="tj-cert" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setCert(e.target.files?.[0] ?? null)} className="text-sm" />
        </div>
        <div>
          <label htmlFor="tj-photo" className="mb-1 block text-sm font-bold text-[var(--text-2)]">
            תמונה <span className="font-normal text-[var(--muted)]">(מומלץ; מוצגת להורים)</span>
          </label>
          <input id="tj-photo" type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} className="text-sm" />
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
