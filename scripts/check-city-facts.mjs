// Every CITY_FACTS key must be a city the vocabulary knows, spelled exactly
// as regions.ts spells it - a typo silently drops the fact from its page.
// Runs in the pre-push hook next to check-page-revised.mjs.
import { readFileSync } from "node:fs";
const facts = readFileSync("app/lib/city-facts.ts", "utf8");
const regions = readFileSync("app/lib/regions.ts", "utf8");
const keys = [...facts.matchAll(/^  "([^"]+)": \{/gm)].map((m) => m[1]);
const bad = keys.filter((k) => !regions.includes(`"${k}"`));
if (keys.length === 0 || bad.length) {
  console.error(`check-city-facts: ${keys.length} facts, unknown cities: ${bad.join(", ") || "(none)"}`);
  process.exit(1);
}
console.log(`check-city-facts: ${keys.length} facts, all cities known`);
