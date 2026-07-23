"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import {
  THERAPIST_TYPES, TRAINING_AREAS, ASSESSMENT_TYPES,
  AGE_GROUPS, LANGUAGES, CULTURAL_PREFS, ARRANGEMENTS,
  COUPLES_MODALITIES, PLAY_THERAPY_MODALITIES,
  COGFUN_AGE_GROUPS, THERAPIST_TYPE_TO_TRAINING,
} from "@/app/lib/therapist-options";
import RegionCityPicker from "@/app/components/RegionCityPicker";
import { ArrowRight, Loader2 } from "lucide-react";

// טופס פרופיל מטפל בפורטל המרכז — יצירה ('new') או עריכה (UUID). הפרופיל
// בבעלות המרכז: רק מנהלי המרכז עורכים אותו, אין למטפל הבודד חשבון משלו.
// שיקוף של טופס העריכה העצמית של מטפל (dashboard/edit), מול ה-API של הפורטל.

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

export default function CenterTherapistFormPage() {
  const params = useParams<{ id: string }>();
  const isNew = params.id === "new";
  const therapistId = isNew ? null : params.id;

  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  // מסלול 2 — מרכז כישות אחת: הטופס מתאים את עצמו (בלי תעודות/שאלות סגנון,
  // ומספר המיקומים קובע כמה אזורים מותר לסמן).
  const [isEntity, setIsEntity] = useState(false);
  const [numLocations, setNumLocations] = useState(1);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [existingCerts, setExistingCerts] = useState<Array<{ id: string; original_name: string; signed_url: string | null }>>([]);

  const [form, setForm] = useState({
    full_name: "", email: "", phone: "", bio: "", gender: "", online: false,
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
  });

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/centers/login";
        return;
      }
      setToken(session.access_token);
      if (!therapistId) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/center-portal/therapists?id=${encodeURIComponent(therapistId)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const json = await res.json();
        if (!json.ok) {
          setLoadErr(json.error ?? "שגיאה בטעינת הפרופיל");
        } else {
          const t = json.therapist;
          setStatus(t.status ?? null);
          setIsEntity(t.entity_type === "center");
          setNumLocations(Math.max(1, Math.floor(Number(json.numLocations) || 1)));
          setProfilePhotoUrl(json.photoUrl ?? null);
          setExistingCerts(json.certificates ?? []);
          setForm({
            full_name: t.full_name ?? "",
            email: t.email ?? "",
            phone: t.phone ?? "",
            bio: t.bio ?? "",
            gender: t.gender ?? "",
            online: t.online ?? false,
            therapist_types: t.therapist_types ?? [],
            training_areas: (t.training_areas ?? []).filter((a: string) => !PLAY_MODALITIES_SET.has(a)),
            play_therapy_modalities: (t.training_areas ?? []).filter((a: string) => PLAY_MODALITIES_SET.has(a)),
            assessment_types: t.assessment_types ?? [],
            regions: t.regions ?? [],
            cultural_prefs: t.cultural_prefs ?? [],
            arrangements: t.arrangements ?? [],
            age_groups: t.age_groups ?? [],
            languages: t.languages ?? [],
            couples_modalities: t.couples_modalities ?? [],
            cogfun_age_groups: t.cogfun_age_groups ?? [],
            style_q1: t.style_q1 ?? null,
            style_q2: t.style_q2 ?? null,
            activity_level: t.activity_level ?? null,
            education: t.education ?? "",
            experience: t.experience ?? "",
          });
        }
      } catch {
        setLoadErr("שגיאת רשת");
      } finally {
        setLoading(false);
      }
    })();
  }, [therapistId]);

  async function uploadFile(file: File, type: "photo" | "certificate", id: string, accessToken: string): Promise<string | null> {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", type);
    fd.append("therapist_id", id);
    try {
      const res = await fetch("/api/center-portal/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: fd,
      });
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
    setSaveMsg("");

    // token טרי בעת ה-submit — לא token שנתפס בטעינה (טפסים ארוכים ⇒ 401).
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token ?? token;
    if (!accessToken) {
      setSaveErr("פג תוקף החיבור. רענן/י את העמוד והתחבר/י מחדש — הפרטים יישמרו.");
      setSaving(false);
      return;
    }

    const { play_therapy_modalities, cogfun_age_groups, ...rest } = form;
    const fields = {
      ...rest,
      training_areas: [...form.training_areas, ...play_therapy_modalities],
      cogfun_age_groups,
    };

    const res = await fetch("/api/center-portal/therapists", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(isNew ? { action: "create", ...fields } : { action: "update", id: therapistId, ...fields }),
    });
    const json = await res.json();
    if (!json.ok) {
      setSaveErr(json.error ?? "שגיאה בשמירה");
      setSaving(false);
      return;
    }
    const savedId: string = json.id;

    // העלאות — best-effort: כשל לא מסתיר את השמירה שהצליחה.
    const uploadIssues: string[] = [];
    if (photoFile) {
      const err = await uploadFile(photoFile, "photo", savedId, accessToken);
      if (err) uploadIssues.push(err); else setPhotoFile(null);
    }
    if (certFile) {
      const err = await uploadFile(certFile, "certificate", savedId, accessToken);
      if (err) uploadIssues.push(err); else setCertFile(null);
    }

    if (uploadIssues.length) {
      setSaveErr(`הפרטים נשמרו, אך העלאת הקובץ לא הושלמה (${uploadIssues.join("; ")}). אפשר לנסות שוב.`);
      setSaving(false);
      return;
    }

    if (isNew) {
      // חזרה לדשבורד — המטפל החדש יופיע שם כ"ממתין לאישור".
      window.location.href = "/centers/dashboard?created=1";
      return;
    }
    setSaveMsg("הפרטים נשמרו בהצלחה ✓");
    setSaving(false);
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center" dir="rtl"><Loader2 size={28} className="animate-spin text-[var(--teal)]" /></div>;
  }

  if (loadErr) {
    return (
      <main className="mx-auto max-w-md px-5 py-20 text-center" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700;800;900&display=swap');`}</style>
        <div className="rounded-3xl border border-stone-200 bg-white p-8">
          <p className="text-sm leading-7 text-stone-700">{loadErr}</p>
          <Link href="/centers/dashboard" className="mt-4 inline-block text-sm font-bold underline" style={{ color: "var(--teal)" }}>← חזרה לפורטל</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 pb-24" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700;800;900&display=swap');`}</style>

      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-stone-900">
            {isNew
              ? "הוספת מטפל/ת למרכז"
              : isEntity
                ? `עריכת פרופיל המרכז — ${form.full_name || "המרכז"}`
                : `עריכת פרופיל — ${form.full_name || "מטפל/ת"}`}
          </h1>
          <p className="mt-1 text-xs text-stone-500">
            {isEntity
              ? 'המרכז מוצג במערכת ההתאמות כרובריקה אחת ("מרכז טיפולי"). ההתאמה למטופלים מבוססת על ההתאמה המקצועית בלבד — מלאו את תחומי הטיפול, קבוצות הגיל, השפות והאזורים.'
              : isNew
                ? "הפרופיל יישלח לאישור צוות טיפול חכם, ולאחר האישור ייכנס אוטומטית למערכת ההתאמות."
                : status === "pending"
                  ? "הפרופיל ממתין לאישור צוות טיפול חכם."
                  : "שינויים נשמרים מיד. הקידום במערכת ההתאמות מנוהל אוטומטית דרך מנוי המרכז."}
          </p>
        </div>
        <Link href="/centers/dashboard" className="inline-flex items-center gap-1 rounded-full border border-stone-300 px-4 py-1.5 text-sm font-semibold text-stone-600 hover:bg-stone-50 whitespace-nowrap">
          <ArrowRight size={15} /> לפורטל
        </Link>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        <div className="rounded-2xl border border-[#E8E0D8] bg-white p-6">
          <h2 className="text-lg font-extrabold text-stone-900 mb-5">{isEntity ? "פרטי המרכז" : "פרטים אישיים"}</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-stone-700">{isEntity ? "שם המרכז *" : "שם מלא *"}</label>
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
            {!isEntity && (
              <div>
                <label className="mb-1 block text-sm font-semibold text-stone-700">מגדר</label>
                <select value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#2e7d8c]">
                  <option value="">בחר</option>
                  <option value="זכר">זכר</option>
                  <option value="נקבה">נקבה</option>
                </select>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input type="checkbox" id="online" checked={form.online}
                onChange={e => setForm({...form, online: e.target.checked})} />
              <label htmlFor="online" className="text-sm font-semibold text-stone-700">{isEntity ? "המרכז מציע גם טיפול אונליין" : "מטפל/ת אונליין"}</label>
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-sm font-semibold text-stone-700">{isEntity ? "תיאור המרכז" : "ביוגרפיה קצרה"}</label>
            <textarea value={form.bio} onChange={e => setForm({...form, bio: e.target.value})}
              rows={4} className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#2e7d8c]"
              placeholder={isEntity ? "על המרכז, הגישה הטיפולית, ומה מייחד אותו..." : "על המטפל/ת, הגישה הטיפולית, ומה מייחד אותו/ה..."} />
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-sm font-semibold text-stone-700">{isEntity ? "הכשרות והסמכות הצוות" : "השכלה והכשרה"}</label>
            <textarea value={form.education} onChange={e => setForm({...form, education: e.target.value})}
              rows={3} className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#2e7d8c]"
              placeholder={isEntity ? "תחומי הכשרה, הסמכות והתמחויות של צוות המרכז..." : "תארים, התמחויות, הכשרות רלוונטיות..."} />
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-sm font-semibold text-stone-700">{isEntity ? "ותק וניסיון המרכז" : "ניסיון מקצועי"}</label>
            <textarea value={form.experience} onChange={e => setForm({...form, experience: e.target.value})}
              rows={3} className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#2e7d8c]"
              placeholder={isEntity ? "ותק המרכז, מסגרות עבודה, תחומי מומחיות..." : "תפקידים, מסגרות עבודה, שנות ניסיון..."} />
          </div>
        </div>

        {isEntity ? (
          <div className="rounded-2xl border border-[#E8E0D8] bg-white p-6">
            <h2 className="text-lg font-extrabold text-stone-900 mb-2">הלוגו והצוות של המרכז</h2>
            <p className="text-sm leading-6 text-stone-600">
              לוגו המרכז וחברי הצוות (שם, תפקיד ותמונה) מנוהלים בעמוד הפרופיל הציבורי של המרכז.
              במרכז טיפולי אין צורך להעלות תעודות רישיון לכל מטפל — הסמכות הצוות מנוהלות אצלכם.
            </p>
            <Link href="/centers/dashboard" className="mt-3 inline-flex items-center gap-1 text-sm font-bold underline" style={{ color: "var(--teal)" }}>
              <ArrowRight size={15} /> לניהול הפרופיל הציבורי בפורטל
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-[#E8E0D8] bg-white p-6">
            <h2 className="text-lg font-extrabold text-stone-900 mb-5">תמונה ותעודות</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-stone-700">תמונת פרופיל</label>
                {(photoPreview || profilePhotoUrl) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoPreview ?? profilePhotoUrl ?? ""} alt="" className="mb-2 h-24 w-24 rounded-full object-cover border border-stone-200" />
                )}
                <input type="file" accept="image/*" onChange={e => {
                  const f = e.target.files?.[0] ?? null;
                  setPhotoFile(f);
                  setPhotoPreview(f ? URL.createObjectURL(f) : null);
                }} className="block w-full text-xs" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-stone-700">תעודה / רישיון (PDF / JPG / PNG)</label>
                {existingCerts.length > 0 && (
                  <ul className="mb-2 space-y-1 text-xs text-stone-600">
                    {existingCerts.map(c => (
                      <li key={c.id}>
                        📄 {c.signed_url
                          ? <a href={c.signed_url} target="_blank" className="underline">{c.original_name}</a>
                          : c.original_name}
                      </li>
                    ))}
                  </ul>
                )}
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setCertFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-xs" />
                <p className="mt-1 text-[11px] text-stone-400">תעודת הרישיון נדרשת לאישור הפרופיל ואינה מוצגת באתר.</p>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-[#E8E0D8] bg-white p-6">
          <h2 className="text-lg font-extrabold text-stone-900 mb-5">התמחות מקצועית</h2>
          <CheckboxGroup label={isEntity ? "סוגי מטפלים במרכז" : "סוג מטפל"} options={THERAPIST_TYPES}
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
            <CheckboxGroup label="טיפול COG-FUN — לאילו קבוצות גיל?" options={COGFUN_AGE_GROUPS}
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
            <p className="mb-3 text-xs text-stone-500">
              {isEntity
                ? `בחרו אזור כדי לפתוח את רשימת הערים. מספר המיקומים/סניפים במנוי (${numLocations}) קובע כמה אזורים ניתן לסמן — עד 4 ערים בכל אזור.`
                : "בחרו אזור כדי לפתוח את רשימת הערים. ניתן לבחור עד 3 ערים."}
            </p>
            {isEntity ? (
              <RegionCityPicker selected={form.regions} onChange={v => setForm({...form, regions: v})} maxRegions={numLocations} />
            ) : (
              <RegionCityPicker selected={form.regions} onChange={v => setForm({...form, regions: v})} maxCities={3} />
            )}
          </div>
          <CheckboxGroup label="העדפות תרבותיות" options={CULTURAL_PREFS}
            selected={form.cultural_prefs} onChange={v => setForm({...form, cultural_prefs: v})} />
          <CheckboxGroup label="הסדרים" options={ARRANGEMENTS}
            selected={form.arrangements} onChange={v => setForm({...form, arrangements: v})} />
        </div>

        {!isEntity && (
        <div className="rounded-2xl border border-[#E8E0D8] bg-white p-6">
          <h2 className="text-lg font-extrabold text-stone-900 mb-1">סגנון טיפולי</h2>
          <p className="text-xs text-stone-500 mb-5">3 שאלות על הגישה הטיפולית — משמשות להתאמה אישיותית עם מטופלים. מומלץ למלא יחד עם המטפל/ת.</p>
          <StyleQuestion
            name="style_q1"
            question="בעבודתו/ה הטיפולית, המטפל/ת נוטה לראות בהבנה מעמיקה של שורשי הקושי, העבר והדפוסים הלא-מודעים מרכיב מרכזי בשינוי הטיפולי."
            hint="1 = בכלל לא — העבודה ממוקדת בהקלה מיידית ובתפקוד | 7 = מאוד — עבודה מבוססת תובנה ועומק"
            value={form.style_q1}
            onChange={v => setForm({...form, style_q1: v})}
          />
          <StyleQuestion
            name="style_q2"
            question="בעבודתו/ה הטיפולית, המטפל/ת נוטה להציע למטופלים מסגרת ברורה, מטרות מוגדרות, כלים ומשימות בין פגישות."
            hint="1 = בכלל לא — עבודה במרחב פתוח וגמיש | 7 = מאוד — עבודה מובנית, מכוונת ופרקטית"
            value={form.style_q2}
            onChange={v => setForm({...form, style_q2: v})}
          />
          <StyleQuestion
            name="activity_level"
            question="בטיפול, הסגנון הטבעי של המטפל/ת הוא להיות פעיל/ה, מכוון/ת ומעורב/ת מילולית, יותר מאשר שקט/ה, מכיל/ה ומתבונן/ת."
            hint="1 = שקט/ה ומתבונן/ת | 7 = פעיל/ה ומעורב/ת מאוד"
            value={form.activity_level}
            onChange={v => setForm({...form, activity_level: v})}
          />
        </div>
        )}

        <div className="sticky bottom-4">
          <button type="submit" disabled={saving || !form.full_name.trim()}
            className="w-full rounded-full py-3.5 text-base font-bold text-white transition hover:opacity-95 disabled:opacity-50 shadow-lg"
            style={{ background: "linear-gradient(135deg,var(--teal-dark),var(--teal))" }}>
            {saving ? <Loader2 size={18} className="inline animate-spin" /> : isNew ? "יצירת הפרופיל ושליחה לאישור" : "שמירת שינויים"}
          </button>
          {saveErr && <p className="mt-2 rounded-xl bg-red-50 border border-red-200 px-4 py-2 text-center text-sm text-red-700">{saveErr}</p>}
          {saveMsg && <p className="mt-2 rounded-xl bg-green-50 border border-green-200 px-4 py-2 text-center text-sm text-green-700">{saveMsg}</p>}
        </div>
      </form>
    </main>
  );
}
