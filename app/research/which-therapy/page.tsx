import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "איזה טיפול פסיכולוגי מתאים לי? — מדריך מבוסס מחקר | טיפול חכם",
  description:
    "CBT, דינמי, DBT, ACT, EMDR, EFT — מה ההבדל ואיזה מתאים לך? מדריך מקיף מבוסס מחקרים עדכניים על בחירת טיפול פסיכולוגי והתאמה בין מטפל למטופל.",
  openGraph: {
    title: "איזה טיפול פסיכולוגי מתאים לי?",
    description:
      "מדריך מקיף לבחירת סוג הטיפול הנכון — CBT, דינמי, DBT, ACT, EMDR, EFT — לפי הצורך, האישיות, וממצאי המחקר העדכניים.",
    url: "https://www.mentalytics.co.il/research/which-therapy",
    type: "article",
    locale: "he_IL",
    siteName: "טיפול חכם",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "איזה טיפול פסיכולוגי מתאים לי?",
  description:
    "מדריך מקיף לבחירת סוג הטיפול הנכון לפי הצורך, האישיות, וממצאי המחקר העדכניים — CBT, פסיכודינמי, DBT, ACT, EMDR, טיפול זוגי.",
  inLanguage: "he",
  datePublished: "2025-01-01",
  dateModified: "2026-04-22",
  author: { "@type": "Organization", name: "טיפול חכם", url: "https://www.mentalytics.co.il" },
  publisher: {
    "@type": "Organization",
    name: "טיפול חכם",
    url: "https://www.mentalytics.co.il",
    logo: { "@type": "ImageObject", url: "https://www.mentalytics.co.il/logo.png" },
  },
  url: "https://www.mentalytics.co.il/research/which-therapy",
  mainEntityOfPage: { "@type": "WebPage", "@id": "https://www.mentalytics.co.il/research/which-therapy" },
  about: [
    { "@type": "Thing", name: "CBT — טיפול קוגניטיבי-התנהגותי" },
    { "@type": "Thing", name: "טיפול פסיכודינמי" },
    { "@type": "Thing", name: "DBT — טיפול דיאלקטי-התנהגותי" },
    { "@type": "Thing", name: "EMDR" },
    { "@type": "Thing", name: "ACT — Acceptance and Commitment Therapy" },
    { "@type": "Thing", name: "EFT — טיפול זוגי ממוקד ברגש" },
    { "@type": "Thing", name: "ברית טיפולית" },
  ],
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "מהו הטיפול הפסיכולוגי הטוב ביותר?",
      acceptedAnswer: {
        "@type": "Answer",
        text: 'המחקר מראה שאין "טיפול הכי טוב" אחד לכולם. הגורם המשפיע ביותר על הצלחת הטיפול הוא הברית הטיפולית — איכות הקשר בין המטפל למטופל. מעבר לכך, CBT יעיל מאוד לחרדה ו-OCD, טיפול פסיכודינמי מתאים לדפוסים חוזרים, ו-EMDR הוא קו ראשון לטראומה.',
      },
    },
    {
      "@type": "Question",
      name: "מה ההבדל בין CBT לטיפול דינמי?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "CBT ממוקד, מובנה, ועובד על דפוסי חשיבה והתנהגות בהווה. טיפול פסיכודינמי חושף תהליכים לא מודעים ודפוסים הנובעים מהעבר. CBT קצר יותר בדרך כלל; טיפול דינמי מאפשר עומק וארוך יותר.",
      },
    },
    {
      "@type": "Question",
      name: "מתי מומלץ EMDR?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "EMDR נחשבת כיום לטיפול קו ראשון לטראומה ו-PTSD. היא יעילה במיוחד לחרדה הקשורה בזיכרונות טראומטיים.",
      },
    },
    {
      "@type": "Question",
      name: "מה ה-DBT ומתי הוא מתאים?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "DBT (טיפול דיאלקטי-התנהגותי) מתאים כשהוויסות הרגשי הוא הקושי המרכזי — סערות רגשיות עזות, פגיעה עצמית, הפרעת אישיות גבולית. הוא משלב כלים מ-CBT עם קבלה רדיקלית ומיינדפולנס.",
      },
    },
    {
      "@type": "Question",
      name: "מהי ברית טיפולית ולמה היא חשובה?",
      acceptedAnswer: {
        "@type": "Answer",
        text: 'הברית הטיפולית היא איכות הקשר בין מטפל למטופל — תחושת ביטחון, הסכמה על מטרות, ותחושה שהמטפל מבין. מטה-אנליזה של 295 מחקרים (Flückiger et al., 2018) הראתה שהברית הטיפולית היא המנבא החזק ביותר של הצלחת הטיפול — חזק יותר מסוג השיטה עצמה.',
      },
    },
  ],
};

