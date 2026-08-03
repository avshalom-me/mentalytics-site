"use client";

import { useState } from "react";
import {
  THERAPIST_TYPES, TRAINING_AREAS, ASSESSMENT_TYPES,
  AGE_GROUPS, LANGUAGES, CULTURAL_PREFS, ARRANGEMENTS,
  COUPLES_MODALITIES, PLAY_THERAPY_MODALITIES,
  COGFUN_AGE_GROUPS, THERAPIST_TYPE_TO_TRAINING,
} from "@/app/lib/therapist-options";
import RegionCityPicker from "@/app/components/RegionCityPicker";
import { CheckCircle2, Loader2 } from "lucide-react";

// טופס מילוי-עצמי של מטפל/ת לפי הזמנת מרכז (מסלול 1). אחות של טופס העריכה
// בפורטל המרכז (app/centers/dashboard/therapists/[id]) - אותם שדות ואותם
// אילוצים; בצד השרת שניהם עוברים דרך CENTER_THERAPIST_EDIT_FIELDS, כך
// שהוספת שדה חדש מחייבת עדכון בשני הטפסים.

const PLAY_MODALITIES_SET = new Set<string>(PLAY_THERAPY_MODALITIES);

function CheckboxGroup({ label, options, selected, onChange }: {
  label: string; options: readonly string[]; selected: string[];
  onChange: (v: string[]) => void;
}) {
  function toggle(item: string) {
    onChange(selected.includes(item) ? selected.filter(x => x !== item) : [...selected, item]);
  }
  return (
    <div className="mb-5">
      <div className="mb-2 text-sm font-semibold text-stone-800">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <label key={opt} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-stone-200 px-2.5 py-1 text-xs hover:bg-stone-50">
            <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} />
            {opt}
          </label>
        ))}
      </div>
    </div>
  );
}

function StyleQuestion({ name, question, hint, value, onChange }: {
  name: string; question: string; hint: string;
  value: number | null; onChange: (v: number) => void;
}) {
  return (
    <div className="mb-6">
      <p className="text-sm font-semibold text-stone-800">{question}</p>
      <p className="mt-1 text-xs text-stone-500">{hint}</p>
      <div className="mt-3 flex flex-wrap gap-3">
        {[1,2,3,4,5,6,7].map(num => (
          <label key={num} className="flex items-center gap-1.5 text-sm cursor-pointer">
            <input type="radio" name={name} checked={value === num} onChange={() => onChange(num)} />
            {num}
          </label>
        ))}
      </div>
    </div>
  );
}

