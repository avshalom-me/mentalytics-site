import type { Metadata } from "next";

// הדשבורד של המטפל/ת, כולל עריכת הפרופיל: אזור מחובר, לא עמוד לחיפוש.
// עד 13/10/2026 לא הוצהר עליו noindex, ו-robots.ts חוסם רק /admin ו-/api.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function TherapistDashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
