"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import EnrichedStatsPanel, { type EnrichedStatsData } from "./EnrichedStatsPanel";
import ProfileLinkPromo from "./ProfileLinkPromo";
import { UpgradeToPromotedButton } from "@/app/therapists/register/PromotedSignupButton";
import { isPromoActive, SUBSCRIPTION_PROMO_PRICE, SUBSCRIPTION_PROMO_MONTHS, SUBSCRIPTION_REGULAR_PRICE } from "@/app/lib/promo";
import { ATTRIBUTION_HEADER, getAttributionHeaderValue } from "@/app/lib/attribution";

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

type StatsBucket = { whatsapp: number; phone: number; email: number; site_message: number; total: number };
type SourceBreakdown = { match: StatsBucket; directory: StatsBucket };
type StatsResponse = {
  week: StatsBucket;
  month: StatsBucket;
  profile_views?: { all_time: number };
  match_impressions?: { all_time: number };
  all_time_contacts?: { total: number; match: number; directory: number; messages: number; clicks: number };
  enriched?: EnrichedStatsData;
};

// הסבר מודגש למונח "לחיצות ליצירת קשר". קודם ישב ב-11px אפור בתחתית הכרטיס
// ואיש לא קרא אותו: מטפלים ראו "פניות" וציפו להודעה או לשיחה שלא תמיד הגיעו.
// המונח והקופסה הזו מבהירים שהיחידה הנמדדת היא לחיצה, לא שיחה שהתקיימה.
function ContactExplainer() {
  return (
    <div className="mt-4 rounded-xl border p-4" style={{ background: "var(--teal-pale)", borderColor: "var(--teal-mid)" }}>
      <h4 className="mb-1.5 text-sm font-black" style={{ color: "var(--teal-dark)" }}>
        ⓘ מה נספר כאן, ולמה לא שמעתי מכולם?
      </h4>
      <p className="text-[13px] leading-6 text-stone-700">
        המספר סופר כל פעם שמטופל <strong>לחץ</strong> על הוואטסאפ, הטלפון או המייל שלך בפרופיל, כלומר ביקש ליצור איתך קשר.
        חלק מהלוחצים לא משלימים את השליחה או את השיחה, ולכן ייתכן שלא כל לחיצה הגיעה אליכם בפועל.
      </p>
      <p className="mt-2 text-[13px] leading-6 text-stone-700">
        <strong>📝 הודעות שנשלחו דרך טופס האתר</strong> הן היחידות שמגיעות אליכם תמיד, ישירות למייל.
        הודעות וואטסאפ מהאתר נפתחות בנוסח &quot;הגעתי אלייך דרך אתר טיפול חכם&quot;, ושיחות טלפון מגיעות ללא זיהוי.
      </p>
      <p className="mt-2 text-[13px] leading-6 text-stone-700">
        ולצד זה: לא מעט מטופלים רואים אתכם בהתאמה, מחפשים את שמכם בגוגל ופונים אליכם <strong>ישירות</strong>.
        פניות כאלה הגיעו מאיתנו אך אינן נספרות כאן, כך שייתכן מאוד שאתם מקבלים <strong>יותר</strong> ממה שמוצג.
      </p>
    </div>
  );
}

