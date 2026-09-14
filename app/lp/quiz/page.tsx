import Link from "next/link";
import type { Metadata } from "next";
import { countListed } from "@/app/lib/therapist-directory";
import PageViewTracker from "@/app/components/PageViewTracker";
import QuizCta from "@/app/therapists/QuizCta";
import TooltipAsterisk from "@/app/components/TooltipAsterisk";

// הזרוע השנייה של טסט הנייטיב: ארצי + אונליין, בלי גיאוגרפיה, ובלי רשימת
// מטפלים. עמוד /lp/[region] מוכר "יש מטפלים לידך" - זו הוכחה מקומית, ואצלנו
// היא ממירה פי 13. העמוד הזה מוכר את הדבר שאף אינדקס לא יכול להעתיק:
// השאלון, הדו"ח שיוצא ממנו, וההתאמה לפי קושי ואישיות. הגולש ממילא בוחר
// אזור בתוך השאלון, אז הגיאוגרפיה לא צריכה להופיע לפניו.
//
// זה A/B אמיתי: אותה רשת, אותו סוג גולש, שני דפים. אם הזרוע הזאת מנצחת
// בהתחלות שאלון, המסקנה היא שבנייטיב הייחודיות שווה יותר מההוכחה המקומית,
// ואת הקמפיין הבא בונים ארצי. אם מפסידה - ההפך.
//
// noindex כמו אחיו: עמוד קמפיין, לא נכס חיפוש.

const BADGE = { display: "flex", alignItems: "center", gap: "6px" } as const;
const ICON = { display: "block" } as const;

// שלושת הצעדים מדף הבית, מילה במילה. לא מיובאים משם כי page.tsx הוא מקור
// של /  ב-page-revised.ts, וכל נגיעה בו מחייבת lastmod חדש שאין לו הצדקה.
const STEPS = [
  {
    n: "1",
    title: "מלאו את השאלון",
    body: "השאלון מתעדכן בזמן אמת ומדייק את השאלות בהתאם לתשובות שתזינו - כך תוכלו למקד ולהבין את הקושי שאתם מתמודדים איתו.",
    bg: "var(--teal)",
  },
  {
    n: "2",
    title: "קבלו דו\"ח אישי",
    body: "פירוט של הקשיים הבולטים שעלו מהשאלון, ובהתאם להם - סוגי הטיפול והמטפלים המתאימים במיוחד לכם. ניתן לשמירה כ-PDF.",
    bg: "var(--gold)",
  },
  {
    n: "3",
    title: "בחרו את המטפל הנכון לכם",
    body: "רשימת מטפלים מדורגת לפי סוג הטיפול המתאים, אישיות המטפל, האזור שבחרתם או אונליין.",
    bg: "var(--teal-dark)",
  },
] as const;

export const revalidate = 300;

export const metadata: Metadata = {
  title: "שאלון שמאתר את הקושי ומתאים לכם מטפל/ת",
  robots: { index: false, follow: false },
};

