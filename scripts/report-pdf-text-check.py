"""What a viewer can do with a report PDF: extract the Hebrew, search it, follow its links.

    python -I scripts/report-pdf-text-check.py report.pdf [expected.txt]

Needs PyMuPDF and pypdfium2 (pip), and `pdftotext` (poppler) on the PATH. PDFium is the engine of
Chrome and Edge, poppler of many Linux viewers, MuPDF of several mobile ones. Adobe Reader and macOS
Preview are not covered: open the file in them by hand and search for a Hebrew phrase.

With expected.txt (the report's text, UTF-8) it also says how many of its Hebrew words come back as
the right word, and how many come back letter-reversed ("םולש"). A PDF made of pictures returns none.

The text layer itself is the prototype in app/lib/report-pdf-text.ts; switch it on in a browser
console with `window.__pdfTextLayer = true` before pressing the report's PDF button.
"""
import re
import subprocess
import sys

import fitz
import pypdfium2 as pdfium

sys.stdout.reconfigure(encoding="utf-8")
PHRASES = ["ועדת זכאות ואפיון", "התערבות מערכתית", "ניסיון טיפולי", "קישורים רשמיים", "טיפול חכם"]

pdf = sys.argv[1]
doc = fitz.open(pdf)
raw = open(pdf, "rb").read()
print(f"{pdf}: {len(doc)} pages, {len(raw) // 1024} KB, {sum(len(p.get_links()) for p in doc)} links, "
      f"tagged={b'/StructTreeRoot' in raw}, lang={bool(re.search(rb'/Lang\s*[(/]', raw))}")

texts = {}
pd = pdfium.PdfDocument(pdf)
texts["PDFium"] = "\n".join(pd[i].get_textpage().get_text_range() for i in range(len(pd)))
texts["MuPDF"] = "\n".join(p.get_text() for p in doc)
texts["poppler"] = subprocess.run(["pdftotext", "-enc", "UTF-8", pdf, "-"], capture_output=True).stdout.decode("utf-8", "replace")

for name, t in texts.items():
    # MuPDF puts every word on a line of its own and its search matches word by word, so a phrase
    # count from it would mislead; its Hebrew word score below is the fair measure.
    found = "n/a" if name == "MuPDF" else {ph: len(re.findall(re.escape(ph), t)) for ph in PHRASES}
    print(f"  {name:8} {len(t):6} characters; phrases found: {found}")

if len(sys.argv) > 2:
    def letters(s):
        return re.sub(r"[^\u05D0-\u05EA]", "", s)
    words = {letters(w) for w in open(sys.argv[2], encoding="utf-8").read().split()}
    words = {w for w in words if len(w) >= 2}
    for name, t in texts.items():
        got = {letters(w) for w in t.split()}
        ok = sum(1 for w in words if w in got)
        rev = sum(1 for w in words if w not in got and w[::-1] in got)
        print(f"  {name:8} Hebrew words right {ok}/{len(words)} ({100 * ok // len(words)}%), reversed {rev}")
