import Link from "next/link";
import type { Metadata } from "next";
import ArticleShell from "@/app/components/ArticleShell";

export const metadata: Metadata = {
  title: "אבחון פסיכודיאגנוסטי - לראות את התמונה המלאה",
  description: "מהו אבחון פסיכודיאגנוסטי, מה הוא כולל, מתי כדאי לפנות אליו - ואיך הוא יכול להיות המפתח לשינוי אמיתי.",
  keywords: [
    "אבחון פסיכודיאגנוסטי", "אבחון פסיכולוגי", "פסיכולוג קליני", "מבחן רורשאך",
    "אבחון נפשי", "מבנה אישיות", "תוכנית טיפולית", "אבחון מעמיק",
  ],
  openGraph: {
    title: "אבחון פסיכודיאגנוסטי - לראות את התמונה המלאה",
    description: "מהו האבחון הפסיכולוגי המעמיק ביותר, מה הוא כולל ומתי הוא חיוני - מאמר מקצועי של גונן שש, פסיכולוג קליני מומחה.",
    locale: "he_IL",
    type: "article",
    siteName: "טיפול חכם",
    images: [
      {
        url: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1200&h=630&fit=crop&auto=format&q=80",
        width: 1200,
        height: 630,
        alt: "אבחון פסיכודיאגנוסטי - הערכה פסיכולוגית מעמיקה",
      },
    ],
  },
  alternates: {
    canonical: "https://www.mentalytics.co.il/research/psychodiagnostic",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "לראות את התמונה המלאה: מהו אבחון פסיכודיאגנוסטי ומתי הוא המפתח לשינוי?",
  "description": "מהו אבחון פסיכודיאגנוסטי, מה הוא כולל, מתי כדאי לפנות אליו ואיך הוא יכול להיות המפתח לשינוי אמיתי.",
  "inLanguage": "he",
  "datePublished": "2026-06-14",
  "dateModified": "2026-06-14",
  "author": {
    "@type": "Person",
    "name": "גונן שש",
    "jobTitle": "פסיכולוג קליני מומחה",
  },
  "publisher": {
    "@type": "Organization",
    "name": "טיפול חכם",
    "url": "https://www.mentalytics.co.il",
  },
  "url": "https://www.mentalytics.co.il/research/psychodiagnostic",
  "image": "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1200&h=630&fit=crop&auto=format&q=80",
  "keywords": "אבחון פסיכודיאגנוסטי, אבחון פסיכולוגי, פסיכולוג קליני, מבנה אישיות",
  "articleSection": "מידע מקצועי",
  "isPartOf": {
    "@type": "WebSite",
    "name": "טיפול חכם",
    "url": "https://www.mentalytics.co.il",
  },
};

const breadcrumbLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "בית", "item": "https://www.mentalytics.co.il" },
    { "@type": "ListItem", "position": 2, "name": "מאמרים ומידע שימושי", "item": "https://www.mentalytics.co.il/research" },
    { "@type": "ListItem", "position": 3, "name": "אבחון פסיכודיאגנוסטי", "item": "https://www.mentalytics.co.il/research/psychodiagnostic" },
  ],
};

