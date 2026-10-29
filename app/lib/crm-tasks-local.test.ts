import { describe, it, expect } from "vitest";
import { applyTaskPatch, insertTask, removeTask, sortOpen, type LocalTask } from "./crm-tasks-local";

const NOW = "2026-10-29T12:00:00.000Z";

function task(id: string, over: Partial<LocalTask> = {}): LocalTask {
  return {
    id,
    status: "open",
    due_date: null,
    snoozed_until: null,
    created_at: "2026-10-20T10:00:00.000Z",
    completed_at: null,
    completion_note: null,
    title: `משימה ${id}`,
    ...over,
  };
}

describe("sortOpen", () => {
  it("orders like the server: due date first (no date last), then newest first", () => {
    const sorted = sortOpen([
      task("nodate", { created_at: "2026-10-28T00:00:00Z" }),
      task("late", { due_date: "2026-11-05" }),
      task("soon-old", { due_date: "2026-11-01", created_at: "2026-10-01T00:00:00Z" }),
      task("soon-new", { due_date: "2026-11-01", created_at: "2026-10-27T00:00:00Z" }),
    ]);
    expect(sorted.map((t) => t.id)).toEqual(["soon-new", "soon-old", "late", "nodate"]);
  });
});

describe("applyTaskPatch", () => {
  const lists = { open: [task("a", { due_date: "2026-11-01" }), task("b")], done: [task("z", { status: "done", completed_at: "2026-10-01T00:00:00Z", created_at: "2026-10-25T00:00:00Z" })] };

  it("marking done moves the task to the top of the done list with a completion stamp", () => {
    const next = applyTaskPatch(lists, "a", { status: "done", completion_note: "נסגר" }, NOW);
    expect(next.open.map((t) => t.id)).toEqual(["b"]);
    expect(next.done.map((t) => t.id)).toEqual(["a", "z"]);
    expect(next.done[0]).toMatchObject({ status: "done", completed_at: NOW, completion_note: "נסגר" });
  });

  it("reopening brings it back among the open tasks in order, and clears the completion fields", () => {
    const next = applyTaskPatch(lists, "z", { status: "open" }, NOW);
    expect(next.done).toEqual([]);
    expect(next.open.map((t) => t.id)).toEqual(["a", "z", "b"]);
    expect(next.open[1]).toMatchObject({ completed_at: null, completion_note: null });
  });

  it("a snooze or an assignee change keeps the task open and re-sorts", () => {
    const next = applyTaskPatch(lists, "b", { due_date: "2026-10-30" }, NOW);
    expect(next.open.map((t) => t.id)).toEqual(["b", "a"]);
    expect(next.done).toHaveLength(1);
    const assigned = applyTaskPatch(lists, "a", { assignee: "נעמה" }, NOW);
    expect(assigned.open[0]).toMatchObject({ id: "a", assignee: "נעמה", completed_at: null });
  });

  it("in_progress stays open; an unknown id changes nothing", () => {
    const next = applyTaskPatch(lists, "a", { status: "in_progress" }, NOW);
    expect(next.open.map((t) => t.id)).toEqual(["a", "b"]);
    expect(applyTaskPatch(lists, "nope", { status: "done" }, NOW)).toBe(lists);
  });
});

describe("removeTask / insertTask", () => {
  it("removes from either list", () => {
    const lists = { open: [task("a")], done: [task("z", { status: "done" })] };
    expect(removeTask(lists, "a").open).toEqual([]);
    expect(removeTask(lists, "z").done).toEqual([]);
  });

  it("inserts a new task in server order, replacing a stale copy", () => {
    const lists = { open: [task("a", { due_date: "2026-11-01" })], done: [] };
    const next = insertTask(lists, task("n", { due_date: "2026-10-30", created_at: "2026-10-29T00:00:00Z" }));
    expect(next.open.map((t) => t.id)).toEqual(["n", "a"]);
    const again = insertTask(next, task("n", { due_date: "2026-12-01", created_at: "2026-10-29T00:00:00Z" }));
    expect(again.open.map((t) => t.id)).toEqual(["a", "n"]);
  });
});
