import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";

// איתור משתמש Supabase Auth לפי כתובת מייל, בצד השרת.
//
// auth.users אינו נגיש מ-supabase-js (הסכמה לא חשופה ל-API), ול-Admin API אין
// חיפוש לפי מייל - רק דפדוף. עם כמה מאות משתמשים זה עמוד אחד; הלולאה קיימת
// כדי שהפונקציה לא תשתתק בשקט ביום שיהיו יותר מאלף. אותו דפוס כמו הקישור
// הידני ב-admin-therapists.
//
// ההשוואה case-insensitive אחרי trim: כך גם Gmail וגם Supabase מתייחסים לכתובת,
// ומי שנרשם עם אות גדולה לא יוחזר כ"לא קיים".

export type AuthUserLite = { id: string; email: string };

export async function findAuthUserByEmail(rawEmail: string): Promise<AuthUserLite | null> {
  const wanted = rawEmail.trim().toLowerCase();
  if (!wanted) return null;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`auth listUsers failed: ${error.message}`);
    const users = data?.users ?? [];
    const hit = users.find((u) => (u.email ?? "").toLowerCase() === wanted);
    if (hit && hit.email) return { id: hit.id, email: hit.email };
    if (users.length < 1000) break;
  }
  return null;
}
