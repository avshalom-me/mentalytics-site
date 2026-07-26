import type { Metadata } from "next";
import {
  Sparkles,
  Rocket,
  FlaskConical,
  Cpu,
  Zap,
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
      "חממה לרעיונות מקצועיים בתחום בריאות הנפש והלמידה - מרעיון ראשוני ועד למוצר דיגיטלי שלם.",
  },
};

const BENEFITS = [
  "ליווי באפיון, מיקוד ודיוק קהל היעד.",
  "בחינת אפשרויות לפיילוט, מחקר ושיפור מתמשך.",
  "חשיפה לקהל רלוונטי - מטפלים, הורים ומשתמשים שמחפשים פתרונות.",
  "שיתופי פעולה ואפשרויות שילוב בפלטפורמת טיפול חכם.",
];

export default function DevelopersPage() {
  return (
    <main dir="rtl" className="dev-root relative min-h-screen overflow-hidden">
      <style>{`
        .dev-root {
          background: #ffffff;
          font-family: 'Heebo', sans-serif;
          color: var(--text);
        }

        /* Subtle dot grid */
        .dev-grid-bg {
          background-image: radial-gradient(circle, rgba(61,140,138,.22) 1px, transparent 1px);
          background-size: 30px 30px;
          mask-image: radial-gradient(ellipse 85% 55% at 50% 10%, black 20%, transparent 100%);
          -webkit-mask-image: radial-gradient(ellipse 85% 55% at 50% 10%, black 20%, transparent 100%);
        }

        /* Teal → Gold gradient text */
        .dev-gradient-text {
          background: linear-gradient(110deg, #2A6462 0%, #3D8C8A 40%, #D49018 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .dev-gradient-text-warm {
          background: linear-gradient(110deg, #D49018 0%, #3D8C8A 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        /* Light glass cards with 3D depth shadow */
        .dev-glass-card {
          background: #ffffff;
          border: 1px solid var(--line);
          border-radius: 20px;
          box-shadow:
            0 4px 0 var(--teal-mid),
            0 10px 36px rgba(61,140,138,.09);
          transition: transform 0.35s ease, box-shadow 0.35s ease;
        }
        .dev-glass-card:hover {
          transform: perspective(900px) translateY(-5px) rotateX(1.2deg);
          box-shadow:
            0 8px 0 var(--teal-mid),
            0 20px 50px rgba(61,140,138,.15);
        }

        /* Hero glass card variant */
        .dev-hero-card {
          background: linear-gradient(155deg, #fdfaf7 0%, #eaf4f3 60%, #fdf6e3 100%);
          border: 1px solid var(--teal-mid);
          border-radius: 28px;
          box-shadow:
            0 6px 0 var(--teal-mid),
            0 20px 60px rgba(61,140,138,.12);
          position: relative;
          overflow: hidden;
        }

        /* Perspective grid floor */
        .dev-perspective-grid {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 170px;
          background-image:
            linear-gradient(rgba(61,140,138,.22) 1px, transparent 1px),
            linear-gradient(90deg, rgba(61,140,138,.22) 1px, transparent 1px);
          background-size: 38px 38px;
          transform: perspective(320px) rotateX(60deg);
          transform-origin: bottom;
          mask-image: linear-gradient(to top, rgba(0,0,0,.35) 0%, transparent 100%);
          -webkit-mask-image: linear-gradient(to top, rgba(0,0,0,.35) 0%, transparent 100%);
          pointer-events: none;
          z-index: 0;
        }

        /* Spinning ring decoration */
        @keyframes spinSlow { to { transform: rotate(360deg); } }
        .dev-ring {
          background: conic-gradient(from 90deg, #3D8C8A, #D49018, #F0A8AC, #3D8C8A);
          animation: spinSlow 18s linear infinite;
          filter: blur(1px);
        }

        /* CTA button: dark teal → gold */
        .dev-cta-btn {
          background: linear-gradient(120deg, #2A6462 0%, #3D8C8A 45%, #D49018 100%);
          background-size: 200% 200%;
          animation: ctaShift 6s ease-in-out infinite;
          box-shadow: 0 6px 28px rgba(61,140,138,.45), 0 2px 8px rgba(212,144,24,.3);
          border-radius: 50px;
          transition: filter 0.25s ease, transform 0.25s ease;
        }
        .dev-cta-btn:hover { filter: brightness(1.08); transform: translateY(-2px); }
        @keyframes ctaShift {
          0%,100% { background-position: 0% 50%; }
          50%      { background-position: 100% 50%; }
        }

        /* Blobs */
        @keyframes floatBlob {
          0%,100% { transform: translateY(0) scale(1); }
          50%      { transform: translateY(-20px) scale(1.05); }
        }
        .dev-blob   { animation: floatBlob 9s ease-in-out infinite; }
        .dev-blob-2 { animation-duration: 12s; animation-delay: 2s; }
        .dev-blob-3 { animation-duration: 14s; animation-delay: 4.5s; }

        /* Animations */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up   { animation: fadeUp .7s ease both; }
        .fade-up-2 { animation-delay: .1s; }
        .fade-up-3 { animation-delay: .2s; }
        .fade-up-4 { animation-delay: .3s; }

        /* Icon chip */
        .dev-icon-chip {
          background: var(--teal-pale);
          border: 1px solid var(--teal-mid);
        }

        /* Bullet */
        .dev-bullet {
          background: linear-gradient(135deg, #3D8C8A, #D49018);
          box-shadow: 0 0 10px rgba(61,140,138,.5);
        }

        /* Pulsing dot */
        @keyframes pulseDot {
          0%,100% { opacity: .4; transform: scale(1); }
          50%      { opacity: 1;  transform: scale(1.35); }
        }
        .dev-pulse-dot { animation: pulseDot 2.4s ease-in-out infinite; }

        /* 3D floating cards scene - desktop only */
        .dev-3d-scene { display: none; position: relative; width: 190px; height: 155px; flex-shrink: 0; }
        @media (min-width: 768px) { .dev-3d-scene { display: block; } }

        /* Secondary button */
        .dev-sec-btn {
          border-radius: 50px;
          border: 1.5px solid var(--teal-mid);
          padding: 10px 22px;
          font-size: 14px;
          font-weight: 600;
          color: var(--teal);
          background: transparent;
          transition: background 0.25s ease, color 0.25s ease;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
        }
        .dev-sec-btn:hover { background: var(--teal-pale); }
      `}</style>

      {/* Background elements */}
      <div className="dev-grid-bg pointer-events-none absolute inset-0" style={{ zIndex: 0 }} aria-hidden />
      <div className="dev-blob pointer-events-none absolute -top-40 -right-32 h-[30rem] w-[30rem] rounded-full"
        style={{ background: "radial-gradient(circle, #3D8C8A, transparent 70%)", opacity: .12, zIndex: 0 }} aria-hidden />
      <div className="dev-blob dev-blob-2 pointer-events-none absolute top-[45%] -left-44 h-[26rem] w-[26rem] rounded-full"
        style={{ background: "radial-gradient(circle, #D49018, transparent 70%)", opacity: .1, zIndex: 0 }} aria-hidden />
      <div className="dev-blob dev-blob-3 pointer-events-none absolute -bottom-40 right-1/4 h-[22rem] w-[22rem] rounded-full"
        style={{ background: "radial-gradient(circle, #F0A8AC, transparent 70%)", opacity: .18, zIndex: 0 }} aria-hidden />

      <div className="relative mx-auto max-w-5xl px-5 pb-24" style={{ zIndex: 1 }}>

        {/* ── HERO ── */}
        <section className="pt-12 fade-up">
          <div className="dev-hero-card">

            {/* Spinning ring */}
            <div className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full dev-ring"
              style={{ opacity: .18 }} aria-hidden />

            {/* Perspective grid floor */}
            <div className="dev-perspective-grid" aria-hidden />

            <div className="relative p-8 md:p-14 flex items-center gap-12" style={{ zIndex: 1 }}>

              {/* Text */}
              <div style={{ flex: 1 }}>
                {/* Badge */}
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: "8px",
                  fontSize: "11px", fontWeight: 700, color: "var(--teal)",
                  textTransform: "uppercase", letterSpacing: ".16em",
                  background: "var(--teal-pale)", padding: "6px 14px", borderRadius: "50px",
                  border: "1px solid var(--teal-mid)", marginBottom: "24px",
                }}>
                  <Sparkles size={11} />
                  חדש בטיפול חכם
                  <span className="dev-pulse-dot inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--gold)" }} />
                </div>

                <h1 style={{
                  fontSize: "clamp(2.2rem, 4.5vw, 3.8rem)", fontWeight: 900,
                  lineHeight: 1.1, letterSpacing: "-.025em", marginBottom: "8px",
                }}>
                  <span className="dev-gradient-text">בית למפתחים</span>
                  <br />
                  <span style={{ color: "var(--text)" }}>בתחום בריאות הנפש והלמידה</span>
                </h1>

                <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--muted)", marginBottom: "20px" }}>
                  מבית{" "}
                  <span style={{ color: "var(--gold-dark)", fontWeight: 700 }}>טיפול חכם</span>
                </div>

                <p style={{ fontSize: "17px", lineHeight: 1.9, color: "var(--text-2)", maxWidth: "58ch", marginBottom: "14px" }}>
                  יש לכם רעיון לאפליקציה או תוכנה שיכולים לעזור לאנשים? טיפול חכם מזמינה מטפלים ויזמים להצטרף לבית מקצועי חדש לפיתוח כלים דיגיטליים בתחום בריאות הנפש, הטיפול, ההורות והלמידה.
                </p>

                <p style={{ fontSize: "15px", lineHeight: 1.9, color: "var(--muted)", maxWidth: "58ch", marginBottom: "32px" }}>
                  אנחנו מאמינים שהעתיד של בריאות הנפש והלמידה לא נמצא רק בחדר הטיפולים, אלא גם בכלים חכמים שיכולים ללוות אנשים בין פגישות, להנגיש ידע מקצועי ולסייע בזיהוי צרכים.
                </p>

                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                  <a href="#contact" className="dev-cta-btn"
                    style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "12px 24px", fontSize: "14px", fontWeight: 700, color: "white", textDecoration: "none" }}>
                    <Zap size={16} />
                    בואו ניצור שיתוף פעולה
                  </a>
                  <a href="#how" className="dev-sec-btn">
                    איך זה עובד
                  </a>
                </div>
              </div>

              {/* 3D floating cards - desktop decoration */}
              <div className="dev-3d-scene" aria-hidden>
                {/* Card - back layer */}
                <div style={{
                  position: "absolute",
                  width: "158px", height: "100px",
                  background: "var(--gold-pale)",
                  borderRadius: "14px",
                  border: "1px solid #EDD090",
                  transform: "perspective(600px) rotateY(22deg) rotateX(-7deg) translate(-28px, -22px)",
                  boxShadow: "0 14px 36px rgba(212,144,24,.2)",
                  opacity: 0.75,
                }} />
                {/* Card - mid layer */}
                <div style={{
                  position: "absolute",
                  width: "158px", height: "100px",
                  background: "var(--teal-pale)",
                  borderRadius: "14px",
                  border: "1px solid var(--teal-mid)",
                  transform: "perspective(600px) rotateY(22deg) rotateX(-7deg) translate(-12px, -9px)",
                  boxShadow: "0 14px 36px rgba(61,140,138,.18)",
                  opacity: 0.88,
                }} />
                {/* Card - front layer with fake UI */}
                <div style={{
                  position: "absolute",
                  width: "158px", height: "100px",
                  background: "white",
                  borderRadius: "14px",
                  border: "1px solid var(--line)",
                  transform: "perspective(600px) rotateY(22deg) rotateX(-7deg)",
                  boxShadow: "0 18px 44px rgba(61,140,138,.22)",
                  padding: "14px 16px",
                }}>
                  <div style={{ width: "55%", height: "8px", background: "var(--teal)", borderRadius: "4px", marginBottom: "8px", opacity: .75 }} />
                  <div style={{ width: "80%", height: "6px", background: "var(--line)", borderRadius: "4px", marginBottom: "6px" }} />
                  <div style={{ width: "40%", height: "6px", background: "var(--line)", borderRadius: "4px", marginBottom: "14px" }} />
                  <div style={{ display: "flex", gap: "6px" }}>
                    <div style={{ width: "50px", height: "22px", background: "var(--teal)", borderRadius: "6px", opacity: .85 }} />
                    <div style={{ width: "38px", height: "22px", background: "var(--gold-pale)", border: "1px solid #EDD090", borderRadius: "6px" }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── RESEARCH + OFFER ── */}
        <section id="how" className="mt-16 fade-up fade-up-2">
          <SectionHeader
            icon={FlaskConical}
            iconBg="linear-gradient(135deg, #3D8C8A, #D49018)"
            title="מחקר, פיילוטים ולמידה"
            kicker="מרעיון להוכחה"
          />
          <div className="mt-6 grid gap-4">
            <ProseCard>
              אם פיתחתם כלי, אפליקציה, שאלון או פתרון שמסייע לאנשים - נשמח להכיר. הפלטפורמה של טיפול חכם נבנית כמערכת חכמה להתאמת פתרונות בתחום הנפש והלמידה, וכלים דיגיטליים יוכלו להשתלב כחלק ממערך ההמלצות לצד טיפול, אבחון ואנשי מקצוע.
            </ProseCard>
            <ProseCard>
              אנחנו מעוניינים לעודד פיתוח כלים שאפשר ללמוד מהם ולבחון אותם. במסגרת הבית למפתחים ניתן לחשוב יחד על פיילוטים, איסוף משוב, שיתופי פעולה עם חוקרים - ולהפוך רעיון טוב לכלי שניתן לדייק ולבסס לאורך זמן.
            </ProseCard>
          </div>
        </section>

        {/* ── WHAT TO BUILD ── */}
        <section className="mt-16 fade-up fade-up-3">
          <SectionHeader
            icon={Cpu}
            iconBg="linear-gradient(135deg, #2A6462, #3D8C8A)"
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

        {/* ── BENEFITS ── */}
        <section className="mt-16 fade-up fade-up-3">
          <SectionHeader
            icon={Rocket}
            iconBg="linear-gradient(135deg, #D49018, #F0A8AC)"
            title="למה להצטרף אלינו?"
            kicker="מה אנחנו נביא לשולחן"
          />
          <ul className="mt-6 grid gap-3 md:grid-cols-2">
            {BENEFITS.map((b, i) => (
              <li key={i} className="dev-glass-card flex items-start gap-3 p-5">
                <span className="dev-bullet mt-2 h-2.5 w-2.5 flex-shrink-0 rounded-full" />
                <span style={{ fontSize: "15px", lineHeight: "1.8", color: "var(--text-2)" }}>{b}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ── CONTACT ── */}
        <section id="contact" className="mt-20 fade-up fade-up-4">
          <div style={{
            background: "linear-gradient(145deg, var(--teal-pale) 0%, #ffffff 50%, var(--gold-pale) 100%)",
            borderRadius: "28px",
            padding: "52px 40px",
            textAlign: "center",
            border: "1px solid var(--teal-mid)",
            boxShadow: "0 6px 0 var(--teal-mid), 0 20px 60px rgba(61,140,138,.1)",
            marginBottom: "32px",
          }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              fontSize: "11px", fontWeight: 700, color: "var(--gold-dark)",
              textTransform: "uppercase", letterSpacing: ".16em",
              background: "var(--gold-pale)", padding: "6px 14px", borderRadius: "50px",
              border: "1px solid #EDD090", marginBottom: "20px",
            }}>
              <HeartHandshake size={12} />
              יש לכם רעיון? נשמח לשמוע
            </div>

            <h2 style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)", fontWeight: 900, lineHeight: 1.15, letterSpacing: "-.02em", marginBottom: "16px" }}>
              <span className="dev-gradient-text">בואו נבנה יחד</span>
              <span style={{ color: "var(--text)" }}> את הדור הבא</span>
            </h2>

            <p style={{ maxWidth: "52ch", margin: "0 auto 12px", lineHeight: 1.8, color: "var(--text-2)", fontSize: "16px" }}>
              אם יש לכם אפליקציה קיימת, תוכנה בפיתוח, שאלון מקצועי, רעיון ראשוני או צורך מהשטח שאתם רוצים להפוך לכלי דיגיטלי - זה המקום להתחיל.
            </p>
            <p style={{ maxWidth: "52ch", margin: "0 auto 20px", lineHeight: 1.8, color: "var(--muted)", fontSize: "15px" }}>
              בואו לקחת חלק בבניית הדור הבא של הכלים הדיגיטליים בתחום בריאות הנפש, הטיפול, ההורות והלמידה.
            </p>
            <p style={{ maxWidth: "52ch", margin: "0 auto", lineHeight: 1.8, fontSize: "15px", fontWeight: 600 }} className="dev-gradient-text">
              השאירו פרטים ונבחן יחד כיצד ניתן לשלב, לפתח או לקדם את הרעיון שלכם.
            </p>
          </div>

          <DevelopersForm />
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
        style={{ background: iconBg, boxShadow: "0 6px 24px rgba(61,140,138,.3)" }}
      >
        <Icon size={20} color="white" />
      </div>
      <div>
        {kicker && (
          <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--teal)" }}>
            {kicker}
          </div>
        )}
        <h2 className="text-2xl md:text-3xl font-extrabold" style={{ color: "var(--text)" }}>{title}</h2>
      </div>
    </div>
  );
}

function ProseCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="dev-glass-card p-5 md:p-6" style={{ borderInlineStart: "4px solid var(--teal)" }}>
      <p className="text-[15px] md:text-base leading-8" style={{ color: "var(--text-2)" }}>{children}</p>
    </div>
  );
}
