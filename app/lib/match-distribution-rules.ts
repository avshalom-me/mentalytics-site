// רובריקת חלוקת הפניות (29/10/2026): איך הפניות מהשאלון מתחלקות בין
// המקודמים, מי עמוס/ה, מי רעב/ה, ומה לעשות. מודול טהור - הנתונים מגיעים
// מ-match-distribution.ts (RPC), והעמוד מציג שורה = חומרה + שם + מספרים +
// "מה לעשות" + כפתור, כמו שאר מסכי הסוכנים.
//
// היעד של הבעלים: כ-2 פניות בחודש לכל מטפל/ת משלם/ת. הרובריקה מודדת את
// החלון הנוכחי מול החלון הקודם (30 יום), כדי שאפשר יהיה לראות אם ההעלמה
// בעומס (match-load-shedding.ts) שינתה משהו.

import { canPauseFromMatching } from "./match-pause";
import { isShedEligible, shedProbability, SHED_START_PEOPLE } from "./match-load-shedding";

/** כמה פונים בחודש הבעלים רוצה לכל משלם/ת. */
export const TARGET_PEOPLE_PER_MONTH = 2;
/** "עמוס/ה": פי שלושה מהיעד. */
export const BUSY_PEOPLE = TARGET_PEOPLE_PER_MONTH * 3;
/** "חשיפה בלי פניות": נחשף/ה לפחות כך ולא קיבל/ה אף פנייה. */
export const EXPOSED_MIN_APPEARANCES = 30;
/** "בלי חשיפה": פחות מכך הופעות אחרי שבועיים של קידום. */
export const UNEXPOSED_MAX_APPEARANCES = 10;
export const NEW_DAYS = 14;

export type DistributionRow = {
  id: string;
  name: string;
  promotion_source: string | null;
  entity_type: string | null;
  status: string;
  online: boolean;
  regions: string[];
  /** ימים מאז תחילת הקידום (null כשלא ידוע). */
  promoted_days: number | null;
  paused_until: string | null;
  /** אנשים שפנו בחלון (30 יום), מכל המקורות. */
  people: number;
  people_prev: number;
  match_people: number;
  /** הופעות בתוצאות השאלון בחלון. */
  appearances: number;
  appearances_prev: number;
  opens: number;
  /** אנשים שפנו ב-14 הימים האחרונים - הקלט של ההעלמה בעומס. */
  load14: number;
};

export type Severity = "critical" | "high" | "normal" | "low";

export type Verdict = {
  severity: Severity;
  /** קוד קצר לקיבוץ בעמוד. */
  kind: "busy" | "above" | "on_target" | "exposed_no_contacts" | "unexposed" | "new" | "quiet";
  label: string;
  advice: string;
  /** האם כפתור ההקפאה הידנית רלוונטי (לפי מדיניות match-pause). */
  canPause: boolean;
  /** האם ההעלמה האוטומטית פועלת עליו/ה עכשיו, ובאיזו הסתברות. */
  shedNow: number;
};

function pausedNow(r: DistributionRow, nowMs: number): boolean {
  return !!r.paused_until && Date.parse(r.paused_until) > nowMs;
}

function ilDay(iso: string): string {
  return new Date(iso).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" });
}

export function classifyRow(r: DistributionRow, nowMs: number = Date.now()): Verdict {
  const paused = pausedNow(r, nowMs);
  const canPause = canPauseFromMatching(r) && !paused;
  const shedNow = isShedEligible(r) ? shedProbability(r.load14) : 0;
  const isNew = r.promoted_days !== null && r.promoted_days < NEW_DAYS;

  if (r.people >= BUSY_PEOPLE) {
    return {
      severity: "high",
      kind: "busy",
      label: "עמוס/ה",
      advice: paused
        ? `כבר בהקפאה שקטה עד ${ilDay(r.paused_until as string)}.`
        : shedNow > 0
          ? `ההעלמה בעומס פועלת (${r.load14} פונים ב-14 יום, מוסתר/ת ב-${Math.round(shedNow * 100)}% מהחיפושים). אפשר גם להקפיא לשבוע.`
          : canPause
            ? "הרבה מעבר ליעד. הקפאה שקטה לשבוע מפנה מקום לאחרים."
            : r.promotion_source === "center"
              ? "הרבה מעבר ליעד. מטפלי מרכז לא מוקפאים: המרכז משלם ורואה את המספרים."
              : "הרבה מעבר ליעד. במסלול ההזמנה לפני החיוב הראשון לא מקפיאים.",
      canPause,
      shedNow,
    };
  }
  if (r.people >= TARGET_PEOPLE_PER_MONTH + 1) {
    return { severity: "normal", kind: "above", label: "מעל היעד", advice: "אין מה לעשות. מעקב בלבד.", canPause, shedNow };
  }
  if (r.people >= 1) {
    return { severity: "low", kind: "on_target", label: "ביעד", advice: "", canPause, shedNow };
  }
  // אפס פניות בחלון:
  if (isNew) {
    return { severity: "low", kind: "new", label: "חדש/ה", advice: "פחות משבועיים בקידום. עוד מוקדם לשפוט.", canPause, shedNow };
  }
  if (r.appearances >= EXPOSED_MIN_APPEARANCES) {
    return {
      severity: "high",
      kind: "exposed_no_contacts",
      label: "חשיפה בלי פניות",
      advice: `${r.appearances} הופעות, ${r.opens} פתיחות, אף פנייה. עוד חשיפה לא תעזור: לבדוק תמונה ופתיחת ביו, ולשקול הודעה.`,
      canPause,
      shedNow,
    };
  }
  if (r.appearances < UNEXPOSED_MAX_APPEARANCES) {
    return {
      severity: "normal",
      kind: "unexposed",
      label: "בלי חשיפה",
      advice: `${r.appearances} הופעות בלבד. לבדוק אזורים ותחומים בפרופיל, או שבאזור אין ביקוש.`,
      canPause,
      shedNow,
    };
  }
  return { severity: "normal", kind: "quiet", label: "שקט/ה", advice: `${r.appearances} הופעות ואף פנייה.`, canPause, shedNow };
}

