import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "שאלון הכוונה טיפולית למבוגרים",
  description: "מלאו שאלון קצר וקבלו הכוונה מותאמת אישית לסוג הטיפול והמטפל המתאים לכם - על בסיס מחקר וניסיון קליני.",
  // See app/kids/layout.tsx: noindex (it is a flow, not a landing page) but
  // follow, so link equity reaches /therapists and the topic pages.
  robots: { index: false, follow: true },
};

export default function AdultsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
