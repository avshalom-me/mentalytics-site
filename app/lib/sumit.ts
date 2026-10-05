// Sumit API client - credit card processing + automatic recurring billing.
//
// Architecture:
// - Frontend uses Sumit's Payments JS SDK with SUMIT_API_PUBLIC_KEY to
//   tokenize the card client-side. The raw card number never reaches our
//   server (PCI scope minimised).
// - This module runs on the server with SUMIT_API_KEY and accepts the
//   SingleUseToken from the frontend, then calls /billing/recurring/charge
//   for subscriptions or /billing/payments/charge for one-offs.
// - Sumit creates the standing order automatically and charges the saved
//   token every month on its own servers - there is no client-side cron
//   for renewals. We poll /billing/recurring/listforcustomer once a day
//   to sync any status changes (failed charge, customer-initiated cancel
//   from Sumit's portal, etc.).
//
// Refs:
//   https://app.sumit.co.il/help/developers/swagger/index.html
//   https://help.sumit.co.il/he/articles/5833033 (charging with API)

import { SUBSCRIPTION_REGULAR_PRICE, priceWithVat } from "@/app/lib/promo";

const API_BASE = process.env.SUMIT_API_BASE || "https://api.sumit.co.il";

// Israeli VAT, 18% since 2025-01-01. VATIncluded=false on charge bodies tells
// Sumit to add VAT on top of UnitPrice and report it cleanly on the invoice.
const VAT_RATE = 0.18;
export const QUIZ_BASE_PRICE = 30;
// Regular monthly price. Single source of truth lives in app/lib/promo.ts so
// client/server/cron never diverge.
export const SUBSCRIPTION_BASE_PRICE = SUBSCRIPTION_REGULAR_PRICE;
export const QUIZ_TOTAL = priceWithVat(QUIZ_BASE_PRICE);
export const SUBSCRIPTION_TOTAL = priceWithVat(SUBSCRIPTION_BASE_PRICE);

function credentials() {
  const id = process.env.SUMIT_COMPANY_ID;
  const key = process.env.SUMIT_API_KEY;
  if (!id || !key) throw new Error("Sumit credentials not configured");
  return { CompanyID: parseInt(id, 10), APIKey: key };
}

// Sumit wraps every response in {Status, UserErrorMessage, TechnicalErrorDetails, Data}.
// Status is numeric: 0 = success, anything else is an error code. The Swagger
// "Example Value" shows "Success (0)" as a label, but the wire format is just 0.
interface SumitEnvelope<T> {
  Status: number;
  UserErrorMessage: string | null;
  TechnicalErrorDetails: string | null;
  Data: T;
}

/**
 * Sumit answered and refused the request (envelope Status != 0): nothing was
 * created on their side. Distinct from an HTTP failure or a dropped
 * connection, after which a standing order may or may not exist - a caller
 * that retries has to know which of the two happened. Same message as before;
 * `instanceof Error` still holds.
 */
export class SumitBusinessError extends Error {}

async function api<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, Credentials: credentials() }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sumit ${path} HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  const env = (await res.json()) as SumitEnvelope<T>;
  if (env.Status !== 0) {
    const msg = env.UserErrorMessage || env.TechnicalErrorDetails || `status=${env.Status}`;
    throw new SumitBusinessError(`Sumit ${path} business error: ${msg}`);
  }
  return env.Data;
}

// ---------- Charge validation ----------
//
// The envelope Status above only says the API call was PROCESSED - a card
// DECLINE still comes back with Status=0. The decline lives inside
// Data.Payment: ValidPayment=false plus the Shva code in Payment.Status
// (e.g. "004" = issuer refusal, "006" = wrong CVV/ID). Verified live
// 2026-07-04 on two real declines that sailed through as "paid"
// subscriptions. Money has actually moved only when the payment is
// explicitly valid, or - for responses that omit the Payment object - when
// a document (invoice/receipt) was produced.

export interface SumitPaymentInfo {
  ValidPayment?: boolean;
  Status?: string | null;
  StatusDescription?: string | null;
  [k: string]: unknown;
}

