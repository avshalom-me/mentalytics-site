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

const API_BASE = process.env.SUMIT_API_BASE || "https://api.sumit.co.il";

// Israeli VAT, 18% since 2025-01-01. VATIncluded=false on charge bodies tells
// Sumit to add VAT on top of UnitPrice and report it cleanly on the invoice.
const VAT_RATE = 0.18;
export const QUIZ_BASE_PRICE = 30;
export const SUBSCRIPTION_BASE_PRICE = 120;
export const QUIZ_TOTAL = +(QUIZ_BASE_PRICE * (1 + VAT_RATE)).toFixed(2);
export const SUBSCRIPTION_TOTAL = +(SUBSCRIPTION_BASE_PRICE * (1 + VAT_RATE)).toFixed(2);

function credentials() {
  const id = process.env.SUMIT_COMPANY_ID;
  const key = process.env.SUMIT_API_KEY;
  if (!id || !key) throw new Error("Sumit credentials not configured");
  return { CompanyID: parseInt(id, 10), APIKey: key };
}

// Sumit wraps every response in {Status, UserErrorMessage, TechnicalErrorDetails, Data}.
// Status is typically "Success" on the happy path; anything else is an error.
interface SumitEnvelope<T> {
  Status: string;
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
  if (typeof env.Status === "string" && !env.Status.startsWith("Success")) {
    const msg = env.UserErrorMessage || env.TechnicalErrorDetails || env.Status;
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
}): Promise<SubscriptionChargeResult> {
  return api<SubscriptionChargeResult>("/billing/recurring/charge/", {
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
        UnitPrice: SUBSCRIPTION_BASE_PRICE,
        // Recurrence is how many times Sumit will charge after the first.
        // 999 = effectively "until cancelled". We control cancellation via
        // the cancelSubscription endpoint below.
        Recurrence: 999,
      },
    ],
    VATIncluded: false,
    SendCopyToOrganization: true,
    PreventStandingOrder: false, // explicit: create the standing order
  });
}

// ---------- Cancel a standing order ----------

export async function cancelSubscription(recurringItemId: number): Promise<void> {
  await api("/billing/recurring/cancel/", {
    ID: recurringItemId,
  });
}

// ---------- Status sync (daily cron polls this) ----------

export interface RecurringItem {
  ID: number;
  Status: string; // "Active", "Cancelled", "Suspended", ...
  NextChargeDate?: string;
  LastChargeStatus?: string;
  [k: string]: unknown;
}

export async function listRecurringForCustomer(opts: {
  externalIdentifier: string;
  includeInactive?: boolean;
}): Promise<RecurringItem[]> {
  const data = await api<{ Items?: RecurringItem[] } | RecurringItem[]>(
    "/billing/recurring/listforcustomer/",
    {
      Customer: {
        ExternalIdentifier: opts.externalIdentifier,
        SearchMode: 0,
      },
      IncludeInactive: opts.includeInactive ?? false,
    }
  );
  if (Array.isArray(data)) return data;
  return data.Items ?? [];
}
