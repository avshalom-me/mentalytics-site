import Link from "next/link";
import type { Metadata } from "next";
import ArticleShell from "@/app/components/ArticleShell";

export const metadata: Metadata = {
  title: "אבחון אוטיזם (ASD) - איך מתבצע אבחון תקשורת, למי ומתי לפנות",
  description: "מהו אבחון אוטיזם (אבחון תקשורת ASD), כיצד הוא מתבצע, אילו כלים מקצועיים כלולים בו ומתי מומלץ לפנות - מדריך להורים ולמבוגרים על הרצף.",
  keywords: [
    "אבחון תקשורת", "אבחון אוטיזם", "ASD", "ADOS", "ADI-R",
    "רצף האוטיזם", "קשיים חברתיים", "פסיכולוג קליני", "אבחון ילדים",
  ],
  openGraph: {
    title: "אבחון אוטיזם (ASD) - איך מתבצע אבחון תקשורת, למי ומתי לפנות",
    description: "מהו אבחון תקשורת, כיצד הוא מתבצע ומדוע אבחון כפול ומקצועי הוא קריטי - מאמר מקצועי של גונן שש, פסיכולוג קליני מומחה.",
    locale: "he_IL",
    type: "article",
    siteName: "טיפול חכם",
    images: [
      {
        url: "https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=1200&h=630&fit=crop&auto=format&q=80",
        width: 1200,
        height: 630,
        alt: "אבחון תקשורת ואוטיזם - ילד בהערכה מקצועית",
      },
    ],
  },
  alternates: {
    canonical: "https://www.mentalytics.co.il/research/autism-assessment",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "מהו אבחון אוטיזם ותקשורת (ASD), כיצד הוא מתבצע ומדוע הוא מפתח לשינוי?",
  "description": "מהו אבחון תקשורת (ASD), כיצד הוא מתבצע, מה הכלים המקצועיים שבו ומתי מומלץ לפנות - מדריך מקיף להורים ולמבוגרים.",
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
  "url": "https://www.mentalytics.co.il/research/autism-assessment",
  "image": "https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=1200&h=630&fit=crop&auto=format&q=80",
  "keywords": "אבחון תקשורת, אוטיזם, ASD, ADOS, ADI-R, רצף האוטיזם, פסיכולוג קליני",
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
    { "@type": "ListItem", "position": 3, "name": "אבחון תקשורת ואוטיזם", "item": "https://www.mentalytics.co.il/research/autism-assessment" },
  ],
};


// Questions the page answers in its own body, nothing invented: an assistant
// quoting this page should be quoting what a reader sees. CTA headings that end
// in a question mark ("מחפשים מאבחן?") are deliberately excluded - they are not
// informational Q&A and Google's guidelines exclude them.
const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "מהו אבחון אוטיזם (אבחון תקשורת)?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "אבחון תקשורת נועד לבחון לעומק האם אדם נמצא על רצף האוטיזם. מטרתו אינה רק אבחנה רשמית אלא מיפוי מדויק של מאפייני התקשורת הייחודיים, הבנת האופן שבו האדם חווה את העולם, והמלצות טיפוליות ממוקדות. האבחון בוחן אינטראקציה חברתית-רגשית, תקשורת מילולית ולא מילולית, ודפוסי התנהגות ותחומי עניין."
        }
      },
      {
        "@type": "Question",
        "name": "כיצד מתבצע אבחון אוטיזם בישראל?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "האבחון מבוסס על אבחון כפול ומקביל: שתי הערכות עצמאיות ונפרדות על ידי שני אנשי מקצוע מתחומים שונים. הערכה רפואית מבוצעת על ידי פסיכיאטר או נוירולוג ילדים או רופא ילדים מומחה בהתפתחות הילד, והערכה פסיכולוגית על ידי פסיכולוג מוסמך. הסטנדרט הזה נדרש כדי שהממצאים יוכרו על ידי ביטוח לאומי, החינוך והרווחה."
        }
      },
      {
        "@type": "Question",
        "name": "מתי מומלץ לפנות לאבחון אוטיזם?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "בגיל הרך, כשמזהים עיכוב בשפה, חוסר תגובה לקריאת השם, היעדר קשר עין או קושי במשחק משותף. בגיל בית הספר, כשיש קושי להשתלב חברתית, להבין קודים חברתיים, או התנהגויות נוקשות ותחומי עניין מצומצמים. בגיל ההתבגרות והבגרות, כשאדם חש שונות עמוקה, קושי חברתי מתמשך או תשישות מניסיונות מתמידים להסוות (Masking)."
        }
      }
    ]
  };

