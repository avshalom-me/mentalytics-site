const API_BASE =
  process.env.MORNING_API_BASE || "https://api.greeninvoice.co.il/api/v1";

let cached: { token: string; exp: number } | null = null;

async function getToken(): Promise<string> {
  if (cached && cached.exp > Date.now()) return cached.token;

  const res = await fetch(`${API_BASE}/account/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: process.env.MORNING_API_KEY,
      secret: process.env.MORNING_API_SECRET,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Morning auth failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  cached = { token: data.token, exp: Date.now() + 50 * 60_000 };
  return data.token;
}

async function api(path: string, body: Record<string, unknown>) {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Morning ${path} failed (${res.status}): ${text}`);
  }

  return res.json();
}

async function apiGet(path: string) {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Morning GET ${path} failed (${res.status}): ${text}`);
  }

  return res.json();
}

// Fetch a payment / document by id to verify it actually completed
// at Morning, with the expected amount. Used by the webhook to defend
// against forged callbacks even if the URL secret leaks.
export interface MorningDocument {
  id: string;
  status?: number;
  paymentsSum?: number;
  amount?: number;
  income?: { price: number }[];
  [k: string]: unknown;
}

export async function fetchDocument(docId: string): Promise<MorningDocument> {
  return apiGet(`/documents/${encodeURIComponent(docId)}`);
}

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.mentalytics.co.il";
const NOTIFY_URL = process.env.MORNING_WEBHOOK_SECRET
  ? `${BASE_URL}/api/webhooks/morning?secret=${encodeURIComponent(process.env.MORNING_WEBHOOK_SECRET)}`
  : `${BASE_URL}/api/webhooks/morning`;

export interface PaymentFormResult {
  errorCode: number;
  url: string;
}

export async function createSubscriptionPayment(opts: {
  therapistId: string;
  therapistName: string;
  therapistEmail: string;
  therapistPhone?: string;
  paymentId: string;
}): Promise<PaymentFormResult> {
  const client: Record<string, unknown> = {
    name: opts.therapistName,
    emails: [opts.therapistEmail],
    add: true,
  };
  if (opts.therapistPhone) client.phone = opts.therapistPhone;

  return api("/payments/form", {
    type: 320,
    lang: "he",
    currency: "ILS",
    vatType: 0,
    amount: 120,
    maxPayments: 1,
    pluginId: process.env.MORNING_PLUGIN_ID,
    description: "מנוי חודשי — מסלול מקודם | טיפול חכם",
    client,
    income: [
      {
        catalogNum: "PROMOTED-MONTHLY",
        description: "מנוי מטפל חודשי — מסלול מקודם",
        quantity: 1,
        price: 120,
        currency: "ILS",
        vatType: 0,
      },
    ],
    successUrl: `${BASE_URL}/therapists/payment/success`,
    failureUrl: `${BASE_URL}/therapists/payment/failure`,
    notifyUrl: NOTIFY_URL,
    custom: JSON.stringify({
      type: "subscription",
      paymentId: opts.paymentId,
      therapistId: opts.therapistId,
    }),
  });
}

export async function createQuizPayment(opts: {
  fingerprint: string;
  ip: string;
  quizType: string;
  paymentId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}): Promise<PaymentFormResult> {
  return api("/payments/form", {
    type: 320,
    lang: "he",
    currency: "ILS",
    vatType: 0,
    amount: 30,
    maxPayments: 1,
    pluginId: process.env.MORNING_PLUGIN_ID,
    description: "שאלון התאמה לטיפול | טיפול חכם",
    client: {
      name: opts.customerName,
      emails: [opts.customerEmail],
      phone: opts.customerPhone,
      add: true,
    },
    income: [
      {
        catalogNum: "QUIZ-SINGLE",
        description: "שימוש בשאלון התאמה לטיפול",
        quantity: 1,
        price: 30,
        currency: "ILS",
        vatType: 0,
      },
    ],
    successUrl: `${BASE_URL}/quiz/payment-success?type=${opts.quizType}`,
    failureUrl: `${BASE_URL}/quiz/payment-failure`,
    notifyUrl: NOTIFY_URL,
    custom: JSON.stringify({
      type: "quiz",
      paymentId: opts.paymentId,
      fingerprint: opts.fingerprint,
      ip: opts.ip,
      quizType: opts.quizType,
    }),
  });
}

export async function chargeToken(
  tokenId: string,
  opts: {
    therapistName: string;
    therapistEmail: string;
    paymentId: string;
    therapistId: string;
  }
) {
  return api(`/payments/tokens/${tokenId}/charge`, {
    type: 320,
    lang: "he",
    currency: "ILS",
    vatType: 0,
    amount: 120,
    maxPayments: 1,
    description: "מנוי חודשי — מסלול מקודם | טיפול חכם",
    client: {
      name: opts.therapistName,
      emails: [opts.therapistEmail],
    },
    income: [
      {
        catalogNum: "PROMOTED-MONTHLY",
        description: "מנוי מטפל חודשי — מסלול מקודם",
        quantity: 1,
        price: 120,
        currency: "ILS",
        vatType: 0,
      },
    ],
    notifyUrl: NOTIFY_URL,
    custom: JSON.stringify({
      type: "subscription_renewal",
      paymentId: opts.paymentId,
      therapistId: opts.therapistId,
    }),
  });
}

export async function searchTokens(externalKey: string) {
  return api("/payments/tokens/search", { externalKey });
}
