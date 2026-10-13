import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// /api/developers sends a real email on every call. Until 13/10/2026 it had no
// ceiling at all - the only public mail-sending route without one - so a loop
// of a hundred requests could use up the site's daily Resend allowance and
// stop patient messages and sign-up mails for the rest of the day. The limit
// here is the one /api/contact has had since 15/9/26.
const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

import { POST } from "@/app/api/developers/route";

// Invented sender; no real person.
const valid = { name: "פלוני אלמוני", email: "someone@example.com", description: "רעיון לכלי" };

let n = 0;
function post(body: unknown, ip?: string) {
  n++;
  return POST(
    new NextRequest("http://localhost/api/developers", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip ?? `10.9.${Math.floor(n / 200)}.${(n % 200) + 1}` },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  sendMock.mockReset();
  sendMock.mockResolvedValue({ data: { id: "re_1" }, error: null });
});

describe("/api/developers", () => {
  it("sends the inquiry with the sender's address as reply-to", async () => {
    const res = await post({ ...valid, email: " someone@example.com " });
    expect(res.status).toBe(200);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0]).toMatchObject({ replyTo: "someone@example.com" });
  });

  it("stops the sixth submission from one address within the hour, and says when to retry", async () => {
    const ip = "10.8.0.1";
    for (let i = 0; i < 5; i++) expect((await post(valid, ip)).status).toBe(200);
    const sixth = await post(valid, ip);
    expect(sixth.status).toBe(429);
    expect(Number(sixth.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(sendMock).toHaveBeenCalledTimes(5);
    // Another address is not held back by it.
    expect((await post(valid, "10.8.0.2")).status).toBe(200);
  });

  it("refuses an address that is not an email, before anything is sent", async () => {
    const res = await post({ ...valid, email: "not-an-address" });
    expect(res.status).toBe(400);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("still asks for the required fields", async () => {
    expect((await post({ email: "someone@example.com" })).status).toBe(400);
    expect(sendMock).not.toHaveBeenCalled();
  });
});
