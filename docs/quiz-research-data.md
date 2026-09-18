# Questionnaire data for research - what is recorded, and what each version is worth

Written 18/9/2026, after an audit of everything the questionnaires had recorded up
to that point. The audit is the reason for the rules below; read the "known
defects" section before pooling anything across dates.

## The record: `analytics_events.event_type = 'quiz_treatments'`, `metadata.v = 2`

One row per **scored questionnaire**, in the adults, kids and school flows alike.
The event name predates its scope - it is the full result record, not only
treatments. Joins to everything else on `session_id`.

| field | meaning |
|---|---|
| `quiz_type` | `adults` / `kids` / `school` (the counsellor tool - exclude from patient research) |
| `n_recs` | recommendations before de-duplication. **0 = the questionnaire found nothing**; the row is still written |
| `domains` | every domain the person selected (adults: emotional, functional, relationship, addiction, personal; kids: emotional, academic, developmental, behavioral, social) |
| `treatments` / `assessments` / `professionals` | distinct keys - the same strings the therapist match searches on |
| `default_treatments` | subset of `treatments` that is there only because nothing fired (adults: the `emotional-default` recommendation; kids: the low-stress fallback to טיפול דינאמי). "Recommended X because of a finding" = in `treatments` and not here |
| `age_band` | adults: 18-30 / 31-45 / 46-60 / 60+. kids: 1-7 / 8-12 / 13-18 - the three grade groups the scorer itself branches on |
| `gender` | m / f / other |
| `qv` | version of the instrument that **scored** it (content hash, from the score API) |
| `cv` | version baked into the **client bundle** that asked the questions. `qv != cv` = a cached bundle talked to a newer server: a mixed-version record, exclude it from anything version-sensitive |
| `build` | short commit SHA of the client bundle |
| `device` | mobile / tablet / desktop |
| `truncated` | present only if a key list exceeded 15 - should never happen; if it does, the lists are incomplete |
| `staff` | present (true) on staff test runs - the browser held the staff token. **Exclude these rows from every analysis** |

Written once per **scoring response** (adults: in goScoring; kids and school: in
fetchScore), never when the result screen mounts. So one scoring = one row: not
re-sent when the screen is rebuilt after a therapist-profile visit, nor when a
parent steps back into the questions and forward again (up to 18/9 the kids
screen did both). Note the kids flow does not re-score on that back-and-forward
- see "Known defects" - so the row always describes the answers that were
actually scored.

### Reading `qv`
A 10-character SHA-256 over the files that define the instrument
(`QUIZ_INSTRUMENT_FILES` in `next.config.ts`), with CRLF normalised to LF. To map a
hash back to a date, walk `git log` over those paths and hash each revision the
same way. The two large screen files are deliberately outside the hash; a flow
change made only there is located through `build`.

The hash covers the files, not their behaviour: a comment or a type edit in one
of them produces a new `qv` with identical scoring. Adjacent `qv` values can be
merged after reading the diff between them; the reverse (splitting one pooled
version into two) would be impossible, which is why it errs this way.

## What is never recorded per visitor: suicidality

A suicidality finding is stored **only** as a weekly count in
`research_weekly_counts` (`metric = 'suicidality'`, denominator
`metric = 'scored'`): a week, a questionnaire type and a number - no session, no
timestamp, no demographics. Both count scorings, not people. Suppress any rate
where `scored < 10`.

Written by `record_quiz_scoring(quiz_type, suicidality)`: one call per scoring,
after the response is sent, updating **both** rows every time (the suicidality
row by 0 when there was no finding). The first version (bump_research_count,
18/9 morning) touched the suicidality row only on suicidal scorings, so the
row's version stamp (`xmin`, an ordered transaction id) pointed at the latest
one and could be lined up against the quiz_treatments row written seconds
later; and it made two API calls instead of one, visible in the gateway logs.
Staff runs and the school tool are not counted.

Per visitor the finding is pooled into the generic emotional finding
(`app/lib/sensitive-findings.ts`) before it can reach a URL or a row, and the
`urgent` flag is not persisted anywhere, because four of the five urgent adult
findings are suicidality.

`*_legacy` metrics in the same table preserve, in aggregate, what the per-session
rows said before they were pooled on 18/9/2026. They count visitors who opened a
profile or an explanation from an urgent recommendation - a self-selected subset -
and **must not be added to the live `suicidality` metric**.

## Known defects in the older data

| data | dates | defect |
|---|---|---|
| `quiz_complete` v1 | 23/6 - 5/8 | completion only, no content. Symptom-domain prevalence for this period is still recoverable from `quiz_step` (below) |
| `quiz_complete` v2, adults, `treatments` | 6/8 - 18/9 | one entry **per recommendation**, then cut to 5. 46% of records hit the cap holding 1.9 distinct treatments on average, so anything that ranks late - above all טיפול דינאמי - is undercounted (51% recorded; 66% among uncut records). Treat every share except CBT as a lower bound. Proof it lost data: 14 sessions recorded as "CBT only" went on to search for a dynamic therapist |
| `quiz_complete`, `issue` | all | only the **first** domain selected. Relationships: 18.8% by `issue`, 49% by screen path |
| `quiz_complete`, `region` | all | always empty - the region is chosen later, in the match form |
| `quiz_complete`, kids | all | fires on reaching the result screen, and **again every time that screen is restored** after a profile visit: 20 of 36 repeat kids completions were this, 6 were genuine restarts. De-duplicate by session |
| `quiz_treatments` v1 | 13/8 - 18/9 | kids only; **not sent when nothing was found**, so those questionnaires are missing from its denominator; no demographics; cannot tell default טיפול דינאמי from finding-driven |
| kids result screen | all | a parent who reaches the results, steps **back** into the questions, changes an answer and returns sees the **old** result - the flow re-scores only when there is no score yet. 12 such returns in 11 sessions up to 18/9. Open: re-scoring costs a free-tier credit, so the fix is a product decision |
| treatment keys | before ~9/9 | `קלינאית תקשורת` and `קלינאות תקשורת` are the same key - normalise to the second |

## A retrospective asset: `quiz_step`

A detail screen is shown only after its gate was answered positively, so the set
of screens a completer reached = the concern areas they endorsed. This works for
the whole period since 23/6, including v1. Screens were added, merged and removed
over time (`legacy: true` in `app/lib/quiz-step-content.ts`), so compare within a
version, not across.

## Interpretation

The recommendation is a deterministic function of the answers. "Who is recommended
CBT" is therefore an audit of the algorithm, not a clinical finding. The questions
the data can actually carry: the self-reported concern profile of an online
help-seeking population; therapist-style preferences; what people choose when
offered two treatments; whether the type of recommendation predicts contacting a
therapist. Validation against clinicians needs no user data at all (vignettes).

The population is self-selected and heavily paid-traffic (young, female, central
Israel), and only completers are recorded.
