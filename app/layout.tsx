import type { Metadata } from "next";
import { preload } from "react-dom";
import "./globals.css";
import "./fonts/heebo.css";
import NavBar from "./components/NavBar";
import SiteFooter from "./components/SiteFooter";
import AccessibilityWidget from "./components/AccessibilityWidget";
import AttributionTracker from "./components/AttributionTracker";
import ThirdPartyTags from "./components/ThirdPartyTags";
import { paidVisitorBootScript } from "@/app/lib/paid-visitor";
import { OG_FALLBACK_IMAGE } from "@/app/lib/share-metadata";
import { learningFooterLinkLive } from "@/app/lib/learning-door";

// Heebo מתארח אצלנו ולא נמשך מגוגל בזמן ה-build; הכללים וההסבר ב-fonts/heebo.css.
// הקובץ העברי נטען מראש, כמו ש-next/font עשה: בלי זה הדפדפן מגלה את הגופן רק
// אחרי שקרא את ה-CSS, והטקסט מוצג זמן רב יותר בגופן החלופי.
const HEEBO_HEBREW_FONT = "/fonts/heebo-v28/heebo-hebrew.woff2";

export const metadata: Metadata = {
  title: { default: "טיפול חכם", template: "%s | טיפול חכם" },
  description: "מערכת הכוונה טיפולית חכמה - מלאו שאלון קצר וקבלו המלצות מותאמות אישית על סוג הטיפול והמטפל המתאים לכם.",
  metadataBase: new URL("https://www.mentalytics.co.il"),
  // Inherited by every page that sets no openGraph of its own, so it must hold
  // nothing page-specific: no url, no title, no description. It used to carry
  // the homepage's, and /therapists, /centers, /about, /adults, /kids and the
  // rest all shared on Facebook AS the homepage (og:url is the share target).
  // Without them Next fills og:title and og:description from each page's own
  // title and description, and Facebook takes the page's own URL. The
  // homepage's share text lives in app/page.tsx; articles use shareMetadata().
  openGraph: {
    siteName: "טיפול חכם",
    locale: "he_IL",
    type: "website",
    images: [OG_FALLBACK_IMAGE],
  },
  // Title, description and image are filled per page from the above.
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // preload() ולא תג <link> ב-<head>: React מרים רמז כזה לראש ה-head בעצמו, ותג
  // כתוב ביד יצא ב-HTML פעמיים. crossOrigin נדרש גם לקובץ מהדומיין שלנו: גופנים
  // נטענים תמיד במצב CORS, ובלעדיו הדפדפן מוריד את הקובץ פעמיים.
  preload(HEEBO_HEBREW_FONT, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  return (
    <html lang="he" dir="rtl">
      <body className="min-h-screen">
        {/* ראשון ב-body, לפני הציור הראשון: מסמן מבקר ממומן (html.mnt-paid)
            כדי שמטפלים חינמיים לא יוצגו לו - ראו app/lib/paid-visitor.ts. */}
        <script id="paid-visitor" dangerouslySetInnerHTML={{ __html: paidVisitorBootScript() }} />
        <AttributionTracker />
        {/* NavBar also renders the "skip to main content" link, first thing
            in the tab order, in the language of the page. */}
        <NavBar />
        <AccessibilityWidget />

        <div id="main-content">{children}</div>
        {/* Vercel Analytics, Google (GA4 and Ads) and Taboola. None of them runs
            on the counsellors' questionnaire (/school): see
            app/components/ThirdPartyTags.tsx and app/lib/tag-free-paths.ts. */}
        <ThirdPartyTags />

        {/* The footer's link to "לימוד חכם" is decided here, on the server, so the
            HTML and the hydrated footer always agree - see learningFooterLinkLive. */}
        <SiteFooter learningLink={learningFooterLinkLive()} />
      </body>
    </html>
  );
}