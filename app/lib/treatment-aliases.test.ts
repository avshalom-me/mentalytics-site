import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { toTrainingAreaKey } from "./treatment-aliases";
import { TRAINING_AREAS, PLAY_THERAPY_MODALITIES, ASSESSMENT_TYPES, THERAPIST_TYPES } from "./therapist-options";

// המלצה של שאלון שאין לה תחום בטופס של המטפלים לא מתאימה לאף מטפל, והחיפוש
// שלה מציג לכולם אותו אחוז נמוך - בלי שום שגיאה. כך "הדרכת הורים טיפולית"
// נשארה שבורה ארבעה חודשים. הבדיקות כאן קוראות את מפתחות ההמלצה ישירות מקוד
// השאלונים (כמו school-tracks.test.ts), כדי שמפתח חדש או שינוי בטופס יכשילו
// את הבדיקה ולא את החיפוש של משפחה.

const src = (file: string) => readFileSync(join(process.cwd(), "app", "lib", file), "utf8");

function patternKeys(source: string, arrayName: string): string[] {
  const start = source.indexOf(`const ${arrayName}`);
  if (start < 0) throw new Error(`${arrayName} not found in kids-recommendations.ts`);
  const body = source.slice(start, source.indexOf("];", start));
  return [...new Set([...body.matchAll(/key:\s*"([^"]+)"/g)].map((m) => m[1]))];
}

const TRAINING = new Set<string>([...TRAINING_AREAS, ...PLAY_THERAPY_MODALITIES]);

// המלצות שידוע שאין להן תחום בטופס, וההחלטה עליהן פתוחה. כשמתקנים אחת מהן -
// להוציא אותה מכאן (הבדיקה תדרוש זאת).
const KNOWN_KIDS_GAPS = ["פיזיותרפיה רצפת אגן"];

describe("toTrainingAreaKey", () => {
  it("maps the kids parent-guidance key to the area therapists tick", () => {
    expect(toTrainingAreaKey("הדרכת הורים טיפולית")).toBe("הדרכת הורים");
    expect(toTrainingAreaKey("  הדרכת  הורים   טיפולית ")).toBe("הדרכת הורים");
  });

  it("leaves every other key as it is", () => {
    expect(toTrainingAreaKey("CBT")).toBe("CBT");
    expect(toTrainingAreaKey("הדרכת הורים")).toBe("הדרכת הורים");
  });
});

describe("every recommendation a questionnaire can make has something to match", () => {
  const kids = src("kids-recommendations.ts");

  it("kids treatment keys are training areas (after the alias)", () => {
    const unmatched = patternKeys(kids, "TREATMENT_PATTERNS").filter((k) => !TRAINING.has(toTrainingAreaKey(k)));
    expect(unmatched.sort()).toEqual([...KNOWN_KIDS_GAPS].sort());
  });

  it("kids assessment keys are assessment types", () => {
    for (const k of patternKeys(kids, "ASSESSMENT_PATTERNS")) {
      expect(ASSESSMENT_TYPES as readonly string[], k).toContain(k);
    }
  });

  it("kids professional keys are therapist types", () => {
    for (const k of patternKeys(kids, "PROFESSIONAL_PATTERNS")) {
      expect(THERAPIST_TYPES as readonly string[], k).toContain(k);
    }
  });

  it("adults treatment keys are training areas, assessment types or therapist types", () => {
    const adults = src("questionnaire-score.ts");
    const keys = [...new Set([...adults.matchAll(/treatment:\s*"([^"]+)"/g)].map((m) => m[1]))];
    expect(keys.length).toBeGreaterThan(10);
    const allowed = new Set<string>([...TRAINING, ...ASSESSMENT_TYPES, ...THERAPIST_TYPES]);
    for (const k of keys) expect(allowed.has(toTrainingAreaKey(k)), k).toBe(true);
  });
});
