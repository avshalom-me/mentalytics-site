import Link from "next/link";
import { regionToSlug } from "@/app/lib/regions";
import { countListed, MIN_LISTED_FOR_INDEX } from "@/app/lib/therapist-directory";
import { MIN_CITY_TOPIC, PILOT_CITIES } from "@/app/lib/topics";

/**
 * Depth section for the couples-therapy specialty page.
 *
 * Keyword Planner (8/8/2026, geo=IL) put couples and family at 8,480 monthly
 * searches - 63% of all demand in the field across 154 phrases - and the page
 * was 1,074 words that mentioned none of the big ones: ייעוץ זוגי (880),
 * טיפול זוגי מחירים (260), טיפול זוגי מכבי/כללית (280), שיטת אימגו (140).
 *
 * Enriching this page rather than building a new one is deliberate: a second
 * page on the same head term would cannibalise the one that already exists and
 * already carries whatever age it has earned.
 */

/** Cities to offer, beyond the three pilot cities, if supply allows. */
const EXTRA_CITIES = ["רמת גן", "רעננה", "כפר סבא", "הוד השרון", "מודיעין", "קרית אונו"];

const h3 = {
  fontSize: "17px",
  fontWeight: 800,
  color: "var(--text)",
  marginTop: "26px",
  marginBottom: "10px",
} as const;

const p = { fontSize: "15px", lineHeight: 1.85, color: "var(--text-2)", marginBottom: "12px" } as const;

