"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabaseClient";
import { Building2, Users, Eye, MessageCircle, MapPin, Activity, ExternalLink, LogOut, Loader2, Sparkles, Search } from "lucide-react";
import { type PublicPage } from "./PublicPageEditor";
import InvitePanel from "./InvitePanel";

// דשבורד פורטל המרכז: הראשי מציג סטטיסטיקות ונתונים בלבד - כל השינויים
// והעריכות מרוכזים באזור עריכה נפרד (/centers/dashboard/profile), כמו אצל
// מטפל בודד. הנתונים מ-/api/center-portal (מאומת בטוקן).

type TherapistItem = {
  id: string;
  name: string;
  status: string;
  approved: boolean;
  online: boolean;
  photo_url: string | null;
  profile_path: string;
  month_views: number;
  month_clicks: number;
};

type Clicks = { whatsapp: number; phone: number; email: number; site_message?: number; total: number };
type Bar = { name: string; count: number };
const EMPTY_CLICKS: Clicks = { whatsapp: 0, phone: 0, email: 0, site_message: 0, total: 0 };

type SourceFunnel = { impressions: number; entries: number; contacts: number; entry_rate: number; contact_rate: number };

type Stats = {
  listed_count: number;
  views_month: number;         // מצטבר (השם נשמר לתאימות)
  impressions_month?: number;  // מצטבר
  directory_impressions?: number;
  clicks_total?: Clicks;
  by_source?: { match: SourceFunnel; directory: SourceFunnel; direct_contacts: number };
  benchmark?: {
    days: number; peers: number;
    per_therapist_views: number; per_therapist_contacts: number;
    free_avg_views: number; free_avg_contacts: number;
  } | null;
  clicks_week: Clicks;
  clicks_month: Clicks;
  by_region: Bar[];
  by_issue: Bar[];
  by_age: Bar[];
  by_gender: Bar[];
  trend: { label: string; clicks: number }[];
};

type PortalData = {
  /** פרופיל מטפל אישי שמוחזק באותו חשבון (מנהל/ת שגם מטפל/ת). */
  own_therapist?: { id: string; full_name: string } | null;
  center: {
    name: string;
    status: string;
    billing_track?: string | null;
    entity?: { id: string; status: string; admin_approved: boolean; matching_filled?: boolean } | null;
    plan_title: string | null;
    billing_starts_at: string | null;
    therapist_quota: number;
    linked_count: number;
    public_page: PublicPage;
  };
  therapists: TherapistItem[];
  stats: Stats | null;
};

const REGION_LABELS: Record<string, string> = {
  center: "מרכז", sharon: "שרון", jerusalem: "ירושלים", haifa: "חיפה", north: "צפון", south: "דרום", online: "אונליין", other: "אחר",
};
const GENDER_LABELS: Record<string, string> = { m: "גברים", f: "נשים", other: "אחר" };

