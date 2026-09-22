import type { Metadata } from "next";
import { shareMetadata, editorialImage } from "@/app/lib/share-metadata";

export const metadata: Metadata = {
  alternates: { canonical: "https://www.mentalytics.co.il/research/therapist-types" },
  title: "סוגי מטפלים - פסיכולוג, פסיכיאטר, עו\"ס ועוד",
  description: "מה ההבדל בין פסיכולוג קליני לחינוכי? מה עושה עו\"ס קליני? מדריך מלא לסוגי המטפלים הנפשיים בישראל, ההכשרה והרישוי שלהם.",
  ...shareMetadata({
    url: "/research/therapist-types",
    title: "סוגי מטפלים - פסיכולוג, פסיכיאטר, עו\"ס ועוד",
    description: "מה ההבדל בין פסיכולוג קליני לחינוכי? מה עושה עו\"ס קליני? מדריך מלא לסוגי המטפלים הנפשיים בישראל, ההכשרה והרישוי שלהם.",
    image: editorialImage("therapist-types"),
  }),
};

export default function TherapistTypesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
