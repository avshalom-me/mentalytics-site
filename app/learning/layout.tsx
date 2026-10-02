import type { Metadata } from "next";

// אזור המורים המקצועיים ("מענה לימודי"). לפי החלטת הבעלים (2/10/2026) האזור
// לא מקושר מהניווט, מדף הבית או מה-sitemap, ולא מאונדקס: מורים מגיעים לכאן
// מקישור ישיר שנשלח בגיוס, והורים - רק מכרטיס בתוצאות שאלון הילדים.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function LearningLayout({ children }: { children: React.ReactNode }) {
  return children;
}
