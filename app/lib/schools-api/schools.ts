// מקור משותף: נתיב האדמין (/api/admin-schools/*, הבעלים) ונתיב הפורטל
// (/api/partner-schools/*, השותפה) קוראים לכאן עם אובייקט צופה.
import { NextRequest, NextResponse } from "next/server";
import {
    SchoolsCrmError,
  clearOtherPrimaryContacts,
  countSchoolsByStatus,
  getSchoolDetail,
  isUuid,
  listOwners,
  listSchools,
  logActivity,
  saveContact,
  saveOwner,
  saveSchool,
  saveTraining,
  deleteContact,
  deleteOwner,
  deleteSchool,
  deleteTraining,
  schoolTimeline,
  schoolsOverview,
} from "@/app/lib/schools-crm.server";
import type { Viewer } from "@/app/lib/schools-crm.server";
import {
  ACTIVITY_KINDS,
  CONTACT_ROLES,
  OWNER_KINDS,
  SCHOOL_ENTITY_TYPES,
  SCHOOL_STAGES,
  SCHOOL_STATUSES,
  SECTORS,
  SUPPLIER_STATUSES,
} from "@/app/lib/schools-crm";

// בתי ספר, אנשי קשר, בעלויות, הדרכות ויומן פעילות של ענף בתי הספר, לאדמין
// (/admin/schools). Basic Auth ושומר ה-CSRF של ה-middleware מכסים את כל /api/admin-*.
//
// GET   בלי פרמטרים: הרשימה, עם הסינון ב-query (status, region, owner_id, q, demo=1),
//       ספירה לפי סטטוס ורשימת הבעלויות. picker=1: רשימה קצרה לבחירת בית ספר.
//       owners=1: הבעלויות עם מספר בתי הספר של כל אחת.
//       id=<uuid>: בית ספר אחד עם אנשי הקשר, העסקאות, הרישיונות, ההדרכות וציר הזמן.
// POST  {action}: save_school, save_contact, save_owner, save_training, log_activity,
//       delete_school, delete_contact, delete_training, delete_owner.
//       בלי id נוצרת שורה חדשה; עם id מתעדכנים רק השדות שנשלחו.

type Body = Record<string, unknown>;

const has = (b: Body, key: string) => Object.prototype.hasOwnProperty.call(b, key);
const inList = (list: { value: string }[], v: unknown) => typeof v === "string" && list.some((o) => o.value === v);
const bad = (message: string) => new SchoolsCrmError(message, 400);
const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const todayIL = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());

/** טקסט חופשי: ריק הופך ל-null, ארוך מדי נחתך. */
function nstr(v: unknown, max: number): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().slice(0, max);
  return s || null;
}
function reqStr(v: unknown, max: number, what: string): string {
  const s = nstr(v, max);
  if (!s) throw bad(`${what}: חובה למלא`);
  return s;
}
/** מספר שלם או עשרוני אי-שלילי; ריק הופך ל-null. */
function nnum(v: unknown, what: string, opts: { int?: boolean; max?: number } = {}): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > (opts.max ?? 1e9) || (opts.int && !Number.isInteger(n))) throw bad(`${what}: מספר לא תקין`);
  return opts.int ? n : Math.round(n * 100) / 100;
}
function nday(v: unknown, what: string): string | null {
  const s = nstr(v, 10);
  if (!s) return null;
  if (!isDay(s)) throw bad(`${what}: תאריך לא תקין`);
  return s;
}
function nid(v: unknown, what: string): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (!isUuid(v)) throw bad(`${what}: מזהה לא תקין`);
  return v;
}
function reqId(v: unknown, what: string): string {
  const id = nid(v, what);
  if (!id) throw bad(`${what}: חסר מזהה`);
  return id;
}
function choice(list: { value: string }[], v: unknown, what: string): string {
  if (!inList(list, v)) throw bad(`${what}: ערך לא מוכר`);
  return v as string;
}