export class SumitPaymentDeclinedError extends Error {
  readonly declineCode: string | null;
  constructor(declineCode: string | null, message: string) {
    super(message);
    this.name = "SumitPaymentDeclinedError";
    this.declineCode = declineCode;
  }
}

function assertChargeSucceeded(
  data: { Payment?: SumitPaymentInfo | null; DocumentID?: number | null; [k: string]: unknown },
  context: string
): void {
  const payment = data.Payment;
  if (payment?.ValidPayment === true) return;
  if (!payment && data.DocumentID != null) return;
  const code = payment?.Status?.trim() || null;
  const desc = payment?.StatusDescription?.trim() || null;
  // Include reconciliation ids in the message: in the unexpected case this
  // fires on a charge that DID move money, the log line is the only pointer
  // back to the Sumit document / standing order.
  const ids = `DocumentID=${data.DocumentID ?? "null"} RecurringCustomerItemIDs=${JSON.stringify(
    (data as { RecurringCustomerItemIDs?: unknown }).RecurringCustomerItemIDs ?? null
  )}`;
  throw new SumitPaymentDeclinedError(
    code,
    `Sumit ${context}: payment declined${code ? ` (code ${code})` : ""}${desc ? ` - ${desc}` : ""} [${ids}]`
  );
}

// ---------- One-off charge (quiz) ----------

export interface OneOffChargeResult {
  DocumentID?: number;
  DocumentURL?: string;
  CustomerID?: number;
  Payment?: SumitPaymentInfo | null;
  // Sumit returns more fields; we keep this loose because we don't depend
  // on most of them downstream - the document/customer ids are what we
  // store for reconciliation.
  [k: string]: unknown;
}

export async function chargeQuizPayment(opts: {
  fingerprint: string;
  singleUseToken: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}): Promise<OneOffChargeResult> {
  const result = await api<OneOffChargeResult>("/billing/payments/charge/", {
    Customer: {
      ExternalIdentifier: `fp:${opts.fingerprint}`,
      SearchMode: 0, // Automatic - find-or-create by ExternalIdentifier
      Name: opts.customerName,
      EmailAddress: opts.customerEmail,
      Phone: opts.customerPhone,
    },
    SingleUseToken: opts.singleUseToken,
    Items: [
      {
        Item: {
          Name: "שאלון התאמה לטיפול | טיפול חכם",
          SKU: "QUIZ-SINGLE",
        },
        Quantity: 1,
        UnitPrice: QUIZ_BASE_PRICE,
      },
    ],
    VATIncluded: false, // 18% VAT added by Sumit on top of UnitPrice
    SendDocumentByEmail: true,
    PreventStandingOrder: true, // explicit: this is a single charge, not a sub
  });
  assertChargeSucceeded(result, "quiz charge");
  return result;
}

// ---------- Subscription (charge + create standing order) ----------

export interface SubscriptionChargeResult {
  DocumentID?: number;
  CustomerID?: number;
  // Sumit's wire field: one standing-order id per Items[] element (we always
  // send exactly one item, so this holds exactly one id on success).
  RecurringCustomerItemIDs?: number[] | null;
  Payment?: SumitPaymentInfo | null;
  // Resolved standing-order id - NOT a wire field. Populated below from
  // RecurringCustomerItemIDs (or the list-lookup fallback) for callers.
  RecurringItemID?: number;
  [k: string]: unknown;
}

