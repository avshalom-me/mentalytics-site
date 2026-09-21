# -*- coding: utf-8 -*-
"""Meta feed images for the September 2026 relaunch: two campaigns x two variants.

Patients (P-A contrast "not by a photo", P-B process "matching, not guessing") and
therapist recruitment (R-A direct benefit, R-B the failed-first-session question).
Rendered at 1080x1350 (4:5, the feed format) with a 2x device scale.

Rules baked in, from the July 2026 post-mortem and Meta's ad standards:
- Big headline, little text: the July carousels were too wordy to stop a scroll.
- No sentence may assert or imply the viewer's mental-health condition
  (Meta "Personal Attributes"), so the patient images talk about the service only.
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
 display:flex;flex-direction:column;align-items:center;padding:48px 76px 38px;position:relative}
.ring{position:absolute;border-radius:50%;border:34px solid;opacity:.55;pointer-events:none}
.logo{width:210px;height:auto;margin-bottom:26px}
.chip{display:inline-block;background:var(--gold-pale);color:var(--gold-dark);border:2px solid #F0DDB0;
 font-weight:800;font-size:30px;border-radius:50px;padding:10px 30px;margin-bottom:26px}
h1{font-weight:900;font-size:84px;line-height:1.1;text-align:center;letter-spacing:-1px}
h1 em{font-style:normal;color:var(--teal)}
.sub{font-size:36px;line-height:1.5;color:var(--text-2);text-align:center;margin-top:20px;margin-bottom:26px;font-weight:500}
.btn{margin-top:auto;background:var(--teal);color:#fff;font-weight:800;font-size:40px;border-radius:60px;
 padding:26px 70px;box-shadow:0 14px 30px rgba(42,100,98,.28);display:flex;align-items:center;gap:18px}
.url{margin-top:22px;font-size:30px;font-weight:800;color:var(--teal-dark);letter-spacing:.5px;direction:ltr}
.card{background:#fff;border:2px solid var(--line);border-radius:30px;box-shadow:0 22px 50px rgba(19,31,30,.12)}
.check{display:flex;align-items:center;gap:22px;background:#fff;border:2px solid var(--line);border-radius:60px;
 padding:16px 28px;font-size:31px;font-weight:700;color:var(--text-2);margin-top:14px;width:100%}
.check i{flex:none;width:46px;height:46px;border-radius:50%;background:var(--teal-pale);display:flex;align-items:center;justify-content:center}
</style></head><body>
<div class="ring" style="width:520px;height:520px;top:-210px;left:-190px;border-color:var(--teal-mid)"></div>
<div class="ring" style="width:420px;height:420px;bottom:-200px;right:-160px;border-color:#F3E3C0"></div>
<img class="logo" src="%(logo)s">"""

TICK = ('<i><svg width="26" height="26" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" '
        'stroke="#2A6462" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></i>')
ARROW = ('<svg width="34" height="34" viewBox="0 0 24 24"><path d="M19 12H5M11 6l-6 6 6 6" fill="none" '
         'stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>')


PORTRAITS = os.path.join(W, "portraits")
# The owner's own wording (21/9/2026). The refund line follows the purchase terms
# (section 9): a refund for the first two months only if no contact came in at all.
SUB_PATIENTS = "שאלון שנבנה ע״י פסיכולוגים וחוקרים. התאמת שיטת טיפול ומטפל/ת לפי הגישה המקצועית והאישית שמיועדת לך אישית."
SUB_RECRUIT = "שאלון שנבנה ע״י פסיכולוגים וחוקרים. התאמת שיטת טיפול ומטפל/ת לפי הגישה המקצועית."
CHIP_RECRUIT = "פסיכולוג/עו״ס/מטפלת רגשית?"
REFUND = "מסלול חינמי, ומסלול מקודם עם החזר אם אין פניות"


def face(name):
    return "file:///" + os.path.join(PORTRAITS, name + ".jpg").replace("\\", "/")


def foot(label):
    return '<div class="btn">' + label + ARROW + '</div><div class="url">mentalytics.co.il</div></body></html>'


def head():
    return HEAD.replace("%(logo)s", LOGO)


def photo(name, today):
    # "Today" faces are slightly muted: the row is the directory experience, not the product.
    filt = "filter:saturate(.55);opacity:.82;" if today else ""
    return ('<img src="' + face(name) + '" style="width:150px;height:150px;border-radius:22px;object-fit:cover;' + filt + '">')


