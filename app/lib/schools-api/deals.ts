// מקור משותף: נתיב האדמין (/api/admin-schools/*, הבעלים) ונתיב הפורטל
// (/api/partner-schools/*, השותפה) קוראים לכאן עם אובייקט צופה.
import { NextRequest, NextResponse } from "next/server";
import { SchoolsCrmError, deleteDeal, isUuid, listDeals, saveDeal } from "@/app/lib/schools-crm.server";
import type { Viewer } from "@/app/lib/schools-crm.server";
import { DEAL_LOST_REASONS, DEAL_PRODUCTS, DEAL_SOURCES, DEAL_STAGES, PROCUREMENT_ROUTES } from "@/app/lib/schools-crm";

// עסקאות ענף בתי הספר, ללוח הצינור (/admin/schools/pipeline) ולעמוד בית הספר.
// Basic Auth ושומר ה-CSRF של ה-middleware מכסים את כל /api/admin-*.
//
// GET   כל העסקאות עם שם בית הספר והעיר (או שם הבעלות).
// POST  {action: "delete", id}: מחיקת עסקה.
// POST  {action: "save"}: עסקה חדשה (school_id או owner_id) או עדכון (id).
//       בעדכון מתעדכנים רק השדות שנשלחו, כך שהעברת עסקה בין עמודות שולחת
//       רק {id, stage}. מעבר שלב נרשם ביומן הפעילות (saveDeal).

type Body = Record<string, unknown>;

const has = (b: Body, key: string) => Object.prototype.hasOwnProperty.call(b, key);
const inList = (list: { value: string }[], v: unknown) => typeof v === "string" && list.some((o) => o.value === v);
const bad = (message: string) => new SchoolsCrmError(message, 400);
const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

function nstr(v: unknown, max: number): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().slice(0, max);
  return s || null;
}
function nday(v: unknown, what: string): string | null {
  const s = nstr(v, 10);
  if (!s) return null;
  if (!isDay(s)) throw bad(`${what}: תאריך לא תקין`);
  return s;
}
function nchoice(list: { value: string }[], v: unknown, what: string): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (!inList(list, v)) throw bad(`${what}: ערך לא מוכר`);
  return v as string;
}
function nid(v: unknown, what: string): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (!isUuid(v)) throw bad(`${what}: מזהה לא תקין`);
  return v;
}

export async function dealsGet(v: Viewer) {
  void v;
  try {
    return NextResponse.json({ ok: true, deals: await listDeals() });
  } catch (e) {
    return fail(e);
  }
}

export async function dealsPost(req: NextRequest, v: Viewer) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  }
  try {
    if (body.action === "delete") {
      const delId = nid(body.id, "עסקה");
      if (!delId) throw bad("חסר מזהה עסקה");
      await deleteDeal(v, delId);
      return NextResponse.json({ ok: true });
    }
    if (body.action !== "save") return NextResponse.json({ ok: false, error: "פעולה לא מוכרת" }, { status: 400 });

    const id = nid(body.id, "עסקה") ?? undefined;
    const patch: Body = {};
    if (!id) {
      const schoolId = nid(body.school_id, "בית ספר");
      const ownerId = nid(body.owner_id, "בעלות");
      if (!schoolId && !ownerId) throw bad("בוחרים בית ספר");
      patch.school_id = schoolId;
      patch.owner_id = ownerId;
    }
    if (has(body, "title")) patch.title = nstr(body.title, 200);
    if (has(body, "school_year")) {
      const sy = nstr(body.school_year, 7);
      if (sy && !/^\d{4}\/\d{2}$/.test(sy)) throw bad("שנת לימודים: בצורה 2026/27");
      patch.school_year = sy;
    }
    if (has(body, "stage")) {
      const stage = nchoice(DEAL_STAGES, body.stage, "שלב");
      if (!stage) throw bad("שלב: חובה לבחור");
      patch.stage = stage;
    }
    if (has(body, "product")) {
      const product = nchoice(DEAL_PRODUCTS, body.product, "מוצר");
      if (!product) throw bad("מוצר: חובה לבחור");
      patch.product = product;
    }
    if (has(body, "value_gross")) {
      const raw = body.value_gross;
      if (raw === null || raw === undefined || raw === "") patch.value_gross = null;
      else {
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0 || n > 1e8) throw bad("סכום לא תקין");
        patch.value_gross = Math.round(n * 100) / 100;
      }
    }
    if (has(body, "source")) patch.source = nchoice(DEAL_SOURCES, body.source, "מקור");
    if (has(body, "handler")) patch.handler = nstr(body.handler, 80);
    if (has(body, "next_step")) patch.next_step = nstr(body.next_step, 300);
    if (has(body, "next_step_due")) patch.next_step_due = nday(body.next_step_due, "מועד הצעד הבא");
    if (has(body, "procurement_route")) patch.procurement_route = nchoice(PROCUREMENT_ROUTES, body.procurement_route, "מסלול רכש");
    if (has(body, "pilot_start")) patch.pilot_start = nday(body.pilot_start, "תחילת פיילוט");
    if (has(body, "pilot_end")) patch.pilot_end = nday(body.pilot_end, "סוף פיילוט");
    if (has(body, "quote_ref")) patch.quote_ref = nstr(body.quote_ref, 60);
    if (has(body, "po_number")) patch.po_number = nstr(body.po_number, 60);
    if (has(body, "expected_payment_date")) patch.expected_payment_date = nday(body.expected_payment_date, "מועד תשלום צפוי");
    if (has(body, "frozen_until")) patch.frozen_until = nday(body.frozen_until, "מועד חזרה מהקפאה");
    if (has(body, "notes")) patch.notes = nstr(body.notes, 2000);

    // סיבת הפסד נדרשת בהעברה ל"אבוד" ומתנקה כשהעסקה חוזרת לשלב אחר.
    if (has(body, "lost_reason")) patch.lost_reason = nchoice(DEAL_LOST_REASONS, body.lost_reason, "סיבת הפסד");
    if (patch.stage === "lost" && !patch.lost_reason) throw bad("בוחרים סיבה להפסד העסקה");
    if (typeof patch.stage === "string" && patch.stage !== "lost") patch.lost_reason = null;

    const deal = await saveDeal(v, patch, id);
    return NextResponse.json({ ok: true, deal });
  } catch (e) {
    return fail(e);
  }
}

function fail(e: unknown) {
  if (e instanceof SchoolsCrmError) {
    let status = e.status;
    let message = e.message;
    if (status === 404) message = "לא נמצא";
    else if (/foreign key/i.test(message)) {
      status = 400;
      message = "בית הספר שנבחר לא נמצא";
    }
    return NextResponse.json({ ok: false, error: message }, { status });
  }
  console.error("schools-api/deals:", e instanceof Error ? e.message : e);
  return NextResponse.json({ ok: false, error: "שגיאה בשרת" }, { status: 500 });
}
