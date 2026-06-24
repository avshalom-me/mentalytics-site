"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import EnrichedStatsPanel, { type EnrichedStatsData } from "./EnrichedStatsPanel";
import { UpgradeToPromotedButton } from "@/app/therapists/register/PromotedSignupButton";
import { isPromoActive, SUBSCRIPTION_PROMO_PRICE, SUBSCRIPTION_PROMO_MONTHS, SUBSCRIPTION_REGULAR_PRICE } from "@/app/lib/promo";

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
  admin_approved?: boolean;
  tier: string;
  profile_photo_path?: string;
  education?: string;
  experience?: string;
  rejection_reason?: string | null;
};

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
  match_impressions?: { week: number; month: number };
  comparison?: Comparison;
  enriched?: EnrichedStatsData;
};

function ContactStats({ stats, loadingStats, isPaying }: { stats: StatsResponse | null; loadingStats: boolean; isPaying: boolean }) {
  const [period, setPeriod] = useState<"week" | "month">("week");

  const data = stats?.[period];
  const sourceData = period === "week" ? stats?.week_by_source : stats?.month_by_source;
  const views = stats?.profile_views;
  const impressions = stats?.match_impressions;
  const periodLabel = period === "week" ? "7 הימים האחרונים" : "30 הימים האחרונים";
  const viewsValue = views ? (period === "week" ? views.week : views.month) : 0;
  const impressionsValue = impressions ? (period === "week" ? impressions.week : impressions.month) : 0;
  const conversionPct = impressionsValue > 0 ? Math.round((viewsValue / impressionsValue) * 100) : null;

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
              {/* Funnel steps 1+2: exposure → profile entries */}
              {(impressionsValue > 0 || viewsValue > 0) && (
                <div className="mb-5">
                  <h3 className="text-sm font-bold text-stone-800 mb-1">חשיפה ועניין</h3>
                  <p className="text-[11px] text-stone-500 mb-3">כמה אנשים ראו אותך ונכנסו לפרופיל — לפני שלב יצירת הקשר</p>
                  <div className="grid grid-cols-2 gap-3 mb-2">
                    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-center">
                      <div className="text-lg font-black text-indigo-700">{impressionsValue}</div>
                      <div className="text-xs text-indigo-600 font-semibold mt-1">✨ הופעות במאטצ'ינג</div>
                      <div className="text-[10px] text-indigo-500 mt-0.5">פעמים שהופעת ברשימת ההמלצות</div>
                    </div>
                    <div className="rounded-xl border border-purple-200 bg-purple-50 p-3 text-center">
                      <div className="text-lg font-black text-purple-700">{viewsValue}</div>
                      <div className="text-xs text-purple-600 font-semibold mt-1">👁 כניסות לפרופיל</div>
                      <div className="text-[10px] text-purple-500 mt-0.5">לחיצות שהובילו לעמוד שלך</div>
                    </div>
                  </div>
                  {conversionPct !== null && (
                    <div className="text-xs text-stone-500 text-center">
                      יחס המרה: <span className="font-bold text-stone-700">{conversionPct}%</span> מהמופיעים נכנסו לפרופיל
                    </div>
                  )}
                </div>
              )}

              {/* Funnel step 3: contacts by source */}
              <h3 className="text-sm font-bold text-stone-800 mb-1">פניות לפי מקור</h3>
              <p className="text-[11px] text-stone-500 mb-3">אנשים שלחצו ליצירת קשר (וואטסאפ / טלפון / מייל)</p>
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
              {sourceData.match.total + sourceData.directory.total === 0 && viewsValue > 0 && (
                <div className="rounded-xl bg-[#f0ece4] px-4 py-3 mb-4 text-center text-xs text-stone-600">
                  עדיין אין פניות — אבל {viewsValue} {viewsValue === 1 ? "אדם כבר נכנס" : "אנשים כבר נכנסו"} לפרופיל שלך 🌱
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

export default function TherapistDashboardPage() {
  return (
    <Suspense>
      <TherapistDashboard />
    </Suspense>
  );
}

function TherapistDashboard() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [showRefundNote, setShowRefundNote] = useState(false);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("upgrade") === "promoted" && token && profile && profile.status !== "paying") {
      window.location.href = "/therapists/checkout";
    }
  }, [searchParams, token, profile]);

  useEffect(() => {
    if (!token) return;
    setLoadingStats(true);
    fetch("/api/therapist-stats", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(json => { if (json.ok) setStats(json); })
      .finally(() => setLoadingStats(false));
  }, [token]);

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

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/therapists/login";
  }

  if (loading) return <div className="p-10 text-center">טוען...</div>;

  const statusLabel = profile?.status === "paying" && !profile?.admin_approved
    ? { text: "שולם — ממתין לאישור מנהל (טרם מופיע בהתאמות)", color: "bg-orange-50 text-orange-800 border border-orange-300" }
    : profile?.status === "paying"
    ? { text: "מקודם — מופיע בהתאמות", color: "bg-yellow-50 text-yellow-800 border border-yellow-300" }
    : profile?.status === "approved"
    ? { text: "מאושר — מופיע בדף המטפלים", color: "bg-green-100 text-green-800" }
    : profile?.status === "rejected"
    ? { text: "נדחה", color: "bg-red-100 text-red-800" }
    : { text: "ממתין לאישור", color: "bg-yellow-100 text-yellow-800" };

  // "What to improve" — prioritized, actionable suggestions tied to profile
  // completeness and (for promoted therapists) the funnel. Empty = looks good.
  const improvements: { icon: string; text: string }[] = [];
  if (profile) {
    if (!profile.profile_photo_path)
      improvements.push({ icon: "🖼️", text: "הוסף/י תמונת פרופיל — פרופילים עם תמונה מקבלים פניות רבות יותר באופן משמעותי." });
    if (!profile.bio || profile.bio.trim().length < 80)
      improvements.push({ icon: "✍️", text: "הרחב/י את הביוגרפיה (2–3 משפטים על הגישה, הניסיון והייחוד שלך) — מגביר אמון והקלקות." });
    if ((!profile.regions || profile.regions.length === 0) && !profile.online)
      improvements.push({ icon: "📍", text: "הוסף/י אזורי טיפול או סמן/י עבודה אונליין — בלי זה קשה למטופלים למצוא אותך." });
    if (!profile.education || !profile.education.trim())
      improvements.push({ icon: "🎓", text: "הוסף/י פרטי השכלה והכשרה — מחזק את האמינות המקצועית." });

    if (profile.status === "paying") {
      const imp = stats?.match_impressions?.month ?? 0;
      const views = stats?.profile_views?.month ?? 0;
      const contacts = stats?.month?.total ?? 0;
      if (imp >= 20 && views / imp < 0.15)
        improvements.push({ icon: "👁️", text: "הופעת הרבה בתוצאות ההתאמה אך מעט נכנסו לפרופיל — תמונה וכותרת ביו חזקה מגדילות את אחוז ההקלקה." });
      if (views >= 15 && contacts === 0)
        improvements.push({ icon: "💬", text: "אנשים נכנסו לפרופיל אך עדיין לא פנו — ביו ברור, הסדרים שקופים ומחיר עוזרים להפוך צפייה לפנייה." });
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');`}</style>

      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-stone-900">לוח הבקרה שלי</h1>
          <p className="text-sm text-stone-500 mt-0.5">{userEmail}</p>
        </div>
        <div className="flex items-center gap-4">
          {!isNew && (
            <Link href="/therapists/dashboard/edit"
              className="text-xs font-semibold text-[#2e7d8c] underline hover:text-[#24606c]">
              עריכת פרטים אישיים
            </Link>
          )}
          <button onClick={handleLogout}
            className="text-xs text-stone-500 underline hover:text-stone-700">
            התנתק
          </button>
        </div>
      </div>

      {/* Rejection notice — reason + how to re-submit */}
      {profile?.status === "rejected" && (
        <div className="mb-6 rounded-2xl bg-red-50 border border-red-200 px-5 py-4">
          <h2 className="text-sm font-extrabold text-red-800 mb-1">הפרופיל לא אושר</h2>
          {profile.rejection_reason ? (
            <p className="text-sm text-red-700 leading-6">סיבה: {profile.rejection_reason}</p>
          ) : (
            <p className="text-sm text-red-700 leading-6">הפרופיל לא אושר במתכונתו הנוכחית.</p>
          )}
          <p className="text-sm text-red-700 leading-6 mt-1">
            עדכן/י את הפרטים והעלה/י תעודת רישיון ברורה וקריאה, ולחץ/י &quot;שמור פרטים&quot; — הפרופיל יישלח שוב לאישור.
          </p>
        </div>
      )}

      {/* Paid but awaiting admin approval — not yet shown in matching */}
      {profile && profile.status === "paying" && !profile.admin_approved && (
        <div className="mb-6 rounded-2xl bg-orange-50 border border-orange-200 px-5 py-4">
          <h2 className="text-sm font-extrabold text-orange-800 mb-1">התשלום התקבל — הפרופיל ממתין לאישור</h2>
          <p className="text-sm text-orange-700 leading-6">
            תודה! קיבלנו את התשלום. הפרופיל שלך יופיע בהתאמות לפונים רק לאחר שמנהל יאשר את התעודות שלך. נעדכן אותך במייל כשהפרופיל יאושר.
          </p>
        </div>
      )}

      {/* Pricing banner — only for non-paying therapists */}
      {profile && profile.status !== "paying" && (
        <div className="mb-6 rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg,#0F5468,#1A7A96)", boxShadow: "0 4px 20px rgba(15,84,104,.25)" }}>
          <div className="px-6 pt-6 pb-5">
            <div className="text-xs font-bold text-white/60 uppercase tracking-widest mb-2">מבצע פתיחה — הצטרפות למערכת ההתאמה החכמה</div>
            {isPromoActive() ? (
              <>
                <div className="flex items-end gap-3 mb-1">
                  <span className="text-4xl font-black text-white leading-none">₪{SUBSCRIPTION_PROMO_PRICE}</span>
                  <span className="text-white/70 text-sm pb-1">+ מע&quot;מ / לחודש</span>
                  <span className="text-white/40 text-lg pb-1 line-through">₪{SUBSCRIPTION_REGULAR_PRICE}</span>
                </div>
                <p className="text-white/70 text-xs mb-4">
                  ל-{SUBSCRIPTION_PROMO_MONTHS} החודשים הראשונים, ולאחר מכן ₪{SUBSCRIPTION_REGULAR_PRICE} + מע&quot;מ. ניתן לבטל בכל עת.
                </p>
              </>
            ) : (
              <>
                <div className="flex items-end gap-3 mb-1">
                  <span className="text-4xl font-black text-white leading-none">₪{SUBSCRIPTION_REGULAR_PRICE}</span>
                  <span className="text-white/70 text-sm pb-1">+ מע&quot;מ / לחודש</span>
                </div>
                <p className="text-white/60 text-xs mb-4">ניתן לבטל בכל עת</p>
              </>
            )}
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
            <div className="mt-5">
              <UpgradeToPromotedButton />
            </div>
          </div>
        </div>
      )}

      {/* Plan comparison + status */}
      {profile && (
        <div className="mb-6 rounded-2xl overflow-hidden border border-[#E8E0D8]">

          {/* Status bar */}
          <div className={`px-5 py-3 flex items-center justify-between text-sm font-bold ${statusLabel.color}`}>
            <span>סטטוס: {statusLabel.text}</span>
            {((profile.status === "approved" || profile.status === "paying") && profile.admin_approved) && (
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
                <li className="flex items-start gap-1.5"><span className="text-green-600 font-bold mt-0.5">✓</span> דף פרופיל אישי עם תמונה, ביוגרפיה ותחומי התמחות</li>
                <li className="flex items-start gap-1.5"><span className="text-green-600 font-bold mt-0.5">✓</span> נגיש לכל מי שמחפש מטפלים באתר</li>
                <li className="flex items-start gap-1.5"><span className="text-green-600 font-bold mt-0.5">✓</span> חיפוש לפי מיקום — אזור או עיר</li>
                <li className="flex items-start gap-1.5"><span className="text-stone-300 mt-0.5">✗</span> <span className="text-stone-400">מערכת ההתאמה החכמה</span></li>
                <li className="flex items-start gap-1.5"><span className="text-stone-300 mt-0.5">✗</span> <span className="text-stone-400">סטטיסטיקות וניתוח פרופיל הפונים</span></li>
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
                <li className="flex items-start gap-1.5"><span className="font-bold mt-0.5" style={{ color: profile.status === "paying" ? "#0F5468" : "#d1d5db" }}>✓</span> כל מה שבמסלול החינמי</li>
                <li className="flex items-start gap-1.5"><span className="font-bold mt-0.5" style={{ color: profile.status === "paying" ? "#0F5468" : "#d1d5db" }}>✓</span> מערכת התאמה חכמה — פניות לפי גיל, אזור, שפה, סגנון טיפולי ועוד</li>
                <li className="flex items-start gap-1.5"><span className="font-bold mt-0.5" style={{ color: profile.status === "paying" ? "#0F5468" : "#d1d5db" }}>✓</span> דו"ח צפיות, לחיצות ואחוזי המרה</li>
                <li className="flex items-start gap-1.5"><span className="font-bold mt-0.5" style={{ color: profile.status === "paying" ? "#0F5468" : "#d1d5db" }}>✓</span> פילוח הפונים: אזור, קושי, גיל ומגדר</li>
                <li className="flex items-start gap-1.5"><span className="font-bold mt-0.5" style={{ color: profile.status === "paying" ? "#0F5468" : "#d1d5db" }}>✓</span> השוואה לממוצע המטפלים באתר</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Write-an-article CTA — for any approved therapist (free or paying) */}
      {profile && (profile.status === "approved" || profile.status === "paying") && (
        <div className="mb-6 rounded-2xl border border-[#E8E0D8] bg-white p-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-base font-extrabold text-stone-900">כתבו מאמר — קבלו יותר פניות</h2>
            <p className="text-sm text-stone-500 mt-0.5 leading-6">
              מידע מקצועי קצר עוזר למטופלים להכיר אתכם. כל מאמר מאושר מתפרסם במאגר המאמרים עם שמכם וקישור לפרופיל.
            </p>
          </div>
          <Link href="/therapists/articles"
            className="rounded-xl bg-[#D49018] px-5 py-2.5 text-sm font-bold text-white hover:opacity-90 whitespace-nowrap">
            לכתיבת מאמר
          </Link>
        </div>
      )}

      {/* Contact stats */}
      {token && !isNew && <ContactStats stats={stats} loadingStats={loadingStats} isPaying={profile?.status === "paying"} />}

      {/* Enriched stats (paying only) */}
      {token && !isNew && profile?.status === "paying" && stats?.enriched && <EnrichedStatsPanel data={stats.enriched} />}

      {/* What to improve */}
      {!isNew && profile && (
        <div className="mb-6 rounded-2xl border border-[#E8E0D8] bg-white p-5">
          <h2 className="text-base font-extrabold text-stone-900 mb-3">💡 מה כדאי לשפר</h2>
          {improvements.length === 0 ? (
            <p className="text-sm text-stone-600 leading-6">
              הפרופיל שלך נראה מצוין — כל הפרטים המרכזיים מולאו. המשך/י כך! 🎉
            </p>
          ) : (
            <>
              <ul className="space-y-2.5">
                {improvements.map((s, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-stone-700 leading-6">
                    <span className="flex-shrink-0">{s.icon}</span>
                    <span>{s.text}</span>
                  </li>
                ))}
              </ul>
              <Link href="/therapists/dashboard/edit"
                className="mt-4 inline-block rounded-xl bg-[#2e7d8c] px-5 py-2.5 text-sm font-bold text-white hover:opacity-90">
                לעריכת הפרופיל
              </Link>
            </>
          )}
        </div>
      )}

      {/* New user: prompt to complete profile */}
      {isNew && (
        <div className="mb-6 rounded-2xl bg-blue-50 border border-blue-200 px-5 py-5">
          <h2 className="text-base font-extrabold text-blue-900 mb-1">ברוך הבא! 👋</h2>
          <p className="text-sm text-blue-800 leading-6 mb-4">כדי להופיע באתר, יש למלא את הפרטים האישיים והמקצועיים ולהעלות תעודה. זה לוקח כמה דקות.</p>
          <Link href="/therapists/dashboard/edit"
            className="inline-block rounded-xl bg-[#2e7d8c] px-6 py-3 text-sm font-bold text-white hover:opacity-90">
            למילוי הפרטים שלי ←
          </Link>
        </div>
      )}

      {/* Edit personal details — for existing profiles */}
      {!isNew && profile && (
        <div className="mb-6 rounded-2xl border border-[#E8E0D8] bg-white p-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-base font-extrabold text-stone-900">הפרטים האישיים שלי</h2>
            <p className="text-sm text-stone-500 mt-0.5 leading-6">עריכת הפרופיל המקצועי, תחומי הטיפול, האזורים, התמונה והתעודות.</p>
          </div>
          <Link href="/therapists/dashboard/edit"
            className="rounded-xl bg-[#2e7d8c] px-5 py-2.5 text-sm font-bold text-white hover:opacity-90 whitespace-nowrap">
            עריכת פרטים אישיים
          </Link>
        </div>
      )}
    </main>
  );
}
