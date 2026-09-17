import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadCenterHealth } from "@/app/lib/center-health";
import { verifyCallSheetLink } from "@/app/lib/call-sheet-token";
import CenterCallSheet from "@/app/components/CenterCallSheet";

// דף השיחה לצוות (עומר), מחוץ לאדמין: נפתח רק עם קישור חתום שפג תוך שבוע.
// הקישור נוצר מכפתור בעמוד המרכזים באדמין. קישור לא תקין או שפג = 404,
// בלי רמז שהדף קיים.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "דף שיחה - מכונים",
  robots: { index: false, follow: false, noarchive: true },
};

export default async function SharedCallSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ exp?: string; sig?: string; center?: string }>;
}) {
  const { exp, sig, center } = await searchParams;
  if (!verifyCallSheetLink(exp, sig)) notFound();
  const report = await loadCenterHealth();
  return <CenterCallSheet report={report} only={center || undefined} />;
}
