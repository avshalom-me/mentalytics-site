// סביבת העבודה המשותפת של ענף בתי הספר: התוכנית השנתית (גנט), לוח הפתקים
// והתזכורות, והקבצים. כאן אוצר המילים, החשבון שהמסכים מציירים איתו, וניקוי
// הקלט שהשרת מפעיל. בלי React ובלי מסד, כך שאפשר לייבא מהדפדפן ומהשרת.
//
// ה-API: app/lib/schools-api/workspace.ts. הטבלאות:
// supabase/migrations/20261025_schools_workspace.sql. תוכן התוכנית עצמו (אבני
// הדרך, הסכומים) נשמר במסד ולא כאן, כי הריפו ציבורי.

import { SCHOOL_ENTITY_TYPES } from "./schools-crm";

export type Opt<T extends string = string> = { value: T; label: string };
export const labelOf = (list: readonly Opt[], value: string | null | undefined) => list.find((o) => o.value === value)?.label ?? value ?? "";

// ── התוכנית ────────────────────────────────────────────────────────────────────

export const PLAN_KINDS = [
  { value: "phase", label: "שלב" },
  { value: "milestone", label: "אבן דרך" },
] as const satisfies readonly Opt[];
export type PlanKind = (typeof PLAN_KINDS)[number]["value"];

/** השורות של הגנט. צבע אחד לכל שורה, מתוך צבעי המותג. */
export const PLAN_TRACKS = [
  { value: "product", label: "שאלון ומוצר", color: "#3D8C8A", pale: "#EAF4F3" },
  { value: "marketing", label: "שיווק ופרסום", color: "#D49018", pale: "#FDF6E3" },
  { value: "pricing", label: "תמחור ושוק", color: "#A87010", pale: "#FBF1DD" },
  { value: "sales", label: "מכירות ובתי ספר", color: "#2A6462", pale: "#E3EFEE" },
  { value: "team", label: "צוות וגיוס", color: "#C9727A", pale: "#FBECEC" },
  { value: "general", label: "כללי", color: "#6B807E", pale: "#EFF5F5" },
] as const;
export type PlanTrack = (typeof PLAN_TRACKS)[number]["value"];
export const trackOf = (value: string | null | undefined) => PLAN_TRACKS.find((t) => t.value === value) ?? PLAN_TRACKS[PLAN_TRACKS.length - 1];

export const PLAN_STATUSES = [
  { value: "planned", label: "מתוכנן" },
  { value: "active", label: "בעבודה" },
  { value: "done", label: "הושלם" },
  { value: "dropped", label: "בוטל" },
] as const satisfies readonly Opt[];
export type PlanStatus = (typeof PLAN_STATUSES)[number]["value"];

/** שער של אבן דרך: מה נמדד מול הסף. */
export const GATE_METRICS = [
  { value: "received_net", label: 'כסף שנכנס, בלי מע"מ' },
  { value: "received_gross", label: 'כסף שנכנס, כולל מע"מ' },
] as const satisfies readonly Opt[];
export type GateMetric = (typeof GATE_METRICS)[number]["value"];

export interface PlanItem {
  id: string;
  kind: PlanKind;
  title: string;
  track: PlanTrack;
  start_date: string;
  end_date: string | null;
  status: PlanStatus;
  owner: string | null;
  description: string | null;
  gate_metric: GateMetric | null;
  gate_threshold: number | null;
  sort: number;
  created_by: string;
  updated_at: string;
}

// ── משימות ─────────────────────────────────────────────────────────────────────
// משימות הענף הן שורות ב-crm_tasks. מלבד משימה של בית ספר, עסקה או רישיון, משימה
// יכולה להיות של הענף עצמו (entity_id ריק) או להיות תלויה בפריט של התוכנית
// (entity_id = school_plan_items.id). כולן מתחילות ב-"school", ולכן התור הראשי
// של הבעלים ממשיך להציג רק את אלה שמשויכות אליו (OWNER_QUEUE_TASKS_OR).

export const BRANCH_TASK = "school_branch";
export const PLAN_TASK = "school_plan";
export const BRANCH_TASK_TYPES = [...SCHOOL_ENTITY_TYPES, BRANCH_TASK, PLAN_TASK] as const;
export type BranchTaskType = (typeof BRANCH_TASK_TYPES)[number];
export const isBranchTaskType = (t: unknown): t is BranchTaskType => typeof t === "string" && (BRANCH_TASK_TYPES as readonly string[]).includes(t);

