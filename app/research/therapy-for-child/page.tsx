import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "איך לבחור פסיכולוג לילד?",
  description: "מה חשוב לבדוק כשבוחרים מטפל לילד — הכשרה, גישה להורים, גיל הילד, ומה לשאול בשיחת ההיכרות.",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "איך לבחור פסיכולוג לילד?",
  "description": "מה חשוב לבדוק כשבוחרים מטפל לילד — הכשרה, גישה להורים, גיל הילד, ומה לשאול בשיחת ההיכרות.",
  "inLanguage": "he",
  "author": { "@type": "Organization", "name": "טיפול חכם" },
  "publisher": { "@type": "Organization", "name": "טיפול חכם", "url": "https://www.mentalytics.co.il" },
  "url": "https://www.mentalytics.co.il/research/therapy-for-child",
};

export default function TherapyForChildPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');`}</style>

      <Link href="/research" className="text-sm text-stone-500 hover:underline mb-6 inline-block">← חזרה למאמרים ומידע שימושי</Link>

      <h1 className="text-3xl font-black text-stone-900 mb-3">איך לבחור פסיכולוג לילד?</h1>
      <p className="text-stone-600 leading-7 mb-8">
        בחירת מטפל לילד היא אחת ההחלטות ההוריות המשמעותיות ביותר. הילד לא תמיד יכול לבטא מה מתאים לו — האחריות נופלת עליכם.
      </p>

      <div className="rounded-2xl p-6 bg-blue-50 border border-blue-200 mb-6">
        <h2 className="font-extrabold text-blue-900 text-xl mb-4">👧 מה שונה בטיפול בילדים?</h2>
        <ul className="space-y-3 text-sm leading-7 text-blue-900">
          <li>• ילדים לא תמיד מסוגלים לבטא את עצמם במילים — המטפל עובד דרך משחק, ציור, סיפורים ופעילות.</li>
          <li>• הקשר עם ההורים הוא חלק מרכזי בטיפול — מטפל טוב ישלב אתכם ולא יבודד אתכם מהתהליך.</li>
          <li>• גיל הילד משמעותי — גיל הרך, ילדים בגיל בית ספר ומתבגרים דורשים גישות שונות לחלוטין.</li>
        </ul>
      </div>

      <div className="rounded-2xl p-6 bg-amber-50 border border-amber-200 mb-6">
        <h2 className="font-extrabold text-amber-900 text-xl mb-4">✅ מה לבדוק במטפל</h2>
        <ul className="space-y-3 text-sm leading-7 text-amber-900">
          <li>• <strong>הכשרה ספציפית לילדים</strong> — פסיכולוג חינוכי או קליני עם התמחות בילדים. לא כל פסיכולוג מטפל בילדים.</li>
          <li>• <strong>ניסיון עם הגיל הרלוונטי</strong> — מטפל בגיל הרך שונה ממטפל במתבגרים.</li>
          <li>• <strong>גישה להורים</strong> — האם יש מפגשי הורים? עד כמה שומרים אתכם בתמונה?</li>
          <li>• <strong>כימיה עם הילד</strong> — הילד לא חייב "לאהוב" את הטיפול, אבל לא אמור לפחד ממנו.</li>
        </ul>
      </div>

      <div className="rounded-2xl p-6 bg-purple-50 border border-purple-200 mb-6">
        <h2 className="font-extrabold text-purple-900 text-xl mb-4">🗣️ שאלות לשאול בשיחת היכרות</h2>
        <ul className="space-y-2 text-sm leading-7 text-purple-900">
          <li>• מה הגישה שלך לטיפול בילדים בגיל הזה?</li>
          <li>• כיצד אתה עובד עם ההורים לאורך התהליך?</li>
          <li>• האם תשתף אותנו בהתקדמות? באיזו תדירות?</li>
          <li>• כמה זמן בדרך כלל לוקח תהליך כזה?</li>
          <li>• מה הסימנים שאנחנו הורים צריכים לשים לב אליהם בין הפגישות?</li>
        </ul>
      </div>

      <div className="rounded-2xl p-6 bg-red-50 border border-red-200 mb-6">
        <h2 className="font-extrabold text-red-900 text-xl mb-4">⚠️ סימני אזהרה</h2>
        <ul className="space-y-3 text-sm leading-7 text-red-900">
          <li>• מטפל שמסרב לדבר אתכם כהורים כלל.</li>
          <li>• הילד יוצא מכל פגישה נסער מאוד וממשיך להיות כך גם שעות לאחר מכן.</li>
          <li>• אחרי חודשיים–שלושה אין שום שינוי ולמטפל אין הסבר.</li>
          <li>• המטפל לא מתאים את הגישה לגיל ולאישיות הילד.</li>
        </ul>
      </div>

      <div className="rounded-2xl p-6 bg-white border border-[#E8E0D8]">
        <h2 className="font-extrabold text-stone-900 text-xl mb-4">מחפשים מטפל לילד?</h2>
        <p className="text-sm leading-7 text-stone-700 mb-4">
          השאלון של טיפול חכם לילדים מתאים מטפל לפי הגיל, הצורך והאזור שלכם.
        </p>
        <Link href="/kids"
          className="inline-flex items-center gap-2 rounded-xl bg-[#2e7d8c] px-5 py-2.5 text-sm font-bold text-white hover:opacity-90">
          לשאלון לילדים ←
        </Link>
      </div>

      <div className="mt-6 rounded-2xl border border-[#E8E0D8] bg-[#f8f5f0] p-6">
        <h2 className="mb-4 text-base font-extrabold text-stone-800">קריאה נוספת</h2>
        <ul className="space-y-2 text-sm">
          <li><Link href="/research/therapist-types" className="text-[#2e7d8c] hover:underline">← סוגי המטפלים בישראל</Link></li>
          <li><Link href="/research/assessments" className="text-[#2e7d8c] hover:underline">← סוגי אבחונים והערכות</Link></li>
          <li><Link href="/research/choosing-therapist" className="text-[#2e7d8c] hover:underline">← מה חשוב לבדוק כשבוחרים מטפל?</Link></li>
          <li><Link href="/research/which-therapy" className="text-[#2e7d8c] hover:underline">← איזה טיפול פסיכולוגי מתאים לי?</Link></li>
        </ul>
      </div>
    </main>
  );
}
