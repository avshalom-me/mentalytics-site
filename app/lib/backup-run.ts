import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import { fetchAllRows } from "./fetch-all-rows";
import { startAgentRun, finishAgentRun } from "./agent-infra";
import {
  BACKUP_FOLDER_NAME,
  createRootFolder,
  driveConfigured,
  driveCredentialSource,
  driveFolderOverride,
  ensureFolder,
  uploadFile,
} from "./google-drive";

// גיבוי לדרייב של המשתמש - שני חלקים, ושניהם עונים על פער אמיתי:
//
// 1. **קבצי Storage.** גיבויי Supabase (יומי ו-PITR כאחד) אינם כוללים אותם -
//    כך כתוב בתיעוד שלהם. אצלנו שם 181MB של תעודות רישיון ותמונות פרופיל,
//    422 קבצים, והם החומר היחיד שאי אפשר לשחזר בשום דרך אחרת.
// 2. **דאמפ לוגי של טבלאות העסק.** לא כי אין גיבוי - יש - אלא כי שחזור של
//    Supabase הוא הכל-או-כלום: מגלגלים את כל המסד אחורה בזמן. דאמפ משלנו
//    מאפשר לשחזר **טבלה אחת** בלי לגעת בשאר, וזה בדיוק התרחיש של
//    "מישהו הפיל טבלה".
//
// analytics_events ו-therapist_profile_views אינם מגובים במכוון: הם 46MB
// מתוך 68MB של המסד, הם טלמטריה, ואובדנם אינו משנה דבר עסקית. גיבוי שלהם
// היה הופך ריצה של דקות לריצה של שעה.

const TELEMETRY_TABLES = new Set(["analytics_events", "therapist_profile_views"]);

/** הטבלאות שנכנסות לדאמפ. מפורשות ולא "כל מה שיש" - טבלה חדשה צריכה החלטה. */
const BUSINESS_TABLES = [
  "therapists",
  "therapy_center_accounts",
  "center_therapist_invites",
  "subscriptions",
  "payments",
  "crm_leads",
  "crm_email_log",
  "therapist_contact_clicks",
  "therapist_certificates",
  "therapist_articles",
  "therapist_audit_log",
  "match_tokens",
  "consent_events",
  "plan_targets",
  "quiz_usage",
] as const;

/** תקרת זמן לריצה. Vercel קוצב 300 שניות; עוצרים לפני, ומשלימים מחר. */
const RUN_BUDGET_MS = 210_000;

