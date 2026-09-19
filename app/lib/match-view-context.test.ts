import { describe, it, expect, beforeEach } from "vitest";
import { stashMatchContext, takeMatchContext, SENSITIVE_PROFILE_PARAMS } from "./match-view-context";
import { GENERAL_EMOTIONAL_FINDING } from "./sensitive-findings";

// The hand-off that replaced the i / t / sy query parameters on profile links.
// The contract: what the card stashes on click is what the profile takes - once,
// for that therapist only, only while fresh - and a suicidality finding never
// makes it into the store in the first place.

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  get size() { return this.m.size; }
}

const store = new MemoryStorage();
beforeEach(() => {
  store.clear();
  (globalThis as unknown as { sessionStorage: MemoryStorage }).sessionStorage = store;
});

const T0 = 1_000_000_000_000;

describe("match view context", () => {
  it("hands the stashed context to the profile of the same therapist", () => {
    stashMatchContext("t1", { issue: "relationship", treatment: "טיפול מיני", symptom: "נמצא קושי בתפקוד המיני בזוגיות." }, T0);
    expect(takeMatchContext("t1", T0 + 1000)).toEqual({
      issue: "relationship", treatment: "טיפול מיני", symptom: "נמצא קושי בתפקוד המיני בזוגיות.",
    });
  });

  it("gives it once: a second read gets nothing, and the store is left empty", () => {
    stashMatchContext("t1", { issue: "emotional" }, T0);
    takeMatchContext("t1", T0);
    expect(takeMatchContext("t1", T0)).toBeUndefined();
    expect(store.size).toBe(0);
  });

  it("keeps other therapists' entries apart", () => {
    stashMatchContext("t1", { treatment: "CBT" }, T0);
    stashMatchContext("t2", { treatment: "EMDR" }, T0);
    expect(takeMatchContext("t2", T0)?.treatment).toBe("EMDR");
    expect(takeMatchContext("t1", T0)?.treatment).toBe("CBT");
  });

  it("drops an entry older than 30 minutes", () => {
    stashMatchContext("t1", { treatment: "CBT" }, T0);
    expect(takeMatchContext("t1", T0 + 31 * 60_000)).toBeUndefined();
  });

  it("pools a suicidality finding before it is stored at all", () => {
    stashMatchContext("t1", { symptom: "נמצאו סימנים של אובדנות." }, T0);
    expect(store.getItem("mnt_match_ctx")).not.toContain("אובדנ");
    expect(takeMatchContext("t1", T0)?.symptom).toBe(GENERAL_EMOTIONAL_FINDING);
  });

  it("survives blocked storage without throwing", () => {
    (globalThis as unknown as { sessionStorage: unknown }).sessionStorage = {
      getItem() { throw new Error("blocked"); },
      setItem() { throw new Error("blocked"); },
      removeItem() { throw new Error("blocked"); },
    };
    expect(() => stashMatchContext("t1", { treatment: "CBT" }, T0)).not.toThrow();
    expect(takeMatchContext("t1", T0)).toBeUndefined();
  });

  it("names exactly the parameters the profile strips from old links", () => {
    expect([...SENSITIVE_PROFILE_PARAMS].sort()).toEqual(["i", "sy", "t"]);
  });
});
