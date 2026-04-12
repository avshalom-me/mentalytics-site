"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { REGION_CITIES } from "@/app/lib/regions";

type Gender = "זכר" | "נקבה";

const THERAPIST_TYPES = [
  "פסיכולוג קליני",
  "פסיכולוג חינוכי",
  "פסיכולוג שיקומי/רפואי",
  "פסיכולוג התפתחותי",
  "פסיכולוג תעסוקתי",
  "יועצ/ת חינוכי",
  'עו"ס קליני',
  "מטפל/ת בהבעה ויצירה",
  "מטפל מיני",
  "קרימינולוג קליני",
  "פיזיותרפיסט/ית",
] as const;

const TRAINING_AREAS = [
  "טיפול דינאמי",
  "CBT",
  "ACT",
  "EMDR",
  "DBT",
  "הדרכת הורים",
  "טיפול דיאדי",
  "טיפול משפחתי",
  "טיפול בהבעה ויצירה",
  "ריפוי בעיסוק",
  "טיפול תעסוקתי",
  "קבוצה חברתית",
  "טיפול זוגי",
  "טיפול בהתמכרויות",
  "טיפול מיני",
  "טיפול COG-FUN לקשיי קשב וריכוז",
  "טיפול בטראומה",
] as const;

const COUPLES_MODALITIES = ["EFT", "דינאמי", "מבני"] as const;

const PLAY_THERAPY_MODALITIES = [
  "טיפול באומנות",
  "טיפול בתנועה",
  "דרמה תרפיה",
  'טיפול בעזרת בע"ח',
  "טיפול במוזיקה",
  "פסיכודרמה",
] as const;

const AGE_GROUPS = [
  "גיל הרך",
  "ילדים",
  "נוער",
  "מבוגרים",
  "הגיל השלישי",
] as const;

const ASSESSMENT_TYPES = [
  "פסיכו-דידקטי",
  "פסיכו-דיאגנוסטי",
  "נוירו-פסיכולוגי",
  "אבחון תעסוקתי",
  "הערכה פסיכולוגית",
  "הערכת בשלות לגן",
  "אבחון קשיי תקשורת ASD",
] as const;

const CULTURAL_PREFS = [
  "היכרות עם העולם הדתי",
  "היכרות עם העולם החרדי",
  'היכרות עם עולם הלהט"ב',
] as const;

const LANGUAGES = [
  "עברית",
  "אנגלית",
  "ערבית",
  "רוסית",
  "צרפתית",
  "ספרדית",
  "פורטוגזית",
  "אמהרית",
] as const;

const ARRANGEMENTS = [
  "קופות החולים",
  "משרד הביטחון",
  "ביטוח לאומי",
  "ביטוחים פרטיים",
] as const;

type FormState = {
  fullName: string;
  email: string;
  phone: string;
  therapistTypes: string[];
  trainingAreas: string[];
  couplesModalities: string[];
  playTherapyModalities: string[];
  ageGroups: string[];
  assessmentTypes: string[];
  styleQ1: number | null;
  styleQ2: number | null;
  activityLevel: number | null;
  regions: string[];
  online: "כן" | "לא";
  culturalPrefs: string[];
  languages: string[];
  acceptingNewClients: boolean;
  gender: Gender | "";
  price: string;
  arrangements: string[];
  certificates: File[];
  profilePhoto: File | null;
  bio: string;
  education: string;
  experience: string;
  termsAccepted: boolean;
};

function toggleInArray(arr: string[], value: string) {
  return arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];
}

