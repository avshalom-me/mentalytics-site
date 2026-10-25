import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OWNER_QUEUE_TASKS_OR, SCHOOL_ENTITY_TYPES } from "./schools-crm";
import {
  BOARD_NOTE_KINDS,
  BRANCH_TASK_TYPES,
  FILE_PATH_RE,
  PLAN_STATUSES,
  PLAN_TRACKS,
  addDays,
  addMonths,
  barGeometry,
  cleanBoardInput,
  cleanPlanInput,
  daysBetween,
  gateProgress,
  isIsoDate,
  isLate,
  positionPct,
  quarterStart,
  reminderDue,
  reminderOpen,
  storageSafeName,
  timeline,
} from "./schools-workspace";

describe("dates", () => {
  it("validates real calendar days only", () => {
    expect(isIsoDate("2026-10-25")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-10-25T10:00")).toBe(false);
    expect(isIsoDate(20261025)).toBe(false);
  });
  it("adds days and months across year ends", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addMonths("2026-11-15", 2)).toBe("2027-01-01");
    expect(addMonths("2027-01-01", -1)).toBe("2026-12-01");
    expect(daysBetween("2026-10-25", "2026-11-11")).toBe(17);
  });
  it("finds the calendar quarter", () => {
    expect(quarterStart("2026-10-25")).toBe("2026-10-01");
    expect(quarterStart("2027-03-31")).toBe("2027-01-01");
  });
});

describe("timeline", () => {
  const t = timeline("2026-10-01", 12);
  it("covers twelve whole months in four quarters", () => {
    expect(t.start).toBe("2026-10-01");
    expect(t.end).toBe("2027-10-01");
    expect(t.months).toHaveLength(12);
    expect(t.months[0].label).toBe("אוקטובר");
    expect(t.quarters.map((q) => q.label)).toEqual(["רבעון 4 · 2026", "רבעון 1 · 2027", "רבעון 2 · 2027", "רבעון 3 · 2027"]);
    expect(t.quarters.reduce((a, q) => a + q.days, 0)).toBe(t.days);
    expect(t.days).toBe(365);
  });
  it("splits a window that starts mid-quarter", () => {
    const n = timeline("2026-11-20", 3);
    expect(n.start).toBe("2026-11-01");
    expect(n.quarters.map((q) => q.days)).toEqual([61, 31]);
  });
  it("places days as a share of the window, clamped", () => {
    expect(positionPct(t, "2026-10-01")).toBe(0);
    expect(positionPct(t, "2027-10-01")).toBe(100);
    expect(positionPct(t, "2025-01-01")).toBe(0);
  });
  it("draws inclusive bars and cuts what runs out of the window", () => {
    const one = barGeometry(t, "2026-11-01", "2026-11-01")!;
    expect(one.widthPct).toBeCloseTo(100 / 365);
    const cut = barGeometry(t, "2026-09-15", "2026-10-10")!;
    expect(cut.cutStart).toBe(true);
    expect(cut.startPct).toBe(0);
    expect(cut.widthPct).toBeCloseTo((10 / 365) * 100);
    expect(barGeometry(t, "2026-01-01", "2026-09-30")).toBeNull();
    expect(barGeometry(t, "2027-10-01", null)).toBeNull();
    const tail = barGeometry(t, "2027-09-20", "2027-12-31")!;
    expect(tail.cutEnd).toBe(true);
    expect(tail.startPct + tail.widthPct).toBeCloseTo(100);
  });
  it("treats an end before the start as a one-day item", () => {
    expect(barGeometry(t, "2026-11-10", "2026-11-01")!.widthPct).toBeCloseTo(100 / 365);
  });
});

describe("plan status", () => {
  it("is late only after the last day, and never when done or dropped", () => {
    const item = { start_date: "2026-10-25", end_date: "2026-11-11", status: "active" as const };
    expect(isLate(item, "2026-11-11")).toBe(false);
    expect(isLate(item, "2026-11-12")).toBe(true);
    expect(isLate({ ...item, status: "done" }, "2026-12-01")).toBe(false);
    expect(isLate({ start_date: "2026-12-26", end_date: null, status: "planned" }, "2026-12-27")).toBe(true);
  });
  it("measures a gate", () => {
    expect(gateProgress(0, 6000)).toEqual({ pct: 0, reached: false, missing: 6000 });
    expect(gateProgress(1500, 6000).pct).toBe(25);
    expect(gateProgress(6000.01, 6000)).toEqual({ pct: 100, reached: true, missing: 0 });
  });
});

