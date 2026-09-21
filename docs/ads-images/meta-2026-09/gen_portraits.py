# -*- coding: utf-8 -*-
"""AI-generated therapist portraits for the patients ads (21/9/2026, at the owner's request).

Five faces: four for the "how people choose today" row and one for the matched card.
They are illustrations only. None of them carries a name, a licence or any claim,
so no image presents a fictional person as a real listed therapist.

Reads OPENAI_API_KEY from the repo's .env.local. Run once; the ad generator (gen.py)
picks up whatever is in portraits/.
"""
import base64, json, os, urllib.request

W = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(W, "..", "..", ".."))
OUT = os.path.join(W, "portraits")
os.makedirs(OUT, exist_ok=True)


def key():
    for line in open(os.path.join(REPO, ".env.local"), encoding="utf-8"):
        if line.startswith("OPENAI_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"')
    raise SystemExit("OPENAI_API_KEY missing")


BASE = ("Professional headshot photograph of an Israeli psychotherapist, head and shoulders, "
        "looking at the camera, soft natural window light, plain light neutral background, "
        "realistic photo, shallow depth of field, no text, no logos, no jewellery that draws the eye. ")

PEOPLE = {
    "grid-1": "Woman in her late 30s, dark curly hair, friendly neutral expression, casual blouse.",
    "grid-2": "Man in his 50s, short grey beard, glasses, button-down shirt, calm expression.",
    "grid-3": "Woman in her 40s, straight brown hair tied back, light cardigan, slight smile.",
    "grid-4": "Man in his early 30s, short dark hair, clean shaven, knit sweater, neutral expression.",
    "match":  "Woman in her mid 40s, shoulder-length dark hair, warm genuine smile, approachable, "
              "soft green blouse, the kind of face you would trust in a first session.",
}


def generate(prompt):
    body = json.dumps({"model": "gpt-image-1", "prompt": BASE + prompt, "size": "1024x1024",
                       "quality": "medium", "n": 1}).encode()
    req = urllib.request.Request("https://api.openai.com/v1/images/generations", data=body,
                                 headers={"Authorization": "Bearer " + key(), "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return base64.b64decode(json.load(r)["data"][0]["b64_json"])


if __name__ == "__main__":
    for name, desc in PEOPLE.items():
        path = os.path.join(OUT, name + ".jpg")
        if os.path.exists(path):
            print("skip", name)
            continue
        import io as _io
        from PIL import Image
        Image.open(_io.BytesIO(generate(desc))).convert("RGB").resize((512, 512)).save(path, "JPEG", quality=88)
        print("ok", name)
