import { NextRequest, NextResponse } from "next/server";
import { publicTherapistTitle } from "@/app/lib/gender-text";
import { CITY_TO_REGION, REGION_NEIGHBORS } from "@/app/lib/regions";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import {
  FREE_REGION_FALLBACK_ENABLED,
  coversRegion,
  expertiseOf,
  overlaps,
} from "@/app/lib/match-fallback";

export const dynamic = "force-dynamic";

// Simple in-memory rate limiter: max 10 requests per IP per minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

type TherapistRow = {
  id: string;
  full_name: string | null;
  gender: string | null;
  online: boolean | string | null;
  therapist_types: unknown;
  training_areas: unknown;
  assessment_types: unknown;
  couples_modalities: unknown;
  cogfun_age_groups: unknown;
  regions: unknown;
  cultural_prefs: unknown;
  arrangements: unknown;
  bio: string | null;
  phone: string | null;
  profile_photo_path: string | null;
  status: string | null;
  promotion_source: string | null; // 'paid' | 'center' | 'manual'/'trial' (מתנה) | 'gift_trial' (חלון מתנה, מתגלגל ל-paid בחיוב הראשון) | null (חינמי)
  match_paused_until: string | null; // הקפאה זמנית מההתאמות בלבד (ראו migration)
  style_q1: number | null;
  style_q2: number | null;
  activity_level: number | null;
  age_groups: unknown;
  languages: unknown;
  entity_type: string | null; // 'center' = שורת ישות-מרכז (מסלול 2); אחרת מטפל רגיל
  center_account_id: string | null;
};

// דירוג מסחרי לשבירת תיקו. status='paying' מקבץ יחד שתי אוכלוסיות שונות
// לגמרי - מי שמשלם בפועל ומי שקודם במתנה - וכשהציונים שווים אין שום סיבה
// שמקודם-חינם יעקוף לקוח משלם. סדר: משלם ← מרכז משלם ← מתנה ← חינמי.
// (זהה להיררכיה במאגר הציבורי, app/lib/therapist-directory.ts)
function commercialRank(t: TherapistRow): number {
  if (t.status !== "paying") return 3; // FREE_REGION_FALLBACK - גיבוי חינמי
  if (t.promotion_source === "paid") return 0;
  if (t.promotion_source === "center") return 1;
  return 2; // manual / trial - קידום מתנה
}

type NormalizedMatchInput = {
  treatmentTypes: string[];
  diagnosisTypes: string[];
  therapistTypes: string[];
  requiredTherapistTypes: string[]; // hard filter — only therapists of these types
  culturalPreferences: string[];
  arrangements: string[];
  city: string | null;
  region: string | null;
  genderPreference: string | null;
  onlineRequired: boolean;
  limit: number;
  styleP1: number | null;
  styleP2: number | null;
  styleP3: number | null;
  ageGroups: string[];
  languages: string[];
  couplesModality: string[];
  needsSexualTherapy: boolean;
  expressiveModalities: string[];
};

const WEIGHTS = {
  expertise: 25,       // training_areas
  therapistType: 8,    // therapist_types
  // מיקום. היה 10 עד 6/9/2026: אז ההפרש בין מקומי לאזור-סמוך היה 8 נקודות
  // דירוג, בדיוק משקל של קריטריון רך אחד (סוג מטפל 8, חצי מטיפול משולב
  // 12.5, גיל 15), ולכן מטפל מחדרה עם דינאמי+CBT עקף מטפל מחיפה עם דינאמי
  // בלבד, על שאלון שהתחיל ב"חיפה". נמדד על 30 יום: כרטיס מקומי הביא פנייה
  // פי 13 יותר מכרטיס לא-מקומי (29 מ-761 מול 2 מ-695). ב-25 הפער מקומי-סמוך
  // הוא 21 נקודות, יותר מכל קריטריון בודד. הציון המוצג לא מושפע (ראו למטה).
  locationOnline: 25,  // regions + online
  gender: 4,           // gender
  cultural: 5,         // cultural_prefs
  arrangements: 3,     // arrangements
  ageGroup: 15,        // age_groups
  couplesBonus: 15,    // exact couples modality match (EFT/דינאמי/מבני) — soft preference, not a filter
  sexualBonus: 6,      // therapist also does sexual therapy when needed
  expressiveBonus: 8,  // expressive therapy modality match (art/music/movement)
  cogfunBonus: 6,      // COG-FUN age group match (children/teens/adults)
};

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(
    new Set(values.map(normalizeText).filter(Boolean))
  );
}

function parseArray(value: unknown): string[] {
  if (value == null) return [];

  if (Array.isArray(value)) {
    return uniqueStrings(value.map(String));
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    // אם נשמר כמחרוזת JSON
    if (
      (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
      (trimmed.startsWith('"[') && trimmed.endsWith(']"'))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return uniqueStrings(parsed.map(String));
        }
      } catch {
        // ממשיכים לפירוק רגיל
      }
    }

    // פירוק לפי מפרידים נפוצים
    return uniqueStrings(
      trimmed
        .split(/[,\n;/|]+/g)
        .map((s) => s.trim())
        .filter(Boolean)
    );
  }

  return [];
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const v = normalizeText(value);

  return ["true", "1", "yes", "כן", "online", "on"].includes(v);
}

function firstNonEmptyString(...values: unknown[]): string | null {
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized) return normalized;
  }
  return null;
}

