import type { Metadata } from "next";
import Link from "next/link";
import PageViewTracker from "@/app/components/PageViewTracker";

/**
 * The doorway to the counsellor rubric.
 *
 * The tool itself (/school) stays out of the index and out of the navigation:
 * it is a working instrument, and a parent who wandered into it would get the
 * kids questionnaire without its paywall. This page is what search is meant to
 * find - it explains the tool to the person it was built for and links to it,
 * so the entry point is a page whose wording we control rather than the first
 * screen of a questionnaire.
 *
 * Not linked from the main navigation either. The nav carries the two audiences
 * the site is organised around, and a third would be the clutter this page
 * exists to avoid; the footer and the articles a counsellor already reads are
 * the quiet routes in.
 */
export const metadata: Metadata = {
  title: "שאלון מסייע להפניות ליועצות חינוכיות ולצוותי חינוך",
  description:
    "כלי עבודה ליועצת: מיפוי מוקד הקושי של התלמיד/ה בארבעה מסלולים, הפניה מנומקת לטיפול או לאבחון, מפת הוועדות עם המועדים והמסמכים, וטיוטת סיכום להעתקה. בלי פרטים מזהים, בחינם.",
  alternates: { canonical: "https://www.mentalytics.co.il/counselors" },
  openGraph: {
    title: "שאלון מסייע להפניות - ליועצות ולצוותי חינוך | טיפול חכם",
    description:
      "מוקד הקושי בארבעה מסלולים, הפניה מנומקת, מפת ועדות עם מועדים מחושבים, וטיוטת סיכום להפניה - בלי פרטים מזהים.",
  },
};

const OUTPUTS = [
  {
    title: "מוקד הקושי, לפי מסלול",
    body: "השאלון נפתח בארבעת התחומים - רגשי, לימודי, חברתי והתנהגותי - ונפתח לעומק רק במה שסומן. הפלט הוא תמונה ראשונית של מה שעולה בכל תחום, בשפה שאפשר להביא איתה לצוות הרב-מקצועי או לשיחה עם ההורים.",
  },
  {
    title: "הפניה מנומקת, עם הסבר",
    body: "לכל ממצא מוצע סוג הטיפול או האבחון המתאים לו, עם הסבר קצר למה דווקא הוא. אפשר גם לחפש מטפלים באזור - הרשימה נועדה להעברה להורים, והבחירה נשארת שלהם.",
  },
  {
    title: "מפת הוועדות, עם התאריכים שלך",
    body: "צוות רב-מקצועי, ועדת זכאות ואפיון, התאמות בדרכי היבחנות והערר על כל אחת - מסודרים לפי מה שרלוונטי לתלמיד/ה הזה, עם המועדים מחושבים לתאריך היום, המסמכים הנדרשים, והשאלה מי מוסמך לתת אבחנה קבילה לכל סוג מוגבלות.",
  },
  {
    title: "טיוטת סיכום להפניה",
    body: "רקע, ממצאים, מה כבר נוסה בבית הספר ומה קרה, והמלצות - מוכן להעתקה למסמך שלך. זה בדיוק החומר שוועדת זכאות מבקשת כ\"סיכום התערבויות\", וזה החלק שחוסך את השעה.",
  },
];

const FAQ = [
  {
    q: "כמה זמן זה לוקח?",
    a: "בין ארבע לשש דקות. עונים רק על התחומים שסומנו, ובכל שאלה שאין לך מידע עליה אפשר לסמן \"לא ידוע\" ולהמשיך - השאלון לא יחסום אותך.",
  },
  {
    q: "אני לא יודעת מה קורה בבית. אפשר בכל זאת למלא?",
    a: "כן. לפני החלק הרגשי מופיע מסך שממליץ למלא אותו יחד עם ההורים, בטלפון או בפגישה, כי חלק מהסימפטומים מתרחשים בבית. אם אין אפשרות כרגע - עונים על מה שידוע, מסמנים \"לא ידוע\" בשאר, ואפשר לשמור טיוטה ולחזור אחרי שיחה עם ההורים.",
  },
  {
    q: "האם נשמרים פרטים על התלמיד/ה?",
    a: "לא. אין שדה שם, אין מספר זהות ואין שדות טקסט חופשי שמזמינים פרטים מזהים - השאלון בנוי כך שאינו מבקש אותם. הטיוטות נשמרות בדפדפן שבו מילאת בלבד, עד 21 יום, ואינן נשלחות לשרת.",
  },
  {
    q: "זה קובע זכאות או מחליף אבחון?",
    a: "לא, ובמפורש. הכלי מסייע בהכוונה ובהתארגנות. הוא אינו אבחון, אינו קובע זכאות לשירותי חינוך מיוחדים או להתאמות, ואינו מחליף את שיקול דעתך, את הפסיכולוג/ית של בית הספר או את החלטת הוועדה.",
  },
  {
    q: "מאיפה מגיעים המועדים והכללים?",
    a: "מפרסומים רשמיים של משרד החינוך בלבד, ולצד כל מסלול כתוב מול מה הוא אומת ומתי. הם משתנים משנה לשנה, ולרשות המקומית עשויים להיות מועדים פנימיים מוקדמים יותר - לכן המפה אומרת מה המועד הסטטוטורי ומבקשת לאמת מול הרשות לפני הגשה.",
  },
  {
    q: "כמה זה עולה?",
    a: "כלום. השאלון פתוח ליועצות ולצוותי חינוך בלי תשלום ובלי הרשמה.",
  },
];

