import Image from "next/image";
import type { Metadata } from "next";
import PageViewTracker from "@/app/components/PageViewTracker";

export const metadata: Metadata = {
  title: "מי אנחנו",
  description: "הכירו את הצוות מאחורי טיפול חכם - מערכת הכוונה טיפולית מבוססת מחקר שפותחה על ידי פסיכולוגים קליניים, לעזור לכם למצוא את המטפל הנכון.",
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
    bullets: ["פסיכולוג קליני מומחה", "מרצה בתחום האבחון הפסיכולוגי", "פסיכולוג מאבחן במגזר הפרטי והציבורי"],
  },
  {
    name: "שילת יוגב",
    role: "חברת הצוות המקצועי המפתח",
    img: "/team/shilat.jpeg",
    bullets: ["מנהלת מרכז טיפולי לילדים ומבוגרים במשך כעשור", "פיזיותרפיסטית ילדים"],
  },
  {
    name: "יוחאי ברוקנר",
    role: "חבר הצוות המקצועי המפתח",
    img: "/team/yochai.jpg",
    bullets: [
      "פסיכולוג בהתמחות חינוכית ותעסוקתית",
      "בעל ניסיון בתחום היזמות החברתית",
    ],
  },
  {
    name: "עומר סבו",
    role: "רכזת פיתוח ומחקר",
    img: "/team/omer.jpeg",
    bullets: [
      "סטודנטית לתואר שני בפסיכולוגיה התפתחותית",
      "ניסיון בעולמות הסטארטאפ ויזמות חברתית",
      "היכרות מעמיקה עם עולם הטיפול",
    ],
  },
];

const BASE = "https://www.mentalytics.co.il";

/**
 * AboutPage + Person entities, built FROM the `team` array above - never
 * restated by hand, so the schema cannot drift from what the page displays.
 *
 * Why this exists: a therapy-matching site is squarely YMYL, where Google
 * weighs who stands behind the advice. The credentials were already on the
 * page in prose; until now nothing made them machine-readable, and the site
 * carried no Person entity at all. `knowsAbout` is deliberately omitted -
 * inferring topics from a job title would be us asserting expertise the page
 * does not state.
 */
const aboutLd = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  url: `${BASE}/about`,
  inLanguage: "he",
  name: "מי אנחנו - טיפול חכם",
  mainEntity: {
    "@type": "Organization",
    name: "טיפול חכם",
    alternateName: "Mentalytics",
    url: BASE,
    logo: `${BASE}/logo.svg.png`,
    founder: {
      "@type": "Person",
      name: team[0].name,
      jobTitle: team[0].role,
    },
    member: team.map((m) => ({
      "@type": "Person",
      name: m.name,
      jobTitle: m.role,
      // The bullets are the credentials the page already publishes.
      description: m.bullets.join("; "),
      image: `${BASE}${m.img}`,
    })),
  },
};

