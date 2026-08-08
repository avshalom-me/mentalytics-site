/**
 * Cache-buster for the two questionnaire item endpoints.
 *
 * Both /api/questionnaire/{adults,kids}/questions answer with
 * `Cache-Control: public, max-age=86400, stale-while-revalidate=604800`, so a
 * browser that loaded the quiz yesterday keeps its copy of the item lists for a
 * day and may serve it for a week. That is fine while the lists only gain
 * wording fixes, and dangerous the moment the scoring thresholds move with them:
 * a client holding the six-item psychosis follow-up while the server scores
 * against the three-item thresholds is a combination neither version was tested
 * as. Appending this to the request URL makes a release that changes the items a
 * different cache key, so nobody is served the old list against new thresholds.
 *
 * Bump it in the same commit as any change to app/lib/questionnaire-items.server.ts.
 */
export const QUESTIONNAIRE_ITEMS_VERSION = "2026-08-08";
