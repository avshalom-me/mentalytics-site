import Link from "next/link";
import type { Metadata } from "next";
import QuizCtaBanner from "../QuizCtaBanner";
import { siteAuthorRef } from "@/app/lib/author";
import ArticleShell from "@/app/components/ArticleShell";

/**
 * The page that substantiates the claim every landing page makes.
 *
 * ~150 landing pages say "שאלון שנבנה על ידי פסיכולוגים קליניים ומבוסס מחקר",
 * and until now nothing on the site backed it. Repeating that prose on all of
 * them was the alternative and it was rejected deliberately: 25% of a city
 * page's sentences are already shared, and a common block would have pushed
 * that past 40% - the scaled-content pattern CitySeoSection was designed to
 * avoid. One page, linked from many with varying anchors, concentrates the
 * ranking signal instead of diluting it.
 *
 * SOURCING RULE for this file: the mechanism described here is read off the
 * live matcher (app/api/match/route.ts), not from marketing copy. The exact
 * point weights are deliberately NOT published - a therapist who knows
 * "expertise is worth the most" would tick every training area, which is
 * precisely the behaviour that degrades match quality. Ordering only.
 */

const URL = "https://www.mentalytics.co.il/research/how-matching-works";
const TITLE = "איך עובדת ההתאמה בטיפול חכם - המודל שמאחורי השאלון";

export const metadata: Metadata = {
  title: TITLE,
  description:
    "מה עומד מאחורי שאלון ההתאמה: על אילו מקורות המודל נשען, מה השאלון מודד, איך מחושבת ההתאמה בין הצורך שלכם למטפל/ת - ומה המודל לא עושה.",
  keywords: [
    "איך מוצאים פסיכולוג מתאים",
    "התאמה בין מטפל למטופל",
    "שאלון התאמה לטיפול",
    "איך לבחור סוג טיפול",
    "מודל התאמה טיפולית",
  ],
  alternates: { canonical: URL },
  openGraph: {
    title: TITLE,
    description:
      "על מה המודל נשען, מה השאלון מודד, איך מחושבת ההתאמה, ומה המודל לא עושה.",
    locale: "he_IL",
    type: "article",
    siteName: "טיפול חכם",
    url: URL,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: TITLE,
  inLanguage: "he",
  mainEntityOfPage: URL,
  author: siteAuthorRef(),
  publisher: { "@type": "Organization", name: "טיפול חכם", url: "https://www.mentalytics.co.il" },
  description:
    "המודל שמאחורי שאלון ההתאמה של טיפול חכם: מקורות, מה נמדד, איך מחושבת ההתאמה, ומגבלות המודל.",
};

const breadcrumbLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "בית", item: "https://www.mentalytics.co.il" },
    { "@type": "ListItem", position: 2, name: "מאמרים ומידע", item: "https://www.mentalytics.co.il/research" },
    { "@type": "ListItem", position: 3, name: "איך עובדת ההתאמה", item: URL },
  ],
};

const h2 = {
  fontSize: "20px",
  fontWeight: 800,
  color: "var(--text)",
  marginBottom: "12px",
  borderBottom: "2px solid var(--teal-mid)",
  paddingBottom: "8px",
} as const;

