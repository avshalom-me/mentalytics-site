import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";

/**
 * Questionnaire facts that are kept only as general information.
 *
 * research_weekly_counts holds a week, a questionnaire and a number - no
 * session, no timestamp, no demographics - so a row cannot be walked back to a
 * person. It is the only place a suicidality finding is recorded at all; see
 * sensitive-findings.ts for why it never travels with the visitor.
 *
 * "scored" is the denominator and is bumped for EVERY scoring, so that a rate
 * can be read off the same table at the same granularity. Both count scorings
 * rather than people: someone who retakes the questionnaire counts twice, in
 * the numerator and the denominator alike.
 */
export type ResearchMetric = "scored" | "suicidality";

/**
 * Never throws and never rejects: this runs inside the scoring request, and a
 * statistics write must not be able to cost someone their result. It is awaited
 * by the caller (rather than fired and forgotten) because a serverless function
 * may be frozen the moment the response is sent.
 */
export async function bumpResearchCounts(quizType: "adults" | "kids", metrics: ResearchMetric[]): Promise<void> {
  try {
    await Promise.allSettled(
      metrics.map((metric) =>
        supabaseAdmin.rpc("bump_research_count", { p_quiz_type: quizType, p_metric: metric }),
      ),
    );
  } catch {
    // Deliberately swallowed - see above.
  }
}
