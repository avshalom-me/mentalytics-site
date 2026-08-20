import Link from "next/link";
import type { PublicTherapist } from "./TherapistsClient";
import { publicTypeOverride } from "@/app/lib/gender-text";
import { REGION_PRICE_RANGE, REGION_PUBLIC_SERVICES } from "@/app/lib/region-public-services";
import type { LocalArticle } from "@/app/lib/local-articles";

// SEO content block for city/region landing pages, rendered BELOW the
// therapist listings (patients rarely scroll past the cards; crawlers read it
// all - the alhasapa/betipulnet pattern). Three anti-"doorway page" measures:
//  1. The prose is DERIVED FROM LIVE DATA - which professions and specialties
//     this place actually has, named - so every city's text is genuinely
//     different and self-updates as supply changes. Names, never counts: see
//     the paragraph builder below for why.
//  2. Headings/phrasings rotate deterministically per place name.
//  3. Small-supply places get adapted wording instead of boilerplate.
// Native <details> accordions - no JS, SSR-rendered, fully indexable.

type Kind = "city" | "region" | "online";

// Deterministic per-place variant picker (stable across builds - no Math.random,
// which would make Google see a different page on every crawl).
function hashPlace(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return h;
}

// Truncate by CODE POINT, not by UTF-16 unit: slice() can cut an emoji in half
// and leave a lone surrogate, which the response encoder then serves as "�".
function truncateChars(text: string, max: number): string {
  const chars = [...text];
  if (chars.length <= max) return text;
  return `${chars.slice(0, max).join("").trimEnd()}...`;
}

function typeBreakdown(therapists: PublicTherapist[]): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const t of therapists) {
    const main = t.therapist_types?.[0];
    if (!main) continue;
    // הכלל מוחל לכל אדם בנפרד, ואז מקבצים: עיר עם שלושה שמטפלים במבוגרים
    // ואחת שרק בילדים תציג את שתי הקבוצות נכון. בלי זה השורה הזו הייתה
    // אומרת "מטפל/ת בהבעה ויצירה" בזמן שכל הכרטיסים באותו עמוד אומרים
    // "פסיכותרפיסטית". מגדר null בכוונה - זו ספירה ולא אדם, ולכן הצורה
    // הכוללת.
    const label = publicTypeOverride(main, null, t.age_groups) ?? main;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);
}

