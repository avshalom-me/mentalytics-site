"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─── Homepage "output showcase": an auto-rotating phone mockup that walks
// through the four output screens (difficulty mapping → recommendations + AI
// note → matched therapists → the per-therapist AI explanation).
//
// The therapist names are deliberately playful (Freud/Jung) and the pane-4
// explanation text is a REAL output of /api/explain-match (generated once with
// a dummy questionnaire payload), so the demo shows exactly what the live
// system produces - including its two-paragraph structure and the disclaimer.
//
// Self-contained: markup + scoped styles (osw- prefix), no external deps.

const CYCLE_MS = 4600;
const PANES = 4;

const STEPS = [
  { t: "מיפוי הקשיים", d: "תמונה ברורה של מה שמעסיק אתכם - בלי תוויות" },
  { t: "המלצות + ניתוח אישי", d: "סוגי הטיפול שמתאימים לכם, מוסבר במילים פשוטות" },
  { t: "מטפלים מותאמים", d: "דירוג לפי התאמה מקצועית ואישיותית" },
  { t: "ניתוח AI אישי", d: "הסבר במילים פשוטות למה המטפל הותאם דווקא לך" },
];

export default function OutputShowcase() {
  const [idx, setIdx] = useState(0);
  // Bumped on every pane change - remounts the step progress bar so its CSS
  // animation restarts from zero.
  const [cycle, setCycle] = useState(0);
  const paused = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      if (!paused.current) {
        setIdx(i => (i + 1) % PANES);
        setCycle(c => c + 1);
      }
    }, CYCLE_MS);
  }, []);

  useEffect(() => {
    start();
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [start]);

  const goTo = (i: number) => {
    setIdx(i);
    setCycle(c => c + 1);
    start();
  };

  return (
    <section className="osw" aria-label="כך נראה הפלט של טיפול חכם">
      <style>{OSW_CSS}</style>

      <div className="osw-head">
        <span className="osw-eyebrow">כך זה נראה מבפנים</span>
        <h2>
          מהשאלון - עד <em>המטפל המתאים</em>
        </h2>
        <p>דוח אישי ברור, ניתוח מותאם, ורשימת מטפלים שמדורגת בדיוק בשבילך.</p>
      </div>

      <div className="osw-stage">
        {/* step captions */}
        <div className="osw-steps">
          {STEPS.map((s, i) => (
            <button
              key={s.t}
              type="button"
              className={`osw-step${i === idx ? " active" : ""}`}
              onClick={() => goTo(i)}
            >
              <span className="n">{i + 1}</span>
              <span className="t">{s.t}</span>
              <span className="d">{s.d}</span>
              {i === idx && <span className="prog" key={cycle} />}
            </button>
          ))}
        </div>

        {/* phone */}
        <div
          className="osw-phone-wrap"
          onMouseEnter={() => { paused.current = true; }}
          onMouseLeave={() => { paused.current = false; }}
        >
          <div className="osw-float f1"><span className="em">🔒</span>אנונימי לחלוטין</div>
          <div className="osw-float f2"><span className="em">📚</span>מבוסס מחקר</div>
          <div className="osw-float f3">
            <span className="big">93%</span>
            <span className="sm">התאמה<br />כוללת</span>
          </div>

          <div className="osw-phone">
            <div className="osw-island" />
            <div className="osw-screen">
              <div className="osw-statusbar"><span>9:41</span><span>𝄪 ⌁ ▮</span></div>
              <div className="osw-appbar">
                <b><span className="a">טיפול</span> <span className="b">חכם</span></b>
              </div>

              {/* pane 1: personal report */}
              <div className={`osw-pane${idx === 0 ? " active" : ""}`}>
                <div className="rise osw-doc-head">
                  <div>
                    <div className="ttl">הדוח האישי שלך</div>
                    <div className="date">נוצר עבורך · אנונימי</div>
                  </div>
                  <span className="osw-pdf-chip">📄 נשמר כ-PDF</span>
                </div>
                <div className="rise osw-mcard" style={{ marginBottom: "10px" }}>
                  <div className="osw-mcard-title">מיפוי תחומי הקושי</div>
                  {[
                    ["עומס רגשי ולחץ יומיומי", 78, ""],
                    ["שינה ורגיעה", 64, "g2"],
                    ["ריכוז והתמדה במטלות", 52, "g3"],
                    ["מתח סביב מערכות יחסים", 38, "g4"],
                  ].map(([label, w, g], k, arr) => (
                    <div className="osw-bar-row" key={label as string} style={k === arr.length - 1 ? { marginBottom: 2 } : undefined}>
                      <div className="lbl"><span>{label}</span><b>{w}%</b></div>
                      <div className="track"><div className={`fill ${g}`} style={{ ["--w" as string]: `${w}%` }} /></div>
                    </div>
                  ))}
                </div>
                <div className="rise osw-doc-note">
                  הדוח מתאר את מה ששיתפת - במילים פשוטות, בלי אבחנות ובלי תוויות. הוא שלך בלבד, וניתן לשמירה ולשיתוף עם מטפל.
                </div>
              </div>

              {/* pane 2: recommendations + AI note */}
              <div className={`osw-pane${idx === 1 ? " active" : ""}`}>
                <div className="rise osw-pane-title">ההמלצות שלך</div>
                <div className="rise osw-mcard osw-rec">
                  <span className="ico">🌱</span>
                  <span className="tx">
                    <span className="nm">טיפול רגשי בגישה דינמית</span><br />
                    <span className="fit">מתאים לעיבוד עומס רגשי מתמשך</span>
                  </span>
                  <span className="tag">✦ מומלץ ראשון</span>
                </div>
                <div className="rise osw-mcard osw-rec" style={{ marginBottom: "12px" }}>
                  <span className="ico">🧭</span>
                  <span className="tx">
                    <span className="nm">טיפול קוגניטיבי-התנהגותי (CBT)</span><br />
                    <span className="fit">כלים מעשיים לשינה ולריכוז</span>
                  </span>
                  <span className="tag t2">התאמה טובה</span>
                </div>
                <div className="rise osw-ai-panel">
                  <div className="osw-ai-head">
                    <span className="osw-ai-avatar">✦</span>
                    <span className="osw-ai-title">למה ההמלצה הזו?</span>
                    <span className="osw-ai-badge">ניתוח AI</span>
                  </div>
                  <p className="osw-ai-text">
                    מהתשובות שלך עולה תקופה עמוסה, שמורגשת גם בשינה וגם בריכוז. לצד זה בולטת{" "}
                    <span className="hl">מוטיבציה גבוהה לשינוי</span> - נקודת פתיחה מצוינת. טיפול רגשי ממוקד
                    יכול לעזור לתרגם אותה לכלים יומיומיים, בקצב שלך.
                  </p>
                </div>
              </div>

              {/* pane 3: matched therapists */}
              <div className={`osw-pane${idx === 2 ? " active" : ""}`}>
                <div className="rise osw-pane-title">המטפלים שהותאמו לך</div>
                <TherapistMiniCard
                  name="ד״ר זיגמונד פרויד"
                  meta="גבר • תל אביב והסביבה"
                  bio="פסיכולוג קליני. מתמחה בטיפול דינמי ובעיבוד רגשי מעמיק."
                  overall={93} prof={90} pers={97}
                />
                <TherapistMiniCard
                  name="ד״ר קרל יונג"
                  meta="גבר • אונליין"
                  bio="פסיכואנליטיקאי. עבודה עם דימויים, משמעות וכיוון אישי."
                  overall={89} prof={91} pers={86}
                />
              </div>

              {/* pane 4: the real AI explanation for one therapist */}
              <div className={`osw-pane osw-pane-last${idx === 3 ? " active" : ""}`}>
                <TherapistMiniCard
                  name="ד״ר זיגמונד פרויד"
                  meta="גבר • תל אביב והסביבה"
                  bio="פסיכולוג קליני. מתמחה בטיפול דינמי ובעיבוד רגשי מעמיק."
                  overall={93} prof={90} pers={97}
                  aiActive
                />
                <div className="rise osw-ai-panel" style={{ marginTop: "10px" }}>
                  <div className="osw-ai-head">
                    <span className="osw-ai-avatar">✦</span>
                    <span className="osw-ai-title">למה המטפל הזה הוצע לך</span>
                    <span className="osw-ai-badge">ניתוח AI</span>
                  </div>
                  {/* Verbatim output of /api/explain-match for a dummy questionnaire */}
                  <p className="osw-ai-text">
                    ד״ר זיגמונד פרויד מתמחה בטיפול פסיכודינמי, שהוא סוג הטיפול שהומלץ בשאלון שלך.
                    הוא בעל ניסיון בעיבוד רגשי מעמיק, מה שיכול לסייע בהתמודדות עם העומס הרגשי המתמשך,
                    בעיות השינה והקושי בריכוז ובהתמדה שהזכרת.
                  </p>
                  <p className="osw-ai-text" style={{ marginTop: "7px" }}>
                    ד״ר פרויד פעיל באזור תל אביב והסביבה, כך שתוכל להיפגש עמו פנים אל פנים. בנוסף, ישנה{" "}
                    <span className="hl">התאמה סגנונית גבוהה מאוד</span>, כך שסגנון העבודה שלו עשוי להתאים
                    לצרכים שלך. אם תבחר בטיפול, תוכל לצפות לתהליך מותאם אישית בקצב שמתאים לך.
                  </p>
                  <p className="osw-ai-note">ההתאמה מבוססת על תשובות השאלון ואינה מהווה אבחנה או המלצה בלעדית.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="osw-dots" role="tablist" aria-label="מסכי הדגמה">
        {STEPS.map((s, i) => (
          <button
            key={s.t}
            type="button"
            className={`osw-dot${i === idx ? " active" : ""}`}
            aria-label={`מסך ${i + 1}: ${s.t}`}
            onClick={() => goTo(i)}
          />
        ))}
      </div>

      <p className="osw-note">דמו להמחשה · השמות והנתונים להדגמה בלבד</p>
    </section>
  );
}

