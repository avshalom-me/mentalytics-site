import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "מאמרים ומידע על טיפול נפשי",
  description: "מידע מקצועי בעברית על סוגי טיפולים נפשיים, איך לבחור מטפל, אבחון ADHD, טיפול אונליין ועוד — מותאם לישראל ולמערכת הבריאות הישראלית.",
};

const QUESTIONS = [
  { href: "/research/which-therapy",    icon: "🔍", title: "איזה טיפול פסיכולוגי מתאים לי?",    desc: "מדריך מעשי לבחירת סוג הטיפול הנכון לפי הצורך, האישיות וסגנון החיים.",   img: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=600&h=260&fit=crop&auto=format&q=75" },
  { href: "/research/therapy-for-child", icon: "👧", title: "איך לבחור פסיכולוג לילד?",           desc: "מה חשוב לבדוק, מה לשאול, ואיך יודעים שמצאתם את האיש הנכון לילד שלכם.",  img: "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=600&h=260&fit=crop&auto=format&q=75" },
  { href: "/research/cbt-vs-dynamic",   icon: "⚖️", title: "הבדל בין CBT לטיפול דינמי",          desc: "שתי הגישות הנפוצות ביותר — מה ההבדל בפועל, ומי מתאים לאיזה מטופל?",    img: "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?w=600&h=260&fit=crop&auto=format&q=75" },
  { href: "/research/adhd-adults",      icon: "🧩", title: "אבחון ADHD למבוגרים",               desc: "מה כולל האבחון, איפה עושים אותו, כמה עולה, ומה עושים עם התוצאות.",       img: "https://images.unsplash.com/photo-1517842645767-c639042777db?w=600&h=260&fit=crop&auto=format&q=75" },
];

const TOPICS = [
  { href: "/research/therapist-types",  icon: "👨‍⚕️", title: "סוגי המטפלים בישראל",              desc: 'פסיכולוג קליני, עו"ס קליני, מטפל בהבעה ויצירה — מה ההבדל ומי מתאים למה?', img: "https://images.unsplash.com/photo-1758273241078-8eec353836be?w=600&h=260&fit=crop&auto=format&q=75" },
  { href: "/research/assessments",      icon: "📋", title: "סוגי אבחונים והערכות",              desc: "פסיכודידקטי, פסיכודיאגנוסטי, נוירופסיכולוגי — מתי כל אחד רלוונטי ומה מקבלים בסוף?", img: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&h=260&fit=crop&auto=format&q=75" },
  { href: "/research/online-therapy",   icon: "💻", title: "טיפול אונליין — כן או לא?",          desc: "מחקרים, יתרונות, חסרונות, ומתי טיפול פנים מול פנים הכרחי.",              img: "https://images.unsplash.com/photo-1587614382346-4ec70e388b28?w=600&h=260&fit=crop&auto=format&q=75", imgPosition: "center top" },
  { href: "/research/choosing-therapist",icon: "🤝", title: "איך בוחרים מטפל?",                  desc: "מה לשאול בשיחת היכרות, אילו פרמטרים חשובים, ומה המחקר אומר על ברית טיפולית.", img: "https://images.unsplash.com/photo-1776886099265-6366478b341b?w=600&h=260&fit=crop&auto=format&q=75" },
  { href: "/research/therapy-types",    icon: "🧠", title: "סוגי הטיפולים השונים",               desc: "CBT, דינאמי, EMDR, DBT, ACT ועוד — הסבר נגיש על כל גישה טיפולית ומה מתאים למי.", img: "https://images.unsplash.com/photo-1637245048732-adf1a547835e?w=600&h=260&fit=crop&auto=format&q=75" },
  { href: "/research/faq",              icon: "❓", title: "שאלות נפוצות",                       desc: "כמה עולה טיפול, כמה זמן לוקח, האם קופות חולים מכסות — ותשובות לשאלות נוספות.", img: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=600&h=260&fit=crop&auto=format&q=75" },
];

function ArticleCard({ href, icon, title, desc, img, imgPosition = "center" }: { href: string; icon: string; title: string; desc: string; img: string; imgPosition?: string }) {
  return (
    <Link href={href} className="group block rounded-2xl bg-white transition hover:shadow-md hover:-translate-y-0.5"
      style={{ border: "1px solid var(--line)", boxShadow: "0 2px 10px rgba(61,140,138,.05)", textDecoration: "none", overflow: "hidden" }}>

      {/* Image */}
      <div style={{ height: "168px", overflow: "hidden", background: "var(--surface)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img}
          alt={title}
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: imgPosition, transition: "transform .45s ease", display: "block" }}
          className="group-hover:scale-105"
          loading="lazy"
        />
      </div>

      {/* Content */}
      <div style={{ padding: "20px 22px 22px" }}>
        <div style={{
          width: "40px", height: "40px", borderRadius: "10px",
          background: "var(--teal-pale)", display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: "19px", marginBottom: "12px",
        }}>{icon}</div>
        <h2 style={{ fontSize: "15.5px", fontWeight: 800, color: "var(--text)", marginBottom: "7px" }}
          className="group-hover:underline">{title}</h2>
        <p style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.75 }}>{desc}</p>
        <div style={{
          marginTop: "14px", display: "inline-flex", alignItems: "center", gap: "4px",
          fontSize: "12px", fontWeight: 600, color: "var(--teal)",
          background: "var(--teal-pale)", borderRadius: "50px", padding: "4px 12px",
        }}>קריאה ←</div>
      </div>
    </Link>
  );
}

export default function ResearchHubPage() {
  return (
    <main className="mx-auto max-w-4xl px-5 py-14 pb-20" dir="rtl">

      {/* Header */}
      <div className="mb-12 text-center">
        <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--teal)", textTransform: "uppercase", letterSpacing: ".16em", marginBottom: "10px" }}>
          ידע מקצועי
        </p>
        <h1 style={{ fontSize: "clamp(2rem,4vw,2.8rem)", fontWeight: 900, color: "var(--text)", letterSpacing: "-.02em", marginBottom: "14px" }}>
          מאמרים ומידע שימושי
        </h1>
        <p style={{ fontSize: "16px", color: "var(--text-2)", lineHeight: 1.8, maxWidth: "46ch", margin: "0 auto" }}>
          מידע מקצועי ונגיש על עולם הטיפול הנפשי — כדי שתוכלו להגיע מוכנים ולקבל החלטות מושכלות.
        </p>
      </div>

      {/* Important questions */}
      <div className="mb-5">
        <h2 style={{ fontSize: "18px", fontWeight: 800, color: "var(--text)", marginBottom: "4px" }}>שאלות חשובות</h2>
        <p style={{ fontSize: "13px", color: "var(--muted)" }}>תשובות לשאלות שמטופלים שואלים הכי הרבה</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 mb-12">
        {QUESTIONS.map((t) => <ArticleCard key={t.href} {...t} />)}
      </div>

      {/* Topic cards */}
      <div className="mb-5">
        <h2 style={{ fontSize: "18px", fontWeight: 800, color: "var(--text)", marginBottom: "4px" }}>מידע מקצועי</h2>
        <p style={{ fontSize: "13px", color: "var(--muted)" }}>על סוגי הטיפולים, המטפלים והאבחונים</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 mb-12">
        {TOPICS.map((t) => <ArticleCard key={t.href} {...t} />)}
      </div>

      {/* Academic articles */}
      <div style={{
        background: "var(--surface)", borderRadius: "var(--radius)",
        border: "1px solid var(--line)", padding: "24px 28px",
      }}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 style={{ fontWeight: 800, color: "var(--text)", fontSize: "16px" }}>📚 מאמרים אקדמאיים</h3>
            <p style={{ fontSize: "13px", color: "var(--muted)", marginTop: "4px" }}>
              השאלונים מבוססים על מאות מחקרים — הנה המקורות המלאים.
            </p>
          </div>
          <Link href="/research/academic" style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            background: "var(--teal)", color: "white",
            borderRadius: "50px", padding: "10px 22px",
            fontSize: "14px", fontWeight: 700, transition: "background .2s",
          }} className="hover:bg-[var(--teal-dark)]">
            לרשימת המאמרים ←
          </Link>
        </div>
      </div>

    </main>
  );
}
