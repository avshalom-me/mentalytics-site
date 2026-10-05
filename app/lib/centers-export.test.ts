import { describe, it, expect } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import {
  buildCentersXlsx,
  centersExportFileName,
  centersExportSheet,
  type ExportCenter,
} from "./centers-export";

// Invented centres only - this repo is public.
const center = (over: Partial<ExportCenter> = {}): ExportCenter => ({
  name: "מרכז לדוגמה",
  status: "active",
  billing_track: "per_therapist",
  contact_name: null,
  email: null,
  phone: null,
  notes: null,
  created_at: "2026-09-01T08:00:00Z",
  updated_at: "2026-09-02T08:00:00Z",
  gift_months: 0,
  price_per_therapist: null,
  therapist_count: null,
  fixed_monthly_price: null,
  num_locations: 1,
  discount_amount: 0,
  agreed_monthly_price: null,
  billing_starts_at: null,
  paid_at: null,
  cancelled_at: null,
  payer_name: null,
  payer_email: null,
  payer_phone: null,
  sumit_recurring_id: null,
  slug: null,
  public_page_enabled: false,
  public_description: null,
  public_managers: null,
  public_city: null,
  public_website: null,
  public_phone: null,
  public_whatsapp: null,
  user_id: null,
  linked_therapist_count: 0,
  pending_therapist_count: 0,
  ...over,
});

const engagement = {
  views_30: 40,
  clicks_30: 6,
  views_total: 900,
  clicks_total: 1234,
  clicks_30_by_channel: { paid: 2, organic: 1, direct: 0, other: 3 },
  clicks_30_by_type: { whatsapp: 3, phone: 1 },
  page_views_30: 12,
  page_views_total: 80,
  website_clicks_30: 2,
  website_clicks_total: 9,
  page_contact_30: 1,
  page_contact_total: 4,
  card_contact_30: 5,
  card_contact_total: 11,
  site_messages_30: 4,
  site_messages_total: 7,
};

// The value in one column of one row, found by its header.
function cell(centers: ExportCenter[], header: string, row = 0) {
  const sheet = centersExportSheet(centers);
  const col = sheet.columns.findIndex((c) => c.header === header);
  expect(col, `no column "${header}"`).toBeGreaterThanOrEqual(0);
  return sheet.rows[row][col];
}

describe("the columns", () => {
  const { columns } = centersExportSheet([]);

  it("have unique headers", () => {
    const headers = columns.map((c) => c.header);
    expect(new Set(headers).size).toBe(headers.length);
  });

  it("fit their header in at most two lines, so the header row stays low", () => {
    for (const c of columns) {
      expect(Math.ceil((c.header.length * 1.15) / c.width), c.header).toBeLessThanOrEqual(2);
    }
  });

  it("alternate the header shade between sections, starting with the first", () => {
    expect(columns[0].band).toBe(0);
    const bands = columns.map((c) => c.band);
    expect(new Set(bands)).toEqual(new Set([0, 1]));
    // Bands change only at section edges: a run of one shade is never a single column.
    const runs: number[] = [];
    let run = 1;
    for (let i = 1; i < bands.length; i++) {
      if (bands[i] === bands[i - 1]) run++;
      else {
        runs.push(run);
        run = 1;
      }
    }
    runs.push(run);
    expect(Math.min(...runs)).toBeGreaterThan(1);
  });

  it("show the sheet right-to-left with the centre name frozen", () => {
    const sheet = centersExportSheet([]);
    expect(sheet.rtl).toBe(true);
    expect(sheet.freezeFirstColumn).toBe(true);
    expect(columns[0].header).toBe("שם המרכז");
  });
});

