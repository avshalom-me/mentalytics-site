import { describe, expect, it } from "vitest";
import {
  BIO_MIN_CHARS,
  careCooldownActive,
  careFindings,
  profileCompleteness,
  remedialHint,
  teacherMissingItems,
  type CareTeacher,
} from "./teacher-care";
import { CARE_TEMPLATES, careDraft, plainTextHtml, TEACHER_EMAIL_SIGNATURE } from "./teacher-email-templates";

// הכללים של "טיפול בפרופילים" כפי שהבעלים אישר ב-6/11/2026. הבדיקות מקבעות
// את ההבטחות: מייל אחד ב-21 יום, שבוע המתנה לפני בקשת תמונה, טיוטה אחת
// שמונה הכול, ותעודה שנדרשת רק לשלוש ההכשרות.

const NOW = new Date("2026-11-06T08:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

function teacher(over: Partial<CareTeacher> = {}): CareTeacher {
  return {
    id: "t1",
    full_name: "דנה לוי",
    listing_state: "trial",
    created_at: daysAgo(30),
    approved_at: daysAgo(20),
    remedial: false,
    qualification: "teaching_cert",
    institution: null,
    bio: "א".repeat(BIO_MIN_CHARS + 10),
    price_text: "150 ש\"ח",
    focuses: ["rw_fluency"],
    expertise: ["literacy"],
    has_certificate: false,
    has_photo: true,
    ...over,
  };
}

const run = (teachers: CareTeacher[], extra: Partial<Parameters<typeof careFindings>[0]> = {}) =>
  careFindings({ teachers, stats: {}, lastSent: {}, now: NOW, ...extra });

describe("מה חסר בפרופיל", () => {
  it("פרופיל מלא: כלום לא חסר, 5 מתוך 5", () => {
    expect(teacherMissingItems(teacher())).toEqual([]);
    expect(profileCompleteness(teacher())).toEqual({ done: 5, total: 5, missing: [] });
  });
  it("תעודה נספרת רק כשההכשרה מחייבת אותה", () => {
    expect(teacherMissingItems(teacher({ qualification: "remedial_cert" }))).toEqual(["certificate"]);
    expect(profileCompleteness(teacher({ qualification: "remedial_cert" })).total).toBe(6);
    expect(teacherMissingItems(teacher({ qualification: "student" }))).toEqual([]);
  });
  it("ביו קצר, מחיר ריק, בלי מוקדים ובלי ניסיון", () => {
    expect(teacherMissingItems(teacher({ bio: "קצר", price_text: " ", focuses: [], expertise: null, has_photo: false }))).toEqual([
      "photo",
      "price",
      "bio",
      "focuses",
      "expertise",
    ]);
  });
});

describe("הוראה מתקנת בלי תעודה", () => {
  it("מסומן/ת הוראה מתקנת בלי תעודה", () => {
    expect(remedialHint(teacher({ remedial: true, qualification: "remedial_cert", has_certificate: false }))).toBe("marked");
    expect(remedialHint(teacher({ remedial: true, qualification: "remedial_cert", has_certificate: true }))).toBeNull();
  });
  it("הביו מספר על הוראה מתקנת אבל ההכשרה היא סטודנט/ית", () => {
    expect(remedialHint(teacher({ qualification: "student", bio: "סטודנטית לחינוך מיוחד והוראה מתקנת, שנה שלישית" }))).toBe("hinted");
    expect(remedialHint(teacher({ qualification: "student", institution: "לימודי לקויות למידה" }))).toBe("hinted");
    // מי שההכשרה שלו/ה מחייבת תעודה וצירף/ה אותה - אין מה לברר.
    expect(remedialHint(teacher({ qualification: "special_ed_degree", has_certificate: true, bio: "הוראה מתקנת" }))).toBeNull();
    expect(remedialHint(teacher({ qualification: "student", bio: "מלמדת מתמטיקה בכיף" }))).toBeNull();
  });
});

describe("הטיוטות", () => {
  it("בקשת תעודה למי שכותב/ת על הוראה מתקנת, עם ההכשרה הרשומה", () => {
    const f = run([teacher({ qualification: "student", bio: "סטודנטית לחינוך מיוחד והוראה מתקנת, שנה שלישית. ".repeat(6) })]);
    expect(f.map((x) => x.kind)).toEqual(["certificate_request"]);
    expect(f[0].severity).toBe("high");
    expect(f[0].draft?.template).toBe(CARE_TEMPLATES.certificate_request);
    expect(f[0].draft?.body).toContain("סטודנט/ית");
    expect(f[0].dedupeKey).toBe("teacher:t1:certificate_request");
  });
  it("תמונה בלבד חסרה: טיוטת תמונה, אבל רק שבוע אחרי האישור", () => {
    expect(run([teacher({ has_photo: false, approved_at: daysAgo(3) })])).toEqual([]);
    const f = run([teacher({ has_photo: false, approved_at: daysAgo(8) })]);
    expect(f.map((x) => x.kind)).toEqual(["photo_request"]);
  });
  it("כמה דברים חסרים, כולל תמונה: טיוטה אחת שמונה הכול", () => {
    const f = run([teacher({ has_photo: false, price_text: null, expertise: [] })]);
    expect(f.map((x) => x.kind)).toEqual(["profile_completion"]);
    expect(f[0].draft?.body).toContain("תמונת פרופיל");
    expect(f[0].draft?.body).toContain("מחיר לשיעור");
    expect(f[0].draft?.body).toContain("ניסיון עם קשיים");
    expect(f[0].title).toContain("חסרים");
  });
  it("מורה בארכיון או שנדחה/תה לא מקבל/ת טיוטות; ממתין/ה מקבל/ת רק את ההתראה", () => {
    expect(run([teacher({ listing_state: "archived", has_photo: false })])).toEqual([]);
    const f = run([teacher({ listing_state: "pending", created_at: daysAgo(4), has_photo: false })]);
    expect(f.map((x) => x.kind)).toEqual(["pending_stale"]);
    expect(run([teacher({ listing_state: "pending", created_at: daysAgo(1) })])).toEqual([]);
  });
  it("מייל טיפול אחד ב-21 יום: אחרי בקשת תמונה שנשלחה לפני שבוע אין טיוטה חדשה", () => {
    const lastSent = { t1: { [CARE_TEMPLATES.photo_request]: daysAgo(7) } };
    expect(careCooldownActive(lastSent.t1, NOW)).toBe(true);
    expect(run([teacher({ has_photo: false, price_text: null })], { lastSent })).toEqual([]);
    const old = { t1: { [CARE_TEMPLATES.photo_request]: daysAgo(40) } };
    expect(run([teacher({ has_photo: false, price_text: null })], { lastSent: old }).length).toBe(1);
  });
  it("חשיפות בלי פניות: התראה לבעלים בלי מייל, רק אחרי 60 יום ו-20 חשיפות", () => {
    const stats = { t1: { impressions_total: 25, contacts_total: 0 } };
    expect(run([teacher({ approved_at: daysAgo(70) })], { stats }).map((x) => x.kind)).toEqual(["no_contacts"]);
    expect(run([teacher({ approved_at: daysAgo(30) })], { stats })).toEqual([]);
    expect(run([teacher({ approved_at: daysAgo(70) })], { stats: { t1: { impressions_total: 25, contacts_total: 1 } } })).toEqual([]);
  });
});

describe("המייל", () => {
  it("טקסט פשוט נכנס למעטפת: פסקאות, רשימה, קישור אישי וחתימת לימוד חכם", () => {
    const d = careDraft("profile_completion", { full_name: "דנה", qualification: null }, { missing: [{ label: "מחיר לשיעור", why: "הורים מסננים לפי מחיר" }] });
    const html = plainTextHtml({ full_name: "דנה", edit_token: "TOK" }, d.body);
    expect(html).toContain("<li");
    expect(html).toContain("מחיר לשיעור: הורים מסננים לפי מחיר");
    expect(html).toContain("/learning/k/TOK");
    expect(html).toContain(TEACHER_EMAIL_SIGNATURE);
    expect(html).toContain("limud-chacham-logo.png");
    expect(html).not.toContain("—");
  });
  it("אין מקף ארוך ואין מחיר בשום טיוטה", () => {
    const t = { full_name: "דנה", qualification: "student" };
    const all = [
      careDraft("certificate_request", t, { mode: "marked" }),
      careDraft("certificate_request", t, { mode: "hinted" }),
      careDraft("photo_request", t, {}),
      careDraft("profile_completion", t, { missing: [] }),
    ];
    for (const d of all) {
      expect(d.subject + d.body).not.toContain("—");
      expect(d.body).not.toMatch(/ש"ח לחודש|תשלום/);
      expect(d.subject).toContain("| לימוד חכם");
    }
  });
});

describe("המורים הראשונים", () => {
  const founding = new Set(["t1"]);
  it("מייל אחד במקום בקשת תעודה ובקשת השלמה, עם כל מה שחסר", () => {
    const t = teacher({ qualification: "student", bio: "סטודנטית לחינוך מיוחד והוראה מתקנת", has_photo: false, approved_at: daysAgo(5) });
    const f = run([t], { foundingIds: founding });
    expect(f.map((x) => x.kind)).toEqual(["founding_note"]);
    expect(f[0].severity).toBe("high");
    expect(f[0].draft?.template).toBe(CARE_TEMPLATES.founding_note);
    expect(f[0].draft?.body).toContain("תעודה בהוראה מתקנת");
    expect(f[0].draft?.body).toContain("• תמונת פרופיל");
    expect(f[0].title).toContain("חסרים תעודה, תמונת פרופיל");
  });
  it("פרופיל מלא: ברכה, בלי רשימת חוסרים", () => {
    const f = run([teacher()], { foundingIds: founding });
    expect(f.map((x) => x.kind)).toEqual(["founding_note"]);
    expect(f[0].draft?.body).toContain("הפרופיל שלך מלא");
    expect(f[0].draft?.body).not.toContain("•");
  });
  it("לא ביום האישור, ולא למי שאינו/ה מהראשונים", () => {
    expect(run([teacher({ approved_at: daysAgo(0.5) })], { foundingIds: founding })).toEqual([]);
    expect(run([teacher()], { foundingIds: new Set(["t2"]) })).toEqual([]);
  });
  it("אחרי שנשלח: צינון של 21 יום, ואז הכללים הרגילים", () => {
    const t = teacher({ has_photo: false, approved_at: daysAgo(40) });
    expect(run([t], { foundingIds: founding, lastSent: { t1: { [CARE_TEMPLATES.founding_note]: daysAgo(10) } } })).toEqual([]);
    const later = run([t], { foundingIds: founding, lastSent: { t1: { [CARE_TEMPLATES.founding_note]: daysAgo(30) } } });
    expect(later.map((x) => x.kind)).toEqual(["photo_request"]);
  });
  it("קישור ההצטרפות מתויג ונשלח כקישור אמיתי; 'כרגע ללא תשלום', בלי מחיר", () => {
    const d = careDraft("founding_note", { full_name: "דנה", qualification: null }, { missing: [] });
    expect(d.subject).toContain("| לימוד חכם");
    expect(d.body).toContain("כרגע ללא תשלום");
    expect(d.body).not.toMatch(/ש"ח|חינם/);
    expect(d.body + d.subject).not.toContain("—");
    const html = plainTextHtml({ full_name: "דנה", edit_token: "TOK" }, d.body);
    expect(html).toMatch(/<a href="https:\/\/www\.mentalytics\.co\.il\/learning\/join\?utm_source=community&amp;utm_medium=referral&amp;utm_campaign=teachers-referral"/);
    expect(html).toContain(">mentalytics.co.il/learning/join</a>");
    expect(html).toContain("/learning/k/TOK");
  });
  it("פותח בברכה לפי המגדר, בלי 'המאגר קטן', וההזמנה להשיב באה לפני הבקשה לעמיתים", () => {
    const she = careDraft("founding_note", { full_name: "דנה", qualification: null, gender: "נקבה" }, { missing: [] }).body;
    const he = careDraft("founding_note", { full_name: "דן", qualification: null, gender: "זכר" }, { missing: [] }).body;
    const unknown = careDraft("founding_note", { full_name: "טל", qualification: null }, { missing: [] }).body;
    expect(she.startsWith("ברוכה הבאה ללימוד חכם מבית טיפול חכם!")).toBe(true);
    expect(he.startsWith("ברוך הבא ללימוד חכם מבית טיפול חכם!")).toBe(true);
    expect(unknown.startsWith("ברוך/ה הבא/ה ללימוד חכם מבית טיפול חכם!")).toBe(true);
    for (const b of [she, he, unknown]) {
      expect(b).not.toMatch(/קטן/);
      expect(b.indexOf("אפשר להשיב למייל הזה")).toBeLessThan(b.indexOf("עמית או עמיתה"));
    }
  });
  it("תמונה חסרה: 'פרופילים ללא תמונה מקבלים מעט מאוד פניות', בבקשת התמונה וברשימת החוסרים", () => {
    expect(careDraft("photo_request", { full_name: "דנה", qualification: null }, {}).body).toContain("פרופילים ללא תמונה מקבלים מעט מאוד פניות");
    const t = teacher({ has_photo: false, approved_at: daysAgo(5) });
    expect(run([t], { foundingIds: founding })[0].draft?.body).toContain("פרופילים ללא תמונה מקבלים מעט מאוד פניות");
  });
  it("הלוגו של לימוד חכם בסוף המייל, מתחת לחתימה, ולא בראשו", () => {
    const html = plainTextHtml({ full_name: "דנה", edit_token: "TOK" }, "שורה");
    const logo = html.indexOf("limud-chacham-logo.png");
    expect(html.split("limud-chacham-logo.png").length).toBe(2);
    expect(logo).toBeGreaterThan(html.indexOf("צוות לימוד חכם"));
    expect(logo).toBeGreaterThan(html.indexOf("/learning/k/TOK"));
  });
});
