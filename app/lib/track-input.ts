// גבולות על מה ש-/api/track מוכן לכתוב ל-analytics_events.
//
// הנתיב ציבורי בכוונה (כל דפדפן שולח אליו), ועד 19/10/2026 הוא קיבל כל אובייקט
// כ-metadata וכל מחרוזת כ-source, בלי תקרה. מדידה ב-30 הימים שלפני: ה-metadata
// הגדול ביותר 468 תווים (אחוזון 99: 224), ה-source הארוך ביותר 23. התקרות כאן
// רחוקות מזה פי כמה, כך ששום אירוע אמיתי לא נדחה, וגוף של מגה-בייט כבר לא
// נכנס לטבלה שכל דשבורד וסוכן קוראים ממנה.

export const TRACK_METADATA_MAX_CHARS = 2_000;
export const TRACK_SOURCE_MAX_CHARS = 64;
export const TRACK_SESSION_MAX_CHARS = 128;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type TrackFields = {
  source: string | null;
  therapist_id: string | null;
  session_id: string | null;
  metadata: Record<string, unknown>;
};

/**
 * מנרמל את שדות הבקשה. null = הבקשה נדחית (400): metadata גדול מהתקרה.
 * שדה לא תקין אחר (source ארוך, therapist_id שאינו UUID) נזרק בשקט, כמו קודם,
 * כי האירוע עצמו עדיין נכון.
 */
export function normalizeTrackFields(body: Record<string, unknown>): TrackFields | null {
  const { source, therapist_id, session_id, metadata } = body;

  let safeMetadata: Record<string, unknown> = {};
  if (typeof metadata === "object" && metadata !== null && !Array.isArray(metadata)) {
    if (JSON.stringify(metadata).length > TRACK_METADATA_MAX_CHARS) return null;
    safeMetadata = metadata as Record<string, unknown>;
  }

  return {
    source: typeof source === "string" && source.length > 0 && source.length <= TRACK_SOURCE_MAX_CHARS ? source : null,
    therapist_id: typeof therapist_id === "string" && UUID_RE.test(therapist_id) ? therapist_id : null,
    session_id:
      typeof session_id === "string" && session_id.length > 0 && session_id.length <= TRACK_SESSION_MAX_CHARS
        ? session_id
        : null,
    metadata: safeMetadata,
  };
}