export type BackupRun = {
  ok: boolean;
  configured: boolean;
  dump?: { tables: number; rows: number; bytes: number; skipped?: string[] };
  storage?: { uploaded: number; remaining: number; bytes: number };
  /** מוחזר פעם אחת בלבד - בריצה שיצרה את תיקיית הגיבוי. */
  folderLink?: string;
  /** באילו אישורים נעשה שימוש - כדי שהשאלה לא תישאר פתוחה. */
  credentials?: "dedicated" | "google_ads_fallback" | "missing";
  error?: string;
  note?: string;
};

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function runBackup(): Promise<BackupRun> {
  if (!driveConfigured()) {
    return {
      ok: false,
      configured: false,
      note:
        "Google Drive לא מוגדר. נדרש GOOGLE_DRIVE_REFRESH_TOKEN עם scope drive.file " +
        "(ה-client id/secret נלקחים מ-GOOGLE_ADS_* אם לא הוגדרו בנפרד). " +
        "תיקיית היעד נוצרת אוטומטית בריצה הראשונה.",
    };
  }
  const startedAt = Date.now();
  // נרשם ביומן הריצות כמו כל סוכן - לא לתצוגה בלבד: שומר הלילה בודק טריות
  // של כל סוכן, וכך "הגיבוי לא רץ שלושה ימים" נתפס מעצמו. זו בדיוק התקלה
  // שאי אפשר להרשות לגלות ביום שבו צריך את הגיבוי.
  const runId = await startAgentRun("backup", "run");

  try {
    // ── תיקיית היעד ─────────────────────────────────────────────────────────
    // נוצרת ע"י האפליקציה ולא מסופקת ידנית: scope drive.file אינו רואה
    // תיקיות שהמשתמש הכין בעצמו. נוצרת פעם אחת ונזכרת, כדי שלא תיווצר
    // תיקייה חדשה בכל ריצה.
    let root = driveFolderOverride();
    let rootLink: string | null = null;
    if (!root) {
      const { data: saved } = await supabaseAdmin
        .from("backup_state")
        .select("drive_file_id")
        .eq("kind", "root_folder")
        .eq("source_key", BACKUP_FOLDER_NAME)
        .maybeSingle();
      root = (saved?.drive_file_id as string | undefined) ?? null;
      if (!root) {
        const created = await createRootFolder();
        root = created.id;
        rootLink = created.link;
        await supabaseAdmin.from("backup_state").upsert(
          { kind: "root_folder", source_key: BACKUP_FOLDER_NAME, drive_file_id: created.id },
          { onConflict: "kind,source_key" },
        );
        console.log(`backup: created Drive folder "${BACKUP_FOLDER_NAME}" - ${created.link}`);
      }
    }
    // ── 1. דאמפ הטבלאות ─────────────────────────────────────────────────────
    const dumpFolder = await ensureFolder("db", root);
    const payload: Record<string, unknown[]> = {};
    const skipped: string[] = [];
    let rows = 0;
    for (const table of BUSINESS_TABLES) {
      if (TELEMETRY_TABLES.has(table)) continue;
      try {
        const data = await fetchAllRows<Record<string, unknown>>(() =>
          supabaseAdmin.from(table).select("*"),
        );
        payload[table] = data;
        rows += data.length;
      } catch (e) {
        // טבלה שנמחקה או שונתה לא מפילה את כל הגיבוי - נרשמת ומדווחת.
        skipped.push(`${table}: ${e instanceof Error ? e.message : "unknown"}`);
      }
    }
    const json = JSON.stringify({ generated_at: new Date().toISOString(), tables: payload });
    const dumpName = `mentalytics-db-${stamp()}.json`;
    const up = await uploadFile({
      name: dumpName,
      parentId: dumpFolder,
      content: json,
      mimeType: "application/json",
    });
    await supabaseAdmin.from("backup_state").upsert(
      { kind: "db_dump", source_key: stamp(), drive_file_id: up.id, size_bytes: json.length, uploaded_at: new Date().toISOString() },
      { onConflict: "kind,source_key" },
    );

    // ── 2. קבצי Storage, מצטבר ──────────────────────────────────────────────
    // דרך RPC ולא ישירות: supabase-js מדבר רק עם סכמות שנחשפו ל-API, ו-
    // .schema("storage") מוחזר כ-"Invalid schema: storage". ראו את המיגרציה
    // admin_storage_objects_rpc.
    const { data: objectRows, error: objErr } = await supabaseAdmin.rpc("admin_storage_objects");
    if (objErr) throw new Error(`storage listing failed: ${objErr.message}`);
    const objects = (objectRows ?? []) as { bucket_id: string; name: string; size_bytes: number }[];
    const { data: doneRows } = await supabaseAdmin
      .from("backup_state")
      .select("source_key")
      .eq("kind", "storage_object");
    const done = new Set((doneRows ?? []).map((r) => r.source_key as string));

    const pending = objects.filter((o) => !done.has(`${o.bucket_id}/${o.name}`));
    let uploaded = 0;
    let bytes = 0;
    const filesFolder = await ensureFolder("storage", root);
    const bucketFolders = new Map<string, string>();

    for (const obj of pending) {
      if (Date.now() - startedAt > RUN_BUDGET_MS) break; // נמשיך בריצה הבאה
      const key = `${obj.bucket_id}/${obj.name}`;
      try {
        const dl = await supabaseAdmin.storage.from(obj.bucket_id).download(obj.name);
        if (dl.error || !dl.data) continue;
        const buf = await dl.data.arrayBuffer();

        let parent = bucketFolders.get(obj.bucket_id);
        if (!parent) {
          parent = await ensureFolder(obj.bucket_id, filesFolder);
          bucketFolders.set(obj.bucket_id, parent);
        }
        // הנתיב שטוח בשם הקובץ: תיקיות משנה בדרייב היו מכפילות קריאות API
        // בלי להוסיף דבר - הנתיב המקורי נשמר בשם וניתן לשחזור ממנו.
        const res = await uploadFile({
          name: obj.name.replace(/\//g, "__"),
          parentId: parent,
          content: buf,
          mimeType: "application/octet-stream",
        });
        await supabaseAdmin.from("backup_state").upsert(
          { kind: "storage_object", source_key: key, drive_file_id: res.id, size_bytes: buf.byteLength },
          { onConflict: "kind,source_key" },
        );
        uploaded++;
        bytes += buf.byteLength;
      } catch (e) {
        console.error(`backup: storage object failed (${key}):`, e instanceof Error ? e.message : e);
      }
    }

    const remaining = Math.max(0, pending.length - uploaded);
    await finishAgentRun(runId, {
      status: "ok",
      summary:
        `${rows} שורות ב-${Object.keys(payload).length} טבלאות · ${uploaded} קבצים הועלו` +
        (remaining > 0 ? ` · ${remaining} נותרו לריצה הבאה` : " · הכול מגובה"),
      details: { uploaded, remaining, dump_rows: rows, credentials: driveCredentialSource() },
    });

    return {
      ok: true,
      configured: true,
      dump: { tables: Object.keys(payload).length, rows, bytes: json.length, ...(skipped.length ? { skipped } : {}) },
      storage: { uploaded, remaining, bytes },
      credentials: driveCredentialSource(),
      // מוחזר רק בריצה שיצרה את התיקייה - כדי שיהיה קישור ישיר אליה בלוג.
      ...(rootLink ? { folderLink: rootLink } : {}),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finishAgentRun(runId, { status: "error", error: msg });
    return { ok: false, configured: true, error: msg };
  }
}
