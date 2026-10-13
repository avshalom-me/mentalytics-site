import type { Metadata } from "next";
import Link from "next/link";
import { shareMetadata } from "@/app/lib/share-metadata";
import { LEARNING_BRAND, LEARNING_OG_IMAGE, LEARNING_SIGNATURE, learningRobots } from "@/app/lib/learning-door";
import { loadDoorSupply } from "@/app/lib/teachers.server";
import { TEACHER_SUBJECTS, type TeacherSubject } from "@/app/lib/teacher-options";
import { ALL_REGIONS } from "@/app/lib/regions";
import { PAGE_REVISED } from "@/app/lib/page-revised";

/**
 * דף הנחיתה של "לימוד חכם" - הדלת הציבורית של ענף המורים.
 *
 * הבעלים (3/10/2026): דלת נפרדת בתוך הדומיין, בשם משלה ועם לוגו דומה, שעומדת
 * בפני עצמה ונשארת מחוברת לשאלון הילדים. ב-13/10/2026 ביקש "דף נחיתה מסודר
 * ומלא, כולל SEO מסודר", שלא ייראה כמו טקסט של בינה מלאכותית, בחתימת "צוות
 * לימוד חכם". החיפוש עצמו עבר למאגר המורים (/learning/teachers); כאן נשאר
 * ההסבר: איזה מורה לחפש, מה נבדק ומה לא, ואיך זה עובד.
 *
 * הנוסח עבר פאנל ביקורת (GPT, Gemini, Claude; 13/10/2026). מה שנקבע שם ונשמר:
 *   • מה שהעמוד אומר על המורים הוא מה שהמערכת באמת עושה. תעודה נבדקת רק אצל
 *     מורים להוראה מתקנת ולחינוך מיוחד, שאר הפרטים הם לפי הצהרת המורה, ורקע
 *     פלילי אינו נבדק. לא לרכך ולא להעלים.
 *   • בלי פרקי זמן קליניים ("אחרי חצי שנה", "אחרי חודשיים"): שתי רגליים חלקו
 *     עליהם בכיוונים הפוכים, וזו הכרעה של איש מקצוע. הם יחזרו, אם יחזרו, עם
 *     המאמרים שהבעלים יבדוק.
 *   • השאלון "מציע כיוון" ו"התשובות מצביעות על", לא "מזהה": הוא אינו אבחון.
 *   • בלי מספרים על פניות ובלי מחיר עתידי למורים.
 *
 * האינדוקס נשלט ממתג אחד (LEARNING_DOOR_PUBLIC). כשהמאגר ריק הכפתור הראשי
 * מוביל לשאלון ולא למאגר, ולכן העמוד נבנה מחדש כל חמש דקות.
 */
export const revalidate = 300;

const URL = "https://www.mentalytics.co.il/learning";
// בכותרת: ביחיד, כמו שמחפשים ("מורה להוראה מתקנת", "מורה פרטי"). ב-H1: ברבים.
const TITLE = "מורה להוראה מתקנת ומורה פרטי לכיתות א׳ עד י״ב";
const DESCRIPTION =
  "מאגר מורים להוראה מתקנת (מותאמת) ומורים פרטיים לקריאה, מתמטיקה, אנגלית ולשון, מכיתה א׳ עד י״ב. מסננים לפי תחום, כיתה ואזור ופונים למורה ישירות.";

export const metadata: Metadata = {
  // absolute: הסיומת של האתר היא "| טיפול חכם", והעמוד הזה חותם בשם של הדלת.
  title: { absolute: `${TITLE} | ${LEARNING_BRAND}` },
  description: DESCRIPTION,
  alternates: { canonical: URL },
  robots: learningRobots(),
  ...shareMetadata({
    url: "/learning",
    title: `${LEARNING_BRAND}: מורים להוראה מתקנת ומורים פרטיים`,
    description: "מאגר מורים לכיתות א׳ עד י״ב. מסננים לפי תחום, כיתה ואזור ופונים למורה ישירות.",
    type: "website",
    image: LEARNING_OG_IMAGE,
  }),
};

