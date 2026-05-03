import type { Metadata } from "next";
import {
  Sparkles,
  Lightbulb,
  Rocket,
  FlaskConical,
  Users,
  Code2,
  Cpu,
  Zap,
  Target,
  GraduationCap,
  Brain,
  HeartHandshake,
} from "lucide-react";
import DevelopersForm from "./DevelopersForm";

export const metadata: Metadata = {
  title: "בית למפתחים בתחום בריאות הנפש והלמידה",
  description:
    "טיפול חכם מזמינה מטפלים, אנשי חינוך, חוקרים, יזמים ומפתחים להצטרף לבית מקצועי חדש לפיתוח כלים דיגיטליים בתחום בריאות הנפש, ההורות והלמידה.",
  openGraph: {
    title: "בית למפתחים | טיפול חכם",
    description:
      "חממה לרעיונות מקצועיים בתחום בריאות הנפש והלמידה — מרעיון ראשוני ועד למוצר דיגיטלי שלם.",
  },
};

const AUDIENCE = [
  { icon: Brain, text: "פסיכולוגים, עובדים סוציאליים, מטפלים ומאבחנים שפיתחו רעיון לכלי דיגיטלי." },
  { icon: GraduationCap, text: "אנשי חינוך, הוראה מתקנת ותחום הלמידה שמחזיקים בפתרונות לעולם הקשב, הקריאה, הכתיבה והלמידה." },
  { icon: Code2, text: "מפתחי אפליקציות בתחום הרגשי, החברתי, ההורי, הטיפולי או הלימודי." },
  { icon: FlaskConical, text: "חוקרים וסטודנטים מתקדמים שמעוניינים להפוך ידע מחקרי לכלי יישומי." },
  { icon: Rocket, text: "יזמים שרוצים לבנות מוצר בתחום בריאות הנפש, ההורות או החינוך." },
  { icon: Cpu, text: "בעלי תוכנות קיימות שמעוניינים להגיע לקהל רחב יותר של מטפלים, הורים ומשתמשים." },
  { icon: Lightbulb, text: "אנשי מקצוע שיש להם רעיון טוב, אבל עדיין לא יודעים איך להפוך אותו למוצר." },
];

const BENEFITS = [
  "להפוך רעיון מקצועי למוצר דיגיטלי ברור, מעשי ונגיש.",
  "לקבל ליווי ראשוני באפיון, מיקוד ודיוק קהל היעד.",
  "לחשוב יחד על חוויית המשתמש, המודל המקצועי והערך הטיפולי או הלימודי.",
  "לבחון אפשרויות לפיילוט, מחקר, משוב ושיפור מתמשך.",
  "לחשוף את הכלי לקהל רלוונטי ומדויק.",
  "לבדוק כיצד הכלי משתלב בתהליכי המלצה והתאמה של טיפול חכם.",
  "להגיע למטפלים, הורים ומשתמשים שמחפשים פתרונות איכותיים.",
  "לקבל הזדמנות לשיתופי פעולה, פיתוחים עתידיים והרחבת ההשפעה של הרעיון.",
];

