import Link from "next/link";
import type { PublicTherapist } from "./TherapistsClient";

// SEO content block for city/region landing pages, rendered BELOW the
// therapist listings (patients rarely scroll past the cards; crawlers read it
// all — the alhasapa/betipulnet pattern). Three anti-"doorway page" measures:
//  1. The stats are DERIVED FROM LIVE DATA, so every city's text is genuinely
//     different (and self-updates as supply changes).
//  2. Headings/phrasings rotate deterministically per place name.
//  3. Small-supply places get adapted wording instead of boilerplate.
// Native <details> accordions — no JS, SSR-rendered, fully indexable.

type Kind = "city" | "region" | "online";

// Deterministic per-place variant picker (stable across builds — no Math.random,
// which would make Google see a different page on every crawl).
function hashPlace(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return h;
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
}: {
  placeName: string;
  kind: Kind;
  therapists: PublicTherapist[];
  onlineCount: number;
  regionName?: string | null;
}) {
  const h = hashPlace(placeName);
  const total = therapists.length;
  const types = typeBreakdown(therapists);
  const specialties = topSpecialties(therapists);
  const onlineHere = therapists.filter((t) => t.online).length;
  const women = therapists.filter((t) => t.gender === "נקבה").length;
  const men = total - women;

  const inPlace = kind === "online" ? "בטיפול אונליין" : `ב${placeName}`;

  const headings = [
    `טיפול פסיכולוגי ${inPlace} — מה חשוב לדעת`,
    `מחפשים פסיכולוג ${inPlace}? כמה דברים שכדאי לדעת`,
    `פסיכולוגים ומטפלים ${inPlace} — שאלות ותשובות`,
  ];

  // Live-data supply paragraph — this is what makes each page genuinely unique.
  const typesText = types.map((t) => `${t.label} (${t.count})`).join(" · ");
  const statsBits: string[] = [];
  if (total >= 3) {
    statsBits.push(
      h % 2 === 0
        ? `${inPlace === "בטיפול אונליין" ? "באונליין" : inPlace} מוצגים כרגע ${total} מטפלים מאומתים דרך טיפול חכם`
        : `דרך טיפול חכם מוצגים כרגע ${total} מטפלים מאומתים ${inPlace}`
    );
    if (typesText) statsBits.push(`לפי הכשרה: ${typesText}`);
    if (kind !== "online" && onlineHere > 0)
      statsBits.push(`${onlineHere} מתוכם מטפלים גם אונליין`);
    if (women > 0 && men > 0) statsBits.push(`במאגר מטפלות ומטפלים (${women} נשים, ${men} גברים)`);
    if (specialties.length >= 2) statsBits.push(`בין תחומי ההתמחות: ${specialties.join(", ")}`);
  } else if (total > 0) {
    statsBits.push(
      `${inPlace} מוצגים כרגע ${total === 1 ? "מטפל/ת מאומת/ת אחד/ת" : `${total} מטפלים מאומתים`} דרך טיפול חכם`
    );
    if (regionName) statsBits.push(`בנוסף פעילים מטפלים נוספים באזור ${regionName}`);
    statsBits.push(`ו-${onlineCount} מטפלים זמינים אונליין מכל מקום`);
  } else {
    statsBits.push(`ההיצע ${inPlace} מתעדכן — בינתיים זמינים ${onlineCount} מטפלים מאומתים אונליין`);
    if (regionName) statsBits.push(`ומטפלים נוספים באזור ${regionName}`);
  }
  const statsParagraph = `${statsBits.join(", ")}. הרשימה מתעדכנת באופן שוטף.`;

  // FAQ — phrasing varies by place hash; the content stays honest and generic-
  // free (no invented city facts, no fake price differences between cities).
  const costQ = kind === "online" ? "כמה עולה טיפול פסיכולוגי אונליין?" : `כמה עולה טיפול פסיכולוגי פרטי ${inPlace}?`;
  const costA =
    (h % 2 === 0
      ? `טווח המחירים המקובל בישראל לפגישת טיפול פרטית נע לרוב בין 250 ל־500 ש״ח, בהתאם להכשרת המטפל (פסיכולוג מומחה, עו״ס קליני, מטפל CBT ועוד), לניסיון ולאזור.`
      : `בישראל, פגישת טיפול פרטית עולה לרוב בין 250 ל־500 ש״ח — המחיר תלוי בעיקר בהכשרה ובניסיון של המטפל, פחות בעיר עצמה.`) +
    ` פרטים מדויקים אפשר לברר ישירות מול המטפל — יצירת הקשר דרך הפרופיל היא ללא עלות וללא התחייבות.`;

  const chooseQ = `איך בוחרים ${kind === "online" ? "מטפל אונליין" : `פסיכולוג ${inPlace}`} שמתאים לי?`;
  const chooseA =
    `המחקר עקבי: איכות הקשר בין מטופל למטפל היא מהמנבאים החזקים ביותר להצלחת הטיפול — לעיתים יותר מהשיטה עצמה. חשוב לבדוק הכשרה ורישיון, התמחות בקושי שלכם, ותחושת נוחות בשיחה הראשונה.`;

  const onlineQ =
    kind === "online"
      ? "האם טיפול אונליין באמת עובד כמו טיפול בקליניקה?"
      : `לא מצאתם מטפל פנוי ${inPlace} — מה עושים?`;
  const onlineA =
    kind === "online"
      ? `מחקרים מהשנים האחרונות מראים שטיפול בשיחת וידאו משיג תוצאות דומות לטיפול פנים־אל־פנים ברוב הקשיים הנפוצים (חרדה, דיכאון, קשיי הסתגלות). היתרון: גישה למטפל המתאים ביותר — לא רק לקרוב ביותר.`
      : `שווה לשקול טיפול אונליין: מחקרים מראים שטיפול בווידאו משיג תוצאות דומות לטיפול בקליניקה ברוב הקשיים הנפוצים, והוא פותח גישה ל־${onlineCount} מטפלים מאומתים מכל הארץ${regionName ? `, בנוסף למטפלים באזור ${regionName}` : ""}.`;

  const kupaQ = "טיפול פרטי או דרך קופת החולים?";
  const kupaA =
    h % 2 === 0
      ? `דרך הקופה הטיפול מסובסד, אך זמני ההמתנה ארוכים לרוב (חודשים במקרים רבים) והבחירה במטפל מוגבלת. טיפול פרטי מתחיל מהר, מאפשר לבחור מטפל שמתאים לכם — וחלק מהביטוחים המשלימים מחזירים חלק מהעלות.`
      : `לשני המסלולים יתרונות: הקופה זולה משמעותית אבל כרוכה בהמתנה ארוכה ובבחירה מוגבלת; במסלול פרטי מתחילים תוך ימים ובוחרים בדיוק את המטפל. כדאי לבדוק גם החזרים מהביטוח המשלים שלכם.`;

  const faq = [
    { q: costQ, a: costA, link: null },
    { q: chooseQ, a: chooseA, link: { href: "/research/choosing-therapist", label: "למדריך המלא: איך למצוא פסיכולוג שמתאים ←" } },
    { q: onlineQ, a: onlineA, link: kind === "online" ? null : { href: "/therapists/region/אונליין", label: "לכל המטפלים אונליין ←" } },
    { q: kupaQ, a: kupaA, link: null },
  ];

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
