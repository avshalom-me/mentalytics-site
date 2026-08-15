import "server-only";
import OpenAI from "openai";
import { Resend } from "resend";
import { supabaseAdmin } from "./supabaseAdmin";
import { buildDashboardData } from "./work-queue";
import { alertRecipients } from "./alert-recipients";
import { startAgentRun, finishAgentRun } from "./agent-infra";
import { logEmail } from "./email-log";
import { LEAD_TYPES, DEAL_STAGES } from "./crm";

// בקר התפעול היומי (סוכן 1 בתוכנית): אוסף כל בוקר את מה שדורש תשומת לב
// ושולח מייל אחד מרוכז. מקור הנתונים הוא אותו תור עבודה של לוח הבקרה
// (work-queue.ts) + תורי ההצעות, כך שהמייל והמסך לעולם לא סותרים זה את זה.
//
// בטיחות: ברירת המחדל היא תצוגה מקדימה בלבד (אותו דפוס ?send=confirm של
// trial-ending והדוח החודשי). שליחה אמיתית רק כשה-cron נקרא עם send=confirm.

const FROM = "טיפול חכם <noreply@mentalytics.co.il>";
const DIGEST_LLM_MODEL = process.env.AGENT_DIGEST_LLM_MODEL ?? "gpt-4o-mini";
// מעל כמה שורות בסקציה קוטמים (המייל חייב להישאר קריא בדקה).
const MAX_LINES_PER_SECTION = 6;

export type DigestSection = {
  key: string;
  label: string;
  count: number;
  urgent: boolean;
  lines: string[]; // שורות מוכנות להצגה, כבר קטומות
  link: string; // עמוד האדמין הרלוונטי
};

export type DigestResult = {
  ok: boolean;
  mode: "preview" | "send";
  empty: boolean;
  sections: DigestSection[];
  aiSummary: string | null;
  html: string | null;
  recipients: string[];
  emailStatus?: "sent" | "failed" | "skipped";
  error?: string;
};

function labelOfLeadType(value: string | null): string {
  return LEAD_TYPES.find((t) => t.value === value)?.label ?? "כללי";
}

function stageLabel(value: string | null): string {
  return DEAL_STAGES.find((s) => s.value === value)?.label ?? value ?? "";
}

function daysAgo(iso: string | null): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
}

function ageText(iso: string | null): string {
  const d = daysAgo(iso);
  if (d <= 0) return "היום";
  if (d === 1) return "אתמול";
  return `לפני ${d} ימים`;
}

