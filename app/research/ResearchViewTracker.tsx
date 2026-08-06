"use client";

import { usePathname } from "next/navigation";
import { usePageView } from "@/app/lib/useTrack";

// מעקב כניסות למאמרים - עד 6/8/26 אשכול התוכן היה עיוור לחלוטין באנליטיקס
// (אף מאמר לא שלח page_view), כך שכניסה אורגנית למאמר לא נספרה בשום חתך.
// יושב ב-layout של /research ולכן מכסה כל מאמר, כולל עריכותיים שנוספים
// מהאדמין. page = "research:<slug>"; לאינדקס - "research:index".
//
// usePageView יורה פעם אחת לכל mount (דגל sent) - לכן ה-key לפי הנתיב:
// מעבר בין מאמרים באותו ביקור ממונט מחדש את הרכיב הפנימי ונספר כצפייה חדשה.

function Fire({ page }: { page: string }) {
  usePageView(page, "research");
  return null;
}

export default function ResearchViewTracker() {
  const pathname = usePathname();
  const slug = (pathname ?? "/research").replace(/^\/research\/?/, "").replace(/\/$/, "") || "index";
  return <Fire key={pathname} page={`research:${decodeURIComponent(slug)}`} />;
}