export default function AutismAssessmentPage() {
  return (
    <ArticleShell
      href="/research/autism-assessment"
      title="אבחון אוטיזם ותקשורת"
      sectionSlug="אבחונים-והערכות"
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd).replace(/</g, "\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      {/* Header */}
      <div className="mb-10">
        <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--teal)", textTransform: "uppercase", letterSpacing: ".14em", marginBottom: "10px" }}>
          מידע מקצועי · אבחון תקשורת
        </p>
        <h1 style={{ fontSize: "clamp(1.8rem,4vw,2.4rem)", fontWeight: 900, color: "var(--text)", lineHeight: 1.25, letterSpacing: "-.02em", marginBottom: "16px" }}>
          מהו אבחון אוטיזם ותקשורת (ASD), כיצד הוא מתבצע ומדוע הוא מפתח לשינוי?
        </h1>
        <p style={{ fontSize: "15px", color: "var(--text-2)", lineHeight: 1.8 }}>
          כשעולה חשד לקושי חברתי, תקשורתי או התנהגותי - אבחון תקשורת מקצועי הוא הכלי היסודי ביותר להבנת המצב ולהתאמת המענה הנכון.
        </p>
      </div>

      {/* Hero image */}
      <div style={{ borderRadius: "16px", overflow: "hidden", marginBottom: "40px", height: "280px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=900&h=560&fit=crop&auto=format&q=75"
          alt="אבחון תקשורת ואוטיזם - הערכה מקצועית"
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 35%" }}
        />
      </div>

      {/* Article body */}
      <article className="space-y-10 text-stone-700 leading-8 text-base">

        <section>
          <p>
            תקשורת אנושית היא רשת מורכבת של מילים, מבטים, מחוות גוף והבנת קודים חברתיים לא כתובים. עבור רובנו, הניווט ברשת הזו קורה באופן אוטומטי, אך עבור אנשים על רצף האוטיזם (ASD), חוויית התקשורת והאינטראקציה החברתית פועלת בצורה שונה לחלוטין. כאשר עולה חשד לקושי חברתי, תקשורתי או התנהגותי - בין אם אצל פעוטות, ילדים או מבוגרים - הכלי המקצועי והיסודי ביותר להבנת המצב הוא <strong>אבחון תקשורת</strong>.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text)", marginBottom: "14px", borderBottom: "2px solid var(--teal-mid)", paddingBottom: "8px" }}>
            מהו בעצם אבחון תקשורת?
          </h2>
          <p>
            אבחון תקשורת נועד לבחון לעומק האם אדם נמצא על רצף האוטיזם. מטרת התהליך אינה רק לתת אבחנה רשמית, אלא למפות במדויק את מאפייני התקשורת הייחודיים של האדם, להבין את האופן שבו הוא חווה את העולם, ולספק המלצות טיפוליות ממוקדות שיאפשרו לו ולמשפחתו להתקדם, לגשר על פערים ולמצות את הפוטנציאל האישי שלו.
          </p>
          <p className="mt-4">האבחון בוחן מספר תחומים מרכזיים:</p>
          <ul className="space-y-3 mt-3">
            <li>
              <strong>(א) אינטראקציה חברתית-רגשית</strong> - היכולת ליצור ולשמר קשרים, הדדיות בשיחה, ושיתוף בחוויות וברגשות.
            </li>
            <li>
              <strong>(ב) תקשורת לא-מילולית</strong> - שימוש במבט עיניים, מחוות גוף (ג&rsquo;סטות), הבעות פנים והבנת סיטואציות חברתיות.
            </li>
            <li>
              <strong>(ג) דפוסי התנהגות ותחומי עניין</strong> - נטייה לחזרתיות, קושי בגמישות ובמעברים, רגישות ייחודית לעוררות חושית, וכן קיומם של תחומי עניין ייחודיים ואינטנסיביים.
            </li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text)", marginBottom: "14px", borderBottom: "2px solid var(--teal-mid)", paddingBottom: "8px" }}>
            כיצד האבחון מתבצע?
          </h2>
          <p>
            כדי להבטיח את הדיוק המרבי ואת ההכרה הרשמית של מוסדות המדינה בממצאים (לצורך קבלת זכויות ומענים בביטוח לאומי, בחינוך וברווחה), האבחון מבוסס על סטנדרט מקצועי קפדני המורכב מכמה חלקים:
          </p>
          <ol className="space-y-3 mt-4 list-decimal list-inside">
            <li>
              <strong>אבחון כפול ומקביל</strong> - האבחון חייב לכלול שתי הערכות עצמאיות ונפרדות שנעשות על ידי שני אנשי מקצוע מתחומים שונים.
            </li>
            <li>
              <strong>הערכה רפואית</strong> - מבוצעת על ידי רופא מומחה: פסיכיאטר (בילדים או מבוגרים) או נוירולוג ילדים / רופא ילדים מומחה בהתפתחות הילד.
            </li>
            <li>
              <strong>הערכה פסיכולוגית</strong> - מבוצעת על ידי פסיכולוג מומחה (קליני, התפתחותי או חינוכי).
            </li>
          </ol>
        </section>

        <section>
          <h2 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text)", marginBottom: "14px", borderBottom: "2px solid var(--teal-mid)", paddingBottom: "8px" }}>
            הערכה תקשורתית, קוגניטיבית ותפקודית
          </h2>
          <p>
            האבחון אינו מתמקד רק בהיבטים החברתיים, אלא כולל גם הערכה קוגניטיבית והערכה תפקודית. חלק זה כולל מבחני אינטליגנציה או הערכות התפתחותיות, לצד שאלוני תפקוד והסתגלות. כלי הערכה אלו בוחנים את מידת העצמאות והתפקוד של האדם בחיי היום-יום, והם חיוניים כדי להבין את רמת התפקוד הכללית, את כוחות החשיבה שלו, ואת מידת התמיכה והליווי שהוא זקוק להם.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text)", marginBottom: "14px", borderBottom: "2px solid var(--teal-mid)", paddingBottom: "8px" }}>
            כלי הערכה בינלאומיים מתוקפים
          </h2>
          <p>
            כדי לתקף את הממצאים, נעשה שימוש בכלים מדעיים מובנים הנחשבים לסטנדרט המוביל בעולם:
          </p>
          <ul className="space-y-3 mt-4">
            <li>
              <strong>ADOS (Autism Diagnostic Observation Schedule)</strong> - תצפית ישירה ומובנית של המאבחן על האינטראקציה והתקשורת של המטופל בזמן אמת באמצעות משחק או שיחה.
            </li>
            <li>
              <strong>ADI-R (Autism Diagnostic Interview-Revised)</strong> - ראיון עומק מפורט והיסטורי שנערך עם ההורים לגבי התפתחות הילד מגיל צעיר.
            </li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text)", marginBottom: "14px", borderBottom: "2px solid var(--teal-mid)", paddingBottom: "8px" }}>
            הסתכלות על האדם כמכלול - ואבחנות נוספות
          </h2>
          <p>
            אבחון מקצועי אינו עונה רק על השאלה הצרה &ldquo;ספקטרום - כן או לא?&rdquo;. המאבחנים מסתכלים על האדם כמכלול שלם ומורכב, ומנסים להבין אילו גורמים נוספים משפיעים על רווחתו הנפשית ותפקודו. התהליך כולל התייחסות, ובמידת הצורך גם אבחנה מבדלת או אבחנה נלווית (קו-מורבידיות), של מצבים כמו הפרעות קשב וריכוז (ADHD), הפרעות חרדה, קשיים בלמידה או קשיים רגשיים אחרים - כדי לספק תמונה מלאה ואינטגרטיבית.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text)", marginBottom: "14px", borderBottom: "2px solid var(--teal-mid)", paddingBottom: "8px" }}>
            מתי מומלץ לפנות לאבחון?
          </h2>
          <ul className="space-y-4 mt-2">
            <li>
              <strong>בגיל הרך</strong> - כאשר מזהים עיכוב בשפה, חוסר תגובה לקריאת השם, היעדר קשר עין, קושי במשחק משותף או נטייה להתבודדות.
            </li>
            <li>
              <strong>בגילאי בית הספר</strong> - כאשר הילד מתקשה להשתלב חברתית, מתקשה להבין קודים חברתיים או מציג התנהגויות נוקשות ותחומי עניין מצומצמים מאוד.
            </li>
            <li>
              <strong>בגיל ההתבגרות והבגרות</strong> - כאשר אדם חש לאורך חייו תחושת שונות עמוקה, קושי חברתי מתמשך או תשישות נפשית מניסיונות בלתי פוסקים &ldquo;להסוות&rdquo; ולהתאים את עצמו לחברה (Masking).
            </li>
          </ul>
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
