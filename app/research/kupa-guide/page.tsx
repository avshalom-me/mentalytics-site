import Link from "next/link";
import type { Metadata } from "next";

// M6 (docs/seo-roadmap.md): the kupot layer — real demand at low competition
// ("פסיכולוג ילדים מכבי" 390/mo, "טיפול זוגי מכבי/כללית" 140/mo each). Honest
// YMYL guide: how the public route works post-reform, per-kupa reimbursement
// tracks in RANGES (numbers change — we tell readers to verify), when private
// fits better. Clean scientific-article styling per the site's article design.

const TITLE = "טיפול פסיכולוגי דרך קופת החולים — המדריך המלא";
const DESCRIPTION =
  "איך מקבלים טיפול נפשי דרך כללית, מכבי, מאוחדת ולאומית: מסלול המרפאות, זמני המתנה, החזרים מהביטוח המשלים לטיפול פרטי — ומתי עדיף כל מסלול.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "https://www.mentalytics.co.il/research/kupa-guide" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "https://www.mentalytics.co.il/research/kupa-guide" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: TITLE,
  description: DESCRIPTION,
  inLanguage: "he",
  author: { "@type": "Organization", name: "טיפול חכם" },
  publisher: { "@type": "Organization", name: "טיפול חכם", url: "https://www.mentalytics.co.il" },
  url: "https://www.mentalytics.co.il/research/kupa-guide",
};

const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "האם טיפול פסיכולוגי דרך הקופה באמת חינם?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "טיפול במרפאות בריאות הנפש של הקופות ניתן במסגרת סל הבריאות — בחינם או בהשתתפות עצמית נמוכה. המחיר האמיתי הוא לרוב ההמתנה: בין שבועות לחודשים, תלוי באזור ובמרפאה.",
      },
    },
    {
      "@type": "Question",
      name: "כמה מחזיר הביטוח המשלים על טיפול פרטי?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "ברוב הביטוחים המשלימים ההחזר נע סביב 40%-80% מעלות הפגישה, עד תקרה לפגישה ולמספר פגישות מוגבל בשנה. הסכומים והתנאים משתנים בין הקופות ובין רמות הביטוח — חשוב לוודא באתר הקופה או במוקד לפני שמתחילים.",
      },
    },
    {
      "@type": "Question",
      name: "האם אפשר לבחור את המטפל במסלול הציבורי?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "בחירת המטפל במרפאות הקופה מוגבלת — משובצים לרוב לפי זמינות. בחלק מהקופות קיים גם מסלול מטפלים עצמאיים בהסדר, שבו הבחירה רחבה יותר. במסלול פרטי הבחירה חופשית לחלוטין.",
      },
    },
  ],
};

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-10 mb-3 text-xl font-bold text-stone-900">{children}</h2>;
}

