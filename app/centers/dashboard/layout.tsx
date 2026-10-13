import type { Metadata } from "next";

// פורטל המרכז, על כל עמודיו (עריכה, מטפלים): אזור מחובר, לא עמוד לחיפוש.
// עד 13/10/2026 לא הוצהר עליו noindex, ו-robots.ts חוסם רק /admin ו-/api.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function CenterDashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
