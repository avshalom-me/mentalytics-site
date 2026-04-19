import Link from "next/link";
import type { Metadata } from "next";
import { HelpCircle, MessageCircle, Mail, Lock, Coins, Heart, Sparkles, User, GraduationCap } from "lucide-react";
import ContactForm from "./components/ContactForm";

export const metadata: Metadata = {
  title: "טיפול חכם — הכוונה טיפולית חכמה",
  description: "מלאו שאלון קצר וקבלו המלצות מותאמות אישית על סוג הטיפול, סוג המטפל, והמטפל הנכון עבורכם — לילדים ולמבוגרים.",
};

const faqs = [
  {
    q: 'מה זה "טיפול חכם"?',
    a: '"טיפול חכם" היא מערכת שאלונים מודולרית (משתנה אוטומטית לפי התשובות שלכם) שמסייעת למקד את הקושי ולהציע כיוון טיפולי מתאים, על בסיס מחקר וניסיון קליני מצטבר. בנוסף, המערכת מציעה "שידוך" המתאים ביותר לפי צרכיכם — סוג הטיפול המומלץ, סוג ואופי המטפל, העדפות מיקום, שפה, תרבות ועוד.',
  },
  {
    q: "האם צריך להזין פרטים מזהים?",
    a: "לא. השימוש בשאלונים אנונימי לחלוטין ולא נשמר בשום מקום.",
  },
  {
    q: "כמה פעמים אפשר להשתמש בשאלון ומה העלות?",
    a: "ניתן להשתמש 3 פעמים בשאלון. לאחר מכן תשלום סמלי של 30 שקלים. לרוב אין צורך ביותר מפעם או פעמיים.",
  },
  {
    q: "כמה זמן זה לוקח?",
    a: "בדרך כלל כמה דקות. השאלון מודולרי, כך שרק שאלות רלוונטיות מופיעות בהתאם לתשובות.",
  },
  {
    q: "איך מתחילים שאלון למבוגרים או לילדים/נוער?",
    a: "התחלת השאלונים נמצאת בכפתורים הקבועים בתפריט העליון (שאלון למבוגרים / שאלון לילדים-נוער).",
  },
  {
    q: "למה להשתמש בחברה שלכם, האם לא עדיף לקבל המלצה מחבר/ה?",
    a: "לעיתים אכן זה כיוון טוב לקבל המלצה מחבר. אולם לא תמיד מטפל שמתאים לחבר/ה מתאים גם לך. לפעמים בגלל הבדלים בסיבה שבאת לטיפול ולפעמים זה סוג הטיפול או האישיות המקצועית של המטפל.",
  },
  {
    q: "מה עוד אני מקבל?",
    a: "בחלק מהמקרים יינתנו כלים להפחתת הקשיים המדווחים או להתמודדות טובה יותר עם מה שצויין. המערכת גם יודעת להפנות לאבחון או הערכה לפי הצורך.",
  },
];


function TrustBadge({ icon: Icon, text, color }: { icon: any; text: string; color: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-white/80 px-5 py-4 shadow-sm border border-[#EDE5DC]">
      <div
        className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: color + "22" }}
      >
        <Icon size={16} style={{ color }} />
      </div>
      <p className="text-sm leading-6 text-stone-700 font-medium">{text}</p>
    </div>
  );
}

