import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  trialEndingHtml, trialEndingSubject, trialLastDayHtml, signupReceivedHtml, approvedHtml,
  paymentConfirmedHtml, personalLinkHtml, rejectedHtml, teacherEmailPreview, TEACHER_EMAIL_PREVIEWS, hebDate,
} from "./teacher-email-templates";
import { teacherLinkUrl, TEACHER_PRICE_GROSS } from "./teacher-options";

// המיילים של יום 85 ושל היום האחרון מבטיחים למורה דברים שהקוד מקיים. הבדיקה
// כאן שומרת שהנוסח והכללים לא ייפרדו, ושכללי הסגנון של האתר נשמרים.

const END = "2026-12-31T21:59:59.000Z";
const T = { full_name: "דנה לוי", edit_token: "tok_ABC-123", trial_ends_at: END };
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("the day-85 email", () => {
  const html = trialEndingHtml(T, { impressions: 46, contacts: 7 });

  it("names the end date in Israel time, in the subject and the body", () => {
    expect(hebDate(END)).toBe("31 בדצמבר 2026");
    expect(trialEndingSubject(END)).toContain("31 בדצמבר 2026");
    expect(text(html)).toContain("תקופת הניסיון מסתיימת ב- 31 בדצמבר 2026");
  });
  it("states no duration: the same email goes out after an extension or a return from the archive", () => {
    expect(text(html)).not.toContain("שלושה חודשים");
    expect(text(html)).toContain("מוצג להורים מאז שאושר, בלי תשלום");
  });
  it("states the price including VAT, no commitment, and that nothing is charged before the end", () => {
    const t = text(html);
    expect(t).toContain(`${TEACHER_PRICE_GROSS} ש"ח לחודש, כולל מע"מ`);
    expect(t).toContain("ללא התחייבות");
    expect(t).toContain("עד אז לא נגבה דבר");
  });
  it("links to the sign-up page through the personal link", () => {
    expect(html).toContain(teacherLinkUrl(T.edit_token, "pay"));
    expect(teacherLinkUrl(T.edit_token, "pay")).toMatch(/\/learning\/k\/tok_ABC-123\?to=pay$/);
  });
  it("promises exactly one more email, and a reversible archive", () => {
    const t = text(html);
    expect(t).toContain("ביום האחרון נשלח תזכורת אחת נוספת, ואחריה לא יישלחו הודעות נוספות בנושא");
    expect(t).toContain("הפרופיל יעבור לארכיון ולא יוצג להורים");
    expect(t).toContain("אפשר להפעיל אותו מחדש בכל עת");
  });
  it("uses the teacher's own numbers, and only the ones that exist", () => {
    expect(text(html)).toContain("הוא הוצג 46 פעמים להורים, ו-7 הורים לחצו כדי ליצור איתך קשר");
    expect(text(trialEndingHtml(T, { impressions: 12, contacts: 1 }))).toContain("הוצג 12 פעמים להורים, והורה אחד לחץ");
    expect(text(trialEndingHtml(T, { impressions: 1, contacts: 0 }))).toContain("הוא הוצג פעם אחת להורים שחיפשו מורה");
    expect(text(trialEndingHtml(T, { impressions: 0, contacts: 2 }))).toContain("עד היום 2 הורים לחצו");
    // בלי הופעות ובלי פניות - אין שורת מספרים בכלל.
    const none = text(trialEndingHtml(T, { impressions: 0, contacts: 0 }));
    expect(none).not.toContain("הוצג");
    expect(none).not.toContain("לחצו");
  });
});

describe("the last-day email", () => {
  const t = text(trialLastDayHtml(T));
  it("says today, tomorrow's archive, and that it is the last message", () => {
    expect(t).toContain("היום מסתיימת תקופת הניסיון");
    expect(t).toContain("הפרופיל יעבור מחר לארכיון");
    expect(t).toContain("זו ההודעה האחרונה מאיתנו בנושא");
  });
});

describe("every teacher email", () => {
  const all = [
    trialEndingHtml(T, { impressions: 3, contacts: 1 }),
    trialLastDayHtml(T),
    signupReceivedHtml(T),
    approvedHtml(T),
    paymentConfirmedHtml(T, "2026-12-31"),
    personalLinkHtml(T),
    rejectedHtml(T, "לא צורפה תעודה."),
  ];
  it("has no em-dash, is right-to-left, and greets by name", () => {
    for (const html of all) {
      expect(html).not.toContain("—");
      expect(html).toContain('dir="rtl"');
      expect(html).toContain("שלום דנה לוי,");
    }
  });
  it("escapes the name and the rejection reason", () => {
    const html = rejectedHtml({ full_name: '<b>x</b>' }, '<script>');
    expect(html).not.toContain("<b>x</b>");
    expect(html).not.toContain("<script>");
  });
  it("mentions no payment request before day 85: sign-up and approval only say an email will come", () => {
    for (const html of [signupReceivedHtml(T), approvedHtml(T)]) {
      const t = text(html);
      expect(t).toContain("לקראת סוף התקופה נשלח מייל");
      expect(html).not.toContain("?to=pay");
    }
  });
});

describe("the admin preview", () => {
  it("renders every listed template, and nothing else", () => {
    for (const p of TEACHER_EMAIL_PREVIEWS) expect(teacherEmailPreview(p.key, END)?.html.length ?? 0).toBeGreaterThan(500);
    expect(teacherEmailPreview("nope", END)).toBeNull();
  });
});

describe("the automated-email guard", () => {
  it("approves exactly the teacher templates the cron and the teacher's own actions send", () => {
    const src = readFileSync(join(process.cwd(), "app", "lib", "automated-email-guard.ts"), "utf8");
    for (const tpl of ["teacher_trial_ending", "teacher_trial_last_day", "teacher_signup_received", "teacher_personal_link", "teacher_payment_confirmed"]) {
      expect(src, tpl).toContain(`"${tpl}"`);
    }
    // אישור ודחייה נשלחים רק מלחיצה באדמין, ולכן אינם ברשימת האוטומטיים.
    expect(src).not.toContain('"teacher_approved"');
    expect(src).not.toContain('"teacher_rejected"');
  });
});
