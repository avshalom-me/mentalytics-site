// ניסיונות העלאת תעודה שנכשלו אצל המטפל/ת, כפי שהדפדפן מדווח עליהם
// (/api/therapist-cert, action "report_failure" → therapist_audit_log).
//
// למה זה קיים: עד 29/9/2026 כישלון העלאה היה בלתי נראה לגמרי. מטפלת ניסתה
// להעלות תעודה שש פעמים בשלושה ימים, הקובץ לא יצא מהטלפון שלה אף פעם,
// ובאדמין הופיע רק "עדכנה" בירוק - כאילו השלימה. השרת ראה רק את הכנת
// ההעלאה, לא את הכישלון עצמו.
//
// הקובץ טהור (בלי מסד), כדי שגם ה-API וגם הבדיקות ישתמשו בו.

export const CERT_UPLOAD_FAILED_ACTION = "cert_upload_failed";

/** השלבים שהדפדפן מדווח עליהם - הערך נשמר, התווית מוצגת באדמין. */
export const CERT_FAILURE_STAGES = {
  read: "קריאת הקובץ מהמכשיר",
  sign: "הכנת ההעלאה",
  upload: "העלאה ישירה",
  fallback: "העלאה דרך השרת",
  commit: "שמירת התעודה",
} as const;
export type CertFailureStage = keyof typeof CERT_FAILURE_STAGES;

export function isCertFailureStage(v: unknown): v is CertFailureStage {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(CERT_FAILURE_STAGES, v);
}

export type CertFailureRow = {
  therapist_id: string;
  created_at: string;
  after_state: unknown;
};

export type CertUploadFailureSummary = {
  count: number;
  last_at: string;
  /** "העלאה ישירה: Failed to fetch" - לתצוגה בכרטיס באדמין. */
  last_error: string | null;
};

function describe(after: unknown): string | null {
  if (!after || typeof after !== "object") return null;
  const a = after as { stage?: unknown; message?: unknown };
  const stage = isCertFailureStage(a.stage) ? CERT_FAILURE_STAGES[a.stage] : null;
  const message = typeof a.message === "string" && a.message.trim() ? a.message.trim().slice(0, 120) : null;
  if (stage && message) return `${stage}: ${message}`;
  return stage ?? message;
}

/**
 * לכל מטפל/ת: כמה ניסיונות נכשלו מאז התעודה האחרונה שנשמרה (או מאז ומעולם,
 * אם אין תעודה). כישלון שאחריו תעודה כבר נשמרה - הבעיה נפתרה, ולא מוצג.
 */
export function summarizeCertUploadFailures(
  failures: CertFailureRow[],
  latestCertAt: Record<string, string>,
): Record<string, CertUploadFailureSummary> {
  const out: Record<string, CertUploadFailureSummary> = {};
  for (const f of failures) {
    const certAt = latestCertAt[f.therapist_id];
    if (certAt && Date.parse(certAt) >= Date.parse(f.created_at)) continue;
    const cur = out[f.therapist_id];
    if (!cur) {
      out[f.therapist_id] = { count: 1, last_at: f.created_at, last_error: describe(f.after_state) };
    } else {
      cur.count += 1;
      if (Date.parse(f.created_at) > Date.parse(cur.last_at)) {
        cur.last_at = f.created_at;
        cur.last_error = describe(f.after_state);
      }
    }
  }
  return out;
}
