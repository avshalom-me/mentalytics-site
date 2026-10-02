import { describe, it, expect } from "vitest";
import {
  addDays, daysBetween, israelDate, israelEndOfDay, trialEndFor, extendedTrialEnd,
  trialDaysLeft, trialPhase, planTrialActions, sumitCheckDue, PAY_EMAIL_DAYS_BEFORE_END, type TrialRow,
} from "./teacher-trial";

// המייל הראשון ביום ה-85, המייל השני ביום האחרון, והארכיון למחרת - זה מה
// שהבעלים אישר, וזה מה שהמיילים עצמם מבטיחים למורה.

describe("Israel calendar helpers", () => {
  it("reads the Israeli date across midnight UTC", () => {
    expect(israelDate(new Date("2026-10-02T21:30:00Z"))).toBe("2026-10-03"); // 00:30 בישראל
    expect(israelDate(new Date("2026-10-02T20:30:00Z"))).toBe("2026-10-02");
  });
  it("adds days and counts between dates", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(daysBetween("2026-10-02", "2026-12-31")).toBe(90);
    expect(daysBetween("2026-12-31", "2026-10-02")).toBe(-90);
  });
  it("ends the day at 23:59:59 Israel time, summer and winter", () => {
    expect(israelEndOfDay("2026-07-15").toISOString()).toBe("2026-07-15T20:59:59.000Z"); // קיץ, +3
    expect(israelEndOfDay("2026-12-31").toISOString()).toBe("2026-12-31T21:59:59.000Z"); // חורף, +2
  });
});

describe("the trial window", () => {
  const approved = new Date("2026-10-02T08:00:00Z");
  const end = trialEndFor(approved).toISOString();

  it("runs 90 Israeli days from the approval and ends at the end of that day", () => {
    expect(israelDate(new Date(end))).toBe("2026-12-31");
    expect(trialDaysLeft(end, approved)).toBe(90);
  });
  it("stays free until day 85, then closing, then last day, then ended", () => {
    expect(PAY_EMAIL_DAYS_BEFORE_END).toBe(5);
    expect(trialPhase(end, new Date("2026-12-25T10:00:00Z"))).toBe("free"); // 6 ימים לסוף
    expect(trialPhase(end, new Date("2026-12-26T10:00:00Z"))).toBe("closing"); // יום 85
    expect(trialPhase(end, new Date("2026-12-30T10:00:00Z"))).toBe("closing");
    expect(trialPhase(end, new Date("2026-12-31T10:00:00Z"))).toBe("last_day");
    expect(trialPhase(end, new Date("2027-01-01T06:20:00Z"))).toBe("ended");
    expect(trialPhase(null)).toBeNull();
  });
  it("extends from the current end, or from today once it has passed", () => {
    expect(israelDate(extendedTrialEnd(end, 30, new Date("2026-12-01T10:00:00Z")))).toBe("2027-01-30");
    expect(israelDate(extendedTrialEnd(end, 30, new Date("2027-02-01T10:00:00Z")))).toBe("2027-03-03");
    expect(israelDate(extendedTrialEnd(null, 14, new Date("2026-10-02T10:00:00Z")))).toBe("2026-10-16");
  });
});

