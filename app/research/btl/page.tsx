import Link from "next/link";
import type { Metadata } from "next";
import ArticleShell from "@/app/components/ArticleShell";
import { AuthorByline } from "@/app/components/AuthorByline";
import { siteAuthorRef, SITE_AUTHOR, SITE_AUTHOR_PATH } from "@/app/lib/author";
import { BTL_TRACKS } from "@/app/lib/btl-tracks";
import { BtlTrackChooser } from "@/app/components/BtlProcessFlow";

const BASE_URL = "https://www.mentalytics.co.il";
const URL = `${BASE_URL}/research/btl`;
const TITLE = "טיפול נפשי דרך ביטוח לאומי - איזה מסלול שייך לכם";
const DESCRIPTION =
  "ביטוח לאומי מממן טיפול נפשי רק בחלק מהמסלולים, ובאחרים משלם קצבה בלבד. המפה המלאה: נפגעי איבה, נפגעי עבודה, נכות כללית וילד נכה - מי זכאי למה, ולמה כדאי להתחיל מוקדם.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "טיפול נפשי דרך ביטוח לאומי",
    "ביטוח לאומי טיפול פסיכולוגי",
    "זכאות טיפול נפשי",
    "נפגעי פעולות איבה טיפול נפשי",
    "נפגעי עבודה פגיעה נפשית",
    "סל שיקום",
    "שיקום מקצועי ביטוח לאומי",
  ],
  alternates: { canonical: URL },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: "article", locale: "he_IL", siteName: "טיפול חכם" },
};

const articleLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: TITLE,
  description: DESCRIPTION,
  inLanguage: "he",
  datePublished: "2026-08-04",
  dateModified: "2026-08-04",
  // Both, to match the visible byline.
  author: [siteAuthorRef(), { "@type": "Organization", name: "צוות טיפול חכם", url: BASE_URL }],
  publisher: { "@type": "Organization", name: "טיפול חכם", url: BASE_URL },
  url: URL,
  articleSection: "מסגרת, עלות וזכויות",
  isPartOf: { "@type": "WebSite", name: "טיפול חכם", url: BASE_URL },
};

const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "האם ביטוח לאומי מממן טיפול פסיכולוגי?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "רק בחלק מהמסלולים. בנפגעי פעולות איבה ובנפגעי עבודה הביטוח הלאומי אחראי על הריפוי ולכן מממן טיפול נפשי בפועל. בנכות כללית ובגמלת ילד נכה הוא משלם קצבה כספית, והטיפול עצמו מתקבל דרך קופת החולים. זו ההבחנה שהכי מבלבלת פונים.",
      },
    },
    {
      "@type": "Question",
      name: "האם אפשר לקבל טיפול נפשי בלי ועדה רפואית?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "כן, במסלול אחד. מי שנכח באירוע איבה וסובל מתגובת חרדה זכאי לטיפול נפשי במימון מלא בלי להגיש תביעת הכרה ובלי ועדה רפואית - 12 מפגשים, ולפי חוות דעת מקצועית של המטפל הרחבה עד 24 מפגשים. הטיפול ניתן במרכזי חוסן, במוקדי קופות החולים וביחידות בבתי חולים.",
      },
    },
    {
      "@type": "Question",
      name: "מה עושים אם המטפל שבחרתי אינו במאגר המורשה?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "שלוש אפשרויות: לבקש מהמטפל להצטרף למאגר בטופס 269, לעבור למטפל שנמצא במאגר, או לבדוק זכאות למסלול ההחזר של רפורמת נפש אחת - שם ההחזר ניתן עבור מטפל המוסמך על ידי משרד הבריאות או הרווחה, עד 384 שקלים למפגש כולל מע\"מ, שעה אחת בשבוע. בכל מקרה אין להתחיל לשלם ולקוות להחזר בדיעבד.",
      },
    },
    {
      "@type": "Question",
      name: "כמה זמן יש לי להגיש ערר על החלטת ועדה רפואית?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "החלון משתנה לפי המסלול: 30 יום בנכות מעבודה, 60 יום בנכות כללית, ו-90 יום בגמלת ילד נכה. על החלטת ועדת העררים אפשר לערער לבית הדין האזורי לעבודה בתוך 60 יום, אך רק בשאלות משפטיות ולא על שיקול הדעת הרפואי. לערעורים אלה קיים סיוע משפטי חינם ללא מבחן הכנסה.",
      },
    },
  ],
};

// The track pages carry one; the hub was the only page in the cluster without.
const breadcrumbLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "בית", item: BASE_URL },
    { "@type": "ListItem", position: 2, name: "מאמרים ומידע שימושי", item: `${BASE_URL}/research` },
    { "@type": "ListItem", position: 3, name: "טיפול נפשי דרך ביטוח לאומי", item: URL },
  ],
};

