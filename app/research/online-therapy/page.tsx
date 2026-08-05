import Link from "next/link";
import type { Metadata } from "next";
import { ResearchBreadcrumbLd } from "@/app/components/ResearchBreadcrumbLd";
import ArticleShell from "@/app/components/ArticleShell";
import { siteAuthorRef, SITE_AUTHOR, SITE_AUTHOR_PATH } from "@/app/lib/author";
import { AuthorByline } from "@/app/components/AuthorByline";
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

/**
 * SOURCING RULE - every citation below was verified against its own record
 * (publisher page / PMC) on 5/8/2026 before entering this file: authors, year,
 * journal, N, and the effect sizes as printed. Do not add a citation from
 * memory or from a model's answer without the same check; the BTL cluster
 * already caught one confident-and-wrong figure that reached production.
 */
const SOURCES = [
  {
    label:
      "Hedman-Lagerlöf et al., 2023, World Psychiatry - מטא-אנליזה, 31 ניסויים מבוקרים, 3,053 משתתפים: g=0.02 (CI -0.09-0.14)",
    href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10168168/",
  },
  {
    label:
      "Carlbring et al., 2018, Cognitive Behaviour Therapy - מטא-אנליזה, 20 מחקרים, 1,418 משתתפים: g=0.05 (CI -0.09-0.20)",
    href: "https://www.tandfonline.com/doi/full/10.1080/16506073.2017.1401115",
  },
  {
    label:
      "Fernandez et al., 2021, Clinical Psychology & Psychotherapy - מטא-אנליזה של טיפול בווידאו: הבדל זניח מול פנים-אל-פנים, האפקט הבולט ביותר ב-CBT לחרדה, דיכאון ו-PTSD",
    href: "https://onlinelibrary.wiley.com/doi/10.1002/cpp.2594",
  },
  {
    label:
      "Norwood et al., 2018, Clinical Psychology & Psychotherapy - סקירה שיטתית: הברית הטיפולית מדורגת מעט נמוך יותר בווידאו, אך הפחתת הסימפטומים שקולה",
    href: "https://onlinelibrary.wiley.com/doi/10.1002/cpp.2315",
  },
];

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

