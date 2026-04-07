"use client";

import { useState } from "react";
import Link from "next/link";

const TYPES = [
  {
    title: "פסיכולוג/ית קליני/ת",
    license: "משרד הבריאות — רישיון פסיכולוג מומחה",
    icon: "🎓",
    desc: null,
    suitable: "טיפול מעמיק, אבחון, מקרים מורכבים, הפרעות אישיות, טראומה",
    richContent: true,
  },
  {
    title: "פסיכולוג/ית חינוכי/ת",
    license: "משרד הבריאות / משרד החינוך (אגף שפ\"י)",
    icon: "📚",
    desc: null,
    suitable: "ילדים ובני נוער, לקויות למידה, קשיי קשב, חרדת בחינות",
    richContent: "educational",
  },
  {
    title: "פסיכולוג/ית התפתחותי/ת",
    license: "משרד הבריאות — רישיון פסיכולוג מומחה (ענף התפתחותי)",
    icon: "🌱",
    desc: null,
    suitable: "לידה עד גיל 9, עיכובי התפתחות, קשיי ויסות, קשר הורה-ילד, קשיי שפה וקוגניציה",
    richContent: "developmental",
  },
  {
    title: "פסיכולוג/ית תעסוקתי/ת",
    license: "משרד הבריאות — רישיון פסיכולוג מומחה (ענף תעסוקתי)",
    icon: "💼",
    desc: null,
    suitable: "בחירת קריירה, שינוי תעסוקתי, הערכת כישורים, ייעוץ ארגוני, שיקום תעסוקתי",
    richContent: "occupational",
  },
  {
    title: "פסיכולוג/ית רפואי/ת",
    license: "משרד הבריאות — רישיון פסיכולוג מומחה (ענף רפואי)",
    icon: "🏥",
    desc: null,
    suitable: "מחלה כרונית, כאב כרוני, אשפוז, אונקולוגיה, הסתגלות למצב רפואי, ליווי בני משפחה",
    richContent: "medical",
  },
  {
    title: "פסיכולוג/ית שיקומי/ת",
    license: "משרד הבריאות — רישיון פסיכולוג מומחה (ענף שיקומי)",
    icon: "♿",
    desc: null,
    suitable: "נכות גופנית, פגיעות ראש, שיקום לאחר מחלה, מוגבלות קוגניטיבית, שילוב חברתי ותעסוקתי",
    richContent: "rehabilitation",
  },
  {
    title: 'עו"ס קליני/ת (עובד/ת סוציאלי/ת קליני/ת)',
    license: 'משרד הרווחה — פנקס העובדים הסוציאליים',
    icon: "🤝",
    desc: null,
    suitable: "טיפול פרטני, זוגי ומשפחתי, משברים, טראומה, חרדה, דיכאון, ילדים ומתבגרים",
    richContent: "socialwork",
  },
  {
    title: "מטפל/ת באמצעות הבעה ויצירה",
    license: "הכשרה מוכרת — מעמד רגולטורי בהסדרה",
    icon: "🎨",
    desc: null,
    suitable: "ילדים, טראומה, ביטוי רגשי, אנשים שמתקשים בדיבור, בתי ספר, בריאות הנפש",
    richContent: "arts",
  },
  {
    title: "מרפא/ה בעיסוק",
    license: "משרד הבריאות — תעודת מקצוע",
    icon: "⚙️",
    desc: null,
    suitable: "ויסות חושי, מוטוריקה עדינה, כתיבה, התארגנות, ADHD, תפקוד בגן ובבית הספר",
    richContent: "ot",
  },
  {
    title: "קלינאי/ת תקשורת",
    license: "משרד הבריאות — תעודת מקצוע",
    icon: "🗣️",
    desc: null,
    suitable: "עיכוב שפתי, היגוי, גמגום, קשיי תקשורת, שמיעה, שיקום שפה אחרי אירוע נוירולוגי",
    richContent: "slp",
  },
  {
    title: "פסיכיאטר/ית",
    license: "משרד הבריאות — רופא/ה מומחה/ית בפסיכיאטריה",
    icon: "💊",
    desc: null,
    suitable: "אבחון נפשי, תרופות, דיכאון קשה, חרדה חמורה, פסיכוזה, הפרעה דו-קוטבית",
    richContent: "psychiatry",
  },
  {
    title: "קרימינולוג/ית קליני/ת",
    license: "משרד הבריאות — תעודת קרימינולוג קליני (חוק הסדרת העיסוק במקצועות הבריאות)",
    icon: "⚖️",
    desc: null,
    suitable: "הערכת סיכון, התנהגות עברייניות, ממשק פסיכיאטרי-משפטי, שיקום, צוותים רב-מקצועיים",
    richContent: "criminology",
  },
  {
    title: "מאמן/ת מנטלי/ת / קואוצ'ר",
    license: "אין רגולציה ממשלתית",
    icon: "🎯",
    desc: "אינו/ה מוסמך/ת לטיפול בהפרעות נפשיות. מתמקד/ת בהשגת מטרות, פיתוח עצמי וביצועים. חשוב להבחין בין קואוצ'ינג לטיפול נפשי.",
    suitable: "פיתוח עצמי, ביצועים, מטרות חיים — לא להפרעות נפשיות",
  },
];