export async function schoolsGet(req: NextRequest, v: Viewer) {
  void v;
  const sp = req.nextUrl.searchParams;
  try {
    if (sp.has("id")) {
      const id = sp.get("id");
      if (!isUuid(id)) throw bad("מזהה בית ספר לא תקין");
      const detail = await getSchoolDetail(id);
      const [timeline, owners] = await Promise.all([
        schoolTimeline(id, detail.deals.map((d) => d.id as string), detail.licenses.map((l) => l.id as string)),
        listOwners(),
      ]);
      return NextResponse.json({
        ok: true,
        school: detail.school,
        contacts: detail.contacts,
        deals: detail.deals,
        // קוד הגישה נשאר במסך הרישיונות; כאן רק מצב הרישיון והתשלומים.
        licenses: detail.licenses.map((l) => {
          const copy = { ...l };
          delete copy.access_code;
          return copy;
        }),
        trainings: detail.trainings,
        timeline,
        owners: owners.map((o) => ({ id: o.id, name: o.name })),
      });
    }

    // owners=1: כל הבעלויות עם מספר בתי הספר של כל אחת (/admin/schools/owners).
    if (sp.get("owners")) return NextResponse.json({ ok: true, owners: await listOwners() });

    const q = sp.get("q") ?? "";
    if (sp.get("picker")) {
      const rows = await listSchools({ q, includeDemo: true, limit: 30 });
      return NextResponse.json({
        ok: true,
        schools: rows.map((s) => ({ id: s.id, name: s.name, symbol: s.symbol, city: s.city, is_demo: s.is_demo })),
      });
    }

    const status = sp.get("status") ?? "";
    const ownerId = sp.get("owner_id") ?? "";
    if (status && !inList(SCHOOL_STATUSES, status)) throw bad("סטטוס לא מוכר");
    if (ownerId && !isUuid(ownerId)) throw bad("בעלות לא תקינה");
    const base = { region: (sp.get("region") ?? "").slice(0, 40) || undefined, ownerId: ownerId || undefined, q, includeDemo: sp.get("demo") === "1" };
    const [schools, counts, owners] = await Promise.all([
      listSchools({ ...base, status: status || undefined }),
      countSchoolsByStatus(base),
      listOwners(),
    ]);
    const overview = await schoolsOverview(schools.map((s) => s.id as string));
    return NextResponse.json({
      ok: true,
      schools: schools.map((s) => ({ ...s, ...overview.get(s.id as string) })),
      counts,
      owners: owners.map((o) => ({ id: o.id, name: o.name })),
      // הרשימה נחתכת ב-500: מצמצמים בסינון.
      truncated: schools.length >= 500,
    });
  } catch (e) {
    return fail(e);
  }
}

