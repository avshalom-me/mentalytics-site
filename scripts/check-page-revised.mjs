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
 * The dates are read from git history, so the history has to be all there. In
 * a shallow clone the commit at the edge of what was fetched is treated as
 * having no parents, so git names it as the last change to every file that is
 * really older. On 30/9 a depth-50 clone of an untouched master failed with 30
 * pages "changed 2026-09-23" - /privacy, /terms, all of /research - and that
 * was only the date of the edge commit. The advice printed under it would
 * have moved 30 correct dates forward. So a shallow clone is refused before
 * anything is dated, with exit code 2 rather than the 1 of a real finding,
 * which is how the pre-push hook knows not to call the dates stale. It is not
 * let through either: that would switch the check off in every shallow clone.
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

// 2 = the check could not run, 1 = it ran and found something. The pre-push
// hook words its last line by the difference.
const EXIT_NOT_CHECKED = 2;

const shallow =
  execFileSync("git", ["rev-parse", "--is-shallow-repository"], { encoding: "utf8" }).trim() ===
  "true";

if (shallow) {
  console.error("❌ Page revision dates were not checked: this clone's git history is shallow.\n");
  console.error("   The check dates each source file by its last commit. In a shallow clone a");
  console.error("   file that last changed before the fetched history is dated by the commit at");
  console.error("   its edge instead, so pages are reported as stale that are not.");
  console.error(`   Do not change the dates in ${SRC} because of this.\n`);
  console.error("   Fetch the full history, then run the check (or push) again:");
  console.error("      git fetch --unshallow origin\n");
  process.exit(EXIT_NOT_CHECKED);
}

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
