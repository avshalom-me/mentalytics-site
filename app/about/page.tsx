import Image from "next/image";
import type { Metadata } from "next";
import { Sparkles, ShieldCheck, Target, Users, Heart } from "lucide-react";

export const metadata: Metadata = {
  title: "אודות",
  description: "הכירו את הצוות מאחורי טיפול חכם — מערכת הכוונה טיפולית חכמה שפותחה על ידי פסיכולוגים קליניים.",
};

type TeamMember = {
  name: string;
  role: string;
  img: string;
  bullets: string[];
};

const team: TeamMember[] = [
  {
    name: 'ד"ר אבשלום גליל',
    role: 'מייסד ויו״ר החברה',
    img: "/team/avshalom.jpg",
    bullets: [
      "פסיכולוג קליני וחינוכי – מומחה מדריך",
      "דוקטורט בפסיכולוגיה קלינית ומדעי המוח (אוניברסיטת בר-אילן)",
      "מרצה וחוקר באוניברסיטת אריאל, במגמה הקלינית והתעסוקתית",
      "מרצה לאבחון והערכה במוסדות אקדמאיים",
    ],
  },
  {
    name: "גונן שש",
    role: "חבר הצוות המקצועי המפתח",
    img: "/team/gonen.jpg",
    bullets: ["פסיכולוג קליני מומחה", "מרצה בתחום האבחון הפסיכולוגי"],
  },
  {
    name: "שילת יוגב",
    role: "חברת הצוות המקצועי המפתח",
    img: "/team/shilat.jpeg",
    bullets: ["מנהלת מרכז טיפולי לילדים ומבוגרים במשך כעשור"],
  },
];

