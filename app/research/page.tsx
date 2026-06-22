import Link from "next/link";
import type { Metadata } from "next";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

export const metadata: Metadata = {
  title: "מאמרים ומידע על טיפול נפשי",
  description: "מידע מקצועי בעברית על סוגי טיפולים נפשיים, איך לבחור מטפל, אבחון ADHD, טיפול אונליין ועוד — מותאם לישראל ולמערכת הבריאות הישראלית.",
};

// Refresh the hub periodically so newly-approved community articles appear.
export const revalidate = 300;

type CommunityItem = { slug: string; title: string; summary: string; topic: string | null; author: string };

async function getCommunityArticles(): Promise<CommunityItem[]> {
  const { data } = await supabaseAdmin
    .from("therapist_articles")
    .select("slug, title, summary, topic, therapists(full_name)")
    .eq("status", "approved")
    .order("approved_at", { ascending: false })
    .limit(40);
  return (data ?? []).map((r) => {
    const t = Array.isArray(r.therapists) ? r.therapists[0] : r.therapists;
    return {
      slug: r.slug,
      title: r.title,
      summary: r.summary,
      topic: r.topic,
      author: t?.full_name ?? "מטפל/ת",
    };
  });
}

const QUESTIONS = [
  { href: "/research/which-therapy",    icon: "🔍", title: "איזה טיפול פסיכולוגי מתאים לי?",    desc: "מדריך מעשי לבחירת סוג הטיפול הנכון לפי הצורך, האישיות וסגנון החיים.",   img: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=600&h=260&fit=crop&auto=format&q=75" },
  { href: "/research/therapy-for-child", icon: "👧", title: "איך לבחור פסיכולוג לילד?",           desc: "מה חשוב לבדוק, מה לשאול, ואיך יודעים שמצאתם את האיש הנכון לילד שלכם.",  img: "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=600&h=260&fit=crop&auto=format&q=75" },
  { href: "/research/cbt-vs-dynamic",   icon: "⚖️", title: "הבדל בין CBT לטיפול דינמי",          desc: "שתי הגישות הנפוצות ביותר — מה ההבדל בפועל, ומי מתאים לאיזה מטופל?",    img: "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?w=600&h=260&fit=crop&auto=format&q=75" },
  { href: "/research/adhd-adults",      icon: "🧩", title: "אבחון ADHD למבוגרים",               desc: "מה כולל האבחון, איפה עושים אותו, כמה עולה, ומה עושים עם התוצאות.",       img: "https://images.unsplash.com/photo-1517842645767-c639042777db?w=600&h=260&fit=crop&auto=format&q=75" },
  { href: "/research/faq",              icon: "❓", title: "שאלות נפוצות",                       desc: "כמה עולה טיפול, כמה זמן לוקח, האם קופות חולים מכסות — ותשובות לשאלות נוספות.", img: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=600&h=260&fit=crop&auto=format&q=75" },
];

const TOPICS = [
  { href: "/research/therapist-patient-match", icon: "🔗", title: "הקושי בהתאמה בין מטפל למטופל", desc: "מה המחקר אומר על התאמה אישיותית בין מטפל למטופל — גישת ההשלמה מול גישת הדמיון, ולמה זה כל כך משפיע על הצלחת הטיפול.", img: "https://images.unsplash.com/photo-1604881991720-f91add269bed?w=600&h=260&fit=crop&auto=format&q=75" },
  { href: "/research/therapist-types",  icon: "👨‍⚕️", title: "סוגי המטפלים בישראל",              desc: 'פסיכולוג קליני, עו"ס קליני, מטפל בהבעה ויצירה — מה ההבדל ומי מתאים למה?', img: "https://images.unsplash.com/photo-1758273241078-8eec353836be?w=600&h=260&fit=crop&auto=format&q=75" },
  { href: "/research/assessments",      icon: "📋", title: "סוגי אבחונים והערכות",              desc: "פסיכודידקטי, פסיכודיאגנוסטי, נוירופסיכולוגי — מתי כל אחד רלוונטי ומה מקבלים בסוף?", img: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&h=260&fit=crop&auto=format&q=75" },
  { href: "/research/psychodiagnostic", icon: "🔬", title: "אבחון פסיכודיאגנוסטי",              desc: "לראות את התמונה המלאה: מהו האבחון המעמיק ביותר שיש, מה הוא כולל ומתי הוא חיוני.", img: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=600&h=260&fit=crop&auto=format&q=75" },
  { href: "/research/autism-assessment", icon: "🗣️", title: "אבחון תקשורת ואוטיזם",             desc: "מהו אבחון תקשורת, כיצד הוא מתבצע, ומדוע אבחון כפול ומקצועי הוא קריטי.", img: "https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=600&h=260&fit=crop&auto=format&q=75" },
  { href: "/research/online-therapy",   icon: "💻", title: "טיפול אונליין — כן או לא?",          desc: "מחקרים, יתרונות, חסרונות, ומתי טיפול פנים מול פנים הכרחי.",              img: "https://images.unsplash.com/photo-1587614382346-4ec70e388b28?w=600&h=260&fit=crop&auto=format&q=75", imgPosition: "center top" },
  { href: "/research/choosing-therapist",icon: "🤝", title: "איך בוחרים מטפל?",                  desc: "מה לשאול בשיחת היכרות, אילו פרמטרים חשובים, ומה המחקר אומר על ברית טיפולית.", img: "https://images.unsplash.com/photo-1776886099265-6366478b341b?w=600&h=260&fit=crop&auto=format&q=75" },
  { href: "/research/therapy-types",    icon: "🧠", title: "סוגי הטיפולים השונים",               desc: "CBT, דינאמי, EMDR, DBT, ACT ועוד — הסבר נגיש על כל גישה טיפולית ומה מתאים למי.", img: "https://images.unsplash.com/photo-1637245048732-adf1a547835e?w=600&h=260&fit=crop&auto=format&q=75" },
  { href: "/research/child-emotional-developmental", icon: "🧒", title: "היבטים פיזיולוגיים בגיל הרך ופרשנות רגשית שגויה", desc: "כיצד קשיים פיזיולוגיים — עצירות תפקודית, עיבוד חושי, עיכוב שפתי ואתגרים מוטוריים — מקבלים ביטוי כקושי רגשי לכאורה.", img: "https://images.unsplash.com/photo-1576765608622-067973a79f53?w=600&h=260&fit=crop&auto=format&q=75" },
];

function ArticleCard({ href, title, desc, img, imgPosition = "center" }: { href: string; title: string; desc: string; img: string; imgPosition?: string }) {
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

function CommunityCard({ slug, title, summary, topic, author }: CommunityItem) {
  return (
    <Link href={`/research/community/${slug}`} className="group block rounded-2xl bg-white transition hover:shadow-md hover:-translate-y-0.5"
      style={{ border: "1px solid var(--line)", boxShadow: "0 2px 10px rgba(61,140,138,.05)", textDecoration: "none", padding: "20px 22px" }}>
      {topic && (
        <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--teal)", letterSpacing: ".06em", marginBottom: "8px" }}>{topic}</div>
      )}
      <h3 style={{ fontSize: "15.5px", fontWeight: 800, color: "var(--text)", marginBottom: "7px" }}
        className="group-hover:underline">{title}</h3>
      {summary && <p style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.75 }}>{summary}</p>}
      <div style={{ marginTop: "12px", fontSize: "12px", color: "var(--faint)" }}>מאת {author}</div>
    </Link>
  );
}

export default async function ResearchHubPage() {
  const community = await getCommunityArticles();
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

      {/* Topic cards */}
      <div className="mb-5">
        <h2 style={{ fontSize: "18px", fontWeight: 800, color: "var(--text)", marginBottom: "4px" }}>מידע מקצועי</h2>
        <p style={{ fontSize: "13px", color: "var(--muted)" }}>על סוגי הטיפולים, המטפלים והאבחונים</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 mb-12">
        {TOPICS.map((t) => <ArticleCard key={t.href} {...t} />)}
      </div>

      {/* Important questions */}
      <div className="mb-5">
        <h2 style={{ fontSize: "18px", fontWeight: 800, color: "var(--text)", marginBottom: "4px" }}>שאלות חשובות</h2>
        <p style={{ fontSize: "13px", color: "var(--muted)" }}>תשובות לשאלות שמטופלים שואלים הכי הרבה</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 mb-12">
        {QUESTIONS.map((t) => <ArticleCard key={t.href} {...t} />)}
      </div>

      {/* Community articles — written by site therapists */}
      {community.length > 0 && (
        <>
          <div className="mb-5">
            <h2 style={{ fontSize: "18px", fontWeight: 800, color: "var(--text)", marginBottom: "4px" }}>מאמרים מאת מטפלי האתר</h2>
            <p style={{ fontSize: "13px", color: "var(--muted)" }}>מידע, תובנות וכלים מאת המטפלים הרשומים בטיפול חכם</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 mb-12">
            {community.map((c) => <CommunityCard key={c.slug} {...c} />)}
          </div>
        </>
      )}

      {/* Academic articles */}
      <div style={{
        background: "var(--surface)", borderRadius: "var(--radius)",
        border: "1px solid var(--line)", padding: "24px 28px",
      }}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 style={{ fontWeight: 800, color: "var(--text)", fontSize: "16px" }}>מאמרים אקדמאיים</h3>
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