async function gatherSections(): Promise<DigestSection[]> {
  const todayIso = new Date().toISOString().slice(0, 10);

  const [dash, pendingRecsRes, pendingActionsRes, openDealsRes] = await Promise.all([
    buildDashboardData(),
    supabaseAdmin
      .from("marketing_recommendations")
      .select("id, title")
      .eq("status", "pending")
      .order("priority", { ascending: false })
      .limit(MAX_LINES_PER_SECTION + 1),
    supabaseAdmin
      .from("agent_actions")
      .select("id, title, agent")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(MAX_LINES_PER_SECTION + 1),
    supabaseAdmin
      .from("crm_deals")
      .select("id, title, stage, next_step, next_step_due")
      .in("stage", ["inquiry", "meeting", "pilot", "proposal", "contract"]),
  ]);

  const q = dash.queue;
  const sections: DigestSection[] = [];

  // לידים שממתינים בסטטוס "חדשה" - הפער שהמיפוי מצא: אף אחד לא מתריע עליהם.
  if (q.new_leads.length > 0) {
    sections.push({
      key: "leads",
      label: "לידים ממתינים",
      count: dash.kpis.new_leads_count,
      urgent: q.new_leads.some((l) => daysAgo(l.created_at) >= 2),
      lines: q.new_leads
        .slice(0, MAX_LINES_PER_SECTION)
        .map(
          (l) =>
            `${l.name || "ללא שם"} (${labelOfLeadType(l.lead_type)}) · ${ageText(l.created_at)}`
        ),
      link: "/admin/leads",
    });
  }

  // תשלומים שנכשלו בשבוע האחרון - היום זה נראה רק בלוגים או בכניסה לאדמין.
  if (q.failed_payments.length > 0) {
    sections.push({
      key: "failed_payments",
      label: "תשלומים שנכשלו (7 ימים)",
      count: q.failed_payments.length,
      urgent: true,
      lines: q.failed_payments
        .slice(0, MAX_LINES_PER_SECTION)
        .map((p) => `${p.full_name || p.therapist_id} · ₪${p.amount ?? "?"} · ${ageText(p.created_at)}`),
      link: "/admin/therapists",
    });
  }

  // ערבות בסיכון: משלמים בלי אף פנייה שהחלון שלהם נסגר.
  if (q.guarantee_attention.length > 0) {
    sections.push({
      key: "guarantee",
      label: "תקופת ביטחון בסיכון",
      count: q.guarantee_attention_count,
      urgent: q.guarantee_attention.some((g) => g.risk === "expired_no_contact"),
      lines: q.guarantee_attention
        .slice(0, MAX_LINES_PER_SECTION)
        .map((g) =>
          g.risk === "expired_no_contact"
            ? `${g.full_name} · החלון נסגר בלי פניות`
            : `${g.full_name} · ${g.days_left} ימים נותרו · ${g.contacts_in_window} פניות`
        ),
      link: "/admin/guarantee",
    });
  }

  // משימות שהגיע זמנן (כולל באיחור).
  if (q.due_tasks.length > 0) {
    sections.push({
      key: "tasks",
      label: "משימות להיום ובאיחור",
      count: q.due_tasks.length,
      urgent: q.due_tasks.some((t) => (t.due_date ?? "") < todayIso),
      lines: q.due_tasks.slice(0, MAX_LINES_PER_SECTION).map((t) => {
        const overdue = (t.due_date ?? "") < todayIso ? " · באיחור" : "";
        const entity = t.entity_label ? ` (${t.entity_label})` : "";
        return `${t.title}${entity}${overdue}`;
      }),
      link: "/admin/tasks",
    });
  }

  // עסקאות B2B בלי צעד הבא מוגדר או עם צעד באיחור - הדגל שכבר קיים בקנבן.
  const openDeals = openDealsRes.data ?? [];
  const stuckDeals = openDeals.filter(
    (d) => !d.next_step || (d.next_step_due && d.next_step_due < todayIso)
  );
  if (stuckDeals.length > 0) {
    sections.push({
      key: "deals",
      label: "עסקאות שדורשות צעד הבא",
      count: stuckDeals.length,
      urgent: false,
      lines: stuckDeals
        .slice(0, MAX_LINES_PER_SECTION)
        .map((d) =>
          !d.next_step
            ? `${d.title} (${stageLabel(d.stage)}) · אין צעד הבא`
            : `${d.title} (${stageLabel(d.stage)}) · צעד באיחור מ-${d.next_step_due}`
        ),
      link: "/admin/deals",
    });
  }

  // ממתינים לאישור שלך - מטפלים, מאמרים, המלצות והצעות סוכנים.
  const approvalLines: string[] = [];
  if (q.paying_unapproved.length > 0)
    approvalLines.push(
      `${q.paying_unapproved.length} מטפלים משלמים שעדיין לא מוצגים באתר (דחוף): ${q.paying_unapproved
        .slice(0, 3)
        .map((t) => t.full_name || "?")
        .join(", ")}`
    );
  if (q.pending_review_count > 0)
    approvalLines.push(`${q.pending_review_count} פרופילים חדשים ממתינים לבדיקה`);
  if (q.pending_articles_count > 0)
    approvalLines.push(`${q.pending_articles_count} מאמרים ממתינים לאישור`);
  const pendingRecs = pendingRecsRes.data ?? [];
  if (pendingRecs.length > 0)
    approvalLines.push(`${pendingRecs.length} המלצות שיווק ממתינות`);
  const pendingActions = pendingActionsRes.data ?? [];
  if (pendingActions.length > 0)
    approvalLines.push(`${pendingActions.length} הצעות סוכנים ממתינות`);
  if (approvalLines.length > 0) {
    sections.push({
      key: "approvals",
      label: "ממתין לאישור שלך",
      count: approvalLines.length,
      urgent: q.paying_unapproved.length > 0,
      lines: approvalLines,
      link: "/admin/agents",
    });
  }

  return sections;
}

// סיכום קצר של מודל קטן: שלוש שורות "הכי חשוב היום". נכשל בשקט - המייל
// שלם גם בלעדיו.
async function buildAiSummary(sections: DigestSection[]): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const payload = sections.map((s) => ({
      label: s.label,
      count: s.count,
      urgent: s.urgent,
      lines: s.lines,
    }));
    const res = await openai.chat.completions.create(
      {
        model: DIGEST_LLM_MODEL,
        max_tokens: 300,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content:
              "אתה עוזר תפעול של פלטפורמת טיפול חכם. קבל נתוני בוקר וכתוב עד 3 שורות קצרות בעברית: מה הדבר הכי חשוב לטפל בו היום ולמה. עובדתי ותמציתי, בלי פתיחות, בלי סופרלטיבים, בלי להמציא נתונים שלא קיבלת. אסור להשתמש בקו מפריד ארוך; השתמש ב' - ' במקום.",
          },
          { role: "user", content: JSON.stringify(payload) },
        ],
      },
      { timeout: 30_000, maxRetries: 0 }
    );
    const text = res.choices[0]?.message?.content?.trim();
    return text || null;
  } catch (e) {
    console.error("digest AI summary failed:", e);
    return null;
  }
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.mentalytics.co.il";

