import type { Metadata } from "next";
import MeClient from "./MeClient";

// הפרופיל האישי של מורה. אין טוקן בכתובת: המורה מגיע/ה לכאן מהקישור האישי
// (/learning/k/<token>), ששם עוגייה ומפנה לכאן. בלי עוגייה העמוד מציע לשלוח
// את הקישור למייל הרשום.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "הפרופיל שלי | לימוד חכם",
  robots: { index: false, follow: false },
};

export default async function TeacherMePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 pb-24" dir="rtl">
      {/* הלוגו בכותרת העליונה (LearningNavBar). */}
      <p className="mb-6 text-sm font-bold text-[var(--teal)]">לימוד חכם · הפרופיל שלי</p>
      <MeClient invalidLink={sp.invalid === "1"} />
    </main>
  );
}