export async function schoolsPost(req: NextRequest, v: Viewer) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  }
  try {
    switch (body.action) {
      case "save_school": {
        const id = nid(body.id, "בית ספר") ?? undefined;
        const patch: Body = {};
        if (!id || has(body, "name")) patch.name = reqStr(body.name, 200, "שם בית הספר");
        if (has(body, "symbol")) patch.symbol = nstr(body.symbol, 20);
        if (has(body, "stage")) patch.stage = choice(SCHOOL_STAGES, body.stage, "שלב חינוך");
        if (has(body, "sector")) patch.sector = body.sector ? choice(SECTORS, body.sector, "מגזר") : null;
        if (has(body, "owner_id")) patch.owner_id = nid(body.owner_id, "בעלות");
        if (has(body, "city")) patch.city = nstr(body.city, 80);
        if (has(body, "region_key")) patch.region_key = nstr(body.region_key, 40);
        if (has(body, "students")) patch.students = nnum(body.students, "מספר תלמידים", { int: true, max: 100000 });
        if (has(body, "counselors")) patch.counselors = nnum(body.counselors, "מספר יועצות", { int: true, max: 1000 });
        if (has(body, "status")) patch.status = choice(SCHOOL_STATUSES, body.status, "סטטוס");
        if (has(body, "notes")) patch.notes = nstr(body.notes, 4000);
        if (!id) patch.source = "manual";
        const school = await saveSchool(v, patch, id);
        return NextResponse.json({ ok: true, school });
      }
      case "save_contact": {
        const id = nid(body.id, "איש קשר") ?? undefined;
        const patch: Body = {};
        if (!id) patch.school_id = reqId(body.school_id, "בית ספר");
        if (!id || has(body, "name")) patch.name = reqStr(body.name, 120, "שם איש הקשר");
        if (has(body, "role")) patch.role = choice(CONTACT_ROLES, body.role, "תפקיד");
        if (has(body, "phone")) patch.phone = nstr(body.phone, 40);
        if (has(body, "whatsapp")) patch.whatsapp = nstr(body.whatsapp, 40);
        if (has(body, "email")) {
          const email = nstr(body.email, 200);
          if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad("כתובת המייל לא תקינה");
          patch.email = email;
        }
        if (has(body, "is_primary")) patch.is_primary = body.is_primary === true;
        if (has(body, "active")) {
          patch.active = body.active === true;
          // מי שעזבה נשמרת לתיעוד, עם תאריך העזיבה.
          patch.left_at = body.active === true ? null : todayIL();
        }
        if (has(body, "notes")) patch.notes = nstr(body.notes, 1000);
        const contact = await saveContact(v, patch, id);
        if (contact.is_primary === true && typeof contact.school_id === "string") {
          await clearOtherPrimaryContacts(contact.school_id, contact.id as string);
        }
        return NextResponse.json({ ok: true, contact });
      }
      case "save_owner": {
        const id = nid(body.id, "בעלות") ?? undefined;
        const patch: Body = {};
        if (!id || has(body, "name")) patch.name = reqStr(body.name, 200, "שם הבעלות");
        if (has(body, "kind")) patch.kind = choice(OWNER_KINDS, body.kind, "סוג בעלות");
        if (has(body, "city")) patch.city = nstr(body.city, 80);
        if (has(body, "region_key")) patch.region_key = nstr(body.region_key, 40);
        if (has(body, "payment_terms_days")) patch.payment_terms_days = nnum(body.payment_terms_days, "ימי תשלום", { int: true, max: 365 });
        if (has(body, "supplier_status")) patch.supplier_status = choice(SUPPLIER_STATUSES, body.supplier_status, "סטטוס ספק");
        if (has(body, "supplier_notes")) patch.supplier_notes = nstr(body.supplier_notes, 2000);
        if (has(body, "notes")) patch.notes = nstr(body.notes, 4000);
        const owner = await saveOwner(v, patch, id);
        return NextResponse.json({ ok: true, owner });
      }
      case "save_training": {
        const id = nid(body.id, "הדרכה") ?? undefined;
        const patch: Body = {};
        if (!id) patch.school_id = reqId(body.school_id, "בית ספר");
        if (!id || has(body, "held_on")) {
          const day = nday(body.held_on, "תאריך ההדרכה");
          if (!day) throw bad("תאריך ההדרכה: חובה למלא");
          patch.held_on = day;
        }
        if (has(body, "hours")) {
          const hours = nnum(body.hours, "שעות", { max: 100 });
          if (!hours) throw bad("שעות: חובה למלא");
          patch.hours = hours;
        }
        if (has(body, "trainer")) patch.trainer = nstr(body.trainer, 120);
        if (has(body, "participants")) patch.participants = nnum(body.participants, "משתתפים", { int: true, max: 10000 });
        if (has(body, "topic")) patch.topic = nstr(body.topic, 300);
        if (has(body, "billable")) patch.billable = body.billable === true;
        if (has(body, "amount_gross") || has(body, "billable")) {
          patch.amount_gross = body.billable === true ? nnum(body.amount_gross, "סכום", { max: 1e7 }) : null;
        }
        if (has(body, "notes")) patch.notes = nstr(body.notes, 1000);
        const training = await saveTraining(v, patch, id);
        return NextResponse.json({ ok: true, training });
      }
      case "log_activity": {
        const entityType = body.entity_type;
        if (typeof entityType !== "string" || !(SCHOOL_ENTITY_TYPES as readonly string[]).includes(entityType)) throw bad("סוג ישות לא מוכר");
        const entityId = reqId(body.entity_id, "ישות");
        // "מערכת" שמור לפעולות של המערכת עצמה.
        const kind = choice(ACTIVITY_KINDS.filter((o) => o.value !== "system"), body.kind, "סוג פעילות");
        const summary = reqStr(body.summary, 2000, "תיאור הפעילות");
        let happenedAt: string | undefined;
        const raw = nstr(body.happened_at, 40);
        if (raw) {
          const t = Date.parse(raw);
          if (Number.isNaN(t)) throw bad("מועד הפעילות לא תקין");
          happenedAt = new Date(t).toISOString();
        }
        await logActivity(v, entityType as (typeof SCHOOL_ENTITY_TYPES)[number], entityId, kind, summary, happenedAt);
        return NextResponse.json({ ok: true });
      }
      case "delete_school":
        await deleteSchool(v, reqId(body.id, "בית ספר"));
        return NextResponse.json({ ok: true });
      case "delete_contact":
        await deleteContact(v, reqId(body.id, "איש קשר"));
        return NextResponse.json({ ok: true });
      case "delete_training":
        await deleteTraining(v, reqId(body.id, "הדרכה"));
        return NextResponse.json({ ok: true });
      case "delete_owner":
        await deleteOwner(v, reqId(body.id, "בעלות"));
        return NextResponse.json({ ok: true });
      default:
        return NextResponse.json({ ok: false, error: "פעולה לא מוכרת" }, { status: 400 });
    }
  } catch (e) {
    return fail(e);
  }
}

function fail(e: unknown) {
  if (e instanceof SchoolsCrmError) {
    let status = e.status;
    let message = e.message;
    if (status === 404 && !message) message = "לא נמצא";
    else if (/duplicate key/i.test(message)) {
      status = 409;
      message = "ערך כזה כבר קיים (סמל מוסד כפול?)";
    } else if (/foreign key/i.test(message)) {
      status = 400;
      message = "הפריט שנבחר לא נמצא";
    }
    return NextResponse.json({ ok: false, error: message }, { status });
  }
  console.error("schools-api/schools:", e instanceof Error ? e.message : e);
  return NextResponse.json({ ok: false, error: "שגיאה בשרת" }, { status: 500 });
}