describe("rows", () => {
  it("come in the order the admin page lists centres: active track 2, active track 1, gift, sent, draft, stopped", () => {
    const rows = [
      center({ name: "נעצר", status: "cancelled" }),
      center({ name: "במתנה", status: "active", billing_track: "center_entity", gift_granted_at: "2026-10-05T10:00:00Z" }),
      center({ name: "טיוטה א", status: "draft" }),
      center({ name: "נשלח", status: "sent" }),
      center({ name: "פעיל מסלול 1 - ראשון", status: "active" }),
      center({ name: "פעיל מסלול 2", status: "active", billing_track: "center_entity" }),
      center({ name: "טיוטה ב", status: "draft" }),
      center({ name: "פעיל מסלול 1 - שני", status: "active" }),
    ];
    const names = centersExportSheet(rows).rows.map((r) => r[0]);
    expect(names).toEqual([
      "פעיל מסלול 2",
      "פעיל מסלול 1 - ראשון",
      "פעיל מסלול 1 - שני",
      "במתנה",
      "נשלח",
      "טיוטה א",
      "טיוטה ב",
      "נעצר",
    ]);
  });

  it("do not reorder or change the list they were given", () => {
    const rows = [center({ name: "ב", status: "draft" }), center({ name: "א", status: "active" })];
    centersExportSheet(rows);
    expect(rows.map((r) => r.name)).toEqual(["ב", "א"]);
  });

  it("are one per centre, with a value slot for every column", () => {
    const sheet = centersExportSheet([center(), center({ name: "עוד אחד" })]);
    expect(sheet.rows).toHaveLength(2);
    for (const r of sheet.rows) expect(r).toHaveLength(sheet.columns.length);
  });
});

describe("identity and status", () => {
  it("uses the admin's own words for status and track", () => {
    expect(cell([center({ status: "sent" })], "סטטוס")).toBe("הצעה נשלחה");
    expect(cell([center({ status: "active" })], "סטטוס")).toBe("מנוי פעיל");
    expect(cell([center({ status: "draft" })], "סטטוס")).toBe("טיוטה");
    expect(cell([center({ status: "cancelled" })], "סטטוס")).toBe("בארכיון");
    expect(cell([center({ billing_track: "center_entity" })], "מסלול")).toBe("מסלול 2 - מרכז כישות");
    expect(cell([center({ billing_track: "per_therapist" })], "מסלול")).toBe("מסלול 1 - מטפלים בנפרד");
    // An old or empty track is track 1, as on the page.
    expect(cell([center({ billing_track: null })], "מסלול")).toBe("מסלול 1 - מטפלים בנפרד");
  });

  it("tells a centre on a gift promotion from a paying one", () => {
    const gift = center({ status: "active", gift_granted_at: "2026-10-05T10:00:00Z", gift_until: "2026-12-05T10:00:00Z" });
    expect(cell([gift], "סטטוס")).toBe("קידום מתנה");
    expect(cell([gift], "קידום מתנה מתאריך")).toBeCloseTo(46300 + 13 / 24, 7);
    expect(cell([gift], "קידום מתנה עד")).toBeCloseTo(46361 + 12 / 24, 7);
    // A gift with no end date: the status says gift, the end date stays empty.
    const open = center({ status: "active", gift_granted_at: "2026-10-05T10:00:00Z", gift_until: null });
    expect(cell([open], "סטטוס")).toBe("קידום מתנה");
    expect(cell([open], "קידום מתנה עד")).toBeNull();
    // A paying centre has neither.
    expect(cell([center({ status: "active" })], "קידום מתנה מתאריך")).toBeNull();
  });

  it("does not call a stopped centre a gift, whatever dates were left on its row", () => {
    const stopped = center({ status: "cancelled", gift_granted_at: "2026-09-05T10:00:00Z", gift_until: "2026-10-05T10:00:00Z", cancel_reason: "gift_ended", cancelled_at: "2026-10-06T06:45:00Z" });
    expect(cell([stopped], "סטטוס")).toBe("בארכיון");
    expect(cell([stopped], "קידום מתנה מתאריך")).toBeNull();
    expect(cell([stopped], "קידום מתנה עד")).toBeNull();
    expect(cell([stopped], "סיבת העצירה")).toBe("תקופת המתנה הסתיימה");
  });

  it("says why a subscription stopped, and nothing for a centre that is not stopped", () => {
    expect(cell([center({ status: "cancelled", cancel_reason: "admin" })], "סיבת העצירה")).toBe("נעצר מהאדמין");
    expect(cell([center({ status: "cancelled", cancel_reason: "sumit" })], "סיבת העצירה")).toBe("הוראת הקבע בוטלה ב-Sumit");
    // Stopped before the reason was kept.
    expect(cell([center({ status: "cancelled" })], "סיבת העצירה")).toBeNull();
    expect(cell([center({ status: "active", cancel_reason: "admin" })], "סיבת העצירה")).toBeNull();
  });

  it("keeps an unknown status readable instead of dropping it", () => {
    expect(cell([center({ status: "paused" })], "סטטוס")).toBe("paused");
  });

  it("trims text and turns blank text into an empty cell", () => {
    expect(cell([center({ contact_name: "  דנה  ", notes: "   " })], "איש/אשת קשר")).toBe("דנה");
    expect(cell([center({ notes: "   " })], "הערות פנימיות")).toBeNull();
  });

  it("keeps phone numbers as text, leading zero and all", () => {
    expect(cell([center({ phone: "052-0000000", payer_phone: "0500000000" })], "טלפון איש/אשת הקשר (פנימי)")).toBe("052-0000000");
    expect(cell([center({ payer_phone: "0500000000" })], "טלפון המשלם")).toBe("0500000000");
  });
});

