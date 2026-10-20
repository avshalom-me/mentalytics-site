import { describe, it, expect } from "vitest";
import {
  analyzeConcentration,
  isConcentrated,
  workRegions,
  FREEZE_MIN_ALTERNATIVES,
  FREEZE_MIN_MATCH_PEOPLE,
  FREEZE_MIN_TENURE_DAYS,
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
    assessment_types: [],
    couples_modalities: [],
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
  // משלם/ת מאז יוני: הקידום בתשלום ארוך מ-60 יום.
  const paidSince = new Map([["hot", LONG_AGO]]);
  const base = { contacts: contacts("hot", 5), now: NOW, paidSince };

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
    const r = analyzeConcentration({
      ...base,
      contacts: [...base.contacts, ...contacts("busy2", 4)],
      therapists: [therapist("hot"), ...others],
    });
    const hot = r.freeze.find((f) => f.id === "hot")!;
    expect(hot.safe).toBe(false);
    expect(hot.weakest?.alternatives).toBe(FREEZE_MIN_ALTERNATIVES - 1);
  });

  it("checks alternatives for the ages that actually contacted: children are not covered by adults-only therapists", () => {
    const r = analyzeConcentration({
      ...base,
      contacts: contacts("hot", 5, "CBT", "match", { ageBand: "child" }),
      therapists: [therapist("hot", { age_groups: ["ילדים", "מבוגרים"] }), ...quiet(5)],
    });
    expect(r.freeze[0].safe).toBe(false);
    expect(r.freeze[0].blockedReason).toContain("(ילדים)");
  });

  it("follows the manual freeze rules: no centers and no invitation route before the first charge", () => {
    const center = analyzeConcentration({ ...base, therapists: [therapist("hot", { promotion_source: "center" }), ...quiet(5)] });
    expect(center.freeze[0].safe).toBe(false);
    const gift = analyzeConcentration({ ...base, therapists: [therapist("hot", { promotion_source: "gift_trial" }), ...quiet(5)] });
    expect(gift.freeze[0].safe).toBe(false);
  });

  // "עברו לפחות 60 יום מקידום ממומן" (הבעלים, 20/10/26).
  it(`does not freeze before ${FREEZE_MIN_TENURE_DAYS} days of promotion`, () => {
    const r = analyzeConcentration({
      ...base,
      therapists: [therapist("hot", { promoted_since: "2026-09-01T00:00:00Z" }), ...quiet(5)],
    });
    expect(r.freeze[0].safe).toBe(false);
    expect(r.freeze[0].blockedReason).toContain(String(FREEZE_MIN_TENURE_DAYS));
  });

  it("for a paying therapist, counts the 60 days from the start of paying, not from an earlier free promotion", () => {
    const r = analyzeConcentration({
      ...base,
      paidSince: new Map([["hot", "2026-09-10T00:00:00Z"]]),
      therapists: [therapist("hot"), ...quiet(5)],
    });
    expect(r.freeze[0].safe).toBe(false);
    expect(r.freeze[0].blockedReason).toContain("בתשלום");
  });

  it("does not freeze a paying therapist whose subscription cannot be found", () => {
    const r = analyzeConcentration({ ...base, paidSince: new Map(), therapists: [therapist("hot"), ...quiet(5)] });
    expect(r.freeze[0].safe).toBe(false);
  });

  it("does not count as an alternative someone whose 'accepting new patients' is not set - the quiz shows only true", () => {
    const r = analyzeConcentration({
      ...base,
      therapists: [therapist("hot"), ...quiet(3), therapist("unset", { accepting_new_patients: null })],
    });
    expect(r.freeze[0].safe).toBe(false);
    expect(r.freeze[0].weakest?.alternatives).toBe(3);
  });

  it("checks the online patients of a therapist who also has a clinic", () => {
    const mixed = [...contacts("hot", 2), ...contacts("hot", 3, "CBT", "match", { regionGroup: "online" }).map((c, i) => ({ ...c, sessionId: `o${i}` }))];
    const r = analyzeConcentration({
      ...base,
      contacts: mixed,
      // חמש חלופות בקליניקה בגוש דן, אף אחת לא אונליין.
      therapists: [therapist("hot", { online: true }), ...quiet(5)],
    });
    expect(r.freeze[0].safe).toBe(false);
    expect(r.freeze[0].blockedReason).toContain("אונליין");
  });

  it("does not freeze when a quiz contact cannot be tied to what the patient searched or where", () => {
    const r = analyzeConcentration({
      ...base,
      contacts: [...contacts("hot", 4), { therapistId: "hot", sessionId: "x", source: "match", treatment: null, regionGroup: null, ageBand: null }],
      therapists: [therapist("hot"), ...quiet(5)],
    });
    expect(r.freeze[0].safe).toBe(false);
    expect(r.freeze[0].blockedReason).toContain("בלי נתון מלא");
  });

  it("checks each child age group separately: therapists for teens are not alternatives for toddlers", () => {
    const r = analyzeConcentration({
      ...base,
      contacts: contacts("hot", 5, "CBT", "match", { ageBand: "child" }),
      therapists: [therapist("hot", { age_groups: ["גיל הרך", "נוער"] }), ...quiet(5, { age_groups: ["נוער"] })],
    });
    expect(r.freeze[0].safe).toBe(false);
    expect(r.freeze[0].blockedReason).toContain("גיל הרך");
  });

  it("a contact with no age band makes every age group of the therapist count", () => {
    const r = analyzeConcentration({
      ...base,
      contacts: contacts("hot", 5, "CBT", "match", { ageBand: null }),
      therapists: [therapist("hot", { age_groups: ["ילדים", "מבוגרים"] }), ...quiet(5)],
    });
    expect(r.freeze[0].safe).toBe(false);
    expect(r.freeze[0].blockedReason).toContain("ילדים");
  });

  it("never freezes a center's own listing", () => {
    const r = analyzeConcentration({ ...base, therapists: [therapist("hot", { entity_type: "center" }), ...quiet(5)] });
    expect(r.freeze[0].safe).toBe(false);
  });

  it("keeps the 28-day cooldown even when the freeze is missing from the audit log", () => {
    const r = analyzeConcentration({
      ...base,
      therapists: [therapist("hot", { match_paused_until: "2026-10-10T00:00:00Z" }), ...quiet(5)],
    });
    expect(r.freeze[0].safe).toBe(false);
    expect(r.freeze[0].blockedReason).toContain("הקפאה קודמת");
  });

  it("counts expertise the way the match engine does, including assessment types", () => {
    const r = analyzeConcentration({
      ...base,
      contacts: contacts("hot", 5, "פסיכו-דידקטי"),
      therapists: [
        therapist("hot", { training_areas: [], assessment_types: ["פסיכו-דידקטי"] }),
        ...quiet(5, { training_areas: [], assessment_types: ["פסיכו-דידקטי"] }),
      ],
    });
    expect(r.freeze[0].safe).toBe(true);
  });

  // "בקידום מתנה לא לעשות את ההקפאה הזו. רק מטפל בתשלום" (הבעלים, 20/10/26).
  it("never proposes freezing a gift promotion, however long and however busy", () => {
    for (const source of ["trial", "manual"]) {
      const r = analyzeConcentration({
        ...base,
        therapists: [therapist("hot", { promotion_source: source }), ...quiet(5)],
      });
      expect(r.freeze[0].safe).toBe(false);
      expect(r.freeze[0].blockedReason).toContain("בתשלום");
    }
  });

  it("does not freeze again within four weeks of the last freeze", () => {
    const r = analyzeConcentration({
      ...base,
      therapists: [therapist("hot"), ...quiet(5)],
      lastPausedAt: new Map([["hot", "2026-10-01T10:00:00Z"]]),
    });
    expect(r.freeze[0].safe).toBe(false);
  });

  // "לפחות 3 מהפונים הגיעו מהשאלון" (הבעלים, 20/10/26).
  it(`needs at least ${FREEZE_MIN_MATCH_PEOPLE} people from the quiz - the freeze moves only those`, () => {
    const viaProfile = contacts("hot", 3, "CBT", "profile").map((c, i) => ({ ...c, sessionId: `p${i}` }));
    const two = analyzeConcentration({
      ...base,
      contacts: [...contacts("hot", FREEZE_MIN_MATCH_PEOPLE - 1), ...viaProfile],
      therapists: [therapist("hot"), ...quiet(5)],
    });
    expect(two.freeze[0].safe).toBe(false);
    expect(two.freeze[0].blockedReason).toContain("השאלון");
    const three = analyzeConcentration({
      ...base,
      contacts: [...contacts("hot", FREEZE_MIN_MATCH_PEOPLE), ...viaProfile],
      therapists: [therapist("hot"), ...quiet(5)],
    });
    expect(three.freeze[0].safe).toBe(true);
  });
});
