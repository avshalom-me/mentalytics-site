import type { Metadata } from "next";

// A client component cannot export `metadata`, so /research/academic had none:
// no description, no canonical, and a <title> that fell back to the bare site
// default - the same string the homepage uses. That is very likely the page
// Search Console reports as "duplicate without a user-selected canonical".
export const metadata: Metadata = {
  title: "מאמרים אקדמאיים - המקורות שמאחורי השאלונים",
  description:
    "רשימת המחקרים והמקורות האקדמיים שעליהם מבוססים שאלוני ההכוונה של טיפול חכם - ניתן לחיפוש, לסינון ולמיון.",
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