describe("offer and price", () => {
  const perTherapist = center({
    price_per_therapist: 100,
    therapist_count: 5,
    num_locations: 2,
    discount_amount: 50,
    fixed_monthly_price: 999, // stale value left from before a track change; not used on track 1
  });
  const entity = center({
    billing_track: "center_entity",
    fixed_monthly_price: 800,
    price_per_therapist: 111, // stale on track 2
    therapist_count: 3,
    discount_amount: 0,
  });

  it("shows per-therapist price and count only on track 1, and the fixed price only on track 2", () => {
    expect(cell([perTherapist], 'מחיר למטפל (₪, לפני מע"מ)')).toBe(100);
    expect(cell([perTherapist], "מספר מטפלים בהצעה")).toBe(5);
    expect(cell([perTherapist], 'מחיר חודשי קבוע (₪, לפני מע"מ)')).toBeNull();
    expect(cell([entity], 'מחיר למטפל (₪, לפני מע"מ)')).toBeNull();
    expect(cell([entity], "מספר מטפלים בהצעה")).toBeNull();
    expect(cell([entity], 'מחיר חודשי קבוע (₪, לפני מע"מ)')).toBe(800);
  });

  it("computes the monthly total the way the admin card does: base x locations - discount, then VAT", () => {
    // 100 x 5 = 500; x 2 locations = 1000; - 50 = 950; +18% = 1121.
    expect(cell([perTherapist], 'סכום חודשי לפי ההצעה (₪, לפני מע"מ)')).toBe(950);
    expect(cell([perTherapist], 'סכום חודשי לפי ההצעה (₪, כולל מע"מ)')).toBe(1121);
    expect(cell([entity], 'סכום חודשי לפי ההצעה (₪, לפני מע"מ)')).toBe(800);
    expect(cell([entity], 'סכום חודשי לפי ההצעה (₪, כולל מע"מ)')).toBe(944);
  });

  it("leaves the totals empty when no price is set - a 0 would read as a price", () => {
    const unpriced = center({ price_per_therapist: null, therapist_count: null });
    expect(cell([unpriced], 'סכום חודשי לפי ההצעה (₪, לפני מע"מ)')).toBeNull();
    expect(cell([unpriced], 'סכום חודשי לפי ההצעה (₪, כולל מע"מ)')).toBeNull();
  });

  it("carries the gift months, locations, discount and the agreed price as numbers", () => {
    const c = center({ gift_months: 2, num_locations: 3, discount_amount: 75.5, agreed_monthly_price: 1500 });
    expect(cell([c], "חודשי מתנה בהצעה")).toBe(2);
    expect(cell([c], "מספר מיקומים")).toBe(3);
    expect(cell([c], 'הנחה (₪ לחודש, לפני מע"מ)')).toBe(75.5);
    expect(cell([c], 'מחיר חודשי שסוכם (₪, לפני מע"מ)')).toBe(1500);
  });

  it("accepts numbers that arrive as strings and ignores junk", () => {
    const c = center({ agreed_monthly_price: "1250.5" as unknown as number, discount_amount: "abc" as unknown as number });
    expect(cell([c], 'מחיר חודשי שסוכם (₪, לפני מע"מ)')).toBe(1250.5);
    expect(cell([c], 'הנחה (₪ לחודש, לפני מע"מ)')).toBeNull();
  });
});