export type DistributionSummary = {
  promoted: number;
  people: number;
  people_prev: number;
  /** חלק 5 ו-10 המובילים מכלל הפונים, באחוזים. */
  top5_share: number;
  top5_share_prev: number;
  top10_share: number;
  top10_share_prev: number;
  /** כמה מקודמים בלי אף פנייה, באחוזים. */
  zero_share: number;
  zero_share_prev: number;
  /** כמה מהמשלמים הגיעו ליעד. */
  paid_on_target: number;
  paid_total: number;
  /** כמה מועלמים אוטומטית עכשיו (הסתברות > 0). */
  shed_now: number;
};

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((100 * part) / whole) : 0;
}

function topShare(values: number[], n: number): number {
  const total = values.reduce((a, b) => a + b, 0);
  const top = [...values].sort((a, b) => b - a).slice(0, n).reduce((a, b) => a + b, 0);
  return pct(top, total);
}

export function summarize(rows: readonly DistributionRow[]): DistributionSummary {
  const cur = rows.map((r) => r.people);
  const prev = rows.map((r) => r.people_prev);
  const paid = rows.filter((r) => r.promotion_source === "paid");
  return {
    promoted: rows.length,
    people: cur.reduce((a, b) => a + b, 0),
    people_prev: prev.reduce((a, b) => a + b, 0),
    top5_share: topShare(cur, 5),
    top5_share_prev: topShare(prev, 5),
    top10_share: topShare(cur, 10),
    top10_share_prev: topShare(prev, 10),
    zero_share: pct(rows.filter((r) => r.people === 0).length, rows.length),
    zero_share_prev: pct(rows.filter((r) => r.people_prev === 0).length, rows.length),
    paid_on_target: paid.filter((r) => r.people >= TARGET_PEOPLE_PER_MONTH).length,
    paid_total: paid.length,
    shed_now: rows.filter((r) => isShedEligible(r) && r.load14 >= SHED_START_PEOPLE).length,
  };
}

export type RegionRow = {
  region: string;
  searches: number;
  people: number;
  therapists_with_contacts: number;
  top1: number;
  top3: number;
  /** מקודמים שמכסים את האזור (לפי הפרופילים). */
  covering: number;
};

export type RegionVerdict = { severity: Severity; label: string; note: string };

/** מה אומר האזור: ריכוז (מטפל/ת אחד/ת מקבל/ת את רוב הפניות), דליל, או תקין. */
export function classifyRegion(r: RegionRow): RegionVerdict {
  if (r.people === 0) {
    return { severity: "low", label: "בלי פניות", note: r.searches > 0 ? `${r.searches} חיפושים ואף פנייה` : "" };
  }
  const perPromoted = r.covering > 0 ? r.people / r.covering : null;
  const top1Share = pct(r.top1, r.people);
  if (r.people >= 5 && top1Share >= 50) {
    return { severity: "high", label: "ריכוז", note: `מטפל/ת אחד/ת מקבל/ת ${top1Share}% מהפניות` };
  }
  if (perPromoted !== null && perPromoted < TARGET_PEOPLE_PER_MONTH * 0.75 && r.covering >= 4) {
    return {
      severity: "normal",
      label: "ביקוש נמוך למספר המקודמים",
      note: `${r.people} פונים ל-${r.covering} מקודמים (${perPromoted.toFixed(1)} לכל אחד גם בחלוקה שווה)`,
    };
  }
  return { severity: "low", label: "תקין", note: perPromoted !== null ? `${perPromoted.toFixed(1)} פונים לכל מקודם/ת` : "" };
}
