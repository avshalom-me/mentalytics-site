"use client";

import RegionCityPicker from "@/app/components/RegionCityPicker";
import {
  TEACHER_SUBJECTS,
  TEACHER_GRADE_GROUPS,
  TEACHER_QUALIFICATIONS,
  TEACHER_LANGUAGES,
  TEACHER_EXPERTISE,
  TEACHER_EXPERTISE_MAX,
  TEACHER_FOCUSES,
  TEACHER_LESSON_SETTINGS,
  focusKeysFor,
  teachesInPerson,
  qualificationAllowsRemedial,
} from "@/app/lib/teacher-options";

// שדות הפרופיל של מורה - משותפים לטופס ההצטרפות ולטופס העריכה, כדי שלא
// יהיו שני עותקים שנסחפים זה מזה. הערך המשותף (TeacherForm) הוא בדיוק מה
// ש-/api/teachers/signup ו-/api/teachers/profile מקבלים.

export type TeacherForm = {
  full_name: string;
  email: string;
  phone: string;
  gender: "" | "זכר" | "נקבה";
  subjects: string[];
  /** מוקדי ההוראה בתוך התחומים שסומנו (TEACHER_FOCUSES). */
  focuses: string[];
  remedial: boolean;
  grade_groups: string[];
  /** ניסיון עם מאפייני למידה (TEACHER_EXPERTISE), עד שלושה. */
  expertise: string[];
  /** איפה מתקיים השיעור (TEACHER_LESSON_SETTINGS). "אונליין" נגזר מכאן. */
  lesson_settings: string[];
  regions: string[];
  languages: string[];
  price_text: string;
  bio: string;
  qualification: string;
  institution: string;
  qualification_year: string;
  teaching_certificate: boolean;
  experience_years: string;
};

export const EMPTY_TEACHER_FORM: TeacherForm = {
  full_name: "",
  email: "",
  phone: "",
  gender: "",
  subjects: [],
  focuses: [],
  remedial: false,
  grade_groups: [],
  expertise: [],
  lesson_settings: [],
  regions: [],
  languages: ["עברית"],
  price_text: "",
  bio: "",
  qualification: "",
  institution: "",
  qualification_year: "",
  teaching_certificate: false,
  experience_years: "",
};

export const field = "w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--teal)]";
export const label = "mb-1 block text-sm font-bold text-[var(--text-2)]";

