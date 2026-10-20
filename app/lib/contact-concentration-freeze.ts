import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import { fetchAllRows } from "./fetch-all-rows";
import { applyMatchPause } from "./match-pause-apply";
import { guaranteeStateFor } from "./guarantee";
import { loadConcentrationInput } from "./contact-concentration-data";
import {
  analyzeConcentration,
  FREEZE_DAYS,
  HOT_MIN_PEOPLE,
  CONCENTRATION_WINDOW_DAYS,
  type ConcTherapist,
  type FreezeCandidate,
} from "./contact-concentration";

// ההקפאה השקטה מריכוז הפניות (הבעלים, 20/10/26): "חצי-אוטומטית" - בדיקה פעם
// בשבועיים שמעלה הצעה לתור, וההקפאה עצמה רק בלחיצה. "בזהירות ובבדיקות כפולות
// כי זה עניין רגיש", ולכן כל הכללים נבדקים פעמיים:
//   1. כשההצעה עולה לתור (supply-gaps.ts) - הניתוח הטהור + הבדיקות שכאן.
//   2. ברגע הלחיצה (freezeForConcentration) - שוב הכול, על הנתונים של עכשיו,
//      ואז applyMatchPause עם ההגנות שלו (מסלול, חלון ערבות).
// ההקפאה לא שולחת שום מייל ולא משנה שום דגל ציבורי (ראו match-pause.ts).

export const FREEZE_ACTION_TYPE = "concentration_freeze";

/** בדיקות שדורשות מסד ולכן לא יושבות במודול הטהור: למשלם/ת - חלון ערבות
 *  הפניות סגור. כשאי אפשר לבדוק, לא מקפיאים. */
export async function serverFreezeChecks(freeze: FreezeCandidate[]): Promise<FreezeCandidate[]> {
  return Promise.all(
    freeze.map(async (f) => {
      if (!f.safe || f.promotionSource !== "paid") return f;
      try {
        const g = await guaranteeStateFor(f.id);
        if (g?.open) {
          const until = new Date(g.windowEnd).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" });
          return { ...f, safe: false, blockedReason: `בתוך חלון ערבות הפניות (עד ${until}); עד אז לא מקפיאים.` };
        }
        return f;
      } catch (e) {
        console.error("serverFreezeChecks: guarantee check failed:", e instanceof Error ? e.message : e);
        return { ...f, safe: false, blockedReason: "לא הצלחנו לבדוק את חלון ערבות הפניות, ולכן לא מקפיאים." };
      }
    })
  );
}

/** הניתוח המלא על הנתונים של עכשיו - לבדיקה ברגע הלחיצה. */
async function currentFreezeCandidates(): Promise<FreezeCandidate[]> {
  const [therapists, input] = await Promise.all([
    fetchAllRows<ConcTherapist>(() =>
      supabaseAdmin
        .from("therapists")
        .select(
          "id, full_name, status, promotion_source, entity_type, regions, online, training_areas, age_groups, admin_approved, accepting_new_patients, match_paused_until, promoted_since"
        )
        .eq("status", "paying")
    ),
    loadConcentrationInput(),
  ]);
  const result = analyzeConcentration({
    contacts: input.contacts,
    therapists,
    lastPausedAt: input.lastPausedAt,
    paidSince: input.paidSince,
  });
  return serverFreezeChecks(result.freeze);
}

export async function freezeForConcentration(opts: {
  therapistId: string;
  /** ההצעה בתור שממנה הגיעה הלחיצה. */
  actionId: string;
}): Promise<{ ok: true; until: string | null } | { ok: false; error: string; status: number }> {
  // הלחיצה חייבת להגיע מהצעה ממתינה של אותו מטפל/ת - לא מכפתור ישן, לא
  // מהצעה שכבר בוצעה, ולא עם מזהה מטפל אחר.
  const { data: action, error: actionErr } = await supabaseAdmin
    .from("agent_actions")
    .select("id, action_type, status, entity_id")
    .eq("id", opts.actionId)
    .maybeSingle();
  if (actionErr) return { ok: false, status: 500, error: actionErr.message };
  if (!action || action.action_type !== FREEZE_ACTION_TYPE) return { ok: false, status: 404, error: "ההצעה לא נמצאה" };
  if (action.status !== "pending") return { ok: false, status: 409, error: "ההצעה כבר טופלה - רענן/י את העמוד" };
  if (action.entity_id !== opts.therapistId) return { ok: false, status: 409, error: "ההצעה שייכת למטפל/ת אחר/ת" };

  const candidate = (await currentFreezeCandidates()).find((f) => f.id === opts.therapistId);
  if (!candidate) {
    return {
      ok: false,
      status: 409,
      error: `לא הוקפא/ה: כבר לא ${HOT_MIN_PEOPLE} פונים ומעלה ב-${CONCENTRATION_WINDOW_DAYS} הימים האחרונים, ואין סיבה להקפיא.`,
    };
  }
  if (!candidate.safe) return { ok: false, status: 409, error: `לא הוקפא/ה: ${candidate.blockedReason}` };

  const paused = await applyMatchPause({
    therapistId: opts.therapistId,
    days: FREEZE_DAYS,
    reason: "ריכוז פניות",
    auditReason:
      `admin paused from matching for ${FREEZE_DAYS}d: contact concentration ` +
      `(${candidate.people} people in ${CONCENTRATION_WINDOW_DAYS}d, ${candidate.matchPeople} from the quiz, ` +
      `${candidate.weakest?.alternatives ?? "?"} alternatives), re-checked at click`,
  });
  if (!paused.ok) return paused;

  const until = paused.until
    ? new Date(paused.until).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" })
    : "";
  const { error: updErr } = await supabaseAdmin
    .from("agent_actions")
    .update({
      status: "executed",
      status_changed_at: new Date().toISOString(),
      resolved_by: "admin",
      resolution_note: `❄️ ${candidate.name} הוקפא/ה מתוצאות השאלון עד ${until}, בלי מייל`,
    })
    .eq("id", opts.actionId)
    .eq("status", "pending");
  // ההקפאה כבר בוצעה; כישלון כאן רק משאיר את ההצעה פתוחה, ולחיצה שנייה
  // תיעצר בבדיקה ("כבר מוקפא/ת").
  if (updErr) console.error("freezeForConcentration: action update failed:", updErr.message);
  return { ok: true, until: paused.until };
}
