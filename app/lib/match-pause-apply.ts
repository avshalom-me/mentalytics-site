import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import { writeAudit } from "./audit";
import { guaranteeStateFor } from "./guarantee";
import { guaranteePauseBlock, pauseSourceBlock, type GuaranteeState } from "./match-pause";

// ההקפאה השקטה עצמה, במקום אחד: הכפתורים בעמוד המטפלים והפעולה מסקירת
// השימור קוראים לאותה פונקציה, כדי שההגנות (מסלול, חלון ערבות) לא ייפרדו.
// days=0 משחרר, ומותר תמיד. הכללים ב-match-pause.ts.

export type MatchPauseResult =
  | { ok: true; until: string | null; before: string | null }
  | { ok: false; error: string; status: number };

export async function applyMatchPause(opts: {
  therapistId: string;
  days: number;
  reason: string | null;
  /** מה נכתב ביומן הביקורת כסיבה - מי הקפיא ומאיפה. */
  auditReason?: string;
}): Promise<MatchPauseResult> {
  const days = Number.isFinite(opts.days) ? Math.max(0, Math.min(90, Math.floor(opts.days))) : 0;
  const until = days > 0 ? new Date(Date.now() + days * 86_400_000).toISOString() : null;
  const reason = opts.reason ? opts.reason.trim().slice(0, 200) : null;

  const { data: before, error: beforeErr } = await supabaseAdmin
    .from("therapists")
    .select("match_paused_until, status, promotion_source")
    .eq("id", opts.therapistId)
    .maybeSingle();
  if (beforeErr) return { ok: false, error: beforeErr.message, status: 500 };
  if (!before) return { ok: false, error: "מטפל/ת לא נמצא/ה", status: 404 };

  // שחרור מותר תמיד; את ההקפאה בודקים - קודם המסלול, ואז (למשלם/ת
  // פרטי/ת) חלון ערבות הפניות. כשאי אפשר לבדוק את החלון - לא מקפיאים.
  if (until) {
    const sourceBlock = pauseSourceBlock(before);
    if (sourceBlock) return { ok: false, error: sourceBlock, status: 409 };
    if (before.promotion_source === "paid") {
      let guarantee: GuaranteeState | null;
      try {
        guarantee = await guaranteeStateFor(opts.therapistId);
      } catch (e) {
        console.error("applyMatchPause: guarantee check failed:", e instanceof Error ? e.message : e);
        return { ok: false, error: "לא הצלחנו לבדוק את חלון ערבות הפניות, ולכן לא הקפאנו. נסו שוב בעוד רגע.", status: 503 };
      }
      const guaranteeBlock = guaranteePauseBlock(guarantee);
      if (guaranteeBlock) return { ok: false, error: guaranteeBlock, status: 409 };
    }
  }

  const { error } = await supabaseAdmin
    .from("therapists")
    .update({ match_paused_until: until, match_paused_reason: until ? reason : null })
    .eq("id", opts.therapistId);
  if (error) return { ok: false, error: error.message, status: 500 };

  await writeAudit(supabaseAdmin, {
    therapistId: opts.therapistId,
    actorType: "admin",
    action: "set_match_pause",
    before: { match_paused_until: before.match_paused_until ?? null, promotion_source: before.promotion_source },
    after: { match_paused_until: until },
    reason:
      opts.auditReason ??
      (until ? `admin paused from matching for ${days}d${reason ? `: ${reason}` : ""}` : "admin resumed matching"),
  });
  return { ok: true, until, before: before.match_paused_until ?? null };
}
