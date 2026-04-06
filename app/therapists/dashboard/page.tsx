"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { REGION_CITIES } from "@/app/lib/regions";

const ALL_CITIES = Object.values(REGION_CITIES).flat();

const THERAPIST_TYPES = [
  "פסיכולוג קליני","פסיכולוג חינוכי","פסיכולוג שיקומי/רפואי","פסיכולוג התפתחותי",
  "פסיכולוג תעסוקתי","יועצ/ת חינוכי",'עו"ס קליני',"מטפל/ת בהבעה ויצירה",
  "מטפל מיני","קרימינולוג קליני","פיזיותרפיסט/ית",
];
const TRAINING_AREAS = [
  "טיפול דינאמי","CBT","ACT","EMDR","DBT","הדרכת הורים","טיפול דיאדי",
  "טיפול משפחתי","טיפול בהבעה ויצירה","ריפוי בעיסוק","טיפול תעסוקתי",
  "קבוצה חברתית","טיפול זוגי","טיפול בהתמכרויות","טיפול מיני",
  "טיפול COG-FUN לקשיי קשב וריכוז","טיפול בטראומה","פסיכואנליזה",
];
const ASSESSMENT_TYPES = [
  "פסיכו-דידקטי","פסיכו-דיאגנוסטי","נוירו-פסיכולוגי","אבחון תעסוקתי",
  "הערכה פסיכולוגית","הערכת בשלות לגן","אבחון קשיי תקשורת ASD",
];
const CULTURAL_PREFS = [
  "היכרות עם העולם הדתי","היכרות עם העולם החרדי",'היכרות עם עולם הלהט"ב',
];
const ARRANGEMENTS = [
  "קופות החולים","משרד הביטחון","ביטוח לאומי","ביטוחים פרטיים",
];

type Profile = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  bio: string;
  gender: string;
  online: boolean;
  therapist_types: string[];
  training_areas: string[];
  assessment_types: string[];
  regions: string[];
  cultural_prefs: string[];
  arrangements: string[];
  status: string;
  tier: string;
  profile_photo_url?: string;
  certificate_url?: string;
};

