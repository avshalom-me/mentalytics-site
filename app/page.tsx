import Link from "next/link";
import type { Metadata } from "next";
import ContactForm from "./components/ContactForm";
import TooltipAsterisk from "./components/TooltipAsterisk";

export const metadata: Metadata = {
  title: "טיפול חכם — מתאימים את החיבור הנכון",
  description: "מלאו שאלון קצר וקבלו המלצות מותאמות אישית על סוג הטיפול, סוג המטפל, והמטפל הנכון עבורכם — לילדים ולמבוגרים.",
};

const faqs = [
  {
    q: 'מה זה "טיפול חכם"?',
    a: 'מערכת שאלונים מודולרית שמסייעת למקד את הקושי ולהציע כיוון טיפולי מתאים, על בסיס מחקר וניסיון קליני. בנוסף, המערכת מציעה התאמת מטפל לפי צרכיכם — סוג הטיפול, אופי המטפל, מיקום, שפה, תרבות ועוד.',
  },
  {
    q: "האם צריך להזין פרטים מזהים?",
    a: "לא. השימוש בשאלונים אנונימי לחלוטין ולא נשמר בשום מקום.",
  },
  {
    q: "כמה פעמים אפשר להשתמש ומה העלות?",
    a: 'ניתן להשתמש 6 פעמים בשאלון. לאחר מכן תשלום סמלי של 30 ש"ח + מע"מ. לרוב אין צורך ביותר מפעם או פעמיים.',
  },
  {
    q: "כמה זמן זה לוקח?",
    a: "בדרך כלל כמה דקות. השאלון מודולרי — רק שאלות רלוונטיות מופיעות בהתאם לתשובות.",
  },
  {
    q: "למה לא פשוט לקבל המלצה מחבר?",
    a: "לעיתים זה כיוון טוב, אבל מטפל שמתאים לחבר לא תמיד מתאים גם לך — בגלל הבדלים בסיבת הפנייה, בסוג הטיפול, או באישיות המקצועית של המטפל.",
  },
  {
    q: "מה עוד אני מקבל?",
    a: "בחלק מהמקרים יינתנו כלים להפחתת הקשיים המדווחים. המערכת גם יודעת להפנות לאבחון או הערכה לפי הצורך.",
  },
  {
    q: "האם המטפלים המופיעים באתר מוסמכים?",
    a: "כל המטפלים עוברים תהליך אימות המוודאים שהם בעלי הכלים וההכשרה המתאימה.",
  },
];

const steps = [
  {
    n: "1",
    title: "מלאו את השאלון",
    body: "השאלון מתעדכן בזמן אמת ומדייק את השאלות בהתאם לתשובות שתזינו — כך תוכלו למקד ולהבין את הקושי שאתם מתמודדים איתו.",
    numBg: "var(--teal)",
    numColor: "white",
    numBorder: "var(--teal)",
  },
  {
    n: "2",
    title: "קבלו המלצה אישית",
    body: "תקבלו פירוט של הקשיים הבולטים שעלו מהשאלון, ובהתאם להם — סוגי הטיפול והמטפלים המתאימים במיוחד לכם. ניתן לשמירה כ-PDF.",
    numBg: "var(--gold)",
    numColor: "white",
    numBorder: "var(--gold)",
  },
  {
    n: "3",
    title: "בחרו את המטפל הנכון לכם",
    body: "רשימת מטפלים מדורגת לפי סוג הטיפול המתאים, אישיות המטפל, מיקום גיאוגרפי ועוד.",
    numBg: "var(--teal-dark)",
    numColor: "white",
    numBorder: "var(--teal-dark)",
  },
];


