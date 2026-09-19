import type { ReactNode } from "react";

// כרטיס מטפל בתוצאות ההתאמה: מסך התוצאות בשאלון המבוגרים, בשאלון הילדים,
// וברשימה השמורה (/match/<token>). עד 18/9/26 כל אחד מהם החזיק עותק משלו של
// אותו כרטיס, ושינוי באחד היה צריך לעבור ידנית לשניים האחרים. מה שבאמת שונה
// ביניהם (הכפתורים, הניסוח, התג של הגישה הזוגית) נכנס כאן כ-props.
//
// פריסה בטלפון (18/9/26): בשלוש עמודות - תמונה, טקסט, תיבת אחוז - עמודת
// הטקסט נשארה ברוחב 67-119 פיקסלים במסכים של 360-412. שמות נשברו לארבע
// שורות, האזורים לעשר, ומהתיאור נראו שתיים-שלוש מילים; כרטיס של מרכז הגיע
// ל-773 פיקסלים, גבוה מהמסך. מתחת ל-640 פיקסלים הכרטיס בנוי עכשיו בשורות:
// תמונה ושם; פס הציון לכל הרוחב; תיאור ואזורים לכל הרוחב; כפתורים. מ-640
// ומעלה הוא נשאר כמו שהיה: תמונה ותיבת ציון לכל הגובה, והטקסט ביניהם.

export type MatchCardScore =
  /** באזור שהתבקש (או בלי מיקום מבוקש): אחוז, ופירוט כשיש ציון אישיותי. */
  | { kind: "percent"; overall: number; professional: number | null; personality: number | null }
  /** מחוץ לאזור: מילים במקום אחוז - ראו app/lib/match-card-label.ts. */
  | { kind: "words"; label: string; reason: string };

// מיקום בגריד. בטלפון: שורה 1 תמונה+שם, שורה 2 ציון, שורה 3 תיאור. במסך רחב:
// תמונה וציון על שתי השורות, שם מעל תיאור בעמודה האמצעית.
const AREA_PHOTO = "[grid-column:1] [grid-row:1] sm:[grid-row:1/3]";
const AREA_HEAD = "[grid-column:2] [grid-row:1]";
const AREA_SCORE = "[grid-column:1/-1] [grid-row:2] sm:[grid-column:3] sm:[grid-row:1/3]";
const AREA_BODY = "[grid-column:1/-1] [grid-row:3] sm:[grid-column:2] sm:[grid-row:2]";

/**
 * הכפתורים שהקוראים מעבירים ב-actions. בטלפון פעולת הקשר הראשית נפרשת לכל
 * הרוחב (MatchCardWhatsApp עושה זאת בעצמו), והכפתורים המשניים מקבלים
 * ריווח צר מעט - כך הם נכנסים יחד בשורה אחת גם במסך של 360 פיקסלים, במקום
 * להיערם בשלוש-ארבע שורות. במסך רחב - כמו שהיו.
 */
export const MATCH_CARD_BTN = {
  centerMessage:
    "inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[var(--teal)] px-4 py-2 text-[13px] font-bold text-white transition-opacity hover:opacity-90 sm:w-auto",
  explain:
    "inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-[#EAD9B0] bg-white px-3 py-2 text-[13px] font-bold text-[var(--gold-dark)] transition-colors hover:border-[var(--gold)] hover:bg-[var(--gold-pale)] disabled:opacity-60 sm:px-4",
} as const;

// "פרופיל מלא ←" lives in its own client module (it stashes the match context
// on click - see app/lib/match-view-context.ts); re-exported so every caller
// keeps importing it from here.
export { default as MatchCardProfileLink } from "./MatchCardProfileLink";

