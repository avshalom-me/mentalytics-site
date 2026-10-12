import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

// "מצב צוות" בלחיצה אחת: השרת נותן את STAFF_BYPASS_TOKEN למי שמחובר לאדמין.
// הקוד הוא סוד, ולכן הבדיקות כאן נועלות שלושה דברים: הוא יוצא רק בתשובה של
// הנתיב, הוא לא נשמר במטמון, ובלי קוד בסביבה לא יוצא דבר (isStaffBypass לא
// מאשר קוד ריק, אז אין מה לתת). הערכים כאן בדויים.

import { POST } from "@/app/api/admin-staff-mode/route";
import * as route from "@/app/api/admin-staff-mode/route";
import { isStaffBypass } from "@/app/lib/usage";

vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({}) }));

const FAKE = "test-staff-code-not-a-real-secret";

afterEach(() => vi.unstubAllEnvs());

describe("/api/admin-staff-mode", () => {
  it("hands the code to the caller when the server has one", async () => {
    vi.stubEnv("STAFF_BYPASS_TOKEN", FAKE);
    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, token: FAKE });
  });

  it("is never cached", async () => {
    vi.stubEnv("STAFF_BYPASS_TOKEN", FAKE);
    expect((await POST()).headers.get("cache-control")).toBe("no-store");
    expect(route.dynamic).toBe("force-dynamic");
  });

  it("gives nothing when the server has no code, and says why", async () => {
    for (const empty of ["", undefined]) {
      if (empty === undefined) vi.stubEnv("STAFF_BYPASS_TOKEN", undefined as unknown as string);
      else vi.stubEnv("STAFF_BYPASS_TOKEN", empty);
      const res = await POST();
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.ok).toBe(false);
      expect(body).not.toHaveProperty("token");
    }
  });

  it("answers POST only, so the admin gate's cross-site write check applies", () => {
    expect(Object.keys(route).filter((k) => /^(GET|HEAD|PUT|PATCH|DELETE)$/.test(k))).toEqual([]);
  });

  it("gives a code that the quiz routes accept, and an empty one never opens them", async () => {
    vi.stubEnv("STAFF_BYPASS_TOKEN", FAKE);
    const { token } = await (await POST()).json();
    expect(isStaffBypass(token)).toBe(true);
    expect(isStaffBypass("something else")).toBe(false);
    vi.stubEnv("STAFF_BYPASS_TOKEN", "");
    expect(isStaffBypass("")).toBe(false);
  });
});

// הקוד מגיע לדפדפן רק דרך הנתיב הזה (ודרך הקישור ?staff= שהצוות מקליד בעצמו).
// אף קובץ של האתר לא מקבל אותו בזמן בנייה: מי שיקרא את process.env.STAFF_BYPASS_TOKEN
// בקובץ שנשלח ללקוח (משתנה שמתחיל ב-NEXT_PUBLIC_ או קובץ "use client") יפיל את הבדיקה.
describe("the staff code stays on the server", () => {
  const ROOT = process.cwd();
  function files(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) files(full, out);
      else if (/\.(ts|tsx)$/.test(name)) out.push(full);
    }
    return out;
  }
  const sources = files(path.join(ROOT, "app"))
    .map((f) => ({
      file: path.relative(ROOT, f).split(path.sep).join("/"),
      text: readFileSync(f, "utf8"),
    }))
    // this file names the patterns it looks for
    .filter((s) => s.file !== "app/lib/admin-staff-mode-route.test.ts");

  it("is read from the environment only in server code", () => {
    const readers = sources.filter((s) => s.text.includes("STAFF_BYPASS_TOKEN") && /process\.env\.STAFF_BYPASS_TOKEN/.test(s.text));
    expect(readers.length).toBeGreaterThan(0);
    for (const s of readers) {
      expect(s.text, s.file).not.toMatch(/^\s*["']use client["']/m);
    }
  });

  it("is never exposed through a NEXT_PUBLIC variable", () => {
    for (const s of sources) expect(s.text, s.file).not.toMatch(/NEXT_PUBLIC_STAFF/);
  });
});
