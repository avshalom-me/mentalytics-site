"use client";

import { useCallback, useEffect, useRef } from "react";

// כפתור "חזור" של הדפדפן בתוך מסך יחיד.
//
// הבעיה שזה פותר: שני השאלונים הם ראוט אחד (/adults, /kids) עם מסך פנימי
// ב-state. מעבר בין שאלה לשאלה לא נגע בהיסטוריית הדפדפן בכלל - נמדד: אחרי
// מעבר מסך history.length נשאר זהה - ולכן "חזור" לא חזר שאלה אחת אלא **עזב
// את השאלון כולו** וקפץ לעמוד שממנו נכנסו, בדרך כלל דף הבית. מי שלחץ חזור
// בטעות איבד את כל התשובות.
//
// המודל: כל רשומת היסטוריה נושאת את הצילום של המסך שמוצג בזמן שהיא הרשומה
// הנוכחית. מעבר קדימה דוחף רשומה חדשה; "חזור" ו"קדימה" של הדפדפן מגיעים
// עם ה-state של אותה רשומה, וממנו משחזרים. אין מחסנית מקבילה שיכולה
// להתפצל מהאמת - הדפדפן הוא המחסנית.
//
// למה זה בטוח למרות ההסתעפות: התשובות חיות ב-React ואינן משתנות בניווט,
// ולכן חזרה משחזרת בדיוק את המסלול שהמשתמש עבר בפועל. רשומות "קדימה"
// נמחקות אוטומטית ברגע שממשיכים הלאה (pushState חותך אותן), כך שהתרחיש
// המסוכן היחיד - לחזור, לשנות תשובה, ואז ללחוץ "קדימה" בלי להמשיך - כמעט
// אינו נגיש.

/** מפתח ייעודי בתוך history.state, לצד ה-state הפנימי של Next. */
const KEY = "mntScreen";

type Entry<S> = { snapshot: S; depth: number };

function readEntry<S>(state: unknown): Entry<S> | null {
  if (!state || typeof state !== "object") return null;
  const e = (state as Record<string, unknown>)[KEY];
  if (!e || typeof e !== "object") return null;
  const { snapshot, depth } = e as { snapshot?: S; depth?: number };
  if (snapshot === undefined || typeof depth !== "number") return null;
  return { snapshot, depth };
}

/**
 * @param snapshot מצב המסך הנוכחי - חייב להיות ניתן לסריאליזציה (מסך + סמנים).
 * @param restore מחזיר את הקומפוננטה למצב שנשמר. אסור לו לדחוף היסטוריה.
 * @param enabled כבוי במסכים שאין להם משמעות ניווטית (למשל תשלום).
 */
export function useScreenHistory<S>(
  snapshot: S,
  restore: (snapshot: S) => void,
  enabled = true,
): { pushScreen: () => void; goBack: () => void } {
  const depthRef = useRef(0);
  // ה-restore נקרא מתוך מאזין שנרשם פעם אחת; ref שומר אותו טרי בלי לרשום מחדש.
  const restoreRef = useRef(restore);
  restoreRef.current = restore;
  // הצילום העדכני, לסנכרון הרשומה הנוכחית אחרי כל רינדור.
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  // מסנכרן את הרשומה הנוכחית לצילום הנוכחי. רץ אחרי כל שינוי מסך, כולל
  // מיד אחרי pushScreen - שם הרשומה החדשה עדיין נושאת את הצילום הישן.
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const state = { ...(window.history.state ?? {}), [KEY]: { snapshot, depth: depthRef.current } };
    window.history.replaceState(state, "");
  }, [snapshot, enabled]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const onPop = (e: PopStateEvent) => {
      const entry = readEntry<S>(e.state);
      // אין צילום = יצאנו מהשאלון (הרשומה שלפני הכניסה). לא נוגעים - הדפדפן
      // מנווט, ושומר ה-beforeunload הוא זה שמזהיר על אובדן התשובות.
      if (!entry) return;
      depthRef.current = entry.depth;
      restoreRef.current(entry.snapshot);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [enabled]);

  const pushScreen = useCallback(() => {
    if (!enabled || typeof window === "undefined") return;
    depthRef.current += 1;
    // אותו URL: השאלון הוא ראוט אחד, ורק ה-state מבדיל בין המסכים. שמירת
    // ה-state הקיים חיונית - הוא מכיל את עץ הראוטר של Next, ודריסתו ב-null
    // שוברת את הניווט של App Router ברשומה הזו.
    window.history.pushState(
      { ...(window.history.state ?? {}), [KEY]: { snapshot: snapshotRef.current, depth: depthRef.current } },
      "",
    );
  }, [enabled]);

  const goBack = useCallback(() => {
    if (typeof window !== "undefined") window.history.back();
  }, []);

  return { pushScreen, goBack };
}
