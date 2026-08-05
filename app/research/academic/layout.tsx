import type { Metadata } from "next";

// Originally added because a client component cannot export `metadata`, and
// /research/academic had none: no description, no canonical, and a <title> that
// fell back to the bare site default. The page is a server component now and
// could hold its own metadata, but keeping it here costs nothing and keeps the
// route's metadata in one place.
export const metadata: Metadata = {
  title: "מאמרים אקדמאיים - המקורות שמאחורי השאלונים",
  description:
    "מאות המחקרים והמקורות האקדמיים שעליהם מבוססים שאלוני ההכוונה של טיפול חכם, עם סטטוס אימות לכל מקור וקישור ל-DOI. ניתן לחיפוש, לסינון לפי נושא ולמיון לפי שנה.",
  alternates: { canonical: "https://www.mentalytics.co.il/research/academic" },
  openGraph: {
    title: "מאמרים אקדמאיים - המקורות שמאחורי השאלונים",
    description: "המחקרים והמקורות האקדמיים שעליהם מבוססים שאלוני ההכוונה של טיפול חכם.",
    url: "https://www.mentalytics.co.il/research/academic",
    type: "website",
  },
};

export default function AcademicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