describe("dates", () => {
  it("show timestamps in Israel time, not UTC", () => {
    // 21:30Z on 29 Sept is 00:30 on 30 Sept in Israel (UTC+3).
    const c = center({ created_at: "2026-09-29T21:30:00Z", paid_at: "2026-01-15T12:00:00Z" });
    expect(cell([c], "נוצר")).toBeCloseTo(46295 + 30 / 1440, 7);
    expect(cell([c], "שולם בתאריך")).toBeCloseTo(46037 + 14 / 24, 7);
  });

  it("keeps a date-only value on its own day", () => {
    expect(cell([center({ billing_starts_at: "2026-10-05" })], "תחילת חיוב")).toBe(46300);
  });

  it("leave the cell empty for a missing or unreadable date", () => {
    const c = center({ cancelled_at: null, paid_at: "garbage" });
    expect(cell([c], "נעצר בתאריך")).toBeNull();
    expect(cell([c], "שולם בתאריך")).toBeNull();
    expect(cell([c], "תחילת חיוב")).toBeNull();
  });

  it("use date formats for date columns", () => {
    const kinds = Object.fromEntries(centersExportSheet([]).columns.map((c) => [c.header, c.kind]));
    expect(kinds["נוצר"]).toBe("datetime");
    expect(kinds["תחילת חיוב"]).toBe("date");
  });
});

describe("payment", () => {
  it("carries the payer and the recurring-payment id", () => {
    const c = center({ payer_name: "שם משלם", payer_email: "payer@example.com", sumit_recurring_id: "12345" });
    expect(cell([c], "שם המשלם")).toBe("שם משלם");
    expect(cell([c], "אימייל המשלם")).toBe("payer@example.com");
    expect(cell([c], "מזהה הוראת קבע ב-Sumit")).toBe("12345");
  });
});

