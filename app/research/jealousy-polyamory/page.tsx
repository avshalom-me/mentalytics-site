import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { ResearchBreadcrumbLd } from "@/app/components/ResearchBreadcrumbLd";
import ArticleShell from "@/app/components/ArticleShell";
import { therapistPath } from "@/app/lib/therapist-url";

/**
 * Guest article by Dr Daniel Heiman, distilled from a chapter of his doctoral
 * research on polyamory. Authored by him, not by the house or by me - so the
 * byline, the Article schema author and the closing card all point at his
 * therapist profile rather than at the site author used elsewhere in /research.
 */

const BASE_URL = "https://www.mentalytics.co.il";
const URL = `${BASE_URL}/research/jealousy-polyamory`;

const AUTHOR_ID = "d4954f74-8361-424c-bcd7-a490cfc427ba";
const AUTHOR_NAME = 'ד"ר דניאל היימן';
const AUTHOR_PATH = therapistPath(AUTHOR_ID, AUTHOR_NAME);

const TITLE = "מה שקנאה מלמדת על כל זוגיות";
const DESCRIPTION =
  "קנאה היא לא סימן שמשהו רע קורה, אלא מידע. מתוך מחקר דוקטורט על פוליאמוריה: למה חוקים לא מחליפים הקשבה, מה מסתתר מאחורי \"אני לא חשוב לך\", ואיך משפט אחד משנה שיחה שלמה.";
const HERO =
  "https://images.unsplash.com/photo-1543269865-cbf427effbad?w=1200&h=630&fit=crop&auto=format&q=80";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "קנאה בזוגיות",
    "פוליאמוריה",
    "קשר פתוח",
    "תקשורת בזוגיות",
    "תקשורת מקרבת",
    "טיפול זוגי",
    "קנאה",
    "רכושנות בזוגיות",
  ],
  alternates: { canonical: URL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: URL,
    type: "article",
    locale: "he_IL",
    siteName: "טיפול חכם",
    images: [{ url: HERO, width: 1200, height: 630, alt: "זוג משוחח" }],
  },
};

const articleLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: TITLE,
  description: DESCRIPTION,
  inLanguage: "he",
  datePublished: "2026-08-09",
  dateModified: "2026-08-09",
  // The guest author, by name and by profile URL - this is his work.
  author: {
    "@type": "Person",
    name: AUTHOR_NAME,
    jobTitle: "פסיכולוג קליני",
    url: `${BASE_URL}${AUTHOR_PATH}`,
  },
  publisher: { "@type": "Organization", name: "טיפול חכם", url: BASE_URL },
  url: URL,
  image: HERO,
  articleSection: "זוגיות ומשפחה",
  isPartOf: { "@type": "WebSite", name: "טיפול חכם", url: BASE_URL },
};

const h2 = {
  fontSize: "21px",
  fontWeight: 800,
  color: "var(--text)",
  marginTop: "34px",
  marginBottom: "12px",
} as const;

