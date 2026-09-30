import { describe, it, expect } from "vitest";
import { canPauseFromMatching, guaranteePauseBlock, inboxPauseContext, pauseSourceBlock } from "./match-pause";

const t = (status: string | null, promotion_source: string | null) => ({ status, promotion_source });

describe("who can be paused from the questionnaire results", () => {
  it("gift promotions, as before, and now private payers too", () => {
    expect(canPauseFromMatching(t("paying", "trial"))).toBe(true);
    expect(canPauseFromMatching(t("paying", "manual"))).toBe(true);
    expect(canPauseFromMatching(t("paying", "paid"))).toBe(true);
  });

  it("not centre therapists, not the invitation track before its first charge, not the unpromoted", () => {
    expect(canPauseFromMatching(t("paying", "center"))).toBe(false);
    expect(canPauseFromMatching(t("paying", "gift_trial"))).toBe(false);
    expect(canPauseFromMatching(t("paying", null))).toBe(false);
    // A promotion that ended leaves the source behind; there is nothing to pause.
    expect(canPauseFromMatching(t("approved", "trial"))).toBe(false);
    expect(canPauseFromMatching(t("approved", "paid"))).toBe(false);
    expect(canPauseFromMatching(t(null, null))).toBe(false);
  });

  it("explains a refusal in words that fit the case, and says nothing when allowed", () => {
    expect(pauseSourceBlock(t("paying", "paid"))).toBeNull();
    expect(pauseSourceBlock(t("paying", "trial"))).toBeNull();
    expect(pauseSourceBlock(t("paying", "center"))).toMatch(/מרכז/);
    expect(pauseSourceBlock(t("paying", "gift_trial"))).toMatch(/מסלול ההזמנה/);
    expect(pauseSourceBlock(t("approved", null))).toMatch(/לא מקודם/);
    expect(pauseSourceBlock(t("approved", "center"))).toMatch(/לא מקודם/);
  });
});

describe("the refund guarantee, for a private payer", () => {
  // 23:30 in Israel on 29 Nov is already 30 Nov - the date shown must be Israel's.
  const windowEnd = "2026-11-29T22:30:00Z";

  it("blocks a pause while the window is open and no inquiry has arrived", () => {
    const msg = guaranteePauseBlock({ open: true, windowEnd, contacts: 0 });
    expect(msg).toMatch(/ערבות הפניות/);
    expect(msg).toContain("30.11.2026");
    expect(msg).toMatch(/אחרי הפנייה הראשונה/);
  });

  it("treats an uncounted open window as no inquiries - when unsure, do not pause", () => {
    expect(guaranteePauseBlock({ open: true, windowEnd, contacts: null })).not.toBeNull();
  });

  it("allows it once one inquiry arrived - the guarantee is already met", () => {
    expect(guaranteePauseBlock({ open: true, windowEnd, contacts: 1 })).toBeNull();
    expect(guaranteePauseBlock({ open: true, windowEnd, contacts: 14 })).toBeNull();
  });

  it("allows it after the window closed, and when the guarantee does not apply at all", () => {
    expect(guaranteePauseBlock({ open: false, windowEnd, contacts: null })).toBeNull();
    expect(guaranteePauseBlock({ open: false, windowEnd, contacts: 0 })).toBeNull();
    expect(guaranteePauseBlock(null)).toBeNull();
  });
});

// The inbox agent drafts replies with an LLM. Until 30/9/26 it was told "paused
// from matching at their request" - one question about fewer inquiries away
// from a draft that says so. The pause must never reach the prompt.
describe("what the inbox agent is told about a pause", () => {
  const now = new Date("2026-10-01T09:00:00Z");

  it("gives the model a neutral instruction with no trace of the pause, and the admin the fact", () => {
    const ctx = inboxPauseContext("2026-10-14T21:30:00Z", now);
    expect(ctx).not.toBeNull();
    expect(ctx!.promptLine).not.toMatch(/הקפא|מוקפא|השהי|מושהה|pause|freeze/i);
    expect(ctx!.promptLine).not.toContain("15.10.2026");
    expect(ctx!.promptLine).toContain("[להשלים");
    // Israel date of 21:30Z on 14/10 is 15/10.
    expect(ctx!.adminNote).toContain("15.10.2026");
    expect(ctx!.adminNote).toMatch(/לא לציין/);
  });

  it("says nothing when there is no pause, or it already ended", () => {
    expect(inboxPauseContext(null, now)).toBeNull();
    expect(inboxPauseContext(undefined, now)).toBeNull();
    expect(inboxPauseContext("2026-09-20T00:00:00Z", now)).toBeNull();
    expect(inboxPauseContext(now.toISOString(), now)).toBeNull();
  });
});