export default function DevelopersPage() {
  return (
    <main dir="rtl" className="dev-root relative min-h-screen overflow-hidden text-stone-100">
      {/* Page-specific styles */}
      <style>{`
        .dev-root {
          background:
            radial-gradient(1200px 600px at 20% -10%, rgba(167,139,250,.18), transparent 60%),
            radial-gradient(900px 500px at 90% 10%, rgba(244,114,182,.15), transparent 60%),
            radial-gradient(1000px 700px at 50% 110%, rgba(34,211,238,.12), transparent 60%),
            #07091B;
          font-family: 'Heebo', sans-serif;
        }
        .dev-grid-bg {
          background-image:
            linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
            linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px);
          background-size: 56px 56px;
          mask-image: radial-gradient(ellipse 90% 70% at 50% 30%, black 40%, transparent 100%);
          -webkit-mask-image: radial-gradient(ellipse 90% 70% at 50% 30%, black 40%, transparent 100%);
        }
        .dev-gradient-text {
          background: linear-gradient(120deg,#A78BFA 0%,#F472B6 45%,#22D3EE 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .dev-gradient-text-warm {
          background: linear-gradient(120deg,#FCA66B 0%,#F472B6 50%,#A78BFA 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .dev-glass-card {
          position: relative;
          background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.025));
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          box-shadow: 0 8px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06);
        }
        .dev-glass-card::before {
          content: "";
          position: absolute; inset: 0;
          padding: 1px;
          border-radius: inherit;
          background: linear-gradient(135deg, rgba(167,139,250,.5), rgba(244,114,182,.35), rgba(34,211,238,.5));
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
                  mask-composite: exclude;
          opacity: .35;
          pointer-events: none;
        }
        .dev-cta-btn {
          background: linear-gradient(120deg,#5B3FE3 0%,#C13ABF 50%,#0EA5E9 100%);
          background-size: 200% 200%;
          animation: ctaShift 6s ease-in-out infinite;
          box-shadow: 0 10px 40px rgba(193,58,191,.45), 0 4px 16px rgba(91,63,227,.4);
        }
        .dev-cta-btn:hover { filter: brightness(1.1); transform: translateY(-1px); }
        @keyframes ctaShift {
          0%,100% { background-position: 0% 50%; }
          50%     { background-position: 100% 50%; }
        }
        @keyframes floatBlob {
          0%,100% { transform: translateY(0) scale(1); }
          50%     { transform: translateY(-22px) scale(1.06); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spinSlow { to { transform: rotate(360deg); } }
        @keyframes pulseDot {
          0%,100% { opacity: .35; transform: scale(1); }
          50%     { opacity: .85; transform: scale(1.25); }
        }
        .dev-blob { animation: floatBlob 9s ease-in-out infinite; }
        .dev-blob-2 { animation-duration: 11s; animation-delay: 2s; }
        .dev-blob-3 { animation-duration: 13s; animation-delay: 4s; }
        .fade-up { animation: fadeUp .7s ease both; }
        .fade-up-2 { animation-delay: .1s; }
        .fade-up-3 { animation-delay: .2s; }
        .fade-up-4 { animation-delay: .3s; }
        .dev-icon-chip {
          background: linear-gradient(135deg, rgba(167,139,250,.18), rgba(244,114,182,.12));
          border: 1px solid rgba(167,139,250,.3);
          box-shadow: 0 0 24px rgba(167,139,250,.15) inset;
        }
        .dev-bullet {
          background: linear-gradient(135deg,#A78BFA,#F472B6,#22D3EE);
          box-shadow: 0 0 14px rgba(244,114,182,.5);
        }
        .dev-pulse-dot { animation: pulseDot 2.4s ease-in-out infinite; }
        .dev-ring {
          background: conic-gradient(from 90deg, #A78BFA, #F472B6, #22D3EE, #A78BFA);
          animation: spinSlow 16s linear infinite;
          filter: blur(1px);
        }
      `}</style>

      {/* Animated background grid + blobs */}
      <div className="dev-grid-bg pointer-events-none absolute inset-0 -z-0" aria-hidden />
      <div
        className="dev-blob pointer-events-none absolute -top-32 -right-24 h-[28rem] w-[28rem] rounded-full opacity-50 -z-0"
        style={{ background: "radial-gradient(circle, #6D28D9, transparent 70%)" }}
        aria-hidden
      />
      <div
        className="dev-blob dev-blob-2 pointer-events-none absolute top-[40%] -left-40 h-[26rem] w-[26rem] rounded-full opacity-40 -z-0"
        style={{ background: "radial-gradient(circle, #DB2777, transparent 70%)" }}
        aria-hidden
      />
      <div
        className="dev-blob dev-blob-3 pointer-events-none absolute -bottom-32 right-1/4 h-[24rem] w-[24rem] rounded-full opacity-40 -z-0"
        style={{ background: "radial-gradient(circle, #06B6D4, transparent 70%)" }}
        aria-hidden
      />

      <div className="relative z-10 mx-auto max-w-5xl px-5 pb-24">
        {/* HERO */}
        <section className="pt-12 fade-up">
          <div className="dev-glass-card relative overflow-hidden p-8 md:p-14">
            {/* Decorative spinning ring */}
            <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full opacity-30 dev-ring" aria-hidden />

            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold tracking-widest uppercase backdrop-blur"
              style={{ color: "#C4B5FD" }}>
              <Sparkles size={12} />
              חדש בטיפול חכם
              <span className="dev-pulse-dot ml-1 inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: "#22D3EE" }} />
            </div>

            <h1 className="mt-6 text-4xl md:text-6xl font-black leading-tight tracking-tight">
              <span className="dev-gradient-text">בית למפתחים</span>
              <br />
              <span className="text-white">בתחום בריאות הנפש והלמידה</span>
            </h1>

            <div className="mt-3 text-sm md:text-base font-semibold text-stone-400">
              מבית <span className="dev-gradient-text-warm">טיפול חכם</span>
            </div>

            <p className="mt-6 max-w-3xl text-lg leading-8 text-stone-200">
              יש לכם רעיון לאפליקציה, כלי דיגיטלי, שאלון, תוכנה או מערכת שיכולים לעזור לאנשים, ילדים, הורים, מטפלים או אנשי חינוך?
              טיפול חכם מזמינה מטפלים, מאבחנים, אנשי חינוך, חוקרים, יזמים ומפתחים להצטרף לבית מקצועי חדש לפיתוח כלים דיגיטליים
              בתחום בריאות הנפש, הטיפול, ההורות והלמידה.
            </p>

            <p className="mt-5 max-w-3xl text-base leading-8 text-stone-300">
              אנחנו מאמינים שהעתיד של בריאות הנפש והלמידה לא נמצא רק בחדר הטיפולים, אלא גם בכלים חכמים שיכולים ללוות אנשים בין פגישות,
              להנגיש ידע מקצועי, לתמוך בתרגול רגשי, לסייע בזיהוי צרכים, לחזק תהליכי למידה ולעזור לאנשי מקצוע לתת מענה מדויק, נגיש ויעיל יותר.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#contact"
                className="dev-cta-btn group relative inline-flex items-center gap-2 overflow-hidden rounded-xl px-6 py-3 text-sm font-bold text-white"
              >
                <Zap size={16} />
                ספרו לנו על הרעיון שלכם
              </a>
              <a
                href="#how"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-stone-200 backdrop-blur transition hover:bg-white/10"
              >
                איך זה עובד
              </a>
            </div>
          </div>
        </section>

        {/* INCUBATOR SECTION */}
        <section id="how" className="mt-16 fade-up fade-up-2">
          <SectionHeader
            icon={Lightbulb}
            iconBg="linear-gradient(135deg,#A78BFA,#F472B6)"
            title="חממה לרעיונות מקצועיים"
            kicker="מרעיון לכלי דיגיטלי"
          />

          <div className="mt-6 grid gap-4">
            <ProseCard>
              טיפול חכם מבקשת ליצור חממה לרעיונות מקצועיים בתחום בריאות הנפש והלמידה — מקום שבו רעיון ראשוני, תובנה מהקליניקה,
              שאלון שנבנה לאורך שנים או צורך שעלה מהשטח יכולים להפוך בהדרגה למוצר דיגיטלי שלם.
            </ProseCard>
            <ProseCard>
              הרבה אנשי טיפול, חינוך ואבחון מחזיקים ברעיונות מצוינים, אך לא תמיד יודעים איך להפוך אותם למוצר: איך לאפיין אותו,
              למי הוא מיועד, מה חוויית המשתמש הנכונה, איך בונים מודל פעולה ברור, איך בודקים שהוא באמת שימושי, ואיך מחברים אותו לקהל יעד רלוונטי.
            </ProseCard>
            <ProseCard>
              כאן אנחנו נכנסים לתמונה. טיפול חכם יכולה ללוות רעיונות בשלבים שונים — מרעיון ראשוני, דרך אפיון, מיקוד, בניית מודל מקצועי,
              חשיבה על קהל יעד וחוויית משתמש, ועד בחינת אפשרויות לפיתוח, פיילוט, מחקר, חשיפה ושילוב עתידי בפלטפורמה.
            </ProseCard>
          </div>
        </section>

        {/* WHAT WE OFFER */}
        <section className="mt-16 fade-up fade-up-2">
          <SectionHeader
            icon={Target}
            iconBg="linear-gradient(135deg,#22D3EE,#3B82F6)"
            title="מה אנחנו מציעים?"
            kicker="חיבור בין הכלי שלכם למשתמשים"
          />

          <div className="mt-6 grid gap-4">
            <ProseCard>
              אם פיתחתם כלי, אפליקציה, שאלון, מערכת תרגול, תוכנה למטפלים או פתרון שמסייע לילדים, הורים, מטופלים או אנשי מקצוע — נשמח להכיר.
            </ProseCard>
            <ProseCard>
              הפלטפורמה של טיפול חכם נבנית כמערכת חכמה להתאמת פתרונות בתחום הנפש והלמידה. בעתיד, כלים דיגיטליים יוכלו להשתלב כחלק
              ממערך ההמלצות של האתר, לצד המלצות על סוגי טיפול, אבחונים ואנשי מקצוע מתאימים. כך, אדם שממלא שאלון יוכל לקבל לא רק כיוון
              טיפולי או אבחוני, אלא גם חשיפה לכלים דיגיטליים שעשויים להתאים לצרכים שלו.
            </ProseCard>
          </div>
        </section>

        {/* RESEARCH */}
        <section className="mt-16 fade-up fade-up-3">
          <SectionHeader
            icon={FlaskConical}
            iconBg="linear-gradient(135deg,#F472B6,#FB923C)"
            title="מחקר, פיילוטים ולמידה מהשטח"
            kicker="מרעיון להוכחה"
          />

          <div className="mt-6 grid gap-4">
            <ProseCard>
              אחד היתרונות המרכזיים של טיפול חכם הוא החיבור בין ידע מקצועי, טכנולוגיה, משתמשים אמיתיים וחשיבה מחקרית.
              אנחנו מעוניינים לעודד פיתוח כלים שאפשר ללמוד מהם, לבחון אותם, לשפר אותם, ובהמשך גם לבדוק את תרומתם באופן מסודר.
            </ProseCard>
            <ProseCard>
              במסגרת הבית למפתחים ניתן יהיה לחשוב יחד על פיילוטים, איסוף משוב, מדדי שימוש, שאלוני הערכה, שיתופי פעולה עם אנשי מקצוע
              וחוקרים, ובניית תהליך הדרגתי שבו רעיון טוב לא נשאר רק מוצר יפה — אלא הופך לכלי שניתן לבחון, לדייק ולבסס לאורך זמן.
            </ProseCard>
          </div>
        </section>

        {/* AUDIENCE */}
        <section className="mt-16 fade-up fade-up-3">
          <SectionHeader
            icon={Users}
            iconBg="linear-gradient(135deg,#8B5CF6,#22D3EE)"
            title="למי זה מתאים?"
            kicker="מי יכול להצטרף"
          />

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {AUDIENCE.map(({ icon: Icon, text }, i) => (
              <div key={i} className="dev-glass-card flex items-start gap-3 p-4">
                <div className="dev-icon-chip flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl">
                  <Icon size={18} style={{ color: "#C4B5FD" }} />
                </div>
                <p className="text-[15px] leading-7 text-stone-200">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* WHAT TO BUILD */}
        <section className="mt-16 fade-up fade-up-4">
          <SectionHeader
            icon={Cpu}
            iconBg="linear-gradient(135deg,#06B6D4,#A78BFA)"
            title="מה אפשר לפתח יחד?"
            kicker="מגוון רחב של כלים"
          />

          <div className="mt-6">
            <ProseCard>
              אפליקציות לתרגול רגשי, כלים לוויסות חרדה, מערכות לניהול טיפול, שאלונים דיגיטליים, כלים להורים, תוכנות למעקב בין פגישות,
              מערכות לילדים עם קשיי למידה או קשב, כלים למטפלים, פתרונות לבתי ספר, מערכות הדרכה, מוצרי AI תומכים, וכל פתרון דיגיטלי
              שמחבר בין צורך אמיתי לבין ידע מקצועי.
            </ProseCard>
          </div>
        </section>

        {/* BENEFITS */}
        <section className="mt-16 fade-up fade-up-4">
          <SectionHeader
            icon={Rocket}
            iconBg="linear-gradient(135deg,#F472B6,#A78BFA)"
            title="למה להצטרף אלינו?"
            kicker="מה אנחנו נביא לשולחן"
          />

          <ul className="mt-6 grid gap-3 md:grid-cols-2">
            {BENEFITS.map((b, i) => (
              <li key={i} className="dev-glass-card flex items-start gap-3 p-4">
                <span className="dev-bullet mt-2 h-2 w-2 flex-shrink-0 rounded-full" />
                <span className="text-[15px] leading-7 text-stone-200">{b}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* CONTACT FORM */}
        <section id="contact" className="mt-20 fade-up fade-up-4">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold tracking-widest uppercase backdrop-blur"
              style={{ color: "#FCA66B" }}>
              <HeartHandshake size={12} />
              יש לכם רעיון? נשמח לשמוע
            </div>
            <h2 className="mt-5 text-3xl md:text-4xl font-black leading-tight">
              <span className="dev-gradient-text-warm">בואו נבנה יחד</span>
              <span className="text-white"> את הדור הבא</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-stone-300 leading-7">
              אם יש לכם אפליקציה קיימת, תוכנה בפיתוח, שאלון מקצועי, רעיון ראשוני או צורך מהשטח שאתם רוצים להפוך לכלי דיגיטלי —
              זה המקום להתחיל.
            </p>
            <p className="mx-auto mt-3 max-w-2xl text-stone-300 leading-7">
              בואו לקחת חלק בבניית הדור הבא של הכלים הדיגיטליים בתחום בריאות הנפש, הטיפול, ההורות והלמידה.
            </p>
            <p className="mx-auto mt-5 max-w-2xl text-base font-semibold leading-7 dev-gradient-text">
              השאירו פרטים ונבחן יחד כיצד ניתן לשלב, לפתח או לקדם את הרעיון שלכם במסגרת טיפול חכם — מהשלב הראשוני ועד למוצר דיגיטלי שלם.
            </p>
          </div>

          <div className="mt-8">
            <DevelopersForm />
          </div>
        </section>
      </div>
    </main>
  );
}

function SectionHeader({
  icon: Icon,
  iconBg,
  title,
  kicker,
}: {
  icon: React.ComponentType<{ size?: number; color?: string; style?: React.CSSProperties }>;
  iconBg: string;
  title: string;
  kicker?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl"
        style={{ background: iconBg, boxShadow: "0 8px 28px rgba(167,139,250,.35)" }}
      >
        <Icon size={20} color="white" />
      </div>
      <div>
        {kicker && (
          <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#C4B5FD" }}>
            {kicker}
          </div>
        )}
        <h2 className="text-2xl md:text-3xl font-extrabold text-white">{title}</h2>
      </div>
    </div>
  );
}

function ProseCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="dev-glass-card p-5 md:p-6">
      <p className="text-[15px] md:text-base leading-8 text-stone-200">{children}</p>
    </div>
  );
}
