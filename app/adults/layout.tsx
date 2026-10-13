import type { Metadata } from "next";
import { staffLinkBootScript } from "@/app/lib/staff-link";

export const metadata: Metadata = {
  title: "שאלון הכוונה טיפולית למבוגרים",
  description: "מלאו שאלון קצר וקבלו הכוונה מותאמת אישית לסוג הטיפול והמטפל המתאים לכם - על בסיס מחקר וניסיון קליני.",
  // See app/kids/layout.tsx: noindex (it is a flow, not a landing page) but
  // follow, so link equity reaches /therapists and the topic pages.
  robots: { index: false, follow: true },
};

export default function AdultsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* קישור צוות (?staff=): הקוד עובר לאחסון והכתובת נמחקת עוד בזמן פענוח
          ה-HTML, לפני שתגי המדידה נטענים - ראו app/lib/staff-link.ts. */}
      <script id="staff-link" dangerouslySetInnerHTML={{ __html: staffLinkBootScript() }} />
      {children}
    </>
  );
}
