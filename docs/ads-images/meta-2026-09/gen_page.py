# -*- coding: utf-8 -*-
"""Profile picture and cover photo for the new Facebook Page (21/9/2026).

- page-profile.png: the real logo (public/logo-temp.png, cropped to its content),
  centred with padding so Facebook's circle crop never clips the lettering.
- page-cover.png: 1640x624 (2x the 820x312 desktop cover). Phones show a 16:9
  slice of the centre, so all text sits inside the middle ~1000px, and the
  bottom corners stay empty because the profile picture overlaps one of them.
"""
import io, os, subprocess
from PIL import Image

W = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(W, "..", "..", ".."))
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

# ---------- profile picture ----------
logo = Image.open(os.path.join(REPO, "public", "logo-temp.png")).convert("RGBA")
logo = logo.crop(logo.getbbox())
S = 1080
canvas = Image.new("RGB", (S, S), "#FFFFFF")
target_w = int(S * 0.70)  # 70% width keeps the wide logo inside the circle
ratio = target_w / logo.width
logo = logo.resize((target_w, int(logo.height * ratio)), Image.LANCZOS)
canvas.paste(logo, ((S - logo.width) // 2, (S - logo.height) // 2), logo)
canvas.save(os.path.join(W, "page-profile.png"), "PNG", optimize=True)
print("page-profile", canvas.size)

# ---------- cover ----------
HTML = """<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;800;900&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:820px;height:312px;overflow:hidden;font-family:Heebo,sans-serif}
body{background:radial-gradient(90% 140% at 50% 0%,#ffffff 0%,#F4F9F8 55%,#EAF4F3 100%);
 display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative}
.ring{position:absolute;border-radius:50%;border:16px solid;opacity:.5}
.tag{font-size:15px;font-weight:800;color:#A87010;letter-spacing:.3px;margin-bottom:10px}
h1{font-size:37px;font-weight:900;color:#131F1E;line-height:1.12;text-align:center}
h1 em{font-style:normal;color:#3D8C8A}
.sub{margin-top:12px;font-size:17px;font-weight:500;color:#3E5250;text-align:center}
.url{margin-top:10px;font-size:15px;font-weight:800;color:#2A6462;direction:ltr}
</style></head><body>
<div class="ring" style="width:300px;height:300px;top:-170px;left:-90px;border-color:#C2DFDE"></div>
<div class="ring" style="width:260px;height:260px;top:-150px;right:-110px;border-color:#F3E3C0"></div>
<div class="tag">מתאימים את החיבור הנכון</div>
<h1>פסיכולוג לא בוחרים <em>לפי תמונה.</em></h1>
<div class="sub">שאלון שנבנה ע״י פסיכולוגים וחוקרים · חינם ואנונימי</div>
<div class="url">mentalytics.co.il</div>
</body></html>"""

p = os.path.join(W, "_cover.html")
io.open(p, "w", encoding="utf-8").write(HTML)
out = os.path.join(W, "page-cover.png")
subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--virtual-time-budget=8000",
                "--force-device-scale-factor=2", "--window-size=820,312", f"--screenshot={out}",
                "file:///" + p.replace("\\", "/")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
Image.open(out).convert("RGB").save(out, "PNG", optimize=True)
os.remove(p)
print("page-cover", Image.open(out).size)

# ---------- intro post ("נעים להכיר"), 1080x1350 feed ----------
LOGO_URL = "file:///" + os.path.join(REPO, "public", "logo.png").replace("\\", "/")
INTRO = """<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;800;900&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1080px;height:1350px;overflow:hidden;font-family:Heebo,sans-serif;color:#131F1E}
body{background:radial-gradient(120% 80% at 50% 0%,#ffffff 0%,#F4F9F8 55%,#EAF4F3 100%);
 display:flex;flex-direction:column;align-items:center;padding:64px 80px 56px;position:relative}
.ring{position:absolute;border-radius:50%;border:34px solid;opacity:.55}
.logo{width:250px;margin-bottom:30px}
.chip{background:#FDF6E3;color:#A87010;border:2px solid #F0DDB0;font-weight:800;font-size:32px;border-radius:50px;padding:10px 34px;margin-bottom:26px}
h1{font-weight:900;font-size:86px;line-height:1.1;text-align:center;letter-spacing:-1px}
h1 em{font-style:normal;color:#3D8C8A}
.sub{font-size:36px;line-height:1.5;color:#3E5250;text-align:center;margin-top:26px;font-weight:500}
.row{display:flex;gap:18px;margin-top:40px;width:100%}
.c{flex:1;background:#fff;border:2px solid #DDE9E8;border-radius:28px;padding:26px 16px;text-align:center;box-shadow:0 18px 40px rgba(19,31,30,.10)}
.c b{display:block;font-size:34px;font-weight:900;color:#2A6462}
.c span{display:block;font-size:26px;color:#6B807E;margin-top:6px;font-weight:500}
.url{margin-top:auto;font-size:32px;font-weight:800;color:#2A6462;direction:ltr}
</style></head><body>
<div class="ring" style="width:520px;height:520px;top:-210px;left:-190px;border-color:#C2DFDE"></div>
<div class="ring" style="width:420px;height:420px;bottom:-200px;right:-160px;border-color:#F3E3C0"></div>
<img class="logo" src="%LOGO%">
<div class="chip">נעים להכיר</div>
<h1>עושים סדר<br><em>בדרך לטיפול.</em></h1>
<div class="sub">שאלון שנבנה ע״י פסיכולוגים וחוקרים, שממליץ על שיטת טיפול ומתאים מטפל/ת לפי התאמה מקצועית ואישיותית.</div>
<div class="row">
 <div class="c"><b>מבוגרים</b><span>שאלון אישי</span></div>
 <div class="c"><b>הורים</b><span>ילדים ובני נוער</span></div>
 <div class="c"><b>מטפלים</b><span>פניות מדויקות</span></div>
</div>
<div class="url">mentalytics.co.il</div>
</body></html>""".replace("%LOGO%", LOGO_URL)

p = os.path.join(W, "_intro.html")
io.open(p, "w", encoding="utf-8").write(INTRO)
out = os.path.join(W, "page-intro.png")
subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--virtual-time-budget=8000",
                "--allow-file-access-from-files", "--force-device-scale-factor=2", "--window-size=1080,1350",
                f"--screenshot={out}", "file:///" + p.replace("\\", "/")],
               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
Image.open(out).convert("RGB").save(out, "PNG", optimize=True)
os.remove(p)
print("page-intro", Image.open(out).size)
