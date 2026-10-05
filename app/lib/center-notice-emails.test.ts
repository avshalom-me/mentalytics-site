import { describe, it, expect } from "vitest";
import {
  buildCenterGiftEmail,
  buildCenterStopEmail,
  centerNoticeAddresses,
  centerNoticeDate,
  pickCenterNoticeAddresses,
} from "./center-notice-emails";

const SITE = "https://example.test";

// The owner approved these texts word for word on 5/10/2026. A change here is a
// change to what a centre reads about its money, and needs his approval first.

describe("the email a centre gets when its paid subscription is stopped", () => {
  const base = {
    centerName: "מרכז הדוגמה",
    contactName: "דנה",
    billingTrack: "per_therapist",
    hasPortalAccount: true,
    stoppedAt: "2026-10-05T09:00:00.000Z",
    siteUrl: SITE,
  };

  it("carries the approved wording", () => {
    const mail = buildCenterStopEmail(base);
    expect(mail.subject).toBe("המנוי של מרכז הדוגמה בטיפול חכם נעצר");
    expect(mail.text).toBe(
      [
        "שלום דנה,",
        "המנוי של מרכז הדוגמה בטיפול חכם נעצר היום, 5.10.2026.",
        [
          "- הוראת הקבע בוטלה, וכרטיס האשראי לא יחויב.",
          "- המרכז והפרופילים של המטפלים שלו אינם מוצגים עכשיו באתר.",
          "- שום דבר לא נמחק. הפרופילים, עמוד המרכז והנתונים שמורים, ואפשר להמשיך להיכנס לפורטל ולראות אותם.",
        ].join("\n"),
        "אם תרצו לחזור, כתבו לנו ונחדש את המנוי. אין צורך להזין את הכרטיס שוב: פרטי הכרטיס שמורים אצל חברת הסליקה Sumit (לא אצלנו), והם לא יחויבו בלי בקשה מכם. עם החידוש המרכז חוזר להופיע באתר כמו שהיה.",
        "אם אתם מעדיפים שפרטי הכרטיס יוסרו, כתבו לנו ונסיר אותם.",
        "לכל שאלה: admin@getmentalytics.com\nצוות טיפול חכם",
      ].join("\n\n"),
    );
  });

  it("says the same in the HTML the centre actually sees", () => {
    const { html } = buildCenterStopEmail(base);
    for (const line of [
      "שלום דנה,",
      "המנוי של מרכז הדוגמה בטיפול חכם נעצר היום, 5.10.2026.",
      "הוראת הקבע בוטלה, וכרטיס האשראי לא יחויב.",
      "המרכז והפרופילים של המטפלים שלו אינם מוצגים עכשיו באתר.",
      "אם אתם מעדיפים שפרטי הכרטיס יוסרו, כתבו לנו ונסיר אותם.",
      "לכל שאלה: admin@getmentalytics.com",
    ]) {
      expect(html).toContain(line);
    }
    expect(html).toContain('dir="rtl"');
    expect(html).toContain(`${SITE}/logo.png`);
  });

  it("speaks of the centre's page, not of therapist profiles, for a centre listed as one entry", () => {
    const { text } = buildCenterStopEmail({ ...base, billingTrack: "center_entity" });
    expect(text).toContain("- המרכז והעמוד שלו אינם מוצגים עכשיו באתר.");
    expect(text).toContain("- שום דבר לא נמחק. עמוד המרכז והנתונים שמורים, ואפשר להמשיך להיכנס לפורטל ולראות אותם.");
    expect(text).not.toContain("הפרופילים");
  });

  it("does not tell a centre that never set up an account to keep entering the portal", () => {
    const { text } = buildCenterStopEmail({ ...base, hasPortalAccount: false });
    expect(text).toContain("- שום דבר לא נמחק. הפרופילים, עמוד המרכז והנתונים שמורים.");
    expect(text).not.toContain("פורטל");
  });

  it("greets the centre by name when there is no contact person", () => {
    expect(buildCenterStopEmail({ ...base, contactName: null }).text.startsWith("שלום מרכז הדוגמה,")).toBe(true);
    expect(buildCenterStopEmail({ ...base, contactName: "  " }).text.startsWith("שלום מרכז הדוגמה,")).toBe(true);
  });

  it("dates the stop by the Israeli calendar, not the server's", () => {
    // 22:30 UTC on the 5th is already the 6th in Israel.
    const { text } = buildCenterStopEmail({ ...base, stoppedAt: "2026-10-05T22:30:00.000Z" });
    expect(text).toContain("נעצר היום, 6.10.2026.");
  });

  it("does not let a centre's name break out of the HTML", () => {
    const mail = buildCenterStopEmail({ ...base, centerName: 'מרכז <b>"א"</b> & בניו', contactName: "<script>" });
    expect(mail.html).not.toContain("<b>");
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("מרכז &lt;b&gt;&quot;א&quot;&lt;/b&gt; &amp; בניו");
    // the subject is plain text, and must not carry HTML entities
    expect(mail.subject).toBe('המנוי של מרכז <b>"א"</b> & בניו בטיפול חכם נעצר');
  });
});

