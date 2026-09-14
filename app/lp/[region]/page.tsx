import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { loadPublicTherapists } from "@/app/lib/therapist-directory";
import { slugToCity, slugToRegion, CITY_TO_REGION } from "@/app/lib/regions";
import TherapistResultCard from "@/app/components/TherapistResultCard";
import PageViewTracker from "@/app/components/PageViewTracker";
import QuizCta from "@/app/therapists/QuizCta";
import TooltipAsterisk from "@/app/components/TooltipAsterisk";

// עמוד נחיתה לקמפיינים בתשלום (Taboola/נייטיב). קיים בנפרד מעמודי הערים
// והאזורים ב-/therapists מסיבה אחת: אלה נכסי SEO מדורגים, ואסור לשנות
// את הכותרת או המבנה שלהם לפי צורכי קמפיין בן שבועיים. כאן מותר הכל,
// כי העמוד noindex ולא מתחרה על אף שאילתה.
//
// המבנה נגזר משלושה מקורות:
//   1. נתוני ההמרה של האתר - עמודי עיר ממירים 6-7.7% מול 0.95% בדף הבית,
//      וההפרש הוא ההיצע המקומי הגלוי. לכן כרטיסי המטפלים גבוה בעמוד.
//   2. הדפוס של BetterHelp - נקודת הכניסה למעלה, התוכן מתחתיה.
//   3. הבטחת המודעה - בנייטיב הגולש קרא כותרת והתחייב לתוכן. דף שהוא
//      רשימה בלבד שובר את ההבטחה ומייצר נטישה מיידית.
//
// מובייל-first במכוון: קמפיין הנייטיב רץ על מובייל בלבד (CPC של כשליש
// מדסקטופ, ותנועת אתרי התוכן בישראל היא ברובה מובייל).

const HOW_MANY_CARDS = 6;

const BADGE = { display: "flex", alignItems: "center", gap: "6px" } as const;
const ICON = { display: "block" } as const;

export const revalidate = 300;

type Params = { params: Promise<{ region: string }> };

/**
 * הפרמטר יכול להיות עיר או אזור - הקמפיינים משתמשים בשניהם.
 *
 * `around` הוא הסיפא לכותרות: עיר צריכה "והסביבה" כדי שגולש מרמת גן לא
 * ירגיש שהעמוד לא בשבילו, אבל שם אזור כבר מתאר שטח, ו"בחיפה והקריות
 * והסביבה" הוא ניסוח מגושם עם שתי ו' רצופות.
 */
function resolvePlace(
  slug: string
): { name: string; around: string; filter: { city?: string; region?: string } } | null {
  const city = slugToCity(slug);
  if (city) return { name: city, around: `${city} והסביבה`, filter: { city } };
  const region = slugToRegion(slug);
  if (region) return { name: region, around: region, filter: { region } };
  return null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { region: slug } = await params;
  const place = resolvePlace(slug);
  if (!place) return { title: "עמוד לא נמצא", robots: { index: false, follow: false } };
  return {
    // בלי הסיפא "| טיפול חכם" - ה-layout הראשי מוסיף אותה בעצמו, וכפילות
    // כאן מייצרת "| טיפול חכם | טיפול חכם" בלשונית ובתצוגה המקדימה.
    title: `פסיכולוגים ומטפלים ב${place.around}`,
    // noindex הוא לא זהירות אלא חובה: בלעדיו העמוד הזה מתחרה בעמוד העיר
    // האמיתי על אותה שאילתה ומדלל אותו.
    robots: { index: false, follow: false },
  };
}

