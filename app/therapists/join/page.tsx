import Link from "next/link";
import type { Metadata } from "next";
import { Sparkles, ArrowLeft, CheckCircle2, ShieldCheck, Users, Brain } from "lucide-react";

export const metadata: Metadata = {
  title: "הצטרפות מטפלים | טיפול חכם",
  description:
    'פלטפורמת "טיפול חכם" מחברת בין מטופלים למטפלים על בסיס התאמה פסיכולוגית מדויקת. יותר פניות רלוונטיות, פחות בזבוז זמן. הצטרפות ללא עלות.',
};

const faqs = [
  {
    q: "למי זה מתאים?",
    a: 'לכל מטפל רשום או בעל תעודה מוכרת: פסיכולוגים, עובדים סוציאליים, מטפלים בהבעה ויצירה, פיזיותרפיסטים, ריפוי בעיסוק, קלינאי תקשורת, פסיכיאטרים, יועצים חינוכיים, מטפלים מיניים ומטפלים זוגיים.',
  },
  {
    q: "איך נבנתה מערכת ההתאמות?",
    a: "המערכת נבנתה במשך שנים, על בסיס שילוב של מחקרים בפסיכולוגיה ובהתאמות טיפול, וכן על בסיס ניסיון קליני של מספר מומחים ומטפלים מאסכולות שונות.",
  },
  {
    q: "איפה אני מקבל את המידע הסטטיסטי על סוגי הפניות ומי מקבל אותו?",
    a: 'רק מטפלים במסלול המקודם מקבלים את הסטטיסטיקות יחד עם ניתוח AI של הגורמים וסוגי הפניות. את הסטטיסטיקה והתיאורים אפשר לראות בפרופיל האישי.',
  },
  {
    q: "מה קורה אם לא אקבל פניות?",
    a: "ללא סיכון — אם לא תקבל פנייה מתאימה בחודשיים הראשונים לרישום במסלול המקודם, תוכל לקבל את כל הכסף חזרה במהירות ובקלות.",
  },
  {
    q: "כמה עולה המסלול החינמי?",
    a: "ההרשמה והמסלול החינמי ללא עלות כלל. אתה מקבל דף פרופיל מקצועי שנגיש לכל מי שמחפש מטפלים באתר.",
  },
];

