import { describe, it, expect, vi, afterEach } from "vitest";

process.env.SUMIT_COMPANY_ID = process.env.SUMIT_COMPANY_ID || "1";
process.env.SUMIT_API_KEY = process.env.SUMIT_API_KEY || "test-key";

import {
  addMonthsToDay,
  daysBetween,
  israelDay,
  israelDayToIso,
  monthsLabel,
  retentionGiftActive,
  retentionGiftBlocker,
  type RetentionGiftFacts,
} from "./retention-gift-rules";
import { buildRetentionGiftEndingEmail, buildRetentionGiftGrantedEmail, hebDay } from "./retention-gift-emails";
import { deferRecurringNextBilling, sumitDay } from "./sumit";

describe("addMonthsToDay", () => {
  it("keeps the day of the month the customer is used to", () => {
    expect(addMonthsToDay("2026-10-16", 2)).toBe("2026-12-16");
    expect(addMonthsToDay("2026-11-16", 2)).toBe("2027-01-16");
    expect(addMonthsToDay("2026-12-01", 3)).toBe("2027-03-01");
  });

  it("lands on the last day when the target month is shorter", () => {
    // 31 בדצמבר + חודשיים = סוף פברואר, לא 3 במרץ.
    expect(addMonthsToDay("2026-12-31", 2)).toBe("2027-02-28");
    expect(addMonthsToDay("2027-12-31", 2)).toBe("2028-02-29");
    expect(addMonthsToDay("2026-08-31", 1)).toBe("2026-09-30");
  });

  it("stores a calendar day so that it reads back as the same day, summer and winter", () => {
    // ישראל ב-+3 בקיץ וב-+2 בחורף. מתנה שניתנת באוקטובר מסתיימת בדצמבר,
    // ולכן שני הצדדים של החלפת השעון חייבים להחזיר את אותו תאריך.
    for (const day of ["2026-07-15", "2026-10-15", "2026-10-25", "2026-12-15", "2027-01-01", "2027-03-26"]) {
      expect(israelDay(new Date(israelDayToIso(day)))).toBe(day);
    }
  });

  it("counts days between two dates", () => {
    expect(daysBetween("2026-12-09", "2026-12-16")).toBe(7);
    expect(daysBetween("2026-12-16", "2026-12-09")).toBe(-7);
  });
});

describe("retentionGiftBlocker", () => {
  const ok: RetentionGiftFacts = {
    therapist: { status: "paying", promotion_source: "paid" },
    subscription: { status: "active", morning_token_id: "2258818507", retention_gift_until: null },
    order: { status: 0, nextBilling: "2026-10-16" },
    liveOrderCount: 1,
    months: 2,
    today: "2026-10-13",
  };

  it("allows a therapist who pays by a healthy standing order", () => {
    expect(retentionGiftBlocker(ok)).toBeNull();
  });

  it("refuses anyone who is not charged themselves", () => {
    for (const promotion_source of ["manual", "trial", "center", "gift_trial", null]) {
      expect(retentionGiftBlocker({ ...ok, therapist: { status: "paying", promotion_source } })).toMatch(/משלם\/ת בעצמו/);
    }
    expect(retentionGiftBlocker({ ...ok, therapist: { status: "approved", promotion_source: null } })).toMatch(/משלם\/ת בעצמו/);
  });

  it("refuses when there is no active subscription or no Sumit order id", () => {
    expect(retentionGiftBlocker({ ...ok, subscription: null })).toMatch(/מנוי פעיל/);
    expect(retentionGiftBlocker({ ...ok, subscription: { ...ok.subscription!, status: "cancelled" } })).toMatch(/מנוי פעיל/);
    expect(retentionGiftBlocker({ ...ok, subscription: { ...ok.subscription!, morning_token_id: null } })).toMatch(/מזהה הוראת קבע/);
    expect(retentionGiftBlocker({ ...ok, subscription: { ...ok.subscription!, morning_token_id: "x@y.z" } })).toMatch(/מזהה הוראת קבע/);
  });

  it("refuses to stack a second gift on one that is still running", () => {
    const running = { ...ok.subscription!, retention_gift_until: "2026-12-16" };
    expect(retentionGiftBlocker({ ...ok, subscription: running })).toMatch(/כבר ניתנה מתנת שימור/);
    // אחרי שהחיוב חזר אפשר שוב.
    const over = { ...ok.subscription!, retention_gift_until: "2026-10-13" };
    expect(retentionGiftBlocker({ ...ok, subscription: over })).toBeNull();
  });

  it("refuses when the order is not in a plain active state", () => {
    expect(retentionGiftBlocker({ ...ok, order: null })).toMatch(/לא נמצאה ב-Sumit/);
    for (const status of [1, 3, 9, 11, 12, 13, 14]) {
      expect(retentionGiftBlocker({ ...ok, order: { status, nextBilling: "2026-10-16" } })).toMatch(/אינה במצב פעיל רגיל/);
    }
  });

  it("refuses when a second live order would keep charging through the gift", () => {
    expect(retentionGiftBlocker({ ...ok, liveOrderCount: 2 })).toMatch(/יותר מהוראת קבע חיה אחת/);
  });

  it("refuses on the billing day itself, and without a billing date", () => {
    expect(retentionGiftBlocker({ ...ok, order: { status: 0, nextBilling: "2026-10-13" } })).toMatch(/מתוזמן להיום/);
    expect(retentionGiftBlocker({ ...ok, order: { status: 0, nextBilling: null } })).toMatch(/אין תאריך חיוב/);
  });

  it("accepts only the offered lengths", () => {
    expect(retentionGiftBlocker({ ...ok, months: 1 })).toBeNull();
    expect(retentionGiftBlocker({ ...ok, months: 3 })).toBeNull();
    for (const months of [0, 4, 12, 1.5, NaN]) {
      expect(retentionGiftBlocker({ ...ok, months })).toMatch(/מספר החודשים/);
    }
  });

  it("knows when a gift is still running", () => {
    expect(retentionGiftActive("2026-12-16", "2026-12-15")).toBe(true);
    expect(retentionGiftActive("2026-12-16", "2026-12-16")).toBe(false);
    expect(retentionGiftActive(null, "2026-12-15")).toBe(false);
  });
});

