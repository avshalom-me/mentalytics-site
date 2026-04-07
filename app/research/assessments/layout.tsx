import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "סוגי אבחונים והערכות פסיכולוגיות",
  description: "מדריך לסוגי האבחונים הפסיכולוגיים — פסיכו-דידקטי, פסיכו-דיאגנוסטי, נוירו-פסיכולוגי ועוד. מי עושה אותם, כמה עולה ומה מקבלים.",
};

export default function AssessmentsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
