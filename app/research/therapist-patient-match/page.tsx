import Link from "next/link";
import type { Metadata } from "next";
import { siteAuthorRef, SITE_AUTHOR_PATH } from "@/app/lib/author";
import ArticleShell from "@/app/components/ArticleShell";

const IMG = "https://images.unsplash.com/photo-1604881991720-f91add269bed";

export const metadata: Metadata = {
  title: "התאמה טיפולית בין מטפל למטופל - מה אומר המחקר",
  description:
    "סקירה מחקרית על התאמה אישיותית בין מטפל למטופל: גישת ההשלמה מול גישת הדמיון, צירי השליטה והקרבה, סגנונות התקשרות, וכיצד ההתאמה משפיעה על הצלחת הטיפול.",
  keywords: [
    "התאמה טיפולית", "התאמת מטפל", "מטפל ומטופל", "ברית טיפולית",
    "סגנון התקשרות", "גישת ההשלמה", "גישת הדמיון", "אישיות המטפל",
    "פסיכותרפיה", "בחירת מטפל",
  ],
  openGraph: {
    title: "הקושי בהתאמה הטיפולית בין מטפל למטופל - מה אומר המחקר?",
    description:
      "התאמה אישיותית בין מטפל למטופל - השלמה מול דמיון, צירי שליטה וקרבה, וכיצד הם משפיעים על הצלחת הטיפול. מאת ד\"ר אבשלום גליל, פסיכולוג קליני.",
    locale: "he_IL",
    type: "article",
    siteName: "טיפול חכם",
    images: [
      {
        url: `${IMG}?w=1200&h=630&fit=crop&auto=format&q=80`,
        width: 1200,
        height: 630,
        alt: "שתי ידיים שלובות - חיבור וברית טיפולית בין מטפל למטופל",
      },
    ],
  },
  alternates: {
    canonical: "https://www.mentalytics.co.il/research/therapist-patient-match",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "הקושי בהתאמה הטיפולית והאישיותית בין מטפל למטופל",
  "description":
    "סקירה מחקרית על התאמה אישיותית בין מטפל למטופל: גישת ההשלמה מול גישת הדמיון, צירי השליטה והקרבה, וכיצד ההתאמה משפיעה על הצלחת הטיפול.",
  "inLanguage": "he",
  "datePublished": "2026-06-22",
  "dateModified": "2026-06-22",
  "author": siteAuthorRef(),
  "publisher": {
    "@type": "Organization",
    "name": "טיפול חכם",
    "url": "https://www.mentalytics.co.il",
  },
  "url": "https://www.mentalytics.co.il/research/therapist-patient-match",
  "image": `${IMG}?w=1200&h=630&fit=crop&auto=format&q=80`,
  "keywords":
    "התאמה טיפולית, התאמת מטפל, ברית טיפולית, סגנון התקשרות, גישת ההשלמה, גישת הדמיון",
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
    { "@type": "ListItem", "position": 3, "name": "הקושי בהתאמה הטיפולית בין מטפל למטופל", "item": "https://www.mentalytics.co.il/research/therapist-patient-match" },
  ],
};

const H2 = {
  fontSize: "20px",
  fontWeight: 800,
  color: "var(--text)",
  marginBottom: "14px",
  borderBottom: "2px solid var(--teal-mid)",
  paddingBottom: "8px",
} as const;

