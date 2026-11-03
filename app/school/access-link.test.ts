import { describe, expect, it } from "vitest";
import { accessCodeFromSearch, withoutAccessParam } from "./access-link";

describe("trial link: /school?access=CODE", () => {
  it("reads the code from the link and normalises it like a typed one", () => {
    expect(accessCodeFromSearch("?access=ABCD-2345")).toBe("ABCD-2345");
    expect(accessCodeFromSearch("?access=abcd2345")).toBe("ABCD-2345");
    expect(accessCodeFromSearch("?utm_source=wa&access=ABCD%202345")).toBe("ABCD-2345");
  });
  it("ignores a link without a code, with an empty one, or with something that cannot be a code", () => {
    expect(accessCodeFromSearch("")).toBeNull();
    expect(accessCodeFromSearch("?access=")).toBeNull();
    expect(accessCodeFromSearch("?access=abc")).toBeNull();
    expect(accessCodeFromSearch("?access=ABCD-0O1I")).toBeNull(); // 0, O, 1, I are not in the alphabet
    expect(accessCodeFromSearch("?other=ABCD-2345")).toBeNull();
  });
  it("takes the code out of the address and keeps everything else", () => {
    expect(withoutAccessParam("/school", "?access=ABCD-2345", "")).toBe("/school");
    expect(withoutAccessParam("/school", "?utm_source=wa&access=ABCD-2345", "#top")).toBe("/school?utm_source=wa#top");
    expect(withoutAccessParam("/school", "", "")).toBe("/school");
  });
});
