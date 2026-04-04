import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "שאלון הכוונה טיפולית למבוגרים",
  description: "מלאו שאלון קצר וקבלו הכוונה מותאמת אישית לסוג הטיפול והמטפל המתאים לכם — על בסיס מחקר וניסיון קליני.",
};

export default function AdultsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
