"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { REGION_CITIES } from "@/app/lib/regions";
import {
  THERAPIST_TYPES, TRAINING_AREAS, ASSESSMENT_TYPES,
  AGE_GROUPS, LANGUAGES, CULTURAL_PREFS, ARRANGEMENTS,
  COUPLES_MODALITIES, PLAY_THERAPY_MODALITIES,
} from "@/app/lib/therapist-options";
import EnrichedStatsPanel, { type EnrichedStatsData } from "./EnrichedStatsPanel";

const ALL_CITIES = Object.values(REGION_CITIES).flat();
const PLAY_MODALITIES_SET = new Set<string>(PLAY_THERAPY_MODALITIES);

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
  age_groups: string[];
  languages: string[];
  style_q1: number | null;
  style_q2: number | null;
  activity_level: number | null;
  status: string;
  tier: string;
  profile_photo_path?: string;
  education?: string;
  experience?: string;
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

function RegionCheckboxGroup({ selected, onChange }: {
  selected: string[]; onChange: (v: string[]) => void;
}) {
  function toggle(city: string) {
    onChange(selected.includes(city) ? selected.filter(x => x !== city) : [...selected, city]);
  }
  return (
    <div className="mb-5">
      <div className="mb-3 text-sm font-semibold text-stone-800">ערים / אזורים</div>
      <div className="space-y-4">
        {Object.entries(REGION_CITIES).map(([region, cities]) => (
          <div key={region}>
            <div className="mb-1.5 text-xs font-bold text-[#2e7d8c] uppercase tracking-wide">{region}</div>
            <div className="flex flex-wrap gap-2">
              {cities.map(city => (
                <label key={city} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-stone-200 px-2.5 py-1 text-xs hover:bg-stone-50">
                  <input type="checkbox" checked={selected.includes(city)} onChange={() => toggle(city)} />
                  {city}
                </label>
              ))}
            </div>
          </div>
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

type StatsBucket = { whatsapp: number; phone: number; email: number; total: number };
type SourceBreakdown = { match: StatsBucket; directory: StatsBucket };
type TrendMonth = { label: string; total: number; match: number; directory: number };
type Comparison = { your_month: number; avg_month: number; therapist_count: number };
type StatsResponse = {
  week: StatsBucket;
  month: StatsBucket;
  week_by_source?: SourceBreakdown;
  month_by_source?: SourceBreakdown;
  trends?: TrendMonth[];
  profile_views?: { week: number; month: number };
  comparison?: Comparison;
  enriched?: EnrichedStatsData;
};

function ContactStats({ stats, loadingStats, isPaying }: { stats: StatsResponse | null; loadingStats: boolean; isPaying: boolean }) {
  const [period, setPeriod] = useState<"week" | "month">("week");

  const data = stats?.[period];
  const sourceData = period === "week" ? stats?.week_by_source : stats?.month_by_source;
  const views = stats?.profile_views;
  const periodLabel = period === "week" ? "7 הימים האחרונים" : "30 הימים האחרונים";

  return (
    <div className="mb-6 rounded-2xl border border-[#E8E0D8] bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-extrabold text-stone-900">פניות מהפרופיל שלך</h2>
        <div className="flex rounded-xl border border-stone-200 overflow-hidden text-xs font-semibold">
          <button
            onClick={() => setPeriod("week")}
            className={`px-3 py-1.5 transition-colors ${period === "week" ? "bg-[#0F5468] text-white" : "bg-white text-stone-500 hover:bg-stone-50"}`}
          >
            שבוע
          </button>
          <button
            onClick={() => setPeriod("month")}
            className={`px-3 py-1.5 transition-colors ${period === "month" ? "bg-[#0F5468] text-white" : "bg-white text-stone-500 hover:bg-stone-50"}`}
          >
            חודש
          </button>
        </div>
      </div>

      {loadingStats ? (
        <div className="text-sm text-stone-400 py-4 text-center">טוען נתונים...</div>
      ) : !data ? (
        <div className="text-sm text-stone-400 py-4 text-center">לא ניתן לטעון נתונים</div>
      ) : (
        <>
          <p className="text-xs text-stone-500 mb-4">{periodLabel}</p>
          {data.total === 0 ? (
            <div className="text-sm text-stone-400 py-2 text-center">לא היו פניות בתקופה זו</div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {data.whatsapp > 0 && (
                <div className="rounded-xl bg-green-50 border border-green-100 p-4 text-center">
                  <div className="text-2xl font-black text-green-700">{data.whatsapp}</div>
                  <div className="text-xs text-green-600 mt-1 font-semibold">💬 וואטסאפ</div>
                </div>
              )}
              {data.phone > 0 && (
                <div className="rounded-xl bg-stone-50 border border-stone-200 p-4 text-center">
                  <div className="text-2xl font-black text-stone-700">{data.phone}</div>
                  <div className="text-xs text-stone-500 mt-1 font-semibold">📞 שיחות</div>
                </div>
              )}
              {data.email > 0 && (
                <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 text-center">
                  <div className="text-2xl font-black text-blue-700">{data.email}</div>
                  <div className="text-xs text-blue-500 mt-1 font-semibold">✉️ מייל</div>
                </div>
              )}
            </div>
          )}
          <div className="mt-4 rounded-xl bg-[#f0ece4] px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-stone-600">סה"כ פניות</span>
            <span className="text-xl font-black text-[#0F5468]">{data.total}</span>
          </div>

          {/* ── Enhanced stats: paying only ── */}
          {isPaying && sourceData && (
            <div className="mt-5 pt-5 border-t border-[#E8E0D8]">
              {/* Source breakdown */}
              <h3 className="text-sm font-bold text-stone-800 mb-3">פירוט לפי מקור</h3>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-xl border border-teal-200 bg-teal-50 p-3 text-center">
                  <div className="text-lg font-black text-teal-700">{sourceData.match.total}</div>
                  <div className="text-xs text-teal-600 font-semibold">🎯 ממערכת ההתאמה</div>
                </div>
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-center">
                  <div className="text-lg font-black text-stone-700">{sourceData.directory.total}</div>
                  <div className="text-xs text-stone-500 font-semibold">🔍 ממאגר המטפלים</div>
                </div>
              </div>

              {/* Profile views */}
              {views && (views.week > 0 || views.month > 0) && (
                <div className="rounded-xl border border-purple-200 bg-purple-50 p-3 mb-4 flex items-center justify-between">
                  <span className="text-sm text-purple-700 font-semibold">👁 צפיות בפרופיל</span>
                  <span className="text-lg font-black text-purple-700">{period === "week" ? views.week : views.month}</span>
                </div>
              )}

              {/* Comparison */}
              {stats?.comparison && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 mb-4">
                  <h4 className="text-xs font-bold text-amber-800 mb-2">📊 השוואה לממוצע (30 ימים)</h4>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-center">
                      <div className="text-lg font-black text-amber-800">{stats.comparison.your_month}</div>
                      <div className="text-xs text-amber-600">הפניות שלך</div>
                    </div>
                    <div className="text-stone-300 text-lg">|</div>
                    <div className="text-center">
                      <div className="text-lg font-black text-amber-800">{stats.comparison.avg_month}</div>
                      <div className="text-xs text-amber-600">ממוצע ({stats.comparison.therapist_count} מטפלים)</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Monthly trends */}
              {stats?.trends && stats.trends.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-stone-800 mb-3">📈 מגמה חודשית</h3>
                  <div className="space-y-2">
                    {stats.trends.map(m => {
                      const maxTotal = Math.max(...stats.trends!.map(t => t.total), 1);
                      const barWidth = Math.round((m.total / maxTotal) * 100);
                      const [y, mo] = m.label.split("-");
                      const monthNames = ["", "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
                      const label = `${monthNames[Number(mo)]} ${y}`;
                      return (
                        <div key={m.label} className="flex items-center gap-2">
                          <span className="text-xs text-stone-500 w-20 text-left flex-shrink-0">{label}</span>
                          <div className="flex-1 h-5 bg-stone-100 rounded-full overflow-hidden relative">
                            {m.total > 0 && (
                              <div className="h-full rounded-full flex overflow-hidden" style={{ width: `${barWidth}%` }}>
                                {m.match > 0 && (
                                  <div className="h-full bg-teal-500" style={{ width: `${(m.match / m.total) * 100}%` }} />
                                )}
                                {m.directory > 0 && (
                                  <div className="h-full bg-stone-400" style={{ width: `${(m.directory / m.total) * 100}%` }} />
                                )}
                              </div>
                            )}
                          </div>
                          <span className="text-xs font-bold text-stone-700 w-6 text-right">{m.total}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-stone-500">
                    <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-teal-500" /> התאמה</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-stone-400" /> מאגר</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
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
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showRefundNote, setShowRefundNote] = useState(false);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoadingStats(true);
    fetch("/api/therapist-stats", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(json => { if (json.ok) setStats(json); })
      .finally(() => setLoadingStats(false));
  }, [token]);

  // Form state
  const [form, setForm] = useState({
    full_name: "", phone: "", bio: "", gender: "", online: false,
    therapist_types: [] as string[], training_areas: [] as string[],
    assessment_types: [] as string[], regions: [] as string[],
    cultural_prefs: [] as string[], arrangements: [] as string[],
    age_groups: [] as string[], languages: [] as string[],
    couples_modalities: [] as string[], play_therapy_modalities: [] as string[],
    style_q1: null as number | null,
    style_q2: null as number | null,
    activity_level: null as number | null,
    education: "",
    experience: "",
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
        if (json.photoUrl) setProfilePhotoUrl(json.photoUrl);
        setForm({
          full_name: json.therapist.full_name ?? "",
          phone: json.therapist.phone ?? "",
          bio: json.therapist.bio ?? "",
          gender: json.therapist.gender ?? "",
          online: json.therapist.online ?? false,
          therapist_types: json.therapist.therapist_types ?? [],
          training_areas: (json.therapist.training_areas ?? []).filter((a: string) => !PLAY_MODALITIES_SET.has(a)),
          couples_modalities: json.therapist.couples_modalities ?? [],
          play_therapy_modalities: (json.therapist.training_areas ?? []).filter((a: string) => PLAY_MODALITIES_SET.has(a)),
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

  async function uploadFile(file: File, type: "photo" | "certificate"): Promise<string | null> {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", type);
    const res = await fetch("/api/therapist-upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
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
    if (!token) return;
    setSaving(true);
    setSaveMsg("");
    setSaveErr("");

    // Upload files if selected
    if (photoFile || certFile) {
      setUploading(true);
      const uploadErrors: string[] = [];
      if (photoFile) {
        const err = await uploadFile(photoFile, "photo");
        if (err) uploadErrors.push(err);
      }
      if (certFile) {
        const err = await uploadFile(certFile, "certificate");
        if (err) uploadErrors.push(err);
      }
      setUploading(false);
      if (uploadErrors.length) {
        setSaveErr(uploadErrors.join("; "));
        setSaving(false);
        return;
      }
    }

    const { play_therapy_modalities, ...rest } = form;
    const patchBody = {
      ...rest,
      training_areas: [...form.training_areas, ...play_therapy_modalities],
    };
    const res = await fetch("/api/therapist-profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(patchBody),
    });
    const json = await res.json();
    if (json.ok) {
      setSaveMsg(json.created ? "הפרופיל נוצר בהצלחה! הוא ממתין לאישור." : "הפרטים עודכנו בהצלחה.");
      setIsNew(false);
      setPhotoFile(null);
      setCertFile(null);
      setPhotoPreview(null);
      const res2 = await fetch("/api/therapist-profile", { headers: { Authorization: `Bearer ${token}` } });
      const json2 = await res2.json();
      if (json2.therapist) {
        setProfile(json2.therapist);
        if (json2.photoUrl) setProfilePhotoUrl(json2.photoUrl);
      }
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

  const statusLabel = profile?.status === "paying"
    ? { text: "מקודם — מופיע בהתאמות", color: "bg-yellow-50 text-yellow-800 border border-yellow-300" }
    : profile?.status === "approved"
    ? { text: "מאושר — מופיע בדף המטפלים", color: "bg-green-100 text-green-800" }
    : profile?.status === "rejected"
    ? { text: "נדחה", color: "bg-red-100 text-red-800" }
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

      {/* Pricing banner — only for non-paying therapists */}
      {profile && profile.status !== "paying" && (
        <div className="mb-6 rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg,#0F5468,#1A7A96)", boxShadow: "0 4px 20px rgba(15,84,104,.25)" }}>
          <div className="px-6 pt-6 pb-5">
            <div className="text-xs font-bold text-white/60 uppercase tracking-widest mb-2">הצטרפות למערכת ההתאמה החכמה</div>
            <div className="flex items-end gap-3 mb-1">
              <span className="text-4xl font-black text-white leading-none">₪120</span>
              <span className="text-white/70 text-sm pb-1">לחודש</span>
            </div>
            <p className="text-white/60 text-xs mb-4">ניתן לבטל בכל עת</p>
            <div className="h-px bg-white/20 mb-4" />
            <div className="flex items-start gap-2.5">
              <span className="text-yellow-300 font-bold text-base mt-0.5 flex-shrink-0">✓</span>
              <span className="text-white/90 text-sm leading-5">
                לא קיבלת מטופל/מאובחן שהגיע דרכינו תוך חודשיים? אפשרי לבקש החזר כספי מלא
                <button
                  onClick={() => setShowRefundNote(v => !v)}
                  className="mr-1 text-yellow-300 font-black text-xs underline underline-offset-2 hover:text-yellow-200 transition-colors"
                >
                  *
                </button>
              </span>
            </div>
            {showRefundNote && (
              <div className="mt-3 rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-xs text-white/80 leading-5">
                * ההחזר הכספי מכסה את דמי המנוי של החודשיים בהם הייתם מנויים. ההחזר ניתן רק אם לא התקבלה אף הפנייה שהתממשה בשני החודשים העוקבים ממועד ההצטרפות.
              </div>
            )}
            <button disabled className="mt-5 w-full rounded-xl py-3 text-sm font-black bg-white/20 border border-white/30 text-white/50 cursor-not-allowed">
              הצטרפות ותשלום — בקרוב
            </button>
          </div>
        </div>
      )}

      {/* Plan comparison + status */}
      {profile && (
        <div className="mb-6 rounded-2xl overflow-hidden border border-[#E8E0D8]">

          {/* Status bar */}
          <div className={`px-5 py-3 flex items-center justify-between text-sm font-bold ${statusLabel.color}`}>
            <span>סטטוס: {statusLabel.text}</span>
            {(profile.status === "approved" || profile.status === "paying") && (
              <span className={`text-xs font-black px-3 py-1 rounded-full ${profile.status === "paying" ? "bg-yellow-400 text-yellow-900" : "bg-white/60 text-stone-600"}`}>
                {profile.status === "paying" ? "★ מקודם" : "חינמי"}
              </span>
            )}
          </div>

          {/* Plan cards */}
          <div className="grid grid-cols-2 bg-white">

            {/* Free */}
            <div className={`p-5 border-l border-[#E8E0D8] ${profile.status !== "paying" ? "bg-white" : "bg-stone-50 opacity-70"}`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-black rounded-full px-2.5 py-0.5 bg-green-100 text-green-800">חינמי</span>
                {profile.status !== "paying" && <span className="text-xs text-stone-400 font-medium">← המסלול הנוכחי שלך</span>}
              </div>
              <ul className="space-y-2 text-xs text-stone-600 leading-5">
                <li className="flex items-start gap-1.5"><span className="text-green-600 font-bold mt-0.5">✓</span> פרסום דף מידע אישי עם תמונה, ביוגרפיה ותחומי התמחות</li>
                <li className="flex items-start gap-1.5"><span className="text-green-600 font-bold mt-0.5">✓</span> נגיש לכל מי שמחפש מטפלים באתר</li>
                <li className="flex items-start gap-1.5"><span className="text-green-600 font-bold mt-0.5">✓</span> חיפוש מטפל לפי מיקום — אזור או עיר</li>
                <li className="flex items-start gap-1.5"><span className="text-stone-300 mt-0.5">✗</span> <span className="text-stone-400">כניסה למערכת ההתאמה</span></li>
                <li className="flex items-start gap-1.5"><span className="text-stone-300 mt-0.5">✗</span> <span className="text-stone-400">דו"ח שבועי של פניות</span></li>
              </ul>
            </div>

            {/* Promoted */}
            <div className={`p-5 ${profile.status === "paying" ? "" : ""}`}
              style={profile.status === "paying" ? { background: "linear-gradient(160deg,#f0f9fb,#e6f4f7)" } : {}}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-black rounded-full px-2.5 py-0.5 bg-yellow-100 text-yellow-800 border border-yellow-300">★ מקודם</span>
                {profile.status === "paying" && <span className="text-xs text-[#0F5468] font-medium">← המסלול הנוכחי שלך</span>}
              </div>
              <ul className="space-y-2 text-xs leading-5" style={{ color: profile.status === "paying" ? "#1a4a5c" : "#9ca3af" }}>
                <li className="flex items-start gap-1.5"><span className="font-bold mt-0.5" style={{ color: profile.status === "paying" ? "#0F5468" : "#d1d5db" }}>✓</span> דף מידע אישי — כולל כל מה שבמסלול החינמי</li>
                <li className="flex items-start gap-1.5"><span className="font-bold mt-0.5" style={{ color: profile.status === "paying" ? "#0F5468" : "#d1d5db" }}>✓</span> כניסה למערכת ההתאמה — פניות לפי תחומי הטיפול והאישיות המקצועית שלך</li>
                <li className="flex items-start gap-1.5"><span className="font-bold mt-0.5" style={{ color: profile.status === "paying" ? "#0F5468" : "#d1d5db" }}>✓</span> התאמה לפי פרמטרים מגוונים: גיל, אזור, שפה, סגנון טיפולי, הסדרי ביטוח ועוד</li>
                <li className="flex items-start gap-1.5"><span className="font-bold mt-0.5" style={{ color: profile.status === "paying" ? "#0F5468" : "#d1d5db" }}>✓</span> הפניות המדויקות ביותר — מטופלים שמחפשים בדיוק את הגישה שלך</li>
                <li className="flex items-start gap-1.5"><span className="font-bold mt-0.5" style={{ color: profile.status === "paying" ? "#0F5468" : "#d1d5db" }}>✓</span> דו"ח שבועי של כמות הלחיצות על הפרופיל שלך</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Contact stats */}
      {token && !isNew && <ContactStats stats={stats} loadingStats={loadingStats} isPaying={profile?.status === "paying"} />}

      {/* Enriched stats (paying only) */}
      {token && !isNew && profile?.status === "paying" && stats?.enriched && <EnrichedStatsPanel data={stats.enriched} />}

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
          <h2 className="text-lg font-extrabold text-stone-900 mb-5">התמחות מקצועית</h2>
          <CheckboxGroup label="סוג מטפל" options={THERAPIST_TYPES}
            selected={form.therapist_types} onChange={v => setForm({...form, therapist_types: v})} />
          <CheckboxGroup label="תחומי טיפול" options={TRAINING_AREAS}
            selected={form.training_areas} onChange={v => {
              const hadCouples = form.training_areas.includes("טיפול זוגי");
              const hasCouples = v.includes("טיפול זוגי");
              const hadExpressive = form.training_areas.includes("טיפול בהבעה ויצירה");
              const hasExpressive = v.includes("טיפול בהבעה ויצירה");
              setForm({...form, training_areas: v,
                couples_modalities: hadCouples && !hasCouples ? [] : form.couples_modalities,
                play_therapy_modalities: hadExpressive && !hasExpressive ? [] : form.play_therapy_modalities,
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
          <CheckboxGroup label="סוגי אבחון" options={ASSESSMENT_TYPES}
            selected={form.assessment_types} onChange={v => setForm({...form, assessment_types: v})} />
          <CheckboxGroup label="קבוצות גיל" options={AGE_GROUPS}
            selected={form.age_groups} onChange={v => setForm({...form, age_groups: v})} />
          <CheckboxGroup label="שפות טיפול" options={LANGUAGES}
            selected={form.languages} onChange={v => setForm({...form, languages: v})} />
        </div>

        <div className="rounded-2xl border border-[#E8E0D8] bg-white p-6">
          <h2 className="text-lg font-extrabold text-stone-900 mb-5">אזור ופרטים נוספים</h2>
          <RegionCheckboxGroup selected={form.regions} onChange={v => setForm({...form, regions: v})} />
          <CheckboxGroup label="העדפות תרבותיות" options={CULTURAL_PREFS}
            selected={form.cultural_prefs} onChange={v => setForm({...form, cultural_prefs: v})} />
          <CheckboxGroup label="הסדרים" options={ARRANGEMENTS}
            selected={form.arrangements} onChange={v => setForm({...form, arrangements: v})} />
        </div>

        <div className="rounded-2xl border border-[#E8E0D8] bg-white p-6">
          <h2 className="text-lg font-extrabold text-stone-900 mb-1">סגנון טיפולי</h2>
          <p className="text-xs text-stone-500 mb-5">3 שאלות על הגישה הטיפולית שלך — ישמשו להתאמה אישיותית עם מטופלים</p>
          <StyleQuestion
            name="style_q1"
            question="בעבודתי הטיפולית, אני נוטה לראות בהבנה מעמיקה של שורשי הקושי, העבר והדפוסים הלא-מודעים מרכיב מרכזי בשינוי הטיפולי."
            hint="1 = בכלל לא מסכים/ה — עבודתי ממוקדת יותר בהקלה מיידית ובתפקוד | 7 = מסכים/ה מאוד — עבודתי מבוססת תובנה ועומק"
            value={form.style_q1}
            onChange={v => setForm({...form, style_q1: v})}
          />
          <StyleQuestion
            name="style_q2"
            question="בעבודתי הטיפולית, אני נוטה להציע למטופלים מסגרת ברורה, מטרות מוגדרות, כלים ומשימות בין פגישות."
            hint="1 = בכלל לא מסכים/ה — אני עובד/ת יותר במרחב פתוח וגמיש | 7 = מסכים/ה מאוד — אני עובד/ת באופן מובנה, מכוון ופרקטי"
            value={form.style_q2}
            onChange={v => setForm({...form, style_q2: v})}
          />
          <StyleQuestion
            name="activity_level"
            question="בטיפול, הסגנון הטבעי שלי הוא להיות פעיל/ה, מכוון/ת ומעורב/ת מילולית, יותר מאשר שקט/ה, מכיל/ה ומתבונן/ת."
            hint="1 = בכלל לא מסכים/ה — אני יותר מכיל/ה, שוהה ומתבונן/ת | 7 = מסכים/ה מאוד — אני יותר פעיל/ה, מכוון/ת ומעורב/ת"
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
            <input type="file" accept=".pdf,.jpg,.jpeg,.png"
              onChange={e => setCertFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold hover:file:bg-stone-200" />
          </div>
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
