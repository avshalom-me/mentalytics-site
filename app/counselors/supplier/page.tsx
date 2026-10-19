import type { Metadata } from "next";
import Link from "next/link";

/**
 * The page a school's bookkeeper (or a local authority's procurement officer) is
 * sent to: what the company provides to be opened as a supplier, and when and
 * how it is paid. Linked from the access section of /counselors.
 *
 * Not for search: it is a working page for someone who already asked for access,
 * so it stays out of the index. No company number, no bank details and no prices
 * here - the repository is public. The company's details are in the supplier
 * documents themselves and in the payment page the school receives.
 *
 * The title carries no "| טיפול חכם": the root layout's title template adds it.
 */
export const metadata: Metadata = {
  title: "מסמכי ספק ותנאי תשלום לבתי ספר",
  description: "מה מספקים לפי בקשה כדי לפתוח את טיפול חכם כספק בבית ספר או ברשות, ואיך ומתי משלמים על הרישיון לשאלון היועצות.",
  robots: { index: false, follow: true },
};

const DOCUMENTS = [
  "אישור ניהול ספרים ואישור ניכוי מס במקור מרשות המסים, לפי מספר החברה",
  "אישור ניהול חשבון בנק",
  "תצהיר לפי חוק עסקאות גופים ציבוריים",
  "טופס פתיחת ספק של הרשות, ממולא לפי בקשה",
  "הצעת מחיר וחשבונית עסקה",
  "חשבונית מס/קבלה אחרי התשלום",
];

const PAYMENT_TERMS = [
  "הרישיון נפתח עם התשלום הראשון, לפי הצעת המחיר וחשבונית העסקה. חשבונית מס/קבלה מונפקת עם קבלת התשלום.",
  "בכלים דיגיטליים: 40% עם ההזמנה והיתרה עד 28 בפברואר של שנת הלימודים. רכישה אחרי 31 בדצמבר משולמת במלואה.",
  "אפשר לשלם בהעברה בנקאית, בכרטיס אשראי בקישור תשלום, או בהמחאה.",
];

const SUPPORT_EMAIL = "admin@getmentalytics.com";

export default function CounselorsSupplierPage() {
  return (
    <main dir="rtl" className="min-h-screen bg-white" style={{ fontFamily: "'Heebo', sans-serif", color: "var(--text)" }}>
      <section className="mx-auto max-w-3xl px-5 pt-20 pb-12 sm:pt-28">
        <p className="mb-4 text-sm font-bold" style={{ color: "var(--teal)" }}>לבתי ספר ולרשויות</p>
        <h1 className="text-[2.1rem] font-black leading-[1.15] sm:text-[3rem]" style={{ color: "var(--text)" }}>
          מסמכי ספק ותנאי תשלום
        </h1>
        <p className="mt-5 text-lg leading-relaxed" style={{ color: "var(--text-2)" }}>
          העמוד מיועד למי שמטפל ברכש או בהנהלת החשבונות של בית הספר או של הרשות. הוא מרכז מה אנחנו מספקים כדי להיפתח כספק,
          ואיך ומתי משלמים על הרישיון לשאלון היועצות.
        </p>
      </section>

      <section className="py-14" style={{ background: "var(--surface)" }}>
        <div className="mx-auto max-w-3xl px-5">
          <h2 className="text-2xl font-black sm:text-3xl" style={{ color: "var(--text)" }}>מה אנחנו מספקים לפי בקשה</h2>
          <ul className="mt-6 flex flex-col gap-3">
            {DOCUMENTS.map((d) => (
              <li key={d} className="flex items-start gap-3 rounded-2xl bg-white p-5" style={{ border: "1px solid var(--line)" }}>
                <span aria-hidden="true" className="mt-2 h-2 w-2 flex-shrink-0 rounded-full" style={{ background: "var(--teal)" }} />
                <span className="leading-relaxed" style={{ color: "var(--text-2)" }}>{d}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-14">
        <h2 className="text-2xl font-black sm:text-3xl" style={{ color: "var(--text)" }}>תנאי תשלום</h2>
        <ul className="mt-6 flex flex-col gap-3">
          {PAYMENT_TERMS.map((t) => (
            <li key={t} className="flex items-start gap-3 rounded-2xl bg-white p-5" style={{ border: "1px solid var(--line)" }}>
              <span aria-hidden="true" className="mt-2 h-2 w-2 flex-shrink-0 rounded-full" style={{ background: "var(--gold)" }} />
              <span className="leading-relaxed" style={{ color: "var(--text-2)" }}>{t}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="py-14" style={{ background: "var(--surface)" }}>
        <div className="mx-auto max-w-3xl px-5">
          <h2 className="text-2xl font-black sm:text-3xl" style={{ color: "var(--text)" }}>איך מבקשים</h2>
          <p className="mt-4 leading-relaxed" style={{ color: "var(--text-2)" }}>
            כותבים אלינו למייל{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} dir="ltr" className="font-bold underline" style={{ color: "var(--teal-dark)" }}>{SUPPORT_EMAIL}</a>
            , עם שם בית הספר או הרשות ורשימת המסמכים שנדרשת אצלכם. בית ספר שעוד לא ביקש גישה לשאלון יכול לעשות זאת בטופס שבעמוד השאלון.
          </p>
          <div className="mt-8">
            <Link
              href="/counselors#access"
              className="inline-flex items-center justify-center rounded-full px-8 py-4 text-base font-bold text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--teal-dark)" }}
            >
              לטופס בקשת הגישה
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
