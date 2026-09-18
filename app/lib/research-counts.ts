import "server-only";
import { after } from "next/server";
import { supabaseAdmin } from "./supabaseAdmin";

/**
 * Questionnaire facts that are kept only as general information.
 *
 * research_weekly_counts holds a week, a questionnaire and a number - no
 * session, no timestamp, no demographics - so a row cannot be walked back to a
 * person. It is the only place a suicidality finding is recorded at all; see
 * sensitive-findings.ts for why it never travels with the visitor.
 *
 * "scored" is the denominator and "suicidality" the numerator, both counting
 * scorings rather than people: someone who retakes the questionnaire counts
 * twice, in the numerator and the denominator alike.
 *
 * Exactly ONE database call per scoring, and it always updates both rows (the
 * suicidality row by 0 when there was no finding). Two calls for a suicidal
 * scoring and one otherwise showed up in the API logs; and a row written only
 * by suicidal scorings carried, in its row version, a pointer to the latest one.
 * See supabase/migrations/20260918b_record_quiz_scoring.sql.
 */
export function recordQuizScoring(quizType: "adults" | "kids", suicidality: boolean): void {
  // after(): runs once the response has been sent. A statistics write must not be
  // able to delay someone's result, let alone cost it - awaited in the request,
  // a hung database call held the result hostage after the free-tier credit had
  // already been consumed. Vercel keeps the function alive until it finishes.
  after(async () => {
    try {
      await supabaseAdmin.rpc("record_quiz_scoring", { p_quiz_type: quizType, p_suicidality: suicidality });
    } catch {
      // Deliberately swallowed: a lost count is acceptable, a failed result is not.
    }
  });
}
