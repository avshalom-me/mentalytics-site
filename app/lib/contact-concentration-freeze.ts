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
  FREEZE_ACTION_TYPE,
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

export { FREEZE_ACTION_TYPE };

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
          "id, full_name, status, promotion_source, entity_type, regions, online, training_areas, assessment_types, couples_modalities, age_groups, admin_approved, accepting_new_patients, match_paused_until, promoted_since"
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

  // תפיסה אטומית של ההצעה לפני כל דבר אחר: pending → approved רק אם היא עוד
  // pending. שתי לחיצות בו-זמנית (שתי לשוניות, ניסיון חוזר אחרי timeout) -
  // רק אחת תופסת, והשנייה נעצרת כאן ולא מקפיאה פעם שנייה.
  const nowIso = () => new Date().toISOString();
  const { data: claimed, error: claimErr } = await supabaseAdmin
    .from("agent_actions")
    .update({ status: "approved", status_changed_at: nowIso(), resolved_by: "admin", resolution_note: "בבדיקה לפני הקפאה" })
    .eq("id", opts.actionId)
    .eq("status", "pending")
    .select("id");
  if (claimErr) return { ok: false, status: 500, error: claimErr.message };
  if (!claimed || claimed.length === 0) return { ok: false, status: 409, error: "ההצעה כבר בטיפול - רענן/י את העמוד" };

  // מכאן כל יציאה בלי הקפאה מחזירה או סוגרת את ההצעה. כשל טכני - חזרה
  // לתור, כדי שאפשר יהיה לנסות שוב. כלל שכבר לא מתקיים - סגירה עם הסיבה,
  // כי לחיצה נוספת תיעצר באותו מקום.
  const release = async (outcome: "retry" | "close", note: string) => {
    const { error } = await supabaseAdmin
      .from("agent_actions")
      .update(
        outcome === "retry"
          ? { status: "pending", status_changed_at: nowIso(), resolved_by: null, resolution_note: null }
          : { status: "dismissed", status_changed_at: nowIso(), resolved_by: "system", resolution_note: note }
      )
      .eq("id", opts.actionId)
      .eq("status", "approved");
    if (error) console.error("freezeForConcentration: release failed:", error.message);
  };

  let candidates: FreezeCandidate[];
  try {
    candidates = await currentFreezeCandidates();
  } catch (e) {
    await release("retry", "");
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, status: 503, error: `הבדיקה לפני ההקפאה נכשלה, ולכן לא הוקפא/ה. נסו שוב בעוד רגע. (${msg})` };
  }
  const candidate = candidates.find((f) => f.id === opts.therapistId);
  if (!candidate) {
    const error = `לא הוקפא/ה: כבר לא ${HOT_MIN_PEOPLE} פונים ומעלה ב-${CONCENTRATION_WINDOW_DAYS} הימים האחרונים, ואין סיבה להקפיא.`;
    await release("close", error);
    return { ok: false, status: 409, error };
  }
  if (!candidate.safe) {
    const error = `לא הוקפא/ה: ${candidate.blockedReason}`;
    await release("close", error);
    return { ok: false, status: 409, error };
  }

  const paused = await applyMatchPause({
    therapistId: opts.therapistId,
    days: FREEZE_DAYS,
    reason: "ריכוז פניות",
    auditReason:
      `admin paused from matching for ${FREEZE_DAYS}d: contact concentration ` +
      `(${candidate.people} people in ${CONCENTRATION_WINDOW_DAYS}d, ${candidate.matchPeople} from the quiz, ` +
      `${candidate.weakest?.alternatives ?? "?"} alternatives), re-checked at click`,
  });
  if (!paused.ok) {
    // applyMatchPause מסרב גם מסיבה של כלל (מסלול, ערבות) וגם מתקלה; בכל מקרה
    // לא הוקפא/ה, וההצעה חוזרת לתור עם ההודעה למטה.
    await release(paused.status >= 500 ? "retry" : "close", `לא הוקפא/ה: ${paused.error}`);
    return paused;
  }

  const until = paused.until
    ? new Date(paused.until).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" })
    : "";
  const { error: updErr } = await supabaseAdmin
    .from("agent_actions")
    .update({
      status: "executed",
      status_changed_at: nowIso(),
      resolved_by: "admin",
      resolution_note: `❄️ ${candidate.name} הוקפא/ה מתוצאות השאלון עד ${until}, בלי מייל`,
    })
    .eq("id", opts.actionId)
    .eq("status", "approved");
  // ההקפאה כבר בוצעה; כישלון כאן משאיר את ההצעה ב-approved (לא חוזרת לתור),
  // והצינון של 28 יום נשען גם על יומן הביקורת וגם על תאריך ההקפאה עצמו.
  if (updErr) console.error("freezeForConcentration: action update failed:", updErr.message);
  return { ok: true, until: paused.until };
}
