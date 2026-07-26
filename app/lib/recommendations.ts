/**
 * Phase 2 - organic recommendation generator. Deterministic, pure.
 * Turns the supply/demand picture into concrete, approvable actions that
 * DON'T depend on paid ad accounts (recruit therapists, fix low-converting
 * profiles, grow demand organically where supply is idle). Paid-ad
 * recommendations are intentionally deferred until ad accounts + spend data
 * exist.
 */

import type { SupplyDemand } from "./supply-demand";

export type GeneratedRec = {
  type: "recruit_therapists" | "promote_region_organic" | "low_conversion_therapist";
  target_key: string;
  title: string;
  rationale: string;
  suggested_action: string;
  priority: number;
  metadata: Record<string, unknown>;
};

// Only flag a profile as low-converting once it has had a meaningful number of
// views with still zero contacts - avoids noise from barely-seen profiles.
const MIN_VIEWS_FOR_CONVERSION_FLAG = 8;

export function buildRecommendations(sd: SupplyDemand): GeneratedRec[] {
  const recs: GeneratedRec[] = [];

  for (const r of sd.regions) {
    // "other" is an unclassifiable catch-all bucket - not a real recruitable
    // or promotable geography, so skip region-level recommendations for it.
    if (r.region === "other") continue;

    // Excess demand → recruit therapists (organic outreach)
    if (r.status === "needs_therapists" && r.demand > 0) {
      recs.push({
        type: "recruit_therapists",
        target_key: `region:${r.region}`,
        title: `לגייס מטפלים באזור ${r.label}`,
        rationale: `${r.demand} צפיות מטופלים מול ${r.therapists} מטפלים מקומיים - הביקוש עולה על ההיצע.`,
        suggested_action: `פנייה יזומה למטפלים באזור ${r.label} (LinkedIn, קבוצות מקצועיות, המלצות עמיתים).`,
        priority: 100 + r.demand,
        metadata: { region: r.region, demand: r.demand, therapists: r.therapists },
      });
    }
    // Excess supply → grow demand organically (paid comes later)
    if (r.status === "needs_patients" && r.therapists > 0) {
      recs.push({
        type: "promote_region_organic",
        target_key: `region:${r.region}`,
        title: `להגביר ביקוש מטופלים באזור ${r.label}`,
        rationale: `${r.therapists} מטפלים מול ${r.demand} ביקוש בלבד - עודף היצע, חלק מהמטפלים עלולים לא לקבל פניות.`,
        suggested_action: `תוכן ו-SEO ממוקדי ${r.label}; בהמשך (אחרי חיבור חשבונות הפרסום) פרסום ממוקד אזור.`,
        priority: 50 + r.therapists,
        metadata: { region: r.region, demand: r.demand, therapists: r.therapists },
      });
    }
  }

  for (const t of sd.therapistLeads) {
    if (t.profileViews >= MIN_VIEWS_FOR_CONVERSION_FLAG && t.contactClicks === 0) {
      recs.push({
        type: "low_conversion_therapist",
        target_key: `therapist:${t.id}`,
        title: `פרופיל שלא ממיר: ${t.full_name}`,
        rationale: `${t.profileViews} צפיות ו-0 פניות - מטופלים רואים את הפרופיל אך לא יוצרים קשר.`,
        suggested_action: `לבדוק את הפרופיל (תמונה, טקסט פתיחה, כפתורי קשר/וואטסאפ) וליידע את המטפל/ת.`,
        priority: 100 + t.profileViews,
        metadata: { therapist_id: t.id, profileViews: t.profileViews },
      });
    }
  }

  return recs.sort((a, b) => b.priority - a.priority);
}