const h2 = {
  fontSize: "21px",
  fontWeight: 800,
  color: "var(--text)",
  marginBottom: "14px",
  borderBottom: "2px solid var(--teal-mid)",
  paddingBottom: "8px",
} as const;

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
      <article className="space-y-10 text-stone-700 leading-8 text-base">
        <div className="space-y-5">
          <p>
            בשנים האחרונות, ובמיוחד מאז הטלטלה שהביאה איתה תקופת הקורונה, עולם הטיפול הנפשי עבר שינוי מרחיק לכת. מה שנתפס בעבר כפתרון דחוק או כברירת מחדל לאירועי חירום, הפך לחלק בלתי נפרד מהיומיום של מטופלים ומטפלים רבים. המעבר לטיפול אונליין הוא הרבה מעבר לשינוי טכני; הוא מגדיר מחדש את האופן שבו אנחנו תופסים את המרחב הטיפולי. בראש ובראשונה, מדובר במהפכה של נגישות. הגמישות המרחבית והחיסכון המשמעותי בזמן נסיעה מאפשרים לרבים להתמיד בטיפול שבעבר היה נזנח בשל אילוצי החיים.
          </p>
          <p>
            אולם היתרון המשמעותי ביותר אינו רק לוגיסטי, אלא מהותי: הטיפול המקוון מסיר את המחסומים הגיאוגרפיים ומרחיב את היצע המטפלים באופן דרמטי. בעבר, אדם היה מוגבל לאנשי המקצוע הפועלים באזור מגוריו; כיום מי שמחפש פסיכולוג אונליין או מטפל רגשי מרחוק בוחר מתוך היצע ארצי ואף עולמי. מציאות זו מאפשרת "דיוק" גבוה בהרבה בהתאמה בין המטפל למטופל, הן מבחינת הגישה הטיפולית והן מבחינת המומחיות הספציפית הנדרשת. עבור מהגרים או ישראלים השוהים בחו"ל, למשל, היכולת לעבור טיפול בשפת האם היא לעיתים הגורם המכריע בין הצלחה לכישלון. היכולת לבטא כאב או רגש מורכב בשפה שבה גדלנו מאפשרת חיבור עמוק שלא תמיד מתאפשר בשפה זרה.
          </p>
          <p>
            לצד היתרונות הללו, אי אפשר להתעלם מהאתגרים המורכבים שהמסך מציב בפנינו. חלק ניכר מהתקשורת האנושית הוא לא מילולי - הוא עובר דרך הגוף, הריח, קצב הנשימה והנוכחות הפיזית המשותפת באותו החדר. תיאוריות פסיכולוגיות, ובמיוחד אלו הגישות הפסיכודינמיות, מדברות על "יחסי העברה": אותם רגשות לא מודעים שהמטופל משליך על המטפל. בטיפול מרחוק, כשרואים בזום או בשיחת וידאו רק ראש וכתפיים דרך מלבן דו-ממדי, חלק מהמידע הפיזיולוגי והחושי הזה הולך לאיבוד. היעדר הנוכחות הגופנית המלאה עלול לעיתים להחליש את עוצמת החיבור או להפוך את המפגש למעט יותר "סטרילי".
          </p>
          <p>
            כדי לפצות על המרחק הזה, מטפלים רבים פיתחו מיומנויות חדשות. הם לומדים "לתמלל" את מה שלא נאמר: לציין בקול שינויים עדינים בטון הדיבור, להגיב להבעות פנים שחולפות במהירות על המסך, ולתת מילים לתחושות שבעבר היו עוברות בחדר באופן אינטואיטיבי. בנוסף, המטפל נדרש לניהול מוקפד יותר של קשר העין מול המצלמה כדי לייצר חוויה של נראות אצל המטופל. ישנם גם אתגרים טכניים - בעיות קליטה, רעשי רקע או קשיים בתפעול התוכנה - שלא פעם מעוררים תסכול וקוטעים את רצף המחשבה, מה שדורש משני הצדדים סבלנות גדולה יותר.
          </p>
          <p>
            בסופו של דבר, שאלת ההתאמה לטיפול אונליין היא עניין אינדיבידואלי הדורש קבלת החלטות מושכלת. עבור מטופלים רבים, המרחק הדיגיטלי דווקא מאפשר "אפקט של הסרת עכבות", ועוזר להם להיפתח ולדבר על נושאים מביכים בקלות רבה יותר מאשר פנים אל פנים. עם זאת, במצבי משבר חריפים או עבור אנשים הזקוקים ל"קרקוע" (Grounding) שמעניקה נוכחות פיזית ממשית, הפגישה בקליניקה נותרת חיונית. הבחירה בפורמט הטיפולי צריכה להתבסס על שקלול בין הצורך במומחיות ספציפית ונוחות, לבין היכולת של המטופל לייצר אינטימיות וביטחון דרך המדיום הדיגיטלי. הטיפול המקוון הוא כלי רב עוצמה, אך הוא דורש מאיתנו ללמוד מחדש איך להרגיש קרובים, גם כשיש בינינו מרחק פיזי.
          </p>
        </div>

        {/* The commercial half of the cluster, inside the informational half.
            The reader who just finished "does it work" is exactly the reader the
            directory exists for - and this in-body block is the contextual link
            the generic layout footer cannot be. */}
        <div className="rounded-2xl p-6" style={{ background: "var(--teal-pale)", border: "1px solid var(--teal-mid)" }}>
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

        {/* What the research says - named, verified citations. The previous
            version wrote "מטה-אנליזות מרובות מצאו" without naming one, which is
            exactly the E-E-A-T gap on a site built by a clinician-researcher. */}
        <section>
          <h2 style={h2}>מה המחקר אומר</h2>
          <p className="mb-4">
            זו אחת השאלות הנחקרות ביותר בפסיכותרפיה של העשור האחרון, והתשובה עקבית באופן יוצא דופן.
            המטא-אנליזה העדכנית ביותר, שפורסמה ב-<em>World Psychiatry</em> (Hedman-Lagerlöf ועמיתיו,
            2023), איגדה 31 ניסויים מבוקרים עם 3,053 משתתפים שהשוו ישירות טיפול קוגניטיבי-התנהגותי
            מבוסס-אינטרנט בליווי מטפל לטיפול פנים אל פנים: ההבדל שנמצא היה אפסי (g=0.02) - כלומר
            שקילות של ממש, על פני הפרעות נפשיות וגופניות כאחד. זהו עדכון של מטא-אנליזה קודמת
            (Carlbring ועמיתיו, 2018; 20 מחקרים) שמצאה את אותה תמונה בדיוק.
          </p>
          <p className="mb-4">
            ומה לגבי טיפול בשיחת וידאו רגילה, כמו שרוב המטופלים פוגשים אותו? מטא-אנליזה של Fernandez
            ועמיתיו (2021) בדקה בדיוק את זה ומצאה שההבדל מטיפול בקליניקה זניח, כשהאפקט הבולט ביותר
            נמדד בטיפול CBT לחרדה, לדיכאון ולפוסט-טראומה.
          </p>
          <p className="mb-4">
            וכאן נקודה מעניינת שמכבדת את שני הצדדים של הוויכוח: סקירה שיטתית שהתמקדה בברית הטיפולית
            (Norwood ועמיתיו, 2018) מצאה שהמטופלים אכן מדרגים את הקשר הטיפולי בווידאו כמעט טוב - אבל
            מעט פחות - מאשר פנים אל פנים, ובכל זאת הפחתת הסימפטומים שקולה. במילים אחרות: התחושה
            שמשהו מהחדר הולך לאיבוד במסך אינה דמיון, אך היא אינה מתרגמת לתוצאה טיפולית פחותה.
          </p>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            כנות מתבקשת: רוב הראיות החזקות נאספו על טיפולים מובנים, ובראשם CBT. לטיפולים דינמיים
            ארוכי-טווח יש פחות מחקר השוואתי ישיר, ושם ההכרעה עדיין נשענת יותר על שיקול דעת קליני.
          </p>
        </section>

        {/* When in-person is the right call */}
        <section>
          <h2 style={h2}>מתי עדיף פנים מול פנים</h2>
          <ul className="space-y-3">
            {[
              ["מחשבות אובדניות פעילות", "מצב שדורש הערכת סיכון ישירה ורצף טיפולי צמוד."],
              ["ילדים צעירים", "בגיל הרך הקשר הטיפולי עובר במשחק ובנוכחות גופנית; אונליין מתאים יותר להדרכת הורים."],
              ["טיפול בהבעה ויצירה", "חלק מהשיטות דורשות חומרים ונוכחות פיזית משותפת."],
              ["טיפולים פרה-רפואיים", "ריפוי בעיסוק ופיזיותרפיה לרוב אינם ניתנים לביצוע מלא מרחוק."],
              ["סביבה ביתית ללא פרטיות", "כשאין בבית חדר שקט ובטוח לדבר בו, המסגרת הפיזית היא חלק מהטיפול."],
              ["מצבים פסיכוטיים חריפים", "דורשים הערכה ישירה ולעיתים מעורבות פסיכיאטרית מיידית."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span aria-hidden style={{ color: "var(--gold-dark)", fontWeight: 900, flexShrink: 0 }}>·</span>
                <span>
                  <strong>{t}</strong> - {d}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Price - the query family with the clearest content gap per the panel.
            The range is the same industry-survey anchor the directory pages use
            (see CitySeoSection) - one number system across the site, no invented
            price data. */}
        <section>
          <h2 style={h2}>כמה עולה טיפול פסיכולוגי אונליין?</h2>
          <p className="mb-4">
            פגישה פרטית עם פסיכולוג או מטפל מוסמך עולה בישראל לרוב בין 300 ל-550 ש"ח, כשהממוצע
            הארצי בסקרי התעריפים נע סביב 400 ש"ח. טיפול אונליין נמצא פעמים רבות בחלק הנמוך של
            הטווח: המטפל חוסך את עלות הקליניקה, וחלק מהמטפלים מגלגלים את החיסכון למחיר. הגורם
            המשפיע ביותר על המחיר אינו הפורמט אלא ההכשרה והניסיון - פסיכולוג מומחה מול מתמחה, עו"ס
            קליני, מטפל CBT וכן הלאה.
          </p>
          <p className="mb-4">
            חשוב לדעת שיש גם מסלולים מסובסדים: טיפול דרך קופת החולים בעלות נמוכה משמעותית (ולעיתים
            ללא עלות), הסדרים דרך ביטוחים משלימים, ומטפלים שמציעים תעריף מוזל לפי מצב כלכלי. לפני
            שמתחייבים למחיר פרטי מלא, שווה לבדוק{" "}
            <Link href="/therapists/arrangement" className="font-semibold hover:underline" style={{ color: "var(--teal-dark)" }}>
              מי יכול לממן את הטיפול
            </Link>
            .
          </p>
        </section>

        {/* Kupot - short and honest: the details live in the kupa guide, which
            already surfaces for this query family. No per-kupah specifics here
            that were not verified against the kupah pages themselves. */}
        <section>
          <h2 style={h2}>טיפול אונליין דרך קופות החולים</h2>
          <p className="mb-4">
            כל קופות החולים מציעות כיום מסלולים של טיפול נפשי מרחוק - בשיחת וידאו או בטלפון - אבל
            ההיקף, ההשתתפות העצמית וזמני ההמתנה שונים מקופה לקופה ומתעדכנים תדיר. אם המחיר הוא
            השיקול המרכזי שלכם, זה המקום הראשון לבדוק בו, והמדריך שלנו עושה סדר בתהליך:
          </p>
          <Link
            href="/research/kupa-guide"
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold"
            style={{ background: "var(--bg)", border: "1px solid var(--teal-mid)", color: "var(--teal-dark)", textDecoration: "none" }}
          >
            למדריך המלא: טיפול פסיכולוגי דרך הקופה ←
          </Link>
        </section>

        {/* Practical prep */}
        <section>
          <h2 style={h2}>לקראת הפגישה הראשונה אונליין</h2>
          <p className="mb-4">כמה דברים קטנים שעושים הבדל גדול באיכות הפגישה:</p>
          <ul className="mb-6 space-y-2">
            {[
              "מקום שקט עם פרטיות אמיתית - לא הסלון כשכולם בבית.",
              "אוזניות - משפרות את איכות השמע ומגבירות את תחושת האינטימיות.",
              "חיבור אינטרנט יציב, ובדיקה קצרה של המצלמה והמיקרופון לפני.",
              "לפנות את הזמן באמת: טיפול מרחוק דורש את אותה מחויבות כמו פגישה בקליניקה.",
            ].map((t) => (
              <li key={t} className="flex gap-3">
                <span aria-hidden style={{ color: "var(--teal)", fontWeight: 900, flexShrink: 0 }}>·</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <p className="mb-3 font-bold" style={{ color: "var(--text)" }}>שאלות ששווה לשאול את המטפל לפני שמתחילים:</p>
          <ul className="space-y-2">
            {[
              "האם יש לך ניסיון בטיפול אונליין?",
              "באיזו פלטפורמה נעבוד, ומה קורה אם יש תקלה טכנית באמצע פגישה?",
              "האם אפשר לעבור לפגישות בקליניקה אם נרגיש שזה מתאים יותר?",
            ].map((t) => (
              <li key={t} className="flex gap-3">
                <span aria-hidden style={{ color: "var(--teal)", fontWeight: 900, flexShrink: 0 }}>·</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Sources - verified, linked, in the clean editorial style */}
        <section>
          <h2 style={h2}>מקורות</h2>
          <ul className="space-y-2 text-sm">
            {SOURCES.map((s) => (
              <li key={s.href}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--teal)", textDecoration: "underline", textUnderlineOffset: "3px" }}
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <div className="rounded-2xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <h2 className="mb-4 text-base font-extrabold" style={{ color: "var(--text)" }}>קריאה נוספת</h2>
          <ul className="space-y-2 text-sm">
            {[
              { href: "/research/kupa-guide", label: "טיפול פסיכולוגי דרך הקופה - המדריך המלא" },
              { href: "/research/choosing-therapist", label: "מה חשוב לבדוק כשבוחרים מטפל?" },
              { href: "/research/which-therapy", label: "איזה טיפול פסיכולוגי מתאים לי?" },
              { href: "/research/therapist-types", label: "סוגי המטפלים בישראל" },
            ].map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:underline" style={{ color: "var(--teal-dark)" }}>
                  ← {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <AuthorByline
          coAuthor="צוות טיפול חכם"
          note={`נכתב על ידי ${SITE_AUTHOR.name}, ${SITE_AUTHOR.jobTitle} וממייסדי "טיפול חכם", יחד עם צוות טיפול חכם. המקורות המצוטטים אומתו מול הפרסומים המקוריים. אין באמור תחליף לייעוץ מקצועי פרטני. עודכן באוגוסט 2026.`}
        />
      </article>
    </ArticleShell>
  );
}
