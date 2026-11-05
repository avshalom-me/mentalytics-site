import { describe, expect, it } from "vitest";
import { cityListingSections } from "./city-listing-order";

type Card = { id: string; free: boolean; accepting_new_patients: boolean };
const paid = (id: string): Card => ({ id, free: false, accepting_new_patients: true });
const free = (id: string): Card => ({ id, free: true, accepting_new_patients: true });
const paidFull = (id: string): Card => ({ id, free: false, accepting_new_patients: false });
const ids = (rows: Card[]) => rows.map((r) => r.id);

describe("cityListingSections", () => {
  it("puts the paying therapists next door above the free ones in a thin city", () => {
    // The shape of the city page on 4/11/2026: three free in the city, paying
    // and free ones in the adjacent cities.
    const s = cityListingSections(
      [free("c1"), free("c2"), free("c3")],
      [paid("n1"), paid("n2"), free("n3")],
      []
    );
    expect(s.paidFirst).toBe(true);
    expect(ids(s.inCity)).toEqual([]);
    expect(ids(s.nearby)).toEqual(["n1", "n2"]);
    expect(ids(s.others)).toEqual(["c1", "c2", "c3", "n3"]);
  });

  it("lifts the region's paying therapists too, and keeps every card on the page", () => {
    const inCity = [paid("c1"), free("c2")];
    const nearby = [free("n1")];
    const region = [paid("r1"), free("r2")];
    const s = cityListingSections(inCity, nearby, region);
    expect(s.paidFirst).toBe(true);
    expect([...ids(s.inCity), ...ids(s.nearby), ...ids(s.region)]).toEqual(["c1", "r1"]);
    expect(ids(s.others)).toEqual(["c2", "n1", "r2"]);
    const shown = [...s.inCity, ...s.nearby, ...s.region, ...s.others];
    expect(shown).toHaveLength(inCity.length + nearby.length + region.length);
  });

  it("leaves a page that is already paid-first exactly as it was", () => {
    const inCity = [paid("c1"), paid("c2"), free("c3")];
    const s = cityListingSections(inCity, [], []);
    expect(s.paidFirst).toBe(false);
    expect(s.inCity).toBe(inCity);
    expect(s.others).toEqual([]);
  });

  it("keeps a paying therapist who takes no new patients last, without splitting the page for them", () => {
    const s = cityListingSections([paid("c1"), free("c2"), paidFull("c3")], [], []);
    expect(s.paidFirst).toBe(false);

    const split = cityListingSections([free("c1"), paidFull("c2")], [paid("n1")], []);
    expect(split.paidFirst).toBe(true);
    expect(ids(split.nearby)).toEqual(["n1"]);
    expect(ids(split.others)).toEqual(["c1", "c2"]);
  });

  it("keeps the order within each group (the daily rotation)", () => {
    const s = cityListingSections([free("c1")], [paid("n2"), paid("n1"), free("n4"), free("n3")], []);
    expect(ids(s.nearby)).toEqual(["n2", "n1"]);
    expect(ids(s.others)).toEqual(["c1", "n4", "n3"]);
  });
});
