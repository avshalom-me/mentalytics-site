import "server-only";
import OpenAI from "openai";
import { supabaseAdmin } from "./supabaseAdmin";
import { startAgentRun, finishAgentRun } from "./agent-infra";
import {
  gmailConfigured,
  connectedAccount,
  listInboxIds,
  getMessage,
  threadAnsweredAfter,
  sendGmailReply,
} from "./gmail";
import { INBOX_KNOWLEDGE } from "./inbox-knowledge";

// סוכן שירות הלקוחות: קורא את admin@getmentalytics.com, מסווג כל פנייה,
// ומכין טיוטת תשובה מתוך בסיס הידע + תשובות עבר שאושרו.
//
// גבול הבטיחות של הסוכן הזה הוא חד: הקרון קולט ומנסח בלבד. שליחה קיימת
// רק כפעולת אדמין מפורשת (sendInboxReply), פנייה-פנייה, אחרי עריכה.
// אין שום מסלול שבו טיוטה הופכת למייל יוצא בלי לחיצה.
//
// "למידה": כל תשובה שנשלחה נשמרת כדוגמה (is_exemplar), והטיוטות הבאות
// מקבלות את הדוגמאות האחרונות בפרומפט. אין fine-tuning - יש התכנסות
// לניסוחים שאושרו בפועל.

// gpt-4o ולא mini: הבדיקה הראשונה תפסה את mini מעוות עובדה מספרית
// מבסיס הידע. בעשרות מיילים ביום ההפרש הוא אגורות - והטיוטות יוצאות לאנשים.
const MODEL = process.env.AGENT_INBOX_LLM_MODEL ?? "gpt-4o";
const MAX_DRAFTS_PER_RUN = 10;
const MAX_EXTERNAL_CHECKS_PER_RUN = 20;
const INGEST_WINDOW_DAYS = 7;
// התיבה שהסוכן אמור לעבוד מולה. ב-OAuth Playground קל לאשר בטעות עם
// החשבון האישי שמחובר בדפדפן - ואז הסוכן היה קורא תיבה אישית בשקט.
// הריצה מאמתת את זהות החשבון ומסרבת לעבוד על כל תיבה אחרת.
const EXPECTED_ACCOUNT = (process.env.GMAIL_ACCOUNT ?? "admin@getmentalytics.com").toLowerCase();

// כתובות שלנו - מייל מהן אינו "פנייה נכנסת" (התשובות של עצמנו חוזרות
// ב-in:inbox כשהפונה עונה, אבל ההודעה המקורית שלנו לא צריכה שורה).
const OUR_DOMAINS = ["getmentalytics.com", "mentalytics.co.il"];

export type InboxRow = {
  id: string;
  gmail_message_id: string;
  gmail_thread_id: string;
  header_message_id: string | null;
  from_email: string;
  from_name: string | null;
  subject: string | null;
  body_text: string | null;
  received_at: string;
  sender_therapist_id: string | null;
  sender_therapist_name?: string | null;
  category: string | null;
  status: string;
  draft_subject: string | null;
  draft_body: string | null;
  draft_generated_at: string | null;
  final_body: string | null;
  replied_at: string | null;
};

export type InboxRunResult = {
  ok: boolean;
  configured: boolean;
  fetched: number;
  inserted: number;
  drafted: number;
  autoIgnored: number;
  answeredExternal: number;
  errors: string[];
  error?: string;
};

// ── העשרת הקשר: מי הפונה ────────────────────────────────────────────────

type SenderContext = {
  therapistId: string | null;
  contextText: string; // מוזרק לפרומפט; ריק אם הפונה לא זוהה
};