function buildDigestHtml(sections: DigestSection[], aiSummary: string | null): string {
  const dateStr = new Date().toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Jerusalem",
  });

  const sectionHtml = sections
    .map((s) => {
      const more =
        s.count > s.lines.length
          ? `<div style="font-size:12px;color:#8a8a8a;margin-top:4px">ועוד ${s.count - s.lines.length}...</div>`
          : "";
      const urgentBadge = s.urgent
        ? `<span style="background:#fdecec;color:#b3402e;border-radius:20px;padding:1px 10px;font-size:11px;font-weight:bold;margin-inline-start:8px">דורש טיפול</span>`
        : "";
      return `
      <div style="margin-bottom:20px">
        <div style="font-weight:800;font-size:15px;color:#131F1E;margin-bottom:6px">
          ${s.label} (${s.count})${urgentBadge}
        </div>
        <ul style="margin:0;padding-inline-start:18px;color:#3E5250;font-size:13.5px;line-height:1.7">
          ${s.lines.map((l) => `<li>${l}</li>`).join("")}
        </ul>
        ${more}
        <a href="${SITE}${s.link}" style="font-size:12px;color:#3D8C8A">לטיפול באדמין ←</a>
      </div>`;
    })
    .join("");

  const aiHtml = aiSummary
    ? `<div style="background:#EAF4F3;border-radius:12px;padding:14px 18px;margin-bottom:22px;color:#2A6462;font-size:14px;line-height:1.7;white-space:pre-line">${aiSummary}</div>`
    : "";

  return `
  <div dir="rtl" style="font-family:'Heebo','Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#131F1E">
    <div style="font-size:20px;font-weight:900;margin-bottom:2px">דוח בוקר · טיפול חכם</div>
    <div style="font-size:13px;color:#6B807E;margin-bottom:18px">${dateStr}</div>
    ${aiHtml}
    ${sectionHtml}
    <div style="border-top:1px solid #DDE9E8;margin-top:24px;padding-top:12px;font-size:11.5px;color:#A2B5B4">
      נשלח אוטומטית על ידי בקר התפעול · <a href="${SITE}/admin/agents" style="color:#3D8C8A">עמוד הסוכנים</a>
    </div>
  </div>`;
}

export async function runDailyDigest(opts: { send: boolean }): Promise<DigestResult> {
  const mode = opts.send ? "send" : "preview";
  const runId = await startAgentRun("daily_digest", mode);
  const recipients = alertRecipients();

  try {
    const sections = await gatherSections();

    // אין מה לדווח - אין מייל (עיקרון "אין חדש, לא נשלח").
    if (sections.length === 0) {
      await finishAgentRun(runId, {
        status: "empty",
        summary: "אין פריטים שדורשים תשומת לב - לא נשלח מייל",
      });
      return {
        ok: true,
        mode,
        empty: true,
        sections: [],
        aiSummary: null,
        html: null,
        recipients,
        emailStatus: "skipped",
      };
    }

    const aiSummary = await buildAiSummary(sections);
    const html = buildDigestHtml(sections, aiSummary);
    const totalItems = sections.reduce((sum, s) => sum + s.count, 0);
    const subject = `דוח בוקר · ${totalItems} פריטים ממתינים`;

    let emailStatus: "sent" | "failed" | "skipped" = "skipped";
    let sendError = "";

    if (opts.send) {
      if (!process.env.RESEND_API_KEY) {
        emailStatus = "failed";
        sendError = "RESEND_API_KEY unset";
      } else {
        try {
          const resend = new Resend(process.env.RESEND_API_KEY);
          const { error } = await resend.emails.send({
            from: FROM,
            to: recipients,
            subject,
            html,
          });
          if (error) {
            emailStatus = "failed";
            sendError = error.message;
          } else {
            emailStatus = "sent";
          }
        } catch (e) {
          emailStatus = "failed";
          sendError = e instanceof Error ? e.message : String(e);
        }
        void logEmail({
          recipient: recipients.join(","),
          recipientType: "other",
          subject,
          template: "agent_daily_digest",
          sentBy: "cron",
          status: emailStatus === "sent" ? "sent" : "failed",
          error: sendError || undefined,
        });
      }
    }

    await finishAgentRun(runId, {
      status: "ok",
      summary:
        mode === "send"
          ? `נשלח דוח עם ${sections.length} סקציות (${totalItems} פריטים) · מייל: ${emailStatus}`
          : `תצוגה מקדימה: ${sections.length} סקציות (${totalItems} פריטים)`,
      details: {
        mode,
        sections: sections.map((s) => ({ key: s.key, count: s.count })),
        email_status: emailStatus,
        ai_summary_included: aiSummary !== null,
      },
      error: sendError || undefined,
    });

    return {
      ok: true,
      mode,
      empty: false,
      sections,
      aiSummary,
      html,
      recipients,
      emailStatus,
      error: sendError || undefined,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finishAgentRun(runId, { status: "error", error: msg });
    return {
      ok: false,
      mode,
      empty: false,
      sections: [],
      aiSummary: null,
      html: null,
      recipients,
      error: msg,
    };
  }
}