export async function createSubscription(opts: {
  therapistId: string;
  therapistName: string;
  therapistEmail: string;
  therapistPhone?: string;
  singleUseToken: string;
  // Per-subscription price. Defaults to the regular price; the early-bird
  // promo passes the discounted price here and the daily cron later updates
  // the standing order back to SUBSCRIPTION_BASE_PRICE.
  unitPrice?: number;
  // "YYYY-MM-DD" - מוגדר רק במסלול ההצטרפות עם חודשי מתנה. הכרטיס נשמר
  // והוראת הקבע נוצרת עכשיו, אבל החיוב הראשון יוצא בתאריך הזה. אותו
  // מנגנון בדיוק שכבר עובד אצל המרכזים.
  firstChargeDate?: string;
}): Promise<SubscriptionChargeResult> {
  const charge = await api<SubscriptionChargeResult>("/billing/recurring/charge/", {
    Customer: {
      ExternalIdentifier: opts.therapistId,
      SearchMode: 0,
      Name: opts.therapistName,
      EmailAddress: opts.therapistEmail,
      Phone: opts.therapistPhone || null,
    },
    SingleUseToken: opts.singleUseToken,
    Items: [
      {
        Item: {
          Name: "מנוי חודשי - מסלול מקודם | טיפול חכם",
          SKU: "PROMOTED-MONTHLY",
          Duration_Months: 1,
        },
        Quantity: 1,
        UnitPrice: opts.unitPrice ?? SUBSCRIPTION_BASE_PRICE,
        // Recurrence is how many times Sumit will charge after the first.
        // 999 = effectively "until cancelled". We control cancellation via
        // the cancelSubscription endpoint below.
        Recurrence: 999,
        ...(opts.firstChargeDate ? { Date_Start: opts.firstChargeDate } : {}),
      },
    ],
    VATIncluded: false,
    // Email the customer the receipt automatically on each charge - Sumit
    // does NOT do this by default for /billing/recurring/charge (unlike
    // /billing/payments/charge which has SendDocumentByEmail). For recurring
    // the correct flag is UpdateCustomerByEmail + the attach toggle.
    UpdateCustomerByEmail: true,
    UpdateCustomerByEmail_AttachDocument: true,
    SendCopyToOrganization: true,
    PreventStandingOrder: false, // explicit: create the standing order
  });

  // A declined card must stop the flow HERE - before this line the caller
  // used to record the decline as a paid subscription (payment "completed",
  // therapist promoted, welcome email). Sumit cancels the standing order it
  // just created on its own when the initial charge is declined (observed
  // live on both real declines: item born with Status=1=Cancelled), so
  // there is nothing to clean up remotely.
  // עם Date_Start עתידי אין תשלום מיידי לוודא: הצלחת המעטפת פירושה
  // שהוראת הקבע נוצרה והכרטיס נשמר. בלי התנאי הזה כל הצטרפות במסלול
  // המתנה הייתה נכשלת כאילו הכרטיס נדחה.
  if (!opts.firstChargeDate) {
    assertChargeSucceeded(charge, "subscription charge");
  }

  // The standing-order id arrives in RecurringCustomerItemIDs. (An earlier
  // version read a nonexistent `RecurringItemID` wire field - that's why
  // morning_token_id used to depend entirely on the list-lookup fallback
  // below, which stays as a safety net.)
  if (
    !charge.RecurringItemID &&
    Array.isArray(charge.RecurringCustomerItemIDs) &&
    charge.RecurringCustomerItemIDs.length > 0
  ) {
    charge.RecurringItemID = charge.RecurringCustomerItemIDs[0];
  }
  if (!charge.RecurringItemID) {
    try {
      const items = await listRecurringForCustomer({
        externalIdentifier: opts.therapistId,
        includeInactive: false,
      });
      // Most recent active item is the one we just created.
      const newest = items
        .filter((i) => i.Status === 0)
        .sort((a, b) => Number(b.ID) - Number(a.ID))[0];
      if (newest) charge.RecurringItemID = newest.ID;
    } catch (e) {
      console.error("createSubscription: failed to resolve RecurringItemID:", e);
    }
  }

  return charge;
}

