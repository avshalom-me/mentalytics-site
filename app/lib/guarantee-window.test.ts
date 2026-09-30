import { describe, it, expect } from "vitest";
import { guaranteeWindow, type GuaranteeSubscription } from "./guarantee-window";
import { GUARANTEE_DAYS } from "./crm";

const DAY = 86_400_000;
const sub = (created_at: string, status: string | null = "active"): GuaranteeSubscription => ({ status, created_at });

describe("the guarantee window anchor", () => {
  it("runs GUARANTEE_DAYS from the start of the promotion when that is all there is", () => {
    const w = guaranteeWindow({ promoted_since: "2026-09-01T10:00:00+00:00", created_at: "2026-08-20T08:00:00+00:00" }, []);
    expect(w.start.toISOString()).toBe("2026-09-01T10:00:00.000Z");
    expect(w.end.getTime() - w.start.getTime()).toBe(GUARANTEE_DAYS * DAY);
    expect(w.interrupted).toBe(false);
  });

  // The case in guarantee.ts: subscribed 16/7, suspended by a card failure on
  // 16/8 and paid again the same day - promoted_since moved forward, and the
  // window must not move with it.
  it("keeps the original subscription start when a billing hiccup reset promoted_since", () => {
    const w = guaranteeWindow(
      { promoted_since: "2026-08-16T11:16:00+00:00", created_at: "2026-07-10T00:00:00+00:00" },
      [sub("2026-07-16T09:00:00+00:00")],
    );
    expect(w.start.toISOString()).toBe("2026-07-16T09:00:00.000Z");
    expect(w.interrupted).toBe(true);
  });

  it("anchors on the active subscription, not a cancelled one from an earlier stay", () => {
    const w = guaranteeWindow(
      { promoted_since: "2026-09-02T12:00:00+00:00", created_at: "2026-01-01T00:00:00+00:00" },
      [sub("2026-02-01T00:00:00+00:00", "cancelled"), sub("2026-09-02T11:59:00+00:00", "active")],
    );
    expect(w.start.toISOString()).toBe("2026-09-02T11:59:00.000Z");
    // A minute between the subscription and the promotion is one signup, not an interruption.
    expect(w.interrupted).toBe(false);
  });

  it("falls back to the earliest subscription when none is active, and to created_at when there is nothing", () => {
    const noActive = guaranteeWindow(
      { promoted_since: null, created_at: "2026-01-01T00:00:00+00:00" },
      [sub("2026-05-01T00:00:00+00:00", "cancelled"), sub("2026-04-01T00:00:00+00:00", "cancelled")],
    );
    expect(noActive.start.toISOString()).toBe("2026-04-01T00:00:00.000Z");
    const nothing = guaranteeWindow({ promoted_since: null, created_at: "2026-01-01T00:00:00+00:00" }, []);
    expect(nothing.start.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(nothing.interrupted).toBe(false);
  });

  it("ignores an empty promoted_since", () => {
    const w = guaranteeWindow({ promoted_since: "", created_at: "2026-01-01T00:00:00+00:00" }, [sub("2026-03-01T00:00:00+00:00")]);
    expect(w.start.toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });
});

// The anchor code moved out of computeGuarantee on 30/9/26. This is that code as
// it was, verbatim in behaviour, run against the moved version on many shapes of
// input: the tracker must not see a single window change.
function previousImplementation(
  t: { promoted_since: string | null; created_at: string },
  subs: GuaranteeSubscription[],
) {
  let firstSub: string | undefined;
  let firstActiveSub: string | undefined;
  for (const s of subs) {
    const prev = firstSub;
    if (!prev || s.created_at < prev) firstSub = s.created_at;
    if (s.status === "active") {
      const prevActive = firstActiveSub;
      if (!prevActive || s.created_at < prevActive) firstActiveSub = s.created_at;
    }
  }
  const subStart = firstActiveSub ?? firstSub ?? null;
  const candidates = [t.promoted_since, subStart].filter((v): v is string => typeof v === "string" && v.length > 0);
  const startIso = candidates.length > 0 ? candidates.reduce((a, b) => (a < b ? a : b)) : t.created_at;
  const start = new Date(startIso);
  const end = new Date(start.getTime() + GUARANTEE_DAYS * 24 * 60 * 60 * 1000);
  const interrupted = !!t.promoted_since && new Date(t.promoted_since).getTime() - start.getTime() > 60 * 60 * 1000;
  return { start, end, interrupted };
}

describe("the move out of computeGuarantee", () => {
  it("gives the same window as before for every combination tried", () => {
    const stamps = [
      "2026-06-01T00:00:00+00:00",
      "2026-07-16T09:00:00+00:00",
      "2026-07-16T09:30:00+00:00",
      "2026-08-16T11:16:00+00:00",
      "2026-09-30T23:59:59.123456+00:00",
    ];
    const statuses = ["active", "cancelled", null];
    let checked = 0;
    for (const promoted of [null, "", ...stamps]) {
      for (const n of [0, 1, 2, 3]) {
        // Deterministic spread of subscription rows over stamps and statuses.
        for (let seed = 0; seed < 6; seed++) {
          const subs = Array.from({ length: n }, (_, i) =>
            sub(stamps[(seed + i * 2) % stamps.length], statuses[(seed + i) % statuses.length]),
          );
          const tRow = { promoted_since: promoted, created_at: "2026-05-01T00:00:00+00:00" };
          const a = guaranteeWindow(tRow, subs);
          const b = previousImplementation(tRow, subs);
          expect(a.start.getTime()).toBe(b.start.getTime());
          expect(a.end.getTime()).toBe(b.end.getTime());
          expect(a.interrupted).toBe(b.interrupted);
          checked++;
        }
      }
    }
    expect(checked).toBe(7 * 4 * 6);
  });
});
