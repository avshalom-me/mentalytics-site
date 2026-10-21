import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { underDailyCap } from "@/app/lib/daily-cap";
import { getIp } from "@/app/lib/usage";
import { BRANCH_OWNER_ASSIGNEE, CONTACT_ROLES, labelOf, planLicense } from "@/app/lib/schools-crm";
import { isUuid, logActivity, saveDeal, saveSchool, type Viewer } from "@/app/lib/schools-crm.server";

// בקשת גישה של בית ספר לשאלון היועצות, מהטופס ב-/counselors#access.
//
// הבקשה הופכת, בלי שום מייל, לשלושה דברים בענף בתי הספר: בית ספר (קיים, או חדש
// בסטטוס "פוטנציאלי"), איש קשר, ועסקה בשלב "פנייה ראשונה" עם משימה לבעלים
// (crm_tasks, entity_type 'school_deal') לחזור לפונה בתוך יומיים. הבקשה נרשמת
// גם ביומן הפעילות של בית הספר.
//
// הנתיב ציבורי, ולכן: כל שדה מאומת ומוגבל באורך, יש מלכודת דבש (שדה "website"
// שאדם אינו רואה), ותקרה של 5 בקשות ליום לכתובת IP (מונה במסד, כמו קוד
// הגישה). שליחה חוזרת של אותו מייל או טלפון בתוך 24 שעות מקבלת "הצלחה" בלי
// ליצור עסקה שנייה.
//
// סדר הכתיבות נבחר כך שכישלון באמצע לא יאבד פנייה: בית ספר, עסקה, משימה
// (עם הטלפון והמייל בפירוט שלה), יומן, ואיש הקשר אחרון. איש הקשר הוא גם מה
// ששומר מכפילויות, ולכן ניסיון חוזר אחרי כישלון לא ייחסם כ"כבר נשלח".
//
// איש הקשר נכתב כאן ישירות ולא דרך saveContact: הוא מוסיף created_by לכל הוספה,
// ולטבלת school_contacts אין עמודה כזו.

export const dynamic = "force-dynamic";

/** מי מופיע ביומן כמבצע: הטופס עצמו, לא אדם. */
const FORM_VIEWER: Viewer = { role: "owner", name: "טופס הפנייה" };

/** השם כפי שהוא בבחירת האחראים של המשימות (staff_members), והמטפל בעסקה. */
const OWNER_ASSIGNEE = BRANCH_OWNER_ASSIGNEE;

/** הפנייה הראשונה נכנסה (DEAL_STAGES: "פנייה ראשונה"). */
const FIRST_CONTACT_STAGE = "contacted";
/** DEAL_SOURCES: "פנייה נכנסת". */
const INBOUND_SOURCE = "inbound";
/** DEAL_PRODUCTS: "רישיון לשאלון". */
const LICENSE_PRODUCT = "license";
/** שלבי הצינור שבהם עסקת רישיון עדיין פתוחה: פנייה נוספת מצטרפת אליה ולא פותחת עסקה שנייה. */
const OPEN_DEAL_STAGES = ["listed", "contacted", "meeting", "pilot", "quote_sent", "approval"];

const LIMITS = { school: 120, city: 60, name: 80, email: 120, message: 1000 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

/** תווי בקרה מוחלפים ברווח; בטקסט חופשי נשארות שורות חדשות. */
function stripControl(s: string, keepNewlines: boolean): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (keepNewlines && c === 10) out += "\n";
    else out += c < 32 || c === 127 ? " " : s[i];
  }
  return out;
}

const oneLine = (v: unknown): string => (typeof v === "string" ? stripControl(v, false).replace(/\s+/g, " ").trim() : "");

