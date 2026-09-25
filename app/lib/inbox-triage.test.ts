import { describe, it, expect, vi } from "vitest";

// What the agent is allowed to close without asking.
//
// 18/9/26: a therapist replied in two lines that he could not make a proposed
// meeting time. The two lines sat above a long quote of our own automatic
// "פנייה חדשה" notification, the classifier read the thread as an automated
// message, and the inquiry was closed as needing no reply. It never appeared
// in the queue. The cases below keep the shape of the real messages of that
// week, with invented wording, names and numbers: this repository is public.

vi.mock("server-only", () => ({}));

import { splitQuoted } from "./email-quote";
import { isCourtesyClosing, mayAutoIgnore, isSameInquiry, type InquiryLike } from "./inbox-triage";

const DECLINED_TIME = [
  "היי אבשלום, שמחתי לשמוע.",
  "בשעה הזאת אני תפוס עם מטופל.",
  "",
  "בתאריך יום ו׳, 18 בספט׳ 2026, 10:26, מאת Admin Admin ‏<",
  "admin@getmentalytics.com>:",
  "",
  "> שלום יונתן,",
  ">",
  "> אשמח לשוחח איתך, האם אתה פנוי בשלישי הקרוב ב9:00?",
  ">",
  ">> פנייה חדשה — בית למפתחים",
  ">> טופס הצטרפות מהאתר",
  ">> שם: יונתן כהן",
  ">> נשלח מ-mentalytics.co.il/developers",
].join("\n");

describe("splitQuoted", () => {
  it("keeps only what the person wrote now, and hands back the quote separately", () => {
    const { text, quoted } = splitQuoted(DECLINED_TIME);
    expect(text).toBe("היי אבשלום, שמחתי לשמוע.\nבשעה הזאת אני תפוס עם מטופל.");
    expect(quoted).toContain("פנייה חדשה");
    // The new text is a fraction of the mail: classifying the whole body
    // means classifying the quote.
    expect(text.length).toBeLessThan(quoted.length / 3);
  });

  it("treats a mail that is quote all the way down as having no separate quote", () => {
    const fwd = "> הכול מצוטט\n> שורה שנייה";
    expect(splitQuoted(fwd)).toEqual({ text: fwd, quoted: "" });
  });
});

describe("isCourtesyClosing", () => {
  it("accepts a plain sign-off", () => {
    expect(isCourtesyClosing("סבבה, אז ננסה ככה. תודה")).toBe(true);
    expect(isCourtesyClosing("תודה רבה לכם")).toBe(true);
  });

  it("rejects anything that asks, declines or leaves a number", () => {
    expect(isCourtesyClosing("היי אבשלום, שמחתי לשמוע. בשעה הזאת אני תפוס עם מטופל.")).toBe(false);
    expect(isCourtesyClosing("תודה, אפשר לקבוע למחר?")).toBe(false);
    expect(isCourtesyClosing("תודה, תתקשרו אליי 0500000000")).toBe(false);
    expect(isCourtesyClosing("")).toBe(false);
  });
});

describe("mayAutoIgnore", () => {
  it("still closes spam and system mail by itself", () => {
    expect(mayAutoIgnore("system", "בוצע חיוב עבור מטפל")).toBe(true);
    expect(mayAutoIgnore("spam", "מסמך ממשרד רואה החשבון ממתין לך בקישור")).toBe(true);
  });

  it("never closes a person's message that asks for something", () => {
    // The regression: category was "other", not spam or system.
    expect(mayAutoIgnore("other", splitQuoted(DECLINED_TIME).text)).toBe(false);
    expect(
      mayAutoIgnore("therapist_billing", "שלום, אבקש שתחזרו אליי בעניין החלפת הכרטיס למנוי. תודה")
    ).toBe(false);
  });

  it("does close a person's courtesy sign-off", () => {
    expect(mayAutoIgnore("other", "סבבה, אז ננסה ככה. תודה")).toBe(true);
  });
});

