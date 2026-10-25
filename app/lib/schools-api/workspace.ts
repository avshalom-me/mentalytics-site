import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { BRANCH_OWNER_ASSIGNEE } from "@/app/lib/schools-crm";
import { isUuid, type Viewer } from "@/app/lib/schools-crm.server";
import {
  BRANCH_TASK,
  PLAN_TASK,
  DEFAULT_FOLDER,
  FILES_BUCKET,
  FILE_MAX_BYTES,
  FILE_PATH_RE,
  cleanBoardInput,
  cleanPlanInput,
  reminderDue,
  storageSafeName,
  type BoardInput,
  type BoardNote,
  type PlanInput,
  type ReminderState,
} from "@/app/lib/schools-workspace";

// סביבת העבודה המשותפת של הענף, לבעלים (/api/admin-schools/{plan,board,
// reminders,files}) ולשותפה (/api/partner-schools/*): התוכנית השנתית, לוח
// הפתקים והתזכורות, והקבצים. שני הצדדים רואים ועורכים את אותו הדבר; מי כתב
// נלקח תמיד מהצופה ולא ממה שהדפדפן שלח. אין כאן שום שליחה החוצה: תזכורת
// קופצת בתוך ה-CRM, לא במייל ולא בוואטסאפ.

const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });
const now = () => new Date().toISOString();
const body = async (req: NextRequest): Promise<Record<string, unknown> | null> => {
  const b = await req.json().catch(() => null);
  return b && typeof b === "object" && !Array.isArray(b) ? (b as Record<string, unknown>) : null;
};
const actionOf = (b: Record<string, unknown>) => (typeof b.action === "string" ? b.action : "");

// ── התוכנית ────────────────────────────────────────────────────────────────────

const PLAN_COLUMNS = "id, kind, title, track, start_date, end_date, status, owner, description, gate_metric, gate_threshold, sort, created_by, updated_at";

/** כמה כסף נכנס לענף עד היום, בלי בתי ספר להדגמה. השער של אבן דרך נמדד מול זה. */
async function receivedTotals(): Promise<{ received_gross: number; received_net: number }> {
  const { data, error } = await supabaseAdmin
    .from("school_payments")
    .select("amount_gross, amount_net, school_licenses!inner(schools!inner(is_demo))")
    .eq("status", "received")
    .eq("school_licenses.schools.is_demo", false)
    .limit(10000);
  if (error) throw new Error(error.message);
  let gross = 0;
  let net = 0;
  for (const p of data ?? []) {
    gross += Number(p.amount_gross ?? 0);
    net += Number(p.amount_net ?? 0);
  }
  return { received_gross: Math.round(gross * 100) / 100, received_net: Math.round(net * 100) / 100 };
}

/**
 * הפריטים של התוכנית, המשימות של הענף ושל פריטי התוכנית שיש להן תאריך (כדי
 * לצייר אותן על הגנט), והכסף שנכנס. משימות של בית ספר מסוים לא נכנסות לגנט.
 */
export async function planGet() {
  try {
    const [items, tasks, totals] = await Promise.all([
      supabaseAdmin.from("school_plan_items").select(PLAN_COLUMNS).is("archived_at", null).order("start_date").order("sort"),
      supabaseAdmin
        .from("crm_tasks")
        .select("id, title, details, entity_type, entity_id, entity_label, start_date, due_date, assignee, status, priority")
        .in("entity_type", [BRANCH_TASK, PLAN_TASK])
        .or("start_date.not.is.null,due_date.not.is.null")
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(1000),
      receivedTotals(),
    ]);
    if (items.error) return fail(items.error.message, 500);
    if (tasks.error) return fail(tasks.error.message, 500);
    return NextResponse.json({ ok: true, items: items.data ?? [], tasks: tasks.data ?? [], totals });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "שגיאה", 500);
  }
}