export default function PsychodiagnosticPage() {
  return (
    <ArticleShell
      href="/research/psychodiagnostic"
      title="אבחון פסיכודיאגנוסטי"
      sectionSlug="אבחונים-והערכות"
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      {/* Header */}
      <div className="mb-10">
        <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--teal)", textTransform: "uppercase", letterSpacing: ".14em", marginBottom: "10px" }}>
          מידע מקצועי · אבחון פסיכולוגי
        </p>
        <h1 style={{ fontSize: "clamp(1.8rem,4vw,2.4rem)", fontWeight: 900, color: "var(--text)", lineHeight: 1.25, letterSpacing: "-.02em", marginBottom: "16px" }}>
          לראות את התמונה המלאה: מהו אבחון פסיכודיאגנוסטי ומתי הוא המפתח לשינוי?
        </h1>
        <p style={{ fontSize: "15px", color: "var(--text-2)", lineHeight: 1.8 }}>
          כשטיפול שיחתי מרגיש כאילו הוא &ldquo;מדשדש במקום&rdquo; - לעיתים מה שחסר הוא מפה מדויקת של האישיות. זה בדיוק מה שאבחון פסיכודיאגנוסטי מספק.
        </p>
      </div>

      {/* Hero image */}
      <div style={{ borderRadius: "16px", overflow: "hidden", marginBottom: "40px", height: "280px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=900&h=560&fit=crop&auto=format&q=75"
          alt="אבחון פסיכודיאגנוסטי - הערכה פסיכולוגית מעמיקה"
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 40%" }}
        />
      </div>

      {/* Article body */}
      <article className="space-y-10 text-stone-700 leading-8 text-base">

        <section>
          <p>
            כשאנחנו מתמודדים עם כאב פיזי מתמשך או מעורפל, הצעד הטבעי הראשון הוא לפנות לרופא ולבקש בדיקת עומק - בדיקת דם, צילום או הדמיה. אנחנו רוצים לדעת בדיוק מה המקור לבעיה לפני שאנחנו מתחילים בטיפול. בעולם בריאות הנפש, ה&ldquo;צילום&rdquo; המעמיק והמדויק ביותר נקרא <strong>אבחון פסיכודיאגנוסטי</strong>.
          </p>
          <p className="mt-4">
            פניות רבות לטיפול נפשי מתחילות בתחושה כללית של מועקה, תקיעות, חרדה או קשיים במערכות יחסים. לפעמים, טיפול שיחתי רגיל מרגיש כאילו הוא &ldquo;מדשדש במקום&rdquo; מבלי להגיע לשורש העניין. כאן נכנס לתמונה האבחון הפסיכודיאגנוסטי.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text)", marginBottom: "14px", borderBottom: "2px solid var(--teal-mid)", paddingBottom: "8px" }}>
            מהו בעצם אבחון פסיכודיאגנוסטי?
          </h2>
          <p>
            אבחון פסיכודיאגנוסטי הוא הערכה פסיכולוגית מקיפה ומעמיקה המבוצעת לרוב על ידי פסיכולוגים קליניים שהוסמכו לכך, ושעברו הכשרה מקיפה של כ-10 שנים של לימודים והתמחות. מטרת האבחון היא לא להדביק &ldquo;תווית&rdquo; או אבחנה רשמית (כמו דיכאון, הפרעת אישיות או חרדה), אלא לשרטט מפה מפורטת של מבנה האישיות של האדם - ומתוכה, להתוות ערוצי פעולה ממוקדים ותוכנית טיפולית מותאמת אישית שתאפשר לו לפרוץ דרך ולהתקדם בחייו.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text)", marginBottom: "14px", borderBottom: "2px solid var(--teal-mid)", paddingBottom: "8px" }}>
            האבחון בוחן מספר צירים במקביל
          </h2>
          <ul className="space-y-4 mt-2">
            <li className="flex gap-3">
              <span style={{ color: "var(--teal)", fontWeight: 700, flexShrink: 0 }}>הציר הרגשי והאישיותי</span>
              <span>כיצד האדם מתמודד עם מתחים? מהם מנגנוני ההגנה שלו? איך הוא חווה את עצמו ואת הזולת?</span>
            </li>
            <li className="flex gap-3">
              <span style={{ color: "var(--teal)", fontWeight: 700, flexShrink: 0 }}>הציר הקוגניטיבי</span>
              <span>מהם כוחות החשיבה שלו? כיצד הוא מעבד מידע ותופס את המציאות סביבו?</span>
            </li>
            <li className="flex gap-3">
              <span style={{ color: "var(--teal)", fontWeight: 700, flexShrink: 0 }}>הציר התפקודי</span>
              <span>באילו תחומים יש לו נקודות חוזק בולטות (משאבים נפשיים), ובאילו תחומים קיימת פגיעות או רגישות גבוהה?</span>
            </li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text)", marginBottom: "14px", borderBottom: "2px solid var(--teal-mid)", paddingBottom: "8px" }}>
            איך זה עובד בפועל?
          </h2>
          <p>
            האבחון אינו מסתכם בשיחה אחת, אלא מורכב מסדרה של פגישות (לרוב בין 2 ל-4 מפגשים) הכוללות:
          </p>
          <ul className="space-y-3 mt-4">
            <li><strong>ראיון קליני מעמיק</strong> - היכרות עם היסטוריית החיים של המטופל, סיבת הפנייה והקשיים הנוכחיים.</li>
            <li><strong>מבחנים אובייקטיביים ומבחני ביצוע</strong> - שימוש בכלים מדעיים מובנים כמו מבחני אינטליגנציה, זיכרון ושאלונים עצמיים.</li>
            <li><strong>מבחנים השלכתיים</strong> - מבחנים המאפשרים הצצה אל תכנים לא מודעים, כמו מבחן רורשאך (&ldquo;כתמי הדיו&rdquo;) או מבחני ציורים וסיפורים.</li>
          </ul>
          <p className="mt-4">
            בסיום התהליך, הפסיכולוג מנתח את כל הממצאים, מחבר ביניהם ומפיק דו&rdquo;ח אבחוני מפורט. הדו&rdquo;ח כולל הבנה מעמיקה של אופי האישיות והקושי של המאובחן, וכן כולל המלצות מעשיות להמשך טיפול - למשל: סוג הטיפול המומלץ, מידת הדחיפות, או הצורך בשילוב טיפול תרופתי.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text)", marginBottom: "14px", borderBottom: "2px solid var(--teal-mid)", paddingBottom: "8px" }}>
            מתי כדאי לפנות לאבחון פסיכודיאגנוסטי?
          </h2>
          <ul className="space-y-4 mt-2">
            <li>
              <strong>כשיש &ldquo;ערפל טיפולי&rdquo;</strong> - כאשר המטופל נמצא בטיפול זמן רב אך אין שיפור במצבו, והמטפל או המטופל חשים שמשהו חסר.
            </li>
            <li>
              <strong>לצורך אבחנה מבדלת</strong> - כאשר קשה להבחין בין מצבים נפשיים דומים (למשל, האם מדובר בהפרעת קשב וריכוז קשה או בכלל בחרדה שמסווה את עצמה?).
            </li>
            <li>
              <strong>לקראת צמתים משמעותיים</strong> - ועדות רפואיות, קביעת אחוזי נכות, התאמות למסגרות תעסוקתיות או צבאיות, או חוות דעת משפטיות.
            </li>
            <li>
              <strong>לילדים ונוער</strong> - לעיתים קרובות משתמשים באבחון זה עבור ועדות והתאמה לפנימיות טיפוליות.
            </li>
          </ul>
        </section>

        <section>
          <p>
            אבחון פסיכודיאגנוסטי טוב אינו רק מגדיר את הקושי - הוא מאיר את הכוחות של המטופל ומראה לו, ולמטפלים שלו, את הדרך המדויקת ביותר לצמיחה. אבחון מעמיק וטוב שמתאים לצרכי המאובחן הינו קריטי ליעילות הטיפול. לעיתים קרובות אנשים לא יודעים איזה סוג אבחון צריך לעבור, וכדאי לעשות בירור מסודר לגבי האבחון המתאים.
          </p>
        </section>

        {/* Author */}
        <div style={{
          borderTop: "1px solid var(--line)", paddingTop: "28px", marginTop: "8px",
          display: "flex", alignItems: "center", gap: "14px",
        }}>
          <div style={{
            width: "44px", height: "44px", borderRadius: "50%",
            background: "var(--teal-pale)", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "18px", flexShrink: 0,
          }}>👤</div>
          <div>
            <p style={{ fontWeight: 700, color: "var(--text)", fontSize: "14px" }}>גונן שש</p>
            <p style={{ fontSize: "13px", color: "var(--muted)" }}>פסיכולוג קליני מומחה · מ.ר. 27-148029</p>
          </div>
        </div>

        {/* Back link */}
        <div style={{ paddingTop: "8px" }}>
          <Link href="/research/assessments" style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            fontSize: "13px", color: "var(--teal)", fontWeight: 600,
          }}>
            ← ראו גם: סוגי אבחונים והערכות - השוואה מקיפה
          </Link>
        </div>

      </article>
    </ArticleShell>
  );
}
