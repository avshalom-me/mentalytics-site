import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { stripHtml } from "./gmail";
import {
  buildContactFormEmail,
  isOurEmailAddress,
  parseSiteInquiry,
  SITE_FORM_SUBJECT_PREFIX,
} from "./site-inquiry";

// The service agent skips every email sent from our own domains. A visitor who
// writes through the site's contact form reaches us exactly that way - sent by
// the site, with the visitor in Reply-To - so those inquiries never entered the
// agent's queue. These tests pin the rule that lets them in, and only them.
// All names, addresses and texts here are invented.

const SITE = "noreply@mentalytics.co.il";
const form = { name: "דנה לוי", email: "dana@example.com", subject: "שאלה על הפרופיל", message: "שלום,\n\nיש לי שאלה על הפרופיל שלי.\nתודה" };

describe("an email the contact form sent us", () => {
  const mail = buildContactFormEmail(form);

  it("is recognised from its plain-text part, with the visitor's message exactly as written", () => {
    expect(parseSiteInquiry({ fromEmail: SITE, replyTo: "dana@example.com", subject: mail.subject, bodyText: mail.text })).toEqual({
      form: "contact",
      email: "dana@example.com",
      name: "דנה לוי",
      subject: "שאלה על הפרופיל",
      message: "שלום,\n\nיש לי שאלה על הפרופיל שלי.\nתודה",
    });
  });

  it("is recognised just the same when only the HTML part survives", () => {
    const parsed = parseSiteInquiry({ fromEmail: SITE, replyTo: "dana@example.com", subject: mail.subject, bodyText: stripHtml(mail.html) });
    expect(parsed).toMatchObject({ form: "contact", email: "dana@example.com", name: "דנה לוי", subject: "שאלה על הפרופיל" });
    expect(parsed?.message).toBe("שלום,\n\nיש לי שאלה על הפרופיל שלי.\nתודה");
  });

  it("is recognised when a mail service flattened the table, one cell per line", () => {
    // How an automatic HTML-to-text conversion renders the same email.
    const bodyText = [
      "פנייה חדשה מהאתר",
      "",
      "שם:",
      "דנה לוי",
      "מייל:",
      "dana@example.com [mailto:dana@example.com]",
      "נושא:",
      "שאלה על הפרופיל",
      "",
      "הודעה:",
      "",
      "שלום, יש לי שאלה על הפרופיל שלי. תודה",
      "",
      "נשלח מ-mentalytics-site.vercel.app",
    ].join("\n");
    expect(parseSiteInquiry({ fromEmail: SITE, replyTo: "Dana@Example.com", subject: mail.subject, bodyText })).toEqual({
      form: "contact",
      email: "dana@example.com",
      name: "דנה לוי",
      subject: "שאלה על הפרופיל",
      message: "שלום, יש לי שאלה על הפרופיל שלי. תודה",
    });
  });

  it("keeps the subject as plain text in the header, and reads back one that was HTML-escaped by the old form", () => {
    const quoted = buildContactFormEmail({ ...form, subject: 'שאלה על "חבילה" & מחיר' });
    expect(quoted.subject).toBe('פנייה חדשה מ-טיפול חכם: שאלה על "חבילה" & מחיר');
    const old = parseSiteInquiry({
      fromEmail: SITE,
      replyTo: "dana@example.com",
      subject: "פנייה חדשה מ-טיפול חכם: שאלה על &quot;חבילה&quot; &amp; מחיר",
      bodyText: quoted.text,
    });
    expect(old?.subject).toBe('שאלה על "חבילה" & מחיר');
  });

  it("has an empty subject when the visitor wrote none", () => {
    const blank = buildContactFormEmail({ ...form, subject: "" });
    expect(blank.subject).toBe("פנייה חדשה מ-טיפול חכם: ללא נושא");
    const parsed = parseSiteInquiry({ fromEmail: SITE, replyTo: "dana@example.com", subject: blank.subject, bodyText: blank.text });
    expect(parsed?.subject).toBe("");
    expect(parsed?.message).toBe(form.message);
  });

  it("does not cut a message that itself says 'הודעה:' or ends with 'נשלח מ-...'", () => {
    const message = "קיבלתי מכם הודעה: החשבון נחסם.\nלמה?\n\nנשלח מ-iPhone";
    const tricky = buildContactFormEmail({ ...form, subject: "הודעה: חשבון", message });
    for (const bodyText of [tricky.text, stripHtml(tricky.html)]) {
      const parsed = parseSiteInquiry({ fromEmail: SITE, replyTo: "dana@example.com", subject: tricky.subject, bodyText });
      expect(parsed?.subject).toBe("הודעה: חשבון");
      expect(parsed?.message).toBe(message);
    }
  });

  it("gives back an apostrophe the HTML part carried as an entity", () => {
    const withQuote = buildContactFormEmail({ ...form, message: "אני מטפלת בצ'כית" });
    const parsed = parseSiteInquiry({ fromEmail: SITE, replyTo: "dana@example.com", subject: withQuote.subject, bodyText: stripHtml(withQuote.html) });
    expect(parsed?.message).toBe("אני מטפלת בצ'כית");
  });

  it("does not let a visitor's line break into the subject header", () => {
    expect(buildContactFormEmail({ ...form, subject: "שורה\r\nBcc: someone@example.com" }).subject).not.toMatch(/[\r\n]/);
  });
});

