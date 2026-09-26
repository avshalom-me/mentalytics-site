/**
 * English labels for the values the therapists table stores in Hebrew.
 *
 * The English page (/en) shows a therapist's NAME exactly as written, in Hebrew,
 * and everything else in English: profession, approaches, ages, languages,
 * places, funding. So a value with no entry here is dropped from the card
 * rather than shown in Hebrew - a missing label is a gap to fill in this file,
 * never a reason to leak Hebrew into the English page.
 *
 * The keys must be spelled exactly as the database spells them (see
 * therapist-options.ts and regions.ts). A few legacy values that are no longer
 * offered in the form but still sit on live profiles are included too.
 */
import { CITY_TO_REGION, ONLINE_SLUG } from "@/app/lib/regions";
import { treatsAdults } from "@/app/lib/gender-text";

export const EN_REGIONS: Record<string, string> = {
  "גוש דן": "Tel Aviv area",
  "ירושלים והסביבה": "Jerusalem area",
  "דרום השרון": "Southern Sharon",
  "צפון השרון": "Northern Sharon",
  "השפלה והמרכז": "Shfela and Modi'in",
  "חיפה והקריות": "Haifa and the Krayot",
  "גליל וצפון": "Galilee and the North",
  "עמק יזרעאל ונצרת": "Jezreel Valley and Nazareth",
  "דרום": "South",
  "נגב ואילת": "Negev and Eilat",
  "יהודה ושומרון": "Judea and Samaria",
  [ONLINE_SLUG]: "Online",
};

// Every city in REGION_CITIES. Spellings follow the common English usage of
// each municipality (the one on its road signs and website), not a
// letter-by-letter transliteration.
export const EN_CITIES: Record<string, string> = {
  // גוש דן
  "תל אביב": "Tel Aviv",
  "רמת גן": "Ramat Gan",
  "גבעתיים": "Givatayim",
  "בני ברק": "Bnei Brak",
  "פתח תקווה": "Petah Tikva",
  "הרצליה": "Herzliya",
  "רמת השרון": "Ramat HaSharon",
  "בת ים": "Bat Yam",
  "חולון": "Holon",
  "אור יהודה": "Or Yehuda",
  "קרית אונו": "Kiryat Ono",
  "גבעת שמואל": "Givat Shmuel",
  "יהוד": "Yehud",
  "גני תקווה": "Ganei Tikva",
  "אלעד": "Elad",
  "שוהם": "Shoham",
  // ירושלים והסביבה
  "ירושלים": "Jerusalem",
  "בית שמש": "Beit Shemesh",
  "מבשרת ציון": "Mevaseret Zion",
  "מעלה אדומים": "Ma'ale Adumim",
  "אבו גוש": "Abu Ghosh",
  // דרום השרון
  "כפר סבא": "Kfar Saba",
  "רעננה": "Ra'anana",
  "הוד השרון": "Hod HaSharon",
  "ראש העין": "Rosh HaAyin",
  "כפר יונה": "Kfar Yona",
  "טייבה": "Tayibe",
  "קלנסווה": "Qalansawe",
  "תל מונד": "Tel Mond",
  // צפון השרון
  "נתניה": "Netanya",
  "חדרה": "Hadera",
  "פרדס חנה-כרכור": "Pardes Hanna-Karkur",
  "בנימינה": "Binyamina",
  "זיכרון יעקב": "Zichron Yaakov",
  "עמק חפר": "Emek Hefer",
  "חריש": "Harish",
  "אור עקיבא": "Or Akiva",
  "קדימה-צורן": "Kadima-Zoran",
  "אבן יהודה": "Even Yehuda",
  // השפלה והמרכז
  "ראשון לציון": "Rishon LeZion",
  "רחובות": "Rehovot",
  "נס ציונה": "Ness Ziona",
  "מודיעין": "Modi'in",
  "לוד": "Lod",
  "רמלה": "Ramla",
  "יבנה": "Yavne",
  "גדרה": "Gedera",
  "קרית עקרון": "Kiryat Ekron",
  // חיפה והקריות
  "חיפה": "Haifa",
  "קריית אתא": "Kiryat Ata",
  "קריית ביאליק": "Kiryat Bialik",
  "קריית מוצקין": "Kiryat Motzkin",
  "קריית ים": "Kiryat Yam",
  "נשר": "Nesher",
  "טירת כרמל": "Tirat Carmel",
  // גליל וצפון
  "עכו": "Akko",
  "נהריה": "Nahariya",
  "כרמיאל": "Karmiel",
  "צפת": "Safed",
  "מעלות-תרשיחא": "Ma'alot-Tarshiha",
  "קריית שמונה": "Kiryat Shmona",
  "שלומי": "Shlomi",
  "כפר ורדים": "Kfar Vradim",
  // עמק יזרעאל ונצרת
  "עפולה": "Afula",
  "נצרת": "Nazareth",
  "מגדל העמק": "Migdal HaEmek",
  "טבריה": "Tiberias",
  "אום אל-פחם": "Umm al-Fahm",
  "בית שאן": "Beit She'an",
  "יוקנעם": "Yokneam",
  "קריית טבעון": "Kiryat Tivon",
  "רמת ישי": "Ramat Yishai",
  // דרום
  "באר שבע": "Be'er Sheva",
  "אשדוד": "Ashdod",
  "אשקלון": "Ashkelon",
  "קריית גת": "Kiryat Gat",
  "נתיבות": "Netivot",
  "שדרות": "Sderot",
  "קריית מלאכי": "Kiryat Malakhi",
  "אופקים": "Ofakim",
  // נגב ואילת
  "דימונה": "Dimona",
  "אילת": "Eilat",
  "ערד": "Arad",
  "מצפה רמון": "Mitzpe Ramon",
  "ירוחם": "Yeruham",
  "רהט": "Rahat",
  // יהודה ושומרון
  "אריאל": "Ariel",
  "גוש עציון": "Gush Etzion",
  "ביתר עילית": "Beitar Illit",
  "מודיעין עילית": "Modi'in Illit",
  "אלפי מנשה": "Alfei Menashe",
  "בנימין": "Binyamin",
};

