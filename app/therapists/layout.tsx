import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "מאגר מטפלים — פסיכולוגים ומטפלים מוסמכים",
  description: "חיפוש וסינון מטפלים, פסיכולוגים ומאבחנים לפי סוג טיפול, אזור, הסדרי ביטוח והעדפות אישיות.",
};

export default function TherapistsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