function TherapistMiniCard({
  name, meta, bio, overall, prof, pers, aiActive,
}: {
  name: string; meta: string; bio: string;
  overall: number; prof: number; pers: number;
  aiActive?: boolean;
}) {
  return (
    <div className="rise osw-tcard">
      <div className="row">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/avatar-male.svg" alt="" />
        <div className="info">
          <span className="nm">{name}</span><span className="vrf">✓ מאומת</span>
          <div className="mt">{meta}</div>
          <div className="bio2">{bio}</div>
        </div>
        <div className="osw-score-mini">
          <div className="n">{overall}<small>%</small></div>
          <div className="l">התאמה כוללת</div>
          <div className="dv" />
          <div className="s">מקצועי <b>{prof}%</b></div>
          <div className="s">אישיותי <b>{pers}%</b></div>
        </div>
      </div>
      <div className="tbtns">
        <span className="tb1">פרופיל מלא ←</span>
        <span className="tb2" style={aiActive ? { background: "var(--gold-pale)", borderColor: "var(--gold)" } : undefined}>
          <span className="sp">✦</span>למה הותאם לי?
        </span>
      </div>
    </div>
  );
}

const OSW_CSS = `
.osw{
  padding:100px 24px;position:relative;background:var(--surface);
  overflow-x:hidden;overflow-x:clip;
  display:flex;flex-direction:column;align-items:center;
}
.osw-head{text-align:center;max-width:620px;margin:0 auto 44px;}
.osw-eyebrow{display:inline-block;background:var(--teal-pale);color:var(--teal-dark);font-size:12.5px;font-weight:800;border-radius:50px;padding:4px 14px;margin-bottom:14px;}
.osw-head h2{font-size:clamp(1.9rem,3.2vw,3rem);font-weight:900;line-height:1.12;letter-spacing:-.02em;color:var(--text);}
.osw-head h2 em{font-style:normal;color:var(--teal);}
.osw-head p{color:var(--muted);font-size:16px;margin-top:10px;line-height:1.8;}

.osw-stage{display:flex;align-items:center;gap:56px;flex-wrap:wrap;justify-content:center;max-width:1080px;margin:0 auto;}

/* step captions */
.osw-steps{display:flex;flex-direction:column;gap:10px;width:260px;}
.osw-step{
  border:1px solid var(--line);border-radius:16px;background:white;
  padding:13px 16px;cursor:pointer;transition:.35s ease;position:relative;overflow:hidden;
  text-align:start;font-family:inherit;display:block;width:100%;
}
.osw-step .n{
  display:inline-flex;align-items:center;justify-content:center;
  width:22px;height:22px;border-radius:50%;background:var(--surface);color:var(--muted);
  font-size:12px;font-weight:800;margin-inline-end:8px;transition:.35s;vertical-align:1px;
}
.osw-step .t{font-size:14.5px;font-weight:800;color:var(--text-2);transition:.35s;}
.osw-step .d{display:block;font-size:12px;color:var(--faint);margin-top:2px;margin-inline-start:30px;line-height:1.5;}
.osw-step .prog{position:absolute;bottom:0;inset-inline-start:0;height:2.5px;width:0;background:linear-gradient(90deg,var(--teal),var(--gold));border-radius:2px;animation:oswProg ${CYCLE_MS}ms linear forwards;}
.osw-step.active{border-color:var(--teal-mid);background:var(--teal-pale);box-shadow:0 6px 18px rgba(42,100,98,.10);}
.osw-step.active .n{background:var(--teal);color:white;}
.osw-step.active .t{color:var(--teal-dark);}
.osw-step.active .d{color:var(--muted);}
@keyframes oswProg{from{width:0}to{width:100%}}

/* phone */
.osw-phone-wrap{position:relative;}
.osw-phone{
  width:308px;height:632px;border-radius:46px;background:#101c1b;
  padding:10px;box-shadow:0 30px 70px rgba(19,31,30,.28),0 4px 16px rgba(19,31,30,.14);
  position:relative;
}
.osw-island{position:absolute;top:22px;left:50%;transform:translateX(-50%);width:96px;height:26px;border-radius:50px;background:#101c1b;z-index:30;}
.osw-screen{position:relative;width:100%;height:100%;border-radius:37px;overflow:hidden;background:var(--surface);}
.osw-statusbar{position:absolute;top:0;left:0;right:0;height:44px;z-index:20;display:flex;align-items:center;justify-content:space-between;padding:14px 26px 0;font-size:12px;font-weight:700;color:var(--text);}
.osw-appbar{position:absolute;top:44px;left:0;right:0;height:44px;z-index:20;display:flex;align-items:center;justify-content:center;background:rgba(247,250,249,.92);border-bottom:1px solid var(--line);}
.osw-appbar b{font-size:14px;font-weight:900;}
.osw-appbar b .a{color:var(--teal);}
.osw-appbar b .b{color:var(--gold);}

.osw-pane{
  position:absolute;inset:0;padding:100px 14px 18px;overflow:hidden;
  opacity:0;transform:translateY(18px) scale(.985);transition:opacity .55s ease,transform .55s ease;
  pointer-events:none;
}
.osw-pane.active{opacity:1;transform:none;pointer-events:auto;}
.osw-pane-last{padding-top:92px;}
.osw-pane-title{font-size:15.5px;font-weight:900;margin-bottom:10px;}

.osw-pane .rise{opacity:0;transform:translateY(10px);transition:.5s ease;}
.osw-pane.active .rise{opacity:1;transform:none;}
.osw-pane.active .rise:nth-child(2){transition-delay:.08s}
.osw-pane.active .rise:nth-child(3){transition-delay:.16s}
.osw-pane.active .rise:nth-child(4){transition-delay:.24s}

.osw-mcard{background:white;border:1px solid var(--line);border-radius:14px;padding:12px;}
.osw-mcard-title{font-size:11px;font-weight:900;color:var(--teal-dark);margin-bottom:9px;}

/* pane 1 */
.osw-doc-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;}
.osw-doc-head .ttl{font-size:15.5px;font-weight:900;}
.osw-doc-head .date{font-size:10px;color:var(--faint);}
.osw-pdf-chip{display:inline-flex;align-items:center;gap:5px;background:white;border:1px solid var(--line);color:var(--muted);font-size:10px;font-weight:700;border-radius:50px;padding:3px 9px;}
.osw-bar-row{margin-bottom:11px;}
.osw-bar-row .lbl{display:flex;justify-content:space-between;font-size:11.5px;font-weight:700;color:var(--text-2);margin-bottom:4px;}
.osw-bar-row .lbl b{color:var(--teal-dark);font-weight:900;}
.osw-bar-row .track{height:8px;border-radius:50px;background:var(--surface);border:1px solid var(--line);overflow:hidden;}
.osw-bar-row .fill{height:100%;width:0;border-radius:50px;background:linear-gradient(90deg,var(--teal),var(--teal-dark));transition:width 1.1s cubic-bezier(.25,.9,.3,1) .25s;}
.osw-bar-row .fill.g2{background:linear-gradient(90deg,#4E9E9C,var(--teal));}
.osw-bar-row .fill.g3{background:linear-gradient(90deg,#7CC0BE,#4E9E9C);}
.osw-bar-row .fill.g4{background:linear-gradient(90deg,#A4D4D2,#7CC0BE);}
.osw-pane.active .fill{width:var(--w);}
.osw-doc-note{font-size:10.5px;color:var(--muted);background:var(--teal-pale);border-radius:10px;padding:8px 10px;line-height:1.5;}

/* pane 2 */
.osw-rec{display:flex;align-items:center;gap:10px;margin-bottom:9px;}
.osw-rec .ico{width:34px;height:34px;border-radius:10px;background:var(--teal-pale);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;}
.osw-rec .tx{flex:1;min-width:0;line-height:1.35;}
.osw-rec .nm{font-size:12.5px;font-weight:800;}
.osw-rec .fit{font-size:10.5px;color:var(--muted);}
.osw-rec .tag{font-size:9.5px;font-weight:800;border-radius:50px;padding:2px 8px;background:var(--gold-pale);color:var(--gold-dark);border:1px solid #EAD9B0;white-space:nowrap;}
.osw-rec .tag.t2{background:var(--teal-pale);color:var(--teal-dark);border-color:var(--teal-mid);}

/* AI panel */
.osw-ai-panel{background:var(--gold-pale);border-radius:13px;border-inline-start:3px solid var(--gold);padding:11px 12px;}
.osw-ai-head{display:flex;align-items:center;gap:7px;margin-bottom:6px;}
.osw-ai-avatar{width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,var(--teal),var(--gold));color:white;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;box-shadow:0 1px 4px rgba(168,112,16,.3);}
.osw-ai-title{font-size:11.5px;font-weight:900;color:var(--gold-dark);}
.osw-ai-badge{font-size:9px;font-weight:800;color:var(--gold-dark);background:white;border:1px solid #EAD9B0;border-radius:50px;padding:1px 7px;margin-inline-start:auto;}
.osw-ai-text{font-size:11.5px;color:var(--text-2);line-height:1.65;}
.osw-ai-text .hl{color:var(--teal-dark);font-weight:800;}
.osw-ai-note{font-size:9px;color:var(--faint);margin-top:8px;}

/* therapist mini cards */
.osw-tcard{background:white;border:1px solid var(--line);border-radius:14px;padding:11px;margin-bottom:10px;box-shadow:0 2px 10px rgba(19,31,30,.04);}
.osw-tcard .row{display:flex;gap:9px;align-items:stretch;}
.osw-tcard img{width:44px;height:44px;border-radius:11px;object-fit:cover;background:var(--teal-pale);align-self:flex-start;}
.osw-tcard .info{flex:1;min-width:0;}
.osw-tcard .nm{font-size:12.5px;font-weight:800;white-space:nowrap;}
.osw-tcard .vrf{display:inline-block;background:var(--teal-pale);color:var(--teal-dark);font-size:8.5px;font-weight:800;border-radius:50px;padding:1px 6px;margin-inline-start:5px;vertical-align:1px;}
.osw-tcard .mt{font-size:9.5px;color:var(--muted);margin-top:1px;}
.osw-tcard .bio2{font-size:9.5px;color:var(--text-2);margin-top:3px;line-height:1.45;}
.osw-score-mini{flex-shrink:0;width:64px;background:var(--teal-pale);border-radius:11px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6px 3px;text-align:center;}
.osw-score-mini .n{font-size:20px;font-weight:900;color:var(--teal-dark);line-height:1;}
.osw-score-mini .n small{font-size:10px;vertical-align:.35em;}
.osw-score-mini .l{font-size:7.5px;font-weight:800;color:var(--teal);margin-top:2px;}
.osw-score-mini .dv{width:60%;height:1px;background:var(--teal-mid);margin:4px 0 3px;}
.osw-score-mini .s{font-size:7.5px;color:var(--muted);}
.osw-score-mini .s b{color:var(--teal-dark);}
.osw-tcard .tbtns{display:flex;gap:6px;margin-top:8px;}
.osw-tcard .tb1{background:var(--teal);color:white;font-size:10px;font-weight:800;border-radius:50px;padding:5px 12px;}
.osw-tcard .tb2{background:white;color:var(--gold-dark);border:1px solid #EAD9B0;font-size:10px;font-weight:800;border-radius:50px;padding:5px 10px;display:inline-flex;align-items:center;gap:4px;}
.osw-tcard .tb2 .sp{width:13px;height:13px;border-radius:50%;background:linear-gradient(135deg,var(--teal),var(--gold));color:white;font-size:7px;display:inline-flex;align-items:center;justify-content:center;}

/* floating chips */
.osw-float{
  position:absolute;background:white;border:1px solid var(--line);border-radius:50px;
  box-shadow:0 10px 26px rgba(19,31,30,.12);padding:8px 15px;font-size:12.5px;font-weight:800;
  color:var(--text-2);white-space:nowrap;z-index:40;animation:oswBob 5.2s ease-in-out infinite;
}
.osw-float .em{margin-inline-end:5px;}
.osw-float.f1{top:52px;inset-inline-end:-74px;animation-delay:.3s;}
.osw-float.f2{bottom:150px;inset-inline-start:-92px;animation-delay:1.4s;}
.osw-float.f3{bottom:36px;inset-inline-end:-60px;animation-delay:2.4s;border-radius:16px;display:flex;align-items:center;gap:9px;padding:9px 14px;}
.osw-float.f3 .big{font-size:21px;font-weight:900;color:var(--teal-dark);line-height:1;}
.osw-float.f3 .sm{font-size:10px;color:var(--muted);font-weight:700;line-height:1.25;}
@keyframes oswBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}

/* dots */
.osw-dots{display:flex;gap:8px;justify-content:center;margin-top:28px;}
.osw-dot{width:8px;height:8px;border-radius:50px;background:var(--teal-mid);border:0;cursor:pointer;transition:.3s;padding:0;}
.osw-dot.active{width:26px;background:var(--teal);}
.osw-note{margin-top:14px;font-size:12px;color:var(--faint);text-align:center;}

/* mobile */
@media (max-width:860px){
  .osw{padding:80px 16px;}
  .osw-stage{gap:34px;}
  .osw-steps{display:grid;grid-template-columns:1fr 1fr;width:100%;max-width:420px;order:2;}
  .osw-step{padding:11px 12px;}
  .osw-step .t{font-size:13px;}
  .osw-step .d{display:none;}
  .osw-float{font-size:11px;padding:7px 12px;}
  .osw-float.f1{inset-inline-end:-8px;}
  .osw-float.f2{inset-inline-start:-8px;}
  .osw-float.f3{inset-inline-end:-6px;}
}

@media (prefers-reduced-motion: reduce){
  .osw-float{animation:none;}
  .osw-pane{transition:opacity .3s ease;transform:none;}
  .osw-pane .rise{transition:opacity .3s ease;transform:none;}
}
`;
