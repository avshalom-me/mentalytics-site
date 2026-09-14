"use client";

import { trackingOptedOut } from "./track-optout";

/**
 * פיקסל Taboola - שליחת אירועי המרה.
 *
 * הפיקסל הבסיסי נטען ב-layout ויורה `page_view` לבדו. כאן נשלחים האירועים
 * הנוספים, ומהם נגזרות ההמרות שמזינות את אופטימיזציית הקמפיין.
 *
 * למה שני אירועים ולא אחד: בתקציב הטסט (₪1,000, כ-500 קליקים) צפויות
 * 5-10 פניות בלבד - מדגם שלא מאפשר להסיק דבר. התחלות שאלון לעומת זאת
 * צפויות ב-75-100, וזה כבר מדגם אמיתי. לכן `quiz_start` הוא מדד ההצלחה
 * בפועל של הטסט, ו-`contact` הוא המדד העסקי שנמדד לאורך זמן.
 *
 * שמות האירועים כלליים במכוון. אסור שיישלח ל-Taboola מידע על תוכן קליני,
 * ולכן אין כאן סוג קושי, לא תשובות ולא אבחנה - רק "התחיל שאלון".
 */

const TABOOLA_ACCOUNT_ID = 2102216;

type TaboolaEvent = "quiz_start" | "contact";

declare global {
  interface Window {
    _tfa?: Array<Record<string, unknown>>;
  }
}

/**
 * @param opts.once - מפתח ב-sessionStorage שמונע ירי חוזר באותה לשונית.
 *   מסך הפתיחה של השאלון נטען מחדש בכל חזרה אחורה (וגם ב-back של הדפדפן),
 *   ובלי זה מבקר אחד שהלך קדימה-אחורה נספר כשתי המרות.
 */
export function tfaEvent(name: TaboolaEvent, opts?: { once?: string }) {
  if (typeof window === "undefined") return;
  if (trackingOptedOut()) return; // מכשיר של הצוות - לא מזהמים גם את Taboola
  if (opts?.once) {
    try {
      if (sessionStorage.getItem(opts.once) === "1") return;
      sessionStorage.setItem(opts.once, "1");
    } catch {
      // sessionStorage חסום - עדיף לירות פעמיים מאשר לאבד את ההמרה
    }
  }
  try {
    window._tfa = window._tfa || [];
    window._tfa.push({ notify: "event", name, id: TABOOLA_ACCOUNT_ID });
  } catch {
    // הפיקסל הוא מדידה, לא פונקציונליות. כשל כאן לא ישבור זרימה למשתמש.
  }
}
