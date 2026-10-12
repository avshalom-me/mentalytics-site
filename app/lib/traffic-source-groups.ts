// מקורות הכניסה לאתר כפי שדשבורד השיווק קורא להם: שם אחד לכל מקור, ואילו
// ערוצים (channel) נספרים בו. משמש את טבלת "מקורות תנועה" ואת שורת "השאר"
// בכרטיסי כיסוי הפניות, כדי ששני המקומות יקראו לאותו מקור באותו שם.
//
// הסדר הוא סדר התצוגה בטבלה: מה שמשלמים עליו, מה שמגיע לבד, ומה שצומח.

export type SourceGroup = { id: string; label: string; keys: string[] };

export const SOURCE_GROUPS: SourceGroup[] = [
  { id: "google_paid", label: "גוגל ממומן", keys: ["google_paid"] },
  { id: "google_organic", label: "גוגל אורגני", keys: ["google_organic"] },
  { id: "ai", label: "עוזרי AI", keys: ["ai"] },
  { id: "referral", label: "אתרים מפנים", keys: ["referral"] },
  { id: "direct", label: "כניסות ישירות", keys: ["direct"] },
  { id: "taboola", label: "טאבולה", keys: ["taboola_paid"] },
  { id: "meta", label: "פייסבוק ואינסטגרם", keys: ["meta_paid", "meta_organic"] },
  { id: "whatsapp", label: "וואטסאפ", keys: ["whatsapp"] },
  { id: "email", label: "קישור ממייל", keys: ["email"] },
  { id: "search_other", label: "מנועי חיפוש אחרים", keys: ["search_other"] },
  { id: "tiktok", label: "טיקטוק", keys: ["tiktok_paid", "tiktok_organic"] },
  { id: "unknown", label: "לא מזוהה", keys: ["unknown", "other"] },
];

const UNKNOWN = SOURCE_GROUPS[SOURCE_GROUPS.length - 1];
const GROUP_BY_CHANNEL = new Map<string, SourceGroup>(
  SOURCE_GROUPS.flatMap((g) => g.keys.map((k) => [k, g] as const)),
);

export function sourceGroup(id: string): SourceGroup {
  const g = SOURCE_GROUPS.find((x) => x.id === id);
  if (!g) throw new Error(`unknown source group: ${id}`);
  return g;
}

export type SourceCount = { id: string; label: string; n: number };

/**
 * ספירה לפי ערוץ → ספירה לפי מקור, מהרב למעט. ערוץ שאינו מוכר נספר ב"לא
 * מזוהה", כדי שהסכום יישאר סכום הקלט. `skipChannels` מוציא ערוצים שמוצגים
 * בנפרד (גוגל אדס, בכרטיסי הכיסוי).
 */
export function countBySource(byChannel: Record<string, number>, skipChannels: string[] = []): SourceCount[] {
  const totals = new Map<string, number>();
  for (const [channel, n] of Object.entries(byChannel)) {
    if (n <= 0 || skipChannels.includes(channel)) continue;
    const g = GROUP_BY_CHANNEL.get(channel) ?? UNKNOWN;
    totals.set(g.id, (totals.get(g.id) ?? 0) + n);
  }
  return SOURCE_GROUPS.filter((g) => totals.has(g.id))
    .map((g) => ({ id: g.id, label: g.label, n: totals.get(g.id)! }))
    .sort((a, b) => b.n - a.n);
}
