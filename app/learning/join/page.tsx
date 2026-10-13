import type { Metadata } from "next";
import Link from "next/link";
import JoinForm from "./JoinForm";
import { LEARNING_BRAND, LEARNING_OG_IMAGE, LEARNING_SIGNATURE, learningRobots } from "@/app/lib/learning-door";
import { shareMetadata } from "@/app/lib/share-metadata";
import { TEACHER_SUBJECTS } from "@/app/lib/teacher-options";

// דף ההצטרפות למורים של "לימוד חכם". מורים מגיעים אליו מהפוסטים בקבוצות
// פייסבוק (שם מתחיל הגיוס), מהדלת (/learning), ומחיפוש.
//
// בנוי כפי שהבעלים ביקש ב-13/10/2026: מה זה לימוד חכם ומה הקשר לטיפול חכם,
// איך יגיעו תלמידים, מה מקבלים ומה זה עולה, מי יכול להצטרף, ואז הטופס בחלקים
// ממוספרים. טון עובדתי: בלי הבטחה למספר פניות (המאגר חדש, ונאמר כך), ובלי
// מחיר עתידי - "כרגע ללא תשלום" הוא כל מה שנאמר (TEACHER_FREE_LISTING).
// הנוסח עבר את אותו פאנל ביקורת של דף הנחיתה.

const URL = "https://www.mentalytics.co.il/learning/join";
const TITLE = "הצטרפות למאגר מורים פרטיים ומורים להוראה מתקנת";
const DESCRIPTION =
  "מורים להוראה מתקנת, לחינוך מיוחד ומורים פרטיים: פרופיל במאגר של לימוד חכם, שבו הורים מחפשים מורה לפי תחום, כיתה ואזור ופונים ישירות. כרגע ללא תשלום וללא עמלה.";

const ROUTES: { title: string; body: string }[] = [
  {
    title: "מהשאלון לילדים ולנוער",
    body: "הורים ממלאים בטיפול חכם שאלון על ילדם. כשהתשובות מצביעות על קושי לימודי ממוקד, למשל בחשבון בכיתה ג׳ או באנגלית בתיכון, הדוח ממליץ על הוראה מתקנת או על מורה פרטי, ומציג מורים שמתאימים לתחום, לכיתה ולאזור.",
  },
  {
    title: "משאלון היועצות",
    body: "יועצות חינוכיות ממלאות גרסה של השאלון על תלמידים שלהן. כשהתשובות מצביעות על קושי לימודי, מוצגים להן מורים מתאימים.",
  },
  {
    title: "מחיפוש במאגר",
    body: "הורה שנכנס למאגר, או שמגיע מגוגל, מסנן לפי תחום, כיתה ואזור ורואה את הכרטיס שלכם.",
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "יש תשלום?",
    a: "לא. כרגע אין תשלום על ההצטרפות, על הפרופיל או על הפניות, ואין עמלה על שיעורים. לא מבקשים כרטיס אשראי, ולכן אין חיוב אוטומטי.",
  },
  {
    q: "אילו מקצועות אפשר ללמד במאגר?",
    a: `${TEACHER_SUBJECTS.map((s) => s.label).join(", ")}. מקצועות אחרים, כמו פיזיקה או כימיה, אינם כלולים כרגע.`,
  },
  {
    q: "אני מלמד/ת רק אונליין. אפשר?",
    a: "כן. מסמנים בטופס שהשיעור מתקיים אונליין, וההורים יכולים לסנן לפי זה.",
  },
  {
    q: "באיזה סדר מוצגים המורים?",
    a: "קודם מורים מהאזור שההורה בחר. ביניהם, ראשונים מי שסימנו ניסיון עם הקושי שההורה ציין, למשל קשב או דיסלקסיה. בין מורים שווים הסדר מתחלף מדי יום, כדי שאף מורה לא יהיה תמיד ראשון או אחרון.",
  },
  {
    q: "כמה זמן עד שהפרופיל עולה?",
    a: "אנחנו עוברים על כל הרשמה בעצמנו, בדרך כלל בתוך כמה ימים. כשהפרופיל מאושר נשלח אליכם מייל.",
  },
  {
    q: "אילו פרופילים לא מאושרים?",
    a: "פרופיל שאינו של הוראה (למשל טיפול רגשי או אבחון), פרופיל שחסרים בו פרטים, והכשרה בהוראה מתקנת או בחינוך מיוחד שלא צורפה לה תעודה.",
  },
  {
    q: "מי רואה את מספר הטלפון שלי?",
    a: "המספר מוצג בכרטיס ובפרופיל שלכם, וכל מי שנכנס לאתר יכול לראות אותו. כתובת המייל אינה מוצגת.",
  },
  {
    q: "מה קורה לתעודה ששלחתי?",
    a: "היא משמשת רק לבדיקה שלנו, ואינה מוצגת לאיש מלבדנו.",
  },
  {
    q: "אפשר לעדכן או להסיר את הפרופיל?",
    a: "כן. אחרי ההרשמה תקבלו במייל קישור אישי לעריכת הפרופיל, בלי סיסמה. להסרה מהמאגר כותבים לנו, והפרופיל יורד.",
  },
];