function LandingScreen() {
  return (
    <main className="min-h-screen bg-[#f0ece4]" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');`}</style>
      <div className="mx-auto max-w-4xl px-4 py-10">

        {/* Header */}
        <div className="mb-10 text-center">
          <img src="/logo.svg.png" alt="Mentalytics" className="mx-auto mb-4 h-16 w-auto" />
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold tracking-widest uppercase mb-4"
            style={{ background: "#0F546822", color: "#0F5468", border: "1px solid #0F546844" }}>
            למטפלים ומאבחנים
          </div>
          <h1 className="text-3xl font-black text-[#1a3a5c]" style={{ fontFamily: "serif" }}>
            בחר/י את מסלול ההצטרפות שלך
          </h1>
          <p className="mt-3 text-stone-700 leading-7 max-w-lg mx-auto text-sm">
            מנטליטיקס מחברת בין מטופלים לאנשי טיפול — בשתי רמות שירות.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid gap-6 md:grid-cols-2 mb-10">

          {/* Free plan */}
          <div className="rounded-2xl bg-white p-7 shadow-sm flex flex-col" style={{ border: "1px solid #E8E0D8" }}>
            <div className="mb-4">
              <span className="inline-block rounded-full px-3 py-1 text-xs font-bold mb-3"
                style={{ background: "#E8F4F0", color: "#1a5c46" }}>
                חינמי
              </span>
              <h2 className="text-xl font-black text-[#1a3a5c] mb-1">מסלול בסיסי</h2>
              <p className="text-2xl font-black text-stone-800 mb-4">₪0 <span className="text-sm font-normal text-stone-500">/ תמיד</span></p>
            </div>
            <ul className="space-y-3 flex-1 mb-6">
              <li className="flex items-start gap-2 text-sm text-stone-700">
                <span className="mt-0.5 text-green-600 font-bold flex-shrink-0">✓</span>
                <span><strong>דף מידע אישי</strong> — פרסום פרופיל שלך עם תמונה, ביוגרפיה ותחומי התמחות</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-stone-700">
                <span className="mt-0.5 text-green-600 font-bold flex-shrink-0">✓</span>
                <span>נגיש לכל מי שמחפש מטפלים באתר</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-stone-700">
                <span className="mt-0.5 text-green-600 font-bold flex-shrink-0">✓</span>
                <span>שליטה מלאה בפרטים המוצגים</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-stone-400 line-through">
                <span className="mt-0.5 flex-shrink-0">✗</span>
                <span>כניסה למערכת ההתאמה</span>
              </li>
            </ul>
            <a
              href="/therapists/login"
              className="block w-full text-center rounded-xl px-6 py-3 text-sm font-bold transition hover:opacity-90 active:scale-95"
              style={{ background: "#E8E0D8", color: "#1a3a5c" }}
            >
              הרשמה חינמית ←
            </a>
          </div>

          {/* Promoted plan */}
          <div className="rounded-2xl p-7 shadow-lg flex flex-col relative"
            style={{ background: "linear-gradient(160deg,#0F5468 0%,#1A7A96 100%)", border: "2px solid #0F5468" }}>
            <div className="absolute -top-3 right-6">
              <span className="rounded-full px-3 py-1 text-xs font-black shadow"
                style={{ background: "#F5C842", color: "#1a3a0a" }}>
                מומלץ
              </span>
            </div>
            <div className="mb-4">
              <span className="inline-block rounded-full px-3 py-1 text-xs font-bold mb-3"
                style={{ background: "rgba(255,255,255,0.2)", color: "#ffffff" }}>
                מקודם
              </span>
              <h2 className="text-xl font-black text-white mb-1">מסלול מתקדם</h2>
              <p className="text-2xl font-black text-white mb-4">בקרוב <span className="text-sm font-normal opacity-70">/ מנוי חודשי</span></p>
            </div>
            <ul className="space-y-3 flex-1 mb-6">
              <li className="flex items-start gap-2 text-sm text-white">
                <span className="mt-0.5 text-yellow-300 font-bold flex-shrink-0">✓</span>
                <span><strong>דף מידע אישי</strong> — כולל כל מה שבמסלול הבסיסי</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-white">
                <span className="mt-0.5 text-yellow-300 font-bold flex-shrink-0">✓</span>
                <span><strong>כניסה למערכת ההתאמה</strong> — הפניות על בסיס תחומי הטיפול והאישיות המקצועית שלך</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-white">
                <span className="mt-0.5 text-yellow-300 font-bold flex-shrink-0">✓</span>
                <span>התאמה לפי פרמטרים מגוונים: גיל, אזור, שפה, סגנון טיפולי, הסדרי ביטוח ועוד</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-white">
                <span className="mt-0.5 text-yellow-300 font-bold flex-shrink-0">✓</span>
                <span>הפניות מדויקות — המטופלים שתקבל/י יתאימו לך ולגישה הטיפולית שלך</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-white">
                <span className="mt-0.5 text-yellow-300 font-bold flex-shrink-0">✓</span>
                <span>ערך טיפולי גבוה יותר — מטופלים שבחרו אותך על בסיס התאמה אמיתית</span>
              </li>
            </ul>
            <button
              disabled
              className="block w-full text-center rounded-xl px-6 py-3 text-sm font-bold cursor-not-allowed opacity-60"
              style={{ background: "rgba(255,255,255,0.2)", color: "#ffffff", border: "1px solid rgba(255,255,255,0.4)" }}
            >
              הרשמה ותשלום — בקרוב
            </button>
            <p className="text-center text-xs mt-3 opacity-60 text-white">
              הרשמה כבסיסי תאפשר שדרוג בהמשך
            </p>
          </div>
        </div>

        {/* Sub note */}
        <p className="text-center text-xs text-stone-500">
          ההרשמה אורכת כ-5 דקות. הפרופיל יעלה לאחר בדיקה ואישור.
        </p>
      </div>
    </main>
  );
}