// ── תאריכים ────────────────────────────────────────────────────────────────────
// בכל מקום YYYY-MM-DD: משווים כמחרוזות, ואין אזור זמן.

const DAY = 86_400_000;
const utc = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
export function isIsoDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const t = utc(v);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === v;
}
export const addDays = (iso: string, days: number) => new Date(utc(iso) + days * DAY).toISOString().slice(0, 10);
export const daysBetween = (from: string, to: string) => Math.round((utc(to) - utc(from)) / DAY);
export function addMonths(iso: string, n: number): string {
  const [y, m] = iso.slice(0, 7).split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}-01`;
}

export const HE_MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

/** היום הראשון של הרבעון הקלנדרי. */
export function quarterStart(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return `${y}-${String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, "0")}-01`;
}

export interface TimelineSpan { start: string; end: string; label: string; days: number }
export interface Timeline {
  start: string;
  /** היום שאחרי היום האחרון בחלון. */
  end: string;
  days: number;
  months: TimelineSpan[];
  quarters: TimelineSpan[];
}

/**
 * החלון שהגנט מצייר: חודשים שלמים מתחילת החודש של `from`, מקובצים לרבעונים
 * קלנדריים. התצוגה השנתית היא 12 חודשים מתחילת הרבעון; התקריב הוא 3.
 */
export function timeline(from: string, months: number): Timeline {
  const start = `${from.slice(0, 7)}-01`;
  const end = addMonths(start, months);
  const ms: TimelineSpan[] = [];
  for (let i = 0; i < months; i++) {
    const s = addMonths(start, i);
    const e = addMonths(start, i + 1);
    ms.push({ start: s, end: e, label: HE_MONTHS[Number(s.slice(5, 7)) - 1], days: daysBetween(s, e) });
  }
  const qs: TimelineSpan[] = [];
  for (const m of ms) {
    const q = quarterStart(m.start);
    const last = qs[qs.length - 1];
    if (last && last.start === q) {
      last.end = m.end;
      last.days += m.days;
    } else {
      qs.push({ start: q, end: m.end, label: `רבעון ${Math.floor((Number(q.slice(5, 7)) - 1) / 3) + 1} · ${q.slice(0, 4)}`, days: m.days });
    }
  }
  return { start, end, days: daysBetween(start, end), months: ms, quarters: qs };
}

/** איפה יום נופל בחלון, באחוזים מתחילתו. מוגבל לחלון. */
export function positionPct(t: Timeline, iso: string): number {
  return Math.min(100, Math.max(0, (daysBetween(t.start, iso) / t.days) * 100));
}

export interface BarGeometry {
  /** מתחילת החלון, באחוזים. בעמוד מימין לשמאל, ההתחלה היא הקצה הימני. */
  startPct: number;
  widthPct: number;
  /** הפס התחיל לפני החלון, או נמשך אחריו. */
  cutStart: boolean;
  cutEnd: boolean;
}

/**
 * הפס של שלב, או הנקודה של אבן דרך, בחלון. תאריך הסיום כלול: שלב מ-1.11 עד
 * 1.11 הוא ברוחב יום אחד. null כשהוא כולו מחוץ לחלון.
 */
export function barGeometry(t: Timeline, start: string, end: string | null): BarGeometry | null {
  const last = end && end >= start ? end : start;
  const after = addDays(last, 1);
  if (after <= t.start || start >= t.end) return null;
  const s = start < t.start ? t.start : start;
  const e = after > t.end ? t.end : after;
  return {
    startPct: positionPct(t, s),
    widthPct: (daysBetween(s, e) / t.days) * 100,
    cutStart: start < t.start,
    cutEnd: after > t.end,
  };
}

/** שלב או אבן דרך שהיום האחרון שלהם עבר, ושלא הושלמו ולא בוטלו. */
export function isLate(item: Pick<PlanItem, "start_date" | "end_date" | "status">, today: string): boolean {
  if (item.status === "done" || item.status === "dropped") return false;
  return (item.end_date ?? item.start_date) < today;
}

/** כמה שער התקדם: מה שנכנס מול הסף. */
export function gateProgress(received: number, threshold: number): { pct: number; reached: boolean; missing: number } {
  const pct = threshold > 0 ? Math.min(100, Math.max(0, (received / threshold) * 100)) : 0;
  return { pct, reached: threshold > 0 && received >= threshold, missing: Math.max(0, Math.round((threshold - received) * 100) / 100) };
}

export type Clean<T> = { ok: true; value: T } | { ok: false; error: string };
const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const inList = <T extends string>(list: readonly { value: T }[], v: unknown): v is T => list.some((o) => o.value === v);

export type PlanInput = Partial<Pick<PlanItem, "kind" | "title" | "track" | "start_date" | "end_date" | "status" | "owner" | "description" | "gate_metric" | "gate_threshold" | "sort">>;

/**
 * ניקוי פריט תוכנית לפני כתיבה. ביצירה חובה כותרת ותאריך התחלה; בעדכון רק מה
 * שנשלח. לשלב חובה תאריך סיום (בלעדיו הוא היה מצויר כיום אחד ומסומן באיחור
 * למחרת); אבן דרך היא יום אחד, ולכן אין לה תאריך סיום. שער דורש גם מדד וגם סף.
 * `current` הוא הפריט כפי שהוא במסד, כדי לבדוק עדכון חלקי מול מה שלא נשלח.
 */
export function cleanPlanInput(raw: unknown, current?: PlanInput): Clean<PlanInput> {
  if (!raw || typeof raw !== "object") return { ok: false, error: "בקשה לא תקינה" };
  const b = raw as Record<string, unknown>;
  const out: PlanInput = {};
  const has = (k: string) => k in b;
  if (!current || has("title")) {
    const t = text(b.title, 200);
    if (!t) return { ok: false, error: "חסרה כותרת" };
    out.title = t;
  }
  if (has("kind")) {
    if (!inList(PLAN_KINDS, b.kind)) return { ok: false, error: "סוג לא מוכר" };
    out.kind = b.kind;
  }
  if (has("track")) {
    if (!inList(PLAN_TRACKS, b.track)) return { ok: false, error: "שורה לא מוכרת" };
    out.track = b.track;
  }
  if (has("status")) {
    if (!inList(PLAN_STATUSES, b.status)) return { ok: false, error: "סטטוס לא מוכר" };
    out.status = b.status;
  }
  if (!current || has("start_date")) {
    if (!isIsoDate(b.start_date)) return { ok: false, error: "חסר תאריך התחלה" };
    out.start_date = b.start_date;
  }
  if (has("end_date")) {
    if (b.end_date && !isIsoDate(b.end_date)) return { ok: false, error: "תאריך סיום לא תקין" };
    out.end_date = (b.end_date as string) || null;
  }
  if (has("owner")) out.owner = text(b.owner, 60);
  if (has("description")) out.description = text(b.description, 4000);
  if (has("sort")) out.sort = Number.isFinite(Number(b.sort)) ? Math.trunc(Number(b.sort)) : 0;
  if (has("gate_metric")) {
    if (b.gate_metric && !inList(GATE_METRICS, b.gate_metric)) return { ok: false, error: "מדד לא מוכר" };
    out.gate_metric = (b.gate_metric as GateMetric) || null;
  }
  if (has("gate_threshold")) {
    const n = b.gate_threshold === null || b.gate_threshold === "" ? null : Number(b.gate_threshold);
    if (n !== null && (!Number.isFinite(n) || n <= 0 || n > 1e9)) return { ok: false, error: "הסף צריך להיות סכום חיובי" };
    out.gate_threshold = n === null ? null : Math.round(n * 100) / 100;
  }

  const merged = { ...current, ...out };
  const kind = merged.kind ?? "phase";
  if (kind === "milestone") {
    if (merged.end_date) out.end_date = null;
  } else if (!merged.end_date) {
    return { ok: false, error: "לשלב צריך תאריך סיום" };
  } else if (merged.start_date && merged.end_date < merged.start_date) {
    return { ok: false, error: "תאריך הסיום לפני תאריך ההתחלה" };
  }
  const metric = "gate_metric" in out ? out.gate_metric : merged.gate_metric;
  const threshold = "gate_threshold" in out ? out.gate_threshold : merged.gate_threshold;
  if (!!metric !== (threshold != null)) return { ok: false, error: "שער צריך גם מדד וגם סף, או אף אחד מהם" };
  if (metric && kind !== "milestone") return { ok: false, error: "שער אפשרי רק באבן דרך" };
  return { ok: true, value: out };
}

// ── הלוח ───────────────────────────────────────────────────────────────────────

export const BOARD_NOTE_KINDS = [
  { value: "note", label: "פתק", icon: "🗒️" },
  { value: "decision", label: "החלטה", icon: "✅" },
  { value: "template", label: "נוסח מוכן", icon: "📝" },
  { value: "link", label: "קישור", icon: "🔗" },
  { value: "agenda", label: "לפגישה הבאה", icon: "🗓️" },
] as const;
export type BoardNoteKind = (typeof BOARD_NOTE_KINDS)[number]["value"];

/** מצב התזכורת של אדם אחד: סגר אותה, או דחה עד מועד. */
export interface ReminderState { dismissed_at?: string; snooze_until?: string }

export interface BoardNote {
  id: string;
  kind: BoardNoteKind;
  title: string | null;
  body: string | null;
  url: string | null;
  pinned: boolean;
  remind_at: string | null;
  remind_to: string[];
  reminder_state: Record<string, ReminderState>;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

type ReminderFields = Pick<BoardNote, "remind_at" | "remind_to" | "reminder_state">;

/**
 * האם הפתק צריך לקפוץ עכשיו לאדם הזה? מ-remind_at והלאה, לכל שם ב-remind_to,
 * עד שסגר אותו; "אחר כך" דוחה עד snooze_until. ההשוואה היא של רגעים בזמן, לא
 * של מחרוזות, כי חותמות הזמן מגיעות מהמסד ומהדפדפן בפורמטים שונים.
 */
export function reminderDue(note: ReminderFields, name: string, now: Date): boolean {
  if (!note.remind_at || !note.remind_to.includes(name)) return false;
  if (new Date(note.remind_at).getTime() > now.getTime()) return false;
  const s = note.reminder_state?.[name];
  if (s?.dismissed_at) return false;
  if (s?.snooze_until && new Date(s.snooze_until).getTime() > now.getTime()) return false;
  return true;
}

/** האם יש מישהו שהתזכורת עוד לא נסגרה אצלו. מוצג על הפתק כ"תזכורת". */
export function reminderOpen(note: ReminderFields): boolean {
  if (!note.remind_at || note.remind_to.length === 0) return false;
  return note.remind_to.some((n) => !note.reminder_state?.[n]?.dismissed_at);
}

// ── שינוי פתק בלי לאבד שינוי של מישהו אחר ───────────────────────────────────────
// סגירה, דחייה ועריכה של פתק קוראות את השורה, מחשבות ממנה את מה שצריך לכתוב,
// וכותבות. כש-reminder_state נכתב כולו (מפתח לכל אדם), שני אנשים שסוגרים את אותה
// תזכורת באותו רגע קראו אותו ריק וכל אחד כתב רק את עצמו: הסגירה של הראשון
// אבדה והתזכורת קפצה לו שוב. לכן כל כתיבה מותנית בגרסה שנקראה (updated_at ו-
// reminder_state: עריכה מקדמת את הראשון, סגירה ודחייה משנות את השני), ואם מישהו
// הקדים - קוראים מחדש, מחליטים מחדש, וכותבים שוב.

/** מה לעשות עם הפתק שנקרא: מה לכתוב, או למה לא. */
export type NoteChange = { ok: true; patch: Record<string, unknown> } | { ok: false; error: string; status?: number };

export type NoteChangeResult = { ok: true; note: BoardNote } | { ok: false; error: string; status: number };

/** הפתק שהצופה רואה השתנה מתחת לידיו, ואחרי כמה ניסיונות עדיין. */
export const NOTE_CONFLICT = "מישהו שינה את הפתק באותו רגע. אפשר לנסות שוב.";
export const NOTE_MISSING = "הפתק לא נמצא";

export interface NoteStore {
  read(): Promise<BoardNote | null>;
  /** כותב רק אם הפתק במסד עדיין בגרסה של `seen`; מחזיר אותו אחרי הכתיבה, או null אם מישהו הקדים. */
  writeIf(seen: BoardNote, patch: Record<string, unknown>): Promise<BoardNote | null>;
}

export async function changeNote(store: NoteStore, decide: (current: BoardNote) => NoteChange | Promise<NoteChange>, attempts = 5): Promise<NoteChangeResult> {
  for (let i = 0; i < attempts; i++) {
    const seen = await store.read();
    if (!seen) return { ok: false, error: NOTE_MISSING, status: 404 };
    const change = await decide(seen);
    if (!change.ok) return { ok: false, error: change.error, status: change.status ?? 400 };
    const written = await store.writeIf(seen, change.patch);
    if (written) return { ok: true, note: written };
  }
  return { ok: false, error: NOTE_CONFLICT, status: 409 };
}

export type BoardInput = Partial<Pick<BoardNote, "kind" | "title" | "body" | "url" | "pinned" | "remind_at" | "remind_to">>;

/**
 * ניקוי פתק לפני כתיבה. פתק צריך כותרת או תוכן; קישור צריך כתובת http(s);
 * תזכורת צריכה מועד ולפחות אדם אחד. `current` כמו ב-cleanPlanInput.
 */
export function cleanBoardInput(raw: unknown, current?: BoardInput): Clean<BoardInput> {
  if (!raw || typeof raw !== "object") return { ok: false, error: "בקשה לא תקינה" };
  const b = raw as Record<string, unknown>;
  const out: BoardInput = {};
  const has = (k: string) => k in b;
  if (has("kind")) {
    if (!BOARD_NOTE_KINDS.some((k) => k.value === b.kind)) return { ok: false, error: "סוג לא מוכר" };
    out.kind = b.kind as BoardNoteKind;
  }
  if (has("title")) out.title = text(b.title, 200);
  if (has("body")) out.body = text(b.body, 8000);
  if (has("url")) {
    const u = text(b.url, 1000);
    if (u && !/^https?:\/\/[^\s]+$/i.test(u)) return { ok: false, error: "קישור צריך להתחיל ב-https://" };
    out.url = u;
  }
  if (has("pinned")) out.pinned = b.pinned === true;
  if (has("remind_at")) {
    if (b.remind_at) {
      const t = new Date(String(b.remind_at));
      if (Number.isNaN(t.getTime())) return { ok: false, error: "מועד התזכורת לא תקין" };
      out.remind_at = t.toISOString();
    } else out.remind_at = null;
  }
  if (has("remind_to")) {
    if (!Array.isArray(b.remind_to)) return { ok: false, error: "רשימת הנמענים לא תקינה" };
    out.remind_to = [...new Set(b.remind_to.map((n) => text(n, 60)).filter((n): n is string => !!n))].slice(0, 20);
  }

  const merged = { ...current, ...out };
  if (!merged.title && !merged.body && !merged.url) return { ok: false, error: "פתק ריק" };
  if (merged.kind === "link" && !merged.url) return { ok: false, error: "חסר קישור" };
  if (merged.remind_at && !(merged.remind_to ?? []).length) return { ok: false, error: "למי להזכיר?" };
  if (!merged.remind_at && "remind_to" in out) out.remind_to = [];
  return { ok: true, value: out };
}

// ── קבצים ──────────────────────────────────────────────────────────────────────

export const FILE_MAX_BYTES = 50 * 1024 * 1024;
export const FILES_BUCKET = "school-branch-files";
export const DEFAULT_FOLDER = "כללי";

/**
 * שם בטוח לסוף נתיב באחסון: אותיות לטיניות, ספרות, נקודה ומקף. השם העברי
 * המקורי נשמר בטבלה ומוחזר בהורדה.
 */
export function storageSafeName(name: string): string {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) : "";
  const stem = (dot > 0 ? name.slice(0, dot) : name).normalize("NFKD").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return `${stem || "file"}${ext ? `.${ext}` : ""}`;
}

/** נתיב שהשרת הנפיק: files/YYYY-MM/<uuid>-<שם בטוח>. כל נתיב אחר נדחה. */
export const FILE_PATH_RE = /^files\/\d{4}-\d{2}\/[0-9a-f-]{36}-[A-Za-z0-9_.-]{1,60}$/;

export function fileSizeLabel(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
