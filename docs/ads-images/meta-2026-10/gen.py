# -*- coding: utf-8 -*-
"""Meta feed images for the October 2026 ads: one for therapist recruitment, one for patients.

Each is the still half of a pair whose other half is a video (the recruitment video, and the
adults' promo that the patients' image is built from). The wording is the owner's, approved on
6/10/2026; the refund line is his sentence, word for word.
Rendered at 1080x1350 (4:5, the feed format) with a 2x device scale.

Rules carried over from the September set (meta-2026-09/gen.py):
- Big headline, little text: the July carousels were too wordy to stop a scroll.
- Nothing in the patients' image may assert or imply the viewer's mental-health condition
  (Meta "Personal Attributes"): it speaks about choosing a therapist, never about the reader.
- No em dash anywhere (house rule), and the logo is the real file, never redrawn.
"""
import io, os, subprocess
from PIL import Image

W = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(W, "..", "..", ".."))
LOGO = "file:///" + os.path.join(REPO, "public", "logo.png").replace("\\", "/")
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
WIDTH, HEIGHT = 1080, 1350

HEAD = """<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;800;900&display=swap" rel="stylesheet">
<style>
:root{--teal:#3D8C8A;--teal-dark:#2A6462;--teal-pale:#EAF4F3;--teal-mid:#C2DFDE;--gold:#D49018;--gold-dark:#A87010;--gold-pale:#FDF6E3;
--text:#131F1E;--text-2:#3E5250;--muted:#6B807E;--faint:#A2B5B4;--surface:#F7FAF9;--line:#DDE9E8}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1080px;height:1350px;overflow:hidden;font-family:Heebo,sans-serif;color:var(--text)}
body{background:radial-gradient(120% 80% at 50% 0%,#ffffff 0%,#F4F9F8 55%,var(--teal-pale) 100%);
 display:flex;flex-direction:column;align-items:center;padding:46px 76px 36px;position:relative}
.ring{position:absolute;border-radius:50%;border:34px solid;opacity:.55;pointer-events:none}
.logo{width:200px;height:auto;margin-bottom:22px}
.chip{display:inline-block;background:var(--gold-pale);color:var(--gold-dark);border:2px solid #F0DDB0;
 font-weight:800;font-size:31px;border-radius:50px;padding:10px 32px;margin-bottom:22px}
h1{font-weight:900;line-height:1.1;text-align:center;letter-spacing:-1px}
h1 em{font-style:normal;color:var(--teal)}
.btn{margin-top:auto;background:var(--teal);color:#fff;font-weight:800;font-size:40px;border-radius:60px;
 padding:24px 70px;box-shadow:0 14px 30px rgba(42,100,98,.28);display:flex;align-items:center;gap:18px}
.url{margin-top:20px;font-size:30px;font-weight:800;color:var(--teal-dark);letter-spacing:.5px;direction:ltr}
.card{background:#fff;border:2px solid var(--line);border-radius:30px;box-shadow:0 18px 40px rgba(19,31,30,.10)}
.check{display:flex;align-items:center;gap:22px;background:#fff;border:2px solid var(--line);border-radius:60px;
 padding:15px 28px;font-size:32px;font-weight:700;color:var(--text-2);margin-top:14px;width:100%}
.check i{flex:none;width:46px;height:46px;border-radius:50%;background:var(--teal-pale);display:flex;align-items:center;justify-content:center}
</style></head><body>
<div class="ring" style="width:520px;height:520px;top:-210px;left:-190px;border-color:var(--teal-mid)"></div>
<div class="ring" style="width:420px;height:420px;bottom:-200px;right:-160px;border-color:#F3E3C0"></div>
<img class="logo" src="%(logo)s">"""

TICK = ('<i><svg width="26" height="26" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" '
        'stroke="#2A6462" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></i>')
ARROW = ('<svg width="34" height="34" viewBox="0 0 24 24"><path d="M19 12H5M11 6l-6 6 6 6" fill="none" '
         'stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>')

# The owner's sentence (6/10/2026), kept as he wrote it. The join page says the same
# ("פנייה מתאימה"); section 9 of the purchase terms is worded differently, and he decided
# on 6/10/2026 to leave the terms as they are.
REFUND = "אם אין פניות מתאימות בתוך 60 יום מקבלים החזר מלא."


