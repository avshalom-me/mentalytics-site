"use client";

import { HELP, type HelpEntry } from "../help-content";

// The full user guide, inside the CRM. Composed from the same help-content
// entries that power the (?) tips — one source of truth, so the guide can't
// drift from the in-context help. Guide-only prose (intro, routine, security,
// roadmap) lives here.

const SECTION_ORDER: { title: string; ids: string[] }[] = [
  { title: "לוח הבקרה", ids: ["dashboard", "kpis", "work-queue", "plan"] },
  { title: "מטפלים וכרטיס ה-360°", ids: ["timeline", "notes", "gmail-link"] },
  { title: "לידים ופניות", ids: ["leads"] },
  { title: "תקופת ביטחון", ids: ["guarantee"] },
  { title: "משימות והצעות", ids: ["tasks", "suggestions"] },
  { title: "עסקאות B2B", ids: ["deals"] },
  { title: "כספים", ids: ["finance", "expenses"] },
  { title: "ארגונים ומרכזים", ids: ["organizations"] },
];

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="mb-1 text-2xl font-black text-stone-900">מדריך המערכת</h1>
        <p className="mb-8 text-sm text-stone-500">
          כל מה שיש במערכת, מה כל דבר בודק, ואיך עובדים איתה. אותו תוכן בדיוק זמין גם נקודתית — דרך עיגולי
          ה-(?) שליד כל כותרת.
        </p>

        <GuideCard title="למה המערכת בנויה כך">
          <p className="mb-2">
            ה-CRM חי בתוך האדמין של האתר, לא בכלי חיצוני: כל הנתונים (מטפלים, תשלומים, פניות) כבר כאן,
            ופרטי פונים לטיפול נפשי הם מידע רגיש שלא מוציאים החוצה.
          </p>
          <p>
            עיקרון מנחה — <b>לכל נתון מקור אמת אחד:</b> הכנסות נקראות אוטומטית מהחיובים, פניות נתפסות
            אוטומטית מהאתר; רק הוצאות, הערות ומשימות מוזנות ידנית, ופעם אחת בלבד.
          </p>
        </GuideCard>

        <GuideCard title="שגרת השימוש המומלצת">
          <ul className="list-disc space-y-1.5 ps-5">
            <li>
              <b>כל בוקר (2–3 דקות):</b> לוח הבקרה, תור העבודה מלמעלה למטה. תור ריק = הכול בשליטה.
            </li>
            <li>
              <b>כשמגיעה חשבונית ספק:</b> 30 שניות הזנה במסך הכספים.
            </li>
            <li>
              <b>אחרי שיחה חשובה:</b> שורת הערה בכרטיס המטפל או בעסקה — מה שלא נכתב, נשכח.
            </li>
            <li>
              <b>פעם בשבוע:</b> מבט על מעקב הביטחון, על הצעות המערכת במסך המשימות, ועל ‟הצעד הבא” בעסקאות.
            </li>
          </ul>
        </GuideCard>

        {SECTION_ORDER.map((section) => (
          <div key={section.title} className="mb-8">
            <h2 className="mb-3 text-lg font-black text-teal-800">{section.title}</h2>
            {section.ids.map((id) => {
              const entry = HELP[id];
              if (!entry) return null;
              return <EntryCard key={id} entry={entry} />;
            })}
          </div>
        ))}

        <GuideCard title="אבטחה ופרטיות">
          <ul className="list-disc space-y-1.5 ps-5">
            <li>הגישה לכל המערכת מוגנת בהזדהות; בקשות ממקורות זרים נחסמות.</li>
            <li>טבלאות ה-CRM נעולות ברמת מסד הנתונים — רק השרת ניגש אליהן.</li>
            <li>פרטי פונים = מידע בריאותי רגיש: לא מייצאים, לא מעתיקים החוצה, לא משתפים.</li>
            <li>שום תהליך לא כותב ישירות לספרי החשבונות — רק טיוטות לאישור אנושי ב-Sumit.</li>
          </ul>
        </GuideCard>

        <GuideCard title="מה בהמשך הדרך">
          <ul className="list-disc space-y-1.5 ps-5">
            <li>הפעלת מודול ההוצאות ב-Sumit (בתהליך מול התמיכה שלהם).</li>
            <li>תבניות מייל — אחרי שיצטבר שימוש שיראה אילו הודעות חוזרות.</li>
            <li>ריבוי משתמשים והרשאות — כשאדם נוסף מתחיל לעבוד במערכת.</li>
            <li>מסכי מרכזים טיפוליים — כשהמרכז הראשון נקלט.</li>
          </ul>
        </GuideCard>
      </div>
    </div>
  );
}

function GuideCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="mb-3 text-lg font-black text-teal-800">{title}</h2>
      <div className="rounded-2xl border border-stone-200 bg-white p-5 text-sm leading-relaxed text-stone-700">
        {children}
      </div>
    </div>
  );
}

function EntryCard({ entry }: { entry: HelpEntry }) {
  return (
    <div className="mb-3 rounded-2xl border border-stone-200 bg-white p-5">
      <h3 className="mb-1 text-base font-black text-stone-900">{entry.title}</h3>
      <p className="mb-3 text-sm font-semibold text-teal-700">{entry.short}</p>
      <GuideField label="מה זה מציג" body={entry.what} />
      {entry.how && <GuideField label="איך זה עובד" body={entry.how} />}
      {entry.source && <GuideField label="מאיפה הנתונים" body={entry.source} />}
      {entry.actions && <GuideField label="מה עושים עם זה" body={entry.actions} />}
    </div>
  );
}

function GuideField({ label, body }: { label: string; body: string }) {
  return (
    <div className="mb-2.5 last:mb-0">
      <div className="text-xs font-black text-stone-400">{label}</div>
      <p className="text-sm leading-relaxed text-stone-700 whitespace-pre-line">{body}</p>
    </div>
  );
}