export const metadata: Metadata = {
  // absolute: הסיומת של האתר היא "| טיפול חכם", והעמוד הזה חותם בשם של הדלת.
  title: { absolute: `${TITLE} | ${LEARNING_BRAND}` },
  description: DESCRIPTION,
  alternates: { canonical: URL },
  robots: learningRobots(),
  ...shareMetadata({
    url: "/learning/join",
    title: `${LEARNING_BRAND}: מאגר חדש למורים להוראה מתקנת ולמורים פרטיים`,
    description: "הורים מחפשים מורה לפי תחום, כיתה ואזור ופונים ישירות. ההצטרפות כרגע ללא תשלום וללא עמלה.",
    type: "website",
    image: LEARNING_OG_IMAGE,
  }),
};

const h2 = "text-xl font-black leading-tight text-[var(--text)] sm:text-2xl";
const prose = "text-[16px] leading-8 text-[var(--text-2)]";

function jsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export default function TeacherJoinPage() {
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };

  return (
    <main className="mx-auto max-w-3xl px-5 py-12 pb-24" dir="rtl" style={{ color: "var(--text)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(faqLd) }} />

      {/* הלוגו בכותרת העליונה (LearningNavBar); כאן רק למי העמוד. */}
      <p className="mb-3 text-sm font-bold text-[var(--teal)]">{LEARNING_BRAND} · למורים</p>
      <h1 className="text-3xl font-black leading-tight sm:text-[2.6rem]">הצטרפות למאגר המורים של {LEARNING_BRAND}</h1>
      <p className="mt-5 text-lg leading-8 text-[var(--text-2)]">
        {LEARNING_BRAND} הוא מאגר של מורים להוראה מתקנת ומורים פרטיים, לכיתות א׳ עד י״ב. הורים מחפשים בו מורה לפי תחום, כיתה ואזור,
        ופונים אליכם ישירות. ההצטרפות כרגע ללא תשלום, ואין עמלה על שיעורים.
      </p>
      <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
        <a href="#join-form" className="inline-flex items-center justify-center rounded-full bg-[var(--teal)] px-8 py-3.5 text-base font-bold text-white transition-colors hover:bg-[var(--teal-dark)]">
          לטופס ההצטרפות
        </a>
        <span className="text-sm text-[var(--muted)]">טופס אחד. אחרי האישור נשלח אליכם קישור אישי לעריכת הפרופיל, בלי סיסמה.</span>
      </div>

      <section className="mt-14">
        <h2 className={h2}>מי אנחנו</h2>
        <p className={`mt-3 ${prose}`}>
          {LEARNING_BRAND} הוא חלק מ<Link href="/" className="font-bold text-[var(--teal-dark)] underline underline-offset-4">טיפול חכם</Link>, אתר
          להתאמת טיפול נפשי שבנה פסיכולוג קליני. הורים ממלאים באתר שאלון על ילדם ומקבלים דוח עם המלצות. אצל חלק מהילדים ההמלצה היא
          הוראה מתקנת או מורה פרטי, ועד עכשיו לא הייתה לנו רשימת מורים להפנות אליה. המאגר נבנה בשביל זה.
        </p>
      </section>

      <section className="mt-12">
        <h2 className={h2}>איך הורים יגיעו אליכם</h2>
        <ol className="mt-5 list-none space-y-4">
          {ROUTES.map(({ title, body }, i) => (
            <li key={title} className="grid grid-cols-[auto_1fr] gap-x-4">
              <span aria-hidden="true" className="text-3xl font-black leading-none text-[var(--teal)]">{i + 1}</span>
              <div>
                <h3 className="text-[17px] font-extrabold">{title}</h3>
                <p className="mt-1 leading-7 text-[var(--text-2)]">{body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-6 leading-7 text-[var(--text-2)]" style={{ borderInlineStart: "3px solid var(--gold)", paddingInlineStart: "16px" }}>
          המאגר חדש. בשבועות הראשונים יהיו מעט פניות, ומספרן יעלה ככל שהמאגר יתמלא ויותר הורים ויועצות ישתמשו בו.
        </p>
      </section>

      <section className="mt-12">
        <h2 className={h2}>מה מקבלים, ומה זה עולה</h2>
        <ul className="mt-4 list-none space-y-3 leading-7 text-[var(--text-2)]">
          <li><strong className="text-[var(--text)]">פרופיל במאגר.</strong> התחומים, הכיתות, האזורים, ההכשרה, המחיר וכמה מילים שלכם.</li>
          <li><strong className="text-[var(--text)]">פניות ישירות.</strong> ההורים פונים אליכם בוואטסאפ או בטלפון. את המחיר, המקום והמועדים קובעים אתם, ואין עמלה על שיעורים.</li>
          <li><strong className="text-[var(--text)]">נתונים.</strong> בקישור האישי תראו כמה פעמים הפרופיל הוצג, וכמה פעמים הורים לחצו על וואטסאפ או על חיוג.</li>
          <li><strong className="text-[var(--text)]">ללא תשלום, כרגע.</strong> ההצטרפות, הפרופיל והפניות אינם כרוכים בתשלום. לא מבקשים כרטיס אשראי, ולכן אין חיוב אוטומטי.</li>
        </ul>
      </section>

      <section className="mt-12">
        <h2 className={h2}>מי יכול להצטרף</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl p-5" style={{ background: "var(--teal-pale)" }}>
            <h3 className="text-base font-black text-[var(--teal-dark)]">מורים להוראה מתקנת ולחינוך מיוחד</h3>
            <p className="mt-2 text-[15px] leading-7 text-[var(--text-2)]">
              עם תעודת הכשרה בהוראה מתקנת (מותאמת), תואר בחינוך מיוחד או תואר שני בלקויות למידה. נבקש לצרף את התעודה, ונבדוק אותה
              לפני שהפרופיל עולה. בכרטיס יופיע הסימון &quot;תעודה נבדקה&quot;.
            </p>
          </div>
          <div className="rounded-2xl p-5" style={{ background: "var(--gold-pale)" }}>
            <h3 className="text-base font-black text-[var(--gold-dark)]">מורים פרטיים</h3>
            <p className="mt-2 text-[15px] leading-7 text-[var(--text-2)]">
              למתמטיקה, לאנגלית, לעברית ולשון ולאסטרטגיות למידה. אין צורך לצרף תעודה. ההשכלה, ההכשרה והניסיון יוצגו להורים לפי
              מה שכתבתם, ואיננו מאמתים אותם.
            </p>
          </div>
        </div>
        <p className="mt-5 text-[15px] leading-7 text-[var(--text-2)]">
          אנחנו עוברים על כל פרופיל לפני שהוא מוצג. בהרשמה תתבקשו להצהיר שאין לכם הרשעה פלילית ושאין מניעה על פי דין לעבודתכם עם
          קטינים. אתם מורים עצמאיים: ההתקשרות, התשלום והאחריות המקצועית הם ביניכם לבין ההורים.
        </p>
      </section>

      <div className="mt-12">
        <JoinForm />
      </div>

      <section className="mt-14">
        <h2 className={h2}>שאלות של מורים</h2>
        <div className="mt-6 rounded-2xl" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          {FAQ.map((f, i) => (
            <details key={f.q} className="group" style={{ borderTop: i === 0 ? "none" : "1px solid var(--line)" }}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[16px] font-bold text-[var(--text)] [&::-webkit-details-marker]:hidden">
                <span>{f.q}</span>
                <span aria-hidden="true" className="shrink-0 text-[22px] leading-none text-[var(--teal)] transition group-open:rotate-45">+</span>
              </summary>
              <p className="px-5 pb-5 text-[15.5px] leading-8 text-[var(--text-2)]">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <p className="mt-10 text-sm leading-7 text-[var(--muted)]">
        <span className="font-bold text-[var(--text-2)]">{LEARNING_SIGNATURE}</span>
        <br />
        לשאלות: <a href="mailto:admin@getmentalytics.com" className="underline underline-offset-4" dir="ltr">admin@getmentalytics.com</a>
      </p>
    </main>
  );
}
