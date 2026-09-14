"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import CenterDashboardView from "@/app/centers/dashboard/DashboardView";
import type { PortalData } from "@/app/centers/dashboard/DashboardView";

// "צפייה בתור מרכז" (7/9/2026): מרנדר את פורטל המרכז בדיוק כפי שהמרכז רואה
// אותו, מתוך /admin/centers. הצורך: אין באדמין דרך לראות מה המרכז רואה, ואין
// מסלול התחזות - הכניסה לפורטל היא לפי חשבון Supabase של המרכז בלבד, החלטה
// מכוונת ב-center-auth.ts. בלי המסך הזה כל שאלה על "מה מוצג להם" נענתה בניחוש.
//
// קריאה בלבד: הנתונים מגיעים מ-center_portal_preview, שמריץ את אותה
// buildCenterPortalPayload של הפורטל האמיתי - כך שהתצוגה לא יכולה להיסחף
// ממנו. preview=true מסתיר את פעולות בעל החשבון (התנתקות).
//
// המזהה מגיע כמקטע נתיב ולא כ-query: useSearchParams חייב Suspense ובאותו
// מסלול לא נפתר כאן בכלל, ו-useParams עובד ישירות.

type CenterRow = { id: string; name: string; status: string };

export default function CenterPreviewPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ? decodeURIComponent(params.id) : "";
  const [centers, setCenters] = useState<CenterRow[]>([]);
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin-centers")
      .then((r) => r.json())
      .then((j) => setCenters((j.centers ?? []).filter((c: CenterRow) => c.status === "active")))
      .catch(() => setCenters([]));
  }, []);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    setLoading(true);
    setError("");
    fetch("/api/admin-centers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "center_portal_preview", id }),
    })
      .then((r) => r.json())
      .then((j) => (j.ok ? setData(j as PortalData) : setError(j.error ?? "שגיאה בטעינת הנתונים")))
      .catch(() => setError("שגיאת רשת"))
      .finally(() => setLoading(false));
  }, [id]);

  const current = centers.find((c) => c.id === id);

  return (
    <div dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <div className="sticky top-0 z-30 border-b border-amber-200 bg-amber-50 px-5 py-2.5">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
          <span className="rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-black text-amber-900">
            👁 צפייה בתור מרכז
          </span>
          <span className="text-xs text-amber-900">
            זה בדיוק מה שהמרכז רואה בפורטל שלו. קריאה בלבד - שום פעולה כאן אינה משנה דבר.
          </span>
          <select
            value={current ? id : ""}
            onChange={(e) => { if (e.target.value) window.location.href = `/admin/centers/preview/${e.target.value}`; }}
            className="ms-auto rounded-lg border border-amber-300 bg-white px-3 py-1 text-sm"
          >
            <option value="">מרכז אחר...</option>
            {centers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <Link href="/admin/centers" className="text-xs font-bold text-amber-900 underline">
            ← חזרה לניהול מרכזים
          </Link>
        </div>
      </div>

      {loading && (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 size={26} className="animate-spin text-[var(--teal)]" />
        </div>
      )}

      {!loading && error && (
        <p className="mx-auto mt-10 max-w-md rounded-2xl border border-red-200 bg-red-50 p-5 text-center text-sm text-red-700">
          {error}
        </p>
      )}

      {!loading && !error && data && <CenterDashboardView data={data} preview />}
    </div>
  );
}
