import { describe, it, expect } from "vitest";
import {
  buildClickReport,
  CLICK_REPORT_MARKER,
  CLICK_REPORT_MAX_LINES,
  clickReportSince,
  collapseClickReport,
  insertClickReport,
  type ReportClick,
} from "./click-report";

// The list a therapist or a centre gets when they ask why the number of contact
// clicks does not match the inquiries that reached them. It is built in code and
// never by the language model, so what is tested here is what a customer reads.
// All data here is invented.

const NOW = new Date("2026-10-05T17:00:00.000Z");
const click = (over: Partial<ReportClick>): ReportClick => ({
  at: "2026-09-01T10:00:00.000Z",
  type: "whatsapp",
  source: "profile",
  channel: "google_organic",
  referrerHost: "google.com",
  ...over,
});

describe("the window of the report", () => {
  it("starts on the same day, two months back", () => {
    expect(clickReportSince(NOW).toISOString()).toBe("2026-08-05T17:00:00.000Z");
  });

  it("stops at the end of a shorter month instead of spilling into the next one", () => {
    expect(clickReportSince(new Date("2026-04-30T09:00:00.000Z")).toISOString()).toBe("2026-02-28T09:00:00.000Z");
  });
});

describe("the report a therapist gets", () => {
  const report = buildClickReport(
    [
      click({ at: "2026-09-22T21:58:00.000Z", source: "match", channel: "taboola_paid", referrerHost: "trc.taboola.com" }),
      click({ at: "2026-08-13T17:00:00.000Z", source: "profile", channel: "google_paid" }),
      click({ at: "2026-08-30T07:55:00.000Z", type: "site_message", source: "directory", channel: "direct", referrerHost: null }),
    ],
    { audience: "therapist", now: NOW },
  );

  it("lists every click, oldest first, with the Israeli date and hour", () => {
    expect(report.text).toBe(
      [
        "לחיצות ליצירת קשר בפרופיל שלך, 5.8.2026 עד 5.10.2026",
        'סה"כ 3: וואטסאפ 2, הודעה דרך טופס האתר 1.',
        "",
        "- 13.8 בשעה 20:00: לחיצה על וואטסאפ בעמוד הפרופיל. הכניסה לאתר הייתה ממודעה שלנו בגוגל.",
        "- 30.8 בשעה 10:55: הודעה דרך טופס האתר בכרטיס ברשימת המטפלים. הכניסה לאתר הייתה ישירה (הקלדת הכתובת, סימנייה או קישור שלא זוהה).",
        "- 23.9 בשעה 00:58: לחיצה על וואטסאפ בתוצאות שאלון ההתאמה. הכניסה לאתר הייתה ממודעה שלנו באתר תוכן.",
        "",
        "השעות לפי שעון ישראל.",
      ].join("\n"),
    );
  });

  it("tells the admin how many clicks and over which dates", () => {
    expect(report.count).toBe(3);
    expect(report.summary).toBe("3 לחיצות, 5.8.2026 עד 5.10.2026");
  });

  it("says so plainly when there was no click at all", () => {
    const none = buildClickReport([], { audience: "therapist", now: NOW });
    expect(none.count).toBe(0);
    expect(none.text).toBe("בין 5.8.2026 ל-5.10.2026 לא נרשמה אף לחיצה ליצירת קשר בפרופיל שלך.");
  });

  it("names every way a visitor can have arrived", () => {
    const line = (channel: string | null, referrerHost: string | null = null) =>
      buildClickReport([click({ channel, referrerHost })], { audience: "therapist", now: NOW }).text.split("\n")[3];
    expect(line("google_organic")).toContain("הכניסה לאתר הייתה מחיפוש בגוגל.");
    expect(line("meta_paid")).toContain("ממודעה שלנו בפייסבוק או באינסטגרם.");
    expect(line("whatsapp")).toContain("מקישור שנשלח בוואטסאפ.");
    expect(line("ai")).toContain("מעוזר בינה מלאכותית.");
    expect(line("email")).toContain("מקישור במייל.");
    expect(line("referral", "example.org")).toContain("מהאתר example.org.");
    expect(line("referral")).toContain("מקישור בתוך האתר שלנו.");
    expect(line(null)).toContain("ממקור שלא זוהה.");
    expect(line("something_new")).toContain("ממקור שלא זוהה.");
  });

  it("marks a second click of the same visitor on the same button, minutes later", () => {
    const twice = buildClickReport(
      [
        click({ at: "2026-09-22T14:54:00.000Z", sessionId: "s1" }),
        click({ at: "2026-09-22T14:54:40.000Z", sessionId: "s1" }),
        // another visitor in the same minute, and the same visitor a day later: both count
        click({ at: "2026-09-22T14:54:50.000Z", sessionId: "s2" }),
        click({ at: "2026-09-23T14:54:00.000Z", sessionId: "s1" }),
        // a different button is a different attempt to reach the therapist
        click({ at: "2026-09-23T14:55:00.000Z", sessionId: "s1", type: "phone" }),
      ],
      { audience: "therapist", now: NOW },
    );
    const lines = twice.text.split("\n").filter((l) => l.startsWith("- "));
    expect(lines.map((l) => l.includes("(לחיצה חוזרת של אותו גולש)"))).toEqual([false, true, false, false, false]);
    expect(twice.repeats).toBe(1);
    expect(twice.text.split("\n")[1]).toBe('סה"כ 5: וואטסאפ 4, חיוג 1. מתוכן אחת היא לחיצה חוזרת של אותו גולש.');
  });

  it("does not call two clicks a repeat when the visitor is unknown", () => {
    const report = buildClickReport(
      [click({ at: "2026-09-22T14:54:00.000Z" }), click({ at: "2026-09-22T14:54:30.000Z" })],
      { audience: "therapist", now: NOW },
    );
    expect(report.repeats).toBe(0);
    expect(report.text).not.toContain("לחיצה חוזרת");
  });

  it("explains what 'a link inside our site' means, since such a click may be the therapist's own", () => {
    const own = buildClickReport([click({ channel: "referral", referrerHost: null })], { audience: "therapist", now: NOW });
    expect(own.text.split("\n").at(-1)).toBe(
      'כניסה "מקישור בתוך האתר שלנו" נרשמת כשהגלישה התחילה בעמוד אחר באתר, למשל באזור האישי. לחיצה כזו יכולה להיות גם שלך.',
    );
    const none = buildClickReport([click({})], { audience: "therapist", now: NOW });
    expect(none.text.split("\n").at(-1)).toBe("השעות לפי שעון ישראל.");
  });

  it("never says anything about the visitor beyond when, which button, where and from which channel", () => {
    for (const word of ["אזור", "גיל", "קושי", "session", "utm"]) expect(report.text).not.toContain(word);
  });

  it("shows only the latest clicks when there are very many, and says so", () => {
    const many = Array.from({ length: CLICK_REPORT_MAX_LINES + 5 }, (_, i) =>
      click({ at: new Date(Date.UTC(2026, 7, 10, 8, i)).toISOString() }),
    );
    const big = buildClickReport(many, { audience: "therapist", now: NOW });
    expect(big.count).toBe(CLICK_REPORT_MAX_LINES + 5);
    expect(big.text).toContain(`מוצגות ${CLICK_REPORT_MAX_LINES} הלחיצות האחרונות מתוך ${CLICK_REPORT_MAX_LINES + 5}.`);
    expect(big.text.split("\n").filter((l) => l.startsWith("- ")).length).toBe(CLICK_REPORT_MAX_LINES);
  });
});

