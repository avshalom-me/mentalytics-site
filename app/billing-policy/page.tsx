import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "מדיניות חיוב, ביטול והחזרים | טיפול חכם",
  description: "מדיניות חיוב, ביטול מנוי והחזרים כספיים עבור מטפלים בפלטפורמת טיפול חכם.",
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

      <h1 className="mt-6 text-3xl font-black text-stone-900 mb-2">מדיניות חיוב, ביטול והחזרים</h1>
      <p className="text-sm text-stone-500 mb-10">טיפול חכם — תנאים למנוי מטפלים</p>

      <div className="space-y-8 text-sm leading-7 text-stone-700">

        <section>
          <h2 className="text-lg font-extrabold text-stone-900 mb-2">1. חיוב חודשי</h2>
          <p>השירות ניתן במסגרת מנוי חודשי מתחדש.</p>
          <p>החיוב מתבצע אחת לחודש באמצעות אמצעי התשלום שהוזן בעת ההרשמה.</p>
        </section>

        <section>
          <h2 className="text-lg font-extrabold text-stone-900 mb-2">2. ביטול מנוי</h2>
          <p>ניתן לבטל את המנוי בכל עת.</p>
          <p>עם זאת: הביטול ייכנס לתוקף מתום תקופת החיוב הנוכחית. אם בוצע חיוב לחודש חדש — השירות ימשיך עד סוף אותו חודש, ולא יבוצע חיוב נוסף לאחר מכן.</p>
        </section>

        <section>
          <h2 className="text-lg font-extrabold text-stone-900 mb-2">3. מדיניות החזרים (מודל ייחודי למטפלים)</h2>
          <p>מטפל זכאי לבקש החזר כספי בגין חודש מסוים, בכפוף לתנאים הבאים:</p>
          <ul className="list-disc pr-6 mt-2 space-y-1">
            <li>לא התקבלה אף פנייה דרך המערכת במהלך אותו חודש.</li>
            <li>הבקשה מוגשת במהלך החודש העוקב בלבד.</li>
            <li>לאחר סיום החודש העוקב — לא ניתן להגיש בקשת החזר עבור אותו חודש.</li>
          </ul>
          <div className="mt-3 rounded-xl bg-stone-50 border border-stone-200 px-4 py-3">
            <p className="font-semibold text-stone-800">לדוגמה:</p>
            <p>עבור חודש ינואר ניתן לבקש החזר עד סוף פברואר בלבד.</p>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-extrabold text-stone-900 mb-2">4. אופן הגשת בקשת החזר</h2>
          <p>בקשות החזר יש להגיש באמצעות:</p>
          <ul className="list-disc pr-6 mt-2 space-y-1">
            <li>טופס ייעודי באתר</li>
            <li>או פנייה מסודרת למייל התמיכה</li>
          </ul>
          <p className="mt-2">הבקשה תטופל בתוך מספר ימי עסקים.</p>
        </section>

        <section>
          <h2 className="text-lg font-extrabold text-stone-900 mb-2">5. שימוש הוגן והגנה מפני ניצול לרעה</h2>
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
          <h2 className="text-lg font-extrabold text-stone-900 mb-2">6. מניעת הכחשות עסקה (Chargeback)</h2>
          <p>המשתמש מתחייב לפנות תחילה לשירות הלקוחות של החברה בכל בקשה להחזר או בירור.</p>
          <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-amber-900">
            פתיחת הכחשת עסקה מול חברת האשראי ללא פנייה מוקדמת עשויה להיחשב כהפרת תנאי השימוש.
          </div>
        </section>
      </div>
    </main>
  );
}
