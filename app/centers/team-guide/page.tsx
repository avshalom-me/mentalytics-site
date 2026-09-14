import type { Metadata } from "next";
import PrintButton from "../PrintButton";

// מדריך קצר לשליחה למרכז טיפולי: איך מצטרף מנהל נוסף לפורטל.
//
// לא לאינדוקס ולא ב-sitemap: זה דף תפעולי שנשלח ללקוח קיים, לא תוכן
// ציבורי. הסדר שמתואר כאן (נרשם קודם, מוסיפים אחר כך) הוא בדיוק מה
// שהמערכת אוכפת ב-/api/center-portal/members - אין claim-by-email, ולכן
// חבר חדש חייב חשבון קיים לפני שאפשר להוסיף אותו. אם המסלול משתנה, הדף
// הזה חייב להשתנות איתו, אחרת המרכז יקבל הוראות שלא עובדות.
//
// ידידותי להדפסה כמו עמוד ההסבר למרכזים: אותו PrintButton, אותם כללי print.

const SITE = "https://www.mentalytics.co.il";
const REGISTER_URL = `${SITE}/centers/login?mode=register`;
const LOGIN_URL = `${SITE}/centers/login`;

export const metadata: Metadata = {
  title: "מנהל נוסף בפורטל המרכז",
  description: "שלושה צעדים לצירוף מנהל נוסף לפורטל הניהול של המרכז הטיפולי.",
  robots: { index: false, follow: false },
};

const steps: { who: string; title: string; body: React.ReactNode }[] = [
  {
    who: "המנהל החדש",
    title: "נרשם לפורטל עם הכתובת האישית שלו",
    body: (
      <>
        <p>נכנסים לקישור, מזינים כתובת מייל וסיסמה (לפחות 6 תווים), ולוחצים <Ui>הרשמה</Ui>:</p>
        <Url href={REGISTER_URL} />
        <p>
          הכתובת היא של המנהל עצמו, לא של המרכז. אם העמוד מציין &quot;המייל שאיתו קיבלתם את ההצעה&quot;,
          אפשר להתעלם: זו הנחיה למרכז שנרשם בפעם הראשונה.
        </p>
        <p>
          אחרי ההרשמה תופיע הודעה שהחשבון עדיין לא מקושר למרכז. <strong className="text-[var(--text)]">זה תקין</strong>,
          זה המצב עד לצעד הבא.
        </p>
      </>
    ),
  },
  {
    who: "מנהל קיים",
    title: "מוסיף את הכתובת בפורטל",
    body: (
      <>
        <p>
          נכנסים לפורטל כרגיל, גוללים לסקציה <Ui>צוות הניהול</Ui>, מזינים בדיוק את כתובת המייל שאיתה נרשם
          המנהל החדש, ולוחצים <Ui>הוספה לצוות</Ui>.
        </p>
        <p>
          ההוספה מיידית. אם מופיעה ההודעה &quot;אין עדיין חשבון עם הכתובת&quot;, המנהל החדש טרם ביצע את צעד 1,
          או שהכתובת שהוזנה שונה מזו שאיתה נרשם.
        </p>
      </>
    ),
  },
  {
    who: "המנהל החדש",
    title: "נכנס לפורטל",
    body: (
      <>
        <p>מכאן והלאה הכניסה רגילה, עם המייל והסיסמה שנבחרו בצעד 1:</p>
        <Url href={LOGIN_URL} />
        <p>הוא יראה את הפורטל המלא של המרכז, עם אותן הרשאות בדיוק כמו כל מנהל אחר.</p>
      </>
    ),
  },
];

function Ui({ children }: { children: React.ReactNode }) {
  return (
    <span className="whitespace-nowrap rounded-md bg-[var(--teal-pale)] px-1.5 py-px font-bold text-[var(--text)]">{children}</span>
  );
}