export default function MatchResultCard({
  name,
  nameAs: Name = "h3",
  isCenter,
  photoUrl,
  gender,
  subtitle,
  affiliation,
  bio,
  regions,
  inAreaChip,
  badge,
  score,
  centerNote,
  notice,
  actions,
  children,
}: {
  name: string;
  /** h3 בתוך מסך התוצאות (יש מעליו h2), h2 ברשימה השמורה. */
  nameAs?: "h2" | "h3";
  isCenter: boolean;
  photoUrl: string | null | undefined;
  gender: string | null | undefined;
  subtitle: string;
  /** "מצוות X" - שיוך מטפל למרכז. */
  affiliation?: string | null;
  bio?: string | null;
  regions: string[];
  /** תג ליד האזורים, למשל "✓ באזור שלך". */
  inAreaChip?: string | null;
  /** תג נוסף מתחת לאזורים (הגישה הזוגית שהותאמה, במבוגרים). */
  badge?: ReactNode;
  /** null = בלי ציון (טוקן ישן ברשימה השמורה). */
  score: MatchCardScore | null;
  /** ההסבר לכוכבית שליד המספר האישיותי של מרכז. */
  centerNote?: string | null;
  notice?: ReactNode;
  /** הכפתורים. MatchCardWhatsApp נפרש בטלפון לכל הרוחב, כפעולה הראשית. */
  actions: ReactNode;
  /** מתחת לכפתורים - הסבר ה-AI. */
  children?: ReactNode;
}) {
  return (
    <div className="rounded-[18px] border border-[var(--line)] bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5">
      {/* sm:grid-rows auto/1fr: כשתיבת הציון גבוהה מהטקסט (היא על שתי השורות),
          הגובה העודף יורד לשורה השנייה - אחרת הוא מתחלק בין השורות ונפער
          רווח בין השם לתיאור. */}
      <div
        className={`grid grid-cols-[64px_minmax(0,1fr)] gap-x-3 sm:grid-rows-[auto_1fr] sm:gap-x-4 ${
          score ? "sm:grid-cols-[78px_minmax(0,1fr)_auto]" : "sm:grid-cols-[78px_minmax(0,1fr)]"
        }`}
      >
        {isCenter && !photoUrl ? (
          // מרכז בלי לוגו - סמל ניטרלי (לא אווטאר מגדרי; gender של ישות ריק)
          <div
            className={`flex h-16 w-16 items-center justify-center self-start rounded-2xl border border-[var(--teal-mid)] bg-[var(--teal-pale)] text-3xl sm:h-[78px] sm:w-[78px] ${AREA_PHOTO}`}
            aria-hidden
          >
            🏢
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={photoUrl || (gender === "נקבה" ? "/avatar-female.svg" : "/avatar-male.svg")}
            alt={name}
            loading="lazy"
            className={`h-16 w-16 self-start rounded-2xl sm:h-[78px] sm:w-[78px] ${AREA_PHOTO} ${
              isCenter
                ? "border border-[var(--line)] bg-white object-contain p-1" // לוגו מרכז - לא לחתוך
                : "object-cover"
            }`}
          />
        )}

        <div className={`min-w-0 self-center text-right sm:self-auto ${AREA_HEAD}`}>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:gap-2">
            <Name className="text-lg font-extrabold text-[var(--text)]">{name}</Name>
            {isCenter && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--gold-pale)] px-2.5 py-0.5 text-[12px] font-bold text-[var(--gold-dark)]">🏢 מרכז טיפולי</span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--teal-pale)] px-2.5 py-0.5 text-[12px] font-bold text-[var(--teal-dark)]">✓ מאומת</span>
          </div>
          <p className="mt-0.5 text-xs text-[var(--muted)]">{subtitle}</p>
          {affiliation && (
            <p className="mt-0.5 text-xs font-semibold text-[var(--muted)]"><span aria-hidden>🏢</span> {affiliation}</p>
          )}
        </div>

        {score?.kind === "percent" && (
          // טלפון: פס אופקי - המספר, ולצידו סוג ההתאמה והפירוט. מסך רחב: התיבה
          // האנכית (sm:contents מפרק את העטיפה כך שהשורות נערמות בה כמו קודם).
          <div className={`mt-3 flex items-center gap-3 rounded-2xl bg-[var(--teal-pale)] px-3.5 py-2 sm:mt-0 sm:w-[110px] sm:flex-col sm:justify-center sm:gap-0 sm:px-2 sm:py-3 sm:text-center ${AREA_SCORE}`}>
            <div className="text-[2rem] font-black leading-none tracking-tight text-[var(--teal-dark)] sm:text-[2.4rem]">
              {score.overall}<span className="align-super text-sm font-extrabold sm:text-base">%</span>
            </div>
            <div className="min-w-0 text-right sm:contents sm:text-center">
              <div className="text-[12px] font-bold text-[var(--teal)] sm:mt-1 sm:text-[10.5px]">{score.personality != null ? "התאמה כוללת" : "התאמה מקצועית"}</div>
              {score.personality != null && score.professional != null && (
                <>
                  <div className="hidden sm:my-2 sm:block sm:h-px sm:w-2/3 sm:bg-[var(--teal-mid)]" />
                  <div className="flex flex-wrap gap-x-2.5 sm:flex-col sm:gap-0.5">
                    <span className="text-[11px] text-[var(--muted)] sm:text-[10.5px]">מקצועי <b className="font-extrabold text-[var(--teal-dark)]">{score.professional}%</b></span>
                    <span className="text-[11px] text-[var(--muted)] sm:text-[10.5px]">אישיותי <b className="font-extrabold text-[var(--teal-dark)]">{score.personality}%{isCenter && "*"}</b></span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        {score?.kind === "words" && (
          // מחוץ לאזור: מילים במקום אחוז, כדי שהמספר לא יתחרה במספר של מי שקרוב.
          <div className={`mt-3 flex items-center gap-2.5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 sm:mt-0 sm:w-[110px] sm:flex-col sm:justify-center sm:gap-0 sm:px-2 sm:py-3 sm:text-center ${AREA_SCORE}`}>
            <div className="text-[12.5px] font-extrabold leading-snug text-[var(--teal-dark)]">{score.label}</div>
            <div className="h-3.5 w-px bg-[var(--line)] sm:my-2 sm:h-px sm:w-2/3" />
            <div className="text-[11px] font-bold text-[var(--muted)]">{score.reason}</div>
          </div>
        )}

        <div className={`min-w-0 text-right ${AREA_BODY}`}>
          {bio && <p className="mt-1.5 line-clamp-2 text-sm text-[var(--text-2)]">{bio}</p>}
          {regions.length > 0 && (
            <p className="mt-1.5 text-xs text-[var(--muted)]">
              📍 {regions.join(", ")}
              {/* המרחק יצא מהציון, ולכן הוא מסומן כאן במפורש במקום להיבלע בתוך אחוז אחד. */}
              {inAreaChip && (
                <span className="ms-1.5 inline-block rounded-full bg-[var(--teal-pale)] px-2 py-0.5 text-[11px] font-bold text-[var(--teal-dark)]">
                  {inAreaChip}
                </span>
              )}
            </p>
          )}
          {badge}
        </div>
      </div>
      {centerNote && <p className="mt-2 text-[11px] leading-5 text-[var(--muted)]">{centerNote}</p>}
      {notice}
      <div className="mt-3.5 flex flex-wrap items-center gap-2 sm:gap-2.5">{actions}</div>
      {children}
    </div>
  );
}
