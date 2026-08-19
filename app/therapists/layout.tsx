import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "מאגר מטפלים - פסיכולוגים ומטפלים מוסמכים",
  // Also the fallback description for every /therapists/* page that sets none,
  // so it has to read as an offer and not as a feature list of a search form.
  description:
    "מלאו שאלון מקצועי שפותח על ידי פסיכולוגים קליניים ומצאו את ההתאמה הנכונה, או סננו בעצמכם את מאגר המטפלים שתעודותיהם אומתו לפי אזור, קושי וגישה. בחינם.",
};

export default function TherapistsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