// הכתובת מוצגת במלואה כטקסט, לא כ"לחצו כאן": המסמך נשלח במייל ובוואטסאפ,
// והמרכז צריך לראות ולהעתיק את הכתובת עצמה.
function Url({ href }: { href: string }) {
  return (
    <a
      href={href}
      dir="ltr"
      className="my-1 inline-block break-all rounded-full border border-[var(--line)] bg-white px-3.5 py-1.5 font-bold text-[var(--teal-dark)] no-underline transition hover:border-[var(--teal)]"
      style={{ unicodeBidi: "isolate" }}
    >
      {href}
    </a>
  );
}

export default function CenterTeamGuidePage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 pb-20 print:py-4" dir="rtl">
      <style>{`
        @media print {
          nav, footer, .print-hide { display: none !important; }
          body { background: #fff; }
        }
      `}</style>

      <div className="print-hide mb-8 flex items-center justify-between gap-3">
        <p className="text-[12.5px] font-semibold text-[var(--muted)]">טיפול חכם · פורטל הניהול למרכזים טיפוליים</p>
        <PrintButton />
      </div>

      <h1 className="mb-2.5 text-[clamp(1.7rem,4vw,2.2rem)] font-black leading-tight tracking-tight text-[var(--text)]">
        כיצד מתחבר מנהל נוסף למערכת
      </h1>
      <p className="mb-8 max-w-[58ch] text-[15.5px] leading-[1.8] text-[var(--text-2)]">
        פורטל המרכז יכול לשמש יותר ממנהל אחד. ההצטרפות נעשית בשלושה צעדים, ו
        <strong className="text-[var(--text)]">הסדר חשוב</strong>: המנהל החדש נרשם קודם, ורק אחר כך מנהל קיים מוסיף אותו.
      </p>

      <ol className="m-0 grid list-none gap-3.5 p-0">
        {steps.map((s, i) => (
          <li
            key={i}
            className="grid grid-cols-[44px_1fr] items-start gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-5 py-5 print:break-inside-avoid"
          >
            <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--teal)] text-[19px] font-black text-white">
              {i + 1}
            </span>
            <div className="min-w-0 text-[14.5px] leading-[1.75] text-[var(--text-2)] [&_p]:mb-2 [&_p:last-child]:mb-0">
              <p className="!mb-0.5 text-[11.5px] font-extrabold tracking-[.12em] text-[var(--teal-dark)]">{s.who}</p>
              <h2 className="!mb-2 mt-1 text-[17px] font-extrabold text-[var(--text)]">{s.title}</h2>
              {s.body}
            </div>
          </li>
        ))}
      </ol>

      <section className="mt-7 rounded-2xl border border-[#EDDCB4] bg-[var(--gold-pale)] px-5 py-4 print:break-inside-avoid">
        <h3 className="mb-2 text-[14.5px] font-extrabold text-[var(--text)]">טוב לדעת</h3>
        <ul className="m-0 ps-[18px] text-[14px] leading-[1.75] text-[var(--text-2)]">
          <li><strong className="text-[var(--text)]">כל המנהלים שווים.</strong> כל מי שבצוות הניהול יכול לערוך את פרטי המרכז והמטפלים, להוסיף מטפלים למנוי ולנהל את הצוות.</li>
          <li><strong className="text-[var(--text)]">החשבון שהקים את המרכז מסומן כ&quot;חשבון ראשי&quot;</strong> ואי אפשר להסיר אותו מהפורטל, כדי שאף אחד לא יינעל בחוץ. לשינויו פנו אלינו.</li>
          <li><strong className="text-[var(--text)]">הסרת מנהל</strong> נעשית מאותה סקציה בלחיצה על &quot;הסרה&quot;. הגישה נחסמת מיד.</li>
          <li><strong className="text-[var(--text)]">כתובת מייל אחת מנהלת מרכז אחד.</strong> מי שכבר מנהל מרכז אחר במערכת יצטרך להירשם עם כתובת נוספת.</li>
        </ul>
      </section>

      <p className="mt-7 text-[13px] leading-[1.7] text-[var(--muted)]">
        שאלות או תקלה בדרך? כתבו לנו:{" "}
        <a href="mailto:admin@getmentalytics.com" className="font-bold text-[var(--teal-dark)] no-underline">admin@getmentalytics.com</a>
      </p>
    </main>
  );
}