function multiLine(v: unknown): string {
  if (typeof v !== "string") return "";
  return stripControl(v.replace(/\r\n?/g, "\n"), true)
    .replace(/[^\S\n]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** טלפון בלי רווחים, מקפים וסוגריים; ספרות בלבד, עם + בהתחלה אם יש. */
function normalizePhone(raw: string): string | null {
  const s = raw.replace(/[\s\-().]/g, "");
  return /^\+?\d{9,15}$/.test(s) ? s : null;
}

function todayIL(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
}

function addDays(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** תבנית ilike להתאמה מדויקת: רק % _ ו-\ מוברחים, כדי ששם עם תו כזה לא יהפוך לכוכבית. */
const exactPattern = (s: string) => s.replace(/[\\%_]/g, "\\$&");

type SchoolRef = { id: string; symbol: string | null; is_demo: boolean };

async function findSchool(name: string, city: string, symbol: string | null): Promise<SchoolRef | null> {
  if (symbol) {
    const { data } = await supabaseAdmin.from("schools").select("id, symbol, is_demo").eq("symbol", symbol).maybeSingle();
    if (data) return data as SchoolRef;
  }
  const { data } = await supabaseAdmin
    .from("schools")
    .select("id, symbol, is_demo")
    .eq("is_demo", false)
    .ilike("name", exactPattern(name))
    .ilike("city", exactPattern(city))
    .order("updated_at", { ascending: false })
    .limit(1);
  const match = (data?.[0] ?? null) as SchoolRef | null;
  // אותו שם ואותה עיר אבל סמל אחר: בית ספר אחר, לא אותו.
  if (match && symbol && match.symbol && match.symbol !== symbol) return null;
  return match;
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fail("בקשה לא תקינה", 400);
    body = parsed as Record<string, unknown>;
  } catch {
    return fail("בקשה לא תקינה", 400);
  }

  // מלכודת דבש: שדה שאדם לא רואה. מי שמילא אותו הוא בוט, ומקבל "הצלחה" ושום דבר לא נכתב.
  if (oneLine(body.website)) return NextResponse.json({ ok: true });

  const schoolName = oneLine(body.school_name);
  const city = oneLine(body.city);
  const symbolRaw = oneLine(body.symbol).replace(/\s/g, "");
  const contactName = oneLine(body.contact_name);
  const email = oneLine(body.email).toLowerCase();
  const phone = normalizePhone(oneLine(body.phone));
  const message = multiLine(body.message);
  const role = CONTACT_ROLES.some((o) => o.value === body.role) ? (body.role as string) : "counselor";

  if (schoolName.length < 2) return fail("צריך לכתוב את שם בית הספר", 400);
  if (schoolName.length > LIMITS.school) return fail("שם בית הספר ארוך מדי", 400);
  if (city.length < 2) return fail("צריך לכתוב את העיר", 400);
  if (city.length > LIMITS.city) return fail("שם העיר ארוך מדי", 400);
  if (symbolRaw && !/^\d{4,9}$/.test(symbolRaw)) return fail("סמל מוסד הוא מספר, בספרות בלבד", 400);
  if (contactName.length < 2) return fail("צריך לכתוב שם איש קשר", 400);
  if (contactName.length > LIMITS.name) return fail("השם ארוך מדי", 400);
  if (!phone) return fail("מספר הטלפון לא תקין", 400);
  if (!EMAIL_RE.test(email) || email.length > LIMITS.email) return fail("כתובת המייל לא תקינה", 400);
  if (message.length > LIMITS.message) return fail(`ההודעה ארוכה מדי: עד ${LIMITS.message} תווים`, 400);
  const symbol = symbolRaw || null;

  if (!(await underDailyCap(`school_request:${getIp(req)}`, 5))) {
    return fail("נשלחו יותר מדי בקשות מהכתובת הזו היום. אפשר לנסות שוב מחר, או לכתוב אלינו.", 429);
  }

  try {
    // אותו מייל או אותו טלפון בתוך 24 שעות: כבר קיבלנו. שתי שאילתות נפרדות
    // ולא or(): ערך שהוקלד אינו נכנס לתחביר של הסינון.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [byEmail, byPhone] = await Promise.all([
      supabaseAdmin.from("school_contacts").select("id").eq("email", email).gte("created_at", since).limit(1),
      supabaseAdmin.from("school_contacts").select("id").eq("phone", phone).gte("created_at", since).limit(1),
    ]);
    if ((byEmail.data?.length ?? 0) > 0 || (byPhone.data?.length ?? 0) > 0) {
      return NextResponse.json({ ok: true });
    }

    // ── בית הספר ────────────────────────────────────────────────────────────────
    let school = await findSchool(schoolName, city, symbol);
    // סמל שכבר שייך לבית ספר ההדגמה אינו מתאים לבקשה אמיתית: לא מצמידים אליו ולא משכפלים אותו.
    const symbolForInsert = school?.is_demo ? null : symbol;
    if (school?.is_demo) school = null;
    if (!school) {
      try {
        const created = await saveSchool(FORM_VIEWER, {
          name: schoolName,
          city,
          symbol: symbolForInsert,
          // השלב (יסודי, תיכון...) לא נשאל בטופס: "אחר" הוא "עוד לא ידוע", לא ניחוש.
          stage: "other",
          status: "prospect",
          source: INBOUND_SOURCE,
        });
        school = { id: created.id as string, symbol: symbolForInsert, is_demo: false };
      } catch (e) {
        // שתי בקשות באותה שנייה על אותו סמל: השנייה נתקלת באינדקס הייחודי ומצטרפת לראשונה.
        const again = symbolForInsert ? await findSchool(schoolName, city, symbolForInsert) : null;
        if (!again || again.is_demo) throw e;
        school = again;
      }
    }
    const schoolId = school.id;
    if (!isUuid(schoolId)) throw new Error("school id missing");

    // ── העסקה ───────────────────────────────────────────────────────────────────
    const due = addDays(todayIL(), 2);
    const { data: openDeals } = await supabaseAdmin
      .from("school_deals")
      .select("id, stage")
      .eq("school_id", schoolId)
      .eq("product", LICENSE_PRODUCT)
      .in("stage", OPEN_DEAL_STAGES)
      .order("created_at", { ascending: false })
      .limit(1);
    const existing = openDeals?.[0] as { id: string; stage: string } | undefined;

    let dealId: string;
    if (existing) {
      // בית ספר שכבר יש לו עסקת רישיון פתוחה: הפנייה מצטרפת אליה. עסקה שרק נרשמה
      // ("רשום") עוברת ל"פנייה ראשונה"; מתקדמת יותר נשארת איפה שהיא.
      dealId = existing.id;
      if (existing.stage === "listed") await saveDeal(FORM_VIEWER, { stage: FIRST_CONTACT_STAGE }, dealId);
      await logActivity(FORM_VIEWER, "school_deal", dealId, "note", `פנייה נוספת מהאתר מאת ${contactName}`);
    } else {
      const deal = await saveDeal(FORM_VIEWER, {
        school_id: schoolId,
        title: "בקשת גישה לשאלון",
        school_year: planLicense("annual", todayIL()).school_year,
        stage: FIRST_CONTACT_STAGE,
        product: LICENSE_PRODUCT,
        source: INBOUND_SOURCE,
        handler: OWNER_ASSIGNEE,
        next_step: "לחזור לפונה",
        next_step_due: due,
      });
      dealId = deal.id as string;
    }

    // ── המשימה לבעלים ───────────────────────────────────────────────────────────
    // הטלפון והמייל בפירוט המשימה: גם אם ההמשך נכשל, יש לבעלים מה לעשות.
    const details = [
      `${contactName}, ${labelOf(CONTACT_ROLES, role)}`,
      `טלפון: ${phone}`,
      `מייל: ${email}`,
      symbol ? `סמל מוסד: ${symbol}` : "",
      message ? `הודעה: ${message}` : "",
    ].filter(Boolean).join("\n");
    const { error: taskErr } = await supabaseAdmin.from("crm_tasks").insert({
      title: `לחזור ל${contactName} מ${schoolName}`.slice(0, 300),
      details: details.slice(0, 2000),
      entity_type: "school_deal",
      entity_id: dealId,
      entity_label: schoolName.slice(0, 120),
      due_date: due,
      priority: "normal",
      assignee: OWNER_ASSIGNEE,
      created_by: "school-form",
    });
    if (taskErr) throw new Error(`crm_tasks: ${taskErr.message}`);

    await logActivity(FORM_VIEWER, "school", schoolId, "note", message || "פנייה מהאתר");

    // ── איש הקשר, אחרון ─────────────────────────────────────────────────────────
    const { count } = await supabaseAdmin.from("school_contacts").select("id", { count: "exact", head: true }).eq("school_id", schoolId);
    const { error: contactErr } = await supabaseAdmin.from("school_contacts").insert({
      school_id: schoolId,
      role,
      name: contactName,
      phone,
      email,
      is_primary: (count ?? 0) === 0,
    });
    if (contactErr) throw new Error(`school_contacts: ${contactErr.message}`);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("school-access-request:", e instanceof Error ? e.message : e);
    return fail("לא הצלחנו לשמור את הפנייה. אפשר לנסות שוב, או לכתוב אלינו ל-admin@getmentalytics.com.", 500);
  }
}