describe("an email the developers form sent us", () => {
  const body = [
    "פנייה חדשה — בית למפתחים",
    "טופס הצטרפות מהאתר",
    "שם: יואב כהן",
    "מייל: yoav@example.com",
    "טלפון: 0500000000",
    "תפקיד / רקע: פסיכולוג חינוכי",
    "שלב הרעיון: רעיון ראשוני",
    "קישור / אתר: —",
    "תיאור הרעיון:",
    "כלי לתרגול נשימות לילדים.",
    "נשלח מ-mentalytics.co.il/developers",
  ].join("\n");

  it("is recognised, and keeps the whole form as the message", () => {
    const parsed = parseSiteInquiry({
      fromEmail: SITE,
      replyTo: "yoav@example.com",
      subject: `${SITE_FORM_SUBJECT_PREFIX.developers} יואב כהן`,
      bodyText: body,
    });
    expect(parsed).toMatchObject({ form: "developers", email: "yoav@example.com", name: "יואב כהן", subject: "" });
    expect(parsed?.message.startsWith("שם: יואב כהן")).toBe(true);
    expect(parsed?.message).toContain("תיאור הרעיון:\nכלי לתרגול נשימות לילדים.");
    expect(parsed?.message).not.toContain("נשלח מ-mentalytics");
  });
});

describe("everything else from our own addresses stays out of the queue", () => {
  const mail = buildContactFormEmail(form);
  const base = { fromEmail: SITE, replyTo: "dana@example.com", subject: mail.subject, bodyText: mail.text };

  it("an alert the system sent itself: no Reply-To", () => {
    expect(parseSiteInquiry({ ...base, replyTo: null })).toBeNull();
    expect(parseSiteInquiry({ ...base, replyTo: "" })).toBeNull();
  });

  it("a mail whose Reply-To is one of our own addresses", () => {
    expect(parseSiteInquiry({ ...base, replyTo: "admin@getmentalytics.com" })).toBeNull();
  });

  it("a mail with a visitor in Reply-To that is not one of the two forms", () => {
    // e.g. a patient's message to a therapist, copied to our mailbox: it is the
    // therapist's to answer, not ours.
    expect(parseSiteInquiry({ ...base, subject: "פנייה חדשה ממטופל/ת דרך אתר טיפול חכם" })).toBeNull();
  });

  it("a mail that only imitates the form: sent from outside", () => {
    expect(parseSiteInquiry({ ...base, fromEmail: "someone@example.com" })).toBeNull();
    expect(parseSiteInquiry({ ...base, fromEmail: "noreply@mentalytics.co.il.example.com" })).toBeNull();
  });

  it("a form email with nothing in it", () => {
    expect(parseSiteInquiry({ ...base, bodyText: "הודעה:\n\nנשלח מ-mentalytics-site.vercel.app" })).toBeNull();
  });
});

describe("our own addresses", () => {
  it("are the two domains we send and receive on, whatever the case", () => {
    expect(isOurEmailAddress("noreply@mentalytics.co.il")).toBe(true);
    expect(isOurEmailAddress("Admin@GetMentalytics.com")).toBe(true);
    expect(isOurEmailAddress("dana@example.com")).toBe(false);
    expect(isOurEmailAddress("dana@notmentalytics.co.il")).toBe(false);
  });
});