export default function HomePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": ["MedicalBusiness", "HealthAndBeautyBusiness"],
    name: "טיפול חכם",
    url: "https://www.mentalytics.co.il",
    description: "מערכת הכוונה טיפולית חכמה — התאמת מטפלים על בסיס שאלונים מבוססי מחקר",
    areaServed: { "@type": "Country", name: "IL" },
    serviceType: "Therapist Matching",
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade { opacity: 0; transform: translateY(20px); animation: fadeIn .5s ease forwards; }
        .fade-1 { animation-delay: .05s; }
        .fade-2 { animation-delay: .15s; }
        .fade-3 { animation-delay: .25s; }
        .fade-4 { animation-delay: .35s; }
        .fade-5 { animation-delay: .45s; }

        details summary::-webkit-details-marker { display: none; }
        details[open] .faq-icon { transform: rotate(45deg); background: var(--teal); color: white; }
        .faq-icon { transition: transform .2s, background .2s; }

        .step-card:hover { box-shadow: 0 8px 32px rgba(61,140,138,.1); border-color: var(--teal-mid) !important; }
      `}</style>

      {/* ─── HERO ─── */}
      <section style={{
        minHeight: "90vh",
        padding: "80px 24px 72px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        background: "white",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Radial glows */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: "radial-gradient(ellipse at 70% 10%, rgba(212,144,24,.07) 0%, transparent 55%), radial-gradient(ellipse at 20% 80%, rgba(61,140,138,.07) 0%, transparent 55%)",
        }} />

        {/* Decorative arcs */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}
          viewBox="0 0 1200 600" fill="none" preserveAspectRatio="xMidYMid slice">
          <path d="M-100 520 Q600 80 1300 520" stroke="var(--teal)" strokeWidth="80" strokeLinecap="round" opacity=".03"/>
          <path d="M-100 570 Q600 150 1300 570" stroke="var(--gold)"  strokeWidth="50" strokeLinecap="round" opacity=".03"/>
          <path d="M100 540 Q600 160 1100 540" stroke="var(--teal)" strokeWidth="24" strokeLinecap="round" opacity=".045"/>
          <path d="M200 565 Q600 200 1000 565" stroke="var(--gold)"  strokeWidth="16" strokeLinecap="round" opacity=".045"/>
        </svg>

        <div style={{ position: "relative", zIndex: 1, maxWidth: "800px" }} className="fade fade-1">
          {/* H1 */}
          <h1 style={{
            fontSize: "clamp(3rem, 5.5vw, 5.5rem)",
            fontWeight: 900,
            lineHeight: 1.06,
            letterSpacing: "-.02em",
            color: "var(--text)",
            marginBottom: "22px",
          }} className="fade fade-2">
            מוצאים לכם<br />
            את{" "}
            <em style={{ fontStyle: "normal", color: "var(--teal)", position: "relative" }}>
              הטיפול הנכון
              <span style={{
                position: "absolute", bottom: "-6px", right: 0, left: 0,
                height: "5px", borderRadius: "3px",
                background: "linear-gradient(90deg,transparent,var(--gold) 40%,transparent)",
                opacity: .6, display: "block",
              }} />
            </em>
          </h1>

          {/* Subtitle */}
          <p style={{
            fontSize: "1.12rem", color: "var(--text-2)", fontWeight: 400,
            lineHeight: 1.8, maxWidth: "46ch", margin: "0 auto 38px",
          }} className="fade fade-3">
            שאלון שמוביל להמלצה מדויקת על <strong style={{ color: "var(--teal)", fontWeight: 700 }}>סוג הטיפול</strong> ועל <strong style={{ color: "var(--gold)", fontWeight: 700 }}>סוג המטפל</strong> שמתאים לכם.
          </p>
          <p style={{
            fontSize: "1.25rem", color: "var(--teal-dark)", fontWeight: 700,
            margin: "-22px auto 38px",
          }} className="fade fade-3">
            בואו נמצא לכם את המטפל/ת המתאימ/ה
          </p>

          {/* CTAs */}
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center", marginBottom: "24px" }} className="fade fade-4">
            <Link href="/adults" style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              borderRadius: "50px", fontFamily: "inherit", fontWeight: 700, fontSize: "15.5px",
              padding: "14px 34px", background: "var(--teal)", color: "white",
              border: "none", transition: "all .22s", cursor: "pointer",
            }} className="hover:bg-[var(--teal-dark)] hover:-translate-y-0.5">
              <img src="/icons/btn-adults.svg" alt="" width={22} height={22} style={{ display: "block" }} />
              התאמה למבוגרים ←
            </Link>
            <Link href="/kids" style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              borderRadius: "50px", fontFamily: "inherit", fontWeight: 700, fontSize: "15.5px",
              padding: "14px 34px", background: "var(--gold)", color: "white",
              border: "none", transition: "all .22s", cursor: "pointer",
            }} className="hover:bg-[var(--gold-dark)] hover:-translate-y-0.5">
              <img src="/icons/btn-kids.svg" alt="" width={22} height={22} style={{ display: "block" }} />
              התאמה לילדים ←
            </Link>
          </div>

          {/* Eyebrow — moved below CTAs */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            fontSize: "12.5px", fontWeight: 700, color: "var(--teal)",
            textTransform: "uppercase", letterSpacing: ".16em",
            marginBottom: "20px",
            background: "var(--teal-pale)",
            padding: "6px 14px", borderRadius: "50px",
          }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--teal)", flexShrink: 0, display: "inline-block" }} />
            מבוסס מחקר וניסיון קליני
          </div>

          {/* Trust badges */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", fontSize: "13px", color: "var(--muted)", justifyContent: "center" }} className="fade fade-5">
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><img src="/icons/anonymous.svg" alt="" width={20} height={20} style={{ display: "block" }} /> שאלון אנונימי</span>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><img src="/icons/free.svg" alt="" width={20} height={20} style={{ display: "block" }} /> חינמי<TooltipAsterisk /></span>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><img src="/icons/minutes.svg" alt="" width={20} height={20} style={{ display: "block" }} /> כמה דקות</span>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><img src="/icons/report.svg" alt="" width={20} height={20} style={{ display: "block" }} /> דו"ח אישי לשמירה</span>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><img src="/icons/team.svg" alt="" width={20} height={20} style={{ display: "block" }} /> מטפלים מורשים בלבד</span>
          </div>
        </div>
      </section>

      {/* ─── STATS STRIP ─── */}
      <style>{`
        @media (max-width: 640px) {
          .stats-strip { padding: 20px 12px !important; }
          .stat-item { padding: 0 10px !important; }
          .stat-number { font-size: 1.35rem !important; }
          .stat-label { font-size: 11px !important; white-space: normal !important; text-align: center; }
        }
      `}</style>
      <div className="stats-strip" style={{
        background: "var(--surface)",
        borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)",
        padding: "24px 56px",
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: 0, flexWrap: "nowrap",
      }}>
        {[
          { n: "20+", l: "סוגי טיפולים נפשיים" },
          { n: "100%", l: "אנונימי לחלוטין" },
          { n: "מאות", l: "מחקרים כבסיס" },
        ].map(({ n, l }, i, arr) => (
          <div key={n} className="stat-item" style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: "3px",
            padding: "0 44px",
            borderInlineEnd: i < arr.length - 1 ? "1px solid var(--line)" : "none",
            flex: "1 1 0", minWidth: 0,
          }}>
            <span className="stat-number" style={{ fontSize: "2rem", fontWeight: 900, color: "var(--teal)", lineHeight: 1 }}>{n}</span>
            <span className="stat-label" style={{ fontSize: "13px", color: "var(--muted)", whiteSpace: "nowrap" }}>{l}</span>
          </div>
        ))}
      </div>

      {/* ─── HOW IT WORKS ─── */}
      <section style={{ padding: "100px 24px" }}>
        <div style={{ maxWidth: "1080px", margin: "0 auto" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--teal)", textTransform: "uppercase", letterSpacing: ".16em", marginBottom: "10px" }}>
            איך זה עובד
          </p>
          <h2 style={{ fontSize: "clamp(1.9rem, 3.2vw, 3rem)", fontWeight: 900, lineHeight: 1.12, letterSpacing: "-.02em", color: "var(--text)", marginBottom: "14px" }}>
            שלושה צעדים פשוטים
          </h2>
          <p style={{ fontSize: "16px", color: "var(--text-2)", lineHeight: 1.8, maxWidth: "50ch", marginBottom: "60px" }}>
            השאלון מסתעף לפי תשובותיכם — רק שאלות רלוונטיות, בדיוק מה שצריך.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "32px", position: "relative" }} className="steps-grid-wrap">
            <style>{`
              @media (max-width: 640px) {
                .steps-grid-wrap { grid-template-columns: 1fr !important; }
              }
              .steps-grid-wrap::before {
                content: '';
                position: absolute;
                top: 36px;
                right: calc(16.66% + 12px);
                left: calc(16.66% + 12px);
                height: 1px;
                background: var(--teal-mid);
                z-index: 0;
              }
              @media (max-width: 640px) { .steps-grid-wrap::before { display: none; } }
            `}</style>
            {steps.map(({ n, title, body, numBg, numColor, numBorder, tag }) => (
              <div key={n} className="step-card" style={{
                background: "white",
                borderRadius: "var(--radius)",
                padding: "32px 28px",
                border: "1px solid var(--line)",
                position: "relative",
                zIndex: 1,
              }}>
                <div style={{
                  width: "52px", height: "52px", borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "20px", fontWeight: 900,
                  background: numBg,
                  color: numColor,
                  marginBottom: "20px",
                  border: `2px solid ${numBorder}`,
                }}>{n}</div>
                <h3 style={{ fontSize: "17px", fontWeight: 800, color: "var(--text)", marginBottom: "9px" }}>{title}</h3>
                <p style={{ fontSize: "14.5px", color: "var(--muted)", lineHeight: 1.75 }}>{body}</p>
                {tag && (
                  <span style={{
                    display: "inline-block", marginTop: "14px",
                    background: "var(--gold-pale)", color: "var(--gold-dark)",
                    fontSize: "12px", fontWeight: 600,
                    padding: "4px 12px", borderRadius: "50px",
                    border: "1px solid #EDD090",
                  }}>{tag}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TWO PATHS ─── */}
      <div id="adults" style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }} className="paths-grid">
        <style>{`@media (max-width: 640px) { .paths-grid { grid-template-columns: 1fr !important; } }`}</style>

        {/* Adults */}
        <div style={{ background: "var(--teal-pale)", padding: "72px 64px", position: "relative", overflow: "hidden" }}>
          <div style={{
            position: "absolute", bottom: "-80px", left: "-80px",
            width: "300px", height: "300px", borderRadius: "50%",
            border: "44px solid rgba(61,140,138,.08)", pointerEvents: "none",
          }} />
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            borderRadius: "50px", fontSize: "12.5px", fontWeight: 700,
            padding: "5px 16px", marginBottom: "24px",
            background: "var(--teal)", color: "white",
          }}>למבוגרים</div>
          <h3 style={{ fontSize: "clamp(1.5rem, 2.4vw, 2rem)", fontWeight: 900, lineHeight: 1.18, letterSpacing: "-.02em", color: "var(--text)", marginBottom: "14px" }}>
            שאלון התאמת<br />הטיפול למבוגרים
          </h3>
          <p style={{ fontSize: "15px", color: "var(--text-2)", lineHeight: 1.8, marginBottom: "28px", maxWidth: "36ch" }}>
            פותח במשך מספר שנים, מבוסס על מאות מחקרים ועל ניסיון קליני מצטבר.
          </p>
          <ul style={{ listStyle: "none", marginBottom: "36px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {["מיקוד הקושי וסוג הטיפול המתאים", "התאמת אישיות המטפל לצרכיכם", 'דו"ח אישי הניתן לשמירה'].map(item => (
              <li key={item} style={{ fontSize: "14.5px", color: "var(--text-2)", display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <span style={{
                  width: "20px", height: "20px", borderRadius: "50%",
                  background: "var(--teal)", color: "white",
                  fontSize: "11px", fontWeight: 700,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, marginTop: "2px",
                }}>✓</span>
                {item}
              </li>
            ))}
          </ul>
          <Link href="/adults" style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            borderRadius: "50px", fontFamily: "inherit", fontWeight: 700, fontSize: "15.5px",
            padding: "14px 34px", background: "var(--teal)", color: "white",
            transition: "all .22s",
          }} className="hover:bg-[var(--teal-dark)]">
            <img src="/icons/btn-adults.svg" alt="" width={22} height={22} style={{ display: "block" }} />
            התאמה למבוגרים ←
          </Link>
        </div>

        {/* Kids */}
        <div id="kids" style={{ background: "var(--gold-pale)", padding: "72px 64px", position: "relative", overflow: "hidden" }}>
          <div style={{
            position: "absolute", bottom: "-80px", left: "-80px",
            width: "300px", height: "300px", borderRadius: "50%",
            border: "44px solid rgba(212,144,24,.08)", pointerEvents: "none",
          }} />
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            borderRadius: "50px", fontSize: "12.5px", fontWeight: 700,
            padding: "5px 16px", marginBottom: "24px",
            background: "var(--gold)", color: "white",
          }}>לילדים ונוער</div>
          <h3 style={{ fontSize: "clamp(1.5rem, 2.4vw, 2rem)", fontWeight: 900, lineHeight: 1.18, letterSpacing: "-.02em", color: "var(--text)", marginBottom: "14px" }}>
            שאלון התאמת<br />הטיפול לילדים
          </h3>
          <p style={{ fontSize: "15px", color: "var(--text-2)", lineHeight: 1.8, marginBottom: "28px", maxWidth: "36ch" }}>
            מיועד להורים. מבוסס על מחקר בפסיכולוגיה, קלינאות תקשורת, לקויות למידה ועוד.
          </p>
          <ul style={{ listStyle: "none", marginBottom: "36px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {["המלצה על סוג הטיפול והאבחון", "כלים להתמודדות בבית ובכיתה", "מידע על מימון ובירוקרטיה"].map(item => (
              <li key={item} style={{ fontSize: "14.5px", color: "var(--text-2)", display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <span style={{
                  width: "20px", height: "20px", borderRadius: "50%",
                  background: "var(--gold)", color: "white",
                  fontSize: "11px", fontWeight: 700,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, marginTop: "2px",
                }}>✓</span>
                {item}
              </li>
            ))}
          </ul>
          <Link href="/kids" style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            borderRadius: "50px", fontFamily: "inherit", fontWeight: 700, fontSize: "15.5px",
            padding: "14px 34px", background: "var(--gold)", color: "white",
            transition: "all .22s",
          }} className="hover:bg-[var(--gold-dark)]">
            <img src="/icons/btn-kids.svg" alt="" width={22} height={22} style={{ display: "block" }} />
            התאמה לילדים ←
          </Link>
        </div>
      </div>

      {/* ─── QUOTE ─── */}
      <section style={{ padding: "100px 24px", background: "white", textAlign: "center" }}>
        <div style={{ maxWidth: "740px", margin: "0 auto" }}>
          <div style={{ fontSize: "80px", fontWeight: 900, lineHeight: .8, color: "var(--teal-pale)", fontFamily: "Georgia,serif", marginBottom: "8px" }}>"</div>
          <p style={{ fontSize: "clamp(1.1rem, 2vw, 1.5rem)", fontWeight: 300, color: "var(--text)", lineHeight: 1.85, marginBottom: "28px" }}>
            מחקרים רבים מראים כי הצלחת טיפול נפשי תלויה מאוד בהתאמת{" "}
            <strong style={{ fontWeight: 700, color: "var(--teal)" }}>סוג הטיפול לצורך המטופל</strong>{" "}
            — ובהתאמת אישיות המטפל לאישיות המטופל.
          </p>
          <div style={{ width: "48px", height: "3px", borderRadius: "2px", background: "var(--gold)", margin: "0 auto 20px" }} />
          <cite style={{ fontSize: "12.5px", color: "var(--faint)", fontStyle: "normal", textTransform: "uppercase", letterSpacing: ".12em" }}>
            מתוך בסיס המחקר של טיפול חכם
          </cite>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section style={{ background: "var(--surface)", padding: "100px 24px 72px" }}>
        <div style={{ maxWidth: "1080px", margin: "0 auto" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--teal)", textTransform: "uppercase", letterSpacing: ".16em", marginBottom: "10px" }}>שאלות ותשובות</p>
          <h2 style={{ fontSize: "clamp(1.9rem, 3.2vw, 3rem)", fontWeight: 900, lineHeight: 1.12, letterSpacing: "-.02em", color: "var(--text)", marginBottom: "36px" }}>שאלות נפוצות</h2>
          <div style={{ maxWidth: "800px" }}>
            {faqs.map((item, idx) => (
              <details key={idx} style={{
                borderRadius: "14px",
                border: "1px solid var(--line)",
                background: "var(--surface)",
                marginBottom: "6px",
                overflow: "hidden",
              }}>
                <style>{`details[open] { background: white; border-color: var(--teal) !important; }`}</style>
                <summary style={{
                  padding: "20px 24px", fontSize: "15.5px", fontWeight: 600,
                  color: "var(--text)", cursor: "pointer", listStyle: "none",
                  display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px",
                }}>
                  <span>{item.q}</span>
                  <span className="faq-icon" style={{
                    width: "26px", height: "26px", borderRadius: "50%",
                    background: "var(--teal-pale)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "var(--teal)", fontSize: "17px", fontWeight: 300,
                    flexShrink: 0,
                  }}>+</span>
                </summary>
                <div style={{ padding: "0 24px 20px", fontSize: "14.5px", color: "var(--muted)", lineHeight: 1.8 }}>
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CONTACT ─── */}
      <section id="contact" style={{ padding: "80px 24px" }}>
        <div style={{ maxWidth: "680px", margin: "0 auto" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--teal)", textTransform: "uppercase", letterSpacing: ".16em", marginBottom: "10px" }}>צרו קשר</p>
          <h2 style={{ fontSize: "clamp(1.5rem, 2.5vw, 2rem)", fontWeight: 900, color: "var(--text)", marginBottom: "10px" }}>פנייה מהירה</h2>
          <p style={{ fontSize: "15px", color: "var(--text-2)", lineHeight: 1.8, marginBottom: "32px" }}>
            אנחנו כאן לענות על כל שאלה — לפני השאלון, אחריו, או אם סתם רוצים לדבר עם מישהו לפני שמתחילים.
          </p>
          <ContactForm />
        </div>
      </section>
    </>
  );
}
