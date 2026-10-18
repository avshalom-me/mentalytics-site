import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseFormDraft, centerFormSaveErrorMessage, centerFormDraftKey } from "./center-form-draft";

// A new centre's manager filled the matching profile, pressed save, and what she
// had ticked was gone; no save had reached the database (18/10/2026).
describe("the local draft of the centre profile form", () => {
  const now = Date.UTC(2026, 9, 18);
  const form = { full_name: "מרכז לדוגמה", age_groups: ["מבוגרים"] };

  it("reads back what was kept", () => {
    expect(parseFormDraft(JSON.stringify({ savedAt: now - 60_000, form }), now)).toEqual(form);
  });

  it("drops a draft older than 30 days", () => {
    expect(parseFormDraft(JSON.stringify({ savedAt: now - 31 * 86_400_000, form }), now)).toBeNull();
  });

  it("ignores a missing or broken draft", () => {
    expect(parseFormDraft(null, now)).toBeNull();
    expect(parseFormDraft("{not json", now)).toBeNull();
    expect(parseFormDraft(JSON.stringify({ form }), now)).toBeNull();
  });

  it("keeps one draft per profile", () => {
    expect(centerFormDraftKey("abc")).not.toBe(centerFormDraftKey("new"));
  });
});

describe("the save error message", () => {
  it("tells a signed-out manager that her input is kept", () => {
    const msg = centerFormSaveErrorMessage(401, "unauthorized");
    expect(msg).toContain("התחברו מחדש");
    expect(msg).toContain("שמור בדפדפן");
    expect(msg).not.toContain("unauthorized");
  });

  it("passes a Hebrew server message through", () => {
    expect(centerFormSaveErrorMessage(403, "המנוי של המרכז אינו פעיל")).toContain("המנוי של המרכז אינו פעיל");
  });

  it("explains an answer that was not JSON", () => {
    expect(centerFormSaveErrorMessage(504)).toContain("504");
  });
});

describe("the centre profile form", () => {
  const page = readFileSync("app/centers/dashboard/therapists/[id]/page.tsx", "utf8");
  const save = page.slice(page.indexOf("async function handleSave"), page.indexOf("if (loading) {"));

  it("keeps a draft until the server save succeeds", () => {
    expect(page).toContain("writeFormDraft(draftKey, form)");
    expect(save).toContain("clearFormDraft(draftKey)");
  });

  it("never reads the save answer as JSON without a fallback", () => {
    expect(save).toContain("res.json().catch(");
    expect(save).not.toMatch(/const json = await res\.json\(\);/);
  });

  it("opens the public page editor in a new tab from inside the form", () => {
    const formBody = page.slice(page.indexOf("<form onSubmit"), page.indexOf("</form>"));
    const links = [...formBody.matchAll(/<Link href="\/centers\/dashboard[^"]*"([^>]*)>/g)];
    expect(links.length).toBeGreaterThan(0);
    for (const m of links) expect(m[1]).toContain('target="_blank"');
  });
});
