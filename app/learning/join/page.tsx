import type { Metadata } from "next";
import JoinForm from "./JoinForm";
import { TEACHER_PRICE_GROSS, TEACHER_TRIAL_DAYS } from "@/app/lib/teacher-options";

// דף ההצטרפות למורים. בכוונה לא "דף שיווק": טון עובדתי, מה זה, למי זה,
// מה התנאים, ומה נדרש כדי להתקבל. נפתח רק מקישור ישיר (ראו layout).

export const metadata: Metadata = {
  title: "הצטרפות מורים למענה הלימודי",
  robots: { index: false, follow: false },
};

export default function TeacherJoinPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 pb-24" dir="rtl">
      <div className="mb-8 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="טיפול חכם" style={{ height: "48px", width: "auto", display: "inline-block" }} />
        <div className="mt-2 text-sm font-bold text-[var(--teal-dark)]">מענה לימודי</div>
      </div>

      <h1 className="mb-4 text-3xl font-black leading-tight text-[var(--text)] sm:text-4xl">
        מורים להוראה מתקנת ומורים פרטיים: הצטרפות למאגר
      </h1>
      <p className="mb-6 text-lg leading-8 text-[var(--text-2)]">
        הורים ממלאים בטיפול חכם שאלון מקיף על ילדם. כשהשאלון מזהה קושי לימודי ממוקד - למשל קושי בחשבון
        בכיתה ג׳, קושי בקריאה עם רקע שפתי, או קושי באנגלית בתיכון - הוא ממליץ על הוראה מתקנת או על תגבור,
        ומציג להורים מורים מתאימים לפי התחום, שכבת הגיל ואזור המגורים. ההורים פונים ישירות אליכם.
      </p>

      <section className="mb-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
          <h2 className="mb-2 text-base font-black text-[var(--teal-dark)]">מה מקבלים</h2>
          <ul className="space-y-1.5 text-sm leading-6 text-[var(--text-2)]">
            <li>• פניות של הורים שהשאלון כבר זיהה אצל ילדם את הקושי המדויק שאתם מלמדים</li>
            <li>• פרופיל עם ההכשרה, התחומים, שכבות הגיל והאזורים שלכם</li>
            <li>• נתונים: כמה פעמים הפרופיל הופיע, וכמה הורים פנו</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-[var(--gold)] bg-[var(--gold-pale)] p-5">
          <h2 className="mb-2 text-base font-black text-[var(--gold-dark)]">התנאים</h2>
          <ul className="space-y-1.5 text-sm leading-6 text-[var(--text)]">
            <li>• {TEACHER_TRIAL_DAYS} ימי ניסיון מרגע האישור: ללא תשלום, ללא התחייבות, ללא כרטיס אשראי</li>
            <li>• אחר כך: {TEACHER_PRICE_GROSS} ש״ח לחודש כולל מע״מ, ללא התחייבות, ביטול בכל עת</li>
            <li>• בלי תשלום בסוף הניסיון הפרופיל יורד מהמאגר. הנתונים נשמרים, ואפשר לחזור</li>
          </ul>
        </div>
      </section>

      <section className="mb-10 rounded-2xl border border-[var(--line)] bg-white p-5">
        <h2 className="mb-2 text-base font-black text-[var(--text)]">מי יכול להצטרף</h2>
        <p className="text-sm leading-7 text-[var(--text-2)]">
          <strong>הוראה מתקנת (מותאמת):</strong> תעודת מומחה/ית להוראה מתקנת מתוכנית אקדמית, תואר בחינוך מיוחד, או
          תואר שני בלקויות למידה. <strong>תגבור פרטי במתמטיקה או באנגלית:</strong> תעודת הוראה או תואר בתחום הדעת,
          או סטודנט/ית מתקדם/ת עם ניסיון. בכל מקרה נבקש לצרף תעודה, ונאמת אותה לפני שהפרופיל מוצג.
          ההצטרפות כוללת הצהרה על היעדר הרשעה או מניעה לעבודה עם קטינים. טיפול חכם אינה המעסיקה
          ואינה צד לשיעורים: ההתקשרות, התשלום והאחריות המקצועית הם בינכם לבין ההורים.
        </p>
      </section>

      <JoinForm />
    </main>
  );
}
