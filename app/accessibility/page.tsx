import Link from "next/link";

export default function AccessibilityPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <h1 className="text-3xl font-black text-stone-900 mb-6">הצהרת נגישות</h1>

      <div className="space-y-6 text-stone-700 leading-7">
        <section>
          <h2 className="text-xl font-bold text-stone-900 mb-2">כללי</h2>
          <p>
            Mentalytics פועלת להנגשת אתר האינטרנט שלה לאנשים עם מוגבלות, בהתאם לתקן הישראלי{" "}
            <strong>ת"י 5568</strong> (המבוסס על WCAG 2.1 ברמת AA) ובהתאם לתיקון 35 לחוק שוויון זכויות לאנשים עם מוגבלות.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-stone-900 mb-2">מה בוצע באתר</h2>
          <ul className="space-y-1.5 list-disc list-inside">
            <li>הגדרת שפת הדף כעברית (<code>lang="he"</code>)</li>
            <li>הגדרת כיוון קריאה מימין לשמאל (<code>dir="rtl"</code>)</li>
            <li>תיאורי טקסט חלופי (<code>alt</code>) לכל התמונות</li>
            <li>מבנה כותרות היררכי (<code>h1</code>–<code>h3</code>) בכל הדפים</li>
            <li>ניגודיות צבעים עומדת בדרישות רמה AA</li>
            <li>אפשרות ניווט מלאה באמצעות מקלדת</li>
            <li>קישור "דלג לתוכן הראשי" בתחילת כל עמוד</li>
            <li>תגיות <code>aria-label</code> לאלמנטי ניווט</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-stone-900 mb-2">מה טרם הושלם</h2>
          <p>
            אנו עובדים באופן שוטף על שיפור הנגישות. ייתכן כי חלק מהתכנים ישנם לא עומדים עדיין בכל דרישות התקן.
            אנו מתחייבים לטפל בפערים שיתגלו בהקדם האפשרי.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-stone-900 mb-2">פניות בנושא נגישות</h2>
          <p>
            נתקלתם בבעיית נגישות? נשמח לשמוע. ניתן לפנות אלינו בדוא"ל:{" "}
            <a href="mailto:accessibility@mentalytics.co.il" className="text-[#0F5468] underline">
              accessibility@mentalytics.co.il
            </a>
          </p>
          <p className="mt-2 text-sm text-stone-500">
            נשתדל להגיב תוך 5 ימי עסקים.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-stone-900 mb-2">תאריך עדכון אחרון</h2>
          <p>מרץ 2026</p>
        </section>
      </div>

      <div className="mt-10">
        <Link href="/" className="text-sm text-stone-500 hover:underline">← חזרה לדף הבית</Link>
      </div>
    </main>
  );
}
