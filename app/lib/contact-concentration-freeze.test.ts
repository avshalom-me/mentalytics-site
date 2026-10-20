import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ConcContact, ConcTherapist } from "./contact-concentration";

// ההקפאה השקטה מריכוז פניות: "בזהירות ובבדיקות כפולות כי זה עניין רגיש"
// (הבעלים, 20/10/26). הבדיקות כאן מוודאות שההקפאה עצמה (applyMatchPause) לא
// נקראת בכלל אלא אם כל התנאים עוברים ברגע הלחיצה. שמות ומזהים בדויים.

const h = vi.hoisted(() => ({
  action: null as null | { id: string; action_type: string; status: string; entity_id: string },
  updates: [] as unknown[],
  // מה תפיסת ההצעה (pending → approved) מחזירה: שורה אחת = תפסנו.
  claimRows: [{ id: "act1" }] as { id: string }[],
  therapists: [] as unknown[],
  contacts: [] as unknown[],
  paidSince: new Map<string, string>(),
  guarantee: (async () => ({ open: false, windowEnd: "2026-08-01T00:00:00Z", contacts: null })) as () => Promise<unknown>,
}));

vi.mock("server-only", () => ({}));
vi.mock("./supabaseAdmin", () => {
  const builder = () => {
    const b: Record<string, unknown> = {};
    b.select = () => b;
    b.eq = () => b;
    b.maybeSingle = async () => ({ data: h.action, error: null });
    b.update = (v: unknown) => {
      h.updates.push(v);
      return b;
    };
    b.then = (resolve: (v: unknown) => unknown) => resolve({ data: h.claimRows, error: null });
    return b;
  };
  return { supabaseAdmin: { from: () => builder() } };
});
vi.mock("./fetch-all-rows", () => ({ fetchAllRows: async () => h.therapists }));
vi.mock("./contact-concentration-data", () => ({
  loadConcentrationInput: async () => ({ contacts: h.contacts, lastPausedAt: new Map(), paidSince: h.paidSince }),
}));
vi.mock("./guarantee", () => ({ guaranteeStateFor: () => h.guarantee() }));
const applyMatchPause = vi.fn(async () => ({ ok: true as const, until: "2026-10-27T12:00:00Z", before: null }));
vi.mock("./match-pause-apply", () => ({ applyMatchPause: (...args: unknown[]) => applyMatchPause(...(args as [])) }));

import { freezeForConcentration, FREEZE_ACTION_TYPE } from "./contact-concentration-freeze";

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
    training_areas: ["CBT"],
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

function contacts(id: string, n: number): ConcContact[] {
  return Array.from({ length: n }, (_, i) => ({
    therapistId: id,
    sessionId: `${id}-${i}`,
    source: "match",
    treatment: "CBT",
    regionGroup: "center",
    ageBand: "31-45",
  }));
}

const quiet = (n: number) => Array.from({ length: n }, (_, i) => therapist(`q${i}`));

beforeEach(() => {
  h.action = { id: "act1", action_type: FREEZE_ACTION_TYPE, status: "pending", entity_id: "hot" };
  h.updates = [];
  h.claimRows = [{ id: "act1" }];
  h.therapists = [therapist("hot"), ...quiet(5)];
  h.contacts = contacts("hot", 5);
  h.paidSince = new Map([["hot", LONG_AGO]]);
  h.guarantee = async () => ({ open: false, windowEnd: "2026-08-01T00:00:00Z", contacts: null });
  applyMatchPause.mockClear();
});

describe("freezing from a queued proposal", () => {
  it("freezes for a week, silently, when every check passes, and closes the proposal", async () => {
    const r = await freezeForConcentration({ therapistId: "hot", actionId: "act1" });
    expect(r.ok).toBe(true);
    expect(applyMatchPause).toHaveBeenCalledTimes(1);
    expect(applyMatchPause.mock.calls[0]).toEqual([expect.objectContaining({ therapistId: "hot", days: 7 })]);
    // קודם נתפסת, ורק אחרי ההקפאה נסגרת כבוצעה.
    expect(h.updates).toEqual([
      expect.objectContaining({ status: "approved" }),
      expect.objectContaining({ status: "executed" }),
    ]);
  });

  it("two clicks at the same moment freeze once: the one that loses the claim stops before any check", async () => {
    h.claimRows = [];
    const r = await freezeForConcentration({ therapistId: "hot", actionId: "act1" });
    expect(r.ok).toBe(false);
    expect(applyMatchPause).not.toHaveBeenCalled();
  });

  it("a rule that no longer holds closes the proposal with the reason, instead of leaving it to be clicked again", async () => {
    h.therapists = [therapist("hot"), ...quiet(2)];
    await freezeForConcentration({ therapistId: "hot", actionId: "act1" });
    expect(h.updates).toEqual([
      expect.objectContaining({ status: "approved" }),
      expect.objectContaining({ status: "dismissed" }),
    ]);
  });

  it("never freezes a center's own listing, even when it is promoted as paid", async () => {
    h.therapists = [therapist("hot", { entity_type: "center" }), ...quiet(5)];
    const r = await freezeForConcentration({ therapistId: "hot", actionId: "act1" });
    expect(r.ok).toBe(false);
    expect(applyMatchPause).not.toHaveBeenCalled();
  });

  it("refuses a proposal that is not waiting any more (double click, old tab)", async () => {
    h.action = { ...h.action!, status: "executed" };
    const r = await freezeForConcentration({ therapistId: "hot", actionId: "act1" });
    expect(r.ok).toBe(false);
    expect(applyMatchPause).not.toHaveBeenCalled();
  });

  it("refuses when the proposal belongs to another therapist", async () => {
    const r = await freezeForConcentration({ therapistId: "q0", actionId: "act1" });
    expect(r.ok).toBe(false);
    expect(applyMatchPause).not.toHaveBeenCalled();
  });

  it("refuses an action that is not a freeze proposal", async () => {
    h.action = { ...h.action!, action_type: "gift_offer" };
    const r = await freezeForConcentration({ therapistId: "hot", actionId: "act1" });
    expect(r.ok).toBe(false);
    expect(applyMatchPause).not.toHaveBeenCalled();
  });

  it("re-checks at the click: alternatives that dropped since the proposal stop the freeze", async () => {
    h.therapists = [therapist("hot"), ...quiet(2)];
    const r = await freezeForConcentration({ therapistId: "hot", actionId: "act1" });
    expect(r.ok).toBe(false);
    expect(applyMatchPause).not.toHaveBeenCalled();
  });

  it("re-checks at the click: someone no longer busy is not frozen", async () => {
    h.contacts = contacts("hot", 2);
    const r = await freezeForConcentration({ therapistId: "hot", actionId: "act1" });
    expect(r.ok).toBe(false);
    expect(applyMatchPause).not.toHaveBeenCalled();
  });

  it("does not freeze a paying therapist inside the contacts guarantee window", async () => {
    h.guarantee = async () => ({ open: true, windowEnd: "2026-11-30T00:00:00Z", contacts: 6 });
    const r = await freezeForConcentration({ therapistId: "hot", actionId: "act1" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("ערבות");
    expect(applyMatchPause).not.toHaveBeenCalled();
  });

  it("does not freeze when the guarantee window cannot be checked", async () => {
    h.guarantee = async () => {
      throw new Error("db down");
    };
    const r = await freezeForConcentration({ therapistId: "hot", actionId: "act1" });
    expect(r.ok).toBe(false);
    expect(applyMatchPause).not.toHaveBeenCalled();
  });
});