describe("cleanPlanInput", () => {
  const base = { title: " שלב ", start_date: "2026-10-25", end_date: "2026-11-11" };
  it("needs a title and a start date to create", () => {
    expect(cleanPlanInput({ start_date: "2026-10-25", end_date: "2026-11-11" }).ok).toBe(false);
    expect(cleanPlanInput({ title: "x", end_date: "2026-11-11" }).ok).toBe(false);
    const c = cleanPlanInput(base);
    expect(c.ok && c.value.title).toBe("שלב");
  });
  it("needs an end date for a phase, not for a milestone", () => {
    expect(cleanPlanInput({ title: "x", start_date: "2026-10-25" })).toEqual({ ok: false, error: "לשלב צריך תאריך סיום" });
    expect(cleanPlanInput({ title: "x", start_date: "2026-10-25", kind: "milestone" }).ok).toBe(true);
    const milestone = { kind: "milestone" as const, title: "x", start_date: "2026-12-26", end_date: null };
    expect(cleanPlanInput({ kind: "phase" }, milestone).ok).toBe(false);
    expect(cleanPlanInput({ end_date: null }, { ...milestone, kind: "phase" as const, end_date: "2026-12-31" }).ok).toBe(false);
  });
  it("rejects unknown vocabulary and reversed dates", () => {
    expect(cleanPlanInput({ ...base, track: "finance" }).ok).toBe(false);
    expect(cleanPlanInput({ ...base, status: "late" }).ok).toBe(false);
    expect(cleanPlanInput({ ...base, end_date: "2026-10-01" }).ok).toBe(false);
  });
  it("keeps a milestone to one day", () => {
    const c = cleanPlanInput({ ...base, kind: "milestone", end_date: "2026-12-01" });
    expect(c.ok && c.value.end_date).toBeNull();
  });
  it("wants a gate whole, and only on a milestone", () => {
    expect(cleanPlanInput({ ...base, kind: "milestone", gate_metric: "received_gross" }).ok).toBe(false);
    expect(cleanPlanInput({ ...base, gate_metric: "received_gross", gate_threshold: 6000 }).ok).toBe(false);
    expect(cleanPlanInput({ ...base, kind: "milestone", gate_metric: "received_gross", gate_threshold: -1 }).ok).toBe(false);
    const c = cleanPlanInput({ ...base, kind: "milestone", gate_metric: "received_gross", gate_threshold: "6000" });
    expect(c.ok && c.value.gate_threshold).toBe(6000);
  });
  it("checks a partial update against what is stored", () => {
    const current = { kind: "phase" as const, title: "שלב", start_date: "2026-11-01", end_date: "2026-11-30", gate_metric: null, gate_threshold: null };
    expect(cleanPlanInput({ start_date: "2026-12-05" }, current).ok).toBe(false);
    const c = cleanPlanInput({ status: "done" }, current);
    expect(c.ok && c.value).toEqual({ status: "done" });
    const gated = { ...current, kind: "milestone" as const, end_date: null, gate_metric: "received_gross" as const, gate_threshold: 6000 };
    expect(cleanPlanInput({ kind: "phase" }, gated).ok).toBe(false);
    expect(cleanPlanInput({ kind: "phase", end_date: "2026-11-30", gate_metric: null, gate_threshold: null }, gated).ok).toBe(true);
  });
});