export default function TherapistTypesPage() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <main className="mx-auto max-w-3xl px-5 py-12 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');`}</style>

      <Link href="/research" className="text-sm text-stone-500 hover:underline mb-6 inline-block">← חזרה למאמרים ומידע שימושי</Link>

      <h1 className="text-3xl font-black text-stone-900 mb-3">סוגי המטפלים בישראל</h1>
      <p className="text-stone-600 leading-7 mb-10">
        בישראל פועלים סוגים שונים של אנשי טיפול ובריאות הנפש. ההבדלים ביניהם חשובים — הן מבחינת ההכשרה, הן מבחינת הסמכות המשפטית והן מבחינת ההתאמה לצורך.
      </p>

      <div className="space-y-3">
        {TYPES.map((t, i) => (
          <div key={i} className="rounded-2xl bg-white border border-[#E8E0D8] overflow-hidden" style={{ boxShadow: "0 2px 8px rgba(100,60,30,.05)" }}>
            {/* Header — always visible, clickable */}
            <button
              className="w-full text-right px-5 py-4 flex items-center gap-4 hover:bg-stone-50 transition"
              onClick={() => setOpen(open === i ? null : i)}
            >
              <span className="text-2xl flex-shrink-0">{t.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-extrabold text-stone-900 text-base">{t.title}</span>
                  <span className="text-xs rounded-full px-2 py-0.5 bg-stone-100 text-stone-500 border border-stone-200">{t.license}</span>
                </div>
                <p className="text-xs text-stone-500 truncate">{t.suitable}</p>
              </div>
              <span
                className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-lg transition-transform"
                style={{
                  background: "#F4E8DC",
                  color: "#8B2E0A",
                  transform: open === i ? "rotate(45deg)" : "rotate(0deg)",
                  fontWeight: 300,
                }}
              >
                +
              </span>
            </button>

            {/* Expanded content */}
            {open === i && (
              <div className="px-5 pb-6 pt-3 border-t border-[#EAE0D5]">
                {t.richContent === "ot" ? (
                  <div className="text-sm leading-7 text-stone-700 space-y-4">
                    <p>
                      מרפא/ה בעיסוק הוא/היא איש/אשת מקצוע בריאות בעל/ת תעודת מקצוע מטעם משרד הבריאות, שעוסק/ת בשיפור <strong>התפקוד היומיומי, העצמאות וההשתתפות</strong> של האדם — בבית, במסגרת החינוכית, בעבודה ובחיי היום-יום.
                    </p>

                    <div className="rounded-xl bg-[#EBF5F1] border border-[#A8D4C0] p-4">
                      <h3 className="font-bold text-[#2A6B50] mb-3">אצל ילדים — תחומי עיסוק עיקריים</h3>
                      <div className="grid grid-cols-1 gap-1.5">
                        {[
                          "מוטוריקה עדינה — אחיזת עיפרון, כתיבה, שימוש במספריים, תיאום עין-יד",
                          "ויסות חושי — חיפוש תחושתי, הצפה חושית, רגישויות",
                          "התארגנות למשימות — תכנון, התמדה, גמישות, יכולת להישאר בתוך משימה",
                          "עצמאות בלבוש, אכילה ומשחק",
                          "קושי במעברים ופערים בין יכולת לביצוע בפועל",
                        ].map((item, idx) => (
                          <div key={idx} className="flex gap-2"><span className="text-[#2A6B50] font-bold flex-shrink-0">•</span><span>{item}</span></div>
                        ))}
                      </div>
                      <p className="mt-3 text-xs text-stone-500">משרד הבריאות מגדיר ריפוי בעיסוק כחלק מהשירותים הניתנים לילדים במסגרת מערך התפתחות הילד, כולל מיון, הערכה, התערבות והדרכת הורים.</p>
                    </div>

                    <div className="rounded-xl bg-[#F0F8FF] border border-[#B4D4F0] p-4">
                      <h3 className="font-bold text-[#1A4A8A] mb-2">גישת Cog-Fun — התמחות ייעודית ל-ADHD</h3>
                      <p className="mb-2">חלק מהמרפאות והמרפאים בעיסוק עברו הכשרה בגישת <strong>Cog-Fun</strong> — גישה קוגניטיבית-תפקודית שפותחה באוניברסיטה העברית עבור ילדים, מתבגרים ומבוגרים עם ADHD. הגישה מתמקדת בקשיים בתפקודים ניהוליים ובוויסות עצמי, ומסייעת לפתח אסטרטגיות שעוזרות לתפקד טוב יותר בבית, בלמידה וביחסים. מחקרים שפורסמו עליה מצאו שיפור בתפקוד היומיומי אצל ילדים עם ADHD.</p>
                      <p className="text-xs text-stone-500">כדאי לשאול בעת בחירת מרפאה בעיסוק האם יש לה הכשרה ב-Cog-Fun, כשזה רלוונטי.</p>
                    </div>
                  </div>
                ) : t.richContent === "slp" ? (
                  <div className="text-sm leading-7 text-stone-700 space-y-4">
                    <p>
                      קלינאי תקשורת הוא בעל מקצוע בריאות עם תעודת מקצוע מטעם משרד הבריאות, והתחום עוסק באבחון ובטיפול בבעיות של <strong>שפה, דיבור, תקשורת, שמיעה ולעיתים גם בליעה</strong>. קלינאי תקשורת אינו "מטפל רגשי" במובן הקלאסי, אבל הוא איש מקצוע חשוב מאוד כשיש קושי תקשורתי שמשפיע על תפקוד, התפתחות, למידה וקשרים עם אחרים.
                    </p>

                    <div className="rounded-xl bg-[#EBF5F1] border border-[#A8D4C0] p-4">
                      <h3 className="font-bold text-[#2A6B50] mb-3">אצל ילדים</h3>
                      <ul className="space-y-1.5">
                        <li className="flex gap-2"><span className="text-[#2A6B50] font-bold flex-shrink-0">•</span><span>עיכוב שפתי — אוצר מילים, הבנה, ביטוי.</span></li>
                        <li className="flex gap-2"><span className="text-[#2A6B50] font-bold flex-shrink-0">•</span><span>קשיי היגוי — אי-בהירות בדיבור, הגייה לא תקינה.</span></li>
                        <li className="flex gap-2"><span className="text-[#2A6B50] font-bold flex-shrink-0">•</span><span>קשיי תקשורת — כולל ילדים עם אוטיזם או עיכוב התפתחותי.</span></li>
                        <li className="flex gap-2"><span className="text-[#2A6B50] font-bold flex-shrink-0">•</span><span>קשיים הקשורים לשמיעה — ילדים עם לקות שמיעה או התקנת שתל קוכלארי.</span></li>
                      </ul>
                    </div>

                    <div className="rounded-xl bg-[#F0F8FF] border border-[#B4D4F0] p-4">
                      <h3 className="font-bold text-[#1A4A8A] mb-3">אצל מבוגרים</h3>
                      <ul className="space-y-1.5">
                        <li className="flex gap-2"><span className="text-[#1A4A8A] font-bold flex-shrink-0">•</span><span>שיקום שפה ודיבור אחרי שבץ, פגיעת ראש או מחלה נוירולוגית.</span></li>
                        <li className="flex gap-2"><span className="text-[#1A4A8A] font-bold flex-shrink-0">•</span><span>גמגום וקשיי שטף דיבור.</span></li>
                        <li className="flex gap-2"><span className="text-[#1A4A8A] font-bold flex-shrink-0">•</span><span>קשיי בליעה (דיספאגיה) — לרוב בהקשר רפואי.</span></li>
                      </ul>
                    </div>
                  </div>
                ) : t.richContent === "arts" ? (
                  <div className="text-sm leading-7 text-stone-700 space-y-4">
                    <p>
                      מטפל באמצעות הבעה ויצירה עוסק בטיפול נפשי דרך תהליכי יצירה והבעה. בניגוד לטיפול בשיחה, <strong>היצירה עצמה היא הכלי הטיפולי</strong> — לא רק ביטוי, אלא תהליך של עיבוד, חקירה ושינוי.
                    </p>

                    <div className="rounded-xl bg-[#F5EEF8] border border-[#D4B4E8] p-4">
                      <h3 className="font-bold text-[#6A3A8A] mb-3">שישה תחומי התמחות</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {["🖼️ אמנות", "📖 ביבליותרפיה", "🎭 דרמה", "🎵 מוזיקה", "🎪 פסיכודרמה", "🕺 תנועה"].map((item) => (
                          <div key={item} className="rounded-lg bg-white/70 border border-[#D4B4E8] px-3 py-2 text-[#6A3A8A] font-medium">{item}</div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl bg-[#EBF5F1] border border-[#A8D4C0] p-4">
                      <h3 className="font-bold text-[#2A6B50] mb-3">מסלול ההכשרה</h3>
                      <ul className="space-y-2.5">
                        <li className="flex gap-2"><span className="text-[#2A6B50] font-bold flex-shrink-0">•</span><span><strong>תואר שני (M.A.):</strong> בטיפול באמצעות אמנויות, במסלול ההתמחות הרלוונטי — כולל לימודים תיאורטיים, הכשרה קלינית מעשית וסופרוויז'ן.</span></li>
                        <li className="flex gap-2"><span className="text-[#2A6B50] font-bold flex-shrink-0">•</span><span><strong>מעמד רגולטורי:</strong> התחום מוכר ופועל במערכות הציבוריות (חינוך, בריאות הנפש), אך עבר לאורך השנים שינויים והסדרה מורכבת — כדאי לבדוק את המצב העדכני מול הגוף המקצועי הרלוונטי.</span></li>
                      </ul>
                    </div>

                    <div className="rounded-xl bg-[#FEF3EB] border border-[#F4C8A4] p-4">
                      <h3 className="font-bold text-[#8B4A10] mb-3">למי מתאים?</h3>
                      <ul className="space-y-1.5">
                        <li className="flex gap-2"><span className="text-[#8B4A10] font-bold flex-shrink-0">•</span><span>ילדים ובני נוער שמתקשים בביטוי מילולי.</span></li>
                        <li className="flex gap-2"><span className="text-[#8B4A10] font-bold flex-shrink-0">•</span><span>עיבוד טראומה — כשהמילים אינן מספיקות.</span></li>
                        <li className="flex gap-2"><span className="text-[#8B4A10] font-bold flex-shrink-0">•</span><span>אנשים עם מוגבלות שכלית או קוגניטיבית.</span></li>
                        <li className="flex gap-2"><span className="text-[#8B4A10] font-bold flex-shrink-0">•</span><span>כחלק ממערך טיפולי רחב יותר לצד טיפול שיחתי.</span></li>
                      </ul>
                    </div>
                  </div>
                ) : t.richContent === "criminology" ? (
                  <div className="text-sm leading-7 text-stone-700 space-y-4">
                    <p>
                      קרימינולוג קליני הוא בעל מקצוע המוסדר בישראל במסגרת <strong>חוק הסדרת העיסוק במקצועות הבריאות</strong>. מי שעומד בדרישות החוק יכול לקבל תעודת קרימינולוג קליני מטעם משרד הבריאות. בתחום בריאות הנפש, הקרימינולוגיה הקלינית עוסקת באבחון, הערכה, טיפול, שיקום וייעוץ — במיוחד <strong>בממשק שבין מצוקה נפשית, התנהגות, סיכון ותפקוד חברתי</strong>.
                    </p>

                    <div className="rounded-xl bg-[#F5EEF8] border border-[#D4B4E8] p-4">
                      <h3 className="font-bold text-[#6A3A8A] mb-3">מסלול ההכשרה</h3>
                      <ul className="space-y-2.5">
                        <li className="flex gap-2"><span className="text-[#6A3A8A] font-bold flex-shrink-0">•</span><span><strong>תואר ראשון:</strong> בקרימינולוגיה, עבודה סוציאלית, פסיכולוגיה או תחום קרוב.</span></li>
                        <li className="flex gap-2"><span className="text-[#6A3A8A] font-bold flex-shrink-0">•</span><span><strong>תואר שני:</strong> בקרימינולוגיה קלינית או תחום מוכר, כולל פרקטיקום קליני.</span></li>
                        <li className="flex gap-2"><span className="text-[#6A3A8A] font-bold flex-shrink-0">•</span><span><strong>עמידה בדרישות החוק:</strong> הגשת מועמדות למשרד הבריאות לקבלת התעודה המוכרת.</span></li>
                      </ul>
                    </div>

                    <div className="rounded-xl bg-[#FDF6EE] border border-[#F0D4A8] p-4">
                      <h3 className="font-bold text-[#8B4A10] mb-3">תחומי עיסוק מרכזיים</h3>
                      <ul className="space-y-2">
                        <li className="flex gap-2"><span className="text-[#8B4A10] font-bold flex-shrink-0">•</span><span><strong>הערכת סיכון:</strong> הערכת פוטנציאל לאלימות, חזרה לעבירה ורמת סכנה לסביבה.</span></li>
                        <li className="flex gap-2"><span className="text-[#8B4A10] font-bold flex-shrink-0">•</span><span><strong>ממשק פסיכיאטרי-משפטי (פורנזי):</strong> עבודה עם אוכלוסיות במערכת המשפט, בכלא או בפיקוח.</span></li>
                        <li className="flex gap-2"><span className="text-[#8B4A10] font-bold flex-shrink-0">•</span><span><strong>שיקום חברתי:</strong> סיוע בשילוב חזרה לקהילה, בניית מסגרת חיים תפקודית ומניעת הישנות.</span></li>
                        <li className="flex gap-2"><span className="text-[#8B4A10] font-bold flex-shrink-0">•</span><span><strong>צוותים רב-מקצועיים:</strong> עבודה במרפאות ובבתי חולים לבריאות הנפש לצד פסיכיאטרים, פסיכולוגים ועו"סים.</span></li>
                      </ul>
                    </div>
                  </div>
                ) : t.richContent === "psychiatry" ? (
                  <div className="text-sm leading-7 text-stone-700 space-y-4">
                    <p>
                      פסיכיאטר הוא קודם כול <strong>רופא</strong>: הוא מסיים לימודי רפואה, מקבל רישיון לעסוק ברפואה, ולאחר מכן עובר התמחות בפסיכיאטריה. לאחר סיום ההתמחות והבחינות הוא מוכר כ<strong>מומחה בפסיכיאטריה</strong>.
                    </p>

                    <div className="rounded-xl bg-[#F8F4FF] border border-[#D8C8F0] p-4">
                      <h3 className="font-bold text-[#4A2A8A] mb-3">מסלול ההכשרה</h3>
                      <ul className="space-y-2.5">
                        <li className="flex gap-2"><span className="text-[#4A2A8A] font-bold flex-shrink-0">•</span><span><strong>לימודי רפואה (6 שנים):</strong> תואר M.D. — רפואה כללית, אנטומיה, פיזיולוגיה, פתולוגיה ועוד.</span></li>
                        <li className="flex gap-2"><span className="text-[#4A2A8A] font-bold flex-shrink-0">•</span><span><strong>רישיון לעסוק ברפואה:</strong> לאחר סיום הלימודים ועמידה בדרישות משרד הבריאות.</span></li>
                        <li className="flex gap-2"><span className="text-[#4A2A8A] font-bold flex-shrink-0">•</span><span><strong>התמחות בפסיכיאטריה:</strong> כולל עבודה במחלקות ובמרפאות פסיכיאטריות, רכיבי נוירולוגיה ורפואה כללית, לפי הסילבוס המוגדר.</span></li>
                        <li className="flex gap-2"><span className="text-[#4A2A8A] font-bold flex-shrink-0">•</span><span><strong>בחינות מומחיות:</strong> בסיום — בחינות תיאורטיות ומעשיות. עם המעבר — תואר "מומחה בפסיכיאטריה".</span></li>
                      </ul>
                    </div>

                    <div className="rounded-xl bg-[#F0F8FF] border border-[#B4D4F0] p-4">
                      <h3 className="font-bold text-[#1A4A8A] mb-3">תחומי עיסוק מרכזיים</h3>
                      <ul className="space-y-2">
                        <li className="flex gap-2"><span className="text-[#1A4A8A] font-bold flex-shrink-0">•</span><span><strong>אבחון מצבים נפשיים:</strong> הערכה רפואית-נפשית מקיפה, כולל שלילת גורמים אורגניים.</span></li>
                        <li className="flex gap-2"><span className="text-[#1A4A8A] font-bold flex-shrink-0">•</span><span><strong>קביעת תוכנית טיפול:</strong> שילוב בין תרופות, פסיכותרפיה ומסגרת הטיפול המתאימה.</span></li>
                        <li className="flex gap-2"><span className="text-[#1A4A8A] font-bold flex-shrink-0">•</span><span><strong>רישום ואיזון תרופות:</strong> טיפול תרופתי במצבים כמו דיכאון, חרדה, פסיכוזה והפרעה דו-קוטבית.</span></li>
                        <li className="flex gap-2"><span className="text-[#1A4A8A] font-bold flex-shrink-0">•</span><span><strong>פסיכיאטריה של ילד ומתבגר:</strong> בישראל קיימת מומחיות נפרדת המוכרת על ידי משרד הבריאות, עם הכשרה ייעודית לאוכלוסייה זו.</span></li>
                      </ul>
                    </div>

                    <p className="text-xs text-stone-500">
                      פסיכיאטרים רבים אינם מעניקים טיפול פסיכותרפי שוטף — תפקידם מתמקד באבחון וניהול תרופתי. ישנם פסיכיאטרים שגם מטפלים בשיחות, אך זה פחות נפוץ בשל עומס ומגבלות מערכתיות.
                    </p>
                  </div>
                ) : t.richContent === "socialwork" ? (
                  <div className="text-sm leading-7 text-stone-700 space-y-4">
                    <p>
                      עו״ס קליני הוא עובד סוציאלי שעוסק בעיקר בטיפול נפשי, אבחון פסיכו־סוציאלי, ליווי במצבי משבר, עבודה עם טראומה, חרדה, דיכאון וקשיים ביחסים — עם ילדים, מתבגרים, מבוגרים, זוגות ומשפחות. בניגוד לתפיסה הרווחת, <strong>התואר המוגן בחוק הוא "עובד סוציאלי"</strong> — הביטוי "קליני" מתאר אוריינטציה טיפולית-נפשית מובהקת.
                    </p>

                    <div className="rounded-xl bg-[#EBF5F1] border border-[#A8D4C0] p-4">
                      <h3 className="font-bold text-[#2A6B50] mb-3">מסלול ההכשרה</h3>
                      <ul className="space-y-2.5">
                        <li className="flex gap-2"><span className="text-[#2A6B50] font-bold flex-shrink-0">•</span><span><strong>תואר ראשון (BSW):</strong> בעבודה סוציאלית — כולל פרקטיקום בשטח. בסיום נרשמים בפנקס העובדים הסוציאליים של משרד הרווחה.</span></li>
                        <li className="flex gap-2"><span className="text-[#2A6B50] font-bold flex-shrink-0">•</span><span><strong>רישיון לטיפול:</strong> כבר מרגע הרישום, החוק מאפשר לעסוק בטיפול, ייעוץ, שיקום והדרכה של פרטים, משפחות וקהילות.</span></li>
                        <li className="flex gap-2"><span className="text-[#2A6B50] font-bold flex-shrink-0">•</span><span><strong>תואר שני (MSW) — מקובל מאוד:</strong> רבים ממשיכים לתואר שני, לעיתים במסלול קליני ייעודי הכולל פרקטיקום מעמיק.</span></li>
                        <li className="flex gap-2"><span className="text-[#2A6B50] font-bold flex-shrink-0">•</span><span><strong>הכשרות נוספות:</strong> לאחר מכן, רבים ממשיכים ללימודי פסיכותרפיה (CBT, דינאמי, EMDR וכו') כהכשרות ייעודיות.</span></li>
                      </ul>
                    </div>

                    <div className="rounded-xl bg-[#F0F8FF] border border-[#B4D4F0] p-4">
                      <h3 className="font-bold text-[#1A4A8A] mb-3">מה מייחד את הגישה?</h3>
                      <p className="mb-2">העו״ס הקליני מביא <strong>ראייה מערכתית</strong> — מבין את האדם בתוך ההקשר של חייו: נפשי, משפחתי, חברתי, כלכלי ותרבותי. לכן לצד טיפול רגשי בשיחה:</p>
                      <ul className="space-y-2">
                        <li className="flex gap-2"><span className="text-[#1A4A8A] font-bold flex-shrink-0">•</span><span>עבודה עם בני משפחה, מסגרות חינוך וגורמי רווחה.</span></li>
                        <li className="flex gap-2"><span className="text-[#1A4A8A] font-bold flex-shrink-0">•</span><span>סיוע בסוגיות תפקוד, זכויות, משברים ומעברים בחיים.</span></li>
                        <li className="flex gap-2"><span className="text-[#1A4A8A] font-bold flex-shrink-0">•</span><span>נפוצ/ה מאוד במרפאות בריאות הנפש, קופות חולים, שירותי רווחה, מסגרות שיקום וקליניקות פרטיות.</span></li>
                      </ul>
                    </div>
                  </div>
                ) : t.richContent === "medical" ? (
                  <div className="text-sm leading-7 text-stone-700 space-y-4">
                    <p>
                      הפסיכולוג הרפואי עוסק ביחסי הגומלין בין גוף לנפש, ובסיוע נפשי לאנשים המתמודדים עם מחלה גופנית, אשפוז, כאב, טיפולים רפואיים, מחלה כרונית או מצבים רפואיים מורכבים. העבודה כוללת אבחון והערכה, טיפול במטופלים, ליווי בני משפחה, ולעיתים גם <strong>ייעוץ לצוותים רפואיים</strong> בתוך בתי חולים, מרפאות וקופות חולים.
                    </p>

                    <div className="rounded-xl bg-[#F8F4FF] border border-[#D8C8F0] p-4">
                      <h3 className="font-bold text-[#4A2A8A] mb-3">מסלול ההכשרה</h3>
                      <ul className="space-y-2.5">
                        <li className="flex gap-2"><span className="text-[#4A2A8A] font-bold flex-shrink-0">•</span><span><strong>תואר ראשון:</strong> בפסיכולוגיה בציונים גבוהים — תנאי קבלה לתואר השני.</span></li>
                        <li className="flex gap-2"><span className="text-[#4A2A8A] font-bold flex-shrink-0">•</span><span><strong>תואר שני (M.A.):</strong> במסלול פסיכולוגיה קלינית או רפואית, כולל פרקטיקום בסביבה רפואית.</span></li>
                        <li className="flex gap-2"><span className="text-[#4A2A8A] font-bold flex-shrink-0">•</span><span><strong>התמחות — 4 שנים:</strong> בבתי חולים כלליים או פסיכיאטריים, מרפאות כאב, מחלקות אונקולוגיה ומסגרות רפואיות מוכרות.</span></li>
                        <li className="flex gap-2"><span className="text-[#4A2A8A] font-bold flex-shrink-0">•</span><span><strong>בחינת המומחיות:</strong> בסיום — בחינה מול ועדת בוחנים. עם המעבר מקבל תואר "פסיכולוג רפואי מומחה".</span></li>
                      </ul>
                    </div>

                    <div className="rounded-xl bg-[#F0F8FF] border border-[#B4D4F0] p-4">
                      <h3 className="font-bold text-[#1A4A8A] mb-3">תחומי עיסוק מרכזיים</h3>
                      <ul className="space-y-2">
                        <li className="flex gap-2"><span className="text-[#1A4A8A] font-bold flex-shrink-0">•</span><span><strong>מחלה כרונית וכאב:</strong> סיוע בהסתגלות, התמודדות עם הגבלות תפקודיות ושיפור איכות חיים.</span></li>
                        <li className="flex gap-2"><span className="text-[#1A4A8A] font-bold flex-shrink-0">•</span><span><strong>אונקולוגיה ומחלות קשות:</strong> ליווי נפשי בשלבי אבחנה, טיפול ושיקום — למטופל ולמשפחה.</span></li>
                        <li className="flex gap-2"><span className="text-[#1A4A8A] font-bold flex-shrink-0">•</span><span><strong>הכנה לניתוחים ופרוצדורות:</strong> הפחתת חרדה לפני פרוצדורות רפואיות ועידוד שיתוף פעולה עם הטיפול.</span></li>
                        <li className="flex gap-2"><span className="text-[#1A4A8A] font-bold flex-shrink-0">•</span><span><strong>ייעוץ לצוותים רפואיים:</strong> סיוע לצוות בהתמודדות עם מטופלים מורכבים ומניעת שחיקה מקצועית.</span></li>
                      </ul>
                    </div>
                  </div>
                ) : t.richContent === "developmental" ? (
                  <div className="text-sm leading-7 text-stone-700 space-y-4">
                    <p>
                      הפסיכולוג ההתפתחותי עוסק באבחון ובטיפול בילדים מגיל לידה ועד גיל 9 ובמשפחותיהם, בעיקר סביב שאלות של התפתחות, ויסות, קשר הורה־ילד, קשיים רגשיים בגיל הרך ועיכובים בתחומים כמו שפה, קוגניציה, תקשורת ומוטוריקה. העבודה נעשית לרוב בתוך <strong>מערך התפתחות הילד ובצוותים רב-מקצועיים</strong>.
                    </p>

                    <div className="rounded-xl bg-[#EBF5F1] border border-[#A8D4C0] p-4">
                      <h3 className="font-bold text-[#2A6B50] mb-3">מסלול ההכשרה</h3>
                      <ul className="space-y-2.5">
                        <li className="flex gap-2"><span className="text-[#2A6B50] font-bold flex-shrink-0">•</span><span><strong>תואר ראשון:</strong> בפסיכולוגיה בציונים גבוהים — תנאי קבלה לתואר השני.</span></li>
                        <li className="flex gap-2"><span className="text-[#2A6B50] font-bold flex-shrink-0">•</span><span><strong>תואר שני (M.A.):</strong> במסלול פסיכולוגיה התפתחותית, כולל פרקטיקום עם ילדים צעירים ומשפחותיהם.</span></li>
                        <li className="flex gap-2"><span className="text-[#2A6B50] font-bold flex-shrink-0">•</span><span><strong>התמחות — 4 שנים:</strong> במרכזי התפתחות הילד ובמסגרות מוכרות על ידי משרד הבריאות.</span></li>
                        <li className="flex gap-2"><span className="text-[#2A6B50] font-bold flex-shrink-0">•</span><span><strong>בחינת המומחיות:</strong> בסיום — בחינה מול ועדת בוחנים. עם המעבר מקבל תואר "פסיכולוג התפתחותי מומחה".</span></li>
                      </ul>
                    </div>

                    <div className="rounded-xl bg-[#FEF3EB] border border-[#F4C8A4] p-4">
                      <h3 className="font-bold text-[#8B4A10] mb-3">תחומי עיסוק מרכזיים</h3>
                      <ul className="space-y-2">
                        <li className="flex gap-2"><span className="text-[#8B4A10] font-bold flex-shrink-0">•</span><span><strong>אבחון התפתחותי:</strong> הערכת רמת ההתפתחות הקוגניטיבית, השפתית, החברתית והמוטורית ואיתור עיכובים.</span></li>
                        <li className="flex gap-2"><span className="text-[#8B4A10] font-bold flex-shrink-0">•</span><span><strong>ויסות רגשי וחושי:</strong> טיפול בקשיי ויסות בגיל הרך, כולל שינה, אכילה והתנהגות.</span></li>
                        <li className="flex gap-2"><span className="text-[#8B4A10] font-bold flex-shrink-0">•</span><span><strong>קשר הורה־ילד:</strong> טיפול דיאדי ותמיכה בהורים לחיזוק הקשר וההורות.</span></li>
                        <li className="flex gap-2"><span className="text-[#8B4A10] font-bold flex-shrink-0">•</span><span><strong>חשד לאוטיזם:</strong> אבחון מוקדם ולווי משפחות בשלב שלפני ואחרי האבחנה.</span></li>
                      </ul>
                    </div>
                  </div>
                ) : t.richContent === "rehabilitation" ? (
                  <div className="text-sm leading-7 text-stone-700 space-y-4">
                    <p>
                      הפסיכולוג השיקומי עוסק באבחון ובטיפול באנשים בכל גיל שחיים עם נכות או מוגבלות תפקודית — גופנית, קוגניטיבית או רגשית — בין אם היא מולדת, התפתחותית, נרכשה בעקבות מחלה או נגרמה מטראומה. המטרה המרכזית היא לסייע לאדם <strong>למצות את יכולותיו ולהשתלב בצורה מיטבית</strong> בחיים האישיים, המשפחתיים, החברתיים, הלימודיים והתעסוקתיים.
                    </p>

                    <div className="rounded-xl bg-[#EBF5F1] border border-[#A8D4C0] p-4">
                      <h3 className="font-bold text-[#2A6B50] mb-3">מסלול ההכשרה</h3>
                      <ul className="space-y-2.5">
                        <li className="flex gap-2"><span className="text-[#2A6B50] font-bold flex-shrink-0">•</span><span><strong>תואר ראשון:</strong> בפסיכולוגיה בציונים גבוהים — תנאי קבלה לתואר השני.</span></li>
                        <li className="flex gap-2"><span className="text-[#2A6B50] font-bold flex-shrink-0">•</span><span><strong>תואר שני (M.A.):</strong> במסלול פסיכולוגיה שיקומית או קלינית עם דגש שיקומי, כולל פרקטיקום בשטח.</span></li>
                        <li className="flex gap-2"><span className="text-[#2A6B50] font-bold flex-shrink-0">•</span><span><strong>התמחות — 4 שנים:</strong> במוסדות שיקומיים מוכרים על ידי משרד הבריאות (בתי חולים שיקומיים, מרכזי שיקום, מוסדות לטיפול באוכלוסיות מיוחדות).</span></li>
                        <li className="flex gap-2"><span className="text-[#2A6B50] font-bold flex-shrink-0">•</span><span><strong>בחינת המומחיות:</strong> בסיום — בחינה מול ועדת בוחנים. עם המעבר מקבל תואר "פסיכולוג שיקומי מומחה".</span></li>
                      </ul>
                    </div>

                    <div className="rounded-xl bg-[#F0F8FF] border border-[#B4D4F0] p-4">
                      <h3 className="font-bold text-[#1A4A8A] mb-3">תחומי עיסוק מרכזיים</h3>
                      <ul className="space-y-2">
                        <li className="flex gap-2"><span className="text-[#1A4A8A] font-bold flex-shrink-0">•</span><span><strong>פגיעות ראש ושבץ:</strong> הערכה קוגניטיבית, טיפול בהשלכות הרגשיות ותכנון שיקום תפקודי.</span></li>
                        <li className="flex gap-2"><span className="text-[#1A4A8A] font-bold flex-shrink-0">•</span><span><strong>נכות גופנית ומחלות כרוניות:</strong> סיוע בהסתגלות, בניית זהות חדשה ושמירה על איכות חיים.</span></li>
                        <li className="flex gap-2"><span className="text-[#1A4A8A] font-bold flex-shrink-0">•</span><span><strong>מוגבלות שכלית התפתחותית:</strong> אבחון, התאמות תפקודיות ותמיכה במשפחה.</span></li>
                        <li className="flex gap-2"><span className="text-[#1A4A8A] font-bold flex-shrink-0">•</span><span><strong>שילוב תעסוקתי וחינוכי:</strong> הכנה לחזרה לעבודה או ללימודים לאחר פגיעה או מחלה.</span></li>
                      </ul>
                    </div>
                  </div>
                ) : t.richContent === "occupational" ? (
                  <div className="text-sm leading-7 text-stone-700 space-y-4">
                    <p>
                      הפסיכולוגיה התעסוקתית עוסקת ב<strong>התאמה בין אדם לעולם העבודה</strong> — הערכה ומיון, ייעוץ קריירה, ייעוץ ארגוני, ופיתוח רווחה ותפקוד של עובדים, צוותים וארגונים.
                    </p>

                    <div className="rounded-xl bg-[#F5EEF8] border border-[#D4B4E8] p-4">
                      <h3 className="font-bold text-[#6A3A8A] mb-3">מסלול ההכשרה</h3>
                      <ul className="space-y-2.5">
                        <li className="flex gap-2"><span className="text-[#6A3A8A] font-bold flex-shrink-0">•</span><span><strong>תואר ראשון:</strong> בפסיכולוגיה בציונים גבוהים — תנאי קבלה לתואר השני.</span></li>
                        <li className="flex gap-2"><span className="text-[#6A3A8A] font-bold flex-shrink-0">•</span><span><strong>תואר שני (M.A.):</strong> במסלול פסיכולוגיה תעסוקתית-ארגונית, כולל פרקטיקום בשטח.</span></li>
                        <li className="flex gap-2"><span className="text-[#6A3A8A] font-bold flex-shrink-0">•</span><span><strong>התמחות — 4 שנים:</strong> במוסדות מוכרים על ידי משרד הבריאות.</span></li>
                        <li className="flex gap-2"><span className="text-[#6A3A8A] font-bold flex-shrink-0">•</span><span><strong>בחינת המומחיות:</strong> בסיום — בחינה מול ועדת בוחנים. עם המעבר מקבל תואר "פסיכולוג תעסוקתי מומחה".</span></li>
                      </ul>
                    </div>

                    <div className="rounded-xl bg-[#FDF6EE] border border-[#F0D4A8] p-4">
                      <h3 className="font-bold text-[#8B4A10] mb-3">ענפי ההתמחות העיקריים</h3>
                      <ul className="space-y-2">
                        <li className="flex gap-2"><span className="text-[#8B4A10] font-bold flex-shrink-0">•</span><span><strong>מבחנים והערכה:</strong> פיתוח וביצוע הערכות כישורים, אישיות ופוטנציאל לצרכי מיון וקידום.</span></li>
                        <li className="flex gap-2"><span className="text-[#8B4A10] font-bold flex-shrink-0">•</span><span><strong>ייעוץ תעסוקתי:</strong> עזרה לפרטים בבחירת מסלול, שינוי קריירה ושיקום תעסוקתי.</span></li>
                        <li className="flex gap-2"><span className="text-[#8B4A10] font-bold flex-shrink-0">•</span><span><strong>ייעוץ ארגוני:</strong> שיפור תפקוד צוותים, ניהול שינוי, פיתוח מנהלים ורווחת עובדים.</span></li>
                      </ul>
                    </div>
                  </div>
                ) : t.richContent === "educational" ? (
                  <div className="text-sm leading-7 text-stone-700 space-y-4">
                    <p>
                      תהליך ההכשרה של פסיכולוג חינוכי בישראל הוא מובנה, ארוך ומפוקח על ידי משרד הבריאות ומשרד החינוך (אגף שפ"י). מדובר בדרך שנמשכת לרוב <strong>כעשור מתחילת הלימודים</strong> ועד לקבלת תואר "מומחה".
                    </p>

                    <div className="rounded-xl bg-[#EBF5F1] border border-[#A8D4C0] p-4">
                      <h3 className="font-bold text-[#2A6B50] mb-3">שלבי ההכשרה</h3>
                      <ul className="space-y-2.5">
                        <li className="flex gap-2"><span className="text-[#2A6B50] font-bold flex-shrink-0">•</span><span><strong>תואר ראשון:</strong> בפסיכולוגיה בציונים גבוהים — תנאי קבלה לתואר השני.</span></li>
                        <li className="flex gap-2"><span className="text-[#2A6B50] font-bold flex-shrink-0">•</span><span><strong>תואר שני (M.A.):</strong> במסלול פסיכולוגיה חינוכית (או מסלולים מוכרים כגון פסיכולוגיה של הילד), כולל פרקטיקום — התנסות מעשית בשטח עם הדרכה.</span></li>
                        <li className="flex gap-2"><span className="text-[#2A6B50] font-bold flex-shrink-0">•</span><span><strong>התמחות — 4 שנים בחצי משרה:</strong> לב ליבה של ההכשרה. מתבצעת לרוב במסגרת שפ"ח (שירות פסיכולוגי חינוכי) ברשויות המקומיות, המוכר על ידי משרד הבריאות כמוסד מאמן.</span></li>
                        <li className="flex gap-2"><span className="text-[#2A6B50] font-bold flex-shrink-0">•</span><span><strong>בחינת המומחיות:</strong> רק לאחר מעבר בהצלחה מקבל הפסיכולוג את התואר "פסיכולוג חינוכי מומחה".</span></li>
                      </ul>
                    </div>

                    <div className="rounded-xl bg-[#F8F4FF] border border-[#D8C8F0] p-4">
                      <h3 className="font-bold text-[#4A2A8A] mb-2">המשך דרך</h3>
                      <p>ישנם פסיכולוגים חינוכיים מומחים שממשיכים לקבלת רישיון כ<strong>"פסיכולוג חינוכי מדריך"</strong> — המוסמך להדריך מתמחים.</p>
                    </div>

                    <p>
                      פסיכולוג חינוכי לרוב מטפל בילדים ונוער. לעיתים, לאחר הכשרות נוספות, עובד גם עם מבוגרים או גיל הזהב.
                    </p>
                  </div>
                ) : t.richContent === true ? (
                  <div className="text-sm leading-7 text-stone-700 space-y-4">
                    <p>
                      הפסיכולוג הקליני עוסק בהבנת עולמו הפנימי של האדם, אבחון קשיים נפשיים ומתן טיפול נפשי (פסיכותרפיה). בנוסף, הוא מוסמך לערוך <strong>אבחון פסיכודיאגנוסטי למבוגרים</strong> — הערכה מקיפה של תפקוד נפשי, אישיות ומצב רגשי — כאשר ההכשרה הנרחבת שעבר מכשירה אותו לכך באופן ייחודי. בישראל, התואר <strong>"פסיכולוג קליני מומחה"</strong> מוגן על פי חוק הפסיכולוגים (1977), ורק מי שעמד בכל תנאי ההכשרה רשאי להשתמש בו.
                    </p>

                    <div className="rounded-xl bg-[#F8F4FF] border border-[#D8C8F0] p-4">
                      <h3 className="font-bold text-[#4A2A8A] mb-3">1. מסלול ההכשרה</h3>
                      <p className="text-xs text-stone-500 mb-3">בישראל, המסלול נחשב לאחד התחרותיים ביותר באקדמיה:</p>
                      <ul className="space-y-2.5">
                        <li className="flex gap-2"><span className="text-[#4A2A8A] font-bold flex-shrink-0">•</span><span><strong>תואר שני (M.A.):</strong> לאחר תואר ראשון בהצטיינות ומעבר מבחן המתא"ם — לימודי פסיכולוגיה קלינית הכוללים פרקטיקום.</span></li>
                        <li className="flex gap-2"><span className="text-[#4A2A8A] font-bold flex-shrink-0">•</span><span><strong>רישום בפנקס הפסיכולוגים:</strong> עם סיום התואר השני, הבוגר נחשב "פסיכולוג" — אך עדיין לא "מומחה".</span></li>
                        <li className="flex gap-2"><span className="text-[#4A2A8A] font-bold flex-shrink-0">•</span><span><strong>התמחות — 4 שנים:</strong> במוסדות מוכרים על ידי משרד הבריאות.</span></li>
                        <li className="flex gap-2"><span className="text-[#4A2A8A] font-bold flex-shrink-0">•</span><span><strong>בחינת המומחיות:</strong> בסיום ההתמחות — בחינה בעל פה מול ועדת בוחנים בכירה. רק לאחר המעבר הופך לפסיכולוג קליני מומחה.</span></li>
                      </ul>
                    </div>

                    <div className="rounded-xl bg-[#F0F8FF] border border-[#B4D4F0] p-4">
                      <h3 className="font-bold text-[#1A4A8A] mb-3">2. מבנה ההתמחות הייחודי לישראל</h3>
                      <p className="mb-3">משרד הבריאות מחייב עבודה בשני סוגי מרפאות:</p>
                      <ul className="space-y-2.5">
                        <li className="flex gap-2"><span className="text-[#1A4A8A] font-bold flex-shrink-0">•</span><span><strong>התמחות מרפאתית (אמבולטורית):</strong> מרפאות בריאות הנפש או קופות חולים. דיכאון, חרדה, משברי חיים וקשיים בינאישיים.</span></li>
                        <li className="flex gap-2"><span className="text-[#1A4A8A] font-bold flex-shrink-0">•</span><span><strong>התמחות אשפוזית:</strong> מחלקות פסיכיאטריות. מצבים מורכבים — פסיכוזה, הפרעות אישיות קשות, מצבי חירום אובדניים — בצוות רב-מקצועי.</span></li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-stone-700">{t.desc}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-2xl p-5 bg-amber-50 border border-amber-200 text-sm text-amber-900 leading-7">
        <strong>חשוב לדעת:</strong> כותרת כמו "מטפל/ת" או "יועץ/ת" אינה מוגנת בחוק. לפני שמתחילים טיפול, מומלץ לוודא שיש למטפל/ת רישיון ממשלתי מוכר.
      </div>
    </main>
  );
}
