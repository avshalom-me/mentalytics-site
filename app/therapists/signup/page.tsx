"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Gender = "זכר" | "נקבה" | "אחר";

const THERAPIST_TYPES = [
  "פסיכולוג קליני",
  "פסיכולוג חינוכי",
  "פסיכולוג שיקומי/רפואי",
  "פסיכולוג התפתחותי",
  "פסיכולוג תעסוקתי",
  'עו"ס קליני',
  "מטפל/ת בהבעה ויצירה",
  "מטפל מיני",
  "קרימינולוג קליני",
] as const;

const TRAINING_AREAS = [
  "טיפול דינאמי",
  "CBT",
  "EMDR",
  "DBT",
  "הדרכת הורים",
  "טיפול דיאדי",
  'טיפול במשחק ודיבור (תנועה/אומנות/בע"ח/מוזיקה)',
  "טיפול תעסוקתי",
  "טיפול זוגי", // <-- כאן השינוי: בלי פירוט בסוגריים
  "טיפול בהתמכרויות",
  "טיפול מיני",
  "טיפול COG-FUN לקשיי קשב וריכוז",
] as const;

const COUPLES_MODALITIES = ["EFT", "דינאמי", "מבני"] as const;

const REGIONS = [
  "איזור הצפון",
  "איזור חיפה",
  "איזור השרון",
  "איזור תל אביב",
  "איזור המרכז (ללא תל אביב)",
  "איזור השפלה",
  "איזור ירושלים",
  "איזור הדרום",
] as const;

const CULTURAL_PREFS = [
  "היכרות עם העולם הדתי",
  "היכרות עם העולם החרדי",
  'היכרות עם עולם הלהט"ב',
  "טיפול בשפה הערבית",
  "טיפול בשפה הרוסית",
  "טיפול בשפה הספרדית",
] as const;

const ARRANGEMENTS = ["קופות החולים", "משרד הביטחון", "ביטוח לאומי", "ביטוחים פרטיים"] as const;

type FormState = {
  fullName: string;
  therapistTypes: string[];
  trainingAreas: string[];
  couplesModalities: string[]; // <-- חדש
  regions: string[]; // עד 2
  online: "כן" | "לא";
  culturalPrefs: string[];
  gender: Gender | "";
  price: string; // טקסט כדי לא להסתבך עם הקלדה
  arrangements: string[];
  certificates: File[];
  profilePhoto: File | null;
};

function toggleInArray(arr: string[], value: string) {
  return arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];
}

