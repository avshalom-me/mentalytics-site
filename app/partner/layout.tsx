import type { Metadata } from "next";
import PartnerShell from "./PartnerShell";

// פורטל השותפה של ענף בתי הספר. אזור עבודה פרטי: מחוץ לאינדקס, וכל הנתונים
// עוברים דרך /api/partner-schools/* עם הסשן שלה (app/lib/schools-auth.server.ts).
export const metadata: Metadata = {
  title: "פורטל בתי הספר",
  robots: { index: false, follow: false },
};

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return <PartnerShell>{children}</PartnerShell>;
}
