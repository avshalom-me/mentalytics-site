"""Helpers shared by the statement readers.

Nothing in this folder knows an amount, a payee or an account number: those live
in the database (statement_rules, statement_lines). The repo is public.
"""
import hashlib
import re
import unicodedata
from datetime import date, datetime

HEBREW = re.compile(r"[א-ת]")

# Hebrew punctuation and typographic quotes that print differently from the
# ASCII a rule was written with.
_PUNCT = str.maketrans({
    "״": '"', "“": '"', "”": '"', "″": '"',
    "׳": "'", "‘": "'", "’": "'",
})
_BIDI = re.compile("[‎‏‪-‮⁦-⁩]")


def normalize(text: str) -> str:
    """Quotes to ASCII, bidi marks out, whitespace collapsed. Used on both sides of a rule match."""
    text = unicodedata.normalize("NFC", text or "")
    text = _BIDI.sub("", text).translate(_PUNCT)
    return re.sub(r"\s+", " ", text).strip()


def fix_visual_hebrew(token: str) -> str:
    """PDF text comes out in visual order: a Hebrew word is stored back to front."""
    return token[::-1] if HEBREW.search(token) else token


def parse_amount(text: str) -> float:
    """'1,234.56', '-2,950.00', '12.30-' and '₪ 9.88' all read as a signed number."""
    s = text.replace("₪", "").replace("$", "").replace("EU", "").replace("\xa0", "").strip()
    negative = s.startswith("-") or s.endswith("-")
    value = float(s.strip("-").replace(",", ""))
    return -value if negative else value


def parse_date(text: str) -> date:
    text = text.strip()
    for fmt in ("%d/%m/%Y", "%d/%m/%y", "%d.%m.%Y", "%d.%m.%y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            pass
    raise ValueError(f"not a date: {text!r}")


def dedupe_key(*parts) -> str:
    """A stable fingerprint, so importing the same line twice changes nothing."""
    return hashlib.sha1("|".join(str(p) for p in parts).encode("utf-8")).hexdigest()
