"use client";

import { useState, useEffect } from "react";
import { ALL_REGIONS, REGION_CITIES, CITY_TO_REGION } from "@/app/lib/regions";

function trackClick(therapistId: string, clickType: "whatsapp" | "phone" | "email") {
  fetch("/api/track-click", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ therapist_id: therapistId, click_type: clickType, source: "match" }),
  }).catch(() => {});
}

// ── Types ────────────────────────────────────────────────────────────────────
type Ans = Record<string, any>;
type BoxCls = "info" | "warn" | "danger" | "purple" | "ok";
interface Box { cls: BoxCls; txt: string; isLowStress?: boolean; }

// ── Grade groups ─────────────────────────────────────────────────────────────
const GA_GRADES = ["פעוט","גן3","גן-טרום","גן","א"];
const BV_GRADES = ["ב","ג","ד","ה","ו"];
const ZY_GRADES = ["ז","ח","ט","י","יא","יב"];

function gg(A: Ans): "ga"|"bv"|"zy"|"" {
  const g = A._grade || "";
  if (GA_GRADES.includes(g)) return "ga";
  if (BV_GRADES.includes(g)) return "bv";
  if (ZY_GRADES.includes(g)) return "zy";
  const age = parseInt(A._age) || 0;
  if (age > 0 && age <= 7)  return "ga";
  if (age >= 8 && age <= 12) return "bv";
  if (age >= 13)             return "zy";
  return "";
}

function acadGg(A: Ans): "gan"|"ag"|"dv"|"zh"|"tyb" {
  const g = A._grade || "";
  if (["פעוט","גן3","גן-טרום","גן"].includes(g) || g.startsWith("גן")) return "gan";
  if (["א","ב","ג"].includes(g)) return "ag";
  if (["ד","ה","ו"].includes(g)) return "dv";
  if (["ז","ח"].includes(g)) return "zh";
  if (["ט","י","יא","יב"].includes(g)) return "tyb";
  const age = parseInt(A._age) || 0;
  if (age <= 6) return "gan";
  if (age <= 9) return "ag";
  if (age <= 12) return "dv";
  if (age <= 14) return "zh";
  return "tyb";
}

function devAgeOk(A: Ans): boolean {
  const age = parseInt(A._age) || 0;
  return (age > 0 && age < 7) || gg(A) === "ga";
}

// ── Page order ───────────────────────────────────────────────────────────────
const PAGES = [
  "p-consent","p-demo","p-areas",
  "p-q1","p-aq","p-aq-grade","p-q1-ga",
  "p-q2","p-q2-grade",
  "p-q3","p-mq","p-mq-sui",
  "p-q4","p-q4-types","p-q4-s","p-q4-g","p-q4-b","p-q4-ctrl",
  "p-q5","p-oq","p-oq-grade",
  "p-q6","p-tq",
  "p-q7","p-pq",
  "p-q8","p-eq",
  "p-q9","p-bq",
  "p-q10","p-q10-par","p-q10-grade",
  "p-ga-traits",
  "p-acad",
  "p-dev-toilet",
  "p-dev-sensory",
  "p-beh",
  "p-soc",
  "p-result",
] as const;
type PageId = (typeof PAGES)[number];

// ── Skip logic ───────────────────────────────────────────────────────────────
function skipPage(pid: string, A: Ans): boolean {
  const emoOn = ["מעט","הרבה","הרבה מאוד"].includes(A.a_emo || "");
  const emoPages = [
    "p-q1","p-aq","p-aq-grade","p-q2","p-q2-grade","p-q3","p-mq","p-mq-sui",
    "p-q4","p-q4-types","p-q4-s","p-q4-g","p-q4-b","p-q4-ctrl",
    "p-q5","p-oq","p-oq-grade","p-q6","p-tq","p-q7","p-pq","p-q8","p-eq",
    "p-q9","p-bq","p-q10","p-q10-par","p-q10-grade",
  ];
  if (emoPages.includes(pid) && !emoOn) return true;

  if (pid === "p-aq")         return (A.q1 || 0) < 4;
  if (pid === "p-aq-grade")   return (A.aq_tot || 0) < 14;
  if (pid === "p-q1-ga")      return gg(A) !== "ga" || (A.q1 || 0) < 4;
  if (pid === "p-q2-grade")   return (A.q2 || 0) < 4;
  if (pid === "p-mq")         return (A.q3 || 0) < 4;
  if (pid === "p-mq-sui")     return (A.mq_tot || 0) < 4;
  if (pid === "p-q4-types")   return A.q4 !== "כן";
  if (pid === "p-q4-s")       return !A.ad_s;
  if (pid === "p-q4-g")       return !A.ad_g;
  if (pid === "p-q4-b")       return !A.ad_b;
  if (pid === "p-q4-ctrl")    return A.q4 !== "כן";
  if (pid === "p-oq")         return A.q5 !== "כן";
  if (pid === "p-oq-grade")   return (A.oq_tot || 0) < 10;
  if (pid === "p-tq")         return A.q6 !== "כן";
  if (pid === "p-pq")         return A.q7 !== "כן";
  if (pid === "p-eq")         return A.q8 !== "כן";
  if (pid === "p-bq")         return A.q9 !== "כן";

  if (pid === "p-q10") {
    const anyPositive =
      (A.q1 || 0) >= 4 ||
      (A.q2 || 0) >= 4 ||
      ((A.q3 || 0) >= 4 && (A.mq_tot || 0) >= 4) ||
      (A.q4 === "כן" && ((A.add_s_tot||0)>=3||(A.add_g_tot||0)>=4||(A.add_b_tot||0)>=4||A.ad_o)) ||
      (A.q5 === "כן" && (A.oq_tot || 0) >= 10) ||
      (A.q6 === "כן" && (A.tq_tot || 0) >= 15) ||
      (A.q7 === "כן" && (A.pq_tot || 0) >= 2) ||
      (A.q8 === "כן" && ((A.eq_ano||0)>=2||(A.eq_bul||0)>=2)) ||
      (A.q9 === "כן" && (A.bq_tot || 0) >= 5);
    return anyPositive;
  }
  if (pid === "p-q10-par")   return A.q10 !== "כן";
  if (pid === "p-q10-grade") return A.q10_par !== "כן";

  if (pid === "p-acad") return !["מעט","הרבה","הרבה מאוד"].includes(A.a_aca || "");

  const devOn = ["מעט","הרבה","הרבה מאוד"].includes(A.a_dev || "");
  if (pid === "p-dev-toilet")  return !devOn || (!devAgeOk(A) && A.toilet !== "כן");
  if (pid === "p-dev-sensory") return !devOn || !devAgeOk(A);

  if (pid === "p-beh") return !["מעט","הרבה","הרבה מאוד"].includes(A.a_beh || "");
  if (pid === "p-soc") return !["מעט","הרבה","הרבה מאוד"].includes(A.a_soc || "");

  if (pid === "p-ga-traits") {
    if (gg(A) !== "ga") return true;
    if (A.ga_consent !== undefined) return true;
    const hasGaPositive =
      (A.q1||0)>=4 || (A.q2||0)>=4 ||
      ((A.q3||0)>=4 && (A.mq_tot||0)>=4) ||
      (A.q5==="כן" && (A.oq_tot||0)>=10) ||
      (A.q9==="כן" && (A.bq_tot||0)>=5) ||
      (A.q10==="כן" && A.q10_par==="כן");
    return !hasGaPositive;
  }
  return false;
}

// ── Navigation ───────────────────────────────────────────────────────────────
function nextPid(cur: string, A: Ans): string {
  let i = PAGES.indexOf(cur as PageId) + 1;
  while (i < PAGES.length && skipPage(PAGES[i], A)) i++;
  return i < PAGES.length ? PAGES[i] : "p-result";
}
function prevPid(cur: string, A: Ans): string {
  let i = PAGES.indexOf(cur as PageId) - 1;
  while (i >= 0 && skipPage(PAGES[i], A)) i--;
  return i >= 0 ? PAGES[i] : PAGES[0];
}

// ── Score updaters ────────────────────────────────────────────────────────────
function updAQ(A: Ans, k: string, v: number): Ans {
  const n = { ...A, [k]: v };
  n.aq_tot = ["aq1","aq2","aq3","aq4","aq5","aq6","aq7","aq8","aq9","aq10"]
    .reduce((s, x) => s + (n[x] || 0), 0);
  return n;
}
function updMQ(A: Ans, k: string, v: string): Ans {
  const n = { ...A, [k]: v };
  n.mq_tot = ["mq1","mq2","mq3","mq4","mq5","mq6","mq7","mq8","mq9"]
    .filter(x => n[x] === "כן").length;
  return n;
}
function updOQ(A: Ans, k: string, v: number): Ans {
  const n = { ...A, [k]: v };
  n.oq_tot = ["oq1","oq2","oq3","oq4","oq5","oq6"]
    .reduce((s, x) => s + (n[x] || 0), 0);
  return n;
}
function updTQ(A: Ans, k: string, v: number): Ans {
  const n = { ...A, [k]: v };
  n.tq_tot = ["tq1","tq2","tq3","tq4","tq5","tq6","tq7","tq8","tq9","tq10"]
    .reduce((s, x) => s + (n[x] || 0), 0);
  return n;
}
function updPQ(A: Ans, k: string, v: string): Ans {
  const n = { ...A, [k]: v };
  n.pq_tot = ["pq5","pq16","pq7","pq11","pq13","pq8"]
    .filter(x => n[x] === "כן").length;
  return n;
}
function updEQ(A: Ans, k: string, v: string): Ans {
  const n = { ...A, [k]: v };
  const age = parseInt(n._age) || 0;
  if (age === 0 || age < 12) {
    n.eq_ano = ["ea1","ea2","ea3","ea4"].filter(x => n[x] === "כן").length;
    n.eq_bul = ["ea5","ea6","ea7","ea8"].filter(x => n[x] === "כן").length;
  } else {
    n.eq_ano = ["eb1","eb2","eb3"].filter(x => n[x] === "כן").length;
    n.eq_bul = ["eb4","eb5","eb6","eb7"].filter(x => n[x] === "כן").length;
  }
  return n;
}
function updBQ(A: Ans, k: string, v: string): Ans {
  const n = { ...A, [k]: v };
  n.bq_tot = ["bq1","bq2","bq3","bq4","bq5","bq6","bq7"]
    .filter(x => n[x] === "כן").length;
  return n;
}
function updLSAS(A: Ans, k: string, v: number): Ans {
  const n = { ...A, [k]: v };
  let tot = 0;
  for (let i = 1; i <= 8; i++) tot += (n[`lsas_a${i}`] || 0);
  n.lsas_tot = tot;
  return n;
}
function computeBehPlan(A: Ans): Ans {
  function sev(v: string) { return v === "הרבה" ? 2 : v === "מעט" ? 1 : 0; }
  const s1 = sev(A.beh1||""), s2 = sev(A.beh2||""), s3 = sev(A.beh3||"");
  let ml = 0;
  if (s1===1) ml = Math.max(ml,1); if (s1===2) ml = Math.max(ml,2);
  if (s2===1) ml = Math.max(ml,3); if (s2===2) ml = Math.max(ml,4);
  if (s3===1) ml = Math.max(ml,5); if (s3===2) ml = Math.max(ml,6);
  const plan = ml===0 ? "" : ml<=3 ? "חיובי" : ml<=5 ? "חיובי_שלילי" : "חיובי_שלילי_פסיכולוגי";
  return { ...A, beh_max_level: ml, beh_plan: plan };
}
function updAddict(A: Ans, k: string, v: string, type: "s"|"g"|"b"): Ans {
  const n = { ...A, [k]: v };
  if (type === "s") n.add_s_tot = ["as1","as2","as3","as4","as5","as6"].filter(x => n[x]==="כן").length;
  if (type === "g") n.add_g_tot = ["ag1","ag2","ag3","ag4","ag5","ag6","ag7"].filter(x => n[x]==="כן").length;
  if (type === "b") n.add_b_tot = ["agl1","agl2","agl3","agl4","agl5","agl6","agl7"].filter(x => n[x]==="כן").length;
  return n;
}

// ── Shared referral helpers ───────────────────────────────────────────────────
function buildGaRef(A: Ans): string {
  const consent = A.ga_consent || "";
  const par     = A.ga_consent_parent || "";
  const lvl     = A.a_emo || "";
  if (consent === "לא") {
    return par === "לא"
      ? "✅ הפנייה: הדרכת הורים טיפולית"
      : "✅ הפנייה: הדרכת הורים טיפולית\n✅ הפנייה: טיפול דיאדי";
  }
  if (consent === "כן") {
    if (lvl === "הרבה מאוד") {
      return "✅ הפנייה: טיפול פסיכודינאמי ע\"י פסיכולוג קליני/חינוכי/התפתחותי או עו\"ס קליני בשילוב הדרכת הורים";
    }
    const ints: string[] = [];
    if (A.ga_int_art)    ints.push("אומנות");
    if (A.ga_int_music)  ints.push("מוזיקה");
    if (A.ga_int_move)   ints.push("תנועה");
    if (A.ga_int_drama)  ints.push("דרמה");
    if (A.ga_int_biblio) ints.push("ביבליותרפיה — סיפור");
    if (A.ga_int_garden) ints.push("גינון");
    if (A.ga_int_animal) ints.push("בע\"ח");
    let txt = "✅ הפנייה: טיפול בהבעה ויצירה";
    if (ints.length) txt += "\n📌 בעדיפות ל: " + ints.join(", ");
    return txt;
  }
  return "✅ הפנייה: הדרכת הורים טיפולית יחד עם תרפיה בהבעה ויצירה";
}

// Same referral logic as Q10 (general emotional difficulties) — grade-based
function buildQ10StyleRef(A: Ans): string {
  const grp = gg(A);
  if (grp === "ga") return buildGaRef(A);
  if (grp === "bv") {
    const m = A.soc_motiv_therapy || A.q10_mot || A.aq_mot_bv || 0;
    return m <= 2
      ? "✅ הפנייה: הדרכת הורים"
      : "✅ הפנייה לטיפול ע\"פ מאפייני הילד";
  }
  // zy
  const v2 = A.soc_verbal || A.q10_verbal || 0;
  let txt = v2 <= 2
    ? "✅ הפנייה: טיפול פסיכודינאמי + הדרכת הורים"
    : "✅ הפנייה: טיפול פסיכודינאמי";
  const ints: string[] = [];
  if (A.int_art)    ints.push("אומנות");
  if (A.int_music)  ints.push("מוזיקה");
  if (A.int_move)   ints.push("תנועה");
  if (A.int_drama)  ints.push("פסיכודרמה");
  if (A.int_biblio) ints.push("ביבליותרפיה");
  if (A.int_animal) ints.push("טיפול בבע\"ח");
  if (ints.length) txt += "\n📌 תחומי עניין: " + ints.join(", ");
  return txt;
}

// ── Compute results ───────────────────────────────────────────────────────────
function computeResults(A: Ans): Box[] {
  const grp = gg(A);
  const boxes: Box[] = [];
  const emoGroups: { symptoms: string[]; extraBoxes: Box[]; referral: string }[] = [];
  const emoStandalones: Box[] = [];

  function getGaRef(): string { return buildGaRef(A); }

  function addToGroup(symptomTxt: string, referralTxt: string, extraBoxes: Box[]) {
    const existing = emoGroups.find(g => g.referral === referralTxt);
    if (existing) {
      existing.symptoms.push(symptomTxt);
      existing.extraBoxes.push(...extraBoxes);
    } else {
      emoGroups.push({ symptoms: [symptomTxt], extraBoxes, referral: referralTxt });
    }
  }

  // Q1 — חרדה
  if ((A.q1 || 0) >= 4) {
    const aqTot = A.aq_tot || 0;
    const extras: Box[] = [];
    if (A.q1_pain === "כן") {
      if (A.q1_med_clear === "לא")
        extras.push({ cls:"warn", txt:"⚠️ דווח על כאבים כרוניים — יש לפנות לרופא משפחה לשלילת גורם רפואי לפני הטיפול" });
      else if (!A.q1_med_clear)
        extras.push({ cls:"warn", txt:"⚠️ דווח על כאבים כרוניים — מומלץ לשלול גורם רפואי לפני הטיפול" });
    }
    if (aqTot >= 14) {
      let ref = "";
      if (grp === "ga") {
        ref = getGaRef();
      } else if (grp === "bv") {
        const m = A.aq_mot_bv || 0;
        if (m === 1) ref = "✅ הפנייה: הדרכת הורים טיפולית";
        else if (m === 2) ref = "✅ הפנייה: הדרכת הורים טיפולית יחד עם תרפיה בהבעה ויצירה";
        else {
          if (aqTot <= 20) {
            const v = A.aq_verbal_bv || 0;
            ref = v <= 2
              ? "✅ הפנייה: הדרכת הורים טיפולית יחד עם תרפיה בהבעה ויצירה"
              : "✅ הפנייה: טיפול CBT לטיפול בחרדה בשילוב הדרכת הורים";
          } else {
            const p = A.aq_prac_bv || 0;
            ref = p <= 2
              ? "✅ הפנייה: טיפול פסיכודינאמי בשילוב הדרכת הורים"
              : "✅ הפנייה: טיפול CBT לטיפול בחרדה בשילוב הדרכת הורים";
          }
        }
      } else {
        if (aqTot > 13) {
          const m = A.aq_mot_zy || 0, p = A.aq_prac || 0;
          ref = m === 1
            ? "✅ הפנייה: הדרכת הורים טיפולית"
            : p <= 2
              ? "✅ הפנייה: טיפול פסיכודינאמי בשילוב הדרכת הורים"
              : "✅ הפנייה: טיפול CBT בשילוב הדרכת הורים";
        }
      }
      addToGroup("📊 נמצאו סימנים לחרדה", ref, extras);
    } else {
      emoStandalones.push({ cls:"purple", txt:"📊 נמצאו סימפטומים של מתח ברמה נמוכה", isLowStress: true });
      extras.forEach(e => emoStandalones.push(e));
    }
    emoStandalones.push({ cls:"info", txt:
      "📌 כלים ופרקטיקות להפחתת מתח בילדים ונוער:\n\n" +
      "🟢 קרקוע: לבקש מהילד/ה לומר 5 דברים שרואים מולם. 4 דברים שאפשר לגעת בהם. 3 דברים ששומעים. 2 דברים שאפשר להריח. 1 דבר שאפשר לטעום.\n\n" +
      "🟢 נשימות: לדמיין ניפוח בועת סבון — נשימה עמוקה דרך האף, ונשיפה איטית מהפה (כדי לא לפוצץ את הבועה).\n\n" +
      "🟢 שגרה: להפחית אי-ודאות. ליצור לוח יומי עם ציורים או סמלים של סדר היום. לסקור אותו בבוקר ובערב יחד עם הילד.\n\n" +
      "🟢 פינת מרגוע: ליצור מקום רגוע להתמודדות עם מתח. לכלול: צעצועים להפגת מתחים, כדור לחיץ, חוברות צביעה ועוד. חשוב לשתף את הילד בבחירת התכנים.\n\n" +
      "🟢 פעילות גופנית: הליכה, ריקוד, או משחק בחוץ — מסייע בהפחתת הורמון המתח (קורטיזול) ומשפר שינה וריכוז."
    });
  }

  // Q2 — דימוי עצמי
  if ((A.q2 || 0) >= 4) {
    let ref = "";
    if (grp === "ga") ref = getGaRef();
    else if (grp === "bv") {
      const m = A.q2_mot || 0;
      ref = m <= 1
        ? "✅ הפנייה: הדרכת הורים טיפולית"
        : "✅ הפנייה: טיפול פסיכודינאמי בשילוב הדרכת הורים";
    } else {
      ref = "✅ הפנייה: טיפול פסיכודינאמי בשילוב הדרכת הורים";
    }
    addToGroup("📊 נמצאו סימנים לדימוי עצמי נמוך", ref, []);
  }

  // Q3 — מצב רוח ירוד
  if ((A.q3 || 0) >= 4 && (A.mq_tot || 0) >= 4) {
    const extras: Box[] = [];
    if (A.q3_sui === "כן")
      extras.push({ cls:"danger", txt:"🚨 דווח על מחשבות אובדניות — נדרשת הערכת סיכון דחופה" });
    let ref = grp === "ga" ? getGaRef() : "✅ הפנייה: טיפול פסיכודינאמי";
    addToGroup("📊 נמצאו סימנים למצב רוח ירוד", ref, extras);
  }

  // Q4 — התמכרות
  if (A.q4 === "כן") {
    const s = A.add_s_tot || 0, g2 = A.add_g_tot || 0, b = A.add_b_tot || 0;
    const addSyms: string[] = [];
    if (s >= 3) addSyms.push("📊 נמצאו סימנים להתמכרות לחומרים");
    if (g2 >= 4) addSyms.push("📊 נמצאו סימנים להתמכרות למשחקי מחשב");
    if (b >= 4) { const sv = b >= 8 ? "חמורה" : b >= 6 ? "בינונית" : "קלה"; addSyms.push("📊 נמצאו סימנים להתמכרות להימורים — " + sv); }
    if (A.ad_o) addSyms.push("📊 דווח על התמכרות אחרת — יש לפרט");
    if (addSyms.length) {
      const ctrl = A.q4_ctrl || 5;
      let ref = grp === "ga"
        ? "✅ הפנייה: הדרכת הורים טיפולית"
        : grp === "bv"
          ? (ctrl <= 1 ? "✅ הפנייה: הדרכת הורים" : "✅ הפנייה: טיפול CBT בהתמכרויות")
          : "✅ הפנייה: טיפול CBT מומחה בהתמכרויות";
      addToGroup(addSyms.join("\n"), ref, []);
    }
  }

  // Q5 — OCD
  if (A.q5 === "כן" && (A.oq_tot || 0) >= 10) {
    const sv = (A.oq_tot || 0) >= 15 ? "משמעותיים" : "קלים-בינוניים";
    const significant = (A.oq_tot || 0) >= 15;
    let ref = grp === "ga"
      ? getGaRef()
      : significant
        ? "✅ הפנייה: טיפול CBT בשילוב הדרכת הורים + בשילוב צוות בית הספר במידת הצורך"
        : "✅ הפנייה: טיפול CBT בשילוב הדרכת הורים";
    addToGroup("📊 נמצאו סימנים " + sv + " להתנהגויות אובססיביות-קומפולסיביות", ref, []);
  }

  // Q6 — טראומה (standalone)
  if (A.q6 === "כן" && (A.tq_tot || 0) >= 15) {
    let txt = "📊 נמצאו סימנים לקשיי עיבוד לאחר אירוע טראומטי";
    const clusters: string[] = [];
    if ([A.tq1,A.tq2,A.tq3].some(x => (x||0) >= 2)) clusters.push("חודרנות");
    if ([A.tq4,A.tq5].some(x => (x||0) >= 2))       clusters.push("הימנעות");
    if ([A.tq6,A.tq7].some(x => (x||0) >= 2))       clusters.push("שינוי קוגניציה ומצב רוח");
    if ([A.tq8,A.tq9,A.tq10].some(x => (x||0) >= 2)) clusters.push("עוררות ותגובתיות");
    if (clusters.length) txt += "\nאשכולות: " + clusters.join(", ");
    emoStandalones.push({ cls:"purple", txt });
    emoStandalones.push({ cls:"info", txt:'✅ הפנייה לטיפול בטראומה (EMDR / CPT) ע"י פסיכולוג/עו"ס קליני' });
  }

  // Q7 — פרודרום (standalone)
  if (A.q7 === "כן" && (A.pq_tot || 0) >= 2) {
    emoStandalones.push({ cls:"warn", txt:"📊 דווחו חוויות חושיות או קוגניטיביות החורגות מהרגיל — מומלץ להעריך" });
    emoStandalones.push({ cls:"info", txt:"✅ הפנייה לפסיכולוג קליני או פסיכיאטר להערכה" });
  }

  // Q8 — הפרעות אכילה (standalone)
  if (A.q8 === "כן") {
    const ano = A.eq_ano || 0, bul = A.eq_bul || 0;
    if (ano >= 2 || bul >= 2) {
      emoStandalones.push({ cls:"purple", txt:"📊 נמצאו קשיים בתחום האכילה" });
      emoStandalones.push({ cls:"info",   txt:'✅ הפנייה לטיפול ע"פ מאפייני הילד + דיאטנית קלינית מומחית' });
    }
  }

  // Q9 — ויסות/BPD
  if (A.q9 === "כן" && (A.bq_tot || 0) >= 5) {
    let ref = grp === "ga" ? getGaRef() : "✅ הפנייה לטיפול DBT פרטני/קבוצתי";
    addToGroup("📊 נמצאו סימנים לקשיי ויסות על רקע קשרים בינאישיים", ref, []);
  }

  // Q10 — קשיים כלליים
  if (A.q10 === "כן" && A.q10_par === "כן") {
    let ref = "";
    if (grp === "ga") {
      ref = getGaRef();
    } else if (grp === "bv") {
      const m = A.q10_mot || 0;
      ref = m <= 2 ? "✅ הפנייה: הדרכת הורים" : "✅ הפנייה לטיפול ע\"פ מאפייני הילד";
    } else {
      const v2 = A.q10_verbal || 0;
      let txt = v2 <= 2
        ? "✅ הפנייה: טיפול פסיכודינאמי + הדרכת הורים"
        : "✅ הפנייה: טיפול פסיכודינאמי";
      const ints: string[] = [];
      if (A.int_art)    ints.push("אומנות");
      if (A.int_music)  ints.push("מוזיקה");
      if (A.int_move)   ints.push("תנועה");
      if (A.int_drama)  ints.push("פסיכודרמה");
      if (A.int_biblio) ints.push("ביבליותרפיה");
      if (A.int_animal) ints.push("טיפול בבע\"ח");
      if (ints.length) txt += "\n📌 תחומי עניין: " + ints.join(", ");
      ref = txt;
    }
    addToGroup("📊 נמצאו קשיים רגשיים כלליים", ref, []);
  }

  // ── BV merge: Q1+Q2+Q3 all positive → combined referral ──────────────────
  if (grp === "bv") {
    const q1p = (A.q1||0)>=4 && (A.aq_tot||0)>=14;
    const q2p = (A.q2||0)>=4;
    const q3p = (A.q3||0)>=4 && (A.mq_tot||0)>=4;
    if (q1p && q2p && q3p) {
      const combinedRef = "✅ הפנייה: טיפול פסיכודינאמי בשילוב CBT בשילוב הדרכת הורים";
      const bvLabels = ["📊 נמצאו סימנים לחרדה","📊 נמצאו סימנים לדימוי עצמי נמוך","📊 נמצאו סימנים למצב רוח ירוד"];
      const mergedExtras: Box[] = [];
      const mergedSymptoms: string[] = [];
      for (let i = emoGroups.length - 1; i >= 0; i--) {
        const g = emoGroups[i];
        if (g.symptoms.some(s => bvLabels.includes(s))) {
          mergedSymptoms.unshift(...g.symptoms);
          mergedExtras.unshift(...g.extraBoxes);
          emoGroups.splice(i, 1);
        }
      }
      if (mergedSymptoms.length)
        emoGroups.unshift({ symptoms: mergedSymptoms, extraBoxes: mergedExtras, referral: combinedRef });
    }
  }

  // ── Dedup by therapy base ─────────────────────────────────────────────────
  function therapyBase(r: string): string {
    return (r || "")
      .replace(/^✅ הפנייה:\s*/, "").replace(/^✅ /, "")
      .replace(/\s*בשילוב הדרכת הורים.*/, "")
      .replace(/\s*\+\s*הדרכת הורים.*/, "")
      .trim();
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < emoGroups.length && !changed; i++) {
      for (let j = i + 1; j < emoGroups.length && !changed; j++) {
        const bi = therapyBase(emoGroups[i].referral || "");
        const bj = therapyBase(emoGroups[j].referral || "");
        if (bi && bj && bi === bj) {
          const ri = emoGroups[i].referral || "", rj = emoGroups[j].referral || "";
          const strongerRef = ri.includes("הדרכת הורים") ? ri
            : rj.includes("הדרכת הורים") ? rj
            : ri.length >= rj.length ? ri : rj;
          const merged = {
            symptoms: [...emoGroups[i].symptoms, ...emoGroups[j].symptoms],
            extraBoxes: [...emoGroups[i].extraBoxes, ...emoGroups[j].extraBoxes],
            referral: strongerRef,
          };
          emoGroups.splice(j, 1);
          emoGroups.splice(i, 1);
          emoGroups.unshift(merged);
          changed = true;
        }
      }
    }
  }

  // ── Multiple-referral notice ──────────────────────────────────────────────
  const allEmoRefs = new Set<string>();
  emoGroups.forEach(g => { if (g.referral) allEmoRefs.add(g.referral); });
  emoStandalones.forEach(s => { if (!s.isLowStress && s.txt?.startsWith("✅")) allEmoRefs.add(s.txt); });
  if (allEmoRefs.size > 1)
    boxes.push({ cls:"warn", txt:"⚠️ נמצאו מספר הפניות רגשיות. יש לבחור את ההפנייה הכי דחופה עבורכם." });

  // ── Output emoGroups ──────────────────────────────────────────────────────
  emoGroups.forEach(grp2 => {
    grp2.extraBoxes.forEach(e => boxes.push(e));
    boxes.push({ cls:"purple", txt: grp2.symptoms.join("\n") });
    if (grp2.referral) boxes.push({ cls:"info", txt: grp2.referral });
  });

  // ── Low-stress standalone ─────────────────────────────────────────────────
  const lowStress    = emoStandalones.filter(s => s.isLowStress);
  const otherStands  = emoStandalones.filter(s => !s.isLowStress);
  const hasAnyTherapy =
    emoGroups.some(g => g.referral?.includes("טיפול")) ||
    emoStandalones.some(s => s.txt?.startsWith("✅") && s.txt.includes("טיפול") && !s.isLowStress);
  lowStress.forEach(s => boxes.push(s));
  if (lowStress.length > 0 && !hasAnyTherapy && emoGroups.length === 0)
    boxes.push({ cls:"info", txt:"✅ הפנייה: טיפול פסיכודינאמי" });
  otherStands.forEach(s => boxes.push(s));

  return boxes;
}

