"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabaseClient";
import { Building2, Users, Eye, MessageCircle, MapPin, Activity, ExternalLink, LogOut, Loader2, Sparkles, Search } from "lucide-react";
import { type PublicPage } from "./PublicPageEditor";
import InvitePanel from "./InvitePanel";
import CenterDashboardView from "./DashboardView";

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

  return <CenterDashboardView data={data} justCreated={justCreated} logout={logout} />;
}
