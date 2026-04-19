import { NextRequest, NextResponse } from "next/server";
import { CITY_TO_REGION, REGION_NEIGHBORS } from "@/app/lib/regions";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

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
  regions: unknown;
  cultural_prefs: unknown;
  arrangements: unknown;
  bio: string | null;
  phone: string | null;
  email: string | null;
  profile_photo_path: string | null;
  status: string | null;
  style_q1: number | null;
  style_q2: number | null;
  activity_level: number | null;
  age_groups: unknown;
  languages: unknown;
};

type NormalizedMatchInput = {
  treatmentTypes: string[];
  diagnosisTypes: string[];
  therapistTypes: string[];
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
  couplesModality: string | null;
  needsSexualTherapy: boolean;
};

const WEIGHTS = {
  expertise: 25,       // training_areas
  therapistType: 8,    // therapist_types
  locationOnline: 10,  // regions + online
  gender: 4,           // gender
  cultural: 5,         // cultural_prefs
  arrangements: 3,     // arrangements
  ageGroup: 15,        // age_groups
  couplesBonus: 8,     // exact couples modality match (EFT/דינאמי/מבני)
  sexualBonus: 6,      // therapist also does sexual therapy when needed
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
  const couplesModality = firstNonEmptyString(body.couplesModality, body.couples_modality);
  const needsSexualTherapy = parseBoolean(body.needsSexualTherapy ?? body.needs_sexual_therapy);

  return {
    treatmentTypes,
    diagnosisTypes,
    therapistTypes,
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
  };
}

async function buildSignedPhotoUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  try {
    const { data, error } = await supabaseAdmin.storage
      .from("therapist-certificates")
      .createSignedUrl(decodeURIComponent(path), 60 * 60);
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

  // Bonus: exact couples modality match (e.g. patient needs EFT and therapist does EFT)
  if (input.couplesModality) {
    possible += WEIGHTS.couplesBonus;
    if (couplesModalities.some((m) => normalizeText(m) === normalizeText(input.couplesModality!))) {
      earned += WEIGHTS.couplesBonus;
      reasons.push(`התאמה בגישה הזוגית: ${input.couplesModality}`);
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

  if (input.therapistTypes.length > 0) {
    possible += WEIGHTS.therapistType;
    const matched = intersection(therapistTypes, input.therapistTypes);
    if (matched.length > 0) {
      earned += WEIGHTS.therapistType;
      reasons.push(`התאמה בסוג המטפל: ${matched.join(", ")}`);
    }
  }

  if (input.city || input.region || input.onlineRequired) {
    possible += WEIGHTS.locationOnline;

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
      earned += WEIGHTS.locationOnline; // 100% — אותה עיר
      reasons.push("התאמה מלאה באזור");
    } else if (inSameRegion) {
      earned += Math.round(WEIGHTS.locationOnline * 0.6); // 60% — אותו אזור
      reasons.push("התאמה באזור");
    } else if (inAdjacentRegion) {
      earned += Math.round(WEIGHTS.locationOnline * 0.3); // 30% — אזור סמוך
      reasons.push("מטפל/ת מאזור סמוך");
    } else if (onlineMatch) {
      earned += Math.round(WEIGHTS.locationOnline * 0.4); // 40% — אונליין בלבד
      reasons.push("מציע טיפול אונליין");
    } else if (patientRegion) {
      // Hard filter: no geographic match and user didn't request online → exclude
      // (applies whether or not therapist declared regions)
      return null;
    }
  }

  if (input.genderPreference) {
    possible += WEIGHTS.gender;
    if (therapistGender && therapistGender === normalizeText(input.genderPreference)) {
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

  const score =
    possible > 0 ? Math.round((earned / possible) * 100) : 0;

  // ── Personality / style matching ─────────────────────────────────────────
  let personality_score: number | null = null;
  const t1Raw = therapist.style_q1, t2 = therapist.style_q2, t3 = therapist.activity_level;
  const { styleP1, styleP2, styleP3 } = input;
  if (styleP1 != null && styleP2 != null && styleP3 != null &&
      t1Raw != null && t2 != null && t3 != null) {
    // All three Q scales aligned: 1=practical/immediate, 7=insight/deep/active
    const davg = (Math.abs(styleP1 - t1Raw) + Math.abs(styleP2 - t2) + Math.abs(styleP3 - t3)) / 3;
    personality_score = Math.round(100 * (1 - davg / 6));
  }

  return {
    score,
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

    const { data, error } = await supabaseAdmin
      .from("therapists")
      .select(
        "id, full_name, gender, online, therapist_types, training_areas, assessment_types, couples_modalities, age_groups, regions, cultural_prefs, arrangements, languages, bio, phone, email, profile_photo_path, status, style_q1, style_q2, activity_level"
      )
      .eq("status", "paying");

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    const therapists = (data ?? []) as TherapistRow[];

    const scored = therapists
      .map((therapist) => {
        const result = scoreTherapist(therapist, input);
        if (result === null) return null;
        return { therapist, result };
      })
      .filter((x): x is { therapist: TherapistRow; result: NonNullable<ReturnType<typeof scoreTherapist>> } => x !== null);

    const WEIGHT_PROFESSIONAL = 0.65;
    const WEIGHT_PERSONALITY  = 0.35;

    function combinedScore(prof: number, pers: number | null): number {
      if (pers == null) return prof;
      return Math.round(prof * WEIGHT_PROFESSIONAL + pers * WEIGHT_PERSONALITY);
    }

    scored.sort((a, b) => {
      const profDiff = b.result.score - a.result.score;
      // Primary: professional score — expertise/location/etc.
      // Personality can only affect ranking when professional scores are within 8 points
      if (Math.abs(profDiff) > 8) return profDiff;
      // Tiebreaker within close range: combined score (personality can tip)
      const ca = combinedScore(a.result.score, a.result.personality_score);
      const cb = combinedScore(b.result.score, b.result.personality_score);
      return cb - ca;
    });

    const top = scored.slice(0, input.limit);

    // Detect addiction fallback: user requested addiction treatment but no matched therapist specializes in it
    const ADDICTION_LABEL = normalizeText("טיפול בהתמכרויות");
    const addictionRequested = input.treatmentTypes.some(t => normalizeText(t) === ADDICTION_LABEL);
    const addictionCbtFallback = addictionRequested &&
      scored.every(({ result }) => !result.normalizedTherapist.trainingAreas.some(a => normalizeText(a) === ADDICTION_LABEL));

    const ranked = await Promise.all(
      top.map(async ({ therapist, result }) => {
        const photoUrl = await buildSignedPhotoUrl(therapist.profile_photo_path);
        return {
          id: therapist.id,
          full_name: therapist.full_name,
          gender: therapist.gender,
          online: therapist.online,
          therapist_types: therapist.therapist_types,
          training_areas: therapist.training_areas,
          regions: therapist.regions,
          cultural_prefs: therapist.cultural_prefs,
          arrangements: therapist.arrangements,
          bio: therapist.bio,
          phone: therapist.phone,
          email: therapist.email,
          profile_photo_url: photoUrl,
          status: therapist.status,
          match_score: result.score,
          personality_score: result.personality_score,
          combined_score: combinedScore(result.score, result.personality_score),
          match_reasons: result.reasons,
        };
      })
    );

    return NextResponse.json({
      ok: true,
      input_normalized: input,
      total_found: therapists.length,
      returned: ranked.length,
      matches: ranked,
      addiction_cbt_fallback: addictionCbtFallback,
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