// אילו קישורים מתוך "קישורים לפרסומים שכתבת" (therapists.publication_links)
// מוצגים בעמוד הפרופיל הציבורי.
//
// החלטת הבעלים מ-18/9/26: מטפל חינמי לא מקבל מאיתנו קישור לאתר שלו. בבדיקה
// באותו יום, שישה מתוך 15 המטפלים עם קישורים לחיצים הפנו לאתר אישי, לדף
// עסקי או לפייסבוק - וכל השישה היו חינמיים. קישור כזה מוציא את הגולש
// מהאתר לפני שפנה, והפנייה שלו כבר לא נספרת אצלנו; הוא גם מעביר לאתר של
// המטפל חלק מהסמכות של האתר בגוגל.
//
// הכלל: מטפל שמשלם (status='paying', כולל מתנה ומטפלי מרכזים) - כל הקישורים.
// מטפל חינמי - רק קישורים לפרסומים: כתבי עת ומאגרים אקדמיים, מוסדות אקדמיים,
// עיתונות, פלטפורמת המאמרים hebpsy והאתר שלנו. כל כתובת אחרת, כולל כתובת
// שלא מוכרת לנו, מוסתרת. ברירת המחדל היא הסתרה, כי כך אתר אישי חדש לא
// יחלוף בטעות. אם פרסום לגיטימי מוסתר, מוסיפים את הדומיין לרשימה.

const PUBLICATION_HOST_SUFFIXES = [
  // האתר שלנו - מאמרים שהמטפל כתב אצלנו
  "mentalytics.co.il",
  // כתבי עת, מוציאים לאור ומאגרים אקדמיים
  "sciencedirect.com",
  "springer.com",
  "sagepub.com",
  "mdpi.com",
  "scholar.google.com",
  "researchgate.net",
  "ncbi.nlm.nih.gov",
  "tandfonline.com",
  "wiley.com",
  "jstor.org",
  "academia.edu",
  "apa.org",
  "frontiersin.org",
  "nature.com",
  "cambridge.org",
  "oup.com",
  "doi.org",
  "semanticscholar.org",
  "biomedcentral.com",
  "plos.org",
  "elsevier.com",
  "orcid.org",
  // ספרייה לאומית ומוסדות אקדמיים
  "nli.org.il",
  "ac.il",
  "edu",
  // עיתונות
  "ynet.co.il",
  "haaretz.co.il",
  "themarker.com",
  "calcalist.co.il",
  "mako.co.il",
  "walla.co.il",
  "maariv.co.il",
  "israelhayom.co.il",
  "kan.org.il",
  "n12.co.il",
  // פלטפורמת מאמרים מקצועית. רק דפי מאמר - ראו PATH_RULES למטה.
  "hebpsy.net",
] as const;

// דומיינים שמארחים גם פרסומים וגם דפים אישיים של מטפלים. אצלם הדומיין לא
// מספיק, וגם הנתיב צריך להיות של מאמר. hebpsy.net הוא גם אינדקס מטפלים עם
// דף אישי ופרטי קשר לכל מטפל (pl.asp, me_list.asp) - בלי הכלל הזה מטפל חינמי
// היה מקשר לדף הפרסום שלו אצל מתחרה. נמצא ב-18/9/26, שעה אחרי הכלל עצמו.
const PATH_RULES: Record<string, RegExp> = {
  "hebpsy.net": /^\/articles\.asp$/i,
};

/** כתובת http(s) תקינה, או null. */
function parse(url: string): URL | null {
  try {
    const u = new URL(url.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u : null;
  } catch {
    return null;
  }
}

/** שם המארח בלי www, באותיות קטנות; null לכתובת לא תקינה או לא http(s). */
function hostOf(url: string): string | null {
  const u = parse(url);
  return u ? u.hostname.toLowerCase().replace(/^www\./, "") : null;
}

/** האם הכתובת מובילה לפרסום (ולא לאתר של המטפל). התאמה לפי סיומת דומיין. */
export function isPublicationLink(url: string): boolean {
  const u = parse(url);
  const host = hostOf(url);
  if (!u || !host) return false;
  const suffix = PUBLICATION_HOST_SUFFIXES.find((s) => host === s || host.endsWith(`.${s}`));
  if (!suffix) return false;
  const pathRule = PATH_RULES[suffix];
  return pathRule ? pathRule.test(u.pathname) : true;
}

/**
 * הקישורים שעמוד הפרופיל מציג. isPaying = status 'paying' (משלם, מתנה או
 * מטפל של מרכז משלם). כתובות לא תקינות לא מוצגות לאף אחד.
 */
export function visibleProfileLinks(links: string[] | null | undefined, isPaying: boolean): string[] {
  const clean = (links ?? []).map((l) => (typeof l === "string" ? l.trim() : "")).filter((l) => hostOf(l) !== null);
  return isPaying ? clean : clean.filter(isPublicationLink);
}