export default async function QuizLandingPage() {
  const [total, online] = await Promise.all([countListed(), countListed({ online: true })]);

  return (
    <main dir="rtl" style={{ background: "var(--bg)" }}>
      <PageViewTracker page="lp:quiz" />

      {/* ── שכבה 1: הכותרת של המודעה, התגיות, והכניסה ─────────────────── */}
      <section className="mx-auto max-w-3xl px-5 pt-6 pb-2 sm:pt-12">
        <h1
          style={{
            fontSize: "clamp(1.75rem,5vw,2.6rem)",
            fontWeight: 900,
            color: "var(--text)",
            letterSpacing: "-.02em",
            lineHeight: 1.2,
          }}
        >
          איך אדע מה הקושי שלי ואיזה טיפול אני צריך?
        </h1>
        <p className="mt-3 leading-7" style={{ color: "var(--text-2)", fontSize: "1.05rem" }}>
          לא רשימה אלפביתית של שמות. שאלון שבנו פסיכולוגים קליניים עוזר למקד מה מפריע, מה סוג
          הטיפול שמתאים לזה, ואיזה מטפל/ת מתאים לכם באופי ובגישה. בסוף מקבלים דו&quot;ח
          אישי, ורשימה של מטפלים מתאימים בכל הארץ ואונליין.
        </p>

        <div className="mt-4 mb-8 flex flex-wrap gap-x-5 gap-y-2.5" style={{ fontSize: "13px", color: "var(--muted)" }}>
          <span style={BADGE}>
            <img src="/icons/anonymous.svg" alt="" width={20} height={20} style={ICON} /> שאלון אנונימי
          </span>
          <span style={BADGE}>
            <img src="/icons/free.svg" alt="" width={20} height={20} style={ICON} /> חינמי
            <TooltipAsterisk />
          </span>
          <span style={BADGE}>
            <img src="/icons/minutes.svg" alt="" width={20} height={20} style={ICON} /> כמה דקות
          </span>
          <span style={BADGE}>
            <img src="/icons/report.svg" alt="" width={20} height={20} style={ICON} /> דו&quot;ח אישי לשמירה
          </span>
          <span style={BADGE}>
            <img src="/icons/team.svg" alt="" width={20} height={20} style={ICON} /> מטפלים מורשים בלבד
          </span>
        </div>

        <QuizCta body="ענו על שאלון קצר, וקבלו דו&quot;ח אישי והתאמה למטפל/ת, באזורכם או באונליין." />
      </section>

      {/* ── שכבה 2: מה מקבלים בדו"ח ────────────────────────────────────
          זה מה שהמודעה הבטיחה, ולכן הוא מעל הצעדים ולא מתחתם. */}
      <section style={{ background: "var(--surface)" }}>
        <div className="mx-auto max-w-3xl px-5 py-12">
          <h2 className="text-2xl font-black" style={{ color: "var(--text)" }}>
            מה יש בדו&quot;ח שתקבלו בסוף
          </h2>
          <ul className="mt-6 grid gap-4">
            {[
              ["מיקוד הקושי", "לא \"חרדה\" באופן כללי, אלא מה בדיוק מפריע ואיפה זה פוגש אתכם ביומיום."],
              ["סוג הטיפול שמתאים לזה", "CBT, דינמי, זוגי, EMDR ועוד. לכל קושי יש גישות שעובדות טוב יותר, והדו\"ח אומר איזו."],
              ["התאמת אישיות המטפל/ת", "יש מי שצריך מטפל/ת שמובילים, ויש מי שצריך מי שמקשיבים. השאלון בודק גם את זה."],
              ["רשימת מטפלים מתאימים", `מתוך ${total} מטפלים ומטפלות מורשים בכל הארץ, ${online} מהם גם אונליין.`],
            ].map(([t, b]) => (
              <li key={t} className="flex gap-3">
                <span
                  className="mt-1 inline-flex shrink-0 items-center justify-center rounded-full text-xs font-bold"
                  style={{ width: 22, height: 22, background: "var(--teal)", color: "#fff" }}
                >
                  ✓
                </span>
                <div>
                  <p className="font-extrabold" style={{ color: "var(--text)" }}>{t}</p>
                  <p className="mt-0.5 leading-7" style={{ color: "var(--text-2)" }}>{b}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── שכבה 3: שלושת הצעדים, כמו בדף הבית ────────────────────────── */}
      <section className="mx-auto max-w-3xl px-5 py-12">
        <h2 className="text-2xl font-black" style={{ color: "var(--text)" }}>
          איך זה עובד
        </h2>
        <div className="mt-6 grid gap-5">
          {STEPS.map((s) => (
            <div key={s.n} className="flex gap-4">
              <span
                className="inline-flex shrink-0 items-center justify-center rounded-full text-base font-black"
                style={{ width: 40, height: 40, background: s.bg, color: "#fff" }}
              >
                {s.n}
              </span>
              <div>
                <h3 className="text-lg font-extrabold" style={{ color: "var(--text)" }}>{s.title}</h3>
                <p className="mt-1 leading-7" style={{ color: "var(--text-2)" }}>{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── שכבה 4: שלוש ההתלבטויות ────────────────────────────────────── */}
      <section style={{ background: "var(--surface)" }}>
        <div className="mx-auto max-w-3xl px-5 py-12">
          <h2 className="text-xl font-black" style={{ color: "var(--text)" }}>
            שאלות שנשאלות כאן הרבה
          </h2>
          <dl className="mt-6 grid gap-6">
            <div>
              <dt className="font-extrabold" style={{ color: "var(--text)" }}>כמה זה עולה?</dt>
              <dd className="mt-1.5 leading-7" style={{ color: "var(--text-2)" }}>
                השאלון, הדו&quot;ח וההתאמה בחינם. את מחיר הטיפול עצמו קובע/ת המטפל/ת, ואתם סוגרים ישירות מולו.
              </dd>
            </div>
            <div>
              <dt className="font-extrabold" style={{ color: "var(--text)" }}>מה קורה עם מה שאני כותב?</dt>
              <dd className="mt-1.5 leading-7" style={{ color: "var(--text-2)" }}>
                השאלון אנונימי. אין צורך בשם או בפרטים מזהים, ותשובותיכם לא מועברות לאיש.
              </dd>
            </div>
            <div>
              <dt className="font-extrabold" style={{ color: "var(--text)" }}>אני מתחייב למשהו?</dt>
              <dd className="mt-1.5 leading-7" style={{ color: "var(--text-2)" }}>
                לא. בסוף השאלון תקבלו את הדו&quot;ח ורשימת מטפלים. אם תרצו, תפנו. אם לא, לא.
              </dd>
            </div>
          </dl>

          <div className="mt-10">
            <QuizCta body="שאלון קצר, ובסופו דו&quot;ח אישי והתאמה. בחינם, אנונימי, וללא התחייבות." />
          </div>

          <p className="mt-8 text-center text-sm">
            <Link href="/research/how-matching-works" className="font-bold" style={{ color: "var(--teal-dark)" }}>
              איך ההתאמה מחושבת ←
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
