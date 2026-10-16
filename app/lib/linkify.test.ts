import { describe, expect, it } from "vitest";
import { linkifyEscapedText } from "./linkify";

const URL = "https://www.mentalytics.co.il/therapists/gift-checkout?token=AbC-12_xYz";

describe("linkifyEscapedText", () => {
  it("wraps an address on its own line in a real link, with the whole token", () => {
    const html = linkifyEscapedText(`הקישור האישי:\n${URL}\n\nבברכה`);
    expect(html).toContain(`<a href="${URL}"`);
    expect(html).toContain(`>${URL}</a>`);
  });

  it("stops where Hebrew text starts, and leaves the sentence's full stop outside", () => {
    expect(linkifyEscapedText(`ראו ${URL}.`)).toBe(`ראו <a href="${URL}" style="color:#0F5468;">${URL}</a>.`);
    expect(linkifyEscapedText(`${URL}תודה`)).toContain(`<a href="${URL}"`);
  });

  it("keeps an escaped ampersand inside the address", () => {
    const escaped = "https://example.com/a?x=1&amp;y=2";
    expect(linkifyEscapedText(escaped)).toBe(`<a href="${escaped}" style="color:#0F5468;">${escaped}</a>`);
  });

  it("links nothing that is not a web address, and never lets markup through", () => {
    expect(linkifyEscapedText("טלפון 055-993-1403 ומייל admin@getmentalytics.com")).toBe("טלפון 055-993-1403 ומייל admin@getmentalytics.com");
    // Escaped input stays escaped: an injected tag cannot become markup.
    expect(linkifyEscapedText("&lt;script&gt;https://evil.example/&lt;/script&gt;")).not.toContain("<script>");
    expect(linkifyEscapedText("javascript:alert(1)")).toBe("javascript:alert(1)");
  });

  it("links several addresses in one text", () => {
    const html = linkifyEscapedText("https://a.example/one ו-https://b.example/two");
    expect(html.match(/<a href=/g)?.length).toBe(2);
  });
});
