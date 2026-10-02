"use client";

import RegionCityPicker from "@/app/components/RegionCityPicker";
import {
  TEACHER_SUBJECTS,
  TEACHER_GRADE_GROUPS,
  TEACHER_QUALIFICATIONS,
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
  remedial: boolean;
  grade_groups: string[];
  regions: string[];
  online: boolean;
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
  remedial: false,
  grade_groups: [],
  regions: [],
  online: false,
  languages: ["עברית"],
  price_text: "",
  bio: "",
  qualification: "",
  institution: "",
  qualification_year: "",
  teaching_certificate: false,
  experience_years: "",
};

const LANGS = ["עברית", "אנגלית", "ערבית", "רוסית", "צרפתית", "ספרדית", "אמהרית"];

export const field = "w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--teal)]";
export const label = "mb-1 block text-sm font-bold text-[var(--text-2)]";

function toggle(arr: string[], v: string): string[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

export function toApiPayload(f: TeacherForm) {
  return {
    full_name: f.full_name.trim(),
    email: f.email.trim().toLowerCase(),
    phone: f.phone.trim(),
    gender: f.gender || null,
    subjects: f.subjects,
    remedial: f.remedial,
    grade_groups: f.grade_groups,
    regions: f.regions,
    online: f.online,
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
}: {
  form: TeacherForm;
  setForm: (next: TeacherForm) => void;
  /** בעריכה המייל הוא מזהה הרשומה ואינו ניתן לשינוי מהטופס. */
  emailLocked?: boolean;
}) {
  const remedialAllowed = qualificationAllowsRemedial(form.qualification);
  const set = (patch: Partial<TeacherForm>) => setForm({ ...form, ...patch });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>שם מלא *</label>
          <input value={form.full_name} onChange={(e) => set({ full_name: e.target.value })} required className={field} />
        </div>
        <div>
          <label className={label}>מגדר</label>
          <select value={form.gender} onChange={(e) => set({ gender: e.target.value as TeacherForm["gender"] })} className={field}>
            <option value="">-- לא לציין --</option>
            <option value="נקבה">נקבה</option>
            <option value="זכר">זכר</option>
          </select>
        </div>
        <div>
          <label className={label}>מייל *</label>
          <input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} required disabled={emailLocked} className={`${field} disabled:opacity-60`} />
        </div>
        <div>
          <label className={label}>טלפון נייד * <span className="font-normal text-[var(--muted)]">(ההורים פונים בוואטסאפ)</span></label>
          <input type="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} required className={field} />
        </div>
      </div>

      <div>
        <div className={label}>תחומי הוראה *</div>
        <div className="flex flex-wrap gap-2">
          {TEACHER_SUBJECTS.map((s) => (
            <label key={s.key} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${form.subjects.includes(s.key) ? "border-[var(--teal)] bg-[var(--teal-pale)] font-bold text-[var(--teal-dark)]" : "border-[var(--line)]"}`}>
              <input type="checkbox" className="hidden" checked={form.subjects.includes(s.key)} onChange={() => set({ subjects: toggle(form.subjects, s.key) })} />
              {s.label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <div className={label}>שכבות גיל *</div>
        <div className="flex flex-wrap gap-2">
          {TEACHER_GRADE_GROUPS.map((g) => (
            <label key={g.key} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${form.grade_groups.includes(g.key) ? "border-[var(--teal)] bg-[var(--teal-pale)] font-bold text-[var(--teal-dark)]" : "border-[var(--line)]"}`}>
              <input type="checkbox" className="hidden" checked={form.grade_groups.includes(g.key)} onChange={() => set({ grade_groups: toggle(form.grade_groups, g.key) })} />
              {g.label}
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <div className={label}>הכשרה *</div>
        <select
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
            <label className={label}>המוסד שהעניק את התעודה / התואר</label>
            <input value={form.institution} onChange={(e) => set({ institution: e.target.value })} className={field} placeholder="למשל: לוינסקי-וינגייט, דוד ילין, בית ברל" />
          </div>
          <div>
            <label className={label}>שנת סיום</label>
            <input inputMode="numeric" value={form.qualification_year} onChange={(e) => set({ qualification_year: e.target.value.replace(/\D/g, "").slice(0, 4) })} className={field} />
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.teaching_certificate} onChange={(e) => set({ teaching_certificate: e.target.checked })} />
            יש לי תעודת הוראה
          </label>
          <div className="flex items-center gap-2 text-sm">
            <span>שנות ניסיון בהוראה:</span>
            <input inputMode="numeric" value={form.experience_years} onChange={(e) => set({ experience_years: e.target.value.replace(/\D/g, "").slice(0, 2) })} className={`${field} w-20`} />
          </div>
        </div>
        <label className={`mt-3 flex items-start gap-2 text-sm ${remedialAllowed ? "" : "opacity-50"}`}>
          <input type="checkbox" className="mt-1" checked={form.remedial} disabled={!remedialAllowed} onChange={(e) => set({ remedial: e.target.checked })} />
          <span>
            <strong>אני מורה להוראה מתקנת (מותאמת)</strong>
            <span className="block text-xs text-[var(--muted)]">
              {remedialAllowed
                ? "השאלון מפנה להוראה מתקנת כשזוהה קושי ממוקד בקריאה, בכתיבה או בחשבון. הסימון מאומת מול התעודה."
                : "זמין רק עם תעודת הוראה מתקנת, תואר בחינוך מיוחד או תואר שני בלקויות למידה. עם הכשרה אחרת הפרופיל מוצג לתגבור פרטי."}
            </span>
          </span>
        </label>
      </div>

      <div>
        <div className={label}>איפה מלמדים</div>
        <label className="mb-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.online} onChange={(e) => set({ online: e.target.checked })} />
          שיעורים אונליין
        </label>
        <RegionCityPicker selected={form.regions} onChange={(v) => set({ regions: v })} maxCities={6} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className={label}>שפות הוראה</div>
          <div className="flex flex-wrap gap-2">
            {LANGS.map((l) => (
              <label key={l} className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${form.languages.includes(l) ? "border-[var(--teal)] bg-[var(--teal-pale)] font-bold text-[var(--teal-dark)]" : "border-[var(--line)]"}`}>
                <input type="checkbox" className="hidden" checked={form.languages.includes(l)} onChange={() => set({ languages: toggle(form.languages, l) })} />
                {l}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className={label}>מחיר לשיעור <span className="font-normal text-[var(--muted)]">(מוצג להורים)</span></label>
          <input value={form.price_text} onChange={(e) => set({ price_text: e.target.value })} className={field} placeholder='למשל: 150-180 ש"ח לשעה' maxLength={60} />
        </div>
      </div>

      <div>
        <label className={label}>כמה מילים על עצמך <span className="font-normal text-[var(--muted)]">(מוצג להורים; עד 1,200 תווים)</span></label>
        <textarea value={form.bio} onChange={(e) => set({ bio: e.target.value.slice(0, 1200) })} rows={5} className={field} placeholder="ניסיון, גישה, עם אילו קשיים עבדת, איך נראה שיעור" />
      </div>
    </div>
  );
}
