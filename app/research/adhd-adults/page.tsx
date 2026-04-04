import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "אבחון ADHD למבוגרים",
  description: "מה כולל האבחון, איפה עושים אותו, כמה עולה, ומה עושים עם התוצאות.",
};

export default function AdhdAdultsPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');`}</style>

      <Link href="/research" className="text-sm text-stone-500 hover:underline mb-6 inline-block">← חזרה למאמרים ומידע שימושי</Link>

      <h1 className="text-3xl font-black text-stone-900 mb-3">אבחון ADHD למבוגרים</h1>
      <p className="text-stone-600 leading-7 mb-8">
        רבים מגיעים לאבחון ADHD רק בבגרות — לאחר שנים של תחושת "משהו לא עובד" בלי הסבר. האבחון יכול להיות נקודת מפנה משמעותית.
      </p>

      <div className="rounded-2xl p-6 bg-emerald-50 border border-emerald-200 mb-6">
        <h2 className="font-extrabold text-emerald-900 text-xl mb-4">🔍 מי עושה את האבחון?</h2>
        <ul className="space-y-3 text-sm leading-7 text-emerald-900">
          <li>• <strong>פסיכולוג קליני או חינוכי</strong> עם הכשרה באבחון נוירופסיכולוגי — זה הנפוץ ביותר.</li>
          <li>• <strong>פסיכיאטר</strong> — יכול לאבחן ולרשום תרופות, אך לרוב האבחון פחות מעמיק.</li>
          <li>• <strong>נוירולוג</strong> — פחות נפוץ לאבחון ADHD בלבד.</li>
          <li>• חשוב: האבחון צריך להיעשות על ידי <strong>מוסמך מוכר</strong> — לא כל "בדיקת ADHD" מקוונת מהווה אבחון תקף.</li>
        </ul>
      </div>

      <div className="rounded-2xl p-6 bg-blue-50 border border-blue-200 mb-6">
        <h2 className="font-extrabold text-blue-900 text-xl mb-4">📋 מה כולל האבחון?</h2>
        <ul className="space-y-3 text-sm leading-7 text-blue-900">
          <li>• <strong>ראיון קליני מעמיק</strong> — שאלות על תפקוד בעבר ובהווה, ילדות, לימודים, עבודה, קשרים.</li>
          <li>• <strong>שאלונים סטנדרטיים</strong> — כגון Conners, CAARS, Brown ADD Rating Scales.</li>
          <li>• <strong>מבחנים קוגניטיביים</strong> — בדיקת קשב, זיכרון עבודה ומהירות עיבוד.</li>
          <li>• <strong>שלילת אבחנות אחרות</strong> — חרדה, דיכאון, הפרעת שינה יכולות לחקות ADHD.</li>
          <li>• לעיתים — <strong>דיווח מגורם נוסף</strong> (בן/בת זוג, הורה) על התנהגות בסביבות שונות.</li>
        </ul>
      </div>

      <div className="rounded-2xl p-6 bg-amber-50 border border-amber-200 mb-6">
        <h2 className="font-extrabold text-amber-900 text-xl mb-4">💰 עלות ומשך</h2>
        <ul className="space-y-3 text-sm leading-7 text-amber-900">
          <li>• <strong>משך:</strong> לרוב 2–4 מפגשים של שעה–שעתיים כל אחד.</li>
          <li>• <strong>עלות:</strong> 1,500–4,000 ₪ בפרטי, תלוי במאבחן ובהיקף.</li>
          <li>• <strong>קופות חולים:</strong> ניתן לפנות לרופא משפחה לקבל הפניה לפסיכיאטר — חלק מהקופות מממנות הערכה ראשונית.</li>
          <li>• <strong>תוצר:</strong> דוח אבחוני כתוב — מסמך רשמי שניתן להציג למעסיק, לאוניברסיטה, לצבא.</li>
        </ul>
      </div>

      <div className="rounded-2xl p-6 bg-purple-50 border border-purple-200 mb-6">
        <h2 className="font-extrabold text-purple-900 text-xl mb-4">⚡ מה עושים אחרי האבחון?</h2>
        <ul className="space-y-3 text-sm leading-7 text-purple-900">
          <li>• <strong>תרופות:</strong> פסיכיאטר יכול לרשום ריטלין/קונצרטה/אדרל — יעיל מאוד לחלק מהמקרים.</li>
          <li>• <strong>CBT ממוקד ADHD:</strong> עוזר בניהול זמן, ארגון ורגולציה רגשית.</li>
          <li>• <strong>Coaching:</strong> אימון ADHD לתפקוד יומיומי — לא פסיכולוגיה, אבל שימושי.</li>
          <li>• <strong>התאמות:</strong> הדוח פותח דלתות — זמן נוסף בבחינות, התאמות בעבודה.</li>
          <li>• זכרו: אבחון ADHD אינו גזר דין — הוא <strong>הסבר וכלי</strong> לחיות טוב יותר.</li>
        </ul>
      </div>

      <div className="rounded-2xl p-6 bg-white border border-[#E8E0D8]">
        <h2 className="font-extrabold text-stone-900 text-xl mb-3">מחפשים מאבחן?</h2>
        <p className="text-sm leading-7 text-stone-700 mb-4">
          במאגר המטפלים של טיפול חכם תוכלו לסנן לפי "אבחון נוירו-פסיכולוגי" ולמצוא מאבחנים מוסמכים באזורכם.
        </p>
        <Link href="/therapists"
          className="inline-flex items-center gap-2 rounded-xl bg-[#2e7d8c] px-5 py-2.5 text-sm font-bold text-white hover:opacity-90">
          למאגר המטפלים ←
        </Link>
      </div>
    </main>
  );
}
