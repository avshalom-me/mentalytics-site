"""Classifies a statement line with the rules in the database (statement_rules).

A rule applies when its description fragment is inside the line's description
(quotes and case ignored) and every other condition it sets also holds: the
source, the direction, the amount, the bank reference. The first rule that
applies, lowest priority number first, decides. A line no rule applies to stays
'unknown' for the owner to look at: nothing is guessed.
"""
from common import normalize

NO_MATCH = {
    "flow": "unknown", "category": None, "counterparty": None,
    "recurring": None, "status": "unknown", "note": None, "rule_id": None,
}


def matches(rule: dict, line: dict) -> bool:
    if rule.get("source") and rule["source"] != line["source"]:
        return False
    if normalize(rule["description_contains"]).lower() not in normalize(line["description"]).lower():
        return False
    direction = "in" if line["amount"] > 0 else "out"
    if rule.get("direction") and rule["direction"] != direction:
        return False
    if rule.get("amount_exact") is not None and abs(abs(line["amount"]) - float(rule["amount_exact"])) > 0.005:
        return False
    if rule.get("reference_exact") and str(rule["reference_exact"]) != str(line.get("reference") or ""):
        return False
    return True


def classify(line: dict, rules: list) -> dict:
    for rule in sorted((r for r in rules if r.get("active", True)), key=lambda r: r["priority"]):
        if matches(rule, line):
            return {
                "flow": rule["flow"], "category": rule.get("category"),
                "counterparty": rule.get("counterparty"), "recurring": rule.get("recurring"),
                "status": rule["status"], "note": rule.get("note"), "rule_id": rule["id"],
            }
    return dict(NO_MATCH)
