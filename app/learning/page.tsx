import type { Metadata } from "next";
import Link from "next/link";
import { shareMetadata } from "@/app/lib/share-metadata";
import { LEARNING_BRAND, learningRobots } from "@/app/lib/learning-door";
import { loadDoorSupply } from "@/app/lib/teachers.server";
import { TEACHER_PRICE_GROSS, TEACHER_TRIAL_DAYS } from "@/app/lib/teacher-options";
import TeacherDirectSearch from "./TeacherDirectSearch";

/**
 * הדלת הציבורית של ענף המורים: "לימוד חכם".
 *
 * החלטת הבעלים (3/10/2026): דלת נפרדת בתוך הדומיין, בשם משלה ועם לוגו דומה,
 * שעומדת בפני עצמה - הורה שהגיע מגוגל מחפש כאן מורה בלי למלא שאלון - ונשארת
 * מחוברת לשאלון הילדים, שממשיך להציג מורים מתוך הדוח. עד אז /learning רק
 * הפנה לטופס ההצטרפות של המורים.
 *
 * מה שהעמוד אומר על המורים הוא מה שהמערכת באמת עושה: ההכשרה נבדקת מול
 * תעודה; מוקדי ההוראה והניסיון הם הצהרה של המורה; רקע פלילי לא נבדק. טון
 * עובדתי, בלי הבטחות על תוצאות.
 *
 * האינדוקס נשלט ממתג אחד (LEARNING_DOOR_PUBLIC). כשהמאגר ריק, טופס החיפוש
 * מוחלף בהודעה (ראו TeacherDirectSearch) - ולכן העמוד נבנה מחדש כל חמש
 * דקות, כדי שמורה שאושר יפתח את החיפוש בלי פריסה.
 */
export const revalidate = 300;

const TITLE = `${LEARNING_BRAND}: מורים להוראה מתקנת ומורים פרטיים`;
const DESCRIPTION =
  "מורים להוראה מתקנת ומורים פרטיים שההכשרה שלהם נבדקה מול תעודה. מחפשים לפי תחום, כיתה ואזור, או ממלאים שאלון שפיתחו פסיכולוגים וחוקרים ומראה איזה מענה מתאים לילד.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "https://www.mentalytics.co.il/learning" },
  robots: learningRobots(),
  ...shareMetadata({
    url: "/learning",
    title: `${TITLE} | טיפול חכם`,
    description: "חיפוש מורה לפי תחום, כיתה, אזור והקשיים שברקע. ההכשרה של כל מורה נבדקת מול תעודה, והפנייה אליו ישירה.",
    type: "website",
  }),
};

const STEPS = [
  {
    title: "מספרים מה צריך",
    body: "תחום, כיתה ואזור. אם יש ברקע קושי קשב, דיסלקסיה או קושי שפתי, מציינים גם אותו. אפשר בבחירות קצרות, ואפשר במילים שלכם.",
  },
  {
    title: "רואים מי מתאים",
    body: "קודם מורים מהאזור שלכם. ביניהם, ראשונים מי שיש להם ניסיון עם הקושי שציינתם. מורים מאזור סמוך, ומורים רחוקים שמלמדים אונליין, מוצגים אחריהם ובנפרד.",
  },
  {
    title: "פונים ישירות למורה",
    body: "בוואטסאפ או בטלפון. את המחיר, המקום והמועדים קובעים ביניכם. אין תיווך, אין עמלה, והמורה לא מקבל מאיתנו שום מידע על הילד.",
  },
];

const TRUST = [
  {
    title: "נבדק מול תעודה: ההכשרה",
    body: "תעודה בהוראה מתקנת, תואר בחינוך מיוחד, תואר שני בלקויות למידה, תעודת הוראה או תואר בתחום הדעת. ההכשרה שכל מורה מצהיר עליה נבדקת מול תעודה לפני שהפרופיל מוצג.",
  },
  {
    title: "לפי הצהרת המורה: מוקדי ההוראה והניסיון",
    body: "מוקדי ההוראה בתוך כל תחום, והניסיון עם קשיים כמו קשב או דיסלקסיה, הם מה שהמורה מעיד על עצמו, וכך הם מסומנים בפרופיל. בהרשמה כל מורה מצהיר שאין מניעה חוקית לעבודתו עם קטינים. איננו בודקים רקע פלילי.",
  },
  {
    title: "מה לימוד חכם אינו",
    body: "המורים עצמאיים. איננו מעסיקים אותם, ואיננו צד לשיעורים, למחיר או לתשלום. מורה אינו מטפל ואינו מאבחן: לקושי רגשי, או כשנדרש אבחון, פונים לאנשי המקצוע המתאימים.",
  },
];