// הנוסח שהמטפל מקבל. שינוי כאן = שינוי בהבטחה ללקוח, ועובר קודם אישור של
// הבעלים - לכן הבדיקה משווה את הטקסט המלא ולא רק מחפשת מילים.
describe("retention gift emails", () => {
  const input = { name: "דנה לוי", months: 2, chargeDate: "2026-12-16", amount: 140 };

  it("formats the date in Hebrew without drifting a day", () => {
    expect(hebDay("2026-12-16")).toBe("16 בדצמבר 2026");
    expect(monthsLabel(1)).toBe("חודש");
    expect(monthsLabel(2)).toBe("חודשיים");
    expect(monthsLabel(3)).toBe("3 חודשים");
  });

  it("granted: says what was given, when billing resumes, and promises the reminder", () => {
    const mail = buildRetentionGiftGrantedEmail(input);
    expect(mail.subject).toBe("קיבלת חודשיים של קידום במתנה - טיפול חכם");
    expect(mail.text).toBe(
      [
        "שלום דנה לוי,",
        "",
        "קיבלת מאיתנו חודשיים של קידום במתנה.",
        "",
        "הקידום שלך באתר ממשיך כרגיל, בלי שום שינוי. בתקופת המתנה הכרטיס שלך לא יחויב.",
        "",
        "החיוב הבא: 16 בדצמבר 2026",
        'הסכום: 140 ש"ח + מע"מ לחודש, כמו קודם.',
        "",
        "שבוע לפני סיום המתנה נשלח אליך מייל תזכורת.",
        "אין צורך לעשות דבר.",
        "",
        "צוות טיפול חכם",
      ].join("\n")
    );
    expect(mail.html).toContain("החיוב הבא: 16 בדצמבר 2026");
    expect(mail.html).toContain("שבוע לפני סיום המתנה נשלח אליך מייל תזכורת.");
  });

  it("ending: gives the date, the amount, and how to stop", () => {
    const mail = buildRetentionGiftEndingEmail(input);
    expect(mail.subject).toBe("המתנה שלך מסתיימת ב-16 בדצמבר 2026 - טיפול חכם");
    expect(mail.text).toBe(
      [
        "שלום דנה לוי,",
        "",
        "קיבלת מאיתנו חודשיים של קידום במתנה, והתחייבנו לעדכן אותך שבוע לפני שהמתנה מסתיימת. זה המייל הזה.",
        "",
        "החיוב חוזר: 16 בדצמבר 2026",
        'הסכום: 140 ש"ח + מע"מ לחודש, כל חודש.',
        "",
        "אם תרצה/י להמשיך - אין צורך לעשות דבר, והקידום פשוט ממשיך.",
        "אם תרצה/י להפסיק - מספיק להשיב למייל הזה עד 16 בדצמבר 2026 ונבטל מיד, בלי חיוב.",
        "",
        "צוות טיפול חכם",
      ].join("\n")
    );
  });

  it("carries no performance numbers and no em-dash", () => {
    for (const mail of [buildRetentionGiftGrantedEmail(input), buildRetentionGiftEndingEmail(input)]) {
      expect(mail.text).not.toMatch(/—/);
      expect(mail.html).not.toMatch(/—/);
      expect(mail.text).not.toMatch(/צפיות|פניות|לחיצות|חשיפות/);
    }
  });

  it("escapes a name that carries markup", () => {
    const mail = buildRetentionGiftGrantedEmail({ ...input, name: '<b>"x"</b>' });
    expect(mail.html).not.toContain("<b>");
    expect(mail.html).toContain("&lt;b&gt;");
  });
});

// ── Sumit: דחיית תאריך החיוב הבא ─────────────────────────────────────────────
const ITEM_ID = 2258818507;
const CUSTOMER = "therapist-under-test";

