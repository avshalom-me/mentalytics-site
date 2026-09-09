import { ARTICLE_TOPICS } from "@/app/lib/articles";

/**
 * The single source of truth for how articles are organised, and for the link
 * between an article topic and the therapist-directory page that answers the
 * same need.
 *
 * Why this exists: /research used to be grouped by WHO wrote a piece
 * ("מידע מקצועי" / "שאלות חשובות" / "מאמרים מאת מטפלי האתר") - three hardcoded
 * <h2> headings. But nobody searches by authorship; they search by subject. At
 * the same time `ARTICLE_TOPICS` (the buckets therapists tag their own articles
 * with) already existed and was rendered as a decorative label and nothing else.
 *
 * Two axes, deliberately:
 *   - SECTIONS are reader intent, and they are what /research renders.
 *   - `articleTopics` maps the clinical ARTICLE_TOPICS values into a section, so
 *     a therapist tagging "טראומה" lands in the right place automatically.
 *
 * Forcing all 17 editorial guides into the 9 clinical buckets would have dumped
 * nine of them into "כללי", which serves no search intent at all. Most of the
 * editorial set is meta ("how do I choose", "what does it cost") - real intents
 * that deserve their own sections.
 *
 * `directory` is the commercial counterpart of each section: the informational
 * article and the therapist list are two halves of the same query, and each
 * should link to the other.
 */

export type ArticleTopic = (typeof ARTICLE_TOPICS)[number];

export type Section = {
  slug: string;
  name: string;
  /** One line under the section heading, and the hub page's meta description. */
  blurb: string;
  /** ARTICLE_TOPICS values that route a community article into this section. */
  articleTopics: ArticleTopic[];
  /** Directory pages answering the commercial intent behind this section. */
  directory: { href: string; label: string }[];
};