export default function WhichTherapyPage() {
  return (
    <main
      className="mx-auto max-w-2xl px-5 py-12 pb-20"
      dir="rtl"
      style={{ fontFamily: "'Heebo', sans-serif" }}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');`}</style>

      <Link href="/research" className="text-sm text-stone-500 hover:underline mb-8 inline-block">
        ← חזרה למאמרים ומידע שימושי
      </Link>

      <article className="article-body">
        <header className="mb-10 pb-6 border-b border-stone-200">
          <p className="text-sm text-stone-500 mb-2">1.3.26</p>
          <h1 className="text-4xl font-black text-stone-900 leading-tight mb-3">
            איזה טיפול פסיכולוגי מתאים לי?
          </h1>
          <p className="text-sm text-stone-500">מבוסס על מחקרים עדכניים בפסיכותרפיה</p>
        </header>

        <h2>למה הבחירה בטיפול פסיכולוגי מורכבת כל כך?</h2>
        <p>
          בחירת טיפול פסיכולוגי אינה דומה לבחירת טיפול רפואי בשבר או בדלקת. בעוד שברפואה פיזית קיימים פרוטוקולים
          אחידים וברורים, ובעלי בסיס מחקרי מובהק לכל אבחנה, בעולם הנפש המציאות מורכבת בהרבה. הצלחת הטיפול תלויה
          בשילוב עדין בין אישיותו של המטופל, סוג הקושי שאיתו הוא מגיע, השלב שבו הוא נמצא בחייו, והמתודולוגיה
          הספציפית שבה עובד המטפל. כך קורה שאותה שיטה עצמה, המופעלת על ידי שני מטפלים שונים, יכולה להניב תוצאות
          שונות לחלוטין אצל אותו מטופל; ולהיפך — אותו מטפל, המיישם את אותה שיטה אצל שני מטופלים שונים, עשוי לקדם
          את האחד באופן ניכר ולא להגיע כלל לקרבה טיפולית עם האחר.
        </p>
        <p>
          המחקר העדכני בפסיכולוגיה מצביע על כך שהשאלה הנפוצה "איזה טיפול הכי טוב?" היא במידה רבה השאלה הלא נכונה.
          השאלה המדויקת יותר היא איזה טיפול מתאים לי, לקושי הספציפי שלי, ברגע הזה בחיי, ואצל איזה מטפל הוא צפוי
          להניב תוצאה משמעותית. אי אפשר להתעלם ממידת ההתאמה למטפל עצמו: ישנם מטפלים שונים העובדים באותה השיטה, אך
          האינטראקציה שלהם עם מטופליהם מתבצעת באופן שונה לחלוטין — בקצב שונה, במידת אקטיביות שונה, ובאופי הנוכחות
          הרגשית שהם מציעים. לכן יש חשיבות מהותית בהבנה ובהתאמה בין מטפל למטופל על בסיס האישיות המקצועית-אישית, לא
          פחות מההתאמה לסוג השיטה.
        </p>

        <h2>טיפול קוגניטיבי-התנהגותי (CBT)</h2>
        <p>
          הטיפול הקוגניטיבי-התנהגותי הוא השיטה הנחקרת ביותר בעולם הפסיכותרפיה, ומקובל לראות בו את "סטנדרט הזהב"
          של הטיפולים מבוססי-הראיות. מדובר בגישה ממוקדת מטרה, קצרת-מועד ומובנית, אשר מזהה את דפוסי החשיבה
          וההתנהגות שמשמרים את הסבל ועובדת באופן שיטתי על החלפתם בכלים אדפטיביים. מטה-אנליזה מאוחדת של Cuijpers
          ועמיתיו (2023), הסוקרת מאות מחקרים מבוקרים, מצאה עדיפות סטטיסטית של CBT בהפרעות כגון OCD, פוביות
          ספציפיות, והפרעות חרדה — תחומים שבהם הפרוטוקולים הקצרים והמובנים של הגישה מצליחים לחולל שינוי מדיד תוך
          מספר חודשים בלבד. עם זאת, חלק מהמטופלים חווים את השיטה כטכנית או קרה מדי, ומתקשים למצוא בה את העומק
          הרגשי שהם זקוקים לו. עבורם ייתכן שגישה אחרת תתאים יותר, גם אם מבחינה מחקרית טהורה ה-CBT נראה כבחירה
          ההגיונית "על הנייר".
        </p>

        <h2>טיפול פסיכודינמי</h2>
        <p>
          הטיפול הפסיכודינמי, שהוא הטיפול הוותיק והקלאסי ביותר, מתמקד בחשיפתם של תהליכים לא-מודעים — מתוך הנחה
          שקשיי ההווה מושרשים בדפוסי יחסים מוקדמים ובקונפליקטים פנימיים שאינם נגישים בקלות למודעות. המטרה איננה
          רק הקלה בסימפטום, אלא שינוי מבני עמוק יותר באופן שבו האדם תופס את עצמו, את האחר, ואת מערכות היחסים
          שלו. סקירת-על עדכנית של Leichsenring ועמיתיו (2023) הראתה שהטיפול הפסיכודינמי עומד בקריטריונים של
          "טיפול נתמך אמפירית" להפרעות נפשיות נפוצות — ממצא שמתחזק בשנים האחרונות, כולל במחקרים של חוקרים
          ישראלים. גישה זו מתאימה במיוחד כשהמצוקה אינה ממוקדת בסימפטום בודד אלא בדפוסים חוזרים של בושה, זהות
          שברירית, קשיים מתמשכים ביחסים בין-אישיים, או תחושת ריקנות כרונית. הטיפול הפסיכודינמי נוגע במרכיבים
          העמוקים ביותר של הנפש ומסייע להבנת האישיות ודרכי ההתמודדות, כולל אותם מרכיבים שאינם מודעים לאדם עצמו
          ושמכוונים את חייו מאחורי הקלעים.
        </p>

        <h2>גישות ממוקדות: DBT, ACT ו-EMDR</h2>
        <p>
          לצד שתי האסכולות המרכזיות התפתחו בעשורים האחרונים גישות ממוקדות יותר, שכל אחת מהן פותחה לתת-קבוצה
          מסוימת של קשיים. הטיפול הדיאלקטי-התנהגותי (DBT) מציע שילוב ייחודי בין כלים לשינוי התנהגותי, בסגנון של
          ה-CBT, לבין קבלה רדיקלית ועקרונות של מיינדפולנס. השיטה פותחה במקור על ידי Marsha Linehan עבור מטופלים
          עם הפרעת אישיות גבולית, פגיעה עצמית ואובדנות, אך לאורך השנים הוכיחה יעילות גם בקשת רחבה של קשיים
          רגשיים. היא מתאימה במיוחד למי שחווה סערות רגשיות עזות וקושי בוויסות, אך כרוכה במחויבות גבוהה יחסית
          וכוללת לרוב גם קבוצת מיומנויות במקביל לטיפול הפרטני. גישת ה-ACT (Acceptance and Commitment Therapy)
          הולכת בכיוון משלים: במקום לנסות לשנות את תוכן המחשבות והרגשות, היא מלמדת את המטופל לקבל אותם מבלי
          להיגרר אחריהם, ולפעול בהתאם לערכים שבחר לעצמו. מטה-אנליזה מובילה של A-Tjak ועמיתיה (2015) הראתה את
          יעילותה במצבים של הימנעות חווייתית ורומינציה. ה-EMDR, שיטת עיבוד מחדש של זיכרונות טראומטיים באמצעות
          תנועות עיניים דו-צדדיות, נחשבת כיום לטיפול קו ראשון בטראומה וב-PTSD, ויעילה במיוחד עבור חרדה הקשורה
          בזיכרונות טראומטיים. היא מחייבת מטפל המוסמך ספציפית לעבוד בה, ואיננה תחליף לעבודה רגשית מעמיקה אלא
          כלי ממוקד למטרה ספציפית.
        </p>

        <h2>טיפול זוגי</h2>
        <p>
          בטיפול זוגי המורכבות גדלה כפליים: המטפל נדרש להתאים את עצמו לשני אנשים בעלי אישיות, היסטוריה ועמדות
          שונות במקביל, ושלוש הגישות המרכזיות נבדלות מהותית בעדשת העבודה שלהן ובמקום שבו הן מאתרות את שורש
          התקיעות. הגישה הממוקדת ברגש (EFT), שפותחה על ידי Sue Johnson, מבוססת על תיאוריית ההתקשרות ורואה
          במריבות מעין "ריקוד" שבו כל צד מנסה להרגיש בטוח וקרוב, אך עושה זאת באופן שדוחה את האחר. המטרה הטיפולית
          היא להמיר את המעגל השלילי הזה בחוויה של קרבה וביטחון רגשי. הגישה הדינמית-זוגית, כפי שגיבש Arthur
          Nielsen, בוחנת כיצד כל בן זוג משליך על האחר את הצללים של עברו ואת דפוסי הילדות הלא-מודעים שלו, וכיצד
          הזוגיות הופכת לבמה שעליה משוחזרים מערכות יחסים מוקדמות. הגישה המבנית, שבסיסיה הונחו על ידי Salvador
          Minuchin, מתמקדת ב"ארכיטקטורה" של הקשר — בגבולות, בהיררכיה, בתפקידים שכל אחד נוטל על עצמו, ובמידת
          המעורבות של המשפחה המורחבת בחיי הזוג. הבחירה המושכלת בין הגישות תלויה פחות בשאלה איזו מהן "צודקת"
          תיאורטית, ויותר בשאלה איזו גישה פוגשת בצורה המדויקת ביותר את מנגנון התקיעות המרכזי של הזוג הספציפי.
        </p>

        <h2>הברית הטיפולית והמנבא החזק של הצלחת הטיפול</h2>
        <p>
          ממצא מרכזי במחקר הפסיכותרפיה בעשורים האחרונים הוא שהשיטה כשלעצמה אינה המנבא החזק ביותר של הצלחת
          הטיפול. מטה-אנליזה רחבת-היקף של Flückiger ועמיתיו (2018), שכללה 295 מחקרים ומעל 30,000 מטופלים,
          הראתה קשר חיובי עקבי בין הברית הטיפולית — איכות הקשר עם המטפל וההסכמה על מטרות הטיפול — לבין תוצאתו,
          על פני כמעט כל שיטה ופורמט שנבדקו. בהמשך לכך, מטה-אנליזה של Elliott ועמיתיו (2018) הראתה שאמפתיה של
          המטפל היא מנבא בינוני-חזק של התוצאה (r≈.28). מצרף הממצאים הללו מלמד שהקשר האנושי בין מטפל למטופל אינו
          רק מסגרת או קישוט לטכניקה הטיפולית, אלא חלק מהמנגנון עצמו שדרכו הטכניקה הופכת לאפקטיבית. אי אפשר לדעת
          מראש בוודאות אם תיווצר ברית טיפולית מיטיבה עם מטפל ספציפי, אך ניתן להגדיל באופן ניכר את הסיכוי לכך על
          ידי התאמה מדויקת של סוג הטיפול לצורך, ושל אישיות המטפל לאישיות המטופל.
        </p>

        <h2>המדע של ההתאמה</h2>
        <p>
          מספר קווי מחקר מתכנסים לאותה תובנה: זהותו של המטפל וסגנונו משנים את התוצאה לא פחות מאשר השיטה
          עצמה. מטה-אנליזה של Swift ועמיתיו (2018) הראתה שמטופלים שקיבלו טיפול ההולם את העדפותיהם נשרו פחות
          וסיימו את הטיפול עם תוצאות טובות יותר. מחקריו של פרופ' Larry Beutler על Systematic Treatment
          Selection מצאו שמטופלים עם רמת "התנגדות" גבוהה מגיבים טוב יותר למטפל לא-מכווין ופחות סמכותי, בעוד
          שמטופלים הזקוקים למבנה ברור משגשגים דווקא אצל מטפל אקטיבי ומכוון. מחקר אקראי מבוקר של Constantino
          ועמיתיו (2021), שהתפרסם ב-JAMA Psychiatry, הראה שהתאמה מבוססת-נתונים בין מטופלים למטפלים שיפרה את
          תוצאות הטיפול באופן משמעותי, במיוחד אצל מטופלים עם בעיות מורכבות. עבור חלק מהמטופלים מטפל אקטיבי, ישיר
          ומאתגר יוצר תחושת ביטחון ומחזיר תחושת מסוגלות; עבור אחרים, אותו סגנון בדיוק נחווה כחודרני ופוגעני.
          מטפל מתאים, אם כן, אינו רק כזה השולט בשיטה מסוימת, אלא כזה היודע לנוע בין אקטיביות להשהיה, בין הכוונה
          להקשבה, בהתאם לצורך המשתנה של המטופל הספציפי שמולו.
        </p>

        <h2>איך בוחרים בפועל</h2>
        <p>
          בחירה מושכלת בטיפול דורשת חשיבה דו-ממדית: התאמה מקצועית, כלומר האם ארגז הכלים של המטפל מתאים לקושי
          שאיתו אני מגיע, והתאמה אישיותית, כלומר האם הסגנון והטמפרמנט שלו מהדהדים לצרכים הרגשיים שלי. שני
          הממדים הללו אינם תחליף זה לזה, ושניהם נדרשים על מנת שתיווצר העבודה הטיפולית המיטיבה.
        </p>
        <p>
          לפני שמתחילים טיפול, כדאי לעצור ולשאול כמה שאלות בסיסיות. ראשית, מהו מוקד הבעיה שאני באמת רוצה לשנות?
          האם מדובר בסימפטום ספציפי כמו חרדה לפני מבחנים, או בדפוס רחב יותר של יחסים שאני מוצא את עצמי חוזר
          אליו לאורך השנים? התשובה לשאלה זו מכוונת במידה רבה את הבחירה בין גישה ממוקדת וקצרת-טווח לבין גישה
          עומקית וארוכה יותר. שאלה משלימה היא האם אני מחפש בעיקר כלים מעשיים שיעזרו לי לתפקד טוב יותר ביום-יום,
          או שאני זקוק יותר למרחב של עיבוד והבנה של מה שעובר עליי, גם אם הוא לא מסתיים בטכניקה ברורה ליישום.
          מעבר לכך, חשוב לבחון את העדפת הסגנון האישית: יש מי שמשגשג מול מטפל אקטיבי, ישיר ומאתגר שמדרבן אותו
          להתקדמות, ויש מי שזקוק למטפל איטי ומכיל יותר, שמאפשר את המרחב הרגשי הדרוש לעיבוד פנימי. שאלה רביעית
          ומעשית היא האם למטפל יש ניסיון ספציפי בקושי שאיתו אני מגיע — טיפול בהפרעות אכילה, בטראומה מינית, או
          בבני זוג בני דתות שונות, למשל, מצריך היכרות עם תחום הבעיה ולא רק עם השיטה הטיפולית הכללית. לבסוף,
          כדאי לשאול את המטפל עצמו, כבר בפגישות הראשונות, כיצד הוא מתכוון לבחון שהטיפול אכן עובד ומקדם את
          המטרות שהוגדרו, ואילו סימנים יעידו על כך שיש מקום לשנות כיוון. שאלה זו, שנשמעת לעיתים מאיימת, היא
          למעשה סימן בריא: היא משקפת מטופל שלוקח אחריות על תהליך שלו ומטפל שאינו מהסס לחשוב יחד איתו על איכות
          העבודה המשותפת.
        </p>

        <h2>סיכום</h2>
        <p>
          הממצאים המחקריים המצטברים מובילים למסקנה אחת ברורה: לא תמיד מה שקובע את הצלחת הטיפול הוא האם המטפל
          נחשב ל"מטפל מעולה" במובן כללי, אלא האם הוא מתאים למטופל הספציפי שלפניו ולקושי שאיתו הוא מגיע. כדאי
          לראות בפגישות הראשונות שלב הערכה הדדי, שבו לא רק המטפל מתרשם מהמטופל אלא גם המטופל בוחן בכנות אם
          סגנון העבודה מהדהד עבורו, אם השיטה מרגישה מתאימה, ואם נוצרת תחושת כיוון בעבודה המשותפת. כאשר אין
          תחושת כיוון, כאשר סגנון העבודה לא מהדהד, או כאשר השיטה מרגישה זרה מדי לאחר מספר פגישות, אין הכרח
          לפרש זאת כ"התנגדות" של המטופל לטיפול. לעיתים קרובות זוהי אינדיקציה אמיתית לחוסר התאמה, ואין פסול
          בהמשך החיפוש. כאשר השיטה הנכונה פוגשת את המטפל הנכון בתוך קשר אנושי מאפשר — שם, ורק שם, מתרחש השינוי
          המיוחל.
        </p>

        <p className="signature">
          ד"ר אבשלום גליל, פסיכולוג קליני וחינוכי מדריך
        </p>

        <hr className="my-10 border-stone-200" />

        <h2 className="!text-base !mt-0">מראי מקומות</h2>
        <ol className="references">
          <li>
            A-Tjak, J. G. L., Davis, M. L., Morina, N., Powers, M. B., Smits, J. A. J., & Emmelkamp, P. M. G. (2015).
            A meta-analysis of the efficacy of acceptance and commitment therapy for clinically relevant mental and
            physical health problems. <em>Psychotherapy and Psychosomatics, 84</em>(1), 30–36.
          </li>
          <li>
            Beutler, L. E., Harwood, T. M., Michelson, A., Song, X., & Holman, J. (2011). Resistance/reactance level.{" "}
            <em>Journal of Clinical Psychology, 67</em>(2), 133–142.
          </li>
          <li>
            Constantino, M. J., Boswell, J. F., Coyne, A. E., Swales, T. P., & Kraus, D. R. (2021). Effect of matching
            therapists to patients vs assignment as usual on adult psychotherapy outcomes.{" "}
            <em>JAMA Psychiatry, 78</em>(9), 960–969.
          </li>
          <li>
            Cuijpers, P., Miguel, C., Harrer, M., Plessen, C. Y., Ciharova, M., Ebert, D., & Karyotaki, E. (2023).
            Cognitive behavior therapy vs. control conditions, other psychotherapies, pharmacotherapies and combined
            treatment for depression. <em>World Psychiatry, 22</em>(1), 105–115.
          </li>
          <li>
            Elliott, R., Bohart, A. C., Watson, J. C., & Murphy, D. (2018). Therapist empathy and client outcome: An
            updated meta-analysis. <em>Psychotherapy, 55</em>(4), 399–410.
          </li>
          <li>
            Flückiger, C., Del Re, A. C., Wampold, B. E., & Horvath, A. O. (2018). The alliance in adult
            psychotherapy: A meta-analytic synthesis. <em>Psychotherapy, 55</em>(4), 316–340.
          </li>
          <li>
            Johnson, S. M. (2004). <em>The practice of emotionally focused couple therapy: Creating connections</em>{" "}
            (2nd ed.). Brunner-Routledge.
          </li>
          <li>
            Leichsenring, F., Steinert, C., Rabung, S., & Ioannidis, J. P. A. (2023). The efficacy of psychotherapies
            and pharmacotherapies for mental disorders in adults. <em>World Psychiatry, 22</em>(2), 286–304.
          </li>
          <li>
            Minuchin, S. (1974). <em>Families and family therapy</em>. Harvard University Press.
          </li>
          <li>
            Nielsen, A. C. (2016).{" "}
            <em>A roadmap for couple therapy: Integrating systemic, psychodynamic, and behavioral approaches</em>.
            Routledge.
          </li>
          <li>
            Norcross, J. C., & Wampold, B. E. (2019). Evidence-based therapy relationships: Research conclusions and
            clinical practices. In <em>Psychotherapy relationships that work</em> (3rd ed., Vol. 1, pp. 631–646).
            Oxford University Press.
          </li>
          <li>
            Swift, J. K., Callahan, J. L., Cooper, M., & Parkin, S. R. (2018). The impact of accommodating client
            preference in psychotherapy: A meta-analysis. <em>Journal of Clinical Psychology, 74</em>(11), 1924–1937.
          </li>
        </ol>
      </article>

      {/* CTA */}
      <aside className="mt-12 pt-8 border-t border-stone-200">
        <h2 className="text-xl font-extrabold text-stone-900 mb-2">רוצה עזרה בבחירה?</h2>
        <p className="text-stone-700 leading-7 mb-4">
          השאלון של טיפול חכם מנתח את הצרכים שלך ומציע התאמה אישית — כולל סוג הטיפול המומלץ וסגנון המטפל המתאים.
        </p>
        <Link
          href="/adults"
          className="inline-flex items-center gap-2 rounded-xl bg-[#2e7d8c] px-5 py-2.5 text-sm font-bold text-white hover:opacity-90"
        >
          מלא את השאלון ←
        </Link>
      </aside>

      {/* Related */}
      <nav className="mt-10 pt-6 border-t border-stone-200">
        <h2 className="text-base font-extrabold text-stone-800 mb-3">קריאה נוספת</h2>
        <ul className="space-y-2 text-sm">
          <li>
            <Link href="/research/cbt-vs-dynamic" className="text-[#2e7d8c] hover:underline">
              ← הבדל בין CBT לטיפול דינמי
            </Link>
          </li>
          <li>
            <Link href="/research/therapy-types" className="text-[#2e7d8c] hover:underline">
              ← סוגי הטיפולים השונים
            </Link>
          </li>
          <li>
            <Link href="/research/therapist-types" className="text-[#2e7d8c] hover:underline">
              ← סוגי המטפלים בישראל
            </Link>
          </li>
          <li>
            <Link href="/research/choosing-therapist" className="text-[#2e7d8c] hover:underline">
              ← מה חשוב לבדוק כשבוחרים מטפל?
            </Link>
          </li>
        </ul>
      </nav>

      <style>{`
        .article-body {
          color: #292524;
          font-size: 17px;
          line-height: 1.85;
        }
        .article-body h2 {
          font-size: 1.5rem;
          font-weight: 800;
          color: #1c1917;
          margin-top: 2.5rem;
          margin-bottom: 1rem;
          line-height: 1.3;
        }
        .article-body h3 {
          font-size: 1.1rem;
          font-weight: 700;
          color: #292524;
          margin-top: 1.75rem;
          margin-bottom: 0.5rem;
        }
        .article-body p {
          margin-bottom: 1.1rem;
        }
        .article-body strong {
          color: #1c1917;
          font-weight: 700;
        }
        .article-body ol:not(.references) {
          margin: 1rem 0 1.5rem;
          padding-right: 1.5rem;
        }
        .article-body ol:not(.references) li {
          margin-bottom: 0.5rem;
          list-style-type: decimal;
        }
        .article-body blockquote {
          border-right: 3px solid #2e7d8c;
          padding: 0.25rem 1rem;
          margin: 1.5rem 0;
          color: #44403c;
          font-style: normal;
        }
        .article-body .references {
          font-size: 13px;
          line-height: 1.7;
          color: #57534e;
          padding-right: 1.5rem;
        }
        .article-body .references li {
          margin-bottom: 0.6rem;
          list-style-type: decimal;
        }
        .article-body .signature {
          margin-top: 2.5rem;
          font-weight: 600;
          color: #1c1917;
        }
      `}</style>
    </main>
  );
}
