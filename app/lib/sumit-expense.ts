import "server-only";

// Push a CRM-entered expense into Sumit as a DRAFT expense document.
//
// Safety model: IsDraft=true means the document lands in Sumit's drafts and
// does NOT touch the books until a human approves it inside Sumit (the
// accountant reads the books from there). A failure here never blocks the
// local CRM row - the row keeps sumit_status='failed' and can be re-sent.
//
// Amount semantics: we send the GROSS amount actually paid (net + VAT) as
// the line amount, and spell the net/VAT breakdown in the description; the
// approving human confirms the VAT treatment when moving the draft to books.

const API_BASE = process.env.SUMIT_API_BASE || "https://api.sumit.co.il";

type SumitEnvelope<T> = {
  Status: number;
  UserErrorMessage: string | null;
  TechnicalErrorDetails: string | null;
  Data: T | null;
};

function credentials() {
  const id = process.env.SUMIT_COMPANY_ID;
  const key = process.env.SUMIT_API_KEY;
  if (!id || !key) throw new Error("Sumit credentials not configured");
  return { CompanyID: parseInt(id, 10), APIKey: key };
}

export type SumitExpenseDraftInput = {
  date: string; // YYYY-MM-DD
  supplierName: string;
  itemName: string; // expense item/category name as it should appear in Sumit
  amountGross: number; // ₪ actually paid (incl. VAT when applicable)
  description?: string;
  expenseNumber?: string; // the supplier's invoice number
};

export type SumitExpenseDraftResult =
  | { ok: true; documentId: number }
  | { ok: false; error: string };

export async function createSumitExpenseDraft(
  input: SumitExpenseDraftInput
): Promise<SumitExpenseDraftResult> {
  try {
    const body = {
      Credentials: credentials(),
      IsDraft: true, // never touch the books directly
      Date: input.date,
      Supplier: { Name: input.supplierName.slice(0, 200) },
      Lines: [
        {
          Item: { Name: input.itemName.slice(0, 120) },
          Amount: +Number(input.amountGross).toFixed(2),
        },
      ],
      ...(input.expenseNumber ? { ExpenseNumber: input.expenseNumber.slice(0, 60) } : {}),
      ...(input.description ? { Description: input.description.slice(0, 500) } : {}),
    };

    const res = await fetch(`${API_BASE}/accounting/documents/addexpense/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }

    const json = (await res.json()) as SumitEnvelope<{ DocumentID: number }>;
    if (json.Status !== 0 || !json.Data?.DocumentID) {
      return {
        ok: false,
        error: json.UserErrorMessage || json.TechnicalErrorDetails || `Sumit status ${json.Status}`,
      };
    }
    return { ok: true, documentId: json.Data.DocumentID };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown error" };
  }
}