export default function HomePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": ["MedicalBusiness", "HealthAndBeautyBusiness"],
    name: "טיפול חכם",
    url: "https://www.tipolchacham.co.il",
    description:
      "מערכת הכוונה טיפולית חכמה — התאמת מטפלים על בסיס שאלונים מבוססי מחקר",
    areaServed: { "@type": "Country", name: "IL" },
    serviceType: "Therapist Matching",
  };

  return (
    <main
      className="mx-auto max-w-5xl px-5 pb-20"
      dir="rtl"
      style={{ fontFamily: "'Heebo', sans-serif" }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');

        details summary::-webkit-details-marker { display: none; }

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
        .fade-up-4 { animation-delay: .46s; }

        .blob { animation: floatBlob 7s ease-in-out infinite; }
        .blob-2 { animation-duration: 9s; animation-delay: 1.5s; }
        .blob-3 { animation-duration: 11s; animation-delay: 3s; }

        details[open] .rotate-plus { transform: rotate(45deg); }
        .rotate-plus { transition: transform .25s ease; display:inline-block; }
      `}</style>

      {/* HERO */}
      <section className="pt-10 fade-up">
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
          <div className="blob blob-3 pointer-events-none absolute left-1/2 top-8 h-56 w-56 -translate-x-1/2 rounded-full opacity-20"
            style={{ background: "radial-gradient(circle, #D4A0C8, transparent 70%)" }} />

          <div className="relative p-8 md:p-12">
            <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">

              {/* LEFT: TEXT */}
              <div className="max-w-2xl fade-up fade-up-1">
                <div className="mb-5 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold tracking-widest uppercase"
                  style={{ background: "#F4A57422", color: "#B06030", border: "1px solid #F4A57455" }}>
                  <Sparkles size={12} />
                  מבוסס מחקר וניסיון קליני
                </div>

                <h1
                  className="text-5xl font-black tracking-tight"
                  style={{ color: "#2C1A10", letterSpacing: "-0.02em" }}
                >
                  טיפול חכם
                </h1>

                <p className="mt-2 text-xl font-semibold" style={{ color: "#6B4226" }}>
                  מערכת בירור, הכוונה והתאמה טיפולית באמצעות שאלונים אנונימיים
                </p>

                <p className="mt-5 leading-8 text-stone-700">
                  מחקרים רבים מראים כי הצלחת טיפול נפשי תלויה מאוד{" "}
                  <span className="font-bold" style={{ color: "#8B2E0A" }}>
                    בהתאמת סוג הטיפול לצורך של המטופל/ת
                  </span>{" "}
                  ובהתאמת{" "}
                  <span className="font-bold" style={{ color: "#0F5468" }}>
                    אישיות המטופל לאישיות המקצועית של המטפל
                  </span>
                  . הצעד הראשון הוא להבין — ואנחנו כאן בדיוק בשביל זה.
                </p>

                <div
                  className="mt-6 rounded-2xl p-5"
                  style={{
                    background: "rgba(255,255,255,0.75)",
                    border: "1px solid rgba(220,200,175,0.55)",
                    backdropFilter: "blur(6px)",
                  }}
                >
                  <p className="font-bold text-stone-900">לכאן אנחנו נכנסים:</p>
                  <p className="mt-2 leading-7 text-stone-700">
                    בנינו מערכת שאלונים מודולרית, המבוססת על מאות מחקרים בתחום האבחון
                    והטיפול וכן על ניסיון קליני מצטבר של פסיכולוגים ואנשי טיפול —
                    שתסייע גם למקד את הקושי שאיתו אתם מתמודדים וגם להתאים את סוג
                    הטיפול ואת איש הטיפול המתאים ביותר עבורכם.
                  </p>
                </div>

                <div className="mt-6 flex flex-col gap-3 fade-up fade-up-2">
                  <TrustBadge
                    icon={Lock}
                    color="#0F5468"
                    text="השימוש בשאלונים אנונימי לחלוטין ולא נשמר בשום מקום."
                  />
                  <TrustBadge
                    icon={Coins}
                    color="#8B2E0A"
                    text="ניתן להשתמש 3 פעמים בשאלון, לאחר מכן תשלום סמלי של 30 שקלים. לרוב אין צורך ביותר מפעם או פעמיים."
                  />
                  <TrustBadge
                    icon={Heart}
                    color="#9B4F80"
                    text='המערכת פותחה ע"י פסיכולוגים ומטפלים קליניים וכן חוקרים בתחומים שונים - כדי שתקבלו את הטיפול ואת המטפל/ת המתאים ביותר עבורכם'
                  />
                </div>

                <p className="mt-5 text-sm" style={{ color: "#8B6A50" }}>
                  לפירוט והסבר השתמשו בכפתורים בתפריט העליון: מבוגרים / ילדים-נוער.<br />
                  להתחלת שאלון באופן מיידי יש ללחוץ על "שאלון למבוגרים" / "שאלון לילדים".
                </p>
              </div>

              {/* RIGHT: ILLUSTRATIONS + CARD */}
              <div className="flex w-full flex-col gap-4 md:w-[300px] fade-up fade-up-3">

                <div
                  className="rounded-3xl p-5"
                  style={{
                    background: "rgba(255,255,255,0.82)",
                    border: "1px solid rgba(220,200,175,0.55)",
                    backdropFilter: "blur(10px)",
                    boxShadow: "0 8px 28px rgba(120,80,50,.09)",
                  }}
                >
                  <div className="flex items-center gap-2 font-extrabold text-stone-900">
                    <HelpCircle size={18} style={{ color: "#8B2E0A" }} />
                    טיפול חכם
                  </div>
                  <p className="mt-2 text-sm leading-6 text-stone-700">
                    אם אתם לא בטוחים מאיפה להתחיל, או רוצים לשאול משהו לפני — אפשר לפנות כאן ונחזור אליכם בחום.
                  </p>

                  <div className="mt-4 flex flex-col gap-2">
                    <Link
                      href="#contact"
                      className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 active:scale-95"
                      style={{ background: "linear-gradient(135deg,#0F5468,#1A7A96)" }}
                    >
                      <MessageCircle size={16} />
                      לפנייה מהירה
                    </Link>
                    <Link
                      href="/about"
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#D8CBBF] bg-white/80 px-4 py-3 text-sm font-semibold text-stone-800 transition hover:bg-white"
                    >
                      <Mail size={16} />
                      לקרוא עוד / אודות
                    </Link>
                  </div>

                </div>

              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS — demo match */}
      <section className="mt-14 fade-up fade-up-4" dir="rtl">
        <h2 className="mb-6 text-2xl font-extrabold text-stone-900">אז איך זה עובד?</h2>

        {/* Layout: steps right, demo card left. On mobile: stacked */}
        <div className="flex flex-col sm:flex-row gap-6 items-start">

          {/* Steps — stacked vertically on the right (RTL = right side) */}
          <ol className="flex-1 space-y-3">
            {[
              { n: "1", title: "מלא/י את השאלון", body: "השאלון מסתעף בהתאם לתשובות — כל תשובה משפיעה על השאלה הבאה." },
              { n: "2", title: "קבל/י מסמך פלט", body: "תקציר סוגי הטיפול המתאימים לך, ניתן לשמירה כ-PDF. בנוסף תקבל/י כלים מיידיים שמתאימים לסוג הקושי המתואר." },
              { n: "3", title: "בחר/י מטפל מותאם", body: "לפי הטיפול הכי מתאים שיצא בשאלון, ההתאמה לאישיות המקצועית של המטפל ופרמטרים נוספים — תקבל/י רשימת התאמות מדורגת." },
            ].map(({ n, title, body }) => (
              <li key={n} className="rounded-2xl border border-[#E8E0D8] bg-white p-4 flex gap-3" style={{ boxShadow: "0 2px 12px rgba(60,40,20,.07)" }}>
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1a3a5c] text-white text-xs font-bold">{n}</span>
                <div>
                  <div className="font-bold text-stone-900 text-sm mb-0.5">{title}</div>
                  <div className="text-xs text-stone-500 leading-relaxed">{body}</div>
                </div>
              </li>
            ))}
            <li className="rounded-2xl border border-[#E8E0D8] bg-white px-4 py-3 flex gap-3 items-center" style={{ boxShadow: "0 2px 12px rgba(60,40,20,.07)" }}>
              <span className="text-sm text-stone-600">
                השימוש בשאלונים חינמי{" "}
                <details className="inline">
                  <summary className="inline cursor-pointer list-none text-[#8B2E0A] font-bold hover:underline">*</summary>
                  <span className="block mt-1 text-xs text-stone-500 leading-relaxed">בשימוש הוגן. מעל 3 שימושים ישנו תשלום סמלי של 30 ש״ח.</span>
                </details>
              </span>
            </li>
          </ol>

          {/* Demo card — styled exactly like a real match card */}
          <div className="w-full sm:w-72 shrink-0 rounded-2xl bg-white p-4 shadow-lg">
            <div className="flex items-start gap-3" dir="rtl">
              <img src="/demo-freud.webp" alt="זיגמונד פרויד"
                className="h-14 w-14 flex-shrink-0 rounded-xl object-cover object-top" />
              <div className="flex-1 text-right">
                <h3 className="text-base font-bold text-[#1a3a5c]">זיגמונד פרויד</h3>
                <p className="text-xs text-[#6b7280]">זכר • אונליין • 📍 יבנה</p>
                <p className="mt-1 text-xs text-gray-600 line-clamp-2">
                  פסיכיאטר ונוירולוג עם למעלה מ-40 שנות ניסיון בטיפול דינמי. מתמחה בחרדה ודיכאון.
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <span className="rounded-full bg-[#e0f4fa] px-2 py-0.5 text-xs text-[#2e7d8c]">טיפול דינמי</span>
                  <span className="rounded-full bg-[#e0f4fa] px-2 py-0.5 text-xs text-[#2e7d8c]">התאמה באזור</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
                  <div className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white bg-[#1a3a5c]">✦ 91%</div>
                  <div className="rounded-full border border-[#1a3a5c] px-2.5 py-0.5 text-xs font-semibold text-[#1a3a5c]">מקצועי: 88%</div>
                  <div className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white bg-emerald-600">אישיותי: 96%</div>
                </div>
              </div>
            </div>

            {/* AI explanation demo — button only */}
            <div className="mt-3" dir="rtl">
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#c7ddf5] bg-[#f0f7ff] px-3 py-1.5 text-xs font-semibold text-[#1a3a5c] cursor-default opacity-80">
                ✦ למה זה מתאים לי?
              </span>
            </div>

            <div className="mt-2.5 flex flex-wrap gap-2" dir="rtl">
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-green-500 px-3 py-1.5 text-xs font-semibold text-white opacity-80 cursor-default">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                וואטסאפ
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#2e7d8c] px-3 py-1.5 text-xs font-semibold text-white opacity-80 cursor-default">✉ מייל</span>
            </div>
            <p className="mt-1.5 text-xs text-stone-400 italic">* הדמיה בלבד</p>
          </div>

        </div>
      </section>

      {/* WHY IT MATTERS */}
      <section className="mt-14 fade-up fade-up-4">
        <h2 className="mb-6 text-2xl font-extrabold text-stone-900">למה זה חשוב?</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: "🔍",
              title: "מיקוד הקושי",
              body: "לא כל כאב נפשי הוא אותו הדבר. השאלון עוזר להבין מה באמת קורה — לפני שמחפשים עזרה.",
              bg: "#FEF3EB",
              border: "#F4C8A4",
            },
            {
              icon: "🤝",
              title: "התאמה אישית",
              body: "ישנם בשוק כיום למעלה מ-20 סוגי טיפולים נפשיים שונים ועוד מספר אבחונים פסיכולוגיים שונים. התאמת סוג הטיפול לבעיה היא קריטית להצלחה.",
              bg: "#EBF5F1",
              border: "#A8D4C0",
            },
            {
              icon: "🛡️",
              title: "פרטיות מלאה",
              body: "ללא שם, ללא מייל, ללא מעקב. השאלון הוא שלכם — פרטי ומוגן.",
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
              <h3 className="mb-2 font-bold text-stone-900">{p.title}</h3>
              <p className="text-sm leading-6 text-stone-700">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ADULTS QUESTIONNAIRE */}
      <section id="adults" className="mt-14 fade-up">
        <div
          className="rounded-3xl p-8 md:p-10"
          style={{
            background: "linear-gradient(135deg,#FDF6EE 0%,#F5E8DC 60%,#E8F4F0 100%)",
            border: "1px solid #E0D5C8",
            boxShadow: "0 8px 32px rgba(120,80,50,.10)",
          }}
        >
          <div className="mb-1 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold tracking-widest uppercase"
            style={{ background: "#C96B5522", color: "#C96B55", border: "1px solid #C96B5544" }}>
            <User size={12} />
            מבוגרים
          </div>

          <h2 className="mt-4 text-2xl font-extrabold text-stone-900 leading-snug">
            שאלון התאמת הטיפול עבור מבוגרים
          </h2>

          <div className="mt-5 space-y-4 leading-8 text-stone-700">
            <p>
              שאלון התאמת הטיפול עבור מבוגרים <strong>פותח במשך מספר שנים</strong>. הוא מבוסס על שילוב של עיבוד{" "}
              <span className="font-bold" style={{ color: "#8B2E0A" }}>מאות מחקרים בתחום הפסיכולוגיה ומדעי המוח</span>,
              על ניסיון קליני של מטפלים מובילים ועל עיבוד של בינה מלאכותית.
            </p>
            <p>
              מטרת השאלון היא <strong>כפולה</strong>: להבין איזה{" "}
              <span className="font-semibold" style={{ color: "#0F5468" }}>סוג טיפול</span> הכי
              מתאים לצורך שלכם, וגם איזה{" "}
              <span className="font-semibold" style={{ color: "#0F5468" }}>סגנון אישיות של מטפל/ת</span>{" "}
              הכי מתאים לצרכים שלכם.
            </p>
            <p>
              לאחר המענה על השאלון תיפתח לכם האפשרות לבחור מטפל המתאים ביותר עבורכם (ע"פ סוג הטיפול, אישיות מקצועית של המטפל, גיל, איזור מגורים, מגדר, העדפה תרבותית ועוד).
            </p>
          </div>

          <div className="mt-7 flex items-center gap-4 flex-wrap">
            <span className="text-base font-semibold text-stone-800">למעבר לשאלון לחצו כאן:</span>
            <Link
              href="/adults"
              className="inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold text-white transition hover:opacity-90 active:scale-95"
              style={{ background: "linear-gradient(135deg,#C96B55,#A0402A)" }}
            >
              <User size={16} />
              לשאלון למבוגרים ←
            </Link>
          </div>
        </div>
      </section>

      {/* KIDS QUESTIONNAIRE */}
      <section id="kids" className="mt-10 fade-up">
        <div
          className="rounded-3xl p-8 md:p-10"
          style={{
            background: "linear-gradient(135deg,#F0F7F2 0%,#DFF0E6 60%,#E8F4F0 100%)",
            border: "1px solid #C8DDD0",
            boxShadow: "0 8px 32px rgba(50,100,70,.10)",
          }}
        >
          <div className="mb-1 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold tracking-widest uppercase"
            style={{ background: "#6F8F7A22", color: "#4A7060", border: "1px solid #6F8F7A44" }}>
            <GraduationCap size={12} />
            ילדים ונוער
          </div>

          <h2 className="mt-4 text-2xl font-extrabold text-stone-900 leading-snug">
            שאלון התאמת הטיפול עבור ילדים
          </h2>

          <div className="mt-5 space-y-4 leading-8 text-stone-700">
            <p>
              שאלון התאמת הטיפול עבור ילדים <strong>פותח במשך מספר שנים</strong>. הוא מבוסס על שילוב של עיבוד{" "}
              <span className="font-bold" style={{ color: "#2A5C3A" }}>מאות מחקרים בתחום הפסיכולוגיה ומדעי המוח</span>,
              על ניסיון קליני של מטפלים במספר תחומים: פסיכולוגיה, קלינאות תקשורת, לקויות למידה, ריפוי בעיסוק, פיזיותרפיה ועוד.
            </p>
            <p>
              <strong>מטרות המענה על השאלון מרובות:</strong> להבין איזה{" "}
              <span className="font-semibold" style={{ color: "#0F5468" }}>סוג טיפול/אבחון</span> הכי
              מתאים לילדכם, לקבל כלים להתמודדות בבית או בכיתה, ולמצוא את המטפל/המאבחן המתאים ביותר.
              בנוסף, הדו"ח שיינתן יסביר על אפשרויות המימון והבירוקרטיה הכרוכה.
            </p>
            <p>
              לאחר המענה על השאלון יתקבל <strong>דו"ח אוטומטי</strong> שימליץ על אפשרויות הטיפול או האבחון הטובות ביותר.
              כמו כן, ברוב המקרים יינתנו גם כלים להתמודדות עבור ההורים והצוות החינוכי.
            </p>
            <p>
              בנוסף, ניתן יהיה לקבל התאמות מטפלים/מאבחנים ע"פ פרמטרים שונים כגון: התאמת הטיפול/אבחון לקושי הילד,{" "}
              גיל, מגדר, מקום מגורים, שפה והעדפה תרבותית ועוד.
            </p>
          </div>

          <div className="mt-7 flex items-center gap-4 flex-wrap">
            <span className="text-base font-semibold text-stone-800">למעבר לשאלון לחצו כאן:</span>
            <Link
              href="/kids"
              className="inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold text-white transition hover:opacity-90 active:scale-95"
              style={{ background: "linear-gradient(135deg,#6F8F7A,#4A7060)" }}
            >
              <GraduationCap size={16} />
              לשאלון לילדים ←
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-14">
        <h2 className="mb-6 text-2xl font-extrabold text-stone-900">שאלות ותשובות</h2>
        <div className="space-y-3">
          {faqs.map((item, idx) => (
            <details
              key={idx}
              className="group rounded-2xl bg-white p-5 cursor-pointer"
              style={{
                border: "1px solid #EAE0D5",
                boxShadow: "0 4px 14px rgba(100,60,30,.06)",
              }}
            >
              <summary className="flex list-none items-center justify-between font-bold text-stone-900">
                <span>{item.q}</span>
                <span
                  className="rotate-plus mr-3 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full leading-none"
                  style={{ background: "#F4E8DC", color: "#8B2E0A", fontSize: "20px", fontWeight: 300 }}
                >
                  +
                </span>
              </summary>
              <p className="mt-4 leading-7 text-stone-700 border-t border-[#EAE0D5] pt-4">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="mt-14">
        <div
          className="rounded-3xl p-8"
          style={{
            background: "linear-gradient(135deg,#FDF6EE,#E8F4F0)",
            border: "1px solid #E0D5C8",
            boxShadow: "0 8px 28px rgba(100,60,30,.08)",
          }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ background: "#0F546822" }}>
              <MessageCircle size={20} style={{ color: "#0F5468" }} />
            </div>
            <h3 className="text-xl font-extrabold text-stone-900">פנייה מהירה</h3>
          </div>
          <p className="text-stone-700 leading-7">
            אנחנו כאן לענות על כל שאלה — לפני השאלון, אחריו, או אם סתם רוצים לדבר עם מישהו לפני שמתחילים.
          </p>
          <ContactForm />
        </div>
      </section>

      <div className="h-16" />
    </main>
  );
}