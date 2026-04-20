import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "כניסה למטפלים",
  description: "כניסה לדשבורד המטפלים של טיפול חכם — ניהול הפרופיל שלך, צפייה בסטטיסטיקות ועדכון פרטים.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