function toggle(arr: string[], v: string): string[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

/** תגית בחירה. אותו מראה כמו תגיות התחומים והשכבות שמעליה. */
function chip(on: boolean, blocked = false): string {
  return `rounded-full border focus-within:ring-2 focus-within:ring-[var(--teal)] px-3 py-1.5 text-sm ${
    on ? "border-[var(--teal)] bg-[var(--teal-pale)] font-bold text-[var(--teal-dark)]" : "border-[var(--line)]"
  } ${blocked ? "cursor-not-allowed opacity-45" : "cursor-pointer"}`;
}

export function toApiPayload(f: TeacherForm) {
  return {
    full_name: f.full_name.trim(),
    email: f.email.trim().toLowerCase(),
    phone: f.phone.trim(),
    gender: f.gender || null,
    subjects: f.subjects,
    // מוקד של תחום שהוסר לא נשלח: הוא כבר לא מוצג בטופס, ואי אפשר לבטל אותו.
    focuses: f.focuses.filter((k) => focusKeysFor(f.subjects).includes(k)),
    remedial: f.remedial,
    grade_groups: f.grade_groups,
    expertise: f.expertise,
    lesson_settings: f.lesson_settings,
    // ערים רק למי שמלמד/ת פנים אל פנים; בחירה שנשארה מוסתרת לא נשמרת.
    regions: teachesInPerson(f.lesson_settings) ? f.regions : [],
    online: f.lesson_settings.includes("online"),
    languages: f.languages.length ? f.languages : ["עברית"],
    price_text: f.price_text.trim() || null,
    bio: f.bio.trim() || null,
    qualification: f.qualification,
    institution: f.institution.trim() || null,
    qualification_year: f.qualification_year ? Number(f.qualification_year) : null,
    teaching_certificate: f.teaching_certificate,
    experience_years: f.experience_years ? Number(f.experience_years) : null,
  };
}

export default function TeacherProfileFields({
  form,
  setForm,
  emailLocked = false,
  qualificationLocked = false,
  remedialVerified = false,
}: {
  form: TeacherForm;
  setForm: (next: TeacherForm) => void;
  /** בעריכה המייל הוא מזהה הרשומה ואינו ניתן לשינוי מהטופס. */
  emailLocked?: boolean;
  /** אחרי האישור ההכשרה היא מה שאומת מול התעודה, ולכן היא נעולה לעריכה. */
  qualificationLocked?: boolean;
  /** הסימון "הוראה מתקנת" כפי שהוא שמור (ואומת). אחרי האישור אפשר רק להסיר אותו. */
  remedialVerified?: boolean;
}) {
  // לפי מה ששמור ולא לפי התיבה עצמה: תיבה שננעלת ברגע שמבטלים אותה לא משאירה
  // דרך להתחרט לפני השמירה.
  const remedialAllowed = qualificationAllowsRemedial(form.qualification) && (!qualificationLocked || remedialVerified);
  const set = (patch: Partial<TeacherForm>) => setForm({ ...form, ...patch });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="tf-name" className={label}>שם מלא *</label>
          <input id="tf-name" autoComplete="name" value={form.full_name} onChange={(e) => set({ full_name: e.target.value })} required className={field} />
        </div>
        <div>
          <label htmlFor="tf-gender" className={label}>מגדר</label>
          <select id="tf-gender" value={form.gender} onChange={(e) => set({ gender: e.target.value as TeacherForm["gender"] })} className={field}>
            <option value="">-- לא לציין --</option>
            <option value="נקבה">נקבה</option>
            <option value="זכר">זכר</option>
          </select>
        </div>
        <div>
          <label htmlFor="tf-email" className={label}>מייל *</label>
          <input id="tf-email" type="email" autoComplete="email" dir="ltr" value={form.email} onChange={(e) => set({ email: e.target.value })} required disabled={emailLocked} className={`${field} disabled:opacity-60`} />
        </div>
        <div>
          <label htmlFor="tf-phone" className={label}>טלפון נייד * <span className="font-normal text-[var(--muted)]">(ההורים פונים בוואטסאפ)</span></label>
          <input id="tf-phone" type="tel" autoComplete="tel" dir="ltr" value={form.phone} onChange={(e) => set({ phone: e.target.value })} required className={field} />
        </div>
      </div>

      <div>
        <div id="tf-subjects" className={label}>תחומי הוראה *</div>
        <div role="group" aria-labelledby="tf-subjects" className="flex flex-wrap gap-2">
          {TEACHER_SUBJECTS.map((s) => (
            <label key={s.key} className={`cursor-pointer rounded-full border focus-within:ring-2 focus-within:ring-[var(--teal)] px-3 py-1.5 text-sm ${form.subjects.includes(s.key) ? "border-[var(--teal)] bg-[var(--teal-pale)] font-bold text-[var(--teal-dark)]" : "border-[var(--line)]"}`}>
              <input type="checkbox" className="sr-only" checked={form.subjects.includes(s.key)} onChange={() => set({ subjects: toggle(form.subjects, s.key) })} />
              {s.label}
            </label>
          ))}
        </div>
      </div>

      {form.subjects.length > 0 && (
        <div>
          <div className={label}>
            מוקדי ההוראה שלך בכל תחום <span className="font-normal text-[var(--muted)]">(מוצג להורים)</span>
          </div>
          <div className="space-y-3">
            {TEACHER_SUBJECTS.filter((s) => form.subjects.includes(s.key)).map((s) => (
              <div key={s.key} role="group" aria-labelledby={`tf-focus-${s.key}`}>
                <div id={`tf-focus-${s.key}`} className="mb-1.5 text-xs font-bold text-[var(--muted)]">{s.label}</div>
                <div className="flex flex-wrap gap-2">
                  {TEACHER_FOCUSES[s.key].map((f) => (
                    <label key={f.key} className={chip(form.focuses.includes(f.key))}>
                      <input type="checkbox" className="sr-only" checked={form.focuses.includes(f.key)} onChange={() => set({ focuses: toggle(form.focuses, f.key) })} />
                      {f.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div id="tf-grades" className={label}>שכבות גיל *</div>
        <div role="group" aria-labelledby="tf-grades" className="flex flex-wrap gap-2">
          {TEACHER_GRADE_GROUPS.map((g) => (
            <label key={g.key} className={`cursor-pointer rounded-full border focus-within:ring-2 focus-within:ring-[var(--teal)] px-3 py-1.5 text-sm ${form.grade_groups.includes(g.key) ? "border-[var(--teal)] bg-[var(--teal-pale)] font-bold text-[var(--teal-dark)]" : "border-[var(--line)]"}`}>
              <input type="checkbox" className="sr-only" checked={form.grade_groups.includes(g.key)} onChange={() => set({ grade_groups: toggle(form.grade_groups, g.key) })} />
              {g.label}
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <label htmlFor="tf-qualification" className={label}>הכשרה *</label>
        {qualificationLocked && (
          <p className="mb-2 text-xs text-[var(--muted)]">ההכשרה אומתה מול התעודה. לשינוי שלה (למשל אחרי השלמת תעודה נוספת) - כתבו לנו.</p>
        )}
        <select
          id="tf-qualification"
          disabled={qualificationLocked}
          value={form.qualification}
          onChange={(e) => {
            const q = e.target.value;
            set({ qualification: q, remedial: form.remedial && qualificationAllowsRemedial(q) });
          }}
          required
          className={field}
        >
          <option value="">-- בחר/י --</option>
          {TEACHER_QUALIFICATIONS.map((q) => (
            <option key={q.key} value={q.key}>{q.label}</option>
          ))}
        </select>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label htmlFor="tf-institution" className={label}>המוסד שהעניק את התעודה / התואר</label>
            <input id="tf-institution" disabled={qualificationLocked} value={form.institution} onChange={(e) => set({ institution: e.target.value })} className={`${field} disabled:opacity-60`} placeholder="למשל: לוינסקי-וינגייט, דוד ילין, בית ברל" />
          </div>
          <div>
            <label htmlFor="tf-year" className={label}>שנת סיום</label>
            <input id="tf-year" disabled={qualificationLocked} inputMode="numeric" value={form.qualification_year} onChange={(e) => set({ qualification_year: e.target.value.replace(/\D/g, "").slice(0, 4) })} className={`${field} disabled:opacity-60`} />
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" disabled={qualificationLocked} checked={form.teaching_certificate} onChange={(e) => set({ teaching_certificate: e.target.checked })} />
            יש לי תעודת הוראה
          </label>
          <div className="flex items-center gap-2 text-sm">
            <label htmlFor="tf-experience">שנות ניסיון בהוראה:</label>
            <input id="tf-experience" inputMode="numeric" value={form.experience_years} onChange={(e) => set({ experience_years: e.target.value.replace(/\D/g, "").slice(0, 2) })} className={`${field} w-20`} />
          </div>
        </div>
        <label className={`mt-3 flex items-start gap-2 text-sm ${remedialAllowed ? "" : "opacity-50"}`}>
          <input type="checkbox" className="mt-1" checked={form.remedial} disabled={!remedialAllowed} onChange={(e) => set({ remedial: e.target.checked })} />
          <span>
            <strong>אני מורה להוראה מתקנת (מותאמת)</strong>
            <span className="block text-xs text-[var(--muted)]">
              {remedialAllowed
                ? qualificationLocked && !form.remedial
                  ? "שמירה בלי הסימון תסיר את הפרופיל מהחיפושים של הוראה מתקנת. החזרת הסימון אחר כך נעשית דרכנו."
                  : "השאלון מפנה להוראה מתקנת כשזוהה קושי ממוקד בקריאה, בכתיבה או בחשבון. הסימון מאומת מול התעודה."
                : qualificationLocked
                  ? "הפרופיל אושר לתגבור פרטי. לרישום כהוראה מתקנת נדרש אימות של תעודה מתאימה - כתבו לנו."
                  : "זמין רק עם תעודת הוראה מתקנת, תואר בחינוך מיוחד או תואר שני בלקויות למידה. עם הכשרה אחרת הפרופיל מוצג לתגבור פרטי."}
            </span>
          </span>
        </label>
      </div>

      <div>
        <div id="tf-expertise" className={label}>עם אילו קשיים יש לך ניסיון ממוקד ומתמשך בהוראה?</div>
        <p className="mb-2 text-xs leading-5 text-[var(--muted)]">
          אפשר לסמן עד שלושה. הסימון מוצג להורים בפרופיל. אם אין מוקד מיוחד, אפשר להשאיר ריק.
        </p>
        <div role="group" aria-labelledby="tf-expertise" className="flex flex-wrap gap-2">
          {TEACHER_EXPERTISE.map((e) => {
            const on = form.expertise.includes(e.key);
            // אחרי שלושה, השאר נעולים עד שמסירים אחד - כך אי אפשר לסמן הכול.
            const blocked = !on && form.expertise.length >= TEACHER_EXPERTISE_MAX;
            return (
              <label key={e.key} className={chip(on, blocked)}>
                <input type="checkbox" className="sr-only" checked={on} disabled={blocked} onChange={() => set({ expertise: toggle(form.expertise, e.key) })} />
                {e.label}
              </label>
            );
          })}
        </div>
        {form.expertise.length >= TEACHER_EXPERTISE_MAX && (
          <p className="mt-2 text-xs text-[var(--muted)]" role="status">נבחרו שלושה. כדי להחליף, מסירים אחד מהם.</p>
        )}
      </div>

      <div>
        <div id="tf-settings" className={label}>איפה מתקיים השיעור *</div>
        <div role="group" aria-labelledby="tf-settings" className="mb-3 flex flex-wrap gap-2">
          {TEACHER_LESSON_SETTINGS.map((s) => (
            <label key={s.key} className={chip(form.lesson_settings.includes(s.key))}>
              <input type="checkbox" className="sr-only" checked={form.lesson_settings.includes(s.key)} onChange={() => set({ lesson_settings: toggle(form.lesson_settings, s.key) })} />
              {s.label}
            </label>
          ))}
        </div>
        {teachesInPerson(form.lesson_settings) && (
          <>
            <div className="mb-2 text-xs font-bold text-[var(--muted)]">הערים שבהן מתקיימים השיעורים פנים אל פנים *</div>
            <RegionCityPicker selected={form.regions} onChange={(v) => set({ regions: v })} maxCities={6} />
          </>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div id="tf-languages" className={label}>שפות הוראה</div>
          <div role="group" aria-labelledby="tf-languages" className="flex flex-wrap gap-2">
            {TEACHER_LANGUAGES.map((l) => (
              <label key={l} className={`cursor-pointer rounded-full border focus-within:ring-2 focus-within:ring-[var(--teal)] px-3 py-1 text-xs ${form.languages.includes(l) ? "border-[var(--teal)] bg-[var(--teal-pale)] font-bold text-[var(--teal-dark)]" : "border-[var(--line)]"}`}>
                <input type="checkbox" className="sr-only" checked={form.languages.includes(l)} onChange={() => set({ languages: toggle(form.languages, l) })} />
                {l}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="tf-price" className={label}>מחיר לשיעור <span className="font-normal text-[var(--muted)]">(מוצג להורים)</span></label>
          <input id="tf-price" value={form.price_text} onChange={(e) => set({ price_text: e.target.value })} className={field} placeholder='למשל: 150-180 ש"ח לשעה' maxLength={60} />
        </div>
      </div>

      <div>
        <label htmlFor="tf-bio" className={label}>כמה מילים על עצמך <span className="font-normal text-[var(--muted)]">(מוצג להורים; עד 1,200 תווים)</span></label>
        <textarea id="tf-bio" value={form.bio} onChange={(e) => set({ bio: e.target.value.slice(0, 1200) })} rows={5} className={field} placeholder="ניסיון, גישה, עם אילו קשיים עבדת, איך נראה שיעור" />
      </div>
    </div>
  );
}