function mergeArrays(...values: unknown[]): string[] {
  return uniqueStrings(values.flatMap((v) => parseArray(v)));
}

function hasOverlap(a: string[], b: string[]): boolean {
  const setB = new Set(b.map(normalizeText));
  return a.some((item) => setB.has(normalizeText(item)));
}

function intersection(a: string[], b: string[]): string[] {
  const setB = new Set(b.map(normalizeText));
  return uniqueStrings(a.filter((item) => setB.has(normalizeText(item))));
}

function normalizeInput(body: Record<string, any>): NormalizedMatchInput {
  const treatmentTypes = mergeArrays(
    body.treatmentTypes,
    body.treatment_types,
    body.training_areas,
    body.recommended_treatments,
    body.recommendedTreatment,
    body.recommendedTreatments,
    body.treatments,
    body.therapy_types,
    body.therapyTypes
  );

  const diagnosisTypes = mergeArrays(
    body.diagnosisTypes,
    body.diagnosis_types,
    body.diagnoses,
    body.issues,
    body.presenting_problems,
    body.presentingProblems
  );

  const therapistTypes = mergeArrays(
    body.therapistTypes,
    body.therapist_types,
    body.provider_types,
    body.providerTypes
  );

  const requiredTherapistTypes = mergeArrays(
    body.requiredTherapistTypes,
    body.required_therapist_types
  );

  const culturalPreferences = mergeArrays(
    body.culturalPreferences,
    body.cultural_preferences,
    body.cultural_prefs
  );

  const arrangements = mergeArrays(
    body.arrangements,
    body.arrangement_preferences,
    body.arrangementPreferences
  );

  const region = firstNonEmptyString(
    body.region,
    body.regions,
    body.location,
    body.area
  );

  const genderPreference = firstNonEmptyString(
    body.genderPreference,
    body.gender_preference,
    body.preferred_gender,
    body.gender
  );

  const onlineRequired = parseBoolean(
    body.onlineRequired ??
      body.online_required ??
      body.is_online ??
      body.online
  );

  let limit = Number(body.limit ?? 10);
  if (!Number.isFinite(limit) || limit <= 0) limit = 10;
  limit = Math.min(limit, 20);

  const styleP1 = Number.isInteger(body.styleP1) && body.styleP1 >= 1 && body.styleP1 <= 7 ? body.styleP1 : null;
  const styleP2 = Number.isInteger(body.styleP2) && body.styleP2 >= 1 && body.styleP2 <= 7 ? body.styleP2 : null;
  const styleP3 = Number.isInteger(body.styleP3) && body.styleP3 >= 1 && body.styleP3 <= 7 ? body.styleP3 : null;
  const ageGroups = mergeArrays(body.ageGroups, body.age_groups);
  const city = firstNonEmptyString(body.city, body.city_name);
  const languages = mergeArrays(body.languages);
  // A tied couples questionnaire names two approaches; both should earn the
  // bonus, so the preference is a list. The single-string field stays accepted
  // for cached bundles that still send it.
  const couplesModalityList = mergeArrays(body.couplesModalities, body.couples_modalities);
  const couplesModalitySingle = firstNonEmptyString(body.couplesModality, body.couples_modality);
  const couplesModality = couplesModalityList.length > 0
    ? couplesModalityList
    : couplesModalitySingle ? [couplesModalitySingle] : [];
  const needsSexualTherapy = parseBoolean(body.needsSexualTherapy ?? body.needs_sexual_therapy);
  const expressiveModalities = mergeArrays(body.expressiveModalities, body.expressive_modalities);

  return {
    treatmentTypes,
    diagnosisTypes,
    therapistTypes,
    requiredTherapistTypes,
    culturalPreferences,
    arrangements,
    city,
    region,
    genderPreference,
    onlineRequired,
    limit,
    styleP1,
    styleP2,
    styleP3,
    ageGroups,
    languages,
    couplesModality,
    needsSexualTherapy,
    expressiveModalities,
  };
}

