/**
 * רצפת זמן למסך ביניים.
 *
 * מסך "מעבד תשובות" שמופיע ונעלם ברבע שנייה קורא כאילו לא קרה דבר: המטופל
 * לחץ "סיום" וקיבל מיד רשימה, בלי שום סימן שמשהו נשקל. שתי שניות הן ההפרש
 * בין "המערכת ענתה" לבין "המערכת חשבה".
 *
 * זו **רצפה ולא עיכוב**: אם הניקוד לקח כבר יותר מהזמן הזה - ממשיכים מיד.
 * הוספת שתי שניות קבועות הייתה מענישה דווקא את מי שכבר המתין.
 */
export function minDwell(startedAt: number, ms = 2000): Promise<void> {
  const left = ms - (Date.now() - startedAt);
  if (left <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, left));
}