/**
 * create { ...שדות }, update { id, ...שדות }, archive { id }.
 * פריט שנמחק נשאר בטבלה עם archived_at, והמשימות שתלויות בו לא נעלמות.
 */
export async function planPost(req: NextRequest, v: Viewer) {
  const b = await body(req);
  if (!b) return fail("בקשה לא תקינה");
  const action = actionOf(b);

  if (action === "create") {
    const c = cleanPlanInput(b);
    if (!c.ok) return fail(c.error);
    const { data, error } = await supabaseAdmin
      .from("school_plan_items")
      .insert({ ...c.value, created_by: v.name.slice(0, 60) })
      .select(PLAN_COLUMNS)
      .single();
    if (error) return fail(error.message, 500);
    return NextResponse.json({ ok: true, item: data });
  }

  if (!isUuid(b.id)) return fail("חסר מזהה");
  const { data: current, error: curErr } = await supabaseAdmin.from("school_plan_items").select(PLAN_COLUMNS).eq("id", b.id).is("archived_at", null).maybeSingle();
  if (curErr) return fail(curErr.message, 500);
  if (!current) return fail("הפריט לא נמצא", 404);

  if (action === "update") {
    const fields = { ...b };
    delete fields.action;
    delete fields.id;
    const c = cleanPlanInput(fields, current as PlanInput);
    if (!c.ok) return fail(c.error);
    if (Object.keys(c.value).length === 0) return fail("אין מה לעדכן");
    const { data, error } = await supabaseAdmin
      .from("school_plan_items")
      .update({ ...c.value, updated_at: now() })
      .eq("id", b.id)
      .select(PLAN_COLUMNS)
      .single();
    if (error) return fail(error.message, 500);
    // שם הפריט מוצג ליד המשימות שתלויות בו.
    if (c.value.title && c.value.title !== current.title) {
      await supabaseAdmin.from("crm_tasks").update({ entity_label: c.value.title.slice(0, 120) }).eq("entity_type", "school_plan").eq("entity_id", b.id);
    }
    return NextResponse.json({ ok: true, item: data });
  }

  if (action === "archive") {
    const { error } = await supabaseAdmin.from("school_plan_items").update({ archived_at: now(), updated_at: now() }).eq("id", b.id);
    if (error) return fail(error.message, 500);
    return NextResponse.json({ ok: true });
  }

  return fail("פעולה לא מוכרת");
}

// ── הלוח ───────────────────────────────────────────────────────────────────────

const NOTE_COLUMNS = "id, kind, title, body, url, pinned, remind_at, remind_to, reminder_state, created_by, created_at, updated_at, archived_at";

/**
 * למי אפשר להקפיץ תזכורת: מי שנכנס ל-CRM של הענף, כלומר הבעלים (מהאדמין, בשם
 * BRANCH_OWNER_ASSIGNEE) והשותפות הפעילות. איש צוות אחר לא רואה את ה-CRM, ותזכורת
 * אליו לא הייתה קופצת לאף אחד.
 */
async function reminderRecipients(): Promise<string[]> {
  const { data, error } = await supabaseAdmin.from("partner_users").select("name").eq("active", true);
  if (error) throw new Error(error.message);
  const partners = (data ?? []).map((r) => String(r.name ?? "").trim()).filter(Boolean);
  return [...new Set([BRANCH_OWNER_ASSIGNEE, ...partners])];
}

/** הפתקים של הלוח (או הארכיון, ב-archived=1), שם הצופה כדי שהמסך ידע מה "אצלך", ולמי אפשר להזכיר. */
export async function boardGet(req: NextRequest, v: Viewer) {
  const archived = !!req.nextUrl.searchParams.get("archived");
  let q = supabaseAdmin.from("school_board_notes").select(NOTE_COLUMNS);
  q = archived ? q.not("archived_at", "is", null).order("archived_at", { ascending: false }) : q.is("archived_at", null).order("pinned", { ascending: false }).order("updated_at", { ascending: false });
  try {
    const [{ data, error }, recipients] = await Promise.all([q.limit(500), reminderRecipients()]);
    if (error) return fail(error.message, 500);
    return NextResponse.json({ ok: true, notes: data ?? [], me: v.name, recipients });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "שגיאה", 500);
  }
}

