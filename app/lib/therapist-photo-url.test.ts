import { describe, it, expect } from "vitest";
import { photoVersion, therapistPhotoUrl } from "./therapist-photo-url";

const ID = "906837b9-dda5-49ad-995f-e6cc41d77aa5";
const OLD = "photos/b508f69f-ed73-439d-abb5-352cea7a3ccd-1789000000000.webp";
const NEW = "photos/b508f69f-ed73-439d-abb5-352cea7a3ccd-1789999006765.webp";

describe("therapistPhotoUrl", () => {
  it("changes when the photo changes - that is what makes the new photo appear at once", () => {
    expect(therapistPhotoUrl(ID, OLD)).not.toBe(therapistPhotoUrl(ID, NEW));
  });

  it("stays the same for the same photo, so caching keeps working", () => {
    expect(therapistPhotoUrl(ID, NEW)).toBe(therapistPhotoUrl(ID, NEW));
    expect(photoVersion(NEW)).toMatch(/^[0-9a-z]{1,7}$/);
  });

  it("keeps the stable route and adds the domain only when asked", () => {
    expect(therapistPhotoUrl(ID, NEW)).toBe(`/therapist-photo/${ID}?v=${photoVersion(NEW)}`);
    expect(therapistPhotoUrl(ID, NEW, "https://www.mentalytics.co.il")).toBe(
      `https://www.mentalytics.co.il/therapist-photo/${ID}?v=${photoVersion(NEW)}`,
    );
  });
});
