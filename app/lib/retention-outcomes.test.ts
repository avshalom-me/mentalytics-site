import { describe, expect, it } from "vitest";
import { computeOutcomes, summarizeOutcomes, type ContactEvent, type ExecutedAction } from "./retention-outcomes";

const NOW = new Date("2026-11-20T08:00:00Z");
const d = (daysFromNow: number) => new Date(NOW.getTime() + daysFromNow * 86_400_000).toISOString();

const action = (id: string, type: string, daysAgo: number, therapist = "t1"): ExecutedAction => ({
  id, action_type: type, therapist_id: therapist, entity_label: "דנה", executed_at: d(-daysAgo), resolution_note: null,
});
const contact = (therapist: string, sid: string, daysAgo: number): ContactEvent => ({ therapist_id: therapist, sid, at: d(-daysAgo) });

describe("computeOutcomes", () => {
  it("counts people before and after, and calls a rise a recovery", () => {
    const out = computeOutcomes(
      [action("a", "retention_email", 20)],
      [contact("t1", "s1", 25), contact("t1", "s2", 10), contact("t1", "s2", 9), contact("t1", "s3", 8)],
      new Map([["t1", { status: "paying", promotion_source: "paid", profile_updated_at: null }]]),
      NOW,
    );
    expect(out[0].before14).toBe(1);
    expect(out[0].after14).toBe(2); // s2 once, s3 once - repeat presses of s2 count as one person
    expect(out[0].after28).toBeNull(); // only 20 days passed
    expect(out[0].verdict).toBe("recovered");
  });

  it("is too early before 14 days, and notices a profile edit without contacts", () => {
    const states = new Map([["t1", { status: "paying", promotion_source: "trial", profile_updated_at: d(-5) }]]);
    const early = computeOutcomes([action("a", "retention_email", 7)], [], states, NOW);
    expect(early[0].verdict).toBe("too_early");
    const edited = computeOutcomes([action("a", "retention_email", 15)], [], states, NOW);
    expect(edited[0].verdict).toBe("edited");
  });

  it("a therapist who is no longer promoted counts as left, whatever the contacts", () => {
    const out = computeOutcomes(
      [action("a", "retention_task", 30)],
      [contact("t1", "x", 5)],
      new Map([["t1", { status: "approved", promotion_source: null, profile_updated_at: null }]]),
      NOW,
    );
    expect(out[0].verdict).toBe("left");
    expect(out[0].after28).toBe(1);
  });

  it("summarises per action type over the measurable rows only", () => {
    const rows = computeOutcomes(
      [action("a", "retention_email", 20, "t1"), action("b", "retention_email", 3, "t2"), action("c", "retention_freeze", 20, "t3")],
      [contact("t1", "s", 10)],
      new Map([
        ["t1", { status: "paying", promotion_source: "paid", profile_updated_at: null }],
        ["t2", { status: "paying", promotion_source: "paid", profile_updated_at: null }],
        ["t3", { status: "paying", promotion_source: "trial", profile_updated_at: null }],
      ]),
      NOW,
    );
    const s = summarizeOutcomes(rows);
    expect(s[0]).toEqual({ action_type: "retention_email", total: 2, measured: 1, recovered: 1, edited: 0, left: 0 });
    expect(s[1]).toEqual({ action_type: "retention_freeze", total: 1, measured: 1, recovered: 0, edited: 0, left: 0 });
  });
});
