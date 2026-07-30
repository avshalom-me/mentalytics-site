import Link from "next/link";
import type { PublicTherapist } from "./TherapistsClient";
import { REGION_PRICE_RANGE, REGION_PUBLIC_SERVICES } from "@/app/lib/region-public-services";
import type { LocalArticle } from "@/app/lib/local-articles";

// SEO content block for city/region landing pages, rendered BELOW the
// therapist listings (patients rarely scroll past the cards; crawlers read it
// all - the alhasapa/betipulnet pattern). Three anti-"doorway page" measures:
//  1. The stats are DERIVED FROM LIVE DATA, so every city's text is genuinely
//     different (and self-updates as supply changes).
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

/** Hebrew has no "1 גברים" - a count of one takes the singular form, no numeral. */
function countLabel(n: number, one: string, plural: string): string {
  return n === 1 ? one : `${n} ${plural}`;
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
    if (main) counts.set(main, (counts.get(main) ?? 0) + 1);
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
  therapists,
  onlineCount,
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
  onlineCount: number;
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
  const total = therapists.length;
  // The breakdown must describe what the page ACTUALLY lists, otherwise the text
  // undercounts the grid above it. An earlier version gated this on `total >= 3`
  // while the page renders adjacent-city cards whenever in-city < 6, so a city
  // with 3 of its own and 20 neighbours printed "3 מטפלים" above 23 cards.
  // No threshold here at all now: whatever is rendered is what gets counted,
  // and the wording below keeps the groups separate.
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

  // Live-data supply paragraph - this is what makes each page genuinely unique.
  const typesText = types.map((t) => `${t.label} (${t.count})`).join(" · ");
  const statsBits: string[] = [];
  // Where the extra cards came from, named. Adjacent cities are listed by name;
  // the wider-region fallback can only be described by its region.
  const alsoBits: string[] = [];
  if (nearby.length > 0) {
    alsoBits.push(
      nearbyPlaces.length > 0
        ? `ועוד ${nearby.length} מטפלים בערים הצמודות (${nearbyPlaces.join(", ")})`
        : `ועוד ${nearby.length} מטפלים בערים הצמודות`
    );
  }
  if (regionNearby.length > 0) {
    alsoBits.push(`ועוד ${regionNearby.length} מטפלים באזור ${regionName ?? ""}`.trim());
  }

  if (total > 0) {
    statsBits.push(
      total >= 3 && h % 2 === 0
        ? `${inPlace === "בטיפול אונליין" ? "באונליין" : inPlace} מוצגים כרגע ${total} מטפלים מאומתים דרך טיפול חכם`
        : total >= 3
          ? `דרך טיפול חכם מוצגים כרגע ${total} מטפלים מאומתים ${inPlace}`
          : `${inPlace} מוצג כרגע ${total === 1 ? "מטפל/ת מאומת/ת אחד/ת" : `${total} מטפלים מאומתים`} דרך טיפול חכם`
    );
    statsBits.push(...alsoBits);
    if (typesText) statsBits.push(alsoBits.length > 0 ? `לפי הכשרה, בכל הרשימה יחד: ${typesText}` : `לפי הכשרה: ${typesText}`);
    if (kind !== "online" && onlineHere > 0) statsBits.push(`${onlineHere} מתוכם מטפלים גם אונליין`);
    if (women > 0 && men > 0) statsBits.push(`מטפלות ומטפלים כאחד (${countLabel(women, "אישה אחת", "נשים")}, ${countLabel(men, "גבר אחד", "גברים")})`);
    if (specialties.length >= 2) statsBits.push(`בין תחומי ההתמחות: ${specialties.join(", ")}`);
    statsBits.push(`ו-${onlineCount} מטפלים זמינים אונליין מכל מקום`);
  } else if (alsoShown.length > 0) {
    const where =
      nearby.length > 0
        ? `בערים הצמודות${nearbyPlaces.length > 0 ? ` (${nearbyPlaces.join(", ")})` : ""}`
        : `באזור ${regionName ?? ""}`.trim();
    statsBits.push(
      `${inPlace} עצמה טרם נרשמו מטפלים במאגר, אך ${where} מוצגים כרגע ${alsoShown.length} מטפלים מאומתים`
    );
    if (typesText) statsBits.push(`לפי הכשרה: ${typesText}`);
    if (women > 0 && men > 0) statsBits.push(`מטפלות ומטפלים כאחד (${countLabel(women, "אישה אחת", "נשים")}, ${countLabel(men, "גבר אחד", "גברים")})`);
    if (specialties.length >= 2) statsBits.push(`בין תחומי ההתמחות: ${specialties.join(", ")}`);
    statsBits.push(`ובנוסף ${onlineCount} מטפלים זמינים אונליין מכל מקום`);
  } else {
    statsBits.push(`ההיצע ${inPlace} מתעדכן - בינתיים זמינים ${onlineCount} מטפלים מאומתים אונליין`);
    if (regionName) statsBits.push(`ומטפלים נוספים באזור ${regionName}`);
  }
  const statsParagraph = `${statsBits.join(", ")}. הרשימה מתעדכנת באופן שוטף.`;

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
      : `שווה לשקול טיפול אונליין: מחקרים מראים שטיפול בווידאו משיג תוצאות דומות לטיפול בקליניקה ברוב הקשיים הנפוצים, והוא פותח גישה ל־${onlineCount} מטפלים מאומתים מכל הארץ${regionName ? `, בנוסף למטפלים באזור ${regionName}` : ""}.`;

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
      <p className="text-[15px] leading-8 text-stone-600 mb-6">{statsParagraph}</p>

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