async function unknownRecipients(names: string[] | undefined): Promise<string[]> {
  if (!names?.length) return [];
  const known = new Set(await reminderRecipients());
  return names.filter((n) => !known.has(n));
}

/**
 * create { ...שדות }, update { id, ...שדות }, archive { id }, restore { id },
 * dismiss { id } (סגירת התזכורת אצל הצופה), snooze { id, until } (דחייה אצלו).
 * כשמועד התזכורת משתנה, היא קופצת שוב לכולם; כשרק הנמענים משתנים, מי שכבר סגר
 * נשאר סגור.
 */
export async function boardPost(req: NextRequest, v: Viewer) {
  const b = await body(req);
  if (!b) return fail("בקשה לא תקינה");
  const action = actionOf(b);
  const fieldsOf = () => {
    const f = { ...b };
    delete f.action;
    delete f.id;
    return f;
  };

  if (action === "create") {
    const c = cleanBoardInput(fieldsOf());
    if (!c.ok) return fail(c.error);
    const unknown = await unknownRecipients(c.value.remind_to);
    if (unknown.length) return fail(`אין ל-CRM של הענף כניסה בשם: ${unknown.join(", ")}`);
    const { data, error } = await supabaseAdmin
      .from("school_board_notes")
      .insert({ ...c.value, created_by: v.name.slice(0, 60) })
      .select(NOTE_COLUMNS)
      .single();
    if (error) return fail(error.message, 500);
    return NextResponse.json({ ok: true, note: data });
  }

  if (!isUuid(b.id)) return fail("חסר מזהה");
  const { data: row, error: rowErr } = await supabaseAdmin.from("school_board_notes").select(NOTE_COLUMNS).eq("id", b.id).maybeSingle();
  if (rowErr) return fail(rowErr.message, 500);
  if (!row) return fail("הפתק לא נמצא", 404);
  const current = row as BoardNote;
  const state: Record<string, ReminderState> = { ...(current.reminder_state ?? {}) };

  if (action === "update") {
    const c = cleanBoardInput(fieldsOf(), current as BoardInput);
    if (!c.ok) return fail(c.error);
    const unknown = await unknownRecipients(c.value.remind_to?.filter((n) => !current.remind_to.includes(n)));
    if (unknown.length) return fail(`אין ל-CRM של הענף כניסה בשם: ${unknown.join(", ")}`);
    const patch: Record<string, unknown> = { ...c.value, updated_at: now() };
    const at = "remind_at" in c.value ? c.value.remind_at : current.remind_at;
    const to = c.value.remind_to ?? current.remind_to;
    const sameMoment = (a: string | null | undefined, z: string | null | undefined) => (a ? new Date(a).getTime() : null) === (z ? new Date(z).getTime() : null);
    if (!sameMoment(at, current.remind_at)) patch.reminder_state = {};
    else if (c.value.remind_to) patch.reminder_state = Object.fromEntries(Object.entries(state).filter(([n]) => to.includes(n)));
    const { data, error } = await supabaseAdmin.from("school_board_notes").update(patch).eq("id", b.id).select(NOTE_COLUMNS).single();
    if (error) return fail(error.message, 500);
    return NextResponse.json({ ok: true, note: data });
  }

  if (action === "archive" || action === "restore") {
    const { error } = await supabaseAdmin
      .from("school_board_notes")
      .update({ archived_at: action === "archive" ? now() : null, updated_at: now() })
      .eq("id", b.id);
    if (error) return fail(error.message, 500);
    return NextResponse.json({ ok: true });
  }

  if (action === "dismiss" || action === "snooze") {
    if (!current.remind_to.includes(v.name)) return fail("התזכורת הזו לא מיועדת אליך");
    if (action === "dismiss") state[v.name] = { dismissed_at: now() };
    else {
      const until = new Date(String(b.until ?? ""));
      const t = until.getTime();
      if (Number.isNaN(t) || t <= Date.now() || t > Date.now() + 60 * 86_400_000) return fail("מועד הדחייה לא תקין");
      state[v.name] = { snooze_until: until.toISOString() };
    }
    // לא נוגעים ב-updated_at: סגירת תזכורת אינה עריכה של הפתק.
    const { error } = await supabaseAdmin.from("school_board_notes").update({ reminder_state: state }).eq("id", b.id);
    if (error) return fail(error.message, 500);
    return NextResponse.json({ ok: true });
  }

  return fail("פעולה לא מוכרת");
}

