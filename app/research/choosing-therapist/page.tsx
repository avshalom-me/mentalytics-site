import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "מה חשוב לבדוק כשבוחרים מטפל?",
  description: "6 קריטריונים לבחירת מטפל נפשי — הכשרה, התמחות, כימיה, גישה טיפולית, לוגיסטיקה ועלות. ועוד שאלות לשאול בשיחת ההיכרות.",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "מה חשוב לבדוק כשבוחרים מטפל?",
  "description": "6 קריטריונים לבחירת מטפל נפשי — הכשרה, התמחות, כימיה, גישה טיפולית, לוגיסטיקה ועלות.",
  "inLanguage": "he",
  "author": { "@type": "Organization", "name": "טיפול חכם" },
  "publisher": { "@type": "Organization", "name": "טיפול חכם", "url": "https://www.mentalytics.co.il" },
  "url": "https://www.mentalytics.co.il/research/choosing-therapist",
};

const CRITERIA = [
  {
    icon: "🎓",
    title: "הכשרה ורישיון",
    desc: "ודאו שלמטפל יש רישיון ממשלתי מוכר. אפשר לבקש לראות תעודה או לחפש ברשם המוסמכים של משרד הבריאות.",
  },
  {
    icon: "🎯",
    title: "התמחות בתחום הרלוונטי",
    desc: "מטפל שמתמחה בטראומה, בחרדה, בהתמכרויות — יביא ניסיון וכלים ספציפיים. שאלו ישירות: כמה מקרים כאלה טיפלת בהם?",
  },
  {
    icon: "💬",
    title: "כימיה ותחושת בטחון",
    desc: "מחקרים מראים שהברית הטיפולית היא המנבא החזק ביותר להצלחת הטיפול — לפעמים אפילו יותר מהשיטה עצמה. תחושת הבטחון עם המטפל קריטית.",
  },
  {
    icon: "🛠️",
    title: "גישה טיפולית",
    desc: "האם הגישה מתאימה לאופי שלכם? מי שרוצה כלים מעשיים ומשימות — יתאים לו CBT. מי שרוצה חקירה עמוקה — דינאמי. אפשר לשאול מראש.",
  },
  {
    icon: "📍",
    title: "נגישות לוגיסטית",
    desc: "מיקום, שעות, מחיר — אלה לא 'עניינים שטחיים'. מטפל שקשה להגיע אליו יביא לביטולים ולנשירה. הלוגיסטיקה חשובה.",
  },
  {
    icon: "💰",
    title: "עלות והסדרים",
    desc: "בדקו אם המטפל עובד עם קופות החולים, ביטוח לאומי, ביטוחים פרטיים — לפני שמתחילים, לא אחרי.",
  },
];

const QUESTIONS = [
  "מה הניסיון שלך עם [הקושי הספציפי שלי]?",
  "איזו גישה טיפולית אתה משתמש/ת בה?",
  "כמה זמן בדרך כלל לוקח טיפול כזה?",
  "מה קורה בין פגישות? יש שיעורי בית?",
  "איך נדע שהטיפול מתקדם?",
  "מה עלות הפגישה? מה קורה אם אני מבטל/ת?",
  "האם אתה עובד/ת עם [קופת חולים / ביטוח]?",
];

export default function ChoosingTherapistPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');`}</style>

      <Link href="/research" className="text-sm text-stone-500 hover:underline mb-6 inline-block">← חזרה למאמרים ומידע שימושי</Link>

      <h1 className="text-3xl font-black text-stone-900 mb-3">מה חשוב לבדוק כשבוחרים מטפל?</h1>
      <p className="text-stone-600 leading-7 mb-10">
        בחירת מטפל היא אחת ההחלטות החשובות שתקבלו. המחקר מראה שהתאמה טובה בין מטופל למטפל מכפילה את הסיכוי להצלחת הטיפול.
      </p>

      {/* Criteria */}
      <div className="space-y-4 mb-10">
        {CRITERIA.map((c, i) => (
          <div key={i} className="flex gap-4 rounded-2xl bg-white p-5 border border-[#E8E0D8]" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <div className="text-3xl flex-shrink-0">{c.icon}</div>
            <div>
              <h3 className="font-bold text-stone-900 mb-1">{c.title}</h3>
              <p className="text-sm leading-6 text-stone-700">{c.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Questions */}
      <div className="rounded-2xl p-6 bg-[#F5F0FF] border border-[#D4C4F0]">
        <h2 className="font-extrabold text-[#4A2A8A] text-xl mb-4">שאלות לשאול בשיחת ההיכרות</h2>
        <ul className="space-y-2">
          {QUESTIONS.map((q, i) => (
            <li key={i} className="flex items-start gap-2 text-sm leading-6 text-[#4A2A8A]">
              <span className="mt-1 w-5 h-5 rounded-full bg-[#4A2A8A] text-white text-xs flex items-center justify-center flex-shrink-0">{i + 1}</span>
              {q}
            </li>
          ))}
        </ul>
      </div>

      {/* Red flags */}
      <div className="mt-6 rounded-2xl p-6 bg-red-50 border border-red-200">
        <h2 className="font-extrabold text-red-900 text-xl mb-4">🚩 Red flags — מתי לחפש מטפל אחר</h2>
        <ul className="space-y-2 text-sm leading-7 text-red-900">
          <li>• המטפל מדבר יותר ממה שהוא מקשיב בפגישות הראשונות.</li>
          <li>• אתם מרגישים שפוטים במקום שנשמעים.</li>
          <li>• המטפל מסרב לענות על שאלות על הגישה שלו.</li>
          <li>• תחושת אי-נוחות שלא פוחתת אחרי 3-4 פגישות.</li>
          <li>• חצייה של גבולות מקצועיים (יחסים כפולים, שיתוף מידע אישי מופרז).</li>
        </ul>
      </div>

      <div className="mt-6 rounded-2xl p-5 bg-emerald-50 border border-emerald-200 text-sm text-emerald-900 leading-7">
        <strong>חשוב:</strong> מותר לנסות מטפל אחר אם הפגישות הראשונות לא מרגישות נכונות. זה לא כישלון — זה חלק מהתהליך.
      </div>

      <div className="mt-6 rounded-2xl border border-[#E8E0D8] bg-[#f8f5f0] p-6">
        <h2 className="mb-4 text-base font-extrabold text-stone-800">קריאה נוספת</h2>
        <ul className="space-y-2 text-sm">
          <li><Link href="/research/therapist-types" className="text-[#2e7d8c] hover:underline">← סוגי המטפלים בישראל</Link></li>
          <li><Link href="/research/which-therapy" className="text-[#2e7d8c] hover:underline">← איזה טיפול פסיכולוגי מתאים לי?</Link></li>
          <li><Link href="/research/online-therapy" className="text-[#2e7d8c] hover:underline">← טיפול אונליין — כן או לא?</Link></li>
          <li><Link href="/research/faq" className="text-[#2e7d8c] hover:underline">← שאלות נפוצות על טיפול נפשי</Link></li>
        </ul>
      </div>
    </main>
  );
}
