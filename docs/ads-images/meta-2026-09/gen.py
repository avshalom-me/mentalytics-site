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
 display:flex;flex-direction:column;align-items:center;padding:52px 80px 46px;position:relative}
.ring{position:absolute;border-radius:50%;border:34px solid;opacity:.55;pointer-events:none}
.logo{width:210px;height:auto;margin-bottom:26px}
.chip{display:inline-block;background:var(--gold-pale);color:var(--gold-dark);border:2px solid #F0DDB0;
 font-weight:800;font-size:30px;border-radius:50px;padding:10px 30px;margin-bottom:26px}
h1{font-weight:900;font-size:84px;line-height:1.1;text-align:center;letter-spacing:-1px}
h1 em{font-style:normal;color:var(--teal)}
.sub{font-size:36px;line-height:1.5;color:var(--text-2);text-align:center;margin-top:24px;margin-bottom:34px;font-weight:500}
.btn{margin-top:auto;background:var(--teal);color:#fff;font-weight:800;font-size:40px;border-radius:60px;
 padding:26px 70px;box-shadow:0 14px 30px rgba(42,100,98,.28);display:flex;align-items:center;gap:18px}
.url{margin-top:22px;font-size:30px;font-weight:800;color:var(--teal-dark);letter-spacing:.5px;direction:ltr}
.card{background:#fff;border:2px solid var(--line);border-radius:30px;box-shadow:0 22px 50px rgba(19,31,30,.12)}
.check{display:flex;align-items:center;gap:22px;background:#fff;border:2px solid var(--line);border-radius:60px;
 padding:20px 32px;font-size:34px;font-weight:700;color:var(--text-2);margin-top:18px;width:100%}
.check i{flex:none;width:46px;height:46px;border-radius:50%;background:var(--teal-pale);display:flex;align-items:center;justify-content:center}
</style></head><body>
<div class="ring" style="width:520px;height:520px;top:-210px;left:-190px;border-color:var(--teal-mid)"></div>
<div class="ring" style="width:420px;height:420px;bottom:-200px;right:-160px;border-color:#F3E3C0"></div>
<img class="logo" src="%(logo)s">"""

TICK = ('<i><svg width="26" height="26" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" '
        'stroke="#2A6462" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></i>')
ARROW = ('<svg width="34" height="34" viewBox="0 0 24 24"><path d="M19 12H5M11 6l-6 6 6 6" fill="none" '
         'stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>')


def foot(label):
    return '<div class="btn">' + label + ARROW + '</div><div class="url">mentalytics.co.il</div></body></html>'


def head():
    return HEAD.replace("%(logo)s", LOGO)


def silhouette(op):
    return ('<div style="width:132px;height:132px;border-radius:22px;background:#E6EEED;opacity:' + op +
            ';display:flex;align-items:flex-end;justify-content:center;overflow:hidden">'
            '<svg width="104" height="104" viewBox="0 0 24 24"><circle cx="12" cy="9" r="4.2" fill="#B7C9C7"/>'
            '<path d="M3.5 24c0-5 3.8-8.2 8.5-8.2S20.5 19 20.5 24z" fill="#B7C9C7"/></svg></div>')


def p_a():
    """Patients A: the contrast. How people pick today (a wall of photos) against a match."""
    photos = "".join(silhouette(o) for o in (".9", ".7", ".5", ".35"))
    match = """<div class="card" style="width:100%;padding:30px 34px;margin-top:26px;display:flex;align-items:center;gap:26px">
 <div style="flex:none;width:118px;height:118px;border-radius:24px;background:var(--teal-pale);display:flex;align-items:center;justify-content:center">
  <svg width="70" height="70" viewBox="0 0 24 24"><path d="M12 21s-7-4.4-7-10.2A4.3 4.3 0 0 1 12 8a4.3 4.3 0 0 1 7 2.8C19 16.6 12 21 12 21z" fill="none" stroke="#3D8C8A" stroke-width="2.2" stroke-linejoin="round"/></svg></div>
 <div style="flex:1">
  <div style="font-size:36px;font-weight:900">המטפל/ת שהותאמ/ה לך</div>
  <div style="display:flex;gap:14px;margin-top:14px;flex-wrap:wrap">
   <span style="background:var(--teal-dark);color:#fff;border-radius:40px;padding:8px 22px;font-size:27px;font-weight:800">מקצועית 90%</span>
   <span style="background:#0E9F6E;color:#fff;border-radius:40px;padding:8px 22px;font-size:27px;font-weight:800">אישיותית 88%</span>
   <span style="background:var(--teal-pale);color:var(--teal-dark);border-radius:40px;padding:8px 22px;font-size:27px;font-weight:800">&#x2713; מורשה</span>
  </div></div></div>"""
    return head() + """
<h1 style="font-size:80px">פסיכולוג לא בוחרים<br><em>לפי תמונה.</em></h1>
<div style="width:100%;margin-top:30px">
 <div style="font-size:28px;font-weight:700;color:var(--faint);text-align:center;margin-bottom:14px">ככה בוחרים היום</div>
 <div style="display:flex;justify-content:center;gap:22px">""" + photos + """</div>
 <div style="text-align:center;margin:18px 0 0;font-size:28px;font-weight:800;color:var(--teal)">ככה בוחרים אצלנו</div>
 """ + match + """
</div>
<div class="sub">שאלון שבנו פסיכולוגים קליניים מתאים מטפל/ת לפי הגישה המקצועית והאישיות.</div>
""" + foot("התחילו את השאלון")


def p_b():
    """Patients B: the process. Three steps, credibility first."""
    steps = [("1", "שאלון קצר ואנונימי", "בלי הרשמה ובלי פרטים מזהים"),
             ("2", "המלצה על סוג הטיפול", "לפי המחקר, עם הסבר במילים פשוטות"),
             ("3", "מטפלים מדורגים לפי התאמה", "מקצועית ואישיותית, כולם מורשים")]
    rows = ""
    for n, t, d in steps:
        bg = "var(--gold)" if n == "3" else "var(--teal)"
        rows += ('<div class="card" style="display:flex;align-items:center;gap:28px;padding:26px 32px;margin-top:20px;width:100%">'
                 '<div style="flex:none;width:84px;height:84px;border-radius:50%;background:' + bg +
                 ';color:#fff;font-size:44px;font-weight:900;display:flex;align-items:center;justify-content:center">' + n + '</div>'
                 '<div><div style="font-size:38px;font-weight:900">' + t + '</div>'
                 '<div style="font-size:29px;color:var(--muted);margin-top:4px;font-weight:500">' + d + '</div></div></div>')
    return head() + """
<h1>התאמה מקצועית,<br><em>לא ניחוש.</em></h1>
<div style="width:100%;margin-top:34px">""" + rows + """</div>
<div class="sub">נבנה על ידי פסיכולוגים קליניים. חינם ואנונימי.</div>
""" + foot("למילוי השאלון")


def r_a():
    """Recruitment A: the direct benefit. Rebuilt from the July ad A, with less text."""
    checks = "".join('<div class="check">' + TICK + '<span>' + c + '</span></div>' for c in (
        "פניות לפי שיטת הטיפול והסגנון שלך",
        "פרופיל מקצועי ונתוני צפיות ופניות",
        "מסלול חינמי, ומסלול מקודם עם החזר"))
    return head() + """
<div class="chip">לפסיכולוגים, עו״ס ומטפלים</div>
<h1 style="font-size:76px">מטופלים שמגיעים אלייך<br><em>אחרי התאמה,</em><br>לא אחרי תמונה.</h1>
<div style="width:100%;margin-top:36px">""" + checks + """</div>
""" + foot("לפרטים והצטרפות")


def r_b():
    """Recruitment B: the question. Rebuilt from the July ad B, which drew more visits."""
    return head() + """
<div class="chip">לפסיכולוגים, עו״ס ומטפלים</div>
<h1 style="font-size:78px;margin-top:10px">כמה שיחות ראשונות<br>נגמרות במשפט<br><em>״זה לא מתאים״?</em></h1>
<div class="card" style="width:100%;margin-top:44px;padding:36px 40px">
 <div style="font-size:36px;line-height:1.55;color:var(--text-2);font-weight:500;text-align:center">
  טיפול חכם מפנה אלייך מטופלים אחרי <b style="color:var(--teal-dark)">שאלון מקצועי</b> שמתאים בין הצורך שלהם לבין הגישה והאישיות שלך.</div>
</div>
<div class="sub" style="font-size:32px">נבנה על ידי פסיכולוג קליני, על בסיס מחקר וניסיון קליני.</div>
""" + foot("איך זה עובד")


FILES = {"fb-patients-a": p_a, "fb-patients-b": p_b, "fb-recruit-a": r_a, "fb-recruit-b": r_b}

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