export default function TherapistJoinPage() {
  return (
    <main
      className="mx-auto max-w-5xl px-5 pb-20"
      dir="rtl"
      style={{ fontFamily: "'Heebo', sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');
        details summary::-webkit-details-marker { display: none; }
        details[open] .rotate-plus { transform: rotate(45deg); }
        .rotate-plus { transition: transform .25s ease; display:inline-block; }
      `}</style>

      {/* Login link for existing therapists */}
      <div className="pt-4 flex justify-end">
        <Link
          href="/therapists/login?mode=login"
          className="text-sm text-stone-600 hover:text-[#0F5468] hover:underline"
        >
          כבר רשומ/ה? לכניסה למערכת ←
        </Link>
      </div>

      {/* HERO */}
      <section className="pt-4">
        <div
          className="relative overflow-hidden rounded-[32px] p-8 md:p-12"
          style={{
            background: "linear-gradient(135deg,#F0F7FA 0%,#E6F4F7 50%,#F5E8DC 100%)",
            border: "1px solid #D8E4E8",
            boxShadow: "0 16px 48px rgba(15,84,104,.10)",
          }}
        >
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold tracking-widest uppercase mb-5"
            style={{ background: "#0F546822", color: "#0F5468", border: "1px solid #0F546844" }}>
            <Sparkles size={12} />
            לאנשי מקצוע בתחום הטיפול
          </div>

          <h1 className="text-3xl md:text-4xl font-black leading-tight text-stone-900">
            הגיע הזמן שמטופלים ימצאו אותך — לפי התאמה אמיתית,
            <br className="hidden md:inline" />
            <span style={{ color: "#0F5468" }}> לא לפי מזל.</span>
          </h1>

          <p className="mt-5 text-lg leading-8 text-stone-700 max-w-3xl">
            פלטפורמת <strong>&quot;טיפול חכם&quot;</strong> מחברת בין מטופלים למטפלים על בסיס התאמה פסיכולוגית מדויקת — לא רק חיפוש גנרי.
          </p>

          <ul className="mt-6 space-y-2.5 text-stone-800">
            <li className="flex items-start gap-2"><CheckCircle2 size={20} style={{ color: "#0F5468" }} className="mt-0.5 flex-shrink-0" /> יותר פניות רלוונטיות</li>
            <li className="flex items-start gap-2"><CheckCircle2 size={20} style={{ color: "#0F5468" }} className="mt-0.5 flex-shrink-0" /> פחות בזבוז זמן</li>
            <li className="flex items-start gap-2"><CheckCircle2 size={20} style={{ color: "#0F5468" }} className="mt-0.5 flex-shrink-0" /> התאמה שמבוססת על ההכשרה והכלים שאתה עובד איתם, ועל האישיות הטיפולית שלך</li>
          </ul>

          <div className="mt-8">
            <Link
              href="/therapists/login?mode=register"
              className="inline-flex items-center gap-2 rounded-2xl px-7 py-4 text-base font-bold text-white transition hover:opacity-95 active:scale-95"
              style={{ background: "linear-gradient(135deg,#0F5468,#1A7A96)", boxShadow: "0 8px 20px rgba(15,84,104,.25)" }}
            >
              הצטרף עכשיו ללא עלות
              <ArrowLeft size={18} />
            </Link>
            <p className="mt-3 text-sm text-stone-600">ההרשמה חינמית. שדרוג למסלול מקודם — אופציונלי.</p>
          </div>
        </div>
      </section>

      {/* PLANS TABLE — right after hero */}
      <section className="mt-10">
        <h2 className="text-2xl font-extrabold text-stone-900 mb-2">המסלולים</h2>
        <p className="text-stone-600 mb-6">כל מטפל מתחיל במסלול החינמי. שדרוג למסלול מקודם — אופציונלי.</p>

        <div className="rounded-2xl overflow-hidden border border-[#E8E0D8] bg-white shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2">

            {/* Free */}
            <div className="p-6 border-b md:border-b-0 md:border-l border-[#E8E0D8]">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-black rounded-full px-2.5 py-1 bg-green-100 text-green-800">חינמי</span>
                <span className="text-xs text-stone-500">ללא עלות, לכל מטפל מאושר</span>
              </div>
              <h3 className="text-lg font-bold text-stone-900 mb-4">דף פרופיל אישי</h3>
              <ul className="space-y-2.5 text-sm text-stone-700 leading-6">
                <li className="flex items-start gap-2"><span className="text-green-600 font-bold mt-0.5">✓</span> דף פרופיל אישי עם תמונה, ביוגרפיה ותחומי התמחות</li>
                <li className="flex items-start gap-2"><span className="text-green-600 font-bold mt-0.5">✓</span> נגיש לכל מי שמחפש מטפלים באתר</li>
                <li className="flex items-start gap-2"><span className="text-green-600 font-bold mt-0.5">✓</span> חיפוש לפי מיקום — אזור או עיר</li>
                <li className="flex items-start gap-2 text-stone-400"><span className="text-stone-300 mt-0.5">✗</span> מערכת ההתאמה החכמה</li>
                <li className="flex items-start gap-2 text-stone-400"><span className="text-stone-300 mt-0.5">✗</span> סטטיסטיקות וניתוח פרופיל הפונים</li>
              </ul>
            </div>

            {/* Promoted */}
            <div className="p-6 relative" style={{ background: "linear-gradient(160deg,#f0f9fb,#e6f4f7)" }}>
              <div className="absolute top-4 left-4">
                <span className="text-xs font-black rounded-full px-2.5 py-1 bg-yellow-400 text-yellow-900">★ מומלץ</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-black rounded-full px-2.5 py-1 bg-yellow-100 text-yellow-800 border border-yellow-300">★ מקודם</span>
                <span className="text-xs text-[#0F5468]">מופיע בהתאמות</span>
              </div>
              <div className="mb-4 flex items-baseline gap-2">
                <span className="text-lg font-black text-[#0F5468]">מבצע היכרות — &#8362;120 לחודש</span>
                <span className="text-xs text-[#0F5468]">*</span>
              </div>
              <h3 className="text-lg font-bold text-[#1a4a5c] mb-4">התאמה חכמה + סטטיסטיקות מתקדמות</h3>
              <ul className="space-y-2.5 text-sm leading-6" style={{ color: "#1a4a5c" }}>
                <li className="flex items-start gap-2"><span className="font-bold mt-0.5 text-[#0F5468]">✓</span> כל מה שבמסלול החינמי</li>
                <li className="flex items-start gap-2"><span className="font-bold mt-0.5 text-[#0F5468]">✓</span> הופעה במערכת ההתאמה — מטופלים מופנים לפי הכלי הטיפולי, על בסיס התאמה אישיותית, על בסיס גיל, אזור, שפה, העדפה תרבותית ועוד</li>
                <li className="flex items-start gap-2"><span className="font-bold mt-0.5 text-[#0F5468]">✓</span> דו&quot;ח צפיות, לחיצות ואחוזי המרה — כמה אנשים ראו, כמה פנו</li>
                <li className="flex items-start gap-2"><span className="font-bold mt-0.5 text-[#0F5468]">✓</span> פילוח הפונים אליך: מאיזה אזור, עם איזה קושי, באיזה גיל ומגדר</li>
                <li className="flex items-start gap-2"><span className="font-bold mt-0.5 text-[#0F5468]">✓</span> השוואה לממוצע המטפלים באתר — לדעת איפה אתה עומד</li>
              </ul>
              <p className="mt-4 text-xs text-[#0F5468]/70">* ללא סיכון — החזר כספי מלא אם לא תקבל פנייה בחודשיים הראשונים.</p>
            </div>
          </div>
        </div>

        {/* CTA after table */}
        <div className="mt-6 text-center">
          <Link
            href="/therapists/register"
            className="inline-flex items-center gap-2 rounded-2xl px-8 py-4 text-base font-bold text-white transition hover:opacity-95 active:scale-95"
            style={{ background: "linear-gradient(135deg,#0F5468,#1A7A96)", boxShadow: "0 8px 20px rgba(15,84,104,.25)" }}
          >
            הצטרף לאחד המסלולים
            <ArrowLeft size={18} />
          </Link>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mt-14">
        <h2 className="text-2xl font-extrabold text-stone-900 mb-3">איך זה עובד?</h2>
        <p className="text-stone-700 leading-8 mb-6 max-w-3xl">
          מטופלים פוטנציאליים עוברים שאלון חכם ומודולרי שמנתח את:
        </p>

        <div className="grid gap-4 md:grid-cols-2 mb-6">
          {[
            { icon: Brain, title: "סוג הקושי", body: "רגשי, חברתי, זוגי, משפחתי, התנהגותי ועוד." },
            { icon: Sparkles, title: "התאמה מחקרית", body: "סוג/י הטיפול המתאימים ביותר מחקרית לסוג הקושי המדווח." },
            { icon: Users, title: "העדפות אישיות", body: "סגנון טיפולי, אישיות המטפל ואופי הקשר המקצועי." },
            { icon: ShieldCheck, title: "מאפיינים דמוגרפיים", body: "מגורים, גיל, שפה והעדפות תרבותיות." },
          ].map(({ icon: Icon, title, body }, i) => (
            <div key={i} className="rounded-2xl border border-[#E8E0D8] bg-white p-5 flex gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: "#0F546815" }}>
                <Icon size={20} style={{ color: "#0F5468" }} />
              </div>
              <div>
                <h3 className="font-bold text-stone-900 mb-1">{title}</h3>
                <p className="text-sm text-stone-600 leading-6">{body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl p-6" style={{ background: "#FDF6EE", border: "1px solid #E8DCC8" }}>
          <p className="leading-8 text-stone-800">
            לאחר מכן — המטופלים מקבלים <strong>התאמה למטפלים שמתאימים בדיוק לפרופיל שלהם</strong>, כולל <strong>סוכן AI</strong> שמסביר להם את ההתאמה במפורט במידה ורוצים.
          </p>
          <p className="mt-3 leading-8 text-stone-800">
            <strong>ואתה?</strong> מקבל פניות הרבה יותר מדויקות.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-14">
        <h2 className="text-2xl font-extrabold text-stone-900 mb-6">שאלות ותשובות</h2>
        <div className="space-y-3">
          {faqs.map((item, idx) => (
            <details
              key={idx}
              className="group rounded-2xl bg-white p-5 cursor-pointer"
              style={{ border: "1px solid #EAE0D5", boxShadow: "0 2px 10px rgba(100,60,30,.05)" }}
            >
              <summary className="flex list-none items-center justify-between font-bold text-stone-900">
                <span>{item.q}</span>
                <span
                  className="rotate-plus mr-3 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full leading-none"
                  style={{ background: "#E6F4F7", color: "#0F5468", fontSize: "20px", fontWeight: 300 }}
                >
                  +
                </span>
              </summary>
              <p className="mt-4 leading-7 text-stone-700 border-t border-[#EAE0D5] pt-4">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="mt-14">
        <div
          className="rounded-3xl p-8 md:p-10 text-center"
          style={{
            background: "linear-gradient(135deg,#0F5468 0%,#1A7A96 100%)",
            boxShadow: "0 16px 40px rgba(15,84,104,.20)",
          }}
        >
          <h2 className="text-2xl md:text-3xl font-black text-white mb-3">
            מוכנ/ה להתחיל לקבל פניות רלוונטיות?
          </h2>
          <p className="text-white/90 text-lg mb-6 leading-8">
            ההרשמה חינמית ולוקחת פחות מ-5 דקות.
          </p>
          <Link
            href="/therapists/login?mode=register"
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-4 text-base font-bold text-[#0F5468] transition hover:opacity-95 active:scale-95"
          >
            להרשמה
            <ArrowLeft size={18} />
          </Link>
          <p className="mt-4 text-sm text-white/80">
            כבר רשומ/ה?{" "}
            <Link href="/therapists/login?mode=login" className="underline hover:text-white">
              לכניסה למערכת
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
