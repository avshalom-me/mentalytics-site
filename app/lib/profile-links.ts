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
  // פלטפורמת מאמרים מקצועית
  "hebpsy.net",
] as const;

/** שם המארח בלי www, באותיות קטנות; null לכתובת לא תקינה או לא http(s). */
function hostOf(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** האם הכתובת מובילה לפרסום (ולא לאתר של המטפל). התאמה לפי סיומת דומיין. */
export function isPublicationLink(url: string): boolean {
  const host = hostOf(url);
  if (!host) return false;
  return PUBLICATION_HOST_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`));
}

/**
 * הקישורים שעמוד הפרופיל מציג. isPaying = status 'paying' (משלם, מתנה או
 * מטפל של מרכז משלם). כתובות לא תקינות לא מוצגות לאף אחד.
 */
export function visibleProfileLinks(links: string[] | null | undefined, isPaying: boolean): string[] {
  const clean = (links ?? []).map((l) => (typeof l === "string" ? l.trim() : "")).filter((l) => hostOf(l) !== null);
  return isPaying ? clean : clean.filter(isPublicationLink);
}
