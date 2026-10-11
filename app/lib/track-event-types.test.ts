import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { ANALYTICS_EVENT_TYPES, CLIENT_ANALYTICS_EVENT_TYPES } from "./analytics-event-types";

// useTrack.ts keeps its own union of the events the browser sends, and /api/track
// answers 400 to anything that is not in the canonical list. A name that drifts
// between the two is dropped without a trace, so they are compared here.
describe("the events the browser sends", () => {
  const source = readFileSync(path.join(process.cwd(), "app/lib/useTrack.ts"), "utf8");
  const union = source.match(/type EventType = ([^;]+);/)?.[1] ?? "";
  const sent = [...union.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);

  it("are all accepted by /api/track", () => {
    expect(sent.length).toBeGreaterThan(5);
    for (const name of sent) expect(CLIENT_ANALYTICS_EVENT_TYPES as readonly string[]).toContain(name);
  });

  it("include the profile form that follows a registration", () => {
    expect(sent).toContain("recruit_profile_form_view");
    expect(ANALYTICS_EVENT_TYPES as readonly string[]).toContain("recruit_profile_form_view");
  });
});
