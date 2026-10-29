import { describe, it, expect } from "vitest";
import {
  BUSY_PEOPLE,
  classifyRegion,
  classifyRow,
  summarize,
  TARGET_PEOPLE_PER_MONTH,
  type DistributionRow,
} from "./match-distribution-rules";

const NOW = Date.parse("2026-10-29T10:00:00Z");

function row(over: Partial<DistributionRow> = {}): DistributionRow {
  return {
    id: "t",
    name: "מטפל/ת",
    promotion_source: "paid",
    entity_type: "therapist",
    status: "paying",
    online: true,
    regions: ["תל אביב"],
    promoted_days: 40,
    paused_until: null,
    people: 0,
    people_prev: 0,
    match_people: 0,
    appearances: 0,
    appearances_prev: 0,
    opens: 0,
    load14: 0,
    ...over,
  };
}

describe("classifyRow", () => {
  it("busy: three times the target, with the automatic shedding described when it applies", () => {
    const v = classifyRow(row({ people: BUSY_PEOPLE, load14: 5 }), NOW);
    expect(v.kind).toBe("busy");
    expect(v.severity).toBe("high");
    expect(v.shedNow).toBeCloseTo(2 / 3);
    expect(v.advice).toContain("5 פונים ב-14 יום");
    expect(v.canPause).toBe(true);
  });

  it("busy but not sheddable: a gift promotion keeps the manual pause, a centre therapist gets neither", () => {
    const gift = classifyRow(row({ people: 7, load14: 7, promotion_source: "trial" }), NOW);
    expect(gift.shedNow).toBe(0);
    expect(gift.canPause).toBe(true);
    expect(gift.advice).toContain("הקפאה שקטה");
    const center = classifyRow(row({ people: 7, load14: 7, promotion_source: "center" }), NOW);
    expect(center.canPause).toBe(false);
    expect(center.advice).toContain("מטפלי מרכז לא מוקפאים");
    const trialCard = classifyRow(row({ people: 7, load14: 7, promotion_source: "gift_trial" }), NOW);
    expect(trialCard.advice).toContain("לפני החיוב הראשון");
  });

  it("an active pause removes the pause button", () => {
    const v = classifyRow(row({ people: 7, paused_until: "2026-11-03T00:00:00Z" }), NOW);
    expect(v.canPause).toBe(false);
    expect(v.advice).toContain("כבר בהקפאה שקטה עד 3.11.2026");
  });

  it("above target and on target", () => {
    expect(classifyRow(row({ people: TARGET_PEOPLE_PER_MONTH + 1 }), NOW).kind).toBe("above");
    expect(classifyRow(row({ people: 1 }), NOW).kind).toBe("on_target");
    expect(classifyRow(row({ people: 2 }), NOW).kind).toBe("on_target");
  });

  it("zero contacts: new first, then exposed-without-contacts, then unexposed, then quiet", () => {
    expect(classifyRow(row({ promoted_days: 5, appearances: 80 }), NOW).kind).toBe("new");
    const exposed = classifyRow(row({ appearances: 103, opens: 7 }), NOW);
    expect(exposed.kind).toBe("exposed_no_contacts");
    expect(exposed.severity).toBe("high");
    expect(exposed.advice).toContain("103 הופעות, 7 פתיחות");
    expect(classifyRow(row({ appearances: 4 }), NOW).kind).toBe("unexposed");
    expect(classifyRow(row({ appearances: 20 }), NOW).kind).toBe("quiet");
  });
});

describe("summarize", () => {
  it("top shares, zero share, paid on target and who is shed now", () => {
    const rows = [
      row({ id: "a", people: 16, people_prev: 10, load14: 9 }),
      row({ id: "b", people: 13, people_prev: 3, load14: 4 }),
      row({ id: "c", people: 0, people_prev: 2, promotion_source: "trial", load14: 6 }),
      row({ id: "d", people: 1, people_prev: 0 }),
      row({ id: "e", people: 0, people_prev: 0 }),
    ];
    const s = summarize(rows);
    expect(s.promoted).toBe(5);
    expect(s.people).toBe(30);
    expect(s.people_prev).toBe(15);
    expect(s.top5_share).toBe(100);
    expect(s.top10_share_prev).toBe(100);
    expect(s.zero_share).toBe(40);
    expect(s.zero_share_prev).toBe(40);
    expect(s.paid_total).toBe(4);
    expect(s.paid_on_target).toBe(2);
    // c is a gift promotion: loaded but never shed.
    expect(s.shed_now).toBe(2);
  });

  it("is safe on an empty list", () => {
    expect(summarize([]).top5_share).toBe(0);
  });
});

describe("classifyRegion", () => {
  it("concentration when one therapist takes half or more of at least five contacts", () => {
    const v = classifyRegion({ region: "השפלה והמרכז", searches: 49, people: 14, therapists_with_contacts: 6, top1: 8, top3: 11, covering: 5 });
    expect(v.label).toBe("ריכוז");
    expect(v.note).toContain("57%");
  });

  it("low demand for the number of promoted therapists", () => {
    const v = classifyRegion({ region: "גוש דן", searches: 109, people: 20, therapists_with_contacts: 11, top1: 5, top3: 9, covering: 21 });
    expect(v.label).toBe("ביקוש נמוך למספר המקודמים");
    expect(v.note).toContain("1.0 לכל אחד");
  });

  it("fine, and no contacts", () => {
    expect(classifyRegion({ region: "אונליין", searches: 23, people: 10, therapists_with_contacts: 9, top1: 2, top3: 4, covering: 4 }).label).toBe("תקין");
    expect(classifyRegion({ region: "גליל וצפון", searches: 7, people: 0, therapists_with_contacts: 0, top1: 0, top3: 0, covering: 2 }).label).toBe("בלי פניות");
  });
});
