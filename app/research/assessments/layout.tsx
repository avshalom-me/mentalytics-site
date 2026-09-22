import type { Metadata } from "next";
import { shareMetadata, editorialImage } from "@/app/lib/share-metadata";

export const metadata: Metadata = {
  alternates: { canonical: "https://www.mentalytics.co.il/research/assessments" },
  title: "סוגי אבחונים והערכות פסיכולוגיות",
  description: "מדריך לסוגי האבחונים הפסיכולוגיים - פסיכו-דידקטי, פסיכו-דיאגנוסטי, נוירו-פסיכולוגי ועוד. מי עושה אותם, כמה עולה ומה מקבלים.",
  ...shareMetadata({
    url: "/research/assessments",
    title: "סוגי אבחונים והערכות פסיכולוגיות",
    description: "מדריך לסוגי האבחונים הפסיכולוגיים - פסיכו-דידקטי, פסיכו-דיאגנוסטי, נוירו-פסיכולוגי ועוד. מי עושה אותם, כמה עולה ומה מקבלים.",
    image: editorialImage("assessments"),
  }),
};

export default function AssessmentsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
