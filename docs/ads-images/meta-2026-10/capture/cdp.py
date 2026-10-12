"""Headless Chrome over CDP, at phone width, for capturing the live questionnaire.

Nothing a capture run does may reach the site's data:
  - the site's own analytics are switched off before any page script runs
    (localStorage mnt_no_track), and third-party tags are blocked at the network;
  - the score request is answered locally by the repo's own scoring function
    (score.mjs), so no free use is consumed and no research counter moves;
  - the match request is answered with demo therapists (handlers set by the caller);
  - any /api/track* request that still fires is swallowed and reported.
"""
import base64
import json
import os
import subprocess
import tempfile
import time
import urllib.request

import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PORT = 9341

BLOCKED = [
    "*googletagmanager.com*", "*google-analytics.com*", "*doubleclick.net*", "*googleadservices.com*",
    "*googlesyndication.com*", "*google.com/pagead*", "*google.com/ccm*", "*taboola.com*", "*clarity.ms*",
    "*facebook.net*", "*facebook.com/tr*", "*hotjar.com*", "*/_vercel/insights*", "*/_vercel/speed-insights*",
    "*vitals.vercel-insights.com*", "*va.vercel-scripts.com*",
]

profile = tempfile.mkdtemp(prefix="cdp_pvid_")
proc = subprocess.Popen(
    [CHROME, "--headless=new", f"--remote-debugging-port={PORT}", f"--user-data-dir={profile}",
     "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "--remote-allow-origins=*", "about:blank"],
    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
)

tabs = None
for _ in range(80):
    try:
        tabs = json.load(urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json"))
        if tabs:
            break
    except Exception:
        pass
    time.sleep(0.25)
page = [t for t in tabs if t.get("type") == "page"][0]
ws = websocket.create_connection(page["webSocketDebuggerUrl"], suppress_origin=True)
_id = 0
handlers = {}      # url substring -> fn(request) -> (status, dict) ; None lets the request through
swallowed = []     # tracking requests that fired despite the opt-out
seen_api = []      # every /api/ request the page made, for the run report


def _send(method, params=None):
    global _id
    _id += 1
    ws.send(json.dumps({"id": _id, "method": method, "params": params or {}}))
    return _id


def _on_paused(p):
    req = p["request"]
    url = req["url"]
    rid = p["requestId"]
    if "/api/" in url:
        seen_api.append(f'{req["method"]} {url.split("mentalytics.co.il")[-1][:90]}')
    if "/api/track" in url:
        swallowed.append(url)
        _send("Fetch.fulfillRequest", {"requestId": rid, "responseCode": 204, "responseHeaders": []})
        return
    for key, fn in handlers.items():
        if key in url:
            status, payload = fn(req)
            body = base64.b64encode(json.dumps(payload, ensure_ascii=False).encode("utf-8")).decode("ascii")
            _send("Fetch.fulfillRequest", {
                "requestId": rid, "responseCode": status,
                "responseHeaders": [{"name": "content-type", "value": "application/json; charset=utf-8"}],
                "body": body,
            })
            return
    _send("Fetch.continueRequest", {"requestId": rid})


def cmd(method, params=None):
    want = _send(method, params)
    while True:
        m = json.loads(ws.recv())
        if m.get("method") == "Fetch.requestPaused":
            _on_paused(m["params"])
            continue
        if m.get("id") == want:
            if "error" in m:
                raise RuntimeError(f"{method}: {m['error']}")
            return m.get("result", {})


def ev(expr):
    r = cmd("Runtime.evaluate", {"expression": expr, "awaitPromise": True, "returnByValue": True})
    if r.get("exceptionDetails"):
        raise RuntimeError(json.dumps(r["exceptionDetails"], ensure_ascii=False)[:900])
    return r.get("result", {}).get("value")


def wait_ready():
    for _ in range(160):
        if ev("document.readyState") == "complete":
            return
        time.sleep(0.25)


def wait_text(t, tries=120):
    for _ in range(tries):
        if ev("document.body && document.body.innerText.includes(%s)" % json.dumps(t)):
            return True
        time.sleep(0.25)
    raise RuntimeError("never saw: " + t)


def start(width=390, height=844, dpr=3):
    cmd("Page.enable")
    cmd("Runtime.enable")
    cmd("Network.enable")
    cmd("Network.setBlockedURLs", {"urls": BLOCKED})
    cmd("Emulation.setDeviceMetricsOverride", {"width": width, "height": height, "deviceScaleFactor": dpr, "mobile": True})
    cmd("Page.addScriptToEvaluateOnNewDocument", {"source": "try{localStorage.setItem('mnt_no_track','1')}catch(e){}"})
    cmd("Fetch.enable", {"patterns": [{"urlPattern": "*/api/*", "requestStage": "Request"}]})


def shot(path, clip):
    r = cmd("Page.captureScreenshot", {
        "format": "png", "captureBeyondViewport": True,
        "clip": {"x": clip["x"], "y": clip["y"], "width": clip["w"], "height": clip["h"], "scale": 1},
    })
    with open(path, "wb") as f:
        f.write(base64.b64decode(r["data"]))


def stop():
    try:
        ws.close()
    except Exception:
        pass
    proc.terminate()
