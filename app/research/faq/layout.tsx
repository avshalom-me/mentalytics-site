import type { Metadata } from "next";
import { FAQS } from "./faqs";

export const metadata: Metadata = {
  title: "שאלות נפוצות על טיפול נפשי",
  description: "תשובות לשאלות הנפוצות ביותר על טיפול פסיכולוגי - עלות, קופות חולים, משך טיפול, הבדל בין פסיכולוג לפסיכיאטר, חיסיון ועוד.",
};

// FAQPage JSON-LD נפלט מה-layout (server) כדי שיהיה ב-HTML הראשוני - הדף עצמו
// הוא client component ולכן ה-JSON-LD שלו לא היה נסרק.
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      {children}
    </>
  );
}
