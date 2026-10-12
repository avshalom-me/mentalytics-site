"""Walk the adults questionnaire once, as a fictional person whose difficulty is in her
relationships with others, and photograph the report and the therapist list.

Same method as capture_adults.py (the promo video, 3/10/2026): live site at phone width, 3x,
tracking off, the score answered locally by the repo's own function, the therapist list
answered with demo data. The case: emotional domain, a woman of 34, no low mood and no
worries, "a lasting inconsistency in how I manage my relationships" -> the personality
block -> "signs of difficulty in interpersonal relationships" -> dynamic therapy.

Output, next to this file and not committed: public/a_report0.png, a_report1.png, a_list0.png,
a_list1.png, public/case.json, and the texts of the report, the list and the two explanations.
The run ends by listing any word on those screens that carries anxiety or depression, which
the owner ruled out of the ad. a_report1 and a_list1 are then copied by hand to ../carousel-src/.

Needs: Chrome, Node 24 (score.mjs imports the scoring .ts directly), and the websocket-client
package. Two requests reach the site for real, both an AI call that stores nothing about the
visitor: /api/explain-recommendation and /api/explain-match.
"""
import io
import json
import os
import re
import subprocess
import sys
import time

sys.stdout.reconfigure(encoding="utf-8")

import cdp
from cdp import cmd, ev, wait_ready, wait_text

HERE = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.join(HERE, "public")
os.makedirs(PUB, exist_ok=True)
URL = "https://www.mentalytics.co.il/adults"
W, H = 390, 844
manifest = {}
FINDING = "נמצאו סימנים לקשיים בקשרים בין-אישיים"
BANNED = re.compile("חרד|דיכאו|דכאו")

DEMO_MATCHES = {
    "ok": True,
    "addiction_cbt_fallback": False,
    "matches": [
        {"id": "demo-1", "full_name": "ד״ר זיגמונד פרויד", "entity_type": "therapist", "profile_photo_url": None,
         "gender": "זכר", "online": False, "regions": ["גוש דן"], "in_requested_area": True,
         "bio": "פסיכולוג קליני. מתמחה בטיפול דינמי ובעיבוד רגשי מעמיק.",
         "public_title": "פסיכולוג קליני", "therapist_types": ["פסיכולוג קליני"], "training_areas": ["טיפול דינאמי"],
         "match_reasons": ["התאמה בתחום המומחיות: טיפול דינאמי", "התאמה מלאה באזור", "התאמה בקבוצת גיל"],
         "match_score": 90, "personality_score": 97, "combined_score": 93, "phone": "0500000000", "couples_modalities": []},
        {"id": "demo-2", "full_name": "ד״ר קרל יונג", "entity_type": "therapist", "profile_photo_url": None,
         "gender": "זכר", "online": True, "regions": ["גוש דן"], "in_requested_area": True,
         "bio": "פסיכואנליטיקאי. עבודה עם דימויים, משמעות וכיוון אישי.",
         "public_title": "פסיכואנליטיקאי", "therapist_types": ["פסיכולוג קליני"], "training_areas": ["טיפול דינאמי"],
         "match_reasons": ["התאמה בתחום המומחיות: טיפול דינאמי", "התאמה מלאה באזור", "התאמה בקבוצת גיל"],
         "match_score": 91, "personality_score": 86, "combined_score": 89, "phone": "0500000000", "couples_modalities": []},
    ],
}


def score_locally(req):
    body = req.get("postData") or "{}"
    out = subprocess.run(["node", os.path.join(HERE, "score.mjs")], input=body.encode("utf-8"),
                         capture_output=True, timeout=60)
    if out.returncode != 0:
        print("score.mjs failed:", out.stderr.decode("utf-8", "replace")[-600:])
        return 500, {"ok": False, "error": "local scoring failed"}
    result = json.loads(out.stdout.decode("utf-8"))
    print("  scored locally:", json.dumps([(r["symptomText"], r["treatmentLabel"]) for r in result["recommendations"]], ensure_ascii=False))
    with io.open(os.path.join(HERE, "answers_sent.json"), "w", encoding="utf8") as f:
        f.write(body)
    return 200, result


