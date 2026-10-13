import { TRACKING_OPTOUT_KEY } from "./track-optout";

/** Where the quiz pages keep the staff code, and the query parameter that delivers it. */
export const STAFF_TOKEN_KEY = "staff_token";
export const STAFF_LINK_PARAM = "staff";

/**
 * The first script in the HTML of /adults and /kids - ahead of hydration, and
 * ahead of the analytics tags, which Next injects only after it.
 *
 * A staff link (/adults?staff=<code>) used to leave the code in the address
 * bar: the React effect that stored it ran after hydration, and by then GA4,
 * Google Ads and Taboola had each recorded the full page URL. The code that
 * lifts the quiz's free limit sat in three third-party reports, readable by
 * anyone with access to them. This runs while the HTML is still being parsed:
 * it moves the code into storage, switches measurement off for this browser
 * (as the effect did), and rewrites the address without the parameter - so no
 * tag ever sees it. The effect then finds the code in storage and the quiz
 * behaves exactly as before; it keeps its own copy of this as a fallback.
 *
 * Storage first, address second: if storage is blocked the parameter stays
 * where the effect can still read it, instead of the link quietly doing
 * nothing. No imports can be used inside the script; the keys are inlined.
 */
export function staffLinkBootScript(): string {
  return (
    "(function(){try{" +
    "var u=new URL(location.href);" +
    `var t=u.searchParams.get(${JSON.stringify(STAFF_LINK_PARAM)});` +
    "if(!t)return;" +
    `localStorage.setItem(${JSON.stringify(STAFF_TOKEN_KEY)},t);` +
    `localStorage.setItem(${JSON.stringify(TRACKING_OPTOUT_KEY)},"1");` +
    `u.searchParams.delete(${JSON.stringify(STAFF_LINK_PARAM)});` +
    'history.replaceState(history.state,"",u.pathname+u.search+u.hash);' +
    "}catch(e){}})();"
  );
}
