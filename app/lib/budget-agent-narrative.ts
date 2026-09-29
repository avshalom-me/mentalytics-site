import OpenAI from "openai";
import { narrativeIsFaithful, type BudgetRecommendation } from "./budget-agent";
import type { BudgetReport } from "./budget-data";

// The model's part in the monthly budget recommendation: two or three sentences
// on why this split, and what it risks. Principle 0.1 of the plan - the code
// computes, the model words - is enforced, not requested: the wording may only
// repeat numbers it was given (narrativeIsFaithful), otherwise it is dropped and
// the recommendation goes out as computed. Only campaign names and figures are
// sent; nothing about a therapist, a centre or a seeker.
//
// gpt-4o and not mini, for the reason the inbox agent gives: mini bent a
// numeric fact in its first test.
const MODEL = process.env.AGENT_BUDGET_LLM_MODEL ?? "gpt-4o";

export function budgetFacts(report: BudgetReport) {
  const p = report.projection;
  return {
    month: p.month,
    ceiling: p.ceiling,
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
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const res = await openai.chat.completions.create(
      {
        model: MODEL,
        max_tokens: 300,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "אתה עוזר לבעלים של פלטפורמת טיפול חכם לקרוא המלצת תקציב פרסום חודשית. תקבל את ההמלצה כפי שחושבה ואת הנתונים שמאחוריה. " +
              "כתוב 2-3 משפטים קצרים בעברית: למה זו החלוקה, ומה הסיכון העיקרי בה (למשל אזור שנעצר, או קמפיין שנשפט על מעט נתונים). " +
              "חוקים: אל תשנה, תעגל, תחשב או תוסיף אף מספר - מותר רק מספר שמופיע בקלט, כפי שהוא. אל תמליץ על שום דבר שאין בהמלצה. " +
              "בלי פתיחות, בלי סופרלטיבים, בלי כותרות. אסור קו מפריד ארוך; השתמש ב' - '.",
          },
          // The title and the changes, not the body: the body quotes the protection
          // reasons, and those can name a customer.
          { role: "user", content: JSON.stringify({ recommendation: { title: rec.title, changes: rec.changes }, facts }) },
        ],
      },
      { timeout: 45_000, maxRetries: 0 }
    );
    const text = res.choices[0]?.message?.content?.trim().replace(/\s*—\s*/g, " - ");
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