export default function FillForm({ token, centerName, inviteEmail }: {
  token: string; centerName: string; inviteEmail: string;
}) {
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");
  const [done, setDone] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [form, setForm] = useState({
    full_name: "", email: inviteEmail, phone: "", bio: "", gender: "", online: false,
    therapist_types: [] as string[], training_areas: [] as string[],
    assessment_types: [] as string[], regions: [] as string[],
    cultural_prefs: [] as string[], arrangements: [] as string[],
    age_groups: [] as string[], languages: [] as string[],
    couples_modalities: [] as string[], play_therapy_modalities: [] as string[],
    cogfun_age_groups: [] as string[],
    style_q1: null as number | null,
    style_q2: null as number | null,
    activity_level: null as number | null,
    education: "",
    experience: "",
    license_number: "",
    price: "",
  });

  async function uploadFile(file: File, type: "photo" | "certificate"): Promise<string | null> {
    const fd = new FormData();
    fd.append("token", token);
    fd.append("file", file);
    fd.append("type", type);
    try {
      const res = await fetch("/api/centers/fill-profile", { method: "POST", body: fd });
      const json = await res.json();
      return json.ok ? null : (json.error ?? "העלאה נכשלה");
    } catch {
      return "העלאה נכשלה";
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setSaveErr("");

    const { play_therapy_modalities, cogfun_age_groups, price, ...rest } = form;
    const fields = {
      ...rest,
      training_areas: [...form.training_areas, ...play_therapy_modalities],
      cogfun_age_groups,
      price: price.trim() ? Number(price) : null, // עמודה מספרית - "" נכשל בהכנסה
    };

    try {
      const res = await fetch("/api/centers/fill-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...fields }),
      });
      const json = await res.json();
      if (!json.ok) {
        setSaveErr(json.error ?? "שגיאה בשמירה");
        setSaving(false);
        return;
      }

      // העלאות - best-effort: כשל לא מסתיר שמירה שהצליחה.
      const issues: string[] = [];
      if (photoFile) { const err = await uploadFile(photoFile, "photo"); if (err) issues.push(err); }
      if (certFile) { const err = await uploadFile(certFile, "certificate"); if (err) issues.push(err); }
      if (issues.length) {
        setSaveErr(`הפרופיל נשמר, אך העלאת קובץ לא הושלמה (${issues.join("; ")}). אפשר לפנות למנהל/ת המרכז להשלמה.`);
      }
      setDone(true);
    } catch {
      setSaveErr("שגיאת רשת - נסו שוב");
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-green-200 bg-green-50 p-10 text-center shadow-sm">
        <CheckCircle2 size={44} className="mx-auto mb-3 text-green-600" />
        <h1 className="text-xl font-black text-stone-900 mb-2">הפרופיל נשלח! 🎉</h1>
        <p className="text-sm leading-7 text-stone-700">
          תודה! הפרופיל שלך נשלח לאישור קצר של צוות טיפול חכם, ולאחריו ייכנס למערכת ההתאמות דרך {centerName}.
          {saveErr && <span className="mt-2 block text-xs text-amber-700">{saveErr}</span>}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 text-center">
        <p className="text-sm font-semibold tracking-widest uppercase mb-2" style={{ color: "var(--teal)" }}>
          {centerName} · טיפול חכם
        </p>
        <h1 className="text-2xl font-black text-stone-900">מילוי הפרופיל המקצועי שלך</h1>
        <p className="mt-2 text-sm text-stone-500 max-w-md mx-auto leading-6">
          כ-5 דקות. הפרטים ישמשו את מערכת ההתאמות כדי להפנות אליך מטופלים מתאימים דרך המרכז.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        <div className="rounded-2xl border border-[#E8E0D8] bg-white p-6">
          <h2 className="text-lg font-extrabold text-stone-900 mb-5">פרטים אישיים</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-stone-700">שם מלא *</label>
              <input value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})}
                required className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#2e7d8c]" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-stone-700">טלפון (לפניות מטופלים)</label>
              <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#2e7d8c]" dir="ltr" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-stone-700">אימייל (לפניות מטופלים)</label>
              <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#2e7d8c]" dir="ltr" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-stone-700">מגדר</label>
              <select value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#2e7d8c]">
                <option value="">בחר</option>
                <option value="זכר">זכר</option>
                <option value="נקבה">נקבה</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="online" checked={form.online}
                onChange={e => setForm({...form, online: e.target.checked})} />
              <label htmlFor="online" className="text-sm font-semibold text-stone-700">מטפל/ת אונליין</label>
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-sm font-semibold text-stone-700">ביוגרפיה קצרה</label>
            <textarea value={form.bio} onChange={e => setForm({...form, bio: e.target.value})}
              rows={4} className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#2e7d8c]"
              placeholder="עליך, הגישה הטיפולית, ומה מייחד אותך..." />
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-sm font-semibold text-stone-700">השכלה והכשרה</label>
            <textarea value={form.education} onChange={e => setForm({...form, education: e.target.value})}
              rows={3} className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#2e7d8c]"
              placeholder="תארים, התמחויות, הכשרות רלוונטיות..." />
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-sm font-semibold text-stone-700">ניסיון מקצועי</label>
            <textarea value={form.experience} onChange={e => setForm({...form, experience: e.target.value})}
              rows={3} className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#2e7d8c]"
              placeholder="תפקידים, מסגרות עבודה, שנות ניסיון..." />
          </div>
        </div>

        <div className="rounded-2xl border border-[#E8E0D8] bg-white p-6">
          <h2 className="text-lg font-extrabold text-stone-900 mb-5">תמונה ותעודה</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-stone-700">תמונת פרופיל</label>
              {photoPreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoPreview} alt="" className="mb-2 h-24 w-24 rounded-full object-cover border border-stone-200" />
              )}
              <input type="file" accept="image/*" onChange={e => {
                const f = e.target.files?.[0] ?? null;
                setPhotoFile(f);
                setPhotoPreview(f ? URL.createObjectURL(f) : null);
              }} className="block w-full text-xs" />
              <p className="mt-1 text-[11px] text-stone-400">פרופילים עם תמונה מקבלים משמעותית יותר פניות.</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-stone-700">תעודה / רישיון (PDF / JPG / PNG)</label>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setCertFile(e.target.files?.[0] ?? null)}
                className="block w-full text-xs" />
              <p className="mt-1 text-[11px] text-stone-400">נדרשת לאישור הפרופיל ואינה מוצגת באתר.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-stone-700">מספר רישיון <span className="font-normal text-stone-400">(לא חובה)</span></label>
              <input value={form.license_number} onChange={e => setForm({...form, license_number: e.target.value})}
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#2e7d8c]" dir="ltr" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-stone-700">מחיר למפגש <span className="font-normal text-stone-400">(לא חובה, בשקלים)</span></label>
              <input value={form.price} onChange={e => setForm({...form, price: e.target.value.replace(/[^0-9]/g, "")})}
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#2e7d8c]" dir="ltr" inputMode="numeric" />
              <p className="mt-1 text-[11px] text-stone-400">אינו מוצג בפרופיל - משמש להתאמה לפי תקציב ולסטטיסטיקה אנונימית.</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#E8E0D8] bg-white p-6">
          <h2 className="text-lg font-extrabold text-stone-900 mb-5">התמחות מקצועית</h2>
          <CheckboxGroup label="סוג מטפל" options={THERAPIST_TYPES}
            selected={form.therapist_types} onChange={v => {
              const added = v.filter(t => !form.therapist_types.includes(t));
              let nextTraining = form.training_areas;
              for (const t of added) {
                const auto = THERAPIST_TYPE_TO_TRAINING[t];
                if (auto && !nextTraining.includes(auto)) nextTraining = [...nextTraining, auto];
              }
              setForm({...form, therapist_types: v, training_areas: nextTraining});
            }} />
          <CheckboxGroup label="תחומי טיפול" options={TRAINING_AREAS}
            selected={form.training_areas} onChange={v => {
              const hadCouples = form.training_areas.includes("טיפול זוגי");
              const hasCouples = v.includes("טיפול זוגי");
              const hadExpressive = form.training_areas.includes("טיפול בהבעה ויצירה");
              const hasExpressive = v.includes("טיפול בהבעה ויצירה");
              const hadCogfun = form.training_areas.includes("טיפול COG-FUN לקשיי קשב וריכוז");
              const hasCogfun = v.includes("טיפול COG-FUN לקשיי קשב וריכוז");
              setForm({...form, training_areas: v,
                couples_modalities: hadCouples && !hasCouples ? [] : form.couples_modalities,
                play_therapy_modalities: hadExpressive && !hasExpressive ? [] : form.play_therapy_modalities,
                cogfun_age_groups: hadCogfun && !hasCogfun ? [] : form.cogfun_age_groups,
              });
            }} />
          {form.training_areas.includes("טיפול זוגי") && (
            <CheckboxGroup label="גישה זוגית" options={COUPLES_MODALITIES}
              selected={form.couples_modalities} onChange={v => setForm({...form, couples_modalities: v})} />
          )}
          {form.training_areas.includes("טיפול בהבעה ויצירה") && (
            <CheckboxGroup label="סוג הטיפול בהבעה ויצירה" options={PLAY_THERAPY_MODALITIES}
              selected={form.play_therapy_modalities} onChange={v => setForm({...form, play_therapy_modalities: v})} />
          )}
          {form.training_areas.includes("טיפול COG-FUN לקשיי קשב וריכוז") && (
            <CheckboxGroup label="טיפול COG-FUN - לאילו קבוצות גיל?" options={COGFUN_AGE_GROUPS}
              selected={form.cogfun_age_groups} onChange={v => setForm({...form, cogfun_age_groups: v})} />
          )}
          <CheckboxGroup label="סוגי אבחון" options={ASSESSMENT_TYPES}
            selected={form.assessment_types} onChange={v => setForm({...form, assessment_types: v})} />
          <CheckboxGroup label="קבוצות גיל" options={AGE_GROUPS}
            selected={form.age_groups} onChange={v => setForm({...form, age_groups: v})} />
          <CheckboxGroup label="שפות טיפול" options={LANGUAGES}
            selected={form.languages} onChange={v => setForm({...form, languages: v})} />
        </div>

        <div className="rounded-2xl border border-[#E8E0D8] bg-white p-6">
          <h2 className="text-lg font-extrabold text-stone-900 mb-5">אזור ופרטים נוספים</h2>
          <div className="mb-5">
            <div className="mb-1 text-sm font-semibold text-stone-800">ערים / אזורים</div>
            <p className="mb-3 text-xs text-stone-500">בחרו אזור כדי לפתוח את רשימת הערים. ניתן לבחור עד 3 ערים.</p>
            <RegionCityPicker selected={form.regions} onChange={v => setForm({...form, regions: v})} maxCities={3} />
          </div>
          <CheckboxGroup label="העדפות תרבותיות" options={CULTURAL_PREFS}
            selected={form.cultural_prefs} onChange={v => setForm({...form, cultural_prefs: v})} />
          <CheckboxGroup label="הסדרים" options={ARRANGEMENTS}
            selected={form.arrangements} onChange={v => setForm({...form, arrangements: v})} />
        </div>

        <div className="rounded-2xl border border-[#E8E0D8] bg-white p-6">
          <h2 className="text-lg font-extrabold text-stone-900 mb-1">סגנון טיפולי</h2>
          <p className="text-xs text-stone-500 mb-5">3 שאלות על הגישה הטיפולית שלך - משמשות להתאמה אישיותית עם מטופלים.</p>
          <StyleQuestion
            name="style_q1"
            question="בעבודתי הטיפולית אני נוטה לראות בהבנה מעמיקה של שורשי הקושי, העבר והדפוסים הלא-מודעים מרכיב מרכזי בשינוי הטיפולי."
            hint="1 = בכלל לא - עבודה ממוקדת בהקלה מיידית ובתפקוד | 7 = מאוד - עבודה מבוססת תובנה ועומק"
            value={form.style_q1}
            onChange={v => setForm({...form, style_q1: v})}
          />
          <StyleQuestion
            name="style_q2"
            question="בעבודתי הטיפולית אני נוטה להציע למטופלים מסגרת ברורה, מטרות מוגדרות, כלים ומשימות בין פגישות."
            hint="1 = בכלל לא - עבודה במרחב פתוח וגמיש | 7 = מאוד - עבודה מובנית, מכוונת ופרקטית"
            value={form.style_q2}
            onChange={v => setForm({...form, style_q2: v})}
          />
          <StyleQuestion
            name="activity_level"
            question="בטיפול, הסגנון הטבעי שלי הוא להיות פעיל/ה, מכוון/ת ומעורב/ת מילולית, יותר מאשר שקט/ה, מכיל/ה ומתבונן/ת."
            hint="1 = שקט/ה ומתבונן/ת | 7 = פעיל/ה ומעורב/ת מאוד"
            value={form.activity_level}
            onChange={v => setForm({...form, activity_level: v})}
          />
        </div>

        <div className="sticky bottom-4">
          <button type="submit" disabled={saving || !form.full_name.trim()}
            className="w-full rounded-full py-3.5 text-base font-bold text-white transition hover:opacity-95 disabled:opacity-50 shadow-lg"
            style={{ background: "linear-gradient(135deg,var(--teal-dark),var(--teal))" }}>
            {saving ? <Loader2 size={18} className="inline animate-spin" /> : "שליחת הפרופיל לאישור"}
          </button>
          {saveErr && <p className="mt-2 rounded-xl bg-red-50 border border-red-200 px-4 py-2 text-center text-sm text-red-700">{saveErr}</p>}
        </div>
      </form>
    </>
  );
}
