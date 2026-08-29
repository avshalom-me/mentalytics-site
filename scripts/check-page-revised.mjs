/**
 * Fails if any page's declared <lastmod> is older than the last git change to
 * the files that page is built from.
 *
 * This exists because the comment that asked for it by hand did not work. The
 * landing-page revision date sat at 10/8 while three copy fixes shipped after
 * it, the last being data-nosnippet on the therapist cards (22/8). Googlebot
 * saw a lastmod it already had, so it re-crawled some city pages and not
 * others: on 29/8 the Jerusalem SERP showed our copy while Haifa still listed
 * therapist names, from identical HTML.
 *
 * A stale lastmod is invisible in review, in tests and in the running site.
 * The only place it shows up is a search result weeks later, which is why the
 * check runs on push rather than being left to whoever remembers.
 *
 * Run: node scripts/check-page-revised.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const SRC = "app/lib/page-revised.ts";
const text = readFileSync(SRC, "utf8");

// Paths contain "]" (app/therapists/city/[city]/page.tsx), so the array is
// closed by "]" followed by "}" - not by the first "]" encountered.
const ENTRY = /"([^"]+)":\s*\{\s*date:\s*"(\d{4}-\d{2}-\d{2})",\s*sources:\s*\[(.*?)\],?\s*\}/gs;

const lastCommit = (file) =>
  execFileSync("git", ["log", "-1", "--format=%ad", "--date=short", "--", file], {
    encoding: "utf8",
  }).trim();

const stale = [];
const missing = [];
let checked = 0;

for (const [, route, date, rawSources] of text.matchAll(ENTRY)) {
  const sources = [...rawSources.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  if (sources.length === 0) missing.push(`${route}: no sources listed, nothing can verify it`);
  for (const file of sources) {
    if (!existsSync(file)) {
      missing.push(`${route}: source not found - ${file}`);
      continue;
    }
    checked++;
    const changed = lastCommit(file);
    // Dates are YYYY-MM-DD, so string comparison is chronological.
    if (changed && changed > date) stale.push({ route, date, file, changed });
  }
}

if (checked === 0) {
  console.error(`❌ ${SRC}: parsed no entries at all - the check is not running.`);
  process.exit(1);
}

if (missing.length) {
  console.error(`❌ ${SRC} has entries that cannot be verified:\n`);
  for (const m of missing) console.error(`   ${m}`);
  console.error("");
  process.exit(1);
}

if (stale.length) {
  console.error(`❌ ${stale.length} page(s) changed after the date the sitemap declares:\n`);
  for (const s of stale) {
    console.error(`   ${s.route}`);
    console.error(`      declares ${s.date}, but ${s.file} changed ${s.changed}`);
  }
  console.error(`\n   Update the date in ${SRC} to the real change date.`);
  console.error("   Not today's date - a lastmod that is always today is the one Google ignores.\n");
  process.exit(1);
}

console.log(`✓ page revision dates current (${checked} source files checked)`);
