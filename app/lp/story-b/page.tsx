import type { Metadata } from "next";
import PageViewTracker from "@/app/components/PageViewTracker";
import OutputShowcase from "@/app/components/OutputShowcase";
import QuizCta from "@/app/therapists/QuizCta";
import { Byline, TrustBadges, H2, P, StoryClosing } from "@/app/lp/_story/parts";

// גרסה ב' - "המדריך". מגזין, ממוספר, סריק: ארבעה דברים שצריך לדעת כדי לבחור
// טיפול נכון, וכל אחד מהם הוא בדיוק מה שהשאלון בודק. הזווית: ערך שימושי
// לקורא גם אם לא ילחץ. הטלפון באמצע, כהמחשה של ארבעת השלבים.

export const revalidate = 300;

export const metadata: Metadata = {
  title: "איך יודעים איזה טיפול מתאים? ארבעה דברים שהשאלון בודק במקומכם",
  robots: { index: false, follow: false },
};

const STEPS = [
  {
    n: "1",
    title: "מה בעצם מפריע",
    body: "\"לא טוב לי\" זה אמיתי, אבל זה לא מספיק כדי לבחור טיפול. השאלון מסתעף לפי התשובות ועוזר למקד: עומס? שינה? מערכת יחסים? ריכוז? לרוב זה יותר מדבר אחד, והסדר חשוב.",
  },
  {
    n: "2",
    title: "איזו גישה מתאימה לזה",
    body: "CBT עובד מצוין על דפוסים מעשיים, פחות על עיבוד רגשי מעמיק. טיפול דינמי הפוך. טיפול זוגי, EMDR, ועוד. לכל קושי יש גישות שעובדות טוב יותר, וזה לא משהו שצריך לדעת לבד.",
  },
  {
    n: "3",
    title: "איזה מטפל מתאים באופי",
    body: "יש מי שצריך מטפל שמוביל ונותן כלים, ויש מי שצריך מי שמקשיב ומחכה. שני מטפלים באותה גישה יכולים להיות חוויה שונה לגמרי. השאלון בודק גם את זה.",
  },
  {
    n: "4",
    title: "ואיפה, בסוף",
    body: "ליד הבית או אונליין, איזה אזור. זה השלב האחרון בכוונה: מיקום הוא סינון, לא בחירה. קודם מבינים מה צריך, ואז מסננים לפי איפה נוח.",
  },
] as const;

export default function StoryB() {
  return (
    <main dir="rtl" style={{ background: "var(--bg)" }}>
      <PageViewTracker page="lp:story-b" />

      <article className="mx-auto max-w-3xl px-5 pt-8 pb-4 sm:pt-12">
        <h1
          style={{ fontSize: "clamp(1.75rem,5vw,2.5rem)", fontWeight: 900, color: "var(--text)", letterSpacing: "-.02em", lineHeight: 1.2 }}
        >
          איך יודעים איזה טיפול מתאים? ארבעה דברים שהשאלון בודק במקומכם
        </h1>
        <Byline />
        <TrustBadges />

        <P>
          רוב האנשים שמחפשים טיפול פותחים רשימה, מסננים לפי עיר, ובוחרים לפי תמונה. זה הגיוני,
          כי אין כלי אחר. אבל יש ארבע שאלות שכדאי לענות עליהן לפני, וכולן שאלות שאדם לא אמור לדעת
          לענות בעצמו. זה בדיוק מה שהשאלון עושה.
        </P>

        <div className="mt-6">
          <QuizCta body="שאלון קצר שעונה על ארבע השאלות במקומכם, ובסופו דו&quot;ח והתאמה." />
        </div>

        <ol className="mt-8 grid gap-7">
          {STEPS.map((s) => (
            <li key={s.n} className="flex gap-4">
              <span
                className="inline-flex shrink-0 items-center justify-center rounded-full text-base font-black"
                style={{ width: 40, height: 40, background: s.n === "4" ? "var(--gold)" : "var(--teal)", color: "#fff" }}
              >
                {s.n}
              </span>
              <div>
                <h2 className="text-xl font-black" style={{ color: "var(--text)" }}>{s.title}</h2>
                <p className="mt-1.5 leading-8" style={{ color: "var(--text-2)" }}>{s.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <H2>וכך זה נראה בפועל</H2>
        <P>
          ארבעת השלבים האלה הופכים לדו&quot;ח אחד. הנה מה שמקבלים בסוף, מסך אחרי מסך:
        </P>
      </article>

      <OutputShowcase />

      <article className="mx-auto max-w-3xl px-5 pt-6 pb-14">
        <P>
          השאלון נבנה על ידי פסיכולוגים קליניים, על בסיס ניסיון קליני ומחקר. הוא לא מאבחן ולא
          מדביק תוויות, הוא מתאר במילים פשוטות מה שיתפתם ומצביע על כיוון. את ההחלטה עדיין
          מקבלים אתם.
        </P>

        <StoryClosing ctaBody="ארבע השאלות, בכמה דקות. בחינם, אנונימי, וללא התחייבות." />
      </article>
    </main>
  );
}