// ── Compute academic results ──────────────────────────────────────────────────
function computeAcadResults(A: Ans): Box[] {
  if (!["מעט","הרבה","הרבה מאוד"].includes(A.a_aca || "")) return [];
  const ga = acadGg(A);
  const boxes: Box[] = [];
  function box(cls: BoxCls, txt: string) { boxes.push({ cls, txt }); }

  function emitADHD(inatt: number, hyper: number) {
    const pi = inatt >= 3, ph = hyper >= 3;
    const syms: string[] = [];
    if (pi) syms.push("📊 ישנם סימנים לקשיי ריכוז וקשב");
    if (ph) syms.push("📊 ישנם סימנים לקשיים בתחום ההיפראקטיביות/אימפולסיביות");
    if (syms.length) box("purple", syms.join("\n"));
    if (pi || ph) {
      box("info", "✅ יש לפנות לנוירולוג/רופא ילדים המומחה בקשיי קשב");
      if (pi) box("info", "✅ ישנם סימנים לקשיים בפונקציות הניהוליות — יש לפנות לטיפול/אימון מסוג Cog-Fun");
    }
    return pi || ph;
  }

  // ── גן ──────────────────────────────────────────────────────────────────────
  if (ga === "gan") {
    const yesCount = ["gan_q1","gan_q2","gan_q3","gan_q4","gan_q5"].filter(k => A[k] === "כן").length;
    if (yesCount === 0) return boxes;
    box("purple", "📚 נמצאו קשיים לימודיים — גן");
    if (A.gan_q1 === "כן") {
      if (A.gan_q1_speech === "כן") box("info","✅ קשיים בזיהוי אותיות/מספרים — יש לחזור לקלינאית תקשורת לטיפול נוסף\n✅ יש לפנות לפסיכולוג הגן לבחינת שעות שילוב");
      else box("warn","⚠️ קשיים בזיהוי אותיות/מספרים — יש לבחון פנייה לקלינאית תקשורת + פסיכולוג הגן");
      box("info","📌 כלים: אפליקציות לימוד קריאה, שירים, לוח מגנטי, ציור אותיות, פלסטלינה, ספירת חפצים");
    }
    if (A.gan_q2 === "כן") {
      if (A.gan_q2_speech === "כן") box("info","✅ קשיים שפתיים — יש לחזור לקלינאית תקשורת לטיפול נוסף");
      else box("warn","⚠️ קשיים בזכירת צורות/צבעים — יש לבחון פנייה לקלינאית תקשורת");
    }
    if (A.gan_q3 === "כן") box("info","📌 קשיי מודעות פונולוגית — כלים: שירים וחרוזים, \"צליל פותח של היום\", קלפי תמונות, משחקי חריזה");
    if (A.gan_q4 === "כן") box("warn","⚠️ קשיים בביטוי עצמי ואוצר מילים — מומלץ להפנות לקלינאית תקשורת להערכה");
    if (A.gan_q5 === "כן") {
      if (A.gan_q5_ot === "כן") box("info","✅ קשיים מוטוריים — יש לחזור למרפאה בעיסוק לטיפול נוסף");
      else { box("warn","⚠️ קשיים באחזקת עיפרון/ציור — יש לבחון פנייה לריפוי בעיסוק"); box("info","📌 כלים: טושים עבים, פלסטלינה, גזירה לפי קווים, השלחת חרוזים"); }
    }
    if (yesCount >= 4) box("danger","🚨 ניכרים סימפטומים משמעותיים בגן — יש לפנות להיוועצות עם הגננת ופסיכולוג הגן לגבי התאמת המסגרת");
    else if (yesCount === 3) box("warn","⚠️ 3 קשיים לימודיים — מומלץ לבדוק צורך בוועדת זכאות של החינוך המיוחד");
    return boxes;
  }

  // ── א-ג ─────────────────────────────────────────────────────────────────────
  if (ga === "ag") {
    const read  = A.ag_read  || "לא";
    const write = A.ag_write === "כן";
    const comp  = A.ag_comp  === "כן";
    const math  = A.ag_math  || "לא";
    const histYes = ["ag_h1","ag_h2","ag_h3","ag_h4","ag_h5","ag_h6"].filter(k => A[k] === "כן").length;
    const inatt = ["ag_ad1","ag_ad2","ag_ad3","ag_ad4","ag_ad5","ag_ad6"].filter(k => A[k]).length;
    const hyper = ["ag_ah1","ag_ah2","ag_ah3","ag_ah4","ag_ah5","ag_ah6"].filter(k => A[k]).length;
    const adhdPos = inatt >= 3 || hyper >= 3;
    if (read === "לא" && !write && !comp && math === "לא") return boxes;

    const toolsChizuk = "📌 תוכנית חיזוקים — כלים לסיוע בלמידה בכיתה ובבית:\n1. משוב חיובי קבוע — שבחים פשוטים על הצלחה קטנה, עידוד להמשיך ולנסות, מיקוד במאמצים ולא רק בתוצאות.\n2. שילוב תרגילים להרפיה ומדיטציה קלה (נשימות עמוקות, הרפיית שרירים, דמיון מודרך) לפני פעילות לימודית מאתגרת.\n3. התאמת ההוראה לצרכים הייחודיים — בניית מטלות המאפשרות התקדמות בקצב אישי, עם הצלחות קטנות ומדורגות.\n4. למידה בקבוצות קטנות או בעזרת עמיתים.";
    const toolsMath = "📌 כלים לחיזוק חשבון:\nא. שיפור הבנה בסיסית: פירוק משימות לשלבים, שימוש בדוגמאות מחיי היומיום, המחשה בשרטוטים ודיאגרמות.\nב. פיתוח אסטרטגיות: קוד צבעים בנוסחאות, למידה בקבוצות קטנות, הצגת בעיות בדרכים שונות.\nג. כלים טכנולוגיים:\n   • Math Land — משחק הרפתקאות עם תרגילי חשבון ברמות שונות (בתשלום)\n   • Pet Bingo — בינגו חוויתי עם תרגילי חיבור/חיסור/כפל/חילוק (חינמי)";

    const syms: string[] = [];
    const refs: string[] = [];
    const tools: string[] = [];
    function addSym(s: string) { if (!syms.includes(s)) syms.push(s); }
    function addRef(r: string) { if (!refs.includes(r)) refs.push(r); }
    function addTool(t: string) { if (!tools.includes(t)) tools.push(t); }

    if (read !== "לא") {
      addSym("נמצאו סימנים לקשיי קריאה");
      if (A.ag_h6 === "כן") addRef("יש לפנות לקלינאית תקשורת (קושי/לקות בדיבור)");
      if (histYes === 0) {
        const motiv = A.ag_read_motiv;
        if (motiv === "כן") { addRef("יש לבחון פנייה לקלינאית תקשורת"); }
        else if (motiv === "לא") {
          addRef("יש לבנות תוכנית חיזוקים"); addTool(toolsChizuk);
          const mot = (A.ag_mot1||1)+(A.ag_mot2||1)+(A.ag_mot3||1);
          if (mot > 5) { addRef("נמצאו קשיים רגשיים מול למידה — יש להפנות לטיפול פסיכודינאמי"); }
          else { if (!emitADHD(inatt, hyper)) addRef("הפנייה לאבחון פסיכודידקטי"); }
        }
      } else if (histYes >= 1 && histYes <= 2) {
        const speech = A.ag_read_speech;
        if (speech === "כן") {
          const smotiv = A.ag_speech_motiv;
          if (smotiv === "כן") { addRef("יש לבנות תוכנית חיזוקים — במידה ולא מקבל שעות שילוב יש לבחון פנייה לוועדת שילוב"); }
          else if (smotiv === "לא") {
            addRef("יש לבנות תוכנית חיזוקים — במידה ולא מקבל שעות שילוב יש לבחון פנייה לוועדת שילוב"); addTool(toolsChizuk);
            const smot = (A.ag_smot1||1)+(A.ag_smot2||1)+(A.ag_smot3||1);
            if (smot > 5) { addRef("נמצאו קשיים רגשיים מול למידה — יש להפנות לטיפול פסיכודינאמי"); }
            else { if (!emitADHD(inatt, hyper)) addRef("הפנייה לאבחון פסיכודידקטי"); }
          }
        } else if (speech === "לא") { addRef("יש לבחון פנייה לקלינאית תקשורת"); }
      } else if (histYes >= 3) {
        addRef("הפנייה לאבחון פסיכודידקטי"); addRef("יש לבחון פנייה לריפוי בעיסוק");
      }
      if (histYes >= 5) {
        const mot = (A.ag_mot1||1)+(A.ag_mot2||1)+(A.ag_mot3||1);
        if (mot > 5) { addRef("נמצאו קשיים רגשיים מול למידה — יש להפנות לטיפול פסיכודינאמי"); addTool(toolsChizuk); }
      }
    }
    if (write) {
      addSym("נמצאו סימנים לקשיי כתיבה");
      if (read !== "לא") addRef("נראה שיש שילוב של מספר קשיים — יש לפנות לאבחון פסיכו-דידקטי");
      else { if (A.ag_write_ot === "כן") addRef("קשיי כתיבה — יש לחזור לבדיקה אצל מרפאה בעיסוק"); else addRef("קשיי כתיבה — יש לבחון פנייה לריפוי בעיסוק"); }
    }
    if (comp) {
      addSym("נמצאו סימנים לקשיי הבנה בשיעור");
      if (!(read !== "לא" || adhdPos)) addRef("הפנייה לאבחון פסיכודידקטי");
    }
    if (math !== "לא") {
      addSym("נמצאו סימנים לקשיי חשבון");
      if (math === "5%") { addRef("נמצאו קשיים בחשבון:\nא. יש לשקול מתן סיוע פרטני דרך בית הספר או באופן פרטי.\nב. במידה ולא נראה שיפור משמעותי — הפנייה לאבחון פסיכודידקטי."); addTool(toolsMath); }
      else if (math === "10%") { addRef("נמצאו קשיים בחשבון:\nיש לשקול מתן סיוע פרטני דרך בית הספר או באופן פרטי."); addTool(toolsMath); }
      else if (math === "30%") { addRef("נמצאו קשיים בחשבון: יש לשקול מתן סיוע פרטני."); addTool(toolsMath); }
    }
    if (syms.length || refs.length || tools.length) {
      box("purple", "📚 נמצאו קשיים לימודיים — כיתות א-ג");
      if (syms.length) box("purple", syms.map(s => "📊 " + s).join("\n"));
      refs.forEach(r => box("info", "✅ " + r));
      tools.forEach(t => box("info", t));
    }
    return boxes;
  }

  // ── ד-ו ─────────────────────────────────────────────────────────────────────
  if (ga === "dv") {
    const read    = A.dv_read === "כן";
    const histYes = ["dv_h1","dv_h2","dv_h3","dv_h4","dv_h5"].filter(k => A[k] === "כן").length;
    const write   = A.dv_write === "כן";
    const comp    = A.dv_comp  === "כן";
    const math    = A.dv_math  || "לא";
    const adhdQ2yn = A.dv_adhd_yn === "כן";
    const inattQ2 = ["dv_ad1","dv_ad2","dv_ad3","dv_ad4","dv_ad5","dv_ad6"].filter(k => A[k]).length;
    const hyperQ2 = ["dv_ah1","dv_ah2","dv_ah3","dv_ah4","dv_ah5","dv_ah6"].filter(k => A[k]).length;
    const inattR  = ["dv_read_ad1","dv_read_ad2","dv_read_ad3","dv_read_ad4","dv_read_ad5","dv_read_ad6"].filter(k => A[k]).length;
    const hyperR  = ["dv_read_ah1","dv_read_ah2","dv_read_ah3","dv_read_ah4","dv_read_ah5","dv_read_ah6"].filter(k => A[k]).length;
    const adhdPosQ2 = inattQ2 >= 3 || hyperQ2 >= 3;
    const adhdAny   = adhdPosQ2 || inattR >= 3 || hyperR >= 3;
    if (!read && !adhdQ2yn && !write && !comp && math === "לא") return boxes;

    const toolsChizuk = "📌 תוכנית חיזוקים — כלים לסיוע בלמידה בכיתה ובבית:\n1. משוב חיובי קבוע — שבחים פשוטים על הצלחה קטנה, עידוד להמשיך ולנסות, מיקוד במאמצים ולא רק בתוצאות.\n2. שילוב תרגילים להרפיה ומדיטציה קלה (נשימות עמוקות, הרפיית שרירים, דמיון מודרך) לפני פעילות לימודית מאתגרת.\n3. התאמת ההוראה לצרכים הייחודיים — בניית מטלות המאפשרות התקדמות בקצב אישי, עם הצלחות קטנות ומדורגות.\n4. למידה בקבוצות קטנות או בעזרת עמיתים.";
    const toolsMath = "📌 כלים לחיזוק חשבון (גיל היסודי הגדול):\nא. שיפור הבנה בסיסית: פירוק משימות לשלבים, שימוש בדוגמאות מחיי היומיום, המחשה בשרטוטים ודיאגרמות.\nב. פיתוח אסטרטגיות: קוד צבעים בנוסחאות, למידה בקבוצות קטנות, הצגת בעיות בדרכים שונות.\nג. כלים טכנולוגיים:\n   • Matific — פלטפורמה חינוכית מבוססת משחקים, פעילויות מתמטיות אינטראקטיביות בעברית.";

    const syms: string[] = [];
    const refs: string[] = [];
    const tools: string[] = [];
    function addSym(s: string) { if (!syms.includes(s)) syms.push(s); }
    function addRef(r: string) { if (!refs.includes(r)) refs.push(r); }
    function addTool(t: string) { if (!tools.includes(t)) tools.push(t); }

    if (read) {
      addSym("נמצאו סימנים לקשיי קריאה");
      if (histYes === 0) {
        const motiv = A.dv_read_motiv;
        if (motiv === "כן") { addRef("יש לבחון פנייה לקלינאית תקשורת"); addRef("יש לבנות תוכנית חיזוקים"); addTool(toolsChizuk); }
        else if (motiv === "לא") {
          addRef("יש לבנות תוכנית חיזוקים"); addTool(toolsChizuk);
          const mot = (A.dv_mot1||1)+(A.dv_mot2||1)+(A.dv_mot3||1);
          if (mot > 5) addRef("נמצאו קשיים רגשיים מול למידה — יש להפנות לטיפול פסיכודינאמי");
          else { if (!emitADHD(inattR, hyperR)) addRef("הפנייה לאבחון פסיכודידקטי"); }
        }
      } else if (histYes >= 1 && histYes <= 2) {
        const speech = A.dv_read_speech;
        if (speech === "כן") {
          const smotiv = A.dv_speech_motiv;
          if (smotiv === "כן") addRef("יש לבנות תוכנית בית-ספרית — אם אין שיפור לאחר כחודשיים יש לפנות לאבחון פסיכודידקטי");
          else if (smotiv === "לא") {
            addRef("יש לבנות תוכנית בית-ספרית — אם אין שיפור לאחר כחודשיים יש לפנות לאבחון פסיכודידקטי"); addTool(toolsChizuk);
            const smot = (A.dv_smot1||1)+(A.dv_smot2||1)+(A.dv_smot3||1);
            if (smot > 5) addRef("נמצאו קשיים רגשיים מול למידה — יש להפנות לטיפול פסיכודינאמי");
            else { if (!emitADHD(inattR, hyperR)) addRef("הפנייה לאבחון פסיכודידקטי"); }
          }
        } else if (speech === "לא") addRef("יש לבחון פנייה לקלינאית תקשורת");
      } else if (histYes >= 3) addRef("הפנייה לאבחון פסיכודידקטי");
    }
    if (adhdQ2yn) emitADHD(inattQ2, hyperQ2);
    if (write) {
      addSym("נמצאו סימנים לקשיי כתיבה");
      if (A.dv_write_ot === "כן") addRef("קשיי כתיבה — יש לחזור לבדיקה אצל מרפאה בעיסוק");
      else addRef("קשיי כתיבה — יש לבחון פנייה לריפוי בעיסוק");
    }
    if (comp) {
      addSym("נמצאו סימנים לקשיי הבנה בשיעור");
      if (!read && !adhdAny) addRef("הפנייה לאבחון פסיכודידקטי");
    }
    if (math !== "לא") {
      addSym("נמצאו סימנים לקשיי חשבון");
      const hasRA = read || adhdAny;
      if (math === "5%") { addRef(hasRA ? "נמצאו קשיים משמעותיים בחשבון בשילוב קשיים נוספים:\nא. יש לשקול סיוע פרטני דרך בית הספר או באופן פרטי.\nב. הפנייה לאבחון פסיכודידקטי." : "נמצאו קשיים משמעותיים בחשבון:\nא. יש לשקול סיוע פרטני דרך בית הספר או באופן פרטי.\nב. במידה ולא נראה שיפור משמעותי — הפנייה לאבחון פסיכודידקטי."); addTool(toolsMath); }
      else if (math === "10%") { addRef("נמצאו קשיים בחשבון:\nיש לשקול סיוע פרטני דרך בית הספר או באופן פרטי."); addTool(toolsMath); }
      else if (math === "30%") { addRef("נמצאו קשיים קלים בחשבון — יש לשקול סיוע פרטני."); addTool(toolsMath); }
    }
    if (syms.length || refs.length || tools.length) {
      box("purple", "📚 נמצאו קשיים לימודיים — כיתות ד-ו");
      if (syms.length) box("purple", syms.map(s => "📊 " + s).join("\n"));
      refs.forEach(r => box("info", "✅ " + r));
      tools.forEach(t => box("info", t));
    }
    return boxes;
  }

  // ── ז-ח / ט-יב ──────────────────────────────────────────────────────────────
  if (ga === "zh" || ga === "tyb") {
    const p = ga, isTyb = ga === "tyb";
    const verbal = A[p+"_verbal"] || "לא", math = A[p+"_math"] || "לא", eng = A[p+"_eng"] || "לא";
    const adhdYn = A[p+"_adhd_yn"] === "כן";
    const inatt = ["_ad1","_ad2","_ad3","_ad4","_ad5","_ad6"].filter(k => A[p+k]).length;
    const hyper = ["_ah1","_ah2","_ah3","_ah4","_ah5","_ah6"].filter(k => A[p+k]).length;
    const adhdPos = inatt >= 3 || hyper >= 3;
    const write = A[p+"_write"] === "כן", comp = A[p+"_comp"] === "כן";
    if (verbal === "לא" && math === "לא" && eng === "לא" && !adhdYn && !write && !comp) return boxes;

    const verbalToolsMid = "📌 כלים לעבודה עם קשיים ברבי מלל (גילאי החטיבה):\n1. תוכנית התנהגותית של קריאת ספרים עם תגמול/טבלה.\n2. פירוק טקסטים לרכיבים קטנים — \"קריאה פעילה\": קריאת כל פסקה בנפרד וסיכומה במשפט.\n3. בניית \"תרשימי זרימה\" צבעוניים שמסבירים בקצרה על מה מדברת כל פסקה.\n4. קריאה תוך כדי רישום הנקודות העיקריות בכל פסקה.\n5. למידה בקבוצות — הכוונה ללמידה איטית תוך כדי שיח על התסכול שמתעורר.\n6. אסטרטגיית SQ3R — Survey ▸ Question ▸ Read ▸ Recite ▸ Review.\n⚠️ חשוב: לוקח זמן לראות תוצאות — לאחר מספר חודשים לרוב רואים שיפור.";
    const verbalToolsHigh = "📌 כלים לעבודה עם קשיים ברבי מלל (גילאי התיכון):\n1. תוכנית התנהגותית של קריאת ספרים עם תגמול/טבלה.\n2. פירוק טקסטים לרכיבים קטנים — \"קריאה פעילה\".\n3. בניית \"תרשימי זרימה\" צבעוניים לפי פסקאות.\n4. שימוש בכלי AI לסיכום מאמרים ארוכים לבגרות.\n5. פיתוח \"הבנה אינפרנציאלית\": הסקת מידע שנרמז — קשרים סיבתיים, ניתוח עמדות, השוואה.\n6. שיטת Obsidian לארגון ידע — יצירת דפים וקישורים בין מושגים.\n⚠️ חשוב: לוקח זמן לראות תוצאות — לאחר מספר חודשים לרוב רואים שיפור.";
    const mathToolsMid = "📌 כלים לעבודה עם קשיים במתמטיקה (גילאי החטיבה):\n1. עזרה פרטנית — שיעורים פרטיים, חלוקה בין זמן בית לזמן בית ספר.\n2. למידה בעזרת אפליקציות לימודיות וטכנולוגיה.\n3. חזרה לחיזוק יסודות המתמטיקה.\n4. שיח: האם מתעוררת חרדה כתוצאה מהקושי.\n5. קבוצות תרגול או תגבורים בבית הספר.";
    const mathToolsHigh = "📌 כלים לעבודה עם קשיים במתמטיקה (גילאי התיכון):\nא. שיפור הבנה בסיסית: פירוק בעיות לשלבים, שימוש בדוגמאות מחיי היומיום, המחשה בשרטוטים.\nב. אסטרטגיות למידה: קוד צבעים בנוסחאות, למידה בקבוצות קטנות, הצגת בעיות בדרכים שונות.\nג. כלים טכנולוגיים: \"פשוט מתמטיקה\" — קורסים מקוונים בעברית מהטכניון.";
    const engTools = "📌 כלים לעבודה עם קשיים באנגלית:\n1. תגבור פרטי ע\"י מורה לאנגלית — חלוקה בין זמן בית לזמן בית ספר.\n2. למידה בעזרת אפליקציות (Duolingo, Quizlet) ופלטפורמות דיגיטליות.\n3. למידה בהקשר — חשיפה לאנגלית דרך סרטים, שירים ומשחקים.\n4. חזרה לחיזוק יסודות: דקדוק, אוצר מילים ומבנה משפטים.\n5. קבוצות תרגול או תגבורים בבית הספר.";
    const writeToolsMid = "📌 כלים לעבודה עם קשיי כתיבה (גילאי החטיבה):\nתרגול \"כתיבה מהירה\":\nשלב 1 — כתיבה חופשית (5 דקות): כתיבה ברצף על נושא חופשי. כללים: לא מרימים עט, לא מתקנים תוך כדי.\nשלב 2 — קריאה עצמית + סימון (3 דקות): סימון שגיאות כתיב, חזרות, משפטים לא ברורים.\nשלב 3 — \"טעויות חוזרות\": טבלת שיפור אישי — מה גיליתי? דוגמא מכתיבתי. איך לשפר?";
    const writeToolsHigh = "📌 כלים לעבודה עם קשיי כתיבה (גילאי התיכון):\n1. מעבר מכתב-יד להקלדה בבחינות.\n2. מפות מושגים לפני כתיבה — ארגון רעיונות לפני ניסוח.\n3. דף עבודה \"לפני כתיבה\": מה אני טוען? אילו דוגמאות? למי אני כותב?";

    const syms: string[] = [], refs: string[] = [], tools: string[] = [];
    function addSym(s: string) { if (!syms.includes(s)) syms.push(s); }
    function addRef(r: string) { if (!refs.includes(r)) refs.push(r); }
    function addTool(t: string) { if (!tools.includes(t)) tools.push(t); }

    const multiDomains = [verbal !== "לא", math !== "לא", adhdPos, comp].filter(Boolean).length;
    if (multiDomains >= 3) addRef("הפנייה לאבחון פסיכודידקטי");

    if (verbal !== "לא") {
      addSym("נמצאו סימנים לקשיים ברבי מלל");
      if (verbal === "20%" || verbal === "מעל 20%") addRef("הפנייה לאבחון פסיכודידקטי");
      addTool(isTyb ? verbalToolsHigh : verbalToolsMid);
    }
    if (math !== "לא") {
      addSym("נמצאו סימנים לקשיים במתמטיקה");
      if (math === "20%" || math === "מעל 20%") addRef("הפנייה לאבחון פסיכודידקטי");
      addTool(isTyb ? mathToolsHigh : mathToolsMid);
    }
    if (eng !== "לא") {
      addSym("נמצאו סימנים לקשיים באנגלית");
      if (eng === "20%" || eng === "מעל 20%") addRef("הפנייה לאבחון פסיכודידקטי");
      addTool(engTools);
    }
    if (adhdYn) emitADHD(inatt, hyper);
    if (write) {
      addSym("נמצאו סימנים לקשיי כתיבה");
      addRef("קשיי כתיבה — יש לבחון פנייה לריפוי בעיסוק");
      addTool(isTyb ? writeToolsHigh : writeToolsMid);
    }
    if (comp) {
      addSym("נמצאו סימנים לקשיי הבנה בשיעור");
      const hasRel = verbal !== "לא" || adhdPos;
      if (!hasRel) { addRef("קשיים בהבנה שאינם מוסברים ע\"י קשיי קשב או קריאה — יש לפנות לאבחון פסיכו-דידקטי"); if (isTyb) addRef("יש לשים לב לנתינת התאמות לבגרויות"); }
      else if (isTyb) addRef("יש לשים לב לנתינת התאמות לבגרויות");
    }
    if (syms.length || refs.length || tools.length) {
      box("purple", "📚 נמצאו קשיים לימודיים — כיתות " + (isTyb ? "ט-יב" : "ז-ח"));
      if (syms.length) box("purple", syms.map(s => "📊 " + s).join("\n"));
      refs.forEach(r => box("info", "✅ " + r));
      tools.forEach(t => box("info", t));
    }
    return boxes;
  }

  return boxes;
}