async function senderContext(email: string): Promise<SenderContext> {
  // לא maybeSingle: אותו מייל יכול להופיע בכמה רשומות (רשומת בדיקה,
  // פרופיל כפול), ו-maybeSingle נכשל אז בשקט והפונה יצא "לא מזוהה".
  // מעדיפים את הפרופיל המקודם, ואחריו את הוותיק.
  const { data: matches } = await supabaseAdmin
    .from("therapists")
    .select("id, full_name, status, promotion_source, promoted_since, entity_type, created_at")
    .eq("email", email)
    .order("created_at", { ascending: true })
    .limit(5);
  const t = (matches ?? []).find((m) => m.promotion_source) ?? (matches ?? [])[0];
  if (!t) return { therapistId: null, contextText: "" };

  const lines = [
    `הפונה מזוהה במערכת: ${t.full_name ?? "ללא שם"} (${t.entity_type === "center" ? "מרכז טיפולי" : "מטפל/ת"}).`,
  ];
  if (t.promotion_source) {
    const src =
      t.promotion_source === "paid"
        ? "מנוי בתשלום"
        : t.promotion_source === "gift_trial"
          ? "מסלול הזמנה - חודשיים ראשונים ללא תשלום"
          : t.promotion_source === "center"
            ? "מקודם דרך מרכז"
            : "קידום מתנה";
    lines.push(`מסלול נוכחי: ${src}${t.promoted_since ? `, מאז ${String(t.promoted_since).slice(0, 10)}` : ""}.`);
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("first_charge_on, status")
      .eq("therapist_id", t.id)
      .maybeSingle();
    if (sub?.first_charge_on) {
      lines.push(`תאריך החיוב הראשון שלו/ה: ${String(sub.first_charge_on).slice(0, 10)}.`);
    }
  } else {
    lines.push(`מסלול נוכחי: חינמי (מופיע במאגר, לא במערכת ההתאמות).`);
  }
  return { therapistId: t.id as string, contextText: lines.join("\n") };
}

// ── סיווג + טיוטה ───────────────────────────────────────────────────────

const SYSTEM_PROMPT = [
  'אתה עוזר שירות הלקוחות של "טיפול חכם" (Mentalytics) - פלטפורמה ישראלית להתאמת טיפול נפשי.',
  "תפקידך: לסווג מייל נכנס ולכתוב טיוטת תשובה. את הטיוטה יקרא ויערוך אדם לפני שליחה - אתה לא שולח.",
  "",
  "בסיס הידע שמותר להסתמך עליו נמצא בהודעת המשתמש. כלל היסוד: מה שלא כתוב שם - אתה לא טוען.",
  "מייל נכנס מכיל לרוב ציטוט של התכתבות קודמת. הציטוט הוא הקשר בלבד - הוא מראה מה נאמר, ואינו מקור",
  "לעובדות על המוצר. גם אם מופיע בו מחיר, תנאי או תכונה, אל תחזור עליהם אלא אם הם כתובים בבסיס הידע.",
  "אם התשובה הנכונה דורשת עובדה שאין לך, כתוב במקומה סימון [להשלים: מה חסר]. עדיף חור גלוי מניחוש.",
  "",
  "סיווג לאחת הקטגוריות:",
  "therapist_billing (מטפל/ת - תשלום, חשבונית, חיוב), therapist_profile (מטפל/ת - עריכת פרופיל, תמונה, פרטים),",
  "therapist_cancel (מטפל/ת - ביטול מנוי או בקשת הפסקה), patient (מטופל/ת או הורה שמחפשים עזרה),",
  "center (מרכז טיפולי), system (מייל אוטומטי: חשבונית ספק, התראת מערכת, bounce), spam (פרסומת, ניוזלטר, פנייה מסחרית קרה),",
  "other (כל השאר).",
  "",
  "needs_reply=false רק עבור spam ו-system, או מייל שבפירוש לא מצפה לתשובה (אישור אוטומטי).",
  "",
  "כללי הטיוטה:",
  "- עברית, גוף שני, פנייה בשם הפונה אם ידוע. אם המייל נכתב בשפה אחרת - ענה באותה שפה.",
  "- טון עובדתי ומסייע. בלי סופרלטיבים, בלי שפה שיווקית, בלי התנצלויות מיותרות.",
  "- אסור קו מפריד ארוך (מקף ארוך). השתמש ב' - ' במקום.",
  "- קצר ולעניין: לענות על מה שנשאל, לא להוסיף מידע שלא התבקש.",
  "- מספרים, מחירים ותנאים מועתקים מבסיס הידע כלשונם. אסור לנסח מחדש, לעגל או לפשט אותם (למשל: 'עד 5 שאלונים חינם' אסור שייהפך ל'השאלון הראשון חינם').",
  "- מטופל במצוקה חריפה: להפנות בעדינות לער\"ן 1201 או למיון, בלי ייעוץ קליני.",
  "- חתימה: 'בברכה,\\nצוות טיפול חכם'.",
  "- אם קיבלת דוגמאות של תשובות עבר שאושרו - למד מהן את הסגנון והניסוחים.",
  "",
  "החזר JSON בלבד:",
  '{"category": "...", "needs_reply": true/false, "draft_subject": "...", "draft_body": "...", "note": "הערה פנימית קצרה לאדמין, או ריק"}',
].join("\n");

