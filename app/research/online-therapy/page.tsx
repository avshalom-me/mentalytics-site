import Link from "next/link";
import type { Metadata } from "next";
import { ResearchBreadcrumbLd } from "@/app/components/ResearchBreadcrumbLd";
import ArticleShell from "@/app/components/ArticleShell";
import { siteAuthorRef, SITE_AUTHOR, SITE_AUTHOR_PATH } from "@/app/lib/author";
import { countListed } from "@/app/lib/therapist-directory";

// The title used to be "טיפול אונליין - כן או לא?" - a question title carrying
// none of the cluster's head phrases. A 3-model SERP panel (5/8/26) found the
// competitors ranking for this cluster all put "טיפול פסיכולוגי אונליין" in the
// title; the question intent ("האם זה עובד") stays, phrased with the head term.
const TITLE = "טיפול פסיכולוגי אונליין - האם זה עובד ולמי מתאים?";

export const metadata: Metadata = {
  alternates: { canonical: "https://www.mentalytics.co.il/research/online-therapy" },
  title: TITLE,
  description:
    "האם טיפול פסיכולוגי אונליין באמת עובד? מה מראים המחקרים על יעילותו מול טיפול פנים מול פנים, למי הוא פחות מתאים, ואיך בוחרים פסיכולוג אונליין או מטפל לטיפול מרחוק.",
};

// Refresh hourly so the live therapist count in the CTA tracks the directory.
export const revalidate = 3600;

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": TITLE,
  "description": "האם טיפול פסיכולוגי אונליין עובד? מה המחקר אומר, מתי עדיף פנים מול פנים, ואיך בוחרים פסיכולוג אונליין לטיפול מרחוק.",
  "inLanguage": "he",
  // Named clinician + team, matching the site-wide byline decision - an
  // Organization-only author was the E-E-A-T gap the panel flagged here.
  "author": [siteAuthorRef(), { "@type": "Organization", "name": "צוות טיפול חכם" }],
  "dateModified": "2026-08-05",
  "publisher": { "@type": "Organization", "name": "טיפול חכם", "url": "https://www.mentalytics.co.il" },
  "url": "https://www.mentalytics.co.il/research/online-therapy",
};

