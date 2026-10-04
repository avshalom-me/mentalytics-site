import Link from "next/link";
import { regionToSlug } from "@/app/lib/regions";
import { countListed, MIN_LISTED_FOR_INDEX } from "@/app/lib/therapist-directory";
import { MIN_CITY_TOPIC, PILOT_CITIES } from "@/app/lib/topics";
import { onlineTwinFor } from "@/app/lib/online-twin";

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
 *
 * Revised 4/10/2026, when a second guide was about to be written. The page did
 * not lack a guide; it said the same things two and three times. When to come
 * was told here and again under "מה חשוב לדעת"; that couples work needs its own
 * training was said in both; and the approaches were explained here (four of
 * them) and again in the deep dive below (three, "the three central ones"),
 * with EFT and the dynamic approach in both. So now each subject has one home:
 *   - this guide: what it is, when to come, the first sessions, a partner who
 *     will not come, how to choose a therapist, what the research found, cost
 *     and the ways to pay less;
 *   - the deep dive below (SPECIALTY_DEEP_DIVE in specialties.ts): each
 *     approach, once. This guide only names them and points there;
 *   - the online twin (online-copy.ts): how to prepare for couples therapy by
 *     video. It was word for word here too; now this guide links to it.
 * Before adding a paragraph, look for the subject in those three first.
 *
 * What was missing is what Search Console showed people asking and the page
 * not saying (90 days to 4/10/2026, 2,580 impressions for "זוגי", position 43):
 * מטפל זוגי / מטפלת זוגית / פסיכולוג זוגי (who is qualified), טיפול זוגי פרטני (a
 * partner who will not come), טיפול זוגי מסובסד and the municipal stations.
 *
 * The new blocks are data-nosnippet: the line that converts in a search result
 * is the one about the questionnaire (the owner's rule, 24/9/2026), and these
 * are full of the page's head terms, so Google would quote them in its place.
 * The attribute sits on a div because Google honours it on span, div and
 * section only.
 *
 * Every fact added on 4/10/2026 was read at its source that day - the two
 * papers on PubMed, the certification terms on the association's site, the
 * health-fund entitlement on Maccabi's page, the stations on three
 * municipalities' pages. They are listed at the bottom of the section. The
 * price range and the paragraph on supplementary insurance are from 8/8/2026
 * and were left as they were.
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

const link = { className: "font-semibold hover:underline", style: { color: "var(--teal-dark)" } } as const;

// `english` sets the entry's own direction: inside a right-to-left list an
// English reference otherwise ends with its full stop on the wrong side.
const SOURCES: { text: string; href: string; english?: boolean }[] = [
  {
    text: "Roddy, M. K., Walsh, L. M., Rothman, K., Hatch, S. G., & Doss, B. D. (2020). Meta-analysis of couple therapy: Effects across outcomes, designs, timeframes, and other moderators. Journal of Consulting and Clinical Psychology, 88(7), 583-596.",
    href: "https://doi.org/10.1037/ccp0000514",
    english: true,
  },
  {
    text: "Doherty, W. J., Harris, S. M., Hall, E. L., & Hubbard, A. K. (2021). How long do people wait before seeking couples therapy? A research note. Journal of Marital and Family Therapy, 47(4), 882-890.",
    href: "https://doi.org/10.1111/jmft.12479",
    english: true,
  },
  {
    text: "האגודה הישראלית לטיפול זוגי ומשפחתי: תנאי ההסמכה למטפל/ת זוגי/ת ומשפחתי/ת (נקרא ב-4.10.2026).",
    href: "https://mishpaha.org.il/%D7%9E%D7%98%D7%A4%D7%9C%D7%99%D7%9D/%D7%94%D7%9B%D7%99%D7%A8%D7%95-%D7%AA%D7%95-%D7%9E%D7%98%D7%A4%D7%9C/",
  },
  {
    text: "מכבי שירותי בריאות: טיפול ותמיכה משפחתית בבריאות הנפש - תנאי הזכאות (עודכן ב-29.7.2026).",
    href: "https://www.maccabi4u.co.il/eligibilites/55646/",
  },
];

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
  const onlineTwin = await onlineTwinFor("טיפול זוגי");

  return (
    <section className="mt-12 pt-10" style={{ borderTop: "1px solid var(--line)", maxWidth: "75ch" }}>
      <h2 className="text-xl font-extrabold mb-4" style={{ color: "var(--text)" }}>
        טיפול זוגי - המדריך המלא
      </h2>

      <p style={p}>
        בטיפול זוגי &apos;המטופל&apos; הוא הקשר עצמו: לומדים לזהות את מעגלי התקשורת שחוזרים על עצמם -
        ביקורת שמולידה התגוננות, ריחוק שמוליד מרדף - ולבנות דפוס חדש. המטפל אינו שופט מי צודק; הוא
        עוזר לשניים לצאת מהמעגל.
      </p>

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
        משבר אמון או בגידה; פערים בהורות או באינטימיות שמחלחלים לזוגיות; שינוי גדול שמטלטל את
        הקשר - לידה, פיטורים, מחלה, מעבר. וגם ההפך: זוגות שהקשר ביניהם טוב ורוצים לחזק אותו לפני
        החלטה גדולה.
      </p>
      <p style={p}>
        הטעות הנפוצה היא לחכות. זוגות רבים מגיעים אחרי שהדפוס כבר התקבע ואחד מבני הזוג כבר
        התייאש - ואז העבודה קשה בהרבה מאשר שנתיים קודם, כשעוד היה כאב ולא אדישות.
      </p>

      <div data-nosnippet>
        <h3 style={h3}>מה קורה בפגישות הראשונות</h3>
        <p style={p}>
          הפגישות הראשונות מוקדשות להיכרות: מה מביא אתכם דווקא עכשיו, איך כל אחד מכם רואה את הקושי,
          ומה הייתם רוצים שישתנה. הבסיס הוא עבודה משותפת, כששניכם בחדר. יש מטפלים שמוסיפים בהמשך
          פגישה נפרדת עם כל אחד מבני הזוג, ואפשר לשאול על כך כבר בשיחת ההיכרות. לקראת סוף שלב
          ההיכרות מטפלים רבים מסכמים איתכם על מה עובדים, כדי שלשניכם יהיה ברור לאן הטיפול מכוון.
        </p>
        <p style={p}>
          על הפגישה הראשונה בטיפול בכלל, מה שואלים בה ואיך מתכוננים:{" "}
          <Link href="/research/first-session" {...link}>
            הפגישה הראשונה אצל פסיכולוג
          </Link>
          .
        </p>

        <h3 style={h3}>ומה אם בן או בת הזוג לא רוצים לבוא?</h3>
        <p style={p}>
          זה מצב שכיח. אפשר להתחיל לבד: גם טיפול פרטני יכול להתמקד בקשר הזוגי (יש מי שמכנה זאת
          טיפול זוגי פרטני), בחלק שלכם בדפוס ובאופן שבו אתם מגיבים, ויש זוגות שבהם הצד השני מצטרף
          בהמשך. גם את{" "}
          <Link href="/adults" {...link}>
            שאלון ההתאמה
          </Link>{" "}
          אפשר למלא לבד ולסמן בו את תחום הזוגיות, וההמלצה תתייחס לכך.
        </p>
      </div>

      <h3 style={h3}>הגישות המרכזיות</h3>
      <p style={p}>
        הגישות המרכזיות הן טיפול ממוקד רגש (EFT), שיטת גוטמן, שיטת אימגו, הגישה הדינמית והגישה
        המבנית. אין גישה אחת שמנצחת את כולן - ההתאמה לזוג ולמטפל חשובה יותר.{" "}
        <a href="#deep-dive" {...link}>
          פירוט על כל אחת מהגישות
        </a>{" "}
        בהמשך העמוד.
      </p>

      <div data-nosnippet>
        <h3 style={h3}>איך בוחרים מטפל זוגי או מטפלת זוגית</h3>
        <p style={p}>
          בישראל אין חוק שמחייב הכשרה מקצועית כדי לעסוק בטיפול זוגי, וכל אחד יכול להציג את עצמו
          כמטפל זוגי או כיועץ זוגי. לכן כדאי לבדוק שני דברים: תואר שני במקצוע טיפולי, כמו פסיכולוגיה
          או עבודה סוציאלית, והכשרה ייעודית לעבודה עם זוגות. גם &apos;פסיכולוג זוגי&apos; אינו תואר
          רשמי: מי שמנוסה בטיפול פרטני אינו בהכרח מי שהוכשר לעבוד עם שניים.
        </p>
        <p style={p}>
          התעודה המקובלת בתחום היא &apos;מטפל/ת זוגי/ת ומשפחתי/ת מוסמך/ת&apos; של האגודה הישראלית
          לטיפול זוגי ומשפחתי. היא ניתנת אחרי תואר שני טיפולי, שלוש שנות לימודי תעודה בטיפול זוגי
          ומשפחתי ו-750 שעות התמחות בהדרכה. יש גם מטפלים מנוסים בלי התעודה הזאת, ואז שווה לשאול
          איפה למדו טיפול זוגי וכמה שנים הם עובדים עם זוגות.
        </p>
        <p style={p}>
          ומה עם &apos;מטפל זוגי מומלץ&apos;? המלצה של חברים מלמדת שהמטפל התאים להם, לא בהכרח שיתאים
          לכם. סימן טוב יותר הוא ששניכם, ולא רק אחד מכם, יוצאים מהפגישות הראשונות בתחושה שהקשיבו
          לכם. עוד על הבחירה:{" "}
          <Link href="/research/choosing-therapist" {...link}>
            איך למצוא מטפל שמתאים
          </Link>
          .
        </p>

        <h3 style={h3}>האם טיפול זוגי עוזר? מה אומר המחקר</h3>
        <p style={p}>
          מטא-אנליזה מ-2020, שסיכמה 58 מחקרים ו-2,092 זוגות, מצאה שטיפול זוגי משפר במידה ניכרת את
          שביעות הרצון מהקשר, ושהשיפור נשמר ברובו גם במעקב. זוגות שחיכו ברשימת המתנה, לעומת זאת, לא
          השתפרו באופן מובהק. המחקרים עסקו בזוגות של גבר ואישה בלבד, ולכן הממצא נבדק פחות אצל
          זוגות אחרים.
        </p>
        <p style={p}>
          ומי שחושש שחיכה יותר מדי: נהוג לצטט שזוגות מחכים שש שנים לפני שהם פונים, אבל למספר הזה
          בסיס מחקרי דל. במחקר שבדק 270 פונים לטיפול זוגי עברו בממוצע כשנתיים ושמונה חודשים
          מתחילת הבעיות ועד הטיפול, ורובם הגדול פנו בתוך שנתיים. מסקנת החוקרים: אין סיבה להניח שרוב
          הזוגות מגיעים מאוחר מכדי שאפשר יהיה לעזור.
        </p>
      </div>

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
      <p style={p}>
        יוצא מן הכלל: כשאחד מבני המשפחה אובחן עם קושי נפשי, והגורם שמטפל בו מפנה את המשפחה
        לטיפול משפחתי, הטיפול ניתן במסגרת הסל ובהשתתפות עצמית. כך, למשל, בדף הזכאות של מכבי.
      </p>

      <div data-nosnippet>
        <h3 style={h3}>טיפול זוגי במחיר מסובסד</h3>
        <p style={p}>
          בחלק מהרשויות המקומיות פועלת תחנה לטיפול זוגי ומשפחתי מטעם שירותי הרווחה, לתושבי
          הרשות. המטפלים בה הם אנשי מקצוע, והתשלום מסובסד; יש תחנות שבהן הוא נקבע לפי מבחן הכנסה.
          פונים ישירות לתחנה או דרך האגף לשירותים חברתיים ברשות.
        </p>
        <p style={p}>
          למשרתי מילואים: קרן הסיוע משתתפת גם בייעוץ ובטיפול זוגי. התנאים והסכומים ב
          <Link href="/research/community/החזר-טיפול-נפשי-מילואים-מדריך-זכאות" {...link}>
            מדריך ההחזרים למילואים
          </Link>
          .
        </p>
      </div>

      <h3 style={h3}>טיפול זוגי אונליין</h3>
      <p style={p}>
        עובד טוב יותר משנדמה, גם כששניכם יושבים באותו חדר מול המסך וגם כשאחד מכם רחוק.{" "}
        {onlineTwin && (
          <>
            איך נערכים לזה, ומי המטפלים שעובדים כך:{" "}
            <Link href={onlineTwin.href} {...link}>
              {onlineTwin.label}
            </Link>
            .{" "}
          </>
        )}
        <Link href="/research/online-therapy" {...link}>
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
            <Link href="/therapists/specialty/טיפול-משפחתי" {...link}>
              למטפלים המשפחתיים במאגר
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
            {cities.map(({ city }) => (
              <Link
                key={city}
                href={`/therapists/city/${regionToSlug(city)}/טיפול-זוגי`}
                className="rounded-full px-3.5 py-1.5 text-sm font-semibold hover:bg-[var(--teal-pale)]"
                style={{ border: "1px solid var(--line)", color: "var(--text-2)", textDecoration: "none" }}
              >
                טיפול זוגי ב{city}
              </Link>
            ))}
          </div>
        </>
      )}

      <div data-nosnippet className="mt-8">
        <h3 style={{ ...h3, fontSize: "14px", marginTop: 0 }}>מקורות</h3>
        <ol className="list-decimal space-y-1.5" style={{ paddingInlineStart: "20px", fontSize: "13px", lineHeight: 1.7, color: "var(--muted)" }}>
          {SOURCES.map((s) => (
            <li key={s.href}>
              <a href={s.href} target="_blank" rel="noopener noreferrer" dir={s.english ? "ltr" : undefined}
                className="hover:underline" style={{ color: "var(--muted)" }}>
                {s.text}
              </a>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
