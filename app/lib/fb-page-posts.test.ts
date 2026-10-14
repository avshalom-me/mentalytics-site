import { describe, it, expect } from "vitest";
import {
  buildPostText,
  campaignFor,
  cleanSummary,
  copyText,
  dayLabel,
  nextSlots,
  pickArticle,
  postLink,
  SLOT_WEEKDAY,
  type PostArticle,
  type QueuedPost,
} from "./fb-page-posts";

const article = (over: Partial<PostArticle>): PostArticle => ({
  id: "a1",
  slug: "מאמר",
  title: "כותרת המאמר",
  summary: "תקציר של המאמר שמספיק ארוך כדי לפתוח את הפוסט במשפט שלם.",
  image_url: "https://x/img.jpg",
  approved_at: "2026-09-01T10:00:00Z",
  author_key: "t1",
  author: "דנה כהן",
  role: "פסיכולוגית קלינית",
  ...over,
});

describe("the posting days", () => {
  it("are the next four Tuesdays after today, never today itself", () => {
    // 14/10/2026 is a Wednesday
    expect(nextSlots("2026-10-14")).toEqual(["2026-10-20", "2026-10-27", "2026-11-03", "2026-11-10"]);
    // on a Tuesday the first slot is a week away
    expect(nextSlots("2026-10-20", 1)).toEqual(["2026-10-27"]);
    for (const d of nextSlots("2026-12-30", 6)) expect(new Date(`${d}T00:00:00Z`).getUTCDay()).toBe(SLOT_WEEKDAY);
  });

  it("read as a Hebrew weekday and a short date", () => {
    expect(dayLabel("2026-10-20")).toBe("שלישי 20.10");
    expect(dayLabel("2026-11-03")).toBe("שלישי 3.11");
  });
});

describe("which article comes next", () => {
  it("never repeats an article, a replaced one included", () => {
    const arts = [article({ id: "a1" }), article({ id: "a2", author_key: "t2" })];
    const queue: QueuedPost[] = [{ article_id: "a1", planned_on: "2026-10-20", status: "skipped" }];
    expect(pickArticle(arts, queue)?.id).toBe("a2");
    expect(pickArticle(arts, [...queue, { article_id: "a2", planned_on: "2026-10-20", status: "planned" }])).toBeNull();
  });

  it("gives every writer a turn before anyone's second article", () => {
    const arts = [
      article({ id: "a1", author_key: "t1", approved_at: "2026-10-01" }),
      article({ id: "a2", author_key: "t1", approved_at: "2026-10-10" }),
      article({ id: "a3", author_key: "t2", approved_at: "2026-07-01" }),
    ];
    const queue: QueuedPost[] = [{ article_id: "a1", planned_on: "2026-10-20", status: "planned" }];
    // t1 already has a post, t2 has none: t2 goes first though its article is older
    expect(pickArticle(arts, queue)?.id).toBe("a3");
  });

  it("starts with the newest article among writers on equal footing, and prefers one with a picture", () => {
    const arts = [
      article({ id: "old", author_key: "t1", approved_at: "2026-07-01" }),
      article({ id: "new", author_key: "t2", approved_at: "2026-10-01" }),
      article({ id: "newest-no-picture", author_key: "t3", approved_at: "2026-10-12", image_url: null }),
    ];
    expect(pickArticle(arts, [])?.id).toBe("new");
  });
});

describe("the words of the post", () => {
  it("open with the writer's summary and credit the writer with the profession", () => {
    expect(buildPostText(article({}))).toBe(
      "תקציר של המאמר שמספיק ארוך כדי לפתוח את הפוסט במשפט שלם.\n\nמאמר מאת דנה כהן, פסיכולוגית קלינית, מכותבי טיפול חכם."
    );
  });

  it("end the summary like a sentence when the writer left the full stop out", () => {
    expect(buildPostText(article({ summary: "החזרה אל הילד הפנימי והדיאלוג איתו כשער אל ריפוי טראומת ילדות" }))).toMatch(
      /^החזרה אל הילד הפנימי והדיאלוג איתו כשער אל ריפוי טראומת ילדות\.\n\n/
    );
  });

  it("open with the title when the summary is missing or only a subtitle", () => {
    expect(buildPostText(article({ summary: null })).startsWith("כותרת המאמר\n\n")).toBe(true);
    expect(buildPostText(article({ summary: "וויסות וחלון העוררות" })).startsWith("כותרת המאמר\n\n")).toBe(true);
  });

  it("credit a house byline without calling the house one of its own writers", () => {
    expect(buildPostText(article({ author: "צוות טיפול חכם", role: "" }))).toMatch(/\n\nמאמר מאת צוות טיפול חכם\.$/);
  });

  it("tidy the summary: no long dashes, no blank lines, cut at a sentence end near 300 characters", () => {
    expect(cleanSummary("קשיי ריכוז – מתי זה שלב התפתחותי?   \n\n\n ומתי לבדוק — באמת")).toBe(
      "קשיי ריכוז - מתי זה שלב התפתחותי?\nומתי לבדוק - באמת"
    );
    const long = `${"משפט ראשון שהוא די ארוך ומלא מילים. ".repeat(12)}סוף`;
    const out = cleanSummary(long);
    expect(out.length).toBeLessThanOrEqual(300);
    expect(out.endsWith(".")).toBe(true);
  });
});

describe("the link and its campaign", () => {
  it("is tagged as an organic Facebook visit, one campaign per post day", () => {
    expect(campaignFor("2026-10-20")).toBe("page-20261020");
    const link = postLink("על-cbt-בעיניים-פקוחות", "2026-10-20");
    const url = new URL(link);
    expect(url.pathname).toBe(`/research/community/${encodeURIComponent("על-cbt-בעיניים-פקוחות")}`);
    expect(url.searchParams.get("utm_source")).toBe("facebook");
    expect(url.searchParams.get("utm_medium")).toBe("social");
    expect(url.searchParams.get("utm_campaign")).toBe("page-20261020");
  });

  it("goes on its own line after the words when copied", () => {
    expect(copyText("שורה\n\nקרדיט.\n", "https://x")).toBe("שורה\n\nקרדיט.\n\nhttps://x");
  });
});
