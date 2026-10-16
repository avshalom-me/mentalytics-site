/**
 * Turns the web addresses in already-escaped text into real links.
 *
 * Two of our emails carried a personal link as plain text inside an HTML body:
 * the gift offer (its join link) and the service agent's replies. Gmail turns
 * such text into a link by itself; Outlook and several other mail apps do not,
 * so the address arrived as words nobody could click. On 15-16/10/2026 a
 * therapist reading in Outlook clicked the only real link in the gift email,
 * which led to the personal area, and wrote back that we had sent the wrong
 * link.
 *
 * The input must already be HTML-escaped: the function only wraps what it
 * finds in <a>, so it can never let markup through. Only http(s) addresses are
 * linked, made of URL characters only, so an address written right next to
 * Hebrew text stops where the Hebrew starts. A trailing full stop or comma
 * belongs to the sentence, not to the address.
 *
 * No imports: gmail.ts deliberately does not depend on the email layer.
 */

// URL characters after escaping: "&" arrives as "&amp;", which these cover.
const URL_IN_ESCAPED_TEXT = /https?:\/\/[A-Za-z0-9\-._~:/?#@!$&+,;=%]+/g;
const TRAILING_PUNCTUATION = /[.,;:!?]+$/;

export function linkifyEscapedText(escaped: string, linkStyle = "color:#0F5468;"): string {
  return escaped.replace(URL_IN_ESCAPED_TEXT, (match) => {
    // "&amp;" ends in ";" - only strip punctuation that is not part of an entity.
    let url = match;
    let tail = "";
    const trailing = TRAILING_PUNCTUATION.exec(url);
    if (trailing && !/&[a-z]+;$/.test(url)) {
      tail = trailing[0];
      url = url.slice(0, -tail.length);
    }
    if (!/^https?:\/\/[^/]+\.[^/]+/.test(url)) return match;
    return `<a href="${url}" style="${linkStyle}">${url}</a>${tail}`;
  });
}
