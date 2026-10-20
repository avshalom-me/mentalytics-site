import { describe, it, expect } from "vitest";
import {
  analyzeConcentration,
  isConcentrated,
  workRegions,
  FREEZE_MIN_ALTERNATIVES,
  HOT_MIN_PEOPLE,
  ONLINE_REGION,
  type ConcContact,
  type ConcTherapist,
} from "./contact-concentration";

// שמות ומזהים בדויים - הריפו ציבורי.
const NOW = new Date("2026-10-20T12:00:00Z");
const LONG_AGO = "2026-06-01T00:00:00Z";

function therapist(id: string, over: Partial<ConcTherapist> = {}): ConcTherapist {
  return {
    id,
    full_name: `מטפל ${id}`,
    status: "paying",
    promotion_source: "paid",
    entity_type: "therapist",
    regions: ["תל אביב"],
    online: false,
    training_areas: ["CBT", "טיפול דינאמי"],
    age_groups: ["מבוגרים"],
    admin_approved: true,
    accepting_new_patients: true,
    match_paused_until: null,
    promoted_since: LONG_AGO,
    ...over,
  };
}

/** n פונים שונים למטפל, כולם מהשאלון, מבוגרים מאזור המרכז, על אותו טיפול. */
function contacts(
  therapistId: string,
  n: number,
  treatment: string | null = "CBT",
  source = "match",
  over: Partial<ConcContact> = {}
): ConcContact[] {
  return Array.from({ length: n }, (_, i) => ({
    therapistId,
    sessionId: `${therapistId}-s${i}`,
    source,
    treatment,
    regionGroup: treatment ? "center" : null,
    ageBand: treatment ? "18-30" : null,
    ...over,
  }));
}

/** מטפלים פעילים נוספים באותו אזור ותחום, בלי פניות. */
function quiet(n: number, over: Partial<ConcTherapist> = {}): ConcTherapist[] {
  return Array.from({ length: n }, (_, i) => therapist(`q${i}`, over));
}

describe("who counts as receiving many contacts", () => {
  it("is a person, not a click: the same visitor clicking twice is one", () => {
    const twice: ConcContact[] = [
      ...contacts("hot", HOT_MIN_PEOPLE - 1),
      { therapistId: "hot", sessionId: "hot-s0", source: "profile", treatment: null, regionGroup: null, ageBand: null },
    ];
    const r = analyzeConcentration({ contacts: twice, therapists: [therapist("hot")], now: NOW });
    expect(r.hot).toHaveLength(0);
  });

  it(`starts at ${HOT_MIN_PEOPLE} people in the window ("more than 3 in two weeks")`, () => {
    const r = analyzeConcentration({ contacts: contacts("hot", HOT_MIN_PEOPLE), therapists: [therapist("hot")], now: NOW });
    expect(r.hot.map((h) => h.id)).toEqual(["hot"]);
    expect(r.hot[0].matchPeople).toBe(HOT_MIN_PEOPLE);
  });

  it("only promoted therapists count - a free profile is not in the matches at all", () => {
    const r = analyzeConcentration({
      contacts: contacts("free", 6),
      therapists: [therapist("free", { status: "approved", promotion_source: null })],
      now: NOW,
    });
    expect(r.hot).toHaveLength(0);
  });
});

describe("a slice where a few therapists take most of the contacts", () => {
  it("is concentrated when one busy therapist takes the CBT seekers of the area", () => {
    const r = analyzeConcentration({
      contacts: contacts("hot", 5),
      therapists: [therapist("hot"), ...quiet(2)],
      now: NOW,
    });
    const slice = r.slices.find((s) => s.region === "גוש דן" && s.treatment === "cbt");
    expect(slice).toBeDefined();
    expect(slice!.hotPeople).toBe(5);
    expect(slice!.covering).toBe(3);
    expect(slice!.idle).toBe(2);
    expect(isConcentrated(slice!)).toBe(true);
  });

  it("is not concentrated when more than three therapists are busy - the demand is already spread", () => {
    const busy = ["a", "b", "c", "d"];
    const r = analyzeConcentration({
      contacts: busy.flatMap((id) => contacts(id, 4)),
      therapists: busy.map((id) => therapist(id)),
      now: NOW,
    });
    const slice = r.slices.find((s) => s.treatment === "cbt")!;
    expect(slice.hot).toHaveLength(4);
    expect(isConcentrated(slice)).toBe(false);
  });

  it("is not concentrated on one or two seekers of that treatment - that is chance, not a pattern", () => {
    const mixed = [...contacts("hot", 2, "CBT"), ...contacts("hot", 3, null, "profile").map((c, i) => ({ ...c, sessionId: `p${i}` }))];
    const r = analyzeConcentration({ contacts: mixed, therapists: [therapist("hot")], now: NOW });
    const slice = r.slices.find((s) => s.treatment === "cbt")!;
    expect(slice.slicePeople).toBe(2);
    expect(isConcentrated(slice)).toBe(false);
  });

  it("splits a combined request into its parts, and only into parts the therapist does", () => {
    const r = analyzeConcentration({
      contacts: contacts("hot", 4, "CBT + טיפול באמנות"),
      therapists: [therapist("hot")],
      now: NOW,
    });
    expect(r.slices.map((s) => s.treatment)).toEqual(["cbt"]);
  });

  it("an online-only therapist is measured against other therapists who work online", () => {
    expect(workRegions({ regions: [], online: true })).toEqual([ONLINE_REGION]);
    const r = analyzeConcentration({
      contacts: contacts("hot", 4, "CBT", "match", { regionGroup: "online" }),
      therapists: [therapist("hot", { regions: [], online: true }), therapist("o1", { regions: ["חיפה"], online: true })],
      now: NOW,
    });
    const slice = r.slices.find((s) => s.region === ONLINE_REGION)!;
    expect(slice.covering).toBe(2);
  });
});

