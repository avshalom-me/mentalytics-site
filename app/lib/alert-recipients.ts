import "server-only";

// נמעני ההתראות התפעוליות - פירסור אחד של WEEKLY_REPORT_TO במקום העותקים
// הפזורים (weekly-report, sumit-status-sync, trial-ending ועוד מפרסרים כל
// אחד לבד, עם ברירות מחדל שונות). קוד חדש משתמש כאן; הקיים יאומץ בהדרגה.
const DEFAULT_RECIPIENTS = [
  "admin@getmentalytics.com",
  "avshalom@getmentalytics.com",
  "omer@getmentalytics.com",
];

export function alertRecipients(): string[] {
  const raw = process.env.WEEKLY_REPORT_TO ?? "";
  const parsed = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : DEFAULT_RECIPIENTS;
}