// ---------- Teacher subscription (ענף המורים, "מענה לימודי") ----------
//
// אותו endpoint, שלושה הבדלים: הלקוח מזוהה כ-`teacher:<id>` כדי שלא יתערבב
// עם מטפל שיש לו אותו מזהה-חיצוני; המחיר נשלח *ברוטו* עם VATIncluded:true,
// כי 60 ש"ח כולל מע"מ אינו מספר שלם לפני מע"מ (ראו teacher-options.ts);
// ו-Date_Start דחוי לסוף תקופת הניסיון כשהמורה משלם/ת לפני שהיא נגמרה -
// אותו מנגנון של חודשי המתנה אצל המרכזים ובמסלול ההזמנה.
export async function createTeacherSubscription(opts: {
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  teacherPhone?: string;
  singleUseToken: string;
  /** המחיר כולל מע"מ. */
  grossPrice: number;
  /** "YYYY-MM-DD" - החיוב הראשון, כשהניסיון עוד רץ. */
  firstChargeDate?: string;
}): Promise<SubscriptionChargeResult> {
  const externalId = `teacher:${opts.teacherId}`;
  const charge = await api<SubscriptionChargeResult>("/billing/recurring/charge/", {
    Customer: {
      ExternalIdentifier: externalId,
      SearchMode: 0,
      Name: opts.teacherName,
      EmailAddress: opts.teacherEmail,
      Phone: opts.teacherPhone || null,
    },
    SingleUseToken: opts.singleUseToken,
    Items: [
      {
        Item: {
          Name: "מנוי חודשי - מענה לימודי | טיפול חכם",
          SKU: "TEACHER-MONTHLY",
          Duration_Months: 1,
        },
        Quantity: 1,
        UnitPrice: opts.grossPrice,
        Recurrence: 999,
        ...(opts.firstChargeDate ? { Date_Start: opts.firstChargeDate } : {}),
      },
    ],
    VATIncluded: true,
    UpdateCustomerByEmail: true,
    UpdateCustomerByEmail_AttachDocument: true,
    SendCopyToOrganization: true,
    PreventStandingOrder: false,
  });
  if (!opts.firstChargeDate) {
    assertChargeSucceeded(charge, "teacher subscription charge");
  }
  if (
    !charge.RecurringItemID &&
    Array.isArray(charge.RecurringCustomerItemIDs) &&
    charge.RecurringCustomerItemIDs.length > 0
  ) {
    charge.RecurringItemID = charge.RecurringCustomerItemIDs[0];
  }
  if (!charge.RecurringItemID) {
    try {
      const items = await listRecurringForCustomer({ externalIdentifier: externalId, includeInactive: false });
      const newest = items
        .filter((i) => SUMIT_RECURRING_ACTIVE_STATUSES.includes(Number(i.Status)))
        .sort((a, b) => Number(b.ID) - Number(a.ID))[0];
      if (newest) charge.RecurringItemID = newest.ID;
    } catch (e) {
      console.error("createTeacherSubscription: failed to resolve RecurringItemID:", e);
    }
  }
  return charge;
}

// ---------- Therapy-center subscription ----------
//
// Same recurring/charge endpoint as therapist subscriptions, with two
// differences: a per-center negotiated price, and optional GIFT MONTHS -
// implemented with the documented `Date_Start` field on the recurring item
// ("First payment date. Defaults to the current date."), so the card is
// tokenized and the standing order created NOW, but the first charge happens
// only when the gift ends. With a future Date_Start there is no immediate
// payment, so charge validation switches from "payment valid" to "standing
// order exists".