async function buildSignedPhotoUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  try {
    const { data, error } = await supabaseAdmin.storage
      .from("therapist-certificates")
      .createSignedUrl(decodeURIComponent(path), 60 * 60 * 24);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

function scoreTherapist(
  therapist: TherapistRow,
  input: NormalizedMatchInput
) {
  const therapistTypes = parseArray(therapist.therapist_types);
  const couplesModalities = parseArray(therapist.couples_modalities);
  const trainingAreas = uniqueStrings([
    ...parseArray(therapist.training_areas),
    ...parseArray(therapist.assessment_types),
    // If therapist has any couples modality (EFT/דינאמי/מבני), synthesise "טיפול זוגי"
    // so they match even if the parent entry is missing from training_areas
    ...(couplesModalities.length > 0 ? ["טיפול זוגי"] : []),
  ]);
  const regions = parseArray(therapist.regions);
  const culturalPrefs = parseArray(therapist.cultural_prefs);
  const arrangements = parseArray(therapist.arrangements);
  const therapistGender = normalizeText(therapist.gender);
  const therapistOnline = parseBoolean(therapist.online);
  const therapistLanguages = parseArray(therapist.languages);

  // Hard filter — language must match (fallback: if therapist has no languages, assume Hebrew)
  if (input.languages.length > 0) {
    const effectiveLangs = therapistLanguages.length > 0 ? therapistLanguages : ["עברית"];
    if (!hasOverlap(effectiveLangs, input.languages)) {
      return null;
    }
  }

  // Hard filter — required therapist type (e.g. dietitian-only search). Used
  // when the recommendation is for a specialised professional type rather
  // than a training area.
  if (input.requiredTherapistTypes.length > 0) {
    if (!hasOverlap(therapistTypes, input.requiredTherapistTypes)) {
      return null;
    }
  }

  // Hard filter — assessment referral: therapist must offer the requested
  // diagnosis/assessment type. Without this, therapists with strong location /
  // age-group scores could appear even though they don't do assessments at all.
  if (input.diagnosisTypes.length > 0) {
    if (!hasOverlap(trainingAreas, input.diagnosisTypes)) {
      return null;
    }
  }

  let earned = 0;
  let possible = 0;
  const reasons: string[] = [];

  // זמנית: גם treatmentTypes וגם diagnosisTypes נבדקים מול training_areas
  const expertiseNeed = uniqueStrings([
    ...input.treatmentTypes,
    ...input.diagnosisTypes,
  ]);

  if (expertiseNeed.length > 0) {
    possible += WEIGHTS.expertise;
    const matched = intersection(trainingAreas, expertiseNeed);
    if (matched.length > 0) {
      // Proportional: reward covering more of the requested types
      const coverage = matched.length / expertiseNeed.length;
      earned += Math.round(WEIGHTS.expertise * coverage);
      reasons.push(`התאמה בתחום המומחיות: ${matched.join(", ")}`);
    }
  }

  // Bonus: couples modality match. The preference may name two tied approaches;
  // a therapist working in either one earns the same full bonus.
  if (input.couplesModality.length > 0) {
    possible += WEIGHTS.couplesBonus;
    const matched = input.couplesModality.filter((want) =>
      couplesModalities.some((m) => normalizeText(m) === normalizeText(want))
    );
    if (matched.length > 0) {
      earned += WEIGHTS.couplesBonus;
      reasons.push(`התאמה בגישה הזוגית: ${matched.join(" / ")}`);
    }
  }

  // Bonus: therapist also handles sexual therapy when needed
  if (input.needsSexualTherapy) {
    possible += WEIGHTS.sexualBonus;
    if (trainingAreas.some((a) => normalizeText(a).includes("מיני")) ||
        therapistTypes.some((t) => normalizeText(t).includes("מיני"))) {
      earned += WEIGHTS.sexualBonus;
      reasons.push("המטפל/ת מתמחה גם בטיפול מיני");
    }
  }

  // Bonus: expressive therapy modality match (e.g. child prefers art and therapist does art therapy)
  if (input.expressiveModalities.length > 0) {
    possible += WEIGHTS.expressiveBonus;
    const matched = intersection(trainingAreas, input.expressiveModalities);
    if (matched.length > 0) {
      const coverage = matched.length / input.expressiveModalities.length;
      earned += Math.round(WEIGHTS.expressiveBonus * coverage);
      reasons.push(`התאמה בטיפול בהבעה ויצירה: ${matched.join(", ")}`);
    } else if (trainingAreas.some((a) => normalizeText(a).includes("הבעה ויצירה"))) {
      earned += Math.round(WEIGHTS.expressiveBonus * 0.4);
      reasons.push("מטפל/ת בהבעה ויצירה (גישה אחרת)");
    }
  }

  // Bonus: COG-FUN age group match
  const COGFUN_LABEL = normalizeText("טיפול cog-fun לקשיי קשב וריכוז");
  const patientNeedsCogfun = expertiseNeed.some(t => normalizeText(t) === COGFUN_LABEL);
  if (patientNeedsCogfun && trainingAreas.some(a => normalizeText(a) === COGFUN_LABEL)) {
    const cogfunAges = parseArray(therapist.cogfun_age_groups);
    if (cogfunAges.length > 0 && input.ageGroups.length > 0) {
      possible += WEIGHTS.cogfunBonus;
      const AGE_TO_COGFUN: Record<string, string> = {
        "גיל הרך": "ילדים",
        "ילדים": "ילדים",
        "נוער": "בני נוער",
        "מבוגרים": "מבוגרים",
        "הגיל השלישי": "מבוגרים",
      };
      const neededCogfun = uniqueStrings(
        input.ageGroups.map(ag => AGE_TO_COGFUN[ag] ?? ag)
      );
      if (hasOverlap(cogfunAges, neededCogfun)) {
        earned += WEIGHTS.cogfunBonus;
        reasons.push("התאמה ב-COG-FUN לקבוצת הגיל");
      }
    }
  }

  if (input.therapistTypes.length > 0) {
    possible += WEIGHTS.therapistType;
    const matched = intersection(therapistTypes, input.therapistTypes);
    if (matched.length > 0) {
      earned += WEIGHTS.therapistType;
      reasons.push(`התאמה בסוג המטפל: ${matched.join(", ")}`);
    }
  }

  // ── מיקום: משפיע על הדירוג, לא על הציון המוצג ────────────────────────────
  // הציון שהמטופל רואה נמדד על התאמה מקצועית בלבד. שתי סיבות:
  //
  // 1) המרחק הוא המידע היחיד שהמטופל מעריך בעצמו בשנייה - הוא רואה "📍 תל
  //    אביב" על הכרטיס. ההתאמה המקצועית היא מה שהוא לא יכול להעריך, וזה מה
  //    שיש לנו לתרום. ערבוב השניים למספר אחד מקודד מידע שכבר מולו על המסך
  //    ומטשטש את מה שאינו.
  // 2) עד 19/8/2026 בלוק המיקום נכנס למכנה רק כשהמשתמש ביקש מיקום, ולכן אותו
  //    מטפל בדיוק קיבל 94% אצל מי שלא בחר אזור ו-67% אצל מי שבחר (נמדד).
  //    המספר לא היה שקרי - הוא ענה על "כמה ממה שביקשת קיבלת" - אבל הוא נקרא
  //    כ"כמה הוא מתאים לי", והפער הזה הוא מה שהמשתמש רואה.
  //
  // locationEarned/locationPossible נצברים בנפרד ומוזרמים ל-rankScore בלבד,
  // כך שמטפל קרוב עדיין מדורג גבוה יותר - רק שהמספר על הכרטיס לא מושפע.
  let locationEarned = 0;
  let locationPossible = 0;
  if (input.city || input.region || input.onlineRequired) {
    locationPossible += WEIGHTS.locationOnline;

    // Hard filter: online-only request (no city/region) — exclude non-online therapists
    if (input.onlineRequired && !input.city && !input.region && !therapistOnline) {
      return null;
    }

    const patientRegion = input.region ??
      (input.city ? CITY_TO_REGION[input.city] ?? null : null);

    const inExactCity = input.city
      ? regions.includes(normalizeText(input.city))
      : false;

    const inSameRegion = patientRegion
      ? regions.some((c) => CITY_TO_REGION[c] === patientRegion || c === patientRegion)
      : false;

    const inAdjacentRegion = patientRegion
      ? regions.some((c) => {
          const cRegion = CITY_TO_REGION[c] ?? c;
          return (REGION_NEIGHBORS[patientRegion] ?? []).includes(cRegion);
        })
      : false;

    const onlineMatch = input.onlineRequired && therapistOnline;

    if (inExactCity) {
      locationEarned += WEIGHTS.locationOnline; // 100% — אותה עיר
      reasons.push("התאמה מלאה באזור");
    } else if (inSameRegion) {
      // The 60% tier exists to rank "your region" below "your city" - but only
      // when the patient named a city. Leaving the city on its "כל האזור"
      // default made 100% unreachable, so the whole location signal collapsed
      // to 6-vs-3 between the requested region and an adjacent one: less than a
      // single cultural checkbox (5). A centre in the requested city therefore
      // ranked below therapists an hour away. When no city was named, matching
      // the region IS the exact answer to what was asked, and scores as such.
      const regionIsTheAsk = !input.city;
      // 0.85 ולא 0.6: כשהמשקל עלה ל-25, 60% היה משאיר פער של 10 נקודות דירוג
      // בין העיר לשאר האזור - מעל רצועת ה-8 שבה האישיותי מכריע - ומטפל
      // מקריית מוצקין עם 100% היה נעול מתחת למטפל מחיפה עם 85%, והרשימה
      // נראית לא מסודרת. ב-85% הפער הוא 4 נקודות: העיר שוברת שוויון, לא
      // חומה. רבע שעה נסיעה לא צריכה להיות יותר מזה.
      locationEarned += regionIsTheAsk
        ? WEIGHTS.locationOnline
        : Math.round(WEIGHTS.locationOnline * 0.85);
      reasons.push(regionIsTheAsk ? "התאמה מלאה באזור" : "התאמה באזור");
    } else if (inAdjacentRegion || onlineMatch) {
      // Adjacent region and "works online" are independent partial answers and
      // one therapist can satisfy both, so these are scored as the better of
      // the two rather than as a first-match chain. Testing adjacency first and
      // returning let the weaker tier mask the stronger one: someone in a
      // neighbouring region who ALSO works online scored 2, below the 4 earned
      // by someone at the other end of the country who works online - the
      // strictly better candidate lost.
      //
      // Adjacent is 15% of the weight, halved from 30% on 14/8/2026. Measured
      // over 2,607 match-card impressions: out-of-area therapists are opened
      // 2.8x less often and contacted 4.2x less often than in-area ones. A
      // neighbouring region can be an hour's drive for a weekly session, so it
      // stays in the results as a fallback but must not compete with someone
      // local. (At a weight of 25 the tier rounds to 4 points. Since 6/9/2026
      // adjacency is also a separate result group, ordered after everyone in
      // the requested area - see the sort - so this tier only orders the
      // out-of-area group among itself.)
      const adjacentPts = inAdjacentRegion ? Math.round(WEIGHTS.locationOnline * 0.15) : 0;
      // An online-only request (no city, no region) has no geography to match
      // against: the hard filter above already dropped everyone who does not
      // work online, so every remaining therapist answers the request in full.
      // Scoring them at 40% docked the whole result set for a preference they
      // all satisfied. Asking for a region AND ticking online is different -
      // there, being reachable online but not nearby is a partial answer.
      const onlineIsTheWholeAsk = !input.city && !input.region;
      const onlinePts = onlineMatch
        ? (onlineIsTheWholeAsk ? WEIGHTS.locationOnline : Math.round(WEIGHTS.locationOnline * 0.4))
        : 0;
      locationEarned += Math.max(adjacentPts, onlinePts);
      if (inAdjacentRegion) reasons.push("מטפל/ת מאזור סמוך");
      if (onlineMatch) reasons.push("מציע טיפול אונליין");
    } else if (patientRegion) {
      // Hard filter: no geographic match and user didn't request online → exclude
      // (applies whether or not therapist declared regions)
      return null;
    }
  }

  if (input.genderPreference) {
    possible += WEIGHTS.gender;
    // מרכז כישות: לרשומה אין מגדר אחד, כי מאחוריה צוות מעורב. אותו היגיון
    // של הציון האישיותי - המרכז מעמיד מטפל/ת מתוך הצוות. בלי החריגה הזו
    // הוא הפסיד את מלוא משקל המגדר בכל שאלון שבו נבחרה העדפה, על סמך שדה
    // ריק ולא על סמך אי-התאמה אמיתית.
    if (therapist.entity_type === "center") {
      earned += WEIGHTS.gender;
      reasons.push("במרכז מטפלים ומטפלות, בהתאם להעדפה");
    } else if (therapistGender && therapistGender === normalizeText(input.genderPreference)) {
      earned += WEIGHTS.gender;
      reasons.push("התאמה בהעדפת מגדר");
    }
  }

  if (input.culturalPreferences.length > 0) {
    possible += WEIGHTS.cultural;
    const matched = intersection(culturalPrefs, input.culturalPreferences);
    if (matched.length > 0) {
      earned += WEIGHTS.cultural;
      reasons.push(`התאמה תרבותית: ${matched.join(", ")}`);
    }
  }

  if (input.arrangements.length > 0) {
    possible += WEIGHTS.arrangements;
    const matched = intersection(arrangements, input.arrangements);
    if (matched.length > 0) {
      earned += WEIGHTS.arrangements;
      reasons.push(`התאמה בהסדרים: ${matched.join(", ")}`);
    }
  }

  if (input.ageGroups.length > 0) {
    const therapistAgeGroups = parseArray(therapist.age_groups);
    // Hard filter: therapist must have declared matching age groups
    if (therapistAgeGroups.length === 0 || !hasOverlap(therapistAgeGroups, input.ageGroups)) {
      return null;
    }
    possible += WEIGHTS.ageGroup;
    earned += WEIGHTS.ageGroup;
    reasons.push("התאמה בקבוצת גיל");
  }

  // הציון המוצג: התאמה מקצועית בלבד, בלי בלוק המיקום (ראו ההערה שם).
  //
  // כשאין *שום* קריטריון מקצועי (חיפוש לפי אזור בלבד, או אונליין בלבד -
  // מהמאגר ולא מהשאלון) המכנה הוא 0, והנוסחה החזירה **0% לכל מטפל**. זה
  // נקרא למטופל כ"לא נמצאה שום התאמה" בדיוק במסך שאמור לשכנע אותו לפנות.
  // במקרה הזה אין מה למדוד מקצועית, ולכן נופלים ל-rankScore - שכולל את
  // המיקום, וזה בדיוק מה שהציון היה לפני הפיצול (19/8/2026). מסלול השאלון
  // לא מגיע לכאן: הוא תמיד שולח גילאים ושפה.
  const professionalScore = possible > 0 ? Math.round((earned / possible) * 100) : null;
  // ציון הדירוג: כולל מיקום, ולכן מטפל קרוב עדיין מדורג לפני רחוק. אינו מוצג
  // בשום מקום - בלעדיו הוצאת המיקום מהציון הייתה שוברת את סדר התוצאות.
  const rankScore =
    possible + locationPossible > 0
      ? Math.round(((earned + locationEarned) / (possible + locationPossible)) * 100)
      : 0;
  const score = professionalScore ?? rankScore;
  /** האם המטפל/ת באזור שהתבקש - לתג "באזור שלך" בכרטיס. */
  const inRequestedArea = locationPossible > 0 && locationEarned >= locationPossible * 0.6;

  // ── Personality / style matching ─────────────────────────────────────────
  let personality_score: number | null = null;
  const t1Raw = therapist.style_q1, t2 = therapist.style_q2, t3 = therapist.activity_level;
  const { styleP1, styleP2, styleP3 } = input;
  if (styleP1 != null && styleP2 != null && styleP3 != null &&
      t1Raw != null && t2 != null && t3 != null) {
    // All three Q scales aligned: 1=practical/immediate, 7=insight/deep/active.
    // davg is the mean absolute gap across the three dims (0 = identical, 6 =
    // opposite). A plain linear map (100*(1-davg/6)) punished typical 2-3 point
    // gaps too hard (→ 50-67%), which read as a poor match even when it isn't.
    // Use a concave curve with a 40 floor so good matches feel right and the
    // worst case still reads as "low" rather than "0". Stays monotonic: smaller
    // gap → higher score. Range [40,100].
    const davg = (Math.abs(styleP1 - t1Raw) + Math.abs(styleP2 - t2) + Math.abs(styleP3 - t3)) / 3;
    personality_score = Math.round(40 + 60 * Math.pow(1 - davg / 6, 0.65));
  }
  // מרכז כישות (entity_type='center'): אין "סגנון" אחד למרכז — הצוות רחב
  // ומתאים למטופל מטפל/ת אישיותית בתוך המרכז. לכן כשההתאמה האישיותית נמדדת
  // בכלל (המשתמש ענה על שאלון הסגנון), המרכז מקבל ציון קבוע גבוה (95) שמוצג
  // בכרטיס עם כוכבית הסבר; כשאין מענה אישיותי — null, כמו אצל כולם.
  if (therapist.entity_type === "center") {
    personality_score = styleP1 != null && styleP2 != null && styleP3 != null ? 95 : null;
  }

  return {
    score,
    rankScore,
    inRequestedArea,
    personality_score,
    reasons,
    normalizedTherapist: {
      therapistTypes,
      trainingAreas,
      regions,
      culturalPrefs,
      arrangements,
      therapistGender,
      therapistOnline,
    },
  };
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ ok: false, error: "יותר מדי בקשות. נסה שוב בעוד דקה." }, { status: 429 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const input = normalizeInput(body);

    const MATCH_COLUMNS =
      "id, full_name, gender, online, therapist_types, training_areas, assessment_types, couples_modalities, cogfun_age_groups, age_groups, regions, cultural_prefs, arrangements, languages, bio, phone, profile_photo_path, status, promotion_source, match_paused_until, style_q1, style_q2, activity_level, entity_type, center_account_id";

    const { data, error } = await supabaseAdmin
      .from("therapists")
      .select(MATCH_COLUMNS)
      .eq("status", "paying")
      .eq("admin_approved", true)
      // Marked "not accepting new patients" → never offered as a match
      // (stays visible only in the public directory).
      .eq("accepting_new_patients", true);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    const therapists = (data ?? []) as TherapistRow[];

    // ── FREE_REGION_FALLBACK (פיצ'ר זמני — ראו app/lib/match-fallback.ts) ──
    // המטופל לא ביקש אונליין, ובאזור המבוקש (אזור שלם, לא רק העיר) מתקיים
    // אחד משניים:
    //   region_empty  — אין אף מטפל משלם באזור → כל החינמיים באזור נכנסים.
    //   expertise_gap — יש משלמים באזור אבל אף אחד לא בתחום הטיפול המבוקש /
    //                   בסוג המטפל הנדרש → נכנסים רק חינמיים מהאזור שכן בתחום.
    let freeFallbackRegion: string | null = null;
    let freeFallbackTrigger: "region_empty" | "expertise_gap" | null = null;
    const freeFallbackIds = new Set<string>();
    if (FREE_REGION_FALLBACK_ENABLED && !input.onlineRequired) {
      const patientRegion =
        input.region ?? (input.city ? CITY_TO_REGION[input.city] ?? null : null);
      if (patientRegion) {
        const expertiseNeed = uniqueStrings([
          ...input.treatmentTypes,
          ...input.diagnosisTypes,
        ]);
        // "רלוונטי" = בתחום המבוקש (אם התבקש) וגם בסוג המטפל הנדרש (אם התבקש)
        const isRelevant = (t: TherapistRow) => {
          if (
            expertiseNeed.length > 0 &&
            !overlaps(
              expertiseOf(
                parseArray(t.training_areas),
                parseArray(t.assessment_types),
                parseArray(t.couples_modalities)
              ),
              expertiseNeed
            )
          ) {
            return false;
          }
          if (
            input.requiredTherapistTypes.length > 0 &&
            !overlaps(parseArray(t.therapist_types), input.requiredTherapistTypes)
          ) {
            return false;
          }
          return true;
        };

        const payingInRegion = therapists.filter((t) =>
          coversRegion(parseArray(t.regions), patientRegion)
        );
        if (payingInRegion.length === 0) {
          freeFallbackTrigger = "region_empty";
        } else if (
          (expertiseNeed.length > 0 || input.requiredTherapistTypes.length > 0) &&
          !payingInRegion.some(isRelevant)
        ) {
          freeFallbackTrigger = "expertise_gap";
        }

        if (freeFallbackTrigger) {
          const { data: freeData } = await supabaseAdmin
            .from("therapists")
            .select(MATCH_COLUMNS)
            .eq("status", "approved")
            .eq("admin_approved", true)
            .eq("accepting_new_patients", true)
            .neq("entity_type", "center"); // ישות-מרכז (למשל מרכז שבוטל) אינה גיבוי חינמי
          const freeCandidates = ((freeData ?? []) as TherapistRow[]).filter(
            (t) =>
              coversRegion(parseArray(t.regions), patientRegion) &&
              (freeFallbackTrigger === "region_empty" || isRelevant(t))
          );
          if (freeCandidates.length > 0) {
            freeFallbackRegion = patientRegion;
            for (const t of freeCandidates) freeFallbackIds.add(t.id);
            therapists.push(...freeCandidates);
          } else {
            freeFallbackTrigger = null;
          }
        }
      }
    }
    // ── end FREE_REGION_FALLBACK ──

    const scored = therapists
      .map((therapist) => {
        const result = scoreTherapist(therapist, input);
        if (result === null) return null;
        return { therapist, result };
      })
      .filter((x): x is { therapist: TherapistRow; result: NonNullable<ReturnType<typeof scoreTherapist>> } => x !== null);

    // ── הקפאה זמנית מההתאמות ─────────────────────────────────────────────
    // מטפל/ת שנמצא/ת בהקפאה (match_paused_until בעתיד) יוצא/ת מהתוצאות, כדי
    // לפנות מקום לאחרים. משפיע על השאלון בלבד - במאגר הציבורי ובדירוג שלו
    // אין שינוי, ולא נשלחת שום התראה.
    //
    // רשת ביטחון: אם ההקפאה מותירה תוצאות דלות מדי, מחזירים את כולם. מטופל
    // שרואה 1-2 תוצאות חווה את זה כתקלה, וזה גם מכסה את המקרה שבו המוקפא/ת
    // הוא/היא היחיד/ה שמכסה נישה מסוימת (שם גם מנגנון הגיבוי החינמי לא היה
    // נכנס, כי הוא נבדק לפני הניקוד ולפי מטפלים משלמים שקיימים).
    const MIN_RESULTS_BEFORE_RESTORING_PAUSED = 3;
    const nowMs = Date.now();
    const isPaused = (t: TherapistRow) =>
      t.match_paused_until != null && new Date(t.match_paused_until).getTime() > nowMs;

    const pausedCount = scored.filter((x) => isPaused(x.therapist)).length;
    if (pausedCount > 0) {
      const active = scored.filter((x) => !isPaused(x.therapist));
      // הסף מתחשב גם במקרה שבו ממילא אין הרבה מועמדים בכלל.
      const needed = Math.min(MIN_RESULTS_BEFORE_RESTORING_PAUSED, scored.length);
      if (active.length >= needed) {
        scored.length = 0;
        scored.push(...active);
      }
      // אחרת: משאירים את הרשימה המלאה - עדיף מוקפא/ת מאשר מסך כמעט ריק.
    }

    // Randomize BEFORE the stable sort below, so any group that ends up tied
    // (equal score, and equal or absent personality) inherits this random
    // order instead of the DB's fixed row order. Without this, the base query
    // has no ORDER BY, so ties resolved to the SAME therapist every single
    // time — confirmed live: identical top-10 across repeated identical
    // requests, and one therapist landing #1 across three unrelated
    // treatment searches purely by DB position. Personality data (sent only
    // when the patient's chosen domain includes the style questions) is a
    // MINORITY of requests, so most ties had zero tiebreaker at all and this
    // was silently burying some paying therapists from every search forever.
    for (let i = scored.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [scored[i], scored[j]] = [scored[j], scored[i]];
    }

    const WEIGHT_PROFESSIONAL = 0.65;
    const WEIGHT_PERSONALITY  = 0.35;

    function combinedScore(prof: number, pers: number | null): number {
      if (pers == null) return prof;
      return Math.round(prof * WEIGHT_PROFESSIONAL + pers * WEIGHT_PERSONALITY);
    }

    scored.sort((a, b) => {
      // קודם כל: מי שבאזור שהתבקש, ורק אחריו כל השאר. זו חלוקה לשתי קבוצות
      // ולא עוד נקודה במשקל, כי משקל לבדו לא סוגר את זה: מטפל מאזור סמוך עם
      // התאמה מקצועית מלאה (דירוג 68) עדיין עוקף מקומי בינוני (62), והמסך
      // הראה 95% מחיפה ומתחתיו 98% מחדרה. הלקוח מציג את הקבוצה השנייה תחת
      // כותרת משלה. כשלא התבקש מיקום כלל, הדגל זהה לכולם ואין השפעה.
      if (a.result.inRequestedArea !== b.result.inRequestedArea) {
        return a.result.inRequestedArea ? -1 : 1;
      }
      // הדירוג על rankScore (כולל מיקום) ולא על הציון המוצג. מטפל קרוב עדיין
      // עולה על רחוק - רק שהמספר בכרטיס אינו נושא את ההפרש הזה.
      const profDiff = b.result.rankScore - a.result.rankScore;
      // Primary: professional score — expertise/location/etc.
      // Personality can only affect ranking when professional scores are within 8 points
      if (Math.abs(profDiff) > 8) return profDiff;
      // Tiebreaker within close range: combined score (personality can tip).
      const ca = combinedScore(a.result.rankScore, a.result.personality_score);
      const cb = combinedScore(b.result.rankScore, b.result.personality_score);
      if (cb !== ca) return cb - ca;
      // Genuinely tied on match quality → paying customers come first.
      // Deliberately AFTER the quality scores: a paying therapist never
      // outranks a demonstrably better fit, but among equals the money wins.
      const rankDiff = commercialRank(a.therapist) - commercialRank(b.therapist);
      if (rankDiff !== 0) return rankDiff;
      // Still identical → the shuffle above decides (sort is stable), so
      // rotation is fair instead of frozen to the DB's row order.
      return 0;
    });

    const top = scored.slice(0, input.limit);

    // Detect addiction fallback: user requested addiction treatment but no matched therapist specializes in it
    const ADDICTION_LABEL = normalizeText("טיפול בהתמכרויות");
    const addictionRequested = input.treatmentTypes.some(t => normalizeText(t) === ADDICTION_LABEL);
    const addictionCbtFallback = addictionRequested &&
      scored.every(({ result }) => !result.normalizedTherapist.trainingAreas.some(a => normalizeText(a) === ADDICTION_LABEL));

    // מסלול 2: כרטיס מרכז מקשר לעמוד הפרופיל הציבורי /centers/<slug> (לא לעמוד
    // מטפל שנחסם). שולפים את ה-slug של המרכזים שהופיעו בתוצאות בבת-אחת.
    const centerSlugById = new Map<string, string>();
    const centerLogoById = new Map<string, string>();
    const entityCenterIds = top
      .filter((x) => x.therapist.entity_type === "center" && x.therapist.center_account_id)
      .map((x) => x.therapist.center_account_id as string);
    if (entityCenterIds.length > 0) {
      const { data: slugRows } = await supabaseAdmin
        .from("therapy_center_accounts")
        .select("id, slug, logo_path")
        .in("id", entityCenterIds);
      // הלוגו נכנס לחריץ התמונה של הכרטיס (אחרת מרכז מקבל אווטאר מגדרי).
      const logoRows = (slugRows ?? []).filter((r) => r.logo_path);
      if (logoRows.length > 0) {
        const paths = logoRows.map((r) => r.logo_path as string);
        const { data: signed } = await supabaseAdmin.storage
          .from("therapist-certificates")
          .createSignedUrls(paths, 60 * 60);
        (signed ?? []).forEach((s, i) => {
          if (s.signedUrl) centerLogoById.set(logoRows[i].id as string, s.signedUrl);
        });
      }
      for (const r of slugRows ?? []) if (r.slug) centerSlugById.set(r.id as string, r.slug as string);
    }

    const ranked = await Promise.all(
      top.map(async ({ therapist, result }) => {
        const photoUrl = await buildSignedPhotoUrl(therapist.profile_photo_path);
        return {
          id: therapist.id,
          full_name: therapist.full_name,
          gender: therapist.gender,
          online: therapist.online,
          therapist_types: therapist.therapist_types,
          // התואר כפי שהוא מוצג בכותרת הפרופיל. מחושב כאן ולא בלקוח כי
          // age_groups לא משודר החוצה, והכלל חייב לצאת ממקום אחד (ראו
          // publicTherapistTitle). ישות-מרכז לא מקבלת תואר אישי.
          public_title:
            therapist.entity_type === "center"
              ? null
              : parseArray(therapist.therapist_types)[0]
                ? publicTherapistTitle(
                    parseArray(therapist.therapist_types)[0],
                    typeof therapist.gender === "string" ? therapist.gender : null,
                    parseArray(therapist.age_groups),
                  )
                : null,
          training_areas: therapist.training_areas,
          couples_modalities: therapist.couples_modalities,
          regions: therapist.regions,
          cultural_prefs: therapist.cultural_prefs,
          arrangements: therapist.arrangements,
          bio: therapist.bio,
          // לישות אין כפתורי קשר בכרטיס — הטלפון הפנימי של המרכז לא משודר
          phone: therapist.entity_type === "center" ? null : therapist.phone,
          // ישות-מרכז: הלוגו של המרכז בחריץ התמונה (אין לה תמונת פרופיל משלה)
          profile_photo_url: therapist.entity_type === "center" && therapist.center_account_id
            ? (centerLogoById.get(therapist.center_account_id) ?? null)
            : photoUrl,
          status: therapist.status,
          entity_type: therapist.entity_type, // 'center' → כרטיס מוצג כ"מרכז טיפולי"
          profile_slug: therapist.entity_type === "center" && therapist.center_account_id
            ? (centerSlugById.get(therapist.center_account_id) ?? null)
            : null,
          // FREE_REGION_FALLBACK (זמני): מטפל חינמי שנכנס כגיבוי אזורי
          free_fallback: freeFallbackIds.has(therapist.id),
          match_score: result.score,
          personality_score: result.personality_score,
          combined_score: combinedScore(result.score, result.personality_score),
          // המרחק יצא מהציון ולכן חייב להיות גלוי כתג משלו - אחרת המידע פשוט
          // נעלם מהמטופל במקום לעבור לערוץ ברור יותר.
          in_requested_area: result.inRequestedArea,
          match_reasons: result.reasons,
        };
      })
    );

    // FREE_REGION_FALLBACK (זמני): רישום הפעלה ל-analytics_events כדי שאפשר
    // יהיה לראות באדמין מתי ולאיזה אזור המנגנון נכנס לפעולה. כשל ברישום לא
    // מפיל את ההתאמה.
    if (freeFallbackRegion) {
      const returnedFree = ranked.filter((m) => freeFallbackIds.has(m.id));
      try {
        await supabaseAdmin.from("analytics_events").insert({
          event_type: "match_free_fallback",
          source: "match_api",
          metadata: {
            region: freeFallbackRegion,
            city: input.city,
            trigger: freeFallbackTrigger,
            requested_treatments: input.treatmentTypes,
            free_candidates: freeFallbackIds.size,
            free_returned: returnedFree.length,
            free_therapist_ids: returnedFree.map((m) => m.id),
          },
        });
      } catch {
        // logging only
      }
    }

    return NextResponse.json({
      ok: true,
      input_normalized: input,
      total_found: therapists.length,
      returned: ranked.length,
      matches: ranked,
      addiction_cbt_fallback: addictionCbtFallback,
      // FREE_REGION_FALLBACK (זמני)
      free_region_fallback: freeFallbackRegion
        ? {
            region: freeFallbackRegion,
            trigger: freeFallbackTrigger,
            candidates: freeFallbackIds.size,
          }
        : null,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Unknown server error",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Use POST /api/match with questionnaire output JSON",
    example_body: {
      treatmentTypes: ["cbt", "trauma"],
      diagnosisTypes: ["anxiety"],
      therapistTypes: ["clinical psychologist"],
      culturalPreferences: ["religious"],
      arrangements: ["private"],
      region: "center",
      genderPreference: "female",
      onlineRequired: true,
      limit: 5,
    },
  });
}