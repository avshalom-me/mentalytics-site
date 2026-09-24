import { describe, it, expect } from "vitest";
import { expandEventGroups, type EventGroup } from "./analytics-event-groups";

const group = (over: Partial<Record<number, unknown>>): EventGroup => {
  const g: unknown[] = ["page_view", null, null, null, null, null, null, null, null, null, null, null, null, 1];
  for (const [i, v] of Object.entries(over)) g[Number(i)] = v;
  return g as EventGroup;
};

describe("expandEventGroups", () => {
  it("gives back one row per event, in group order", () => {
    const rows = expandEventGroups([
      group({ 0: "profile_impression", 1: "2026-09-21", 2: "t-1", 13: 3 }),
      group({ 0: "quiz_step", 4: "adults", 5: "e1", 13: 2 }),
    ]);
    expect(rows).toHaveLength(5);
    expect(rows.slice(0, 3).every((r) => r.event_type === "profile_impression" && r.therapist_id === "t-1")).toBe(true);
    expect(rows[3]).toMatchObject({ event_type: "quiz_step", therapist_id: null, metadata: { quiz_type: "adults", step: "e1" } });
  });

  it("keeps only the metadata the SQL projected, with the JSON values as they were", () => {
    const [row] = expandEventGroups([group({ 0: "filter_used", 6: 7, 13: 1 })]);
    expect(row.metadata).toEqual({ filter_value: 7 });
    const [explain] = expandEventGroups([
      group({ 0: "recommendation_explain_click", 7: "adult", 8: "CBT", 9: "18-30", 10: "f", 11: null, 12: "", 13: 1 }),
    ]);
    // A JSON null is dropped (it reads as missing everywhere); an empty string stays.
    expect(explain.metadata).toEqual({ questionnaire_type: "adult", treatment_label: "CBT", viewer_age_band: "18-30", viewer_gender: "f", domain: "" });
  });

  it("dates a weekly group by its Monday", () => {
    const [row] = expandEventGroups([group({ 0: "page_view", 1: "2026-09-21", 3: "directory", 13: 1 })]);
    expect(row.created_at).toBe("2026-09-21");
    expect(row.metadata).toEqual({ page: "directory" });
  });

  it("returns nothing for no groups", () => {
    expect(expandEventGroups([])).toEqual([]);
  });
});