export async function createCenterSubscription(opts: {
  centerId: string;
  centerName: string;
  payerName: string;
  payerEmail: string;
  payerPhone?: string;
  companyNumber?: string; // ח.פ / עוסק מורשה - מודפס על החשבונית
  singleUseToken: string;
  unitPrice: number;      // הסכום החודשי הכולל שסוכם, לפני מע"מ (לפי מסלול המרכז)
  therapistCount?: number; // מספר המטפלים (מסלול 1) - מודפס בשם הפריט; 0/ריק במסלול 2 (מרכז כישות)
  firstChargeDate?: string; // "YYYY-MM-DD"; מוגדר רק כשיש חודשי מתנה
}): Promise<SubscriptionChargeResult> {
  const externalId = `center:${opts.centerId}`;
  // Quantity=1, UnitPrice=הסכום הכולל - כדי שעדכון מחיר/מספר-מטפלים בעתיד יעבור
  // דרך updateRecurringPrice (שמעדכן UnitPrice) בלי לגעת בכמות ב-Sumit.
  const charge = await api<SubscriptionChargeResult>("/billing/recurring/charge/", {
    Customer: {
      ExternalIdentifier: externalId,
      SearchMode: 0,
      Name: opts.payerName || opts.centerName,
      EmailAddress: opts.payerEmail,
      Phone: opts.payerPhone || null,
      CompanyNumber: opts.companyNumber || null,
    },
    SingleUseToken: opts.singleUseToken,
    Items: [
      {
        Item: {
          Name: `מנוי חודשי למרכז טיפולי${opts.therapistCount && opts.therapistCount > 0 ? ` - ${opts.therapistCount} מטפלים` : ""} | טיפול חכם`,
          SKU: "CENTER-MONTHLY",
          Duration_Months: 1,
        },
        Quantity: 1,
        UnitPrice: opts.unitPrice,
        Recurrence: 999, // עד ביטול, כמו מנויי מטפלים
        ...(opts.firstChargeDate ? { Date_Start: opts.firstChargeDate } : {}),
      },
    ],
    VATIncluded: false,
    UpdateCustomerByEmail: true,
    UpdateCustomerByEmail_AttachDocument: true,
    SendCopyToOrganization: true,
    PreventStandingOrder: false,
  });

  if (!opts.firstChargeDate) {
    // חיוב מיידי - אותה ולידציה כמו מנוי מטפל: דחיית כרטיס חייבת לעצור כאן.
    assertChargeSucceeded(charge, "center subscription charge");
  }
  // עם Date_Start עתידי אין תשלום מיידי לוודא; הצלחת המעטפת (Status=0)
  // פירושה שהוראת הקבע נוצרה והכרטיס נשמר.

  if (
    !charge.RecurringItemID &&
    Array.isArray(charge.RecurringCustomerItemIDs) &&
    charge.RecurringCustomerItemIDs.length > 0
  ) {
    charge.RecurringItemID = charge.RecurringCustomerItemIDs[0];
  }
  if (!charge.RecurringItemID) {
    try {
      const items = await listRecurringForCustomer({
        externalIdentifier: externalId,
        includeInactive: false,
      });
      const newest = items
        .filter((i) => i.Status === 0)
        .sort((a, b) => Number(b.ID) - Number(a.ID))[0];
      if (newest) charge.RecurringItemID = newest.ID;
    } catch (e) {
      console.error("createCenterSubscription: failed to resolve RecurringItemID:", e);
    }
  }

  return charge;
}

// ---------- Cancel a standing order ----------
//
// Sumit's /billing/recurring/cancel takes the customer (resolved by
// ExternalIdentifier) plus the recurring-order id in the
// `RecurringCustomerItemID` field. Passing the id in a generic `ID` field
// returns "Customer item not found" - that was the long-standing F1 bug.
// Verified live against a real standing order on 2026-06-17.
export async function cancelSubscription(opts: {
  recurringItemId: number;
  customerExternalId: string;
}): Promise<void> {
  await api("/billing/recurring/cancel/", {
    Customer: { ExternalIdentifier: opts.customerExternalId, SearchMode: 0 },
    RecurringCustomerItemID: opts.recurringItemId,
  });

  // VERIFY the cancel actually took effect at Sumit. This is the crux of the
  // fix: previously a request that returned without throwing - or a cancel
  // that silently didn't apply - could leave the standing order ACTIVE at
  // Sumit while the caller recorded it as cancelled locally, charging the
  // customer every month with nothing left to catch it. We re-read the item
  // and throw if it's still active, so a "successful" cancel always means the
  // card will genuinely stop being charged.
  const after = await listRecurringForCustomer({
    externalIdentifier: opts.customerExternalId,
    includeInactive: true,
  });
  // "עדיין חיה" = פעילה (0) או מתוזמנת לעתיד (12) — שתיהן יחייבו את הכרטיס.
  const stillActive = after.find(
    (i) => Number(i.ID) === opts.recurringItemId && SUMIT_RECURRING_ACTIVE_STATUSES.includes(Number(i.Status))
  );
  if (stillActive) {
    throw new Error(
      `Sumit cancel did not take effect: recurring item ${opts.recurringItemId} is still active (status=${stillActive.Status})`
    );
  }
}