function CheckboxGroup({ label, options, selected, onChange }: {
  label: string; options: string[]; selected: string[];
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

export default function TherapistDashboard() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [saveErr, setSaveErr] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Form state
  const [form, setForm] = useState({
    full_name: "", phone: "", bio: "", gender: "", online: false,
    therapist_types: [] as string[], training_areas: [] as string[],
    assessment_types: [] as string[], regions: [] as string[],
    cultural_prefs: [] as string[], arrangements: [] as string[],
  });

  useEffect(() => {
    async function loadProfile(session: { access_token: string; user: { email?: string } }) {
      setToken(session.access_token);
      setUserEmail(session.user.email ?? "");

      const res = await fetch("/api/therapist-profile", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();

      if (json.therapist) {
        setProfile(json.therapist);
        setForm({
          full_name: json.therapist.full_name ?? "",
          phone: json.therapist.phone ?? "",
          bio: json.therapist.bio ?? "",
          gender: json.therapist.gender ?? "",
          online: json.therapist.online ?? false,
          therapist_types: json.therapist.therapist_types ?? [],
          training_areas: json.therapist.training_areas ?? [],
          assessment_types: json.therapist.assessment_types ?? [],
          regions: json.therapist.regions ?? [],
          cultural_prefs: json.therapist.cultural_prefs ?? [],
          arrangements: json.therapist.arrangements ?? [],
        });
      } else {
        setIsNew(true);
      }
      setLoading(false);
    }

    async function init() {
      // Session is stored in localStorage by /auth/callback after PKCE exchange
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await loadProfile(session);
      } else {
        window.location.href = "/therapists/login";
      }
    }

    init();

    // Listen only for sign-out
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        window.location.href = "/therapists/login";
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function uploadFile(file: File, type: "photo" | "certificate") {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", type);
    await fetch("/api/therapist-upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setSaveMsg("");
    setSaveErr("");

    // Upload files if selected
    if (photoFile || certFile) {
      setUploading(true);
      if (photoFile) await uploadFile(photoFile, "photo");
      if (certFile) await uploadFile(certFile, "certificate");
      setUploading(false);
    }

    const res = await fetch("/api/therapist-profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (json.ok) {
      setSaveMsg(json.created ? "הפרופיל נוצר בהצלחה! הוא ממתין לאישור." : "הפרטים עודכנו בהצלחה.");
      setIsNew(false);
      setPhotoFile(null);
      setCertFile(null);
      const res2 = await fetch("/api/therapist-profile", { headers: { Authorization: `Bearer ${token}` } });
      const json2 = await res2.json();
      if (json2.therapist) setProfile(json2.therapist);
    } else {
      setSaveErr(json.error ?? "שגיאה בשמירה");
    }
    setSaving(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/therapists/login";
  }

  if (loading) return <div className="p-10 text-center">טוען...</div>;

  const statusLabel = profile?.status === "approved" ? { text: "מאושר ומופיע במאגר", color: "bg-green-100 text-green-800" }
    : profile?.status === "rejected" ? { text: "נדחה", color: "bg-red-100 text-red-800" }
    : { text: "ממתין לאישור", color: "bg-yellow-100 text-yellow-800" };

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');`}</style>

      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-stone-900">לוח הבקרה שלי</h1>
          <p className="text-sm text-stone-500 mt-0.5">{userEmail}</p>
        </div>
        <button onClick={handleLogout}
          className="text-xs text-stone-500 underline hover:text-stone-700">
          התנתק
        </button>
      </div>

      {/* Status banner */}
      {profile && (
        <div className={`mb-6 flex items-center justify-between rounded-2xl px-5 py-4 ${statusLabel.color}`}>
          <div>
            <div className="font-bold text-sm">סטטוס: {statusLabel.text}</div>
            {profile.tier === "paid" && (
              <div className="text-xs mt-0.5 font-semibold">⭐ פרופיל מקודם</div>
            )}
          </div>
          {profile.status === "approved" && profile.tier === "free" && (
            <button className="rounded-xl bg-white/80 border border-current px-3 py-1.5 text-xs font-bold opacity-60 cursor-not-allowed">
              שדרג לקידום (בקרוב)
            </button>
          )}
        </div>
      )}

      {isNew && (
        <div className="mb-6 rounded-2xl bg-blue-50 border border-blue-200 px-5 py-4 text-sm text-blue-800">
          ברוך הבא! מלא את הפרטים שלך ולחץ שמור — הפרופיל יישלח לאישור.
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

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-stone-700">תמונת פרופיל</label>
              {(photoPreview || profile?.profile_photo_url) && (
                <img src={photoPreview || profile?.profile_photo_url || ""} alt="תמונה"
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
              <label className="mb-1 block text-sm font-semibold text-stone-700">מסמך / תעודה מקצועית</label>
              {profile?.certificate_url && !certFile && (
                <a href={profile.certificate_url} target="_blank" rel="noopener noreferrer"
                  className="mb-2 inline-block text-xs text-[#2e7d8c] underline">צפה במסמך הנוכחי</a>
              )}
              <input type="file" accept=".pdf,.jpg,.jpeg,.png"
                onChange={e => setCertFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold hover:file:bg-stone-200" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#E8E0D8] bg-white p-6">
          <h2 className="text-lg font-extrabold text-stone-900 mb-5">התמחות מקצועית</h2>
          <CheckboxGroup label="סוג מטפל" options={THERAPIST_TYPES}
            selected={form.therapist_types} onChange={v => setForm({...form, therapist_types: v})} />
          <CheckboxGroup label="תחומי טיפול" options={TRAINING_AREAS}
            selected={form.training_areas} onChange={v => setForm({...form, training_areas: v})} />
          <CheckboxGroup label="סוגי אבחון" options={ASSESSMENT_TYPES}
            selected={form.assessment_types} onChange={v => setForm({...form, assessment_types: v})} />
        </div>

        <div className="rounded-2xl border border-[#E8E0D8] bg-white p-6">
          <h2 className="text-lg font-extrabold text-stone-900 mb-5">אזור ופרטים נוספים</h2>
          <CheckboxGroup label="ערים / אזורים" options={ALL_CITIES}
            selected={form.regions} onChange={v => setForm({...form, regions: v})} />
          <CheckboxGroup label="העדפות תרבותיות" options={CULTURAL_PREFS}
            selected={form.cultural_prefs} onChange={v => setForm({...form, cultural_prefs: v})} />
          <CheckboxGroup label="הסדרים" options={ARRANGEMENTS}
            selected={form.arrangements} onChange={v => setForm({...form, arrangements: v})} />
        </div>

        {saveMsg && <p className="text-sm text-emerald-600 font-semibold">{saveMsg}</p>}
        {saveErr && <p className="text-sm text-red-600">{saveErr}</p>}

        <button type="submit" disabled={saving}
          className="w-full rounded-xl bg-[#2e7d8c] py-3 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50">
          {uploading ? "מעלה קבצים..." : saving ? "שומר..." : "שמור פרטים"}
        </button>
      </form>
    </main>
  );
}
