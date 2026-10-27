import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

// מצב "גפ״ן": רישיון בית ספר שההסבר ורשימת המטפלים כבויים בו. הבדיקות כאן
// קובעות שני דברים: כבוי = אין שינוי בהתנהגות (ברירת המחדל, ובלי עוגייה), ודולק =
// חסימה בשרת, שקשורה לעוגייה ולא לשדה שהלקוח שולח.
const m = vi.hoisted(() => ({ maybeSingle: vi.fn(), from: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/app/lib/supabaseAdmin", () => ({ supabaseAdmin: { from: m.from } }));

import { featureRefusal, licenseFeatureFlags } from "@/app/lib/school-features.server";
import { SCHOOL_COOKIE, encodeGrant } from "@/app/lib/school-gate.server";
import {
  ALL_FEATURES_ON,
  GEFEN_DISABLED_FEATURES,
  SCHOOL_FEATURES,
  cleanDisabledFeatures,
  featureFlagsFrom,
} from "@/app/lib/schools-crm";

process.env.CRON_SECRET = "test-gate-secret";

const grant = () => encodeGrant({ license_id: "lic-1", school_id: "school-1", exp: Math.floor(Date.now() / 1000) + 3600 });
const reqWith = (cookie?: string) => ({ headers: { get: (n: string) => (n === "cookie" && cookie ? `${SCHOOL_COOKIE}=${cookie}` : null) } });

beforeEach(() => {
  m.maybeSingle.mockReset().mockResolvedValue({ data: { disabled_features: [] }, error: null });
  m.from.mockReset().mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: m.maybeSingle }) }) });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("the flags a licence carries", () => {
  it("a licence with nothing switched off has everything on, which is how every licence starts", () => {
    expect(featureFlagsFrom([])).toEqual(ALL_FEATURES_ON);
    expect(featureFlagsFrom(null)).toEqual(ALL_FEATURES_ON);
    expect(featureFlagsFrom(undefined)).toEqual(ALL_FEATURES_ON);
    expect(ALL_FEATURES_ON).toEqual({ ai_explain: true, therapist_search: true });
  });

  it("switches off exactly what the list names, and ignores what it does not know", () => {
    expect(featureFlagsFrom(["ai_explain"])).toEqual({ ai_explain: false, therapist_search: true });
    expect(featureFlagsFrom(["therapist_search"])).toEqual({ ai_explain: true, therapist_search: false });
    expect(featureFlagsFrom(["ai_explain", "something_new"])).toEqual({ ai_explain: false, therapist_search: true });
    expect(featureFlagsFrom("ai_explain")).toEqual(ALL_FEATURES_ON);
  });

  it("the Gefen profile switches off both features the brief names, and nothing else exists to forget", () => {
    expect([...GEFEN_DISABLED_FEATURES].sort()).toEqual(["ai_explain", "therapist_search"]);
    expect(featureFlagsFrom(GEFEN_DISABLED_FEATURES)).toEqual({ ai_explain: false, therapist_search: false });
    expect(Object.keys(ALL_FEATURES_ON).sort()).toEqual([...SCHOOL_FEATURES].sort());
  });

  it("cleans the admin's input to known features, once each, in a fixed order", () => {
    expect(cleanDisabledFeatures(["therapist_search", "ai_explain", "ai_explain", "x", 7])).toEqual(["ai_explain", "therapist_search"]);
    expect(cleanDisabledFeatures([])).toEqual([]);
    expect(cleanDisabledFeatures("ai_explain")).toEqual([]);
    expect(cleanDisabledFeatures(undefined)).toEqual([]);
  });
});

describe("featureRefusal", () => {
  it("does nothing, and asks the database nothing, for a request without a licence cookie", async () => {
    expect(await featureRefusal(reqWith(), "ai_explain")).toBeNull();
    expect(await featureRefusal(reqWith(), "therapist_search")).toBeNull();
    expect(m.from).not.toHaveBeenCalled();
  });

  it("does nothing for a cookie that is forged or expired", async () => {
    const forged = grant().replace(/\.[^.]+$/, ".AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
    expect(await featureRefusal(reqWith(forged), "ai_explain")).toBeNull();
    const expired = encodeGrant({ license_id: "lic-1", school_id: "school-1", exp: Math.floor(Date.now() / 1000) - 10 });
    expect(await featureRefusal(reqWith(expired), "ai_explain")).toBeNull();
    expect(m.from).not.toHaveBeenCalled();
  });

  it("lets a licensed school through when nothing is switched off for it", async () => {
    expect(await featureRefusal(reqWith(grant()), "ai_explain")).toBeNull();
    expect(await featureRefusal(reqWith(grant()), "therapist_search")).toBeNull();
    expect(m.from).toHaveBeenCalledWith("school_licenses");
  });

  it("refuses with 403 the feature that is off, and only that one", async () => {
    m.maybeSingle.mockResolvedValue({ data: { disabled_features: ["ai_explain"] }, error: null });
    const ai = await featureRefusal(reqWith(grant()), "ai_explain");
    expect(ai?.status).toBe(403);
    expect(await ai?.json()).toMatchObject({ ok: false, featureDisabled: "ai_explain" });
    expect(await featureRefusal(reqWith(grant()), "therapist_search")).toBeNull();
  });

  it("with both off, refuses both", async () => {
    m.maybeSingle.mockResolvedValue({ data: { disabled_features: [...GEFEN_DISABLED_FEATURES] }, error: null });
    expect((await featureRefusal(reqWith(grant()), "ai_explain"))?.status).toBe(403);
    expect((await featureRefusal(reqWith(grant()), "therapist_search"))?.status).toBe(403);
  });

  it("a licence that no longer exists is treated as no licence", async () => {
    m.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await featureRefusal(reqWith(grant()), "ai_explain")).toBeNull();
  });

  it("before the migration is run (no such column) everything stays on", async () => {
    m.maybeSingle.mockResolvedValue({ data: null, error: { code: "42703", message: 'column "disabled_features" does not exist' } });
    expect(await featureRefusal(reqWith(grant()), "ai_explain")).toBeNull();
    expect(await licenseFeatureFlags("lic-1")).toEqual(ALL_FEATURES_ON);
    m.maybeSingle.mockResolvedValue({ data: null, error: { code: "PGRST204", message: "column not in schema cache" } });
    expect(await licenseFeatureFlags("lic-1")).toEqual(ALL_FEATURES_ON);
  });

  it("a read that throws, or a missing signing secret, is the same 503 and not a raw 500", async () => {
    m.maybeSingle.mockRejectedValue(new Error("network"));
    expect((await featureRefusal(reqWith(grant()), "ai_explain"))?.status).toBe(503);
    const saved = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    try {
      expect((await featureRefusal(reqWith("a.b.9999999999.c"), "ai_explain"))?.status).toBe(503);
    } finally {
      process.env.CRON_SECRET = saved;
    }
  });

  it("any other read failure refuses, because a licence that promised no AI must not open to it on a glitch", async () => {
    m.maybeSingle.mockResolvedValue({ data: null, error: { code: "57014", message: "statement timeout" } });
    const res = await featureRefusal(reqWith(grant()), "ai_explain");
    expect(res?.status).toBe(503);
    expect(await licenseFeatureFlags("lic-1")).toBeNull();
  });
});