export default async function LandingPage({ params }: Params) {
  const { region: slug } = await params;
  const place = resolvePlace(slug);
  if (!place) notFound();

  const therapists = await loadPublicTherapists(place.filter);
  const shown = therapists.slice(0, HOW_MANY_CARDS);
  const total = therapists.length;
  const regionForCard = place.filter.region ?? (place.filter.city ? CITY_TO_REGION[place.filter.city] : undefined);

  return (
    <main dir="rtl" style={{ background: "var(--bg)" }}>
      {/* page מתחיל ב-lp: כדי שהתנועה מהקמפיין תהיה ניתנת להפרדה מיידית
          בפילוח עמודי הנחיתה ב-/admin, בלי להסתמך רק על ה-UTM. */}
      <PageViewTracker page={`lp:${place.name}`} />

      {/* ── שכבה 1: הבטחה + כניסה מיידית ─────────────────────────────── */}
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
          {/* הרווח מפורש: מעבר שורה בין ביטוי לטקסט נבלע ב-JSX, ובלעדיו
              נדבק "בתל אביבלפי". */}
          לא רשימה אלפביתית. שאלון קצר שבנו פסיכולוגים קליניים מתאים לכם מטפל/ת ב{place.name}{" "}
          לפי סוג הקושי, הגישה הטיפולית והאישיות המקצועית.
        </p>

        {/* אותן חמש תגיות אמון שבדף הבית. הן עונות בדיוק על ההתלבטויות
            שעוצרות אנשים כאן - עלות, חשיפה, מאמץ - ולכן מקומן מעל הכפתור
            ולא ב-FAQ שבתחתית, שאליו רוב הגולשים לא יגיעו. */}
        <div
          className="mt-4 mb-8 flex flex-wrap gap-x-5 gap-y-2.5"
          style={{ fontSize: "13px", color: "var(--muted)" }}
        >
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

        <QuizCta body="ענו על שאלון קצר, ובסופו תקבלו התאמה אישית למטפל/ת באזורכם או באונליין." />
      </section>

      {/* ── שכבה 2: ההוכחה המקומית ────────────────────────────────────
          זה החלק שמסביר את הפער בין 6-7.7% בעמוד עיר ל-0.95% בדף הבית:
          לראות מטפלים אמיתיים באזור שלך, עם שם ותואר, הופך את ההבטחה
          מהפשטה לעובדה. */}
      {total > 0 && (
        <section className="mx-auto max-w-3xl px-5 py-8">
          <h2 className="text-xl font-black" style={{ color: "var(--text)" }}>
            {total} מטפלים ומטפלות ב{place.around}
          </h2>
          <p className="mt-1.5 text-sm" style={{ color: "var(--muted)" }}>
            תעודות ההכשרה של כל המטפלים באתר אומתו מול המסמכים המקוריים.
          </p>

          <div className="mt-5 grid gap-4">
            {shown.map((t) => (
              <TherapistResultCard key={t.id} t={t} contextRegion={regionForCard} />
            ))}
          </div>

          {total > HOW_MANY_CARDS && (
            <p className="mt-5 text-center">
              <Link
                href={place.filter.city ? `/therapists/city/${slug}` : `/therapists/region/${slug}`}
                className="font-bold"
                style={{ color: "var(--teal-dark)" }}
              >
                לכל {total} המטפלים ב{place.name} ←
              </Link>
            </p>
          )}
        </section>
      )}

      {/* ── שכבה 3: התוכן שמקיים את הבטחת הכותרת ──────────────────────
          תמצית משלושת הפרקים המרכזיים של /research/choosing-therapist,
          שהוא המאמר צמוד-ההחלטה עם שיעור הכניסה לשאלון הגבוה באתר. */}
      <section style={{ background: "var(--surface)" }}>
        <div className="mx-auto max-w-3xl px-5 py-12">
          <h2 className="text-2xl font-black" style={{ color: "var(--text)" }}>
            שלושה דברים שכדאי לדעת לפני שבוחרים
          </h2>

          <div className="mt-7 grid gap-7">
            <div>
              <h3 className="text-lg font-extrabold" style={{ color: "var(--teal-dark)" }}>
                ההתאמה חשובה יותר מהשיטה
              </h3>
              <p className="mt-2 leading-8" style={{ color: "var(--text-2)" }}>
                CBT, טיפול דינמי, EMDR - לכל גישה יש מקום, אבל המחקר עקבי בנקודה אחת: איכות
                הקשר בין המטפל למטופל מנבאת את תוצאות הטיפול יותר מהשיטה עצמה. כלומר השאלה
                הראשונה היא לא &quot;איזו שיטה הכי טובה&quot; אלא &quot;מי מתאים לי&quot;.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-extrabold" style={{ color: "var(--teal-dark)" }}>
                לא כל מטפל מתאים לכל קושי
              </h3>
              <p className="mt-2 leading-8" style={{ color: "var(--text-2)" }}>
                מטפל מצוין בחרדה הוא לא בהכרח המטפל הנכון לקושי בזוגיות או לטראומה. ההכשרה
                הספציפית בקושי שלכם משנה, וזו אחת הסיבות שרשימה לפי סדר אלפביתי או לפי מיקום
                בלבד לא באמת עוזרת לבחור.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-extrabold" style={{ color: "var(--teal-dark)" }}>
                מותר להחליף, וזה לא כישלון
              </h3>
              <p className="mt-2 leading-8" style={{ color: "var(--text-2)" }}>
                אם אחרי כמה פגישות לא נוצר חיבור, זה מידע ולא כישלון. אפשר לומר את זה למטפל,
                ואפשר לחפש מישהו אחר. התאמה טובה מראש פשוט מקצרת את הדרך.
              </p>
            </div>
          </div>

          <p className="mt-8">
            <Link href="/research/choosing-therapist" className="font-bold" style={{ color: "var(--teal-dark)" }}>
              המדריך המלא לבחירת מטפל/ת ←
            </Link>
          </p>
        </div>
      </section>

      {/* ── שכבה 4: שלוש ההתלבטויות ───────────────────────────────────
          עלות, חשיפה והתחייבות הן בדיוק שלוש השאלות שעוצרות אנשים כאן,
          והשאלון לא מבקש אף אחת מהן. אמירה מפורשת עדיפה על הנחה. */}
      <section className="mx-auto max-w-3xl px-5 py-12">
        <h2 className="text-xl font-black" style={{ color: "var(--text)" }}>
          שאלות שנשאלות כאן הרבה
        </h2>
        <dl className="mt-6 grid gap-6">
          <div>
            <dt className="font-extrabold" style={{ color: "var(--text)" }}>
              כמה זה עולה?
            </dt>
            <dd className="mt-1.5 leading-7" style={{ color: "var(--text-2)" }}>
              השאלון וההתאמה בחינם. את מחיר הטיפול עצמו קובע/ת המטפל/ת, ואתם סוגרים ישירות מולו.
            </dd>
          </div>
          <div>
            <dt className="font-extrabold" style={{ color: "var(--text)" }}>
              מה קורה עם מה שאני כותב?
            </dt>
            <dd className="mt-1.5 leading-7" style={{ color: "var(--text-2)" }}>
              השאלון אנונימי. אין צורך בשם או בפרטים מזהים, ותשובותיכם לא מועברות לאיש.
            </dd>
          </div>
          <div>
            <dt className="font-extrabold" style={{ color: "var(--text)" }}>
              אני מתחייב למשהו?
            </dt>
            <dd className="mt-1.5 leading-7" style={{ color: "var(--text-2)" }}>
              לא. בסוף השאלון תקבלו המלצה ורשימת מטפלים מתאימים. אם תרצו, תפנו. אם לא, לא.
            </dd>
          </div>
        </dl>

        <div className="mt-10">
          <QuizCta body="שאלון קצר, ובסופו התאמה אישית. בחינם, אנונימי, וללא התחייבות." />
        </div>
      </section>
    </main>
  );
}