function topSpecialties(therapists: PublicTherapist[]): string[] {
  const counts = new Map<string, number>();
  for (const t of therapists) {
    for (const area of t.training_areas ?? []) counts.set(area, (counts.get(area) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([a]) => a);
}

export default function CitySeoSection({
  placeName,
  kind,
  therapists: therapistsProp,
  regionName,
  articles = [],
  articlesScope = "place",
  nearby = [],
  nearbyPlaces = [],
  regionNearby = [],
}: {
  placeName: string;
  kind: Kind;
  therapists: PublicTherapist[];
  /** Canonical region this place belongs to (the region itself on region pages) - keys price + public-services data. */
  regionName?: string | null;
  articles?: LocalArticle[];
  /** "region" when a city page fell back to region-wide articles - the heading must say so. */
  articlesScope?: "place" | "region";
  /** Therapists shown from ADJACENT cities (small-city pages) - counted separately, never as in-city. */
  nearby?: PublicTherapist[];
  /** The adjacent cities those therapists actually work in, for naming them in the text. */
  nearbyPlaces?: string[];
  /** Therapists shown from the wider region (the last-resort fallback on very thin pages). */
  regionNearby?: PublicTherapist[];
}) {
  const h = hashPlace(placeName);
  // כרטיסי מרכז אינם מטפלים: הם מוצגים ברשימה, אבל פילוח ההכשרות ופילוח
  // המגדר מתארים בני אדם, וישות-מרכז הייתה נכנסת למניין המגדרי בלי מגדר.
  const therapists = therapistsProp.filter((t) => !t.is_center);
  const total = therapists.length;
  // The breakdown must describe what the page ACTUALLY lists, adjacent-city
  // cards included - otherwise the professions named below would not match the
  // grid above them.
  const alsoShown = [...nearby, ...regionNearby];
  const pooled = alsoShown.length > 0 ? [...therapists, ...alsoShown] : therapists;
  const types = typeBreakdown(pooled);
  const specialties = topSpecialties(pooled);
  const onlineHere = pooled.filter((t) => t.online).length;
  const women = pooled.filter((t) => t.gender === "נקבה").length;
  const men = pooled.length - women;

  const inPlace = kind === "online" ? "בטיפול אונליין" : `ב${placeName}`;

  const headings = [
    `טיפול פסיכולוגי ${inPlace} - מה חשוב לדעת`,
    `מחפשים פסיכולוג ${inPlace}? כמה דברים שכדאי לדעת`,
    `פסיכולוגים ומטפלים ${inPlace} - שאלות ותשובות`,
  ];

  // No supply counts anywhere in this paragraph (owner's call, 14/8/2026).
  //
  // Google quotes roughly the first 160 characters of whichever passage it
  // picks, and for "פסיכולוג מומלץ ב..." it picks THIS paragraph over the meta
  // description - on 14/8 the Jerusalem SERP was showing "לפי הכשרה: מטפל/ת
  // בהבעה ויצירה (9) · עו״ס קליני (8)" as our shop window. Numbers read as
  // inventory data, and on a thin city page a small one argues against us.
  //
  // The anti-doorway requirement that the counts used to satisfy still holds:
  // every place needs genuinely different text. It now comes from the NAMES
  // this place actually has - which professions are represented, which
  // specialties, which adjacent towns - all derived from live data, all unique
  // per place, and none of them a number.
  const typesText = types.map((t) => t.label).join(", ");
  const statsBits: string[] = [];
  const detailBits: string[] = [];
  // Which adjacent places contribute, named.
  const alsoBits: string[] = [];
  if (nearby.length > 0 && nearbyPlaces.length > 0) alsoBits.push(`וגם בערים הצמודות (${nearbyPlaces.join(", ")})`);
  else if (nearby.length > 0) alsoBits.push("וגם בערים הצמודות");
  if (regionNearby.length > 0) alsoBits.push(`וגם באזור ${regionName ?? ""}`.trim());

  if (total > 0 || alsoShown.length > 0) {
    const here = total > 0 ? inPlace : `בטווח נסיעה קצר ${inPlace}`;
    statsBits.push(
      kind === "online"
        ? h % 2 === 0
          ? "בטיפול חכם אפשר לעבור על המטפלים והפסיכולוגים שתעודותיהם אומתו ולפנות ישירות למי שנראה מתאים, או למלא שאלון שנבנה על ידי פסיכולוגים קליניים ומבוסס מחקר"
          : "דרך טיפול חכם אפשר לפנות ישירות למטפלים ולפסיכולוגים שתעודותיהם אומתו, או למלא שאלון קצר שנבנה על ידי פסיכולוגים קליניים ומבוסס מחקר"
        : h % 2 === 0
          ? `${here} אפשר לעבור על המטפלים והפסיכולוגים שתעודות ההכשרה שלהם אומתו ולפנות ישירות, או למלא שאלון שנבנה על ידי פסיכולוגים קליניים ומבוסס מחקר`
          : `דרך טיפול חכם אפשר לפנות ישירות למטפלים ולפסיכולוגים ${here} שתעודותיהם אומתו, או למלא שאלון קצר שנבנה על ידי פסיכולוגים קליניים ומבוסס מחקר`
    );
    statsBits.push(...alsoBits);
    if (kind !== "online" && onlineHere > 0) detailBits.push("חלקם מטפלים גם אונליין");
    if (typesText) detailBits.push(`בין המטפלים ברשימה: ${typesText}`);
    if (women > 0 && men > 0) detailBits.push("מטפלות ומטפלים כאחד");
    if (specialties.length >= 2) detailBits.push(`בין תחומי ההתמחות: ${specialties.join(", ")}`);
  } else {
    statsBits.push(`ההיצע ${inPlace} מתעדכן - בינתיים אפשר לפנות למטפלים שתעודותיהם אומתו ומטפלים אונליין מכל הארץ`);
    if (regionName) statsBits.push(`וכן למטפלים באזור ${regionName}`);
  }
  const statsParagraph = [
    `${statsBits.join(", ")}.`,
    detailBits.length > 0 ? `${detailBits.join(", ")}.` : "",
    "הרשימה מתעדכנת באופן שוטף.",
  ]
    .filter(Boolean)
    .join(" ");

  // FAQ - phrasing varies by place hash; the content stays honest and generic-
  // free (no invented city facts, no fake price differences between cities).
  // Region-aware price range (see region-public-services.ts - anchored to the
  // hebpsy tariff surveys; center runs higher than the periphery).
  const price = (regionName && REGION_PRICE_RANGE[regionName]) || { min: 300, max: 550 };
  // A context sentence explaining WHY this area sits where it does relative to
  // the national average - real local prose, not just swapped numbers. Tier is
  // derived from the range itself (>=350 center, >=300 mid, else periphery).
  const tier = price.min >= 350 ? "high" : price.min >= 300 ? "mid" : "low";
  const cityPrefix = kind === "city" && regionName ? `${placeName} שייכת לאזור ${regionName}, ו` : "";
  const areaRef = regionName ? `באזור ${regionName}` : "באזור";
  const priceContext =
    kind === "online"
      ? ""
      : tier === "high"
        ? (h % 2 === 0
            ? `${cityPrefix}${cityPrefix ? "זהו" : `${areaRef} -`} מאזורי הביקוש הגבוהים בארץ, שבהם תעריפי הטיפול גבוהים לרוב מהממוצע הארצי. `
            : `${cityPrefix}${cityPrefix ? "" : `${areaRef} `}תעריפי הטיפול בלב המרכז נוטים להיות מעל הממוצע הארצי, בשל הביקוש הגבוה וריכוז הקליניקות. `)
        : tier === "mid"
          ? `${cityPrefix}${cityPrefix ? "" : `${areaRef} `}תעריפי הטיפול קרובים לרוב לממוצע הארצי. `
          : (h % 2 === 0
              ? `${cityPrefix}${cityPrefix ? "" : `${areaRef} `}בשל המרחק ממרכז הארץ, התעריפים נמוכים לרוב מהממוצע הארצי. `
              : `${cityPrefix}${cityPrefix ? "" : `${areaRef} `}התעריפים נוחים יותר בהשוואה לגוש דן ולמרכז. `);
  const costQ = kind === "online" ? "כמה עולה טיפול פסיכולוגי אונליין?" : `כמה עולה טיפול פסיכולוגי פרטי ${inPlace}?`;
  const costA =
    priceContext +
    (kind === "online"
      ? `בטיפול אונליין הטווח רחב במיוחד - לרוב בין 280 ל־550 ש״ח לפגישה - כי אפשר לבחור מטפל מכל אזור בארץ, כולל אזורים שבהם התעריפים נמוכים יותר.`
      : h % 2 === 0
        ? `לפי סקרי התעריפים בענף, הממוצע הארצי לפגישת טיפול פרטית הוא סביב 400 ש״ח, וכאן המחיר נע לרוב בין ${price.min} ל־${price.max} ש״ח - בהתאם להכשרת המטפל (פסיכולוג מומחה, עו״ס קליני, מטפל CBT ועוד) ולניסיון.`
        : `בפועל, פגישת טיפול פרטית ${inPlace} עולה לרוב בין ${price.min} ל־${price.max} ש״ח (הממוצע הארצי בסקרי התעריפים - סביב 400 ש״ח). המחיר מושפע בעיקר מההכשרה ומהניסיון של המטפל.`) +
    ` פרטים מדויקים אפשר לברר ישירות מול המטפל - יצירת הקשר דרך הפרופיל היא ללא עלות וללא התחייבות.`;

  const chooseQ = `איך בוחרים ${kind === "online" ? "מטפל אונליין" : `פסיכולוג ${inPlace}`} שמתאים לי?`;
  const chooseA =
    `המחקר עקבי: איכות הקשר בין מטופל למטפל היא מהמנבאים החזקים ביותר להצלחת הטיפול - לעיתים יותר מהשיטה עצמה. חשוב לבדוק הכשרה ורישיון, התמחות בקושי שלכם, ותחושת נוחות בשיחה הראשונה.`;

  // "מומלץ" intent - the review-flavored query variant ("פסיכולוג מומלץ בחיפה").
  // Answered honestly: what a real recommendation is (credentials, license
  // registry, fit), what WE verify, and no fabricated reviews.
  const recQ = kind === "online" ? "איך מזהים פסיכולוג מומלץ לטיפול אונליין?" : `איך מזהים פסיכולוג מומלץ ${inPlace}?`;
  const recA =
    (h % 2 === 0
      ? `המלצה אמיתית היא לא כוכבים באתר - היא שילוב של שלושה דברים: הכשרה ורישיון בתוקף (אפשר לוודא בפנקס הפסיכולוגים של משרד הבריאות), ניסיון מוכח בקושי הספציפי שלכם, ותחושת חיבור בשיחה הראשונה.`
      : `לפני שסומכים על "מומלץ", כדאי לבדוק שלושה דברים: שהמטפל מחזיק בהכשרה וברישיון בתוקף, שיש לו ניסיון בקושי שאיתו אתם מתמודדים, ושנוח לכם איתו בשיחה ראשונה - המחקר מראה שהחיבור האישי מנבא הצלחה יותר מכל המלצה.`) +
    ` כל המטפלים המוצגים כאן עברו אימות תעודות והכשרה לפני שפורסמו, כך שנקודת הפתיחה בטוחה - ומשם ההמלצה הכי טובה היא ההתרשמות שלכם.`;

  const onlineQ =
    kind === "online"
      ? "האם טיפול אונליין באמת עובד כמו טיפול בקליניקה?"
      : `לא מצאתם מטפל פנוי ${inPlace} - מה עושים?`;
  const onlineA =
    kind === "online"
      ? `מחקרים מהשנים האחרונות מראים שטיפול בשיחת וידאו משיג תוצאות דומות לטיפול פנים־אל־פנים ברוב הקשיים הנפוצים (חרדה, דיכאון, קשיי הסתגלות). היתרון: גישה למטפל המתאים ביותר - לא רק לקרוב ביותר.`
      : `שווה לשקול טיפול אונליין: מחקרים מראים שטיפול בווידאו משיג תוצאות דומות לטיפול בקליניקה ברוב הקשיים הנפוצים, והוא פותח גישה למטפלים מכל הארץ${regionName ? `, בנוסף למטפלים באזור ${regionName}` : ""}.`;

  const kupaQ = "טיפול פרטי או דרך קופת החולים?";
  const kupaA =
    h % 2 === 0
      ? `דרך הקופה הטיפול מסובסד, אך זמני ההמתנה ארוכים לרוב (חודשים במקרים רבים) והבחירה במטפל מוגבלת. טיפול פרטי מתחיל מהר, מאפשר לבחור מטפל שמתאים לכם - וחלק מהביטוחים המשלימים מחזירים חלק מהעלות.`
      : `לשני המסלולים יתרונות: הקופה זולה משמעותית אבל כרוכה בהמתנה ארוכה ובבחירה מוגבלת; במסלול פרטי מתחילים תוך ימים ובוחרים בדיוק את המטפל. כדאי לבדוק גם החזרים מהביטוח המשלים שלכם.`;

  const faq: { q: string; a: string; link: { href: string; label: string } | null }[] = [
    { q: costQ, a: costA, link: null },
    { q: chooseQ, a: chooseA, link: { href: "/research/choosing-therapist", label: "למדריך המלא: איך למצוא פסיכולוג שמתאים ←" } },
    { q: recQ, a: recA, link: { href: "/research/recommended-psychologist", label: "המדריך: מה באמת הופך פסיכולוג למומלץ ←" } },
    { q: onlineQ, a: onlineA, link: kind === "online" ? null : { href: "/therapists/region/אונליין", label: "לכל המטפלים אונליין ←" } },
    { q: kupaQ, a: kupaA, link: null },
  ];

  // Public mental-health services in the region (hospitals / psychiatric
  // departments, with operator) - curated in region-public-services.ts.
  const services = regionName && kind !== "online" ? REGION_PUBLIC_SERVICES[regionName] ?? [] : [];
  if (services.length > 0) {
    const servicesList = services
      .map((s) => `${s.name} - ${s.kind === "מרכז לבריאות הנפש" ? "מרכז לבריאות הנפש" : "מחלקה פסיכיאטרית"} (${s.city}; ${s.operator})`)
      .join(" · ");
    faq.push({
      q: `אילו שירותי בריאות נפש ציבוריים יש באזור${regionName ? ` ${regionName}` : ""}?`,
      a:
        `מוסדות ציבוריים מרכזיים באזור: ${servicesList}. ` +
        `בנוסף, לכל קופות החולים (כללית, מכבי, מאוחדת, לאומית) מרפאות בריאות נפש אזוריות - טיפול ציבורי במסגרת הסל, בחינם או בהשתתפות נמוכה, בהפניה מרופא/ת המשפחה. זמני ההמתנה משתנים ממרפאה למרפאה.`,
      link: null,
    });
  }

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <section className="mt-14 pt-10 border-t border-[var(--line)]" style={{ maxWidth: "72ch" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd).replace(/</g, "\\u003c") }} />
      <h2 className="text-xl font-extrabold mb-4" style={{ color: "var(--text)" }}>
        {headings[h % headings.length]}
      </h2>
      {/* data-nosnippet: still indexed for ranking, but Google may not quote it.
          This paragraph kept winning the snippet over the intro line, which is
          the one written to earn the click. */}
      <p className="text-[15px] leading-8 text-stone-600 mb-6" data-nosnippet>{statsParagraph}</p>

      {articles.length > 0 && (
        <div className="mb-8">
          <h3 className="text-base font-extrabold mb-3" style={{ color: "var(--text)" }}>
            {kind === "online"
              ? "מאמרים ממטפלים שמטפלים אונליין"
              : articlesScope === "region" && regionName
                ? `מאמרים ממטפלים באזור ${regionName}`
                : `מאמרים ממטפלים ${inPlace}`}
          </h3>
          <ul className="space-y-3.5">
            {articles.map((a) => (
              <li key={a.slug} className="text-sm leading-7">
                <Link
                  href={`/research/community/${encodeURIComponent(a.slug)}`}
                  className="font-semibold hover:underline"
                  style={{ color: "var(--teal-dark)" }}
                >
                  {a.title}
                </Link>
                <span className="text-stone-500"> - מאת {a.author}</span>
                {a.summary && (
                  <span className="block text-stone-500">{truncateChars(a.summary, 180)}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2.5">
        {faq.map((f) => (
          <details key={f.q} className="group rounded-xl border border-[var(--line)] bg-white px-5 py-3.5">
            <summary className="cursor-pointer list-none flex items-center justify-between gap-3 text-[15px] font-bold text-stone-800">
              {f.q}
              <span className="text-stone-400 transition-transform group-open:rotate-180" aria-hidden>▾</span>
            </summary>
            <div className="pt-3 text-sm leading-7 text-stone-600">
              {f.a}
              {f.link && (
                <>
                  {" "}
                  <Link href={f.link.href} className="font-semibold hover:underline" style={{ color: "var(--teal-dark)" }}>
                    {f.link.label}
                  </Link>
                </>
              )}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
