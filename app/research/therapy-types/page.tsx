import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "סוגי הטיפולים השונים — CBT, דינמי, DBT, EMDR ועוד",
  description: "מדריך מקיף לסוגי הטיפולים הנפשיים — CBT, דינמי, DBT, EMDR, ACT ועוד. מה ההבדל, למי מתאים כל טיפול, וכמה זמן לוקח.",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "סוגי הטיפולים השונים",
  "description": "מדריך מקיף לסוגי הטיפולים הנפשיים — CBT, דינמי, DBT, EMDR, ACT ועוד.",
  "inLanguage": "he",
  "author": { "@type": "Organization", "name": "טיפול חכם" },
  "publisher": { "@type": "Organization", "name": "טיפול חכם", "url": "https://www.tipolchacham.co.il" },
  "url": "https://www.tipolchacham.co.il/research/therapy-types",
};

const THERAPIES = [
  {
    name: "טיפול דינאמי / פסיכואנליטי",
    short: "דינאמי",
    icon: "🌊",
    color: "#EDF2FC", border: "#B4C8F0",
    focus: "חקירת הדפוסים הלא-מודעים, חוויות ילדות והשפעתן על ההווה",
    suitable: "דיכאון כרוני, קשיים ביחסים, הפרעות אישיות, רצון להבנה עמוקה",
    duration: "ארוך טווח — חודשים עד שנים",
    style: "שיחות חופשיות, מיעוט הנחיות, עומק רגשי",
  },
  {
    name: "CBT — טיפול קוגניטיבי-התנהגותי",
    short: "CBT",
    icon: "🔄",
    color: "#EBF5F1", border: "#A8D4C0",
    focus: "זיהוי ושינוי דפוסי חשיבה שליליים והתנהגויות בעייתיות",
    suitable: "חרדה, דיכאון, OCD, פוביות, PTSD, קשיי שינה",
    duration: "קצר-בינוני — 12-20 פגישות בדרך כלל",
    style: "מובנה, עם שיעורי בית, ממוקד בהווה",
  },
  {
    name: "DBT — טיפול דיאלקטי-התנהגותי",
    short: "DBT",
    icon: "⚖️",
    color: "#F5EEF8", border: "#D4B4E8",
    focus: "ויסות רגשי, סבילות למצוקה, מיינדפולנס ויחסים בינאישיים",
    suitable: "הפרעת אישיות גבולית, ויסות רגשי קשה, מחשבות אובדניות חוזרות",
    duration: "לרוב כשנה, משולב עם קבוצה",
    style: "שיטתי, כולל מיומנויות מעשיות, לרוב גם פרטני וגם קבוצתי",
  },
  {
    name: "EMDR — עיבוד תנועות עיניים",
    short: "EMDR",
    icon: "👁️",
    color: "#FEF3EB", border: "#F4C8A4",
    focus: "עיבוד זיכרונות טראומטיים דרך גירוי דו-צדדי",
    suitable: "PTSD, טראומה, תאונות, אלימות, אובדן",
    duration: "ממוקד יחסית — אפשרי בעשרות פגישות",
    style: "מובנה, עם פרוטוקול ספציפי, פחות שיחתי",
  },
  {
    name: "ACT — טיפול בקבלה ומחויבות",
    short: "ACT",
    icon: "🧭",
    color: "#F0F8F0", border: "#B0D8B0",
    focus: "קבלת רגשות קשים מבלי להיאבק בהם, ופעולה לפי ערכים אישיים",
    suitable: "חרדה, דיכאון, כאב כרוני, שחיקה",
    duration: "קצר-בינוני",
    style: "מבוסס מיינדפולנס, פחות מאשר CBT — מחפש קבלה, לא שינוי מחשבות",
  },
  {
    name: "טיפול משפחתי וזוגי",
    short: "משפחתי/זוגי",
    icon: "👨‍👩‍👧",
    color: "#FDF6EE", border: "#F0D4A8",
    focus: "דינמיקות משפחתיות, תקשורת זוגית, קונפליקטים",
    suitable: "קשיי זוגיות, גירושים, קשיי הורות, משברים משפחתיים",
    duration: "משתנה",
    style: "הפגישות כוללות יותר מאדם אחד",
  },
  {
    name: "הדרכת הורים",
    short: "הדרכת הורים",
    icon: "👶",
    color: "#EBF5F1", border: "#A8D4C0",
    focus: "כלים להורות, תגובה לקשיים של הילד, חיזוק הקשר",
    suitable: "קשיי התנהגות, חרדה, ADHD, גיל הרך",
    duration: "10-20 פגישות בדרך כלל",
    style: "הדרכה מעשית עם כלים ספציפיים",
  },
  {
    name: "טיפול בהבעה ויצירה",
    short: "הבעה ויצירה",
    icon: "🎨",
    color: "#F5EEF8", border: "#D4B4E8",
    focus: "ביטוי רגשי דרך אמנות, מוזיקה, תנועה, דרמה",
    suitable: "ילדים, טראומה, קושי בביטוי מילולי",
    duration: "משתנה",
    style: "פחות מילולי — הגוף והיצירה הם הכלי",
  },
  {
    name: "טיפול COG-FUN",
    short: "COG-FUN",
    icon: "⚙️",
    color: "#EDF2FC", border: "#B4C8F0",
    focus: "פיתוח תפקודים ניהוליים ומיומנויות יומיומיות",
    suitable: "ילדים עם ADHD, קשיי ארגון ותכנון",
    duration: "ממוקד — בדרך כלל 20 פגישות",
    style: "משימות מעשיות עם ריפוי בעיסוק",
  },
];