// Gender-neutral on purpose: English professional titles do not inflect, so
// the Hebrew m/f forms collapse into one label.
export const EN_THERAPIST_TYPES: Record<string, string> = {
  "פסיכולוג קליני": "Clinical psychologist",
  "פסיכולוג חינוכי": "Educational psychologist",
  "פסיכולוג שיקומי/רפואי": "Rehabilitation psychologist",
  "פסיכולוג התפתחותי": "Developmental psychologist",
  "פסיכולוג תעסוקתי": "Occupational psychologist",
  "יועצ/ת חינוכי": "Educational counselor",
  'עו"ס קליני': "Clinical social worker",
  "מטפל/ת בהבעה ויצירה": "Creative arts therapist",
  "מטפל מיני": "Sex therapist",
  "קרימינולוג קליני": "Clinical criminologist",
  "פיזיותרפיסט/ית": "Physiotherapist",
  "מרפא/ת בעיסוק": "Occupational therapist",
  "קלינאי/ת תקשורת": "Speech-language therapist",
  "דיאטנ/ית קליני/ת": "Clinical dietitian",
};

export const EN_TRAINING_AREAS: Record<string, string> = {
  "טיפול דינאמי": "Psychodynamic therapy",
  "CBT": "CBT",
  "ACT": "ACT",
  "EMDR": "EMDR",
  "CPT": "CPT",
  "טיפול דינאמי בטראומה": "Psychodynamic trauma therapy",
  "DBT": "DBT",
  "הדרכת הורים": "Parent guidance",
  "טיפול דיאדי": "Parent-child (dyadic) therapy",
  "טיפול משפחתי": "Family therapy",
  "טיפול בהבעה ויצירה": "Creative arts therapy",
  "ריפוי בעיסוק": "Occupational therapy",
  "טיפול תעסוקתי": "Career counseling",
  "קבוצה חברתית": "Social skills group",
  "טיפול זוגי": "Couples therapy",
  "טיפול בהתמכרויות": "Addiction treatment",
  "טיפול מיני": "Sex therapy",
  "טיפול COG-FUN לקשיי קשב וריכוז": "Cog-Fun for ADHD",
  "נוירופידבק": "Neurofeedback",
  "טיפול בטראומה": "Trauma therapy",
  "פסיכואנליזה": "Psychoanalysis",
  "קלינאות תקשורת": "Speech and language therapy",
  "טיפול בקשיי תקשורת ASD": "Autism (ASD) communication therapy",
  "טיפול בהפרעות אכילה": "Eating disorders",
  "טיפול באנקופרזיס": "Encopresis",
  // Legacy values (PLAY_THERAPY_MODALITIES), still on live profiles.
  "טיפול באומנות": "Art therapy",
  "טיפול בתנועה": "Movement therapy",
  "דרמה תרפיה": "Drama therapy",
  "פסיכודרמה": "Psychodrama",
  "טיפול במוזיקה": "Music therapy",
  'טיפול בעזרת בע"ח': "Animal-assisted therapy",
};

