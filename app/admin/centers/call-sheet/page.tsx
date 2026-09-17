import type { Metadata } from "next";
import { loadCenterHealth } from "@/app/lib/center-health";
import CenterCallSheet from "@/app/components/CenterCallSheet";

// דף השיחה מתוך האדמין (מוגן ב-Basic Auth דרך ה-middleware). לעומר נשלח
// קישור חתום ל-/centers/call-sheet - אותו רכיב, בלי סיסמת האדמין.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "דף שיחה - מכונים",
  robots: { index: false, follow: false },
};

export default async function AdminCallSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ center?: string }>;
}) {
  const { center } = await searchParams;
  const report = await loadCenterHealth();
  return <CenterCallSheet report={report} only={center || undefined} />;
}
