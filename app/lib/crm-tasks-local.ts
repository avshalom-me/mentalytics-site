// עדכון מקומי של רשימות המשימות באדמין, לפני שהשרת עונה (29/10/2026).
//
// עד עכשיו כל פעולה בעמוד המשימות (סימון כבוצע, דחייה, מחיקה, הוספה) חיכתה
// לשרת, ואז טענה מחדש את שלוש הרשימות והסתירה את כל המסך מאחורי "טוען".
// הבעלים: "במקום לבצע מיד יש שיהוי, כתוב טוען, הדף מתרענן ואז מופיעה
// הפעולה". הפונקציות כאן מחשבות איך הרשימות אמורות להיראות אחרי הפעולה,
// כך שהמסך מתעדכן מיד; השרת עדיין מקור האמת, והרענון השקט שאחרי כל פעולה
// מיישר כל הבדל (סדר, שדות שהשרת ממלא).
//
// מודול טהור, בלי React ובלי מסד.

import { ACTIVE_TASK_STATUSES } from "./crm";

export type LocalTask = {
  id: string;
  status: string;
  due_date: string | null;
  snoozed_until: string | null;
  created_at: string;
  completed_at: string | null;
  completion_note: string | null;
  [key: string]: unknown;
};

export type TaskLists<T extends LocalTask> = { open: T[]; done: T[] };

function isActive(status: string): boolean {
  return (ACTIVE_TASK_STATUSES as readonly string[]).includes(status);
}

/** אותו סדר כמו בשאילתה של השרת: לפי תאריך יעד (בלי תאריך בסוף), ואז החדש קודם. */
export function sortOpen<T extends LocalTask>(tasks: readonly T[]): T[] {
  return [...tasks].sort((a, b) => {
    if (a.due_date !== b.due_date) {
      if (a.due_date === null) return 1;
      if (b.due_date === null) return -1;
      return a.due_date < b.due_date ? -1 : 1;
    }
    return a.created_at > b.created_at ? -1 : a.created_at < b.created_at ? 1 : 0;
  });
}

/**
 * איך הרשימות נראות אחרי PATCH של משימה אחת. משימה שנסגרה עוברת לראש
 * "בוצעו לאחרונה" עם זמן סיום; משימה שנפתחה מחדש חוזרת לפתוחות במקומה.
 */
export function applyTaskPatch<T extends LocalTask>(
  lists: TaskLists<T>,
  id: string,
  patch: Record<string, unknown>,
  nowIso: string = new Date().toISOString(),
): TaskLists<T> {
  const current = lists.open.find((t) => t.id === id) ?? lists.done.find((t) => t.id === id);
  if (!current) return lists;
  const next = { ...current, ...patch } as T;
  const wasActive = isActive(current.status);
  const nowActive = isActive(next.status);
  if (!wasActive && nowActive) {
    // נפתחה מחדש: ההערה וזמן הסיום מתאפסים, כמו בשרת.
    next.completed_at = null;
    next.completion_note = null;
  } else if (wasActive && !nowActive) {
    // כמו בשרת: רק "בוצע" נושא חותמת סיום.
    next.completed_at = next.status === "done" ? nowIso : null;
  }
  const open = sortOpen([...lists.open.filter((t) => t.id !== id), ...(nowActive ? [next] : [])]);
  const doneRest = lists.done.filter((t) => t.id !== id);
  const done = nowActive ? doneRest : [next, ...doneRest];
  return { open, done };
}

export function removeTask<T extends LocalTask>(lists: TaskLists<T>, id: string): TaskLists<T> {
  return { open: lists.open.filter((t) => t.id !== id), done: lists.done.filter((t) => t.id !== id) };
}

/** משימה חדשה שהשרת החזיר נכנסת לפתוחות במקום הנכון, בלי לחכות לטעינה מחדש. */
export function insertTask<T extends LocalTask>(lists: TaskLists<T>, task: T): TaskLists<T> {
  if (!isActive(task.status)) return { open: lists.open, done: [task, ...lists.done.filter((t) => t.id !== task.id)] };
  return { open: sortOpen([...lists.open.filter((t) => t.id !== task.id), task]), done: lists.done };
}
