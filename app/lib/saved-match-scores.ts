// אחוזי ההתאמה ברשימה שמורה (/match/<token>): מה שמסך התוצאות הראה, בלי
// הסבר ה-AI. החלטת הפרטיות במיגרציה 20260918_match_token_scores.sql -
// מספרים ודגלים בלבד, אף פעם לא match_reasons.
//
// אותו מודול משמש את שלושת הצדדים: הכפתור בונה, ה-API מנקה ושומר, ועמוד
// הרשימה מנקה שוב וקורא. הניקוי מעתיק רק שדות מוכרים, כך ששדה נוסף שיגיע
// מהדפדפן (למשל הנימוקים, שנמצאים על אותו אובייקט התאמה) לא יכול להישמר.

export type SavedScore = {
  match_score: number | null;
  personality_score: number | null;
  combined_score: number | null;
  in_requested_area: boolean;
};

export type SavedMatchScores = {
  /** המטופל בחר עיר או אזור. בלי זה אין קבוצות, וכל הכרטיסים מקבלים אחוז. */
  location_asked: boolean;
  /** סומן "גם אונליין" - קובע אם כרטיס מחוץ לאזור מסומן "אונליין" או "אזור סמוך". */
  online_requested: boolean;
  /** רשימת מאבחנים (שאלון הילדים) - משנה רק את שם המקצוע בכותרות. */
  assessment: boolean;
  by_id: Record<string, SavedScore>;
};

/** אובייקט התאמה כפי ש-/api/match מחזיר אותו - רק השדות שנשמרים. */
export type MatchScoreSource = {
  id: string;
  match_score?: number | null;
  personality_score?: number | null;
  combined_score?: number | null;
  in_requested_area?: boolean | null;
};

function pct(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const r = Math.round(v);
  return r >= 0 && r <= 100 ? r : null;
}

function cleanScore(v: unknown): SavedScore | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const s = v as Record<string, unknown>;
  return {
    match_score: pct(s.match_score),
    personality_score: pct(s.personality_score),
    combined_score: pct(s.combined_score),
    in_requested_area: s.in_requested_area === true,
  };
}

/** בצד הדפדפן: מה שנשלח עם יצירת הטוקן. */
export function buildSavedMatchScores(
  matches: readonly MatchScoreSource[],
  opts: { locationAsked: boolean; onlineRequested: boolean; assessment?: boolean },
): SavedMatchScores {
  const by_id: Record<string, SavedScore> = {};
  for (const m of matches) {
    const s = cleanScore(m);
    if (s) by_id[m.id] = s;
  }
  return {
    location_asked: opts.locationAsked,
    online_requested: opts.onlineRequested,
    assessment: opts.assessment === true,
    by_id,
  };
}

/**
 * מנקה קלט (מהדפדפן בשמירה, או מהמסד בקריאה) לצורה המותרת. רק מטפלים
 * שברשימה עצמה נשמרים. null כשאין אף ציון - אז העמוד מציג רשימה בלי אחוזים.
 */
export function parseSavedMatchScores(raw: unknown, listIds: readonly string[]): SavedMatchScores | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const src = r.by_id;
  if (!src || typeof src !== "object" || Array.isArray(src)) return null;
  const allowed = new Set(listIds);
  const by_id: Record<string, SavedScore> = {};
  for (const [id, v] of Object.entries(src as Record<string, unknown>)) {
    if (!allowed.has(id)) continue;
    const s = cleanScore(v);
    if (s) by_id[id] = s;
  }
  if (Object.keys(by_id).length === 0) return null;
  return {
    location_asked: r.location_asked === true,
    online_requested: r.online_requested === true,
    assessment: r.assessment === true,
    by_id,
  };
}

export type SavedRow<T> = {
  t: T;
  score: SavedScore | null;
  /** בקבוצת "מחוץ לאזור שבחרת": מילים במקום אחוז, כמו במסך התוצאות. */
  away: boolean;
};

/**
 * הסדר של מסך התוצאות: קודם מי שבאזור שהתבקש, אחריהם השאר, ובתוך כל קבוצה
 * הסדר שנשמר (הדירוג המקורי). בלי מיקום מבוקש, או בטוקן ישן בלי ציונים,
 * אין קבוצות והרשימה נשארת כפי שנשמרה.
 */
export function savedDisplayRows<T extends { id: string }>(
  list: readonly T[],
  scores: SavedMatchScores | null,
): { rows: SavedRow<T>[]; localCount: number } {
  const scoreOf = (t: T) => scores?.by_id[t.id] ?? null;
  if (!scores?.location_asked) {
    return { rows: list.map((t) => ({ t, score: scoreOf(t), away: false })), localCount: list.length };
  }
  const local = list.filter((t) => scoreOf(t)?.in_requested_area === true);
  const away = list.filter((t) => scoreOf(t)?.in_requested_area !== true);
  return {
    rows: [
      ...local.map((t) => ({ t, score: scoreOf(t), away: false })),
      ...away.map((t) => ({ t, score: scoreOf(t), away: true })),
    ],
    localCount: local.length,
  };
}