describe("the public page", () => {
  const live = { slug: "sample-centre", public_page_enabled: true, status: "active" };

  it("gives the link only when the page is live, the same test the admin card uses", () => {
    expect(cell([center(live)], "עמוד ציבורי באוויר")).toBe("כן");
    expect(cell([center(live)], "כתובת העמוד הציבורי")).toBe("https://www.mentalytics.co.il/centers/sample-centre");
    // Not active yet: the page is not up, so no link to a page that 404s.
    expect(cell([center({ ...live, status: "draft" })], "עמוד ציבורי באוויר")).toBe("לא");
    expect(cell([center({ ...live, status: "draft" })], "כתובת העמוד הציבורי")).toBeNull();
    // Flag off on track 1: not live.
    expect(cell([center({ ...live, public_page_enabled: false })], "עמוד ציבורי באוויר")).toBe("לא");
    // No slug: nothing to link to.
    expect(cell([center({ ...live, slug: null })], "כתובת העמוד הציבורי")).toBeNull();
  });

  it("treats a track 2 page as live without the flag - the page is the whole product there", () => {
    const c = center({ ...live, billing_track: "center_entity", public_page_enabled: false });
    expect(cell([c], "עמוד ציבורי באוויר")).toBe("כן");
  });

  it("carries the fields the centre and the admin filled in", () => {
    const c = center({
      public_description: "תיאור קצר",
      public_managers: "שני מנהלים",
      public_city: "עיר",
      public_address: "רחוב 1",
      public_phone: "03-0000000",
      public_whatsapp: "03-0000001",
      public_website: "https://example.com",
      public_founded_year: 2015,
      public_team_size: 12,
      public_hours: "א-ה 9-17",
      public_accessibility: "נגיש",
    });
    expect(cell([c], "תיאור המרכז")).toBe("תיאור קצר");
    expect(cell([c], "שמות המנהלים / הצוות")).toBe("שני מנהלים");
    expect(cell([c], "עיר / כתובת")).toBe("עיר");
    expect(cell([c], "כתובת מלאה")).toBe("רחוב 1");
    expect(cell([c], "טלפון לחיוג (מוצג באתר)")).toBe("03-0000000");
    expect(cell([c], "וואטסאפ עסקי")).toBe("03-0000001");
    expect(cell([c], "אתר המרכז")).toBe("https://example.com");
    expect(cell([c], "שנת ייסוד")).toBe(2015);
    expect(cell([c], "גודל הצוות")).toBe(12);
    expect(cell([c], "שעות פעילות")).toBe("א-ה 9-17");
    expect(cell([c], "נגישות")).toBe("נגיש");
  });

  it("turns the list-shaped fields into readable text", () => {
    const c = center({
      public_director: { name: "ד\"ר לדוגמה", role: "מנהלת המרכז", note: "הערה קצרה" },
      team_members: [
        { name: "חבר א", role: "פסיכולוג", photo_path: null },
        { name: "חבר ב", role: "", photo_path: "x.png" },
      ],
      public_faq: [
        { q: "שאלה ראשונה?", a: "תשובה ראשונה." },
        { q: "שאלה שנייה?", a: "תשובה שנייה." },
      ],
      gallery: [{ path: "a.png", caption: null }, { path: "b.png", caption: "כיתוב" }],
      logo_path: "logo.png",
    });
    expect(cell([c], "מנהל/ת המרכז")).toBe('ד"ר לדוגמה - מנהלת המרכז\nהערה קצרה');
    expect(cell([c], "צוות בעמוד הציבורי")).toBe("חבר א - פסיכולוג\nחבר ב");
    expect(cell([c], "שאלות ותשובות בעמוד")).toBe("ש: שאלה ראשונה?\nת: תשובה ראשונה.\n\nש: שאלה שנייה?\nת: תשובה שנייה.");
    expect(cell([c], "תמונות בגלריה")).toBe(2);
    expect(cell([c], "לוגו")).toBe("יש");
  });

  it("survives jsonb columns of the wrong shape", () => {
    const c = center({
      public_director: "oops",
      team_members: "oops",
      public_faq: { q: "not a list" },
      gallery: 7,
    });
    expect(() => centersExportSheet([c])).not.toThrow();
    expect(cell([c], "מנהל/ת המרכז")).toBeNull();
    expect(cell([c], "צוות בעמוד הציבורי")).toBeNull();
    expect(cell([c], "שאלות ותשובות בעמוד")).toBeNull();
    expect(cell([c], "תמונות בגלריה")).toBe(0);
    // Array entries that are not objects are skipped, the rest kept.
    const d = center({ team_members: [null, "x", { name: "חברה", role: "מטפלת" }] });
    expect(cell([d], "צוות בעמוד הציבורי")).toBe("חברה - מטפלת");
  });

  it("says nothing about logo and gallery when the fields were not loaded, and 'אין' when they are empty", () => {
    expect(cell([center()], "לוגו")).toBeNull();
    expect(cell([center()], "תמונות בגלריה")).toBeNull();
    expect(cell([center({ logo_path: null, gallery: [] })], "לוגו")).toBe("אין");
    expect(cell([center({ logo_path: null, gallery: [] })], "תמונות בגלריה")).toBe(0);
  });
});

describe("portal accounts and linked therapists", () => {
  it("says whether they have entered the portal and lists the accounts, marking the main one", () => {
    const c = center({
      user_id: "u1",
      members: [
        { email: "main@example.com", is_primary: true },
        { email: "second@example.com", is_primary: false },
        { email: null, is_primary: false },
      ],
      linked_therapist_count: 4,
      pending_therapist_count: 1,
    });
    expect(cell([c], "נכנסו לפורטל")).toBe("כן");
    expect(cell([c], "חשבונות בפורטל")).toBe("main@example.com (ראשי); second@example.com; ?");
    expect(cell([c], "מטפלים משויכים")).toBe(4);
    expect(cell([c], "ממתינים לאישור")).toBe(1);
    expect(cell([center()], "נכנסו לפורטל")).toBe("לא");
    expect(cell([center()], "חשבונות בפורטל")).toBeNull();
  });
});