def p_a():
    """Patients A: the contrast. How people pick today (a wall of photos) against a match."""
    photos = "".join(photo("grid-" + str(i), True) for i in (1, 2, 3, 4))
    match = """<div class="card" style="width:100%;padding:26px 30px;margin-top:22px;display:flex;align-items:center;gap:26px">
 <img src='""" + face("match") + """' style="flex:none;width:128px;height:128px;border-radius:24px;object-fit:cover">
 <div style="flex:1">
  <div style="font-size:36px;font-weight:900">המטפל/ת שהותאמ/ה לך</div>
  <div style="display:flex;gap:14px;margin-top:14px;flex-wrap:wrap">
   <span style="background:var(--teal-dark);color:#fff;border-radius:40px;padding:8px 22px;font-size:27px;font-weight:800">מקצועית 90%</span>
   <span style="background:#0E9F6E;color:#fff;border-radius:40px;padding:8px 22px;font-size:27px;font-weight:800">אישיותית 88%</span>
  </div></div></div>"""
    return head() + """
<h1 style="font-size:76px">פסיכולוג לא בוחרים<br><em>לפי תמונה.</em></h1>
<div style="width:100%;margin-top:26px">
 <div style="font-size:28px;font-weight:700;color:var(--faint);text-align:center;margin-bottom:14px">ככה בוחרים היום</div>
 <div style="display:flex;justify-content:center;gap:20px">""" + photos + """</div>
 <div style="text-align:center;margin:18px 0 0;font-size:28px;font-weight:800;color:var(--teal)">ככה בוחרים אצלנו</div>
 """ + match + """
</div>
<div class="sub" style="font-size:31px">""" + SUB_PATIENTS + """</div>
""" + foot("התחילו את השאלון")


def p_b(hook="מחפשים פסיכולוג?"):
    """Patients B: the process. Three steps, credibility first."""
    steps = [("1", "שאלון קצר ואנונימי", "בלי הרשמה ובלי פרטים מזהים"),
             ("2", "המלצה על סוג הטיפול", "לפי המחקר, עם הסבר במילים פשוטות"),
             ("3", "מטפלים מדורגים לפי התאמה", "מקצועית ואישיותית, כולם מורשים")]
    rows = ""
    for n, t, d in steps:
        bg = "var(--gold)" if n == "3" else "var(--teal)"
        rows += ('<div class="card" style="display:flex;align-items:center;gap:28px;padding:18px 30px;margin-top:14px;width:100%">'
                 '<div style="flex:none;width:84px;height:84px;border-radius:50%;background:' + bg +
                 ';color:#fff;font-size:44px;font-weight:900;display:flex;align-items:center;justify-content:center">' + n + '</div>'
                 '<div><div style="font-size:38px;font-weight:900">' + t + '</div>'
                 '<div style="font-size:29px;color:var(--muted);margin-top:4px;font-weight:500">' + d + '</div></div></div>')
    return head() + """
<div style="font-size:52px;font-weight:900;color:var(--gold-dark);text-align:center">""" + hook + """</div>
<h1 style="font-size:70px;margin-top:4px">התאמה מקצועית,<br><em>לא ניחוש.</em></h1>
<div style="width:100%;margin-top:26px">""" + rows + """</div>
<div class="sub" style="font-size:31px">""" + SUB_PATIENTS + """</div>
""" + foot("למילוי השאלון")


def r_a():
    """Recruitment A: the direct benefit. Rebuilt from the July ad A, with less text."""
    checks = "".join('<div class="check">' + TICK + '<span>' + c + '</span></div>' for c in (
        "פניות לפי שיטת הטיפול והסגנון שלך",
        "פרופיל מקצועי ונתוני צפיות ופניות",
        REFUND))
    return head() + """
<div class="chip">""" + CHIP_RECRUIT + """</div>
<h1 style="font-size:70px">מטופלים שמגיעים אלייך<br><em>אחרי התאמה,</em><br>לא אחרי תמונה.</h1>
<div style="width:100%;margin-top:30px">""" + checks + """</div>
<div class="sub" style="font-size:31px">""" + SUB_RECRUIT + """</div>
""" + foot("לפרטים והצטרפות")


def r_b():
    """Recruitment B: the question. Rebuilt from the July ad B, which drew more visits."""
    return head() + """
<div class="chip">""" + CHIP_RECRUIT + """</div>
<h1 style="font-size:70px;margin-top:4px">כמה שיחות ראשונות<br>נגמרות במשפט<br><em>״זה לא מתאים״?</em></h1>
<div class="card" style="width:100%;margin-top:34px;padding:30px 36px">
 <div style="font-size:36px;line-height:1.55;color:var(--text-2);font-weight:500;text-align:center">
  טיפול חכם מפנה אלייך מטופלים אחרי <b style="color:var(--teal-dark)">שאלון מקצועי</b> שמתאים בין הצורך שלהם לבין הגישה והאישיות שלך.</div>
</div>
<div class="check" style="margin-top:22px">""" + TICK + """<span>""" + REFUND + """</span></div>
<div class="sub" style="font-size:31px">""" + SUB_RECRUIT + """</div>
""" + foot("איך זה עובד")


FILES = {"fb-patients-a": p_a, "fb-patients-b": p_b,
         # Same ad with a hook that asks nothing of the viewer, in case Meta reads
         # "מחפשים פסיכולוג?" as implying a personal attribute and rejects the owner's version.
         "fb-patients-b-safe": lambda: p_b("איך מוצאים פסיכולוג?"),
         "fb-recruit-a": r_a, "fb-recruit-b": r_b}

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
