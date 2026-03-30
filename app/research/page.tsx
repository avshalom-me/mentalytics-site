import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "מאמרים ומידע שימושי",
  description: "מידע מקצועי על סוגי טיפולים, בחירת מטפל, אבחונים, טיפול אונליין ועוד — בעברית, מותאם לישראל.",
};

const TOPICS = [
  {
    href: "/research/therapist-types",
    icon: "👨‍⚕️",
    title: "סוגי המטפלים בישראל",
    desc: "פסיכולוג קליני, עו\"ס קליני, מטפל בהבעה ויצירה — מה ההבדל ומי מתאים למה?",
    color: "#FEF3EB",
    border: "#F4C8A4",
    tag: "#B06030",
  },
  {
    href: "/research/assessments",
    icon: "📋",
    title: "סוגי אבחונים והערכות",
    desc: "פסיכודידקטי, פסיכודיאגנוסטי, נוירופסיכולוגי — מתי כל אחד רלוונטי ומה מקבלים בסוף?",
    color: "#EBF5F1",
    border: "#A8D4C0",
    tag: "#2A6B50",
  },
  {
    href: "/research/online-therapy",
    icon: "💻",
    title: "טיפול אונליין — כן או לא?",
    desc: "מחקרים, יתרונות, חסרונות, ומתי טיפול פנים מול פנים הכרחי.",
    color: "#EDF2FC",
    border: "#B4C8F0",
    tag: "#1A4A8A",
  },
  {
    href: "/research/choosing-therapist",
    icon: "🤝",
    title: "איך בוחרים מטפל?",
    desc: "מה לשאול בשיחת היכרות, אילו פרמטרים חשובים, ומה המחקר אומר על ברית טיפולית.",
    color: "#F5EEF8",
    border: "#D4B4E8",
    tag: "#6A3A8A",
  },
  {
    href: "/research/therapy-types",
    icon: "🧠",
    title: "סוגי הטיפולים השונים",
    desc: "CBT, דינאמי, EMDR, DBT, ACT ועוד — הסבר נגיש על כל גישה טיפולית ומה מתאים למי.",
    color: "#FDF6EE",
    border: "#F0D4A8",
    tag: "#8B4A10",
  },
  {
    href: "/research/faq",
    icon: "❓",
    title: "שאלות נפוצות",
    desc: "כמה עולה טיפול, כמה זמן לוקח, האם קופות חולים מכסות — ותשובות לשאלות נוספות.",
    color: "#F0F8F0",
    border: "#B0D8B0",
    tag: "#2A6A2A",
  },
];

export default function ResearchHubPage() {
  return (
    <main className="mx-auto max-w-4xl px-5 py-12 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');`}</style>

      {/* Header */}
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-black text-stone-900 mb-3">מאמרים ומידע שימושי</h1>
        <p className="text-stone-600 leading-7 max-w-xl mx-auto">
          מידע מקצועי ונגיש על עולם הטיפול הנפשי — כדי שתוכלו להגיע מוכנים ולקבל החלטות מושכלות.
        </p>
      </div>

      {/* Topic cards */}
      <div className="grid gap-5 md:grid-cols-2">
        {TOPICS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="group rounded-2xl p-6 transition hover:shadow-md hover:-translate-y-0.5"
            style={{
              background: t.color,
              border: `1px solid ${t.border}`,
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
              textDecoration: "none",
            }}
          >
            <div className="text-4xl mb-3">{t.icon}</div>
            <h2 className="text-lg font-extrabold text-stone-900 mb-2 group-hover:underline">{t.title}</h2>
            <p className="text-sm leading-6 text-stone-700">{t.desc}</p>
            <div
              className="mt-4 inline-flex items-center gap-1 text-xs font-semibold rounded-full px-3 py-1"
              style={{ background: t.tag + "22", color: t.tag }}
            >
              קריאה ←
            </div>
          </Link>
        ))}
      </div>

      {/* Academic articles section */}
      <div
        className="mt-14 rounded-2xl p-6"
        style={{ background: "#F7F5F2", border: "1px solid #E0D8D0" }}
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-extrabold text-stone-800 text-lg">📚 מאמרים אקדמאיים</h3>
            <p className="text-sm text-stone-500 mt-1">
              השאלונים מבוססים על מאות מחקרים — הנה המקורות המלאים.
            </p>
          </div>
          <Link
            href="/research/academic"
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#4A6FA5,#2C3E7A)" }}
          >
            לרשימת המאמרים ←
          </Link>
        </div>
      </div>
    </main>
  );
}
