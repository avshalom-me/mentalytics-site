import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "איזה טיפול פסיכולוגי מתאים לי?",
  description: "מדריך מעשי לבחירת סוג הטיפול הנכון לפי הצורך, האישיות וסגנון החיים.",
};

export default function WhichTherapyPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');`}</style>

      <Link href="/research" className="text-sm text-stone-500 hover:underline mb-6 inline-block">← חזרה למאמרים ומידע שימושי</Link>

      <h1 className="text-3xl font-black text-stone-900 mb-3">איזה טיפול פסיכולוגי מתאים לי?</h1>
      <p className="text-stone-600 leading-7 mb-8">
        אחת השאלות הנפוצות ביותר — ואין לה תשובה אחת. הטיפול הנכון תלוי בצורך, באישיות שלך ובמה שאתה מחפש מהתהליך.
      </p>

      <div className="rounded-2xl p-6 bg-amber-50 border border-amber-200 mb-6">
        <h2 className="font-extrabold text-amber-900 text-xl mb-4">🎯 לפי מה בוחרים?</h2>
        <ul className="space-y-3 text-sm leading-7 text-amber-900">
          <li>• <strong>מה מביא אותך לטיפול?</strong> — חרדה, דיכאון, טראומה, קשיים ביחסים, משבר חיים? לכל קושי יש גישות שנחקרו יותר.</li>
          <li>• <strong>מה הסגנון שמתאים לך?</strong> — יש מי שאוהב מבנה וכלים מעשיים, ויש מי שמעדיף שיחה פתוחה ועומק.</li>
          <li>• <strong>כמה זמן יש לך?</strong> — טיפולים ממוקדים (CBT, EMDR) יכולים להיות קצרים יחסית. טיפול דינמי הוא בדרך כלל ארוך יותר.</li>
          <li>• <strong>מה הציפייה שלך?</strong> — להרגיש טוב מהר, להבין את עצמך לעומק, לשנות דפוסי התנהגות?</li>
        </ul>
      </div>

      <div className="rounded-2xl p-6 bg-blue-50 border border-blue-200 mb-6">
        <h2 className="font-extrabold text-blue-900 text-xl mb-4">📋 מדריך מהיר לפי הצורך</h2>
        <div className="space-y-4 text-sm leading-7 text-blue-900">
          <div>
            <strong>חרדה, פוביות, OCD, פאניקה</strong>
            <p>CBT היא הגישה המוכחת ביותר. EMDR יעיל לחרדה הקשורה בטראומה. DBT מומלצת למי שהחרדה מלווה ברגשות עצימים.</p>
          </div>
          <div>
            <strong>דיכאון</strong>
            <p>CBT ו-ACT מוכחות מחקרית. טיפול דינמי מתאים למי שהדיכאון מושרש בדפוסים ישנים. תרופות בשילוב טיפול — לעיתים קרובות האפקטיבי ביותר.</p>
          </div>
          <div>
            <strong>טראומה ואירועי חיים קשים</strong>
            <p>EMDR ו-Trauma-focused CBT הן הגישות המובילות. חשוב מאוד שהמטפל מוסמך ספציפית לטראומה.</p>
          </div>
          <div>
            <strong>קשיים ביחסים ודפוסים חוזרים</strong>
            <p>טיפול דינמי או פסיכואנליטי מתאים — עוסק בשורשי הדפוסים. טיפול זוגי (EFT) אם הקושי הוא עם בן/בת הזוג.</p>
          </div>
          <div>
            <strong>הפרעות אכילה, התמכרויות</strong>
            <p>DBT ו-CBT מותאמות. חשוב מאוד מטפל בעל ניסיון ספציפי בתחום.</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl p-6 bg-emerald-50 border border-emerald-200 mb-6">
        <h2 className="font-extrabold text-emerald-900 text-xl mb-4">💡 מה שהמחקר אומר</h2>
        <ul className="space-y-3 text-sm leading-7 text-emerald-900">
          <li>• הגורם המשפיע ביותר על הצלחת הטיפול <strong>אינו סוג הטיפול</strong> — אלא איכות הברית הטיפולית בין מטפל למטופל.</li>
          <li>• מטפל שאתה מרגיש איתו בנוח ומובן — שווה יותר מהגישה הנכונה "על הנייר".</li>
          <li>• אם אחרי 4–6 מפגשים אין שום תחושת שינוי — כדאי לדבר על כך עם המטפל.</li>
        </ul>
      </div>

      <div className="rounded-2xl p-6 bg-white border border-[#E8E0D8]">
        <h2 className="font-extrabold text-stone-900 text-xl mb-4">רוצה עזרה בבחירה?</h2>
        <p className="text-sm leading-7 text-stone-700 mb-4">
          השאלון של טיפול חכם מנתח את הצרכים שלך ומציע התאמה אישית — כולל סוג הטיפול וסוג המטפל המומלץ.
        </p>
        <Link href="/adults"
          className="inline-flex items-center gap-2 rounded-xl bg-[#2e7d8c] px-5 py-2.5 text-sm font-bold text-white hover:opacity-90">
          מלא את השאלון ←
        </Link>
      </div>
    </main>
  );
}
