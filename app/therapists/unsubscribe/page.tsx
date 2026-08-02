import Link from "next/link";
import { verifyUnsubscribeToken } from "@/app/lib/unsubscribe-token";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type SearchParams = { id?: string; token?: string; done?: string; type?: string };

async function getTherapistName(id: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("therapists")
    .select("full_name")
    .eq("id", id)
    .single();
  return data?.full_name ?? null;
}

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const id = params.id;
  const token = params.token;
  const done = params.done === "1";
  const isNewsletter = params.type === "newsletter";

  return (
    <main
      dir="rtl"
      className="min-h-screen flex items-center justify-center px-4 py-10 bg-stone-50"
      style={{ fontFamily: "'Heebo', sans-serif" }}
    >

      <div className="max-w-md w-full rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        {done ? (
          <DoneView isNewsletter={isNewsletter} />
        ) : (
          <ConfirmView id={id} token={token} isNewsletter={isNewsletter} />
        )}
      </div>
    </main>
  );
}

function DoneView({ isNewsletter }: { isNewsletter: boolean }) {
  return (
    <>
      <div className="mb-4 text-3xl">✓</div>
      <h1 className="text-2xl font-black text-stone-900 mb-3">הוסרת בהצלחה</h1>
      <p className="text-sm text-stone-600 leading-7 mb-4">
        {isNewsletter
          ? "לא תקבל/י יותר מאיתנו מאמרים, עדכונים ותכנים מקצועיים."
          : "לא תקבל יותר את הדוח החודשי על הביצועים של הפרופיל שלך."}
      </p>
      <p className="text-xs text-stone-500 leading-6">
        {isNewsletter
          ? "אם זו טעות, אפשר לכתוב לנו ונשמח להחזיר אותך לרשימה."
          : "אם תרצה לחזור לקבל את הדוחות, היכנס ללוח הבקרה שלך ועדכן את ההעדפה."}
      </p>
      <Link
        href="/therapists/dashboard"
        className="mt-5 inline-block rounded-xl bg-[#0F5468] text-white text-sm font-bold px-5 py-2.5 hover:bg-[#0a3f4f] transition-colors"
      >
        חזרה ללוח הבקרה
      </Link>
    </>
  );
}

async function ConfirmView({
  id,
  token,
  isNewsletter,
}: {
  id?: string;
  token?: string;
  isNewsletter: boolean;
}) {
  if (!id || !token) {
    return (
      <>
        <h1 className="text-xl font-black text-stone-900 mb-3">קישור לא תקין</h1>
        <p className="text-sm text-stone-600">קישור ההסרה חסר פרטים. אנא חזור למייל ולחץ שוב.</p>
      </>
    );
  }

  const valid = verifyUnsubscribeToken(id, token, isNewsletter ? "newsletter" : "");
  if (!valid) {
    return (
      <>
        <h1 className="text-xl font-black text-stone-900 mb-3">קישור לא תקף</h1>
        <p className="text-sm text-stone-600 leading-7">
          הקישור שלחצת עליו לא תקף או פג תוקפו. אנא חזור למייל האחרון או צור קשר עם התמיכה.
        </p>
      </>
    );
  }

  const name = await getTherapistName(id);

  return (
    <>
      <h1 className="text-2xl font-black text-stone-900 mb-3">
        {isNewsletter ? "הסרה מרשימת הדיוור" : "הסרה מהדוח החודשי"}
      </h1>
      <p className="text-sm text-stone-600 leading-7 mb-2">
        {name ? `שלום ${name},` : "שלום,"}
      </p>
      <p className="text-sm text-stone-600 leading-7 mb-5">
        {isNewsletter
          ? 'ברגע שתאשר/י, נפסיק לשלוח אליך מאמרים, עדכונים ותכנים מקצועיים מ"טיפול חכם".'
          : "ברגע שתאשר/י, נפסיק לשלוח אליך את הדוח החודשי על הביצועים של הפרופיל שלך. בכל רגע תוכל/י לחזור ולהפעיל את הדוחות מתוך לוח הבקרה."}
      </p>

      <form method="POST" action="/api/therapists/unsubscribe" className="space-y-3">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="token" value={token} />
        {isNewsletter && <input type="hidden" name="type" value="newsletter" />}
        <button
          type="submit"
          className="w-full rounded-xl bg-stone-800 text-white text-sm font-bold py-3 hover:bg-stone-700 transition-colors"
        >
          {isNewsletter ? "אישור - הסר אותי מרשימת הדיוור" : "אישור - הסר אותי מהדוח החודשי"}
        </button>
      </form>

      <Link
        href="/therapists/dashboard"
        className="mt-3 block text-center text-xs text-stone-500 hover:text-stone-700 underline"
      >
        ביטול - חזרה ללוח הבקרה
      </Link>
    </>
  );
}
