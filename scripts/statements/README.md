# Statement import

Brings the owner's monthly bank and credit-card downloads into the database, so the budget agent
(`docs/agents/budget-agent-plan.md`, step 5) can see where the money actually went.

The repo is public. Nothing in this folder holds an amount, a payee or an account number: the files
stay on the owner's machine, and everything read from them lives in two database tables.

| Table | What it holds |
|---|---|
| `statement_lines` | One row per bank movement or card purchase, signed (money out is negative), with a flow, a category and a status. Staging only: it never writes to `expenses`, because a row there also creates a document in Sumit. |
| `statement_rules` | How a line is classified: a description fragment, optionally narrowed by source, direction, exact amount or bank reference. First match, lowest priority number first. A line no rule matches stays `unknown`. |

## Each month

Download, into one folder, Bank Leumi's "account movements" export (`.xls`, which is really HTML) and
Cal's digital monthly statement (`.pdf`). Then:

```bash
python scripts/statements/load.py <folder> --env <path to .env.local>          # dry run
python scripts/statements/load.py <folder> --env <path to .env.local> --apply  # write what is new
```

Needs Python 3 and `pip install pdfplumber`. The service key is read from the env file by the script
and never printed.

Before it writes anything, the load proves it read everything: every balance in the bank file follows
from the line before it, the closing balance matches what the file states, each card statement's lines
add up to its printed total, and that total is the amount the bank debited on the billing day. A
mismatch stops the load. Files may overlap: a line already stored is left alone, so a line the owner
has reviewed never changes. A purchase listed as upcoming on one statement and billed on the next is
one line.

## Classification

Rules are data. To teach the system a payee, insert a row into `statement_rules` (not a code change),
then re-run; to fix lines already stored, update them in `statement_lines`. Statuses:

- `confirmed`: a firm rule, or the owner said so
- `proposed`: a rule guessed it; waits for the owner
- `unknown`: no rule matched
- `ignored`: left out of every total

Flows: `expense`, `income`, `debt_service`, `debt_drawdown`, `tax`, `internal`, `settlement` (the bank
line that pays the card bill: the card's own lines are the costs, so a month is never counted twice),
`unknown`.

## Tests

```bash
python -m unittest scripts/statements/test_statements.py -v
```

Made-up data only. The card reader needs a real PDF; its guard is the reconciliation above.
