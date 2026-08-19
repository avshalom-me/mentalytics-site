import Link from "next/link";
import type { Metadata } from "next";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { loadPublicTherapists } from "@/app/lib/therapist-directory";
import TherapistResultCard from "@/app/components/TherapistResultCard";
import MatchReturnTracker from "../MatchReturnTracker";
import { SPECIALTY_LIST, specialtyToSlug } from "@/app/lib/specialties";

// Saved-match permalink (the "שלח לעצמך את ההתאמות" feature): anonymous token
// → the matched therapist list. Restores the ORIGINAL campaign attribution on
// visit (see MatchReturnTracker) so contacts made from here credit the ad that
// actually produced the match - including cross-device.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ההתאמות השמורות שלי",
  robots: { index: false, follow: false }, // private-ish permalinks - never index
};

type TokenRow = {
  token: string;
  quiz_type: "adults" | "kids";
  /** null כשהטוקן נוצר במסך ההמלצות - שם עוד לא רץ חיפוש. */
  therapist_ids: string[] | null;
  /** תוויות הטיפול שהומלצו. ללא ממצאים קליניים - ראו המיגרציה. */
  recommended_treatments: string[] | null;
  treatment_label: string | null;
  channel: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  created_at: string;
  expires_at: string;
  visit_count: number;
};

// תווית הטיפול שנשמרה היא תווית *תצוגה* מהשאלון, ולא בהכרח ערך מדויק מרשימת
// הגישות (המלצה משולבת נשמרת כ-"א + ב"). לכן ההמרה לעמוד גישה נעשית רק
// בהתאמה מדויקת, ומי שלא מתאים נשאר טקסט - עדיף מקישור שמוביל ל-404.
function specialtyHref(label: string): string | null {
  const clean = label.trim();
  return SPECIALTY_LIST.includes(clean) ? `/therapists/specialty/${specialtyToSlug(clean)}` : null;
}

function ExpiredView() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-16 text-center" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <div className="text-5xl mb-4">⏳</div>
      <h1 className="text-2xl font-black mb-3" style={{ color: "var(--text)" }}>הקישור הזה כבר לא פעיל</h1>
      <p className="text-stone-600 leading-8 mb-8" style={{ maxWidth: "44ch", marginInline: "auto" }}>
        התאמות שמורות נשמרות למשך 90 יום. אפשר למלא שאלון קצר מחדש ולקבל התאמה עדכנית -
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
    .select("token, quiz_type, therapist_ids, recommended_treatments, treatment_label, channel, utm_source, utm_medium, utm_campaign, created_at, expires_at, visit_count")
    .eq("token", token)
    .maybeSingle();

  const row = data as TokenRow | null;
  if (!row || new Date(row.expires_at).getTime() < Date.now()) return <ExpiredView />;

  // Count the return visit (fire-and-forget semantics; failure is harmless).
  await supabaseAdmin
    .from("match_tokens")
    .update({ visit_count: row.visit_count + 1, last_visited_at: new Date().toISOString() })
    .eq("token", token);

  // טוקן שנשמר במסך ההמלצות נושא תוויות טיפול ולא מטפלים - אין מה לטעון,
  // והעמוד מציג במקום זאת את ההמלצות עם קישור להמשיך לחיפוש.
  const savedIds = row.therapist_ids ?? [];
  const recsOnly = savedIds.length === 0 && (row.recommended_treatments?.length ?? 0) > 0;

  const all = recsOnly ? [] : await loadPublicTherapists();
  const byId = new Map(all.map((t) => [t.id, t]));
  const list = savedIds.map((id) => byId.get(id)).filter((t): t is NonNullable<typeof t> => Boolean(t));
  const droppedCount = savedIds.length - list.length;

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
          {recsOnly ? "ההמלצות השמורות שלך 💚" : "ההתאמות השמורות שלך 💚"}
        </h1>
        <p className="mt-2 text-stone-600 leading-7">
          נשמרו ב־{savedDate}
          {!recsOnly && row.treatment_label ? <> · על בסיס ההמלצה: <strong>{row.treatment_label}</strong></> : null}
        </p>
        {droppedCount > 0 && (
          <p className="mt-1 text-sm text-stone-500">
            {droppedCount === 1 ? "מטפל אחד מהרשימה כבר אינו מוצג במאגר." : `${droppedCount} מטפלים מהרשימה כבר אינם מוצגים במאגר.`}
          </p>
        )}
      </div>

      {recsOnly ? (
        // מסך ההמלצות השמורות: מה הותאם, וכפתור אחד להמשיך בדיוק מהנקודה
        // שבה עצרו. זו הסיבה שהטוקן הזה קיים - לתת דרך חזרה למי שקרא, חשב
        // ועזב, במקום לנסות למנוע ממנו לצאת.
        <div className="rounded-2xl border p-6" style={{ borderColor: "var(--teal-mid)", background: "var(--teal-pale)" }}>
          <p className="text-sm font-bold" style={{ color: "var(--teal-dark)" }}>הטיפולים שהותאמו לך בשאלון</p>
          <ul className="mt-3 space-y-2">
            {(row.recommended_treatments ?? []).map((t) => {
              const href = specialtyHref(t);
              return (
                <li key={t} className="flex items-start gap-2 text-[15px] font-semibold" style={{ color: "var(--text)" }}>
                  <span style={{ color: "var(--teal)" }}>•</span>
                  {href ? (
                    <Link href={href} className="underline decoration-1 underline-offset-4 hover:opacity-80" style={{ color: "var(--teal-dark)" }}>
                      {t}
                    </Link>
                  ) : (
                    <span>{t}</span>
                  )}
                </li>
              );
            })}
          </ul>
          {/* היעד הוא מאגר המטפלים ולא השאלון. הכפתור הזה הוביל ל-/adults,
              שנפתח במסך האישור המשפטי - כלומר "להמשך" החזיר את מי שכבר קרא
              את ההמלצות אל תחילת התהליך. הטוקן שומר תוויות טיפול בלבד ולא
              תשובות, ולכן אי אפשר לחדש את השאלון מאמצעו; מה שכן אפשר, וזה
              מה שהובטח, הוא להגיע למטפלים. */}
          <Link
            href="/therapists"
            className="mt-5 inline-flex items-center justify-center font-bold text-white transition hover:opacity-95"
            style={{ background: "var(--teal)", borderRadius: "50px", padding: "13px 28px", fontSize: "15px" }}
          >
            🔍 להמשך - מציאת מטפל/ת מתאים/ה
          </Link>
          <p className="mt-3 text-xs leading-6 text-stone-500">
            השאלון עצמו אינו נשמר. הקישור הזה שומר את סוגי הטיפול שהותאמו לך בלבד.
            אפשר גם <Link href={row.quiz_type === "kids" ? "/kids" : "/adults"} className="font-semibold underline" style={{ color: "var(--teal-dark)" }}>למלא את השאלון מחדש</Link> ולקבל התאמה אישית.
          </p>
        </div>
      ) : list.length === 0 ? (
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
