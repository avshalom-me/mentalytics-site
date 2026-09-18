import { describe, it, expect, vi, beforeEach } from "vitest";

// sendGmailReply is the only path by which an admin-approved inbox reply
// leaves the server. Gmail adds the account signature only in its own compose
// window, never to a message sent through the API - so until 18/9/26 every
// reply went out unsigned. The contract under test: the signature is read from
// the account's sendAs settings and attached to both MIME parts, and a failure
// to read it never blocks the reply itself.
//
// fetch is fully stubbed: nothing here can reach Google.

vi.mock("server-only", () => ({}));

process.env.GMAIL_CLIENT_ID = "test-client";
process.env.GMAIL_CLIENT_SECRET = "test-secret";
process.env.GMAIL_REFRESH_TOKEN = "test-refresh";
process.env.GMAIL_ACCOUNT = "admin@getmentalytics.com";
delete process.env.GMAIL_SENDER;

import { sendGmailReply, getThread } from "./gmail";

type SendAs = { sendAsEmail: string; signature?: string; isDefault?: boolean; isPrimary?: boolean };

const SIGNATURE_HTML =
  '<div dir="rtl"><div>צוות טיפול חכם</div>' +
  '<div><img src="https://example.com/logo.png" width="96"></div>' +
  '<div><a href="https://www.mentalytics.co.il">www.mentalytics.co.il</a> &#124; 050-0000000</div></div>';

let sendAs: SendAs[] | "fail" = [];
let sentRaw: string | null = null;

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  sentRaw = null;
  sendAs = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("https://oauth2.googleapis.com/token")) {
        return respond({ access_token: "access", expires_in: 3600 });
      }
      if (url.endsWith("/settings/sendAs")) {
        return sendAs === "fail"
          ? respond({ error: { message: "Request had insufficient authentication scopes." } }, 403)
          : respond({ sendAs });
      }
      if (url.endsWith("/messages/send")) {
        sentRaw = (JSON.parse(String(init?.body)) as { raw: string }).raw;
        return respond({ id: "msg-1" });
      }
      if (url.includes("/threads/")) {
        return respond({
          messages: [
            {
              id: "t-1",
              threadId: "thread-1",
              internalDate: "1000",
              labelIds: ["SENT"],
              payload: {
                headers: [{ name: "From", value: "Admin <admin@getmentalytics.com>" }],
                mimeType: "text/plain",
                body: {
                  data: Buffer.from(
                    "שלום רב,\nהתשובה עצמה.\n\n-- \nצוות טיפול חכם\n050-0000000\n\nOn Mon, Sep 14, 2026 wrote:\n> ציטוט",
                    "utf-8"
                  ).toString("base64url"),
                },
              },
            },
          ],
        });
      }
      throw new Error(`unexpected fetch in test: ${url}`);
    })
  );
});

/** Pull the decoded text/plain and text/html parts out of the raw MIME. */
function parts(raw: string): { text: string; html: string } {
  const mime = Buffer.from(raw, "base64url").toString("utf-8");
  const boundary = /boundary="([^"]+)"/.exec(mime)?.[1];
  if (!boundary) throw new Error("no boundary");
  const out: Record<string, string> = {};
  for (const chunk of mime.split(`--${boundary}`)) {
    const type = /Content-Type: (text\/(?:plain|html))/.exec(chunk)?.[1];
    if (!type) continue;
    const body = chunk.split("\r\n\r\n").slice(1).join("").trim();
    out[type] = Buffer.from(body, "base64").toString("utf-8");
  }
  return { text: out["text/plain"] ?? "", html: out["text/html"] ?? "" };
}

const reply = {
  threadId: "thread-1",
  to: "someone@example.com",
  subject: "שאלה",
  inReplyTo: "<abc@mail.gmail.com>",
  body: "שלום,\nתשובה.\n\nבברכה,\nצוות טיפול חכם",
};

describe("sendGmailReply signature", () => {
  it("attaches the sender's Gmail signature to both parts", async () => {
    sendAs = [{ sendAsEmail: "admin@getmentalytics.com", signature: SIGNATURE_HTML, isPrimary: true, isDefault: true }];
    const res = await sendGmailReply(reply);
    expect(res).toEqual({ id: "msg-1", signed: true });

    const { text, html } = parts(sentRaw!);
    // The logo has no text form, so its line stays as a blank line.
    expect(text).toBe(
      `${reply.body}\n\n-- \nצוות טיפול חכם\n\nwww.mentalytics.co.il | 050-0000000`
    );
    // The signature sits after the body's pre-wrap div, never inside it.
    const bodyEnd = html.indexOf("</div>");
    const sigAt = html.indexOf('class="gmail_signature"');
    expect(sigAt).toBeGreaterThan(bodyEnd);
    expect(html).toContain(SIGNATURE_HTML);
    expect(html.startsWith('<div dir="rtl"')).toBe(true);
  });

  it("falls back to the default alias when the sender alias has no signature", async () => {
    process.env.GMAIL_SENDER = "support@getmentalytics.com";
    try {
      sendAs = [
        { sendAsEmail: "support@getmentalytics.com", signature: "" },
        { sendAsEmail: "admin@getmentalytics.com", signature: SIGNATURE_HTML, isDefault: true },
      ];
      const res = await sendGmailReply(reply);
      expect(res.signed).toBe(true);
      expect(parts(sentRaw!).html).toContain(SIGNATURE_HTML);
    } finally {
      delete process.env.GMAIL_SENDER;
    }
  });

  it("treats Gmail's empty signature markup as no signature", async () => {
    sendAs = [{ sendAsEmail: "admin@getmentalytics.com", signature: "<div><br></div>", isDefault: true }];
    const res = await sendGmailReply(reply);
    expect(res.signed).toBe(false);
    const { text, html } = parts(sentRaw!);
    expect(text).toBe(reply.body);
    expect(html).not.toContain("gmail_signature");
  });

  it("still sends the reply when the signature cannot be read", async () => {
    sendAs = "fail";
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await sendGmailReply(reply);
    expect(res).toEqual({ id: "msg-1", signed: false });
    expect(parts(sentRaw!).text).toBe(reply.body);
    err.mockRestore();
  });
});

describe("getThread", () => {
  it("cuts a Gmail-sent reply at the signature delimiter, so it is never learned as body text", async () => {
    const [m] = await getThread("thread-1");
    expect(m.bodyText).toBe("שלום רב,\nהתשובה עצמה.");
  });
});
