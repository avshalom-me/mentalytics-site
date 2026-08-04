import type { Metadata } from "next";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import FillForm from "./FillForm";

// מילוי פרופיל מטפל לפי הזמנת מרכז (מסלול 1) - נפתח מהקישור האישי שנשלח
// למטפל במייל. server component: טוען את ההזמנה לפי הטוקן בצד השרת בלבד.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "מילוי פרופיל מטפל/ת",
  robots: { index: false, follow: false }, // קישור אישי - לא לאינדוקס
};

export default async function CenterFillPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const { data: invite } = await supabaseAdmin
    .from("center_therapist_invites")
    .select("id, email, used_at, center_account_id, therapy_center_accounts(name, status)")
    .eq("token", token)
    .maybeSingle();

  const center = (invite as { therapy_center_accounts?: { name: string; status: string } | null } | null)?.therapy_center_accounts ?? null;

  if (!invite || !center) {
    return (
      <Shell>
        <Card emoji="🔗" title="הקישור אינו תקף">
          ייתכן שההזמנה בוטלה או שהקישור הועתק חלקית.<br />
          פנו למנהל/ת המרכז לקבלת קישור חדש.
        </Card>
      </Shell>
    );
  }

  if (invite.used_at) {
    return (
      <Shell>
        <Card emoji="✅" title="הפרופיל כבר מולא">
          הפרופיל מהקישור הזה נשלח לאישור צוות טיפול חכם.<br />
          לעדכונים או שינויים - פנו למנהל/ת המרכז.
        </Card>
      </Shell>
    );
  }

  if (center.status !== "active") {
    return (
      <Shell>
        <Card emoji="⏸️" title="המנוי של המרכז אינו פעיל">
          פנו למנהל/ת המרכז - ייתכן שהמנוי בתהליך הפעלה.
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <FillForm token={token} centerName={center.name} inviteEmail={invite.email} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 pb-24 min-h-screen" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <div className="mb-8 text-center">
        {/* מקור האמת ללוגו הוא קובץ ה-SVG עצמו - לא לשחזר אותו בקוד */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="טיפול חכם" style={{ height: "48px", width: "auto", display: "inline-block" }} />
      </div>
      {children}
    </main>
  );
}

function Card({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md rounded-3xl border border-stone-200 bg-white p-10 text-center shadow-sm">
      <div className="text-4xl mb-3">{emoji}</div>
      <h1 className="text-xl font-black text-stone-900 mb-2">{title}</h1>
      <p className="text-sm leading-6 text-stone-600">{children}</p>
    </div>
  );
}
