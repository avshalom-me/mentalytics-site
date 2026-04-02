import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "הבדל בין CBT לטיפול דינמי",
  description: "שתי הגישות הנפוצות ביותר — מה ההבדל בפועל, ומי מתאים לאיזה מטופל?",
};

export default function CbtVsDynamicPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');`}</style>

      <Link href="/research" className="text-sm text-stone-500 hover:underline mb-6 inline-block">← חזרה למאמרים ומידע שימושי</Link>

      <h1 className="text-3xl font-black text-stone-900 mb-3">הבדל בין CBT לטיפול דינמי</h1>
      <p className="text-stone-600 leading-7 mb-8">
        CBT והטיפול הדינמי הן שתי הגישות הנפוצות ביותר בפסיכולוגיה קלינית — ולעיתים קרובות מטופלים לא בטוחים מה ההבדל ביניהן ומה מתאים להם.
      </p>

      {/* Side by side comparison */}
      <div className="grid md:grid-cols-2 gap-5 mb-8">
        <div className="rounded-2xl p-6 bg-blue-50 border border-blue-200">
          <h2 className="font-extrabold text-blue-900 text-xl mb-4">CBT — טיפול קוגניטיבי-התנהגותי</h2>
          <ul className="space-y-3 text-sm leading-7 text-blue-900">
            <li>• <strong>מיקוד:</strong> ההווה — מחשבות, רגשות והתנהגויות כיום.</li>
            <li>• <strong>אופי:</strong> מובנה, עם כלים מעשיים ומשימות בין הפגישות.</li>
            <li>• <strong>משך:</strong> לרוב 12–20 מפגשים (ממוקד).</li>
            <li>• <strong>תפקיד המטפל:</strong> אקטיבי — מלמד, מכוון, נותן כלים.</li>
            <li>• <strong>מחקר:</strong> הגישה המוכחת ביותר מחקרית.</li>
          </ul>
        </div>

        <div className="rounded-2xl p-6 bg-purple-50 border border-purple-200">
          <h2 className="font-extrabold text-purple-900 text-xl mb-4">טיפול דינמי / פסיכואנליטי</h2>
          <ul className="space-y-3 text-sm leading-7 text-purple-900">
            <li>• <strong>מיקוד:</strong> שורשים — דפוסים ישנים, ילדות, קשרים.</li>
            <li>• <strong>אופי:</strong> פתוח, אסוציאטיבי — "אמור כל מה שעולה לך".</li>
            <li>• <strong>משך:</strong> לרוב ארוך יותר — חצי שנה עד שנים.</li>
            <li>• <strong>תפקיד המטפל:</strong> מקשיב, מפרש, משקף.</li>
            <li>• <strong>מחקר:</strong> יעיל לבעיות אישיות מורכבות ולטווח ארוך.</li>
          </ul>
        </div>
      </div>

      <div className="rounded-2xl p-6 bg-emerald-50 border border-emerald-200 mb-6">
        <h2 className="font-extrabold text-emerald-900 text-xl mb-4">🎯 מי מתאים לאיזה טיפול?</h2>
        <div className="space-y-4 text-sm leading-7 text-emerald-900">
          <div>
            <strong>CBT מתאים יותר אם:</strong>
            <ul className="mt-1 mr-4 space-y-1">
              <li>• יש לך בעיה ספציפית — חרדה, פוביה, OCD, דיכאון אפיזודי.</li>
              <li>• אתה מעדיף מבנה וכלים מעשיים שניתן ליישם מחוץ לפגישה.</li>
              <li>• הזמן או התקציב מוגבלים.</li>
              <li>• אתה מחפש שינוי מהיר יחסית.</li>
            </ul>
          </div>
          <div>
            <strong>טיפול דינמי מתאים יותר אם:</strong>
            <ul className="mt-1 mr-4 space-y-1">
              <li>• יש דפוסים חוזרים ביחסים, בעבודה, בקשרים אינטימיים.</li>
              <li>• תחושה שהבעיה עמוקה יותר ממה שנראה על פני השטח.</li>
              <li>• רוצה להבין את עצמך לעומק, לא רק לפתור בעיה.</li>
              <li>• הקשיים מתחברים לחוויות ילדות ומשפחה.</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="rounded-2xl p-6 bg-white border border-[#E8E0D8]">
        <h2 className="font-extrabold text-stone-900 text-xl mb-3">האמת: לא חייבים לבחור</h2>
        <p className="text-sm leading-7 text-stone-700">
          מטפלים רבים עובדים בגישה אינטגרטיבית — משלבים כלים מ-CBT עם עומק דינמי. הגורם המנבא הטוב ביותר להצלחה הוא איכות הקשר עם המטפל, לא הגישה הספציפית.
        </p>
      </div>
    </main>
  );
}
