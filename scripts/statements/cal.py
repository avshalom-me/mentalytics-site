"""Reads a Cal (Visa) digital monthly statement, a PDF.

Cal prints Hebrew in visual order, so every Hebrew word comes out back to front,
and its table has to be rebuilt from word positions. Columns, right to left:
transaction date, merchant, category, details, "card shown", transaction amount,
billing amount. A second table lists purchases that will be billed in a later
cycle; it has an extra billing-date column.

Needs pdfplumber (pip install pdfplumber).
"""
import re

from common import HEBREW, fix_visual_hebrew, normalize, parse_amount, parse_date

# Column boundaries in PDF points, measured on the statement template.
X_DATE = 495
X_MERCHANT = (412, 497)
X_CATEGORY = (380, 412)
X_DETAILS = (258, 380)
X_TX_AMOUNT = (200, 258)
# The upcoming-purchases table has one more column, so its transaction amount sits further right.
X_TX_AMOUNT_UPCOMING = (200, 300)
X_BILL_DATE = (170, 205)

_DATE4 = re.compile(r"^\d{2}/\d{2}/\d{4}$")
_DATE2 = re.compile(r"^\d{2}/\d{2}/\d{2}$")
_NUM = re.compile(r"^-?[\d,]+\.\d{2}-?$")
_CURRENCY = {"$": "USD", "EU": "EUR", "€": "EUR", "₪": "ILS"}


def _rev(word: str) -> str:
    """A section title as the PDF spells it (back to front)."""
    return word[::-1]


def _lines(page) -> list:
    words = page.extract_words(x_tolerance=1.5, y_tolerance=2)
    rows = {}
    for w in words:
        rows.setdefault(round(w["top"] / 3), []).append(w)
    return [sorted(rows[k], key=lambda w: -w["x0"]) for k in sorted(rows)]


def _merchant(tokens: list) -> str:
    """tokens: (line number, x, text). Latin names read left to right, Hebrew right to left."""
    if not tokens:
        return ""
    if any(HEBREW.search(t) for _, _, t in tokens):
        ordered = sorted(tokens, key=lambda t: (t[0], -t[1]))
    else:
        ordered = sorted(tokens, key=lambda t: (t[0], t[1]))
    return normalize(" ".join(fix_visual_hebrew(t) for _, _, t in ordered))


def parse_cal_statement(path: str) -> dict:
    """Returns {'billing_date', 'total', 'rows': [...], 'future': [...]}.

    A row is {'tx_date', 'merchant', 'details', 'currency', 'orig_amount', 'amount', 'fx_fee'}
    (amounts as printed: a charge is positive, a refund negative); a 'future' row also has
    'billing_date'. Raises if the rows do not add up to the total the statement prints.
    """
    import pdfplumber  # imported here so the pure helpers stay usable without it

    rows, future = [], []
    billing_date = total = None
    section = cur = None
    line_no = 0

    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            for ln in _lines(page):
                line_no += 1
                raw = " ".join(w["text"] for w in ln)

                if _rev("לחיוב") in raw and _rev("עתידי") in raw:
                    section, cur = "future", None
                    continue
                if _rev("שנצברו") in raw and _rev("עסקות") in raw:
                    section, cur = "main", None
                    continue
                if _rev('סה"כ') in raw and _rev("לתאריך") in raw:
                    dates = [w["text"] for w in ln if _DATE2.match(w["text"])]
                    nums = [w["text"] for w in ln if _NUM.match(w["text"])]
                    billing_date = parse_date(dates[0]) if dates else billing_date
                    total = parse_amount(nums[0]) if nums else total
                    section, cur = None, None
                    continue
                if _rev("ט.ל.ח") in raw:  # the small print at the foot of each page
                    section, cur = None, None
                    continue
                if section is None:
                    continue

                anchor = [w for w in ln if _DATE4.match(w["text"]) and w["x0"] > X_DATE]
                if anchor:
                    cur = {
                        "tx_date": parse_date(anchor[0]["text"]), "_merchant": [], "_details": [],
                        "currency": None, "orig_amount": None, "amount": None, "billing_date": None,
                    }
                    (rows if section == "main" else future).append(cur)
                if cur is None:
                    continue

                tx_lo, tx_hi = X_TX_AMOUNT if section == "main" else X_TX_AMOUNT_UPCOMING
                for w in ln:
                    x, text = w["x0"], w["text"]
                    if anchor and w is anchor[0]:
                        continue
                    if anchor and _NUM.match(text):
                        if tx_lo <= x < tx_hi and cur["orig_amount"] is None:
                            cur["orig_amount"] = parse_amount(text)
                        elif x < tx_lo and cur["amount"] is None:
                            cur["amount"] = parse_amount(text)
                    elif anchor and text in _CURRENCY and tx_lo <= x < tx_hi:
                        cur["currency"] = _CURRENCY[text]
                    elif section == "future" and anchor and _DATE2.match(text) and X_BILL_DATE[0] <= x <= X_BILL_DATE[1]:
                        cur["billing_date"] = parse_date(text)
                    elif X_MERCHANT[0] <= x < X_MERCHANT[1]:
                        cur["_merchant"].append((line_no, x, text))
                    elif X_DETAILS[0] <= x < X_DETAILS[1] or (not anchor and X_CATEGORY[0] <= x < X_CATEGORY[1]):
                        cur["_details"].append((line_no, x, text))
                if section == "future":
                    cur = None  # one line per upcoming purchase; what follows is page text

    for row in rows + future:
        row["merchant"] = _merchant(row.pop("_merchant"))
        details = sorted(row.pop("_details"), key=lambda t: (t[0], -t[1]))
        row["details"] = normalize(" ".join(fix_visual_hebrew(t) for _, _, t in details))
        fee = re.search(r'בסך\s+([\d.]+)\s+ש"ח', row["details"])
        row["fx_fee"] = float(fee.group(1)) if fee else None

    if billing_date is None or total is None:
        raise ValueError(f"{path}: could not find the billing date and total")
    printed = round(sum(r["amount"] or 0 for r in rows), 2)
    if abs(printed - total) > 0.005:
        raise ValueError(f"{path}: rows add up to {printed:.2f} but the statement totals {total:.2f}")
    for r in rows:
        r["billing_date"] = billing_date
    return {"billing_date": billing_date, "total": total, "rows": rows, "future": future}
