import Link from "next/link";

/**
 * The questionnaire call-to-action that sits above the therapist list on every
 * geographic and topic landing page.
 *
 * It exists because these pages used to offer a single button to /adults, no
 * matter who they were written for. A parent arriving on
 * "פסיכולוג לילדים ולנוער בתל אביב" was sent into the adults questionnaire,
 * which then recommended adult treatments and matched adult therapists - 22 of
 * the 50 questionnaire sessions from the kids ad campaign went in that way.
 */
type Props = {
  /** Each page phrases its own promise, so the body text is passed in. */
  body: string;
  /**
   * "youth" - the page is written for parents, so it opens the kids
   * questionnaire alone. Anything else lands both audiences, and gets both
   * buttons rather than a guess.
   */
  audience?: "both" | "youth";
};

const SHELL =
  "mb-10 flex flex-col gap-4 rounded-2xl p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7";
const BUTTON =
  "shrink-0 inline-flex items-center justify-center whitespace-nowrap font-bold transition hover:opacity-95";
const BUTTON_STYLE = { borderRadius: "50px", padding: "13px 30px", fontSize: "15px" } as const;

export default function QuizCta({ body, audience = "both" }: Props) {
  const youth = audience === "youth";
  return (
    <div className={SHELL} style={{ background: "var(--teal-pale)", border: "1px solid var(--teal-mid)" }}>
      <div>
        <p style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--teal-dark)" }}>
          {youth ? "לא בטוחים מה הילד/ה צריכ/ה?" : "לא בטוחים מי מתאים לכם?"}
        </p>
        <p className="mt-1.5 leading-7 text-stone-600" style={{ maxWidth: "48ch" }}>
          {body}
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2.5">
        {youth ? (
          <Link href="/kids" className={BUTTON} style={{ ...BUTTON_STYLE, background: "var(--teal)", color: "#fff" }}>
            למילוי שאלון הילדים
          </Link>
        ) : (
          <>
            <Link href="/adults" className={BUTTON} style={{ ...BUTTON_STYLE, background: "var(--teal)", color: "#fff" }}>
              שאלון למבוגרים
            </Link>
            <Link
              href="/kids"
              className={BUTTON}
              style={{ ...BUTTON_STYLE, background: "var(--bg)", color: "var(--teal-dark)", border: "1.5px solid var(--teal)" }}
            >
              שאלון לילדים ולנוער
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
