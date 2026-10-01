"""Tests for the statement readers, on made-up data only (the repo is public).

    python -m unittest scripts/statements/test_statements.py -v

The card reader needs a real PDF; its guard is the reconciliation load.py runs on
every import (lines add up to the printed total, and to the bank's debit).
"""
import os
import sys
import tempfile
import unittest
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from common import dedupe_key, fix_visual_hebrew, normalize, parse_amount, parse_date  # noqa: E402
from leumi import check_balance_chain, opening_balance, parse_leumi_export  # noqa: E402
from rules import classify  # noqa: E402

BANK_HTML = """<html xmlns:o="x"><head><xml><x:a/></xml>
<![endif]--></head><body><table>
<tr><td colspan="9">בנק | תאריך שמירה: 3/5/2026</td></tr>
<tr><td colspan="9">יתרה: 4,500.00 ₪</td></tr>
<tr><td colspan="9">תאריך: 03.05.2026 - 01.05.2026</td></tr>
<tr><td>000</td><td>111/22</td><td>03/05/2026</td><td>תשלום ספק</td><td>3001</td><td>500</td><td></td><td>4,500.00</td><td></td></tr>
<tr><td>000</td><td>111/22</td><td>02/05/2026</td><td>הפקדה</td><td>2002</td><td></td><td>1,000</td><td>5,000.00</td><td></td></tr>
<tr><td>000</td><td>111/22</td><td>01/05/2026</td><td>עמלה</td><td>1001</td><td>10</td><td></td><td>4,000.00</td><td></td></tr>
</table></body></html>"""


class Helpers(unittest.TestCase):
    def test_visual_hebrew_is_turned_back(self):
        self.assertEqual(fix_visual_hebrew("םיבשחמ"), "מחשבים")
        self.assertEqual(fix_visual_hebrew("ח\"טמב"), "במט\"ח")
        self.assertEqual(fix_visual_hebrew("VERCEL"), "VERCEL")

    def test_amounts(self):
        self.assertEqual(parse_amount("1,234.56"), 1234.56)
        self.assertEqual(parse_amount("-2,950.00"), -2950.0)
        self.assertEqual(parse_amount("12.30-"), -12.3)
        self.assertEqual(parse_amount("₪ 9.88"), 9.88)

    def test_dates(self):
        self.assertEqual(parse_date("15/09/2026"), date(2026, 9, 15))
        self.assertEqual(parse_date("15/09/26"), date(2026, 9, 15))
        self.assertEqual(parse_date("01.10.2026"), date(2026, 10, 1))

    def test_normalize_unifies_quotes_and_marks(self):
        self.assertEqual(normalize("מע״מ ‏ ל-י"), 'מע"מ ל-י')

    def test_dedupe_key_is_stable_and_sensitive(self):
        self.assertEqual(dedupe_key("a", 1), dedupe_key("a", 1))
        self.assertNotEqual(dedupe_key("a", 1), dedupe_key("a", 2))


class BankExport(unittest.TestCase):
    def read(self, html=BANK_HTML):
        with tempfile.NamedTemporaryFile("wb", suffix=".xls", delete=False) as f:
            f.write(html.encode("utf-8"))
        try:
            return parse_leumi_export(f.name)
        finally:
            os.unlink(f.name)

    def test_reads_lines_oldest_first_with_signed_amounts(self):
        export = self.read()
        self.assertEqual([l["amount"] for l in export["lines"]], [-10.0, 1000.0, -500.0])
        self.assertEqual(export["lines"][0]["date"], date(2026, 5, 1))
        self.assertEqual(export["balance"], 4500.0)
        self.assertEqual(export["period"], (date(2026, 5, 1), date(2026, 5, 3)))

    def test_balances_chain_and_opening_balance(self):
        export = self.read()
        self.assertEqual(check_balance_chain(export["lines"], export["balance"]), [])
        self.assertEqual(opening_balance(export["lines"]), 4010.0)

    def test_a_missing_line_breaks_the_chain(self):
        export = self.read()
        del export["lines"][1]
        self.assertTrue(check_balance_chain(export["lines"], export["balance"]))


class Rules(unittest.TestCase):
    RULES = [
        {"id": "r-exact", "priority": 10, "source": "bank", "description_contains": "העברה", "direction": "out",
         "amount_exact": 100, "reference_exact": None, "flow": "expense", "category": "office",
         "counterparty": "X", "recurring": True, "status": "proposed", "note": "n"},
        {"id": "r-ref", "priority": 20, "source": "bank", "description_contains": "הלוואה", "direction": None,
         "amount_exact": None, "reference_exact": "777", "flow": "debt_service", "category": "loan",
         "counterparty": "L", "recurring": True, "status": "confirmed", "note": None},
        {"id": "r-any", "priority": 30, "source": None, "description_contains": "VENDOR", "direction": None,
         "amount_exact": None, "reference_exact": None, "flow": "expense", "category": "software",
         "counterparty": "V", "recurring": True, "status": "confirmed", "note": None},
        {"id": "r-off", "priority": 1, "source": None, "description_contains": "VENDOR", "direction": None,
         "amount_exact": None, "reference_exact": None, "flow": "internal", "category": None,
         "counterparty": None, "recurring": None, "status": "confirmed", "note": None, "active": False},
    ]

    def line(self, **kw):
        return {"source": "bank", "description": "x", "amount": -50.0, "reference": None, **kw}

    def test_amount_and_direction_narrow_a_rule(self):
        hit = classify(self.line(description="העברה דיגיטל", amount=-100.0), self.RULES)
        self.assertEqual((hit["rule_id"], hit["status"], hit["flow"]), ("r-exact", "proposed", "expense"))
        self.assertEqual(classify(self.line(description="העברה דיגיטל", amount=100.0), self.RULES)["status"], "unknown")
        self.assertEqual(classify(self.line(description="העברה דיגיטל", amount=-101.0), self.RULES)["status"], "unknown")

    def test_reference_narrows_a_rule(self):
        self.assertEqual(classify(self.line(description="פרעון הלוואה", reference="777"), self.RULES)["rule_id"], "r-ref")
        self.assertEqual(classify(self.line(description="פרעון הלוואה", reference="888"), self.RULES)["status"], "unknown")

    def test_case_and_source_and_inactive_rules(self):
        card = classify(self.line(source="card", description="Vendor Inc."), self.RULES)
        self.assertEqual(card["rule_id"], "r-any")  # the inactive higher-priority rule is skipped

    def test_nothing_is_guessed(self):
        none = classify(self.line(description="something else"), self.RULES)
        self.assertEqual((none["flow"], none["status"], none["rule_id"]), ("unknown", "unknown", None))


if __name__ == "__main__":
    unittest.main()