function ContactStats({ stats, loadingStats, isPaying }: { stats: StatsResponse | null; loadingStats: boolean; isPaying: boolean }) {
  // Free-tier toggle only; the paying view is cumulative with no period splits.
  const [period, setPeriod] = useState<"week" | "month">("week");

  const data = stats?.[period];
  const periodLabel = period === "week" ? "7 הימים האחרונים" : "30 הימים האחרונים";
  const viewsValue = stats?.profile_views?.all_time ?? 0;
  const impressionsValue = stats?.match_impressions?.all_time ?? 0;
  const conversionPct = impressionsValue > 0 ? Math.round((viewsValue / impressionsValue) * 100) : null;
  const contacts = stats?.all_time_contacts;

  // ── Paying/promoted: cumulative numbers since joining - no period splits
  // (product decision 19/7: the totals tell the real value story; month/week
  // slicing made quiet weeks read as "the site brings nothing").
  if (isPaying) {
    return (
      <div className="mb-6 rounded-2xl border border-[#E8E0D8] bg-white p-6">
        <h2 className="text-lg font-extrabold text-stone-900">הפרופיל שלך במספרים</h2>
        <p className="text-xs text-stone-500 mt-0.5 mb-4">נתונים מצטברים מאז הצטרפותך לאתר</p>

        {loadingStats ? (
          <div className="text-sm text-stone-400 py-4 text-center">טוען נתונים...</div>
        ) : !contacts ? (
          <div className="text-sm text-stone-400 py-4 text-center">לא ניתן לטעון נתונים</div>
        ) : (
          <>
            {/* Exposure → interest */}
            <h3 className="text-sm font-bold text-stone-800 mb-1">חשיפה ועניין</h3>
            <p className="text-[11px] text-stone-500 mb-3">כמה אנשים ראו אותך ונכנסו לפרופיל - לפני שלב יצירת הקשר</p>
            <div className="grid grid-cols-2 gap-3 mb-2">
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-center">
                <div className="text-lg font-black text-indigo-700">{impressionsValue.toLocaleString("he-IL")}</div>
                <div className="text-xs text-indigo-600 font-semibold mt-1">✨ הופעות במאטצ'ינג</div>
                <div className="text-[10px] text-indigo-500 mt-0.5">פעמים שהופעת ברשימת ההמלצות</div>
              </div>
              <div className="rounded-xl border border-purple-200 bg-purple-50 p-3 text-center">
                <div className="text-lg font-black text-purple-700">{viewsValue.toLocaleString("he-IL")}</div>
                <div className="text-xs text-purple-600 font-semibold mt-1">👁 כניסות לפרופיל</div>
                <div className="text-[10px] text-purple-500 mt-0.5">לחיצות שהובילו לעמוד שלך</div>
              </div>
            </div>
            {conversionPct !== null && (
              <div className="text-xs text-stone-500 text-center mb-4">
                יחס המרה: <span className="font-bold text-stone-700">{conversionPct}%</span> מהמופיעים נכנסו לפרופיל
              </div>
            )}

            {/* יצירת קשר - מצטבר. התווית מציינת את הפעולה הנמדדת (לחיצה) ולא
                שיחה שהתקיימה, והפיצול מפריד בין מה שהגיע בוודאות לבין כוונה. */}
            <h3 className="mt-5 text-sm font-bold text-stone-800 mb-1">יצירת קשר</h3>
            <p className="text-[11px] text-stone-500 mb-3">כמה מטופלים ביקשו ליצור איתך קשר מתוך הפרופיל</p>
            <div className="rounded-xl bg-[#f0ece4] px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-stone-600">לחיצות ליצירת קשר</span>
              <span className="text-xl font-black text-[#0F5468]">{contacts.total.toLocaleString("he-IL")}</span>
            </div>
            {contacts.total > 0 && (
              <>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {/* ?? 0 — הגנה על חלון הפריסה: קליינט חדש מול תשובת שרת ישנה
                      בלי השדות האלה היה מקריס את כל הדשבורד. */}
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                    <div className="text-lg font-black text-amber-800">{(contacts.messages ?? 0).toLocaleString("he-IL")}</div>
                    <div className="text-[11px] font-bold text-amber-700">📝 הודעות שנשלחו אליך דרך האתר</div>
                    <div className="text-[10px] text-amber-600 mt-0.5">הגיעו למייל שלך בוודאות</div>
                  </div>
                  <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5">
                    <div className="text-lg font-black text-stone-700">{(contacts.clicks ?? contacts.total).toLocaleString("he-IL")}</div>
                    <div className="text-[11px] font-bold text-stone-600">💬 📞 ✉️ לחיצות על וואטסאפ / חיוג / מייל</div>
                    <div className="text-[10px] text-stone-500 mt-0.5">המטופל ביקש ליצור קשר, לא בהכרח השלים</div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-center gap-4 text-xs text-stone-500">
                  <span>🎯 {contacts.match} ממערכת ההתאמה</span>
                  <span>🔍 {contacts.directory} ממאגר המטפלים</span>
                </div>
              </>
            )}
            {contacts.total === 0 && viewsValue > 0 && (
              <div className="mt-3 rounded-xl bg-stone-50 border border-stone-200 px-4 py-3 text-center text-xs text-stone-600">
                עדיין אין לחיצות ליצירת קשר - אבל {viewsValue} {viewsValue === 1 ? "אדם כבר נכנס" : "אנשים כבר נכנסו"} לפרופיל שלך 🌱
              </div>
            )}

            <ContactExplainer />
          </>
        )}
      </div>
    );
  }

  // ── Free tier: unchanged week/month view
  return (
    <div className="mb-6 rounded-2xl border border-[#E8E0D8] bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-extrabold text-stone-900">לחיצות ליצירת קשר</h2>
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
          <p className="text-xs text-stone-500 mb-4">{periodLabel} · כמה מטופלים ביקשו ליצור איתך קשר מתוך הפרופיל</p>
          {data.total === 0 ? (
            <div className="text-sm text-stone-400 py-2 text-center">לא היו לחיצות ליצירת קשר בתקופה זו</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {data.whatsapp > 0 && (
                <div className="rounded-xl bg-green-50 border border-green-100 p-4 text-center">
                  <div className="text-2xl font-black text-green-700">{data.whatsapp}</div>
                  <div className="text-xs text-green-600 mt-1 font-semibold">💬 וואטסאפ</div>
                  <div className="text-[10px] text-green-600/70 mt-0.5">לחיצות</div>
                </div>
              )}
              {data.phone > 0 && (
                <div className="rounded-xl bg-stone-50 border border-stone-200 p-4 text-center">
                  <div className="text-2xl font-black text-stone-700">{data.phone}</div>
                  <div className="text-xs text-stone-500 mt-1 font-semibold">📞 חיוג</div>
                  <div className="text-[10px] text-stone-400 mt-0.5">לחיצות</div>
                </div>
              )}
              {data.email > 0 && (
                <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 text-center">
                  <div className="text-2xl font-black text-blue-700">{data.email}</div>
                  <div className="text-xs text-blue-500 mt-1 font-semibold">✉️ מייל</div>
                  <div className="text-[10px] text-blue-400 mt-0.5">לחיצות</div>
                </div>
              )}
              {data.site_message > 0 && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-center">
                  <div className="text-2xl font-black text-amber-700">{data.site_message}</div>
                  <div className="text-xs text-amber-600 mt-1 font-semibold">📝 הודעה מהאתר</div>
                  <div className="text-[10px] font-bold text-amber-600 mt-0.5">הגיעה למייל שלך</div>
                </div>
              )}
            </div>
          )}
          <div className="mt-4 rounded-xl bg-[#f0ece4] px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-stone-600">סה"כ לחיצות ליצירת קשר</span>
            <span className="text-xl font-black text-[#0F5468]">{data.total}</span>
          </div>
          <ContactExplainer />
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
    // Long-lived tab: the page-load token may have expired by now - always fetch
    // with a fresh session token (getSession refreshes it when needed).
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const fresh = session?.access_token ?? token;
        const r = await fetch("/api/therapist-stats", { headers: { Authorization: `Bearer ${fresh}` } });
        const json = await r.json();
        if (json.ok) setStats(json);
      } catch {
        // stats are non-critical; the dashboard shows a placeholder
      } finally {
        setLoadingStats(false);
      }
    })();
  }, [token]);

  useEffect(() => {
    async function loadProfile(session: { access_token: string; user: { email?: string } }) {
      setToken(session.access_token);
      setUserEmail(session.user.email ?? "");

      // Signup attribution rides along: consumed by the server only when this
      // GET creates the stub row (first load after registration), so the
      // campaign that recruited the therapist is credited in /admin/recruitment.
      const attHeader = getAttributionHeaderValue();
      const res = await fetch("/api/therapist-profile", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          ...(attHeader ? { [ATTRIBUTION_HEADER]: attHeader } : {}),
        },
      });
      const json = await res.json();

      // A brand-new registrant has a STUB row (auto-created on first login,
      // empty name) rather than no row - GET always returns one now. Sending
      // them to the dashboard (pricing banner, plan table, "what to improve")
      // is wrong: they haven't registered yet. Route them straight to the
      // registration form, where pricing is deferred to the final plan-choice
      // step. A real profile (name filled) stays on the dashboard.
      const isStub = !((json.therapist?.full_name ?? "") as string).trim();
      if (!json.therapist || isStub) {
        const upgrade = searchParams.get("upgrade") === "promoted" ? "?plan=promoted" : "";
        window.location.href = `/therapists/dashboard/edit${upgrade}`;
        return;
      }

      setProfile(json.therapist);
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
    ? { text: "שולם - ממתין לאישור מנהל (טרם מופיע בהתאמות)", color: "bg-orange-50 text-orange-800 border border-orange-300" }
    : profile?.status === "paying"
    ? { text: "מקודם - מופיע בהתאמות", color: "bg-yellow-50 text-yellow-800 border border-yellow-300" }
    : profile?.status === "approved"
    ? { text: "מאושר - מופיע בדף המטפלים", color: "bg-green-100 text-green-800" }
    : profile?.status === "rejected"
    ? { text: "נדחה", color: "bg-red-100 text-red-800" }
    : { text: "ממתין לאישור", color: "bg-yellow-100 text-yellow-800" };

  // "What to improve" - prioritized, actionable suggestions tied to profile
  // completeness and (for promoted therapists) the funnel. Empty = looks good.
  const improvements: { icon: string; text: string }[] = [];
  if (profile) {
    if (!profile.profile_photo_path)
      improvements.push({ icon: "🖼️", text: "הוסף/י תמונת פרופיל - פרופילים עם תמונה מקבלים פניות רבות יותר באופן משמעותי." });
    if (!profile.bio || profile.bio.trim().length < 80)
      improvements.push({ icon: "✍️", text: "הרחב/י את הביוגרפיה (2–3 משפטים על הגישה, הניסיון והייחוד שלך) - מגביר אמון והקלקות." });
    if ((!profile.regions || profile.regions.length === 0) && !profile.online)
      improvements.push({ icon: "📍", text: "הוסף/י אזורי טיפול או סמן/י עבודה אונליין - בלי זה קשה למטופלים למצוא אותך." });
    if (!profile.education || !profile.education.trim())
      improvements.push({ icon: "🎓", text: "הוסף/י פרטי השכלה והכשרה - מחזק את האמינות המקצועית." });

    if (profile.status === "paying") {
      const imp = stats?.match_impressions?.all_time ?? 0;
      const views = stats?.profile_views?.all_time ?? 0;
      const contacts = stats?.all_time_contacts?.total ?? 0;
      if (imp >= 20 && views / imp < 0.15)
        improvements.push({ icon: "👁️", text: "הופעת הרבה בתוצאות ההתאמה אך מעט נכנסו לפרופיל - תמונה וכותרת ביו חזקה מגדילות את אחוז ההקלקה." });
      if (views >= 15 && contacts === 0)
        improvements.push({ icon: "💬", text: "אנשים נכנסו לפרופיל אך עדיין לא פנו - ביו ברור, הסדרים שקופים ומחיר עוזרים להפוך צפייה לפנייה." });
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

      {/* Paid but awaiting admin approval - not yet shown in matching */}
      {profile && profile.status === "paying" && !profile.admin_approved && (
        <div className="mb-6 rounded-2xl bg-orange-50 border border-orange-200 px-5 py-4">
          <h2 className="text-sm font-extrabold text-orange-800 mb-1">התשלום התקבל - הפרופיל ממתין לאישור</h2>
          <p className="text-sm text-orange-700 leading-6">
            תודה! קיבלנו את התשלום. הפרופיל שלך יופיע בהתאמות לפונים רק לאחר שמנהל יאשר את התעודות שלך. נעדכן אותך במייל כשהפרופיל יאושר.
          </p>
        </div>
      )}

      {/* Pricing banner - only for non-paying therapists */}
      {profile && profile.status !== "paying" && (
        <div className="mb-6 rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg,#0F5468,#1A7A96)", boxShadow: "0 4px 20px rgba(15,84,104,.25)" }}>
          <div className="px-6 pt-6 pb-5">
            <div className="text-xs font-bold text-white/60 uppercase tracking-widest mb-2">
              {isPromoActive() ? "מבצע פתיחה - הצטרפות למערכת ההתאמה החכמה" : "הצטרפות למערכת ההתאמה החכמה"}
            </div>
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
                <li className="flex items-start gap-1.5"><span className="text-green-600 font-bold mt-0.5">✓</span> חיפוש לפי מיקום - אזור או עיר</li>
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
                <li className="flex items-start gap-1.5"><span className="font-bold mt-0.5" style={{ color: profile.status === "paying" ? "#0F5468" : "#d1d5db" }}>✓</span> מערכת התאמה חכמה - פניות לפי גיל, אזור, שפה, סגנון טיפולי ועוד</li>
                <li className="flex items-start gap-1.5"><span className="font-bold mt-0.5" style={{ color: profile.status === "paying" ? "#0F5468" : "#d1d5db" }}>✓</span> דו"ח צפיות, לחיצות ואחוזי המרה</li>
                <li className="flex items-start gap-1.5"><span className="font-bold mt-0.5" style={{ color: profile.status === "paying" ? "#0F5468" : "#d1d5db" }}>✓</span> פילוח הפונים: אזור, קושי, גיל ומגדר</li>
                <li className="flex items-start gap-1.5"><span className="font-bold mt-0.5" style={{ color: profile.status === "paying" ? "#0F5468" : "#d1d5db" }}>✓</span> השוואה לממוצע המטפלים באתר</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Write-an-article CTA - for any approved therapist (free or paying) */}
      {profile && (profile.status === "approved" || profile.status === "paying") && (
        <div className="mb-6 rounded-2xl border border-[#E8E0D8] bg-white p-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-base font-extrabold text-stone-900">כתבו מאמר - קבלו יותר פניות</h2>
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

      {/* Backlink tool - every listed therapist linking from their personal site
          is a relevant dofollow backlink + better name-search for them. */}
      {token && !isNew && profile && (profile.status === "approved" || profile.status === "paying") && profile.admin_approved && profile.full_name && (
        <ProfileLinkPromo therapistId={profile.id} fullName={profile.full_name} />
      )}

      {/* What to improve */}
      {!isNew && profile && (
        <div className="mb-6 rounded-2xl border border-[#E8E0D8] bg-white p-5">
          <h2 className="text-base font-extrabold text-stone-900 mb-3">💡 מה כדאי לשפר</h2>
          {improvements.length === 0 ? (
            <p className="text-sm text-stone-600 leading-6">
              הפרופיל שלך נראה מצוין - כל הפרטים המרכזיים מולאו. המשך/י כך! 🎉
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

      {/* Edit personal details - for existing profiles */}
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
