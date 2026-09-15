import { describe, it, expect, vi, beforeEach } from "vitest";

// sendInquiryEmail is the one place a site inquiry (to a therapist, a centre,
// or the contact form) leaves the server. The contract under test is the one
// that was missing until 15/9/26: a rejection from Resend is reported to the
// caller AND recorded in crm_email_log, and a success is recorded too.

const { sendMock, logMock } = vi.hoisted(() => ({
  sendMock: vi.fn<(payload: Record<string, unknown>) => Promise<{ data: { id: string } | null; error: { name: string; message: string } | null }>>(),
  logMock: vi.fn<(entry: unknown) => Promise<void>>(),
}));

vi.mock("server-only", () => ({}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));
vi.mock("./email-log", () => ({ logEmail: logMock }));

import { sendInquiryEmail, INQUIRY_SEND_FAILED_MESSAGE } from "./inquiry-send";

const mail = {
  to: "office@example.co.il",
  subject: "פנייה חדשה",
  html: "<p>שלום</p>",
};
const record = { template: "patient_inquiry" as const, recipientType: "organization" as const, entityId: "c-1" };

beforeEach(() => {
  sendMock.mockReset();
  logMock.mockClear();
});

describe("sendInquiryEmail", () => {
  it("reports success and logs a sent row", async () => {
    sendMock.mockResolvedValue({ data: { id: "re_123" }, error: null });
    const res = await sendInquiryEmail(mail, record);
    expect(res).toEqual({ ok: true, id: "re_123" });
    expect(logMock).toHaveBeenCalledTimes(1);
    expect(logMock.mock.calls[0][0]).toMatchObject({
      recipient: mail.to,
      recipientType: "organization",
      entityId: "c-1",
      template: "patient_inquiry",
      status: "sent",
    });
  });

  it("reports a Resend rejection instead of swallowing it, and logs it as failed", async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: { name: "daily_quota_exceeded", message: "You have reached your daily email sending quota." },
    });
    const res = await sendInquiryEmail(mail, record);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("daily email sending quota");
    expect(logMock.mock.calls[0][0]).toMatchObject({
      status: "failed",
      error: expect.stringContaining("daily email sending quota"),
    });
  });

  it("treats a thrown error (network) as a failed send, never as a crash", async () => {
    sendMock.mockRejectedValue(new Error("fetch failed"));
    const res = await sendInquiryEmail(mail, record);
    expect(res).toEqual({ ok: false, error: "fetch failed" });
    expect(logMock.mock.calls[0][0]).toMatchObject({ status: "failed", error: "fetch failed" });
  });

  it("passes replyTo only when the sender left an email", async () => {
    sendMock.mockResolvedValue({ data: { id: "re_1" }, error: null });
    await sendInquiryEmail(mail, record);
    expect(sendMock.mock.calls[0][0]).not.toHaveProperty("replyTo");
    await sendInquiryEmail({ ...mail, replyTo: "patient@example.com" }, record);
    expect(sendMock.mock.calls[1][0]).toMatchObject({ replyTo: "patient@example.com", to: mail.to });
  });

  it("the message shown to the sender follows the no-em-dash rule", () => {
    expect(INQUIRY_SEND_FAILED_MESSAGE).not.toContain("—");
  });
});
