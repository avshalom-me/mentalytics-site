// Changes on OUR side that alter what a visitor from an ad sees or can do.
//
// The ads agent reads this list when a campaign goes cold: a change that falls
// at the start of the dry spell is the first thing to look at, and the agent
// cannot know about it unless it is written down. On 7/10/2026 g-north-sharon
// had been without a contact for 23 days, and the rule of 16/9 below was the
// answer - found by hand, because nothing connected the two.
//
// What belongs here: a rule about who a paid visitor is shown, a change to the
// order of a landing page, a contact button that moved. One line, a date, in
// Hebrew - it is quoted to the owner as it stands. What does not belong: copy
// edits, SEO work, anything a visitor would not notice.
//
// Changes on Google's side (budgets, keywords, AI Max) are not here; they come
// from the account's own change history.
export type PaidTrafficChange = { date: string; label: string };

export const PAID_TRAFFIC_CHANGES: readonly PaidTrafficChange[] = [
  // app/lib/paid-visitor.ts. Before this, a third of the contacts that ads
  // paid for went to free therapists, through a card or through the quiz's
  // free fallback.
  { date: "2026-09-16", label: "מבקר ממומן רואה רק מטפלים מקודמים (בלי חינמיים, ובלי גיבוי חינמי בשאלון)" },
];