// ── Compute developmental results ────────────────────────────────────────────
function computeDevResults(A: Ans): Box[] {
  if (!["מעט","הרבה","הרבה מאוד"].includes(A.a_dev || "")) return [];
  const boxes: Box[] = [];
  function box(cls: BoxCls, txt: string) { boxes.push({ cls, txt }); }
  const age = parseInt(A._age) || 0;
  const ageOk = devAgeOk(A);
  const toiletShow = ageOk || A.toilet === "כן";

  // ── גמילה ──────────────────────────────────────────────────────────────────
  if (toiletShow && A.dev_toilet === "כן") {
    const ttype = A.dev_toilet_type || "";
    const past  = A.dev_toilet_past || "";
    box("purple","📊 נמצאו קשיים בגמילה / התרוקנות");

    if (ttype === "א") {
      box("warn","⚠️ נמצאו סימפטומים של עצירות — יש לפנות לרופא הילדים או לפיזיותרפיה של רצפת אגן בילדים");
      box("info","✅ הפנייה: רופא ילדים / פיזיותרפיסטית רצפת אגן ילדים (פרטי או דרך הקופה)\n\n📋 הערה — עצירות:\nנראה כי הילד מתמודד עם עצירות: קושי או כאבים במתן צואה, צואה קשה, התרוקנות בתדירות נמוכה.\n\nכלים לניסיון בבית:\n• שתיית מים מרובה — לפחות 35 מ\"ל לכל ק\"ג משקל גוף\n• ישיבה יזומה בשירותים כרבע שעה לאחר ארוחה\n• ישיבה עם שרפרף מתחת לכפות הרגליים כך שהברכיים גבוהות מהירך\n• תרגול נשימה בזמן הישיבה בשירותים\n\nאם אין שיפור תוך כשבועיים → פנייה לפיזיותרפיה רצפת אגן ילדים.");
    } else if (ttype === "ב") {
      const wetType = A.dev_wet_type || "";
      box("warn","⚠️ נמצאו סימפטומים של הרטבת " + (wetType || "שתן") + " — יש לפנות לאורולוג ילדים או לפיזיותרפיה של רצפת אגן בילדים");
      box("info","✅ הפנייה: אורולוג ילדים / פיזיותרפיסטית רצפת אגן ילדים (פרטי או דרך הקופה)\n\n📋 הערה — הרטבת יום/לילה:\nב-70–80% מהמקרים הגורם הראשוני הוא עצירות.\n\nכלים לניסיון בבית:\n• שתיית מים מרובה — לפחות 35 מ\"ל לכל ק\"ג משקל גוף\n• ישיבה יזומה בשירותים כרבע שעה לאחר ארוחה\n• ישיבה עם שרפרף מתחת לכפות הרגליים כך שהברכיים גבוהות מהירך\n• תרגול נשימה בזמן הישיבה בשירותים\n\nאם ההרטבה החלה בעקבות אירוע משברי → פנייה לפסיכולוג חינוכי/התפתחותי.\n\n⚠️ חשוב:\n• אין להפעיל לחץ גלוי או סמוי\n• אין להעניש או להעליב\n• אין להכריח את הילד לכבס את מצעיו ובגדיו");
    } else if (ttype === "ג") {
      box("warn","⚠️ נמצאו סימפטומים של בריחת צואה (אנקופרזיס) — יש לפנות לגסטרולוג ילדים או לפיזיותרפיה של רצפת אגן בילדים");
      box("info","✅ הפנייה: גסטרולוג ילדים / פיזיותרפיסטית רצפת אגן ילדים (פרטי או דרך הקופה)\n\n📋 הערה — התלכלכות/הצטאות (אנקופרזיס):\nב-80–90% מהמקרים הגורם הראשוני הוא עצירות.\n\nכלים לניסיון בבית:\n• שתיית מים מרובה — לפחות 35 מ\"ל לכל ק\"ג משקל גוף\n• ישיבה יזומה בשירותים כרבע שעה לאחר ארוחה\n• ישיבה עם שרפרף מתחת לכפות הרגליים\n• תרגול נשימה בזמן הישיבה\n\n⚠️ חשוב:\n• חיזוקים חיוביים בלבד — חיזוקים שליליים עלולים להחמיר\n• אין להפעיל מתח, לחץ או חרדה\n• אם יש התלכלכות בגן/ביה\"ס → לערב פסיכולוג הגן");
    } else if (ttype === "ד") {
      box("warn","⚠️ נמצאו סימפטומים של בריחת שתן וצואה — יש לפנות לגסטרולוג ילדים או לפיזיותרפיה של רצפת אגן בילדים");
      box("info","✅ הפנייה: גסטרולוג ילדים / פיזיותרפיסטית רצפת אגן ילדים (פרטי או דרך הקופה)\n\n📋 הערה — הרטבה + התלכלכות:\nב-70–90% מהמקרים הגורם הראשוני הוא עצירות.\n\nכלים לניסיון בבית:\n• שתיית מים מרובה — לפחות 35 מ\"ל לכל ק\"ג משקל גוף\n• ישיבה יזומה בשירותים כרבע שעה לאחר ארוחה\n• ישיבה עם שרפרף מתחת לכפות הרגליים\n\n⚠️ חשוב:\n• חיזוקים חיוביים בלבד\n• אין להפעיל לחץ, להעניש, להעליב\n• אם יש התלכלכות בגן/ביה\"ס → לערב פסיכולוג הגן");
    }

    if (past === "לא") {
      box("info","📌 עשרת כללי הגמילה (לילדים שטרם גמולו):\n\nא. סימנים שאפשר להתחיל:\n   1. יבש/ה 1.5–2 שעות ברצף\n   2. מודעות לכך שעושה צרכים (נעמד בצד, מודיע \"יש לי\")\n   3. מבינ/ה הוראות פשוטות ויודע/ת לזהות איברי גוף\n   4. מביע/ה רצון לעצמאות (\"אני לבד!\")\n\nב. עדיף לא להתחיל בתקופות לחוצות (מעבר דירה, מעבר גן, מתח)\n\nג. עקביות ונחישות: אם מורידים בשעות הערות — להוריד לגמרי, לא לסירוגין\n\nד. התחלה: עדיף כשיש כמה ימים ברצף בבית (סוף שבוע / חגים)\n\nו. תזכורות: בימים הראשונים — להציע ללכת לשירותים כל 45 דקות\n\nז. ציוד נכון: סיר נוח / מקטין אסלה עם שרפרף, בגדים שקל להוריד, סטים להחלפה\n\nח. פספוסים — חלק בלתי נפרד מהלמידה:\n   \"אופס, ברח הפיפי. פיפי עושים בסיר/בשירותים\"\n   אל תכעסו, אל תענישו, אל תגרמו לבושה\n\nט. חיזוקים: שבחו מאמץ ומודעות — \"אמרת לי שיש פיפי — מצוין!\"\n   פרסים: קטנים, מיידיים, קצרי טווח (מדבקה/חותמת)\n\nי. גמילת לילה: מורכבת יותר וקשורה לפיזיולוגיה. מומלץ לגמול ביום קודם.");
    } else if (past === "כן") {
      if (age > 0 && age < 3) {
        box("info","📌 המלצות לילדים עד גיל 3 (הייתה גמילה מלאה בעבר):\n\nחשוב: יש להימנע מהפעלת לחץ גלוי או סמוי.\n\nמה כן לעשות:\n• חשיפה לנושא הגמילה דרך ספרים\n• צפייה בבני גילו שמשתמשים בשירותים\n• ישיבה על סיר / אסלה לסיפור או משחק — ללא לחץ לתוצאה\n\nאם יש חרדת אסלה / התנגדות:\n→ פנייה לפיזיותרפיסטית רצפת אגן ילדים\n→ הדרכה על ידי פסיכולוג חינוכי/התפתחותי\n\nאם יש חוסר שליטה ובריחות:\n→ שלב ראשון: רופא ילדים לשלילת קושי פיזיולוגי\n→ שלב שני: פיזיותרפיה רצפת אגן ילדים");
      } else {
        box("info","📌 המלצות לילדים מעל גיל 3 (הייתה גמילה מלאה בעבר):\n\n→ שלב ראשון: רופא ילדים לשלילת קושי פיזיולוגי\n→ שלב שני: פיזיותרפיה רצפת אגן ילדים (פרטי או דרך הקופה)\n\nחשוב: יש להימנע מהפעלת לחץ גלוי או סמוי. אין להעניש או להעליב.");
      }
    }
  }

  // ── ויסות חושי ─────────────────────────────────────────────────────────────
  if (ageOk && A.dev_sensory === "כן") {
    const overTot  = (["so1","so2","so3","so4","so5","so6","so7","so8","so9","so10"]
      .reduce((s,k) => s + (A[k] || 0), 0));
    const underTot = (["su1","su2","su3","su4","su5","su6","su7","su8"]
      .reduce((s,k) => s + (A[k] || 0), 0));
    const hasOver  = overTot  > 0;
    const hasUnder = underTot > 0;

    if (!hasOver && !hasUnder) {
      box("purple","📊 ישנם תסמינים כלליים לקשיי ויסות חושי");
      box("warn","⚠️ יש לפנות לרופא המשפחה להמשך בדיקה");
    } else {
      if (hasOver) {
        if (overTot >= 26) { /* תקין */ }
        else if (overTot >= 24) {
          box("purple","📊 נמצאו סימנים לרגישות יתר תחושתית (הבדל קל, ציון: " + overTot + ")");
          box("warn","⚠️ ישנם תסמינים כלליים לקשיי ויסות חושי. יש לפנות לרופא המשפחה להמשך בדיקה");
        } else {
          box("purple","📊 חשד לרגישות יתר תחושתית (הבדל ברור, ציון: " + overTot + ")");
          box("info","✅ הפנייה: טיפול ויסות חושי על ידי ריפוי בעיסוק");
        }
      }
      if (hasUnder) {
        if (underTot >= 19) { /* תקין */ }
        else if (underTot >= 16) {
          box("purple","📊 נמצאו סימנים לתת-תגובתיות תחושתית (הבדל קל, ציון: " + underTot + ")");
          box("warn","⚠️ ישנם תסמינים כלליים לקשיי ויסות חושי. יש לפנות לרופא המשפחה להמשך בדיקה");
        } else {
          box("purple","📊 חשד לתת-תגובתיות תחושתית (הבדל ברור, ציון: " + underTot + ")");
          box("info","✅ הפנייה: טיפול ויסות חושי על ידי ריפוי בעיסוק");
        }
      }
    }
  }

  return boxes;
}

// ── Compute behavioral results ────────────────────────────────────────────────
function computeBehResults(A: Ans): Box[] {
  if (!["מעט","הרבה","הרבה מאוד"].includes(A.a_beh || "")) return [];
  const ml = A.beh_max_level || 0;
  if (ml <= 0) return [];
  const boxes: Box[] = [];
  function box(cls: BoxCls, txt: string) { boxes.push({ cls, txt }); }
  const finalPlan = gg(A) === "ga" ? "חיובי" : (A.beh_plan || "");
  box("purple","📊 נמצאו קשיים התנהגותיים");
  if (finalPlan === "חיובי") {
    box("info","✅ הפנייה: תוכנית התנהגותית ממוקדת מרכיבים חיוביים");
  } else if (finalPlan === "חיובי_שלילי") {
    box("info","✅ הפנייה: תוכנית התנהגותית ממוקדת מרכיבים חיוביים ושליליים, בשיתוף המורים וההורים");
  } else if (finalPlan === "חיובי_שלילי_פסיכולוגי") {
    box("info","✅ הפנייה: תוכנית התנהגותית עם מרכיבים חיוביים ושליליים, בשיתוף המורים וההורים — יחד עם טיפול פסיכולוגי");
  }
  let planTxt = "📌 תוכנית התנהגותית מפורטת:\n\n";
  planTxt += "🟢 תוכנית התנהגותית ממוקדת מרכיבים חיוביים\n";
  planTxt += "נדרשת פגישה עם היועצת, המחנכ/ת ואפשרי גם פסיכולוג המסגרת. בפגישה זו יש לחשוב על הסיבות לקושי המוטיבציוני, ולבנות תוכנית התנהגותית.\n\n";
  planTxt += "דוגמה לתוכנית התנהגותית ממוקדת תגובות חיוביות:\n";
  planTxt += "א. יש לבחור 3 נושאים בהם רוצים לשפר את מצבו של הילד (לדוגמה: א. היעדרויות משיעורים. ב. חוסר השתתפות בשיעורים. ג. חיסורים).\n";
  planTxt += "ב. תוכניות התנהגותיות לרוב עובדות. החיסרון שלהן הוא שפעמים רבות הן \"הולכות לאיבוד\" בשל חוסר מיקוד בנושא האחריות של המבוגרים בתוכנית. בשל כך על התוכנית ההתנהגותית להיות יעילה — יש לתת בכל יום נקודה על כל נושא, לסדר טבלה מסודרת במחברת של הילד, לכתוב תזכורות להורים לוודא שהם עוברים על הנקודות בסוף כל יום, להגדיר מראש ובכתב את הפרסים שהילד מקבל עבור כל סך נקודות.";
  if (finalPlan === "חיובי_שלילי" || finalPlan === "חיובי_שלילי_פסיכולוגי") {
    planTxt += "\n\n🟠 מרכיבים שליליים — תוספת לתוכנית\n";
    planTxt += "בשל העובדה כי החומרה של בעיות ההתנהגות גבוהה, יש להוסיף גם תגובות שליליות בנוסף לתגובות החיוביות.\n\n";
    planTxt += "כיצד מבצעים:\n";
    planTxt += "• יש לערוך פגישה של המחנך/ת + ההורים + הילד, להחליט על 2 נושאים שהם \"קווים אדומים\" (כגון: חוצפה חמורה, או אלימות).\n";
    planTxt += "• בכל מקרה שהוא עובר על הקו האדום — הילד/ה מקבל אזהרה.\n";
    planTxt += "• בפעם השנייה באותו יום שהוא עובר על הקווים האדומים — הוא מקבל תגובה.\n";
    planTxt += "• את התגובה הוא מבצע בבית וחוזר איתה למחרת (אלא אם כן הוא בוחר לעשות אותה בזמן ההפסקות).\n";
    planTxt += "• ההורים צריכים לוודא שהילד מבצע את התגובה.\n";
    planTxt += "• לשתף את הילד באפשרויות של התגובות השליליות ומה הוא היה מעדיף.\n";
    planTxt += "• יש להפחית ככל הניתן בשיחות מוסר והסברים ארוכים, ולהתמקד בכך שגם החלק ה\"שלילי\" של התגובות הינו כתגובה למעשים שלו ולא לזהות שלו.";
  }
  if (finalPlan === "חיובי_שלילי_פסיכולוגי") {
    planTxt += "\n\n🔴 טיפול פסיכולוגי — ע\"פ המאפיינים האישיים והגיל\n";
    planTxt += "יש לפנות לטיפול פסיכודינאמי ע\"פ מאפייני הילד.";
  }
  planTxt += "\n\n📌 כלים לעבודה בכיתה עם ילדים בעלי חיכוכים והתנגדויות:\n";
  planTxt += "• אין לנהל שיח על המקרה מיד לאחר מריבה — יש להשהות לפחות שעתיים עד לרגיעה.\n";
  planTxt += "• תחילת ואמצע השיח צריך להיות בנוי בעיקר משאלות פתוחות, לא שיפוטיות ולא ביקורתיות — ניסיון להקשיב לסיבות ולהסברים של הילד.\n";
  planTxt += "• בסוף השיח — להתמקד בדרכים בהן הוא יימנע מחיכוכים בפעם הבאה, ולשקף לו את הטריגרים.\n";
  planTxt += "• אין להתייאש — לרוב בשיחות הראשונות יש תחושה שהילד לא מקבל את הניסיון לסייע, אך לאחר מספר התערבויות ניתן יהיה לראות שיפור.\n";
  planTxt += "• חשוב מאוד שהמורה לא יערב רגשות שליליים בשיח (כמו ייאוש, אכזבה, כעס), אלא יתמקד התנהגותית במעשים ובהקשבה לצרכים.\n";
  planTxt += "• אין לנהל \"שיחות מוסר\" ארוכות ומייגעות.\n\n";
  planTxt += "📌 המלצות להורים:\n";
  planTxt += "• לשמור על שגרה קבועה ועקבית — גבולות ברורים ועקביים מסייעים לילד להרגיש ביטחון.\n";
  planTxt += "• להימנע מהסלמה מילולית בזמן כעס — לחכות לרגיעה לפני כל שיח.\n";
  planTxt += "• לתת חיזוקים חיוביים גדולים על כל הצלחה קטנה — לשבח התנהגות ספציפית ולא את הילד כולו.\n";
  planTxt += "• ליצור זמן איכות יומי עם הילד ללא מסכים ולא שיחות \"חינוכיות\".\n";
  planTxt += "• לפנות ליועצת בית הספר לתיאום בין הבית לבית הספר.";
  box("info", planTxt);
  return boxes;
}

// ── Compute social results ────────────────────────────────────────────────────
function computeSocResults(A: Ans): Box[] {
  if (!["מעט","הרבה","הרבה מאוד"].includes(A.a_soc || "")) return [];
  const boxes: Box[] = [];
  function box(cls: BoxCls, txt: string) { boxes.push({ cls, txt }); }
  const lsas = A.lsas_tot || 0;
  const soc1 = A.soc1 || "", soc2 = A.soc2 || "", soc3 = A.soc3 || "";
  const sev = A.soc2_sev || 0;
  // soc1 counts as an issue only if LSAS score reaches threshold (≥8)
  const hasSocIssue = (soc1 === "כן" && lsas >= 8) || soc2 === "כן" || soc3 === "כן";
  if (hasSocIssue) box("purple","📊 נמצאו קשיים חברתיים");
  const emoBoxes = computeResults(A);
  const hasEmoTherapyRef = emoBoxes.some(b => b.txt.startsWith("✅") && b.txt.includes("טיפול"));
  const socTherapyRefs: string[] = [];
  const socNonTherapyRefs: string[] = [];
  function addSocRef(txt: string) {
    if (txt.includes("טיפול פסיכודינאמי") || txt.includes("טיפול רגשי")) {
      if (!socTherapyRefs.includes(txt)) socTherapyRefs.push(txt);
    } else { socNonTherapyRefs.push(txt); }
  }
  if (soc1 === "כן" && lsas >= 8) {
    const ref = buildQ10StyleRef(A);
    if (lsas <= 13) {
      box("warn","📊 דווחו סימפטומים קלים של חרדה חברתית");
    } else if (lsas <= 18) {
      box("warn","📊 דווחו סימפטומים בינוניים של חרדה חברתית");
    } else {
      box("danger","📊 דווחו סימפטומים משמעותיים של חרדה חברתית");
    }
    box("info", ref);
  }
  if (soc2 === "כן") {
    if (sev >= 5) {
      addSocRef('קשיים חברתיים גבוהים — הפנייה לקבוצה חברתית + כלים לעבודה בכיתה + טיפול פסיכודינאמי ע"פ מאפייני הילד');
    } else if (sev >= 1) {
      socNonTherapyRefs.push("קשיים חברתיים מתונים — הפנייה לקבוצה חברתית + כלים לעבודה בכיתה");
    }
  }
  if (soc3 === "כן") {
    const early3 = A.soc3_early || "";
    const allComm = A.comm1 === "כן" && A.comm2 === "כן" && A.comm3 === "כן";
    const hasExtra = A.comm_rep === "כן" || A.comm_rigid === "כן" || A.comm_interest === "כן" || A.comm_sens === "כן";
    const allExtraNo = A.comm_rep === "לא" && A.comm_rigid === "לא" && A.comm_interest === "לא" && A.comm_sens === "לא";
    if (allComm && hasExtra) {
      box("danger","📊 ייתכנו תסמינים של קשיי תקשורת — יש לפנות ליועצת ופסיכולוג בית הספר לשם הערכה מקיפה");
    } else if (allComm && allExtraNo) {
      addSocRef("נמצאו קשיי תקשורת — הפנייה לטיפול פסיכודינאמי בשילוב הדרכת הורים");
    } else if (early3 === "לא") {
      addSocRef("נמצאו סימני קושי בתקשורת — הפנייה לטיפול פסיכודינאמי בשילוב הדרכת הורים");
    } else {
      socNonTherapyRefs.push("נמצאו סימני קושי בתקשורת — מומלץ להיוועץ עם יועצת/פסיכולוג");
    }
  }
  socNonTherapyRefs.forEach(r => box("info","✅ " + r));
  if (socTherapyRefs.length > 0 && !hasEmoTherapyRef) {
    const emoMotVal = (A.aq_mot_bv || 0) + (A.aq_mot_zy || 0);
    const socMotVal = A.soc_motiv_therapy || 0;
    const motVal = emoMotVal > 0 ? emoMotVal : socMotVal;
    if (motVal >= 1) {
      const refTxt = motVal <= 2
        ? "יש להפנות לטיפול פסיכודינאמי + הדרכת הורים והתערבות במסגרת החינוכית"
        : "יש להפנות לטיפול פסיכודינאמי משולב + CBT בשילוב הדרכת הורים והתערבות במסגרת החינוכית";
      box("info","✅ " + refTxt);
    } else {
      box("info","✅ יש לענות על שאלת המוטיבציה (בשאלון) לקביעת סוג הטיפול הרגשי המומלץ");
    }
  }
  // classroom tools — only for conflicts/communication, not for social anxiety
  if (soc2 === "כן" || soc3 === "כן") {
    box("info","📌 כלים לעבודה בכיתה עם קשיים חברתיים:\n\n• אין לנהל שיח על מקרה מיד לאחר מריבה — יש להשהות לפחות שעתיים עד לרגיעה.\n• תחילת ואמצע השיח — שאלות פתוחות, לא שיפוטיות ולא ביקורתיות; הקשבה לסיבות ולהסברים של הילד/ה, גם אם נשמעים לא הגיוניים.\n• בסוף השיח — להתמקד בדרכים בהן יוכל להימנע מחיכוכים בפעם הבאה, ולשקף מה היו הטריגרים.\n• אין להתייאש — לאחר מספר התערבויות ניתן לראות שיפור.\n• אם ניתן, לחשוב יחד על רגעים בהם הוא מתחיל להתפרץ (עוד לפני שהתפרץ) ולבנות איתו דרך פעולה.\n• המורה אינו מערב רגשות שליליים בשיח (ייאוש, אכזבה, כעס) — מתמקד בהתנהגות, בהקשבה לצרכים ובהתבוננות לעתיד.\n• אין לנהל \"שיחות מוסר\" ארוכות ומייגעות.");
  }
  return boxes;
}

// ── Shared UI helpers ─────────────────────────────────────────────────────────
const BTN_BASE  = "px-5 py-2 border-2 rounded-full font-medium text-sm transition-all cursor-pointer";
const BTN_SEL   = "bg-[#2c3e7a] text-white border-[#2c3e7a]";
const BTN_DEF   = "bg-white text-[#3a4a5a] border-[#d0dae8] hover:border-[#4a6fa5]";
const SB_BASE   = "min-w-[40px] h-10 border-2 rounded-lg font-semibold text-sm transition-all cursor-pointer flex-1";
const SB_SEL    = "bg-[#2c3e7a] text-white border-[#2c3e7a]";
const SB_DEF    = "bg-white text-[#3a4a5a] border-[#d0dae8] hover:border-[#4a6fa5]";
const SO_BASE   = "px-3 py-1.5 border-2 rounded-2xl text-xs font-medium transition-all cursor-pointer";
const SO_SEL    = "bg-[#2c3e7a] text-white border-[#2c3e7a]";
const SO_DEF    = "bg-white text-[#3a4a5a] border-[#d0dae8] hover:border-[#4a6fa5]";
const CB_BASE   = "px-4 py-2 border-2 rounded-full text-sm font-medium transition-all cursor-pointer";
const CB_SEL    = "bg-[#2c3e7a] text-white border-[#2c3e7a]";
const CB_DEF    = "bg-white text-[#3a4a5a] border-[#d0dae8] hover:border-[#4a6fa5]";

function ob(selected: boolean) { return `${BTN_BASE} ${selected ? BTN_SEL : BTN_DEF}`; }
function sb(selected: boolean) { return `${SB_BASE} ${selected ? SB_SEL : SB_DEF}`; }
function so(selected: boolean) { return `${SO_BASE} ${selected ? SO_SEL : SO_DEF}`; }
function cb(selected: boolean) { return `${CB_BASE} ${selected ? CB_SEL : CB_DEF}`; }

