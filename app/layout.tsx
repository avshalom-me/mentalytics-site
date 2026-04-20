import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { Heebo } from "next/font/google";
import NavBar from "./components/NavBar";
import AccessibilityWidget from "./components/AccessibilityWidget";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";

const heebo = Heebo({
  subsets: ["hebrew"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "טיפול חכם", template: "%s | טיפול חכם" },
  description: "מערכת הכוונה טיפולית חכמה — מלאו שאלון קצר וקבלו המלצות מותאמות אישית על סוג הטיפול והמטפל המתאים לכם.",
  metadataBase: new URL("https://www.mentalytics.co.il"),
  openGraph: {
    siteName: "טיפול חכם",
    locale: "he_IL",
    type: "website",
    url: "https://www.mentalytics.co.il",
    title: "טיפול חכם — הכוונה טיפולית חכמה",
    description: "מלאו שאלון קצר וקבלו המלצות מותאמות אישית על סוג הטיפול והמטפל המתאים לכם — לילדים ולמבוגרים.",
    images: [{ url: "/logo.svg.png", width: 512, height: 512, alt: "טיפול חכם" }],
  },
  twitter: {
    card: "summary",
    title: "טיפול חכם — הכוונה טיפולית חכמה",
    description: "מלאו שאלון קצר וקבלו המלצות מותאמות אישית על סוג הטיפול והמטפל המתאים לכם.",
    images: ["/logo.svg.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body className={`${heebo.className} min-h-screen bg-[#FAF7F2] text-stone-900`}>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:right-2 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:shadow-md focus:outline-none">
          דלג לתוכן הראשי
        </a>
        <NavBar />
        <AccessibilityWidget />

        <div id="main-content">{children}</div>
        <Analytics />
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-V3QQRXSQ0T" strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-V3QQRXSQ0T');
        `}</Script>

        <footer className="mt-16 border-t border-[#E8E1D8] bg-white">
          <div className="mx-auto max-w-5xl px-6 py-8 text-sm text-stone-500 flex flex-wrap items-center gap-4">
            <span>© {new Date().getFullYear()} טיפול חכם</span>
            <Link href="/privacy" className="hover:underline">מדיניות פרטיות</Link>
            <Link href="/terms" className="hover:underline">תנאי שימוש</Link>
            <Link href="/accessibility" className="hover:underline">הצהרת נגישות</Link>
          </div>
        </footer>
      </body>
    </html>
  );
}