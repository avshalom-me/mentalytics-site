# -*- coding: utf-8 -*-
"""Variant A, second round: the personal report as a flat card - no phone bezel, no dead
space - with the CBT row, the "why was this suggested" link and the download button.
Copy mirrors OutputShowcase.tsx (homepage mockup) so the ad shows the real product."""
import io, os, subprocess

W = os.path.dirname(os.path.abspath(__file__))
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

HEAD = """<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;700;800;900&display=swap" rel="stylesheet">
<style>
:root{--teal:#3D8C8A;--teal-dark:#2A6462;--teal-pale:#EAF4F3;--teal-mid:#C2DFDE;--gold:#D49018;--gold-dark:#A87010;--gold-pale:#FDF6E3;
--text:#131F1E;--text-2:#3E5250;--muted:#6B807E;--faint:#A2B5B4;--surface:#F7FAF9;--line:#DDE9E8;}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:%(w)dpx;height:%(h)dpx;overflow:hidden;font-family:Heebo,sans-serif;color:var(--text)}
body{background:radial-gradient(120%% 90%% at 50%% 0%%,#ffffff 0%%,var(--teal-pale) 55%%,#DCEDEC 100%%);display:flex;align-items:center;justify-content:center}
</style></head><body>"""

CARD_CSS = """
<style>
.wrap{zoom:%(zoom).3f}
.card{width:%(cw)dpx;border-radius:26px;background:var(--surface);border:1px solid var(--line);overflow:hidden;
  box-shadow:0 30px 70px rgba(19,31,30,.22),0 4px 16px rgba(19,31,30,.10)}
.appbar{height:42px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.7);border-bottom:1px solid var(--line)}
.appbar b{font-size:15px;font-weight:900}.appbar .a{color:var(--teal)}.appbar .b{color:var(--gold)}
.body{padding:14px 16px 16px}
.dochead{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.dochead .ttl{font-size:18px;font-weight:900}.dochead .date{font-size:10.5px;color:var(--faint);margin-top:1px}
.score{background:#fff;border:1px solid var(--line);border-radius:14px;box-shadow:0 8px 22px rgba(19,31,30,.10);display:flex;align-items:center;gap:8px;padding:6px 12px}
.score .big{font-size:21px;font-weight:900;color:var(--teal-dark);line-height:1}.score .sm{font-size:9.5px;color:var(--muted);font-weight:700;line-height:1.2}
.cols{display:grid;grid-template-columns:%(cols)s;gap:14px;align-items:start}
.mcard{background:#fff;border:1px solid var(--line);border-radius:14px;padding:13px 12px}
.mtitle{font-size:12px;font-weight:900;color:var(--teal-dark);margin-bottom:11px}
.row{margin-bottom:13px}.row:last-child{margin-bottom:2px}
.lbl{display:flex;justify-content:space-between;font-size:12.5px;font-weight:700;color:var(--text-2);margin-bottom:5px}
.lbl b{color:var(--teal-dark);font-weight:900;font-size:13px}
.track{height:12px;border-radius:50px;background:var(--surface);border:1px solid var(--line);overflow:hidden}
.fill{height:100%%;border-radius:50px;background:linear-gradient(90deg,var(--teal),var(--teal-dark))}
.fill.g2{background:linear-gradient(90deg,#4E9E9C,var(--teal))}.fill.g3{background:linear-gradient(90deg,#7CC0BE,#4E9E9C)}
.note{font-size:10.5px;color:var(--muted);background:var(--teal-pale);border-radius:10px;padding:8px 10px;line-height:1.5;margin-top:10px}
.sect{font-size:12px;font-weight:900;color:var(--teal-dark);margin:%(sectmt)dpx 2px 8px}
.rec{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:10px 12px;margin-bottom:8px}
.rec .ico{width:34px;height:34px;border-radius:10px;background:var(--teal-pale);display:flex;align-items:center;justify-content:center;flex:none}
.rec .ico svg{width:20px;height:20px}
.rec .tx{flex:1;min-width:0;line-height:1.35}.rec .nm{font-size:12.5px;font-weight:800;display:block}.rec .fit{font-size:10.5px;color:var(--muted)}
.rec .tag{font-size:9.5px;font-weight:800;border-radius:50px;padding:2px 8px;background:var(--gold-pale);color:var(--gold-dark);border:1px solid #EAD9B0;white-space:nowrap}
.rec .tag.t2{background:var(--teal-pale);color:var(--teal-dark);border-color:var(--teal-mid)}
.why{display:flex;align-items:center;gap:7px;background:var(--gold-pale);border-inline-start:3px solid var(--gold);border-radius:12px;padding:8px 11px;margin-top:2px}
.why .av{width:22px;height:22px;border-radius:50%%;background:linear-gradient(135deg,var(--teal),var(--gold));color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;flex:none;box-shadow:0 1px 4px rgba(168,112,16,.3)}
.why .t{font-size:12px;font-weight:900;color:var(--gold-dark);flex:1}
.why .bd{font-size:9px;font-weight:800;color:var(--gold-dark);background:#fff;border:1px solid #EAD9B0;border-radius:50px;padding:1px 7px;white-space:nowrap}
.dl{display:flex;align-items:center;justify-content:center;gap:8px;height:40px;border-radius:50px;background:var(--teal);color:#fff;font-size:13.5px;font-weight:900;margin-top:12px;box-shadow:0 8px 20px rgba(42,100,98,.28)}
.dl svg{width:17px;height:17px}
</style>"""