export default function CounselorsPage() {
  return (
    <main dir="rtl" className="min-h-screen bg-white" style={{ fontFamily: "'Heebo', sans-serif", color: "var(--text)" }}>
      <PageViewTracker page="counselors" source="counselors" />

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-5 pt-20 pb-14 sm:pt-28">
        <p className="mb-4 text-sm font-bold" style={{ color: "var(--teal)" }}>ליועצות חינוכיות ולצוותי חינוך</p>
        <h1 className="text-[2.1rem] font-black leading-[1.15] sm:text-[3rem]" style={{ color: "var(--text)" }}>
          שאלון מסייע להפניות
        </h1>
        <p className="mt-5 text-lg leading-relaxed" style={{ color: "var(--text-2)" }}>
          את מכירה את התלמיד/ה. מה שלוקח זמן זה מה שבא אחרי: לאיזה טיפול או אבחון להפנות, איזו ועדה רלוונטית ועד מתי,
          אילו מסמכים צריך, ואיך לכתוב את הסיכום. השאלון עושה את המיפוי הזה איתך בכמה דקות.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/school"
            className="inline-flex items-center justify-center rounded-full px-8 py-4 text-base font-bold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--teal-dark)" }}
          >
            למילוי השאלון ←
          </Link>
          <span className="text-sm" style={{ color: "var(--muted)" }}>בחינם · בלי הרשמה · בלי פרטים מזהים</span>
        </div>
      </section>

      {/* What comes out of it */}
      <section className="py-16" style={{ background: "var(--surface)" }}>
        <div className="mx-auto max-w-3xl px-5">
          <h2 className="text-2xl font-black sm:text-3xl" style={{ color: "var(--text)" }}>מה מקבלים בסוף</h2>
          <div className="mt-8 flex flex-col gap-4">
            {OUTPUTS.map(({ title, body }) => (
              <div key={title} className="rounded-2xl bg-white p-6" style={{ border: "1px solid var(--line)" }}>
                <h3 className="text-lg font-extrabold" style={{ color: "var(--teal-dark)" }}>{title}</h3>
                <p className="mt-2 leading-relaxed" style={{ color: "var(--text-2)" }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it is built */}
      <section className="mx-auto max-w-3xl px-5 py-16">
        <h2 className="text-2xl font-black sm:text-3xl" style={{ color: "var(--text)" }}>על מה זה מבוסס</h2>
        <div className="mt-6 space-y-4 leading-relaxed" style={{ color: "var(--text-2)" }}>
          <p>
            זהו שאלון ההפניה של טיפול חכם לילדים ולנוער - שאלון אדפטיבי שפותח על ידי פסיכולוג קליני, שהורים ממלאים על ילדיהם -
            מנקודת המבט של בית הספר. אותם תחומים ואותה הסתעפות, ובכל תחום נוספות שאלות על מה שרואים בכיתה: ביקור סדיר,
            התארגנות, ויסות, מעמד חברתי והצקות, ותגובה לתמיכה שכבר ניתנה. לפני הדוח מסך אחד שמדייק את ההפניה - מה כבר נוסה
            בבית הספר, מה כבר יש בתיק, ואילו ועדות התקיימו.
          </p>
          <p>
            החלק הבירוקרטי נשען על פרסומי משרד החינוך: התוספת הראשונה לתיקון 11 לחוק החינוך המיוחד, שקובעת מי מוסמך לתת
            אבחנה קבילה לכל סוג מוגבלות; מועדי ההפניה והדיון של ועדת זכאות ואפיון; וחוזר הנהלים להתאמות בדרכי היבחנות, שממנו
            נגזר גם תאריך הרצפה לאבחון שיוגש לוועדה המחוזית. לצד כל מסלול מצוין המקור ומועד האימות.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16" style={{ background: "var(--surface)" }}>
        <div className="mx-auto max-w-3xl px-5">
          <h2 className="text-2xl font-black sm:text-3xl" style={{ color: "var(--text)" }}>שאלות שחוזרות</h2>
          <div className="mt-8 flex flex-col gap-4">
            {FAQ.map(({ q, a }) => (
              <div key={q} className="rounded-2xl bg-white p-6" style={{ border: "1px solid var(--line)" }}>
                <h3 className="font-extrabold" style={{ color: "var(--text)" }}>{q}</h3>
                <p className="mt-2 leading-relaxed" style={{ color: "var(--text-2)" }}>{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Close */}
      <section className="mx-auto max-w-3xl px-5 py-20 text-center">
        <h2 className="text-2xl font-black sm:text-3xl" style={{ color: "var(--text)" }}>אפשר להתחיל עם תלמיד/ה אחד/ת</h2>
        <p className="mx-auto mt-4 max-w-xl leading-relaxed" style={{ color: "var(--text-2)" }}>
          הדרך לראות אם זה עוזר היא למלא פעם אחת על מקרה שכבר מוכר לך, ולהשוות למה שהיית כותבת בעצמך.
        </p>
        <div className="mt-8">
          <Link
            href="/school"
            className="inline-flex items-center justify-center rounded-full px-8 py-4 text-base font-bold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--teal-dark)" }}
          >
            למילוי השאלון ←
          </Link>
        </div>
        <p className="mt-10 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
          עובדות ופסיכולוגים בבית הספר מוזמנים גם{" "}
          <Link href="/research/psychodidactic" className="underline" style={{ color: "var(--teal)" }}>למדריך האבחון הפסיכודידקטי</Link>
          {" "}ול<Link href="/therapists" className="underline" style={{ color: "var(--teal)" }}>מאגר המטפלים</Link>.
        </p>
      </section>
    </main>
  );
}
