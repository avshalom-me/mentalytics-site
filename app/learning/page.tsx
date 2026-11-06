import type { Metadata } from "next";
import Link from "next/link";
import { shareMetadata } from "@/app/lib/share-metadata";
import { LEARNING_BRAND, LEARNING_OG_IMAGE, LEARNING_SIGNATURE, learningRobots } from "@/app/lib/learning-door";
import { loadDirectoryTeachers, loadDoorSupply } from "@/app/lib/teachers.server";
import FacesMarquee, { type Face } from "./FacesMarquee";
import { TEACHER_GRADE_GROUPS, TEACHER_SUBJECTS, subjectLabel, teacherPath, type TeacherSubject } from "@/app/lib/teacher-options";
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
// הזהב הוא צבע הפעולה של הדלת (החלטת הבעלים, 6/11/2026): כך היא "דומה לטיפול חכם, לא זהה".
const goldBtn =
  "inline-flex items-center justify-center rounded-full bg-[var(--gold)] px-7 py-3.5 text-base font-bold text-white transition-colors hover:bg-[var(--gold-dark)]";
const outlineBtn =
  "inline-flex items-center justify-center rounded-full border-[1.5px] border-[var(--teal)] bg-white px-7 py-3.5 text-base font-bold text-[var(--teal-dark)] transition-colors hover:bg-[var(--teal-pale)]";
const selectCls = "w-full rounded-xl border border-[var(--line)] bg-white px-3 py-3 text-sm text-[var(--text)]";

function jsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export default async function LearningDoorPage() {
  const [supply, teachers] = await Promise.all([loadDoorSupply(), loadDirectoryTeachers()]);
  const open = supply.total > 0;
  // הפנים בפתיחה ובפס: רק מורים עם תמונה אמיתית, בסדר המאגר.
  const faces: Face[] = teachers
    .filter((t) => t.photo_url && t.slug)
    .slice(0, 12)
    .map((t) => ({ id: t.id, name: t.full_name, subjects: t.subjects.map(subjectLabel).join(", "), photo: t.photo_url as string, href: teacherPath(t.slug as string) }));
  const subjectCounts: Record<string, number> = {};
  for (const t of teachers) for (const k of t.subjects) subjectCounts[k] = (subjectCounts[k] ?? 0) + 1;
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

      {/* ── פתיחה: שתי עמודות על פס זהב בהיר. מימין הטקסט והחיפוש, משמאל פסיפס של
          מורים אמיתיים (או אריחי תחום כשעוד אין שש תמונות). קווי המחברת ברקע
          הם הרמז היחיד לכיתה: בלי איורים ובלי אייקונים. */}
      <section className="relative overflow-hidden" style={{ background: "var(--gold-pale)" }}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: "repeating-linear-gradient(to bottom, transparent 0, transparent 35px, rgba(212,144,24,0.10) 35px, rgba(212,144,24,0.10) 36px)" }}
        />
        <div className={`${wide} relative grid gap-10 pb-14 pt-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-14 lg:pb-20 lg:pt-20`}>
          <div>
            <p className="text-sm font-bold text-[var(--gold-dark)]">{LEARNING_BRAND} · מבית טיפול חכם</p>
            <h1 className="mt-4 text-[clamp(2.1rem,5.6vw,4rem)] font-black leading-[1.1]">
              מורים להוראה מתקנת <span className="block text-[var(--teal-dark)]">ומורים פרטיים</span>
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-8 text-[var(--text-2)]">
              מאגר מורים לילדים ולנוער, מכיתה א׳ עד י״ב. מסננים לפי תחום, כיתה ואזור, קוראים על המורה ופונים אליו בוואטסאפ או בטלפון.
              הפנייה ישירה, והחיפוש אינו עולה כסף.
            </p>

            {/* חיפוש: טופס GET רגיל, בלי קוד בדפדפן. מוביל למאגר עם הסינון בכתובת. */}
            {open ? (
              <form action="/learning/teachers" method="get" className="mt-8 rounded-[20px] bg-white p-4 shadow-[0_10px_40px_rgba(168,112,16,0.10)] sm:p-5" style={{ border: "1px solid rgba(212,144,24,0.35)" }}>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label htmlFor="qs-subject" className="mb-1 block text-xs font-bold text-[var(--muted)]">תחום</label>
                    <select id="qs-subject" name="subject" defaultValue="" className={selectCls}>
                      <option value="">כל התחומים</option>
                      {TEACHER_SUBJECTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="qs-grade" className="mb-1 block text-xs font-bold text-[var(--muted)]">כיתה</label>
                    <select id="qs-grade" name="grade" defaultValue="" className={selectCls}>
                      <option value="">כל הכיתות</option>
                      {TEACHER_GRADE_GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="qs-region" className="mb-1 block text-xs font-bold text-[var(--muted)]">אזור</label>
                    <select id="qs-region" name="region" defaultValue="" className={selectCls}>
                      <option value="">כל הארץ</option>
                      {ALL_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
                  <button type="submit" className={goldBtn}>הצגת מורים</button>
                  <label className="flex items-center gap-2 text-sm text-[var(--text-2)]">
                    <input type="checkbox" name="remedial" value="1" className="h-4 w-4 accent-[var(--gold)]" />
                    רק הוראה מתקנת
                  </label>
                  <label className="flex items-center gap-2 text-sm text-[var(--text-2)]">
                    <input type="checkbox" name="online" value="1" className="h-4 w-4 accent-[var(--gold)]" />
                    גם אונליין
                  </label>
                </div>
              </form>
            ) : (
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/kids" className={goldBtn}>לשאלון לילדים ולנוער</Link>
                <Link href="/learning/join" className={outlineBtn}>מורים: הצטרפות למאגר</Link>
              </div>
            )}
            <p className="mt-5 text-[15px] leading-7 text-[var(--text-2)]">
              לא בטוחים מה הילד צריך?{" "}
              <Link href="/kids" className="font-bold text-[var(--teal-dark)] underline underline-offset-4">השאלון לילדים ולנוער מציע כיוון</Link>
              : הוראה מתקנת, מורה פרטי, אבחון או טיפול.
            </p>
          </div>

          {/* הפסיפס: שישה מורים עם תמונה. מתחת לשלוש תמונות: אריחי התחומים, עם מספר המורים בכל אחד. */}
          <div className="lg:-mb-28 lg:translate-y-6">
            {faces.length >= 3 ? (
              <ul className="grid list-none grid-cols-3 gap-3 sm:gap-4">
                {faces.slice(0, 6).map((f, i) => (
                  <li key={f.id} className={i % 3 === 1 ? "translate-y-5" : ""}>
                    <Link href={f.href} className="group block overflow-hidden rounded-[18px] bg-white shadow-[0_8px_30px_rgba(19,31,30,0.10)] transition-transform hover:-translate-y-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={f.photo} alt={f.name} width={300} height={400} className="aspect-[3/4] w-full object-cover" />
                      <span className="block px-3 py-2">
                        <span className="block truncate text-[14px] font-extrabold">{f.name}</span>
                        <span className="block truncate text-[12px] text-[var(--muted)]">{f.subjects}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="grid list-none grid-cols-2 gap-3 sm:gap-4">
                {TEACHER_SUBJECTS.map((s, i) => (
                  <li key={s.key} className={i === TEACHER_SUBJECTS.length - 1 ? "col-span-2" : ""}>
                    <Link
                      href={`/learning/teachers?subject=${s.key}`}
                      className="group flex h-full flex-col justify-between rounded-[18px] bg-white p-4 shadow-[0_8px_30px_rgba(19,31,30,0.08)] transition-transform hover:-translate-y-1"
                      style={{ borderInlineStart: `4px solid ${i % 2 === 0 ? "var(--teal)" : "var(--gold)"}` }}
                    >
                      <span className="text-[17px] font-extrabold leading-tight">{s.label}</span>
                      <span className="mt-3 text-[13px] text-[var(--muted)]">
                        {subjectCounts[s.key] ? `${subjectCounts[s.key]} ${subjectCounts[s.key] === 1 ? "מורה" : "מורים"} במאגר` : "המאגר מתמלא"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* ── מסלול ההורה: קו אחד, שלוש תחנות. */}
      <section id="how" className="scroll-mt-28 pb-16 pt-20 lg:pt-36">
        <div className={wide}>
          <h2 className={h2}>איך מוצאים כאן מורה</h2>
          <ol className="relative mt-10 grid list-none gap-8 md:grid-cols-3 md:gap-6">
            <span aria-hidden="true" className="absolute inset-x-0 top-[22px] hidden h-[2px] md:block" style={{ background: "var(--gold)" }} />
            {STEPS.map(({ title, body }, i) => (
              <li key={title} className="relative flex gap-4 md:block">
                <span className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-black text-white" style={{ background: "var(--gold)", boxShadow: "0 0 0 6px #fff" }}>
                  {i + 1}
                </span>
                <div className="md:mt-5">
                  <h3 className="text-lg font-extrabold">{title}</h3>
                  <p className="mt-2 leading-relaxed text-[var(--text-2)]">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── פס הפנים (משישה מורים עם תמונה; עד אז הפסיפס בפתיחה מספיק). */}
      <FacesMarquee faces={faces} />

      {/* ── לפי תחום */}
      <section className="py-16" style={{ background: "var(--surface)" }}>
        <div className={wide}>
          <h2 className={h2}>מורים לפי תחום</h2>
          <ul className="mt-8 grid list-none gap-4 md:grid-cols-2">
            {TEACHER_SUBJECTS.map((s) => (
              <li key={s.key} className="rounded-[18px] bg-white p-5" style={{ border: "1px solid var(--line)" }}>
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-lg font-extrabold text-[var(--teal-dark)]">{s.label}</h3>
                  {subjectCounts[s.key] > 0 && <span className="text-xs font-bold text-[var(--gold-dark)]">{subjectCounts[s.key]} במאגר</span>}
                </div>
                <p className="mt-2 leading-7 text-[var(--text-2)]">{SUBJECT_LINES[s.key]}</p>
                <Link href={`/learning/teachers?subject=${s.key}`} className="mt-3 inline-block text-sm font-bold text-[var(--gold-dark)] underline underline-offset-4">
                  למורים בתחום ←
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── איזה מורה לחפש */}
      <section id="which" className="scroll-mt-28 py-20">
        <div className={wide}>
          <div className="max-w-3xl">
            <h2 className={h2}>הוראה מתקנת או מורה פרטי: איך יודעים מה הילד צריך</h2>
            <p className="mt-4 text-[17px] leading-8 text-[var(--text-2)]">
              לפני שבוחרים מורה כדאי להבין מה בדיוק חסר לילד, כי לכל סוג של קושי מתאים מורה אחר. החלוקה שכאן נועדה להתמצאות
              ראשונה. אצל ילדים רבים יש יותר מסוג אחד של קושי.
            </p>
          </div>

          <div className="mt-8 overflow-hidden rounded-[18px] bg-white" style={{ border: "1px solid var(--line)" }}>
            <div className="hidden grid-cols-[1fr_1.5fr_1fr] gap-6 px-6 py-3 text-sm font-extrabold text-[var(--gold-dark)] md:grid" style={{ background: "var(--gold-pale)" }} aria-hidden="true">
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

      {/* ── פנקס: מה נבדק, ומה לפי הצהרה. שתי עמודות, סימן לכל אחת. */}
      <section id="checked" className="scroll-mt-28 py-16" style={{ background: "var(--surface)" }}>
        <div className={wide}>
          <h2 className={h2}>מה אנחנו בודקים, ומה לא</h2>
          <p className="mt-4 max-w-3xl text-[17px] leading-8 text-[var(--text-2)]">
            מי שמלמד באופן פרטי, בהוראה מתקנת או בשיעורים פרטיים, אינו חייב ברישיון, וכל אחד יכול להציג את עצמו כמורה. לכן חשוב לדעת מה
            שבדקנו, ומה לא:
          </p>
          <dl className="mt-8 grid gap-4 md:grid-cols-2">
            {CHECKED.map(({ title, body }, i) => {
              const verified = i === 0;
              const unchecked = i === 2;
              return (
                <div key={title} className={`rounded-[18px] bg-white p-6 ${verified ? "md:row-span-3" : ""}`} style={{ border: verified ? "1.5px solid var(--teal)" : "1px solid var(--line)" }}>
                  <dt className="flex items-start gap-3 text-lg font-extrabold text-[var(--teal-dark)]">
                    <span aria-hidden="true" className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-black" style={{ background: verified ? "var(--teal)" : unchecked ? "#FBE9EA" : "var(--gold-pale)", color: verified ? "#fff" : unchecked ? "#B3261E" : "var(--gold-dark)" }}>
                      {verified ? "✓" : unchecked ? "✗" : "•"}
                    </span>
                    <span>{title}</span>
                  </dt>
                  <dd className="mt-3 leading-relaxed text-[var(--text-2)]">{body}</dd>
                </div>
              );
            })}
          </dl>
        </div>
      </section>

      {/* ── גשר לשאלון */}
      <section className="py-20">
        <div className={narrow}>
          <div className="rounded-[20px] p-7 sm:p-9" style={{ background: "var(--teal-pale)" }}>
            <h2 className="text-xl font-black leading-tight text-[var(--teal-dark)] sm:text-2xl">שאלון שמציע כיוון: הוראה מתקנת, מורה פרטי, אבחון או טיפול</h2>
            <p className="mt-3 leading-relaxed text-[var(--text-2)]">
              לפעמים לא ברור אם הקושי לימודי, רגשי או קשור לקשב. בטיפול חכם יש שאלון לילדים ולנוער, שפיתחו פסיכולוגים.
              הוא עובר על התחומים ומציע כיוון. כשהתשובות מצביעות על קושי לימודי ממוקד, הדוח ממליץ על הוראה מתקנת או על מורה פרטי,
              ומציג מורים מהמאגר הזה. השאלון אינו אבחון.
            </p>
            <Link href="/kids" className={`${goldBtn} mt-6`}>לשאלון לילדים ולנוער</Link>
          </div>
        </div>
      </section>

      {/* ── שאלות נפוצות */}
      <section id="faq" className="scroll-mt-28 py-16" style={{ background: "var(--surface)" }}>
        <div className={narrow}>
          <h2 className={h2}>שאלות נפוצות</h2>
          <div className="mt-8 rounded-2xl bg-white" style={{ border: "1px solid var(--line)" }}>
            {FAQ.map((f, i) => (
              <details key={f.q} className="group" style={{ borderTop: i === 0 ? "none" : "1px solid var(--line)" }}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[16px] font-bold text-[var(--text)] [&::-webkit-details-marker]:hidden">
                  <span>{f.q}</span>
                  <span aria-hidden="true" className="shrink-0 text-[22px] leading-none text-[var(--gold)] transition group-open:rotate-45">+</span>
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

      {/* ── פס תחתון למורים, בירקרק כהה */}
      <section className="py-16" style={{ background: "var(--teal-dark)", color: "#fff" }}>
        <div className={`${wide} grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-center`}>
          <div>
            <p className="text-sm font-bold" style={{ color: "#F3D693" }}>למורים</p>
            <h2 className="mt-2 text-2xl font-black sm:text-3xl">מלמדים הוראה מתקנת או שיעורים פרטיים?</h2>
            <p className="mt-3 max-w-xl leading-relaxed" style={{ color: "rgba(255,255,255,0.82)" }}>
              הורים מחפשים כאן מורה לפי תחום, כיתה ואזור, ופונים אליו ישירות. ההצטרפות למאגר כרגע ללא תשלום, ואין עמלה על שיעורים.
            </p>
          </div>
          <div className="md:text-start">
            <Link href="/learning/join" className={goldBtn}>לפרטים ולהצטרפות</Link>
          </div>
        </div>
        <div className={`${wide} mt-12 text-sm leading-7`} style={{ color: "rgba(255,255,255,0.7)" }}>
          <span className="font-bold text-white">{LEARNING_SIGNATURE}</span>
          <br />
          {LEARNING_BRAND} הוא חלק מ<Link href="/" className="underline underline-offset-4" style={{ color: "#fff" }}>טיפול חכם</Link>. עדכון אחרון: {revisedLabel}.
        </div>
      </section>
    </main>
  );
}
