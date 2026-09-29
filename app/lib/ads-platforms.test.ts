import { describe, it, expect, vi, afterEach } from "vitest";
import {
  fetchBoiRate,
  overlapDays,
  parseBoiCsv,
  platformTotals,
  prorated,
  type PlatformSpendRow,
} from "./ads-platforms";

// Taboola's September, as the owner read it off Realize on 29/9/2026: $458.63
// before VAT for the two campaigns, which ran 16-29/9. Rate: Bank of Israel, 29/9.
const TABOOLA_SEP: PlatformSpendRow = {
  platform: "taboola",
  campaign_key: null,
  period_start: "2026-09-16",
  period_end: "2026-09-29",
  amount_orig: 458.63,
  currency: "USD",
  fx_rate: 3.072,
  amount_ils: 1408.91,
};

// The Bank of Israel feed's CSV for 20-30/9/2026, as it came back.
const BOI_CSV = `SERIES_CODE,FREQ,BASE_CURRENCY,COUNTER_CURRENCY,UNIT_MEASURE,DATA_TYPE,DATA_SOURCE,TIME_COLLECT,CONF_STATUS,PUB_WEBSITE,UNIT_MULT,COMMENTS,TIME_PERIOD,OBS_VALUE,RELEASE_STATUS
RER_USD_ILS,D,USD,ILS,ILS,OF00,BOI_MRKT,V,F,Y,0,,2026-09-22,3.017,YP
RER_USD_ILS,D,USD,ILS,ILS,OF00,BOI_MRKT,V,F,Y,0,,2026-09-24,3.047,YP
RER_USD_ILS,D,USD,ILS,ILS,OF00,BOI_MRKT,V,F,Y,0,,2026-09-25,3.033,YP
RER_USD_ILS,D,USD,ILS,ILS,OF00,BOI_MRKT,V,F,Y,0,,2026-09-28,3.066,YP
RER_USD_ILS,D,USD,ILS,ILS,OF00,BOI_MRKT,V,F,Y,0,,2026-09-29,3.072,YP
`;

afterEach(() => vi.unstubAllGlobals());

describe("prorating an invoice over a window", () => {
  it("counts the days two ranges share, both ends included", () => {
    expect(overlapDays("2026-09-16", "2026-09-29", "2026-08-30", "2026-09-28")).toBe(13);
    expect(overlapDays("2026-09-16", "2026-09-29", "2026-10-01", "2026-10-31")).toBe(0);
    expect(overlapDays("2026-09-16", "2026-09-16", "2026-09-16", "2026-09-16")).toBe(1);
  });

  it("gives a window its share of the invoice's days", () => {
    // The 30 days to 28/9 hold 13 of the 14 campaign days.
    expect(prorated(TABOOLA_SEP, "2026-08-30", "2026-09-28")).toBeCloseTo((1408.91 * 13) / 14, 2);
    expect(prorated(TABOOLA_SEP, "2026-09-01", "2026-09-30")).toBeCloseTo(1408.91, 2);
    expect(prorated(TABOOLA_SEP, "2026-10-01", "2026-10-31")).toBe(0);
  });
});

describe("platformTotals", () => {
  it("puts the spend next to the seekers the platform's own channel brought", () => {
    const totals = platformTotals(
      [TABOOLA_SEP],
      [
        { channel: "taboola_paid", seekers: 4 },
        { channel: "taboola_paid", seekers: 2 },
        { channel: "google_paid", seekers: 70 },
      ],
      "2026-09-01",
      "2026-09-30"
    );
    expect(totals).toEqual([{ platform: "taboola", label: "טאבולה", cost: 1409, seekers: 6, cpl: 235 }]);
  });

  it("shows a platform that brought seekers even without an invoice yet", () => {
    const totals = platformTotals([], [{ channel: "meta_paid", seekers: 1 }], "2026-08-01", "2026-08-31");
    expect(totals).toEqual([{ platform: "meta", label: "מטא", cost: 0, seekers: 1, cpl: null }]);
  });
});

describe("Bank of Israel rates", () => {
  it("reads the feed's CSV", () => {
    const rows = parseBoiCsv(BOI_CSV);
    expect(rows).toHaveLength(5);
    expect(rows[rows.length - 1]).toEqual({ date: "2026-09-29", rate: 3.072 });
  });

  it("uses the last rate published on or before the day (none on a weekend)", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, text: async () => BOI_CSV }));
    vi.stubGlobal("fetch", fetchMock);
    // Sunday 27/9: the rate in force is Friday 25/9's.
    expect(await fetchBoiRate("USD", "2026-09-27")).toEqual({ rate: 3.033, date: "2026-09-25" });
    const url = String((fetchMock.mock.calls[0] as unknown[])[0]);
    expect(url).toContain("RER_USD_ILS");
    expect(url).toContain("endperiod=2026-09-27");
  });

  it("needs no feed for shekels, and returns null when the feed fails", async () => {
    expect(await fetchBoiRate("ILS", "2026-09-27")).toEqual({ rate: 1, date: "2026-09-27" });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, text: async () => "" })));
    expect(await fetchBoiRate("EUR", "2026-09-27")).toBeNull();
  });
});