/** Sumit מזויף עם הוראה אחת. `apply` קובע מה העדכון עושה להוראה בפועל. */
function fakeSumit(opts: {
  status?: number;
  nextBilling: string;
  price?: number;
  apply: (order: { next: string; price: number }, sentDate: string) => void;
}) {
  const order = { next: opts.nextBilling, price: opts.price ?? 165.2 };
  const sentDates: string[] = [];
  const fetchMock = vi.fn(async (url: string, init: { body: string }) => {
    const path = new URL(url).pathname;
    const body = JSON.parse(init.body);
    let data: unknown;
    if (path === "/billing/recurring/update/") {
      // העדכון חייב לשאת רק את התאריך: מחיר או מספר תשלומים שהיו נשלחים כאן
      // היו משנים את ההוראה מעבר למה שהמתנה מבטיחה.
      expect(Object.keys(body).sort()).toEqual(["Credentials", "Customer", "NextPaymentDate", "RecurringCustomerItemID"]);
      sentDates.push(body.NextPaymentDate);
      opts.apply(order, body.NextPaymentDate);
      data = {};
    } else if (path === "/billing/recurring/listforcustomer/") {
      data = {
        RecurringItems: [
          { ID: ITEM_ID, Status: opts.status ?? 0, UnitPrice: order.price, Date_NextBilling: `${order.next}T00:00:00+03:00` },
        ],
      };
    } else {
      throw new Error(`unexpected path ${path}`);
    }
    return {
      ok: true,
      json: async () => ({ Status: 0, UserErrorMessage: null, TechnicalErrorDetails: null, Data: data }),
    };
  });
  vi.stubGlobal("fetch", fetchMock);
  return { order, sentDates };
}

afterEach(() => vi.unstubAllGlobals());

describe("deferRecurringNextBilling", () => {
  const call = (nextPaymentDate: string, allowEarlier = false) =>
    deferRecurringNextBilling({ recurringItemId: ITEM_ID, customerExternalId: CUSTOMER, nextPaymentDate, allowEarlier });

  it("reads Sumit's date as an Israel calendar day", () => {
    expect(sumitDay("2026-10-16T00:00:00+03:00")).toBe("2026-10-16");
    expect(sumitDay(null)).toBeNull();
    expect(sumitDay("garbage")).toBeNull();
  });

  it("moves the next charge and reports both dates", async () => {
    const sumit = fakeSumit({ nextBilling: "2026-10-16", apply: (o, d) => { o.next = d; } });

    const result = await call("2026-12-16");

    expect(result).toEqual({ previousNextBilling: "2026-10-16", nextBilling: "2026-12-16" });
    expect(sumit.sentDates).toEqual(["2026-12-16"]);
    expect(sumit.order.price).toBe(165.2);
  });

  it("fails when Sumit accepts the call but the date does not move", async () => {
    // התשובה "הצליח" בלי שינוי בפועל היא בדיוק המקרה שבו לקוח היה מקבל מייל
    // "חודשיים בלי חיוב" ומחויב כרגיל שלושה ימים אחר כך.
    const sumit = fakeSumit({ nextBilling: "2026-10-16", apply: () => {} });

    await expect(call("2026-12-16")).rejects.toThrow(/did not take effect.*original date is back in place/);
    expect(sumit.order.next).toBe("2026-10-16");
  });

  it("puts the date back and fails when the update also changed the price", async () => {
    const sumit = fakeSumit({
      nextBilling: "2026-10-16",
      apply: (o, d) => { o.next = d; if (d === "2026-12-16") o.price = 0; },
    });

    await expect(call("2026-12-16")).rejects.toThrow(/price 165.2 -> 0/);
    expect(sumit.sentDates).toEqual(["2026-12-16", "2026-10-16"]);
    expect(sumit.order.next).toBe("2026-10-16");
  });

  it("says so loudly when it cannot put the date back", async () => {
    fakeSumit({ nextBilling: "2026-10-16", apply: (o) => { o.next = "2027-06-01"; } });

    await expect(call("2026-12-16")).rejects.toThrow(/COULD NOT RESTORE/);
  });

  it("does not touch an order that is not active", async () => {
    const sumit = fakeSumit({ status: 1, nextBilling: "2026-10-16", apply: () => { throw new Error("must not update"); } });

    await expect(call("2026-12-16")).rejects.toThrow(/not active/);
    expect(sumit.sentDates).toEqual([]);
  });

  it("refuses to move the charge earlier, unless it is a restore", async () => {
    const sumit = fakeSumit({ nextBilling: "2026-12-16", apply: (o, d) => { o.next = d; } });

    await expect(call("2026-10-16")).rejects.toThrow(/is not after the current next billing/);
    expect(sumit.sentDates).toEqual([]);

    await expect(call("2026-10-16", true)).resolves.toEqual({
      previousNextBilling: "2026-12-16",
      nextBilling: "2026-10-16",
    });
  });

  it("rejects a malformed date before calling Sumit", async () => {
    const sumit = fakeSumit({ nextBilling: "2026-10-16", apply: () => {} });
    await expect(call("16/12/2026")).rejects.toThrow(/bad date/);
    expect(sumit.sentDates).toEqual([]);
  });
});