// ---------- Cancel every live standing order of a customer ----------
//
// For "this customer must not be charged again": a centre whose subscription
// the admin stops, or turns into a gift. cancelSubscription() above takes the
// one order id we have on file. That is not enough here - an order we do not
// have on file (a duplicate, or a centre saved without its id) would keep
// charging the card of a customer we have just told is no longer billed.
//
// "Live" here is wider than SUMIT_RECURRING_ACTIVE_STATUSES: it is every order
// that has not ended (SUMIT_RECURRING_ENDED_STATUSES below). An order disabled
// after a failed payment (3), in its grace period (11) or waiting for a retry
// (14) is not charging today, and may charge tomorrow - one in status 3 did,
// on 16/8/2026, which is why the daily sync refuses to read it as cancelled.
// Leaving such an order behind would charge a customer we had told is stopped.
//
// Cancels each one, then re-reads the customer once and throws if any of them
// is still not ended, so a result always means the card will not be charged
// again. Returns the ids it cancelled; an empty list means nothing was live.
// On a failure the caller must not record the customer as stopped; orders
// cancelled before the failure stay cancelled, and a second call finishes the
// rest.
export async function cancelLiveOrdersForCustomer(customerExternalId: string): Promise<number[]> {
  const read = () =>
    listRecurringForCustomer({ externalIdentifier: customerExternalId, includeInactive: true });
  const mayCharge = (i: RecurringItem) => !SUMIT_RECURRING_ENDED_STATUSES.includes(Number(i.Status));

  const live = (await read()).filter(mayCharge);
  if (live.length === 0) return [];

  for (const item of live) {
    // Same request as cancelSubscription; the check comes once, after all of them.
    await api("/billing/recurring/cancel/", {
      Customer: { ExternalIdentifier: customerExternalId, SearchMode: 0 },
      RecurringCustomerItemID: Number(item.ID),
    });
  }

  const cancelled = live.map((i) => Number(i.ID));
  const survivors = (await read()).filter((i) => cancelled.includes(Number(i.ID)) && mayCharge(i));
  if (survivors.length > 0) {
    throw new Error(
      `Sumit cancel did not take effect: ${survivors
        .map((i) => `recurring item ${i.ID} (status=${i.Status})`)
        .join(", ")} still alive for ${customerExternalId}`
    );
  }
  return cancelled;
}

