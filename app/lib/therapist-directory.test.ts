import { describe, it, expect, beforeEach, vi } from "vitest";

// A chainable stand-in for the Supabase query builder: every filter returns the
// builder, and awaiting it resolves whatever the test set for that table.
const h = vi.hoisted(() => {
  const responses = new Map<string, { data: unknown; error: { message: string } | null }>();
  const signOne = vi.fn();
  const signMany = vi.fn(async () => ({ data: [], error: null }));
  const builder = (table: string) => {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "in", "eq", "neq", "not", "or", "order"]) b[m] = () => b;
    b.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(responses.get(table) ?? { data: [], error: null }).then(resolve, reject);
    return b;
  };
  return { responses, signOne, signMany, builder };
});

vi.mock("@/app/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: (table: string) => h.builder(table),
    storage: { from: () => ({ createSignedUrl: h.signOne, createSignedUrls: h.signMany }) },
  },
}));

import { loadPublicTherapists, countListed, loadListedCounts } from "./therapist-directory";
import { therapistPhotoUrl } from "./therapist-photo-url";

const row = (id: string, photo: string | null) => ({
  id,
  full_name: `מטפל ${id}`,
  phone: "0500000000",
  bio: "",
  gender: "נקבה",
  online: true,
  therapist_types: ["פסיכולוג קליני"],
  training_areas: [],
  assessment_types: [],
  regions: ["חיפה"],
  cultural_prefs: [],
  arrangements: [],
  age_groups: [],
  profile_photo_path: photo,
  status: "approved",
  promotion_source: null,
  center_account_id: null,
  created_at: "2026-01-01T00:00:00Z",
  accepting_new_patients: true,
  entity_type: "therapist",
});

beforeEach(() => {
  h.responses.clear();
  h.signOne.mockReset();
  h.signMany.mockClear();
});

// 28-29/9/2026: a six-hour database stall. Every listing rebuild had signed
// each photo separately (up to ~200 requests for one rebuild of the directory),
// and a failed query came back as an empty list that the rebuild then published.
describe("the public directory under load and under failure", () => {
  it("cards use the cached photo address, and no photo is signed per therapist", async () => {
    h.responses.set("therapists", {
      data: [row("11111111-1111-4111-8111-111111111111", "photos/a.webp"), row("22222222-2222-4222-8222-222222222222", null)],
      error: null,
    });
    const cards = await loadPublicTherapists();
    const withPhoto = cards.find((c) => c.id.startsWith("1111"));
    const without = cards.find((c) => c.id.startsWith("2222"));
    expect(withPhoto?.profile_photo_url).toBe(therapistPhotoUrl("11111111-1111-4111-8111-111111111111", "photos/a.webp"));
    expect(without?.profile_photo_url).toBeNull();
    expect(h.signOne).not.toHaveBeenCalled();
  });

  it("a query that fails is an error, never an empty directory", async () => {
    h.responses.set("therapists", { data: null, error: { message: "canceling statement due to statement timeout" } });
    await expect(loadPublicTherapists({ city: "חיפה" })).rejects.toThrow(/statement timeout/);
    // the counts behind the noindex decision and the sitemap fail too, rather than reading 0
    await expect(countListed({ city: "חיפה" })).rejects.toThrow();
    await expect(loadListedCounts()).rejects.toThrow();
  });

  it("a failed centres query also fails the rebuild instead of dropping the centre cards", async () => {
    h.responses.set("therapists", { data: [row("11111111-1111-4111-8111-111111111111", null)], error: null });
    h.responses.set("therapy_center_accounts", { data: null, error: { message: "timeout" } });
    await expect(loadPublicTherapists()).rejects.toThrow(/centers query failed/);
  });
});
