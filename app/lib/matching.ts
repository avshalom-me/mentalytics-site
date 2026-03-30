export type AgeGroup = "גיל הרך" | "ילדים" | "בני נוער" | "מבוגרים";
export type Gender = "גבר" | "אישה" | "אחר";

export type MatchInput = {
  recommendedTreatments: string[];
  recommendedDiagnoses: string[];
  preferredTherapistTypes: string[];
  ageGroup: AgeGroup | null;
  genderPreference: Gender | null;
  regions: string[];
  onlineRequired: boolean;
  culturalPreferences: string[];
  personalityPreference: number | null; // 1-7
  urgency: "low" | "medium" | "high" | null;
};

export type TherapistRecord = {
  id: string;
  full_name: string;
  therapist_types: string[];
  treatment_types: string[];
  diagnosis_types: string[];
  gender: Gender | null;
  age_groups: AgeGroup[];
  regions: string[];
  online_available: boolean;
  cultural_preferences: string[];
  personality_style: number | null; // 1-7
  public_approved: boolean;
};

export type MatchResult = {
  therapist: TherapistRecord;
  score: number;
  breakdown: {
    treatments: number;
    diagnoses: number;
    ageGroup: number;
    locationOnline: number;
    therapistTypes: number;
    gender: number;
    cultural: number;
    personality: number;
  };
  disqualifiedReasons: string[];
};

const WEIGHTS = {
  treatments: 25,
  diagnoses: 25,
  ageGroup: 20,
  locationOnline: 10,
  therapistTypes: 8,
  gender: 4,
  cultural: 5,
  personality: 3,
};

function normalizeArray(arr?: string[] | null): string[] {
  return (arr ?? []).map((x) => x.trim()).filter(Boolean);
}

function hasOverlap(a: string[], b: string[]): boolean {
  return a.some((x) => b.includes(x));
}

function overlapCount(a: string[], b: string[]): number {
  return a.filter((x) => b.includes(x)).length;
}

function scoreListMatch(requested: string[], available: string[], maxScore: number): number {
  const req = normalizeArray(requested);
  const av = normalizeArray(available);

  if (req.length === 0) return 0;
  const matches = overlapCount(req, av);
  if (matches === 0) return 0;

  const ratio = matches / req.length;
  return Math.round(maxScore * ratio);
}

function scoreLocationOnline(input: MatchInput, therapist: TherapistRecord): number {
  if (input.onlineRequired) {
    return therapist.online_available ? WEIGHTS.locationOnline : 0;
  }

  const regionMatch =
    input.regions.length > 0 && hasOverlap(normalizeArray(input.regions), normalizeArray(therapist.regions));

  if (regionMatch) return WEIGHTS.locationOnline;
  if (therapist.online_available) return 7;
  return 0;
}

function scoreGender(input: MatchInput, therapist: TherapistRecord): number {
  if (!input.genderPreference) return 0;
  return input.genderPreference === therapist.gender ? WEIGHTS.gender : 0;
}

function scorePersonality(input: MatchInput, therapist: TherapistRecord): number {
  if (input.personalityPreference == null || therapist.personality_style == null) return 0;

  const distance = Math.abs(input.personalityPreference - therapist.personality_style);

  if (distance === 0) return WEIGHTS.personality;
  if (distance === 1) return 2;
  if (distance === 2) return 1;
  return 0;
}

function isDisqualified(input: MatchInput, therapist: TherapistRecord): string[] {
  const reasons: string[] = [];

  if (!therapist.public_approved) {
    reasons.push("מטפל לא מאושר לפרסום");
  }

  if (input.ageGroup && !therapist.age_groups.includes(input.ageGroup)) {
    reasons.push("אין התאמה לקבוצת גיל");
  }

  if (input.onlineRequired && !therapist.online_available) {
    reasons.push("נדרש אונליין");
  }

  if (input.recommendedDiagnoses.length > 0) {
    const diagnosisOverlap = hasOverlap(
      normalizeArray(input.recommendedDiagnoses),
      normalizeArray(therapist.diagnosis_types)
    );

    if (!diagnosisOverlap) {
      reasons.push("אין סוג אבחון מתאים");
    }
  }

  return reasons;
}

export function scoreTherapist(input: MatchInput, therapist: TherapistRecord): MatchResult {
  const disqualifiedReasons = isDisqualified(input, therapist);

  const treatments = scoreListMatch(
    input.recommendedTreatments,
    therapist.treatment_types,
    WEIGHTS.treatments
  );

  const diagnoses =
    input.recommendedDiagnoses.length > 0
      ? scoreListMatch(input.recommendedDiagnoses, therapist.diagnosis_types, WEIGHTS.diagnoses)
      : 0;

  const ageGroup =
    input.ageGroup && therapist.age_groups.includes(input.ageGroup) ? WEIGHTS.ageGroup : 0;

  const locationOnline = scoreLocationOnline(input, therapist);

  const therapistTypes = scoreListMatch(
    input.preferredTherapistTypes,
    therapist.therapist_types,
    WEIGHTS.therapistTypes
  );

  const gender = scoreGender(input, therapist);

  const cultural = scoreListMatch(
    input.culturalPreferences,
    therapist.cultural_preferences,
    WEIGHTS.cultural
  );

  const personality = scorePersonality(input, therapist);

  const score =
    disqualifiedReasons.length > 0
      ? 0
      : treatments +
        diagnoses +
        ageGroup +
        locationOnline +
        therapistTypes +
        gender +
        cultural +
        personality;

  return {
    therapist,
    score,
    breakdown: {
      treatments,
      diagnoses,
      ageGroup,
      locationOnline,
      therapistTypes,
      gender,
      cultural,
      personality,
    },
    disqualifiedReasons,
  };
}

export function matchTherapists(input: MatchInput, therapists: TherapistRecord[]): MatchResult[] {
  return therapists
    .map((therapist) => scoreTherapist(input, therapist))
    .filter((result) => result.disqualifiedReasons.length === 0)
    .sort((a, b) => b.score - a.score);
}