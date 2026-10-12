# -*- coding: utf-8 -*-
"""Carousel cards 2-4 of the patients' ad: three screens of the site itself.

The owner asked (12/10/2026) to follow the poster (fb-patients-image) with pictures "from the
site": the opening of the questionnaire, a result with a treatment, and the list of therapists
with the match percentages. They had to look like the site in every respect except the
therapists' names, which must not be real people's.

The pictures are not drawn here. They are crops of the screenshots taken for the adults' promo
video on 3/10/2026 (carousel-src/): the live site at a phone's width, 390px at 3x, with tracking
off and the therapist list answered with demo data, so nothing was written to the site's
numbers. The case is invented (a woman of 34, anxiety, reflective style, hence dynamic therapy)
and the two therapists carry the playful names the home page's own demo uses. A card on the site
whose therapist has no photo shows this same silhouette, so no face had to be made up either.

Rules:
- A crop only. Nothing is moved, joined or redrawn, and the page's own background fills the
  margins. Each cut falls in a gap of the page, never through a line of text.
- A therapist card says "דמו להמחשה", as the videos do next to the same list.
- Same size as the poster: 1080x1350 at a 2x device scale.

The first versions of cards 3 and 4 showed the report's summary and two therapists side by
side with their percentages. The owner then asked (12/10/2026) for the two explanations the
site writes, as the video shows them: "why was this suggested to me" under the treatment, and
"why was this therapist matched to me" on the therapist's card. Both speak to the reader about
anxiety, and Meta's "Personal Attributes" rule is about exactly that, an ad telling the viewer
what they suffer from; the risk was put to him. Each explanation is shown down to its own
caveat ("not a diagnosis"). The first versions are kept under their own names as the fallback.
"""
import io, os, subprocess
from PIL import Image

W = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(W, "carousel-src")
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
WIDTH, HEIGHT = 1080, 1350
SHOT_WIDTH = 1170  # the screenshots: 390 css px at 3x

PAGE = """<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
/* #F7FAF9 is the questionnaire's own page background, so the margins are more of the same page */
html,body{width:1080px;height:1350px;overflow:hidden;background:#F7FAF9;font-family:Heebo,sans-serif}
img{position:absolute;display:block}
.pill{position:absolute;top:13px;left:50%%;transform:translateX(-50%%);background:#EAF4F3;border:2px solid #C2DFDE;
 color:#2A6462;font-weight:700;font-size:26px;line-height:1;padding:9px 26px 10px;border-radius:50px;white-space:nowrap}
</style></head><body>
<img src="%(src)s" style="left:%(left).2fpx;top:%(top).2fpx;width:%(w).2fpx;height:%(h).2fpx">
%(pill)s
</body></html>"""

# name -> (screenshot, first row, last row, strip left above the crop, pill)
CARDS = {
    # The opening screen, down to the third promise ("only what is relevant").
    "fb-patients-carousel-2-quiz": ("a_open0.png", 30, 1650, 0, ""),
    # The finding with its treatment, and "why was this suggested to me" opened: both
    # paragraphs and the caveat under them.
    "fb-patients-carousel-3-report": ("a_report1.png", 2470, 4475, 0, ""),
    # One therapist: the match percentages, and "why was this therapist matched to me"
    # opened, down to its caveat.
    "fb-patients-carousel-4-therapists": ("a_list1.png", 1412, 3690, 56, "דמו להמחשה"),
    # The fallback, with neither explanation. The top of the report: the treatment, the
    # button that searches for it, and the summary (the page's top margin is 48px taller so
    # that the cut falls in the gap after the summary).
    "fb-patients-carousel-3-report-summary": ("a_report1.png", 0, 1562, 48, ""),
    # The first therapist in full and the second down to the match percentages.
    "fb-patients-carousel-4-therapists-list": ("a_list0.png", 1412, 3048, 60, "דמו להמחשה"),
}


def build(name):
    shot, y0, y1, strip, pill = CARDS[name]
    crop = os.path.join(W, name + ".crop.png")
    Image.open(os.path.join(SRC, shot)).convert("RGB").crop((0, y0, SHOT_WIDTH, y1)).save(crop, "PNG")
    scale = (HEIGHT - strip) / float(y1 - y0)
    w = SHOT_WIDTH * scale
    html = PAGE % {
        "src": "file:///" + crop.replace("\\", "/"),
        "left": (WIDTH - w) / 2, "top": strip, "w": w, "h": HEIGHT - strip,
        "pill": '<div class="pill">%s</div>' % pill if pill else "",
    }
    return html, crop


if __name__ == "__main__":
    for name in CARDS:
        html, crop = build(name)
        p = os.path.join(W, name + ".html")
        io.open(p, "w", encoding="utf-8").write(html)
        out = os.path.join(W, name + ".png")
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--virtual-time-budget=8000",
                        "--allow-file-access-from-files", "--force-device-scale-factor=2",
                        f"--window-size={WIDTH},{HEIGHT}", f"--screenshot={out}", "file:///" + p.replace("\\", "/")],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
        # Re-encode with pixels only: no text chunks, nothing about the machine that made it.
        im = Image.open(out).convert("RGB")
        im.save(out, "PNG", optimize=True)
        os.remove(p)
        os.remove(crop)
        print(name, im.size)