export default function TherapistSignupPage() {
  const [form, setForm] = useState<FormState>({
    fullName: "",
    therapistTypes: [],
    trainingAreas: [],
    couplesModalities: [], // <-- חדש
    regions: [],
    online: "לא",
    culturalPrefs: [],
    gender: "",
    price: "",
    arrangements: [],
    certificates: [],
    profilePhoto: null,
  });

  const [submitMsg, setSubmitMsg] = useState<string>("");
  const [errors, setErrors] = useState<string[]>([]);

  const regionLimitReached = useMemo(() => form.regions.length >= 2, [form.regions.length]);

  function validate(): string[] {
    const e: string[] = [];
    if (!form.fullName.trim()) e.push("נא למלא שם מלא.");
    if (form.therapistTypes.length === 0) e.push("נא לבחור לפחות סוג מטפל אחד.");
    if (form.trainingAreas.length === 0) e.push("נא לבחור לפחות תחום הכשרה אחד.");
    if (form.trainingAreas.includes("טיפול זוגי") && form.couplesModalities.length === 0) {
      e.push('בחרת "טיפול זוגי" — נא לבחור לפחות סוג אחד (EFT/דינאמי/מבני).');
    }
    if (form.regions.length === 0) e.push("נא לבחור לפחות אזור אחד (אפשר עד 2).");
    if (!form.gender) e.push("נא לבחור מגדר.");
    if (form.price.trim() && Number.isNaN(Number(form.price))) e.push("מחיר חייב להיות מספר (או להשאיר ריק).");
    return e;
  }

async function onSubmit(e: React.FormEvent) {
  e.preventDefault();
  setSubmitMsg("");
  const eList = validate();
  setErrors(eList);
  if (eList.length > 0) return;

  const fd = new FormData();
  fd.append("fullName", form.fullName);
  fd.append("gender", form.gender);
  fd.append("online", form.online);
  fd.append("price", form.price);

  fd.append("therapistTypes", JSON.stringify(form.therapistTypes));
  fd.append("trainingAreas", JSON.stringify(form.trainingAreas));
  fd.append("couplesModalities", JSON.stringify(form.couplesModalities));
  fd.append("regions", JSON.stringify(form.regions));
  fd.append("culturalPrefs", JSON.stringify(form.culturalPrefs));
  fd.append("arrangements", JSON.stringify(form.arrangements));

  for (const f of form.certificates) fd.append("certificates", f);
  if (form.profilePhoto) fd.append("profilePhoto", form.profilePhoto);

  const res = await fetch("/api/therapists/signup", { method: "POST", body: fd });
  const data = await res.json();

  if (!res.ok || !data.ok) {
    setSubmitMsg("");
    setErrors(data.errors ?? [data.error ?? "שגיאה לא ידועה"]);
    return;
  }

  setErrors([]);
  setSubmitMsg("נשלח בהצלחה! הפרטים נקלטו וממתינים לאישור.");
}
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-6">
        <Link href="/therapists" className="text-sm text-indigo-700 hover:underline">
          ← חזרה לאזור מטפלים
        </Link>
        <h1 className="mt-3 text-3xl font-bold">הרשמה למאגר מטפלים</h1>
        <p className="mt-2 text-slate-600">מלא/י את הפרטים. בהמשך נוסיף אימות תעודות, מסד נתונים ותהליך אישור.</p>
      </div>

      {errors.length > 0 && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <div className="mb-2 font-semibold">יש לתקן:</div>
          <ul className="list-disc pr-5">
            {errors.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      )}

      {submitMsg && (
        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">{submitMsg}</div>
      )}

      <form onSubmit={onSubmit} className="space-y-6">
        {/* 1. שם מלא + מגדר */}
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-bold">פרטים בסיסיים</h2>

          <label className="mt-4 block text-sm font-semibold">
            שם מלא
            <input
              className="mt-2 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200"
              value={form.fullName}
              onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
              placeholder="לדוגמה: ד״ר ישראל ישראלי"
            />
          </label>

          <div className="mt-4">
            <div className="text-sm font-semibold">מגדר</div>
            <div className="mt-2 flex flex-wrap gap-3">
              {(["זכר", "נקבה", "אחר"] as Gender[]).map((g) => (
                <label key={g} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="gender" checked={form.gender === g} onChange={() => setForm((p) => ({ ...p, gender: g }))} />
                  {g}
                </label>
              ))}
            </div>
          </div>
        </section>

        {/* 2. סוג מטפל */}
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-bold">סוג מטפל</h2>
          <p className="mt-1 text-sm text-slate-600">אפשר לבחור כמה.</p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {THERAPIST_TYPES.map((t) => (
              <label key={t} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.therapistTypes.includes(t)}
                  onChange={() => setForm((p) => ({ ...p, therapistTypes: toggleInArray(p.therapistTypes, t) }))}
                />
                <span>{t}</span>
              </label>
            ))}
          </div>
        </section>

        {/* 3. תחומי הכשרה + טיפול זוגי תתי-סוגים */}
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-bold">תחומי הכשרה</h2>
          <p className="mt-1 text-sm text-slate-600">אפשר לבחור כמה.</p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {TRAINING_AREAS.map((t) => (
              <label key={t} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.trainingAreas.includes(t)}
                  onChange={() =>
                    setForm((p) => {
                      const nextTrainingAreas = toggleInArray(p.trainingAreas, t);

                      // אם ביטלו "טיפול זוגי" – לאפס תתי-סוגים
                      const couplesWasChecked = p.trainingAreas.includes("טיפול זוגי");
                      const couplesNowChecked = nextTrainingAreas.includes("טיפול זוגי");
                      const shouldClearCouples = couplesWasChecked && !couplesNowChecked;

                      return {
                        ...p,
                        trainingAreas: nextTrainingAreas,
                        couplesModalities: shouldClearCouples ? [] : p.couplesModalities,
                      };
                    })
                  }
                />
                <span>{t}</span>
              </label>
            ))}
          </div>

          {/* תתי-סוגים לטיפול זוגי – מופיע רק אם נבחר */}
          {form.trainingAreas.includes("טיפול זוגי") && (
            <div className="mt-4 rounded-xl border bg-slate-50 p-4">
              <div className="text-sm font-semibold">סוג הטיפול הזוגי</div>
              <p className="mt-1 text-xs text-slate-600">אפשר לבחור כמה.</p>

              <div className="mt-3 flex flex-wrap gap-4">
                {COUPLES_MODALITIES.map((m) => (
                  <label key={m} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.couplesModalities.includes(m)}
                      onChange={() => setForm((p) => ({ ...p, couplesModalities: toggleInArray(p.couplesModalities, m) }))}
                    />
                    {m}
                  </label>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* 4. אזורים (עד 2) */}
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-bold">אזורי פעילות</h2>
          <p className="mt-1 text-sm text-slate-600">אפשר לבחור עד 2 אזורים.</p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {REGIONS.map((r) => {
              const checked = form.regions.includes(r);
              const disabled = !checked && regionLimitReached;

              return (
                <label key={r} className={`flex items-start gap-2 text-sm ${disabled ? "opacity-50" : ""}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() =>
                      setForm((p) => ({
                        ...p,
                        regions: toggleInArray(p.regions, r).slice(0, 2),
                      }))
                    }
                  />
                  <span>{r}</span>
                </label>
              );
            })}
          </div>

          {regionLimitReached && <p className="mt-3 text-xs text-slate-500">בחרת כבר 2 אזורים. כדי לבחור אזור אחר—בטל אחד.</p>}
        </section>

        {/* 5. אונליין */}
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-bold">אונליין</h2>
          <div className="mt-4 flex gap-4 text-sm">
            {(["כן", "לא"] as const).map((x) => (
              <label key={x} className="flex items-center gap-2">
                <input type="radio" name="online" checked={form.online === x} onChange={() => setForm((p) => ({ ...p, online: x }))} />
                {x}
              </label>
            ))}
          </div>
        </section>

        {/* 6. העדפות תרבותיות/שפה */}
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-bold">העדפות תרבותיות ושפה</h2>
          <p className="mt-1 text-sm text-slate-600">אפשר לבחור כמה.</p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {CULTURAL_PREFS.map((t) => (
              <label key={t} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.culturalPrefs.includes(t)}
                  onChange={() => setForm((p) => ({ ...p, culturalPrefs: toggleInArray(p.culturalPrefs, t) }))}
                />
                <span>{t}</span>
              </label>
            ))}
          </div>
        </section>

        {/* 8. מחיר */}
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-bold">מחיר</h2>
          <label className="mt-4 block text-sm font-semibold">
            מחיר לפגישה (ש״ח)
            <input
              className="mt-2 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200"
              value={form.price}
              onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
              placeholder="לדוגמה: 450"
              inputMode="numeric"
            />
          </label>
          <p className="mt-2 text-xs text-slate-500">אפשר להשאיר ריק בשלב זה.</p>
        </section>

        {/* 9. הסדרים */}
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-bold">הסדרים</h2>
          <p className="mt-1 text-sm text-slate-600">אפשר לסמן כמה.</p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {ARRANGEMENTS.map((t) => (
              <label key={t} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.arrangements.includes(t)}
                  onChange={() => setForm((p) => ({ ...p, arrangements: toggleInArray(p.arrangements, t) }))}
                />
                <span>{t}</span>
              </label>
            ))}
          </div>
        </section>

{/* תמונת פרופיל (אופציונלי) */}
<section className="rounded-2xl border bg-white p-6">
  <h2 className="text-lg font-bold">תמונת פרופיל (אופציונלי)</h2>
  <p className="mt-1 text-sm text-slate-600">
    תמונה מגדילה משמעותית את החשיפה וההיענות של מטופלים.
  </p>

  <input
    id="profilePhoto"
    className="hidden"
    type="file"
    accept=".jpg,.jpeg,.png"
    onChange={(e) =>
      setForm((p) => ({
        ...p,
        profilePhoto: e.target.files?.[0] ?? null,
      }))
    }
  />

  <div className="mt-4 flex flex-wrap items-center gap-3">
    <label
      htmlFor="profilePhoto"
      className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
    >
      בחר תמונה
    </label>

    <button
      type="button"
      className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold hover:shadow"
      onClick={() => setForm((p) => ({ ...p, profilePhoto: null }))}
    >
      נקה תמונה
    </button>

    <span className="text-sm text-slate-500">
      {form.profilePhoto ? `נבחרה: ${form.profilePhoto.name}` : "לא נבחרה תמונה"}
    </span>
  </div>
</section>

{/* העלאת תעודות */}
<section className="rounded-2xl border bg-white p-6">
  <h2 className="text-lg font-bold">העלאת תעודות</h2>
  <p className="mt-1 text-sm text-slate-600">
    ניתן להעלות PDF/JPG/PNG. (מומלץ: עד 10MB לקובץ)
  </p>

  {/* input נסתר */}
  <input
    id="certificates"
    className="hidden"
    type="file"
    multiple
    accept=".pdf,.jpg,.jpeg,.png"
    onChange={(e) =>
      setForm((p) => ({
        ...p,
        certificates: Array.from(e.target.files ?? []),
      }))
    }
  />

  <div className="mt-4 flex flex-wrap items-center gap-3">
    <label
      htmlFor="certificates"
      className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
    >
      בחר קבצים
    </label>

    <button
      type="button"
      className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold hover:shadow"
      onClick={() => setForm((p) => ({ ...p, certificates: [] }))}
    >
      נקה בחירה
    </button>

    <span className="text-sm text-slate-500">
      {form.certificates.length > 0
        ? `נבחרו ${form.certificates.length} קבצים`
        : "לא נבחרו קבצים"}
    </span>
  </div>

  {form.certificates.length > 0 && (
    <ul className="mt-4 list-disc pr-5 text-sm text-slate-600">
      {form.certificates.map((f) => (
        <li key={f.name}>{f.name}</li>
      ))}
    </ul>
  )}
</section>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700">
            שליחת טופס
          </button>
          <span className="text-sm text-slate-500">אחרי שליחה—פתח F12 → Console כדי לראות את הנתונים שנאספו.</span>
        </div>
      </form>
    </main>
  );
}