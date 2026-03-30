import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { CITY_TO_REGION } from "@/app/lib/regions";
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
  regions: unknown;
  cultural_prefs: unknown;
  arrangements: unknown;
  bio: string | null;
  profile_photo_path: string | null;
  status: string | null;
  style_q1: number | null;
  style_q2: number | null;
  activity_level: number | null;
  age_groups: unknown;
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
};

const WEIGHTS = {
  expertise: 25,       // training_areas
  therapistType: 8,    // therapist_types
  locationOnline: 10,  // regions + online
  gender: 4,           // gender
  cultural: 5,         // cultural_prefs
  arrangements: 3,     // arrangements
  ageGroup: 15,        // age_groups
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
  const trainingAreas = uniqueStrings([
    ...parseArray(therapist.training_areas),
    ...parseArray(therapist.assessment_types),
  ]);
  const regions = parseArray(therapist.regions);
  const culturalPrefs = parseArray(therapist.cultural_prefs);
  const arrangements = parseArray(therapist.arrangements);
  const therapistGender = normalizeText(therapist.gender);
  const therapistOnline = parseBoolean(therapist.online);

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
      earned += WEIGHTS.expertise;
      reasons.push(`התאמה בתחום המומחיות: ${matched.join(", ")}`);
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

    const patientRegion = input.region ??
      (input.city ? CITY_TO_REGION[input.city] ?? null : null);

    // בדיקת התאמת עיר מדויקת
    const inExactCity = input.city
      ? regions.includes(normalizeText(input.city))
      : false;

    // בדיקת התאמת אזור (אותו אזור, עיר שונה)
    const inSameRegion = patientRegion
      ? regions.some((c) => CITY_TO_REGION[c] === patientRegion)
      : false;

    const onlineMatch = input.onlineRequired && therapistOnline;

    if (inExactCity) {
      earned += WEIGHTS.locationOnline; // התאמה מלאה — אותה עיר
      reasons.push("התאמה מלאה באזור");
    } else if (inSameRegion) {
      earned += Math.round(WEIGHTS.locationOnline * 0.6); // 60% — אותו אזור
      reasons.push("התאמה באזור");
    } else if (onlineMatch) {
      earned += Math.round(WEIGHTS.locationOnline * 0.4); // 40% — אונליין בלבד
      reasons.push("מציע טיפול אונליין");
    }
    // אזור שונה לגמרי = 0 נקודות
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
    possible += WEIGHTS.ageGroup;
    const therapistAgeGroups = parseArray(therapist.age_groups);
    if (hasOverlap(therapistAgeGroups, input.ageGroups)) {
      earned += WEIGHTS.ageGroup;
      reasons.push("התאמה בקבוצת גיל");
    }
  }

  const score =
    possible > 0 ? Math.round((earned / possible) * 100) : 0;

  // ── Personality / style matching ─────────────────────────────────────────
  let personality_score: number | null = null;
  const t1 = therapist.style_q1, t2 = therapist.style_q2, t3 = therapist.activity_level;
  const { styleP1, styleP2, styleP3 } = input;
  if (styleP1 != null && styleP2 != null && styleP3 != null &&
      t1 != null && t2 != null && t3 != null) {
    const davg = (Math.abs(styleP1 - t1) + Math.abs(styleP2 - t2) + Math.abs(styleP3 - t3)) / 3;
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
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Missing env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
        },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const input = normalizeInput(body);

    const { data, error } = await supabase
      .from("therapists")
      .select(
        "id, full_name, gender, online, therapist_types, training_areas, assessment_types, age_groups, regions, cultural_prefs, arrangements, bio, profile_photo_path, status, style_q1, style_q2, activity_level"
      )
      // זמנית: כדי שתוכל לבדוק גם מטפלים שעוד לא אושרו סופית
      .in("status", ["approved", "pending"]);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    const therapists = (data ?? []) as TherapistRow[];

    const scored = therapists.map((therapist) => {
      const result = scoreTherapist(therapist, input);
      return { therapist, result };
    });

    const WEIGHT_PROFESSIONAL = 0.65;
    const WEIGHT_PERSONALITY  = 0.35;

    function combinedScore(prof: number, pers: number | null): number {
      if (pers == null) return prof;
      return Math.round(prof * WEIGHT_PROFESSIONAL + pers * WEIGHT_PERSONALITY);
    }

    scored.sort((a, b) => {
      if (a.therapist.status === "approved" && b.therapist.status !== "approved") return -1;
      if (a.therapist.status !== "approved" && b.therapist.status === "approved") return 1;
      const ca = combinedScore(a.result.score, a.result.personality_score);
      const cb = combinedScore(b.result.score, b.result.personality_score);
      return cb - ca;
    });

    const top = scored.slice(0, input.limit);

    const ranked = await Promise.all(
      top.map(async ({ therapist, result }) => ({
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
        profile_photo_path: therapist.profile_photo_path,
        profile_photo_url: await buildSignedPhotoUrl(therapist.profile_photo_path),
        status: therapist.status,
        match_score: result.score,
        personality_score: result.personality_score,
        combined_score: combinedScore(result.score, result.personality_score),
        match_reasons: result.reasons,
        debug_normalized: result.normalizedTherapist,
      }))
    );

    return NextResponse.json({
      ok: true,
      input_normalized: input,
      total_found: therapists.length,
      returned: ranked.length,
      matches: ranked,
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