import { describe, it, expect } from "vitest";
import {
  groupByCampaign,
  linksToText,
  normalizePublication,
  normalizePublicationPatch,
  parseLinksText,
  youtubeId,
  type Publication,
} from "./publications";

const base = { campaign: "מצפן היועצת", audience: "counselors", kind: "video", title: "סרטון מלא - רחב 16x9" };

describe("normalizePublication", () => {
  it("fills the defaults of a new publication", () => {
    const r = normalizePublication(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toMatchObject({ status: "draft", channels: [], links: [], version: null, published_on: null, sort_order: 0 });
  });

  it("requires a campaign, a title and known enums", () => {
    expect(normalizePublication({ ...base, campaign: "  " }).ok).toBe(false);
    expect(normalizePublication({ ...base, title: "" }).ok).toBe(false);
    expect(normalizePublication({ ...base, audience: "students" }).ok).toBe(false);
    expect(normalizePublication({ ...base, kind: "podcast" }).ok).toBe(false);
    expect(normalizePublication({ ...base, status: "published" }).ok).toBe(false);
    expect(normalizePublication({ ...base, channels: ["youtube", "tiktok"] }).ok).toBe(false);
  });

  it("refuses an address that is not http(s) instead of dropping it", () => {
    expect(normalizePublication({ ...base, public_url: "javascript:alert(1)" }).ok).toBe(false);
    expect(normalizePublication({ ...base, file_url: "drive.google.com/x" }).ok).toBe(false);
    expect(normalizePublication({ ...base, links: [{ label: "פיילוט", url: "ftp://x" }] }).ok).toBe(false);
    const r = normalizePublication({ ...base, public_url: " https://youtu.be/TLoLZFTEV9k ", file_url: "" });
    expect(r.ok && r.value.public_url).toBe("https://youtu.be/TLoLZFTEV9k");
    expect(r.ok && r.value.file_url).toBe(null);
  });

  it("keeps the utm of a link and names an unnamed one", () => {
    const link = "https://www.mentalytics.co.il/school?access=ABCD-1234&utm_source=youtube&utm_medium=video";
    const r = normalizePublication({ ...base, links: [{ url: link }] });
    expect(r.ok && r.value.links).toEqual([{ label: "קישור", url: link }]);
  });

  it("dedupes channels and checks the date", () => {
    const r = normalizePublication({ ...base, channels: ["youtube", "youtube", "web"], published_on: "2026-11-03" });
    expect(r.ok && r.value.channels).toEqual(["youtube", "web"]);
    expect(normalizePublication({ ...base, published_on: "3.11.2026" }).ok).toBe(false);
  });
});

describe("normalizePublicationPatch", () => {
  it("returns only the fields that were sent", () => {
    const r = normalizePublicationPatch({ status: "live", published_on: "2026-11-03" });
    expect(r).toEqual({ ok: true, value: { status: "live", published_on: "2026-11-03" } });
  });

  it("still refuses an empty title or a bad status", () => {
    expect(normalizePublicationPatch({ title: " " }).ok).toBe(false);
    expect(normalizePublicationPatch({ status: "gone" }).ok).toBe(false);
  });
});

describe("parseLinksText", () => {
  it("reads 'label | address' lines and reports the unreadable ones", () => {
    const r = parseLinksText("פיילוט | https://www.mentalytics.co.il/school?access=X&utm_source=a\n\nhttps://www.mentalytics.co.il/counselors#access\nלא קישור");
    expect(r.links).toEqual([
      { label: "פיילוט", url: "https://www.mentalytics.co.il/school?access=X&utm_source=a" },
      { label: "קישור", url: "https://www.mentalytics.co.il/counselors#access" },
    ]);
    expect(r.bad).toEqual(["לא קישור"]);
  });

  it("round-trips with linksToText", () => {
    const links = [{ label: "דף השאלון", url: "https://www.mentalytics.co.il/counselors?utm_source=brochure#access" }];
    expect(parseLinksText(linksToText(links)).links).toEqual(links);
  });
});

describe("youtubeId", () => {
  it("reads watch, short and Shorts links", () => {
    expect(youtubeId("https://youtu.be/TLoLZFTEV9k")).toBe("TLoLZFTEV9k");
    expect(youtubeId("https://www.youtube.com/watch?v=TLoLZFTEV9k&t=3")).toBe("TLoLZFTEV9k");
    expect(youtubeId("https://youtube.com/shorts/E12DCUUKBGQ")).toBe("E12DCUUKBGQ");
    expect(youtubeId("https://m.youtube.com/shorts/E12DCUUKBGQ?feature=share")).toBe("E12DCUUKBGQ");
  });

  it("is null for anything else", () => {
    expect(youtubeId("https://drive.google.com/file/d/abc/view")).toBe(null);
    expect(youtubeId("https://youtube.com/@channel")).toBe(null);
    expect(youtubeId(null)).toBe(null);
  });
});

describe("groupByCampaign", () => {
  const pub = (p: Partial<Publication>): Publication => ({
    id: Math.random().toString(36),
    campaign: "מצפן היועצת",
    audience: "counselors",
    kind: "video",
    title: "x",
    version: null,
    status: "draft",
    channels: [],
    public_url: null,
    file_url: null,
    links: [],
    notes: null,
    published_on: null,
    sort_order: 0,
    created_at: "2026-11-03T10:00:00Z",
    updated_at: "2026-11-03T10:00:00Z",
    ...p,
  });

  it("orders by kind, then live before draft before retired, then the admin's order", () => {
    const g = groupByCampaign([
      pub({ title: "ad", kind: "ad" }),
      pub({ title: "old video", status: "retired" }),
      pub({ title: "video 2", status: "live", sort_order: 2 }),
      pub({ title: "video 1", status: "live", sort_order: 1 }),
      pub({ title: "draft video" }),
    ]);
    expect(g[0].items.map((p) => p.title)).toEqual(["video 1", "video 2", "draft video", "old video", "ad"]);
  });

  it("puts the most recently touched campaign first", () => {
    const g = groupByCampaign([
      pub({ campaign: "ישן", updated_at: "2026-10-01T00:00:00Z" }),
      pub({ campaign: "חדש", updated_at: "2026-11-03T00:00:00Z" }),
    ]);
    expect(g.map((x) => x.campaign)).toEqual(["חדש", "ישן"]);
  });
});
