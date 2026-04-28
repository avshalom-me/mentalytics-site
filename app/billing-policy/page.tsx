import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "תקנון רכישה — חיוב, ביטול והחזרים | טיפול חכם",
  description: "תקנון רכישה, מדיניות חיוב, ביטול מנוי והחזרים כספיים עבור מטפלים ומשתמשים בפלטפורמת טיפול חכם.",
};

export default function BillingPolicyPage() {
  return (
    <main
      className="mx-auto max-w-3xl px-5 py-12 pb-20"
      dir="rtl"
      style={{ fontFamily: "'Heebo', sans-serif" }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');`}</style>

      <Link href="/therapists/register" className="text-sm text-stone-500 hover:text-[#0F5468] hover:underline">
        ← חזרה לדף ההרשמה
      </Link>

      <h1 className="mt-6 text-3xl font-black text-stone-900 mb-2">תקנון רכישה — חיוב, ביטול והחזרים</h1>
      <p className="text-sm text-stone-500 mb-10">טיפול חכם — טיפול חכם — מנטליטיקס | עודכן לאחרונה: אפריל 2026</p>

      <div className="space-y-8 text-sm leading-7 text-stone-700">

        <section>
          <h2 className="text-lg font-extrabold text-stone-900 mb-2">1. כללי</h2>
          <p>תקנון זה מהווה הסכם מחייב בין המשתמש/ת (להלן: &quot;המשתמש&quot;) לבין טיפול חכם — מנטליטיקס (להלן: &quot;החברה&quot;), המפעילה את פלטפורמת &quot;טיפול חכם&quot; בכתובת mentalytics.co.il (להלן: &quot;האתר&quot;).</p>
          <p className="mt-2">השימוש באתר ורכישת שירותים בו מהווים הסכמה לתנאי תקנון זה. אם אינך מסכימ/ה לתנאים — אין לבצע רכישה.</p>
        </section>

        <section>
          <h2 className="text-lg font-extrabold text-stone-900 mb-2">2. פרטי החברה</h2>
          <ul className="list-disc pr-6 mt-2 space-y-1">
            <li>שם החברה: טיפול חכם — מנטליטיקס</li>
            <li>כתובת: אשכולית 28/3, פרדס חנה</li>
            <li>כתובת אתר: mentalytics.co.il</li>
            <li>מייל: <a href="mailto:tipool406@gmail.com" className="underline hover:text-[#0F5468]">tipool406@gmail.com</a></li>
            <li>טלפון: <a href="tel:0527906335" className="underline hover:text-[#0F5468]">052-790-6335</a></li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-extrabold text-stone-900 mb-2">3. השירותים המוצעים</h2>
          <p>האתר מציע שני סוגי שירותים בתשלום:</p>
          <ul className="list-disc pr-6 mt-2 space-y-1">
            <li><strong>מנוי חודשי למטפלים (מסלול מקודם):</strong> מנוי מתחדש בעלות של 120 ש&quot;ח לחודש (לא כולל מע&quot;מ). כולל הופעה במערכת ההתאמה החכמה, סטטיסטיקות מתקדמות, ודו&quot;חות פילוח פניות.</li>
            <li><strong>שימוש בשאלון התאמה (מטופלים):</strong> שלושת השימושים הראשונים חינמיים. כל שימוש נוסף בעלות של 30 ש&quot;ח (לא כולל מע&quot;מ).</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-extrabold text-stone-900 mb-2">4. תהליך הרכישה</h2>
          <ul className="list-disc pr-6 mt-2 space-y-1">
            <li>הרכישה מתבצעת באתר באמצעות טופס תשלום מאובטח.</li>
            <li>התשלום מעובד על ידי חברת Grow באמצעות פלטפורמת Morning (חשבונית ירוקה).</li>
            <li>החברה אינה שומרת פרטי כרטיס אשראי — כל מידע פיננסי מוחזק באופן מאובטח על ידי חברת הסליקה בלבד.</li>
            <li>עם השלמת התשלום תופק חשבונית מס / קבלה אוטומטית ותישלח למייל הרשום.</li>
            <li>לפני ביצוע רכישה, המשתמש נדרש לאשר את תקנון הרכישה באמצעות סימון ✓.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-extrabold text-stone-900 mb-2">5. מחירים ומע&quot;מ</h2>
          <p>כל המחירים המוצגים באתר אינם כוללים מע&quot;מ. מע&quot;מ ייתוסף בהתאם לשיעור המע&quot;מ החוקי בעת ביצוע הרכישה.</p>
          <p className="mt-2">החברה רשאית לעדכן מחירים מעת לעת. שינוי מחיר ייכנס לתוקף מתחילת תקופת החיוב הבאה ויילווה בהודעה מראש.</p>
        </section>

        <section>
          <h2 className="text-lg font-extrabold text-stone-900 mb-2">6. חיוב חודשי (מנוי מטפלים)</h2>
          <p>השירות ניתן במסגרת מנוי חודשי מתחדש.</p>
          <p>החיוב מתבצע אחת לחודש באמצעות אמצעי התשלום שהוזן בעת ההרשמה.</p>
          <p className="mt-2">ההוצאה מוכרת להזדכות במס הכנסה ומע&quot;מ.</p>
        </section>

        <section>
          <h2 className="text-lg font-extrabold text-stone-900 mb-2">7. ביטול מנוי</h2>
          <p>ניתן לבטל את המנוי בכל עת.</p>
          <p>הביטול ייכנס לתוקף מתום תקופת החיוב הנוכחית. אם בוצע חיוב לחודש חדש — השירות ימשיך עד סוף אותו חודש, ולא יבוצע חיוב נוסף לאחר מכן.</p>
          <p className="mt-2">ביטול מנוי ניתן לבצע דרך פנייה למייל <a href="mailto:tipool406@gmail.com" className="underline hover:text-[#0F5468]">tipool406@gmail.com</a> או בטלפון <a href="tel:0527906335" className="underline hover:text-[#0F5468]">052-790-6335</a>.</p>
        </section>

        <section>
          <h2 className="text-lg font-extrabold text-stone-900 mb-2">8. מדיניות החזרים</h2>
          <h3 className="font-bold text-stone-800 mt-3 mb-1">מנוי מטפלים:</h3>
          <p>מטפל/ת זכאי/ת לבקש החזר כספי בגין חודש מסוים, בכפוף לתנאים הבאים:</p>
          <ul className="list-disc pr-6 mt-2 space-y-1">
            <li>לא התקבלה אף פנייה דרך המערכת במהלך אותו חודש.</li>
            <li>הבקשה מוגשת במהלך החודש העוקב בלבד.</li>
            <li>לאחר סיום החודש העוקב — לא ניתן להגיש בקשת החזר עבור אותו חודש.</li>
          </ul>
          <div className="mt-3 rounded-xl bg-stone-50 border border-stone-200 px-4 py-3">
            <p className="font-semibold text-stone-800">לדוגמה:</p>
            <p>עבור חודש ינואר ניתן לבקש החזר עד סוף פברואר בלבד.</p>
          </div>

          <h3 className="font-bold text-stone-800 mt-4 mb-1">שאלון התאמה (מטופלים):</h3>
          <p>תשלום עבור שימוש בשאלון הוא סופי. לא ניתן לבקש החזר לאחר שהשאלון נפתח והמשתמש החל למלא אותו.</p>
        </section>

        <section>
          <h2 className="text-lg font-extrabold text-stone-900 mb-2">9. אופן הגשת בקשת החזר או ביטול</h2>
          <p>בקשות החזר או ביטול מנוי יש להגיש באחד מהאמצעים הבאים:</p>
          <ul className="list-disc pr-6 mt-2 space-y-1">
            <li>מייל: <a href="mailto:tipool406@gmail.com" className="underline hover:text-[#0F5468]">tipool406@gmail.com</a></li>
            <li>טלפון: <a href="tel:0527906335" className="underline hover:text-[#0F5468]">052-790-6335</a></li>
          </ul>
          <p className="mt-2">הבקשה תטופל בתוך 5 ימי עסקים. ההחזר יבוצע לאמצעי התשלום שבו בוצע החיוב המקורי.</p>
        </section>

        <section>
          <h2 className="text-lg font-extrabold text-stone-900 mb-2">10. אבטחת מידע ותשלומים</h2>
          <p>האתר משתמש בהצפנת SSL ומעבד תשלומים באמצעות חברת סליקה מורשית (Grow / Morning). החברה אינה שומרת ואינה חשופה לפרטי כרטיסי אשראי של משתמשים.</p>
          <p className="mt-2">למידע נוסף על הגנת המידע האישי — ראו את <Link href="/privacy" className="underline hover:text-[#0F5468]">מדיניות הפרטיות</Link>.</p>
        </section>

        <section>
          <h2 className="text-lg font-extrabold text-stone-900 mb-2">11. שימוש הוגן והגנה מפני ניצול לרעה</h2>
          <p>במקרים של:</p>
          <ul className="list-disc pr-6 mt-2 space-y-1">
            <li>ביטולים חוזרים ונשנים</li>
            <li>ניצול שיטתי של מנגנון ההחזרים</li>
            <li>פעילות שאינה בתום לב</li>
          </ul>
          <p className="mt-2">החברה רשאית:</p>
          <ul className="list-disc pr-6 mt-1 space-y-1">
            <li>לסרב להחזר עתידי</li>
            <li>או להגביל את השימוש בשירות</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-extrabold text-stone-900 mb-2">12. מניעת הכחשות עסקה (Chargeback)</h2>
          <p>המשתמש מתחייב לפנות תחילה לשירות הלקוחות של החברה בכל בקשה להחזר או בירור.</p>
          <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-amber-900">
            פתיחת הכחשת עסקה מול חברת האשראי ללא פנייה מוקדמת עשויה להיחשב כהפרת תנאי השימוש.
          </div>
        </section>

        <section>
          <h2 className="text-lg font-extrabold text-stone-900 mb-2">13. שינויים בתקנון</h2>
          <p>החברה רשאית לעדכן תקנון זה מעת לעת. שינויים מהותיים יילוו בהודעה למשתמשים הרשומים. המשך השימוש בשירות לאחר עדכון התקנון מהווה הסכמה לתנאים המעודכנים.</p>
        </section>

        <section>
          <h2 className="text-lg font-extrabold text-stone-900 mb-2">14. יצירת קשר</h2>
          <p>לכל שאלה, בקשה או בירור בנושא תשלומים, ביטולים והחזרים:</p>
          <ul className="list-disc pr-6 mt-2 space-y-1">
            <li>מייל: <a href="mailto:tipool406@gmail.com" className="underline hover:text-[#0F5468]">tipool406@gmail.com</a></li>
            <li>טלפון: <a href="tel:0527906335" className="underline hover:text-[#0F5468]">052-790-6335</a></li>
          </ul>
        </section>

      </div>
    </main>
  );
}