/** מה חסר לילד, איך זה נראה, ומי מתאים. שלוש השורות של טבלת ההתמצאות. */
const WHICH: { gap: string; detail: string; looks: string; who: string }[] = [
  {
    gap: "פער בחומר",
    detail: "נושא שלא הובן, היעדרות ארוכה, מבחן שמתקרב.",
    looks: "הבין את החומר בתחילת השנה והתקשה כשהכיתה עברה לחילוק שברים. נעדר כמה שבועות ונוצר פער.",
    who: "מורה פרטי במקצוע.",
  },
  {
    gap: "קושי במיומנות יסוד",
    detail: "קריאה, כתיבה או חשבון.",
    looks: "קורא לאט ומנחש מילים. חוזר על אותן טעויות גם אחרי הסבר ותרגול.",
    who: "מורה להוראה מתקנת, שנקראת היום גם הוראה מותאמת.",
  },
  {
    gap: "קושי בהרגלי למידה",
    detail: "התארגנות, הכנה למבחן, סיכום חומר.",
    looks: "יודע את החומר בעל פה ונכשל במבחן. שיעורי הבית נמשכים שעות.",
    who: "מורה שמלמד אסטרטגיות למידה.",
  },
];

const STEPS = [
  {
    title: "בוחרים תחום, כיתה ואזור",
    body: "אפשר לבקש רק מורים להוראה מתקנת, ואפשר לראות רק מי שמלמד אונליין.",
  },
  {
    title: "קוראים את הכרטיס של המורה",
    body: "מה הוא מלמד ולאילו כיתות, איפה מתקיים השיעור, מה ההכשרה, ומה המחיר אם בחר לציין. אם לילד יש קשיי קשב או דיסלקסיה (דיסלקציה), אפשר לציין זאת, ומורים שכתבו שיש להם ניסיון מתאים יוצגו ראשונים.",
  },
  {
    title: "פונים אליו ישירות",
    body: "בוואטסאפ או בטלפון. את המחיר, המקום והמועדים קובעים ביניכם. המורה לא מקבל מאיתנו שום פרט על הילד.",
  },
];

/** מה כל תחום כולל - לפי מוקדי ההוראה שבטופס המורה (TEACHER_FOCUSES). */
const SUBJECT_LINES: Record<TeacherSubject, string> = {
  reading_writing: "רכישת קריאה, שטף ודיוק, הבנת הנקרא, כתיב והבעה בכתב.",
  math: "מורה פרטי למתמטיקה והוראה מתקנת בחשבון, מיסודות החשבון ועד בגרות ב-5 יחידות.",
  english: "מורה פרטי לאנגלית, מרכישת קריאה ועד בגרות ב-5 יחידות.",
  hebrew: "הבנת הנקרא, הבעה בכתב והכנה לבגרות בלשון.",
  learning_strategies: "התארגנות ושיעורי בית, הכנה למבחנים, קריאה וסיכום של טקסטים.",
};

const CHECKED: { title: string; body: string }[] = [
  {
    title: "נבדק מול תעודה: מורים להוראה מתקנת ולחינוך מיוחד",
    body: "מורה שמופיע כאן כמורה להוראה מתקנת שלח לנו תעודת הכשרה בהוראה מתקנת, תואר בחינוך מיוחד או תואר שני בלקויות למידה. לפני שהפרופיל עלה ראינו את התעודה, ובדקנו שהיא על שמו ושהיא מתאימה להכשרה שהצהיר עליה. איננו פונים למוסד שהנפיק אותה. בכרטיס של מורה כזה מופיע הסימון \"תעודה נבדקה\".",
  },
  {
    title: "לפי הצהרת המורה: כל השאר",
    body: "ההכשרה של מורים פרטיים, שנות הניסיון, מה בדיוק המורה מלמד בתוך התחום, והניסיון עם קשיים כמו קשב או דיסלקסיה: כל אלה הם מה שהמורה כתב על עצמו, וכך הם מסומנים. אנחנו עוברים על כל פרופיל לפני שהוא מוצג, אבל איננו מאמתים את הפרטים האלה. כדאי לשאול את המורה ולבקש לראות תעודות.",
  },
  {
    title: "לא נבדק: רקע פלילי",
    body: "בהרשמה כל מורה מצהיר שאין לו הרשעה פלילית ושאין מניעה על פי דין לעבודתו עם קטינים. איננו בודקים את ההצהרה ואיננו מקבלים אישור משטרה. מומלץ שמבוגר יהיה בבית בזמן השיעור.",
  },
  {
    title: "המורים עצמאיים",
    body: "איננו מעסיקים אותם, ואיננו צד לשיעורים, למחיר או לתשלום.",
  },
];