// 22/9/26: one therapist sent the same cancellation request from her studio
// address and her personal one, 90 seconds apart. The reply went to one, the
// other stayed in the queue after sending and after a refresh. Names, texts
// and addresses below are invented; the shape is the real one.
describe("isSameInquiry", () => {
  const REQUEST =
    "שלום רב, שמי רונית אלון, מטפלת רגשית ומנויה אצלכם בתשלום. המנוי פעיל כבר חודשיים. " +
    "הייתי רוצה לסיים אותו, כי בתקופה הזאת לא הגיעו אליי פניות. אשמח שתעצרו את החיובים " +
    "ותבדקו אם אפשר לקבל החזר על התקופה. תודה, רונית";

  const studio: InquiryLike = {
    id: "a",
    from_email: "studio@example.com",
    subject: "בקשה לביטול המנוי",
    body_text: REQUEST,
    received_at: "2026-09-22T19:44:51Z",
    sender_therapist_id: "t-paying",
  };
  const personal: InquiryLike = {
    id: "b",
    from_email: "ronit.personal@example.com",
    subject: "בקשה לביטול המנוי",
    body_text: REQUEST.replace("בתשלום.", "בתשלום, על חשבון studio@example.com."),
    received_at: "2026-09-22T19:46:23Z",
    // Her personal address matched an empty duplicate signup, not the paying record.
    sender_therapist_id: "t-empty-duplicate",
  };

  it("links two addresses when one message names the other address", () => {
    expect(isSameInquiry(studio, personal)).toBe(true);
    expect(isSameInquiry(personal, studio)).toBe(true);
  });

  it("links a word-for-word double send even without the mention", () => {
    const twin = { ...personal, body_text: REQUEST };
    expect(isSameInquiry(studio, twin)).toBe(true);
  });

  it("links two addresses identified as the same therapist, on the same subject", () => {
    const other = { ...personal, body_text: "ראיתם את המייל הקודם שלי?", sender_therapist_id: "t-paying" };
    expect(isSameInquiry(studio, other)).toBe(true);
  });

  // The failure that matters more: merging two different people would close a
  // real customer's inquiry without an answer.
  it("never links two different people who both reply 'תודה רבה' to the same notification", () => {
    const one: InquiryLike = {
      id: "c",
      from_email: "first@example.com",
      subject: "Re: פנייה חדשה מ-טיפול חכם: שאלה על המנוי",
      body_text: "תודה רבה לכם",
      received_at: "2026-09-15T08:00:00Z",
    };
    const two: InquiryLike = { ...one, id: "d", from_email: "second@example.com", received_at: "2026-09-15T09:30:00Z" };
    expect(isSameInquiry(one, two)).toBe(false);
  });

  it("never links two different people who ask about the same thing in their own words", () => {
    const other: InquiryLike = {
      id: "e",
      from_email: "someone.else@example.com",
      subject: "בקשה לביטול המנוי",
      body_text:
        "היי, אני רוצה לבטל את המנוי שלי כי עברתי לעבוד במרפאה ציבורית ואין לי יותר זמן לקליניקה " +
        "הפרטית. אשמח אם תעדכנו אותי מתי הגבייה תיפסק. תודה, יעל",
      received_at: "2026-09-22T20:10:00Z",
    };
    expect(isSameInquiry(studio, other)).toBe(false);
  });

  it("ignores an address that appears only in the quoted part", () => {
    const quotedOnly: InquiryLike = {
      ...personal,
      subject: "שאלה אחרת לגמרי",
      body_text: "רציתי לשאול משהו אחר.\n\n> On Mon wrote studio@example.com:\n> ציטוט",
    };
    expect(isSameInquiry(studio, quotedOnly)).toBe(false);
  });

  it("does not link the same address (that is the 'wrote again' case) or messages days apart", () => {
    expect(isSameInquiry(studio, { ...studio, id: "f" })).toBe(false);
    expect(isSameInquiry(studio, { ...personal, received_at: "2026-09-27T10:00:00Z" })).toBe(false);
  });
});
