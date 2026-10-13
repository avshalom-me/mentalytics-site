/**
 * IndexNow: telling Bing which addresses changed, instead of waiting for it to
 * come back and look.
 *
 * Why this exists. Microsoft Copilot answers from Bing's index, and other
 * assistants lean on it to a smaller degree; Bing visits a small site rarely.
 * On 13/10/2026 Google was still showing copies of our city pages from
 * July, weeks after the text on them had been fixed - a crawler that is not
 * told a page changed finds out late. Google does not take part in IndexNow,
 * so this does nothing for Google; it is for Bing and the engines that share
 * the protocol (Yandex, Naver, Seznam).
 *
 * The key is not a secret. The protocol has every site publish it at a public
 * address (public/<key>.txt), and it travels in each submission. All it lets a
 * holder do is tell the engines to re-read addresses on this host.
 */
export const INDEXNOW_HOST = "www.mentalytics.co.il";
export const INDEXNOW_KEY = "8a207533ce5d98d55a2ff306589dae3d";
export const INDEXNOW_KEY_LOCATION = `https://${INDEXNOW_HOST}/${INDEXNOW_KEY}.txt`;

const ENDPOINT = "https://api.indexnow.org/indexnow";
/** The protocol's ceiling for one request. */
const MAX_PER_REQUEST = 10_000;

export type SitemapEntry = { url: string; lastModified?: string | Date };

/**
 * The addresses whose lastmod falls within `hours` before `now`, or later.
 *
 * "Or later" is deliberate. A code-generated page carries a date with no time
 * (see app/lib/page-revised.ts), which reads as midnight UTC, while the commit
 * that set it may be dated by the clock in Israel - so on the evening it ships
 * its lastmod can still be a couple of hours ahead. Entries with no lastmod at
 * all are left out: there is nothing to say they changed.
 */
export function changedWithin(entries: SitemapEntry[], hours: number, now: number = Date.now()): string[] {
  const since = now - hours * 3_600_000;
  const urls = new Set<string>();
  for (const e of entries) {
    if (!e.lastModified || !onHost(e.url)) continue;
    const at = new Date(e.lastModified).getTime();
    if (Number.isFinite(at) && at >= since) urls.add(e.url);
  }
  return [...urls];
}

/** Only this host's addresses: the engines reject a list that strays (422). */
export function onHost(url: string): boolean {
  return url === `https://${INDEXNOW_HOST}` || url.startsWith(`https://${INDEXNOW_HOST}/`);
}

/**
 * Submit the addresses. 200 and 202 both mean accepted (202: the key file has
 * not been checked yet). Anything else is reported back, not thrown - a cron
 * that fails here should say what the engine answered.
 */
export async function submitToIndexNow(urls: string[]): Promise<{ ok: boolean; submitted: number; statuses: number[] }> {
  const list = [...new Set(urls.filter(onHost))];
  const statuses: number[] = [];
  let submitted = 0;
  for (let i = 0; i < list.length; i += MAX_PER_REQUEST) {
    const chunk = list.slice(i, i + MAX_PER_REQUEST);
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: INDEXNOW_HOST,
        key: INDEXNOW_KEY,
        keyLocation: INDEXNOW_KEY_LOCATION,
        urlList: chunk,
      }),
    });
    statuses.push(res.status);
    if (res.status === 200 || res.status === 202) submitted += chunk.length;
  }
  return { ok: statuses.every((s) => s === 200 || s === 202), submitted, statuses };
}
