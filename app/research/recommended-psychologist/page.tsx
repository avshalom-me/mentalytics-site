import Link from "next/link";
import type { Metadata } from "next";
import QuizCtaBanner from "../QuizCtaBanner";
import { siteAuthorRef, SITE_AUTHOR_PATH } from "@/app/lib/author";
import ArticleShell from "@/app/components/ArticleShell";

const URL = "https://www.mentalytics.co.il/research/recommended-psychologist";

export const metadata: Metadata = {
  title: "פסיכולוג מומלץ - איך למצוא פסיכולוג טוב שמתאים לכם",
  description:
    "מה זה בעצם 'פסיכולוג מומלץ', ולמה רשימת המלצות גנרית לא מספיקה. איך למצוא פסיכולוג שמתאים דווקא לכם לפי התמחות, גישה, מיקום ועלות, ומה לשאול בשיחת ההיכרות.",
  keywords: [
    "פסיכולוג מומלץ",
    "איך למצוא פסיכולוג טוב",
    "פסיכולוג טוב",
    "המלצה על פסיכולוג",
    "פסיכולוג קליני מומלץ",
    "איך מוצאים פסיכולוג",
    "פסיכולוג מומלץ באזור",
    "בחירת פסיכולוג",
  ],
  alternates: { canonical: URL },
  openGraph: {
    title: "פסיכולוג מומלץ - איך למצוא פסיכולוג טוב שמתאים לכם",
    description:
      "למה 'המלצה על פסיכולוג' היא עניין אישי, ואיך למצוא פסיכולוג טוב שמתאים דווקא לקושי, לאופי ולנסיבות שלכם.",
    locale: "he_IL",
    type: "article",
    siteName: "טיפול חכם",
    url: URL,
    images: [{ url: "https://www.mentalytics.co.il/logo.svg.png", alt: "טיפול חכם" }],
  },
};

const FAQS = [
  {
    q: "מה זה בעצם 'פסיכולוג מומלץ'?",
    a: "אין דירוג רשמי אחד של פסיכולוגים בישראל. 'מומלץ' הוא כמעט תמיד יחסי - מומלץ על ידי מי, ולאיזה צורך. פסיכולוג שהיה מצוין עבור חבר שלכם עם חרדה לא בהכרח מתאים לקושי זוגי או לטיפול בילד. חשוב יותר לחפש פסיכולוג טוב *עבורכם*: מוסמך, מנוסה בקושי הספציפי שלכם, ושאיתו אתם מרגישים בטוחים.",
  },
  {
    q: "איך יודעים שפסיכולוג הוא טוב?",
    a: "שלושה סימנים מרכזיים: (1) רישיון והכשרה מוכרים - אפשר לבדוק ברשם הפסיכולוגים של משרד הבריאות; (2) התמחות שתואמת את הקושי שלכם; (3) תחושה, כבר בפגישות הראשונות, שהוא מקשיב יותר ממה שהוא מדבר ושבטוח לחשוף מולו דברים קשים. מטפל מקצועי גם לא נעלב משאלות על ההכשרה והגישה שלו.",
  },
  {
    q: "עדיף פסיכולוג פרטי או דרך קופת חולים?",
    a: "לשניהם יתרונות. דרך קופת חולים הטיפול זול משמעותית, אך לרוב עם מספר פגישות מוגבל, רשימת מטפלים מוגדרת ולעיתים המתנה. פרטי מאפשר בחירה חופשית של המטפל וזמינות מהירה יותר, בעלות גבוהה יותר. ההחלטה תלויה בדחיפות, בתקציב ובחשיבות שאתם נותנים לבחירה האישית של המטפל.",
  },
  {
    q: "כמה עולה פסיכולוג פרטי בישראל?",
    a: "פגישה פרטית נעה בדרך כלל בין 250 ל-600 ₪, כשפסיכולוגים קליניים ותיקים נוטים לגבות יותר. חלק מהמטפלים עובדים עם ביטוחים משלימים או מציעים מחיר מותאם. כדאי לברר את העלות ואת מדיניות הביטולים כבר בשיחת ההיכרות.",
  },
  {
    q: "איך אני מוצא פסיכולוג מומלץ באזור שלי?",
    a: "אפשר להתחיל מהמלצה של רופא המשפחה או מכרים, אבל היתרון של חיפוש מובנה הוא שהוא מצמצם לפי מה שחשוב לכם - הקושי, האזור או אונליין, סוג הטיפול והתקציב - ומגיע למספר קטן של מטפלים מתאימים במקום רשימה אינסופית. השאלון של טיפול חכם עושה בדיוק את זה.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "פסיכולוג מומלץ - איך למצוא פסיכולוג טוב שמתאים לכם",
  description:
    "מה זה 'פסיכולוג מומלץ', למה רשימת המלצות גנרית לא מספיקה, ואיך למצוא פסיכולוג טוב שמתאים דווקא לכם.",
  inLanguage: "he",
  datePublished: "2026-07-08",
  dateModified: "2026-07-08",
  author: siteAuthorRef(),
  publisher: { "@type": "Organization", name: "טיפול חכם", url: "https://www.mentalytics.co.il" },
  url: URL,
  articleSection: "מידע מקצועי",
};

const breadcrumbLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "בית", item: "https://www.mentalytics.co.il" },
    { "@type": "ListItem", position: 2, name: "מאמרים ומידע שימושי", item: "https://www.mentalytics.co.il/research" },
    { "@type": "ListItem", position: 3, name: "פסיכולוג מומלץ", item: URL },
  ],
};

