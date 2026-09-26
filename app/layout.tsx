import type { Metadata } from "next";
import "./globals.css";
import { Heebo } from "next/font/google";
import NavBar from "./components/NavBar";
import SiteFooter from "./components/SiteFooter";
import AccessibilityWidget from "./components/AccessibilityWidget";
import AttributionTracker from "./components/AttributionTracker";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";
import { paidVisitorBootScript } from "@/app/lib/paid-visitor";
import { OG_FALLBACK_IMAGE } from "@/app/lib/share-metadata";

const heebo = Heebo({
  subsets: ["hebrew"],
  weight: ["300", "400", "500", "700", "800", "900"],
  display: "swap",
});

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
  return (
    <html lang="he" dir="rtl">
      <body className={`${heebo.className} min-h-screen`}>
        {/* ראשון ב-body, לפני הציור הראשון: מסמן מבקר ממומן (html.mnt-paid)
            כדי שמטפלים חינמיים לא יוצגו לו - ראו app/lib/paid-visitor.ts. */}
        <script id="paid-visitor" dangerouslySetInnerHTML={{ __html: paidVisitorBootScript() }} />
        <AttributionTracker />
        {/* NavBar also renders the "skip to main content" link, first thing
            in the tab order, in the language of the page. */}
        <NavBar />
        <AccessibilityWidget />

        <div id="main-content">{children}</div>
        <Analytics />
        {/*
          One gtag.js load feeds two destinations: GA4 (G-V3QQRXSQ0T) for
          analytics, and Google Ads (AW-18223934468) for conversion measurement.
          The Ads line was missing, so the account's Google tag sat at "URGENT /
          No data has been received" and its only conversion action ("Page view")
          read Misconfigured with 0 results - which is also why the conversion
          setup wizard refused to advance past "Google Tag: not installed yet".
        */}
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-V3QQRXSQ0T" strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-V3QQRXSQ0T');
          gtag('config', 'AW-18223934468');
        `}</Script>
        {/*
          פיקסל Taboola (חשבון 2102216) עבור קמפייני הנייטיב. הותקן ידנית
          ולא דרך GTM כי לאתר אין מיכל GTM - ה-gtag שמעליו מוגדר ישירות
          בקוד, ולהקים מיכל רק בשביל הפיקסל היה מחייב להעביר אליו גם את
          מעקב ההמרות של Google Ads שכבר עובד.
          כאן נטען הבסיס ונורה page_view; אירועי ההמרה נשלחים מ-app/lib/taboola.ts.
        */}
        <Script id="taboola-pixel" strategy="afterInteractive">{`
          window._tfa = window._tfa || [];
          window._tfa.push({notify: 'event', name: 'page_view', id: 2102216});
          !function (t, f, a, x) {
            if (!document.getElementById(x)) {
              t.async = 1;t.src = a;t.id=x;f.parentNode.insertBefore(t, f);
            }
          }(document.createElement('script'),
          document.getElementsByTagName('script')[0],
          '//cdn.taboola.com/libtrc/unip/2102216/tfa.js',
          'tb_tfa_script');
        `}</Script>

        <SiteFooter />
      </body>
    </html>
  );
}