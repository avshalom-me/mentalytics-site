import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles, Users, LayoutDashboard, BarChart3, MapPin, Activity, ShieldCheck, Brain, ArrowLeft, FileDown, Globe, TrendingUp } from "lucide-react";
import PrintButton from "./PrintButton";

// עמוד הסבר ציבורי למרכזים טיפוליים — משמש גם כפרוספקט להדפסה/שמירה כ-PDF
// (עמוד אחד, ידידותי להדפסה) לשליחה אחרי שיחת מכירה. אין תמחור מספרי כאן —
// המחיר נקבע אישית פר מרכז בהצעה הייעודית.

export const metadata: Metadata = {
  title: "מרכזים טיפוליים — פלטפורמת טיפול חכם",
  description:
    "פתרון למרכזים טיפוליים: כל מטפלי המרכז במערכת ההתאמות החכמה, פורטל ניהול מרכזי, ודוח סטטיסטיקות מרוכז — איזה מטופלים מחפשים אתכם ובאזורכם.",
};

const included: { icon: typeof Users; title: string; body: string }[] = [
  {
    icon: Users,
    title: "כל מטפלי המרכז במערכת ההתאמות החכמה",
    body: "מטופלים שממלאים את שאלון ההתאמה מופנים למטפלי המרכז לפי סוג הטיפול, אזור, גיל, שפה והעדפות אישיות — פניות מדויקות, לא סתם חשיפה.",
  },
  {
    icon: TrendingUp,
    title: "המטפלים שלכם בראש רשימת האזור",
    body: "כל מטפלי המרכז מקודמים אוטומטית למקומות הראשונים ברשימת המטפלים של האזור שלכם — מעל המטפלים החינמיים — כך שמי שמחפש באזור רואה אתכם קודם.",
  },
  {
    icon: Globe,
    title: "עמוד מרכז מקודם בגוגל",
    body: "עמוד ציבורי משלכם באתר, מותאם למנועי חיפוש (SEO), עם המידע על המרכז, שמות המנהלים והצוות, יצירת קשר — וכל המטפלים של המרכז מרוכזים במקום אחד ומקושרים לפרופילים שלהם.",
  },
  {
    icon: LayoutDashboard,
    title: "מערכת ניהול מטפלים — בשליטת המרכז",
    body: "מנהלי המרכז מוסיפים ועורכים את פרופילי המטפלים ישירות מהפורטל: פרטים, תמונה, תעודות והתמחויות. כל פרופיל עובר אישור קצר של צוות טיפול חכם — ומרגע האישור נכנס אוטומטית למערכת ההתאמות.",
  },
  {
    icon: BarChart3,
    title: "דוח סטטיסטיקות חודשי מרוכז",
    body: "איזה סוגי מטופלים מחפשים את המרכז שלכם ובאזורכם, מאיפה הם מגיעים, ולמה חלק לא יוצרים קשר — נתונים מצטברים לכל המרכז וגם פר-מטפל, תוך שמירה מוחלטת על אנונימיות המטופלים.",
  },
  {
    icon: ShieldCheck,
    title: "ללא התחייבות — ביטול בכל עת",
    body: "אין התחייבות לתקופה. אפשר לסיים את ההתקשרות בכל שלב, כולל במהלך חודשי המתנה, בלי קנסות ובלי בירוקרטיה.",
  },
];

const statCards: { icon: typeof BarChart3; color: string; title: string; body: string }[] = [
  { icon: BarChart3, color: "#0F5468", title: "כמה אנשים ראו אתכם — באמת", body: "צפיות בפרופילים, כמה אנשים שונים, כמה פנו בפועל, ואחוז ההמרה מצפייה לפנייה." },
  { icon: MapPin, color: "#1A7A96", title: "מאיזו גיאוגרפיה מגיעים", body: "מרכז, השרון, ירושלים, חיפה, צפון, דרום או אונליין — היכן הביקוש האמיתי." },
  { icon: Activity, color: "#8B2E0A", title: "עם איזה קשיים פונים", body: "רגשי, זוגי, התמכרות, תפקודי, מיני, הדרכת הורים ועוד — למה מחפשים דווקא אתכם." },
  { icon: Users, color: "#2A5C3A", title: "גילאים ומגדר של הפונים", body: "התפלגות לפי טווחי גיל ומגדר — מי הקהל שלכם ואיך לפנות אליו נכון." },
];