const FAQ: { q: string; a: string; link?: { href: string; label: string } }[] = [
  {
    q: "מה ההבדל בין הוראה מתקנת למורה פרטי?",
    a: "מורה פרטי מלמד את החומר של הכיתה: מסביר שוב, מתרגל ומכין למבחן. הוראה מתקנת עובדת על היכולות שהחומר נשען עליהן, כמו פענוח קריאה, כתיב או הבנת כמויות, ומתאימה כשהקושי נמשך גם אחרי הסברים ותרגול. מורים להוראה מתקנת במאגר הם בעלי תעודה בהוראה מתקנת, תואר בחינוך מיוחד או תואר שני בלקויות למידה.",
  },
  {
    q: "איך יודעים שהמורה באמת מוסמך?",
    a: "ההכשרה שכל מורה מצהיר עליה נבדקת מול תעודה לפני שהפרופיל מוצג. מוקדי ההוראה והניסיון עם קשיים מסוימים, כמו קשב או דיסלקסיה, הם לפי הצהרת המורה ומסומנים כך בפרופיל. בהרשמה כל מורה מצהיר שאין מניעה חוקית לעבודתו עם קטינים. איננו בודקים רקע פלילי.",
  },
  {
    q: "כמה זה עולה?",
    a: "החיפוש והפנייה למורה אינם עולים כסף. את מחיר השיעור קובע המורה, והוא מופיע בפרופיל כשהמורה בחר לציין אותו. התשלום על השיעורים הוא ישירות למורה.",
  },
  {
    q: "מתי כדאי לפנות לאבחון ולא למורה?",
    a: "כשיש כמה קשיים יחד, למשל קריאה וקשב, או כשהקושי נמשך למרות עזרה סדירה. ככלל אצבע, אם אחרי כחצי שנה של הוראה מתקנת סדירה אין שיפור של ממש, כדאי לשקול אבחון פסיכודידקטי. כשהקושי העיקרי רגשי, פונים קודם ליועצת בית הספר או לפסיכולוג.",
    link: { href: "/research/psychodidactic", label: "המדריך לאבחון פסיכודידקטי" },
  },
  {
    q: "המורה רואה את מה שכתבנו, או את תשובות השאלון?",
    a: "לא. המורה לא מקבל מאיתנו שום מידע על הילד: לא את תשובות השאלון, לא את הבחירות בחיפוש ולא את הטקסט שכתבתם. אתם פונים אליו בעצמכם, ומספרים מה שתבחרו.",
  },
  {
    q: "מה עושים אם אין מורה באזור שלנו?",
    a: "המאגר חדש ומתמלא בהדרגה. אפשר לסמן שיעורים אונליין, ואז יוצגו גם מורים מאזורים אחרים. כדאי לברר גם בבית הספר: המחנכת או היועצת יודעות אילו שעות תגבור והוראה מתקנת קיימות בו.",
  },
  {
    q: "אני מורה. איך מצטרפים?",
    a: `ממלאים טופס הצטרפות ומצרפים תעודה. אחרי שההכשרה נבדקת, הפרופיל מוצג להורים. ${TEACHER_TRIAL_DAYS} הימים הראשונים בלי תשלום ובלי כרטיס אשראי, ואחריהם ${TEACHER_PRICE_GROSS} ש״ח לחודש כולל מע״מ, בלי התחייבות.`,
    link: { href: "/learning/join", label: "לטופס ההצטרפות למורים" },
  },
];

const pagePadding = "mx-auto max-w-3xl px-5";
const h2 = "text-2xl font-black sm:text-3xl";
const primaryBtn =
  "inline-flex items-center justify-center rounded-full bg-[var(--teal)] px-8 py-4 text-base font-bold text-white transition-colors hover:bg-[var(--teal-dark)]";
