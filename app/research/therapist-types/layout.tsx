import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "סוגי המטפלים בישראל — פסיכולוג, פסיכיאטר, עו\"ס ועוד",
  description: "מה ההבדל בין פסיכולוג קליני לחינוכי? מה עושה עו\"ס קליני? מדריך מלא לסוגי המטפלים הנפשיים בישראל, ההכשרה והרישוי שלהם.",
};

export default function TherapistTypesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
