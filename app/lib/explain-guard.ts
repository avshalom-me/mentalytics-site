import "server-only";
import { z } from "zod";
import { rateLimit, clientIp } from "./rate-limit";
import { underDailyCap } from "./daily-cap";

/**
 * What the two public explanation routes check before they spend money on a
 * model call (/api/explain-match, /api/explain-recommendation).
 *
 * Until 13/10/2026 each had a per-address minute counter in instance memory
 * and nothing else: no limit on the size of what a caller could put in the
 * prompt, and no ceiling on the day. A caller spread over addresses (or over
 * cold starts, which reset that memory) could run the paid model without end,
 * and once the Claude credit was spent the layer fell back to OpenAI with the
 * same lack of a ceiling.
 *
 *  - The minute limit stays (30 an address), through the shared limiter.
 *  - A request body larger than 64 KB is refused before it is parsed.
 *  - Every field has a length cap (see the schemas); a bio is a few thousand
 *    characters, not a novel.
 *  - A site-wide daily cap per route, in the database, so it holds across
 *    instances. Past it the route serves its template explanation instead of
 *    the model - the button keeps working, nothing is spent. The busiest day
 *    on record is 18 presses per route; the cap is more than ten times that.
 */
export const EXPLAIN_PER_MINUTE = 30;
export const EXPLAIN_MAX_BODY_BYTES = 64 * 1024;
export const EXPLAIN_DAILY_CAP = Number(process.env.EXPLAIN_DAILY_CAP ?? 200);

/** True when this address has used its minute budget on this route. */
export function explainRateLimited(req: Request, route: string): boolean {
  return !rateLimit(route, clientIp(req), EXPLAIN_PER_MINUTE, 60_000).ok;
}

/** True when the declared or actual body is too large to be a real request. */
export function explainBodyTooLarge(req: Request, text?: string): boolean {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > EXPLAIN_MAX_BODY_BYTES) return true;
  return typeof text === "string" && text.length > EXPLAIN_MAX_BODY_BYTES;
}

/** Whether the model may be called for this route today. */
export function explainModelAllowed(feature: string): Promise<boolean> {
  return underDailyCap(feature, EXPLAIN_DAILY_CAP);
}

/** A capped string field. */
export const capped = (max: number) => z.string().max(max);
/** A capped list of capped strings. */
export const cappedList = (max: number, items: number) => z.array(z.string().max(max)).max(items);
