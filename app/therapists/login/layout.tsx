import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "כניסה למטפלים",
  description: "כניסה לדשבורד המטפלים של טיפול חכם - ניהול הפרופיל שלך, צפייה בסטטיסטיקות ועדכון פרטים.",
  // עמוד כניסה אינו עמוד לחיפוש (עד 13/10/2026 היה פתוח לאינדוקס). follow
  // נשאר, כדי שהקישורים ממנו לעמודי האתר ימשיכו להיספר.
  robots: { index: false, follow: true },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
