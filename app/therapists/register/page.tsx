import Link from "next/link";
import type { Metadata } from "next";
import { Sparkles, ArrowLeft, ShieldCheck, Users, BarChart3, MapPin, Activity } from "lucide-react";
import PromotedSignupButton from "./PromotedSignupButton";

export const metadata: Metadata = {
  title: "בחירת מסלול הצטרפות | טיפול חכם",
  description: "בחרו את מסלול ההצטרפות שלכם לפלטפורמת טיפול חכם — מסלול חינמי או מסלול מקודם עם מערכת התאמה חכמה וסטטיסטיקות מתקדמות.",
};

export default function TherapistRegisterPage() {
  return (
    <main
      className="mx-auto max-w-5xl px-5 pb-20"
      dir="rtl"
      style={{ fontFamily: "'Heebo', sans-serif" }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');`}</style>

      <div className="pt-6 mb-4">
        <Link href="/therapists/join" className="text-sm text-stone-500 hover:text-[#0F5468] hover:underline">
          ← חזרה לעמוד המטפלים
        </Link>
      </div>

      {/* STATS DEEP-DIVE */}
      <section>
        <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold tracking-widest uppercase mb-4"
          style={{ background: "#8B2E0A15", color: "#8B2E0A", border: "1px solid #8B2E0A33" }}>
          <Sparkles size={12} />
          בלעדי למסלול המקודם
        </div>

        <h1 className="text-2xl md:text-3xl font-extrabold text-stone-900 mb-3">
          לראשונה — דו&quot;ח שמראה לך <span style={{ color: "#8B2E0A" }}>מי בדיוק מחפש אותך</span>
        </h1>
        <p className="text-stone-700 leading-8 mb-8 max-w-3xl">
          מטפלים עובדים שנים בלי לדעת מאיפה מגיעים הפונים שלהם, מה הם באמת מחפשים, ולמה חלק לא יוצרים קשר. הדו&quot;ח החודשי שלנו חושף בדיוק את זה — תוך שמירה מוחלטת על אנונימיות המטופלים.
        </p>

        <div className="grid gap-4 md:grid-cols-2 mb-6">
          {[
            {
              icon: BarChart3,
              color: "#0F5468",
              title: "כמה אנשים ראו אותך — באמת",
              body: "סך צפיות בפרופיל, כמה אנשים שונים (לא חזרות), כמה פנו אליך בפועל, ואחוז ההמרה מצפייה לפנייה.",
            },
            {
              icon: MapPin,
              color: "#1A7A96",
              title: "מאיזו גיאוגרפיה מגיעים",
              body: "מרכז, השרון, ירושלים, חיפה, צפון, דרום, או אונליין — גרף שמראה לך היכן נמצא הביקוש האמיתי לשירותים שלך.",
            },
            {
              icon: Activity,
              color: "#8B2E0A",
              title: "עם איזה קשיים פונים",
              body: "רגשי, זוגי, התמכרות, תפקודי, התפתחות אישית, טיפול מיני, הדרכת הורים ועוד — פילוח שמראה למה מחפשים דווקא אותך.",
            },
            {
              icon: Users,
              color: "#2A5C3A",
              title: "גילאים ומגדר של הפונים",
              body: 'התפלגות לפי טווחי גיל (18-30, 31-45, 46-60, 60+) ומגדר — כדי שתבין מי הקהל שלך ואיך לפנות אליו נכון.',
            },
          ].map(({ icon: Icon, title, body, color }, i) => (
            <div key={i} className="rounded-2xl border border-[#E8E0D8] bg-white p-5 flex gap-4">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: `${color}15` }}>
                <Icon size={22} style={{ color }} />
              </div>
              <div>
                <h3 className="font-bold text-stone-900 mb-1">{title}</h3>
                <p className="text-sm text-stone-600 leading-6">{body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: "#F0F7FA", border: "1px solid #D8E4E8" }}>
          <ShieldCheck size={18} style={{ color: "#0F5468" }} className="mt-0.5 flex-shrink-0" />
          <p className="text-sm text-stone-700 leading-6">
            <strong>שמירה מוחלטת על פרטיות:</strong> הנתונים מוצגים רק ברמת קבוצות גדולות. קבוצה עם פחות מ-3 אנשים מוצגת כ&quot;אחר&quot; או מוסתרת. אין שום דרך לזהות מטופל ספציפי — גם לא על ידך.
          </p>
        </div>
      </section>

      {/* PLAN COMPARISON + BUTTONS */}
      <section className="mt-14">
        <h2 className="text-2xl font-extrabold text-stone-900 mb-2">בחר/י את המסלול שלך</h2>
        <p className="text-stone-600 mb-6">שני המסלולים כוללים דף פרופיל מקצועי. המסלול המקודם מוסיף מערכת התאמה חכמה וסטטיסטיקות.</p>

        <div className="rounded-2xl overflow-hidden border border-[#E8E0D8] bg-white shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2">

            {/* Free */}
            <div className="p-6 border-b md:border-b-0 md:border-l border-[#E8E0D8] flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-black rounded-full px-2.5 py-1 bg-green-100 text-green-800">חינמי</span>
                <span className="text-xs text-stone-500">ללא עלות</span>
              </div>
              <h3 className="text-lg font-bold text-stone-900 mb-1">מסלול חינמי</h3>
              <p className="text-2xl font-black text-stone-800 mb-4">&#8362;0 <span className="text-sm font-normal text-stone-500">/ לתמיד</span></p>
              <ul className="space-y-2.5 text-sm text-stone-700 leading-6 flex-1">
                <li className="flex items-start gap-2"><span className="text-green-600 font-bold mt-0.5">✓</span> דף פרופיל אישי עם תמונה, ביוגרפיה ותחומי התמחות</li>
                <li className="flex items-start gap-2"><span className="text-green-600 font-bold mt-0.5">✓</span> נגיש לכל מי שמחפש מטפלים באתר</li>
                <li className="flex items-start gap-2"><span className="text-green-600 font-bold mt-0.5">✓</span> חיפוש לפי מיקום — אזור או עיר</li>
                <li className="flex items-start gap-2 text-stone-400"><span className="text-stone-300 mt-0.5">✗</span> מערכת ההתאמה החכמה</li>
                <li className="flex items-start gap-2 text-stone-400"><span className="text-stone-300 mt-0.5">✗</span> סטטיסטיקות וניתוח פרופיל הפונים</li>
              </ul>
              <Link
                href="/therapists/login?mode=register"
                className="mt-6 block w-full text-center rounded-xl border-2 border-stone-300 bg-white px-6 py-3 text-sm font-bold text-stone-700 transition hover:bg-stone-50 hover:border-stone-400"
              >
                הרשמה למסלול החינמי
              </Link>
            </div>

            {/* Promoted */}
            <div className="p-6 relative flex flex-col" style={{ background: "linear-gradient(160deg,#f0f9fb,#e6f4f7)" }}>
              <div className="absolute top-4 left-4">
                <span className="text-xs font-black rounded-full px-2.5 py-1 bg-yellow-400 text-yellow-900">★ מומלץ</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-black rounded-full px-2.5 py-1 bg-yellow-100 text-yellow-800 border border-yellow-300">★ מקודם</span>
              </div>
              <h3 className="text-lg font-bold text-[#1a4a5c] mb-1">מסלול מקודם</h3>
              <p className="text-2xl font-black text-[#0F5468] mb-1">מבצע היכרות — &#8362;120 <span className="text-sm font-normal text-[#0F5468]/70">/ לחודש</span></p>
              <p className="text-xs text-[#0F5468]/60 mb-4">* ללא סיכון — החזר כספי מלא אם לא תקבל פנייה בחודשיים הראשונים</p>
              <ul className="space-y-2.5 text-sm leading-6 flex-1" style={{ color: "#1a4a5c" }}>
                <li className="flex items-start gap-2"><span className="font-bold mt-0.5 text-[#0F5468]">✓</span> כל מה שבמסלול החינמי</li>
                <li className="flex items-start gap-2"><span className="font-bold mt-0.5 text-[#0F5468]">✓</span> הופעה במערכת ההתאמה — מטופלים מופנים לפי הכלי הטיפולי, על בסיס התאמה אישיותית, על בסיס גיל, אזור, שפה, העדפה תרבותית ועוד</li>
                <li className="flex items-start gap-2"><span className="font-bold mt-0.5 text-[#0F5468]">✓</span> דו&quot;ח צפיות, לחיצות ואחוזי המרה</li>
                <li className="flex items-start gap-2"><span className="font-bold mt-0.5 text-[#0F5468]">✓</span> פילוח הפונים: אזור, קושי, גיל ומגדר</li>
                <li className="flex items-start gap-2"><span className="font-bold mt-0.5 text-[#0F5468]">✓</span> השוואה לממוצע המטפלים באתר</li>
              </ul>
              <PromotedSignupButton />
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl p-5 flex items-start gap-3" style={{ background: "#F0F7F2", border: "1px solid #C8DDD0" }}>
          <ShieldCheck size={22} style={{ color: "#2A5C3A" }} className="mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-bold text-stone-900 mb-1">ללא סיכון — החזר כספי מלא</p>
            <p className="text-sm text-stone-700 leading-6">
              במידה ולא תקבל פנייה מתאימה בחודשיים הראשונים לרישום במסלול המקודם — תוכל לקבל את כל הכסף חזרה במהירות ובקלות.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
