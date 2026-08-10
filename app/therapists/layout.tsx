import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "מאגר מטפלים - פסיכולוגים ומטפלים מוסמכים",
  // Also the fallback description for every /therapists/* page that sets none,
  // so it has to read as an offer and not as a feature list of a search form.
  description:
    "מאגר מטפלים מאומתים: פסיכולוגים, עו״ס קליניים ומטפלים - סינון לפי אזור, סוג קושי, גישה טיפולית והסדרי קופות. או מלאו שאלון קצר וקבלו התאמה אישית, בחינם.",
};

export default function TherapistsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
