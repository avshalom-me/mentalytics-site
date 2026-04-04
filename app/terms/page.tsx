import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "תנאי שימוש | טיפול חכם",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <h1 className="text-3xl font-black text-stone-900 mb-2">תנאי שימוש</h1>
      <p className="text-sm text-stone-400 mb-10">עדכון אחרון: מרץ 2026</p>

      <div className="space-y-8 text-stone-700 leading-7">

        <section>
          <h2 className="text-xl font-bold text-stone-900 mb-2">1. כללי</h2>
          <p>
            ברוכים הבאים ל-טיפול חכם. השימוש באתר ובשירותים מהווה הסכמה לתנאי שימוש אלו. אם אינך מסכים לתנאים, אנא הימנע משימוש בשירות.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-stone-900 mb-2">2. אופי השירות</h2>
          <p>
            טיפול חכם היא מערכת <strong>הכוונה והפניה בלבד</strong>. השאלונים והתוצאות אינם מהווים אבחון רפואי, פסיכולוגי או נפשי, ואינם תחליף לייעוץ מקצועי. ההחלטה הסופית על בחירת מטפל היא של המשתמש בלבד.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-stone-900 mb-2">3. מצב חירום</h2>
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-900 text-sm">
            <strong>חשוב:</strong> אם אתה או אדם קרוב נמצאים במצב של סכנת חיים מיידית — <strong>חייג 101 (מד"א) או 1201 (ער"ן)</strong> מיד. השירות אינו מתאים למצבי חירום נפשי חריפים.
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-stone-900 mb-2">4. הרשמת מטפלים</h2>
          <p>
            מטפלים הנרשמים לשירות מצהירים כי:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm mt-2">
            <li>הפרטים שנמסרו נכונים ומדויקים</li>
            <li>הם בעלי הכשרה מקצועית ורישיון תקף כמצוין בפרופיל</li>
            <li>התעודות שהועלו אמיתיות ושייכות למגיש הבקשה</li>
          </ul>
          <p className="mt-3">
            טיפול חכם שומרת לעצמה את הזכות לדחות, להשהות או להסיר פרופיל של מטפל לפי שיקול דעתה, לרבות במקרה של מידע שגוי.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-stone-900 mb-2">5. אחריות</h2>
          <p>
            טיפול חכם אינה אחראית לאיכות הטיפול הניתן על ידי מטפלים המופיעים במערכת, לנזקים ישירים או עקיפים הנובעים משימוש בשירות, או לתוצאות הטיפול. הקשר הטיפולי הוא בין המטפל למטופל בלבד.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-stone-900 mb-2">6. קניין רוחני</h2>
          <p>
            כל התוכן באתר — טקסטים, עיצוב, שאלונים ואלגוריתמי ההתאמה — הוא רכושה של טיפול חכם ומוגן בזכויות יוצרים. אין להעתיק, לשכפל או להשתמש בתוכן ללא אישור מפורש בכתב.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-stone-900 mb-2">7. דין ושיפוט</h2>
          <p>
            תנאי שימוש אלו כפופים לדין הישראלי. כל סכסוך יידון בבתי המשפט המוסמכים במחוז תל אביב.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-stone-900 mb-2">8. יצירת קשר</h2>
          <p>
            לשאלות ופניות:{" "}
            <a href="mailto:info@mentalytics.co.il" className="text-[#0F5468] underline">info@mentalytics.co.il</a>
          </p>
        </section>

      </div>

      <div className="mt-10">
        <Link href="/" className="text-sm text-stone-500 hover:underline">← חזרה לדף הבית</Link>
      </div>
    </main>
  );
}
