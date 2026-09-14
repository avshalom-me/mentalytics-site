import "server-only";
import { startAgentRun, finishAgentRun, createAgentAction, agentEnabled } from "./agent-infra";
import { supabaseAdmin } from "./supabaseAdmin";
import { loadCentersWithReadiness } from "./center-readiness-load";
import { buildCenterNudgeDraft } from "./center-nudge-draft";

// סוכן המרכזים: עובר על כל מרכז פעיל, מזהה מה חסר לו לפי המסלול שרכש,
// ומנסח טיוטת מייל - בדיוק כמו סוכן פערי ההיצע מנסח הצעת קידום למטפל.
//
// הסוכן לא שולח. הוא מכין, ואתה קורא, מתקן ושולח לכל מרכז בנפרד מהאדמין.
// זה מסלול השליחה היחיד: אין קרון ששולח נדנודים, ולא יהיה.
//
// dedupe_key לכל מרכז: כל עוד ההצעה ממתינה היא מתרעננת בכל ריצה (התנהגות
// createAgentAction מ-20/8) - כלומר הטיוטה בתור תמיד משקפת את המצב הנוכחי
// ולא את זה שהיה כשנוצרה.

const SETTLE_DAYS = 7; // שבוע חסד למרכז חדש לפני שמציעים נדנוד
const REPEAT_DAYS = 21; // לא מציעים שוב אם כבר נשלח נדנוד לאחרונה
const NUDGE_TEMPLATE = "center_readiness_nudge";

export type CenterNudgeProposal = {
  centerId: string;
  centerName: string;
  track: string;
  to: string | null;
  subject: string;
  draft: string;
  missing: string[];
  blockedOnUs: string[];
};

export type CenterNudgeRun = {
  ok: boolean;
  checked: number;
  proposals: CenterNudgeProposal[];
  skipped: { center: string; reason: string }[];
  error?: string;
};

export async function runCenterNudgeAgent(): Promise<CenterNudgeRun> {
  const empty: CenterNudgeRun = { ok: true, checked: 0, proposals: [], skipped: [] };
  if (!agentEnabled("center_nudge")) return empty;

  const runId = await startAgentRun("center_nudge", "monitor");
  try {
    const now = Date.now();
    const centers = await loadCentersWithReadiness();
    const proposals: CenterNudgeProposal[] = [];
    const skipped: { center: string; reason: string }[] = [];

    for (const c of centers) {
      const to = c.payerEmail ?? c.email;

      if (c.readiness.missingForCenter.length === 0) {
        skipped.push({ center: c.name, reason: "אין פריט פתוח באחריותם" });
        continue;
      }
      if (!c.paidAt) {
        skipped.push({ center: c.name, reason: "המנוי טרם הופעל" });
        continue;
      }
      if (now - new Date(c.paidAt).getTime() < SETTLE_DAYS * 86_400_000) {
        skipped.push({ center: c.name, reason: "פחות משבוע מתחילת המנוי" });
        continue;
      }
      if (!to) {
        skipped.push({ center: c.name, reason: "אין כתובת מייל למרכז" });
        continue;
      }

      // לא מציעים נדנוד למי שכבר קיבל אחד לאחרונה. הבדיקה כוללת את שם
      // המרכז בנושא, כי שני מרכזים של אותו בעלים חולקים כתובת אחת.
      const since = new Date(now - REPEAT_DAYS * 86_400_000).toISOString();
      const { data: prior } = await supabaseAdmin
        .from("crm_email_log")
        .select("subject")
        .eq("recipient", to)
        .eq("template", NUDGE_TEMPLATE)
        .eq("status", "sent")
        .gte("created_at", since);
      if ((prior ?? []).some((p) => String(p.subject ?? "").includes(c.name.trim()))) {
        skipped.push({ center: c.name, reason: `נשלח נדנוד ב-${REPEAT_DAYS} הימים האחרונים` });
        continue;
      }

      const { subject, body } = buildCenterNudgeDraft({
        centerName: c.name,
        readiness: c.readiness,
        token: c.token,
        hasAccount: c.hasAccount,
      });

      const proposal: CenterNudgeProposal = {
        centerId: c.id,
        centerName: c.name,
        track: c.readiness.trackLabel,
        to,
        subject,
        draft: body,
        missing: c.readiness.missingForCenter.map((i) => i.label),
        blockedOnUs: c.readiness.blockedOnUs.map((i) => i.label),
      };
      proposals.push(proposal);

      await createAgentAction({
        agent: "center_nudge",
        actionType: "center_nudge",
        // פעולה ולא ממצא: יש כאן טיוטה שממתינה להחלטה ולשליחה שלך.
        kind: "action",
        title: `${c.name} - טיוטת נדנוד השלמה`,
        body: c.readiness.headline ?? proposal.missing.slice(0, 3).join(" · "),
        entityType: "center",
        entityId: c.id,
        entityLabel: c.readiness.trackLabel,
        payload: {
          center_id: c.id,
          center_name: c.name,
          track: c.readiness.trackLabel,
          to,
          subject,
          draft: body,
          missing: proposal.missing,
          blocked_on_us: proposal.blockedOnUs,
        },
        dedupeKey: `center_nudge:${c.id}`,
      });
    }

    await finishAgentRun(runId, {
      status: proposals.length > 0 ? "ok" : "empty",
      summary:
        proposals.length > 0
          ? `${proposals.length} טיוטות נדנוד למרכזים: ${proposals.map((p) => p.centerName).join(" · ")}`
          : `אין מה להציע ל-${centers.length} המרכזים הפעילים`,
      details: {
        proposals: proposals.map((p) => ({ center: p.centerName, subject: p.subject })),
        skipped,
      },
    });

    return { ok: true, checked: centers.length, proposals, skipped };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finishAgentRun(runId, { status: "error", error: msg });
    return { ...empty, ok: false, error: msg };
  }
}