export const SECTIONS: Section[] = [
  {
    slug: "בחירת-טיפול-ומטפל",
    name: "בחירת טיפול ומטפל",
    blurb: "איך בוחרים גישה טיפולית, איך מזהים מטפל שמתאים לכם, ומה המחקר אומר על ההתאמה בין השניים.",
    articleTopics: [],
    directory: [
      { href: "/therapists", label: "מאגר המטפלים" },
      { href: "/therapists/specialty", label: "לפי גישה טיפולית" },
      { href: "/adults", label: "שאלון ההכוונה" },
    ],
  },
  {
    slug: "אבחונים-והערכות",
    name: "אבחונים והערכות",
    blurb: "פסיכודידקטי, פסיכודיאגנוסטי, נוירופסיכולוגי ואבחון קשב: מה כל אחד בודק, מי מוסמך לבצע ומה עולה.",
    articleTopics: ["אבחון והערכה"],
    directory: [
      { href: "/therapists/assessment", label: "כל המאבחנים לפי סוג אבחון" },
      { href: "/therapists/assessment/פסיכודידקטי", label: "מאבחנים פסיכודידקטי" },
      { href: "/therapists/topic/טיפול-בקשיי-קשב", label: "מטפלים בקשיי קשב" },
    ],
  },
  {
    slug: "חרדה-ולחץ",
    name: "חרדה ולחץ",
    blurb: "מה עובד בטיפול בחרדה, איך מבדילים בין חרדה רגילה להפרעה, ומה אומר המחקר על כל מסלול טיפול.",
    articleTopics: ["חרדה ולחץ"],
    directory: [
      { href: "/therapists/topic/טיפול-בחרדה", label: "מטפלים בחרדה" },
      { href: "/therapists/specialty/CBT", label: "מטפלי CBT" },
    ],
  },
  {
    slug: "טראומה",
    name: "טראומה",
    blurb: "טיפול בטראומה ובפוסט טראומה: הגישות המבוססות מחקרית, וזכויות למי שנפגע.",
    articleTopics: ["טראומה"],
    directory: [
      { href: "/therapists/topic/טיפול-בטראומה", label: "מטפלים בטראומה" },
      { href: "/therapists/specialty/EMDR", label: "מטפלי EMDR" },
    ],
  },
  {
    slug: "דיכאון-ומצב-רוח",
    name: "דיכאון ומצב רוח",
    blurb: "מתי דכדוך הופך לדיכאון, ואילו טיפולים הוכחו כיעילים.",
    articleTopics: ["דיכאון ומצב רוח"],
    directory: [{ href: "/therapists/topic/טיפול-בדיכאון", label: "מטפלים בדיכאון" }],
  },
  {
    slug: "התמכרויות",
    name: "התמכרויות",
    blurb: "טיפול בהתמכרויות - לחומרים, אלכוהול, מסכים והימורים: מה עובד, ואיך עושים את הצעד הראשון.",
    articleTopics: ["התמכרויות"],
    directory: [
      { href: "/therapists/specialty/טיפול-בהתמכרויות", label: "מטפלים בהתמכרויות" },
      { href: "/adults", label: "שאלון ההכוונה" },
    ],
  },
  {
    slug: "ילדים-ונוער",
    name: "ילדים ונוער",
    blurb: "מתי ילד צריך טיפול רגשי, איך בוחרים מטפל לילד, ומה קורה בגיל ההתבגרות.",
    articleTopics: ["טיפול בילדים ונוער"],
    directory: [
      { href: "/therapists/topic/פסיכולוג-ילדים", label: "פסיכולוגים לילדים" },
      { href: "/therapists/topic/פסיכולוג-לנוער", label: "פסיכולוגים לנוער" },
      { href: "/kids", label: "שאלון לילדים ונוער" },
    ],
  },
  {
    slug: "הורות",
    name: "הורות והדרכת הורים",
    blurb: "הדרכת הורים ככלי טיפולי, ומה ההורים באמת יכולים לשנות.",
    articleTopics: ["הורות"],
    directory: [{ href: "/therapists/specialty/הדרכת-הורים", label: "מדריכי הורים" }],
  },
  {
    slug: "זוגיות-ומשפחה",
    name: "זוגיות ומשפחה",
    blurb: "טיפול זוגי ומשפחתי: מתי הוא מתאים, ומה קורה בו בפועל.",
    articleTopics: ["זוגיות ומשפחה"],
    directory: [
      { href: "/therapists/specialty/טיפול-זוגי", label: "מטפלים זוגיים" },
      { href: "/therapists/specialty/טיפול-משפחתי", label: "מטפלים משפחתיים" },
    ],
  },
  {
    slug: "מסגרת-עלות-וזכויות",
    name: "מסגרת, עלות וזכויות",
    blurb: "כמה עולה טיפול, מה מכסות קופות החולים, האם טיפול אונליין עובד, ולאילו החזרים אתם זכאים.",
    articleTopics: [],
    directory: [
      { href: "/therapists/arrangement", label: "מי מממן טיפול נפשי" },
      { href: "/therapists/arrangement/קופות-חולים", label: "מטפלים בהסדר עם הקופות" },
      { href: "/therapists/region/אונליין", label: "מטפלים אונליין" },
    ],
  },
  {
    slug: "טיפול-במבוגרים",
    name: "טיפול במבוגרים",
    blurb: "תובנות מהחדר: איך טיפול נפשי עובד, וכמה זמן לוקח עד שמרגישים שינוי.",
    articleTopics: ["טיפול במבוגרים", "כללי"],
    directory: [{ href: "/therapists", label: "מאגר המטפלים" }],
  },
];

export function sectionBySlug(slug: string): Section | null {
  let decoded = slug;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    /* keep raw */
  }
  return SECTIONS.find((s) => s.slug === decoded) ?? null;
}

/** Routes a community article's `topic` value to its section. */
export function sectionForTopic(topic: string | null): Section | null {
  if (!topic) return null;
  return SECTIONS.find((s) => (s.articleTopics as string[]).includes(topic)) ?? null;
}

/**
 * The reverse direction: given a directory page path (e.g.
 * "/therapists/topic/טיפול-בחרדה"), which article section speaks to it.
 *
 * Lets a therapist landing page pull the matching reading list without a second
 * mapping table that could drift out of sync with `directory` above.
 */
