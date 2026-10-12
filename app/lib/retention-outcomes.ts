// "מה קרה למה שעשינו": לכל פעולה שבוצעה מסקירת השימור - כמה אנשים פנו
// למטפל/ת ב-14 הימים שלפניה, וב-14 וב-28 הימים שאחריה. טהור, כדי שהחישוב
// ייבדק; הטעינה ב-retention-review-data.ts. אחרי 2-3 חודשים זה מה שאומר
// אילו התערבויות עובדות (ואילו לא), ומה להפסיק להמליץ.

export type ExecutedAction = {
  id: string;
  action_type: string;
  therapist_id: string;
  entity_label: string | null;
  executed_at: string;
  resolution_note: string | null;
};

export type ContactEvent = { therapist_id: string; sid: string; at: string };

export type TherapistState = {
  status: string | null;
  promotion_source: string | null;
  profile_updated_at: string | null;
};

export type ActionOutcome = {
  action_id: string;
  action_type: string;
  therapist_id: string;
  name: string;
  executed_at: string;
  days_since: number;
  /** אנשים שונים ב-14 הימים שלפני הפעולה. */
  before14: number;
  /** אנשים ב-14 הימים שאחרי; null כשעוד לא עברו 14 יום. */
  after14: number | null;
  /** אנשים ב-28 הימים שאחרי; null כשעוד לא עברו 28 יום. */
  after28: number | null;
  /** המטפל/ת ערך/ה את הפרופיל אחרי הפעולה. */
  profile_edited: boolean;
  /** עדיין מקודם/ת (לא ביטל/ה ולא ירד/ה). */
  still_promoted: boolean;
  verdict: "recovered" | "edited" | "no_change" | "left" | "too_early";
};

const DAY = 86_400_000;

function peopleBetween(events: ContactEvent[], fromMs: number, toMs: number): number {
  const seen = new Set<string>();
  for (const e of events) {
    const t = new Date(e.at).getTime();
    if (t >= fromMs && t < toMs) seen.add(e.sid);
  }
  return seen.size;
}

export function computeOutcomes(
  actions: ExecutedAction[],
  contacts: ContactEvent[],
  states: Map<string, TherapistState>,
  now: Date,
): ActionOutcome[] {
  const byTherapist = new Map<string, ContactEvent[]>();
  for (const c of contacts) byTherapist.set(c.therapist_id, [...(byTherapist.get(c.therapist_id) ?? []), c]);
  const nowMs = now.getTime();

  return actions.map((a) => {
    const at = new Date(a.executed_at).getTime();
    const events = byTherapist.get(a.therapist_id) ?? [];
    const daysSince = Math.floor((nowMs - at) / DAY);
    const before14 = peopleBetween(events, at - 14 * DAY, at);
    const after14 = daysSince >= 14 ? peopleBetween(events, at, at + 14 * DAY) : null;
    const after28 = daysSince >= 28 ? peopleBetween(events, at, at + 28 * DAY) : null;
    const state = states.get(a.therapist_id);
    const stillPromoted = state?.status === "paying";
    const profileEdited = !!state?.profile_updated_at && new Date(state.profile_updated_at).getTime() > at;

    let verdict: ActionOutcome["verdict"];
    if (!stillPromoted) verdict = "left";
    else if (after14 == null) verdict = "too_early";
    else if (after14 > before14 || (after14 > 0 && before14 === 0)) verdict = "recovered";
    else if (profileEdited) verdict = "edited";
    else verdict = "no_change";

    return {
      action_id: a.id,
      action_type: a.action_type,
      therapist_id: a.therapist_id,
      name: a.entity_label ?? "",
      executed_at: a.executed_at,
      days_since: daysSince,
      before14,
      after14,
      after28,
      profile_edited: profileEdited,
      still_promoted: stillPromoted,
      verdict,
    };
  });
}

export const OUTCOME_LABELS: Record<ActionOutcome["verdict"], string> = {
  recovered: "חזרו פניות",
  edited: "ערך/ה פרופיל",
  no_change: "בלי שינוי",
  left: "עזב/ה",
  too_early: "מוקדם מדי",
};

/** סיכום לכל סוג פעולה: כמה בוצעו, כמה התאוששו מבין אלה שכבר אפשר למדוד. */
export function summarizeOutcomes(rows: ActionOutcome[]): { action_type: string; total: number; measured: number; recovered: number; edited: number; left: number }[] {
  const by = new Map<string, { action_type: string; total: number; measured: number; recovered: number; edited: number; left: number }>();
  for (const r of rows) {
    const s = by.get(r.action_type) ?? { action_type: r.action_type, total: 0, measured: 0, recovered: 0, edited: 0, left: 0 };
    s.total++;
    if (r.verdict !== "too_early") s.measured++;
    if (r.verdict === "recovered") s.recovered++;
    if (r.verdict === "edited") s.edited++;
    if (r.verdict === "left") s.left++;
    by.set(r.action_type, s);
  }
  return [...by.values()].sort((a, b) => b.total - a.total);
}
