"""Loads the owner's monthly bank and card downloads into statement_lines.

    python scripts/statements/load.py <folder> --env <.env.local>           # dry run: read, classify, reconcile, print
    python scripts/statements/load.py <folder> --env <.env.local> --apply   # also write the lines that are new

The folder holds the files as downloaded: Bank Leumi's "account movements" export
(.xls, really HTML) and Cal's digital monthly statements (.pdf). Re-running on the
same files, or on files that overlap, adds only what is new, and never changes a
line the owner has reviewed. Statements stay on the owner's machine and in the
database; nothing here writes them anywhere else.

Before anything is written the load proves it read everything: every balance in
the bank file follows from the line before it, the closing balance matches what
the file states, each card statement's lines add up to its printed total, and
that total is the amount the bank debited on the billing day.
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from cal import parse_cal_statement  # noqa: E402
from common import dedupe_key  # noqa: E402
from leumi import check_balance_chain, opening_balance, parse_leumi_export  # noqa: E402
from rules import classify  # noqa: E402

BATCH = 100
COLUMNS = [
    "source", "source_label", "line_date", "settle_date", "description", "reference", "amount",
    "orig_amount", "orig_currency", "fx_fee", "balance_after", "flow", "category", "counterparty",
    "recurring", "status", "note", "rule_id", "dedupe_key",
]


def read_env(path: str) -> dict:
    env = {}
    with open(path, encoding="utf-8") as f:
        for raw in f:
            raw = raw.strip()
            if raw and not raw.startswith("#") and "=" in raw:
                key, _, value = raw.partition("=")
                env[key.strip()] = value.strip().strip('"').strip("'")
    return env


class Db:
    def __init__(self, env: dict):
        self.url = env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/") + "/rest/v1"
        self.key = env["SUPABASE_SERVICE_ROLE_KEY"]

    def _call(self, method: str, path: str, body=None, prefer: str = ""):
        req = urllib.request.Request(
            self.url + path,
            data=json.dumps(body).encode("utf-8") if body is not None else None,
            method=method,
            headers={
                "apikey": self.key,
                "Authorization": f"Bearer {self.key}",
                "Content-Type": "application/json",
                **({"Prefer": prefer} if prefer else {}),
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                text = resp.read().decode("utf-8")
                return json.loads(text) if text else None
        except urllib.error.HTTPError as e:
            raise SystemExit(f"database said {e.code}: {e.read().decode('utf-8')[:400]}")

    def rules(self) -> list:
        return self._call("GET", "/statement_rules?active=eq.true&select=*&order=priority")

    def set_settle_date(self, key: str, day: str) -> int:
        """Moves the billing day of a line stored as upcoming; touches nothing else on it."""
        got = self._call(
            "PATCH", f"/statement_lines?dedupe_key=eq.{key}&settle_date=neq.{day}", {"settle_date": day},
            prefer="return=representation",
        )
        return len(got or [])

    def insert_new(self, rows: list) -> int:
        inserted = 0
        for i in range(0, len(rows), BATCH):
            got = self._call(
                "POST", "/statement_lines?on_conflict=dedupe_key", rows[i:i + BATCH],
                prefer="resolution=ignore-duplicates,return=representation",
            )
            inserted += len(got or [])
        return inserted


def collect(folder: str, bank_label: str, card_label: str):
    """Reads every file in the folder; returns (lines, checks, problems)."""
    lines, checks, problems = [], [], []
    card_seen = {}
    for name in sorted(os.listdir(folder)):
        path = os.path.join(folder, name)
        low = name.lower()
        if not os.path.isfile(path):
            continue

        if low.endswith((".xls", ".html", ".htm")):
            export = parse_leumi_export(path)
            if not export["lines"]:
                problems.append(f"{name}: no account movements found, skipped")
                continue
            chain = check_balance_chain(export["lines"], export["balance"])
            first, last = export["lines"][0]["date"], export["lines"][-1]["date"]
            checks.append(
                f"bank file {first}..{last}: {len(export['lines'])} lines, opening balance "
                f"{opening_balance(export['lines']):,.2f}, closing {export['lines'][-1]['balance']:,.2f}, "
                + ("balances chain correctly" if not chain else "BALANCE PROBLEMS")
            )
            problems += [f"{name}: {p}" for p in chain]
            local = Counter()
            for row in export["lines"]:
                base = ("bank", row["date"], row["reference"], row["amount"], row["balance"])
                local[base] += 1
                lines.append({
                    "source": "bank", "source_label": bank_label,
                    "line_date": row["date"], "settle_date": row["date"],
                    "description": row["description"], "reference": row["reference"],
                    "amount": row["amount"], "balance_after": row["balance"],
                    "dedupe_key": dedupe_key(*base, local[base]),
                })

        elif low.endswith(".pdf"):
            try:
                statement = parse_cal_statement(path)
            except ValueError as e:
                problems.append(f"{name}: skipped ({e})")
                continue
            checks.append(
                f"card statement billed {statement['billing_date']}: {len(statement['rows'])} lines add up to the "
                f"printed total {statement['total']:,.2f}"
                + (f", plus {len(statement['future'])} billed later" if statement["future"] else "")
            )
            statement_lines = []
            for section, rows in (("main", statement["rows"]), ("future", statement["future"])):
                local = Counter()
                for row in rows:
                    if row["amount"] is None:
                        problems.append(f"{name}: a line of {row['merchant']!r} on {row['tx_date']} has no amount")
                        continue
                    base = ("card", row["tx_date"], row["merchant"], row["orig_amount"], row["amount"])
                    local[base] += 1
                    statement_lines.append({
                        "source": "card", "source_label": card_label,
                        "line_date": row["tx_date"], "settle_date": row["billing_date"],
                        "description": row["merchant"], "reference": None,
                        "amount": round(-row["amount"], 2),
                        "orig_amount": -row["orig_amount"] if row["orig_amount"] is not None else None,
                        "orig_currency": row["currency"] if row["currency"] not in (None, "ILS") else None,
                        "fx_fee": row["fx_fee"],
                        "dedupe_key": dedupe_key(*base, local[base]),
                        "_upcoming": section == "future",
                    })
            card_seen[statement["billing_date"]] = statement["total"]
            lines += statement_lines
        else:
            problems.append(f"{name}: not a bank export or a card statement, skipped")
    return lines, checks, problems, card_seen


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("folder")
    ap.add_argument("--env", required=True, help="path to the .env.local with the Supabase URL and service key")
    ap.add_argument("--apply", action="store_true", help="write the new lines (default: a dry run)")
    ap.add_argument("--bank-label", default="bank-main")
    ap.add_argument("--card-label", default="card-1")
    args = ap.parse_args()

    db = Db(read_env(args.env))
    rules = db.rules()
    lines, checks, problems, card_totals = collect(args.folder, args.bank_label, args.card_label)

    # A line that appears in two files (a purchase listed as upcoming, then billed) is one line.
    unique = {}
    for line in lines:
        seen = unique.get(line["dedupe_key"])
        if seen is None or (seen.get("_upcoming") and not line.get("_upcoming")):
            unique[line["dedupe_key"]] = line
    lines = list(unique.values())
    for line in lines:
        line.update(classify(line, rules))

    # Each card statement's total is what the bank debited on the billing day.
    bank_by_day = defaultdict(list)
    for line in lines:
        if line["source"] == "bank" and line["flow"] == "settlement":
            bank_by_day[line["line_date"]].append(line["amount"])
    for billed, total in sorted(card_totals.items()):
        hit = any(abs(a + total) < 0.005 for a in bank_by_day.get(billed, []))
        checks.append(
            f"card bill of {billed} ({total:,.2f}): "
            + ("the bank debited exactly that" if hit else "no matching debit in the bank file (outside its range, or a mismatch)")
        )

    print("== Reconciliation")
    for c in checks:
        print("  " + c)
    for p in problems:
        print("  PROBLEM: " + p)

    print("\n== Lines:", len(lines), dict(Counter(l["status"] for l in lines)))
    by_month = defaultdict(lambda: defaultdict(float))
    for l in lines:
        if l["source"] == "bank":
            by_month[l["line_date"].strftime("%Y-%m")]["bank in" if l["amount"] > 0 else "bank out"] += l["amount"]
    print("-- cash through the bank, by month")
    for m in sorted(by_month):
        d = by_month[m]
        print(f"  {m}: in {d['bank in']:>10,.2f}   out {d['bank out']:>11,.2f}   net {d['bank in'] + d['bank out']:>11,.2f}")

    costs = defaultdict(lambda: defaultdict(float))
    for l in lines:
        if l["flow"] == "expense":
            costs[l["line_date"].strftime("%Y-%m")][l["category"] or "-"] += -l["amount"]
    print("-- operating costs by month and category (card purchases by purchase date, bank payments by day)")
    for m in sorted(costs):
        parts = ", ".join(f"{k} {v:,.0f}" for k, v in sorted(costs[m].items(), key=lambda kv: -kv[1]))
        print(f"  {m}: total {sum(costs[m].values()):>8,.0f}  ({parts})")

    for status in ("unknown", "proposed"):
        picked = sorted((l for l in lines if l["status"] == status), key=lambda l: l["line_date"])
        if picked:
            print(f"\n-- {status} ({len(picked)})")
            for l in picked:
                print(f"  {l['line_date']} {l['source']:4} {l['amount']:>11,.2f}  {l['description'][:38]:38} {l['counterparty'] or ''}")

    if problems:
        print("\nNothing written: fix the problems above first.")
        raise SystemExit(1)
    if not args.apply:
        print("\nDry run. Add --apply to write the new lines.")
        return

    payload = [
        {c: (l.get(c).isoformat() if hasattr(l.get(c), "isoformat") else l.get(c)) for c in COLUMNS}
        for l in lines
    ]
    inserted = db.insert_new(payload)
    print(f"\nWritten: {inserted} new lines, {len(payload) - inserted} were already there.")


if __name__ == "__main__":
    main()
