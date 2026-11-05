import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// A card charge to a school has three kinds of failure and only two of them
// are known not to have charged. A decline (Payment.ValidPayment=false) and a
// refusal of the request itself (Status other than 0) release the claim on the
// payment so the school can try again. A network failure, a timeout or an
// unreadable answer leave the outcome unknown: the card may have been charged,
// so the claim stays and no second charge can be taken for ten minutes.
const m = vi.hoisted(() => {
  class Declined extends Error {
    declineCode: string | null = "004";
  }
  class Business extends Error {}
  return {
    Declined,
    Business,
    charge: vi.fn(),
    page: vi.fn(),
    claim: vi.fn(),
    release: vi.fn(),
    mark: vi.fn(),
    code: vi.fn(),
  };
});
const { Declined, Business } = m;

vi.mock("server-only", () => ({}));
vi.mock("@/app/lib/sumit", () => ({ chargeSchoolPayment: m.charge, SumitPaymentDeclinedError: m.Declined, SumitBusinessError: m.Business }));
vi.mock("@/app/lib/schools-crm.server", () => ({
  PAY_PAGE_VIEWER: { role: "owner", name: "דף התשלום" },
  getPayPage: m.page,
  claimPaymentForCard: m.claim,
  releasePaymentClaim: m.release,
  markPaymentReceived: m.mark,
  licenseAccessCode: m.code,
}));
vi.mock("@/app/lib/daily-cap", () => ({ underDailyCap: async () => true }));
vi.mock("@/app/lib/usage", () => ({ getIp: () => "10.0.0.1" }));

import { POST } from "@/app/api/school-pay/[license]/route";

const LICENSE = "6f1c2d3e-0000-4000-8000-000000000001";
const body = { singleUseToken: "tok", payerName: "בית ספר לדוגמה", payerEmail: "office@example.com", payerPhone: "0500000000" };
const post = () =>
  POST(new NextRequest(`http://localhost/api/school-pay/${LICENSE}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), {
    params: Promise.resolve({ license: LICENSE }),
  });

const payPage = {
  open: true,
  next: { id: "pay-1", seq: 1, amount_gross: 750 },
  license: { school_id: "school-1", kind: "annual", school_year: "2026/27" },
  school: { name: "בית ספר לדוגמה", symbol: null },
  payments: [{ id: "pay-1" }],
};

beforeEach(() => {
  for (const f of [m.charge, m.page, m.claim, m.release, m.mark, m.code]) f.mockReset();
  m.page.mockResolvedValue(payPage);
  m.claim.mockResolvedValue(true);
  m.release.mockResolvedValue(undefined);
  m.mark.mockResolvedValue({});
  m.code.mockResolvedValue({ status: "active", access_code: "ABCD-2345" });
});

describe("/api/school-pay POST - card charge outcomes", () => {
  it("a charge that went through marks the payment and hands over the code", async () => {
    m.charge.mockResolvedValue({ DocumentID: 11, DocumentNumber: 22 });
    const res = await post();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, license_active: true, access_code: "ABCD-2345" });
    expect(m.mark).toHaveBeenCalledTimes(1);
    expect(m.release).not.toHaveBeenCalled();
  });

  it("a decline releases the claim, so the school can try another card", async () => {
    m.charge.mockRejectedValue(new Declined("declined"));
    const res = await post();
    expect(res.status).toBe(402);
    expect(m.release).toHaveBeenCalledWith("pay-1");
    expect(m.mark).not.toHaveBeenCalled();
  });

  it("Sumit refusing the request itself releases the claim: nothing was charged", async () => {
    m.charge.mockRejectedValue(new Business("bad token"));
    const res = await post();
    expect(res.status).toBe(502);
    expect(m.release).toHaveBeenCalledWith("pay-1");
  });

  it("an unknown outcome keeps the claim and says not to try again", async () => {
    m.charge.mockRejectedValue(new Error("Sumit /billing/payments/charge/ HTTP 504"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await post();
    const j = await res.json();
    expect(res.status).toBe(502);
    expect(m.release).not.toHaveBeenCalled();
    expect(m.mark).not.toHaveBeenCalled();
    expect(j.error).toContain("לא לנסות שוב");
    expect(spy.mock.calls[0][0]).toContain("CRITICAL");
    spy.mockRestore();
  });

  it("a payment already claimed is not charged a second time", async () => {
    m.claim.mockResolvedValue(false);
    const res = await post();
    expect(res.status).toBe(409);
    expect(m.charge).not.toHaveBeenCalled();
  });
});
