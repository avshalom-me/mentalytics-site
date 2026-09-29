import { describe, it, expect } from "vitest";
import { summarizeCertUploadFailures, isCertFailureStage } from "./cert-upload-failures";

const f = (therapist_id: string, created_at: string, stage: string, message = "Failed to fetch") => ({
  therapist_id,
  created_at,
  after_state: { stage, message },
});

// The case that made this visible: six failed attempts over three days, and no
// certificate ever saved - the admin saw only a green "updated".
describe("failed certificate uploads, as the admin card shows them", () => {
  it("counts every failure while no certificate has been saved, and keeps the latest error", () => {
    const out = summarizeCertUploadFailures(
      [
        f("t1", "2026-09-26T10:55:35Z", "upload"),
        f("t1", "2026-09-27T05:11:09Z", "upload"),
        f("t1", "2026-09-29T07:06:50Z", "read", "file could not be read"),
      ],
      {},
    );
    expect(out.t1.count).toBe(3);
    expect(out.t1.last_at).toBe("2026-09-29T07:06:50Z");
    expect(out.t1.last_error).toBe("קריאת הקובץ מהמכשיר: file could not be read");
  });

  it("drops failures that a later saved certificate resolved", () => {
    const out = summarizeCertUploadFailures(
      [f("t1", "2026-09-27T05:11:09Z", "upload"), f("t2", "2026-09-28T08:00:00Z", "commit")],
      { t1: "2026-09-27T06:00:00Z" },
    );
    expect(out.t1).toBeUndefined();
    expect(out.t2.count).toBe(1);
    expect(out.t2.last_error).toBe("שמירת התעודה: Failed to fetch");
  });

  it("a failure after the last certificate still counts", () => {
    const out = summarizeCertUploadFailures(
      [f("t1", "2026-09-27T05:11:09Z", "upload"), f("t1", "2026-09-29T07:06:50Z", "upload")],
      { t1: "2026-09-28T00:00:00Z" },
    );
    expect(out.t1.count).toBe(1);
  });

  it("tolerates a malformed audit row", () => {
    const out = summarizeCertUploadFailures(
      [{ therapist_id: "t1", created_at: "2026-09-29T07:06:50Z", after_state: null }],
      {},
    );
    expect(out.t1).toEqual({ count: 1, last_at: "2026-09-29T07:06:50Z", last_error: null });
  });

  it("only known stages are accepted from the browser", () => {
    expect(isCertFailureStage("upload")).toBe(true);
    expect(isCertFailureStage("constructor")).toBe(false);
    expect(isCertFailureStage("anything")).toBe(false);
  });
});
