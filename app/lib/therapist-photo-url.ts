// כתובת התמונה הציבורית של מטפל, עם גרסה.
//
// /therapist-photo/<id> היא כתובת יציבה ונשמרת במטמון: שעה בדפדפן, יום ב-CDN
// ועד שבוע "ישן" בזמן רענון (ראו app/therapist-photo/[id]/route.ts). הכתובת
// לא השתנתה כשמטפל החליף תמונה, ולכן עמוד הפרופיל המשיך להציג את הישנה עד
// שהמטמון פג (דווח 21/9/26: הבעלים החליף תמונה, בעורך ראה את החדשה ובאתר את
// הישנה). הגרסה נגזרת מנתיב הקובץ, וכל העלאה יוצרת נתיב חדש - כך תמונה חדשה
// היא כתובת חדשה, והדפדפן וה-CDN מביאים אותה מיד.

/** טביעה קצרה ויציבה של נתיב הקובץ (FNV-1a, 32 ביט, base36). */
export function photoVersion(photoPath: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < photoPath.length; i++) {
    h ^= photoPath.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** /therapist-photo/<id>?v=<גרסה>. baseUrl מוסיף דומיין (og:image, JSON-LD). */
export function therapistPhotoUrl(id: string, photoPath: string, baseUrl = ""): string {
  return `${baseUrl}/therapist-photo/${id}?v=${photoVersion(photoPath)}`;
}
