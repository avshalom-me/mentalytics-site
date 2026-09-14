import Link from "next/link";
import QuizCta from "@/app/therapists/QuizCta";
import TooltipAsterisk from "@/app/components/TooltipAsterisk";

// חלקים משותפים לשלוש גרסאות עמוד ה"כתבה" של קמפיין הנייטיב (/lp/story-*).
// התיקייה מתחילה בקו תחתון ולכן אינה route. כל גרסה היא מאמר אחר לגמרי
// בזווית שלו; מה שמשותף הוא הביילוס, תגיות האמון, הסגירה וה-FAQ, שאסור
// שיהיו שונים בין הזרועות, אחרת הטסט מודד גם אותם.

const BADGE = { display: "flex", alignItems: "center", gap: "6px" } as const;
const ICON = { display: "block" } as const;

/** שורת הקרדיט. בנייטיב היא לא קישוט: כתבה עם מחבר בעל רישיון היא מה שמפריד
 *  אותה מאדברטוריאל אנונימי, גם בעיני הקורא וגם בבדיקת התוכן של Taboola. */
export function Byline({ date = "ספטמבר 2026" }: { date?: string }) {
  return (
    <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
      <Link href="/about" className="font-bold hover:underline" style={{ color: "var(--teal-dark)" }}>
        ד&quot;ר אבשלום גליל
      </Link>
      {" · "}פסיכולוג קליני וחינוכי מומחה-מדריך{" · "}
      {date}
    </p>
  );
}

/** שני כפתורי השאלון בשורה אחת, בלי הקופסה של QuizCta. לדף שבו הדמו פותח
 *  את העמוד: הכפתור הראשון חייב להיות במסך הראשון גם כשהטלפון תופס מסך שלם. */
const INLINE_BTN =
  "inline-flex items-center justify-center whitespace-nowrap font-bold transition hover:opacity-95";
const INLINE_STYLE = { borderRadius: "50px", padding: "12px 26px", fontSize: "15px" } as const;

export function QuizButtonsInline() {
  return (
    <div className="mt-5 flex flex-wrap justify-center gap-2.5">
      <Link href="/adults" className={INLINE_BTN} style={{ ...INLINE_STYLE, background: "var(--teal)", color: "#fff" }}>
        שאלון למבוגרים
      </Link>
      <Link
        href="/kids"
        className={INLINE_BTN}
        style={{ ...INLINE_STYLE, background: "var(--bg)", color: "var(--teal-dark)", border: "1.5px solid var(--teal)" }}
      >
        שאלון לילדים ולנוער
      </Link>
    </div>
  );
}

export function TrustBadges() {
  return (
    <div className="mt-5 mb-2 flex flex-wrap gap-x-5 gap-y-2.5" style={{ fontSize: "13px", color: "var(--muted)" }}>
      <span style={BADGE}><img src="/icons/anonymous.svg" alt="" width={20} height={20} style={ICON} /> שאלון אנונימי</span>
      <span style={BADGE}><img src="/icons/free.svg" alt="" width={20} height={20} style={ICON} /> חינמי<TooltipAsterisk /></span>
      <span style={BADGE}><img src="/icons/minutes.svg" alt="" width={20} height={20} style={ICON} /> כמה דקות</span>
      <span style={BADGE}><img src="/icons/report.svg" alt="" width={20} height={20} style={ICON} /> דו&quot;ח אישי לשמירה</span>
      <span style={BADGE}><img src="/icons/team.svg" alt="" width={20} height={20} style={ICON} /> מטפלים מורשים בלבד</span>
    </div>
  );
}

/** כותרת משנה של מאמר. */
export function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-10 text-2xl font-black" style={{ color: "var(--text)", letterSpacing: "-.01em" }}>
      {children}
    </h2>
  );
}

/** פסקת מאמר במידה קריאה. */
export function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 leading-8" style={{ color: "var(--text-2)", fontSize: "1.05rem" }}>
      {children}
    </p>
  );
}

/** הסגירה: קריאה לשאלון + שלוש ההתלבטויות. זהה בכל הגרסאות. */
export function StoryClosing({ ctaBody }: { ctaBody: string }) {
  return (
    <>
      <div className="mt-10">
        <QuizCta body={ctaBody} />
      </div>

      <section className="mt-12">
        <h2 className="text-xl font-black" style={{ color: "var(--text)" }}>שאלות שנשאלות כאן הרבה</h2>
        <dl className="mt-5 grid gap-5">
          <div>
            <dt className="font-extrabold" style={{ color: "var(--text)" }}>כמה זה עולה?</dt>
            <dd className="mt-1 leading-7" style={{ color: "var(--text-2)" }}>
              השאלון, הדו&quot;ח וההתאמה בחינם. את מחיר הטיפול עצמו קובע/ת המטפל/ת, ואתם סוגרים ישירות מולו.
            </dd>
          </div>
          <div>
            <dt className="font-extrabold" style={{ color: "var(--text)" }}>מה קורה עם מה שאני כותב?</dt>
            <dd className="mt-1 leading-7" style={{ color: "var(--text-2)" }}>
              השאלון אנונימי. אין צורך בשם או בפרטים מזהים, ותשובותיכם לא מועברות לאיש.
            </dd>
          </div>
          <div>
            <dt className="font-extrabold" style={{ color: "var(--text)" }}>אני מתחייב למשהו?</dt>
            <dd className="mt-1 leading-7" style={{ color: "var(--text-2)" }}>
              לא. בסוף השאלון תקבלו את הדו&quot;ח ורשימת מטפלים. אם תרצו, תפנו. אם לא, לא.
            </dd>
          </div>
        </dl>
      </section>
    </>
  );
}
