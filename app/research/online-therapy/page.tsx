import Link from "next/link";

export default function OnlineTherapyPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');`}</style>

      <Link href="/research" className="text-sm text-stone-500 hover:underline mb-6 inline-block">← חזרה למאמרים ומידע שימושי</Link>

      <h1 className="text-3xl font-black text-stone-900 mb-3">טיפול אונליין — כן או לא?</h1>
      <p className="text-stone-600 leading-7 mb-8">
        מחקרים רבים מהשנים האחרונות מראים שטיפול אונליין יעיל לא פחות מטיפול פנים מול פנים ברוב ההפרעות הנפשיות. אבל לא תמיד.
      </p>

      {/* What the research says */}
      <div className="rounded-2xl p-6 bg-emerald-50 border border-emerald-200 mb-6">
        <h2 className="font-extrabold text-emerald-900 text-xl mb-4">✅ מה המחקר אומר לטובת אונליין</h2>
        <ul className="space-y-3 text-sm leading-7 text-emerald-900">
          <li>• <strong>יעילות שקולה:</strong> מטה-אנליזות מרובות מצאו אפקטיביות דומה ל-CBT, DBT ואינטרוונציות ממוקדות.</li>
          <li>• <strong>נגישות גבוהה:</strong> אנשים מפריפריה, עם מוגבלויות ניידות, חרדה חברתית גבוהה — מגיעים לטיפול שאחרת לא היו מגיעים אליו.</li>
          <li>• <strong>עלות נמוכה יותר:</strong> לרוב זול יותר כי המטפל חוסך בהוצאות מרפאה.</li>
          <li>• <strong>גמישות:</strong> פגישה מהבית, מהעבודה, מכל מקום — פחות ביטולים.</li>
          <li>• <strong>כלי דיגיטליים:</strong> אפשרות לשלב אפליקציות, הקלטות ומשימות בין הפגישות.</li>
        </ul>
      </div>

      {/* When it's not suitable */}
      <div className="rounded-2xl p-6 bg-red-50 border border-red-200 mb-6">
        <h2 className="font-extrabold text-red-900 text-xl mb-4">⚠️ מתי עדיף פנים מול פנים</h2>
        <ul className="space-y-3 text-sm leading-7 text-red-900">
          <li>• <strong>מחשבות אובדניות פעילות</strong> — דורש הערכת סיכון ישירה.</li>
          <li>• <strong>ילדים קטנים (מתחת לגיל 8)</strong> — הקשר הגופני חשוב יותר.</li>
          <li>• <strong>טיפול בהבעה ויצירה</strong> — חלק מהשיטות דורשות נוכחות פיזית.</li>
          <li>• <strong>ריפוי בעיסוק ופיזיותרפיה</strong> — לרוב לא ניתן לביצוע אונליין.</li>
          <li>• <strong>סביבה ביתית לא בטוחה</strong> — אם אין פרטיות בבית.</li>
          <li>• <strong>הפרעות פסיכוטיות חריפות</strong> — דורשות מגע ישיר.</li>
        </ul>
      </div>

      {/* Practical tips */}
      <div className="rounded-2xl p-6 bg-blue-50 border border-blue-200 mb-6">
        <h2 className="font-extrabold text-blue-900 text-xl mb-4">💡 טיפים לטיפול אונליין מוצלח</h2>
        <ul className="space-y-3 text-sm leading-7 text-blue-900">
          <li>• מצאו מקום שקט עם פרטיות — לא בסלון עם הילדים.</li>
          <li>• השתמשו באוזניות לאיכות שמע טובה.</li>
          <li>• בדקו שהחיבור לאינטרנט יציב לפני הפגישה.</li>
          <li>• טיפול אונליין דורש אותה רמת מחויבות כמו פגישה פיזית.</li>
        </ul>
      </div>

      {/* Questions to ask */}
      <div className="rounded-2xl p-6 bg-white border border-[#E8E0D8]">
        <h2 className="font-extrabold text-stone-900 text-xl mb-4">שאלות לשאול את המטפל לפני שמתחילים</h2>
        <ul className="space-y-2 text-sm leading-7 text-stone-700">
          <li>• האם יש לך ניסיון בטיפול אונליין?</li>
          <li>• באיזה פלטפורמה נעבוד? (Zoom, Teams, פלטפורמה ייעודית?)</li>
          <li>• מה קורה אם יש בעיית טכנית באמצע פגישה?</li>
          <li>• האם ניתן לעבור לפגישה פיזית אם יתעורר הצורך?</li>
        </ul>
      </div>
    </main>
  );
}
