import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "הרשמה למאגר המטפלים",
  description: "הצטרפו למאגר המטפלים של טיפול חכם — צרו פרופיל מקצועי, קבלו פניות ממטופלים מתאימים והגדילו את החשיפה שלכם.",
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
