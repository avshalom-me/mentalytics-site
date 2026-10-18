import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { centerUploadErrorMessage } from "./center-image-upload";

// A new centre's manager could not upload photos: phone pictures passed Vercel's
// ~4.5MB body cap, the 413 came back without JSON, and the portal showed nothing
// (18/10/2026).
describe("center upload error message", () => {
  it("explains an image that is too large", () => {
    expect(centerUploadErrorMessage(413)).toContain("גדולה מדי");
  });

  it("explains a file the server could not read as an image", () => {
    expect(centerUploadErrorMessage(400, "Invalid image")).toContain("JPG או PNG");
  });

  it("asks to sign in again when the session expired", () => {
    expect(centerUploadErrorMessage(401, "unauthorized")).toContain("התחברו מחדש");
  });

  it("passes a Hebrew server message through", () => {
    expect(centerUploadErrorMessage(403, "המנוי של המרכז אינו פעיל")).toBe("המנוי של המרכז אינו פעיל");
  });

  it("does not show an English storage error", () => {
    const msg = centerUploadErrorMessage(500, "The resource already exists");
    expect(msg).not.toContain("resource");
    expect(msg).toContain("500");
  });
});

describe("the centre portal uploads", () => {
  const editor = readFileSync("app/centers/dashboard/PublicPageEditor.tsx", "utf8");
  const therapistForm = readFileSync("app/centers/dashboard/therapists/[id]/page.tsx", "utf8");

  it("shrink an image before sending it", () => {
    expect(editor).toContain("downscaleImageForUpload(");
    expect(therapistForm).toContain("downscaleImageForUpload(");
  });

  it("never read the upload answer as JSON without a fallback", () => {
    const between = (src: string, from: string, to: string) => src.slice(src.indexOf(from), src.indexOf(to, src.indexOf(from)));
    const editorUpload = between(editor, "async function uploadCenterImage", "async function onLogoFile");
    const formUpload = between(therapistForm, "async function uploadFile", "async function handleSave");
    for (const fn of [editorUpload, formUpload]) {
      expect(fn.length).toBeGreaterThan(100);
      expect(fn).toContain("res.json().catch(");
      expect(fn).not.toMatch(/await res\.json\(\);/);
    }
  });
});

describe("view as centre in the admin", () => {
  const view = readFileSync("app/centers/dashboard/DashboardView.tsx", "utf8");

  // The portal pages open under whatever centre account is signed in to the
  // browser - in the owner's browser that is the trial centre - so from the
  // admin preview an edit link must lead to the admin, not to the portal.
  it("sends edit links to the admin when previewing", () => {
    expect(view).toContain("/admin/therapists?therapist=");
    expect(view).toMatch(/preview\s*\?\s*`\/admin\/therapists\?therapist=/);
  });
});
