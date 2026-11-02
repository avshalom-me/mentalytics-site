import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "מצפן היועצת - שאלון ליועצת ולגננת",
  description: "מצפן היועצת, שאלון ליועצת ולגננת: הבנה ראשונית של מוקד הקושי בכל אחד מהמסלולים (רגשי, לימודי, חברתי, התנהגותי), הפניה והסבר לטיפול או לאבחון המדויק ביותר, ומפת הוועדות עם המועדים.",
  // Same policy as /kids and /adults: the flow itself stays out of the index
  // and out of the sitemap; a landing page for counsellors will be the indexed
  // entry point once there is one.
  robots: { index: false, follow: true },
};

export default function SchoolLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