// ---------- Update the price of an existing standing order ----------
//
// Sumit endpoint POST /billing/recurring/update/ - identifies the order by
// RecurringCustomerItemID (same field as cancel) and sets a new UnitPrice.
// Used to auto-revert the early-bird promo (₪90 → ₪140) after 3 cycles, the
// gift-trial follow-on step, and a centre's price change from the admin, all
// without touching the customer's saved card.
//
// **The price here is gross.** The charge endpoint takes net prices and a
// VATIncluded:false flag and grosses them itself; the update endpoint has no
// VATIncluded parameter at all (Sumit's own API schema), and the UnitPrice it
// writes is the same field that a created order reads back from - which is
// gross: four live orders on 23/9/2026 read 106.2, 165.2, 283.2 and 826 for
// 90, 140, 240 and 700 + VAT. Sending the net price would therefore have set
// the standing order to ₪140 *including* VAT, ₪25.20 a month below the price
// the therapist agreed to, and the check below - which compared against that
// same net number - would have reported success. Nothing had been charged
// wrongly yet: the first revert was due the next morning.
//
// Callers keep passing the net price, as everywhere else in the codebase.
export async function updateRecurringPrice(opts: {
  recurringItemId: number;
  customerExternalId: string;
  /** Price before VAT, as quoted to the customer and stored in the DB. */
  unitPrice: number;
}): Promise<void> {
  const gross = priceWithVat(opts.unitPrice);

  const read = async (phase: "before" | "after update"): Promise<RecurringItem> => {
    const items = await listRecurringForCustomer({
      externalIdentifier: opts.customerExternalId,
      includeInactive: true,
    });
    const item = items.find((i) => Number(i.ID) === opts.recurringItemId);
    // 12 = מתוזמנת (חודשי מתנה) — עדכון מחיר עליה תקין; לדרוש דווקא 0 היה
    // מפיל עריכת מחיר של מרכז בתקופת מתנה למרות שהעדכון הצליח ב-Sumit.
    if (!item || !SUMIT_RECURRING_ACTIVE_STATUSES.includes(Number(item.Status))) {
      throw new Error(
        `Sumit update did not take effect: recurring item ${opts.recurringItemId} not active (${phase}, status=${item?.Status ?? "missing"})`
      );
    }
    return item;
  };
  const readBack = () => read("after update");

  const send = async (price: number) => {
    await api("/billing/recurring/update/", {
      Customer: { ExternalIdentifier: opts.customerExternalId, SearchMode: 0 },
      RecurringCustomerItemID: opts.recurringItemId,
      UnitPrice: price,
    });
    return readBack();
  };

  // Agorot-level comparison: the stored price is the one the card will be
  // charged, so "close enough" is an agora, not a shekel. A response without a
  // numeric price tells us nothing either way, and counts as a match - the
  // same benefit of the doubt the previous check gave it.
  const matches = (value: unknown, target: number) =>
    typeof value !== "number" || Math.abs(value - target) <= 0.01;

  const before = await read("before");
  let item = await send(gross);
  if (matches(item.UnitPrice, gross)) return;

  // The gross reading above is measured, not documented, so handle the one
  // other way Sumit could read this field: if it added VAT on top of what we
  // sent, the order is now above the agreed price. Correct it immediately with
  // the net price - the same number the create path sends - rather than leave
  // a customer facing an overcharge until the next cron run.
  if (matches(item.UnitPrice, priceWithVat(gross))) {
    console.warn(
      `Sumit applied VAT to the update of item ${opts.recurringItemId} (read ${item.UnitPrice} for ${gross}); resending ${opts.unitPrice}.`
    );
    item = await send(opts.unitPrice);
    if (matches(item.UnitPrice, gross)) return;
  }

  // Neither reading explains it. Put the order back where it was and fail, so
  // the caller (cron: keeps promo_reverts_at and retries; admin: shows an
  // error and does not save) never records a price the order does not have.
  const original = typeof before.UnitPrice === "number" ? before.UnitPrice : null;
  if (original != null && !matches(item.UnitPrice, original)) {
    try {
      await send(original);
    } catch (restoreErr) {
      console.error(
        `Sumit price restore failed for item ${opts.recurringItemId} (left at ${item.UnitPrice}, was ${original}):`,
        restoreErr instanceof Error ? restoreErr.message : restoreErr
      );
    }
  }
  throw new Error(
    `Sumit update price mismatch: item ${opts.recurringItemId} is ${item.UnitPrice}, expected ${gross} (${opts.unitPrice} + VAT)`
  );
}

// ---------- Status sync (daily cron polls this) ----------

// Status enum from live API responses: 0 = active, non-zero = cancelled/
// suspended/expired (Sumit's docs don't enumerate the exact codes).
export interface RecurringItem {
  ID: number;
  Status: number;
  CustomerID?: number;
  Date_NextBilling?: string;
  Date_PreviousBilling?: string;
  Date_Last?: string;
  UnitPrice?: number;
  [k: string]: unknown;
}

