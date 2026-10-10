import { llmConfigured, llmText } from "./llm";
import { narrativeIsFaithful, type BudgetRecommendation } from "./budget-agent";
import type { BudgetReport } from "./budget-data";

// The model's part in the monthly budget recommendation: two or three sentences
// on why this split, and what it risks. Principle 0.1 of the plan - the code
// computes, the model words - is enforced, not requested: the wording may only
// repeat numbers it was given (narrativeIsFaithful), otherwise it is dropped and
// the recommendation goes out as computed. Only campaign names and figures are
// sent; nothing about a therapist, a centre or a seeker.
//
// The "standard" tier and not a small model, for the reason the inbox agent
// gives: the small model bent a numeric fact in its first test.

export function budgetFacts(report: BudgetReport) {
  const p = report.projection;
  return {
    month: p.month,
    ceiling: p.ceiling,
    google_ceiling: p.googleCeiling,
    other_platforms_this_month: p.otherMonthCost,
    last_30_days_by_platform: p.lastMonth.byPlatform,
    current_monthly: p.current.monthly,
    plan_monthly: p.plan.monthly,
    plan_seekers: p.plan.seekers,
    plan_cost_per_seeker: p.plan.cpl,
    last_30_days: p.lastMonth,
    cost_per_seeker_target: report.cplTarget?.value ?? null,
    campaigns: p.campaigns
      .filter((c) => c.inPlan)
      .map((c) => ({
        name: c.googleName,
        daily_now: c.dailyBudget,
        daily_proposed: c.proposedDaily,
        decision: c.decision,
        cost_per_seeker_30: c.cpl30,
        cost_per_seeker_60: c.cpl60,
        seekers_30: c.seekers30,
        seekers_to_paying_60: c.paidSeekers60,
        // Whether, not why: the reason is free text and can name a customer.
        protected: c.isProtected,
        learning: c.learning,
        little_data: c.noisy,
      })),
  };
}

export async function narrateBudget(
  rec: BudgetRecommendation,
  facts: ReturnType<typeof budgetFacts>
): Promise<string | null> {
  if (!llmConfigured()) return null;
  try {
    const res = await llmText({
      feature: "budget_narrative",
      tier: "standard",
      system:
        "אתה עוזר לבעלים של פלטפורמת טיפול חכם לקרוא המלצת תקציב פרסום חודשית. תקבל את ההמלצה כפי שחושבה ואת הנתונים שמאחוריה. " +
        "כתוב 2-3 משפטים קצרים בעברית: למה זו החלוקה, ומה הסיכון העיקרי בה (למשל אזור שנעצר, או קמפיין שנשפט על מעט נתונים). " +
        "חוקים: אל תשנה, תעגל, תחשב או תוסיף אף מספר - מותר רק מספר שמופיע בקלט, כפי שהוא. אל תמליץ על שום דבר שאין בהמלצה. " +
        "בלי פתיחות, בלי סופרלטיבים, בלי כותרות. אסור קו מפריד ארוך; השתמש ב' - '.",
      // The title and the changes, not the body: the body quotes the protection
      // reasons, and those can name a customer.
      user: JSON.stringify({ recommendation: { title: rec.title, changes: rec.changes }, facts }),
      maxTokens: 400,
      timeoutMs: 45_000,
      retries: 0,
    });
    const text = res.text.replace(/\s*—\s*/g, " - ").trim();
    if (!text) return null;
    if (!narrativeIsFaithful(text, `${rec.title}\n${rec.body}\n${JSON.stringify(facts)}`)) {
      console.warn("budget narrative dropped: it used a number that was not in its input");
      return null;
    }
    return text;
  } catch (e) {
    console.error("budget narrative failed:", e instanceof Error ? e.message : e);
    return null;
  }
}