describe("readiness and health", () => {
  const active = center({
    readiness: {
      pct: 60,
      headline: "חסרים שני מטפלים",
      slots: { paid: 5, filled: 4, promoted: 3 },
      missing: [{ label: "תמונה" }, { label: "טלפון" }],
      blocked_on_us: ["אישור פרופיל"],
    },
    health: {
      severity: "high",
      days_to_billing: 9,
      flags: [
        { label: "אין פניות", owner: "center", detail: "אפס ב-30 יום." },
        { label: "מעט חשיפה", owner: "us", detail: "" },
      ],
    },
  });

  it("carries readiness as numbers and lists", () => {
    expect(cell([active], "מוכנות (%)")).toBe(60);
    expect(cell([active], "מקומות בתשלום")).toBe(5);
    expect(cell([active], "מקומות פעילים")).toBe(3);
    expect(cell([active], "מקומות מקושרים")).toBe(4);
    expect(cell([active], "מוכנות: כותרת")).toBe("חסרים שני מטפלים");
    expect(cell([active], "מוכנות: חסר אצלם")).toBe("תמונה\nטלפון");
    expect(cell([active], "מוכנות: חסמים אצלנו")).toBe("אישור פרופיל");
  });

  it("carries health severity, the countdown to billing and the flags with who owns them", () => {
    expect(cell([active], "בריאות: חומרה")).toBe("גבוהה");
    expect(cell([active], "חיוב בעוד (ימים)")).toBe(9);
    expect(cell([active], "בריאות: דגלים")).toBe("אין פניות (אצלם): אפס ב-30 יום.\nמעט חשיפה (אצלנו)");
  });

  it("leaves the countdown empty once billing is active (the card says 'חיוב פעיל')", () => {
    const billing = center({ health: { severity: "normal", days_to_billing: -3, flags: [] } });
    expect(cell([billing], "חיוב בעוד (ימים)")).toBeNull();
    expect(cell([billing], "בריאות: חומרה")).toBe("רגילה");
    const today = center({ health: { severity: null, days_to_billing: 0, flags: [] } });
    expect(cell([today], "חיוב בעוד (ימים)")).toBe(0);
    expect(cell([today], "בריאות: חומרה")).toBeNull();
  });

  it("leaves all of it empty for a centre that has neither", () => {
    for (const h of ["מוכנות (%)", "מקומות בתשלום", "מוכנות: חסר אצלם", "בריאות: חומרה", "בריאות: דגלים", "חיוב בעוד (ימים)"]) {
      expect(cell([center()], h), h).toBeNull();
    }
  });
});

describe("engagement", () => {
  const c = center({ engagement });

  it("carries the 30-day and all-time counts as numbers", () => {
    expect(cell([c], "צפיות (30 יום)")).toBe(40);
    expect(cell([c], "לחיצות ליצירת קשר (30 יום)")).toBe(6);
    expect(cell([c], "הודעות באתר (30 יום)")).toBe(4);
    expect(cell([c], "כניסות לעמוד הציבורי (30 יום)")).toBe(12);
    expect(cell([c], "לחיצות לאתר המרכז (30 יום)")).toBe(2);
    expect(cell([c], "לחיצות קשר מהעמוד (30 יום)")).toBe(1);
    expect(cell([c], "לחיצות קשר מכרטיס המרכז (30 יום)")).toBe(5);
    expect(cell([c], "צפיות (מצטבר)")).toBe(900);
    expect(cell([c], "לחיצות ליצירת קשר (מצטבר)")).toBe(1234);
    expect(cell([c], "הודעות באתר (מצטבר)")).toBe(7);
    expect(cell([c], "כניסות לעמוד הציבורי (מצטבר)")).toBe(80);
    expect(cell([c], "לחיצות לאתר המרכז (מצטבר)")).toBe(9);
    expect(cell([c], "לחיצות קשר מהעמוד (מצטבר)")).toBe(4);
    expect(cell([c], "לחיצות קשר מכרטיס המרכז (מצטבר)")).toBe(11);
  });

  it("spells out the channel split, skipping empty channels", () => {
    expect(cell([c], "לחיצות לפי ערוץ (30 יום)")).toBe("ממומן 2 · אורגני 1 · אחר 3");
  });

  it("spells out the click types the way the card does, with site messages added, biggest first", () => {
    // 4 site messages (from another table on track 1) + 3 WhatsApp + 1 phone.
    expect(cell([c], "פניות לפי סוג (30 יום)")).toBe("הודעות באתר 4 · וואטסאפ 3 · טלפון 1");
  });

  it("names a click type it does not know rather than hiding it", () => {
    const odd = center({ engagement: { ...engagement, site_messages_30: 0, clicks_30_by_type: { carrier_pigeon: 2 } } });
    expect(cell([odd], "פניות לפי סוג (30 יום)")).toBe("carrier_pigeon 2");
  });

  it("leaves the text empty when there were no clicks, and every cell empty without engagement data", () => {
    const quiet = center({
      engagement: {
        ...engagement,
        site_messages_30: 0,
        clicks_30_by_channel: { paid: 0, organic: 0, direct: 0, other: 0 },
        clicks_30_by_type: {},
      },
    });
    expect(cell([quiet], "לחיצות לפי ערוץ (30 יום)")).toBeNull();
    expect(cell([quiet], "פניות לפי סוג (30 יום)")).toBeNull();
    expect(cell([center()], "צפיות (30 יום)")).toBeNull();
    expect(cell([center()], "לחיצות לפי ערוץ (30 יום)")).toBeNull();
    expect(cell([center({ engagement: null })], "צפיות (מצטבר)")).toBeNull();
  });

  it("keeps a real zero as 0, not as a blank", () => {
    const zero = center({ engagement: { ...engagement, views_30: 0 } });
    expect(cell([zero], "צפיות (30 יום)")).toBe(0);
  });
});