describe("where the contacts actually came from", () => {
  it("counts a contact only in the region the patient searched, not in every region the therapist lists", () => {
    const r = analyzeConcentration({
      contacts: contacts("hot", 5),
      therapists: [therapist("hot", { regions: ["תל אביב", "ירושלים"] })],
      now: NOW,
    });
    expect(r.slices.map((s) => s.region)).toEqual(["גוש דן"]);
  });

  it("a contact without a known region makes no regional slice", () => {
    const r = analyzeConcentration({
      contacts: contacts("hot", 5, "CBT", "match", { regionGroup: null }),
      therapists: [therapist("hot")],
      now: NOW,
    });
    expect(r.hot).toHaveLength(1);
    expect(r.slices).toHaveLength(0);
  });
});

describe("whether a one-week freeze is safe", () => {
  const base = { contacts: contacts("hot", 5), now: NOW };

  it(`is safe when at least ${FREEZE_MIN_ALTERNATIVES} other active therapists cover the same area, treatment and age`, () => {
    const r = analyzeConcentration({ ...base, therapists: [therapist("hot"), ...quiet(FREEZE_MIN_ALTERNATIVES)] });
    expect(r.freeze[0]).toMatchObject({ id: "hot", safe: true, blockedReason: null });
    expect(r.freeze[0].weakest?.alternatives).toBe(FREEZE_MIN_ALTERNATIVES);
  });

  it("is not safe with fewer alternatives, and says where the gap is", () => {
    const r = analyzeConcentration({ ...base, therapists: [therapist("hot"), ...quiet(FREEZE_MIN_ALTERNATIVES - 1)] });
    expect(r.freeze[0].safe).toBe(false);
    expect(r.freeze[0].blockedReason).toContain("גוש דן");
  });

  it("does not count as alternatives: other busy therapists, frozen ones, a different age group", () => {
    const others = [
      therapist("busy2"),
      therapist("frozen", { match_paused_until: "2026-10-25T00:00:00Z" }),
      therapist("kids", { age_groups: ["ילדים"] }),
      ...quiet(FREEZE_MIN_ALTERNATIVES - 1),
    ];
    const r = analyzeConcentration({ contacts: [...base.contacts, ...contacts("busy2", 4)], therapists: [therapist("hot"), ...others], now: NOW });
    const hot = r.freeze.find((f) => f.id === "hot")!;
    expect(hot.safe).toBe(false);
    expect(hot.weakest?.alternatives).toBe(FREEZE_MIN_ALTERNATIVES - 1);
  });

  it("checks alternatives for the ages that actually contacted: children are not covered by adults-only therapists", () => {
    const kids = contacts("hot", 5, "CBT", "match", { ageBand: "child" });
    const r = analyzeConcentration({
      contacts: kids,
      therapists: [therapist("hot", { age_groups: ["ילדים", "מבוגרים"] }), ...quiet(5)],
      now: NOW,
    });
    expect(r.freeze[0].safe).toBe(false);
    expect(r.freeze[0].blockedReason).toContain("ילדים ונוער");
  });

  it("follows the manual freeze rules: no centers and no invitation route before the first charge", () => {
    const center = analyzeConcentration({ ...base, therapists: [therapist("hot", { promotion_source: "center" }), ...quiet(5)] });
    expect(center.freeze[0].safe).toBe(false);
    const gift = analyzeConcentration({ ...base, therapists: [therapist("hot", { promotion_source: "gift_trial" }), ...quiet(5)] });
    expect(gift.freeze[0].safe).toBe(false);
  });

  it("does not freeze in the first month of promotion", () => {
    const r = analyzeConcentration({
      ...base,
      therapists: [therapist("hot", { promoted_since: "2026-10-08T00:00:00Z" }), ...quiet(5)],
    });
    expect(r.freeze[0].safe).toBe(false);
    expect(r.freeze[0].blockedReason).toContain("30");
  });

  it("does not freeze again within four weeks of the last freeze", () => {
    const r = analyzeConcentration({
      ...base,
      therapists: [therapist("hot"), ...quiet(5)],
      lastPausedAt: new Map([["hot", "2026-10-01T10:00:00Z"]]),
    });
    expect(r.freeze[0].safe).toBe(false);
  });

  it("does not freeze someone whose contacts come mostly outside the matches - the freeze would not move them", () => {
    const r = analyzeConcentration({
      contacts: [...contacts("hot", 1), ...contacts("hot", 4, "CBT", "profile").map((c, i) => ({ ...c, sessionId: `p${i}` }))],
      therapists: [therapist("hot"), ...quiet(5)],
      now: NOW,
    });
    expect(r.freeze[0].safe).toBe(false);
    expect(r.freeze[0].blockedReason).toContain("השאלון");
  });
});