const h2 = {
  fontSize: "21px",
  fontWeight: 800,
  color: "var(--text)",
  marginBottom: "14px",
  borderBottom: "2px solid var(--teal-mid)",
  paddingBottom: "8px",
  scrollMarginTop: "90px",
} as const;

const TRIGGERS: Record<string, string> = {
  hostilities: "נפגעתם או נכחתם באירוע איבה, או שאתם בני משפחה של נפגע",
  "work-injury": "הפגיעה הנפשית נוצרה בעקבות אירוע בעבודה",
  "general-disability": "מצב נפשי מתמשך שפוגע ביכולת שלכם להשתכר",
  "disabled-child": "ילד עד גיל 18 עם מוגבלות נפשית, התפתחותית או פיזית",
};

export default function BtlHubPage() {
  return (
    <ArticleShell
      href="/research/btl"
      title="טיפול נפשי דרך ביטוח לאומי"
      sectionSlug="מסגרת-עלות-וזכויות"
      author={{ name: SITE_AUTHOR.name, role: SITE_AUTHOR.jobTitle, href: SITE_AUTHOR_PATH }}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }} />

      <div className="mb-8">
        <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--teal)", letterSpacing: ".14em", marginBottom: "10px" }}>
          מסגרת, עלות וזכויות
        </p>
        <h1 style={{ fontSize: "clamp(1.8rem,4vw,2.4rem)", fontWeight: 900, color: "var(--text)", lineHeight: 1.25, letterSpacing: "-.02em", marginBottom: "16px" }}>
          טיפול נפשי דרך ביטוח לאומי
        </h1>
        <p style={{ fontSize: "16.5px", color: "var(--text-2)", lineHeight: 1.85 }}>
          המחיר הוא הסיבה הנפוצה ביותר לדחות טיפול, ולעיתים קרובות קיימת זכאות שהפונה פשוט לא ידע עליה.
          המדריך הזה ממפה את כל המסלולים, ומתחיל בשאלה שחייבים לענות עליה קודם: <strong>לאיזה מסלול אתם
          שייכים</strong>.
        </p>
      </div>

      {/* Jump links - see the note on the same nav in [track]/page.tsx. */}
      <nav
        aria-label="תוכן העמוד"
        className="mb-10 rounded-2xl"
        style={{ background: "var(--surface)", border: "1px solid var(--line)", padding: "20px 22px" }}
      >
        <p style={{ fontSize: "12px", fontWeight: 800, color: "var(--muted)", letterSpacing: ".1em", marginBottom: "12px" }}>
          מה יש בעמוד הזה
        </p>
        <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "2px" }}>
          {[
            { id: "why", label: "למה לא לחכות", hint: "החלק הנפשי" },
            { id: "tracks", label: "לאיזה מסלול אתם שייכים", hint: "בחירה מודרכת" },
            { id: "rehab", label: "שיקום מקצועי", hint: "המסלול שחוצה את כולם" },
            { id: "summary", label: "סיכום קצר", hint: "מה לעשות, לפי סדר" },
            { id: "sources", label: "מקורות", hint: "ביטוח לאומי ומחקרים" },
          ].map((c, i) => (
            <li key={c.id}>
              <a
                href={`#${c.id}`}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: "10px",
                  padding: "8px 10px",
                  borderRadius: "10px",
                  textDecoration: "none",
                  color: "var(--text)",
                }}
              >
                <span aria-hidden style={{ fontSize: "12px", fontWeight: 800, color: "var(--teal)", minWidth: "16px" }}>
                  {i + 1}
                </span>
                <span style={{ fontSize: "15px", fontWeight: 700 }}>{c.label}</span>
                <span style={{ fontSize: "13px", color: "var(--muted)" }}>· {c.hint}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <article className="space-y-10 text-stone-700 leading-8 text-base">

        {/* ── Part 3 (intro): why early matters ───────────────────────────── */}
        <section>
          <h2 id="why" style={h2}>למה לא לחכות</h2>
          <p>
            התהליך הבירוקרטי שמתואר כאן לוקח זמן, ולכן מתעורר פיתוי טבעי לחכות: קודם שההכרה תסתדר, קודם
            שהוועדה תתכנס, קודם שיהיה ברור מה מגיע. המחקר אומר שזו הבחירה היקרה ביותר - ולא רק מבחינת סבל,
            אלא מבחינת היכולת לחזור לעבודה ולחיים.
          </p>
          <p className="mt-4">
            <strong>בפסיכוזה מוקדמת:</strong> מטא-אנליזה של 10 מחקרים מבוקרים ו-2,176 משתתפים
            (Correll ועמיתיו, 2018, JAMA Psychiatry) מצאה ששירותי התערבות מוקדמת עדיפים על טיפול רגיל
            בכל התוצאים שנבדקו. מעורבות בלימודים או בעבודה: <strong>RR 1.13</strong> (95% CI 1.03-1.24).
            אשפוז פסיכיאטרי: RR 0.74 (0.61-0.90). נשירה מטיפול: RR 0.70 (0.61-0.80). כלומר האפקט התעסוקתי
            הישיר צנוע אך מובהק, ואילו האפקטים על אשפוז ועל נשירה - שהם המנועים האמיתיים של יציאה משוק
            העבודה - גדולים בהרבה.
          </p>
          <p className="mt-4">
            <strong>אבל צריך לומר גם מה שהמחקר לא מראה,</strong> כי כאן נוצר פער בין מה שמקובל להבטיח לבין
            הראיות. מטא-אנליזה של 16 מחקרים מבוקרים (Nigatu ועמיתיו, 2016) בדקה התערבויות להחזרה לעבודה
            בקרב עובדים עם הפרעות נפשיות שכיחות, ו<strong>לא מצאה שיפור מובהק בשיעור החזרה לעבודה</strong>:
            RR 1.05 (95% CI 0.97-1.12) - רווח הסמך חוצה את האחד. מה שכן נמצא: הפחתה של כ-13 ימי מחלה
            בממוצע (MD ‏-13.38, ‏-24.07 עד -2.69). כלומר טיפול מקצר את משך ההיעדרות, אך אין בסיס להבטיח
            שהוא לבדו "מחזיר לעבודה".
          </p>
          <p className="mt-4">
            <strong>המנוף התעסוקתי החזק באמת אינו הטיפול אלא השיקום התעסוקתי.</strong> מטא-אנליזה של 17
            מחקרים מבוקרים (Modini ועמיתיו, 2016, British Journal of Psychiatry) מצאה שמודל השמה נתמכת
            (Individual Placement and Support) מביא לתעסוקה בשוק החופשי בשיעור של <strong>RR 2.40</strong>{" "}
            (95% CI 1.99-2.90) לעומת שיקום תעסוקתי מסורתי, וההשפעה נשמרה ללא תלות באזור גאוגרפי או
            בשיעורי האבטלה המקומיים. בפסיכוזה מוקדמת, כשהטיפול שולב עם תעסוקה נתמכת, נמצא
            OR 3.66 (95% CI 1.93-6.93) - והמחברים מייחסים את האפקט לשילוב, לא לטיפול לבדו.
          </p>
          <p className="mt-4">
            <strong>המסקנה המעשית, וזו הסיבה שהדף הזה קיים:</strong> אל תחכו לסיום ההליך הבירוקרטי כדי
            להתחיל לטפל, ואל תחכו לסיום הטיפול כדי להתחיל לשקם. בישראל שני הדברים נמצאים במסלולים נפרדים -
            הטיפול במסלול הריפוי, והשיקום המקצועי בטופס 270 מול עובד/ת שיקום - ואפשר להפעיל אותם במקביל.
            הספרות תומכת בכך שהשיקום יתחיל מוקדם ולא כתחנה אחרונה אחרי מיצוי כל ההליכים הרפואיים.
          </p>

          <div
            className="mt-6 rounded-2xl p-5"
            style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
          >
            <p style={{ fontWeight: 800, fontSize: "15px", color: "var(--text)", marginBottom: "8px" }}>
              ושלוש הסתייגויות, כי הן משנות את המסקנה
            </p>
            <ul className="space-y-3" style={{ fontSize: "14.5px", lineHeight: 1.8 }}>
              <li>
                <strong>איחור אינו גזר דין.</strong> מחקר J-TOPS הירושלמי (Shalev ועמיתיו) מצא שמתן חשיפה
                ממושכת <em>בהשהיה</em> לא העלה את הסיכון לפוסט-טראומה כרונית בטווח הארוך. מי שקורא את זה
                שנים אחרי האירוע - הטיפול עדיין עובד.
              </li>
              <li>
                <strong>הקשר בין איחור לאבטלה עקיף.</strong> מטא-אנליזה על משך פסיכוזה לא-מטופלת
                (Penttilä ועמיתיו, 2014) מצאה קשר לתסמינים ולתפקוד חברתי, אבל <em>לא</em> מצאה קשר מובהק
                לתעסוקה או לאשפוז. מי שמבטיח לכם ש"איחור מוביל לאבטלה" מדלג על הנתון הזה.
              </li>
              <li>
                <strong>התערבות גורפת אינה מומלצת.</strong> סקירת Cochrane (Roberts ועמיתיו, 2019) קובעת
                שוודאות הראיות נמוכה ושאי אפשר להמליץ על התערבות פסיכולוגית לכל מי שנחשף לאירוע טראומטי.
                מה שכן מבוסס הוא טיפול למי שמפתח תסמינים - וזה בדיוק ההיגיון של מסלול 12 הטיפולים
                שמתואר כאן.
              </li>
            </ul>
          </div>
        </section>

        {/* ── The map ─────────────────────────────────────────────────────── */}
        <section>
          <h2 id="tracks" style={h2}>לאיזה מסלול אתם שייכים</h2>
          <p className="mb-5">
            זו השאלה הראשונה, והאתר הרשמי עונה עליה הכי פחות טוב - כל זכאות יושבת בעמוד נפרד בלי מפה
            שמחברת ביניהן. שימו לב להבחנה שבתחתית כל כרטיס: <strong>רק שני מסלולים מממנים טיפול נפשי
            בפועל</strong>. בשניים האחרים הביטוח הלאומי משלם קצבה, והטיפול עצמו מגיע מקופת החולים.
          </p>
          <BtlTrackChooser
            tracks={BTL_TRACKS.map((t) => ({
              slug: t.slug,
              name: t.name,
              trigger: TRIGGERS[t.slug] ?? "",
              fundsTherapyDirectly: t.fundsTherapyDirectly,
            }))}
          />
        </section>

        {/* ── Cross-cutting: vocational rehab ─────────────────────────────── */}
        <section>
          <h2 id="rehab" style={h2}>שיקום מקצועי - מסלול שחוצה את כולם</h2>
          <p>
            שיקום מקצועי אינו מסלול נפרד אלא זכאות שנפתחת מתוך כמה מהמסלולים למעלה, והוא מוכרע על ידי
            <strong> עובד/ת שיקום ולא על ידי ועדה רפואית</strong> - הבדל שמקצר משמעותית את התהליך. מגישים
            בטופס 270. הסף שונה לפי מקור הנכות: בנפגעי עבודה הוא נמוך יותר מאשר בנכות כללית, ולכן שווה
            לברר את הסף שחל עליכם ולא להניח.
          </p>
          <p className="mt-4">
            מה שנכלל: אבחון תעסוקתי, מימון לימודים והכשרה, ליווי בהשמה, ובתנאים מסוימים דמי שיקום.
            בהקשר של הפרק המחקרי למעלה - זהו הצינור המעשי ליישום עקרונות ההשמה הנתמכת, והספרות תומכת
            בהפעלתו מוקדם ולא כתחנה אחרונה אחרי מיצוי כל ההליכים הרפואיים.
          </p>
        </section>

        <section>
          <h2 id="summary" style={h2}>סיכום קצר</h2>
          <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "12px" }}>
            {[
              "לזהות לאיזה מסלול אתם שייכים - זו השאלה שקובעת הכל, ואפשר להשתייך ליותר מאחד.",
              "לא לחכות להכרה כדי להתחיל טיפול. טיפול דרך הקופה זמין עכשיו, במקביל לתביעה.",
              "לשים לב לחלונות הזמן: התביעה מוגבלת בדרך כלל לשנה, והערר לוועדה - לשבועות.",
              "לבדוק שיקום מקצועי בנפרד מהקצבה. הסף נמוך יותר וההחלטה אינה של ועדה רפואית.",
              "לתעד הכל מוקדם. תיעוד סמוך לאירוע הוא הראיה החזקה ביותר, וגם הטיפול היעיל ביותר.",
            ].map((x, i) => (
              <li key={x} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                <span
                  aria-hidden
                  style={{
                    flexShrink: 0,
                    width: "26px",
                    height: "26px",
                    borderRadius: "50px",
                    background: "var(--teal-pale)",
                    color: "var(--teal-dark)",
                    fontSize: "13px",
                    fontWeight: 900,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ fontSize: "15.5px", lineHeight: 1.8, color: "var(--text-2)" }}>{x}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Route to supply ─────────────────────────────────────────────── */}
        <section
          style={{ background: "var(--teal-pale)", border: "1px solid var(--teal-mid)", borderRadius: "16px", padding: "24px 26px" }}
        >
          <h2 style={{ fontSize: "17px", fontWeight: 900, color: "var(--teal-dark)", marginBottom: "10px" }}>
            לא בטוחים לאן להתקדם?
          </h2>
          <p className="text-sm leading-7">
            אם אתם יודעים שמשהו לא בסדר אבל לא יודעים איזה טיפול מתאים או למי לפנות, השאלון ממפה את
            הקושי ומציע בסופו התאמה אישית. הוא בחינם, אנונימי וללא התחייבות. ואם כבר ברור לכם מה אתם
            מחפשים, אפשר לעבור ישירות לרשימת המטפלים שעובדים מול ביטוח לאומי.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            {[
              { href: "/adults", label: "לשאלון למבוגרים" },
              { href: "/kids", label: "לשאלון לילדים ונוער" },
              { href: "/therapists/arrangement/ביטוח-לאומי", label: "מטפלים מול ביטוח לאומי" },
              { href: "/therapists/arrangement", label: "כל מסלולי המימון" },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="rounded-full px-4 py-2 text-sm font-semibold"
                style={{ background: "var(--bg)", border: "1px solid var(--line)", color: "var(--teal-dark)", textDecoration: "none" }}
              >
                {label}
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 id="sources" style={h2}>מקורות</h2>
          <ul className="space-y-2 text-sm">
            {[
              { l: "המוסד לביטוח לאומי - טיפול פסיכולוגי לנפגעי פעולות איבה", h: "https://www.btl.gov.il/benefits/Victims_of_Hostilities/Casualties_benefits/Pages/%D7%98%D7%99%D7%A4%D7%95%D7%9C%20%D7%A4%D7%A1%D7%99%D7%9B%D7%95%D7%9C%D7%95%D7%92%D7%99.aspx" },
              { l: 'המוסד לביטוח לאומי - רפורמת "נפש אחת"', h: "https://www.btl.gov.il/benefits/Victims_of_Hostilities/NefeSH_Ahat/Pages/BneyMishpaha.aspx" },
              { l: "המוסד לביטוח לאומי - מאגר המטפלים המורשים", h: "https://www.btl.gov.il/Simulators/peulotEiva/Pages/metaplim-shikum.aspx" },
              { l: "המוסד לביטוח לאומי - שיקום מקצועי", h: "https://www.btl.gov.il/benefits/Vocational_Rehabilitation/Pages/default.aspx" },
              { l: "כל-זכות - מדריך לנפגעי עבודה", h: "https://www.kolzchut.org.il/he/%D7%9E%D7%93%D7%A8%D7%99%D7%9A_%D7%9C%D7%A0%D7%A4%D7%92%D7%A2%D7%99_%D7%A2%D7%91%D7%95%D7%93%D7%94" },
              { l: "Correll et al., 2018, JAMA Psychiatry - מטא-אנליזה, התערבות מוקדמת בפסיכוזה", h: "https://pubmed.ncbi.nlm.nih.gov/29800949/" },
              { l: "Modini et al., 2016, British Journal of Psychiatry - מטא-אנליזה, השמה נתמכת", h: "https://pubmed.ncbi.nlm.nih.gov/27103678/" },
              { l: "Penttilä et al., 2014, British Journal of Psychiatry - משך פסיכוזה לא מטופלת", h: "https://pubmed.ncbi.nlm.nih.gov/25252316/" },
              { l: "Nigatu et al., 2016 - מטא-אנליזה של 16 RCTs, החזרה לעבודה בהפרעות נפשיות שכיחות", h: "https://pubmed.ncbi.nlm.nih.gov/27609709/" },
              { l: "Bond et al., 2014 - תעסוקה נתמכת בפסיכוזה מוקדמת", h: "https://pubmed.ncbi.nlm.nih.gov/25016950/" },
              { l: "Roberts et al., 2019, Cochrane - התערבות פסיכולוגית מוקדמת למניעת PTSD", h: "https://www.cochranelibrary.com/cdsr/doi/10.1002/14651858.CD006869.pub3/full" },
            ].map((s) => (
              <li key={s.h}>
                <a href={s.h} target="_blank" rel="noopener noreferrer" style={{ color: "var(--teal)", textDecoration: "underline", textUnderlineOffset: "3px" }}>
                  {s.l}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <AuthorByline
          coAuthor="צוות טיפול חכם"
          note={`מדריך זה נכתב על ידי ${SITE_AUTHOR.name}, ${SITE_AUTHOR.jobTitle} וממייסדי "טיפול חכם", יחד עם צוות טיפול חכם. תנאי הזכאות והסכומים משתנים מעת לעת, והפרטים המחייבים הם תמיד של המוסד לביטוח לאומי עצמו. אין באמור ייעוץ משפטי. עודכן באוגוסט 2026.`}
        />
      </article>
    </ArticleShell>
  );
}