describe("what never goes into the file", () => {
  const SECRETS = ["SECRET-JOIN-TOKEN-8f3a91", "515151515", "org-9c2d", "doc-77aa31"];
  const withSecrets = {
    ...center({ name: "מרכז עם סודות", payer_name: "משלם" }),
    token: SECRETS[0],
    payer_company_number: SECRETS[1],
    organization_id: SECRETS[2],
    sumit_document_id: SECRETS[3],
  } as unknown as ExportCenter;

  it("has no join-link token, company number or internal ids, anywhere in the workbook", () => {
    const parts = unzipSync(buildCentersXlsx([withSecrets]));
    const all = Object.values(parts).map((u) => strFromU8(u)).join("\n");
    expect(all).toContain("מרכז עם סודות"); // the file does carry the centre
    for (const secret of SECRETS) expect(all.includes(secret), secret).toBe(false);
  });

  it("has no column named after them either", () => {
    const headers = centersExportSheet([]).columns.map((c) => c.header).join("|");
    expect(headers).not.toMatch(/token|טוקן|קישור הצטרפות|ח\.פ|עוסק|מספר חברה|organization|company/i);
  });
});

describe("the workbook", () => {
  it("is a real .xlsx with a filter over every column and row", () => {
    const rows = [center({ name: "א" }), center({ name: "ב" }), center({ name: "ג" })];
    const sheet = centersExportSheet(rows);
    const files = unzipSync(buildCentersXlsx(rows));
    const xml = strFromU8(files["xl/worksheets/sheet1.xml"]);
    // The last column's letter, from the count of columns.
    const n = sheet.columns.length;
    const letter = (i: number): string => (i < 26 ? String.fromCharCode(65 + i) : letter(Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26)));
    expect(xml).toContain(`<autoFilter ref="A1:${letter(n - 1)}4"/>`);
    expect(xml).toContain("שם המרכז");
    expect(xml).toContain('rightToLeft="1"');
    expect(strFromU8(files["xl/workbook.xml"])).toContain('<sheet name="מרכזים"');
  });

  it("builds for an empty list too", () => {
    const files = unzipSync(buildCentersXlsx([]));
    expect(strFromU8(files["xl/worksheets/sheet1.xml"])).toContain("<sheetData><row r=\"1\"");
  });

  it("holds up on a large list", () => {
    const rows = Array.from({ length: 300 }, (_, i) => center({ name: `מרכז ${i}`, engagement }));
    expect(() => buildCentersXlsx(rows)).not.toThrow();
  });
});

describe("file name", () => {
  it("carries the Israeli date and is plain ASCII", () => {
    // 21:30Z on 29 Sept is already 30 Sept in Israel.
    expect(centersExportFileName(new Date("2026-09-29T21:30:00Z"))).toBe("mentalytics-centers-2026-09-30.xlsx");
    expect(centersExportFileName(new Date("2026-01-15T12:00:00Z"))).toBe("mentalytics-centers-2026-01-15.xlsx");
    expect(centersExportFileName()).toMatch(/^mentalytics-centers-\d{4}-\d{2}-\d{2}\.xlsx$/);
  });
});