export default async function CouplesDepthSection() {
  // Only offer a city link where that city×topic page is itself indexable -
  // linking to a noindex page spends crawl budget on a dead end and tells a
  // reader we have therapists we do not have.
  const candidates = [...PILOT_CITIES, ...EXTRA_CITIES];
  const cities: { city: string; n: number }[] = [];
  for (const city of candidates) {
    const n = await countListed({ trainingAreasAny: ["טיפול זוגי"], city });
    if (n >= MIN_CITY_TOPIC) cities.push({ city, n });
  }
  const familyCount = await countListed({ trainingAreasAny: ["טיפול משפחתי"] });

  return (
    <section className="mt-12 pt-10" style={{ borderTop: "1px solid var(--line)", maxWidth: "75ch" }}>
      <h2 className="text-xl font-extrabold mb-4" style={{ color: "var(--text)" }}>
        טיפול זוגי - המדריך המלא
      </h2>

      <h3 style={h3}>ייעוץ זוגי או טיפול זוגי - מה ההבדל?</h3>
      <p style={p}>
        שני המונחים משמשים בערבוביה, וההבחנה אינה חדה, אבל יש הבדל שכדאי להכיר. <strong>ייעוץ זוגי</strong>{" "}
        נוטה להיות קצר וממוקד: החלטה שצריך לקבל, קונפליקט מוגדר, שיפור תקשורת בפרק זמן קצוב.{" "}
        <strong>טיפול זוגי</strong> הוא תהליך ארוך יותר שנוגע גם בשורשים - מה כל אחד מביא איתו מבית
        ההורים, אילו פצעים ישנים נדלקים בתוך הקשר. בפועל, רוב הזוגות מתחילים בשאלה קונקרטית
        ומגלים שהיא מובילה עמוק יותר. מה שחשוב אינו השם אלא ההכשרה של מי שיושב מולכם: עבודה
        זוגית היא דיסציפלינה נפרדת מטיפול פרטני.
      </p>

      <h3 style={h3}>מתי כדאי לפנות</h3>
      <p style={p}>
        הסימנים השכיחים: אותה מריבה שחוזרת בגרסאות שונות ולעולם לא נגמרת; ריחוק שהפך לשגרה;
        משבר אמון או בגידה; פערים בהורות שמחלחלים לזוגיות; שינוי גדול שמטלטל את הקשר - לידה,
        פיטורים, מחלה, מעבר. וגם ההפך: זוגות שהקשר ביניהם טוב ורוצים לחזק אותו לפני החלטה גדולה.
      </p>
      <p style={p}>
        הטעות הנפוצה היא לחכות. זוגות רבים מגיעים אחרי שהדפוס כבר התקבע ואחד מבני הזוג כבר
        התייאש - ואז העבודה קשה בהרבה מאשר שנתיים קודם, כשעוד היה כאב ולא אדישות.
      </p>

      <h3 style={h3}>הגישות המרכזיות</h3>
      <p style={p}>
        <strong>EFT (טיפול ממוקד רגש)</strong> עובד על מעגל ההיקשרות - מי רודף ומי מתרחק - ומנסה
        ליצור חוויה רגשית מתקנת בתוך החדר. <strong>שיטת גוטמן</strong> נשענת על מחקר תצפיתי ארוך
        שנים ומתמקדת בדפוסי תקשורת מדידים: ביקורת, בוז, התגוננות והתחמקות.{" "}
        <strong>שיטת אימגו</strong> מבוססת על הרעיון שאנו נמשכים לבן זוג שמעורר בנו פצעים מוקדמים,
        ומלמדת דיאלוג מובנה שמאט את השיחה. <strong>טיפול זוגי דינמי</strong> מתמקד במה שכל אחד
        מביא איתו מההיסטוריה שלו. אין גישה אחת שמנצחת את כולן - ההתאמה לזוג ולמטפל חשובה יותר.
      </p>

      <h3 style={h3}>כמה עולה טיפול זוגי</h3>
      <p style={p}>
        פגישה זוגית פרטית עולה בישראל לרוב בין 400 ל-700 ש&quot;ח - גבוה מפגישה פרטנית, מפני שהיא
        ארוכה יותר (לרוב 75-90 דקות) ודורשת הכשרה נוספת. תהליך טיפוסי נע בין 10 ל-20 פגישות,
        אם כי זה משתנה מאוד. הגורם המשפיע ביותר על המחיר הוא ההכשרה והוותק, לא הגישה.
      </p>

      <h3 style={h3}>טיפול זוגי דרך קופת החולים</h3>
      <p style={p}>
        זו אחת השאלות הנפוצות ביותר, והתשובה הכנה היא שהמצב מבלבל: טיפול זוגי אינו חלק מסל
        הבריאות הבסיסי, ולכן הוא אינו זהה לטיפול נפשי פרטני שהקופה מחויבת לספק. חלק מהביטוחים
        המשלימים כן מציעים החזר חלקי עבור מספר מפגשים, בהיקף ובתנאים שמשתנים בין הקופות
        ומתעדכנים מעת לעת. <strong>לפני שמתחייבים לתשלום מלא, שווה לברר ישירות מול הקופה</strong>{" "}
        מה כלול בביטוח המשלים שלכם ואילו מטפלים מוכרים לצורך החזר.
      </p>

      <h3 style={h3}>טיפול זוגי אונליין</h3>
      <p style={p}>
        עובד טוב יותר משנדמה, ופותח אפשרויות שקליניקה לא תמיד מאפשרת. עדיף ששני בני הזוג יישבו
        באותו חדר, אך אפשר גם ממקומות שונים - כשאחד בנסיעה, במילואים או ברילוקיישן - והטיפול לא
        נקטע. זוגות עם ילדים קטנים חוסכים את תיאום הבייביסיטר, שלא פעם הוא הסיבה האמיתית לדחיית
        פגישות.{" "}
        <Link href="/research/online-therapy" className="font-semibold hover:underline" style={{ color: "var(--teal-dark)" }}>
          מה המחקר אומר על טיפול מרחוק
        </Link>
        .
      </p>

      {familyCount >= MIN_LISTED_FOR_INDEX && (
        <>
          <h3 style={h3}>ומה לגבי טיפול משפחתי?</h3>
          <p style={p}>
            כשהקושי נוגע גם לילדים או לדינמיקה של הבית כולו ולא רק לקשר בין בני הזוג, טיפול משפחתי
            עשוי להתאים יותר.{" "}
            <Link href="/therapists/specialty/טיפול-משפחתי" className="font-semibold hover:underline" style={{ color: "var(--teal-dark)" }}>
              {familyCount} מטפלים משפחתיים במאגר
            </Link>
            .
          </p>
        </>
      )}

      {cities.length > 0 && (
        <>
          <h3 style={h3}>טיפול זוגי לפי אזור</h3>
          <p style={p}>
            רשימות ממוקדות לערים שבהן יש לנו מספיק מטפלים זוגיים. אם עירכם אינה ברשימה, רוב
            המטפלים כאן מטפלים גם אונליין.
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            {cities.map(({ city, n }) => (
              <Link
                key={city}
                href={`/therapists/city/${regionToSlug(city)}/טיפול-זוגי`}
                className="rounded-full px-3.5 py-1.5 text-sm font-semibold hover:bg-[var(--teal-pale)]"
                style={{ border: "1px solid var(--line)", color: "var(--text-2)", textDecoration: "none" }}
              >
                טיפול זוגי ב{city} ({n})
              </Link>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
