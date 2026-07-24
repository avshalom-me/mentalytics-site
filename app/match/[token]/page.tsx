import Link from "next/link";
import type { Metadata } from "next";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { loadPublicTherapists } from "@/app/lib/therapist-directory";
import TherapistResultCard from "@/app/components/TherapistResultCard";
import MatchReturnTracker from "../MatchReturnTracker";

// Saved-match permalink (the "שלח לעצמך את ההתאמות" feature): anonymous token
// → the matched therapist list. Restores the ORIGINAL campaign attribution on
// visit (see MatchReturnTracker) so contacts made from here credit the ad that
// actually produced the match — including cross-device.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ההתאמות השמורות שלי",
  robots: { index: false, follow: false }, // private-ish permalinks — never index
};

type TokenRow = {
  token: string;
  quiz_type: "adults" | "kids";
  therapist_ids: string[];
  treatment_label: string | null;
  channel: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  created_at: string;
  expires_at: string;
  visit_count: number;
};

function ExpiredView() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-16 text-center" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <div className="text-5xl mb-4">⏳</div>
      <h1 className="text-2xl font-black mb-3" style={{ color: "var(--text)" }}>הקישור הזה כבר לא פעיל</h1>
      <p className="text-stone-600 leading-8 mb-8" style={{ maxWidth: "44ch", marginInline: "auto" }}>
        התאמות שמורות נשמרות למשך 90 יום. אפשר למלא שאלון קצר מחדש ולקבל התאמה עדכנית —
        ייתכן שהצטרפו מטפלים חדשים שמתאימים לך.
      </p>
      <Link
        href="/adults"
        className="inline-flex items-center justify-center font-bold transition hover:opacity-95"
        style={{ background: "var(--teal)", color: "#fff", borderRadius: "50px", padding: "13px 30px", fontSize: "15px" }}
      >
        למילוי שאלון מחודש
      </Link>
    </main>
  );
}

export default async function SavedMatchPage({ params }: { params: Promise<{ token: string }> }) {
  const { token: rawToken } = await params;
  const token = (rawToken ?? "").slice(0, 32);
  if (!/^[A-Za-z0-9_-]{6,32}$/.test(token)) return <ExpiredView />;

  const { data } = await supabaseAdmin
    .from("match_tokens")
    .select("token, quiz_type, therapist_ids, treatment_label, channel, utm_source, utm_medium, utm_campaign, created_at, expires_at, visit_count")
    .eq("token", token)
    .maybeSingle();

  const row = data as TokenRow | null;
  if (!row || new Date(row.expires_at).getTime() < Date.now()) return <ExpiredView />;

  // Count the return visit (fire-and-forget semantics; failure is harmless).
  await supabaseAdmin
    .from("match_tokens")
    .update({ visit_count: row.visit_count + 1, last_visited_at: new Date().toISOString() })
    .eq("token", token);

  // Load ONLY currently-listed therapists, in the original match order.
  const all = await loadPublicTherapists();
  const byId = new Map(all.map((t) => [t.id, t]));
  const list = row.therapist_ids.map((id) => byId.get(id)).filter((t): t is NonNullable<typeof t> => Boolean(t));
  const droppedCount = row.therapist_ids.length - list.length;

  const savedDate = new Date(row.created_at).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <MatchReturnTracker
        seed={{
          channel: (row.channel as never) ?? undefined,
          utm_source: row.utm_source,
          utm_medium: row.utm_medium,
          utm_campaign: row.utm_campaign,
        }}
      />

      <div className="mb-8">
        <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--teal)", textTransform: "uppercase", letterSpacing: ".16em", marginBottom: "8px" }}>
          התאמה אישית
        </p>
        <h1 style={{ fontSize: "clamp(1.7rem,3vw,2.3rem)", fontWeight: 900, color: "var(--text)", letterSpacing: "-.02em" }}>
          ההתאמות השמורות שלך 💚
        </h1>
        <p className="mt-2 text-stone-600 leading-7">
          נשמרו ב־{savedDate}
          {row.treatment_label ? <> · על בסיס ההמלצה: <strong>{row.treatment_label}</strong></> : null}
        </p>
        {droppedCount > 0 && (
          <p className="mt-1 text-sm text-stone-500">
            {droppedCount === 1 ? "מטפל אחד מהרשימה כבר אינו מוצג במאגר." : `${droppedCount} מטפלים מהרשימה כבר אינם מוצגים במאגר.`}
          </p>
        )}
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-[#E8E0D8] bg-[var(--surface)] p-6 text-stone-600">
          המטפלים מהרשימה הזו כבר אינם מוצגים. אפשר <Link href="/adults" className="font-semibold text-[#2e7d8c] hover:underline">למלא שאלון מחודש</Link> או לעיין ב<Link href="/therapists" className="font-semibold text-[#2e7d8c] hover:underline">כל המטפלים</Link>.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((t) => (
            <TherapistResultCard key={t.id} t={t} backHref={`/match/${token}`} />
          ))}
        </div>
      )}

      <div className="mt-10 rounded-2xl p-6" style={{ background: "var(--teal-pale)", border: "1px solid var(--teal-mid)" }}>
        <p className="font-bold" style={{ color: "var(--teal-dark)" }}>רוצה התאמה מעודכנת?</p>
        <p className="mt-1 text-sm leading-7 text-stone-600">
          המאגר מתעדכן כל הזמן. אפשר <Link href={row.quiz_type === "kids" ? "/kids" : "/adults"} className="font-semibold underline" style={{ color: "var(--teal-dark)" }}>למלא את השאלון מחדש</Link> ולקבל התאמה טרייה.
        </p>
      </div>
    </main>
  );
}
