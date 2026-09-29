import { describe, it, expect, vi } from "vitest";
import {
  uploadCertificate,
  CERT_UNREADABLE_MESSAGE,
  CERT_UPLOAD_FAILED_MESSAGE,
  SERVER_UPLOAD_LIMIT,
  type CertUploadDeps,
  type JsonResponse,
} from "./cert-upload-client";

const ok = (json: Record<string, unknown> = {}): JsonResponse => ({ ok: true, status: 200, json: { ok: true, ...json } });

function deps(over: Partial<CertUploadDeps> = {}) {
  const calls: Record<string, unknown>[] = [];
  const postCert = vi.fn(async (body: Record<string, unknown>) => {
    calls.push(body);
    if (body.action === "sign") return ok({ path: "certificates/u-1.pdf", token: "tok" });
    return ok();
  });
  const d: CertUploadDeps = {
    postCert,
    uploadSigned: vi.fn(async () => ({ error: null })),
    postServerUpload: vi.fn(async () => ok()),
    ...over,
  };
  const reports = () => calls.filter((c) => c.action === "report_failure");
  return { d, calls, reports };
}

const pdf = (bytes = 1000, name = "license.pdf") => new File([new Uint8Array(bytes)], name, { type: "application/pdf" });

// 26-29/9/2026: six attempts from one Android phone; the server prepared each
// upload, the preflight went out, and the file itself never left the device.
describe("uploading a certificate from the profile editor", () => {
  it("the happy path signs, uploads the bytes from memory, commits, and reports nothing", async () => {
    const { d, calls, reports } = deps();
    expect(await uploadCertificate(pdf(), d)).toBeNull();
    expect(calls.map((c) => c.action)).toEqual(["sign", "commit"]);
    const [, , body] = (d.uploadSigned as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(body).toBeInstanceOf(Blob);
    expect((body as Blob).size).toBe(1000);
    expect(reports()).toHaveLength(0);
  });

  it("a file the browser cannot read gets clear instructions, and the admin hears about it", async () => {
    const unreadable = { name: "license.pdf", type: "application/pdf", size: 5000, arrayBuffer: () => Promise.reject(new Error("NotReadableError")) } as unknown as File;
    const { d, calls, reports } = deps();
    expect(await uploadCertificate(unreadable, d)).toBe(CERT_UNREADABLE_MESSAGE);
    expect(calls.some((c) => c.action === "sign")).toBe(false);
    expect(reports()).toEqual([expect.objectContaining({ stage: "read" })]);
  });

  it("an empty (cloud placeholder) file is treated as unreadable", async () => {
    const { d, reports } = deps();
    expect(await uploadCertificate(new File([], "license.pdf", { type: "application/pdf" }), d)).toBe(CERT_UNREADABLE_MESSAGE);
    expect(reports()[0]).toMatchObject({ stage: "read", message: "empty file" });
  });

  it("a failed direct upload retries through our server, and succeeds there", async () => {
    const { d, reports } = deps({ uploadSigned: vi.fn(async () => ({ error: { message: "Failed to fetch" } })) });
    expect(await uploadCertificate(pdf(), d)).toBeNull();
    expect(d.postServerUpload).toHaveBeenCalledTimes(1);
    const sent = (d.postServerUpload as ReturnType<typeof vi.fn>).mock.calls[0][0] as File;
    expect(sent.name).toBe("license.pdf");
    expect(reports()).toEqual([expect.objectContaining({ stage: "upload", message: "Failed to fetch" })]);
  });

  it("an upload that throws instead of returning an error is handled the same way", async () => {
    const { d } = deps({ uploadSigned: vi.fn(async () => { throw new Error("boom"); }) });
    expect(await uploadCertificate(pdf(), d)).toBeNull();
    expect(d.postServerUpload).toHaveBeenCalledTimes(1);
  });

  it("when both routes fail the therapist is told what to do, and both failures are reported", async () => {
    const { d, reports } = deps({
      uploadSigned: vi.fn(async () => ({ error: { message: "Failed to fetch" } })),
      postServerUpload: vi.fn(async () => ({ ok: false, status: 500, json: { ok: false, error: "storage down" } })),
    });
    expect(await uploadCertificate(pdf(), d)).toBe(CERT_UPLOAD_FAILED_MESSAGE);
    expect(reports().map((r) => r.stage)).toEqual(["upload", "fallback"]);
  });

  it("a file too big for the server route is not retried there", async () => {
    const { d } = deps({ uploadSigned: vi.fn(async () => ({ error: { message: "Failed to fetch" } })) });
    expect(await uploadCertificate(pdf(SERVER_UPLOAD_LIMIT + 1), d)).toBe(CERT_UPLOAD_FAILED_MESSAGE);
    expect(d.postServerUpload).not.toHaveBeenCalled();
  });

  it("a refusal from our server (wrong type) is shown as is, and recorded", async () => {
    const postCert = vi.fn(async (body: Record<string, unknown>) =>
      body.action === "sign"
        ? { ok: false, status: 400, json: { ok: false, error: "סוג קובץ לא נתמך" } }
        : ok(),
    );
    const { d } = deps({ postCert });
    expect(await uploadCertificate(pdf(), d)).toBe("סוג קובץ לא נתמך");
    expect(postCert.mock.calls.map((c) => c[0].action)).toEqual(["sign", "report_failure"]);
  });

  it("a name without the extension gets one for the server route, which checks it", async () => {
    const { d } = deps({ uploadSigned: vi.fn(async () => ({ error: { message: "x" } })) });
    await uploadCertificate(new File([new Uint8Array(10)], "IMG_2044.JPG", { type: "image/jpeg" }), d);
    const sent = (d.postServerUpload as ReturnType<typeof vi.fn>).mock.calls[0][0] as File;
    expect(sent.name).toBe("IMG_2044.JPG");
    expect(sent.type).toBe("image/jpeg");
  });
});