describe("what the daily run does", () => {
  const end = trialEndFor(new Date("2026-10-02T08:00:00Z")).toISOString();
  const row = (over: Partial<TrialRow> = {}): TrialRow => ({
    id: "t1", listing_state: "trial", trial_ends_at: end,
    trial_ending_notified_at: null, trial_last_day_notified_at: null, hasActiveSubscription: false, ...over,
  });
  const at = (iso: string) => new Date(iso);

  it("asks for nothing before day 85", () => {
    expect(planTrialActions([row()], at("2026-12-25T06:20:00Z"))).toEqual([]);
  });
  it("sends the sign-up email on day 85, once", () => {
    expect(planTrialActions([row()], at("2026-12-26T06:20:00Z"))).toEqual([{ kind: "pay_email", id: "t1" }]);
    expect(planTrialActions([row({ trial_ending_notified_at: "2026-12-26T06:21:00Z" })], at("2026-12-27T06:20:00Z"))).toEqual([]);
  });
  it("catches up if the run was missed on day 85", () => {
    expect(planTrialActions([row()], at("2026-12-29T06:20:00Z"))).toEqual([{ kind: "pay_email", id: "t1" }]);
  });
  it("sends the second email on the last day, and only then archives - the next morning", () => {
    const notified = row({ trial_ending_notified_at: "2026-12-26T06:21:00Z" });
    expect(planTrialActions([notified], at("2026-12-31T06:20:00Z"))).toEqual([{ kind: "last_day_email", id: "t1", moveEndToToday: false }]);
    // אותו יום, ריצה שנייה אחרי שהמייל יצא: כלום. הארכיון רק למחרת.
    const both = row({ trial_ending_notified_at: "2026-12-26T06:21:00Z", trial_last_day_notified_at: "2026-12-31T06:21:00Z" });
    expect(planTrialActions([both], at("2026-12-31T18:00:00Z"))).toEqual([]);
    expect(planTrialActions([both], at("2027-01-01T06:20:00Z"))).toEqual([{ kind: "archive", id: "t1", withoutLastDayEmail: false }]);
  });
  it("never archives before the last-day email; a missed last day moves the end to today", () => {
    const notified = row({ trial_ending_notified_at: "2026-12-26T06:21:00Z" });
    expect(planTrialActions([notified], at("2027-01-01T06:20:00Z"))).toEqual([{ kind: "last_day_email", id: "t1", moveEndToToday: true }]);
    expect(planTrialActions([notified], at("2027-01-02T06:20:00Z"))).toEqual([{ kind: "last_day_email", id: "t1", moveEndToToday: true }]);
    // שלושה ימים שהמייל לא יוצא: ארכיון בכל זאת, מסומן לדיווח.
    expect(planTrialActions([notified], at("2027-01-03T06:20:00Z"))).toEqual([{ kind: "archive", id: "t1", withoutLastDayEmail: true }]);
  });
  it("leaves alone a teacher who signed up for payment, and anyone not in trial", () => {
    const late = at("2027-01-05T06:20:00Z");
    expect(planTrialActions([row({ hasActiveSubscription: true })], late)).toEqual([]);
    for (const s of ["pending", "paying", "archived", "rejected"]) expect(planTrialActions([row({ listing_state: s })], late)).toEqual([]);
    expect(planTrialActions([row({ trial_ends_at: null })], late)).toEqual([]);
  });
});

describe("when a standing order is verified against Sumit", () => {
  it("three days after each monthly charge, once", () => {
    const first = "2026-12-31";
    expect(sumitCheckDue(first, null, new Date("2027-01-02T08:00:00Z"))).toBe(false); // יומיים אחרי
    expect(sumitCheckDue(first, null, new Date("2027-01-03T08:00:00Z"))).toBe(true);
    expect(sumitCheckDue(first, "2027-01-03T08:01:00Z", new Date("2027-01-20T08:00:00Z"))).toBe(false);
    // החיוב של 31 בינואר, ואז של סוף פברואר (אין 31 בפברואר)
    expect(sumitCheckDue(first, "2027-01-03T08:01:00Z", new Date("2027-02-03T08:00:00Z"))).toBe(true);
    expect(sumitCheckDue(first, "2027-02-03T08:01:00Z", new Date("2027-03-02T08:00:00Z"))).toBe(false);
    expect(sumitCheckDue(first, "2027-02-03T08:01:00Z", new Date("2027-03-03T08:00:00Z"))).toBe(true);
  });
  it("not before the first charge, and monthly when there is no charge date", () => {
    expect(sumitCheckDue("2026-12-31", null, new Date("2026-12-20T08:00:00Z"))).toBe(false);
    expect(sumitCheckDue(null, null, new Date("2026-12-20T08:00:00Z"))).toBe(true);
    expect(sumitCheckDue(null, "2026-12-01T08:00:00Z", new Date("2026-12-20T08:00:00Z"))).toBe(false);
    expect(sumitCheckDue(null, "2026-11-01T08:00:00Z", new Date("2026-12-20T08:00:00Z"))).toBe(true);
  });
});