export default function TherapistSignupPage() {
  const [showLanding] = useState(true);
  const [form, setForm] = useState<FormState>({
    fullName: "",
    email: "",
    phone: "",
    therapistTypes: [],
    trainingAreas: [],
    couplesModalities: [],
    playTherapyModalities: [],
    ageGroups: [],
    assessmentTypes: [],
    styleQ1: null,
    styleQ2: null,
    activityLevel: null,
    regions: [],
    online: "לא",
    culturalPrefs: [],
    languages: [],
    acceptingNewClients: true,
    gender: "",
    price: "",
    arrangements: [],
    certificates: [],
    profilePhoto: null,
    bio: "",
    education: "",
    experience: "",
    termsAccepted: false,
  });

  const [submitMsg, setSubmitMsg] = useState<string>("");
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const regionLimitReached = useMemo(
    () => form.regions.length >= 3,
    [form.regions.length]
  );

  function validate(): string[] {
    const e: string[] = [];

    if (!form.fullName.trim()) e.push("נא למלא שם מלא.");
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.push("נא למלא כתובת מייל תקינה.");
    if (!form.phone.trim() || !/^0\d{8,9}$/.test(form.phone.replace(/[-\s]/g, ""))) e.push("נא למלא מספר טלפון סלולארי תקין (לדוגמה: 0501234567).");
    if (form.therapistTypes.length === 0) {
      e.push("נא לבחור לפחות סוג מטפל אחד.");
    }
    if (form.trainingAreas.length === 0) {
      e.push("נא לבחור לפחות תחום הכשרה אחד.");
    }
    if (
      form.trainingAreas.includes("טיפול זוגי") &&
      form.couplesModalities.length === 0
    ) {
      e.push('בחרת "טיפול זוגי" — נא לבחור לפחות סוג אחד (EFT/דינאמי/מבני).');
    }
    if (
      form.trainingAreas.includes("טיפול בהבעה ויצירה") &&
      form.playTherapyModalities.length === 0
    ) {
      e.push('בחרת "טיפול בהבעה ויצירה" — נא לבחור לפחות סוג אחד (אמנות, מוזיקה, דרמה וכו\').');
    }
    if (form.ageGroups.length === 0) {
      e.push("נא לבחור לפחות קבוצת גיל אחת.");
    }
    if (form.styleQ1 === null) {
      e.push("נא לענות על שאלת הסגנון 1 (תובנה מול הקלה מיידית).");
    }
    if (form.styleQ2 === null) {
      e.push("נא לענות על שאלת הסגנון 2 (מסגרת מובנית מול מרחב פתוח).");
    }
    if (form.activityLevel === null) {
      e.push("נא לענות על שאלת הסגנון 3 (פעיל מול מכיל).");
    }
    if (form.online !== "כן" && form.regions.length === 0) {
      e.push("נא לבחור לפחות אזור פעילות אחד, או לסמן שעובד/ת אונליין.");
    }
    if (!form.bio.trim()) {
      e.push("נא לכתוב כמה מילים עליך בשדה 'כמה מילים עליי'.");
    }
    if (form.languages.length === 0) {
      e.push("נא לבחור לפחות שפת טיפול אחת.");
    }
    if (!form.gender) {
      e.push("נא לבחור מגדר.");
    }
    if (form.price.trim() && Number.isNaN(Number(form.price))) {
      e.push("מחיר חייב להיות מספר (או להשאיר ריק).");
    }
    if (form.bio.length > 500) {
      e.push("התיאור האישי יכול להיות עד 500 תווים.");
    }
    if (form.certificates.length === 0) {
      e.push("נא לצרף לפחות תעודה אחת.");
    }
    if (!form.termsAccepted) {
      e.push("נא לאשר את תנאי השימוש והצהרת הנאמנות.");
    }
    return e;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitMsg("");
    setErrors([]);

    const eList = validate();
    setErrors(eList);
    if (eList.length > 0) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setIsSubmitting(true);

    try {
      const fd = new FormData();
      fd.append("fullName", form.fullName);
      fd.append("email", form.email);
      fd.append("phone", form.phone);
      fd.append("gender", form.gender);
      fd.append("online", form.online);
      fd.append("price", form.price);
      fd.append("bio", form.bio);
      fd.append("education", form.education);
      fd.append("experience", form.experience);

      fd.append("therapistTypes", JSON.stringify(form.therapistTypes));
      const allTrainingAreas = [
        ...form.trainingAreas,
        ...form.playTherapyModalities,
      ];
      fd.append("trainingAreas", JSON.stringify(allTrainingAreas));
      fd.append("treatmentTypes", JSON.stringify(allTrainingAreas));
      fd.append("couplesModalities", JSON.stringify(form.couplesModalities));
      fd.append("ageGroups", JSON.stringify(form.ageGroups));
      fd.append("assessmentTypes", JSON.stringify(form.assessmentTypes));
      fd.append("styleQ1", String(form.styleQ1 ?? ""));
      fd.append("styleQ2", String(form.styleQ2 ?? ""));
      fd.append("activityLevel", String(form.activityLevel ?? ""));
      fd.append("regions", JSON.stringify(form.regions));
      fd.append("culturalPrefs", JSON.stringify(form.culturalPrefs));
      fd.append("languages", JSON.stringify(form.languages));
      fd.append("acceptingNewClients", String(form.acceptingNewClients));
      fd.append("arrangements", JSON.stringify(form.arrangements));

      for (const f of form.certificates) {
        fd.append("certificates", f);
      }

      if (form.profilePhoto) {
        fd.append("profilePhoto", form.profilePhoto);
      }

      let data: any = {};
      const res = await fetch("/api/therapists/signup", {
        method: "POST",
        body: fd,
      });

      try {
        data = await res.json();
      } catch {
        data = {};
      }

      if (!res.ok || !data.ok) {
        setSubmitMsg("");
        setErrors(data.errors ?? [data.error ?? "שגיאה לא ידועה"]);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      const warnings = Array.isArray(data.uploadWarnings)
        ? data.uploadWarnings
        : [];

      setErrors([]);
      setSubmitMsg(
        warnings.length > 0
          ? `הטופס נשלח, אבל יש בעיה בהעלאת חלק מהקבצים: ${warnings.join(
              " | "
            )}`
          : "נשלח בהצלחה! הפרטים נקלטו וממתינים לאישור."
      );

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      setSubmitMsg("");
      setErrors([err?.message ?? "שגיאה בשליחה"]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (showLanding) return <LandingScreen />;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-6">
        <Link
          href="/therapists"
          className="text-sm text-indigo-700 hover:underline"
        >
          ← חזרה לאזור מטפלים
        </Link>
        <h1 className="mt-3 text-3xl font-bold">הרשמה למאגר מטפלים</h1>
        <p className="mt-2 text-slate-800">
          מלא/י את הפרטים. לאחר שליחה הפרופיל יישמר וימתין לאישור ידני לפני
          פרסום.
        </p>
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
        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          {submitMsg}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-6">
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-bold">פרטים בסיסיים</h2>

          <label className="mt-4 block text-sm font-semibold">
            שם מלא <span className="text-red-500">*</span>
            <input
              className="mt-2 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200"
              value={form.fullName}
              onChange={(e) =>
                setForm((p) => ({ ...p, fullName: e.target.value }))
              }
              placeholder="לדוגמה: ד״ר ישראל ישראלי"
            />
          </label>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              כתובת מייל <span className="text-red-500">*</span>
              <input
                type="email"
                className="mt-2 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="example@gmail.com"
                inputMode="email"
              />
            </label>
            <label className="block text-sm font-semibold">
              טלפון סלולארי <span className="text-red-500">*</span>
              <input
                type="tel"
                className="mt-2 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="0501234567"
                inputMode="tel"
              />
            </label>
          </div>

          <div className="mt-4">
            <div className="text-sm font-semibold">מגדר</div>
            <div className="mt-2 flex flex-wrap gap-3">
              {(["זכר", "נקבה"] as Gender[]).map((g) => (
                <label key={g} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="gender"
                    checked={form.gender === g}
                    onChange={() => setForm((p) => ({ ...p, gender: g }))}
                  />
                  {g}
                </label>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-bold">הכשרת מטפל <span className="text-red-500">*</span></h2>
          <p className="mt-1 text-sm text-slate-800">אפשר לבחור כמה.</p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {THERAPIST_TYPES.map((t) => (
              <label key={t} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.therapistTypes.includes(t)}
                  onChange={() =>
                    setForm((p) => ({
                      ...p,
                      therapistTypes: toggleInArray(p.therapistTypes, t),
                    }))
                  }
                />
                <span>{t}</span>
              </label>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border bg-white p-6">
  <h2 className="text-lg font-bold">כמה מילים עליי <span className="text-red-500">*</span></h2>
  <p className="mt-1 text-sm text-slate-800">
    2–3 משפטים קצרים על סגנון העבודה, ניסיון או תחומי התמחות.
  </p>

  <label className="mt-4 block text-sm font-semibold">
    תיאור קצר
    <textarea
      className="mt-2 min-h-[120px] w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200"
      value={form.bio}
      onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
      maxLength={500}
      placeholder="לדוגמה: אני פסיכולוגית קלינית בעלת ניסיון בעבודה עם מתבגרים ומבוגרים. משלבת עבודה דינאמית עם כלים ממוקדי מטרה לפי הצורך. מאמינה בקשר טיפולי חם, מקצועי ומותאם אישית."
    />
  </label>

  <p className="mt-2 text-xs text-slate-700">
    {form.bio.length}/500 תווים
  </p>
</section>

        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-bold">השכלה והכשרה</h2>
          <p className="mt-1 text-sm text-slate-800">
            תארים, התמחויות, הכשרות רלוונטיות.
          </p>
          <textarea
            className="mt-4 min-h-[100px] w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
            value={form.education}
            onChange={(e) => setForm((p) => ({ ...p, education: e.target.value }))}
            placeholder="לדוגמה: תואר שני בפסיכולוגיה קלינית, אוניברסיטת תל אביב. התמחות במרכז לבריאות הנפש."
          />
        </section>

        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-bold">ניסיון מקצועי</h2>
          <p className="mt-1 text-sm text-slate-800">
            תפקידים, מסגרות עבודה, שנות ניסיון.
          </p>
          <textarea
            className="mt-4 min-h-[100px] w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
            value={form.experience}
            onChange={(e) => setForm((p) => ({ ...p, experience: e.target.value }))}
            placeholder="לדוגמה: 8 שנות ניסיון בטיפול פרטי עם מבוגרים. לשעבר: פסיכולוגית בקופת חולים מכבי."
          />
        </section>

        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-bold">תחומי הכשרה <span className="text-red-500">*</span></h2>
          <p className="mt-1 text-sm text-slate-800">אפשר לבחור כמה.</p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {TRAINING_AREAS.map((t) => (
              <label key={t} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.trainingAreas.includes(t)}
                  onChange={() =>
                    setForm((p) => {
                      const nextTrainingAreas = toggleInArray(p.trainingAreas, t);
                      const couplesWasChecked = p.trainingAreas.includes("טיפול זוגי");
                      const couplesNowChecked = nextTrainingAreas.includes("טיפול זוגי");
                      const playWasChecked = p.trainingAreas.includes("טיפול בהבעה ויצירה");
                      const playNowChecked = nextTrainingAreas.includes("טיפול בהבעה ויצירה");
                      return {
                        ...p,
                        trainingAreas: nextTrainingAreas,
                        couplesModalities: couplesWasChecked && !couplesNowChecked ? [] : p.couplesModalities,
                        playTherapyModalities: playWasChecked && !playNowChecked ? [] : p.playTherapyModalities,
                      };
                    })
                  }
                />
                <span>{t}</span>
              </label>
            ))}
          </div>

          {form.trainingAreas.includes("טיפול זוגי") && (
            <div className="mt-4 rounded-xl border bg-slate-50 p-4">
              <div className="text-sm font-semibold">סוג הטיפול הזוגי</div>
              <p className="mt-1 text-xs text-slate-800">אפשר לבחור כמה.</p>

              <div className="mt-3 flex flex-wrap gap-4">
                {COUPLES_MODALITIES.map((m) => (
                  <label key={m} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.couplesModalities.includes(m)}
                      onChange={() =>
                        setForm((p) => ({
                          ...p,
                          couplesModalities: toggleInArray(p.couplesModalities, m),
                        }))
                      }
                    />
                    {m}
                  </label>
                ))}
              </div>
            </div>
          )}

          {form.trainingAreas.includes("טיפול בהבעה ויצירה") && (
            <div className="mt-4 rounded-xl border bg-slate-50 p-4">
              <div className="text-sm font-semibold">סוג הטיפול בהבעה ויצירה</div>
              <p className="mt-1 text-xs text-slate-800">אפשר לבחור כמה.</p>

              <div className="mt-3 flex flex-wrap gap-4">
                {PLAY_THERAPY_MODALITIES.map((m) => (
                  <label key={m} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.playTherapyModalities.includes(m)}
                      onChange={() =>
                        setForm((p) => ({
                          ...p,
                          playTherapyModalities: toggleInArray(p.playTherapyModalities, m),
                        }))
                      }
                    />
                    {m}
                  </label>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-bold">קבוצות גיל</h2>
          <p className="mt-1 text-sm text-slate-800">אפשר לבחור כמה.</p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {AGE_GROUPS.map((item) => (
              <label key={item} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.ageGroups.includes(item)}
                  onChange={() =>
                    setForm((p) => ({
                      ...p,
                      ageGroups: toggleInArray(p.ageGroups, item),
                    }))
                  }
                />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-bold">האם עורך/ת אבחונים?</h2>
          <p className="mt-1 text-sm text-slate-800">
            אופציונלי. אם אינך עורך/ת אבחונים, אפשר להשאיר ריק.
          </p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {ASSESSMENT_TYPES.map((item) => (
              <label key={item} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.assessmentTypes.includes(item)}
                  onChange={() =>
                    setForm((p) => ({
                      ...p,
                      assessmentTypes: toggleInArray(p.assessmentTypes, item),
                    }))
                  }
                />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-bold">סגנון עבודה טיפולי <span className="text-red-500">*</span></h2>
          <p className="mt-1 text-sm text-slate-800">3 שאלות על הגישה הטיפולית שלך — ישמשו להתאמה אישיותית עם מטופלים</p>

          {/* T1 */}
          <div className="mt-5">
            <p className="text-sm font-semibold text-slate-800">בעבודתי הטיפולית, אני נוטה לראות בהבנה מעמיקה של שורשי הקושי, העבר והדפוסים הלא-מודעים מרכיב מרכזי בשינוי הטיפולי.</p>
            <p className="mt-1 text-xs text-slate-700">1 = בכלל לא מסכים/ה — עבודתי ממוקדת יותר בהקלה מיידית ובתפקוד &nbsp;|&nbsp; 7 = מסכים/ה מאוד — עבודתי מבוססת תובנה ועומק</p>
            <div className="mt-3 flex flex-wrap gap-4">
              {[1,2,3,4,5,6,7].map((num) => (
                <label key={num} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="styleQ1" checked={form.styleQ1 === num} onChange={() => setForm((p) => ({ ...p, styleQ1: num }))} />
                  {num}
                </label>
              ))}
            </div>
          </div>

          {/* T2 */}
          <div className="mt-5 border-t pt-5">
            <p className="text-sm font-semibold text-slate-800">בעבודתי הטיפולית, אני נוטה להציע למטופלים מסגרת ברורה, מטרות מוגדרות, כלים ומשימות בין פגישות.</p>
            <p className="mt-1 text-xs text-slate-700">1 = בכלל לא מסכים/ה — אני עובד/ת יותר במרחב פתוח וגמיש &nbsp;|&nbsp; 7 = מסכים/ה מאוד — אני עובד/ת באופן מובנה, מכוון ופרקטי</p>
            <div className="mt-3 flex flex-wrap gap-4">
              {[1,2,3,4,5,6,7].map((num) => (
                <label key={num} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="styleQ2" checked={form.styleQ2 === num} onChange={() => setForm((p) => ({ ...p, styleQ2: num }))} />
                  {num}
                </label>
              ))}
            </div>
          </div>

          {/* T3 */}
          <div className="mt-5 border-t pt-5">
            <p className="text-sm font-semibold text-slate-800">בטיפול, הסגנון הטבעי שלי הוא להיות פעיל/ה, מכוון/ת ומעורב/ת מילולית, יותר מאשר שקט/ה, מכיל/ה ומתבונן/ת.</p>
            <p className="mt-1 text-xs text-slate-700">1 = בכלל לא מסכים/ה — אני יותר מכיל/ה, שוהה ומתבונן/ת &nbsp;|&nbsp; 7 = מסכים/ה מאוד — אני יותר פעיל/ה, מכוון/ת ומעורב/ת</p>
            <div className="mt-3 flex flex-wrap gap-4">
              {[1,2,3,4,5,6,7].map((num) => (
                <label key={num} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="activityLevel" checked={form.activityLevel === num} onChange={() => setForm((p) => ({ ...p, activityLevel: num }))} />
                  {num}
                </label>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-bold">אזורי פעילות ואונליין <span className="text-red-500">*</span></h2>
          <p className="mt-1 text-sm text-slate-800">יש לבחור אזור פעילות אחד לפחות, או לסמן שעובד/ת אונליין (אפשר גם שניהם).</p>

          <div className="mt-4">
            <div className="text-sm font-semibold mb-2">האם עובד/ת גם אונליין?</div>
            <div className="flex gap-4 text-sm">
              {(["כן", "לא"] as const).map((x) => (
                <label key={x} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="online"
                    checked={form.online === x}
                    onChange={() => setForm((p) => ({ ...p, online: x }))}
                  />
                  {x}
                </label>
              ))}
            </div>
          </div>

          <div className={`mt-5 ${form.online === "כן" ? "opacity-60" : ""}`}>
            <div className="text-sm font-semibold mb-1">
              ערים / אזורים פיזיים
              {form.online === "כן" && <span className="mr-2 text-xs font-normal text-slate-700">(אופציונלי — כבר סימנת אונליין)</span>}
            </div>
            <p className="text-xs text-slate-700 mb-3">אפשר לבחור עד 3 ערים.</p>
            <div className="space-y-4">
              {Object.entries(REGION_CITIES).map(([region, cities]) => (
                <div key={region}>
                  <p className="mb-1 text-xs font-bold text-slate-700 uppercase tracking-wide">{region}</p>
                  <div className="grid gap-1 sm:grid-cols-3">
                    {cities.map((city) => {
                      const checked = form.regions.includes(city);
                      const disabled = !checked && regionLimitReached;
                      return (
                        <label
                          key={city}
                          className={`flex items-center gap-2 text-sm ${disabled ? "opacity-40" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() =>
                              setForm((p) => ({
                                ...p,
                                regions: toggleInArray(p.regions, city).slice(0, 3),
                              }))
                            }
                          />
                          <span>{city}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {regionLimitReached && (
              <p className="mt-3 text-xs text-slate-700">
                בחרת כבר 3 ערים. כדי לבחור עיר אחרת—בטל אחת.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-bold">התאמות תרבותיות</h2>
          <p className="mt-1 text-sm text-slate-800">אפשר לבחור כמה.</p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {CULTURAL_PREFS.map((item) => (
              <label key={item} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.culturalPrefs.includes(item)}
                  onChange={() =>
                    setForm((p) => ({
                      ...p,
                      culturalPrefs: toggleInArray(p.culturalPrefs, item),
                    }))
                  }
                />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-bold">שפות טיפול</h2>
          <p className="mt-1 text-sm text-slate-800">אפשר לבחור כמה.</p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {LANGUAGES.map((item) => (
              <label key={item} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.languages.includes(item)}
                  onChange={() =>
                    setForm((p) => ({
                      ...p,
                      languages: toggleInArray(p.languages, item),
                    }))
                  }
                />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-bold">
            האם מקבל/ת כרגע מטופלים חדשים?
          </h2>

          <div className="mt-4 flex gap-4 text-sm">
            {[true, false].map((value) => (
              <label key={String(value)} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="acceptingNewClients"
                  checked={form.acceptingNewClients === value}
                  onChange={() =>
                    setForm((p) => ({
                      ...p,
                      acceptingNewClients: value,
                    }))
                  }
                />
                {value ? "כן" : "לא"}
              </label>
            ))}
          </div>
        </section>

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
          <p className="mt-2 text-xs text-slate-700">אפשר להשאיר ריק בשלב זה.</p>
        </section>

        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-bold">הסדרים</h2>
          <p className="mt-1 text-sm text-slate-800">אפשר לסמן כמה.</p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {ARRANGEMENTS.map((t) => (
              <label key={t} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.arrangements.includes(t)}
                  onChange={() =>
                    setForm((p) => ({
                      ...p,
                      arrangements: toggleInArray(p.arrangements, t),
                    }))
                  }
                />
                <span>{t}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-bold">תמונת פרופיל (אופציונלי)</h2>
          <p className="mt-1 text-sm text-slate-800">
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

            <span className="text-sm text-slate-700">
              {form.profilePhoto
                ? `נבחרה: ${form.profilePhoto.name}`
                : "לא נבחרה תמונה"}
            </span>
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-bold">העלאת תעודות <span className="text-red-500">*</span></h2>
          <p className="mt-1 text-sm text-slate-800">
            חובה לצרף לפחות תעודה אחת. ניתן להעלות PDF/JPG/PNG. מומלץ עד 10MB לקובץ.
          </p>

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

            <span className="text-sm text-slate-700">
              {form.certificates.length > 0
                ? `נבחרו ${form.certificates.length} קבצים`
                : "לא נבחרו קבצים"}
            </span>
          </div>

          {form.certificates.length > 0 && (
            <ul className="mt-4 list-disc pr-5 text-sm text-slate-800">
              {form.certificates.map((f, index) => (
                <li key={`${f.name}-${index}`}>{f.name}</li>
              ))}
            </ul>
          )}
        </section>

        <div className="rounded-2xl border border-stone-200 bg-stone-50 p-5 mb-2">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.termsAccepted}
              onChange={(e) => setForm((p) => ({ ...p, termsAccepted: e.target.checked }))}
              className="mt-1 h-4 w-4 flex-shrink-0 accent-indigo-600"
            />
            <span className="text-sm leading-6 text-stone-700">
              אני מאשר/ת שאני בעל/ת רישיון מקצועי תקף, שהפרטים שמסרתי נכונים, ושאעמוד ב
              <a href="/terms" target="_blank" className="text-indigo-600 hover:underline mx-1">תנאי השימוש</a>
              של טיפול חכם.
            </span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className={`rounded-xl px-5 py-3 font-semibold text-white ${
              isSubmitting
                ? "cursor-not-allowed bg-slate-400"
                : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {isSubmitting ? "שולח..." : "שליחת טופס"}
          </button>

          {isSubmitting && (
  <span className="text-sm text-slate-700">
    הטופס נשלח כעת, נא להמתין...
  </span>
)}
        </div>
      </form>
    </main>
  );
}