export function sectionForDirectoryHref(href: string): Section | null {
  return SECTIONS.find((s) => s.directory.some((d) => d.href === href)) ?? null;
}

/**
 * Editorial guest articles written by a listed therapist, keyed by therapist id.
 *
 * These live as code pages under /research/, not as rows in therapist_articles,
 * so the profile page cannot find them the way it finds community pieces. This
 * map is the bridge - deliberately a map and not a second DB row, because a row
 * would mint a /research/community/ URL for an article that already has one.
 */
export const GUEST_ARTICLES_BY_THERAPIST: Record<string, { href: string; title: string; desc: string }[]> = {
  // ד"ר דניאל היימן
  "d4954f74-8361-424c-bcd7-a490cfc427ba": [
    {
      href: "/research/jealousy-polyamory",
      title: "מה שקנאה מלמדת על כל זוגיות",
      desc: "גרסה מקוצרת של פרק ממחקר הדוקטורט על פוליאמוריה: למה חוקים לא מחליפים הקשבה.",
    },
  ],
};

export type EditorialArticle = {
  /** Path segment under /research/. */
  slug: string;
  title: string;
  desc: string;
  img: string;
  section: string;
  imgPosition?: string;
  /** Surfaced first inside its section. */
  featured?: boolean;
};

/**
 * The hand-written guides. Previously split across two arrays in
 * app/research/page.tsx ("TOPICS" and "QUESTIONS") whose only real difference
 * was which heading they sat under.
 */
