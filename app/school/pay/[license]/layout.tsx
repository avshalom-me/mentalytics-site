import type { Metadata } from "next";

// דף התשלום של בית ספר הוא רכיב לקוח; הכותרת וה-noindex יושבים כאן. הקישור
// אישי לרישיון ונשלח לבית הספר מהאדמין, ולכן מחוץ לאינדקס, כמו עמודי התשלום
// של המטפלים והמורים.
export const metadata: Metadata = {
  title: "תשלום עבור רישיון לשאלון היועצות | טיפול חכם",
  robots: { index: false, follow: false },
};

export default function SchoolPayLayout({ children }: { children: React.ReactNode }) {
  return <main>{children}</main>;
}
