import type { Metadata } from "next";

// עמוד התשלום של המסלול המקודם: שלב בתהליך הרשמה, לא עמוד לחיפוש. עד
// 13/10/2026 לא הוצהר עליו noindex, וגוגל ראה אותו עם התיאור של מאגר המטפלים.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