cdp.handlers["/api/questionnaire/adults/score"] = score_locally
cdp.handlers["/api/match"] = lambda req: (200, DEMO_MATCHES)

HELPERS = r"""
window.__q = (sel) => [...document.querySelectorAll(sel)];
window.__area = (e) => { const r = e.getBoundingClientRect(); return r.width * r.height; };
window.__txt = (e) => (e.innerText || e.textContent || '').trim();
window.__byText = (sel, t, mode) => { const m = __q(sel).filter(e => { const s = __txt(e); return mode === 'eq' ? s === t : mode === 'starts' ? s.startsWith(t) : s.includes(t); }); m.sort((a, b) => __area(a) - __area(b)); return m; };
window.__R = (el) => { const r = el.getBoundingClientRect(); return {x: Math.round((r.left + scrollX) * 10) / 10, y: Math.round((r.top + scrollY) * 10) / 10, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10}; };
window.__setVal = (el, v) => { const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', {bubbles: true})); };
window.__tidy = () => {
  document.querySelectorAll('header, footer, nav').forEach(e => { if (!e.closest('main')) e.style.display = 'none'; });
  [...document.querySelectorAll('body *')].forEach(e => { if (e.closest('main')) return; const s = getComputedStyle(e); if (s.position === 'fixed' || s.position === 'sticky') e.style.display = 'none'; });
  if (!document.getElementById('__cap_css')) { const st = document.createElement('style'); st.id = '__cap_css'; st.textContent = '.cta-pulse,.cta-pulse-soft,.animate-pulse{animation:none!important}'; document.head.appendChild(st); }
  window.scrollTo(0, 0);
  return 'ok';
};
'ok'
"""


def js(expr):
    return ev("(()=>{ %s })()" % expr)


def rect(sel, text, mode="includes"):
    r = js("const m = __byText(%s, %s, %s); return m.length ? JSON.stringify(__R(m[0])) : null;"
           % (json.dumps(sel), json.dumps(text), json.dumps(mode)))
    if not r:
        raise RuntimeError(f"no element for rect: {sel} / {text}")
    return json.loads(r)


def click(sel, text, mode="includes"):
    r = js("const m = __byText(%s, %s, %s); if (!m.length) return null; const R = JSON.stringify(__R(m[0])); m[0].click(); return R;"
           % (json.dumps(sel), json.dumps(text), json.dumps(mode)))
    if not r:
        raise RuntimeError(f"nothing to click: {sel} / {text}")
    return json.loads(r)


def settle(t=0.7):
    time.sleep(t)
    ev("document.fonts.ready.then(()=>'ok')")
    ev("__tidy()")
    time.sleep(0.15)


def snap(name, rects=None):
    settle(0.2)
    h = ev("Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, %d)" % H)
    cdp.shot(os.path.join(PUB, f"{name}.png"), {"x": 0, "y": 0, "w": W, "h": h})
    manifest[name] = {"w": W, "h": h, "rects": rects or {}}
    print(f"  {name}: {W}x{round(h)} css", {k: (round(v['y']), round(v['h'])) for k, v in (rects or {}).items()})


def scale_pick(row_index, value):
    r = js("""const grids = __q('main .scale-grid'); const g = grids[%d]; if (!g) return null;
      const b = [...g.querySelectorAll('button')].find(x => __txt(x) === %s); if (!b) return null;
      const R = JSON.stringify(__R(b)); b.click(); return R;""" % (row_index, json.dumps(str(value))))
    if not r:
        raise RuntimeError(f"scale row {row_index} / {value} not found")
    return json.loads(r)


def where():
    return ev("document.querySelector('main') ? document.querySelector('main').innerText.slice(0, 260) : ''").replace("\n", " | ")


