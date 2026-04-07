import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "שאלות נפוצות על טיפול נפשי",
  description: "תשובות לשאלות הנפוצות ביותר על טיפול פסיכולוגי — עלות, קופות חולים, משך טיפול, הבדל בין פסיכולוג לפסיכיאטר, חיסיון ועוד.",
};

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