function AlertBox({ cls, txt }: Box) {
  const style: Record<string, string> = {
    info:   "bg-blue-50 border-r-4 border-blue-500 text-blue-900",
    warn:   "bg-yellow-50 border-r-4 border-yellow-600 text-yellow-900",
    danger: "bg-red-50 border-r-4 border-red-600 text-red-900",
    purple: "bg-purple-50 border-r-4 border-purple-500 text-purple-900",
    ok:     "bg-green-50 border-r-4 border-green-600 text-green-900",
  };
  return (
    <div className={`rounded-xl p-4 mb-3 text-sm font-semibold leading-relaxed whitespace-pre-line ${style[cls] || style.info}`}>
      {txt}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">{children}</div>;
}
function StepTag({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">{children}</div>;
}
function StepQ({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-bold text-[#1a2a3a] mb-1 leading-snug">{children}</h2>;
}
function StepHint({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-gray-400 mb-5 leading-relaxed">{children}</p>;
}
function EqNum({ n }: { n: number }) {
  return <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#2c3e7a] text-white text-sm font-bold mb-3">{n}</div>;
}
function NavRow({ onBack, onNext, backLabel = "→ חזרה", nextLabel = "המשך ←", showBack = true }: {
  onBack?: () => void; onNext?: () => void; backLabel?: string; nextLabel?: string; showBack?: boolean;
}) {
  return (
    <div className="flex gap-3 mt-7 flex-wrap">
      {showBack && onBack && (
        <button onClick={onBack} className="px-6 py-3 border-2 border-[#2c3e7a] text-[#2c3e7a] rounded-full font-semibold text-sm hover:bg-blue-50 transition-all">{backLabel}</button>
      )}
      {onNext && (
        <button onClick={onNext} className="px-8 py-3 bg-gradient-to-r from-[#2c3e7a] to-[#4a6fa5] text-white rounded-full font-bold text-sm shadow-md hover:opacity-90 transition-all">{nextLabel}</button>
      )}
    </div>
  );
}
function SubCard({ children }: { children: React.ReactNode }) {
  return <div className="bg-[#f7f9fc] rounded-xl p-5 mt-2 border border-[#e0e8f4] space-y-4">{children}</div>;
}
function GradeBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#fdf8ff] border-2 border-purple-300 rounded-xl p-4 mt-3">
      <div className="text-sm font-bold text-purple-700 mb-3">{title}</div>
      {children}
    </div>
  );
}

// Scale 1–N (auto-advance on click)
function ScaleRow({ max, val, onChange }: { max: number; val: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap mt-1">
      {Array.from({length: max}, (_, i) => i + 1).map(n => (
        <button key={n} className={sb(val === n)} onClick={() => onChange(n)}>{n}</button>
      ))}
    </div>
  );
}
// Scale 0–4
function Scale04Row({ val, onChange }: { val: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap mt-1">
      {[0,1,2,3,4].map(n => (
        <button key={n} className={so(val === n)} onClick={() => onChange(n)}>{n}</button>
      ))}
    </div>
  );
}
// Yes/No row
function YNRow({ val, onChange }: { val: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-3 mt-1">
      <button className={`flex-1 text-center py-3 text-base font-bold rounded-xl border-2 transition-all ${val==="כן" ? "bg-[#2c3e7a] text-white border-[#2c3e7a]" : "bg-white border-[#d0dae8] text-[#3a4a5a] hover:border-[#4a6fa5]"}`} onClick={() => onChange("כן")}>כן</button>
      <button className={`flex-1 text-center py-3 text-base font-bold rounded-xl border-2 transition-all ${val==="לא" ? "bg-[#2c3e7a] text-white border-[#2c3e7a]" : "bg-white border-[#d0dae8] text-[#3a4a5a] hover:border-[#4a6fa5]"}`} onClick={() => onChange("לא")}>לא</button>
    </div>
  );
}

// ── Age/grade mismatch helper ─────────────────────────────────────────────────
const GRADE_AGE: Record<string, [number, number]> = {
  "פעוט":[1,2],"גן3":[3,3],"גן-טרום":[4,4],"גן":[5,6],
  "א":[6,7],"ב":[7,8],"ג":[8,9],"ד":[9,10],"ה":[10,11],"ו":[11,12],
  "ז":[12,13],"ח":[13,14],"ט":[14,15],"י":[15,16],"יא":[16,17],"יב":[17,18],
};
function ageMismatch(age: number, grade: string): boolean {
  const r = GRADE_AGE[grade];
  if (!r || !age || !grade) return false;
  return age < r[0] || age > r[1] + 1;
}
function calcBMI(h: number, w: number): number | null {
  if (!h || !w) return null;
  return w / ((h / 100) ** 2);
}
function bmiLabel(bmi: number): string {
  if (bmi < 18.5) return "תת משקל";
  if (bmi < 25)   return "תקין";
  if (bmi < 30)   return "עודף משקל";
  return "השמנה";
}

// ── p-consent ─────────────────────────────────────────────────────────────────
function PageConsent({ onNext }: { onNext: () => void }) {
  const [agreed, setAgreed] = useState(false);
  return (
    <div>
      <div className="mb-6 rounded-xl border-2 border-amber-300 bg-amber-50 p-6 leading-relaxed text-amber-900">
        <p className="mb-3 text-base font-bold">⚠️ הצהרה והבהרה משפטית</p>
        <p className="mb-3 text-sm">שאלון זה נועד אך ורק לסייע בהתאמה של סוג הטיפול לקושי המדווח ואינו מהווה אבחון פסיכולוגי, פסיכיאטרי או רפואי מכל סוג שהוא.</p>
        <p className="mb-3 text-sm">המידע המוצג בשאלון הינו כללי בלבד ואינו מחליף ייעוץ מקצועי, אבחון או טיפול על ידי גורמים מוסמכים. השאלון אינו מתיימר לאבחן הפרעות נפשיות, מחלות או כל מצב בריאותי אחר.</p>
        <p className="mb-3 text-sm">המשתמש/ת בשאלון זה מצהיר/ה כי הוא/היא מבין/ה שהתשובות המתקבלות אינן מחייבות מבחינה קלינית, ואין לסמוך עליהן כתחליף לאבחון מקצועי. הגורמים המפעילים את השאלון אינם נושאים בכל אחריות לנזק, ישיר או עקיף, שייגרם כתוצאה מהשימוש בו.</p>
        <p className="text-sm font-semibold">🚨 אם אתה/את נמצא/ת במצב של מצוקה נפשית חריפה או סכנה מיידית, פנה/י מיד לחדר מיון הקרוב, לקו החירום 101 (מד&quot;א) או לסיוע ראשוני 1201.</p>
      </div>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 hover:bg-amber-100">
        <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#2e7d8c]" />
        <span>קראתי את ההצהרה לעיל, הבנתי את תנאיה ואני מסכים/ה להמשיך</span>
      </label>
      <div className="mt-5">
        <button
          disabled={!agreed}
          onClick={onNext}
          className="w-full rounded-xl bg-[#1a3a5c] py-3 text-base font-bold text-white disabled:opacity-40 hover:bg-[#0f2540]"
        >
          קראתי והסכמתי – נמשיך ▸
        </button>
      </div>
    </div>
  );
}

// ── p-demo ────────────────────────────────────────────────────────────────────
function PageDemo({ A, setA, onNext, onBack }: { A: Ans; setA: (a: Ans) => void; onNext: (a: Ans) => void; onBack: () => void }) {
  const [showErr, setShowErr] = useState(false);

  const age   = parseInt(A._age)  || 0;
  const grade = A._grade || "";
  const h     = parseFloat(A._h)  || 0;
  const w     = parseFloat(A._w)  || 0;
  const bmi   = calcBMI(h, w);
  const mismatch = ageMismatch(age, grade);

  function upd(key: string, val: any) {
    const next = { ...A, [key]: val };
    if (key === "_h" || key === "_w") {
      const hv = key === "_h" ? parseFloat(val)||0 : h;
      const wv = key === "_w" ? parseFloat(val)||0 : w;
      const b  = calcBMI(hv, wv);
      if (b) next.bmi = b;
    }
    setA(next);
  }

  function handleNext() {
    if (!A._age || !A._grade || !A.gender) { setShowErr(true); return; }
    setShowErr(false);
    onNext(A);
  }

  return (
    <div>
      <Card>
        <StepTag>שלב 1 מתוך 3</StepTag>
        <StepQ>פרטי הילד/ה</StepQ>
        <StepHint>שדות עם <span className="text-red-500">*</span> הם חובה</StepHint>

        {/* פרטים בסיסיים */}
        <div className="text-xs font-bold text-[#2c3e7a] mb-3 pb-1 border-b-2 border-[#e8eef6]">🧒 פרטים בסיסיים</div>
        <div className="flex gap-4 flex-wrap mb-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500">גיל <span className="text-red-500">*</span></label>
            <input type="number" min={1} max={18} placeholder="גיל"
              value={A._age || ""}
              onChange={e => upd("_age", e.target.value)}
              className="border-2 border-[#d0dae8] rounded-xl px-3 py-2 text-sm w-24 focus:border-[#4a6fa5] outline-none" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500">שכבת גיל <span className="text-red-500">*</span></label>
            <select value={A._grade || ""} onChange={e => upd("_grade", e.target.value)}
              className="border-2 border-[#d0dae8] rounded-xl px-3 py-2 text-sm w-52 focus:border-[#4a6fa5] outline-none bg-white">
              <option value="">-- בחר/י --</option>
              <option value="פעוט">פעוט (גיל 1–2)</option>
              <option value="גן3">גן גיל 3</option>
              <option value="גן-טרום">גן טרום חובה (גיל 4)</option>
              <option value="גן">גן חובה (גיל 5–6)</option>
              <option value="א">כיתה א׳</option>
              <option value="ב">כיתה ב׳</option>
              <option value="ג">כיתה ג׳</option>
              <option value="ד">כיתה ד׳</option>
              <option value="ה">כיתה ה׳</option>
              <option value="ו">כיתה ו׳</option>
              <option value="ז">כיתה ז׳</option>
              <option value="ח">כיתה ח׳</option>
              <option value="ט">כיתה ט׳</option>
              <option value="י">כיתה י׳</option>
              <option value="יא">כיתה י"א</option>
              <option value="יב">כיתה י"ב</option>
            </select>
          </div>
        </div>
        {mismatch && (
          <div className="bg-yellow-50 border-r-4 border-yellow-500 rounded-lg px-4 py-2 text-xs font-semibold text-yellow-800 mb-3">
            ⚠️ אי התאמה בין גיל וכיתה — נא לבדוק
          </div>
        )}
        <div className="mb-5">
          <label className="text-xs font-semibold text-gray-500 block mb-2">מין <span className="text-red-500">*</span></label>
          <div className="flex gap-2 flex-wrap">
            {["זכר","נקבה","אחר"].map(g => (
              <button key={g} className={ob(A.gender === g)} onClick={() => upd("gender", g)}>{g}</button>
            ))}
          </div>
        </div>

        {/* גובה ומשקל */}
        <div className="text-xs font-bold text-[#2c3e7a] mb-3 pb-1 border-b-2 border-[#e8eef6]">📏 גובה ומשקל (אופציונלי)</div>
        <div className="flex gap-4 flex-wrap mb-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500">גובה (ס"מ)</label>
            <input type="number" placeholder='ס"מ' value={A._h || ""}
              onChange={e => upd("_h", e.target.value)}
              className="border-2 border-[#d0dae8] rounded-xl px-3 py-2 text-sm w-28 focus:border-[#4a6fa5] outline-none" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500">משקל (ק"ג)</label>
            <input type="number" placeholder='ק"ג' value={A._w || ""}
              onChange={e => upd("_w", e.target.value)}
              className="border-2 border-[#d0dae8] rounded-xl px-3 py-2 text-sm w-28 focus:border-[#4a6fa5] outline-none" />
          </div>
        </div>
        {bmi && (
          <div className="text-xs text-gray-500 mb-4">BMI: <strong>{bmi.toFixed(1)}</strong> — {bmiLabel(bmi)}</div>
        )}

        {/* ראייה ושמיעה */}
        <div className="text-xs font-bold text-[#2c3e7a] mb-3 pb-1 border-b-2 border-[#e8eef6]">👁️ ראייה ושמיעה</div>
        <div className="mb-4">
          <p className="text-sm text-gray-500 mb-2">האם נעשתה בדיקת ראייה?</p>
          <div className="flex gap-2 mb-2">
            {["כן","לא"].map(v => <button key={v} className={ob(A.vision === v)} onClick={() => upd("vision", v)}>{v}</button>)}
          </div>
          {A.vision === "לא" && (
            <div className="pr-4 border-r-2 border-blue-200 mt-2">
              <p className="text-sm text-gray-500 mb-2">האם יש סימנים לקשיי ראייה?</p>
              <div className="flex gap-2">
                {["כן","לא"].map(v => <button key={v} className={ob(A.vis_sym === v)} onClick={() => upd("vis_sym", v)}>{v}</button>)}
              </div>
            </div>
          )}
        </div>
        <div className="mb-5">
          <p className="text-sm text-gray-500 mb-2">האם נעשתה בדיקת שמיעה?</p>
          <div className="flex gap-2 mb-2">
            {["כן","לא"].map(v => <button key={v} className={ob(A.hearing === v)} onClick={() => upd("hearing", v)}>{v}</button>)}
          </div>
          {A.hearing === "לא" && (
            <div className="pr-4 border-r-2 border-blue-200 mt-2">
              <p className="text-sm text-gray-500 mb-2">האם יש סימנים לקשיי שמיעה?</p>
              <div className="flex gap-2">
                {["כן","לא"].map(v => <button key={v} className={ob(A.hear_sym === v)} onClick={() => upd("hear_sym", v)}>{v}</button>)}
              </div>
            </div>
          )}
        </div>

        {/* שינה ואכילה */}
        <div className="text-xs font-bold text-[#2c3e7a] mb-3 pb-1 border-b-2 border-[#e8eef6]">😴 שינה ואכילה</div>
        <div className="mb-4">
          <p className="text-sm text-gray-500 mb-2">האם יש קשיי שינה?</p>
          <div className="flex gap-2 mb-2">
            {["כן","לא"].map(v => <button key={v} className={ob(A.sleep === v)} onClick={() => upd("sleep", v)}>{v}</button>)}
          </div>
          {A.sleep === "כן" && (
            <div className="pr-4 border-r-2 border-blue-200 mt-2 space-y-3">
              <div>
                <p className="text-sm text-gray-500 mb-2">קושי בהירדמות?</p>
                <div className="flex gap-2">
                  {["כן","לא"].map(v => <button key={v} className={ob(A.sleep_fall === v)} onClick={() => upd("sleep_fall", v)}>{v}</button>)}
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-2">קושי באיכות השינה?</p>
                <div className="flex gap-2">
                  {["כן","לא"].map(v => <button key={v} className={ob(A.sleep_qual === v)} onClick={() => upd("sleep_qual", v)}>{v}</button>)}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="mb-4">
          <p className="text-sm text-gray-500 mb-2">האם יש קשיי אכילה?</p>
          <div className="flex gap-2 mb-2">
            {["כן","לא"].map(v => <button key={v} className={ob(A.eating === v)} onClick={() => upd("eating", v)}>{v}</button>)}
          </div>
          {A.eating === "כן" && (
            <div className="pr-4 border-r-2 border-blue-200 mt-2 space-y-3">
              <div>
                <p className="text-sm text-gray-500 mb-2">בררנות באוכל?</p>
                <div className="flex gap-2">
                  {["כן","לא"].map(v => <button key={v} className={ob(A.eat_picky === v)} onClick={() => upd("eat_picky", v)}>{v}</button>)}
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-2">אכילה מוגזמת/מועטת?</p>
                <div className="flex gap-2">
                  {["כן","לא"].map(v => <button key={v} className={ob(A.eat_amount === v)} onClick={() => upd("eat_amount", v)}>{v}</button>)}
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-2">תלונות על כאבי בטן?</p>
                <div className="flex gap-2">
                  {["כן","לא"].map(v => <button key={v} className={ob(A.eat_belly === v)} onClick={() => upd("eat_belly", v)}>{v}</button>)}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="mb-4">
          <p className="text-sm text-gray-500 mb-2">האם יש קשיי גמילה / התרוקנות?</p>
          <div className="flex gap-2">
            {["כן","לא"].map(v => <button key={v} className={ob(A.toilet === v)} onClick={() => upd("toilet", v)}>{v}</button>)}
          </div>
        </div>
        <div className="mb-2">
          <p className="text-sm text-gray-500 mb-2">האם הילד/ה עצמאי/ת בלבוש ורחצה?</p>
          <div className="flex gap-2">
            {["כן","לא"].map(v => <button key={v} className={ob(A.indep === v)} onClick={() => upd("indep", v)}>{v}</button>)}
          </div>
        </div>
      </Card>

      <div className="mt-4">
        <button onClick={handleNext}
          className="px-8 py-3 bg-gradient-to-r from-[#2c3e7a] to-[#4a6fa5] text-white rounded-full font-bold text-sm shadow-md hover:opacity-90 transition-all">
          המשך ←
        </button>
        {showErr && (
          <p className="text-red-500 text-sm font-semibold mt-3">⛔ יש למלא גיל, כיתה ומגדר לפני המשך</p>
        )}
      </div>
    </div>
  );
}

// ── p-areas ───────────────────────────────────────────────────────────────────
const AREA_OPTS = ["כלל לא","מעט","הרבה","הרבה מאוד"];

function PageAreas({ A, setA, onNext, onBack }: { A: Ans; setA: (a: Ans) => void; onNext: (a: Ans) => void; onBack: () => void }) {
  const age   = parseInt(A._age) || 0;
  const grpV  = gg(A);
  const showDev = (age > 0 && age < 7) || grpV === "ga" || A.toilet === "כן";

  function selArea(key: string, val: string) {
    setA({ ...A, [key]: val });
  }

  const areas = [
    { key:"a_emo", title:"בעיות רגשיות",        desc:"חרדות, לחצים, דימוי עצמי, מצב רוח, התמכרות" },
    ...(showDev ? [{ key:"a_dev", title:"בעיות התפתחותיות", desc:"גמילה, הרטבה, מוטוריקה, ויסות חושי" }] : []),
    { key:"a_aca", title:"בעיות לימודיות",       desc:"קריאה, כתיבה, ריכוז, לקויות למידה" },
    { key:"a_beh", title:"בעיות התנהגותיות",     desc:"התנגדויות, הצקות, אלימות" },
    { key:"a_soc", title:"בעיות חברתיות",        desc:"קושי בחברה, ביישנות, דחייה חברתית" },
  ];

  return (
    <div>
      <Card>
        <StepTag>שלב 2 מתוך 3</StepTag>
        <StepQ>תחומי הקושי העיקריים</StepQ>
        <StepHint>דרג את רמת הקושי בכל תחום</StepHint>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {areas.map(({ key, title, desc }) => (
            <div key={key}
              className={`bg-[#f7f9fc] border-2 rounded-xl p-4 transition-all ${A[key] && A[key] !== "כלל לא" ? "border-[#2c3e7a]" : "border-[#e0e8f4]"}`}>
              <div className="text-sm font-bold text-[#1a2a3a] mb-1">{title}</div>
              <div className="text-xs text-gray-400 mb-3 leading-relaxed">{desc}</div>
              <div className="flex gap-1.5 flex-wrap">
                {AREA_OPTS.map(opt => (
                  <button key={opt}
                    className={`px-2.5 py-1 border-[1.5px] rounded-2xl text-xs font-medium transition-all cursor-pointer ${A[key] === opt ? "bg-[#2c3e7a] text-white border-[#2c3e7a]" : "bg-white text-[#3a4a5a] border-[#d0dae8] hover:border-[#4a6fa5]"}`}
                    onClick={() => selArea(key, opt)}>{opt}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
      <NavRow onBack={onBack} onNext={() => onNext(A)} />
    </div>
  );
}

// ── Shared: GA interests ──────────────────────────────────────────────────────
const GA_INT_LIST = [
  { key:"ga_int_art",    label:"🎨 אומנות" },
  { key:"ga_int_music",  label:"🎵 מוזיקה" },
  { key:"ga_int_move",   label:"🏃 תנועה" },
  { key:"ga_int_drama",  label:"🎭 דרמה" },
  { key:"ga_int_biblio", label:"📖 ביבליותרפיה — סיפור" },
  { key:"ga_int_garden", label:"🌱 גינון" },
  { key:"ga_int_animal", label:"🐾 בע\"ח" },
];

// Block used in p-q1-ga, p-q2-grade (ga), p-ga-traits
function GaConsentBlock({ A, setA, onDone }: {
  A: Ans; setA:(a:Ans)=>void; onDone:(a:Ans)=>void;
}) {
  const emoLvl = A.a_emo || "";
  const veryHigh = emoLvl === "הרבה מאוד";
  function pick(key: string, val: any) { const n={...A,[key]:val}; setA(n); return n; }
  return (
    <div>
      <p className="text-base font-bold text-[#1a2a3a] mb-3">האם הילד מסכים לטיפול?</p>
      <div className="flex gap-3 mb-4">
        <button className={`flex-1 py-3 text-base font-bold rounded-xl border-2 transition-all ${A.ga_consent==="כן"?"bg-[#2c3e7a] text-white border-[#2c3e7a]":"bg-white border-[#d0dae8] text-[#3a4a5a] hover:border-[#4a6fa5]"}`}
          onClick={() => { const n=pick("ga_consent","כן"); if(veryHigh) onDone(n); }}>כן</button>
        <button className={`flex-1 py-3 text-base font-bold rounded-xl border-2 transition-all ${A.ga_consent==="לא"?"bg-[#2c3e7a] text-white border-[#2c3e7a]":"bg-white border-[#d0dae8] text-[#3a4a5a] hover:border-[#4a6fa5]"}`}
          onClick={() => pick("ga_consent","לא")}>לא</button>
      </div>

      {A.ga_consent === "לא" && (
        <div>
          <p className="text-sm font-semibold text-[#1a2a3a] mb-3">האם הילד יסכים לטיפול יחד עם אחד ההורים?</p>
          <div className="flex gap-3">
            {["כן","לא"].map(v=>(
              <button key={v} className={`flex-1 py-3 text-base font-bold rounded-xl border-2 transition-all ${A.ga_consent_parent===v?"bg-[#2c3e7a] text-white border-[#2c3e7a]":"bg-white border-[#d0dae8] text-[#3a4a5a] hover:border-[#4a6fa5]"}`}
                onClick={() => { const n={...A,ga_consent_parent:v}; setA(n); onDone(n); }}>{v}</button>
            ))}
          </div>
        </div>
      )}

      {A.ga_consent === "כן" && !veryHigh && (
        <div>
          <p className="text-sm font-semibold text-[#1a2a3a] mb-3">סמן את כל התחומים בהם ייתכן שילדך יתעניין:</p>
          <div className="flex gap-2 flex-wrap mb-5">
            {GA_INT_LIST.map(({key,label})=>(
              <button key={key} className={cb(!!A[key])}
                onClick={()=>setA({...A,[key]:A[key]?undefined:true})}>{label}</button>
            ))}
          </div>
          <button onClick={()=>onDone(A)}
            className="px-8 py-3 bg-gradient-to-r from-[#2c3e7a] to-[#4a6fa5] text-white rounded-full font-bold text-sm shadow-md hover:opacity-90">המשך ←</button>
        </div>
      )}
    </div>
  );
}

// ── p-q1 ─────────────────────────────────────────────────────────────────────
function PageQ1({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack:()=>void }) {
  function pickScale(v: number) {
    const n = {...A, q1:v};
    setA(n);
    onNext(n);
  }
  return (
    <div>
      <Card>
        <EqNum n={1}/>
        <StepTag>שאלה 1 מתוך 10 — רגשי</StepTag>
        <StepQ>ילדך חש דאגות/לחצים מתמשכים</StepQ>
        <StepHint>1 = כלל לא  |  10 = בעוצמה גבוהה מאוד</StepHint>
        <div className="flex justify-between text-xs text-gray-400 mb-2"><span>כלל לא</span><span>בעוצמה גבוהה</span></div>
        <div className="flex gap-1.5 flex-wrap">
          {[1,2,3,4,5,6,7,8,9,10].map(n=>(
            <button key={n} className={sb(A.q1===n)} onClick={()=>pickScale(n)}>{n}</button>
          ))}
        </div>

        {(A.q1||0) >= 4 && (
          <div className="mt-5 pt-4 border-t border-dashed border-[#d0dae8]">
            <p className="text-sm text-gray-500 mb-2">האם הילד/ה סובל/ת מכאבים כרוניים (כאבי בטן/ראש)?</p>
            <div className="flex gap-2 mb-3">
              {["כן","לא"].map(v=>(
                <button key={v} className={ob(A.q1_pain===v)} onClick={()=>setA({...A,q1_pain:v})}>{v}</button>
              ))}
            </div>
            {A.q1_pain === "כן" && (
              <div>
                <p className="text-sm text-gray-500 mb-2">האם נשללו בעיות רפואיות?</p>
                <div className="flex gap-2">
                  {["כן","לא"].map(v=>(
                    <button key={v} className={ob(A.q1_med_clear===v)} onClick={()=>setA({...A,q1_med_clear:v})}>{v}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
      <NavRow onBack={onBack} onNext={()=>onNext(A)} />
    </div>
  );
}

// ── p-aq ─────────────────────────────────────────────────────────────────────
const AQ_ITEMS = [
  {key:"aq1",  label:"1. תחושת פחד עזה"},
  {key:"aq2",  label:"2. קושי בנשימה / הרגשת חנק"},
  {key:"aq3",  label:"3. זיעה יתירה"},
  {key:"aq4",  label:"4. חוסר נוחות / כאבים בחזה"},
  {key:"aq5",  label:"5. בחילה / צורך להקיא"},
  {key:"aq6",  label:"6. סחרחורת או ניתוק"},
  {key:"aq7",  label:"7. חשש מאובדן שליטה"},
  {key:"aq8",  label:"8. מצוקה מופרזת בהיפרדות מהורים"},
  {key:"aq9",  label:"9. התנגדות / קושי לצאת מהבית"},
  {key:"aq10", label:"10. ביעותי לילה חוזרים"},
];
function PageAQ({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack:()=>void }) {
  return (
    <div>
      <Card>
        <StepTag>🔍 שאלות משלימות</StepTag>
        <StepQ>10 סעיפים — 1 = כלל לא | 2 = לפעמים | 3 = לעיתים קרובות</StepQ>
        <SubCard>
          {AQ_ITEMS.map(({key,label})=>(
            <div key={key}>
              <div className="text-sm font-medium text-[#2a3a4a] mb-2">{label}</div>
              <div className="flex gap-2">
                {[1,2,3].map(n=>(
                  <button key={n} className={so(A[key]===n)} onClick={()=>setA(updAQ(A,key,n))}>{n}</button>
                ))}
              </div>
            </div>
          ))}
        </SubCard>
      </Card>
      <NavRow onBack={onBack} onNext={()=>onNext(A)} />
    </div>
  );
}

// ── p-aq-grade ────────────────────────────────────────────────────────────────
function PageAQGrade({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack:()=>void }) {
  const grp = gg(A);
  const aqTot = A.aq_tot || 0;

  // BV: after selecting motivation
  function bvMotPick(m: number) {
    const n = {...A, aq_mot_bv: m};
    setA(n);
    if (m === 1) onNext(n); // auto-advance when motivation=1
  }

  return (
    <div>
      <Card>
        <StepTag>חרדה — שאלות לפי כיתה</StepTag>
        <StepQ>שאלות משלימות</StepQ>

        {/* גן עד כיתה א׳ */}
        {grp === "ga" && (
          <GradeBlock title="🏫 גן עד כיתה א׳">
            <p className="text-sm text-gray-500">הממצאים יוצגו בדוח הסופי. ניתן להמשיך.</p>
          </GradeBlock>
        )}

        {/* כיתות ב׳–ו׳ */}
        {grp === "bv" && (
          <GradeBlock title="📚 כיתות ב׳–ו׳">
            <p className="text-sm text-gray-500 mb-2">מה רמת המוטיבציה של הילד לטיפול? [1–7]</p>
            <div className="flex gap-1.5 flex-wrap mb-3">
              {[1,2,3,4,5,6,7].map(n=>(
                <button key={n} className={sb(A.aq_mot_bv===n)} onClick={()=>bvMotPick(n)}>{n}</button>
              ))}
            </div>
            {/* מוטיבציה 3-7 + חרדה נמוכה (עד 20): שאל ורבאליות */}
            {(A.aq_mot_bv||0) >= 2 && aqTot <= 20 && (
              <div className="mt-3">
                <p className="text-sm text-gray-500 mb-2">עד כמה ילדך הינו וורבאלי ויודע לשתף אחרים בשיחה ביחס לבני גילו? [1–5]</p>
                <div className="flex gap-1.5 flex-wrap">
                  {[1,2,3,4,5].map(n=>(
                    <button key={n} className={sb(A.aq_verbal_bv===n)}
                      onClick={()=>{ const nA={...A,aq_verbal_bv:n}; setA(nA); onNext(nA); }}>{n}</button>
                  ))}
                </div>
              </div>
            )}
            {/* מוטיבציה 3-7 + חרדה גבוהה (21+): שאל תרגול */}
            {(A.aq_mot_bv||0) >= 2 && aqTot > 20 && (
              <div className="mt-3">
                <p className="text-sm text-gray-500 mb-2">עד כמה יש לילד יכולת ומוטיבציה לתרגל כלים בזמן הפנוי? [1–7]</p>
                <div className="flex gap-1.5 flex-wrap">
                  {[1,2,3,4,5,6,7].map(n=>(
                    <button key={n} className={sb(A.aq_prac_bv===n)}
                      onClick={()=>{ const nA={...A,aq_prac_bv:n}; setA(nA); onNext(nA); }}>{n}</button>
                  ))}
                </div>
              </div>
            )}
          </GradeBlock>
        )}

        {/* כיתות ז׳–י"ב */}
        {grp === "zy" && (
          <GradeBlock title='🎓 כיתות ז׳–י"ב'>
            {aqTot > 13 && (
              <div>
                <p className="text-sm text-gray-500 mb-2">מה רמת המוטיבציה של הילד לטיפול? [1–7]</p>
                <div className="flex gap-1.5 flex-wrap mb-3">
                  {[1,2,3,4,5,6,7].map(n=>(
                    <button key={n} className={sb(A.aq_mot_zy===n)}
                      onClick={()=>{ const nA={...A,aq_mot_zy:n}; setA(nA); if(n===1) onNext(nA); }}>{n}</button>
                  ))}
                </div>
                {(A.aq_mot_zy||0) >= 2 && (
                  <div>
                    <p className="text-sm text-gray-500 mb-2">עד כמה יש לילד יכולת ומוטיבציה לתרגל כלים בזמן הפנוי? [1–7]</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {[1,2,3,4,5,6,7].map(n=>(
                        <button key={n} className={sb(A.aq_prac===n)}
                          onClick={()=>{ const nA={...A,aq_prac:n}; setA(nA); onNext(nA); }}>{n}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </GradeBlock>
        )}
      </Card>
      <NavRow onBack={onBack} onNext={()=>onNext(A)} />
    </div>
  );
}

// ── p-q1-ga ───────────────────────────────────────────────────────────────────
function PageQ1GA({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack:()=>void }) {
  return (
    <div>
      <Card>
        <StepTag>שאלות לפי כיתה — גן עד כיתה א׳</StepTag>
        <StepQ>שאלות משלימות לגיל הצעיר</StepQ>
        <GaConsentBlock A={A} setA={setA} onDone={onNext} />
      </Card>
      <NavRow onBack={onBack} showBack={true} />
    </div>
  );
}

// ── p-q2 ─────────────────────────────────────────────────────────────────────
function PageQ2({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack:()=>void }) {
  return (
    <div>
      <Card>
        <EqNum n={2}/>
        <StepTag>שאלה 2 מתוך 10 — רגשי</StepTag>
        <StepQ>הילד/ה חש/ה כי "אינו/ה שווה" או אינו/ה מוערך/ת</StepQ>
        <StepHint>1 = כלל לא  |  10 = בעוצמה גבוהה מאוד</StepHint>
        <div className="flex justify-between text-xs text-gray-400 mb-2"><span>כלל לא</span><span>בעוצמה גבוהה</span></div>
        <div className="flex gap-1.5 flex-wrap">
          {[1,2,3,4,5,6,7,8,9,10].map(n=>(
            <button key={n} className={sb(A.q2===n)} onClick={()=>{ const nA={...A,q2:n}; setA(nA); onNext(nA); }}>{n}</button>
          ))}
        </div>
      </Card>
      <NavRow onBack={onBack} onNext={()=>onNext(A)} />
    </div>
  );
}

// ── p-q2-grade ────────────────────────────────────────────────────────────────
function PageQ2Grade({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack:()=>void }) {
  const grp = gg(A);
  const gaAlreadyFilled = A.ga_consent !== undefined;
  return (
    <div>
      <Card>
        <StepTag>דימוי עצמי — שאלות לפי כיתה</StepTag>
        <StepQ>שאלות משלימות</StepQ>

        {grp === "ga" && (
          <GradeBlock title="🏫 גן עד כיתה א׳">
            {gaAlreadyFilled
              ? <p className="text-sm text-gray-500">פרטי ההסכמה כבר מולאו — ממשיכים לשאלה הבאה.</p>
              : <GaConsentBlock A={A} setA={setA} onDone={onNext} />
            }
          </GradeBlock>
        )}

        {grp === "bv" && (
          <GradeBlock title="📚 כיתות ב׳–ו׳">
            <p className="text-sm text-gray-500 mb-2">מה רמת המוטיבציה לטיפול? [1–7]</p>
            <div className="flex gap-1.5 flex-wrap">
              {[1,2,3,4,5,6,7].map(n=>(
                <button key={n} className={sb(A.q2_mot===n)}
                  onClick={()=>{ const nA={...A,q2_mot:n}; setA(nA); onNext(nA); }}>{n}</button>
              ))}
            </div>
          </GradeBlock>
        )}

        {grp === "zy" && (
          <GradeBlock title='🎓 כיתות ז׳–י"ב'>
            <p className="text-sm text-gray-500">הממצאים יוצגו בדוח הסופי. ניתן להמשיך.</p>
          </GradeBlock>
        )}
      </Card>
      <NavRow onBack={onBack} onNext={()=>onNext(A)} />
    </div>
  );
}

// ── p-q3 ─────────────────────────────────────────────────────────────────────
function PageQ3({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack:()=>void }) {
  return (
    <div>
      <Card>
        <EqNum n={3}/>
        <StepTag>שאלה 3 מתוך 10 — רגשי</StepTag>
        <StepQ>מצב רוח ירוד או עצוב</StepQ>
        <StepHint>1 = כלל לא  |  10 = בעוצמה גבוהה מאוד</StepHint>
        <div className="flex justify-between text-xs text-gray-400 mb-2"><span>כלל לא</span><span>בעוצמה גבוהה</span></div>
        <div className="flex gap-1.5 flex-wrap">
          {[1,2,3,4,5,6,7,8,9,10].map(n=>(
            <button key={n} className={sb(A.q3===n)} onClick={()=>{ const nA={...A,q3:n}; setA(nA); onNext(nA); }}>{n}</button>
          ))}
        </div>
      </Card>
      <NavRow onBack={onBack} onNext={()=>onNext(A)} />
    </div>
  );
}

// ── p-mq ─────────────────────────────────────────────────────────────────────
const MQ_ITEMS = [
  {key:"mq1", label:"1. תחושה מתמשכת של עצב או עצבנות"},
  {key:"mq2", label:"2. אובדן עניין בפעילויות שנהנה בעבר"},
  {key:"mq3", label:"3. שינויים משמעותיים במשקל/תיאבון"},
  {key:"mq4", label:"4. בעיות שינה (נדודים או שינה יתרה)"},
  {key:"mq5", label:"5. חוסר מנוחה או האטה פסיכומוטורית"},
  {key:"mq6", label:"6. עייפות / חוסר אנרגיה"},
  {key:"mq7", label:"7. תחושות חוסר ערך / אשמה מופרזת"},
  {key:"mq8", label:"8. ירידה ביכולת חשיבה / ריכוז / החלטיות"},
  {key:"mq9", label:"9. מחשבות חוזרות על מוות"},
];
function PageMQ({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack:()=>void }) {
  return (
    <div>
      <Card>
        <StepTag>שאלון מצב רוח</StepTag>
        <StepQ>שאלון מצב רוח — 9 סעיפים</StepQ>
        <StepHint>כן / לא לכל סעיף</StepHint>
        <SubCard>
          {MQ_ITEMS.map(({key,label})=>(
            <div key={key}>
              <div className="text-sm font-medium text-[#2a3a4a] mb-2">{label}</div>
              <div className="flex gap-2">
                {["כן","לא"].map(v=>(
                  <button key={v} className={so(A[key]===v)} onClick={()=>setA(updMQ(A,key,v))}>{v}</button>
                ))}
              </div>
            </div>
          ))}
        </SubCard>
      </Card>
      <NavRow onBack={onBack} onNext={()=>onNext(A)} />
    </div>
  );
}

// ── p-mq-sui ─────────────────────────────────────────────────────────────────
function PageMQSui({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack:()=>void }) {
  return (
    <div>
      <Card>
        <StepTag>מצב רוח — אובדנות</StepTag>
        <StepQ>האם קיימות מחשבות אובדניות חוזרות?</StepQ>
        <StepHint>או ניסיונות אובדניים בעבר</StepHint>
        <YNRow val={A.q3_sui||""} onChange={v=>{ const nA={...A,q3_sui:v}; setA(nA); onNext(nA); }} />
      </Card>
      <NavRow onBack={onBack} />
    </div>
  );
}

// ── p-q4 ─────────────────────────────────────────────────────────────────────
function PageQ4({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack:()=>void }) {
  return (
    <div>
      <Card>
        <EqNum n={4}/>
        <StepTag>שאלה 4 מתוך 10 — רגשי</StepTag>
        <StepQ>סימנים להתמכרות לחומרים / התנהגויות</StepQ>
        <StepHint>משחקי מחשב, אלכוהול, סמים, הימורים, פורנו</StepHint>
        <YNRow val={A.q4||""} onChange={v=>{ const nA={...A,q4:v}; setA(nA); onNext(nA); }} />
      </Card>
      <NavRow onBack={onBack} />
    </div>
  );
}

// ── p-q4-types ────────────────────────────────────────────────────────────────
function PageQ4Types({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack:()=>void }) {
  function toggle(key: string) { setA({...A,[key]:A[key]?undefined:true}); }
  return (
    <div>
      <Card>
        <StepTag>סוג ההתמכרות</StepTag>
        <StepQ>אילו סוגי התמכרות קיימים?</StepQ>
        <StepHint>ניתן לבחור יותר מאחד, לאחר מכן לחץ המשך</StepHint>
        <div className="flex gap-2 flex-wrap">
          <button className={cb(!!A.ad_s)} onClick={()=>toggle("ad_s")}>💊 חומרים (סמים/אלכוהול)</button>
          <button className={cb(!!A.ad_g)} onClick={()=>toggle("ad_g")}>🎮 משחקי מחשב</button>
          <button className={cb(!!A.ad_b)} onClick={()=>toggle("ad_b")}>🎰 הימורים</button>
          <button className={cb(!!A.ad_o)} onClick={()=>toggle("ad_o")}>📱 אחר</button>
        </div>
      </Card>
      <NavRow onBack={onBack} onNext={()=>onNext(A)} />
    </div>
  );
}

// ── p-q4-s ────────────────────────────────────────────────────────────────────
const AS_ITEMS = [
  {key:"as1", label:"1. שימוש בכמויות גדולות יותר מהמתוכנן"},
  {key:"as2", label:"2. רצון / ניסיונות כושלים להפסיק"},
  {key:"as3", label:"3. תשוקה עזה לחומר"},
  {key:"as4", label:"4. כישלון בהתחייבויות בגלל השימוש"},
  {key:"as5", label:"5. ויתור על פעילויות חברתיות"},
  {key:"as6", label:"6. תסמיני גמילה בהפסקה"},
];
function PageQ4S({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack:()=>void }) {
  return (
    <div>
      <Card>
        <StepTag>שאלון חומרים ממכרים</StepTag>
        <StepQ>שאלון חומרים — 6 סעיפים</StepQ>
        <StepHint>כן / לא לכל סעיף</StepHint>
        <SubCard>
          {AS_ITEMS.map(({key,label})=>(
            <div key={key}>
              <div className="text-sm font-medium text-[#2a3a4a] mb-2">{label}</div>
              <div className="flex gap-2">
                {["כן","לא"].map(v=>(
                  <button key={v} className={so(A[key]===v)} onClick={()=>setA(updAddict(A,key,v,"s"))}>{v}</button>
                ))}
              </div>
            </div>
          ))}
        </SubCard>
      </Card>
      <NavRow onBack={onBack} onNext={()=>onNext(A)} />
    </div>
  );
}

// ── p-q4-g ────────────────────────────────────────────────────────────────────
const AG_ITEMS = [
  {key:"ag1", label:"1. עיסוק יתר במשחקים מחוץ לזמן המשחק"},
  {key:"ag2", label:"2. עצבנות/חרדה/כעס כשאין גישה"},
  {key:"ag3", label:"3. צורך לשחק זמן הולך וגדל"},
  {key:"ag4", label:"4. ניסיונות כושלים לצמצם"},
  {key:"ag5", label:"5. הזנחת לימודים/חברה"},
  {key:"ag6", label:"6. שקרים על מידת המשחק"},
  {key:"ag7", label:"7. שימוש במשחקים לבריחה מרגשות שליליים"},
];
function PageQ4G({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack:()=>void }) {
  return (
    <div>
      <Card>
        <StepTag>שאלון גיימינג</StepTag>
        <StepQ>שאלון משחקי מחשב — 7 סעיפים</StepQ>
        <StepHint>כן / לא לכל סעיף</StepHint>
        <SubCard>
          {AG_ITEMS.map(({key,label})=>(
            <div key={key}>
              <div className="text-sm font-medium text-[#2a3a4a] mb-2">{label}</div>
              <div className="flex gap-2">
                {["כן","לא"].map(v=>(
                  <button key={v} className={so(A[key]===v)} onClick={()=>setA(updAddict(A,key,v,"g"))}>{v}</button>
                ))}
              </div>
            </div>
          ))}
        </SubCard>
      </Card>
      <NavRow onBack={onBack} onNext={()=>onNext(A)} />
    </div>
  );
}

// ── p-q4-b ────────────────────────────────────────────────────────────────────
const AB_ITEMS = [
  {key:"agl1", label:"1. עיסוק יתר בהימורים — מחשבות מתמשכות"},
  {key:"agl2", label:"2. צורך להמר בסכומים גדלים"},
  {key:"agl3", label:"3. ניסיונות כושלים להפסיק"},
  {key:"agl4", label:"4. הימור לבריחה מרגשות שליליים"},
  {key:"agl5", label:"5. שקרים על מידת ההימורים"},
  {key:"agl6", label:"6. סיכון בקשרים/לימודים"},
  {key:"agl7", label:"7. הסתמכות על אחרים לסיוע כלכלי"},
];
function PageQ4B({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack:()=>void }) {
  return (
    <div>
      <Card>
        <StepTag>שאלון הימורים</StepTag>
        <StepQ>שאלון הימורים — 7 סעיפים</StepQ>
        <StepHint>כן / לא לכל סעיף</StepHint>
        <SubCard>
          {AB_ITEMS.map(({key,label})=>(
            <div key={key}>
              <div className="text-sm font-medium text-[#2a3a4a] mb-2">{label}</div>
              <div className="flex gap-2">
                {["כן","לא"].map(v=>(
                  <button key={v} className={so(A[key]===v)} onClick={()=>setA(updAddict(A,key,v,"b"))}>{v}</button>
                ))}
              </div>
            </div>
          ))}
        </SubCard>
      </Card>
      <NavRow onBack={onBack} onNext={()=>onNext(A)} />
    </div>
  );
}

// ── p-q4-ctrl ─────────────────────────────────────────────────────────────────
function PageQ4Ctrl({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack:()=>void }) {
  return (
    <div>
      <Card>
        <StepTag>התמכרות — שליטה</StepTag>
        <StepQ>עד כמה הילד/ה בשליטה על ההתנהגות?</StepQ>
        <StepHint>1 = כלל לא בשליטה  |  5 = בשליטה מלאה</StepHint>
        <div className="flex gap-2 flex-wrap">
          {[1,2,3,4,5].map(n=>(
            <button key={n} className={sb(A.q4_ctrl===n)}
              onClick={()=>{ const nA={...A,q4_ctrl:n}; setA(nA); onNext(nA); }}>{n}</button>
          ))}
        </div>
      </Card>
      <NavRow onBack={onBack} onNext={()=>onNext(A)} />
    </div>
  );
}

// ── p-q5 ─────────────────────────────────────────────────────────────────────
function PageQ5({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack:()=>void }) {
  return (
    <div>
      <Card>
        <EqNum n={5}/>
        <StepTag>שאלה 5 מתוך 10 — רגשי</StepTag>
        <StepQ>סימנים לסימפטומים טורדניים / מעשים כפייתיים</StepQ>
        <StepHint>ברוב הימים, שבועיים רצופים לפחות</StepHint>
        <YNRow val={A.q5||""} onChange={v=>{ const nA={...A,q5:v}; setA(nA); onNext(nA); }} />
      </Card>
      <NavRow onBack={onBack} />
    </div>
  );
}

// ── p-oq ─────────────────────────────────────────────────────────────────────
const OQ_ITEMS = [
  {key:"oq1", label:"1. בודק/ת שוב ושוב דברים ולא בטוח"},
  {key:"oq2", label:"2. מחשבות רעות שלא ניתן להפסיק"},
  {key:"oq3", label:"3. אוסף דברים רבים עד הפרעה לשגרה"},
  {key:"oq4", label:"4. שוטף שוב ושוב ידיים / איבר"},
  {key:"oq5", label:"5. מתעצבן אם דברים לא במקום הנכון"},
  {key:"oq6", label:"6. צריך לספור בזמן ביצוע משימות"},
];
function PageOQ({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack:()=>void }) {
  return (
    <div>
      <Card>
        <StepTag>שאלון</StepTag>
        <StepQ>שאלון — 6 סעיפים</StepQ>
        <StepHint>1 = אף פעם  |  2 = לפעמים  |  3 = תמיד</StepHint>
        <SubCard>
          {OQ_ITEMS.map(({key,label})=>(
            <div key={key}>
              <div className="text-sm font-medium text-[#2a3a4a] mb-2">{label}</div>
              <div className="flex gap-2">
                {[1,2,3].map(n=>(
                  <button key={n} className={so(A[key]===n)} onClick={()=>setA(updOQ(A,key,n))}>{n}</button>
                ))}
              </div>
            </div>
          ))}
        </SubCard>
      </Card>
      <NavRow onBack={onBack} onNext={()=>onNext(A)} />
    </div>
  );
}

// ── p-oq-grade ────────────────────────────────────────────────────────────────
function PageOQGrade({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack:()=>void }) {
  const grp = gg(A);
  return (
    <div>
      <Card>
        <StepTag>OCD — שאלות לפי כיתה</StepTag>
        <StepQ>שאלות משלימות</StepQ>
        {grp === "ga" && (
          <GradeBlock title="🏫 גן עד כיתה א׳">
            <p className="text-sm text-gray-500">המשך למילוי השאלון — הממצאים יוצגו בדוח הסופי.</p>
          </GradeBlock>
        )}
        {grp === "bv" && (
          <GradeBlock title="📚 כיתות ב׳–ו׳">
            <p className="text-sm text-gray-500 mb-2">עד כמה יש יכולת לתרגל כלים? [1–7]</p>
            <div className="flex gap-1.5 flex-wrap">
              {[1,2,3,4,5,6,7].map(n=>(
                <button key={n} className={sb(A.oq_prac===n)}
                  onClick={()=>{ const nA={...A,oq_prac:n}; setA(nA); onNext(nA); }}>{n}</button>
              ))}
            </div>
          </GradeBlock>
        )}
        {grp === "zy" && (
          <GradeBlock title='🎓 כיתות ז׳–י"ב'>
            <p className="text-sm text-gray-500">המשך למילוי השאלון — הממצאים יוצגו בדוח הסופי.</p>
          </GradeBlock>
        )}
      </Card>
      <NavRow onBack={onBack} onNext={()=>onNext(A)} />
    </div>
  );
}

// ── p-q6 ─────────────────────────────────────────────────────────────────────
function PageQ6({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack:()=>void }) {
  return (
    <div>
      <Card>
        <EqNum n={6}/>
        <StepTag>שאלה 6 מתוך 10 — רגשי</StepTag>
        <StepQ>חווה אירוע טראומטי</StepQ>
        <StepHint>תאונה, פיגוע, שוד, רעידת אדמה וכד׳</StepHint>
        <YNRow val={A.q6||""} onChange={v=>{ const nA={...A,q6:v}; setA(nA); onNext(nA); }} />
      </Card>
      <NavRow onBack={onBack} />
    </div>
  );
}

// ── p-tq ─────────────────────────────────────────────────────────────────────
const TQ_ITEMS = [
  {key:"tq1",  label:"1. מחשבות/תמונות מטרידות \"קופצות\" לראשו"},
  {key:"tq2",  label:"2. חלומות רעים / סיוטי לילה"},
  {key:"tq3",  label:"3. תחושות בגוף כשנזכר (הזעה, דופק מהיר)"},
  {key:"tq4",  label:"4. מנסה להתרחק מכל מה שמזכיר את האירוע"},
  {key:"tq5",  label:"5. פחות עניין בפעילויות שנהג לעשות"},
  {key:"tq6",  label:"6. לא מצליח להיזכר בחלקים חשובים"},
  {key:"tq7",  label:"7. מבטא רגשות חזקים (פחד, כעס, אשמה)"},
  {key:"tq8",  label:"8. קופצני / נבהל בקלות"},
  {key:"tq9",  label:"9. עושה דברים שיכולים לפגוע בו"},
  {key:"tq10", label:"10. מאוד זהיר / נשמר מפני סכנות"},
];
function PageTQ({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack:()=>void }) {
  return (
    <div>
      <Card>
        <StepTag>שאלון טראומה</StepTag>
        <StepQ>שאלון טראומה — 10 סעיפים</StepQ>
        <p className="text-sm font-bold text-red-800 mb-1">ענו על השאלות הבאות בהתייחס לחודש האחרון:</p>
        <StepHint>0 = כלל לא  |  4 = כמעט תמיד (חודש אחרון)</StepHint>
        <SubCard>
          {TQ_ITEMS.map(({key,label})=>(
            <div key={key}>
              <div className="text-sm font-medium text-[#2a3a4a] mb-2">{label}</div>
              <div className="flex gap-2">
                {[0,1,2,3,4].map(n=>(
                  <button key={n} className={so(A[key]===n)} onClick={()=>setA(updTQ(A,key,n))}>{n}</button>
                ))}
              </div>
            </div>
          ))}
        </SubCard>
      </Card>
      <NavRow onBack={onBack} onNext={()=>onNext(A)} />
    </div>
  );
}

// ── p-q7 ─────────────────────────────────────────────────────────────────────
function PageQ7({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack:()=>void }) {
  return (
    <div>
      <Card>
        <EqNum n={7}/>
        <StepTag>שאלה 7 מתוך 10 — רגשי</StepTag>
        <StepQ>ראה/שמע דברים שאינם קיימים, או אמונות מוזרות / חשדות</StepQ>
        <YNRow val={A.q7||""} onChange={v=>{ const nA={...A,q7:v}; setA(nA); onNext(nA); }} />
      </Card>
      <NavRow onBack={onBack} />
    </div>
  );
}

// ── p-pq ─────────────────────────────────────────────────────────────────────
// Shortened prodromal questionnaire — 6 items (from PQ-16), yes/no
// Covers core CAARMS/PACE domains: auditory & visual hallucinations, paranoia,
// thought disorder, reality testing confusion, thought broadcasting
const PQ_ITEMS = [
  {key:"pq5",  label:"1. קרה לי ששמעתי קולות של אנשים, לחישות או דיבורים כאשר אנשים אחרים אמרו שהם לא שומעים כלום"},
  {key:"pq16", label:"2. ראיתי דברים שאנשים אחרים לא יכולים לראות"},
  {key:"pq7",  label:"3. אני מרגיש/ה לפעמים שלאחרים יש משהו נגדי"},
  {key:"pq11", label:"4. קרה לי שהייתי מבולבל/ת או לא בטוח/ה האם משהו שחוויתי היה אמיתי או דמיוני"},
  {key:"pq13", label:"5. המחשבות שלי כל כך חזקות לעיתים, שאני כמעט ושומע/ת אותן"},
  {key:"pq8",  label:"6. לפעמים אני מרגיש/ה שאני לא שולט/ת על הרעיונות ועל המחשבות שלי"},
];
function PagePQ({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack:()=>void }) {
  return (
    <div>
      <Card>
        <StepTag>שאלון</StepTag>
        <StepQ>שאלון — 6 סעיפים</StepQ>
        <p className="text-sm font-bold text-red-800 mb-1">יש למלא יחד עם הילד</p>
        <StepHint>כן / לא לכל סעיף</StepHint>
        <SubCard>
          {PQ_ITEMS.map(({key,label})=>(
            <div key={key}>
              <div className="text-sm font-medium text-[#2a3a4a] mb-2">{label}</div>
              <div className="flex gap-2">
                {["כן","לא"].map(v=>(
                  <button key={v} className={so(A[key]===v)} onClick={()=>setA(updPQ(A,key,v))}>{v}</button>
                ))}
              </div>
            </div>
          ))}
        </SubCard>
      </Card>
      <NavRow onBack={onBack} onNext={()=>onNext(A)} />
    </div>
  );
}

// ── p-q8 ─────────────────────────────────────────────────────────────────────
function PageQ8({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack:()=>void }) {
  return (
    <div>
      <Card>
        <EqNum n={8}/>
        <StepTag>שאלה 8 מתוך 10 — רגשי</StepTag>
        <StepQ>קשיים בנוגע לאכילה</StepQ>
        <StepHint>ירידה במשקל, השמנה, או הקאות רצוניות</StepHint>
        <YNRow val={A.q8||""} onChange={v=>{ const nA={...A,q8:v}; setA(nA); onNext(nA); }} />
      </Card>
      <NavRow onBack={onBack} />
    </div>
  );
}

// ── p-eq ─────────────────────────────────────────────────────────────────────
function PageEQ({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack:()=>void }) {
  const age = parseInt(A._age) || 0;
  const under12 = age === 0 || age < 12;
  return (
    <div>
      <Card>
        <StepTag>🍽️ שאלות על הרגלי אכילה</StepTag>
        <StepHint>לפי גיל הילד/ה</StepHint>

        {under12 ? (
          <>
            <SubCard>
              <div className="text-sm font-semibold text-[#2a3a4a] mb-3">🍽️ קשיי אכילה — הגבלה (עד גיל 12)</div>
              {[
                {key:"ea1", label:"1. ירידה משמעותית במשקל"},
                {key:"ea2", label:"2. סירוב לאכול / הגבלת אכילה"},
                {key:"ea3", label:"3. דפוסי אכילה טקסיים"},
                {key:"ea4", label:"4. עיכוב בצמיחה"},
              ].map(({key,label})=>(
                <div key={key}>
                  <div className="text-sm font-medium text-[#2a3a4a] mb-2">{label}</div>
                  <div className="flex gap-2">
                    {["כן","לא"].map(v=>(
                      <button key={v} className={so(A[key]===v)} onClick={()=>setA(updEQ(A,key,v))}>{v}</button>
                    ))}
                  </div>
                </div>
              ))}
            </SubCard>
            <SubCard>
              <div className="text-sm font-semibold text-[#2a3a4a] mb-3">🍽️ קשיי אכילה — אכילה מוגזמת (עד גיל 12)</div>
              {[
                {key:"ea5", label:"1. אפיזודות חוזרות של אכילה מוגזמת"},
                {key:"ea6", label:"2. התנהגויות מפצות (הקאה, משלשלים, צום)"},
                {key:"ea7", label:"3. אכילה מוגזמת לפחות פעם בשבוע / 3 חודשים"},
                {key:"ea8", label:"4. הערכה עצמית תלויה במשקל/צורת גוף"},
              ].map(({key,label})=>(
                <div key={key}>
                  <div className="text-sm font-medium text-[#2a3a4a] mb-2">{label}</div>
                  <div className="flex gap-2">
                    {["כן","לא"].map(v=>(
                      <button key={v} className={so(A[key]===v)} onClick={()=>setA(updEQ(A,key,v))}>{v}</button>
                    ))}
                  </div>
                </div>
              ))}
            </SubCard>
          </>
        ) : (
          <>
            <SubCard>
              <div className="text-sm font-semibold text-[#2a3a4a] mb-3">🍽️ קשיי אכילה — הגבלה (12+)</div>
              {[
                {key:"eb1", label:"1. הגבלה חמורה בצריכת מזון → משקל נמוך"},
                {key:"eb2", label:"2. פחד עז מעלייה במשקל"},
                {key:"eb3", label:"3. תפיסת גוף מעוותת / הכחשת חומרת המשקל"},
              ].map(({key,label})=>(
                <div key={key}>
                  <div className="text-sm font-medium text-[#2a3a4a] mb-2">{label}</div>
                  <div className="flex gap-2">
                    {["כן","לא"].map(v=>(
                      <button key={v} className={so(A[key]===v)} onClick={()=>setA(updEQ(A,key,v))}>{v}</button>
                    ))}
                  </div>
                </div>
              ))}
            </SubCard>
            <SubCard>
              <div className="text-sm font-semibold text-[#2a3a4a] mb-3">🍽️ קשיי אכילה — אכילה מוגזמת (12+)</div>
              {[
                {key:"eb4", label:"1. אכילה מוגזמת חוזרת בפרק זמן קצר"},
                {key:"eb5", label:"2. התנהגויות מפצות (הקאה, משלשלים)"},
                {key:"eb6", label:"3. אכילה מוגזמת לפחות פעם בשבוע / 3 חודשים"},
                {key:"eb7", label:"4. הערכה עצמית תלויה במשקל / צורת גוף"},
              ].map(({key,label})=>(
                <div key={key}>
                  <div className="text-sm font-medium text-[#2a3a4a] mb-2">{label}</div>
                  <div className="flex gap-2">
                    {["כן","לא"].map(v=>(
                      <button key={v} className={so(A[key]===v)} onClick={()=>setA(updEQ(A,key,v))}>{v}</button>
                    ))}
                  </div>
                </div>
              ))}
            </SubCard>
          </>
        )}
      </Card>
      <NavRow onBack={onBack} onNext={()=>onNext(A)} />
    </div>
  );
}

// ── p-q9 ─────────────────────────────────────────────────────────────────────
function PageQ9({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack:()=>void }) {
  return (
    <div>
      <Card>
        <EqNum n={9}/>
        <StepTag>שאלה 9 מתוך 10 — רגשי</StepTag>
        <StepQ>סימנים לחוסר יציבות ביחסים, קושי בוויסות רגשות ואימפולסיביות</StepQ>
        <YNRow val={A.q9||""} onChange={v=>{ const nA={...A,q9:v}; setA(nA); onNext(nA); }} />
      </Card>
      <NavRow onBack={onBack} />
    </div>
  );
}

// ── p-bq ─────────────────────────────────────────────────────────────────────
const BQ_ITEMS = [
  {key:"bq1", label:"1. מאמצים קיצוניים להימנע מנטישה"},
  {key:"bq2", label:"2. חוסר ביטחון משמעותי בדימוי העצמי"},
  {key:"bq3", label:"3. אימפולסיביות: סמים/נהיגה/אכילה/יחסי מין"},
  {key:"bq4", label:"4. חוסר יציבות רגשית, שינויים חדים"},
  {key:"bq5", label:"5. התפרצויות כעס לא פרופורציונליות"},
  {key:"bq6", label:"6. רגעים של נתק / חשיבה פרנואידית בלחץ"},
  {key:"bq7", label:"7. יחסים אינטנסיביים ובלתי יציבים"},
];
function PageBQ({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack:()=>void }) {
  return (
    <div>
      <Card>
        <StepTag>שאלון ויסות רגשות ויחסים בינאישיים</StepTag>
        <StepQ>שאלון ויסות רגשות ויחסים בינאישיים — 7 סעיפים</StepQ>
        <StepHint>כן / לא לכל סעיף</StepHint>
        <SubCard>
          {BQ_ITEMS.map(({key,label})=>(
            <div key={key}>
              <div className="text-sm font-medium text-[#2a3a4a] mb-2">{label}</div>
              <div className="flex gap-2">
                {["כן","לא"].map(v=>(
                  <button key={v} className={so(A[key]===v)} onClick={()=>setA(updBQ(A,key,v))}>{v}</button>
                ))}
              </div>
            </div>
          ))}
        </SubCard>
      </Card>
      <NavRow onBack={onBack} onNext={()=>onNext(A)} />
    </div>
  );
}

// ── p-q10 ────────────────────────────────────────────────────────────────────
function PageQ10({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack:()=>void }) {
  return (
    <div>
      <Card>
        <EqNum n={10}/>
        <StepTag>שאלה 10 מתוך 10 — רגשי</StepTag>
        <StepQ>קשיים רגשיים אחרים שלא עלו בשאלון</StepQ>
        <StepHint>ענה רק אם לא ענית חיובי באף שאלה קודמת</StepHint>
        <YNRow val={A.q10||""} onChange={v=>{ const nA={...A,q10:v}; setA(nA); onNext(nA); }} />
      </Card>
      <NavRow onBack={onBack} />
    </div>
  );
}

// ── p-q10-par ────────────────────────────────────────────────────────────────
function PageQ10Par({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack:()=>void }) {
  return (
    <div>
      <Card>
        <StepTag>קשיים כלליים</StepTag>
        <StepQ>האם הקושי קשור לקשר עם אחד ההורים?</StepQ>
        <YNRow val={A.q10_par||""} onChange={v=>{ const nA={...A,q10_par:v}; setA(nA); onNext(nA); }} />
      </Card>
      <NavRow onBack={onBack} />
    </div>
  );
}

// ── p-q10-grade ──────────────────────────────────────────────────────────────
function PageQ10Grade({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack:()=>void }) {
  const grp = gg(A);
  function toggleInt(key: string) {
    setA({ ...A, [key]: !A[key] });
  }
  return (
    <div>
      <Card>
        <StepTag>קשיים כלליים — לפי כיתה</StepTag>
        <StepQ>שאלות משלימות</StepQ>

        {grp === "ga" && (
          <GradeBlock title="🏫 גן עד כיתה א׳">
            <AlertBox cls="info" txt="📋 פנייה לטיפול דיאדי" />
          </GradeBlock>
        )}

        {grp === "bv" && (
          <GradeBlock title="📚 כיתות ב׳–ו׳">
            <p className="text-sm text-gray-500 mb-2">מה רמת המוטיבציה לטיפול? [1–7]</p>
            <div className="flex gap-1.5 flex-wrap">
              {[1,2,3,4,5,6,7].map(n=>(
                <button key={n} className={sb(A.q10_mot===n)}
                  onClick={()=>{ const nA={...A,q10_mot:n}; setA(nA); onNext(nA); }}>{n}</button>
              ))}
            </div>
          </GradeBlock>
        )}

        {grp === "zy" && (
          <GradeBlock title='🎓 כיתות ז׳–י"ב'>
            <p className="text-sm text-gray-500 mb-2">עד כמה ילדך ורבאלי/ת? [1–5]</p>
            <div className="flex gap-1.5 flex-wrap mb-4">
              {[1,2,3,4,5].map(n=>(
                <button key={n} className={sb(A.q10_verbal===n)}
                  onClick={()=>{ const nA={...A,q10_verbal:n}; setA(nA); onNext(nA); }}>{n}</button>
              ))}
            </div>
            <p className="text-sm text-gray-500 mb-2">תחומי עניין לטיפול (ניתן לבחור כמה):</p>
            <div className="flex gap-2 flex-wrap">
              {[
                {key:"int_art",    label:"אומנות"},
                {key:"int_music",  label:"מוזיקה"},
                {key:"int_move",   label:"תנועה"},
                {key:"int_drama",  label:"פסיכודרמה"},
                {key:"int_biblio", label:"ביבליותרפיה"},
                {key:"int_animal", label:'טיפול בבע"ח'},
              ].map(({key,label})=>(
                <button key={key} className={cb(!!A[key])} onClick={()=>toggleInt(key)}>{label}</button>
              ))}
            </div>
          </GradeBlock>
        )}
      </Card>
      <NavRow onBack={onBack} onNext={()=>onNext(A)} />
    </div>
  );
}

// ── p-ga-traits ───────────────────────────────────────────────────────────────
function PageGaTraits({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack:()=>void }) {
  const showNoPath  = A.ga_consent === "לא";
  const showYesPath = A.ga_consent === "כן";
  function toggleInt(key: string) {
    setA({ ...A, [key]: !A[key] });
  }
  return (
    <div>
      <Card>
        <StepTag>שאלון מאפייני הילד — גן עד כיתה א׳</StepTag>
        <StepQ>שאלות לצורך קביעת סוג הטיפול</StepQ>

        <div className="mb-5">
          <p className="text-sm font-bold text-[#1a2a3a] mb-3">האם הילד מסכים לטיפול?</p>
          <YNRow val={A.ga_consent||""} onChange={v=>setA({...A, ga_consent:v, ga_consent_parent:undefined})} />
        </div>

        {showNoPath && (
          <div className="mb-5">
            <p className="text-sm font-semibold text-[#1a2a3a] mb-3">האם הילד יסכים לטיפול יחד עם אחד ההורים?</p>
            <YNRow val={A.ga_consent_parent||""} onChange={v=>setA({...A, ga_consent_parent:v})} />
          </div>
        )}

        {showYesPath && (
          <div>
            <p className="text-sm font-semibold text-[#1a2a3a] mb-3">סמן את כל התחומים בהם ייתכן שילדך יתעניין:</p>
            <div className="flex gap-2 flex-wrap">
              {[
                {key:"ga_int_art",    label:"🎨 אומנות"},
                {key:"ga_int_music",  label:"🎵 מוזיקה"},
                {key:"ga_int_move",   label:"🏃 תנועה"},
                {key:"ga_int_drama",  label:"🎭 דרמה"},
                {key:"ga_int_biblio", label:"📖 ביבליותרפיה — סיפור"},
                {key:"ga_int_garden", label:"🌱 גינון"},
                {key:"ga_int_animal", label:'🐾 בע"ח'},
              ].map(({key,label})=>(
                <button key={key} className={cb(!!A[key])} onClick={()=>toggleInt(key)}>{label}</button>
              ))}
            </div>
          </div>
        )}
      </Card>
      <NavRow onBack={onBack} onNext={()=>onNext(A)} />
    </div>
  );
}

// ── p-dev-toilet ──────────────────────────────────────────────────────────────
function PageDevToilet({ A, setA, onNext, onBack }: PageProps) {
  const ttype   = A.dev_toilet_type || "";
  const showWet = (ttype === "ב" || ttype === "ד");
  return (
    <div>
      <Card>
        <StepTag>🟣 קשיים התפתחותיים</StepTag>
        <StepQ>1. האם כיום ישנם קשיים בגמילה / התרוקנות?</StepQ>
        <StepHint>כולל עצירות, בריחת שתן, בריחת צואה</StepHint>
        <YNRow val={A.dev_toilet||""} onChange={v => setA({...A, dev_toilet:v, dev_toilet_type:undefined, dev_wet_type:undefined})} />

        {A.dev_toilet === "כן" && (
          <SubCard>
            <p className="text-sm font-bold text-purple-900 mb-3">האם הייתה גמילה מלאה בעבר של לפחות 3 חודשים?</p>
            <YNRow val={A.dev_toilet_past||""} onChange={v => setA({...A, dev_toilet_past:v})} />
            <div className="mt-4">
              <p className="text-sm font-bold text-purple-900 mb-3">מהו סוג הקושי בגמילה?</p>
              <div className="flex flex-col gap-2">
                {[{v:"א",l:"א. עצירות"},{v:"ב",l:"ב. בריחת שתן"},{v:"ג",l:"ג. בריחת צואה"},{v:"ד",l:"ד. בריחת שתן וצואה"}].map(({v,l}) => (
                  <button key={v} className={ob(ttype === v)} onClick={() => setA({...A, dev_toilet_type:v, dev_wet_type:undefined})}>{l}</button>
                ))}
              </div>
            </div>
            {showWet && (
              <div className="mt-4">
                <p className="text-sm font-bold text-purple-900 mb-3">האם מדובר על הרטבת יום / לילה / גם וגם?</p>
                <div className="flex flex-col gap-2">
                  {[{v:"יום",l:"הרטבת יום בלבד"},{v:"לילה",l:"הרטבת לילה בלבד"},{v:"גם וגם",l:"גם יום וגם לילה"}].map(({v,l}) => (
                    <button key={v} className={ob(A.dev_wet_type === v)} onClick={() => setA({...A, dev_wet_type:v})}>{l}</button>
                  ))}
                </div>
              </div>
            )}
          </SubCard>
        )}
      </Card>
      <NavRow onBack={onBack} onNext={() => onNext(A)} />
    </div>
  );
}

// ── p-dev-sensory ─────────────────────────────────────────────────────────────
const SENS_OVER_ITEMS = [
  "מביע חוסר נוחות בזמן פעילות ניקיון וטיפוח (תספורת, גזיזת ציפורניים, רחצה)",
  "מעדיף בגד ארוך כשחם או בגד קצר כשקר",
  "מגיב בתוקפנות או בתגובה רגשית חזקה כשנוגעים בו",
  "מתקשה לעמוד לאורך זמן בקרבת אנשים",
  "נמנע מטעמים / ריחות של מאכלים הכלולים בתפריט שגרתי של ילדים",
  "מגביל עצמו לטמפרטורה / מרקמים מסוימים של אוכל",
  "פוחד משהייה בגבהים",
  "נמנע מניתוק רגליים מהקרקע",
  "אינו יכול לעבוד כשיש רעש רקע (מאוורר, מקרר)",
  "מתקשה לסיים מטלות כשיש דיבורים ברקע",
];
const SENS_UNDER_ITEMS = [
  "נהנה מרעשים חזקים / משמיע רעשים וקולות כדי לשמוע אותם",
  "מחפש פעילות המערבת תנועה חזקה / חזרתית",
  "נוגע יותר מהרגיל באנשים / חפצים",
  "אינו שם לב כשגופו או פרצופו מלוכלכים",
  "אינו שם לב כשבגד אינו מונח נכון על גופו",
  "אינו מגיב כשמדברים אליו למרות ששמיעתו תקינה",
  "בעל אחיזה חלשה, דברים נופלים לו מהידיים",
  "נשען על מנת לתמוך בעצמו גם בזמן פעילות",
];

function PageDevSensory({ A, setA, onNext, onBack }: PageProps) {
  const showQs = A.dev_sensory === "כן";
  return (
    <div>
      <Card>
        <StepTag>🟣 קשיים התפתחותיים</StepTag>
        <StepQ>2. האם ישנם קשיים של ויסות חושי?</StepQ>
        <StepHint>תגובות חריגות לגירויים יומיומיים — רתיעה קיצונית מרעשים/מגע (רגישות-יתר) או חיפוש מתמיד אחר תנועה ועוצמה (תת-רגישות)</StepHint>
        <YNRow val={A.dev_sensory||""} onChange={v => setA({...A, dev_sensory:v})} />

        {showQs && (
          <>
            <GradeBlock title="א. שאלון רגישות יתר תחושתית">
              <div className="text-xs text-gray-500 mb-3">לכל שאלה: <strong>1 = תמיד</strong> | <strong>2 = לפעמים</strong> | <strong>3 = אף פעם</strong></div>
              {SENS_OVER_ITEMS.map((label, i) => {
                const k = `so${i+1}`;
                return (
                  <div key={k} className="mb-4">
                    <p className="text-sm text-gray-700 mb-1">{i+1}. {label}</p>
                    <div className="flex gap-2">
                      {[{v:1,l:"תמיד (1)"},{v:2,l:"לפעמים (2)"},{v:3,l:"אף פעם (3)"}].map(({v,l}) => (
                        <button key={v} className={so(A[k]===v)} onClick={() => setA({...A,[k]:v})}>{l}</button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </GradeBlock>
            <GradeBlock title="ב. שאלון תת-תגובתיות תחושתית">
              <div className="text-xs text-gray-500 mb-3">לכל שאלה: <strong>1 = תמיד</strong> | <strong>2 = לפעמים</strong> | <strong>3 = אף פעם</strong></div>
              {SENS_UNDER_ITEMS.map((label, i) => {
                const k = `su${i+1}`;
                return (
                  <div key={k} className="mb-4">
                    <p className="text-sm text-gray-700 mb-1">{i+1}. {label}</p>
                    <div className="flex gap-2">
                      {[{v:1,l:"תמיד (1)"},{v:2,l:"לפעמים (2)"},{v:3,l:"אף פעם (3)"}].map(({v,l}) => (
                        <button key={v} className={so(A[k]===v)} onClick={() => setA({...A,[k]:v})}>{l}</button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </GradeBlock>
          </>
        )}
      </Card>
      <NavRow onBack={onBack} onNext={() => onNext(A)} />
    </div>
  );
}

// ── p-acad ────────────────────────────────────────────────────────────────────
type PageProps = { A: Ans; setA: (a: Ans) => void; onNext: (a?: Ans) => void; onBack: () => void };

const ADHD_INATT = ["קושי בשמירה על ריכוז במשימות","קושי בארגון משימות","נטייה לאבד חפצים הנחוצים למשימה","הסחה קלה מרעשים/קולות","שכחה בביצוע משימות יומיומיות","קושי להקדיש תשומת לב לפרטים / טעויות מרובות"];
const ADHD_HYPER = ["תנועות ידיים/רגליים מוגברות, קושי לשבת במקום","קושי להמתין לתורו","נטייה להפריע לאחרים","ריצה/טיפוס במצבים לא מתאימים","נטייה לענות לפני השלמת השאלה","קושי לשחק בשקט"];

function AcadAdhdBlock({ prefix, A, setA }: { prefix: string; A: Ans; setA: (a: Ans) => void }) {
  function toggle(k: string) { setA({ ...A, [k]: !A[k] }); }
  return (
    <SubCard>
      <div className="text-sm font-bold text-amber-800 mb-2">📋 שאלון קשב (ADHD) — סמן את הסימנים הקיימים</div>
      <div className="text-xs font-semibold text-amber-700 mb-1">קשב:</div>
      {ADHD_INATT.map((label, i) => {
        const k = `${prefix}_ad${i+1}`;
        return <label key={k} className="flex items-center gap-2 text-sm text-gray-700 py-1 cursor-pointer"><input type="checkbox" checked={!!A[k]} onChange={() => toggle(k)} className="w-4 h-4" />{label}</label>;
      })}
      <div className="text-xs font-semibold text-amber-700 mt-3 mb-1">היפראקטיביות:</div>
      {ADHD_HYPER.map((label, i) => {
        const k = `${prefix}_ah${i+1}`;
        return <label key={k} className="flex items-center gap-2 text-sm text-gray-700 py-1 cursor-pointer"><input type="checkbox" checked={!!A[k]} onChange={() => toggle(k)} className="w-4 h-4" />{label}</label>;
      })}
    </SubCard>
  );
}

function PageAcad({ A, setA, onNext, onBack }: PageProps) {
  const grp = acadGg(A);

  // ── גן ──────────────────────────────────────────────────────────────────────
  if (grp === "gan") {
    return (
      <div>
        <Card>
          <StepTag>📚 קשיים לימודיים</StepTag>
          <StepQ>שאלות לגבי התפקוד הלימודי בגן</StepQ>
          <GradeBlock title="🏫 גילאי גן">
            {[
              {k:"gan_q1", q:"1. האם הגננת דיווחה/מזהה קשיים בזיהוי אותיות ומספרים ביחס לבני גילו?", subKey:"gan_q1_speech", subQ:"האם עבר אבחון קלינאית תקשורת?"},
              {k:"gan_q2", q:"2. האם ניכרים קשיים בזכירת צורות וצבעים ביחס לבני גילו?", subKey:"gan_q2_speech", subQ:"האם עבר אבחון קלינאית תקשורת?"},
            ].map(({k,q,subKey,subQ}) => (
              <div key={k} className="mb-4">
                <p className="text-sm font-semibold text-gray-800 mb-2">{q}</p>
                <YNRow val={A[k]||""} onChange={v => setA({...A,[k]:v})} />
                {A[k]==="כן" && <SubCard><p className="text-sm font-semibold text-blue-900 mb-2">{subQ}</p><YNRow val={A[subKey]||""} onChange={v => setA({...A,[subKey]:v})} /></SubCard>}
              </div>
            ))}
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-800 mb-2">3. האם ניכרים קשיים בחריזה או זיהוי צליל פותח ביחס לבני גילו?</p>
              <YNRow val={A.gan_q3||""} onChange={v => setA({...A, gan_q3:v})} />
            </div>
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-800 mb-2">4. האם ניכרים קשיים בביטוי עצמי, שליפת מילים ואוצר מילים ביחס לבני גילו?</p>
              <YNRow val={A.gan_q4||""} onChange={v => setA({...A, gan_q4:v})} />
            </div>
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-800 mb-2">5. האם הגננת דיווחה על קשיים באחזקת עיפרון או איכות ציור?</p>
              <YNRow val={A.gan_q5||""} onChange={v => setA({...A, gan_q5:v})} />
              {A.gan_q5==="כן" && <SubCard><p className="text-sm font-semibold text-blue-900 mb-2">האם עבר אבחון ריפוי בעיסוק?</p><YNRow val={A.gan_q5_ot||""} onChange={v => setA({...A, gan_q5_ot:v})} /></SubCard>}
            </div>
          </GradeBlock>
        </Card>
        <NavRow onBack={onBack} onNext={() => onNext(A)} />
      </div>
    );
  }

  // ── א-ג ──────────────────────────────────────────────────────────────────────
  if (grp === "ag") {
    const read = A.ag_read || "";
    const histYes = ["ag_h1","ag_h2","ag_h3","ag_h4","ag_h5","ag_h6"].filter(k => A[k]==="כן").length;
    const showReadFlow = read !== "" && read !== "לא";
    const showHist0 = showReadFlow && histYes === 0 && ["ag_h1","ag_h2","ag_h3","ag_h4","ag_h5","ag_h6"].every(k => A[k] !== undefined);
    const showHist12 = showReadFlow && histYes >= 1 && histYes <= 2 && ["ag_h1","ag_h2","ag_h3","ag_h4","ag_h5","ag_h6"].every(k => A[k] !== undefined);
    const showMotivRg = showHist0 && A.ag_read_motiv === "לא";
    const agMotTot = (A.ag_mot1||1)+(A.ag_mot2||1)+(A.ag_mot3||1);
    const showAgAdhd = showMotivRg && agMotTot <= 5;
    const speechMotiv = A.ag_speech_motiv || "";
    const speechMotivNo = showHist12 && A.ag_read_speech === "כן" && speechMotiv === "לא";
    const smotTot = (A.ag_smot1||1)+(A.ag_smot2||1)+(A.ag_smot3||1);
    const showSpeechAdhd = speechMotivNo && smotTot <= 5;

    return (
      <div>
        <Card>
          <StepTag>📚 קשיים לימודיים</StepTag>
          <StepQ>שאלות לגבי התפקוד הלימודי</StepQ>
          <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-3 mb-4 text-sm font-bold text-amber-900">
            💡 כדאי להתייעץ עם המחנכ/ת של הכיתה לפני המענה, או לענות יחד בטלפון.
          </div>
          <GradeBlock title="📖 כיתות א׳–ג׳">
            {/* שאלה 1: קריאה */}
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-800 mb-2">1. האם יש קושי בקריאה?</p>
              <div className="flex gap-2 flex-wrap">
                {["לא","5% הכי מתקשה בכיתה","10% הכי מתקשה בכיתה","30% הכי מתקשה בכיתה"].map(opt => (
                  <button key={opt} className={ob(A.ag_read===opt)} onClick={() => setA({...A, ag_read:opt})}>{opt}</button>
                ))}
              </div>
              {showReadFlow && (
                <SubCard>
                  <div className="text-sm font-bold text-blue-900 mb-2">📋 שאלון רקע התפתחותי</div>
                  <div className="text-xs text-gray-500 mb-2">ענה כן/לא על כל סעיף</div>
                  {[
                    {k:"ag_h1",q:"א. האם היה קושי בהתפתחות השפתית בגילאי שנה–שנתיים?"},
                    {k:"ag_h2",q:"ב. האם המורה דיווחה על קשיים בזיהוי אותיות ומספרים?"},
                    {k:"ag_h3",q:"ג. האם הגננת דיווחה על קשיים בזכירת צורות וצבעים?"},
                    {k:"ag_h4",q:"ד. האם הגננת דיווחה על קשיים בחריזה או זיהוי צליל פותח?"},
                    {k:"ag_h5",q:"ה. האם הגננת דיווחה על קשיים בביטוי עצמי ואוצר מילים?"},
                    {k:"ag_h6",q:"ו. האם ישנו קושי או לקות בדיבור?"},
                  ].map(({k,q}) => (
                    <div key={k} className="mb-3">
                      <p className="text-sm text-gray-700 mb-1">{q}</p>
                      <YNRow val={A[k]||""} onChange={v => setA({...A,[k]:v})} />
                    </div>
                  ))}
                  {/* hist=0 → מוטיבציה */}
                  {showHist0 && (
                    <div className="mt-3">
                      <p className="text-sm font-semibold text-emerald-900 mb-2">האם יש מוטיבציה ללמידה ומוכנות לתרגול קריאה?</p>
                      <YNRow val={A.ag_read_motiv||""} onChange={v => setA({...A, ag_read_motiv:v})} />
                      {showMotivRg && (
                        <div className="mt-3 space-y-3">
                          <div className="text-sm font-bold text-rose-800">📋 שאלון מוטיבציה וקשיים רגשיים בלמידה</div>
                          <div className="text-xs text-gray-500">דרג: 1=ללא קושי | 2=קושי בינוני | 3=קושי משמעותי</div>
                          {[{k:"ag_mot1",q:"א. הילד/ה מתקשה להאמין ביכולתו להצליח בלמידה"},{k:"ag_mot2",q:"ב. חרדה ופחד מכישלון במהלך למידה או מבחנים"},{k:"ag_mot3",q:"ג. חוסר מוטיבציה ואי-נכונות להתמודד עם אתגרי למידה"}].map(({k,q}) => (
                            <div key={k}><div className="text-sm text-gray-700 mb-1">{q}</div><div className="flex gap-2">{[1,2,3].map(n => <button key={n} className={so(A[k]===n)} onClick={() => setA({...A,[k]:n})}>{n}</button>)}</div></div>
                          ))}
                          {showAgAdhd && <AcadAdhdBlock prefix="ag" A={A} setA={setA} />}
                        </div>
                      )}
                    </div>
                  )}
                  {/* hist=1-2 → קלינאית */}
                  {showHist12 && (
                    <div className="mt-3">
                      <p className="text-sm font-semibold text-indigo-900 mb-2">האם עבר אבחון/טיפול קלינאית תקשורת?</p>
                      <YNRow val={A.ag_read_speech||""} onChange={v => setA({...A, ag_read_speech:v})} />
                      {A.ag_read_speech==="כן" && (
                        <div className="mt-3">
                          <p className="text-sm font-semibold text-emerald-900 mb-2">האם יש מוטיבציה ללמידה ומוכנות לתרגול קריאה?</p>
                          <YNRow val={speechMotiv} onChange={v => setA({...A, ag_speech_motiv:v})} />
                          {speechMotiv==="לא" && (
                            <div className="mt-3 space-y-3">
                              <div className="text-sm font-bold text-rose-800">📋 שאלון מוטיבציה וקשיים רגשיים בלמידה</div>
                              <div className="text-xs text-gray-500">דרג: 1=ללא קושי | 2=קושי בינוני | 3=קושי משמעותי</div>
                              {[{k:"ag_smot1",q:"א. הילד/ה מתקשה להאמין ביכולתו להצליח בלמידה"},{k:"ag_smot2",q:"ב. חרדה ופחד מכישלון במהלך למידה או מבחנים"},{k:"ag_smot3",q:"ג. חוסר מוטיבציה ואי-נכונות להתמודד עם אתגרי למידה"}].map(({k,q}) => (
                                <div key={k}><div className="text-sm text-gray-700 mb-1">{q}</div><div className="flex gap-2">{[1,2,3].map(n => <button key={n} className={so(A[k]===n)} onClick={() => setA({...A,[k]:n})}>{n}</button>)}</div></div>
                              ))}
                              {showSpeechAdhd && <AcadAdhdBlock prefix="ag" A={A} setA={setA} />}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </SubCard>
              )}
            </div>
            {/* שאלה 2: כתיבה */}
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-800 mb-2">2. האם יש קושי בכתיבה? <span className="font-normal text-xs">(לא כולל שגיאות כתיב)</span></p>
              <YNRow val={A.ag_write||""} onChange={v => setA({...A, ag_write:v})} />
              {A.ag_write==="כן" && <SubCard><p className="text-sm font-semibold text-blue-900 mb-2">האם עבר אבחון/טיפול בריפוי בעיסוק?</p><YNRow val={A.ag_write_ot||""} onChange={v => setA({...A, ag_write_ot:v})} /></SubCard>}
            </div>
            {/* שאלה 3: הבנה */}
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-800 mb-2">3. האם יש קושי בהבנה בע"פ בשיעור?</p>
              <YNRow val={A.ag_comp||""} onChange={v => setA({...A, ag_comp:v})} />
            </div>
            {/* שאלה 4: חשבון */}
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-800 mb-2">4. האם יש קושי בחשבון?</p>
              <div className="flex gap-2 flex-wrap">
                {["לא","5% הכי מתקשה בכיתה","10% הכי מתקשה בכיתה","30% הכי מתקשה בכיתה"].map(opt => (
                  <button key={opt} className={ob(A.ag_math===opt)} onClick={() => setA({...A, ag_math:opt})}>{opt}</button>
                ))}
              </div>
            </div>
          </GradeBlock>
        </Card>
        <NavRow onBack={onBack} onNext={() => onNext(A)} />
      </div>
    );
  }

  // ── ד-ו ──────────────────────────────────────────────────────────────────────
  if (grp === "dv") {
    const histYes = ["dv_h1","dv_h2","dv_h3","dv_h4","dv_h5"].filter(k => A[k]==="כן").length;
    const showReadFlow = A.dv_read === "כן";
    const histAllAnswered = showReadFlow && ["dv_h1","dv_h2","dv_h3","dv_h4","dv_h5"].every(k => A[k] !== undefined);
    const showHist0 = histAllAnswered && histYes === 0;
    const showHist12 = histAllAnswered && histYes >= 1 && histYes <= 2;
    const showMotivRg = showHist0 && A.dv_read_motiv === "לא";
    const dvMotTot = (A.dv_mot1||1)+(A.dv_mot2||1)+(A.dv_mot3||1);
    const showDvReadAdhd = showMotivRg && dvMotTot <= 5;
    const smotivNo = showHist12 && A.dv_read_speech === "כן" && A.dv_speech_motiv === "לא";
    const dvSmotTot = (A.dv_smot1||1)+(A.dv_smot2||1)+(A.dv_smot3||1);
    const showDvSpeechAdhd = smotivNo && dvSmotTot <= 5;

    return (
      <div>
        <Card>
          <StepTag>📚 קשיים לימודיים</StepTag>
          <StepQ>שאלות לגבי התפקוד הלימודי</StepQ>
          <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-3 mb-4 text-sm font-bold text-amber-900">
            💡 כדאי להתייעץ עם המחנכ/ת של הכיתה לפני המענה, או לענות יחד בטלפון.
          </div>
          <GradeBlock title="📗 כיתות ד׳–ו׳">
            {/* שאלה 1: קריאה */}
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-800 mb-2">1. האם יש קושי בקריאה?</p>
              <YNRow val={A.dv_read||""} onChange={v => setA({...A, dv_read:v})} />
              {showReadFlow && (
                <SubCard>
                  <div className="text-sm font-bold text-blue-900 mb-2">📋 שאלון רקע התפתחותי</div>
                  <div className="text-xs text-gray-500 mb-2">ענה כן/לא על כל סעיף</div>
                  {[{k:"dv_h1",q:"א. האם היה קושי בהתפתחות השפתית בגילאי שנה–שנתיים?"},{k:"dv_h2",q:"ב. האם הגננת/המורה דיווחה על קשיים בזיהוי אותיות ומספרים?"},{k:"dv_h3",q:"ג. האם הגננת דיווחה על קשיים בזכירת צורות וצבעים?"},{k:"dv_h4",q:"ד. האם הגננת דיווחה על קשיים בחריזה או זיהוי צליל פותח?"},{k:"dv_h5",q:"ה. האם הגננת דיווחה על קשיים בביטוי עצמי ואוצר מילים?"}].map(({k,q}) => (
                    <div key={k} className="mb-3"><p className="text-sm text-gray-700 mb-1">{q}</p><YNRow val={A[k]||""} onChange={v => setA({...A,[k]:v})} /></div>
                  ))}
                  {showHist0 && (
                    <div className="mt-3">
                      <p className="text-sm font-semibold text-emerald-900 mb-2">האם יש מוטיבציה ללמידה ומוכנות לתרגול קריאה?</p>
                      <YNRow val={A.dv_read_motiv||""} onChange={v => setA({...A, dv_read_motiv:v})} />
                      {showMotivRg && (
                        <div className="mt-3 space-y-3">
                          <div className="text-sm font-bold text-rose-800">📋 שאלון מוטיבציה וקשיים רגשיים בלמידה</div>
                          <div className="text-xs text-gray-500">דרג: 1=ללא קושי | 2=קושי בינוני | 3=קושי משמעותי</div>
                          {[{k:"dv_mot1",q:"א. הילד/ה מתקשה להאמין ביכולתו להצליח בלמידה"},{k:"dv_mot2",q:"ב. חרדה ופחד מכישלון במהלך למידה או מבחנים"},{k:"dv_mot3",q:"ג. חוסר מוטיבציה ואי-נכונות להתמודד עם אתגרי למידה"}].map(({k,q}) => (
                            <div key={k}><div className="text-sm text-gray-700 mb-1">{q}</div><div className="flex gap-2">{[1,2,3].map(n => <button key={n} className={so(A[k]===n)} onClick={() => setA({...A,[k]:n})}>{n}</button>)}</div></div>
                          ))}
                          {showDvReadAdhd && <AcadAdhdBlock prefix="dv_read" A={A} setA={setA} />}
                        </div>
                      )}
                    </div>
                  )}
                  {showHist12 && (
                    <div className="mt-3">
                      <p className="text-sm font-semibold text-indigo-900 mb-2">האם עבר אבחון/טיפול קלינאית תקשורת?</p>
                      <YNRow val={A.dv_read_speech||""} onChange={v => setA({...A, dv_read_speech:v})} />
                      {A.dv_read_speech==="כן" && (
                        <div className="mt-3">
                          <p className="text-sm font-semibold text-emerald-900 mb-2">האם יש מוטיבציה ללמידה ומוכנות לתרגול קריאה?</p>
                          <YNRow val={A.dv_speech_motiv||""} onChange={v => setA({...A, dv_speech_motiv:v})} />
                          {A.dv_speech_motiv==="לא" && (
                            <div className="mt-3 space-y-3">
                              <div className="text-sm font-bold text-rose-800">📋 שאלון מוטיבציה וקשיים רגשיים בלמידה</div>
                              <div className="text-xs text-gray-500">דרג: 1=ללא קושי | 2=קושי בינוני | 3=קושי משמעותי</div>
                              {[{k:"dv_smot1",q:"א. הילד/ה מתקשה להאמין ביכולתו להצליח בלמידה"},{k:"dv_smot2",q:"ב. חרדה ופחד מכישלון במהלך למידה או מבחנים"},{k:"dv_smot3",q:"ג. חוסר מוטיבציה ואי-נכונות להתמודד עם אתגרי למידה"}].map(({k,q}) => (
                                <div key={k}><div className="text-sm text-gray-700 mb-1">{q}</div><div className="flex gap-2">{[1,2,3].map(n => <button key={n} className={so(A[k]===n)} onClick={() => setA({...A,[k]:n})}>{n}</button>)}</div></div>
                              ))}
                              {showDvSpeechAdhd && <AcadAdhdBlock prefix="dv_read" A={A} setA={setA} />}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </SubCard>
              )}
            </div>
            {/* שאלה 2: קשב עצמאי */}
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-800 mb-2">2. האם יש סימנים לקשיי קשב, ריכוז, היפראקטיביות או חולמנות?</p>
              <YNRow val={A.dv_adhd_yn||""} onChange={v => setA({...A, dv_adhd_yn:v})} />
              {A.dv_adhd_yn==="כן" && <AcadAdhdBlock prefix="dv" A={A} setA={setA} />}
            </div>
            {/* שאלה 3: כתיבה */}
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-800 mb-2">3. האם יש קושי בכתיבה?</p>
              <YNRow val={A.dv_write||""} onChange={v => setA({...A, dv_write:v})} />
              {A.dv_write==="כן" && <SubCard><p className="text-sm font-semibold text-blue-900 mb-2">האם עבר אבחון/טיפול בריפוי בעיסוק?</p><YNRow val={A.dv_write_ot||""} onChange={v => setA({...A, dv_write_ot:v})} /></SubCard>}
            </div>
            {/* שאלה 4: הבנה */}
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-800 mb-2">4. האם יש קושי בהבנה בשיעור?</p>
              <YNRow val={A.dv_comp||""} onChange={v => setA({...A, dv_comp:v})} />
            </div>
            {/* שאלה 5: חשבון */}
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-800 mb-2">5. האם יש קושי בחשבון?</p>
              <div className="flex gap-2 flex-wrap">
                {["לא","5% הכי נמוכים בכיתה","10% הכי נמוכים בכיתה","30% הכי נמוכים בכיתה"].map(opt => (
                  <button key={opt} className={ob(A.dv_math===opt)} onClick={() => setA({...A, dv_math:opt})}>{opt}</button>
                ))}
              </div>
            </div>
          </GradeBlock>
        </Card>
        <NavRow onBack={onBack} onNext={() => onNext(A)} />
      </div>
    );
  }

  // ── ז-ח / ט-יב ───────────────────────────────────────────────────────────────
  const p = grp;
  const gradeLabel = grp === "zh" ? "🎓 כיתות ז׳–ח׳" : "🏫 כיתות ט׳–י\"ב";
  const pctOpts4 = ["לא","5%","20%","מעל 20%"];
  const mathEngOpts = ["לא","10%","20%","מעל 20%"];
  return (
    <div>
      <Card>
        <StepTag>📚 קשיים לימודיים</StepTag>
        <StepQ>שאלות לגבי התפקוד הלימודי</StepQ>
        <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-3 mb-4 text-sm font-bold text-amber-900">
          💡 כדאי להתייעץ עם המחנכ/ת של הכיתה לפני המענה, או לענות יחד בטלפון.
        </div>
        <GradeBlock title={gradeLabel}>
          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-800 mb-2">1. רבי מלל — רמת ביצוע ביחס לכיתה</p>
            <div className="flex gap-2 flex-wrap">{pctOpts4.map(opt => <button key={opt} className={ob(A[p+"_verbal"]===opt)} onClick={() => setA({...A, [p+"_verbal"]:opt})}>{opt === "לא" ? "ללא קושי" : opt}</button>)}</div>
          </div>
          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-800 mb-2">2. מתמטיקה — רמת ביצוע ביחס לכיתה</p>
            <div className="flex gap-2 flex-wrap">{mathEngOpts.map(opt => <button key={opt} className={ob(A[p+"_math"]===opt)} onClick={() => setA({...A, [p+"_math"]:opt})}>{opt === "לא" ? "ללא קושי" : opt}</button>)}</div>
          </div>
          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-800 mb-2">3. אנגלית — רמת ביצוע ביחס לכיתה</p>
            <div className="flex gap-2 flex-wrap">{mathEngOpts.map(opt => <button key={opt} className={ob(A[p+"_eng"]===opt)} onClick={() => setA({...A, [p+"_eng"]:opt})}>{opt === "לא" ? "ללא קושי" : opt}</button>)}</div>
          </div>
          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-800 mb-2">4. האם יש סימנים לקשיי קשב, ריכוז, היפראקטיביות או חולמנות?</p>
            <YNRow val={A[p+"_adhd_yn"]||""} onChange={v => setA({...A, [p+"_adhd_yn"]:v})} />
            {A[p+"_adhd_yn"]==="כן" && <AcadAdhdBlock prefix={p} A={A} setA={setA} />}
          </div>
          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-800 mb-2">5. האם יש קושי בכתיבה?</p>
            <YNRow val={A[p+"_write"]||""} onChange={v => setA({...A, [p+"_write"]:v})} />
          </div>
          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-800 mb-2">6. האם יש קושי בהבנה בשיעור?</p>
            <YNRow val={A[p+"_comp"]||""} onChange={v => setA({...A, [p+"_comp"]:v})} />
          </div>
        </GradeBlock>
      </Card>
      <NavRow onBack={onBack} onNext={() => onNext(A)} />
    </div>
  );
}

// ── p-beh ─────────────────────────────────────────────────────────────────────
function PageBeh({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack:()=>void }) {
  function behSet(key: string, val: string) { setA(computeBehPlan({ ...A, [key]: val })); }
  const opts = ["לא","מעט","הרבה"];
  return (
    <div>
      <Card>
        <StepTag>🟠 קשיים התנהגותיים</StepTag>
        <StepQ>שאלות על קשיים התנהגותיים</StepQ>
        <StepHint>ענה על 3 השאלות — הפלט יינתן לפי רמת הקושי הגבוהה ביותר שסומנה</StepHint>
        {[
          { key:"beh1", label:"1. חוסר רצון להשתתף בלמידה ו/או הפרעות ודיבורים בשיעור" },
          { key:"beh2", label:"2. חוצפה כלפי צוות ההוראה" },
          { key:"beh3", label:"3. אלימות פיסית / מילולית מול חברים ו/או צוות ההוראה" },
        ].map(({ key, label }) => (
          <div key={key} className="mb-5 bg-[#e8f7ee] border-2 border-[#52b788] rounded-xl p-4">
            <p className="text-sm font-bold text-[#1b4332] mb-3">{label}</p>
            <div className="flex gap-2">
              {opts.map(o => (
                <button key={o} className={ob(A[key]===o)} onClick={() => behSet(key, o)}>{o}</button>
              ))}
            </div>
          </div>
        ))}
      </Card>
      <NavRow onBack={onBack} onNext={() => onNext(A)} />
    </div>
  );
}

// ── p-soc ─────────────────────────────────────────────────────────────────────
// Shortened social anxiety screen — 8 items, single scale 0–3
// Items selected to cover key DSM-5 domains for childhood social anxiety
const LSAS_ITEMS = [
  "לדבר מול כל הכיתה או לקרוא משהו בקול רם מול הכיתה",        // performance / public speaking
  "להרים יד ולענות על שאלה בשיעור",                             // performance / classroom
  "להתחיל שיחה עם ילד/ה שהוא/היא לא מכיר/ה היטב",              // peer initiation
  "להצטרף לקבוצת ילדים שכבר משחקים יחד",                       // group entry
  "להיכנס לחדר מלא ילדים שרובם לא מכירים אותו/ה",              // social exposure
  "לקבל ביקורת מהמורה או לטעות מול ילדים אחרים",               // fear of negative evaluation
  "לשוחח עם מבוגרים שאינם בני משפחה (כגון רופא, הורה של חבר/ה, שכן חדש)", // adult interaction
  "להשתתף בפעילות חברתית מחוץ לבית הספר (כגון חוג, מסיבה, תנועת נוער)",   // broad social participation
];

function needsSocTherapyMotiv(A: Ans): boolean {
  if ((A.aq_mot_bv || 0) > 0 || (A.aq_mot_zy || 0) > 0) return false;
  if (A.soc1 === "כן") return true;
  if (A.soc2 === "כן" && (A.soc2_sev || 0) >= 5) return true;
  if (A.soc3 === "כן") {
    const allComm = A.comm1 === "כן" && A.comm2 === "כן" && A.comm3 === "כן";
    const hasExtra = A.comm_rep === "כן" || A.comm_rigid === "כן" || A.comm_interest === "כן" || A.comm_sens === "כן";
    if (allComm && !hasExtra) return true;
    if (A.soc3_early === "לא") return true;
  }
  return false;
}

function PageSoc({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack:()=>void }) {
  const soc3Early = A.soc3_early || "";
  const allComm = A.comm1 === "כן" && A.comm2 === "כן" && A.comm3 === "כן";
  const grp = gg(A);
  const showSocDetails = A.soc1 === "כן" && (A.lsas_tot || 0) >= 8 && grp !== "ga";
  return (
    <div>
      <Card>
        <StepTag>🟣 קשיים חברתיים</StepTag>
        <StepQ>שאלות על קשיים חברתיים</StepQ>
        <StepHint>ענה על 3 השאלות — שאלות נוספות יפתחו לפי הצורך</StepHint>

        {/* soc1 — ביישנות / חרדה חברתית */}
        <div className="mb-5 bg-[#f3e8ff] border-2 border-[#9b59b6] rounded-xl p-4">
          <p className="text-sm font-bold text-[#4a1a6a] mb-3">1. האם מגלה סימנים של ביישנות, הימנעות וחשש מאינטראקציות חברתיות?</p>
          <div className="flex gap-3">
            {["לא","כן"].map(o => (
              <button key={o} className={ob(A.soc1===o)} onClick={() => setA({...A, soc1:o})}>{o}</button>
            ))}
          </div>
          {A.soc1 === "כן" && (
            <div className="mt-4 bg-[#ede0f7] rounded-xl p-4 border border-[#9b59b6]">
              <p className="text-xs text-[#6a3a8a] mb-1 font-semibold">דרג/י את עוצמת החרדה/מצוקה בכל מצב:</p>
              <p className="text-xs text-[#6a3a8a] mb-4">0 = כלל לא · 1 = מעט · 2 = הרבה · 3 = מאוד</p>
              <div className="space-y-4">
                {LSAS_ITEMS.map((item, i) => {
                  const n = i + 1;
                  return (
                    <div key={n} className="pb-3 border-b border-[#ddd6f3] last:border-0">
                      <p className="text-xs font-semibold text-[#2a1a4a] mb-2">{n}. {item}</p>
                      <div className="flex gap-2">
                        {[0,1,2,3].map(v => (
                          <button key={v} className={so(A[`lsas_a${n}`]===v)} onClick={() => setA(updLSAS(A,`lsas_a${n}`,v))}>{v}</button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              {(A.lsas_tot || 0) > 0 && (
                <p className="text-xs text-[#6a3a8a] font-bold mt-3">ציון כולל: {A.lsas_tot || 0} / 24</p>
              )}
            </div>
          )}
        </div>

        {/* soc2 — חיכוכים / מריבות */}
        <div className="mb-5 bg-[#f3e8ff] border-2 border-[#9b59b6] rounded-xl p-4">
          <p className="text-sm font-bold text-[#4a1a6a] mb-3">2. האם מגלה סימנים של חיכוכים ומריבות עם בני/בנות גילו?</p>
          <div className="flex gap-3">
            {["לא","כן"].map(o => (
              <button key={o} className={ob(A.soc2===o)} onClick={() => setA({...A, soc2:o})}>{o}</button>
            ))}
          </div>
          {A.soc2 === "כן" && (
            <div className="mt-3">
              <p className="text-sm font-semibold text-[#4a1a6a] mb-2">מה חומרת הקשיים? [1–6]</p>
              <div className="flex gap-1.5 flex-wrap">
                {[1,2,3,4,5,6].map(n => (
                  <button key={n} className={sb(A.soc2_sev===n)} onClick={() => setA({...A, soc2_sev:n})}>{n}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* soc3 — קשיי תקשורת */}
        <div className="mb-5 bg-[#f3e8ff] border-2 border-[#9b59b6] rounded-xl p-4">
          <p className="text-sm font-bold text-[#4a1a6a] mb-3">3. האם ישנם סימנים לקשיים בתקשורת בינו/ה לבין חבריו/הוריו?</p>
          <div className="flex gap-3">
            {["לא","כן"].map(o => (
              <button key={o} className={ob(A.soc3===o)}
                onClick={() => setA(o==="לא"
                  ? {...A, soc3:"לא", soc3_early:"", comm1:"", comm2:"", comm3:"", comm_rep:"", comm_rigid:"", comm_interest:"", comm_sens:""}
                  : {...A, soc3:"כן"})}>{o}</button>
            ))}
          </div>
          {A.soc3 === "כן" && (
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-sm font-semibold text-[#4a1a6a] mb-2">האם חלק מהסימנים החלו בגיל צעיר (3–4 ואילך)?</p>
                <div className="flex gap-3">
                  {["כן","לא"].map(o => (
                    <button key={o} className={ob(A.soc3_early===o)}
                      onClick={() => setA(o==="לא"
                        ? {...A, soc3_early:"לא", comm1:"", comm2:"", comm3:"", comm_rep:"", comm_rigid:"", comm_interest:"", comm_sens:""}
                        : {...A, soc3_early:"כן"})}>{o}</button>
                  ))}
                </div>
              </div>
              {soc3Early === "כן" && (
                <div className="bg-[#ede0f7] rounded-xl p-4 border border-[#9b59b6] space-y-3">
                  {[
                    { key:"comm1", label:"א. האם יש קושי בתגובה רגשית מותאמת לסיטואציה?", hint:"(למשל, תגובות מוגזמות או מוזרות ולא מתאימות למצב)" },
                    { key:"comm2", label:"ב. האם יש קושי בשימוש בתקשורת שאינה מילולית?", hint:"(קשר עין מוגבל, שפת גוף, מחוות, קריאת הבעות פנים של אחרים)" },
                    { key:"comm3", label:"ג. האם יש קושי ביצירה ותחזוקה של קשרים חברתיים?" },
                  ].map(({ key, label, hint }) => (
                    <div key={key}>
                      <p className="text-xs font-semibold text-[#2a1a4a] mb-1">{label}</p>
                      {hint && <p className="text-xs text-gray-500 mb-1">{hint}</p>}
                      <div className="flex gap-2">
                        {["כן","לא"].map(o => (
                          <button key={o} className={so(A[key]===o)} onClick={() => setA({...A, [key]:o})}>{o}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {allComm && (
                    <div className="border-t border-[#c084fc] pt-3">
                      <p className="text-xs font-bold text-[#4a1a6a] mb-3">במידה וכל 3 הסימנים קיימים — בדוק גם:</p>
                      {[
                        { key:"comm_rep",      label:"1. האם ישנה התנהגות חזרתית? (תנועות חוזרות, דיבור חזרתי)" },
                        { key:"comm_rigid",    label:"2. האם יש הצמדות לשגרה נוקשה וקושי להתמודד עם שינויים?" },
                        { key:"comm_interest", label:"3. האם יש תחומי עניין מוגזמים או מצומצמים מעבר לרגיל?" },
                        { key:"comm_sens",     label:"4. האם יש תגובתיות חריגה לגירויים חושיים? (רעש, מגע, אור וכד׳)" },
                      ].map(({ key, label }) => (
                        <div key={key} className="mb-2">
                          <p className="text-xs font-semibold text-[#2a1a4a] mb-1">{label}</p>
                          <div className="flex gap-2">
                            {["כן","לא"].map(o => (
                              <button key={o} className={so(A[key]===o)} onClick={() => setA({...A, [key]:o})}>{o}</button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* grade-aware therapy details for soc1 */}
        {showSocDetails && grp === "bv" && (
          <div className="mb-2 bg-[#f3e8ff] border-2 border-[#9b59b6] rounded-xl p-4">
            <p className="text-sm font-bold text-[#4a1a6a] mb-3">מה רמת המוטיבציה של הילד/ה לטיפול? [1–7]</p>
            <div className="flex gap-1.5 flex-wrap">
              {[1,2,3,4,5,6,7].map(n => (
                <button key={n} className={sb(A.soc_motiv_therapy===n)} onClick={() => setA({...A, soc_motiv_therapy:n})}>{n}</button>
              ))}
            </div>
          </div>
        )}
        {showSocDetails && grp === "zy" && (
          <div className="mb-2 bg-[#f3e8ff] border-2 border-[#9b59b6] rounded-xl p-4">
            <p className="text-sm font-bold text-[#4a1a6a] mb-3">עד כמה ילדך ורבאלי/ת ויודע/ת לשתף אחרים בשיחה? [1–5]</p>
            <div className="flex gap-1.5 flex-wrap mb-4">
              {[1,2,3,4,5].map(n => (
                <button key={n} className={sb(A.soc_verbal===n)} onClick={() => setA({...A, soc_verbal:n})}>{n}</button>
              ))}
            </div>
            <p className="text-sm text-gray-500 mb-2">תחומי עניין לטיפול (ניתן לבחור כמה):</p>
            <div className="flex gap-2 flex-wrap">
              {([
                {key:"int_art",    label:"אומנות"},
                {key:"int_music",  label:"מוזיקה"},
                {key:"int_move",   label:"תנועה"},
                {key:"int_drama",  label:"פסיכודרמה"},
                {key:"int_biblio", label:"ביבליותרפיה"},
                {key:"int_animal", label:'טיפול בבע"ח'},
              ] as {key:string,label:string}[]).map(({key,label}) => (
                <button key={key} className={cb(!!A[key])} onClick={() => setA({...A, [key]: !A[key]})}>{label}</button>
              ))}
            </div>
          </div>
        )}
      </Card>
      <NavRow onBack={onBack} onNext={() => onNext(A)} />
    </div>
  );
}

// ── p-result ──────────────────────────────────────────────────────────────────
const GRADE_LABELS: Record<string, string> = {
  "פעוט":"פעוט","גן3":"גן גיל 3","גן-טרום":"גן טרום חובה","גן":"גן חובה",
  "א":"כיתה א","ב":"כיתה ב","ג":"כיתה ג","ד":"כיתה ד","ה":"כיתה ה","ו":"כיתה ו",
  "ז":"כיתה ז","ח":"כיתה ח","ט":"כיתה ט","י":"כיתה י","יא":"כיתה יא","יב":"כיתה יב",
};
const AREA_LABELS: Record<string, string> = {
  a_emo:"רגשי", a_dev:"התפתחותי", a_aca:"לימודי", a_beh:"התנהגותי", a_soc:"חברתי",
};

// ── Kids matching helpers ─────────────────────────────────────────────────────
const KIDS_TREATMENT_MAP: { rx: RegExp; areas: string[] }[] = [
  { rx: /הדרכת הורים/,                  areas: ["הדרכת הורים"] },
  { rx: /טיפול דיאדי/,                  areas: ["טיפול דיאדי"] },
  { rx: /הבעה ויצירה/,                  areas: ["טיפול בהבעה ויצירה"] },
  { rx: /פסיכודינאמי|דינאמי/,           areas: ["טיפול דינאמי"] },
  { rx: /\bCBT\b/,                       areas: ["CBT"] },
  { rx: /EMDR/,                          areas: ["EMDR", "טיפול בטראומה"] },
  { rx: /\bCPT\b/,                       areas: ["טיפול בטראומה"] },
  { rx: /טיפול בטראומה/,                areas: ["טיפול בטראומה"] },
  { rx: /\bDBT\b/,                       areas: ["DBT"] },
  { rx: /התמכרויות/,                    areas: ["טיפול בהתמכרויות"] },
  { rx: /COG[-\s]?FUN/i,               areas: ["טיפול COG-FUN לקשיי קשב וריכוז"] },
  { rx: /ויסות חושי/,                   areas: ["ריפוי בעיסוק"] },
  { rx: /ריפוי בעיסוק/,                 areas: ["ריפוי בעיסוק"] },
  { rx: /קבוצה חברתית/,                areas: ["קבוצה חברתית"] },
  { rx: /טיפול תעסוקתי/,               areas: ["טיפול תעסוקתי"] },
];

function extractKidsTreatments(A: Ans): string[] {
  const allBoxes = [
    ...computeResults(A),
    ...computeAcadResults(A),
    ...computeDevResults(A),
    ...computeBehResults(A),
    ...computeSocResults(A),
  ];
  const found = new Set<string>();
  for (const box of allBoxes) {
    if (!box.txt.startsWith("✅")) continue;
    for (const { rx, areas } of KIDS_TREATMENT_MAP) {
      if (rx.test(box.txt)) areas.forEach(a => found.add(a));
    }
  }
  return Array.from(found);
}

function getKidsAgeGroups(A: Ans): string[] {
  const grp = gg(A);
  if (grp === "ga") return ["גיל הרך", "ילדים"];
  if (grp === "bv") return ["ילדים"];
  return ["נוער"];
}

const KIDS_ARRANGEMENTS = ["קופות החולים", "משרד הביטחון", "ביטוח לאומי", "ביטוחים פרטיים"] as const;
const KIDS_CULTURAL = ["היכרות עם העולם הדתי", "היכרות עם העולם החרדי", 'היכרות עם עולם הלהט"ב'] as const;

type KidsMatchResult = {
  id: string;
  full_name: string | null;
  gender: string | null;
  online: unknown;
  therapist_types: unknown;
  training_areas: unknown;
  regions: unknown;
  arrangements: unknown;
  bio: string | null;
  phone: string | null;
  email: string | null;
  profile_photo_url: string | null;
  match_score: number;
  personality_score: number | null;
  combined_score: number | null;
  match_reasons: string[];
};

function KidsMatchSection({ A }: { A: Ans }) {
  const [open, setOpen]               = useState(false);
  const [region, setRegion]           = useState("");
  const [online, setOnline]           = useState(false);
  const [gender, setGender]           = useState("");
  const [arrangements, setArrangements] = useState<string[]>([]);
  const [cultural, setCultural]       = useState<string[]>([]);
  const [language, setLanguage]       = useState("עברית");
  const [city, setCity]               = useState("");
  const [loading, setLoading]         = useState(false);
  const [results, setResults]         = useState<KidsMatchResult[]>([]);
  const [error, setError]             = useState("");
  const [searched, setSearched]       = useState(false);
  const [explainData, setExplainData] = useState<Record<string, { title: string; explanation: string; tone_note: string } | null>>({});
  const [explainLoading, setExplainLoading] = useState<Record<string, boolean>>({});

  const treatments = extractKidsTreatments(A);
  const ageGroups  = getKidsAgeGroups(A);

  async function fetchExplanation(t: KidsMatchResult) {
    if (explainLoading[t.id] || explainData[t.id]) return;
    setExplainLoading(prev => ({ ...prev, [t.id]: true }));
    try {
      const res = await fetch("/api/explain-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionnaire_type: "child",
          user_summary: {
            region_preference: city || region || undefined,
            online_preference: online || undefined,
            therapist_gender_preference: gender || undefined,
            recommended_treatment_types: treatments,
            cultural_preferences: cultural.length ? cultural : undefined,
          },
          therapist: {
            id: t.id,
            full_name: t.full_name ?? "",
            therapist_types: t.therapist_types ?? [],
            training_areas: t.training_areas ?? [],
            regions: toArr(t.regions),
            online: t.online ?? false,
            gender: t.gender ?? null,
            bio: t.bio ?? null,
          },
          match_result: {
            match_score: t.match_score,
            match_reasons: t.match_reasons ?? [],
          },
        }),
      });
      const data = await res.json();
      setExplainData(prev => ({ ...prev, [t.id]: data }));
    } catch {
      setExplainData(prev => ({ ...prev, [t.id]: null }));
    } finally {
      setExplainLoading(prev => ({ ...prev, [t.id]: false }));
    }
  }

  function toggleArr(arr: string[], setArr: (v: string[]) => void, val: string) {
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  }

  async function doMatch() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          treatmentTypes: treatments,
          ageGroups,
          genderPreference: gender || null,
          city: city || null,
          region: city ? (CITY_TO_REGION[city] ?? region ?? null) : (region || null),
          onlineRequired: online,
          culturalPreferences: cultural,
          arrangements,
          languages: [language || "עברית"],
          limit: 10,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "שגיאה בחיפוש");
      setResults(data.matches || []);
      setSearched(true);
      setOpen(false);
    } catch (e: any) {
      setError(e.message || "שגיאה בחיפוש");
    } finally {
      setLoading(false);
    }
  }

  function toArr(v: unknown): string[] {
    return Array.isArray(v) ? (v as string[]) : [];
  }

  return (
    <div className="mt-8">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full py-4 rounded-2xl text-white font-bold text-base shadow-md transition hover:opacity-90 active:scale-95"
          style={{ background: "linear-gradient(135deg,#2c3e7a,#4a6fa5)" }}
        >
          🔍 מציאת מטפל/ת מתאים/ה
        </button>
      ) : (
        <div className="rounded-2xl border border-[#c8d8f0] bg-[#f0f5ff] p-5">
          <h3 className="font-bold text-[#1a3a5c] text-lg mb-1">מציאת מטפל/ת מתאים/ה</h3>
          {treatments.length > 0 && (
            <p className="text-xs text-gray-500 mb-4">
              על בסיס הממצאים: {treatments.join(", ")}
            </p>
          )}

          {/* Online */}
          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-[#2a3a5a] cursor-pointer">
              <input type="checkbox" checked={online} onChange={e => setOnline(e.target.checked)} className="w-4 h-4" />
              פתוח/ה גם לטיפול אונליין
            </label>
          </div>

          {/* Region + City */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-[#2a3a5a] mb-1">אזור מגורים</label>
            <select
              value={region}
              onChange={e => { setRegion(e.target.value); setCity(""); }}
              className="w-full rounded-xl border border-[#c8d0e8] bg-white px-3 py-2 text-sm mb-2"
            >
              <option value="">-- בחר אזור --</option>
              {ALL_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {region && (
              <>
                <label className="block text-sm font-semibold text-[#2a3a5a] mb-1">עיר</label>
                <select
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  className="w-full rounded-xl border border-[#c8d0e8] bg-white px-3 py-2 text-sm"
                >
                  <option value="">-- כל האזור --</option>
                  {(REGION_CITIES[region] ?? []).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </>
            )}
          </div>

          {/* Language */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-[#2a3a5a] mb-1">שפת הטיפול</label>
            <select value={language} onChange={e => setLanguage(e.target.value)}
              className="w-full rounded-xl border border-[#c8d0e8] bg-white px-3 py-2 text-sm">
              {["עברית","אנגלית","ערבית","רוסית","צרפתית","ספרדית","פורטוגזית","אמהרית"].map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          {/* Gender */}
          <div className="mb-4">
            <div className="text-sm font-semibold text-[#2a3a5a] mb-2">העדפת מגדר מטפל/ת</div>
            <div className="flex gap-4">
              {(["", "זכר", "נקבה"] as const).map(g => (
                <label key={g} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="radio" checked={gender === g} onChange={() => setGender(g)} />
                  {g || "ללא העדפה"}
                </label>
              ))}
            </div>
          </div>

          {/* Arrangements */}
          <div className="mb-4">
            <div className="text-sm font-semibold text-[#2a3a5a] mb-2">הסדרי תשלום</div>
            <div className="flex flex-wrap gap-3">
              {KIDS_ARRANGEMENTS.map(a => (
                <label key={a} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="checkbox" checked={arrangements.includes(a)} onChange={() => toggleArr(arrangements, setArrangements, a)} />
                  {a}
                </label>
              ))}
            </div>
          </div>

          {/* Cultural */}
          <div className="mb-5">
            <div className="text-sm font-semibold text-[#2a3a5a] mb-2">העדפות תרבותיות</div>
            <div className="flex flex-wrap gap-3">
              {KIDS_CULTURAL.map(c => (
                <label key={c} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="checkbox" checked={cultural.includes(c)} onChange={() => toggleArr(cultural, setCultural, c)} />
                  {c}
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={doMatch}
            disabled={loading}
            className="w-full py-3 rounded-xl text-white font-bold transition hover:opacity-90 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#2c3e7a,#4a6fa5)" }}
          >
            {loading ? "מחפש..." : "חיפוש מטפל/ת"}
          </button>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>
      )}

      {/* Results */}
      {searched && (
        <div className="mt-5">
          {results.length === 0 ? (
            <div className="text-center py-6 text-[#4a6fa5] text-sm bg-blue-50 rounded-2xl">
              לא נמצאו מטפלים מתאימים לפי הפרמטרים שנבחרו.
            </div>
          ) : (
            <>
              <div className="text-sm font-bold text-[#1a3a5c] mb-3">נמצאו {results.length} מטפלים:</div>
              <div className="space-y-4">
                {results.map(t => {
                  const regionsArr = toArr(t.regions);
                  const combined = t.combined_score ?? t.match_score;
                  return (
                    <div key={t.id} className="rounded-2xl bg-white p-5 shadow-lg">
                      <div className="flex items-start gap-4">
                        <img
                          src={t.profile_photo_url || (t.gender === "נקבה" ? "/avatar-female.svg" : "/avatar-male.svg")}
                          alt={t.full_name ?? ""}
                          className="h-16 w-16 flex-shrink-0 rounded-xl object-cover"
                        />
                        <div className="flex-1 text-right">
                          <h3 className="text-lg font-bold text-[#1a3a5c]">{t.full_name || "ללא שם"}</h3>
                          <p className="text-xs text-[#6b7280]">{t.gender} • {t.online ? "אונליין" : "פנים אל פנים"}</p>
                          {t.bio && <p className="mt-1 text-sm text-gray-700 line-clamp-2">{t.bio}</p>}
                          {regionsArr.length > 0 && (
                            <p className="mt-1 text-xs text-gray-500">📍 {regionsArr.join(", ")}</p>
                          )}
                          {t.match_reasons?.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {t.match_reasons.map((r, i) => (
                                <span key={i} className="rounded-full bg-[#e0f4fa] px-2 py-0.5 text-xs text-[#2e7d8c]">{r}</span>
                              ))}
                            </div>
                          )}
                          <div className="mt-2 flex flex-wrap gap-2 items-center">
                            <div className={`inline-block rounded-full px-3 py-1 text-xs font-bold text-white ${
                              combined >= 85 ? "bg-[#1a3a5c]" : combined >= 70 ? "bg-[#2a5a8c]" : combined >= 55 ? "bg-amber-700" : "bg-gray-500"
                            }`}>✦ התאמה כוללת: {combined}%</div>
                            <div className="inline-block rounded-full border border-[#1a3a5c] px-3 py-1 text-xs font-semibold text-[#1a3a5c]">
                              מקצועי: {t.match_score}%
                            </div>
                            {t.personality_score != null && (
                              <div className={`inline-block rounded-full px-3 py-1 text-xs font-semibold text-white ${
                                t.personality_score >= 85 ? "bg-emerald-600" : t.personality_score >= 70 ? "bg-teal-600" : t.personality_score >= 55 ? "bg-amber-600" : "bg-gray-500"
                              }`}>אישיותי: {t.personality_score}%</div>
                            )}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {t.phone && (
                              <a href={`https://wa.me/972${t.phone.replace(/^0/, "").replace(/[-\s]/g, "")}?text=${encodeURIComponent('שלום, הגעתי אלייך דרך אתר "טיפול חכם", אשמח לשמוע פרטים לגבי הטיפול')}`}
                                target="_blank" rel="noopener noreferrer"
                                onClick={() => trackClick(t.id, "whatsapp")}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-green-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-600">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                </svg>
                                וואטסאפ
                              </a>
                            )}
                            {t.email && (
                              <a href={`mailto:${t.email}?subject=פנייה דרך אתר טיפול חכם&body=${encodeURIComponent('שלום, הגעתי אלייך דרך אתר "טיפול חכם", אשמח לשמוע פרטים לגבי הטיפול')}`}
                                onClick={() => trackClick(t.id, "email")}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-[#2e7d8c] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
                                ✉ מייל
                              </a>
                            )}
                            {t.phone && (
                              <a href={`tel:${t.phone}`}
                                onClick={() => trackClick(t.id, "phone")}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-stone-700 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
                                📞 התקשר/י
                              </a>
                            )}
                            <button
                              onClick={() => fetchExplanation(t)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-[#1a3a5c] px-3 py-1.5 text-xs font-semibold text-[#1a3a5c] hover:bg-[#f0f6ff]"
                            >
                              {explainLoading[t.id] ? "טוען..." : "✦ למה זה מתאים לי?"}
                            </button>
                          </div>
                          {explainData[t.id] && (
                            <div className="mt-3 rounded-xl bg-[#f0f8ff] border border-[#c0dff0] p-3 text-right">
                              <p className="text-xs font-bold text-[#1a3a5c] mb-1">{explainData[t.id]!.title}</p>
                              <p className="text-xs text-gray-700 mb-2 leading-relaxed">{explainData[t.id]!.explanation}</p>
                              <p className="text-[10px] text-gray-400">{explainData[t.id]!.tone_note}</p>
                            </div>
                          )}
                          <a href={`/therapists/${t.id}`} className="mt-2 block text-xs text-[#2e7d8c] font-semibold">לפרטים נוספים ◂</a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PageResult({ A, onRestart }: { A: Ans; onRestart: () => void }) {
  const domains = [
    { label: "🧠 תחום רגשי",       boxes: computeResults(A) },
    { label: "📚 תחום לימודי",      boxes: computeAcadResults(A) },
    { label: "🌱 תחום התפתחותי",    boxes: computeDevResults(A) },
    { label: "⚡ תחום התנהגותי",    boxes: computeBehResults(A) },
    { label: "🤝 תחום חברתי",       boxes: computeSocResults(A) },
  ];

  const hasAnyFindings = domains.some(d => d.boxes.length > 0);
  const bmiVal = A._bmi ? Number(A._bmi).toFixed(1) : null;

  return (
    <div>
      {/* Demographics card */}
      <Card>
        <StepTag>סיכום שאלון</StepTag>
        <h2 className="text-xl font-bold text-[#1a2a3a] mb-4">דוח ממצאים</h2>

        <div className="bg-gray-50 rounded-xl p-4 mb-4 text-sm space-y-1.5 text-[#2a3a4a]">
          <div className="flex justify-between">
            <span className="font-semibold">גיל:</span>
            <span>{A._age || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold">כיתה:</span>
            <span>{GRADE_LABELS[A._grade] || A._grade || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold">מגדר:</span>
            <span>{A.gender || "—"}</span>
          </div>
          {bmiVal && (
            <div className="flex justify-between">
              <span className="font-semibold">BMI:</span>
              <span>{bmiVal}</span>
            </div>
          )}
          <div className="pt-1 border-t border-gray-200">
            <div className="font-semibold mb-1">תחומי קושי שסומנו:</div>
            {Object.entries(AREA_LABELS).map(([k, label]) =>
              A[k] && A[k] !== "כלל לא" ? (
                <div key={k} className="flex justify-between">
                  <span>{label}:</span>
                  <span>{A[k]}</span>
                </div>
              ) : null
            )}
          </div>
        </div>
      </Card>

      {/* Findings */}
      <div className="mt-4">
        {!hasAnyFindings && (
          <Card>
            <div className="text-center py-8">
              <div className="text-4xl mb-3">✅</div>
              <p className="font-bold text-green-800 text-lg">לא נמצאו ממצאים משמעותיים</p>
              <p className="text-sm text-gray-500 mt-2">
                על בסיס הנתונים שהוזנו, לא עלו סימנים לקשיים המצריכים הפנייה.
              </p>
            </div>
          </Card>
        )}

        {domains.map((domain, di) => {
          if (domain.boxes.length === 0) return null;
          const main  = domain.boxes.filter(b => !b.txt.startsWith("📌"));
          const tools = domain.boxes.filter(b =>  b.txt.startsWith("📌"));
          return (
            <div key={di} className="mt-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-sm font-bold text-[#1a3a5c] px-3 py-1 rounded-full bg-blue-50 border border-blue-100 whitespace-nowrap">
                  {domain.label}
                </span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>
              {main.map((b, i) => <AlertBox key={i} cls={b.cls} txt={b.txt} />)}
              {tools.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 pr-1">כלים ופרקטיקות</div>
                  {tools.map((b, i) => <AlertBox key={i} cls="info" txt={b.txt} />)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Matching */}
      <KidsMatchSection A={A} />

      {/* Disclaimer */}
      <div className="mt-6 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-xs leading-6 text-stone-500">
        התוצאות מבוססות על תשובותיך לשאלון ומהוות הערכה כללית בלבד.<br />
        אין לראות בתוצאות אלו אבחון, המלצה טיפולית מחייבת או תחליף לייעוץ מקצועי.<br />
        מומלץ לפנות לאיש מקצוע מוסמך לצורך הערכה מלאה.
      </div>

      {/* Actions */}
      <div className="mt-6 flex gap-3 justify-end print:hidden">
        <button
          onClick={() => window.print()}
          className="px-5 py-2 rounded-xl border-2 border-[#2c3e7a] text-[#2c3e7a] text-sm font-semibold hover:bg-[#2c3e7a] hover:text-white transition-all"
        >
          💾 שמירה כ-PDF
        </button>
        <button
          onClick={onRestart}
          className="px-5 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition-all"
        >
          ← שאלון חדש
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function KidsPage() {
  const [step, setStep] = useState<string>("p-consent");
  const [A, setA]       = useState<Ans>({});
  const [usageAllowed, setUsageAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (localStorage.getItem("quiz_bypass") === "1") { setUsageAllowed(true); return; }
    fetch("/api/usage/check?type=kids")
      .then(r => r.json())
      .then(d => setUsageAllowed(d.allowed))
      .catch(() => setUsageAllowed(true));
  }, []);

  useEffect(() => {
    if (step === "p-result") {
      (window as any).gtag?.("event", "quiz_completed", { quiz_type: "kids" });
      if (localStorage.getItem("quiz_bypass") !== "1") {
        fetch("/api/usage/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "kids" }) })
          .then(r => r.json()).then(d => setUsageAllowed(d.allowed));
      }
    }
  }, [step]);

  function goNext(newA: Ans = A) {
    setA(newA);
    setStep(s => nextPid(s, newA));
  }
  function goBack() {
    setStep(s => prevPid(s, A));
  }

  const progress = Math.round(((PAGES.indexOf(step as PageId) + 1) / PAGES.length) * 100);
  const pageProps = { A, setA, onNext: goNext, onBack: goBack };

  if (usageAllowed === false && step !== "p-result") return (
    <main className="mx-auto max-w-2xl px-4 py-8 pb-20" dir="rtl">
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-2xl font-black text-stone-900 mb-3">הגעת למגבלת השימוש החינמי</h2>
        <p className="text-stone-600 leading-7 max-w-sm">
          ניתן למלא את השאלון עד 3 פעמים ללא תשלום.<br />
          בקרוב נפתח אפשרות לתשלום — עקבו אחרינו לעדכונים.
        </p>
      </div>
    </main>
  );

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 pb-20" dir="rtl">
      {/* Header */}
      <header className="mb-6">
        <div className="flex items-center justify-between mb-2">
          {step === "p-consent" ? (
            <div className="w-full text-center mb-1">
              <img src="/logo.svg.png" alt="טיפול חכם" className="mx-auto mb-3 h-16 w-auto" />
              <h1 className="text-2xl font-black text-[#1a3a5c]" style={{ fontFamily: "serif" }}>טיפול חכם</h1>
              <p className="text-sm text-[#6b7280]">שאלון הפניה לטיפול – ילדים ונוער</p>
            </div>
          ) : (
            <>
              <span className="text-xl font-extrabold text-[#1a3a5c]">טיפול חכם</span>
              {step !== "p-result" && (
                <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">שאלון ילדים / מתבגרים</span>
              )}
            </>
          )}
        </div>
        {step !== "p-consent" && step !== "p-result" && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-[#6b7280]">{progress}% הושלם</span>
              {progress > 5 && (
                <span className="text-xs font-semibold text-[#2e7d8c] animate-pulse">
                  {progress <= 25 ? "יופי, ממשיכים! 💪"
                    : progress <= 45 ? "באמצע הדרך, כל הכבוד!"
                    : progress <= 65 ? "יותר ממחצית מאחוריך!"
                    : progress <= 80 ? "כמעט שם, עוד קצת!"
                    : progress <= 92 ? "עוד מעט סיימת! 🎉"
                    : "שאלה אחרונה! 🏁"}
                </span>
              )}
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-2 rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, background: "linear-gradient(90deg, #2e7d8c, #1a3a5c)" }} />
            </div>
          </div>
        )}
      </header>

      {/* Routing */}
      {step === "p-consent"   && <Card><PageConsent onNext={()=>goNext()} /></Card>}
      {step === "p-demo"      && <PageDemo    {...pageProps} />}
      {step === "p-areas"     && <PageAreas   {...pageProps} />}
      {step === "p-q1"        && <PageQ1      {...pageProps} />}
      {step === "p-aq"        && <PageAQ      {...pageProps} />}
      {step === "p-aq-grade"  && <PageAQGrade {...pageProps} />}
      {step === "p-q1-ga"     && <PageQ1GA    {...pageProps} />}
      {step === "p-q2"        && <PageQ2      {...pageProps} />}
      {step === "p-q2-grade"  && <PageQ2Grade {...pageProps} />}
      {step === "p-q3"        && <PageQ3      {...pageProps} />}
      {step === "p-mq"        && <PageMQ      {...pageProps} />}
      {step === "p-mq-sui"    && <PageMQSui   {...pageProps} />}
      {step === "p-q4"        && <PageQ4      {...pageProps} />}
      {step === "p-q4-types"  && <PageQ4Types {...pageProps} />}
      {step === "p-q4-s"      && <PageQ4S     {...pageProps} />}
      {step === "p-q4-g"      && <PageQ4G     {...pageProps} />}
      {step === "p-q4-b"      && <PageQ4B     {...pageProps} />}
      {step === "p-q4-ctrl"   && <PageQ4Ctrl  {...pageProps} />}
      {step === "p-q5"         && <PageQ5       {...pageProps} />}
      {step === "p-oq"          && <PageOQ       {...pageProps} />}
      {step === "p-oq-grade"    && <PageOQGrade  {...pageProps} />}
      {step === "p-q6"          && <PageQ6       {...pageProps} />}
      {step === "p-tq"          && <PageTQ       {...pageProps} />}
      {step === "p-q7"          && <PageQ7       {...pageProps} />}
      {step === "p-pq"          && <PagePQ       {...pageProps} />}
      {step === "p-q8"          && <PageQ8       {...pageProps} />}
      {step === "p-eq"          && <PageEQ       {...pageProps} />}
      {step === "p-q9"          && <PageQ9       {...pageProps} />}
      {step === "p-bq"          && <PageBQ       {...pageProps} />}
      {step === "p-q10"         && <PageQ10      {...pageProps} />}
      {step === "p-q10-par"     && <PageQ10Par   {...pageProps} />}
      {step === "p-q10-grade"   && <PageQ10Grade {...pageProps} />}
      {step === "p-ga-traits"    && <PageGaTraits   {...pageProps} />}
      {step === "p-acad"         && <PageAcad      {...pageProps} />}
      {step === "p-dev-toilet"   && <PageDevToilet  {...pageProps} />}
      {step === "p-dev-sensory"  && <PageDevSensory {...pageProps} />}
      {step === "p-beh"          && <PageBeh        {...pageProps} />}
      {step === "p-soc"          && <PageSoc        {...pageProps} />}

      {step === "p-result" && <PageResult A={A} onRestart={()=>{ setA({}); setStep("p-consent"); }} />}
    </main>
  );
}