export default function CenterDashboardPage() {
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [justCreated, setJustCreated] = useState(false);

  // חזרה מיצירת מטפל חדש (?created=1) - באנר הצלחה חד-פעמי.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("created") === "1") {
      setJustCreated(true);
      window.history.replaceState({}, "", "/centers/dashboard");
    }
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/centers/login";
        return;
      }
      try {
        const res = await fetch("/api/center-portal", { headers: { Authorization: `Bearer ${session.access_token}` } });
        const json = await res.json();
        if (res.status === 401) {
          setError("החשבון שלכם עדיין לא מקושר למרכז. פתחו את הקישור שבמייל \"ברוכים הבאים\" שקיבלתם אחרי התשלום - הוא מקשר את החשבון אוטומטית תוך דקה. לא מוצאים את המייל? כתבו לנו עם שם המרכז ונקשר ידנית תוך יום עסקים.");
        } else if (!json.ok) {
          setError(json.error ?? "שגיאה בטעינת הנתונים");
        } else {
          setData(json);
        }
      } catch {
        setError("שגיאת רשת");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/centers/login";
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center" dir="rtl"><Loader2 size={28} className="animate-spin text-[var(--teal)]" /></div>;
  }

  if (error) {
    return (
      <main className="mx-auto max-w-md px-5 py-20 text-center" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
        <div className="rounded-3xl border border-stone-200 bg-white p-8">
          <p className="text-sm leading-7 text-stone-700">{error}</p>
          <div className="mt-5 flex flex-col gap-2">
            <button onClick={logout} className="rounded-full border border-stone-300 px-5 py-2 text-sm font-bold text-stone-600 hover:bg-stone-50">התנתקות</button>
            <a href="mailto:admin@getmentalytics.com" className="text-sm underline text-stone-500">admin@getmentalytics.com</a>
          </div>
        </div>
      </main>
    );
  }

  if (!data) return null;
  const { center, therapists, stats } = data;
  const isEntity = center.billing_track === "center_entity"; // מסלול 2 - מרכז כישות אחת

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>

      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "var(--teal-pale)" }}>
            <Building2 size={24} style={{ color: "var(--teal)" }} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-stone-900">{center.name}</h1>
            <p className="text-xs text-stone-500">
              פורטל ניהול מרכז{center.plan_title ? ` · ${center.plan_title}` : ""}
              {center.status === "active" ? " · מנוי פעיל" : ""}
              {center.status === "active" && center.billing_starts_at
                ? ` · חיוב חודשי מ-${new Date(center.billing_starts_at + "T00:00:00").toLocaleDateString("he-IL")}`
                : ""}
            </p>
          </div>
        </div>
        <button onClick={logout} className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 px-4 py-1.5 text-sm font-semibold text-stone-600 hover:bg-stone-50">
          <LogOut size={15} /> התנתקות
        </button>
      </div>

      {/* הכיוון ההפוך לשורה שבדשבורד המטפל: אותו חשבון מחזיק גם פרופיל אישי,
          וללא זה אין באתר מעבר בין שני האזורים. */}
      {data.own_therapist && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-3"
          style={{ background: "var(--gold-pale)", borderColor: "#f0e0b8" }}>
          <span className="text-sm" style={{ color: "var(--gold-dark)" }}>
            👤 לחשבון הזה יש גם פרופיל מטפל/ת אישי
            {data.own_therapist.full_name ? <> - <strong>{data.own_therapist.full_name}</strong></> : null}
          </span>
          <a href="/therapists/dashboard"
            className="rounded-full bg-white px-4 py-1.5 text-xs font-bold hover:opacity-90"
            style={{ border: "1.5px solid var(--gold)", color: "var(--gold-dark)" }}>
            לפרופיל האישי ←
          </a>
        </div>
      )}

      {justCreated && (
        <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-semibold text-green-800">
          ✓ הפרופיל נוצר ונשלח לאישור צוות טיפול חכם. לאחר האישור המטפל/ת ייכנס/תיכנס אוטומטית למערכת ההתאמות - הסטטוס מתעדכן כאן בטבלה.
        </div>
      )}

      {/* מדדים מרכזיים */}
      <div className={`mb-8 grid grid-cols-2 gap-3 ${isEntity ? "md:grid-cols-4" : "md:grid-cols-5"}`}>
        {!isEntity && (
          <StatCard icon={Users} label="מטפלים במרכז" value={therapists.length} sub={`${stats?.listed_count ?? 0} מוצגים בהתאמות`} color="#0F5468" />
        )}
        <StatCard icon={Sparkles} label="הופעות בהתאמות" value={stats?.impressions_month ?? 0} sub="מצטבר · ברשימת ההמלצות" color="#7c3aed" />
        <StatCard icon={Search} label="הופעות במאגר" value={stats?.directory_impressions ?? 0} sub="מצטבר · בגלישה במאגר" color="#0F766E" />
        <StatCard icon={Eye} label={isEntity ? "צפיות בפרופיל" : "צפיות בפרופילים"} value={stats?.views_month ?? 0} sub="מצטבר" color="#1A7A96" />
        <StatCard icon={MessageCircle} label="לחיצות ליצירת קשר" value={stats?.clicks_total?.total ?? 0} sub="מצטבר" color="#2A5C3A" />
      </div>

      {/* מסלול 2: הצעד הקריטי - בלי סוגי טיפול המרכז לא קיים בהתאמות */}
      {isEntity && center.entity && center.entity.matching_filled === false && (
        <section className="mb-6 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5">
          <h2 className="mb-1 text-base font-black text-amber-900">⚠️ צעד חיוני: סימון סוגי הטיפול של המרכז</h2>
          <p className="mb-3 text-sm leading-6 text-amber-900">
            המרכז עדיין <strong>לא יופיע בהתאמות</strong> - מערכת ההתאמות משדכת מטופלים לפי
            תחומי הטיפול, קבוצות הגיל, השפות והאזורים שתסמנו. זה לוקח כ-3 דקות.
          </p>
          <Link href={`/centers/dashboard/therapists/${center.entity.id}`}
            className="inline-block rounded-full px-5 py-2 text-sm font-bold text-white transition hover:opacity-95"
            style={{ background: "linear-gradient(135deg,#b45309,#d97706)" }}>
            ✏️ לסימון סוגי הטיפול עכשיו
          </Link>
        </section>
      )}

      {/* מסלול 2 - הפרופיל של המרכז: סטטוס + כניסה לאזור העריכה */}
      {isEntity && (
        <section className="mb-8 rounded-2xl border border-teal-200 bg-teal-50/40 p-5">
          <h2 className="mb-1 text-base font-black text-stone-800">הפרופיל של המרכז</h2>
          <p className="mb-4 text-sm leading-6 text-stone-600">
            המרכז מוצג כרובריקה אחת (&quot;מרכז טיפולי&quot;) במערכת ההתאמות, ולצדה עמוד ציבורי עם הלוגו, הצוות והתמונות. כל השינויים והעריכות - בלחיצה אחת:
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/centers/dashboard/profile"
              className="inline-block rounded-full px-5 py-2 text-sm font-bold text-white transition hover:opacity-95"
              style={{ background: "linear-gradient(135deg,var(--teal-dark),var(--teal))" }}>
              ✏️ עריכת הפרופיל והעמוד הציבורי
            </Link>
            {center.public_page.slug && (
              <a href={`/centers/${center.public_page.slug}`} target="_blank"
                className="inline-flex items-center gap-1 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-50">
                צפייה בעמוד <ExternalLink size={13} />
              </a>
            )}
            {center.entity && (center.entity.admin_approved && center.entity.status === "paying" ? (
              <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-bold text-green-800">✓ מוצג בהתאמות</span>
            ) : center.status !== "active" ? (
              <span className="rounded-full border border-stone-200 bg-stone-100 px-3 py-1 text-xs text-stone-500">יופיע בהתאמות לאחר הפעלת המנוי ואישור הפרופיל</span>
            ) : (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">ממתין לאישור צוות טיפול חכם</span>
            ))}
          </div>
        </section>
      )}

      {/* הזמנת מטפלים במייל (מסלול 1) - כל מטפל ממלא את הפרופיל שלו בעצמו */}
      {!isEntity && center.status === "active" && (
        <InvitePanel quota={center.therapist_quota} linkedCount={center.linked_count} />
      )}

      {/* רשימת המטפלים (מסלול 1) */}
      {!isEntity && (
      <section className="mb-8 rounded-2xl border border-stone-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-black text-stone-800">
            המטפלים של המרכז
            {center.therapist_quota > 0 && (
              <span className="mr-2 text-xs font-semibold text-stone-400">
                {center.linked_count}/{center.therapist_quota} במנוי
              </span>
            )}
          </h2>
          {center.status === "active" && (
            center.therapist_quota > 0 && center.linked_count >= center.therapist_quota ? (
              <span className="rounded-full border border-stone-200 bg-stone-50 px-4 py-1.5 text-xs text-stone-500"
                title="כל מקומות המנוי בשימוש - להרחבה פנו אלינו">
                המכסה מלאה ({center.therapist_quota}) · להרחבה: admin@getmentalytics.com
              </span>
            ) : (
              <Link href="/centers/dashboard/therapists/new"
                className="rounded-full px-4 py-1.5 text-sm font-bold text-white transition hover:opacity-95"
                style={{ background: "linear-gradient(135deg,var(--teal-dark),var(--teal))" }}>
                ➕ הוספת מטפל/ת
              </Link>
            )
          )}
        </div>
        {therapists.length === 0 ? (
          <p className="text-sm text-stone-400">
            עדיין לא נוספו מטפלים למרכז. הוסיפו את המטפלים שלכם בכפתור למעלה - כל פרופיל עובר אישור קצר של צוות טיפול חכם ואז נכנס אוטומטית למערכת ההתאמות.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-xs text-stone-500">
                  <th className="py-2 font-semibold">מטפל/ת</th>
                  <th className="py-2 font-semibold text-center">סטטוס</th>
                  <th className="py-2 font-semibold text-center">צפיות (מצטבר)</th>
                  <th className="py-2 font-semibold text-center">לחיצות ליצירת קשר (מצטבר)</th>
                  <th className="py-2 font-semibold text-left">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {therapists.map((t) => (
                  <tr key={t.id} className="border-b border-stone-100 hover:bg-stone-50">
                    <td className="py-2.5">
                      <div className="flex items-center gap-2.5">
                        {t.photo_url ? (
                          <img src={t.photo_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-xs font-bold text-stone-400">
                            {(t.name[0] ?? "?")}
                          </div>
                        )}
                        <span className="font-semibold text-stone-800">{t.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-center">
                      {t.status === "paying" && t.approved ? (
                        <span className="rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-xs font-bold text-green-800">פעיל בהתאמות</span>
                      ) : t.status === "approved" && t.approved ? (
                        <span className="rounded-full bg-teal-50 border border-teal-200 px-2 py-0.5 text-xs font-bold text-teal-800">מאושר</span>
                      ) : t.status === "rejected" ? (
                        <span className="rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-xs font-bold text-red-700" title="ערכו את הפרופיל ושמרו - יישלח שוב לבדיקה">נדחה - לתיקון</span>
                      ) : (
                        <span className="rounded-full bg-stone-100 border border-stone-200 px-2 py-0.5 text-xs text-stone-500">ממתין לאישור</span>
                      )}
                    </td>
                    <td className="py-2.5 text-center font-bold text-[#1A7A96]">{t.month_views}</td>
                    <td className="py-2.5 text-center font-bold text-[#2A5C3A]">{t.month_clicks}</td>
                    <td className="py-2.5 text-left whitespace-nowrap">
                      <Link href={`/centers/dashboard/therapists/${t.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-stone-600 hover:underline me-3">
                        ✏️ עריכה
                      </Link>
                      <Link href={t.profile_path} target="_blank" className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--teal)] hover:underline">
                        לצפייה <ExternalLink size={12} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      )}

      {/* עמוד המרכז הציבורי - סטטוס + כניסה לאזור העריכה (מסלול 1; במסלול 2 זה בכרטיס הפרופיל למעלה) */}
      {!isEntity && center.status === "active" && (
        <section className="mb-8 rounded-2xl border border-teal-200 bg-teal-50/40 p-5">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-black text-stone-800">🌐 עמוד המרכז הציבורי</h2>
            {center.public_page.enabled ? (
              <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-bold text-green-800">✓ מפורסם באתר</span>
            ) : (
              <span className="rounded-full border border-stone-200 bg-stone-100 px-3 py-1 text-xs text-stone-500">לא מפורסם</span>
            )}
          </div>
          <p className="mb-4 text-sm leading-6 text-stone-600">
            עמוד ציבורי מקודם בגוגל עם הלוגו, המידע על המרכז, הצוות המוביל ותמונות המרכז.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/centers/dashboard/profile"
              className="inline-block rounded-full px-5 py-2 text-sm font-bold text-white transition hover:opacity-95"
              style={{ background: "linear-gradient(135deg,var(--teal-dark),var(--teal))" }}>
              ✏️ עריכת העמוד והפרטים
            </Link>
            {center.public_page.slug && (
              <a href={`/centers/${center.public_page.slug}`} target="_blank"
                className="inline-flex items-center gap-1 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-50">
                צפייה בעמוד <ExternalLink size={13} />
              </a>
            )}
          </div>
        </section>
      )}

      {/* מאיפה מגיעות הפניות - משפך לכל מקור בנפרד */}
      {stats?.by_source && (stats.by_source.match.impressions > 0 || stats.by_source.directory.impressions > 0) && (
        <section className="mb-6 rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="mb-1 text-base font-black text-stone-800">מאיפה מגיעות הפניות</h2>
          <p className="mb-5 text-xs text-stone-400">
            שני מקורות חשיפה נפרדים - שאלון ההתאמה וגלישה במאגר. הפילוח מראה איפה החשיפה
            באמת הופכת לפנייה, וממילא איפה כדאי להשקיע.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <SourceFunnelCard
              title="✨ שאלון ההתאמה" color="#7c3aed"
              hint={isEntity ? "לפי סוגי הטיפול שסימנתם" : "לפי הפרופילים של מטפלי המרכז"}
              f={stats.by_source.match}
            />
            <SourceFunnelCard
              title="🔎 מאגר המטפלים" color="#0F766E"
              hint="גלישה חופשית ועמודי עיר/גישה בגוגל"
              f={stats.by_source.directory}
            />
          </div>
          {stats.by_source.direct_contacts > 0 && (
            <p className="mt-3 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs leading-5 text-stone-600">
              בנוסף: <strong>{stats.by_source.direct_contacts}</strong> לחיצות ליצירת קשר הגיעו מכניסה
              ישירה לעמוד הפרופיל (קישור שנשלח, חיפוש בגוגל) - בלי מעבר דרך ההתאמות או המאגר.
            </p>
          )}
        </section>
      )}

      {/* מה המנוי מייצר מול מטפל ללא קידום */}
      {stats?.benchmark && (stats.benchmark.free_avg_views > 0 || stats.benchmark.free_avg_contacts > 0) && (
        <section className="mb-6 rounded-2xl border p-5" style={{ background: "var(--teal-pale)", borderColor: "var(--teal-mid)" }}>
          <h2 className="mb-1 text-base font-black" style={{ color: "var(--teal-dark)" }}>מה המנוי מייצר</h2>
          <p className="mb-4 text-xs leading-5 text-stone-500">
            {isEntity ? "המרכז שלכם" : "ממוצע למטפל במרכז"} מול {stats.benchmark.peers} מטפלים
            ללא קידום, <strong>באותם {stats.benchmark.days} הימים בדיוק</strong> - כך שגודל
            התקופה ונפח התנועה באתר זהים לשני הצדדים.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <CompareRow
              label="צפיות בפרופיל"
              mine={stats.benchmark.per_therapist_views}
              theirs={stats.benchmark.free_avg_views}
            />
            <CompareRow
              label="לחיצות ליצירת קשר"
              mine={stats.benchmark.per_therapist_contacts}
              theirs={stats.benchmark.free_avg_contacts}
            />
          </div>
        </section>
      )}

      {/* סטטיסטיקות מרוכזות - פילוח הפונים */}
      {stats && (stats.by_region.length > 0 || stats.by_issue.length > 0 || (stats.clicks_total?.total ?? 0) > 0) && (
        <section className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="mb-1 text-base font-black text-stone-800">מי מחפש את המרכז שלכם</h2>
          <p className="mb-5 text-xs text-stone-400">פילוח מצטבר של כלל הפונים למטפלי המרכז, מאז ההצטרפות - נתונים אנונימיים לחלוטין</p>

          <div className="grid gap-6 md:grid-cols-2">
            <Bars title="לפי אזור" icon={MapPin} data={stats.by_region.map((b) => ({ name: REGION_LABELS[b.name] ?? b.name, count: b.count }))} color="#0F5468" />
            <Bars title="לפי נושא הפנייה" icon={Activity} data={stats.by_issue} color="#8B2E0A" />
            <Bars title="לפי קבוצת גיל" data={stats.by_age} color="#7c3aed" />
            <Bars title="לפי מגדר" data={stats.by_gender.map((b) => ({ name: GENDER_LABELS[b.name] ?? b.name, count: b.count }))} color="#1A7A96" />
          </div>

          {/* ערוצי פנייה */}
          <div className="mt-6 border-t border-stone-100 pt-5">
            <h3 className="mb-3 text-sm font-black text-stone-700">איך פונים (מצטבר)</h3>
            <div className="flex flex-wrap gap-3">
              <Channel label="וואטסאפ" value={(stats.clicks_total ?? EMPTY_CLICKS).whatsapp} total={(stats.clicks_total ?? EMPTY_CLICKS).total} color="#22c55e" />
              <Channel label="טלפון" value={(stats.clicks_total ?? EMPTY_CLICKS).phone} total={(stats.clicks_total ?? EMPTY_CLICKS).total} color="#57534e" />
              <Channel label="מייל" value={(stats.clicks_total ?? EMPTY_CLICKS).email} total={(stats.clicks_total ?? EMPTY_CLICKS).total} color="#3b82f6" />
              <Channel label="📝 הודעות מהאתר" value={(stats.clicks_total ?? EMPTY_CLICKS).site_message ?? 0} total={(stats.clicks_total ?? EMPTY_CLICKS).total} color="#d97706" />
            </div>
            <div className="mt-4 rounded-xl border p-4" style={{ background: "var(--teal-pale)", borderColor: "var(--teal-mid)" }}>
              <h4 className="mb-1.5 text-sm font-black" style={{ color: "var(--teal-dark)" }}>ⓘ מה נספר כאן?</h4>
              <p className="text-[13px] leading-6 text-stone-700">
                המספרים סופרים כל פעם שמטופל <strong>לחץ</strong> על הוואטסאפ, הטלפון או המייל שבפרופיל, כלומר ביקש ליצור קשר.
                חלק מהלוחצים לא משלימים את השליחה או את השיחה, ולכן ייתכן שלא כל לחיצה הגיעה אליכם בפועל.
                הודעות שנשלחו דרך טופס האתר הן היחידות שמגיעות תמיד, ישירות למייל.
              </p>
            </div>
          </div>

          {/* מגמה */}
          {stats.trend.some((m) => m.clicks > 0) && (
            <div className="mt-6 border-t border-stone-100 pt-5">
              <h3 className="mb-3 text-sm font-black text-stone-700">מגמת לחיצות ליצירת קשר - 6 חודשים</h3>
              <TrendBars trend={stats.trend} />
            </div>
          )}
        </section>
      )}
    </main>
  );
}

// משפך של מקור חשיפה אחד: הופעות ← כניסות ← פניות, עם שיעורי המעבר.
function SourceFunnelCard({ title, hint, color, f }: {
  title: string; hint: string; color: string; f: SourceFunnel;
}) {
  const Step = ({ n, label }: { n: number; label: string }) => (
    <div className="flex-1 text-center">
      <div className="text-xl font-black" style={{ color }}>{n.toLocaleString("he-IL")}</div>
      <div className="text-[10px] leading-tight text-stone-500">{label}</div>
    </div>
  );
  return (
    <div className="rounded-xl border border-stone-200 p-4">
      <div className="mb-0.5 text-sm font-black text-stone-800">{title}</div>
      <div className="mb-3 text-[11px] text-stone-400">{hint}</div>
      <div className="flex items-center gap-1">
        <Step n={f.impressions} label="הופעות" />
        <span className="text-stone-300">←</span>
        <Step n={f.entries} label="כניסות" />
        <span className="text-stone-300">←</span>
        <Step n={f.contacts} label="פניות" />
      </div>
      {f.impressions > 0 && (
        <div className="mt-3 border-t border-stone-100 pt-2 text-[11px] text-stone-500">
          {f.entry_rate}% מההופעות נכנסו לפרופיל
          {f.entries > 0 && <> · {f.contact_rate}% מהנכנסים פנו</>}
        </div>
      )}
    </div>
  );
}

// השוואה למטפל ללא קידום. מציג "פי X" רק כשההפרש משמעותי - אחרת זה נשמע
// כמו הבטחה שלא עומדים מאחוריה.
function CompareRow({ label, mine, theirs }: { label: string; mine: number; theirs: number }) {
  const x = theirs > 0 ? mine / theirs : 0;
  const showX = theirs > 0 && x >= 1.3;
  const max = Math.max(mine, theirs, 1);
  const Bar = ({ v, c }: { v: number; c: string }) => (
    <div className="h-2 rounded-full bg-white/70">
      <div className="h-full rounded-full" style={{ width: `${(100 * v) / max}%`, background: c }} />
    </div>
  );
  return (
    <div className="rounded-xl bg-white/70 p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs font-bold text-stone-700">{label}</span>
        {showX && (
          <span className="text-xs font-black" style={{ color: "var(--teal-dark)" }}>
            פי {x >= 10 ? Math.round(x) : x.toFixed(1)}
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        <div>
          <div className="mb-0.5 flex justify-between text-[11px] text-stone-600">
            <span>אצלכם</span><span className="font-bold">{mine.toLocaleString("he-IL")}</span>
          </div>
          <Bar v={mine} c="var(--teal)" />
        </div>
        <div>
          <div className="mb-0.5 flex justify-between text-[11px] text-stone-400">
            <span>ללא קידום</span><span>{theirs.toLocaleString("he-IL")}</span>
          </div>
          <Bar v={theirs} c="#d6d3d1" />
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }: { icon: typeof Users; label: string; value: number; sub: string; color: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <Icon size={18} style={{ color }} />
      <div className="mt-2 text-3xl font-black text-stone-900">{value.toLocaleString("he-IL")}</div>
      <div className="text-xs font-semibold text-stone-600">{label}</div>
      <div className="text-[11px] text-stone-400">{sub}</div>
    </div>
  );
}

function Bars({ title, icon: Icon, data, color }: { title: string; icon?: typeof MapPin; data: Bar[]; color: string }) {
  if (data.length === 0) return (
    <div>
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-black text-stone-700">{Icon && <Icon size={15} style={{ color }} />}{title}</h3>
      <p className="text-xs text-stone-400">אין עדיין נתונים</p>
    </div>
  );
  const max = data[0]?.count ?? 1;
  return (
    <div>
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-black text-stone-700">{Icon && <Icon size={15} style={{ color }} />}{title}</h3>
      <div className="space-y-1.5">
        {data.slice(0, 6).map((d) => (
          <div key={d.name} className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-left text-xs font-semibold text-stone-600">{d.name}</span>
            <div className="h-5 flex-1 overflow-hidden rounded-full bg-stone-100">
              <div className="flex h-full items-center justify-end rounded-full px-2" style={{ width: `${Math.max((d.count / max) * 100, 10)}%`, background: color }}>
                <span className="text-xs font-bold text-white">{d.count}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Channel({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex-1 rounded-xl border border-stone-200 p-3 text-center" style={{ minWidth: 90 }}>
      <div className="text-2xl font-black" style={{ color }}>{value}</div>
      <div className="text-xs font-semibold text-stone-600">{label}</div>
      <div className="text-[11px] text-stone-400">{pct}%</div>
    </div>
  );
}

function TrendBars({ trend }: { trend: { label: string; clicks: number }[] }) {
  const max = Math.max(...trend.map((m) => m.clicks), 1);
  return (
    <div className="flex items-end gap-2" style={{ height: 120 }}>
      {trend.map((m) => (
        <div key={m.label} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-xs font-bold text-stone-600">{m.clicks}</span>
          <div className="w-full rounded-t-md" style={{ height: `${Math.max((m.clicks / max) * 90, 3)}px`, background: "var(--teal)" }} />
          <span className="text-[10px] text-stone-400">{m.label.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}
