"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabaseClient";
import { Building2, Users, Eye, MessageCircle, MapPin, Activity, ExternalLink, LogOut, Loader2 } from "lucide-react";

// דשבורד פורטל המרכז: רשימת המטפלים (עם קישור לפרופיל של כל אחד) +
// סטטיסטיקות מצטברות לכל המרכז. הנתונים מ-/api/center-portal (מאומת בטוקן).

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

type Clicks = { whatsapp: number; phone: number; email: number; total: number };
type Bar = { name: string; count: number };

type Stats = {
  listed_count: number;
  views_month: number;
  clicks_week: Clicks;
  clicks_month: Clicks;
  by_region: Bar[];
  by_issue: Bar[];
  by_age: Bar[];
  by_gender: Bar[];
  trend: { label: string; clicks: number }[];
};

type PortalData = {
  center: {
    name: string;
    status: string;
    plan_title: string | null;
    billing_starts_at: string | null;
    therapist_quota: number;
    linked_count: number;
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

  // חזרה מיצירת מטפל חדש (?created=1) — באנר הצלחה חד-פעמי.
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
          setError("החשבון שלכם עדיין לא מקושר למרכז פעיל. ודאו שנרשמתם עם המייל שאיתו קיבלתם את ההצעה, או פנו אלינו.");
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
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700;800;900&display=swap');`}</style>
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

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700;800;900&display=swap');`}</style>

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

      {justCreated && (
        <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-semibold text-green-800">
          ✓ הפרופיל נוצר ונשלח לאישור צוות טיפול חכם. לאחר האישור המטפל/ת ייכנס/תיכנס אוטומטית למערכת ההתאמות — הסטטוס מתעדכן כאן בטבלה.
        </div>
      )}

      {/* מדדים מרכזיים */}
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={Users} label="מטפלים במרכז" value={therapists.length} sub={`${stats?.listed_count ?? 0} מוצגים בהתאמות`} color="#0F5468" />
        <StatCard icon={Eye} label="צפיות בפרופילים" value={stats?.views_month ?? 0} sub="30 יום" color="#1A7A96" />
        <StatCard icon={MessageCircle} label="פניות מטופלים" value={stats?.clicks_month.total ?? 0} sub="30 יום" color="#2A5C3A" />
        <StatCard icon={Activity} label="פניות השבוע" value={stats?.clicks_week.total ?? 0} sub="7 ימים" color="#8B2E0A" />
      </div>

      {/* רשימת המטפלים */}
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
                title="כל מקומות המנוי בשימוש — להרחבה פנו אלינו">
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
            עדיין לא נוספו מטפלים למרכז. הוסיפו את המטפלים שלכם בכפתור למעלה — כל פרופיל עובר אישור קצר של צוות טיפול חכם ואז נכנס אוטומטית למערכת ההתאמות.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-xs text-stone-500">
                  <th className="py-2 font-semibold">מטפל/ת</th>
                  <th className="py-2 font-semibold text-center">סטטוס</th>
                  <th className="py-2 font-semibold text-center">צפיות (חודש)</th>
                  <th className="py-2 font-semibold text-center">פניות (חודש)</th>
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
                        <span className="rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-xs font-bold text-red-700" title="ערכו את הפרופיל ושמרו — יישלח שוב לבדיקה">נדחה — לתיקון</span>
                      ) : (
                        <span className="rounded-full bg-stone-100 border border-stone-200 px-2 py-0.5 text-xs text-stone-500">ממתין לאישור</span>
                      )}
                    </td>
                    <td className="py-2.5 text-center font-bold text-[#1A7A96]">{t.month_views}</td>
                    <td className="py-2.5 text-center font-bold text-[#2A5C3A]">{t.month_clicks}</td>
                    <td className="py-2.5 text-left whitespace-nowrap">
                      <Link href={`/centers/dashboard/therapists/${t.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-stone-600 hover:underline ml-3">
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

      {/* סטטיסטיקות מרוכזות — פילוח הפונים */}
      {stats && (stats.by_region.length > 0 || stats.by_issue.length > 0 || stats.clicks_month.total > 0) && (
        <section className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="mb-1 text-base font-black text-stone-800">מי מחפש את המרכז שלכם</h2>
          <p className="mb-5 text-xs text-stone-400">פילוח מצטבר של כלל הפונים למטפלי המרכז (30 יום) — נתונים אנונימיים לחלוטין</p>

          <div className="grid gap-6 md:grid-cols-2">
            <Bars title="לפי אזור" icon={MapPin} data={stats.by_region.map((b) => ({ name: REGION_LABELS[b.name] ?? b.name, count: b.count }))} color="#0F5468" />
            <Bars title="לפי נושא הפנייה" icon={Activity} data={stats.by_issue} color="#8B2E0A" />
            <Bars title="לפי קבוצת גיל" data={stats.by_age} color="#7c3aed" />
            <Bars title="לפי מגדר" data={stats.by_gender.map((b) => ({ name: GENDER_LABELS[b.name] ?? b.name, count: b.count }))} color="#1A7A96" />
          </div>

          {/* ערוצי פנייה */}
          <div className="mt-6 border-t border-stone-100 pt-5">
            <h3 className="mb-3 text-sm font-black text-stone-700">איך פונים (30 יום)</h3>
            <div className="flex flex-wrap gap-3">
              <Channel label="וואטסאפ" value={stats.clicks_month.whatsapp} total={stats.clicks_month.total} color="#22c55e" />
              <Channel label="טלפון" value={stats.clicks_month.phone} total={stats.clicks_month.total} color="#57534e" />
              <Channel label="מייל" value={stats.clicks_month.email} total={stats.clicks_month.total} color="#3b82f6" />
            </div>
          </div>

          {/* מגמה */}
          {stats.trend.some((m) => m.clicks > 0) && (
            <div className="mt-6 border-t border-stone-100 pt-5">
              <h3 className="mb-3 text-sm font-black text-stone-700">מגמת פניות — 6 חודשים</h3>
              <TrendBars trend={stats.trend} />
            </div>
          )}
        </section>
      )}
    </main>
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