export default function TherapyTypesPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');`}</style>

      <Link href="/research" className="text-sm text-stone-500 hover:underline mb-6 inline-block">← חזרה למאמרים ומידע שימושי</Link>

      <h1 className="text-3xl font-black text-stone-900 mb-3">סוגי הטיפולים השונים</h1>
      <p className="text-stone-600 leading-7 mb-10">
        לא כל הטיפולים זהים. הגישה הטיפולית משפיעה על אופי הפגישות, מה שתחוו בתוכן, ומה הסיכוי להצלחה עבור הקושי הספציפי שלכם.
      </p>

      <div className="space-y-4">
        {THERAPIES.map((t, i) => (
          <div key={i} className="rounded-2xl p-5 border" style={{ background: t.color, borderColor: t.border, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">{t.icon}</span>
              <div>
                <h2 className="font-extrabold text-stone-900 text-base">{t.name}</h2>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-white/70 p-3">
                <div className="font-semibold text-stone-600 text-xs uppercase tracking-wide mb-1">מיקוד</div>
                <div className="text-stone-800">{t.focus}</div>
              </div>
              <div className="rounded-xl bg-white/70 p-3">
                <div className="font-semibold text-stone-600 text-xs uppercase tracking-wide mb-1">מתאים ל</div>
                <div className="text-stone-800">{t.suitable}</div>
              </div>
              <div className="rounded-xl bg-white/70 p-3">
                <div className="font-semibold text-stone-600 text-xs uppercase tracking-wide mb-1">משך</div>
                <div className="text-stone-800">{t.duration}</div>
              </div>
              <div className="rounded-xl bg-white/70 p-3">
                <div className="font-semibold text-stone-600 text-xs uppercase tracking-wide mb-1">סגנון</div>
                <div className="text-stone-800">{t.style}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-2xl p-5 bg-amber-50 border border-amber-200 text-sm text-amber-900 leading-7">
        <strong>חשוב לזכור:</strong> אין גישה "הכי טובה" באופן אוניברסלי. ההתאמה בין הגישה לאדם, לקושי ולסגנון האישי — היא שקובעת.
      </div>

      <div className="mt-6 rounded-2xl border border-[#E8E0D8] bg-[#f8f5f0] p-6">
        <h2 className="mb-4 text-base font-extrabold text-stone-800">קריאה נוספת</h2>
        <ul className="space-y-2 text-sm">
          <li><Link href="/research/cbt-vs-dynamic" className="text-[#2e7d8c] hover:underline">← הבדל בין CBT לטיפול דינמי</Link></li>
          <li><Link href="/research/which-therapy" className="text-[#2e7d8c] hover:underline">← איזה טיפול פסיכולוגי מתאים לי?</Link></li>
          <li><Link href="/research/therapist-types" className="text-[#2e7d8c] hover:underline">← סוגי המטפלים בישראל</Link></li>
          <li><Link href="/research/choosing-therapist" className="text-[#2e7d8c] hover:underline">← מה חשוב לבדוק כשבוחרים מטפל?</Link></li>
        </ul>
      </div>
    </main>
  );
}
