"use client";

import { useState } from "react";
import TeacherProfileFields, { toApiPayload, type TeacherForm } from "@/app/learning/TeacherProfileFields";
import { btn, btnPrimary, patchTeacher, type Teacher } from "./shared";

// עריכת פרופיל מורה מהאדמין: אותו טופס שהמורה רואה (TeacherProfileFields),
// כך שהאדמין לא יכול לשמור משהו שהטופס לא היה מאפשר. בניגוד למורה, האדמין
// יכול לשנות גם מייל והכשרה אחרי האישור (השרת: update_profile).

function toForm(t: Teacher): TeacherForm {
  return {
    full_name: t.full_name,
    email: t.email,
    phone: t.phone ?? "",
    gender: (t.gender as TeacherForm["gender"]) || "",
    subjects: t.subjects ?? [],
    focuses: t.focuses ?? [],
    remedial: t.remedial,
    grade_groups: t.grade_groups ?? [],
    expertise: t.expertise ?? [],
    lesson_settings: t.lesson_settings ?? [],
    regions: t.regions ?? [],
    languages: t.languages?.length ? t.languages : ["עברית"],
    price_text: t.price_text ?? "",
    bio: t.bio ?? "",
    qualification: t.qualification ?? "",
    institution: t.institution ?? "",
    qualification_year: t.qualification_year ? String(t.qualification_year) : "",
    teaching_certificate: t.teaching_certificate,
    experience_years: t.experience_years != null ? String(t.experience_years) : "",
  };
}

export default function EditTeacherModal({ teacher, onClose, onSaved }: { teacher: Teacher; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<TeacherForm>(() => toForm(teacher));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    try {
      const r = await patchTeacher(teacher.id, "update_profile", { fields: toApiPayload(form) });
      if (!r.ok) return setError(r.error || "השמירה נכשלה");
      onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] overflow-y-auto bg-black/40 p-4" dir="rtl" onClick={onClose}>
      <div className="mx-auto my-6 max-w-3xl rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black text-stone-900">עריכת הפרופיל של {teacher.full_name}</h2>
          <button type="button" onClick={onClose} className="rounded-full px-2 text-stone-400" aria-label="סגירה">✕</button>
        </div>
        <p className="mb-4 text-xs text-stone-500">אותו טופס שהמורה ממלא/ת. שינוי הכשרה או הסימון &quot;הוראה מתקנת&quot; הוא אימות שלך, ולכן הוא פתוח כאן גם אחרי האישור.</p>
        <TeacherProfileFields form={form} setForm={setForm} remedialVerified={teacher.remedial} />
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btn}>ביטול</button>
          <button type="button" disabled={busy} onClick={save} className={btnPrimary}>{busy ? "שומר..." : "שמירה"}</button>
        </div>
      </div>
    </div>
  );
}