const secondaryBtn =
  "inline-flex items-center justify-center rounded-full border-[1.5px] border-[var(--gold)] bg-white px-8 py-4 text-base font-bold text-[var(--gold-dark)] transition-colors hover:bg-[var(--gold-pale)]";

function jsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export default async function LearningDoorPage() {
  const supply = await loadDoorSupply();

  const pageLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: TITLE,
    description: DESCRIPTION,
    url: "https://www.mentalytics.co.il/learning",
    inLanguage: "he",
    isPartOf: { "@type": "WebSite", name: "טיפול חכם", url: "https://www.mentalytics.co.il" },
    about: ["הוראה מתקנת", "מורים פרטיים", "לקויות למידה"],
  };
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };

  return (
    <main dir="rtl" className="min-h-screen bg-white" style={{ color: "var(--text)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(pageLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(faqLd) }} />

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-5 pb-16 pt-16 text-center sm:pb-20 sm:pt-24">
        <p className="text-sm font-bold text-[var(--teal)]">{LEARNING_BRAND} · מבית טיפול חכם</p>
        <h1 className="mt-4 text-[clamp(2rem,6.2vw,4.2rem)] font-black leading-[1.12]">
          מורים להוראה מתקנת <span className="block">ומורים פרטיים</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[var(--text-2)]">
          התאמה של מורה מתחילה במה שהילד צריך: התחום, הכיתה, המקום, והקשיים שברקע. ההכשרה של כל מורה במאגר נבדקת מול תעודה
          לפני שהוא מוצג, והפנייה אליו ישירה.
        </p>
        {/* כשהמאגר ריק הכפתור הראשי אינו מוביל לחיפוש שאין בו את מי למצוא. */}
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          {supply.total > 0 ? (
            <>
              <a href="#search" className={primaryBtn}>חיפוש מורה</a>
              <Link href="/kids" className={secondaryBtn}>לא בטוחים מה הילד צריך? לשאלון</Link>
            </>
          ) : (
            <>
              <Link href="/kids" className={primaryBtn}>לשאלון לילדים ולנוער</Link>
              <Link href="/learning/join" className={secondaryBtn}>מורים: הצטרפות למאגר</Link>
            </>
          )}
        </div>
      </section>

      {/* Search */}
      <section id="search" className="scroll-mt-28 py-16" style={{ background: "var(--surface)" }}>
        <div className={pagePadding}>
          <h2 className={`${h2} mb-6`}>חיפוש מורה</h2>
          <TeacherDirectSearch supply={supply} />
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-28 py-20">
        <div className="mx-auto max-w-5xl px-5">
          <h2 className={`${h2} text-center`}>איך זה עובד</h2>
          <ol className="mt-10 grid list-none gap-5 md:grid-cols-3">
            {STEPS.map(({ title, body }, i) => (
              <li key={title} className="rounded-[18px] bg-white p-6" style={{ border: "1px solid var(--line)" }}>
                <span className="text-4xl font-black leading-none text-[var(--teal)]">{i + 1}</span>
                <h3 className="mt-3 text-lg font-extrabold">{title}</h3>
                <p className="mt-2 leading-relaxed text-[var(--text-2)]">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Two ways in */}
      <section className="pb-20">
        <div className="mx-auto grid max-w-5xl gap-5 px-5 md:grid-cols-2">
          <div className="rounded-[20px] p-7 sm:p-9" style={{ background: "var(--teal-pale)" }}>
            <h2 className="text-xl font-black text-[var(--teal-dark)] sm:text-2xl">יודעים מה מחפשים</h2>
            <p className="mt-3 leading-relaxed text-[var(--text-2)]">
              הוראה מתקנת בקריאה, תגבור במתמטיקה, מורה לאנגלית. החיפוש מציג מורים לפי תחום, כיתה ואזור, ומקדים את מי שיש לו
              ניסיון עם הקושי שציינתם.
            </p>
            <a href="#search" className="mt-6 inline-flex items-center justify-center rounded-full bg-[var(--teal)] px-7 py-3 text-sm font-bold text-white transition-colors hover:bg-[var(--teal-dark)]">
              לחיפוש מורה
            </a>
          </div>
          <div className="rounded-[20px] p-7 sm:p-9" style={{ background: "var(--gold-pale)" }}>
            <h2 className="text-xl font-black text-[var(--gold-dark)] sm:text-2xl">לא בטוחים מה הילד צריך</h2>
            <p className="mt-3 leading-relaxed text-[var(--text-2)]">
              לא תמיד ברור אם הקושי לימודי, רגשי או קשור לקשב. השאלון לילדים ולנוער, שפיתחו פסיכולוגים וחוקרים, עובר על התחומים
              ומציע כיוון: הוראה מתקנת, תגבור, אבחון או טיפול. הוא אינו אבחון.
            </p>
            <Link href="/kids" className="mt-6 inline-flex items-center justify-center rounded-full bg-[var(--gold)] px-7 py-3 text-sm font-bold text-white transition-colors hover:bg-[var(--gold-dark)]">
              לשאלון לילדים ולנוער
            </Link>
          </div>
        </div>
      </section>

      {/* What is checked, and what is declared */}
      <section className="py-16" style={{ background: "var(--surface)" }}>
        <div className={pagePadding}>
          <h2 className={h2}>מה נבדק, ומה מוצהר</h2>
          <p className="mt-3 leading-relaxed text-[var(--text-2)]">
            כדי שתדעו על מה אפשר להישען, ומה כדאי לשאול את המורה בעצמכם.
          </p>
          <div className="mt-8 flex flex-col gap-4">
            {TRUST.map(({ title, body }) => (
              <div key={title} className="rounded-2xl bg-white p-6" style={{ border: "1px solid var(--line)" }}>
                <h3 className="text-lg font-extrabold text-[var(--teal-dark)]">{title}</h3>
                <p className="mt-2 leading-relaxed text-[var(--text-2)]">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-28 py-20">
        <div className={pagePadding}>
          <h2 className={h2}>שאלות נפוצות</h2>
          <div className="mt-8 rounded-2xl" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
            {FAQ.map((f, i) => (
              <details key={f.q} className="group" style={{ borderTop: i === 0 ? "none" : "1px solid var(--line)" }}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[16px] font-bold text-[var(--text)] [&::-webkit-details-marker]:hidden">
                  <span>{f.q}</span>
                  <span aria-hidden="true" className="shrink-0 text-[22px] leading-none text-[var(--teal)] transition group-open:rotate-45">+</span>
                </summary>
                <div className="px-5 pb-5 text-[15.5px] leading-8 text-[var(--text-2)]">
                  <p>{f.a}</p>
                  {f.link && (
                    <p className="mt-2">
                      <Link href={f.link.href} className="font-bold text-[var(--teal-dark)] underline underline-offset-4">{f.link.label}</Link>
                    </p>
                  )}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* For teachers */}
      <section className="pb-24">
        <div className={pagePadding}>
          <div className="rounded-[20px] bg-white p-7 sm:p-9" style={{ border: "1.5px solid var(--gold)" }}>
            <p className="text-sm font-bold text-[var(--gold-dark)]">למורים</p>
            <h2 className="mt-2 text-xl font-black sm:text-2xl">מלמדים הוראה מתקנת או שיעורים פרטיים?</h2>
            <p className="mt-3 leading-relaxed text-[var(--text-2)]">
              הורים מחפשים כאן מורה לפי תחום, כיתה ואזור, ופונים אליו ישירות. ההצטרפות כוללת בדיקה של ההכשרה מול תעודה.
              {" "}{TEACHER_TRIAL_DAYS} הימים הראשונים בלי תשלום ובלי כרטיס אשראי, ואחריהם {TEACHER_PRICE_GROSS} ש״ח לחודש כולל מע״מ, בלי התחייבות.
            </p>
            <Link href="/learning/join" className="mt-6 inline-flex items-center justify-center rounded-full border-[1.5px] border-[var(--teal)] bg-white px-7 py-3 text-sm font-bold text-[var(--teal-dark)] transition-colors hover:bg-[var(--teal-pale)]">
              לפרטים ולהצטרפות
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
