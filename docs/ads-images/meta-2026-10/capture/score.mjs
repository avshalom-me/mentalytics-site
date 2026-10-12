// Runs the site's own scoring function on a questionnaire payload, locally.
// Used by the capture script so the demo run never calls the production score
// endpoint (which would consume a free use and bump the research counters).
// Usage: node score.mjs < answers.json   → prints {ok, recommendations, algo}
// The repo is four folders up from here (docs/ads-images/meta-2026-10/capture).
const { scoreQuestionnaire } = await import(new URL("../../../../app/lib/questionnaire-score.ts", import.meta.url).href);

let raw = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) raw += chunk;
const answers = JSON.parse(raw);
delete answers._fp;
delete answers._staffToken;
const result = scoreQuestionnaire(answers);
process.stdout.write(JSON.stringify({ ok: true, ...result, algo: null }));