/** התזכורות שצריכות לקפוץ עכשיו לצופה. המעטפת של ה-CRM שואלת כל כמה דקות. */
export async function remindersGet(v: Viewer) {
  const at = new Date();
  const { data, error } = await supabaseAdmin
    .from("school_board_notes")
    .select(NOTE_COLUMNS)
    .is("archived_at", null)
    .not("remind_at", "is", null)
    .lte("remind_at", at.toISOString())
    .contains("remind_to", [v.name])
    .order("remind_at")
    .limit(100);
  if (error) return fail(error.message, 500);
  const due = ((data ?? []) as BoardNote[]).filter((n) => reminderDue(n, v.name, at));
  return NextResponse.json({ ok: true, reminders: due, me: v.name });
}

// ── קבצים ──────────────────────────────────────────────────────────────────────

const FILE_COLUMNS = "id, name, storage_path, size_bytes, mime, folder, description, plan_item_id, uploaded_by, created_at, archived_at";
const cleanText = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

async function planItemExists(id: unknown): Promise<boolean> {
  if (!isUuid(id)) return false;
  const { data } = await supabaseAdmin.from("school_plan_items").select("id").eq("id", id).is("archived_at", null).maybeSingle();
  return !!data;
}

export async function filesGet(req: NextRequest) {
  const archived = !!req.nextUrl.searchParams.get("archived");
  let q = supabaseAdmin.from("school_files").select(FILE_COLUMNS);
  q = archived ? q.not("archived_at", "is", null) : q.is("archived_at", null);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(500);
  if (error) return fail(error.message, 500);
  return NextResponse.json({ ok: true, files: data ?? [] });
}

/**
 * sign { name, size }        - כתובת העלאה חתומה: הדפדפן מעלה ישר לאחסון, בלי
 *                              לעבור דרך Vercel (שחותך גוף בקשה בכ-4.5MB).
 * commit { path, name, ... } - אחרי ההעלאה: בודק שהקובץ באמת הגיע, ורושם אותו.
 * download { id }            - כתובת הורדה חתומה לחמש דקות, בשם המקורי.
 * update { id, ... }         - שם, תיקייה, תיאור, שיוך לפריט בתוכנית.
 * archive / restore { id }   - הקובץ נשאר באחסון; רק יוצא מהרשימה.
 */