export const EN_AGE_GROUPS: Record<string, string> = {
  "גיל הרך": "Early childhood",
  "ילדים": "Children",
  "נוער": "Teens",
  "מבוגרים": "Adults",
  "הגיל השלישי": "Older adults",
};

export const EN_LANGUAGES: Record<string, string> = {
  "עברית": "Hebrew",
  "אנגלית": "English",
  "ערבית": "Arabic",
  "רוסית": "Russian",
  "צרפתית": "French",
  "ספרדית": "Spanish",
  "פורטוגזית": "Portuguese",
  "אמהרית": "Amharic",
};

export const EN_ARRANGEMENTS: Record<string, string> = {
  "קופות החולים": "Health funds (kupot holim)",
  "משרד הביטחון": "Ministry of Defense",
  "ביטוח לאומי": "National Insurance (Bituach Leumi)",
  "ביטוחים פרטיים": "Private insurance",
};

// Shown after a "Familiar with" label. The field records familiarity, not the
// therapist's own identity (see DirectoryFilter.culturalPrefsAny).
export const EN_CULTURAL_PREFS: Record<string, string> = {
  "היכרות עם העולם הדתי": "Religious communities",
  "היכרות עם העולם החרדי": "Haredi communities",
  'היכרות עם עולם הלהט"ב': "LGBTQ+ community",
};

/** Hebrew values → English labels, in order, unknown values dropped, no repeats. */
export function toEnglish(values: readonly string[] | null | undefined, dict: Record<string, string>): string[] {
  const out: string[] = [];
  for (const v of values ?? []) {
    const label = dict[v];
    if (label && !out.includes(label)) out.push(label);
  }
  return out;
}

/**
 * A city in English. A city this file does not know yet falls back to its
 * region's English name, so the card still says where the therapist works
 * instead of showing Hebrew or nothing.
 */
export function englishPlace(city: string): string | null {
  if (EN_CITIES[city]) return EN_CITIES[city];
  if (EN_REGIONS[city]) return EN_REGIONS[city];
  const region = CITY_TO_REGION[city];
  return region ? EN_REGIONS[region] ?? null : null;
}

export function englishPlaces(cities: readonly string[] | null | undefined): string[] {
  const out: string[] = [];
  for (const c of cities ?? []) {
    const p = englishPlace(c);
    if (p && !out.includes(p)) out.push(p);
  }
  return out;
}

/** The regions a set of cities falls in, as English labels (for the region filter). */
export function englishRegions(cities: readonly string[] | null | undefined): string[] {
  const out: string[] = [];
  for (const c of cities ?? []) {
    const region = CITY_TO_REGION[c] ?? (EN_REGIONS[c] && c !== ONLINE_SLUG ? c : undefined);
    const label = region ? EN_REGIONS[region] : undefined;
    if (label && !out.includes(label)) out.push(label);
  }
  return out;
}

/**
 * The public English title. Mirrors publicTypeOverride in gender-text.ts: a
 * creative arts therapist who works with adults is presented as a
 * psychotherapist, so the two languages never describe the same person
 * differently.
 */
export function englishTitle(types: readonly string[] | null | undefined, ageGroups: string[] | null | undefined): string | null {
  for (const t of types ?? []) {
    if (t === "מטפל/ת בהבעה ויצירה" && treatsAdults(ageGroups)) return "Psychotherapist";
    if (EN_THERAPIST_TYPES[t]) return EN_THERAPIST_TYPES[t];
  }
  return null;
}
