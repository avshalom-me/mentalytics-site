import { describe, it, expect } from "vitest";
import { safeReturnPath, isSavedMatchPath } from "./return-path";

describe("safeReturnPath", () => {
  it("allows the internal listing pages", () => {
    expect(safeReturnPath("/therapists/city/תל-אביב")).toBe("/therapists/city/תל-אביב");
    expect(safeReturnPath("/therapists/region/אונליין")).toBe("/therapists/region/אונליין");
    expect(safeReturnPath("/centers/rotem")).toBe("/centers/rotem");
  });
  it("allows a saved match list", () => {
    expect(safeReturnPath("/match/aB3_x-9QkLm")).toBe("/match/aB3_x-9QkLm");
  });
  it("refuses anything else", () => {
    for (const bad of [
      "//evil.com/therapists/x",
      "https://evil.com/therapists/x",
      "/admin/therapists",
      "/match/short",
      "/match/aB3_x-9QkLm/extra",
      "/match/../admin",
      "/therapists/",
      "javascript:alert(1)",
      "",
      undefined,
      42,
    ]) {
      expect(safeReturnPath(bad), String(bad)).toBeNull();
    }
  });
});

describe("isSavedMatchPath", () => {
  it("recognises only saved-match paths", () => {
    expect(isSavedMatchPath("/match/aB3_x-9QkLm")).toBe(true);
    expect(isSavedMatchPath("/therapists/city/x")).toBe(false);
    expect(isSavedMatchPath(null)).toBe(false);
  });
});
