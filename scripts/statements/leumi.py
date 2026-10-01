"""Reads the account-movements export of Bank Leumi's business site.

The file is called .xls but is an HTML page. Its table has nine columns: branch,
account, date, description, reference, debit, credit, balance and a spare one.
The header cells sit outside any row, so columns are read by position.
"""
import html
import re
from datetime import date

from common import normalize, parse_amount, parse_date

_ROW = re.compile(r"<tr[^>]*>(.*?)</tr>", re.S | re.I)
_CELL = re.compile(r"<t[dh][^>]*>(.*?)</t[dh]>", re.S | re.I)
_TAG = re.compile(r"<[^>]+>")
_DATE = re.compile(r"^\d{2}/\d{2}/\d{4}$")


def _cells(row_html: str) -> list:
    return [normalize(html.unescape(_TAG.sub("", c)).replace("\xa0", " ")) for c in _CELL.findall(row_html)]


def parse_leumi_export(path: str) -> dict:
    """Returns {'lines': [...oldest first], 'balance': stated closing balance, 'period': (from, to)}.

    Each line is {'date', 'description', 'reference', 'amount' (credit positive), 'balance'}.
    """
    with open(path, "rb") as f:
        raw = f.read().decode("utf-8", errors="replace")
    raw = raw.replace("<![endif]-->", "")  # a stray comment that swallows the rest in strict parsers

    lines, header_text = [], []
    for match in _ROW.finditer(raw):
        cells = _cells(match.group(1))
        if len(cells) >= 8 and _DATE.match(cells[2]):
            debit = parse_amount(cells[5]) if cells[5] else 0.0
            credit = parse_amount(cells[6]) if cells[6] else 0.0
            lines.append({
                "date": parse_date(cells[2]),
                "description": cells[3],
                "reference": cells[4] or None,
                "amount": round(credit - debit, 2),
                "balance": parse_amount(cells[7]),
            })
        elif cells:
            header_text.append(" ".join(cells))

    head = " ".join(header_text)
    balance = re.search(r"יתרה:\s*(-?[\d,]+\.\d{2})", head)
    period = re.search(r"(\d{2}\.\d{2}\.\d{4})\s*-\s*(\d{2}\.\d{2}\.\d{4})", head)
    bounds = None
    if period:
        a, b = parse_date(period.group(1)), parse_date(period.group(2))
        bounds = (min(a, b), max(a, b))

    lines.reverse()  # the export lists the newest first; keep same-day lines in their real order
    return {
        "lines": lines,
        "balance": parse_amount(balance.group(1)) if balance else None,
        "period": bounds,
    }


def check_balance_chain(lines: list, stated_balance=None) -> list:
    """Problems found walking the balances; an empty list means no line was missed or altered."""
    problems = []
    for prev, cur in zip(lines, lines[1:]):
        expected = round(prev["balance"] + cur["amount"], 2)
        if abs(expected - cur["balance"]) > 0.005:
            problems.append(
                f"{cur['date']}: balance {cur['balance']:.2f}, but the line before it and this amount give {expected:.2f}"
            )
    if lines and stated_balance is not None and abs(lines[-1]["balance"] - stated_balance) > 0.005:
        problems.append(f"closing balance {lines[-1]['balance']:.2f} differs from the {stated_balance:.2f} the file states")
    return problems


def opening_balance(lines: list):
    """The balance before the first line in the file."""
    return round(lines[0]["balance"] - lines[0]["amount"], 2) if lines else None


__all__ = ["parse_leumi_export", "check_balance_chain", "opening_balance", "date"]