const FAQ: { q: string; a: string; link?: { href: string; label: string } }[] = [
  {
    q: "מה ההבדל בין הוראה מתקנת למורה פרטי?",
    a: "מורה פרטי מלמד את החומר של הכיתה: מסביר שוב, מתרגל ומכין למבחן. הוראה מתקנת עובדת על היכולות שהחומר נשען עליהן, כמו פענוח קריאה, כתיב או הבנת כמויות, ומתאימה כשהקושי נמשך גם אחרי הסברים ותרגול.",
  },
  {
    q: "הוראה מתקנת והוראה מותאמת: זה אותו דבר?",
    a: "בדרך כלל כן. חלק ממוסדות ההכשרה קוראים היום להתמחות בהוראה מתקנת \"הוראה מותאמת\", ורוב ההורים מכירים את השם הוותיק. בבית הספר \"הוראה מותאמת\" משמשת לפעמים גם במובן רחב יותר: התאמת ההוראה בכיתה לתלמידים שונים. באתר מופיעים שני השמות.",
  },
  {
    q: "צריך אבחון לפני שמתחילים הוראה מתקנת?",
    a: "לא תמיד. כשהקושי ממוקד, למשל בקריאה או בחשבון, אפשר להתחיל בהוראה מתקנת ולשקול אבחון אם אין התקדמות. לחלק מההתאמות בבחינות, בעיקר בבגרות, נדרש אבחון, ואת הפרטים כדאי לברר מול יועצת בית הספר. כשיש כמה קשיים יחד, או כשהקושי העיקרי רגשי, פונים קודם ליועצת בית הספר או לפסיכולוג.",
    link: { href: "/research/psychodidactic", label: "המדריך לאבחון פסיכודידקטי" },
  },
  {
    q: "איך יודעים אם המורה מוסמך?",
    a: "אצל מורים להוראה מתקנת ולחינוך מיוחד ראינו את התעודה, והכרטיס מסומן \"תעודה נבדקה\". אצל מורים פרטיים ההכשרה היא לפי הצהרת המורה, וכך היא מסומנת. מי שמלמד באופן פרטי אינו חייב ברישיון, ולכן בכל מקרה כדאי לשאול את המורה על ההכשרה והניסיון שלו ולבקש לראות תעודות.",
  },
  {
    q: "מה כדאי לשאול מורה לפני שמתחילים?",
    a: "מה ההכשרה שלו ואיפה למד. איזה ניסיון יש לו עם קושי כמו של הילד שלכם. איך נראה שיעור, ומה הילד עושה בין שיעור לשיעור. לפי מה תדעו שיש התקדמות. וגם הדברים המעשיים: מחיר, משך השיעור ומה קורה כשמבטלים.",
  },
  {
    q: "כמה עולה שיעור, וכמה עולה השימוש באתר?",
    a: "החיפוש והפנייה למורה אינם עולים כסף. את מחיר השיעור קובע כל מורה, והוא משתנה לפי התחום, הכיתה, האזור והניסיון. מורים שבחרו לציין מחיר מציגים אותו בכרטיס. התשלום על השיעורים הוא ישירות למורה.",
  },
  {
    q: "יש החזר מקופת חולים או מביטוח על הוראה מתקנת?",
    a: "בתוכניות המשלימות של קופות החולים שבדקנו יש השתתפות באבחון דידקטי או פסיכודידקטי, ולא בשיעורי הוראה מתקנת. בחלק מביטוחי הבריאות הפרטיים יש החזר חלקי על הוראה מתקנת, בדרך כלל במסגרת כתב שירות להתפתחות הילד. התנאים משתנים מפוליסה לפוליסה, ולכן מה שקובע הוא הפוליסה שלכם. המידע נבדק באוקטובר 2026.",
  },
  {
    q: "אפשר ללמוד אונליין?",
    a: "כן. מורים שמלמדים אונליין מסומנים במאגר, ואפשר לסנן לפיהם. אם זה מתאים לילד שלכם תלוי בגיל ובקושי. כדאי לשאול את המורה איך נראה אצלו שיעור אונליין, ולנסות שיעור אחד לפני שמחליטים.",
  },
  {
    q: "איך נקבע הסדר שבו המורים מוצגים?",
    a: "קודם מורים מהאזור שבחרתם. ביניהם, ראשונים מי שכתבו שיש להם ניסיון עם הקושי שציינתם. בין מורים שווים הסדר מתחלף מדי יום, כדי שאף מורה לא יהיה תמיד ראשון.",
  },
  {
    q: "המורה רואה את תשובות השאלון, או את מה שחיפשנו?",
    a: "לא. המורה לא מקבל מאיתנו שום מידע על הילד: לא את תשובות השאלון ולא את הבחירות בחיפוש. אתם פונים אליו בעצמכם, ומספרים מה שתבחרו.",
  },
  {
    q: "אין מורה באזור שלנו. מה עושים?",
    a: "המאגר חדש ומתמלא בהדרגה. אפשר לראות גם מורים שמלמדים אונליין. כדאי לברר גם בבית הספר: המחנכת או היועצת יודעות אילו שעות תגבור והוראה מתקנת קיימות בו.",
  },
];