type Classified = {
  category: string;
  needs_reply: boolean;
  draft_subject: string;
  draft_body: string;
  note: string;
};

const VALID_CATEGORIES = new Set([
  "therapist_billing",
  "therapist_profile",
  "therapist_cancel",
  "patient",
  "center",
  "system",
  "spam",
  "other",
]);

async function exemplars(): Promise<{ category: string; incoming: string; reply: string }[]> {
  const { data } = await supabaseAdmin
    .from("inbox_messages")
    .select("category, subject, body_text, final_body")
    .eq("is_exemplar", true)
    .not("final_body", "is", null)
    .order("replied_at", { ascending: false })
    .limit(5);
  return (data ?? []).map((r) => ({
    category: r.category ?? "other",
    incoming: `${r.subject ?? ""}\n${(r.body_text ?? "").slice(0, 400)}`,
    reply: (r.final_body ?? "").slice(0, 1200),
  }));
}

async function classifyAndDraft(row: InboxRow, ctx: SenderContext): Promise<Classified | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const shots = await exemplars();
  try {
    const res = await openai.chat.completions.create(
      {
        model: MODEL,
        max_tokens: 900,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify({
              knowledge_base: INBOX_KNOWLEDGE,
              sender_context: ctx.contextText || "הפונה לא מזוהה במערכת.",
              approved_past_replies: shots,
              incoming_email: {
                from: `${row.from_name ?? ""} <${row.from_email}>`,
                subject: row.subject ?? "",
                body: (row.body_text ?? "").slice(0, 6000),
              },
            }),
          },
        ],
      },
      { timeout: 60_000, maxRetries: 1 }
    );
    const raw = res.choices[0]?.message?.content?.trim();
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Classified>;
    const category = VALID_CATEGORIES.has(String(p.category)) ? String(p.category) : "other";
    return {
      category,
      needs_reply: p.needs_reply !== false && category !== "spam" && category !== "system",
      draft_subject: String(p.draft_subject ?? "").slice(0, 300),
      draft_body: String(p.draft_body ?? "").slice(0, 8000),
      note: String(p.note ?? "").slice(0, 500),
    };
  } catch (e) {
    console.error("inbox classify failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

// ── הריצה ───────────────────────────────────────────────────────────────

function isOurAddress(email: string): boolean {
  return OUR_DOMAINS.some((d) => email.endsWith(`@${d}`));
}

export async function runInboxAgent(): Promise<InboxRunResult> {
  const runId = await startAgentRun("inbox");
  const result: InboxRunResult = {
    ok: true,
    configured: gmailConfigured(),
    fetched: 0,
    inserted: 0,
    drafted: 0,
    autoIgnored: 0,
    answeredExternal: 0,
    errors: [],
  };

  if (!result.configured) {
    await finishAgentRun(runId, {
      status: "empty",
      summary: "לא מוגדר עדיין - חסרים GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN",
      details: { configured: false },
    });
    return result;
  }

  try {
    // 0. אימות זהות: הטוקן חייב להיות של התיבה הנכונה.
    const account = await connectedAccount();
    if (account !== EXPECTED_ACCOUNT) {
      const msg = `הטוקן שייך ל-${account} ולא ל-${EXPECTED_ACCOUNT} - אושר חשבון שגוי ב-OAuth Playground. הסוכן מסרב לקרוא תיבה אחרת.`;
      await finishAgentRun(runId, { status: "error", error: msg, details: { configured: true, account } });
      return { ...result, ok: false, error: msg };
    }

    // 1. קליטה: מה חדש בתיבה שעוד לא אצלנו.
    const ids = await listInboxIds(INGEST_WINDOW_DAYS);
    result.fetched = ids.length;
    if (ids.length > 0) {
      const { data: existing } = await supabaseAdmin
        .from("inbox_messages")
        .select("gmail_message_id")
        .in("gmail_message_id", ids.map((m) => m.id));
      const known = new Set((existing ?? []).map((r) => r.gmail_message_id as string));
      for (const m of ids.filter((x) => !known.has(x.id))) {
        try {
          const msg = await getMessage(m.id);
          if (!msg || isOurAddress(msg.fromEmail)) continue;
          const { error } = await supabaseAdmin.from("inbox_messages").insert({
            gmail_message_id: msg.id,
            gmail_thread_id: msg.threadId,
            header_message_id: msg.headerMessageId,
            from_email: msg.fromEmail,
            from_name: msg.fromName,
            subject: msg.subject,
            body_text: msg.bodyText,
            received_at: msg.receivedAt,
          });
          if (error) {
            // מרוץ בין שתי ריצות על אותה הודעה נבלם ב-unique; זו לא שגיאה.
            if (!error.message.includes("duplicate")) result.errors.push(error.message);
          } else {
            result.inserted++;
          }
        } catch (e) {
          result.errors.push(e instanceof Error ? e.message : String(e));
        }
      }
    }

    // 2. פניות פתוחות שנענו ישירות בג'ימייל - נסגרות, לא נשארות בתור.
    const { data: open } = await supabaseAdmin
      .from("inbox_messages")
      .select("id, gmail_thread_id, received_at")
      .in("status", ["new", "drafted"])
      .order("received_at", { ascending: false })
      .limit(MAX_EXTERNAL_CHECKS_PER_RUN);
    for (const o of open ?? []) {
      try {
        const answered = await threadAnsweredAfter(
          o.gmail_thread_id as string,
          new Date(o.received_at as string).getTime()
        );
        if (answered) {
          await supabaseAdmin
            .from("inbox_messages")
            .update({ status: "sent_external", updated_at: new Date().toISOString() })
            .eq("id", o.id);
          result.answeredExternal++;
        }
      } catch (e) {
        result.errors.push(e instanceof Error ? e.message : String(e));
      }
    }

    // 3. סיווג וטיוטה לכל מה שנשאר חדש.
    const { data: fresh } = await supabaseAdmin
      .from("inbox_messages")
      .select("*")
      .eq("status", "new")
      .order("received_at", { ascending: true })
      .limit(MAX_DRAFTS_PER_RUN);
    for (const row of (fresh ?? []) as InboxRow[]) {
      const ctx = await senderContext(row.from_email);
      const c = await classifyAndDraft(row, ctx);
      if (!c) continue; // אין מפתח OpenAI או כשל - יישאר 'new' לריצה הבאה
      const update: Record<string, unknown> = {
        category: c.category,
        sender_therapist_id: ctx.therapistId,
        updated_at: new Date().toISOString(),
      };
      if (!c.needs_reply) {
        update.status = "ignored";
        result.autoIgnored++;
      } else {
        update.status = "drafted";
        update.draft_subject = c.draft_subject || `Re: ${row.subject ?? ""}`;
        update.draft_body = c.draft_body;
        update.draft_generated_at = new Date().toISOString();
        update.draft_model = MODEL;
        result.drafted++;
      }
      const { error } = await supabaseAdmin.from("inbox_messages").update(update).eq("id", row.id);
      if (error) result.errors.push(error.message);
    }

    await finishAgentRun(runId, {
      status: result.inserted + result.drafted + result.answeredExternal > 0 ? "ok" : "empty",
      summary:
        `נקלטו ${result.inserted} חדשות, ${result.drafted} טיוטות מוכנות` +
        (result.autoIgnored > 0 ? `, ${result.autoIgnored} סווגו כספאם/מערכת` : "") +
        (result.answeredExternal > 0 ? `, ${result.answeredExternal} נענו ישירות בג'ימייל` : ""),
      details: {
        configured: true,
        fetched: result.fetched,
        inserted: result.inserted,
        drafted: result.drafted,
        auto_ignored: result.autoIgnored,
        answered_external: result.answeredExternal,
        errors: result.errors.slice(0, 5),
      },
    });
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "שגיאה";
    await finishAgentRun(runId, { status: "error", error: msg });
    return { ...result, ok: false, error: msg };
  }
}

// ── פעולות אדמין ────────────────────────────────────────────────────────

/** הפניות לעמוד הסוכן: פתוחות קודם, ואחריהן שנענו לאחרונה. */
export async function listInbox(): Promise<InboxRow[]> {
  const { data: openRows } = await supabaseAdmin
    .from("inbox_messages")
    .select("*")
    .in("status", ["new", "drafted"])
    .order("received_at", { ascending: false })
    .limit(40);
  const { data: doneRows } = await supabaseAdmin
    .from("inbox_messages")
    .select("*")
    .in("status", ["sent", "sent_external", "ignored"])
    .order("received_at", { ascending: false })
    .limit(15);
  const rows = [...(openRows ?? []), ...(doneRows ?? [])] as InboxRow[];
  // שם המטפל המזוהה - לתצוגה בלבד.
  const tids = Array.from(new Set(rows.map((r) => r.sender_therapist_id).filter(Boolean))) as string[];
  if (tids.length > 0) {
    const { data: ts } = await supabaseAdmin.from("therapists").select("id, full_name").in("id", tids);
    const names = new Map((ts ?? []).map((t) => [t.id as string, t.full_name as string]));
    for (const r of rows) {
      r.sender_therapist_name = r.sender_therapist_id ? (names.get(r.sender_therapist_id) ?? null) : null;
    }
  }
  return rows;
}

/** ניסוח מחדש לפנייה אחת - לבקשת האדמין, למשל אחרי שהראשונה פספסה. */
export async function regenerateInboxDraft(id: string): Promise<{ ok: boolean; error?: string }> {
  const { data: row } = await supabaseAdmin.from("inbox_messages").select("*").eq("id", id).maybeSingle();
  if (!row) return { ok: false, error: "הפנייה לא נמצאה" };
  if (!["new", "drafted"].includes(row.status as string)) {
    return { ok: false, error: "הפנייה כבר טופלה" };
  }
  const ctx = await senderContext(row.from_email as string);
  const c = await classifyAndDraft(row as InboxRow, ctx);
  if (!c) return { ok: false, error: "הניסוח נכשל - ראו לוג" };
  const { error } = await supabaseAdmin
    .from("inbox_messages")
    .update({
      category: c.category,
      sender_therapist_id: ctx.therapistId,
      status: "drafted",
      draft_subject: c.draft_subject || `Re: ${row.subject ?? ""}`,
      draft_body: c.draft_body,
      draft_generated_at: new Date().toISOString(),
      draft_model: MODEL,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** כמה מהטיוטה שרד בגרסה שנשלחה - מדד למידה, לא מדד דיוק. */
function editRatio(draft: string, finalText: string): number {
  const tokens = (s: string) => new Set(s.split(/\s+/).filter(Boolean));
  const a = tokens(draft);
  const b = tokens(finalText);
  if (a.size === 0 && b.size === 0) return 0;
  let common = 0;
  for (const t of a) if (b.has(t)) common++;
  const union = a.size + b.size - common;
  return union === 0 ? 0 : +(1 - common / union).toFixed(3);
}

/**
 * השליחה עצמה - אך ורק מלחיצת אדמין על פנייה ספציפית, עם הגוף הסופי
 * שנראה על המסך. התשובה יוצאת מ-admin@ באותו שרשור.
 */
export async function sendInboxReply(opts: {
  id: string;
  subject: string;
  body: string;
}): Promise<{ ok: boolean; error?: string; to?: string }> {
  const body = opts.body.trim();
  if (!body) return { ok: false, error: "גוף התשובה ריק" };
  if (body.includes("[להשלים")) {
    return { ok: false, error: "בטיוטה נשאר סימון [להשלים] - יש למלא אותו לפני שליחה" };
  }
  if (!gmailConfigured()) return { ok: false, error: "Gmail לא מוגדר" };
  try {
    const account = await connectedAccount();
    if (account !== EXPECTED_ACCOUNT) {
      return { ok: false, error: `הטוקן שייך ל-${account} ולא ל-${EXPECTED_ACCOUNT} - לא נשלח` };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "בדיקת החשבון נכשלה" };
  }

  const { data: row } = await supabaseAdmin
    .from("inbox_messages")
    .select("*")
    .eq("id", opts.id)
    .maybeSingle();
  if (!row) return { ok: false, error: "הפנייה לא נמצאה" };
  if (!["new", "drafted"].includes(row.status as string)) {
    return { ok: false, error: "הפנייה כבר טופלה - רענן/י את העמוד" };
  }

  let sentId: string;
  try {
    const sent = await sendGmailReply({
      threadId: row.gmail_thread_id as string,
      to: row.from_email as string,
      subject: opts.subject.trim() || `Re: ${row.subject ?? ""}`,
      inReplyTo: row.header_message_id as string | null,
      body,
    });
    sentId = sent.id;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "השליחה נכשלה" };
  }

  // מכאן המייל כבר בחוץ - כשל רישום לא הופך את התוצאה לכישלון.
  const { error: updErr } = await supabaseAdmin
    .from("inbox_messages")
    .update({
      status: "sent",
      final_body: body,
      replied_at: new Date().toISOString(),
      replied_gmail_id: sentId,
      edit_ratio: editRatio(String(row.draft_body ?? ""), body),
      is_exemplar: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", opts.id);
  if (updErr) console.error("inbox reply update failed:", updErr.message);

  const { error: logErr } = await supabaseAdmin.from("crm_email_log").insert({
    recipient: row.from_email,
    recipient_type: "external",
    entity_id: row.sender_therapist_id,
    subject: opts.subject.trim() || `Re: ${row.subject ?? ""}`,
    template: "inbox_reply",
    sent_by: "admin",
    provider: "gmail",
    status: "sent",
  });
  if (logErr) console.error("inbox reply log failed:", logErr.message);

  return { ok: true, to: row.from_email as string };
}

/** סימון ידני: התעלמות (ספאם/לא דורש מענה) או החזרה לתור. */
export async function setInboxStatus(
  id: string,
  status: "ignored" | "new"
): Promise<{ ok: boolean; error?: string }> {
  const { data: row } = await supabaseAdmin
    .from("inbox_messages")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { ok: false, error: "הפנייה לא נמצאה" };
  if (row.status === "sent") return { ok: false, error: "פנייה שנענתה לא משנה סטטוס" };
  const { error } = await supabaseAdmin
    .from("inbox_messages")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}
