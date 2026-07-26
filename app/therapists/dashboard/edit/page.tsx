"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabaseClient";
import {
  THERAPIST_TYPES, TRAINING_AREAS, ASSESSMENT_TYPES,
  AGE_GROUPS, LANGUAGES, CULTURAL_PREFS, ARRANGEMENTS,
  COUPLES_MODALITIES, PLAY_THERAPY_MODALITIES,
  COGFUN_AGE_GROUPS, THERAPIST_TYPE_TO_TRAINING,
} from "@/app/lib/therapist-options";
import RegionCityPicker from "@/app/components/RegionCityPicker";
import { isPromoActive, SUBSCRIPTION_PROMO_PRICE, SUBSCRIPTION_PROMO_MONTHS, SUBSCRIPTION_REGULAR_PRICE } from "@/app/lib/promo";
import { ATTRIBUTION_HEADER, getAttributionHeaderValue } from "@/app/lib/attribution";
import { gaEvent } from "@/app/lib/gtag";

const PLAY_MODALITIES_SET = new Set<string>(PLAY_THERAPY_MODALITIES);

type Profile = {
  id: string;
  full_name: string;
  status: string;
  rejection_reason?: string | null;
  profile_photo_path?: string;
};

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

export default function TherapistProfileEditPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [saveErr, setSaveErr] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [existingCerts, setExistingCerts] = useState<Array<{ id: string; original_name: string; signed_url: string | null }>>([]);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showPlanChoice, setShowPlanChoice] = useState(false);

  const [form, setForm] = useState({
    full_name: "", phone: "", bio: "", gender: "", online: false,
    accepting_new_patients: true,
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
    async function loadProfile(session: { access_token: string }) {
      setToken(session.access_token);
      // Signup attribution rides along: consumed by the server only when this
      // GET creates the stub row (a fresh registrant can land here directly).
      const attHeader = getAttributionHeaderValue();
      const res = await fetch("/api/therapist-profile", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          ...(attHeader ? { [ATTRIBUTION_HEADER]: attHeader } : {}),
        },
      });
      const json = await res.json();

      if (json.therapist) {
        setProfile(json.therapist);
        // A stub row (auto-created at first login) is still a NEW profile from
        // the therapist's point of view - keep the welcome banner.
        if (!(json.therapist.full_name ?? "").trim()) setIsNew(true);
        if (json.photoUrl) setProfilePhotoUrl(json.photoUrl);
        if (Array.isArray(json.certificates)) setExistingCerts(json.certificates);
        setForm({
          full_name: json.therapist.full_name ?? "",
          phone: json.therapist.phone ?? "",
          bio: json.therapist.bio ?? "",
          gender: json.therapist.gender ?? "",
          online: json.therapist.online ?? false,
          accepting_new_patients: json.therapist.accepting_new_patients ?? true,
          therapist_types: json.therapist.therapist_types ?? [],
          training_areas: (json.therapist.training_areas ?? []).filter((a: string) => !PLAY_MODALITIES_SET.has(a)),
          couples_modalities: json.therapist.couples_modalities ?? [],
          play_therapy_modalities: (json.therapist.training_areas ?? []).filter((a: string) => PLAY_MODALITIES_SET.has(a)),
          cogfun_age_groups: json.therapist.cogfun_age_groups ?? [],
          assessment_types: json.therapist.assessment_types ?? [],
          regions: json.therapist.regions ?? [],
          cultural_prefs: json.therapist.cultural_prefs ?? [],
          arrangements: json.therapist.arrangements ?? [],
          age_groups: json.therapist.age_groups ?? [],
          languages: json.therapist.languages ?? [],
          style_q1: json.therapist.style_q1 ?? null,
          style_q2: json.therapist.style_q2 ?? null,
          education: json.therapist.education ?? "",
          experience: json.therapist.experience ?? "",
          activity_level: json.therapist.activity_level ?? null,
        });
      } else {
        setIsNew(true);
      }
      setLoading(false);
    }

    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) await loadProfile(session);
      else window.location.href = "/therapists/login";
    }
    init();
  }, []);

  // Downscale a large image in the browser so it stays well under Vercel's
  // ~4.5MB request-body cap before going through /api/therapist-upload. Only
  // kicks in for oversized files, so normal photos are untouched.
  async function downscaleImage(file: File): Promise<File> {
    if (!file.type.startsWith("image/") || file.size <= 4 * 1024 * 1024) return file;
    try {
      const url = URL.createObjectURL(file);
      const img = document.createElement("img");
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("load failed"));
        img.src = url;
      });
      const maxDim = 1200;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const scale = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); return file; }
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
      if (!blob) return file;
      return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
    } catch {
      return file;
    }
  }

  async function uploadFile(file: File, type: "photo" | "certificate", accessToken: string): Promise<string | null> {
    // Certificates can be large PDFs/scans - upload them straight to Supabase
    // Storage via a signed URL so the bytes bypass the Vercel function (whose
    // ~4.5MB body cap was returning 413). Photos keep going through the route
    // (which compresses them server-side), with a client downscale as a guard.
    if (type === "certificate") {
      const ext = (file.name.split(".").pop() ?? "").toLowerCase();
      const headers = { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` };
      const signRes = await fetch("/api/therapist-cert", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "sign", ext, contentType: file.type, size: file.size }),
      });
      const sign = await signRes.json().catch(() => ({}));
      if (!signRes.ok || !sign.ok) return sign.error ?? `שגיאה בהכנת העלאת תעודה (${signRes.status})`;

      const { error: upErr } = await supabase.storage
        .from("therapist-certificates")
        .uploadToSignedUrl(sign.path, sign.token, file, { contentType: file.type || undefined });
      if (upErr) return `שגיאה בהעלאת תעודה: ${upErr.message}`;

      const commitRes = await fetch("/api/therapist-cert", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "commit", path: sign.path, name: file.name, contentType: file.type, size: file.size }),
      });
      const commit = await commitRes.json().catch(() => ({}));
      if (!commitRes.ok || !commit.ok) return commit.error ?? `שגיאה בשמירת תעודה (${commitRes.status})`;
      return null;
    }

    const toSend = await downscaleImage(file);
    const fd = new FormData();
    fd.append("file", toSend);
    fd.append("type", type);
    const res = await fetch("/api/therapist-upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: fd,
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      return json.error ?? `שגיאה בהעלאת ${type === "photo" ? "תמונה" : "תעודה"} (${res.status})`;
    }
    return null;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg("");
    setSaveErr("");

    // Fetch a FRESH token at submit time. The token captured at page load can
    // expire while a therapist fills the (long) form - Supabase JWTs last ~1h -
    // which previously surfaced as a raw "Unauthorized" on save. getSession()
    // returns the auto-refreshed token held by the client.
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    if (!accessToken) {
      setSaveErr("פג תוקף החיבור. רענן/י את העמוד והתחבר/י מחדש, והפרטים יישמרו.");
      setSaving(false);
      return;
    }
    setToken(accessToken);

    const { play_therapy_modalities, cogfun_age_groups, ...rest } = form;
    const patchBody = {
      ...rest,
      training_areas: [...form.training_areas, ...play_therapy_modalities],
      cogfun_age_groups,
    };
    const res = await fetch("/api/therapist-profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(patchBody),
    });
    const json = await res.json();
    if (!json.ok) {
      setSaveErr(json.error === "Unauthorized" ? "פג תוקף החיבור. רענן/י את העמוד והתחבר/י מחדש." : (json.error ?? "שגיאה בשמירה"));
      setSaving(false);
      return;
    }

    // The profile itself is already saved (PATCH succeeded). File uploads are
    // best-effort from here: a failed upload must NOT hide the save or block
    // the flow - we keep the failed file selected for an easy retry and surface
    // a clear, non-blocking note (the admin can also request completion later).
    let photoErr: string | null = null;
    let certErr: string | null = null;
    if (photoFile || certFile) {
      setUploading(true);
      if (photoFile) photoErr = await uploadFile(photoFile, "photo", accessToken);
      if (certFile) certErr = await uploadFile(certFile, "certificate", accessToken);
      setUploading(false);
    }
    if (!photoErr) { setPhotoFile(null); setPhotoPreview(null); }
    if (!certErr) setCertFile(null);

    // Refresh the stored photo URL + cert list from the server so the therapist
    // immediately SEES the new photo/cert. Previously the preview reverted to
    // the old page-load image after a successful upload, so people thought it
    // failed and re-uploaded repeatedly (one uploaded the same photo 5×).
    if ((photoFile && !photoErr) || (certFile && !certErr)) {
      try {
        const refetch = await fetch("/api/therapist-profile", {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        });
        const rj = await refetch.json();
        if (rj.ok) {
          if (rj.photoUrl) setProfilePhotoUrl(rj.photoUrl);
          if (Array.isArray(rj.certificates)) setExistingCerts(rj.certificates);
        }
      } catch {
        // Non-blocking - the save/upload already succeeded; only the on-screen
        // preview refresh failed.
      }
    }

    const base = json.created ? "הפרופיל נוצר בהצלחה! הוא ממתין לאישור." : "הפרטים עודכנו בהצלחה.";
    const uploadIssues = [photoErr, certErr].filter(Boolean) as string[];
    setIsNew(false);
    if (uploadIssues.length) {
      setSaveMsg("");
      setSaveErr(`${base} שימו לב: העלאת הקובץ לא הושלמה (${uploadIssues.join("; ")}). אפשר לנסות שוב בכל עת - הפרטים כבר נשמרו.`);
    } else {
      setSaveErr("");
      setSaveMsg(base);
    }

    // First-time registration: let the therapist pick a plan before finishing -
    // even if a file upload failed, since the profile was created.
    if (json.created) {
      // GA4 conversion: the therapist finished registration (profile created).
      // This is the mid-funnel signal Google Ads (Demand Gen) needs to optimize
      // toward - ad clicks alone can't train it. Fires once (json.created is true
      // only on first creation) and before the promoted-CTA early return below,
      // so both plan paths are counted. Mark "therapist_registration" as a Key
      // Event in the GA4 admin UI to import it as an Ads conversion.
      gaEvent("therapist_registration");

      // Came in via the "promoted" CTA (join page → register → here): the plan
      // is already chosen, so skip the plan-choice screen and go to checkout.
      if (new URLSearchParams(window.location.search).get("plan") === "promoted") {
        window.location.href = "/therapists/checkout";
        return;
      }
      setShowPlanChoice(true);
      setSaving(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    setSaving(false);
  }

  const promo = isPromoActive();

  if (loading) return <div className="p-10 text-center">טוען...</div>;

  // ── Plan choice - shown right after the first profile submission ──
  if (showPlanChoice) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-12 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');`}</style>

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-green-100 text-green-800 px-4 py-1.5 text-sm font-bold mb-4">
            ✓ הפרופיל נשלח
          </div>
          <h1 className="text-2xl font-black text-stone-900 mb-2">נותר רק לבחור מסלול</h1>
          <p className="text-stone-600 leading-7">הפרופיל שלך נשמר וממתין לאישור. בחר/י איך תופיע/י באתר - תמיד אפשר לשנות מאוחר יותר מלוח הבקרה.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Free */}
          <div className="rounded-2xl border border-[#E8E0D8] bg-white p-6 flex flex-col">
            <span className="text-xs font-black rounded-full px-2.5 py-1 bg-green-100 text-green-800 self-start mb-3">חינמי</span>
            <h2 className="text-lg font-bold text-stone-900 mb-1">מסלול חינמי</h2>
            <p className="text-2xl font-black text-stone-800 mb-4">₪0 <span className="text-sm font-normal text-stone-500">/ לתמיד</span></p>
            <ul className="space-y-2 text-sm text-stone-700 leading-6 flex-1">
              <li className="flex items-start gap-2"><span className="text-green-600 font-bold mt-0.5">✓</span> דף פרופיל אישי נגיש לכל מי שמחפש מטפלים</li>
              <li className="flex items-start gap-2"><span className="text-green-600 font-bold mt-0.5">✓</span> חיפוש לפי מיקום - אזור או עיר</li>
              <li className="flex items-start gap-2 text-stone-400"><span className="text-stone-300 mt-0.5">✗</span> מערכת ההתאמה החכמה וסטטיסטיקות</li>
            </ul>
            <button onClick={() => { window.location.href = "/therapists/dashboard"; }}
              className="mt-6 w-full rounded-xl border-2 border-stone-300 bg-white px-6 py-3 text-sm font-bold text-stone-700 hover:bg-stone-50 hover:border-stone-400">
              פרסום במסלול החינמי
            </button>
          </div>

          {/* Promoted */}
          <div className="rounded-2xl border-2 border-[#1A7A96] p-6 flex flex-col relative" style={{ background: "linear-gradient(160deg,#f0f9fb,#e6f4f7)" }}>
            <span className="text-xs font-black rounded-full px-2.5 py-1 bg-yellow-100 text-yellow-800 border border-yellow-300 self-start mb-3">★ מקודם</span>
            <h2 className="text-lg font-bold text-[#1a4a5c] mb-1">מסלול מקודם</h2>
            {promo ? (
              <>
                <p className="text-xl font-black text-[#0F5468] mb-1">
                  מבצע פתיחה - ₪{SUBSCRIPTION_PROMO_PRICE} + מע&quot;מ <span className="text-sm font-normal">/ לחודש</span>
                </p>
                <p className="text-xs text-[#0F5468]/70 mb-1">
                  ל-{SUBSCRIPTION_PROMO_MONTHS} החודשים הראשונים, ולאחר מכן ₪{SUBSCRIPTION_REGULAR_PRICE} + מע&quot;מ
                </p>
              </>
            ) : (
              <p className="text-xl font-black text-[#0F5468] mb-1">₪{SUBSCRIPTION_REGULAR_PRICE} + מע&quot;מ <span className="text-sm font-normal">/ לחודש</span></p>
            )}
            <div className="mb-4 rounded-lg bg-[#0F5468]/8 border border-[#0F5468]/15 px-3 py-2">
              <p className="text-sm font-black text-[#0F5468] leading-6">
                ללא סיכון - החזר כספי מלא אם לא תקבל/י פנייה<sup className="font-black">*</sup> בחודשיים הקרובים
              </p>
              <p className="mt-1 text-[11px] text-[#0F5468]/70 leading-5">
                <span className="font-bold">* פנייה</span> = קבלת מטופל בקליניקה. מבוסס על אמון מול המטפל.
              </p>
            </div>
            <ul className="space-y-2 text-sm leading-6 flex-1" style={{ color: "#1a4a5c" }}>
              <li className="flex items-start gap-2"><span className="font-bold mt-0.5 text-[#0F5468]">✓</span> כל מה שבחינמי + הופעה במערכת ההתאמה החכמה</li>
              <li className="flex items-start gap-2"><span className="font-bold mt-0.5 text-[#0F5468]">✓</span> דו&quot;ח צפיות, פילוח פונים ואחוזי המרה</li>
              <li className="flex items-start gap-2"><span className="font-bold mt-0.5 text-[#0F5468]">✓</span> השוואה לממוצע המטפלים באתר</li>
            </ul>
            <button onClick={() => { window.location.href = "/therapists/checkout"; }}
              className="mt-6 w-full rounded-xl px-6 py-3 text-sm font-bold text-white hover:opacity-95"
              style={{ background: "linear-gradient(135deg,#0F5468,#1A7A96)" }}>
              הצטרפות למסלול המקודם
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');`}</style>

      {/* Header */}
      <div className="mb-6">
        <Link href="/therapists/dashboard" className="text-sm text-[#2e7d8c] hover:underline">← חזרה ללוח הבקרה</Link>
        <h1 className="mt-2 text-2xl font-black text-stone-900">עריכת הפרטים האישיים</h1>
        <p className="text-sm text-stone-500 mt-0.5">עדכון הפרופיל המקצועי שלך. שינויים נשמרים מיד עם הלחיצה על &quot;שמור פרטים&quot;.</p>
      </div>

      {/* Rejection notice - reason + how to re-submit */}
      {profile?.status === "rejected" && (
        <div className="mb-6 rounded-2xl bg-red-50 border border-red-200 px-5 py-4">
          <h2 className="text-sm font-extrabold text-red-800 mb-1">הפרופיל לא אושר</h2>
          {profile.rejection_reason ? (
            <p className="text-sm text-red-700 leading-6">סיבה: {profile.rejection_reason}</p>
          ) : (
            <p className="text-sm text-red-700 leading-6">הפרופיל לא אושר במתכונתו הנוכחית.</p>
          )}
          <p className="text-sm text-red-700 leading-6 mt-1">
            עדכן/י את הפרטים והעלה/י תעודת רישיון ברורה וקריאה, ולחץ/י &quot;שמור פרטים&quot; - הפרופיל יישלח שוב לאישור.
          </p>
        </div>
      )}

      {isNew && (
        <div className="mb-6 rounded-2xl bg-blue-50 border border-blue-200 px-5 py-4 text-sm text-blue-800">
          ברוך הבא! מלא את הפרטים שלך ולחץ שמור - הפרופיל יישלח לאישור.
        </div>
      )}

      {/* Form */}
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
              <label className="mb-1 block text-sm font-semibold text-stone-700">טלפון</label>
              <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#2e7d8c]" />
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
            <div className="flex items-center gap-2 pt-6">
              <input type="checkbox" id="online" checked={form.online}
                onChange={e => setForm({...form, online: e.target.checked})} />
              <label htmlFor="online" className="text-sm font-semibold text-stone-700">מטפל/ת אונליין</label>
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-sm font-semibold text-stone-700">ביוגרפיה קצרה</label>
            <textarea value={form.bio} onChange={e => setForm({...form, bio: e.target.value})}
              rows={4} className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#2e7d8c]"
              placeholder="ספר/י על עצמך, הגישה הטיפולית שלך, ומה מייחד אותך..." />
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

        {/* Availability - pausing new patient inquiries without leaving the directory */}
        <div className={`rounded-2xl border p-6 ${!form.accepting_new_patients ? "border-amber-300 bg-amber-50" : "border-[#E8E0D8] bg-white"}`}>
          <h2 className="text-lg font-extrabold text-stone-900 mb-3">זמינות לקבלת מטופלים</h2>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" className="mt-1" checked={!form.accepting_new_patients}
              onChange={e => setForm({ ...form, accepting_new_patients: !e.target.checked })} />
            <span>
              <span className="block text-sm font-bold text-stone-800">כעת לא זמין/ה לקבלת מטופלים / אבחונים חדשים</span>
              <span className="mt-1 block text-xs leading-5 text-stone-500">
                כשמסומן: הפרופיל נשאר גלוי במאגר המטפלים, אבל לא יוצע בהתאמות חדשות ולא ניתן יהיה לשלוח
                אליך פניות דרך האתר. אפשר לבטל את הסימון בכל רגע - כשמתפנה מקום, פשוט חוזרים לקבל פניות.
              </span>
            </span>
          </label>
          {!form.accepting_new_patients && (
            <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-amber-700 border border-amber-200">
              ⏸ הפרופיל מסומן כלא זמין - מטופלים חדשים יופנו למטפלים אחרים עד שתחזרו לזמינות.
            </p>
          )}
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
            <p className="mb-3 text-xs text-stone-500">בחר/י אזור כדי לפתוח את רשימת הערים. ניתן לבחור עד 3 ערים.</p>
            <RegionCityPicker selected={form.regions} onChange={v => setForm({...form, regions: v})} maxCities={3} />
          </div>
          <CheckboxGroup label="העדפות תרבותיות" options={CULTURAL_PREFS}
            selected={form.cultural_prefs} onChange={v => setForm({...form, cultural_prefs: v})} />
          <CheckboxGroup label="הסדרים" options={ARRANGEMENTS}
            selected={form.arrangements} onChange={v => setForm({...form, arrangements: v})} />
        </div>

        <div className="rounded-2xl border border-[#E8E0D8] bg-white p-6">
          <h2 className="text-lg font-extrabold text-stone-900 mb-1">סגנון טיפולי</h2>
          <p className="text-xs text-stone-500 mb-5">3 שאלות על הגישה הטיפולית שלך - ישמשו להתאמה אישיותית עם מטופלים</p>
          <StyleQuestion
            name="style_q1"
            question="בעבודתי הטיפולית, אני נוטה לראות בהבנה מעמיקה של שורשי הקושי, העבר והדפוסים הלא-מודעים מרכיב מרכזי בשינוי הטיפולי."
            hint="1 = בכלל לא מסכים/ה - עבודתי ממוקדת יותר בהקלה מיידית ובתפקוד | 7 = מסכים/ה מאוד - עבודתי מבוססת תובנה ועומק"
            value={form.style_q1}
            onChange={v => setForm({...form, style_q1: v})}
          />
          <StyleQuestion
            name="style_q2"
            question="בעבודתי הטיפולית, אני נוטה להציע למטופלים מסגרת ברורה, מטרות מוגדרות, כלים ומשימות בין פגישות."
            hint="1 = בכלל לא מסכים/ה - אני עובד/ת יותר במרחב פתוח וגמיש | 7 = מסכים/ה מאוד - אני עובד/ת באופן מובנה, מכוון ופרקטי"
            value={form.style_q2}
            onChange={v => setForm({...form, style_q2: v})}
          />
          <StyleQuestion
            name="activity_level"
            question="בטיפול, הסגנון הטבעי שלי הוא להיות פעיל/ה, מכוון/ת ומעורב/ת מילולית, יותר מאשר שקט/ה, מכיל/ה ומתבונן/ת."
            hint="1 = בכלל לא מסכים/ה - אני יותר מכיל/ה, שוהה ומתבונן/ת | 7 = מסכים/ה מאוד - אני יותר פעיל/ה, מכוון/ת ומעורב/ת"
            value={form.activity_level}
            onChange={v => setForm({...form, activity_level: v})}
          />
        </div>

        <div className="rounded-2xl border border-[#E8E0D8] bg-white p-6">
          <h2 className="text-lg font-extrabold text-stone-900 mb-5">תמונה ומסמכים</h2>

          <div className="mb-5">
            <div className="mb-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800">
              פרופילים עם תמונה מקבלים פניות רבות באופן משמעותי. מומלץ להוסיף תמונה.
            </div>
            <label className="mb-1 block text-sm font-semibold text-stone-700">תמונת פרופיל <span className="text-stone-400 font-normal">(רשות)</span></label>
            {(photoPreview || profilePhotoUrl) && (
              <img
                src={photoPreview || profilePhotoUrl!}
                alt="תמונה"
                className="mb-2 h-20 w-20 rounded-xl object-cover border border-stone-200" />
            )}
            <input type="file" accept="image/*"
              onChange={e => {
                const f = e.target.files?.[0] ?? null;
                setPhotoFile(f);
                if (f) setPhotoPreview(URL.createObjectURL(f));
              }}
              className="w-full text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold hover:file:bg-stone-200" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-stone-700">תעודת רישיון / אישור מקצועי <span className="text-red-500">*</span></label>
            <p className="mb-2 text-xs text-stone-500">יש להוסיף תעודת רישיון מטפל או תעודה המוכיחה את המקצוע</p>
            {existingCerts.length > 0 && (
              <div className="mb-2 rounded-lg border border-stone-200 bg-stone-50 p-2.5">
                <div className="mb-1.5 text-xs font-semibold text-stone-600">תעודות שכבר הועלו:</div>
                <ul className="flex flex-wrap gap-1.5">
                  {existingCerts.map(c => (
                    <li key={c.id}>
                      {c.signed_url ? (
                        <a href={c.signed_url} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-[#2e7d8c] bg-white px-2.5 py-1 text-xs font-medium text-[#2e7d8c] hover:bg-[#2e7d8c] hover:text-white transition-colors">
                          📄 {c.original_name}
                        </a>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2.5 py-1 text-xs text-stone-400">
                          📄 {c.original_name}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-[11px] text-stone-400">העלאת קובץ חדש תתווסף לתעודות הקיימות (לא תחליף אותן). להסרת תעודה שגויה - פנו אלינו ב-admin@getmentalytics.com.</p>
              </div>
            )}
            <input type="file" accept=".pdf,.jpg,.jpeg,.png"
              onChange={e => setCertFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold hover:file:bg-stone-200" />
          </div>
        </div>

        {saveMsg && <p className="text-sm text-emerald-600 font-semibold">{saveMsg}</p>}
        {saveErr && <p className="text-sm text-red-600">{saveErr}</p>}

        <div className="flex gap-3">
          <button type="submit" disabled={saving}
            className="flex-1 rounded-xl bg-[#2e7d8c] py-3 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50">
            {uploading ? "מעלה קבצים..." : saving ? "שומר..." : "שמור פרטים"}
          </button>
          <Link href="/therapists/dashboard"
            className="rounded-xl border border-stone-300 bg-white px-5 py-3 text-sm font-bold text-stone-700 hover:bg-stone-50 flex items-center">
            חזרה
          </Link>
        </div>
      </form>
    </main>
  );
}
