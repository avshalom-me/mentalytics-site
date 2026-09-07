import type { Metadata } from "next";
import PageViewTracker from "@/app/components/PageViewTracker";
import OutputShowcase from "@/app/components/OutputShowcase";
import QuizCta from "@/app/therapists/QuizCta";
import { Byline, TrustBadges, H2, P, StoryClosing } from "@/app/lp/_story/parts";

// גרסה ג' - "הבעיה". מתחילה מהקורא: שיתוק ההחלטה של מי שרוצה טיפול ונתקע
// בז'רגון. הזווית: אמפתיה קודם, ואז ההקלה - לא חייבים לדעת, השאלון שואל
// עליכם ולא על טיפול. הטלפון הוא הגילוי: "וזה מה שמקבלים".

export const revalidate = 300;

export const metadata: Metadata = {
  // גרשיים עבריים (U+05F4) ולא מירכאות ASCII: הלשונית והתצוגה המקדימה של
  // Taboola מפילות מירכאות מה-<title>, ו"עו ס" נראה כמו שגיאת הקלדה.
  title: "CBT או דינמי? פסיכולוג או עו״ס? לא חייבים לדעת לפני שמתחילים",
  robots: { index: false, follow: false },
};

const QUESTIONS = [
  "CBT או טיפול דינמי? ומה ההבדל בכלל?",
  "פסיכולוג, פסיכותרפיסט או עובד סוציאלי קליני?",
  "מישהו שנותן כלים, או מישהו שמקשיב?",
  "גבר או אישה? צעיר או מנוסה?",
  "ליד הבית, או אונליין ולא משנה איפה?",
  "ואיך אדע אם זה מתאים, לפני שאני משלם על עשר פגישות?",
] as const;

export default function StoryC() {
  return (
    <main dir="rtl" style={{ background: "var(--bg)" }}>
      <PageViewTracker page="lp:story-c" />

      <article className="mx-auto max-w-3xl px-5 pt-8 pb-4 sm:pt-12">
        <h1
          style={{ fontSize: "clamp(1.75rem,5vw,2.5rem)", fontWeight: 900, color: "var(--text)", letterSpacing: "-.02em", lineHeight: 1.2 }}
        >
          CBT או דינמי? פסיכולוג או עו&quot;ס? לא חייבים לדעת לפני שמתחילים
        </h1>
        <Byline />
        <TrustBadges />

        <P>
          רוב האנשים שרוצים טיפול לא נתקעים כי אין מטפלים. הם נתקעים כי יש יותר מדי שאלות לפני,
          וכולן נשמעות כאילו צריך להיות איש מקצוע כדי לענות עליהן:
        </P>

        <ul className="mt-5 grid gap-2.5">
          {QUESTIONS.map((q) => (
            <li key={q} className="flex gap-3 leading-7" style={{ color: "var(--text-2)", fontSize: "1.05rem" }}>
              <span aria-hidden className="mt-3 inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--gold)" }} />
              <span>{q}</span>
            </li>
          ))}
        </ul>

        <P>
          ואז עוברים שבועיים. ואז חודש. לא כי לא רוצים, אלא כי לא יודעים מאיפה להתחיל.
        </P>

        <H2>מה אם לא צריך לענות על אף אחת מהן קודם</H2>
        <P>
          השאלון לא שואל אתכם על טיפול. הוא שואל עליכם: מה מפריע, איפה זה פוגש אתכם ביומיום,
          איך אתם מעדיפים שידברו איתכם. הוא מסתעף לפי התשובות, אז עונים רק על מה שרלוונטי, וזה
          לוקח כמה דקות.
        </P>
        <P>
          את התרגום למונחים המקצועיים, איזו גישה, איזה סוג מטפל, איזה אופי, עושה השאלון. ואת
          האזור בוחרים בסוף, אחרי שכבר ברור מה צריך.
        </P>

        <div className="mt-6">
          <QuizCta body="שאלון קצר ששואל עליכם, לא על טיפול. ובסופו דו&quot;ח והתאמה." />
        </div>

        <H2>וזה מה שמקבלים</H2>
      </article>

      <OutputShowcase />

      <article className="mx-auto max-w-3xl px-5 pt-6 pb-14">
        <P>
          דו&quot;ח שמתאר במילים פשוטות מה עלה, בלי אבחנות ובלי תוויות. סוגי הטיפול שמתאימים לזה,
          עם הסבר למה. ורשימת מטפלים ומטפלות מורשים, מדורגת לפי התאמה מקצועית ואישיותית, עם
          הסבר ליד כל אחד למה דווקא הוא או היא. ניתן לשמירה, ואפשר להביא אותו לפגישה הראשונה.
        </P>

        <StoryClosing ctaBody="לא צריך לדעת כלום לפני. השאלון שואל, אתם עונים. בחינם, אנונימי, וללא התחייבות." />
      </article>
    </main>
  );
}
