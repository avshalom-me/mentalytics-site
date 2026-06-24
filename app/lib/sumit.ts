// Sumit API client — credit card processing + automatic recurring billing.
//
// Architecture:
// - Frontend uses Sumit's Payments JS SDK with SUMIT_API_PUBLIC_KEY to
//   tokenize the card client-side. The raw card number never reaches our
//   server (PCI scope minimised).
// - This module runs on the server with SUMIT_API_KEY and accepts the
//   SingleUseToken from the frontend, then calls /billing/recurring/charge
//   for subscriptions or /billing/payments/charge for one-offs.
// - Sumit creates the standing order automatically and charges the saved
//   token every month on its own servers — there is no client-side cron
//   for renewals. We poll /billing/recurring/listforcustomer once a day
//   to sync any status changes (failed charge, customer-initiated cancel
//   from Sumit's portal, etc.).
//
// Refs:
//   https://app.sumit.co.il/help/developers/swagger/index.html
//   https://help.sumit.co.il/he/articles/5833033 (charging with API)

import { SUBSCRIPTION_REGULAR_PRICE } from "@/app/lib/promo";

const API_BASE = process.env.SUMIT_API_BASE || "https://api.sumit.co.il";

// Israeli VAT, 18% since 2025-01-01. VATIncluded=false on charge bodies tells
// Sumit to add VAT on top of UnitPrice and report it cleanly on the invoice.
const VAT_RATE = 0.18;
export const QUIZ_BASE_PRICE = 30;
// Regular monthly price. Single source of truth lives in app/lib/promo.ts so
// client/server/cron never diverge.
export const SUBSCRIPTION_BASE_PRICE = SUBSCRIPTION_REGULAR_PRICE;
export const QUIZ_TOTAL = +(QUIZ_BASE_PRICE * (1 + VAT_RATE)).toFixed(2);
export const SUBSCRIPTION_TOTAL = +(SUBSCRIPTION_BASE_PRICE * (1 + VAT_RATE)).toFixed(2);

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
    throw new Error(`Sumit ${path} business error: ${msg}`);
  }
  return env.Data;
}

// ---------- One-off charge (quiz) ----------

export interface OneOffChargeResult {
  DocumentID?: number;
  DocumentURL?: string;
  CustomerID?: number;
  // Sumit returns more fields; we keep this loose because we don't depend
  // on most of them downstream — the document/customer ids are what we
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
  return api<OneOffChargeResult>("/billing/payments/charge/", {
    Customer: {
      ExternalIdentifier: `fp:${opts.fingerprint}`,
      SearchMode: 0, // Automatic — find-or-create by ExternalIdentifier
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
}

// ---------- Subscription (charge + create standing order) ----------

export interface SubscriptionChargeResult {
  DocumentID?: number;
  CustomerID?: number;
  RecurringItemID?: number; // Sumit's id for the standing order
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
          Name: "מנוי חודשי — מסלול מקודם | טיפול חכם",
          SKU: "PROMOTED-MONTHLY",
          Duration_Months: 1,
        },
        Quantity: 1,
        UnitPrice: opts.unitPrice ?? SUBSCRIPTION_BASE_PRICE,
        // Recurrence is how many times Sumit will charge after the first.
        // 999 = effectively "until cancelled". We control cancellation via
        // the cancelSubscription endpoint below.
        Recurrence: 999,
      },
    ],
    VATIncluded: false,
    // Email the customer the receipt automatically on each charge — Sumit
    // does NOT do this by default for /billing/recurring/charge (unlike
    // /billing/payments/charge which has SendDocumentByEmail). For recurring
    // the correct flag is UpdateCustomerByEmail + the attach toggle.
    UpdateCustomerByEmail: true,
    UpdateCustomerByEmail_AttachDocument: true,
    SendCopyToOrganization: true,
    PreventStandingOrder: false, // explicit: create the standing order
  });

  // /billing/recurring/charge returns the document + customer but does not
  // surface the new RecurringItem ID in any reliable field name (verified
  // via live testing — DocumentID was 1895650732, no RecurringItemID was
  // populated in the Data envelope). Look it up by ExternalIdentifier so
  // we can store it for later cancel/sync calls.
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

// ---------- Cancel a standing order ----------
//
// Sumit's /billing/recurring/cancel takes the customer (resolved by
// ExternalIdentifier) plus the recurring-order id in the
// `RecurringCustomerItemID` field. Passing the id in a generic `ID` field
// returns "Customer item not found" — that was the long-standing F1 bug.
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
  // fix: previously a request that returned without throwing — or a cancel
  // that silently didn't apply — could leave the standing order ACTIVE at
  // Sumit while the caller recorded it as cancelled locally, charging the
  // customer every month with nothing left to catch it. We re-read the item
  // and throw if it's still active, so a "successful" cancel always means the
  // card will genuinely stop being charged.
  const after = await listRecurringForCustomer({
    externalIdentifier: opts.customerExternalId,
    includeInactive: true,
  });
  const stillActive = after.find(
    (i) => Number(i.ID) === opts.recurringItemId && i.Status === 0
  );
  if (stillActive) {
    throw new Error(
      `Sumit cancel did not take effect: recurring item ${opts.recurringItemId} is still active`
    );
  }
}

// ---------- Update the price of an existing standing order ----------
//
// Sumit endpoint POST /billing/recurring/update/ — identifies the order by
// RecurringCustomerItemID (same field as cancel) and sets a new UnitPrice.
// Used to auto-revert the early-bird promo (₪90 → ₪140) after 3 cycles
// without touching the customer's saved card. We re-read the item afterwards
// and throw unless the new price actually applied — money-critical, so a
// "success" here must mean the next charge will be at the new amount.
export async function updateRecurringPrice(opts: {
  recurringItemId: number;
  customerExternalId: string;
  unitPrice: number;
}): Promise<void> {
  await api("/billing/recurring/update/", {
    Customer: { ExternalIdentifier: opts.customerExternalId, SearchMode: 0 },
    RecurringCustomerItemID: opts.recurringItemId,
    UnitPrice: opts.unitPrice,
  });

  const after = await listRecurringForCustomer({
    externalIdentifier: opts.customerExternalId,
    includeInactive: true,
  });
  const item = after.find((i) => Number(i.ID) === opts.recurringItemId);
  if (!item || item.Status !== 0) {
    throw new Error(
      `Sumit update did not take effect: recurring item ${opts.recurringItemId} not active after update`
    );
  }
  if (typeof item.UnitPrice === "number" && Math.round(item.UnitPrice) !== Math.round(opts.unitPrice)) {
    throw new Error(
      `Sumit update price mismatch: item ${opts.recurringItemId} is ${item.UnitPrice}, expected ${opts.unitPrice}`
    );
  }
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