def head():
    return HEAD.replace("%(logo)s", LOGO)


def foot(label):
    return '<div class="btn">' + label + ARROW + '</div><div class="url">mentalytics.co.il</div></body></html>'


def checks(lines):
    return "".join('<div class="check">' + TICK + '<span>' + c + '</span></div>' for c in lines)


def recruit():
    """Therapists: inquiries that fit the way you work. One diagram of the three steps a patient takes."""
    steps = ["הפונה עונה על שאלון", "מקבל המלצה על שיטת טיפול", "ורואה מטפלים שעובדים בה"]
    rows = ""
    for n, t in enumerate(steps, 1):
        last = n == len(steps)
        rows += ('<div style="display:flex;align-items:center;gap:26px;padding:11px 30px' +
                 (';border-top:2px solid var(--line)' if n > 1 else '') + '">'
                 '<div style="flex:none;width:64px;height:64px;border-radius:50%;background:' +
                 ("var(--gold)" if last else "var(--teal)") +
                 ';color:#fff;font-size:38px;font-weight:900;display:flex;align-items:center;justify-content:center">' + str(n) + '</div>'
                 '<div style="font-size:39px;font-weight:' + ("900" if last else "800") + ';color:' +
                 ("var(--text)" if last else "var(--text-2)") + '">' + t + '</div></div>')
    return head() + """
<div class="chip">פסיכולוג/ית · עו״ס · מטפל/ת</div>
<h1 style="font-size:78px">פניות שמתאימות<br><em>לשיטת הטיפול שלך.</em></h1>
<div class="card" style="width:100%;margin-top:26px;padding:6px 0">""" + rows + """</div>
<div style="width:100%;margin-top:6px">""" + checks([
        "שאלון שפיתחו פסיכולוגים וחוקרים",
        "מסלול חינמי, ומסלול מקודם",
    ]) + """</div>
<div style="font-size:30px;font-weight:700;color:var(--teal-dark);text-align:center;margin:18px 0 26px">""" + REFUND + """</div>
""" + foot("לפרטים והצטרפות")


def pair(a, b, fill, ink):
    pill = "font-size:58px;font-weight:900;line-height:1;border-radius:999px;padding:22px 44px;white-space:nowrap"
    return ('<div style="display:flex;align-items:center;justify-content:center">'
            '<div style="' + pill + ';background:' + fill + ';color:#fff;border:5px solid ' + fill + '">' + a + '</div>'
            '<div style="width:92px;height:9px;background:' + fill + ';opacity:.55"></div>'
            '<div style="' + pill + ';background:#fff;color:' + ink + ';border:5px solid ' + fill + '">' + b + '</div></div>')


def patients():
    """Patients: the sentence and the two pairs of the adults' promo video, and what the questionnaire is."""
    return head() + """
<h1 style="font-size:74px;margin-top:6px">זה לא עניין של מטפל<br>טוב או פחות טוב.<br><em>זה עניין של התאמה.</em></h1>
<div style="display:flex;flex-direction:column;gap:26px;margin-top:40px">""" + \
        pair("השיטה", "לקושי", "var(--teal)", "var(--teal-dark)") + \
        pair("המטפל", "לאדם", "var(--gold)", "var(--gold-dark)") + """</div>
<div style="width:100%;margin-top:30px">""" + checks([
        "שאלון חינמי ואנונימי, 2-4 דקות",
        "פותח על ידי פסיכולוגים קליניים וחוקרים",
        "מבוסס על מאות מחקרים",
    ]) + """</div>
""" + foot("למילוי השאלון")


FILES = {"fb-recruit-image": recruit, "fb-patients-image": patients}

if __name__ == "__main__":
    for name, build in FILES.items():
        p = os.path.join(W, name + ".html")
        io.open(p, "w", encoding="utf-8").write(build())
        out = os.path.join(W, name + ".png")
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--virtual-time-budget=8000",
                        "--allow-file-access-from-files", "--force-device-scale-factor=2",
                        f"--window-size={WIDTH},{HEIGHT}", f"--screenshot={out}", "file:///" + p.replace("\\", "/")],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
        # Re-encode with pixels only: no text chunks, nothing about the machine that made it.
        im = Image.open(out).convert("RGB")
        im.save(out, "PNG", optimize=True)
        os.remove(p)
        print(name, im.size)
