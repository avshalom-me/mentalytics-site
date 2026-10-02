import type { Metadata } from "next";
import EditForm from "./EditForm";

// הפרופיל האישי של מורה - נפתח מהקישור האישי בלבד. הטוקן מאומת בצד השרת
// ב-/api/teachers/profile; העמוד עצמו רק מעביר אותו לטופס.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "הפרופיל שלי | מענה לימודי",
  robots: { index: false, follow: false },
};

export default async function TeacherEditPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 pb-24" dir="rtl">
      <div className="mb-8 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="טיפול חכם" style={{ height: "48px", width: "auto", display: "inline-block" }} />
        <div className="mt-2 text-sm font-bold text-[var(--teal-dark)]">מענה לימודי · הפרופיל שלי</div>
      </div>
      <EditForm token={token} />
    </main>
  );
}