export default function KupaGuidePage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 pb-8" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd).replace(/</g, "\\u003c") }} />

      <Link href="/research" className="text-sm text-stone-500 hover:underline mb-6 inline-block">← חזרה למאמרים ומידע שימושי</Link>

      <h1 className="text-3xl font-black text-stone-900 mb-3">{TITLE}</h1>
      <p className="text-stone-600 leading-8 mb-8">
        מאז רפורמת בריאות הנפש, האחריות לטיפול הנפשי בישראל נמצאת בידי קופות החולים — כלומר, לכל
        מבוטח יש זכות לטיפול פסיכולוגי במסגרת סל הבריאות. בפועל יש שלושה מסלולים שונים מאוד זה
        מזה: המרפאות הציבוריות, מטפלים בהסדר, והחזרים על טיפול פרטי. הנה איך זה עובד באמת —
        כולל החלקים שפחות מספרים עליהם.
      </p>

      <H2>מסלול 1: מרפאות בריאות הנפש של הקופה (הזול ביותר)</H2>
      <p className="text-stone-700 leading-8 mb-4">
        לכל ארבע הקופות — כללית, מכבי, מאוחדת ולאומית — מרפאות בריאות נפש אזוריות (חלקן בהפעלה
        ישירה, חלקן דרך מכונים בהסדר). הטיפול ניתן במסגרת הסל: בחינם או בהשתתפות עצמית נמוכה.
        הדרך פנימה: פנייה לרופא/ת המשפחה לקבלת הפניה, או ישירות למוקד בריאות הנפש של הקופה.
      </p>
      <p className="text-stone-700 leading-8 mb-4">
        <strong>היתרון</strong> ברור — המחיר. <strong>החיסרון המרכזי</strong> הוא ההמתנה: בהתאם
        לאזור ולעומס, ההמתנה לתחילת טיפול נעה בין שבועות לחודשים, ובאזורים מסוימים אף יותר.
        בנוסף, בחירת המטפל מוגבלת (משובצים לפי זמינות), מספר הפגישות עשוי להיות מוגבל, והמעבר
        בין מטפלים אם אין חיבור — מסורבל.
      </p>

      <H2>מסלול 2: מטפלים עצמאיים בהסדר עם הקופה</H2>
      <p className="text-stone-700 leading-8 mb-4">
        חלק מהקופות מפעילות רשימות של פסיכולוגים ומטפלים פרטיים שעובדים בהסדר: הפגישה מתקיימת
        בקליניקה הפרטית של המטפל, והמבוטח משלם השתתפות עצמית מופחתת. זהו מסלול ביניים טוב —
        בחירה רחבה יותר מהמרפאה, מחיר נמוך משמעותית מטיפול פרטי מלא. שווה לבדוק במוקד הקופה אם
        יש מטפלים בהסדר באזורכם ומה זמינותם בפועל.
      </p>

      <H2>מסלול 3: טיפול פרטי + החזר מהביטוח המשלים</H2>
      <p className="text-stone-700 leading-8 mb-4">
        אם יש לכם ביטוח משלים (כללית מושלם/פלטינום, מכבי שלי/זהב, מאוחדת שיא/עדיף, לאומית
        זהב/כסף — לפי הרמה), ברוב המקרים מגיע לכם <strong>החזר חלקי על טיפול פסיכולוגי פרטי</strong>:
        לרוב בטווח של 40%–80% מעלות הפגישה, עד תקרה לפגישה, ולמספר פגישות מוגבל בשנה. התנאים
        משתנים בין קופות, בין רמות ביטוח, ולעיתים דורשים שהמטפל יהיה בעל רישיון ספציפי
        (פסיכולוג מומחה, למשל) — לכן <strong>חובה לוודא במוקד או באתר הקופה לפני שמתחילים</strong>,
        ולשמור קבלות.
      </p>
      <p className="text-stone-700 leading-8 mb-4">
        המשמעות בפועל: פגישה פרטית של 400 ש״ח יכולה לעלות לכם בפועל 100–250 ש״ח אחרי החזר —
        עם התחלה תוך ימים ובחירה חופשית של המטפל. למי שמחזיק ביטוח משלים ממילא, זה לרוב המסלול
        עם היחס הטוב ביותר בין מחיר, מהירות והתאמה.
      </p>

      <H2>אז מה עדיף — ציבורי או פרטי?</H2>
      <p className="text-stone-700 leading-8 mb-4">
        אין תשובה אחת נכונה; יש התאמה למצב:
      </p>
      <ul className="list-disc pr-6 text-stone-700 leading-8 mb-4 space-y-2">
        <li>
          <strong>המסלול הציבורי מתאים</strong> כשהתקציב הוא השיקול המרכזי, כשאין דחיפות, או
          לטיפול ממושך שעלותו הפרטית מצטברת.
        </li>
        <li>
          <strong>המסלול הפרטי מתאים</strong> כשחשוב להתחיל מהר (משבר, החמרה), כשחשובה התאמה
          מדויקת של מטפל (גישה, ניסיון ספציפי, שפה), או כשההמתנה באזורכם ארוכה במיוחד. עם ביטוח
          משלים — הפער הכספי מצטמצם מאוד.
        </li>
        <li>
          <strong>שילוב</strong> הוא לגיטימי: להתחיל פרטי כדי לא להמתין, ובמקביל להיכנס לתור
          הציבורי — או להפך.
        </li>
      </ul>

      <H2>ילדים ונוער</H2>
      <p className="text-stone-700 leading-8 mb-4">
        טיפול רגשי לילדים ולנוער ניתן גם הוא דרך הקופות — במרפאות ילדים ונוער לבריאות הנפש
        ובמכוני התפתחות הילד (לגיל הרך). כאן ההמתנות נוטות להיות ארוכות אף יותר, ולכן הורים
        רבים משלבים: אבחון או התחלת טיפול פרטי, לצד כניסה לתור הציבורי. אם אתם מתלבטים אם
        הקושי בכלל מצריך טיפול — <Link href="/research/therapy-for-child" className="text-[#2e7d8c] font-semibold hover:underline">המדריך שלנו למתי ילד צריך טיפול רגשי</Link> הוא
        נקודת פתיחה טובה, וגם <Link href="/kids" className="text-[#2e7d8c] font-semibold hover:underline">שאלון ההתאמה לילדים ונוער</Link>.
      </p>

      <H2>משרתי מילואים ונפגעי חרדה</H2>
      <p className="text-stone-700 leading-8 mb-4">
        למשרתי מילואים ולנפגעי חרדה קיימים מסלולי זכאות ייעודיים (משרד הביטחון, ביטוח לאומי
        ומסלולים זמניים שהתרחבו בשנים האחרונות) — בנפרד מסל הקופות. פירטנו בהרחבה במדריך
        ייעודי: <Link href="/research/community/החזר-טיפול-נפשי-מילואים-מדריך-זכאות" className="text-[#2e7d8c] font-semibold hover:underline">החזר טיפול נפשי למשרתי מילואים — מדריך זכאות</Link>.
      </p>

      <H2>שאלות נפוצות</H2>
      <div className="space-y-4 mb-4">
        <div>
          <h3 className="font-bold text-stone-900 mb-1">האם הטיפול דרך הקופה באמת חינם?</h3>
          <p className="text-stone-700 leading-8">
            במרפאות הקופה — כן, בחינם או בהשתתפות סמלית. המחיר האמיתי הוא ההמתנה והבחירה
            המוגבלת במטפל.
          </p>
        </div>
        <div>
          <h3 className="font-bold text-stone-900 mb-1">אפשר לקבל החזר על מטפל שמצאתי בעצמי?</h3>
          <p className="text-stone-700 leading-8">
            ברוב הביטוחים המשלימים — כן, בתנאי שהמטפל עומד בדרישות הקופה (סוג רישיון/הכשרה).
            בדקו את התנאים לפני הפגישה הראשונה ושמרו קבלות. כל המטפלים אצלנו מציגים את הכשרתם
            בפרופיל, כך שקל לוודא התאמה לדרישות.
          </p>
        </div>
        <div>
          <h3 className="font-bold text-stone-900 mb-1">כמה זמן ממתינים בפועל במסלול הציבורי?</h3>
          <p className="text-stone-700 leading-8">
            משתנה מאוד בין אזורים ומרפאות — משבועות ועד חודשים רבים. שווה להתקשר למוקד בריאות
            הנפש של הקופה ולשאול על זמן ההמתנה הספציפי באזורכם לפני שמחליטים על מסלול.
          </p>
        </div>
      </div>

      <p className="text-stone-500 text-sm leading-7 mt-8">
        המידע כללי ונכון למועד הכתיבה; תנאי הסל והביטוחים המשלימים משתנים מעת לעת — הנתונים
        המחייבים הם אלה שבאתרי הקופות ובמוקדיהן. אין באמור ייעוץ רפואי או ביטוחי.
      </p>
    </main>
  );
}