export async function filesPost(req: NextRequest, v: Viewer) {
  const b = await body(req);
  if (!b) return fail("בקשה לא תקינה");
  const action = actionOf(b);

  if (action === "sign") {
    const name = cleanText(b.name, 200);
    const size = Number(b.size);
    if (!name) return fail("חסר שם קובץ");
    if (!Number.isFinite(size) || size <= 0) return fail("הקובץ ריק");
    if (size > FILE_MAX_BYTES) return fail("קובץ גדול מ-50MB. אפשר לשים קישור בלוח במקום.");
    const path = `files/${now().slice(0, 7)}/${randomUUID()}-${storageSafeName(name)}`;
    const { data, error } = await supabaseAdmin.storage.from(FILES_BUCKET).createSignedUploadUrl(path);
    if (error || !data) return fail(error?.message ?? "לא הצלחתי להכין את ההעלאה", 500);
    return NextResponse.json({ ok: true, path: data.path, token: data.token });
  }

  if (action === "commit") {
    const path = typeof b.path === "string" ? b.path : "";
    const name = cleanText(b.name, 200);
    if (!FILE_PATH_RE.test(path) || !name) return fail("בקשה לא תקינה");
    if (b.plan_item_id && !(await planItemExists(b.plan_item_id))) return fail("הפריט בתוכנית לא נמצא");
    const dir = path.slice(0, path.lastIndexOf("/"));
    const fileName = path.slice(path.lastIndexOf("/") + 1);
    const { data: found, error: listErr } = await supabaseAdmin.storage.from(FILES_BUCKET).list(dir, { search: fileName, limit: 5 });
    if (listErr) return fail(listErr.message, 500);
    const obj = found?.find((o) => o.name === fileName);
    if (!obj) return fail("הקובץ לא הגיע לאחסון. אפשר לנסות שוב.", 409);
    const meta = (obj.metadata ?? {}) as { size?: number; mimetype?: string };
    const { data, error } = await supabaseAdmin
      .from("school_files")
      .insert({
        name,
        storage_path: path,
        size_bytes: Number(meta.size ?? b.size) || null,
        mime: cleanText(meta.mimetype ?? b.mime, 120),
        folder: cleanText(b.folder, 60) ?? DEFAULT_FOLDER,
        description: cleanText(b.description, 1000),
        plan_item_id: isUuid(b.plan_item_id) ? b.plan_item_id : null,
        uploaded_by: v.name.slice(0, 60),
      })
      .select(FILE_COLUMNS)
      .single();
    if (error) return fail(error.message, 500);
    return NextResponse.json({ ok: true, file: data });
  }

  if (!isUuid(b.id)) return fail("חסר מזהה");
  const { data: file, error: fileErr } = await supabaseAdmin.from("school_files").select(FILE_COLUMNS).eq("id", b.id).maybeSingle();
  if (fileErr) return fail(fileErr.message, 500);
  if (!file) return fail("הקובץ לא נמצא", 404);

  if (action === "download") {
    const { data, error } = await supabaseAdmin.storage.from(FILES_BUCKET).createSignedUrl(file.storage_path, 300, { download: file.name });
    if (error || !data) return fail(error?.message ?? "לא הצלחתי להכין את ההורדה", 500);
    return NextResponse.json({ ok: true, url: data.signedUrl });
  }

  if (action === "update") {
    const patch: Record<string, unknown> = {};
    if ("name" in b) {
      const n = cleanText(b.name, 200);
      if (!n) return fail("חסר שם");
      patch.name = n;
    }
    if ("folder" in b) patch.folder = cleanText(b.folder, 60) ?? DEFAULT_FOLDER;
    if ("description" in b) patch.description = cleanText(b.description, 1000);
    if ("plan_item_id" in b) {
      if (b.plan_item_id && !(await planItemExists(b.plan_item_id))) return fail("הפריט בתוכנית לא נמצא");
      patch.plan_item_id = b.plan_item_id || null;
    }
    if (Object.keys(patch).length === 0) return fail("אין מה לעדכן");
    const { data, error } = await supabaseAdmin.from("school_files").update(patch).eq("id", b.id).select(FILE_COLUMNS).single();
    if (error) return fail(error.message, 500);
    return NextResponse.json({ ok: true, file: data });
  }

  if (action === "archive" || action === "restore") {
    const { error } = await supabaseAdmin.from("school_files").update({ archived_at: action === "archive" ? now() : null }).eq("id", b.id);
    if (error) return fail(error.message, 500);
    return NextResponse.json({ ok: true });
  }

  return fail("פעולה לא מוכרת");
}