describe("the report a centre gets", () => {
  it("speaks of the centre, and of its own page", () => {
    const report = buildClickReport([click({ source: "profile" })], { audience: "center", now: NOW });
    expect(report.text.split("\n")[0]).toBe("לחיצות ליצירת קשר במרכז, 5.8.2026 עד 5.10.2026");
    expect(report.text).toContain("לחיצה על וואטסאפ בעמוד המרכז.");
  });

  it("names the therapist on each line when the centre has several profiles", () => {
    const report = buildClickReport(
      [click({ profileName: "דנה לוי", source: "match" }), click({ at: "2026-09-02T10:00:00.000Z", profileName: null, type: "phone" })],
      { audience: "center", now: NOW, withProfileNames: true },
    );
    expect(report.text).toContain("לחיצה על וואטסאפ (דנה לוי) בתוצאות שאלון ההתאמה.");
    expect(report.text).toContain("לחיצה על חיוג בעמוד המרכז.");
  });

  it("counts the clicks that came from inside our own site, for the admin's note", () => {
    const report = buildClickReport(
      [click({ channel: "referral", referrerHost: null }), click({ channel: "referral", referrerHost: "example.org" }), click({})],
      { audience: "center", now: NOW },
    );
    expect(report.fromInsideSite).toBe(1);
    expect(report.text.split("\n").at(-1)).toBe(
      'כניסה "מקישור בתוך האתר שלנו" נרשמת כשהגלישה התחילה בעמוד אחר באתר, למשל בפורטל המרכז. לחיצה כזו יכולה להיות גם של הצוות שלכם.',
    );
  });
});