const wide = "mx-auto max-w-5xl px-5";
const narrow = "mx-auto max-w-3xl px-5";
const h2 = "text-2xl font-black leading-tight sm:text-3xl";
const primaryBtn =
  "inline-flex items-center justify-center rounded-full bg-[var(--teal)] px-8 py-4 text-base font-bold text-white transition-colors hover:bg-[var(--teal-dark)]";
const secondaryBtn =
  "inline-flex items-center justify-center rounded-full border-[1.5px] border-[var(--gold)] bg-white px-8 py-4 text-base font-bold text-[var(--gold-dark)] transition-colors hover:bg-[var(--gold-pale)]";
const selectCls = "w-full rounded-xl border border-[var(--line)] bg-white px-3 py-3 text-sm text-[var(--text)]";

function jsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export default async function LearningDoorPage() {
  const supply = await loadDoorSupply();
  const open = supply.total > 0;
  const revised = PAGE_REVISED["/learning"].date;
  const revisedLabel = new Date(`${revised}T12:00:00Z`).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem", month: "long", year: "numeric" });

  const team = {
    "@type": "Organization",
    name: LEARNING_SIGNATURE,
    parentOrganization: { "@type": "Organization", name: "טיפול חכם", url: "https://www.mentalytics.co.il" },
  };
  const pageLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${LEARNING_BRAND}: מורים להוראה מתקנת ומורים פרטיים`,
    description: DESCRIPTION,
    url: URL,
    inLanguage: "he",
    dateModified: revised,
    author: team,
    publisher: team,
    isPartOf: { "@type": "WebSite", name: "טיפול חכם", url: "https://www.mentalytics.co.il" },
    about: ["הוראה מתקנת", "הוראה מותאמת", "מורים פרטיים", "לקויות למידה"],
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
      <section className="mx-auto max-w-4xl px-5 pb-14 pt-16 text-center sm:pb-16 sm:pt-24">
        <p className="text-sm font-bold text-[var(--teal)]">{LEARNING_BRAND} · מבית טיפול חכם</p>
        <h1 className="mt-4 text-[clamp(2rem,6.2vw,4.2rem)] font-black leading-[1.12]">
          מורים להוראה מתקנת <span className="block">ומורים פרטיים</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[var(--text-2)]">
          מאגר מורים לילדים ולנוער, מכיתה א׳ עד י״ב. מסננים לפי תחום, כיתה ואזור, קוראים על המורה ופונים אליו בוואטסאפ או בטלפון.
          הפנייה ישירה, והחיפוש אינו עולה כסף.
        </p>
        {/* כשהמאגר ריק הכפתור הראשי אינו מוביל למאגר שאין בו את מי למצוא. */}
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          {open ? (
            <>
              <Link href="/learning/teachers" className={primaryBtn}>למאגר המורים</Link>
              <Link href="/kids" className={secondaryBtn}>לא בטוחים מה הילד צריך? לשאלון</Link>
            </>
          ) : (
            <>
              <Link href="/kids" className={primaryBtn}>לשאלון לילדים ולנוער</Link>
              <Link href="/learning/join" className={secondaryBtn}>מורים: הצטרפות למאגר</Link>
            </>
          )}
        </div>
        {!open && (
          <p className="mx-auto mt-6 max-w-xl text-sm leading-6 text-[var(--muted)]">
            המאגר נפתח בימים אלה, ועדיין אין בו מורים להציג. בינתיים השאלון מציע כיוון: הוראה מתקנת, מורה פרטי, אבחון או טיפול.
          </p>
        )}
      </section>

      {/* חיפוש מהיר: טופס GET רגיל, בלי קוד בדפדפן. מוביל למאגר עם הסינון בכתובת. */}
      {open && (
        <section aria-label="חיפוש מהיר במאגר" className="pb-16">
          <form action="/learning/teachers" method="get" className={`${narrow}`}>
            <div className="grid gap-3 rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end sm:p-5">
              <div>
                <label htmlFor="qs-subject" className="mb-1 block text-xs font-bold text-[var(--muted)]">תחום</label>
                <select id="qs-subject" name="subject" defaultValue="" className={selectCls}>
                  <option value="">כל התחומים</option>
                  {TEACHER_SUBJECTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="qs-region" className="mb-1 block text-xs font-bold text-[var(--muted)]">אזור</label>
                <select id="qs-region" name="region" defaultValue="" className={selectCls}>
                  <option value="">כל הארץ</option>
                  {ALL_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <button type="submit" className="rounded-full bg-[var(--teal)] px-7 py-3 text-sm font-bold text-white transition-colors hover:bg-[var(--teal-dark)]">
                הצגת מורים
              </button>
            </div>
          </form>
        </section>
      )}

      {/* איזה מורה לחפש */}
      <section id="which" className="scroll-mt-28 py-16" style={{ background: "var(--surface)" }}>
        <div className={wide}>
          <div className="max-w-3xl">
            <h2 className={h2}>הוראה מתקנת או מורה פרטי: איך יודעים מה הילד צריך</h2>
            <p className="mt-4 text-[17px] leading-8 text-[var(--text-2)]">
              לפני שבוחרים מורה כדאי להבין מה בדיוק חסר לילד, כי לכל סוג של קושי מתאים מורה אחר. החלוקה שכאן נועדה להתמצאות
              ראשונה. אצל ילדים רבים יש יותר מסוג אחד של קושי.
            </p>
          </div>

          <div className="mt-8 overflow-hidden rounded-[18px] bg-white" style={{ border: "1px solid var(--line)" }}>
            <div className="hidden grid-cols-[1fr_1.5fr_1fr] gap-6 px-6 py-3 text-sm font-extrabold text-[var(--teal-dark)] md:grid" style={{ background: "var(--teal-pale)" }} aria-hidden="true">
              <span>מה חסר</span>
              <span>איך זה נראה</span>
              <span>מי מתאים</span>
            </div>
            {WHICH.map((row, i) => (
              <div key={row.gap} className="grid gap-3 px-5 py-5 md:grid-cols-[1fr_1.5fr_1fr] md:gap-6 md:px-6" style={{ borderTop: i === 0 ? "none" : "1px solid var(--line)" }}>
                <div>
                  <h3 className="text-lg font-extrabold">{row.gap}</h3>
                  <p className="mt-1 text-[15px] leading-7 text-[var(--text-2)]">{row.detail}</p>
                </div>
                <p className="text-[15px] leading-7 text-[var(--text-2)]">
                  <span className="font-bold text-[var(--text)] md:hidden">איך זה נראה: </span>
                  {row.looks}
                </p>
                <p className="text-[15px] font-bold leading-7 text-[var(--teal-dark)]">
                  <span className="font-bold text-[var(--text)] md:hidden">מי מתאים: </span>
                  {row.who}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-7 max-w-3xl space-y-4 text-[16px] leading-8 text-[var(--text-2)]">
            <p>
              הגיל נותן כיוון כללי בלבד. ביסודי, קושי שנמשך נוגע לעיתים קרובות למיומנות יסוד. בחטיבה ובתיכון, קושי במקצוע אחד הוא
              לעיתים קרובות פער בחומר. ואם אחרי תקופה של שיעורים פרטיים סדירים הילד נתקע באותן נקודות, ייתכן שהקושי אינו בחומר
              אלא במיומנות יסוד, וכדאי לשקול הוראה מתקנת.
            </p>
            <p style={{ borderInlineStart: "3px solid var(--gold)", paddingInlineStart: "16px" }}>
              שיעורים אינם טיפול, ואינם תחליף לאבחון. כשהקושי העיקרי רגשי, או כשיש כמה קשיים יחד, כדאי לפנות קודם ליועצת בית
              הספר, לפסיכולוג או לאבחון.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-28 py-20">
        <div className={wide}>
          <h2 className={h2}>איך מוצאים כאן מורה</h2>
          <ol className="mt-9 grid list-none gap-5 md:grid-cols-3">
            {STEPS.map(({ title, body }, i) => (
              <li key={title} className="rounded-[18px] bg-white p-6" style={{ border: "1px solid var(--line)" }}>
                <span className="text-4xl font-black leading-none text-[var(--teal)]">{i + 1}</span>
                <h3 className="mt-3 text-lg font-extrabold">{title}</h3>
                <p className="mt-2 leading-relaxed text-[var(--text-2)]">{body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-9 grid gap-x-10 gap-y-2 md:grid-cols-[auto_1fr] md:items-start">
            <h3 className="text-lg font-extrabold md:pt-1">מורים לפי תחום</h3>
            <ul className="list-none space-y-2">
              {TEACHER_SUBJECTS.map((s) => (
                <li key={s.key} className="leading-7 text-[var(--text-2)]">
                  <Link href={`/learning/teachers?subject=${s.key}`} className="font-bold text-[var(--teal-dark)] underline underline-offset-4">{s.label}</Link>
                  {": "}
                  {SUBJECT_LINES[s.key]}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* What is checked, and what is not */}
      <section id="checked" className="scroll-mt-28 py-16" style={{ background: "var(--surface)" }}>
        <div className={narrow}>
          <h2 className={h2}>מה אנחנו בודקים, ומה לא</h2>
          <p className="mt-4 text-[17px] leading-8 text-[var(--text-2)]">
            מי שמלמד באופן פרטי, בהוראה מתקנת או בשיעורים פרטיים, אינו חייב ברישיון, וכל אחד יכול להציג את עצמו כמורה. זה מה
            שבדקנו, ומה לא:
          </p>
          <dl className="mt-8 space-y-4">
            {CHECKED.map(({ title, body }) => (
              <div key={title} className="rounded-2xl bg-white p-6" style={{ border: "1px solid var(--line)" }}>
                <dt className="text-lg font-extrabold text-[var(--teal-dark)]">{title}</dt>
                <dd className="mt-2 leading-relaxed text-[var(--text-2)]">{body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* The questionnaire */}
      <section className="py-20">
        <div className={narrow}>
          <div className="rounded-[20px] p-7 sm:p-9" style={{ background: "var(--gold-pale)" }}>
            <h2 className="text-xl font-black leading-tight text-[var(--gold-dark)] sm:text-2xl">שאלון שמציע כיוון: הוראה מתקנת, מורה פרטי, אבחון או טיפול</h2>
            <p className="mt-3 leading-relaxed text-[var(--text-2)]">
              לפעמים לא ברור אם הקושי לימודי, רגשי או קשור לקשב. בטיפול חכם יש שאלון לילדים ולנוער, שפיתחו פסיכולוגים וחוקרים.
              הוא עובר על התחומים ומציע כיוון. כשהתשובות מצביעות על קושי לימודי ממוקד, הדוח ממליץ על הוראה מתקנת או על מורה פרטי
              ומציג מורים מהמאגר הזה. השאלון אינו אבחון.
            </p>
            <Link href="/kids" className="mt-6 inline-flex items-center justify-center rounded-full bg-[var(--gold)] px-7 py-3 text-sm font-bold text-white transition-colors hover:bg-[var(--gold-dark)]">
              לשאלון לילדים ולנוער
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-28 py-16" style={{ background: "var(--surface)" }}>
        <div className={narrow}>
          <h2 className={h2}>שאלות נפוצות</h2>
          <div className="mt-8 rounded-2xl bg-white" style={{ border: "1px solid var(--line)" }}>
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
      <section className="py-20">
        <div className={narrow}>
          <div className="rounded-[20px] bg-white p-7 sm:p-9" style={{ border: "1.5px solid var(--gold)" }}>
            <p className="text-sm font-bold text-[var(--gold-dark)]">למורים</p>
            <h2 className="mt-2 text-xl font-black sm:text-2xl">מלמדים הוראה מתקנת או שיעורים פרטיים?</h2>
            <p className="mt-3 leading-relaxed text-[var(--text-2)]">
              הורים מחפשים כאן מורה לפי תחום, כיתה ואזור, ופונים אליו ישירות. ההצטרפות למאגר כרגע ללא תשלום, ואין עמלה על שיעורים.
            </p>
            <Link href="/learning/join" className="mt-6 inline-flex items-center justify-center rounded-full border-[1.5px] border-[var(--teal)] bg-white px-7 py-3 text-sm font-bold text-[var(--teal-dark)] transition-colors hover:bg-[var(--teal-pale)]">
              לפרטים ולהצטרפות
            </Link>
          </div>

          <p className="mt-10 text-sm leading-7 text-[var(--muted)]">
            <span className="font-bold text-[var(--text-2)]">{LEARNING_SIGNATURE}</span>
            <br />
            {LEARNING_BRAND} הוא חלק מ<Link href="/" className="underline underline-offset-4">טיפול חכם</Link>. עדכון אחרון: {revisedLabel}.
          </p>
        </div>
      </section>
    </main>
  );
}