export default function TherapistPatientMatchPage() {
  return (
    <ArticleShell
      href="/research/therapist-patient-match"
      title="התאמה בין מטפל למטופל"
      sectionSlug="בחירת-טיפול-ומטפל"
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      {/* Header */}
      <div className="mb-10">
        <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--teal)", textTransform: "uppercase", letterSpacing: ".14em", marginBottom: "10px" }}>
          מידע מקצועי · התאמה טיפולית
        </p>
        <h1 style={{ fontSize: "clamp(1.7rem,4vw,2.3rem)", fontWeight: 900, color: "var(--text)", lineHeight: 1.3, letterSpacing: "-.02em", marginBottom: "16px" }}>
          {`"זכו – שכינה ביניהם": על הקושי בהתאמה טיפולית ואישיותית בין מטפל ומטופל`}
        </h1>
        <p style={{ fontSize: "15px", color: "var(--text-2)", lineHeight: 1.8 }}>
          {`מהי התאמה "טובה" בין מטפל למטופל, ולמה דווקא הסוגיה החשובה הזו נחקרה כל כך מעט? סקירה של מה שהמחקר כן מלמד אותנו - בין גישת ההשלמה לגישת הדמיון.`}
        </p>
      </div>

      {/* Hero image */}
      <div style={{ borderRadius: "16px", overflow: "hidden", marginBottom: "40px", height: "280px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${IMG}?w=900&h=560&fit=crop&auto=format&q=75`}
          alt="שתי ידיים שלובות - חיבור וברית טיפולית בין מטפל למטופל"
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
        />
      </div>

      {/* Article body */}
      <article className="space-y-10 text-stone-700 leading-8 text-base">

        <section>
          <h2 style={H2}>מבוא</h2>
          <p>
            {`סוגיית ההתאמה האישיותית בין מטפלים נפשיים ומטופלים הינה סוגייה מרתקת ומרובת סתירות. למרות החשיבות הגבוהה של ההתאמה בין מטפלים ומטופלים, וההשלכות הרגשיות, הכלכליות והאישיות של התאמה זו על רווחת המטופלים, נראה שהמחקר הקיים מצומצם יחסית. אפשר להתייחס להתאמה בין מטפל ומטופל כשני חלקים: החלק הראשון הוא ההתאמה בין סוג הטיפול ובין סוג הקושי של המטופל. רוב התיאוריות והשיטות הפסיכולוגיות גורסות, גם אם בצורה לא ישירה, שהן מסוגלות לחולל שינוי אצל כל או רוב סוגי הקשיים של המטופל. תיאוריות פסיכולוגיות מהוות מסגרת רעיונית - תיאורטית ופילוסופית, מסגרת מעשית, התנהגותית והדרכתית, או שילוב של השניים. ישנה מסה תיאורטית רבה על הצלחה (או אי הצלחה) של שיטות טיפול מסוימות על בעיה מסוימת. למשל, מחקרים רבים הראו כי טיפול CBT מסייע מאוד בקשיים בתחום האובססיביות-קומפולסיביות. בעבר, רוב המחקר הפסיכולוגי התמקד בגישות מבוססות המחקר (evidence based) כגון טיפול התנהגותי קוגניטיבי או טיפול דיאלקטי-התנהגותי (DBT). עם זאת, בשנים האחרונות מתרבים המחקרים שממחישים את ההצלחה של טיפולים דינאמיים שונים בסיוע במספר רב של קשיים פסיכולוגיים.`}
          </p>
          <p className="mt-4">
            {`בניגוד למחקר הרב שיש בנוגע להצלחות שיטות טיפול שונות בנוגע לקשיים ספציפיים, יש מעט מחקר אמפירי (באופן יחסי) שנוגע להתאמה אישיותית בין מטפלים ומטופלים. הסיבות לכך מרובות: ראשית, ייתכן כי העדר המחקר הרב נובע מהגישה הטיפול הבסיסית הפסיכואנליטית שהמטפל הינו "דף חלק" ולכן אישיותו וגישתו של המטפל והתאמתה לאישיות המטופל אינה רלוונטית כלל. עם זאת, כיום הגישות האינטר-סובייקטיביות, המתמקדות בקשר הסובייקטיבי בין מטפלים ומטופלים הופכות להיות יותר ויותר נפוצות במיינסטרים הטיפולי והפסיכואנליטי. שנית, ישנו קושי מסוים לחקור דמיון אישיותי בין מטפל ומטופל ועד כמה דמיון זה מסייע או לא להצלחת הטיפול. הקושי הינו מתודולוגי, דהיינו קשור לקושי לבחון אלמנטים אישיותיים אצל מטפלים שייתכן ויתקשו לשתף פעולה עם מחקרים מהסוג הזה שבוחנים את אישיותם ובכך את הצלחתם בטיפול. למרות זאת, במאמר זה ננסה לסקור את המחקרים הקיימים הנוגעים להתאמה אישיותית בין מטפלים נפשיים ומטופלים.`}
          </p>
        </section>

        <section>
          <h2 style={H2}>שני צירים: שליטה וקרבה</h2>
          <p>
            {`השאלה בעשורים האחרונים החלה לעבור מ"האם טיפול פסיכולוגי עובד" ל"מה עובד? עבור מי? ובאילו תנאים?" (Paul, 1967). בתחום ההתאמה בין מטפל ומטופל, הספרות המחקרית נשענת על שני צירים עיקריים: ציר השליטה - עד כמה המטפל פעיל ומכוון לעומת מאפשר ולא מכוון את המטופל. בתחום זה הספרות מתארת בדרך כלל אלמנט של "השלמה" - מטפל צריך להיות שונה או הפוך באישיותו מהמטופל, משלים לו. למשל אם המטופל זקוק להישענות (פסיבי) המטפל צריך להיות מחזיק (אקטיבי). ציר נוסף הינו הקירבה - עד כמה צרכי המטופל מאורגנים סביב יחסיות, החזקה ותלות לעומת צורך באוטונומיה ביקורת עצמית והבנה. ציר זה מורכב יותר להסבר והבנה, מכיוון שישנן תיאוריות המתמקדות בתיאוריות ההשלמה - דהיינו המטפל צריך להיות "הפוך" מהמטופל באישיותו וישנן תיאוריות הדוגלות ב"דמיון" - המטפל צריך להיות דומה באישיותו המקצועית לאישיותו של המטופל.`}
          </p>
          <p className="mt-4">
            {`חלוקה זו מעוגנת במודל המעגליות הבין-אישית (interpersonal circumplex) של קיזלר (Kiesler, 1996), הממקם כל אינטראקציה בין-אישית על שני ממדים: שליטה וקרבה. על פי עיקרון ההשלמה שניסח קיזלר, התנהגות על ציר השליטה מזמינה תגובה הדדית והפוכה (שליטה מזמינה כניעה ולהפך), בעוד שעל ציר הקרבה היא מזמינה תגובה תואמת ודומה (חום מזמין חום). עיקרון כפול זה מבהיר מדוע דווקא על ציר הקרבה מתרכזת המחלוקת בין גישת ההשלמה לגישת הדמיון. ברובד האישיותי העמוק, ההבחנה בין צרכים המאורגנים סביב קשר ותלות לבין צרכים המאורגנים סביב הגדרה עצמית ואוטונומיה נשענת על מודל הקטבים האנאקליטי–אינטרויקטיבי של בלאט (Blatt, 2008). מצירים אלו אנו מבינים את המורכבות של ההתאמה האישיותית בין המטפל והמטופל ובשל כך מתחדד הצורך בהבנת המרכיבים ובניית מודל מורכב מספיק שיסייע להתאמה באופן הסטטיסטי הטוב ביותר האפשרי.`}
          </p>

          {/* Author-provided diagram of the two research axes */}
          <figure style={{ margin: "28px 0 0", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "16px", padding: "16px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/therapist-match-diagram.png"
              alt={`תרשים "צירים מחקריים בולטים בהתאמה בין מטפל ומטופל": ציר השליטה (פעיל ומכוון מול מאפשר) - השלמה, שבה מטופל פסיבי זקוק למטפל מחזיק/אקטיבי ומטופל חיוני/סוער זקוק למטפל מכיל וקשוב; וציר הקרבה (תלות והחזקה מול אוטונומיה) - השלמה (מטפל הפוך) או דמיון (מטפל דומה). שני הצירים מתכנסים אל מורכבות ההתאמה האישיותית והצורך במודל סטטיסטי מורכב להתאמה מיטבית.`}
              style={{ width: "100%", height: "auto", display: "block" }}
            />
            <figcaption style={{ fontSize: "13px", color: "var(--muted)", textAlign: "center", marginTop: "12px" }}>
              צירים מחקריים בולטים בהתאמה בין מטפל ומטופל
            </figcaption>
          </figure>
        </section>

        <section>
          <h2 style={H2}>המחקר האמפירי</h2>
          <p>
            {`מרבית הממצאים והמחקרים התמקדו בתיאוריות ההשלמה. למשל, נבדקה ההשפעה של אוריינטציות אישיותיות של המטופל והמטפל, תוך התמקדות בקשר (אנאקליטי) או הגדרה עצמית (אינטרויקטיבי). הממצאים הצביעו על כך שכאשר הן המטופל והן המטפל חלקו את אותה אוריינטציה, חלה ירידה משמעותית בסימפטומים ושיפור רמות ההתפתחות של המטופלים (Werbart, Hägertz & Borg Ölander, 2018; Norcross & Wampold, 2011). מחקרים נוספים מצאו כי המאפיינים האישיותיים הסובייקטיביים של המטפל משפיעים על הצלחת הטיפול בעקבות התאמה גבוהה יותר למטופל (Lingiardi, Muzi, Tanzilli & Carone, 2018). גם למשתנים דמוגרפיים או תרבותיים משותפים ישנה השפעה חיובית על הצלחת הקשר הטיפולי, אולם בעוצמה פחותה יותר מאשר משתנים אישיותיים (Cabral & Smith, 2011; Ibaraki & Hall, 2014).`}
          </p>
          <p className="mt-4">
            {`בנוסף, סגנון ההתקשרות של המטופל הומשגה כמרכיב חשוב בקשר הטיפולי (Mallinckrodt, 2010). מחקרים נוספים מצאו כי גם סגנון ההתקשרות של המטפל, ולא רק של המטופל, משפיע על המטופל ועל הקשר הטיפולי (Slade, 2016). עם זאת האופן שבו אופן ההתקשרות של המטפל והמטופל פועל נתון במחלוקת: רוב המחקרים תומכים בהשערת ההשלמה - סגנון לא תואם שמשלים אחד את השני (למשל, Bruck et al., 2006; Petrowski et al., 2011). עם זאת, מחקרים אחרים הגיעו למסקנה כי דפוסי התקשרות מתכנסים מובילים לתוצאות טובות יותר עבור חולים עם הפרעות חמורות או נמנעות גבוהות (Farber & Metzger, 2009; Wiseman & Tishby, 2014). נתונים אלו ממחישים עד כמה מסובך לבצע התאמה על בסיס אישיותי בין מטפל ומטופל.`}
          </p>
          <p className="mt-4">
            {`מחקרים אמפיריים נוספים נגעו בנקודה נוספת: ביוטלר ועמיתיו פיתחו את "Systematic Treatment Selection". על פי גישה זו, אפקטיביות הטיפול הנפשי עולה ככל שרמת ההכוונה של המטפל הפוכה מרמת ההתנגדות של המטופל. מטופלים בעלי תגובתיות גבוהה (נטייה להתנגד להשפעה חיצונית) מפיקים תועלת רבה יותר מגישה לא מכוונת ומאפשרת, ואילו מטופלים בעלי התנגדות נמוכה נוטים להפיק יותר מגישה מכוונת וישירה. מטא-אנליזות נוספות איששו ממצאים אלו. מחקר ישראלי נוסף בדק טיפולים דינאמיים קצרי מועד, על ידי מדידת תכונות BIG 5 ודפוסי התקשרות של המטפל/ת ושל המטופל/ת. נמצא כי שילוב ודמיון בממדי הנוירוטיות והמצפוניות ניבאו ירידה בסימפטומים.`}
          </p>
        </section>

        <section>
          <h2 style={H2}>השלמה מול דמיון</h2>
          <p>
            {`כמכלול עולה כי גישת הדמיון בפרמטרים אישיותיים בין מטפל ומטופל היא הגישה הנתמכת ביותר אמפירית. ברמת ההתנהגויות הגלויות (למשל - עד כמה המטפל מכוון מול מטופל מתנגד) התיאוריות ה"משלימות" הן הנתמכות יותר. כך שבמקרים אלו ככל שהמטפל מצליח להתמקם אישיותית בקוטב הנגדי לקוטב של המטופל – כך יש ציפייה גבוהה יותר להצלחת הטיפול. ברמת התצורות הנפשיות העמוקות יותר – הראיות הן מעורבות וישנם יותר תמיכות לתיאוריות הדמיון מאשר לתיאוריות ההשלמה.`}
          </p>
        </section>

        <section>
          <h2 style={H2}>סיכום</h2>
          <p>
            {`לסיכום, חשוב לשים לב לשני דגשים. מחד, אין ספק שחלק מההתאמה הנפשית של מטפל היא להתאים את עצמו ואת תגובותיו לצרכים של המטופל. וגם כשהתאמה זו אינה חלקה, עדיין יש ערך טיפולי גם לחוויית הכשל האמפתי – ככל שמצליחים לעבוד ולעבד את התחושות ההדדיות. מאידך, סביר מאוד להניח שככל שההתאמה האישיותית קרובה יותר, במיוחד במקרים של התאמה אישיותית עמוקה ולא ברמה ההתנהגותית (הניתנת יותר לשליטה ושינוי), כך הסיכוי להצלחת הקשר הטיפולי, הדורש חיבור בינאישי מורכב ועמוק, עולה.`}
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "17px", fontWeight: 800, color: "var(--text-2)", marginBottom: "12px" }}>
            מקורות
          </h2>
          <div style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 2, direction: "ltr", textAlign: "left" }}>
            <p>{`Beutler, L. E., Edwards, C., & Someah, K. (2018). Adapting psychotherapy to patient reactance level: A meta-analytic review. Journal of Clinical Psychology, 74(11), 1952–1963.`}</p>
            <p>{`Beutler, L. E., Harwood, T. M., Michelson, A., Song, X., & Holman, J. (2011). Resistance/reactance level. Journal of Clinical Psychology, 67(2), 133–142.`}</p>
            <p>{`Blatt, S. J. (2008). Polarities of experience: Relatedness and self-definition in personality development, psychopathology, and the therapeutic process. American Psychological Association.`}</p>
            <p>{`Bruck, E., Winston, A., Aderholt, S., & Muran, J. C. (2006). Predictive validity of patient and therapist attachment and introject styles. American Journal of Psychotherapy, 60(4), 393–406.`}</p>
            <p>{`Cabral, R. R., & Smith, T. B. (2011). Racial/ethnic matching of clients and therapists in mental health services: a meta-analytic review of preferences, perceptions, and outcomes. Journal of Counseling Psychology, 58(4), 537.`}</p>
            <p>{`Ibaraki, A. Y., & Hall, G. C. N. (2014). The components of cultural match in psychotherapy. Journal of Social and Clinical Psychology, 33(10), 936–953.`}</p>
            <p>{`Kiesler, D. J. (1996). Contemporary interpersonal theory and research: Personality, psychopathology, and psychotherapy. John Wiley & Sons.`}</p>
            <p>{`Lingiardi, V., Muzi, L., Tanzilli, A., & Carone, N. (2018). Do therapists' subjective variables impact on psychodynamic psychotherapy outcomes? A systematic literature review. Clinical Psychology & Psychotherapy, 25(1), 85–101.`}</p>
            <p>{`Mallinckrodt, B. (2010). The psychotherapy relationship as attachment: Evidence and implications. Journal of Social and Personal Relationships, 27(2), 262–270.`}</p>
            <p>{`Norcross, J. C., & Wampold, B. E. (2011). Evidence-based therapy relationships: research conclusions and clinical practices. Psychotherapy, 48(1), 98.`}</p>
            <p>{`Obegi, J. H., & Berant, E. (Eds.). (2010). Attachment theory and research in clinical work with adults. Guilford Press.`}</p>
            <p>{`Paul, G. L. (1967). Strategy of outcome research in psychotherapy. Journal of Consulting Psychology, 31(2), 109–118.`}</p>
            <p>{`Petrowski, K., Nowacki, K., Pokorny, D., & Buchheim, A. (2011). Matching the patient to the therapist: The roles of the attachment status and the helping alliance. The Journal of Nervous and Mental Disease, 199(11), 839–844.`}</p>
            <p>{`Reis, B. F., & Brown, L. G. (1999). Reducing psychotherapy dropouts: Maximizing perspective convergence in the psychotherapy dyad. Psychotherapy: Theory, Research, Practice, Training, 36(2), 123.`}</p>
            <p>{`Shir, R., & Tishby, O. (2024). Therapy matchmaking: Patient-therapist match in personality traits and attachment style. Psychotherapy Research, 34(3), 353–365.`}</p>
            <p>{`Slade, A. (2016). Attachment and adult psychotherapy: Theory, research, and practice. Handbook of Attachment: Theory, Research, and Clinical Applications, 3, 759–779.`}</p>
            <p>{`Snyder, C. R., & Forsyth, D. R. (1991). Handbook of Social and Clinical Psychology: The Health Perspective. Pergamon Press.`}</p>
            <p>{`Werbart, A., Hägertz, M., & Borg Ölander, N. (2018). Matching patient and therapist anaclitic–introjective personality configurations matters for psychotherapy outcomes. Journal of Contemporary Psychotherapy, 48(4), 241–251.`}</p>
            <p>{`Wiseman, H., & Tishby, O. (2014). Client attachment, attachment to the therapist and client-therapist attachment match: How do they relate to change in psychodynamic psychotherapy? Psychotherapy Research, 24(3), 392–406.`}</p>
          </div>
        </section>

      </article>

      {/* Author bio */}
      <div style={{
        marginTop: "52px",
        borderTop: "1px solid var(--line)",
        paddingTop: "32px",
        display: "flex",
        gap: "18px",
        alignItems: "flex-start",
      }}>
        <div style={{
          width: "52px", height: "52px", flexShrink: 0,
          borderRadius: "50%",
          background: "var(--teal-pale)",
          border: "2px solid var(--teal-mid)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "22px",
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

      {/* Further reading */}
      <div className="mt-10 rounded-2xl border border-[#E8E0D8] bg-[#f8f5f0] p-6">
        <h2 className="mb-4 text-base font-extrabold text-stone-800">קריאה נוספת</h2>
        <ul className="space-y-2 text-sm">
          <li><Link href="/research/choosing-therapist" className="text-[#2e7d8c] hover:underline">← איך בוחרים מטפל?</Link></li>
          <li><Link href="/research/cbt-vs-dynamic" className="text-[#2e7d8c] hover:underline">← ההבדל בין CBT לטיפול דינמי</Link></li>
          <li><Link href="/research/which-therapy" className="text-[#2e7d8c] hover:underline">← איזה טיפול פסיכולוגי מתאים לי?</Link></li>
          <li><Link href="/research/therapy-types" className="text-[#2e7d8c] hover:underline">← סוגי הטיפולים השונים</Link></li>
        </ul>
      </div>
    </ArticleShell>
  );
}
