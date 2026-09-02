import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "שאלון הפניה לצוותי חינוך",
  description: "כלי עבודה ליועצות ולצוותים חינוכיים: מיפוי מצב התלמיד/ה, מפת המסלולים - צוות רב-מקצועי, ועדת זכאות ואפיון והתאמות - עם המועדים והמסמכים, וטיוטת סיכום להפניה.",
  // Same policy as /kids and /adults: the flow itself stays out of the index
  // and out of the sitemap; a landing page for counsellors will be the indexed
  // entry point once there is one.
  robots: { index: false, follow: true },
};

export default function SchoolLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