export const EDITORIAL_ARTICLES: EditorialArticle[] = [
  {
    slug: "jealousy-polyamory",
    title: "מה שקנאה מלמדת על כל זוגיות",
    desc: "מתוך מחקר דוקטורט על פוליאמוריה: למה חוקים לא מחליפים הקשבה, ומה מסתתר מאחורי \"אני לא חשוב לך\". מאת ד\"ר דניאל היימן.",
    img: "https://images.unsplash.com/photo-1543269865-cbf427effbad?w=600&h=260&fit=crop&auto=format&q=75",
    section: "זוגיות-ומשפחה",
    featured: true,
  },
  // ── בחירת טיפול ומטפל ──────────────────────────────────────────────────────
  {
    slug: "how-matching-works",
    title: "איך עובדת ההתאמה בטיפול חכם",
    desc: "על מה המודל נשען, מה השאלון מודד, איך מחושבת ההתאמה - ומה המודל לא עושה.",
    img: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&h=260&fit=crop&auto=format&q=75",
    section: "בחירת-טיפול-ומטפל",
  },
  {
    slug: "recommended-psychologist",
    title: "פסיכולוג מומלץ - איך מוצאים פסיכולוג טוב?",
    desc: "למה 'המלצה על פסיכולוג' היא עניין אישי, ואיך למצוא פסיכולוג טוב שמתאים דווקא לכם.",
    img: "https://images.unsplash.com/photo-1543269865-cbf427effbad?w=600&h=260&fit=crop&auto=format&q=75",
    section: "בחירת-טיפול-ומטפל",
    featured: true,
  },
  {
    slug: "choosing-therapist",
    title: "איך מוצאים פסיכולוג שמתאים?",
    desc: "מה לשאול בשיחת היכרות, אילו פרמטרים חשובים, ומה המחקר אומר על ברית טיפולית.",
    img: "https://images.unsplash.com/photo-1776886099265-6366478b341b?w=600&h=260&fit=crop&auto=format&q=75",
    section: "בחירת-טיפול-ומטפל",
  },
  {
    slug: "which-therapy",
    title: "איזה טיפול פסיכולוגי מתאים לי?",
    desc: "מדריך מעשי לבחירת סוג הטיפול הנכון לפי הצורך, האישיות וסגנון החיים.",
    img: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=600&h=260&fit=crop&auto=format&q=75",
    section: "בחירת-טיפול-ומטפל",
  },
  {
    slug: "therapy-types",
    title: "סוגי הטיפולים השונים",
    desc: "CBT, דינאמי, EMDR, DBT, ACT ועוד - הסבר נגיש על כל גישה טיפולית ומה מתאים למי.",
    img: "https://images.unsplash.com/photo-1637245048732-adf1a547835e?w=600&h=260&fit=crop&auto=format&q=75",
    section: "בחירת-טיפול-ומטפל",
  },
  {
    slug: "cbt-vs-dynamic",
    title: "הבדל בין CBT לטיפול דינמי",
    desc: "שתי הגישות הנפוצות ביותר - מה ההבדל בפועל, ומי מתאים לאיזה מטופל?",
    img: "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?w=600&h=260&fit=crop&auto=format&q=75",
    section: "בחירת-טיפול-ומטפל",
  },
  {
    slug: "first-session",
    title: "הפגישה הראשונה אצל פסיכולוג",
    desc: "מה קורה בפגישה, מה שואלים, מה אם בוכים או משתתקים, וכמה זה עולה.",
    img: "https://images.unsplash.com/photo-1714976694810-85add1a29c96?w=600&h=260&fit=crop&auto=format&q=75",
    section: "בחירת-טיפול-ומטפל",
  },
  {
    slug: "therapist-types",
    title: "סוגי המטפלים בישראל",
    desc: 'פסיכולוג קליני, עו"ס קליני, מטפל בהבעה ויצירה - מה ההבדל ומי מתאים למה?',
    img: "https://images.unsplash.com/photo-1758273241078-8eec353836be?w=600&h=260&fit=crop&auto=format&q=75",
    section: "בחירת-טיפול-ומטפל",
  },
  {
    slug: "therapist-patient-match",
    title: 'על הקושי בהתאמה טיפולית ואישיותית בין מטפל ומטופל',
    desc: "מה המחקר אומר על התאמה אישיותית בין מטפל למטופל - גישת ההשלמה מול גישת הדמיון.",
    img: "https://images.unsplash.com/photo-1604881991720-f91add269bed?w=600&h=260&fit=crop&auto=format&q=75",
    section: "בחירת-טיפול-ומטפל",
  },

  // ── אבחונים והערכות ────────────────────────────────────────────────────────
  {
    slug: "psychodidactic",
    title: "אבחון פסיכודידקטי - המדריך המלא",
    desc: "מי מוסמך לבצע, לכמה זמן זה תקף, כמה זה עולה - ולמה לתוספת זמן של 25% בכלל לא צריך אבחון.",
    img: "https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=600&h=260&fit=crop&auto=format&q=75",
    section: "אבחונים-והערכות",
    featured: true,
  },
  {
    slug: "assessments",
    title: "סוגי אבחונים והערכות",
    desc: "פסיכודידקטי, פסיכודיאגנוסטי, נוירופסיכולוגי - מתי כל אחד רלוונטי ומה מקבלים בסוף?",
    img: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&h=260&fit=crop&auto=format&q=75",
    section: "אבחונים-והערכות",
  },
  {
    slug: "psychodiagnostic",
    title: "אבחון פסיכודיאגנוסטי",
    desc: "לראות את התמונה המלאה: מהו האבחון המעמיק ביותר שיש, מה הוא כולל ומתי הוא חיוני.",
    img: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=600&h=260&fit=crop&auto=format&q=75",
    section: "אבחונים-והערכות",
  },
  {
    slug: "adhd-adults",
    title: "אבחון ADHD למבוגרים",
    desc: "מה כולל האבחון, איפה עושים אותו, כמה עולה, ומה עושים עם התוצאות.",
    img: "https://images.unsplash.com/photo-1517842645767-c639042777db?w=600&h=260&fit=crop&auto=format&q=75",
    section: "אבחונים-והערכות",
  },
  {
    slug: "autism-assessment",
    title: "אבחון תקשורת ואוטיזם",
    desc: "מהו אבחון תקשורת, כיצד הוא מתבצע, ומדוע אבחון כפול ומקצועי הוא קריטי.",
    img: "https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=600&h=260&fit=crop&auto=format&q=75",
    section: "אבחונים-והערכות",
  },

  // ── חרדה ולחץ ──────────────────────────────────────────────────────────────
  {
    slug: "social-anxiety",
    title: "חרדה חברתית - מה עובד בטיפול",
    desc: "מתחילה בגיל 13 בממוצע, ורוב האנשים פונים אחרי 15 עד 20 שנה. מה המחקר אומר על כל מסלול טיפול.",
    // A social scene rather than one of the article's charts: a chart cropped to
    // a 600x260 card loses its axes and title and reads as a stray graphic. A
    // distressed-person stock photo was the other obvious option and is worse -
    // the article's whole argument is that this is common and treatable, not a
    // defect, and it says most people never seek help because of the shame.
    img: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=600&h=260&fit=crop&auto=format&q=75",
    section: "חרדה-ולחץ",
    featured: true,
  },

  // ── ילדים ונוער ────────────────────────────────────────────────────────────
  {
    slug: "therapy-for-child",
    title: "איך לבחור פסיכולוג לילד?",
    desc: "מה חשוב לבדוק, מה לשאול, ואיך יודעים שמצאתם את האיש הנכון לילד שלכם.",
    img: "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=600&h=260&fit=crop&auto=format&q=75",
    section: "ילדים-ונוער",
    featured: true,
  },
  {
    slug: "child-emotional-developmental",
    title: "היבטים פיזיולוגיים בגיל הרך ופרשנות רגשית שגויה",
    desc: "כיצד קשיים פיזיולוגיים מקבלים ביטוי כקושי רגשי לכאורה.",
    img: "https://images.unsplash.com/photo-1576765608622-067973a79f53?w=600&h=260&fit=crop&auto=format&q=75",
    section: "ילדים-ונוער",
  },

  // ── מסגרת, עלות וזכויות ────────────────────────────────────────────────────
  {
    slug: "btl",
    title: "טיפול נפשי דרך ביטוח לאומי - המפה המלאה",
    desc: "רק שני מסלולים מתוך ארבעה מממנים טיפול בפועל. איזה מסלול שייך לכם, אילו טפסים, ומה חלונות הערר.",
    img: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&h=260&fit=crop&auto=format&q=75",
    section: "מסגרת-עלות-וזכויות",
    featured: true,
  },
  {
    slug: "kupa-guide",
    title: "טיפול פסיכולוגי דרך הקופה - המדריך",
    desc: "מרפאות, מטפלים בהסדר והחזרי הביטוח המשלים בכללית, מכבי, מאוחדת ולאומית - ומתי עדיף פרטי.",
    img: "https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=600&h=260&fit=crop&auto=format&q=75",
    section: "מסגרת-עלות-וזכויות",
    featured: true,
  },
  {
    slug: "online-therapy",
    title: "טיפול אונליין - כן או לא?",
    desc: "מחקרים, יתרונות, חסרונות, ומתי טיפול פנים מול פנים הכרחי.",
    img: "https://images.unsplash.com/photo-1587614382346-4ec70e388b28?w=600&h=260&fit=crop&auto=format&q=75",
    section: "מסגרת-עלות-וזכויות",
    imgPosition: "center top",
  },
  {
    slug: "faq",
    title: "שאלות נפוצות",
    desc: "כמה עולה טיפול, כמה זמן לוקח, האם קופות חולים מכסות - ותשובות לשאלות נוספות.",
    img: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=600&h=260&fit=crop&auto=format&q=75",
    section: "מסגרת-עלות-וזכויות",
  },
];

export function editorialBySection(slug: string): EditorialArticle[] {
  return EDITORIAL_ARTICLES.filter((a) => a.section === slug);
}

/**
 * A section earns an indexable hub once it holds real content - the same
 * thin-page rule the city, specialty and topic pages use. Below it the hub is
 * noindex and stays out of the sitemap.
 */
export const MIN_ARTICLES_FOR_SECTION_INDEX = 3;