export default function HowMatchingWorksPage() {
  return (
    <ArticleShell href="/research/how-matching-works" title="איך עובדת ההתאמה" sectionSlug="בחירת-טיפול-ומטפל">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }} />

      <div className="mb-10">
        <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--teal)", textTransform: "uppercase", letterSpacing: ".14em", marginBottom: "10px" }}>
          מידע מקצועי · השיטה
        </p>
        <h1 style={{ fontSize: "clamp(1.7rem,4vw,2.3rem)", fontWeight: 900, color: "var(--text)", lineHeight: 1.3, letterSpacing: "-.02em", marginBottom: "16px" }}>
          איך עובדת ההתאמה בטיפול חכם
        </h1>
        <p style={{ fontSize: "15px", color: "var(--text-2)", lineHeight: 1.8 }}>
          רוב האנשים בוחרים מטפל בשיטה אחת משתיים: המלצה מחבר, או השם הראשון שעולה בחיפוש. שתיהן לא
          רעות, ושתיהן מתעלמות מהשאלה החשובה באמת - האם המטפל/ת הזה/זו מתאים/ה לקושי הספציפי שלכם
          ולדרך שבה אתם עובדים. העמוד הזה מסביר מה עומד מאחורי ההתאמה שאנחנו מציעים, ובאותה מידה חשוב:
          מה המודל לא עושה.
        </p>
      </div>

      <article className="space-y-10 text-stone-700 leading-8 text-base">
        <section>
          <h2 style={h2}>למה בכלל צריך מודל</h2>
          <p className="mb-3">
            המחקר בפסיכותרפיה עקבי בנקודה אחת: <strong>איכות הקשר בין מטופל למטפל היא מהמנבאים החזקים
            ביותר להצלחת הטיפול</strong>, לעיתים יותר מהשיטה הטיפולית עצמה. אבל &quot;קשר טוב&quot; אינו מקריות
            גרידא. הוא מושפע מדברים שאפשר לזהות מראש: האם המטפל/ת עובד/ת בגישה שמתאימה לאופי הקושי,
            האם יש ניסיון עם הגיל הרלוונטי, והאם סגנון העבודה מתיישב עם מה שאתם מחפשים.
          </p>
          <p>
            הבעיה היא שאדם שמחפש טיפול לרוב לא יודע לתרגם את מה שהוא מרגיש לשאלות האלה. &quot;אני לא מצליח
            להירדם ואני עצבני על כולם&quot; הוא תיאור מדויק של חוויה, אבל הוא לא אומר אם מדובר בחרדה,
            בדיכאון, בקושי קשבי או בתגובה למשבר - ולכל אחד מאלה מתאימות גישות שונות.
          </p>
        </section>

        <section>
          <h2 style={h2}>על מה המודל נשען</h2>
          <p className="mb-3">שני מקורות, ובמכוון:</p>
          <p className="mb-3">
            <strong>עיבוד של מאות מחקרים</strong> בפסיכולוגיה, מדעי המוח, קשב וריכוז, ריפוי בעיסוק,
            קלינאות תקשורת ותחומים נוספים. זה החלק שמייצר את הקישור בין תיאור של קושי לבין הגישות
            הטיפוליות שהראו יעילות עבורו.
          </p>
          <p className="mb-3">
            <strong>ידע קליני של מספר רב של מטפלים מאסכולות שונות.</strong> זה החלק שהמחקר לבדו לא נותן.
            מטפל דינמי, מטפלת CBT ומטפל בהבעה ויצירה רואים את אותו מטופל אחרת, ולכל אחד מהם יש ידע
            מעשי על מי מגיע אליו, מה עובד, ומתי כדאי להפנות למישהו אחר. מודל שנשען רק על ספרות מחקרית
            מפספס את זה.
          </p>
          <p>השילוב הזה הוא מה שמאפשר להתאים <strong>צורך</strong> לטיפול, ולא רק להצמיד תווית לגישה.</p>
        </section>

        <section>
          <h2 style={h2}>מה השאלון מודד</h2>
          <p className="mb-3">
            השאלון <strong>אדפטיבי</strong>: הוא מתעדכן בזמן אמת ומדייק את השאלות בהתאם לתשובות שכבר
            נתתם. מי שמתאר קושי בשינה יקבל שאלות המשך אחרות ממי שמתאר קושי בזוגיות. המשמעות המעשית היא
            ששאלון קצר יחסית מגיע לרזולוציה שרשימת שאלות קבועה לא הייתה מגיעה אליה.
          </p>
          <p className="mb-3">הוא בוחן שני דברים במקביל:</p>
          <ul className="list-disc space-y-2" style={{ paddingInlineStart: "22px" }}>
            <li><strong>את הצורך</strong> - אופי הקושי, עוצמתו, כמה זמן הוא נמשך, ואיך הוא משפיע על התפקוד.</li>
            <li><strong>את ההעדפות</strong> - סגנון העבודה שמתאים לכם, מגדר המטפל/ת אם זה משנה לכם, שפה, אזור, אונליין או פנים אל פנים, והסדרים כספיים.</li>
          </ul>
        </section>

        <section>
          <h2 style={h2}>איך מחושבת ההתאמה</h2>
          <p className="mb-3">ההתאמה מורכבת משתי שכבות נפרדות:</p>
          <p className="mb-3">
            <strong>התאמה מקצועית</strong> - האם המטפל/ת באמת עובד/ת עם מה שאתם מביאים. זו השכבה הכבדה,
            ומשקלה כשני שלישים מהציון. בתוכה, מה שמשפיע הכי הרבה הוא <strong>הכשרה בגישות שמתאימות
            לקושי הספציפי</strong>, אחריו <strong>התאמת קבוצת הגיל</strong> (מטפל מבוגרים ומטפלת ילדים
            אינם תחליף זה לזה), ואחריהם מיקום וזמינות לאונליין. יש משקל נוסף להתאמות מודליות מדויקות,
            למשל התאמה בגישה הזוגית או בסוג הטיפול בהבעה ויצירה.
          </p>
          <p className="mb-3">
            <strong>התאמה אישיותית וסגנונית</strong> - האם דרך העבודה מתיישבת עם מי שאתם. משקלה כשליש.
          </p>
          <p className="mb-3">
            הפירוק הזה מכוון: מטפל מצוין בגישה הלא נכונה לקושי שלכם עדיין לא יהיה ההתאמה הטובה ביותר,
            ולכן ההיבט המקצועי מוביל. אבל שני מטפלים עם אותה הכשרה בדיוק אינם שווים עבורכם, ולכן הסגנון
            לא מבוטל.
          </p>
          <p>
            <strong>מה תקבלו בסוף:</strong> לכל מטפל/ת אחוז התאמה, ולצידו <strong>נימוק כתוב</strong> שמסביר
            על מה ההתאמה נשענת - למשל &quot;התאמה בתחום המומחיות: טיפול בחרדה, CBT&quot;. אנחנו מראים את הנימוק
            במכוון: המלצה שלא מסבירה את עצמה היא בקשה לאמון עיוור.
          </p>
        </section>

        <section>
          <h2 style={h2}>מה המודל לא עושה</h2>
          <p className="mb-3">זה החלק שאנחנו חושבים שהכי חשוב לומר בקול:</p>
          <ul className="list-disc space-y-2" style={{ paddingInlineStart: "22px" }}>
            <li><strong>זו אינה אבחנה.</strong> השאלון אינו כלי אבחוני, ואינו קובע שיש לכם הפרעה כלשהי. הוא מכוון לסוג טיפול ולמטפל/ת, לא לתווית.</li>
            <li><strong>זו אינה הערכה קלינית.</strong> הערכה נעשית על ידי איש מקצוע, בפגישה, לאורך זמן.</li>
            <li><strong>זה לא תחליף לפגישת ההיכרות.</strong> אחוז התאמה גבוה הוא נקודת פתיחה טובה, לא הבטחה. ההתרשמות שלכם בשיחה הראשונה חשובה יותר מכל מספר שנציג.</li>
            <li><strong>המודל לא יודע הכל עליכם.</strong> הוא עובד עם מה שמסרתם בשאלון קצר. אם משהו מרכזי לא עלה שם, הוא לא נלקח בחשבון.</li>
          </ul>
        </section>

        <section>
          <h2 style={h2}>גילוי נאות</h2>
          <p className="mb-3">
            <strong>סדר התוצאות נקבע לפי איכות ההתאמה.</strong> שיקולים אחרים נכנסים לתמונה רק במקרה של
            שוויון מלא בציון בין שני מטפלים, אחרי שההתאמה המקצועית והאישיותית כבר הוכרעה, ולעולם לא על
            חשבון התאמה טובה יותר.
          </p>
          <p>כל המטפלים המוצגים עברו אימות תעודות והכשרה לפני שפורסמו.</p>
        </section>

        <section>
          <h2 style={h2}>מי בנה את זה</h2>
          <p className="mb-3">
            המודל פותח על ידי צוות של פסיכולוגים קליניים וחוקרים, בליווי מטפלים מתחומים ומאסכולות שונות.
            אפשר להכיר את הצוות ב
            <Link href="/about" className="font-semibold hover:underline" style={{ color: "var(--teal-dark)" }}>עמוד מי אנחנו</Link>.
          </p>
          <p>
            אם אתם רוצים להעמיק במחקר עצמו, כתבנו על{" "}
            <Link href="/research/therapist-patient-match" className="font-semibold hover:underline" style={{ color: "var(--teal-dark)" }}>ההתאמה בין מטפל למטופל ומה אומר עליה המחקר</Link>, על{" "}
            <Link href="/research/choosing-therapist" className="font-semibold hover:underline" style={{ color: "var(--teal-dark)" }}>איך לבחור פסיכולוג שמתאים לכם</Link>, ועל{" "}
            <Link href="/research/which-therapy" className="font-semibold hover:underline" style={{ color: "var(--teal-dark)" }}>איזה סוג טיפול מתאים לאיזה קושי</Link>.
          </p>
        </section>

        <QuizCtaBanner />
      </article>
    </ArticleShell>
  );
}