export default function AboutPage() {
  return (
    <main
      className="about-scale mx-auto max-w-5xl px-5 pb-20"
      dir="rtl"
      style={{ fontFamily: "'Heebo', sans-serif" }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutLd).replace(/</g, "\\u003c") }}
      />
      <PageViewTracker page="about" source="about" />
      <style>{`
        /* גודל הדף כולו נגזר ממשתנה אחד: 10% בנייד, 30% במחשב (בקשת הבעלים,
           10/9/2026). הכל כאן מוכפל ב-var(--s) - גם גדלי הגופן וגם התמונות -
           כדי ששני היחסים יישבו במקום אחד ולא יתפזרו על פני שלושים ערכים.
           הריווח, הפדינג והרדיוסים לא גדלים: התבקשו גופנים ותמונות בלבד,
           והגדלת המסגרת הייתה דוחפת את רשת שלושת הכרטיסים לגלישה.
           גבהי שורה נכתבים כמספר חסר-יחידה כדי שיגדלו עם הגופן; leading-6
           קבוע של Tailwind היה הופך טקסט גדול יותר לצפוף יותר. */
        .about-scale { --s: 1.1; --story-pad: 26px 22px; }
        @media (min-width: 768px) { .about-scale { --s: 1.3; --story-pad: 52px 56px; } }

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

      {/* STORY */}
      <section className="pt-10 fade-up fade-up-1">
        <div style={{
          position: "relative",
          borderRadius: "28px",
          overflow: "hidden",
          background: "linear-gradient(160deg, #FDFAF6 0%, #F4F9F7 100%)",
          border: "1px solid var(--line)",
          // 56px קבוע בכל רוחב השאיר לטקסט 221 פיקסלים בנייד, כלומר 23 תווים
          // לשורה, וההגדלה רק החמירה את זה. במחשב הריווח נשאר כשהיה.
          padding: "var(--story-pad)",
        }}>
          {/* Decorative quote mark */}
          <div aria-hidden="true" style={{
            position: "absolute",
            top: "-12px",
            right: "24px",
            fontSize: "calc(200px * var(--s))",
            lineHeight: 1,
            fontFamily: "Georgia, serif",
            color: "var(--teal)",
            opacity: 0.07,
            userSelect: "none",
            pointerEvents: "none",
            fontWeight: 900,
          }}>״</div>

          {/* Eyebrow */}
          <p style={{ fontSize: "calc(11px * var(--s))", fontWeight: 700, color: "var(--teal)", textTransform: "uppercase", letterSpacing: ".2em", marginBottom: "28px" }}>
            הסיפור שלנו
          </p>

          {/* Opening hook */}
          <p style={{ fontSize: "calc(20px * var(--s))", fontWeight: 800, color: "var(--text)", lineHeight: 1.8, marginBottom: "22px", maxWidth: "68ch" }}>
            הסיפור שלנו התחיל בערב אחד, כשקבוצה של פסיכולוגים וחוקרים ישבה סביב שולחן ושאלה שאלה פשוטה:{" "}
            <span style={{ color: "var(--teal)" }}>למה כל כך מורכב למצוא מטפל/ת?</span>
          </p>

          {/* Body */}
          <p style={{ fontSize: "calc(17px * var(--s))", lineHeight: 2.0, color: "var(--text-2)", maxWidth: "68ch", marginBottom: "28px" }}>
            כולנו הכרנו מטפלים מצוינים וגם הפנינו אליהם, אבל שוב ושוב ראינו שלא תמיד נוצרת התאמה טובה. לפעמים סוג הטיפול לא היה המדויק ביותר עבור האדם שפנה, ולפעמים פשוט לא נוצר החיבור האנושי והאישי שכל כך חשוב להצלחת התהליך. פעמים רבות המטופל בכלל לא ידע מה הוא מחפש.
          </p>

          {/* Founding moment - gold side border */}
          <div style={{ borderInlineStart: "4px solid var(--gold)", paddingInlineStart: "22px" }}>
            <p style={{ fontSize: "calc(17px * var(--s))", lineHeight: 2.0, color: "var(--text)", fontWeight: 500, maxWidth: "66ch" }}>
              משם התחיל רעיון קטן, שהלך וגדל: האם אפשר להפוך את בחירת המטפל למקצועית יותר?
            </p>
            <p style={{ fontSize: "calc(17px * var(--s))", lineHeight: 2.0, color: "var(--text)", fontWeight: 500, maxWidth: "66ch", marginTop: "12px" }}>
              כך נולדה <strong style={{ color: "var(--teal)" }}>"טיפול חכם"</strong> - מערכת שנבנתה במשך מספר שנים, הנשענת על ידע מחקרי וקליני, ומסייעת להתאים בין מטפלים למטופלים לא רק לפי זמינות או המלצה מקרית, אלא לפי הצרכים, הבנת הקשיים, ההעדפות וסוג הטיפול המתאים ביותר לכל אדם.
            </p>
          </div>
        </div>
      </section>

      {/* DISCLAIMER */}
      <section className="mt-10 fade-up fade-up-2">
        <div style={{
          borderRadius: "20px",
          padding: "24px 32px",
          background: "var(--teal-pale)",
          border: "1px solid var(--teal-mid)",
          display: "flex",
          alignItems: "center",
          gap: "16px",
        }}>
          <img src="/icons/lightbulb.svg" alt="" width={28} height={28} style={{ flexShrink: 0, display: "block", width: "calc(28px * var(--s))", height: "calc(28px * var(--s))" }} />
          <p style={{ fontSize: "calc(16px * var(--s))", fontWeight: 600, color: "var(--teal-dark)", lineHeight: 1.7, margin: 0 }}>
            אנחנו לא מחליפים טיפול או אבחון מקצועי - אנחנו עוזרים לכם להגיע אליו במהירות ובמקצועיות
          </p>
        </div>
      </section>

      {/* TEAM */}
      <section className="mt-14 fade-up fade-up-3">
        <div className="flex items-start gap-3 mb-6">
          <div
            className="mt-1 flex flex-shrink-0 items-center justify-center rounded-2xl"
            style={{ background: "var(--surface)", border: "1px solid var(--line)", width: "calc(40px * var(--s))", height: "calc(40px * var(--s))" }}
          >
            <img src="/icons/team.svg" alt="" width={24} height={24} style={{ display: "block", width: "calc(24px * var(--s))", height: "calc(24px * var(--s))" }} />
          </div>
          <div>
            <h2 className="font-extrabold text-stone-900" style={{ fontSize: "calc(24px * var(--s))", lineHeight: 1.33 }}>הצוות המקצועי המפתח</h2>
            <p className="mt-1 text-stone-600" style={{ fontSize: "calc(16px * var(--s))", lineHeight: 1.6 }}>אנשי מקצוע מהתחום הקליני והאבחוני שמובילים את הפיתוח המקצועי.</p>
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
                <div className="relative overflow-hidden rounded-2xl flex-shrink-0"
                  style={{ border: "2px solid var(--line)", background: "var(--surface)", width: "calc(64px * var(--s))", height: "calc(64px * var(--s))" }}>
                  <Image src={m.img} alt={m.name} fill className="object-cover" />
                </div>
                <div>
                  <div className="font-extrabold text-stone-900" style={{ fontSize: "calc(16px * var(--s))", lineHeight: 1.4 }}>{m.name}</div>
                  <div className="mt-0.5 font-semibold" style={{ color: "#8B6A50", fontSize: "calc(12px * var(--s))", lineHeight: 1.4 }}>
                    {m.role}
                  </div>
                </div>
              </div>

              <ul className="mt-4 space-y-2">
                {m.bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-stone-700" style={{ fontSize: "calc(14px * var(--s))", lineHeight: 1.71 }}>
                    <span
                      className="mt-2 flex-shrink-0 rounded-full"
                      style={{ background: "var(--teal)", width: "calc(6px * var(--s))", height: "calc(6px * var(--s))" }}
                    />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* VALUES */}
      <section className="mt-14 fade-up fade-up-2">
        <div className="flex items-start gap-3 mb-6">
          <div
            className="mt-1 flex flex-shrink-0 items-center justify-center rounded-2xl"
            style={{ background: "var(--surface)", border: "1px solid var(--line)", width: "calc(40px * var(--s))", height: "calc(40px * var(--s))" }}
          >
            <img src="/icons/values.svg" alt="" width={24} height={24} style={{ display: "block", width: "calc(24px * var(--s))", height: "calc(24px * var(--s))" }} />
          </div>
          <div>
            <h2 className="font-extrabold text-stone-900" style={{ fontSize: "calc(24px * var(--s))", lineHeight: 1.33 }}>מה מנחה אותנו</h2>
            <p className="mt-1 text-stone-600" style={{ fontSize: "calc(16px * var(--s))", lineHeight: 1.6 }}>הערכים שעומדים מאחורי כל שאלה ושאלה.</p>
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
              {
                icon: "/icons/clinical-experience.svg",
                title: "ניסיון קליני של אנשי טיפול",
                body: "המערכת פותחה על ידי פסיכולוגים קליניים ואנשי טיפול עם שנים של ניסיון מצטבר בשטח.",
              },
              {
                icon: "/icons/research.svg",
                title: "בסיס מחקרי",
                body: "כל שאלון מבוסס על ספרות מקצועית מוכרת וניסיון קליני מצטבר.",
              },
              {
                icon: "/icons/privacy.svg",
                title: "פרטיות מלאה",
                body: "לא שומרים שמות, לא מייל, לא מעקב. המידע שלכם נשאר שלכם.",
              },
              {
                icon: "/icons/starting-point.svg",
                title: "נקודת התחלה ואבחון, לא תחליף",
                body: "אנחנו לא מחליפים טיפול מקצועי - אנחנו עוזרים לכם להגיע אליו במהירות ובביטחון.",
              },
            ].map((v, i) => (
              <div
                key={i}
                className="flex items-start gap-4 rounded-2xl p-5"
                style={{ background: "#FAFAF9", border: "1px solid #EAE0D5" }}
              >
                <img src={v.icon} alt="" width={32} height={32} className="mt-0.5 flex-shrink-0" style={{ display: "block", width: "calc(32px * var(--s))", height: "calc(32px * var(--s))" }} />
                <div>
                  <div className="font-bold text-stone-900" style={{ fontSize: "calc(16px * var(--s))", lineHeight: 1.5 }}>{v.title}</div>
                  <p className="mt-1 text-stone-700" style={{ fontSize: "calc(14px * var(--s))", lineHeight: 1.71 }}>{v.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="h-16" />
    </main>
  );
}
