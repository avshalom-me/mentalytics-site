// The Facebook ads and what the site knows about each of them.
//
// One ad = one utm_campaign. The link pasted into the ad carries it, and every
// visit, questionnaire and signup that follows is stored under it, so "how many
// came from this ad and what did they do" is answered from our own tables.
//
// Nothing here reads Facebook. The owner sets the ads up by hand, from his
// phone, and no code touches the account (the decision is recorded in
// ads-platforms.ts). The same link works wherever the ad is built.
//
// Pure: the admin screen (/admin/fb-ads) feeds it the two reports that already
// exist - the campaign funnel and the recruitment campaigns - and draws the result.

export type FbAudience = "patients" | "recruit";

export type FbAd = {
  /** The utm_campaign. Must start with "fb-": the marketing dashboard keeps only g-, tab- and fb- campaigns. */
  campaign: string;
  audience: FbAudience;
  label: string;
  /** The landing page the ad opens. */
  path: string;
};

const SITE = "https://www.mentalytics.co.il";

/** The ads of October 2026 (docs/ads-copy/meta-2026-10.md). A new ad is a new row here. */
export const FB_ADS: FbAd[] = [
  { campaign: "fb-patients-image", audience: "patients", label: "מטופלים · תמונה", path: "/lp/story-c" },
  { campaign: "fb-patients-video", audience: "patients", label: "מטופלים · סרטון", path: "/lp/story-c" },
  { campaign: "fb-recruit-image", audience: "recruit", label: "גיוס מטפלים · תמונה", path: "/therapists/join" },
  { campaign: "fb-recruit-video", audience: "recruit", label: "גיוס מטפלים · סרטון", path: "/therapists/join" },
];

/**
 * The address to paste into the ad. utm_medium=paid is what files the visit
 * under "Meta - paid"; without it the site counts the click as organic.
 */
export function fbAdLink(ad: Pick<FbAd, "campaign" | "path">): string {
  return `${SITE}${ad.path}?utm_source=facebook&utm_medium=paid&utm_campaign=${ad.campaign}`;
}

/** A row of the campaign funnel (admin_campaign_funnel), as far as this report reads it. */
export type FbFunnelRow = {
  campaign: string;
  sessions: number;
  quiz_started?: number;
  quiz_completed?: number;
  viewed_profile?: number;
  contacting_people?: number;
  /** Sessions that pressed a register button of a recruitment page (recruit_cta_click). */
  recruit_cta_clicks?: number;
  /** Sessions that saw the register screen of the login page (recruit_register_view). */
  recruit_register_views?: number;
};

/** A row of the recruitment report (/api/admin-therapist-campaigns). */
export type FbRecruitRow = {
  campaign: string;
  visitors: number;
  signups: number;
  approved: number;
  paying: number;
};

export type FbAdStep = { label: string; value: number };

export type FbAdReport = {
  campaign: string;
  audience: FbAudience;
  label: string;
  /** Null for a campaign that reached the site but is not in FB_ADS: its landing page is not known here. */
  link: string | null;
  /** How many arrived: distinct browsers that left any activity under this ad's tag. */
  visits: number;
  /** What they did next, in order. Each is a count of people, never of clicks. */
  steps: FbAdStep[];
};

const isFb = (campaign: string) => campaign.startsWith("fb-");

/** An ad nobody listed is still shown; its name says which side it belongs to. */
function audienceOf(campaign: string): FbAudience {
  return campaign.startsWith("fb-recruit") ? "recruit" : "patients";
}

/**
 * One row per Facebook ad: the listed ones first, in their order, with zeros
 * until someone arrives; then any other fb-* campaign that reached the site
 * (for example the same video uploaded twice with -feed and -reels links).
 */
export function buildFbAdsReport(funnel: FbFunnelRow[], recruit: FbRecruitRow[]): FbAdReport[] {
  const funnelBy = new Map(funnel.filter((r) => isFb(r.campaign)).map((r) => [r.campaign, r]));
  const recruitBy = new Map(recruit.filter((r) => isFb(r.campaign)).map((r) => [r.campaign, r]));

  const row = (campaign: string, audience: FbAudience, label: string, link: string | null): FbAdReport => {
    const f = funnelBy.get(campaign);
    const r = recruitBy.get(campaign);
    const sessions = Number(f?.sessions ?? 0);
    if (audience === "recruit") {
      return {
        campaign, audience, label, link,
        // The join page's own view is the cleaner count; the session count covers
        // a visitor who landed on another page with the ad's tag.
        visits: Math.max(Number(r?.visitors ?? 0), sessions),
        steps: [
          // Between arriving and signing up: pressed the button, saw the form.
          // Both are zero for the days before 8/10/2026, when nothing measured them.
          { label: "לחצו על הרשמה", value: Number(f?.recruit_cta_clicks ?? 0) },
          { label: "הגיעו למסך ההרשמה", value: Number(f?.recruit_register_views ?? 0) },
          { label: "נרשמו", value: Number(r?.signups ?? 0) },
          { label: "אושרו", value: Number(r?.approved ?? 0) },
          { label: "במסלול המקודם", value: Number(r?.paying ?? 0) },
        ],
      };
    }
    return {
      campaign, audience, label, link,
      visits: sessions,
      steps: [
        { label: "התחילו שאלון", value: Number(f?.quiz_started ?? 0) },
        { label: "סיימו שאלון", value: Number(f?.quiz_completed ?? 0) },
        { label: "צפו בפרופיל מטפל", value: Number(f?.viewed_profile ?? 0) },
        { label: "פנו למטפל", value: Number(f?.contacting_people ?? 0) },
      ],
    };
  };

  const listed = FB_ADS.map((ad) => row(ad.campaign, ad.audience, ad.label, fbAdLink(ad)));
  const known = new Set(FB_ADS.map((ad) => ad.campaign));
  const others = [...new Set([...funnelBy.keys(), ...recruitBy.keys()])]
    .filter((c) => !known.has(c))
    .map((c) => row(c, audienceOf(c), c, null))
    .sort((a, b) => b.visits - a.visits || a.campaign.localeCompare(b.campaign));
  return [...listed, ...others];
}

/** A step as a share of the arrivals, in whole percent; null when nobody arrived. */
export function shareOfVisits(value: number, visits: number): number | null {
  if (visits <= 0) return null;
  return Math.round((value / visits) * 100);
}