// הנתיב הגדול של ההתאמה לא נבדק כאן כנתיב (תלוי במסד כולו). נבדק שהשומר נקרא
// בו, ושהוא נקרא לפני כל עבודה, כמו בשני נתיבי ההסבר.
describe("the public routes ask before they do anything", () => {
  const source = (p: string) => readFileSync(p, "utf8");

  it("/api/match asks for therapist_search before its rate limit and before reading the body", () => {
    const src = source("app/api/match/route.ts");
    const post = src.slice(src.indexOf("export async function POST"));
    const ask = post.indexOf('featureRefusal(req, "therapist_search")');
    expect(ask).toBeGreaterThan(-1);
    expect(ask).toBeLessThan(post.indexOf("checkRateLimit(ip)"));
    expect(ask).toBeLessThan(post.indexOf("await req.json()"));
  });

  it("both explanation routes ask for ai_explain before their rate limit", () => {
    for (const p of ["app/api/explain-match/route.ts", "app/api/explain-recommendation/route.ts"]) {
      const src = source(p);
      const post = src.slice(src.indexOf("export async function POST"));
      const ask = post.indexOf('featureRefusal(req, "ai_explain")');
      expect(ask, p).toBeGreaterThan(-1);
      expect(ask, p).toBeLessThan(post.indexOf("explainRateLimited(req"));
    }
  });
});

// הממשק מסתיר לפי הדגלים. אין כאן רינדור של הדוח (הוא תלוי בניקוד ובמסד), ולכן
// נבדק הדפוס עצמו: שלושת כרטיסי הטיפול, האבחון ואיש המקצוע תלויים בדגלים, כרטיס
// המורה לא, והשער מציב את הערך. ההגנה האמיתית בשרת, בבדיקות שלמעלה.
describe("the report hides what the licence switched off", () => {
  const quiz = readFileSync("app/kids/KidsQuiz.tsx", "utf8");
  const gate = readFileSync("app/school/SchoolGate.tsx", "utf8");
  const count = (text: string, needle: string) => text.split(needle).length - 1;

  it("the three finding cards that open a therapist search or an explanation depend on the flags", () => {
    expect(count(quiz, "onSelect={features.therapist_search ? () => selectGroup(b.key, g) : null}")).toBe(3);
    expect(count(quiz, "onExplain={features.ai_explain ? () => fetchRecExplain(b.key, b.label, g) : undefined}")).toBe(3);
    expect(count(quiz, "siblings.length > 0 && features.therapist_search ? siblings.map")).toBe(3);
    expect(quiz).toContain("{showCombinedT && features.therapist_search && (");
    expect(quiz).toContain("{showCombinedA && features.therapist_search && (");
  });

  it("the no-findings fallback search button depends on the flag too, and an error answer is not shown as an explanation", () => {
    const at = quiz.indexOf("onClick={selectDynamicFallback}");
    expect(at).toBeGreaterThan(-1);
    expect(quiz.slice(Math.max(0, at - 160), at)).toContain("{features.therapist_search && (");
    expect(quiz).toContain('res.ok && typeof data?.explanation === "string" ? data : null');
  });

  it("the teacher cards, which are not part of the flag, keep their search button", () => {
    expect(count(quiz, "onSelect={() => selectGroup(b.key, g)}")).toBe(1);
  });

  it("the top button drops only when it would open a therapist search", () => {
    expect(quiz).toContain('const canSearch = g.kind === "teacher" || features.therapist_search;');
    expect(quiz).toContain("{canSearch && (");
  });

  it("outside the gate the default is everything on, so parents see no change", async () => {
    const { SchoolFeaturesContext } = await import("@/app/school/features");
    expect(readFileSync("app/school/features.tsx", "utf8")).toContain("createContext<SchoolFeatureFlags>(ALL_FEATURES_ON)");
    expect(SchoolFeaturesContext).toBeDefined();
  });

  it("the gate sets the value from the server's answer only for a licensed browser", () => {
    expect(gate).toContain("<SchoolFeaturesContext.Provider value={status.licensed ? (status.features ?? ALL_FEATURES_ON) : ALL_FEATURES_ON}>");
  });
});