describe("putting the report into a draft", () => {
  const block = "לחיצות ליצירת קשר בפרופיל שלך, 5.8.2026 עד 5.10.2026\nסה\"כ 1: וואטסאפ 1.";

  it("replaces the marker where the model put it", () => {
    const draft = `שלום דנה,\n\nהנה הפירוט:\n\n${CLICK_REPORT_MARKER}\n\nחשוב לדעת שלחיצה אינה פנייה.\n\nבברכה,\nצוות טיפול חכם`;
    expect(insertClickReport(draft, block)).toBe(
      `שלום דנה,\n\nהנה הפירוט:\n\n${block}\n\nחשוב לדעת שלחיצה אינה פנייה.\n\nבברכה,\nצוות טיפול חכם`,
    );
  });

  it("keeps words the model wrote on the marker's own line", () => {
    const out = insertClickReport(`שלום,\nלהלן הפירוט: ${CLICK_REPORT_MARKER}\nבברכה,\nצוות טיפול חכם`, block);
    expect(out).toBe(`שלום,\n\nלהלן הפירוט:\n\n${block}\n\nבברכה,\nצוות טיפול חכם`);
  });

  it("puts the report once even when the marker appears twice", () => {
    const out = insertClickReport(`א\n${CLICK_REPORT_MARKER}\nב\n${CLICK_REPORT_MARKER}\nג`, block);
    expect(out.split(block).length - 1).toBe(1);
    expect(out).not.toContain(CLICK_REPORT_MARKER);
  });

  it("goes before the closing line when the model forgot the marker", () => {
    expect(insertClickReport("שלום דנה,\n\nתודה על הפנייה.\n\nבברכה,\nצוות טיפול חכם", block)).toBe(
      `שלום דנה,\n\nתודה על הפנייה.\n\n${block}\n\nבברכה,\nצוות טיפול חכם`,
    );
  });

  it("goes at the end of a draft that has no closing line", () => {
    expect(insertClickReport("שלום דנה,\n\nתודה על הפנייה.", block)).toBe(`שלום דנה,\n\nתודה על הפנייה.\n\n${block}`);
  });
});

describe("a past reply used as an example for the next draft", () => {
  it("carries the marker instead of another therapist's clicks", () => {
    const report = buildClickReport([click({}), click({ at: "2026-09-03T10:00:00.000Z", type: "phone" })], {
      audience: "therapist",
      now: NOW,
    });
    const sent = `שלום דנה,\n\nהנה הפירוט:\n\n${report.text}\n\nחשוב לדעת שלחיצה אינה פנייה.\n\nבברכה,\nצוות טיפול חכם`;
    expect(collapseClickReport(sent)).toBe(
      `שלום דנה,\n\nהנה הפירוט:\n\n${CLICK_REPORT_MARKER}\n\nחשוב לדעת שלחיצה אינה פנייה.\n\nבברכה,\nצוות טיפול חכם`,
    );
  });

  it("is collapsed together with the note about clicks from inside the site", () => {
    const report = buildClickReport([click({ channel: "referral", referrerHost: null }), click({ at: "2026-09-03T10:00:00.000Z" })], {
      audience: "center",
      now: NOW,
    });
    expect(collapseClickReport(`שלום,\n\n${report.text}\n\nבברכה`)).toBe(`שלום,\n\n${CLICK_REPORT_MARKER}\n\nבברכה`);
  });

  it("is collapsed also after the admin trimmed the heading and the footer away", () => {
    const sent = "שלום,\n- 1.9 בשעה 13:00: לחיצה על וואטסאפ בעמוד הפרופיל. הכניסה לאתר הייתה מחיפוש בגוגל.\n- 3.9 בשעה 13:00: לחיצה על חיוג בעמוד הפרופיל. הכניסה לאתר הייתה מחיפוש בגוגל.\nבברכה";
    expect(collapseClickReport(sent)).toBe(`שלום,\n\n${CLICK_REPORT_MARKER}\n\nבברכה`);
  });

  it("is left alone when it has no click list", () => {
    const sent = "שלום דנה,\n\n- נקודה ראשונה\n- נקודה שנייה\n\nבברכה,\nצוות טיפול חכם";
    expect(collapseClickReport(sent)).toBe(sent);
  });
});
