import { describe, it, expect, vi, afterEach } from "vitest";

process.env.SUMIT_COMPANY_ID = process.env.SUMIT_COMPANY_ID || "1";
process.env.SUMIT_API_KEY = process.env.SUMIT_API_KEY || "test-key";

import { cancelLiveOrdersForCustomer, updateRecurringPrice } from "./sumit";

const ITEM_ID = 2059972492;
const CUSTOMER = "therapist-under-test";

/**
 * A fake Sumit that holds one standing order, so the test can say how the
 * update endpoint interprets the price it is sent. Returns the update bodies
 * in the order they were sent.
 */
function fakeSumit(opts: { stored: number; interpret: (sent: number) => number }) {
  const sentPrices: number[] = [];
  let stored = opts.stored;
  const fetchMock = vi.fn(async (url: string, init: { body: string }) => {
    const path = new URL(url).pathname;
    const body = JSON.parse(init.body);
    let data: unknown;
    if (path === "/billing/recurring/update/") {
      sentPrices.push(body.UnitPrice);
      stored = opts.interpret(body.UnitPrice);
      data = {};
    } else if (path === "/billing/recurring/listforcustomer/") {
      data = { RecurringItems: [{ ID: ITEM_ID, Status: 0, UnitPrice: stored }] };
    } else {
      throw new Error(`unexpected path ${path}`);
    }
    return {
      ok: true,
      json: async () => ({ Status: 0, UserErrorMessage: null, TechnicalErrorDetails: null, Data: data }),
    };
  });
  vi.stubGlobal("fetch", fetchMock);
  return { sentPrices, get stored() { return stored; } };
}

afterEach(() => vi.unstubAllGlobals());

describe("updateRecurringPrice", () => {
  it("sends the price with VAT, because that is the field Sumit stores", async () => {
    // The order sits at ₪90 + VAT and reverts to the regular ₪140 + VAT.
    const sumit = fakeSumit({ stored: 106.2, interpret: (sent) => sent });

    await updateRecurringPrice({ recurringItemId: ITEM_ID, customerExternalId: CUSTOMER, unitPrice: 140 });

    expect(sumit.sentPrices).toEqual([165.2]);
    expect(sumit.stored).toBe(165.2);
  });

  it("corrects itself if Sumit adds VAT to what it was sent", async () => {
    // The gross reading is measured, not documented. Under the other possible
    // reading the order would end up at ₪194.94 - above the agreed price - so
    // the function must fix it inside the same run.
    const sumit = fakeSumit({ stored: 106.2, interpret: (sent) => +(sent * 1.18).toFixed(2) });

    await updateRecurringPrice({ recurringItemId: ITEM_ID, customerExternalId: CUSTOMER, unitPrice: 140 });

    expect(sumit.sentPrices).toEqual([165.2, 140]);
    expect(sumit.stored).toBe(165.2);
  });

  it("restores the old price and fails when the result is neither", async () => {
    const sumit = fakeSumit({ stored: 106.2, interpret: (sent) => (sent === 106.2 ? 106.2 : 999) });

    await expect(
      updateRecurringPrice({ recurringItemId: ITEM_ID, customerExternalId: CUSTOMER, unitPrice: 140 })
    ).rejects.toThrow(/price mismatch/);

    expect(sumit.stored).toBe(106.2);
    expect(sumit.sentPrices.at(-1)).toBe(106.2);
  });

  it("fails without touching the price when the order is not active", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const path = new URL(url).pathname;
      if (path === "/billing/recurring/update/") throw new Error("must not update a cancelled order");
      return {
        ok: true,
        json: async () => ({
          Status: 0,
          UserErrorMessage: null,
          TechnicalErrorDetails: null,
          Data: { RecurringItems: [{ ID: ITEM_ID, Status: 1, UnitPrice: 106.2 }] },
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      updateRecurringPrice({ recurringItemId: ITEM_ID, customerExternalId: CUSTOMER, unitPrice: 140 })
    ).rejects.toThrow(/not active \(before/);
  });
});

/**
 * A fake Sumit holding several standing orders of one customer. A cancel flips
 * the order to status 1 unless it is listed in `stuck` - the case where Sumit
 * accepts the request and the order stays alive.
 */
function fakeSumitOrders(orders: { ID: number; Status: number }[], stuck: number[] = []) {
  const state = orders.map((o) => ({ ...o }));
  const cancelCalls: number[] = [];
  const fetchMock = vi.fn(async (url: string, init: { body: string }) => {
    const path = new URL(url).pathname;
    const body = JSON.parse(init.body);
    let data: unknown;
    if (path === "/billing/recurring/cancel/") {
      const id = body.RecurringCustomerItemID as number;
      cancelCalls.push(id);
      const order = state.find((o) => o.ID === id);
      if (order && !stuck.includes(id)) order.Status = 1;
      data = {};
    } else if (path === "/billing/recurring/listforcustomer/") {
      // The function has to ask for inactive orders too, or a cancelled one
      // would simply vanish from the list and "not found" would pass for "dead".
      expect(body.IncludeInactive).toBe(true);
      data = { RecurringItems: state.map((o) => ({ ...o })) };
    } else {
      throw new Error(`unexpected path ${path}`);
    }
    return {
      ok: true,
      json: async () => ({ Status: 0, UserErrorMessage: null, TechnicalErrorDetails: null, Data: data }),
    };
  });
  vi.stubGlobal("fetch", fetchMock);
  return { state, cancelCalls };
}

describe("cancelLiveOrdersForCustomer", () => {
  it("cancels a charging order and a scheduled one, and leaves a dead one alone", async () => {
    // 0 = charging, 12 = scheduled (gift months, first charge still ahead), 1 = cancelled.
    const sumit = fakeSumitOrders([
      { ID: 101, Status: 1 },
      { ID: 102, Status: 0 },
      { ID: 103, Status: 12 },
    ]);

    const cancelled = await cancelLiveOrdersForCustomer("center:under-test");

    expect(cancelled).toEqual([102, 103]);
    expect(sumit.cancelCalls).toEqual([102, 103]);
    expect(sumit.state.every((o) => o.Status === 1)).toBe(true);
  });

  it("does nothing, and says so, when no order is alive", async () => {
    const sumit = fakeSumitOrders([{ ID: 101, Status: 1 }]);

    expect(await cancelLiveOrdersForCustomer("center:under-test")).toEqual([]);
    expect(sumit.cancelCalls).toEqual([]);
  });

  it("returns an empty list for a customer with no orders at all", async () => {
    fakeSumitOrders([]);
    expect(await cancelLiveOrdersForCustomer("center:under-test")).toEqual([]);
  });

  it("fails when Sumit accepts the cancel and the order stays alive", async () => {
    // The caller must not record the centre as stopped: its card would keep
    // being charged with nothing left to notice.
    fakeSumitOrders([{ ID: 102, Status: 12 }], [102]);

    await expect(cancelLiveOrdersForCustomer("center:under-test")).rejects.toThrow(/did not take effect/);
  });

  it("stops at the first order it could not cancel", async () => {
    const sumit = fakeSumitOrders(
      [
        { ID: 102, Status: 0 },
        { ID: 103, Status: 0 },
      ],
      [102],
    );

    await expect(cancelLiveOrdersForCustomer("center:under-test")).rejects.toThrow(/102/);
    expect(sumit.cancelCalls).toEqual([102]);
  });
});
