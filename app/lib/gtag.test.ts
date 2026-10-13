import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { gaEvent, LEAD_DEDUPE_MS } from "./gtag";
import { TRACKING_OPTOUT_KEY } from "./track-optout";

// gtag.ts runs in the browser; the three globals it touches are stubbed here.
function store(): Storage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage & { map: Map<string, string> };
}

const g = globalThis as unknown as { window?: unknown; localStorage?: Storage; sessionStorage?: Storage };
let gtag: ReturnType<typeof vi.fn>;

beforeEach(() => {
  gtag = vi.fn();
  g.window = { gtag };
  g.localStorage = store();
  g.sessionStorage = store();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-13T10:00:00Z"));
});

afterEach(() => {
  delete g.window;
  delete g.localStorage;
  delete g.sessionStorage;
  vi.useRealTimers();
});

describe("gaEvent", () => {
  it("sends the event, and a lead also fires the Ads conversion", () => {
    gaEvent("quiz_complete", { quiz_type: "adults" });
    expect(gtag).toHaveBeenCalledTimes(1);
    gaEvent("generate_lead", { method: "whatsapp", source: "profile", therapist_id: "t1" });
    expect(gtag).toHaveBeenCalledTimes(3);
    expect(gtag.mock.calls[2][1]).toBe("conversion");
  });

  it("sends nothing from a browser that opted out of measurement", () => {
    g.localStorage!.setItem(TRACKING_OPTOUT_KEY, "1");
    gaEvent("generate_lead", { method: "phone", source: "profile", therapist_id: "t1" });
    expect(gtag).not.toHaveBeenCalled();
  });

  it("counts a repeated press on the same therapist's button within two minutes as one lead", () => {
    const lead = { method: "whatsapp", source: "profile", therapist_id: "t1" };
    gaEvent("generate_lead", lead);
    gaEvent("generate_lead", lead);
    gaEvent("generate_lead", lead);
    expect(gtag).toHaveBeenCalledTimes(2); // one GA4 event + one Ads conversion
    vi.setSystemTime(new Date(Date.now() + LEAD_DEDUPE_MS + 1));
    gaEvent("generate_lead", lead);
    expect(gtag).toHaveBeenCalledTimes(4);
  });

  it("two different therapists within two minutes are two leads, and a lead without an id is never held back", () => {
    gaEvent("generate_lead", { method: "whatsapp", source: "profile", therapist_id: "t1" });
    gaEvent("generate_lead", { method: "whatsapp", source: "profile", therapist_id: "t2" });
    expect(gtag).toHaveBeenCalledTimes(4);
    // The directory's buttons do not say which therapist (their files are
    // lastmod sources); a visitor contacting two of them in a row is two leads.
    gaEvent("generate_lead", { method: "phone", source: "directory" });
    gaEvent("generate_lead", { method: "phone", source: "directory" });
    expect(gtag).toHaveBeenCalledTimes(8);
  });
});

describe("the analytics tags in the layout honour the opt-out too", () => {
  it("both inline tags check the opt-out key before configuring themselves", () => {
    const layout = readFileSync("app/layout.tsx", "utf8");
    // The guard is built from the same key the opt-out module writes...
    expect(layout).toContain("JSON.stringify(TRACKING_OPTOUT_KEY)");
    // ...and each of the two tags (GA4 + Ads, Taboola) wraps itself in it.
    expect(layout.split("${NOT_OPTED_OUT}").length - 1).toBe(2);
  });
});
