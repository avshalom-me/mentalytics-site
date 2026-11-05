import { afterEach, describe, expect, it, vi } from "vitest";

process.env.SUMIT_COMPANY_ID = process.env.SUMIT_COMPANY_ID || "1";
process.env.SUMIT_API_KEY = process.env.SUMIT_API_KEY || "test-key";

import { chargeSchoolPayment, SumitBusinessError, SumitPaymentDeclinedError } from "./sumit";

const opts = {
  schoolId: "school-1",
  schoolName: "בית ספר לדוגמה",
  payerName: "משלמת",
  payerEmail: "office@example.com",
  payerPhone: "0500000000",
  singleUseToken: "tok",
  amountGross: 750,
  itemName: "רישיון שנתי לשאלון היועצות, 2026/27 | טיפול חכם",
};

function fakeSumit(envelope: Record<string, unknown>) {
  const sent: Record<string, unknown>[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: { body: string }) => {
      sent.push(JSON.parse(init.body));
      return { ok: true, json: async () => ({ UserErrorMessage: null, TechnicalErrorDetails: null, ...envelope }) };
    }),
  );
  return sent;
}

afterEach(() => vi.unstubAllGlobals());

describe("chargeSchoolPayment", () => {
  it("charges the school's own Sumit customer, the full price with VAT inside it, once", async () => {
    const sent = fakeSumit({ Status: 0, Data: { DocumentID: 5, Payment: { ValidPayment: true } } });
    const res = await chargeSchoolPayment(opts);
    expect(res.DocumentID).toBe(5);
    expect(sent).toHaveLength(1);
    const b = sent[0] as { Customer: Record<string, unknown>; Items: { UnitPrice: number }[]; VATIncluded: boolean; PreventStandingOrder: boolean };
    expect(b.Customer).toMatchObject({ ExternalIdentifier: "school:school-1", SearchMode: 2 });
    expect(b.Items[0].UnitPrice).toBe(750);
    expect(b.VATIncluded).toBe(true);
    expect(b.PreventStandingOrder).toBe(true);
  });

  it("does not retry with the automatic customer search when Sumit refuses: the payer's email could match someone else's customer", async () => {
    const sent = fakeSumit({ Status: 1, UserErrorMessage: "refused", Data: null });
    await expect(chargeSchoolPayment(opts)).rejects.toBeInstanceOf(SumitBusinessError);
    expect(sent).toHaveLength(1);
  });

  it("a declined card comes back as a decline, not as a success", async () => {
    fakeSumit({ Status: 0, Data: { DocumentID: null, Payment: { ValidPayment: false, Status: "004", StatusDescription: "refused" } } });
    await expect(chargeSchoolPayment(opts)).rejects.toBeInstanceOf(SumitPaymentDeclinedError);
  });
});
