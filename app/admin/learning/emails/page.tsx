"use client";

import HelpTip from "../../components/HelpTip";
import { Section } from "../../components/BranchWidgets";
import { TEACHER_EMAIL_PREVIEWS } from "@/app/lib/teacher-email-templates";
import { btn } from "../shared";

// המיילים שמורים מקבלים, כפי שהם נשלחים, עם מורה לדוגמה. שום דבר לא נשלח
// מכאן. מיילי הטיפול (תעודה, תמונה, השלמה) נשלחים רק מכרטיס המורה, אחרי
// שהבעלים ערך את הטיוטה; מייל האישור נשלח באישור; קליטה והקישור האישי
// נשלחים אוטומטית כתגובה לפעולה של המורה.

export default function LearningEmailsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-black text-stone-900">מיילים</h1>
        <HelpTip id="teachers" />
      </div>
      <Section title="המיילים, כפי שהם נשלחים" sub="תצוגה עם מורה לדוגמה. החתימה 'צוות לימוד חכם' והלוגו של הדלת בכולם (החלטת הבעלים, 6/11/2026).">
        <div className="mt-3 flex flex-wrap gap-2">
          {TEACHER_EMAIL_PREVIEWS.map((p) => (
            <a key={p.key} href={`/api/admin-teachers?preview=${p.key}`} target="_blank" rel="noopener noreferrer" className={btn}>{p.label} ↗</a>
          ))}
        </div>
      </Section>
      <Section title="מי שולח מה">
        <ul className="mt-3 space-y-1 text-sm text-stone-700">
          <li><b>אוטומטי, כתגובה למורה:</b> קליטת ההרשמה, שליחת הקישור האישי.</li>
          <li><b>בלחיצה שלך:</b> אישור הפרופיל (כברירת מחדל נשלח באישור), דחייה, הודעה חופשית, ושלוש טיוטות הטיפול: בקשת תעודה, בקשת תמונה, השלמת פרופיל.</li>
          <li><b>הטיוטות</b> מוכנות כל בוקר לפי הכללים (אין תעודה להוראה מתקנת, אין תמונה אחרי שבוע, פרופיל דל), מורה מקבל/ת לכל היותר מייל טיפול אחד ב-21 יום, וטיוטה שנדחתה לא חוזרת 30 יום.</li>
          <li><b>לא נשלח:</b> מיילי תשלום וניסיון (המאגר חינם), ודוחות סטטיסטיקה למורים.</li>
        </ul>
      </Section>
    </div>
  );
}