const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

const H2 = {
  fontSize: "20px",
  fontWeight: 800,
  color: "var(--text)",
  marginBottom: "14px",
  borderBottom: "2px solid var(--teal-mid)",
  paddingBottom: "8px",
} as const;

const listStyle = { listStyle: "disc", paddingInlineStart: "22px" } as const;

export default function RecommendedPsychologistPage() {
  return (
    <ArticleShell
      href="/research/recommended-psychologist"
      title="פסיכולוג מומלץ"
      sectionSlug="בחירת-טיפול-ומטפל"
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />

      <div className="mb-10">
        <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--teal)", textTransform: "uppercase", letterSpacing: ".14em", marginBottom: "10px" }}>
          מידע מקצועי · בחירת פסיכולוג
        </p>
        <h1 style={{ fontSize: "clamp(1.7rem,4vw,2.3rem)", fontWeight: 900, color: "var(--text)", lineHeight: 1.3, letterSpacing: "-.02em", marginBottom: "16px" }}>
          פסיכולוג מומלץ - איך למצוא פסיכולוג טוב שמתאים דווקא לכם
        </h1>
        <p style={{ fontSize: "15px", color: "var(--text-2)", lineHeight: 1.8 }}>
          {`אחד החיפושים הנפוצים ביותר הוא "פסיכולוג מומלץ" או "איך למצוא פסיכולוג טוב". זו שאלה חשובה, אבל התשובה הכנה היא שאין רשימת "מומלצים" אחת שמתאימה לכולם - כי המלצה טובה היא תמיד אישית. במדריך הזה נסביר מה באמת הופך פסיכולוג ל"טוב" עבורכם, למה כדאי להיזהר מרשימות המלצות גנריות, ואיך להגיע במהירות למטפל שמתאים לקושי, לאופי ולנסיבות שלכם.`}
        </p>
      </div>

      <article className="space-y-10 text-stone-700 leading-8 text-base">

        <section>
          <h2 style={H2}>{`"מומלץ" - על ידי מי, ולאיזה צורך?`}</h2>
          <p>
            {`בישראל אין דירוג רשמי או "כוכבים" שמסמנים פסיכולוג כמומלץ. כשמישהו אומר "יש לי פסיכולוג מומלץ", הוא בעצם אומר "פסיכולוג שעזר לי, עבור הקושי שלי, באותה תקופה בחיי". זה מידע בעל ערך - אבל הוא לא בהכרח מנבא שאותו מטפל יתאים גם לכם. פסיכולוג מצוין לטיפול בחרדה אצל מבוגר לא בהכרח המתאים ביותר לטיפול זוגי, לילד עם קשיי קשב, או להתמודדות עם טראומה.`}
          </p>
          <p className="mt-4">
            {`המסקנה המעשית: במקום לחפש את "הפסיכולוג המומלץ ביותר", עדיף לחפש את הפסיכולוג הטוב ביותר עבורכם. זו לא סמנטיקה - זה ההבדל בין רשימה אקראית לבין התאמה שבאמת עוזרת.`}
          </p>
        </section>

        <section>
          <h2 style={H2}>למה רשימת המלצות גנרית עלולה להטעות</h2>
          <p>
            {`רשימות "10 הפסיכולוגים המומלצים" או דירוגים כלליים ברשת נוטים לשקף פופולריות, ותק או קידום - לא בהכרח התאמה לצורך הספציפי שלכם. הם גם כמעט אף פעם לא לוקחים בחשבון את שלושת הדברים שהכי משפיעים על הצלחת הטיפול: סוג הקושי שלכם, הגישה הטיפולית שמתאימה לאופי שלכם, והכימיה האישית עם המטפל.`}
          </p>
          <p className="mt-4">
            {`חשוב גם לזכור שהמלצות ברשת מתיישנות. חלק מהשמות שממשיכים להופיע כ"מומלצים" שייכים למטפלים או לשירותים שכבר לא פעילים. לכן עדיף להסתמך על קריטריונים ברורים ועל התרשמות אישית מהמפגש - ולא רק על שם שחוזר.`}
          </p>
        </section>

        <QuizCtaBanner heading="מחפשים פסיכולוג מומלץ ולא יודעים מאיפה להתחיל?" />

        <section>
          <h2 style={H2}>מה באמת הופך פסיכולוג ל"טוב" עבורכם</h2>
          <p className="mb-4">
            {`במקום "מומלץ", בדקו את חמשת הפרמטרים שמנבאים התאמה טובה:`}
          </p>
          <ul style={listStyle} className="space-y-2">
            <li>{`רישיון והכשרה - פסיכולוג מוסמך, רשום ברשם הפסיכולוגים של משרד הבריאות. מותר לבקש לראות רישיון.`}</li>
            <li>{`התמחות בקושי שלכם - ניסיון ספציפי בחרדה, דיכאון, טראומה, זוגיות, ילדים ונוער וכו'.`}</li>
            <li>{`גישה טיפולית מתאימה - CBT ממוקד וכלים מעשיים, או גישה דינמית ועמוקה יותר - לפי מה שמתאים לכם.`}</li>
            <li>{`ברית טיפולית - תחושת אמון וביטחון כבר בפגישות הראשונות. זה מהמנבאים החזקים ביותר להצלחת הטיפול.`}</li>
            <li>{`לוגיסטיקה ועלות - מיקום, זמינות ומחיר שאתם יכולים לעמוד בהם לאורך זמן.`}</li>
          </ul>
          <p className="mt-4">
            {`הרחבנו על כל אחד מהקריטריונים האלה, כולל שאלות לשיחת ההיכרות וסימני אזהרה, במדריך `}
            <Link href="/research/choosing-therapist" style={{ color: "var(--teal-dark)", fontWeight: 600 }} className="hover:underline">איך למצוא פסיכולוג שמתאים</Link>
            {`.`}
          </p>
        </section>

        <section>
          <h2 style={H2}>פסיכולוג, פסיכיאטר או מטפל אחר?</h2>
          <p>
            {`לא כל מי שמחפש "פסיכולוג מומלץ" באמת צריך דווקא פסיכולוג. פסיכולוג קליני מתמחה באבחון ובטיפול בשיחות ואינו רושם תרופות; פסיכיאטר הוא רופא שיכול לרשום תרופות; ועובדים סוציאליים קליניים ופסיכותרפיסטים מוסמכים אף הם לטיפול נפשי. לעיתים ההתאמה הנכונה היא דווקא מקצוע אחר, או שילוב של כמה.`}
          </p>
          <p className="mt-4">
            {`הרחבנו על ההבדלים ומתי כדאי כל אחד במאמר `}
            <Link href="/research/therapist-types" style={{ color: "var(--teal-dark)", fontWeight: 600 }} className="hover:underline">סוגי המטפלים בישראל</Link>
            {`.`}
          </p>
        </section>

        <section>
          <h2 style={H2}>איפה מחפשים - ואיך מגיעים להתאמה מהר</h2>
          <p>
            {`המלצה מרופא המשפחה, מחבר או מבן משפחה היא נקודת פתיחה סבירה, אבל היא מוגבלת לניסיון האישי של הממליץ. חיפוש עצמאי במאגרים נותן בחירה רחבה - אבל מציף בעשרות שמות בלי דרך ברורה לדעת מי מתאים לקושי שלכם.`}
          </p>
          <p className="mt-4">
            {`כאן חיפוש מובנה חוסך זמן ובלבול: במקום לנחש מתוך רשימה, מגדירים את סוג הקושי, האזור או העדפה לאונליין, סוג הטיפול והתקציב - ומקבלים מספר מצומצם של מטפלים מתאימים. השאלון של טיפול חכם בנוי בדיוק לשם כך, ומבוסס על התאמה קלינית ולא על פופולריות.`}
          </p>
        </section>

        <section>
          <h2 style={H2}>שאלות נפוצות</h2>
          <div className="space-y-6">
            {FAQS.map((f) => (
              <div key={f.q}>
                <h3 style={{ fontSize: "16px", fontWeight: 800, color: "var(--text)", marginBottom: "6px" }}>{f.q}</h3>
                <p style={{ color: "var(--text-2)" }}>{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 style={H2}>סיכום</h2>
          <p>
            {`"פסיכולוג מומלץ" הוא נקודת פתיחה, לא תשובה. פסיכולוג טוב עבורכם הוא כזה שמשלב רישיון והכשרה, התמחות רלוונטית, גישה שמתאימה לאופי שלכם, ברית טיפולית בטוחה, ולוגיסטיקה בת-קיימא. במקום להסתמך על רשימה גנרית - הגדירו את הצרכים שלכם והגיעו להתאמה אישית.`}
          </p>
        </section>

        <QuizCtaBanner />

      </article>

      <div style={{ marginTop: "52px", borderTop: "1px solid var(--line)", paddingTop: "32px", display: "flex", gap: "18px", alignItems: "flex-start" }}>
        <div style={{
          width: "52px", height: "52px", flexShrink: 0, borderRadius: "50%",
          background: "var(--teal-pale)", border: "2px solid var(--teal-mid)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px",
        }}>
          🧑‍⚕️
        </div>
        <div>
          <p style={{ fontWeight: 800, fontSize: "15px", marginBottom: "4px" }}>
            <Link href={SITE_AUTHOR_PATH} className="hover:underline" style={{ color: "var(--teal-dark)" }}>{`ד"ר אבשלום גליל`}</Link>
          </p>
          <p style={{ fontSize: "13px", color: "var(--teal)", fontWeight: 600, marginBottom: "8px" }}>פסיכולוג קליני וחינוכי מומחה-מדריך</p>
          <p style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.75 }}>
            {`מאמר זה נכתב על ידי ד"ר אבשלום גליל, פסיכולוג קליני וחינוכי מומחה-מדריך, ממייסדי "טיפול חכם".`}
          </p>
        </div>
      </div>

      <div className="mt-10 rounded-2xl border border-[#E8E0D8] bg-[#f8f5f0] p-6">
        <h2 className="mb-4 text-base font-extrabold text-stone-800">קריאה נוספת</h2>
        <ul className="space-y-2 text-sm">
          <li><Link href="/research/choosing-therapist" className="text-[#2e7d8c] hover:underline">← איך למצוא פסיכולוג שמתאים לך - המדריך המלא</Link></li>
          <li><Link href="/research/therapist-types" className="text-[#2e7d8c] hover:underline">← סוגי המטפלים בישראל</Link></li>
          <li><Link href="/research/which-therapy" className="text-[#2e7d8c] hover:underline">← איזה טיפול פסיכולוגי מתאים לי?</Link></li>
          <li><Link href="/research/faq" className="text-[#2e7d8c] hover:underline">← שאלות נפוצות על טיפול נפשי</Link></li>
        </ul>
      </div>
    </ArticleShell>
  );
}
