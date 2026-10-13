import type { Metadata } from "next";

// עמוד כניסה אינו עמוד לחיפוש. עד 13/10/2026 הוא היה פתוח לאינדוקס בלי כותרת
// משלו, וקיבל הופעות בגוגל (61 ב-28 יום) על חשבון העמודים שמציעים משהו.
// follow נשאר, כדי שהקישורים ממנו לעמודי האתר ימשיכו להיספר.
export const metadata: Metadata = {
  title: "כניסה למרכזים טיפוליים",
  robots: { index: false, follow: true },
};

export default function CenterLoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