export default function JealousyPolyamoryPage() {
  return (
    <ArticleShell
      href="/research/jealousy-polyamory"
      title="מה שקנאה מלמדת על כל זוגיות"
      sectionSlug="זוגיות-ומשפחה"
      author={{ name: AUTHOR_NAME, role: "פסיכולוג קליני", href: AUTHOR_PATH }}
    >
      <ResearchBreadcrumbLd slug="jealousy-polyamory" title={TITLE} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd).replace(/</g, "\\u003c") }}
      />

      <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--teal)", letterSpacing: ".14em", marginBottom: "10px" }}>
        זוגיות ומשפחה
      </p>
      <h1 className="text-3xl font-black text-stone-900 mb-2">דווקא לפאב שלנו?</h1>
      <p style={{ fontSize: "18px", fontWeight: 600, color: "var(--text-2)", marginBottom: "18px" }}>
        מה שקנאה מלמדת על כל זוגיות
      </p>

      <div className="mb-8 overflow-hidden rounded-2xl" style={{ border: "1px solid var(--line)" }}>
        <Image
          src={HERO}
          alt="זוג יושב ומשוחח"
          width={1200}
          height={630}
          priority
          style={{ width: "100%", height: "auto", display: "block" }}
        />
      </div>

      <div
        className="mb-8 rounded-2xl p-5"
        style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
      >
        <p style={{ fontSize: "14.5px", lineHeight: 1.8, color: "var(--text-2)" }}>
          המאמר נכתב על ידי{" "}
          <Link href={AUTHOR_PATH} className="font-bold hover:underline" style={{ color: "var(--teal-dark)" }}>
            {AUTHOR_NAME}
          </Link>
          , פסיכולוג קליני, כגרסה מקוצרת ונגישה של פרק ממחקר הדוקטורט שלו על פוליאמוריה.
        </p>
      </div>

      <article className="space-y-5 text-stone-700 leading-8 text-base">
        <p>
          ערב שלישי במטבח. טלי מספרת לצביקה, תוך כדי שהיא קוצצת סלט, שאתמול יצאה לבלות עם צחי,
          אהוב שהיא בקשר איתו. צביקה ידע על הבילוי מראש, זו לא היתה הפתעה מבחינתו. ההפתעה היא
          המקום: הפאב הקטן עם הפינה ליד החלון, זה שבו הוא וטלי חגגו כל יום הולדת. משהו נצבט לו
          בחזה, והמשפטים כבר נדחפים החוצה: &quot;דווקא לשם? לא היה עוד מקום בעיר?&quot;. עוד שנייה
          הוא יגיד לה שהיא אטומה, שהיא בכלל לא חשבה עליו.
        </p>
        <p>אבל רגע. מה הוא בעצם מרגיש?</p>
        <p>
          השאלה התמימה הזו היא מהקשות שיש, והיא עומדת במרכז פרק ממחקר הדוקטורט של{" "}
          <Link href={AUTHOR_PATH} className="font-semibold hover:underline" style={{ color: "var(--teal-dark)" }}>
            ד&quot;ר דניאל היימן
          </Link>
          , שעוסק בפוליאמוריה: קשרים שבהם, בידיעה ובהסכמה של כל הצדדים, אדם מקיים יותר מקשר אהבה
          אחד. ומה שעולה משם רלוונטי הרבה מעבר לפוליאמוריה. הוא נוגע בכל מי שאהב מישהו ופחד לאבד
          אותו.
        </p>

        <h2 style={h2}>הקנאה, בהגדלה</h2>
        <p>
          ייתכן וחלק גדול מהקוראים של המאמר אינם פוליאמורים, וזה בסדר גמור. פוליאמוריה מעניינת
          אותנו כאן כי היא עובדת כמו זכוכית מגדלת: כשנכנס לתמונה אדם שלישי, גלוי ומוסכם, הרגשות
          שקיימים בכל זוגיות מופיעים בענק. הקנאה, הפחד להיות מוחלפים, הצורך לדעת שאנחנו עדיין הכי
          חשובים למישהו. אי אפשר להעמיד פנים שזה לא שם.
        </p>
        <p>
          אבל אותם רגשות חיים גם בזוגיות של שניים. הם מתעוררים כשבן הזוג נשאר לצחוק עוד קצת עם
          הקולגה, כשאקסית שולחת הודעה, כשחברה טובה תופסת פתאום הרבה מקום, לפעמים אפילו כשהאדם
          שאנחנו אוהבים נראה חופשי ושמח דווקא במקום אחר. הפוליאמוריה לא ממציאה את הקנאה, היא רק
          מגבירה את הווליום. ומי שחי בתוכה נדרש לפתח, פשוט כדי לחיות טוב, מיומנויות להתמודדות עם
          קנאה שכולנו זקוקים להן.
        </p>

        <h2 style={h2}>פחות חוקים, יותר הקשבה</h2>
        <p>
          אחת הטענות המרכזיות במחקר פשוטה לניסוח וקשה ליישום: כשרגשות מדוברים וזוכים להתייחסות,
          הצורך בחוקים ובשליטה קטן. זוגות מכל הסוגים מנסים לא פעם לנהל כאב באמצעות חקיקה: אל
          תיפגשי איתו יותר מפעם בשבוע, תמחק אותה, תחזרי עד חצות. לפעמים גבולות והסכמות באמת
          נחוצים, הם מגנים על הזמן המשותף ועל תחושת היציבות. הקושי מתחיל כשהחוק הופך לתחליף
          להקשבה.
        </p>
        <p>
          חוק שנקבע מראש הוא כמעט תמיד גס מדי למציאות שמשתנה כל הזמן. הוא לא יודע להבחין בין ערב
          שבו בן הזוג זקוק למרחב לבין תקופה שבה הוא מרגיש נטוש וזקוק לקרבה, ולא בין ויתור שנעשה
          מאהבה לבין ציות שמצטבר בשקט לכדי טינה. ההבדל האמיתי אינו בין מותר לאסור, אלא בין ציות
          לאמפתיה. מי שבוחר להיפגש עם אהובה חדשה קצת פחות, כי הוא רואה שבת זוגו מתקשה כרגע עם
          קנאה, נמצא במקום אחר לגמרי ממי שמציית לסעיף בחוזה: הוויתור מדויק לרגע, נעשה מבחירה,
          והחופש נפגע הרבה פחות.
        </p>
        <p>
          ויש במחקר תצפית מפתיעה נוספת: לפעמים דווקא מפגש כנה ואינטימי עם האהוב השני מרכך את
          הרכושנות. דמות מאיימת מרחוק נראית כמי שבא לגנוב אהבה. מקרוב, לפעמים, מתגלה אדם שלם
          שמחפש בדיוק כמונו קשר, קרבה ומשמעות. ההיכרות לא בהכרח מעלימה את הקנאה, אבל היא עשויה
          לרכך את הסיפור הרכושני שנבנה סביבה.
        </p>

        <h2 style={h2}>שני משפטים, שני עולמות</h2>
        <p>
          נחזור לצביקה במטבח. הדחף הראשון שלו הוא להעביר את הכאב הלאה, כמו כדור חם מדי להחזיק
          ביד: &quot;גרמת לי להרגיש לא חשוב כשהתעקשת לצאת דווקא לפאב שלנו&quot;. זה מנגנון אנושי
          עתיק. כשקשה לשאת רגש, אנחנו משליכים אותו על האחר, ולפעמים גם מזלזלים בו קצת בדרך, כדי
          שהדימוי העצמי שלנו יישאר שלם. אלא שכשאנחנו מנותקים ממה שקורה בתוכנו, גם התקשורת שלנו
          יוצאת צרה ומוטה.
        </p>
        <p>
          אני נשען כאן על התקשורת המקרבת של מרשל רוזנברג, ומעמיד זה מול זה שני משפטים שנשמעים
          כמעט אותו דבר. &quot;גרמת לי להרגיש לא חשוב&quot; הוא כתב אישום, והוא מזמין קו הגנה.
          &quot;כשיצאת עם צחי לפאב, הרגשתי חלש ובודד&quot; הוא חשיפה, והיא מזמינה קרבה. קל יותר
          להאשים מאשר להיחשף, אבל ההאשמה סוגרת דלת והפגיעוּת פותחת אותה.
        </p>
        <p>
          מאחורי זה עומד רעיון עמוק: הרגשות שלנו שייכים לנו. מעשיו של האחר יכולים להצית אותם, אבל
          הם לא כל הסיפור. חשוב לא להיתפס כאן לצד השני: לקחת אחריות על רגש אינו אומר שהכול
          &quot;רק בראש שלנו&quot;, ולא שמותר לאחרים להתעלם מאיתנו או לפגוע בנו. זה פשוט מפריד
          בין האירוע שהצית את הכאב לבין הסיפור המוחלט שסיפרנו עליו. את אותו ערב עצמו צביקה יכול
          היה לפגוש בקנאה, בכעס, בתחושת חולשה ובדידות, בתערובת של הכול, ואולי בכלל בהקלה ובהנאה
          מערב חופשי. כשמנסחים &quot;הרגשתי כך&quot;, בלי פרשנות על כוונותיו של האחר, הצד השני
          יכול סוף סוף להקשיב בלי להתגונן.
        </p>

        <h2 style={h2}>מה מסתתר מאחורי &quot;אני לא חשוב לך&quot;</h2>
        <p>
          המשפט &quot;אני לא חשוב בעינייך&quot; נשמע כמו רגש, אבל הוא כמעט אף פעם לא הסיפור המלא.
          מאחוריו מסתתרים רגשות רבים, לפעמים סותרים, שחלקם נדחקים למקום שאין לנו אליו גישה ישירה.
          ההגנות האלה עושות עבודה חשובה, הן מרחיקות כאב. אבל אותה הרחקה עצמה חוסמת גם עיבוד
          ושינוי. אי אפשר לעבד רגש שאנחנו עסוקים בלהוכיח שהוא בעצם שייך למישהו אחר.
        </p>
        <p>
          מצד שני, יש בנו גם דחף להגיע אל האמת, אפילו כשאינה נעימה. כשאדם מצליח לתפוס רגש במילים
          מדויקות, &quot;אני מרגיש קטן&quot;, &quot;אני מפחד שאיעלם לך&quot;, קורה משהו כפול:
          היקרים לו יכולים סוף סוף לעזור, והוא עצמו מפסיק להילחם בעצמו. אנחנו מדחיקים פגיעוּת כדי
          להיראות חזקים, אבל דווקא האומץ לגעת בחלקים הרכים הוא שמוליד שיחה ששווה משהו.
        </p>

        <h2 style={h2}>לשבת עם מה שיש</h2>
        <p>
          איך מתאמנים על זה? אפשרות אחת היא תרגול מדיטטיבי, או מיינדפולנס בשמו המוכר, כדרך אימון
          ופיתוח של שתי יכולות חשובות. הראשונה היא ריכוז והתבוננות: לשים לב לנשימה, לגוף, לרגש
          שנמצא כאן עכשיו. השנייה עדינה יותר, ובמסורת הבודהיסטית קוראים לה שוויון נפש: להתבונן
          ברגש בלי להתאחד איתו, בלי להיאחז בנעים ובלי לברוח מהלא נעים.
        </p>
        <p>
          לפי אותה מסורת, שורש הסבל אינו הרגש עצמו אלא ההיאחזות והדחייה שסביבו. כולנו מכירים את זה
          מהחיים הקטנים: לרצות עוד משולש פיצה כדי שהעונג לא ייגמר, ובאותו רגע ממש לרצות להעלים את
          כאב הבטן ואת נקיפות המצפון. רגשות סותרים גרים בנו יחד כל הזמן. אפשר להתחיל אפילו בדקה
          אחת לפני שיחה קשה: להרגיש את הנשימה, לשים לב לכיווץ בבטן, לזהות את הדחף לתקוף, ולשאול
          בשקט מה עוד נמצא כאן. ככל שאנחנו ערים ליותר מהרגשות שמפעילים אותנו, כך גדלה הבחירה שלנו,
          במקום שהם יבחרו בשבילנו.
        </p>

        <h2 style={h2}>ובחזרה למטבח</h2>
        <p>
          בגרסה אחת של הערב ההוא, צביקה יורה את &quot;גרמת לי להרגיש לא חשוב&quot;, טלי מתגוננת,
          והם הולכים לישון גב אל גב. בגרסה אחרת הוא לוקח נשימה, מחזיק רגע את הכדור ביד, ואומר:
          &quot;כשסיפרת על הפאב, הרגשתי פתאום קטן. כאילו היה לנו מקום שהוא רק שלנו, ועכשיו אני כבר
          לא בטוח&quot;. מול משפט כזה טלי לא צריכה עורך דין. היא יכולה פשוט להתקרב.
        </p>
        <p>
          לא צריך להיות פוליאמורים בשביל הרגע הזה. צריך רק, בפעם הבאה שמשהו נצבט בחזה, לעצור
          שנייה לפני המשפט שמתחיל ב&quot;את תמיד&quot; או ב&quot;אתה אף פעם&quot;, ולשאול בשקט: מה
          אני מרגיש עכשיו, באמת? לפעמים התשובה תפתיע. לפעמים קשה למצוא אותה לבד, וגם זה אנושי
          לגמרי. בשביל זה יש שיחות ארוכות אל תוך הלילה, חברים קרובים, ולפעמים גם חדר טיפולים שקט.
          הדלת שנפתחת פנימה היא כמעט תמיד הדלת החשובה בבית.
        </p>

        {/* Author card - the article is his, and the link is the point of
            publishing a guest piece at all. */}
        <div
          className="mt-10 rounded-2xl p-6"
          style={{ background: "var(--teal-pale)", border: "1px solid var(--teal-mid)" }}
        >
          <p style={{ fontSize: "12px", fontWeight: 800, color: "var(--muted)", letterSpacing: ".1em", marginBottom: "8px" }}>
            על הכותב
          </p>
          <Link href={AUTHOR_PATH} className="text-lg font-black hover:underline" style={{ color: "var(--teal-dark)" }}>
            {AUTHOR_NAME}
          </Link>
          <p className="mt-1 text-sm font-semibold" style={{ color: "var(--teal)" }}>
            פסיכולוג קליני
          </p>
          <p className="mt-3 text-sm leading-7" style={{ color: "var(--text-2)" }}>
            המאמר מבוסס על פרק ממחקר הדוקטורט שלו על פוליאמוריה. בקליניקה עובד בטיפול דינאמי, CBT,
            ACT, טיפול זוגי והדרכת הורים.
          </p>
          <Link
            href={AUTHOR_PATH}
            className="mt-4 inline-block rounded-full px-5 py-2.5 text-sm font-bold"
            style={{ background: "var(--teal)", color: "#fff", textDecoration: "none" }}
          >
            לפרופיל המלא ←
          </Link>
        </div>

        <div className="rounded-2xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <h2 className="mb-3 text-base font-extrabold" style={{ color: "var(--text)" }}>
            קריאה נוספת
          </h2>
          <ul className="space-y-2 text-sm">
            {[
              { href: "/therapists/specialty/טיפול-זוגי", label: "מטפלים זוגיים מוסמכים - המדריך המלא" },
              { href: "/research/which-therapy", label: "איזה טיפול פסיכולוגי מתאים לי?" },
              { href: "/research/choosing-therapist", label: "מה חשוב לבדוק כשבוחרים מטפל?" },
            ].map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:underline" style={{ color: "var(--teal-dark)" }}>
                  ← {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </article>
    </ArticleShell>
  );
}