describe("reminders", () => {
  const note = { remind_at: "2026-10-26T07:00:00.000Z", remind_to: ["נעמה", "אבשלום"], reminder_state: {} };
  const at = (iso: string) => new Date(iso);
  it("pops from its moment on, only to the people it names", () => {
    expect(reminderDue(note, "נעמה", at("2026-10-26T06:59:00Z"))).toBe(false);
    expect(reminderDue(note, "נעמה", at("2026-10-26T07:00:00Z"))).toBe(true);
    expect(reminderDue(note, "עומר", at("2026-10-27T00:00:00Z"))).toBe(false);
  });
  it("compares moments, not strings", () => {
    expect(reminderDue({ ...note, remind_at: "2026-10-26T09:00:00+03:00" }, "נעמה", at("2026-10-26T06:30:00Z"))).toBe(true);
  });
  it("stays closed for whoever closed it, and comes back after a snooze", () => {
    const s = { ...note, reminder_state: { נעמה: { dismissed_at: "2026-10-26T08:00:00Z" }, אבשלום: { snooze_until: "2026-10-26T10:00:00Z" } } };
    expect(reminderDue(s, "נעמה", at("2026-10-27T00:00:00Z"))).toBe(false);
    expect(reminderDue(s, "אבשלום", at("2026-10-26T09:00:00Z"))).toBe(false);
    expect(reminderDue(s, "אבשלום", at("2026-10-26T10:00:00Z"))).toBe(true);
    expect(reminderOpen(s)).toBe(true);
    expect(reminderOpen({ ...s, reminder_state: { ...s.reminder_state, אבשלום: { dismissed_at: "x" } } })).toBe(false);
  });
});

describe("cleanBoardInput", () => {
  it("refuses an empty note and a link without an address", () => {
    expect(cleanBoardInput({ kind: "note", title: " " }).ok).toBe(false);
    expect(cleanBoardInput({ kind: "link", title: "מכרז" }).ok).toBe(false);
    expect(cleanBoardInput({ kind: "link", url: "javascript:alert(1)" }).ok).toBe(false);
    expect(cleanBoardInput({ kind: "link", url: "https://example.org/x" }).ok).toBe(true);
  });
  it("needs someone to remind, and normalises the moment", () => {
    expect(cleanBoardInput({ body: "x", remind_at: "2026-10-26T09:00:00+03:00", remind_to: [] }).ok).toBe(false);
    const c = cleanBoardInput({ body: "x", remind_at: "2026-10-26T09:00:00+03:00", remind_to: ["נעמה", "נעמה", " "] });
    expect(c.ok && c.value.remind_at).toBe("2026-10-26T06:00:00.000Z");
    expect(c.ok && c.value.remind_to).toEqual(["נעמה"]);
  });
  it("clears the recipients when the reminder is removed", () => {
    const c = cleanBoardInput({ remind_at: null, remind_to: ["נעמה"] }, { body: "x", remind_at: "2026-10-26T06:00:00.000Z", remind_to: ["נעמה"] });
    expect(c.ok && c.value).toEqual({ remind_at: null, remind_to: [] });
  });
});

describe("files", () => {
  it("makes a storage-safe name that the server's path rule accepts", () => {
    expect(storageSafeName("טיוטת הסכם.docx")).toBe("file.docx");
    expect(storageSafeName("Flyer v2 (final).PDF")).toBe("Flyer-v2-final.pdf");
    expect(storageSafeName("noext")).toBe("noext");
    const path = `files/2026-10/${"0".repeat(8)}-0000-0000-0000-${"0".repeat(12)}-${storageSafeName("a".repeat(200) + ".jpeg")}`;
    expect(FILE_PATH_RE.test(path)).toBe(true);
    expect(FILE_PATH_RE.test("../secrets/x")).toBe(false);
  });
});

describe("vocabulary matches the migration", () => {
  const sql = readFileSync(join(process.cwd(), "supabase/migrations/20261025_schools_workspace.sql"), "utf8");
  it("lists every track, status and note kind in a check constraint", () => {
    for (const t of PLAN_TRACKS) expect(sql).toContain(`'${t.value}'`);
    for (const s of PLAN_STATUSES) expect(sql).toContain(`'${s.value}'`);
    for (const k of BOARD_NOTE_KINDS) expect(sql).toContain(`'${k.value}'`);
  });
  it("keeps every branch task out of the owner's main queue unless it is his", () => {
    for (const t of BRANCH_TASK_TYPES) expect(t.startsWith("school")).toBe(true);
    expect(OWNER_QUEUE_TASKS_OR).toContain("entity_type.not.like.school*");
    expect(BRANCH_TASK_TYPES.slice(0, SCHOOL_ENTITY_TYPES.length)).toEqual([...SCHOOL_ENTITY_TYPES]);
  });
});