// סטטוסי הוראת קבע ב-Sumit — נמדדו אמפירית מול הוראות אמיתיות (4/8/26):
//   0  = פעילה ומחייבת
//   12 = מתוזמנת (Date_Start עתידי — חודשי מתנה): חיה, החיוב הראשון בעתיד
//   1  = מבוטלת
// כל בדיקת "פעילה?" חייבת לקבל גם 12 — אחרת מרכז בחודשי מתנה נקרא בטעות
// "מבוטל" (ה-cron ביטל מנוי אמיתי בגלל זה). ביטול-אוטומטי מותר רק על 1.
export const SUMIT_RECURRING_ACTIVE_STATUSES: readonly number[] = [0, 12];
export const SUMIT_RECURRING_CANCELLED_STATUS = 1;
// The statuses after which Sumit will not charge an order again, from Sumit's
// own enum (RecurringCustomerItemStatus in the swagger): Cancelled (1),
// FinishedExpired (9), CancelledByCustomer (13). The rest of the enum can
// still charge: Active (0), PendingForFirstPayment (12), and the three
// in-between ones - DisabledFailedBillingPayment (3), GracePeriod (11),
// PendingRetry (14). Used where the question is "can this card still be
// charged", which is stricter than "is this order active".
export const SUMIT_RECURRING_ENDED_STATUSES: readonly number[] = [1, 9, 13];

export async function listRecurringForCustomer(opts: {
  externalIdentifier: string;
  includeInactive?: boolean;
}): Promise<RecurringItem[]> {
  // Sumit wraps the list as { RecurringItems: [...] } inside the envelope's Data.
  const data = await api<{ RecurringItems?: RecurringItem[] }>(
    "/billing/recurring/listforcustomer/",
    {
      Customer: {
        ExternalIdentifier: opts.externalIdentifier,
        SearchMode: 0,
      },
      IncludeInactive: opts.includeInactive ?? false,
    }
  );
  return data.RecurringItems ?? [];
}

// ---------- Accounting documents (read-only) ----------
//
// /accounting/documents/list/ returns the documents Sumit actually issued - the
// books - as opposed to the standing orders above. It is the only place a
// credit note shows up: a refund never passes through the charge flow, so
// `payments` has never recorded one. Nothing here issues, sends or cancels a
// document.
//
// Two traps, both measured on the live account on 29/9/2026:
// - Without Paging the endpoint returns 10 documents, and says nothing about it.
// - DocumentValue includes VAT, and it is negative on a credit.

export interface SumitListedDocument {
  DocumentID: number;
  DocumentNumber?: number | null;
  // Accounting_Typed_DocumentType, numeric on the wire like Status.
  Type: number;
  // "2026-09-18T00:00:00" - the day printed on the document.
  Date?: string | null;
  Currency?: number | null;
  // In the document's currency / in shekels. The same number for a shekel
  // document, which every document on this account has been so far.
  DocumentValue?: number | null;
  CompanyValue?: number | null;
  CustomerID?: number | null;
  IsDraft?: boolean | null;
  [k: string]: unknown;
}

const DOCUMENTS_PAGE_SIZE = 200;

export async function listDocuments(opts: {
  /** "YYYY-MM-DD", inclusive. */
  dateFrom: string;
  /** "YYYY-MM-DD". */
  dateTo: string;
  /** Each page is one quota-counted call. */
  maxPages?: number;
}): Promise<{ documents: SumitListedDocument[]; calls: number; truncated: boolean }> {
  const maxPages = opts.maxPages ?? 5;
  const byId = new Map<number, SumitListedDocument>();
  let calls = 0;
  let start = 0;
  let truncated = false;
  for (;;) {
    calls++;
    const data = await api<{ Documents?: SumitListedDocument[] | null; HasNextPage?: boolean }>(
      "/accounting/documents/list/",
      {
        DateFrom: opts.dateFrom,
        DateTo: opts.dateTo,
        IncludeDrafts: false,
        Paging: { StartIndex: start, PageSize: DOCUMENTS_PAGE_SIZE },
      }
    );
    const page = data.Documents ?? [];
    let fresh = 0;
    for (const d of page) {
      if (typeof d.DocumentID === "number" && !byId.has(d.DocumentID)) {
        byId.set(d.DocumentID, d);
        fresh++;
      }
    }
    // A page that adds nothing new means the paging did not move; stop rather
    // than spend the quota re-reading it.
    if (!data.HasNextPage || fresh === 0) break;
    if (calls >= maxPages) {
      truncated = true;
      break;
    }
    start += page.length;
  }
  return { documents: [...byId.values()], calls, truncated };
}