BARS = """
<div class="mcard"><div class="mtitle">מיפוי תחומי הקושי</div>
 <div class="row"><div class="lbl"><span>עומס רגשי ולחץ</span><b>78%</b></div><div class="track"><div class="fill" style="width:78%"></div></div></div>
 <div class="row"><div class="lbl"><span>שינה ורגיעה</span><b>64%</b></div><div class="track"><div class="fill g2" style="width:64%"></div></div></div>
 <div class="row"><div class="lbl"><span>ריכוז והתמדה</span><b>52%</b></div><div class="track"><div class="fill g3" style="width:52%"></div></div></div>
</div>
<div class="note">במילים פשוטות, בלי אבחנות ובלי תוויות. הדוח שלך בלבד.</div>"""

RECS = """
<div class="sect">ההמלצות שלך</div>
<div class="rec"><span class="ico"><svg viewBox="0 0 24 24"><path d="M12 21c-4-3.5-7-6.6-7-10a7 7 0 0 1 14 0c0 3.4-3 6.5-7 10z" fill="none" stroke="#3D8C8A" stroke-width="2"/><path d="M12 7v6M9.5 9.5h5" stroke="#3D8C8A" stroke-width="2" stroke-linecap="round"/></svg></span>
 <span class="tx"><span class="nm">טיפול רגשי בגישה דינמית</span><span class="fit">לעיבוד עומס רגשי מתמשך</span></span><span class="tag">&#x2726; מומלץ ראשון</span></div>
<div class="rec"><span class="ico"><svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.3 1 2.5h6c0-1.2.4-1.9 1-2.5A6 6 0 0 0 12 3z" fill="none" stroke="#3D8C8A" stroke-width="2" stroke-linejoin="round"/></svg></span>
 <span class="tx"><span class="nm">טיפול קוגניטיבי-התנהגותי (CBT)</span><span class="fit">כלים מעשיים לשינה ולריכוז</span></span><span class="tag t2">התאמה טובה</span></div>
<div class="why"><span class="av">&#x2726;</span><span class="t">למה הוצע לי הטיפול הזה?</span><span class="bd">ניתוח AI</span></div>
<div class="dl"><svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>דו"ח אישי להורדה</div>"""

def variant_a2(w, h, zoom, cw, two_col):
    cols = "1fr 1fr" if two_col else "1fr"
    html = (HEAD % dict(w=w, h=h)) + (CARD_CSS % dict(zoom=zoom, cw=cw, cols=cols, sectmt=0 if two_col else 14))
    html += """<div class="wrap"><div class="card">
<div class="appbar"><b><span class="a">טיפול</span> <span class="b">חכם</span></b></div>
<div class="body">
 <div class="dochead"><div><div class="ttl">הדוח האישי שלך</div><div class="date">נוצר עבורך · אנונימי</div></div>
  <div class="score"><span class="big">93%</span><span class="sm">התאמה<br>כוללת</span></div></div>
 <div class="cols"><div>""" + BARS + "</div><div>" + RECS + "</div></div>"
    html += "</div></div></div></body></html>"
    return html

FILES = {
  "A-report-1200x1200": variant_a2(1200, 1200, zoom=1.78, cw=430, two_col=False),
  "A-report-1200x628":  variant_a2(1200, 628,  zoom=1.52, cw=720, two_col=True),
}

for name, html in FILES.items():
    p = os.path.join(W, name + ".html")
    io.open(p, "w", encoding="utf-8").write(html)
    w, h = name.rsplit("-", 1)[1].split("x")
    out = os.path.join(W, name + ".png")
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--virtual-time-budget=6000",
                    f"--window-size={w},{h}", f"--screenshot={out}", "file:///" + p.replace("\\", "/")],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
    from PIL import Image
    im = Image.open(out); print(name, im.size)
