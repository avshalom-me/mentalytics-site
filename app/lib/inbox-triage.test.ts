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
import { automatedMailReason, isCourtesyClosing, mayAutoIgnore, isSameInquiry, type InquiryLike } from "./inbox-triage";

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

// 6/10/26: the language model that used to recognise machine mail stopped
// answering (the provider's credit ran out), and every charge notice and DMARC
// report stayed in the queue as an open card, among the inquiries of people.
// Mail that is plainly a machine's is now closed by rule. The rules were drawn
// from everything the mailbox had ever classified as system or spam, and they
// must stay narrow: closing a person's mail by mistake is a customer who
// vanishes. Senders, names and numbers below are invented.
describe("mail that is plainly a machine's", () => {
  const reason = (from_email: string, subject: string, auto_header?: string) =>
    automatedMailReason({ from_email, subject, auto_header });

  it("is a charge or credit notice of the payment provider", () => {
    expect(reason("support@sumit.co.il", 'בוצע חיוב עבור דנה לוי ב-העסק שלנו בע"מ')).toBe("הודעה אוטומטית של Sumit");
    expect(reason("c+1000000001@sumit.co.il", 'עדכון על חיוב שבוצע על ידי העסק שלנו בע"מ')).toBe("הודעה אוטומטית של Sumit");
    expect(reason("c+1000000001@sumit.co.il", 'עדכון על זיכוי שבוצע על ידי העסק שלנו בע"מ')).toBe("הודעה אוטומטית של Sumit");
    expect(reason("c+1000000001@sumit.co.il", 'קיבלת חשבונית מס/קבלה זיכוי / 1001 מאת העסק שלנו בע"מ')).toBe("הודעה אוטומטית של Sumit");
    expect(reason("c+2000000002@sumit.co.il", "תזכורת ממשרד רואה החשבון: הגיע הזמן לשלוח מסמכים")).toBe("הודעה אוטומטית של Sumit");
    expect(reason("support@sumit.co.il", "חשבונית מ-SUMIT מתאריך 01/09/2026")).toBe("הודעה אוטומטית של Sumit");
    expect(reason("support@sumit.co.il", "לידיעה, עודכן אמצעי תשלום של דנה לוי")).toBe("הודעה אוטומטית של Sumit");
  });

  it("is a DMARC report, whoever sends it", () => {
    expect(reason("noreply-dmarc-support@google.com", "Report domain: example.co.il Submitter: google.com Report-ID: 123")).toBe("דוח DMARC");
    expect(reason("dmarcreport@microsoft.com", "[Preview] Report Domain: example.co.il Submitter: enterprise.protection.outlook.com")).toBe("דוח DMARC");
    expect(reason("reports@some-provider.example", "Report Domain: example.co.il Submitter: some-provider.example")).toBe("דוח DMARC");
  });

  it("comes from a no-reply address or from the mail system itself", () => {
    for (const from of [
      "no-reply@accounts.google.com",
      "noreply@example.com",
      "ads-account-noreply@google.com",
      "payments-noreply@google.com",
      "donotreply@example.com",
      "do-not-reply@example.com",
      "NoReply@Example.com",
    ]) {
      expect(reason(from, "Security alert")).toBe("כתובת no-reply");
    }
    expect(reason("mailer-daemon@googlemail.com", "Delivery Status Notification (Failure)")).toBe("כתובת של מערכת דואר");
    expect(reason("postmaster@example.com", "Undeliverable")).toBe("כתובת של מערכת דואר");
    expect(reason("dmarcreport@microsoft.com", "weekly summary")).toBe("כתובת של מערכת דואר");
  });

  it("is a supplier's invoice notice", () => {
    expect(reason("invoices@billing.example", "נשלחה אליך חשבונית מס קבלה מספר 30102 מאת ספק כלשהו")).toBe("הודעה אוטומטית על חשבונית");
    expect(reason("invoices@billing.example", "נשלח אליך חשבון עסקה מספר 10104 מאת ספק כלשהו")).toBe("הודעה אוטומטית על חשבונית");
  });

  it("says so in its own headers", () => {
    expect(reason("dana@example.com", "אני בחופשה", "Auto-Submitted: auto-replied")).toBe("מייל אוטומטי (Auto-Submitted: auto-replied)");
    // a header wins even over a reply prefix: an out-of-office answer is "Re: ..."
    expect(reason("dana@example.com", "Re: השלמת רישום", "Auto-Submitted: auto-replied")).not.toBeNull();
  });

  it("is never a person writing from an ordinary address", () => {
    expect(reason("dana@example.com", "שאלה על החיוב החודשי")).toBeNull();
    expect(reason("dana@example.com", "קיבלתי חשבונית שגויה")).toBeNull();
    expect(reason("dana@example.com", "בוצע אצלי חיוב כפול")).toBeNull();
    expect(reason("office@clinic.example", "תזכורת: מחכים לתשובה")).toBeNull();
    // an address that merely contains the letters
    expect(reason("noreplyfan@example.com", "שלום")).toBeNull();
    expect(reason("replynow@example.com", "שלום")).toBeNull();
    expect(reason("bouncer.david@example.com", "שלום")).toBeNull();
  });

  it("is never a reply or a forward, even from a machine-looking address", () => {
    // a customer's answer that the provider relays, or a person forwarding a notice
    expect(reason("c+1000000001@sumit.co.il", 'Re: עדכון על חיוב שבוצע על ידי העסק שלנו בע"מ')).toBeNull();
    expect(reason("support@sumit.co.il", "RE: פנייה לתמיכה 4821")).toBeNull();
    expect(reason("no-reply@example.com", "Fwd: Security alert")).toBeNull();
    expect(reason("support@sumit.co.il", "\u200fRe: בוצע חיוב עבור דנה לוי")).toBeNull();
  });

  it("leaves the provider's human support to the model", () => {
    expect(reason("support@sumit.co.il", "עדכון לגבי הפנייה שלך לתמיכה")).toBeNull();
  });

  it("is not decided by a broken sender address", () => {
    expect(reason("", "Report domain: example.co.il")).toBeNull();
    expect(reason("not-an-address", "בוצע חיוב עבור דנה לוי")).toBeNull();
  });
});