describe("the email a centre gets when it is given a gift promotion", () => {
  const base = {
    centerName: "מרכז הדוגמה",
    contactName: "דנה",
    giftUntil: "2026-11-05T09:00:00.000Z",
    hasPortalAccount: true,
    token: "tok123",
    siteUrl: SITE,
  };

  it("carries the approved wording", () => {
    const mail = buildCenterGiftEmail(base);
    expect(mail.subject).toBe("קידום במתנה למרכז הדוגמה בטיפול חכם");
    expect(mail.text).toBe(
      [
        "שלום דנה,",
        "נתנו למרכז הדוגמה קידום במתנה בטיפול חכם: המרכז מוצג באתר בלי תשלום, עד 5.11.2026.",
        "בתקופה הזו המרכז מופיע בתוצאות ההתאמה של מטופלים, יש לו עמוד באתר, והפורטל פתוח לכם לעריכה ולצפייה בנתונים, בדיוק כמו במנוי.",
        "בתום התקופה, ב-5.11.2026, המרכז יפסיק להיות מוצג באתר, וכל הפרטים שלו יישמרו. החיוב לא מתחדש מעצמו. לקראת סיום התקופה ניצור איתכם קשר, ואם תרצו להמשיך במנוי נסדר את זה.",
        "לכל שאלה: admin@getmentalytics.com\nצוות טיפול חכם",
      ].join("\n\n"),
    );
  });

  // The owner, 5/10/2026: the gift email refers to the gift only. The standing
  // order and the card belong to the stop email, also when the gift goes to a
  // paying centre.
  it("never mentions a standing order or a card", () => {
    for (const mail of [
      buildCenterGiftEmail(base),
      buildCenterGiftEmail({ ...base, giftUntil: null }),
      buildCenterGiftEmail({ ...base, hasPortalAccount: false }),
    ]) {
      for (const word of ["הוראת הקבע", "הוראת קבע", "כרטיס", "Sumit"]) {
        expect(mail.text).not.toContain(word);
        expect(mail.html).not.toContain(word);
      }
    }
  });

  it("has no end-of-period paragraph when the gift has no end date", () => {
    const { text } = buildCenterGiftEmail({ ...base, giftUntil: null });
    expect(text).toContain("המרכז מוצג באתר בלי תשלום, ללא הגבלת זמן.");
    expect(text).not.toContain("בתום התקופה");
    expect(text).not.toContain("עד ");
  });

  it("carries the account-setup link only for a centre without a portal account", () => {
    const withAccount = buildCenterGiftEmail(base);
    expect(withAccount.html).not.toContain("/centers/join/");
    expect(withAccount.text).not.toContain("חשבון ניהול");

    const without = buildCenterGiftEmail({ ...base, hasPortalAccount: false });
    expect(without.html).toContain(`href="${SITE}/centers/join/tok123"`);
    expect(without.text).toContain("כדי להיכנס לפורטל מקימים חשבון ניהול, בדקה, עם מייל וסיסמה. אין צורך בפרטי תשלום.");
    expect(without.text).toContain(`הקמת חשבון הניהול: ${SITE}/centers/join/tok123`);
  });

  it("puts a hyphen after the preposition when the name does not start with a Hebrew letter", () => {
    const mail = buildCenterGiftEmail({ ...base, centerName: "ABC Clinic" });
    expect(mail.subject).toBe("קידום במתנה ל-ABC Clinic בטיפול חכם");
    expect(mail.text).toContain("נתנו ל-ABC Clinic קידום במתנה");
  });

  it("shows the end date as the centre sees it on the site (Israeli calendar)", () => {
    expect(centerNoticeDate("2026-11-05T22:30:00.000Z")).toBe("6.11.2026");
    expect(buildCenterGiftEmail({ ...base, giftUntil: "2026-11-05T22:30:00.000Z" }).text).toContain("עד 6.11.2026.");
  });
});

describe("the addresses a centre can be emailed at", () => {
  it("lists the contact person first, then the invoices address", () => {
    expect(centerNoticeAddresses({ email: "dana@example.test", payer_email: "office@example.test" })).toEqual([
      { address: "dana@example.test", role: "contact" },
      { address: "office@example.test", role: "billing" },
    ]);
  });

  it("lists an address once when both fields hold it", () => {
    expect(centerNoticeAddresses({ email: "Dana@Example.test ", payer_email: "dana@example.test" })).toEqual([
      { address: "Dana@Example.test", role: "contact" },
    ]);
  });

  it("falls back to the invoices address when there is no contact address", () => {
    expect(centerNoticeAddresses({ email: null, payer_email: "office@example.test" })).toEqual([
      { address: "office@example.test", role: "billing" },
    ]);
  });

  it("is empty for a centre with no usable address", () => {
    expect(centerNoticeAddresses({ email: "", payer_email: null })).toEqual([]);
    expect(centerNoticeAddresses({ email: "not an address" })).toEqual([]);
  });
});

describe("choosing which of the centre's addresses get the email", () => {
  const center = { email: "dana@example.test", payer_email: "office@example.test" };

  it("accepts the centre's own addresses, as stored", () => {
    expect(pickCenterNoticeAddresses(center, ["DANA@example.test"])).toEqual(["dana@example.test"]);
    expect(pickCenterNoticeAddresses(center, ["office@example.test", "dana@example.test"])).toEqual([
      "office@example.test",
      "dana@example.test",
    ]);
  });

  it("does not send the same address twice", () => {
    expect(pickCenterNoticeAddresses(center, ["dana@example.test", "dana@example.test"])).toEqual(["dana@example.test"]);
  });

  it("refuses an address that is not on the centre", () => {
    expect(pickCenterNoticeAddresses(center, ["someone@else.test"])).toBeNull();
    expect(pickCenterNoticeAddresses(center, ["dana@example.test", "someone@else.test"])).toBeNull();
  });

  it("refuses anything that is not a list of addresses", () => {
    expect(pickCenterNoticeAddresses(center, [])).toBeNull();
    expect(pickCenterNoticeAddresses(center, "dana@example.test")).toBeNull();
    expect(pickCenterNoticeAddresses(center, [42])).toBeNull();
    expect(pickCenterNoticeAddresses(center, undefined)).toBeNull();
  });
});