export default function CentersInfoPage() {
  return (
    <main
      className="mx-auto max-w-3xl px-5 py-10 pb-20 print:py-4"
      dir="rtl"
      style={{ fontFamily: "'Heebo', sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');
        @media print {
          @page { size: A4; margin: 12mm; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>

      {/* לוגו + פעולות */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <img src="/logo.svg" alt="טיפול חכם" style={{ height: "42px", width: "auto" }} />
        <div className="print:hidden flex items-center gap-2">
          <a href="/prospectus-centers.pdf" target="_blank"
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-95"
            style={{ background: "var(--teal)" }}>
            <FileDown size={16} /> פרוספקט PDF
          </a>
          <PrintButton />
        </div>
      </div>

      {/* Hero */}
      <section className="mb-10">
        <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-widest"
          style={{ background: "var(--teal-pale)", color: "var(--teal-dark)", border: "1px solid var(--teal-mid)" }}>
          <Sparkles size={12} /> למרכזים טיפוליים
        </div>
        <h1 className="mt-4 text-3xl font-black leading-tight text-stone-900 md:text-4xl">
          כל מטפלי המרכז שלכם — מותאמים למטופלים הנכונים,{" "}
          <span style={{ color: "var(--teal)" }}>עם ניהול וסטטיסטיקות במקום אחד.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-stone-700">
          <strong>&quot;טיפול חכם&quot;</strong> היא פלטפורמה ישראלית שנבנתה על ידי פסיכולוגים וחוקרים. מטופלים עוברים שאלון חכם ואינטייק אוטומטי,
          ומופנים למטפלים או למרכזים הטיפוליים המתאימים ביותר. המרכז שלכם מקבל חשיפה במערכת ההתאמות, מערכת לניהול פרופילי המטפלים, ודוח חודשי שחושף מי מחפש אתכם — במחיר חודשי פשוט: <strong>מחיר מוזל לכל מטפל × מספר המטפלים</strong>, שנסגר איתכם אישית בשיחת ההתאמה.
        </p>
      </section>

      {/* מה המרכז מקבל */}
      <section className="mb-10">
        <h2 className="mb-5 text-xl font-black text-stone-900">מה המרכז מקבל</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {included.map(({ icon: Icon, title, body }, i) => (
            <div key={i} className="rounded-2xl border border-[#E8E0D8] bg-white p-5">
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "var(--teal-pale)" }}>
                <Icon size={20} style={{ color: "var(--teal)" }} />
              </div>
              <h3 className="mb-1 font-bold text-stone-900">{title}</h3>
              <p className="text-sm leading-6 text-stone-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* דוח סטטיסטיקות — הרחבה */}
      <section className="mb-10 rounded-3xl border border-[#E8E0D8] bg-white p-6 print:break-inside-avoid">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase"
          style={{ background: "#8B2E0A15", color: "#8B2E0A", border: "1px solid #8B2E0A33" }}>
          <BarChart3 size={12} /> דוח סטטיסטיקות חודשי
        </div>
        <h2 className="mb-2 text-xl font-black text-stone-900">איזה מטופלים מחפשים את המרכז שלכם — ובאזור שלכם</h2>
        <p className="mb-5 text-sm leading-7 text-stone-600">
          מרכזים עובדים שנים בלי לדעת מאיפה מגיעים הפונים ומה הם באמת מחפשים. הדוח החודשי חושף בדיוק את זה, מרוכז לכל המרכז.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {statCards.map(({ icon: Icon, color, title, body }, i) => (
            <div key={i} className="flex gap-3 rounded-2xl border border-[#E8E0D8] bg-[#FCFBF9] p-4">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: `${color}15` }}>
                <Icon size={18} style={{ color }} />
              </div>
              <div>
                <h4 className="mb-0.5 text-sm font-bold text-stone-900">{title}</h4>
                <p className="text-xs leading-5 text-stone-600">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* איך זה עובד */}
      <section className="mb-10">
        <h2 className="mb-5 text-xl font-black text-stone-900">איך זה עובד</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: LayoutDashboard, n: "1", title: "אתם מוסיפים את המטפלים", body: "מנהלי המרכז מזינים את פרופילי המטפלים בפורטל — פרטים, תמונה, תעודות והתמחויות. אישור קצר שלנו, והפרופיל באוויר." },
            { icon: Brain, n: "2", title: "מטופל ממלא שאלון", body: "שאלון חכם מנתח את סוג הקושי, ההעדפות והמיקום." },
            { icon: Users, n: "3", title: "התאמה מדויקת", body: "המערכת מפנה אותו למטפל המתאים במרכז שלכם — לפי תחום, גיל, שפה ואזור." },
            { icon: BarChart3, n: "4", title: "אתם רואים הכול", body: "פורטל ניהול וסטטיסטיקות מרוכזות של כל הפניות והצפיות — לכל המרכז ופר-מטפל." },
          ].map(({ icon: Icon, n, title, body }) => (
            <div key={n} className="rounded-2xl border border-[#E8E0D8] bg-white p-5">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full text-sm font-black text-white" style={{ background: "var(--teal)" }}>{n}</span>
                <Icon size={18} style={{ color: "var(--teal-dark)" }} />
              </div>
              <h3 className="mb-1 font-bold text-stone-900">{title}</h3>
              <p className="text-sm leading-6 text-stone-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="rounded-3xl p-6 text-center print:break-inside-avoid"
        style={{ background: "linear-gradient(135deg,#F0F7FA 0%,#E6F4F7 50%,#F5E8DC 100%)", border: "1px solid #D8E4E8" }}>
        <h2 className="text-2xl font-black text-stone-900">רוצים הצעה למרכז שלכם?</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-stone-700">
          המחיר נקבע אישית בשיחת התאמה — מחיר מוזל לכל מטפל, לפי מספר המטפלים במרכז — ואפשר להתחיל עם חודשי התנסות במתנה שבהם לא נגבה תשלום כלל. נשמח לתאם שיחה ולהכין לכם הצעה מותאמת.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <a href="mailto:admin@getmentalytics.com"
            className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-base font-bold text-white transition hover:opacity-95"
            style={{ background: "linear-gradient(135deg,var(--teal-dark),var(--teal))" }}>
            admin@getmentalytics.com <ArrowLeft size={16} />
          </a>
          <Link href="/centers/login" className="print:hidden text-sm font-bold text-stone-600 underline hover:text-stone-800">
            כבר לקוחות? כניסה לפורטל
          </Link>
        </div>
        <p className="mt-4 text-xs text-stone-500">טיפול חכם — Mentalytics · פלטפורמה שנבנתה על ידי פסיכולוגים וחוקרים</p>
      </section>
    </main>
  );
}