try:
    cdp.start(W, H, 3)
    cmd("Page.navigate", {"url": URL})
    wait_ready()
    wait_text("נעזור לך למצוא")
    ev(HELPERS)
    print("opt-out flag:", ev("localStorage.getItem('mnt_no_track')"))
    settle(1.0)

    print("1 opening")
    js("__q('main label input[type=checkbox]')[0].click(); return 'ok';")
    settle(0.3)
    click("main button", "מתחילים", "starts")
    wait_text("בחר/י את התחומים"); settle()

    print("2 domains")
    click("main button", "מורכבויות בתחום הרגשי/האישי")
    settle(0.3)
    click("main button", "המשך", "starts")
    wait_text("עוד שתי שאלות כלליות"); settle()

    print("3 intake")
    js("__setVal(__q('main input[type=number]')[0], '34'); __setVal(__q('main select')[0], 'נקבה'); return 'ok';")
    settle(0.3)
    click("main button", "המשך", "starts")

    print("4 emotional block")
    wait_text("מצב רוח ירוד"); settle(0.4)
    click("main button", "לא", "eq")
    wait_text("מרומם או רוגזני"); settle(0.4)
    click("main button", "לא", "eq")
    wait_text("סמן/י את הרלוונטי"); settle(0.4)
    click("main button", "אף אחד מהמשפטים אינו מתאר אותי")
    wait_text("דאגות מתמשכות"); settle(0.4)
    click("main button", "לא", "eq")
    wait_text("הכרח לחשוב שוב ושוב"); settle(0.4)
    click("main button", "לא", "eq")
    wait_text("קשיים באחד מהבאים"); settle(0.4)
    click("main button", "איני חווה אף אחד מהקשיים האלה")
    wait_text("האם חווית בעבר"); settle(0.4)
    click("main button", "לא חוויתי אירוע טראומטי")
    wait_text("חוסר עקביות מתמשכת"); settle(0.4)
    click("main button", "כן", "eq")

    print("5 relationships block")
    wait_text("קשיים ניכרים בתפקוד היומיומי"); settle(0.5)
    scale_pick(0, 3)
    scale_pick(1, 3)
    settle(0.3)
    click("main button", "המשך", "starts")
    wait_text("קושי בהבנת כוונות חברתיות"); settle(0.5)
    n = js("const bs = __q('main button').filter(b => __txt(b) === 'לא'); bs.forEach(b => b.click()); return bs.length;")
    print("  'no' buttons pressed:", n)
    settle(0.3)
    click("main button", "המשך", "starts")
    wait_text("דרג/י כל היגד"); settle(0.5)
    rows = js("return __q('main .scale-grid').length;")
    print("  statements:", rows, "|", js("return __q('main .scale-grid').map(g => __txt(g.parentElement).split('\\n')[0]).join(' || ');"))
    for i, v in enumerate([4, 2, 4, 2, 2, 2][:rows]):
        scale_pick(i, v)
    settle(0.3)
    click("main button", "המשך", "starts")

    print("6 style")
    wait_text("שלוש שאלות על סגנון הטיפול"); settle()
    scale_pick(0, 5)
    scale_pick(1, 1)
    scale_pick(2, 2)
    settle(0.3)
    click("main button", "המשך", "starts")

    print("7 report")
    wait_text("דוח ממצאים", tries=200); settle(1.2)

    def report_rects():
        return {"top": json.loads(js("const p = __byText('main p', 'הממצא המרכזי', 'starts')[0]; return JSON.stringify(__R(p.parentElement));")),
                "summary": rect("main h2", "דוח ממצאים", "eq"),
                "finding": json.loads(js("const p = __byText('main p', %s)[0]; return JSON.stringify(__R(p.closest('.rounded-2xl')));" % json.dumps(FINDING)))}

    snap("a_report0", report_rects())
    report_text = ev("document.querySelector('#adults-results-card').innerText")
    print("  report text:", report_text[:600].replace("\n", " | "))
    click("main button", "למה הוצע לי")
    got = None
    for _ in range(160):
        got = js("const b = __q('main .border-purple-200')[0]; return b ? JSON.stringify(__R(b)) : null;")
        if got:
            break
        time.sleep(0.5)
    why_report = ""
    if got:
        time.sleep(0.8)
        rr = report_rects()
        rr["why_box"] = json.loads(js("const b = __q('main .border-purple-200')[0]; return JSON.stringify(__R(b));"))
        snap("a_report1", rr)
        why_report = ev("document.querySelector('main .border-purple-200').innerText")
        print("  explanation:", why_report)
    else:
        print("  !! the explanation never arrived")

    print("8 search + list")
    js("const p = __byText('main p', 'הממצא המרכזי', 'starts')[0]; p.parentElement.querySelector('button').click(); return 'ok';")
    wait_text("חיפוש מטפל עבור"); settle()
    js("__setVal(__q('main select')[0], 'גוש דן'); return 'ok';")
    settle(0.5)
    click("main button", "חפש/י מטפל", "starts")
    wait_text("מטפלים מומלצים"); settle(1.0)

    def list_rects():
        cards = json.loads(js("""const hs = __q('main h3'); return JSON.stringify(hs.map(h => { const card = h.closest('[class*="rounded-[18px]"]'); const sc = [...card.querySelectorAll('div')].find(d => /התאמה כוללת|התאמה מקצועית/.test(__txt(d)) && (d.className || '').includes('rounded-2xl')); return {name: __txt(h), card: __R(card), score: sc ? __R(sc) : null}; }));"""))
        r = {"heading": rect("main h2", "מטפלים מומלצים", "starts")}
        for i, c in enumerate(cards):
            r[f"card{i}"] = c["card"]
            if c["score"]:
                r[f"score{i}"] = c["score"]
        return r

    snap("a_list0", list_rects())
    WHY_BOX = "const b = __q('main div').filter(e => (e.className || '').includes('gold-pale') && /ניתוח AI/.test(__txt(e)))[0];"
    click("main button", "למה הותאמ/ה לי")
    got = None
    for _ in range(160):
        got = js(WHY_BOX + " return b ? JSON.stringify(__R(b)) : null;")
        if got:
            break
        time.sleep(0.5)
    why_match = ""
    if got:
        time.sleep(0.8)
        r2 = list_rects()
        r2["why_box"] = json.loads(js(WHY_BOX + " return JSON.stringify(__R(b));"))
        snap("a_list1", r2)
        why_match = js(WHY_BOX + " return __txt(b);")
        print("  therapist explanation:", why_match)
    else:
        print("  !! the therapist explanation never arrived")

    with io.open(os.path.join(PUB, "case.json"), "w", encoding="utf8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    io.open(os.path.join(HERE, "why_report.txt"), "w", encoding="utf8").write(why_report)
    io.open(os.path.join(HERE, "why_match.txt"), "w", encoding="utf8").write(why_match)
    io.open(os.path.join(HERE, "report_text.txt"), "w", encoding="utf8").write(report_text)
    list_text = ev("document.querySelector('main').innerText")
    io.open(os.path.join(HERE, "list_text.txt"), "w", encoding="utf8").write(list_text)
    for label, t in (("report page", report_text), ("report explanation", why_report), ("therapist list", list_text)):
        hits = sorted(set(m.group(0) for m in re.finditer(r"\S*(?:חרד|דיכאו|דכאו)\S*", t)))
        print(f"BANNED WORDS in {label}:", hits if hits else "none")
except Exception as exc:  # show where the walk stopped before the browser goes away
    print("!! stopped:", repr(exc))
    try:
        print("   on screen:", where())
    except Exception:
        pass
    raise
finally:
    print("api calls seen:")
    for line in dict.fromkeys(cdp.seen_api):
        print("   ", line)
    print("tracking requests swallowed:", len(cdp.swallowed), cdp.swallowed[:5])
    cdp.stop()
