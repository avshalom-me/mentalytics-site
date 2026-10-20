import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import { fetchAllRows } from "./fetch-all-rows";
import { applyMatchPause } from "./match-pause-apply";
import { loadConcentrationInput } from "./contact-concentration-data";
import { analyzeConcentration, FREEZE_DAYS, HOT_MIN_PEOPLE, CONCENTRATION_WINDOW_DAYS, type ConcTherapist } from "./contact-concentration";

// כפתור "הקפא/י שבוע" ברשימת ריכוז הפניות. הרשימה בעמוד הסוכנים היא תמונה
// מהריצה האחרונה, שיכולה להיות בת שבוע: מאז אפשר שהמטפל/ת כבר הוקפא/ה, שחלופות
// באזור ירדו מתחת לרצפה, או שהעומס עבר. לכן לפני ההקפאה הבדיקה כולה רצה מחדש
// על הנתונים של עכשיו, וההקפאה עצמה עוברת דרך applyMatchPause עם כל ההגנות
// שלה (מסלול, חלון ערבות) - אותה פעולה בדיוק כמו בעמוד המטפלים.

export async function freezeForConcentration(
  therapistId: string
): Promise<{ ok: true; until: string | null } | { ok: false; error: string; status: number }> {
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

  const result = analyzeConcentration({ contacts: input.contacts, therapists, lastPausedAt: input.lastPausedAt });
  const candidate = result.freeze.find((f) => f.id === therapistId);
  if (!candidate) {
    return {
      ok: false,
      status: 409,
      error: `לא הוקפא/ה: לא קיבל/ה ${HOT_MIN_PEOPLE} פונים ומעלה ב-${CONCENTRATION_WINDOW_DAYS} הימים האחרונים, ואין סיבה להקפיא.`,
    };
  }
  if (!candidate.safe) {
    return { ok: false, status: 409, error: `לא הוקפא/ה: ${candidate.blockedReason}` };
  }

  const paused = await applyMatchPause({
    therapistId,
    days: FREEZE_DAYS,
    reason: "ריכוז פניות",
    auditReason: `admin paused from matching for ${FREEZE_DAYS}d: contact concentration (${candidate.people} people in ${CONCENTRATION_WINDOW_DAYS}d, ${candidate.weakest?.alternatives ?? "?"} alternatives), re-checked at click`,
  });
  if (!paused.ok) return paused;
  return { ok: true, until: paused.until };
}