export default function AboutPage() {
  return (
    <main
      className="mx-auto max-w-5xl px-5 pb-20"
      dir="rtl"
      style={{ fontFamily: "'Heebo', sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes floatBlob {
          0%, 100% { transform: translateY(0) scale(1); }
          50%       { transform: translateY(-14px) scale(1.04); }
        }
        .fade-up { animation: fadeUp .65s ease both; }
        .fade-up-1 { animation-delay: .10s; }
        .fade-up-2 { animation-delay: .22s; }
        .fade-up-3 { animation-delay: .34s; }
        .blob { animation: floatBlob 7s ease-in-out infinite; }
        .blob-2 { animation-duration: 9s; animation-delay: 1.5s; }
      `}</style>

      {/* HERO */}
      <section className="pt-10 fade-up fade-up-1">
        <div
          className="relative overflow-hidden rounded-[36px]"
          style={{
            background: "linear-gradient(135deg, #FDF6EE 0%, #F5E8DC 40%, #E8F4F0 100%)",
            boxShadow: "0 24px 60px rgba(120,80,50,.12), 0 4px 16px rgba(120,80,50,.07)",
            border: "1px solid rgba(220,200,180,.5)",
          }}
        >
          <div className="blob pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full opacity-30"
            style={{ background: "radial-gradient(circle, #F4A574, transparent 70%)" }} />
          <div className="blob blob-2 pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full opacity-20"
            style={{ background: "radial-gradient(circle, #7EC8A4, transparent 70%)" }} />

          <div className="relative p-8 md:p-12">
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold tracking-widest uppercase"
              style={{ background: "#F4A57422", color: "#B06030", border: "1px solid #F4A57455" }}>
              <Sparkles size={12} />
              אודות טיפול חכם
            </div>

            <h1
              className="mt-4 text-4xl font-black tracking-tight"
              style={{ color: "#2C1A10", letterSpacing: "-0.02em" }}
            >
              הכוונה טיפולית/אבחונים וכלים לסיוע —{" "}
              <span style={{ color: "#6B4226" }}>בצורה בהירה, רגישה ומעשית</span>
            </h1>

            <p className="mt-4 max-w-3xl leading-8 text-stone-700">
              טיפול חכם נולדה מתוך הבנה פשוטה: הרבה אנשים "מסתובבים" בין אפשרויות טיפול,
              אבחונים ומסלולי זכאות — בלי מפת דרכים ברורה. אנחנו בונים מערכת שמסייעת למקד
              את הקושי, להציע כיוון טיפול מתאים, ולהנגיש מידע מסודר על צעדים אפשריים.
              כי לפעמים הצעד הכי קשה הוא פשוט לדעת מאיפה להתחיל — ואנחנו כאן בדיוק בשביל זה.
            </p>

            <div
              className="mt-6 rounded-2xl px-4 py-3 text-sm text-stone-900"
              style={{ background: "rgba(255,255,255,0.75)", border: "1px solid rgba(220,200,175,0.55)" }}
            >
              <div className="flex items-start gap-2">
                <ShieldCheck size={18} style={{ color: "#0F5468" }} className="mt-0.5 flex-shrink-0" />
                <p className="leading-7">
                  <span className="font-semibold">השאלונים כתובים בשפה מכבדת, ומיועדים לתת הכוונה ראשונית ברורה.</span>{" "}
                  השאלונים אינם מהווים אבחון מקצועי אלא רק פירוט הסימפטומים וההתאמה למטפל המתאים.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WHAT WE DO */}
      <section className="mt-14 fade-up fade-up-2">
        <div className="flex items-start gap-3 mb-6">
          <div
            className="mt-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl"
            style={{ background: "#F4E8DC", border: "1px solid #E8D5C0" }}
          >
            <Target size={18} style={{ color: "#8B2E0A" }} />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-stone-900">מה אנחנו עושים בפועל</h2>
            <p className="mt-1 text-stone-600">שילוב של מחקר, ניסיון קליני ומבנה שאלונים מודולרי.</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: "🔍",
              title: "מיקוד הקושי",
              body: "עוזרים להבין מה מרכזי כרגע ומה פחות — כדי לא ללכת לאיבוד בין אפשרויות.",
              bg: "#FEF3EB",
              border: "#F4C8A4",
            },
            {
              icon: "🧭",
              title: "כיוון טיפולי מתאים",
              body: "התאמה בין סוג הקושי לבין כיווני טיפול מקובלים, עם הסבר קצר על הסיבה.",
              bg: "#EBF5F1",
              border: "#A8D4C0",
            },
            {
              icon: "🤝",
              title: "התאמה למטפל/ת",
              body: "בשלב הבא: התאמת מטפל/ת לפי התמחות, סגנון עבודה, אזור, שפה וזמינות.",
              bg: "#F0EBF8",
              border: "#C4A8DC",
            },
          ].map((p, i) => (
            <div
              key={i}
              className="rounded-2xl p-5"
              style={{
                background: p.bg,
                border: `1px solid ${p.border}`,
                boxShadow: "0 4px 16px rgba(100,60,30,.07)",
              }}
            >
              <div className="mb-3 text-3xl">{p.icon}</div>
              <div className="mb-2 font-bold text-stone-900">{p.title}</div>
              <p className="text-sm leading-6 text-stone-700">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* VALUES */}
      <section className="mt-14 fade-up fade-up-2">
        <div className="flex items-start gap-3 mb-6">
          <div
            className="mt-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl"
            style={{ background: "#EBF5F1", border: "1px solid #A8D4C0" }}
          >
            <Heart size={18} style={{ color: "#2E7A5C" }} />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-stone-900">מה מנחה אותנו</h2>
            <p className="mt-1 text-stone-600">הערכים שעומדים מאחורי כל שאלה ושאלה.</p>
          </div>
        </div>

        <div
          className="rounded-2xl p-6 md:p-8"
          style={{
            background: "rgba(255,255,255,0.82)",
            border: "1px solid #EAE0D5",
            boxShadow: "0 4px 16px rgba(100,60,30,.06)",
          }}
        >
          <div className="grid gap-5 md:grid-cols-2">
            {[
              { emoji: "💛", title: "חמימות ורגישות", body: "אנחנו יודעים שלפנות לעזרה זה לא קל. כל מילה בשאלונים נכתבה בתשומת לב, מבלי לשפוט." },
              { emoji: "📚", title: "בסיס מחקרי", body: "כל שאלון מבוסס על ספרות מקצועית מוכרת וניסיון קליני מצטבר — לא על ניחושים." },
              { emoji: "🔒", title: "פרטיות מלאה", body: "לא שומרים שמות, לא מייל, לא מעקב. המידע שלכם נשאר שלכם." },
              { emoji: "🌱", title: "נקודת התחלה, לא תחליף", body: "אנחנו לא מחליפים טיפול מקצועי — אנחנו עוזרים לכם להגיע אליו במהירות ובביטחון." },
            ].map((v, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-2xl mt-0.5">{v.emoji}</span>
                <div>
                  <div className="font-bold text-stone-900">{v.title}</div>
                  <p className="mt-1 text-sm leading-6 text-stone-700">{v.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TEAM */}
      <section className="mt-14 fade-up fade-up-3">
        <div className="flex items-start gap-3 mb-6">
          <div
            className="mt-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl"
            style={{ background: "#EBF0F5", border: "1px solid #A8C0D4" }}
          >
            <Users size={18} style={{ color: "#0F5468" }} />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-stone-900">הצוות המקצועי המפתח</h2>
            <p className="mt-1 text-stone-600">אנשי מקצוע מהתחום הקליני והאבחוני שמובילים את הפיתוח המקצועי.</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {team.map((m) => (
            <div
              key={m.name}
              className="rounded-2xl bg-white p-5"
              style={{
                border: "1px solid #EAE0D5",
                boxShadow: "0 4px 16px rgba(100,60,30,.07)",
              }}
            >
              <div className="flex items-center gap-4">
                <div className="relative h-16 w-16 overflow-hidden rounded-2xl flex-shrink-0"
                  style={{ border: "2px solid #EAE0D5", background: "#FAF7F2" }}>
                  <Image src={m.img} alt={m.name} fill className="object-cover" />
                </div>
                <div>
                  <div className="text-base font-extrabold text-stone-900">{m.name}</div>
                  <div className="mt-0.5 text-xs font-semibold" style={{ color: "#8B6A50" }}>
                    {m.role}
                  </div>
                </div>
              </div>

              <ul className="mt-4 space-y-2">
                {m.bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm leading-6 text-stone-700">
                    <span
                      className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full"
                      style={{ background: "#C96B55" }}
                    />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* CLOSING */}
      <section className="mt-14 fade-up fade-up-3">
        <div
          className="rounded-3xl p-8 text-center"
          style={{
            background: "linear-gradient(135deg,#FDF6EE,#E8F4F0)",
            border: "1px solid #E0D5C8",
            boxShadow: "0 8px 28px rgba(100,60,30,.08)",
          }}
        >
          <div className="text-3xl mb-3">🌿</div>
          <h3 className="text-xl font-extrabold text-stone-900">
            כי כל אחד מגיע לדרך שלו — בזמן שלו
          </h3>
          <p className="mt-3 max-w-xl mx-auto leading-7 text-stone-700">
            טיפול חכם לא כאן כדי להגיד לכם מה לעשות. אנחנו כאן כדי לעזור לכם להבין
            קצת יותר — ולהרגיש קצת פחות לבד בתהליך.
          </p>
        </div>
      </section>

      <div className="h-16" />
    </main>
  );
}