export default async function OnlineTherapyPage() {
  const onlineCount = await countListed({ online: true });
  return (
    <ArticleShell
      href="/research/online-therapy"
      title="טיפול פסיכולוגי אונליין"
      sectionSlug="מסגרת-עלות-וזכויות"
      author={{ name: SITE_AUTHOR.name, role: SITE_AUTHOR.jobTitle, href: SITE_AUTHOR_PATH }}
    >
      <ResearchBreadcrumbLd slug="online-therapy" title={TITLE} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <h1 className="text-3xl font-black text-stone-900 mb-3">{TITLE}</h1>

      {/* Article */}
      <div className="mb-10 space-y-5 text-stone-700 leading-8 text-base">
        <p>
          בשנים האחרונות, ובמיוחד מאז הטלטלה שהביאה איתה תקופת הקורונה, עולם הטיפול הנפשי עבר שינוי מרחיק לכת. מה שנתפס בעבר כפתרון דחוק או כברירת מחדל לאירועי חירום, הפך לחלק בלתי נפרד מהיומיום של מטופלים ומטפלים רבים. המעבר לטיפול אונליין הוא הרבה מעבר לשינוי טכני; הוא מגדיר מחדש את האופן שבו אנחנו תופסים את המרחב הטיפולי. בראש ובראשונה, מדובר במהפכה של נגישות. הגמישות המרחבית והחיסכון המשמעותי בזמן נסיעה מאפשרים לרבים להתמיד בטיפול שבעבר היה נזנח בשל אילוצי החיים.
        </p>
        <p>
          אולם היתרון המשמעותי ביותר אינו רק לוגיסטי, אלא מהותי: הטיפול המקוון מסיר את המחסומים הגיאוגרפיים ומרחיב את היצע המטפלים באופן דרמטי. בעבר, אדם היה מוגבל לאנשי המקצוע הפועלים באזור מגוריו; כיום מי שמחפש פסיכולוג אונליין או מטפל רגשי מרחוק בוחר מתוך היצע ארצי ואף עולמי. מציאות זו מאפשרת "דיוק" גבוה בהרבה בהתאמה בין המטפל למטופל, הן מבחינת הגישה הטיפולית והן מבחינת המומחיות הספציפית הנדרשת. עבור מהגרים או ישראלים השוהים בחו"ל, למשל, היכולת לעבור טיפול בשפת האם היא לעיתים הגורם המכריע בין הצלחה לכישלון. היכולת לבטא כאב או רגש מורכב בשפה שבה גדלנו מאפשרת חיבור עמוק שלא תמיד מתאפשר בשפה זרה.
        </p>
        <p>
          לצד היתרונות הללו, אי אפשר להתעלם מהאתגרים המורכבים שהמסך מציב בפנינו. חלק ניכר מהתקשורת האנושית הוא לא מילולי – הוא עובר דרך הגוף, הריח, קצב הנשימה והנוכחות הפיזית המשותפת באותו החדר. תיאוריות פסיכולוגיות, ובמיוחד אלו הגישות הפסיכודינמיות, מדברות על "יחסי העברה": אותם רגשות לא מודעים שהמטופל משליך על המטפל. בטיפול מרחוק, כשרואים בזום או בשיחת וידאו רק ראש וכתפיים דרך מלבן דו-ממדי, חלק מהמידע הפיזיולוגי והחושי הזה הולך לאיבוד. היעדר הנוכחות הגופנית המלאה עלול לעיתים להחליש את עוצמת החיבור או להפוך את המפגש למעט יותר "סטרילי".
        </p>
        <p>
          כדי לפצות על המרחק הזה, מטפלים רבים פיתחו מיומנויות חדשות. הם לומדים "לתמלל" את מה שלא נאמר: לציין בקול שינויים עדינים בטון הדיבור, להגיב להבעות פנים שחולפות במהירות על המסך, ולתת מילים לתחושות שבעבר היו עוברות בחדר באופן אינטואיטיבי. בנוסף, המטפל נדרש לניהול מוקפד יותר של קשר העין מול המצלמה כדי לייצר חוויה של נראות אצל המטופל. ישנם גם אתגרים טכניים – בעיות קליטה, רעשי רקע או קשיים בתפעול התוכנה – שלא פעם מעוררים תסכול וקוטעים את רצף המחשבה, מה שדורש משני הצדדים סבלנות גדולה יותר.
        </p>
        <p>
          בסופו של דבר, שאלת ההתאמה לטיפול אונליין היא עניין אינדיבידואלי הדורש קבלת החלטות מושכלת. עבור מטופלים רבים, המרחק הדיגיטלי דווקא מאפשר "אפקט של הסרת עכבות", ועוזר להם להיפתח ולדבר על נושאים מביכים בקלות רבה יותר מאשר פנים אל פנים. עם זאת, במצבי משבר חריפים או עבור אנשים הזקוקים ל"קרקוע" (Grounding) שמעניקה נוכחות פיזית ממשית, הפגישה בקליניקה נותרת חיונית. הבחירה בפורמט הטיפולי צריכה להתבסס על שקלול בין הצורך במומחיות ספציפית ונוחות, לבין היכולת של המטופל לייצר אינטימיות וביטחון דרך המדיום הדיגיטלי. הטיפול המקוון הוא כלי רב עוצמה, אך הוא דורש מאיתנו ללמוד מחדש איך להרגיש קרובים, גם כשיש בינינו מרחק פיזי.
        </p>
      </div>

      {/* The commercial half of the cluster, inside the informational half.
          The reader who just finished "does it work" is exactly the reader the
          directory exists for - and this in-body block is the contextual link
          the generic layout footer cannot be. */}
      <div className="mb-10 rounded-2xl p-6" style={{ background: "var(--teal-pale)", border: "1px solid var(--teal-mid)" }}>
        <h2 className="mb-2 text-xl font-extrabold" style={{ color: "var(--teal-dark)" }}>
          מחפשים פסיכולוג אונליין?
        </h2>
        <p className="text-sm leading-7 text-stone-700">
          במאגר של טיפול חכם {onlineCount >= 20 ? `${onlineCount} מטפלים ופסיכולוגים` : "עשרות מטפלים ופסיכולוגים"} מאומתים
          שמטפלים אונליין - אפשר לעבור על הרשימה ולסנן לפי הצורך, או למלא שאלון קצר ולקבל התאמה
          אישית. בחינם, אנונימי וללא התחייבות.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/therapists/region/אונליין"
            className="rounded-full px-5 py-2.5 text-sm font-bold"
            style={{ background: "var(--teal)", color: "#fff", textDecoration: "none" }}
          >
            לכל המטפלים אונליין
          </Link>
          <Link
            href="/adults"
            className="rounded-full px-4 py-2.5 text-sm font-semibold"
            style={{ background: "var(--bg)", border: "1px solid var(--teal-mid)", color: "var(--teal-dark)", textDecoration: "none" }}
          >
            לשאלון למבוגרים
          </Link>
          <Link
            href="/kids"
            className="rounded-full px-4 py-2.5 text-sm font-semibold"
            style={{ background: "var(--bg)", border: "1px solid var(--teal-mid)", color: "var(--teal-dark)", textDecoration: "none" }}
          >
            לשאלון לילדים ונוער
          </Link>
        </div>
      </div>

      {/* What the research says */}
      <div className="rounded-2xl p-6 bg-emerald-50 border border-emerald-200 mb-6">
        <h2 className="font-extrabold text-emerald-900 text-xl mb-4">✅ מה המחקר אומר לטובת אונליין</h2>
        <ul className="space-y-3 text-sm leading-7 text-emerald-900">
          <li>• <strong>יעילות שקולה:</strong> מטה-אנליזות מרובות מצאו אפקטיביות דומה ל-CBT, DBT ואינטרוונציות ממוקדות.</li>
          <li>• <strong>נגישות גבוהה:</strong> אנשים מפריפריה, עם מוגבלויות ניידות, חרדה חברתית גבוהה - מגיעים לטיפול שאחרת לא היו מגיעים אליו.</li>
          <li>• <strong>עלות נמוכה יותר:</strong> לרוב זול יותר כי המטפל חוסך בהוצאות מרפאה.</li>
          <li>• <strong>גמישות:</strong> פגישה מהבית, מהעבודה, מכל מקום - פחות ביטולים.</li>
          <li>• <strong>כלי דיגיטליים:</strong> אפשרות לשלב אפליקציות, הקלטות ומשימות בין הפגישות.</li>
        </ul>
      </div>

      {/* When it's not suitable */}
      <div className="rounded-2xl p-6 bg-red-50 border border-red-200 mb-6">
        <h2 className="font-extrabold text-red-900 text-xl mb-4">⚠️ מתי עדיף פנים מול פנים</h2>
        <ul className="space-y-3 text-sm leading-7 text-red-900">
          <li>• <strong>מחשבות אובדניות פעילות</strong> - דורש הערכת סיכון ישירה.</li>
          <li>• <strong>ילדים קטנים (מתחת לגיל 8)</strong> - הקשר הגופני חשוב יותר.</li>
          <li>• <strong>טיפול בהבעה ויצירה</strong> - חלק מהשיטות דורשות נוכחות פיזית.</li>
          <li>• <strong>ריפוי בעיסוק ופיזיותרפיה</strong> - לרוב לא ניתן לביצוע אונליין.</li>
          <li>• <strong>סביבה ביתית לא בטוחה</strong> - אם אין פרטיות בבית.</li>
          <li>• <strong>הפרעות פסיכוטיות חריפות</strong> - דורשות מגע ישיר.</li>
        </ul>
      </div>

      {/* Practical tips */}
      <div className="rounded-2xl p-6 bg-blue-50 border border-blue-200 mb-6">
        <h2 className="font-extrabold text-blue-900 text-xl mb-4">💡 טיפים לטיפול אונליין מוצלח</h2>
        <ul className="space-y-3 text-sm leading-7 text-blue-900">
          <li>• מצאו מקום שקט עם פרטיות - לא בסלון עם הילדים.</li>
          <li>• השתמשו באוזניות לאיכות שמע טובה.</li>
          <li>• בדקו שהחיבור לאינטרנט יציב לפני הפגישה.</li>
          <li>• טיפול אונליין דורש אותה רמת מחויבות כמו פגישה פיזית.</li>
        </ul>
      </div>

      {/* Questions to ask */}
      <div className="rounded-2xl p-6 bg-white border border-[#E8E0D8]">
        <h2 className="font-extrabold text-stone-900 text-xl mb-4">שאלות לשאול את המטפל לפני שמתחילים</h2>
        <ul className="space-y-2 text-sm leading-7 text-stone-700">
          <li>• האם יש לך ניסיון בטיפול אונליין?</li>
          <li>• באיזה פלטפורמה נעבוד? (Zoom, Teams, פלטפורמה ייעודית?)</li>
          <li>• מה קורה אם יש בעיית טכנית באמצע פגישה?</li>
          <li>• האם ניתן לעבור לפגישה פיזית אם יתעורר הצורך?</li>
        </ul>
      </div>

      <div className="mt-6 rounded-2xl border border-[#E8E0D8] bg-[#f8f5f0] p-6">
        <h2 className="mb-4 text-base font-extrabold text-stone-800">קריאה נוספת</h2>
        <ul className="space-y-2 text-sm">
          <li><Link href="/research/choosing-therapist" className="text-[#2e7d8c] hover:underline">← מה חשוב לבדוק כשבוחרים מטפל?</Link></li>
          <li><Link href="/research/which-therapy" className="text-[#2e7d8c] hover:underline">← איזה טיפול פסיכולוגי מתאים לי?</Link></li>
          <li><Link href="/research/therapist-types" className="text-[#2e7d8c] hover:underline">← סוגי המטפלים בישראל</Link></li>
          <li><Link href="/research/faq" className="text-[#2e7d8c] hover:underline">← שאלות נפוצות על טיפול נפשי</Link></li>
        </ul>
      </div>
    </ArticleShell>
  );
}
