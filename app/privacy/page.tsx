import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "מדיניות פרטיות | Mentalytics",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <h1 className="text-3xl font-black text-stone-900 mb-2">מדיניות פרטיות</h1>
      <p className="text-sm text-stone-400 mb-10">עדכון אחרון: מרץ 2026</p>

      <div className="space-y-8 text-stone-700 leading-7">

        <section>
          <h2 className="text-xl font-bold text-stone-900 mb-2">1. כללי</h2>
          <p>
            Mentalytics ("השירות", "אנחנו") מפעילה אתר אינטרנט המאפשר לאנשים לקבל הכוונה טיפולית ולמטפלים להירשם ולהופיע במערכת ההתאמה. מדיניות זו מתארת אילו נתונים נאספים, כיצד הם נשמרים ואיך הם מוגנים.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-stone-900 mb-2">2. נתוני מטופלים / משתמשי השאלון</h2>
          <p>
            מילוי השאלון אינו מצריך הרשמה. <strong>אנחנו לא שומרים</strong> את תשובות השאלון, את תוצאות ההכוונה, ולא כל מידע מזהה על מי שממלא אותו. תוצאות השאלון מחושבות באופן מיידי ואינן נשמרות בשרתינו.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-stone-900 mb-2">3. נתוני מטפלים</h2>
          <p className="mb-2">מטפלים הנרשמים לשירות מוסרים מרצונם את הפרטים הבאים:</p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>שם מלא, כתובת דוא"ל, מספר טלפון</li>
            <li>תמונת פרופיל (אופציונלי)</li>
            <li>תעודות ורישיונות מקצועיים</li>
            <li>מידע מקצועי: תחומי הכשרה, גישה טיפולית, אזורי פעילות</li>
          </ul>
          <p className="mt-3">
            מידע זה נשמר בשרתי Supabase (אירוח בענן מאובטח) ומשמש אך ורק למטרת הצגת המטפל במערכת ההתאמה. התעודות נשמרות לצורך אימות ואינן מוצגות לציבור.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-stone-900 mb-2">4. שיתוף מידע עם צדדים שלישיים</h2>
          <p>
            אנחנו לא מוכרים, מעבירים או משתפים מידע אישי עם גורמים חיצוניים, למעט:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm mt-2">
            <li>ספקי תשתית הכרחיים (Supabase לאחסון, Vercel לאירוח) — בכפוף למדיניות הפרטיות שלהם</li>
            <li>כשנדרש על פי חוק</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-stone-900 mb-2">5. עוגיות (Cookies)</h2>
          <p>
            האתר משתמש בעוגיות טכניות בלבד הנחוצות לתפקוד האתר. איננו משתמשים בעוגיות שיווקיות או מעקב.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-stone-900 mb-2">6. זכויות המשתמש</h2>
          <p>
            מטפל רשום רשאי בכל עת לבקש עיון, תיקון או מחיקה של הנתונים שלו. לפניות:{" "}
            <a href="mailto:privacy@mentalytics.co.il" className="text-[#0F5468] underline">privacy@mentalytics.co.il</a>
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-stone-900 mb-2">7. אבטחת מידע</h2>
          <p>
            אנחנו נוקטים באמצעי אבטחה סבירים להגנה על המידע, כולל הצפנת תקשורת (HTTPS), בקרת גישה מוגבלת ואחסון מאובטח בענן. עם זאת, אין אבטחה מוחלטת ואיננו יכולים להבטיח אבטחה מלאה בכל מצב.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-stone-900 mb-2">8. שינויים במדיניות</h2>
          <p>
            אנחנו עשויים לעדכן מדיניות זו מעת לעת. שינויים מהותיים יפורסמו בדף זה עם עדכון תאריך הגרסה.
          </p>
        </section>

      </div>

      <div className="mt-10">
        <Link href="/" className="text-sm text-stone-500 hover:underline">← חזרה לדף הבית</Link>
      </div>
    </main>
  );
}
