import "server-only";

// ── Types ─────────────────────────────────────────────────────────────────────

type Ans = Record<string, any>;
type BoxCls = "info" | "warn" | "danger" | "purple" | "ok";
export interface KidsBox { cls: BoxCls; txt: string; isLowStress?: boolean; }

// ── Grade groups ──────────────────────────────────────────────────────────────

const GA_GRADES = ["פעוט", "גן3", "גן-טרום", "גן", "א"];
const BV_GRADES = ["ב", "ג", "ד", "ה", "ו"];
const ZY_GRADES = ["ז", "ח", "ט", "י", "יא", "יב"];

function gg(A: Ans): "ga" | "bv" | "zy" | "" {
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

function acadGg(A: Ans): "gan" | "ag" | "dv" | "zh" | "tyb" {
  const g = A._grade || "";
  if (["פעוט", "גן3", "גן-טרום", "גן"].includes(g) || g.startsWith("גן")) return "gan";
  if (["א", "ב", "ג"].includes(g)) return "ag";
  if (["ד", "ה", "ו"].includes(g)) return "dv";
  if (["ז", "ח"].includes(g)) return "zh";
  if (["ט", "י", "יא", "יב"].includes(g)) return "tyb";
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

function buildQ10StyleRef(A: Ans): string {
  const grp = gg(A);
  if (grp === "ga") return buildGaRef(A);
  if (grp === "bv") {
    const m = A.soc_motiv_therapy || A.q10_mot || A.q2_mot || A.aq_mot_bv || 0;
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

// ── Compute emotional results ─────────────────────────────────────────────────

function computeResults(A: Ans): KidsBox[] {
  const grp = gg(A);
  const boxes: KidsBox[] = [];
  const emoGroups: { symptoms: string[]; extraBoxes: KidsBox[]; referral: string }[] = [];
  const emoStandalones: KidsBox[] = [];

  function getGaRef(): string { return buildGaRef(A); }

  function addToGroup(symptomTxt: string, referralTxt: string, extraBoxes: KidsBox[]) {
    const existing = emoGroups.find(g => g.referral === referralTxt);
    if (existing) {
      existing.symptoms.push(symptomTxt);
      existing.extraBoxes.push(...extraBoxes);
    } else {
      emoGroups.push({ symptoms: [symptomTxt], extraBoxes, referral: referralTxt });
    }
  }

  // Q1 — חרדה
  // חרדת היפרדות (פריטים aq8 + aq9) נבדקת בנפרד מהחרדה הכללית
  const sepTot = (A.aq8 || 0) + (A.aq9 || 0);
  if (sepTot >= 4) {
    const sepRef = grp === "ga"
      ? getGaRef()
      : grp === "bv"
        ? "✅ הפנייה: טיפול CBT ממוקד חרדת היפרדות בשילוב הדרכת הורים"
        : "✅ הפנייה: טיפול CBT ממוקד חרדת היפרדות";
    addToGroup("📊 נמצאו סימנים לחרדת היפרדות", sepRef, []);
  }
  if ((A.q1 || 0) >= 4) {
    const aqTot = A.aq_tot || 0;
    const extras: KidsBox[] = [];
    if (A.q1_pain === "כן") {
      if (A.q1_med_clear === "לא")
        extras.push({ cls: "warn", txt: "⚠️ דווח על כאבים כרוניים — יש לפנות לרופא משפחה לשלילת גורם רפואי לפני הטיפול" });
      else if (!A.q1_med_clear)
        extras.push({ cls: "warn", txt: "⚠️ דווח על כאבים כרוניים — מומלץ לשלול גורם רפואי לפני הטיפול" });
    }
    if (aqTot >= 16) {
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
      emoStandalones.push({ cls: "purple", txt: "📊 נמצאו סימפטומים של מתח ברמה נמוכה", isLowStress: true });
      extras.forEach(e => emoStandalones.push(e));
    }
    emoStandalones.push({ cls: "info", txt:
      "📌 כלים ופרקטיקות להפחתת מתח בילדים ונוער:\n\n" +
      "🟢 קרקוע: לבקש מהילד/ה לומר 5 דברים שרואים מולם. 4 דברים שאפשר לגעת בהם. 3 דברים ששומעים. 2 דברים שאפשר להריח. 1 דבר שאפשר לטעום.\n\n" +
      "🟢 נשימות: לדמיין ניפוח בועת סבון — נשימה עמוקה דרך האף, ונשיפה איטית מהפה (כדי לא לפוצץ את הבועה).\n\n" +
      "🟢 שגרה: להפחית אי-ודאות. ליצור לוח יומי עם ציורים או סמלים של סדר היום. לסקור אותו בבוקר ובערב יחד עם הילד.\n\n" +
      "🟢 פינת מרגוע: ליצור מקום רגוע להתמודדות עם מתח. לכלול: צעצועים להפגת מתחים, כדור לחיץ, חוברות צביעה ועוד. חשוב לשתף את הילד בבחירת התכנים.\n\n" +
      "🟢 פעילות גופנית: הליכה, ריקוד, או משחק בחוץ — מסייע בהפחתת הורמון המתח (קורטיזול) ומשפר שינה וריכוז."
    });
  }

  // Q2 — דימוי עצמי
  if ((A.q2 || 0) >= 5) {
    let ref = "";
    if (grp === "ga") ref = getGaRef();
    else if (grp === "bv") {
      const m = A.q2_mot || A.aq_mot_bv || 0;
      ref = m <= 1
        ? "✅ הפנייה: הדרכת הורים טיפולית"
        : "✅ הפנייה: טיפול פסיכודינאמי בשילוב הדרכת הורים";
    } else {
      ref = "✅ הפנייה: טיפול פסיכודינאמי בשילוב הדרכת הורים";
    }
    addToGroup("📊 נמצאו סימנים לדימוי עצמי נמוך", ref, []);
  }

  // Q3 — מצב רוח ירוד
  // אזהרת אובדנות מופיעה תמיד כשההורה ענה "כן", ללא קשר לציון מצב הרוח
  const suicidalReported = A.q3_sui === "כן";
  if (suicidalReported) {
    emoStandalones.push({ cls: "danger", txt: "🚨 דווח על מחשבות אובדניות — נדרשת הערכת סיכון דחופה אצל פסיכיאטר ילדים" });
  }
  const mqTot = A.mq_tot || 0;
  if ((A.q3 || 0) >= 4 && mqTot >= 4) {
    const isSevere = mqTot >= 6;
    const ref = grp === "ga"
      ? getGaRef()
      : isSevere
        ? "✅ הפנייה: טיפול פסיכודינאמי במקביל לייעוץ אצל פסיכיאטר ילדים לבירור התאמה לטיפול תרופתי"
        : "✅ הפנייה: טיפול פסיכודינאמי";
    const symptomTxt = isSevere
      ? "📊 נמצאו סימנים מובהקים של מצב רוח ירוד"
      : "📊 נמצאו סימנים למצב רוח ירוד";
    addToGroup(symptomTxt, ref, []);
  }

  // Q4 — התמכרות
  if (A.q4 === "כן") {
    const s = A.add_s_tot || 0, g2 = A.add_g_tot || 0, b = A.add_b_tot || 0;
    const addSyms: string[] = [];
    if (s >= 3) addSyms.push("📊 נמצאו סימנים להתמכרות לחומרים");
    if (g2 >= 4) addSyms.push("📊 נמצאו סימנים להתמכרות למשחקי מחשב");
    if (b >= 4) { const sv = b >= 7 ? "חמורה" : b >= 6 ? "בינונית" : "קלה"; addSyms.push("📊 נמצאו סימנים להתמכרות להימורים — " + sv); }
    if (A.ad_o) addSyms.push("📊 דווח על התמכרות אחרת — יש לפרט");
    if (addSyms.length) {
      const ctrl = A.q4_ctrl || 5;
      const ref = grp === "ga"
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
    const ref = grp === "ga"
      ? getGaRef()
      : significant
        ? "✅ הפנייה: טיפול CBT בשילוב הדרכת הורים + בשילוב צוות בית הספר במידת הצורך"
        : "✅ הפנייה: טיפול CBT בשילוב הדרכת הורים";
    addToGroup("📊 נמצאו סימנים " + sv + " להתנהגויות אובססיביות-קומפולסיביות", ref, []);
  }

  // Q6 — טראומה
  if (A.q6 === "כן" && (A.tq_tot || 0) >= 13) {
    let txt = "📊 נמצאו סימנים לקשיי עיבוד לאחר אירוע טראומטי";
    const clusters: string[] = [];
    if ([A.tq1, A.tq2, A.tq3].some(x => (x || 0) >= 2)) clusters.push("חודרנות");
    if ([A.tq4, A.tq5].some(x => (x || 0) >= 2))        clusters.push("הימנעות");
    if ([A.tq6, A.tq7].some(x => (x || 0) >= 2))        clusters.push("שינוי קוגניציה ומצב רוח");
    if ([A.tq8, A.tq9, A.tq10].some(x => (x || 0) >= 2)) clusters.push("עוררות ותגובתיות");
    if (clusters.length) txt += "\nאשכולות: " + clusters.join(", ");
    emoStandalones.push({ cls: "purple", txt });
    emoStandalones.push({ cls: "info", txt: "✅ הפנייה לטיפול בטראומה (EMDR / CPT) ע\"י פסיכולוג/עו\"ס קליני" });
  }

  // Q7 — פרודרום
  // q7a = הזיות (חזותיות/שמיעתיות) → דגל אדום, סף נמוך (פריט אחד מספיק)
  // q7b = אמונות יוצאות דופן בלבד → סף גבוה יותר (3 פריטים)
  const q7Hall = A.q7a === "כן";
  const q7Bel = A.q7b === "כן";
  const pqThreshold = q7Hall ? 1 : (q7Bel ? 3 : Infinity);
  if ((A.pq_tot || 0) >= pqThreshold) {
    emoStandalones.push({ cls: "warn", txt: "📊 דווחו חוויות חושיות או קוגניטיביות החורגות מהרגיל — מומלץ להעריך" });
    emoStandalones.push({ cls: "info", txt: "✅ הפנייה לפסיכולוג קליני או פסיכיאטר להערכה" });
  }

  // Q8 — הפרעות אכילה
  if (A.q8 === "כן") {
    const ano = A.eq_ano || 0, bul = A.eq_bul || 0;
    if (ano >= 2 || bul >= 2) {
      emoStandalones.push({ cls: "purple", txt: "📊 נמצאו קשיים בתחום האכילה" });
      emoStandalones.push({ cls: "info",   txt: "✅ הפנייה לטיפול ע\"פ מאפייני הילד + דיאטנית קלינית מומחית" });
    }
  }

  // Q9 — ויסות/BPD
  // bq_tot >= 5 → קליני, הפניה ל-DBT
  // bq_tot == 4 → גבולי, המלצה להערכה אצל פסיכולוג ילדים
  if (A.q9 === "כן") {
    const bqTot = A.bq_tot || 0;
    if (bqTot >= 5) {
      const ref = grp === "ga" ? getGaRef() : "✅ הפנייה לטיפול DBT פרטני/קבוצתי";
      addToGroup("📊 נמצאו סימנים לקשיי ויסות על רקע קשרים בינאישיים", ref, []);
    } else if (bqTot === 4) {
      const ref = grp === "ga" ? getGaRef() : "✅ מומלץ להיוועץ עם פסיכולוג ילדים להערכה מעמיקה";
      addToGroup("📊 נמצאו מאפיינים של קשיים בוויסות הרגשי וביחסים בין-אישיים", ref, []);
    }
  }

  // Q10 — קשיים כלליים
  if (A.q10 === "כן" && A.q10_par === "כן") {
    let ref = "";
    if (grp === "ga") {
      ref = getGaRef();
    } else if (grp === "bv") {
      const m = A.q10_mot || A.q2_mot || A.aq_mot_bv || 0;
      ref = m <= 2 ? "✅ הפנייה: הדרכת הורים" : "✅ הפנייה לטיפול ע\"פ מאפייני הילד";
    } else {
      const v2 = A.q10_verbal || 0;
      let txt2 = v2 <= 2
        ? "✅ הפנייה: טיפול פסיכודינאמי + הדרכת הורים"
        : "✅ הפנייה: טיפול פסיכודינאמי";
      const ints: string[] = [];
      if (A.int_art)    ints.push("אומנות");
      if (A.int_music)  ints.push("מוזיקה");
      if (A.int_move)   ints.push("תנועה");
      if (A.int_drama)  ints.push("פסיכודרמה");
      if (A.int_biblio) ints.push("ביבליותרפיה");
      if (A.int_animal) ints.push("טיפול בבע\"ח");
      if (ints.length) txt2 += "\n📌 תחומי עניין: " + ints.join(", ");
      ref = txt2;
    }
    addToGroup("📊 נמצאו קשיים רגשיים כלליים", ref, []);
  }

  // BV merge: Q1+Q2+Q3 all positive → combined referral
  if (grp === "bv") {
    const q1p = (A.q1 || 0) >= 4 && (A.aq_tot || 0) >= 14;
    const q2p = (A.q2 || 0) >= 4;
    const q3p = (A.q3 || 0) >= 4 && (A.mq_tot || 0) >= 4;
    if (q1p && q2p && q3p) {
      const combinedRef = "✅ הפנייה: טיפול פסיכודינאמי בשילוב CBT בשילוב הדרכת הורים";
      const bvLabels = ["📊 נמצאו סימנים לחרדה", "📊 נמצאו סימנים לדימוי עצמי נמוך", "📊 נמצאו סימנים למצב רוח ירוד"];
      const mergedExtras: KidsBox[] = [];
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

  // Dedup by therapy base
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

  // Multiple-referral notice
  const allEmoRefs = new Set<string>();
  emoGroups.forEach(g => { if (g.referral) allEmoRefs.add(g.referral); });
  emoStandalones.forEach(s => { if (!s.isLowStress && s.txt?.startsWith("✅")) allEmoRefs.add(s.txt); });
  if (allEmoRefs.size > 1)
    boxes.push({ cls: "warn", txt: "⚠️ נמצאו מספר הפניות רגשיות. יש לבחור את ההפנייה הכי דחופה עבורכם." });
  // 3+ הפניות נפרדות → תמונה קלינית מורכבת, מומלץ ייעוץ אצל פסיכיאטר ילדים להערכה כוללת
  if (allEmoRefs.size >= 3)
    boxes.push({ cls: "info", txt: "📌 נמצאו 3 הפניות רגשיות או יותר — מומלץ במקביל לשקול ייעוץ אצל פסיכיאטר ילדים, להערכה כוללת ולסדר עדיפויות בין התחומים." });

  // Output emoGroups
  emoGroups.forEach(grp2 => {
    grp2.extraBoxes.forEach(e => boxes.push(e));
    boxes.push({ cls: "purple", txt: grp2.symptoms.join("\n") });
    if (grp2.referral) boxes.push({ cls: "info", txt: grp2.referral });
  });

  // Low-stress standalone
  const lowStress   = emoStandalones.filter(s => s.isLowStress);
  const otherStands = emoStandalones.filter(s => !s.isLowStress);
  const hasAnyTherapy =
    emoGroups.some(g => g.referral?.includes("טיפול")) ||
    emoStandalones.some(s => s.txt?.startsWith("✅") && s.txt.includes("טיפול") && !s.isLowStress);
  lowStress.forEach(s => boxes.push(s));
  if (lowStress.length > 0 && !hasAnyTherapy && emoGroups.length === 0)
    boxes.push({ cls: "info", txt: "✅ הפנייה: טיפול פסיכודינאמי" });
  otherStands.forEach(s => boxes.push(s));

  return boxes;
}

// ── Compute academic results ──────────────────────────────────────────────────

function computeAcadResults(A: Ans): KidsBox[] {
  if (!["מעט", "הרבה", "הרבה מאוד"].includes(A.a_aca || "")) return [];
  const boxes = computeAcadResultsRaw(A);
  // Post-processing: no-findings message, cross-emotional, follow-up
  const hasFindings = boxes.some(b => b.txt?.startsWith("📚") || b.txt?.startsWith("📊") || b.txt?.startsWith("✅") || b.txt?.startsWith("⚠️") || b.txt?.startsWith("🚨"));
  if (!hasFindings) {
    boxes.push({ cls: "info", txt: "✅ לא נמצאו סימנים מובהקים לקשיים לימודיים מובהקים. אם בכל זאת קיימת דאגה, מומלץ להיוועץ עם המחנכ/ת או יועצת בית הספר." });
    return boxes;
  }
  // הצלבה עם החלק הרגשי — חרדה / דיכאון / קשב משפיעים על תפקוד לימודי
  const highAnxiety = (A.q1 || 0) >= 7;
  const highMood = (A.q3 || 0) >= 5 && (A.mq_tot || 0) >= 4;
  if (highAnxiety || highMood) {
    boxes.push({ cls: "info", txt: "📌 חשוב לזכור: " + (highMood ? "דווחו סימני מצב רוח ירוד משמעותי" : "דווחה רמת חרדה גבוהה") + " — לעיתים קושי רגשי משפיע ישירות על התפקוד הלימודי. מומלץ לטפל קודם בקושי הרגשי, ולעקוב אם הקשיים הלימודיים נמשכים גם לאחר מכן." });
  }
  // מעקב ארוך-טווח
  boxes.push({ cls: "info", txt: "📅 מומלץ לחזור על השאלון בעוד 3-6 חודשים, לבחון התקדמות לאחר יישום ההמלצות." });
  return boxes;
}

function computeAcadResultsRaw(A: Ans): KidsBox[] {
  const ga = acadGg(A);
  const boxes: KidsBox[] = [];
  function box(cls: BoxCls, txt: string) { boxes.push({ cls, txt }); }

  // Vision/hearing — בדיקה לפני המשך הבירור הלימודי
  if (A.vision === "לא" && A.vis_sym === "כן") {
    box("warn", "⚠️ דווחו סימנים לקשיי ראייה ללא בדיקה — מומלץ לערוך בדיקת ראייה אצל אופטומטריסט/רופא עיניים לפני המשך הבירור הלימודי, כדי לשלול גורם ראייתי לקשיים.");
  }
  if (A.hearing === "לא" && A.hear_sym === "כן") {
    box("warn", "⚠️ דווחו סימנים לקשיי שמיעה ללא בדיקה — מומלץ לערוך בדיקת שמיעה אצל קלינאית תקשורת או רופא אא\"ג לפני המשך הבירור הלימודי.");
  }

  let adhdEmitted = false;
  // inatt items 2,3,5 (1-indexed) הם פונקציות ניהוליות (ארגון, איבוד חפצים, שכחה)
  // efCount = כמה מהם סומנו
  function emitADHD(inatt: number, hyper: number, efCount: number): boolean {
    const pi = inatt >= 4, ph = hyper >= 4;
    if (!(pi || ph)) return false;
    if (adhdEmitted) return true;
    adhdEmitted = true;
    const syms: string[] = [];
    if (pi) syms.push("📊 ישנם סימנים לקשיי ריכוז וקשב");
    if (ph) syms.push("📊 ישנם סימנים לקשיים בתחום ההיפראקטיביות/אימפולסיביות");
    if (syms.length) box("purple", syms.join("\n"));
    box("info", "✅ יש לפנות לנוירולוג/רופא ילדים המומחה בקשיי קשב להמשך אבחון");
    box("info", "📌 ניתן לפנות גם ליועצת בית הספר לתיאום עם הצוות החינוכי וליווי משפחתי");
    if (pi && efCount >= 2) {
      box("info", "✅ ישנם סימנים לקשיים בפונקציות הניהוליות (ארגון, שליפת חפצים, שכחה) — מתאים טיפול/אימון מסוג Cog-Fun");
    }
    box("info", "📚 לקריאה נוספת: אנפ\"ר (איגוד נפגעי הפרעת קשב) — anpar.org.il");
    return true;
  }
  function efCountFromPrefix(prefix: string): number {
    return ["_ad2", "_ad3", "_ad5"].filter(k => A[prefix + k]).length;
  }

  // גן
  if (ga === "gan") {
    const yesCount = ["gan_q1", "gan_q2", "gan_q3", "gan_q4", "gan_q5"].filter(k => A[k] === "כן").length;
    if (yesCount === 0) return boxes;
    box("purple", "📚 נמצאו קשיים לימודיים — גן");
    if (A.gan_q1 === "כן") {
      if (A.gan_q1_speech === "כן") box("info", "✅ קשיים בזיהוי אותיות/מספרים — יש לחזור לקלינאית תקשורת לטיפול נוסף\n✅ יש לפנות לפסיכולוג הגן לבחינת שעות שילוב");
      else box("warn", "⚠️ קשיים בזיהוי אותיות/מספרים — יש לבחון פנייה לקלינאית תקשורת + פסיכולוג הגן");
      box("info", "📌 כלים: אפליקציות לימוד קריאה, שירים, לוח מגנטי, ציור אותיות, פלסטלינה, ספירת חפצים");
    }
    if (A.gan_q2 === "כן") {
      if (A.gan_q2_speech === "כן") box("info", "✅ קשיים שפתיים — יש לחזור לקלינאית תקשורת לטיפול נוסף");
      else box("warn", "⚠️ קשיים בזכירת צורות/צבעים — יש לבחון פנייה לקלינאית תקשורת");
    }
    if (A.gan_q3 === "כן") box("info", "📌 קשיי מודעות פונולוגית — כלים: שירים וחרוזים, \"צליל פותח של היום\", קלפי תמונות, משחקי חריזה");
    if (A.gan_q4 === "כן") box("warn", "⚠️ קשיים בביטוי עצמי ואוצר מילים — מומלץ להפנות לקלינאית תקשורת להערכה");
    if (A.gan_q5 === "כן") {
      if (A.gan_q5_ot === "כן") box("info", "✅ קשיים מוטוריים — יש לחזור למרפאה בעיסוק לטיפול נוסף");
      else { box("warn", "⚠️ קשיים באחזקת עיפרון/ציור — יש לבחון פנייה לריפוי בעיסוק"); box("info", "📌 כלים: טושים עבים, פלסטלינה, גזירה לפי קווים, השלחת חרוזים"); }
    }
    if (yesCount >= 4) box("danger", "🚨 ניכרים סימפטומים משמעותיים בגן — יש לפנות להיוועצות עם הגננת ופסיכולוג הגן לגבי התאמת המסגרת");
    else if (yesCount === 3) box("warn", "⚠️ 3 קשיים לימודיים — מומלץ להיוועץ עם פסיכולוג הגן ולבדוק זכאות לשעות שילוב במסגרת");
    return boxes;
  }

  // א-ג
  if (ga === "ag") {
    const read  = A.ag_read  || "לא";
    const write = A.ag_write === "כן";
    const comp  = A.ag_comp  === "כן";
    const math  = A.ag_math  || "לא";
    const adhdYn = A.ag_adhd_yn === "כן";
    const histYes = ["ag_h1", "ag_h2", "ag_h3", "ag_h4", "ag_h5", "ag_h6"].filter(k => A[k] === "כן").length;
    const inatt = ["ag_ad1", "ag_ad2", "ag_ad3", "ag_ad4", "ag_ad5", "ag_ad6"].filter(k => A[k]).length;
    const hyper = ["ag_ah1", "ag_ah2", "ag_ah3", "ag_ah4", "ag_ah5", "ag_ah6"].filter(k => A[k]).length;
    const efCount = efCountFromPrefix("ag");
    const adhdPos = inatt >= 4 || hyper >= 4;
    if (read === "לא" && !write && !comp && math === "לא" && !adhdYn) return boxes;

    // עבור ילדים בא-ג (גילאי 6-9), ההפניה הרגשית היא לטיפול בהבעה ויצירה ולא לטיפול דינאמי בשיחות
    const emotionalLearningRef = "נמצאו קשיים רגשיים מול למידה — יש להפנות לטיפול בהבעה ויצירה בשילוב הדרכת הורים";
    const toolsChizuk = "📌 תוכנית חיזוקים — כלים לסיוע בלמידה בכיתה ובבית:\n1. משוב חיובי קבוע — שבחים פשוטים על הצלחה קטנה, עידוד להמשיך ולנסות, מיקוד במאמצים ולא רק בתוצאות.\n2. שילוב תרגילים להרפיה ומדיטציה קלה (נשימות עמוקות, הרפיית שרירים, דמיון מודרך) לפני פעילות לימודית מאתגרת.\n3. התאמת ההוראה לצרכים הייחודיים — בניית מטלות המאפשרות התקדמות בקצב אישי, עם הצלחות קטנות ומדורגות.\n4. למידה בקבוצות קטנות או בעזרת עמיתים.";
    const toolsMath = "📌 כלים לחיזוק חשבון:\nא. שיפור הבנה בסיסית: פירוק משימות לשלבים, שימוש בדוגמאות מחיי היומיום, המחשה בשרטוטים ודיאגרמות.\nב. פיתוח אסטרטגיות: קוד צבעים בנוסחאות, למידה בקבוצות קטנות, הצגת בעיות בדרכים שונות.\nג. כלים טכנולוגיים:\n   • Math Land — משחק הרפתקאות עם תרגילי חשבון ברמות שונות (בתשלום)\n   • Pet Bingo — בינגו חוויתי עם תרגילי חיבור/חיסור/כפל/חילוק (חינמי)";
    const psychodidacticNote = "(אבחון פסיכודידקטי מומלץ לרוב מכיתה ג' ומעלה, כשיש מספיק נתונים על תפקוד לימודי בסיסי)";

    const syms: string[] = [], refs: string[] = [], tools: string[] = [];
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
          const mot = (A.ag_mot1 || 1) + (A.ag_mot2 || 1) + (A.ag_mot3 || 1);
          if (mot >= 7) { addRef(emotionalLearningRef); }
          else { if (!emitADHD(inatt, hyper, efCount)) addRef("הפנייה לאבחון פסיכודידקטי " + psychodidacticNote); }
        }
      } else if (histYes >= 1 && histYes <= 3) {
        const speech = A.ag_read_speech;
        if (speech === "כן") {
          const smotiv = A.ag_speech_motiv;
          if (smotiv === "כן") { addRef("יש לבנות תוכנית חיזוקים. כדאי לבדוק עם יועצת בית הספר זכאות לשעות שילוב במסגרת הכיתתית"); }
          else if (smotiv === "לא") {
            addRef("יש לבנות תוכנית חיזוקים. כדאי לבדוק עם יועצת בית הספר זכאות לשעות שילוב במסגרת הכיתתית"); addTool(toolsChizuk);
            const smot = (A.ag_smot1 || 1) + (A.ag_smot2 || 1) + (A.ag_smot3 || 1);
            if (smot >= 7) { addRef(emotionalLearningRef); }
            else { if (!emitADHD(inatt, hyper, efCount)) addRef("הפנייה לאבחון פסיכודידקטי " + psychodidacticNote); }
          }
        } else if (speech === "לא") { addRef("יש לבחון פנייה לקלינאית תקשורת"); }
      } else if (histYes >= 4) {
        addRef("הפנייה לאבחון פסיכודידקטי " + psychodidacticNote);
        addRef("יש לבחון פנייה לריפוי בעיסוק");
      }
    }
    if (adhdYn) emitADHD(inatt, hyper, efCount);
    if (write) {
      addSym("נמצאו סימנים לקשיי כתב יד");
      if (read !== "לא") addRef("נראה שיש שילוב של מספר קשיים — יש לפנות לאבחון פסיכו-דידקטי " + psychodidacticNote);
      else { if (A.ag_write_ot === "כן") addRef("קשיי כתב יד — יש לחזור לבדיקה אצל מרפאה בעיסוק"); else addRef("קשיי כתב יד — יש לבחון פנייה לריפוי בעיסוק"); }
    }
    if (comp) {
      addSym("נמצאו סימנים לקשיי הבנה בשיעור");
      if (!(read !== "לא" || adhdPos)) addRef("הפנייה לאבחון פסיכודידקטי " + psychodidacticNote);
    }
    if (math !== "לא") {
      addSym("נמצאו סימנים לקשיי חשבון");
      if (math === "5%") { addRef("נמצאו קשיים בחשבון:\nא. יש לשקול מתן סיוע פרטני דרך בית הספר או באופן פרטי.\nב. במידה ולא נראה שיפור משמעותי — הפנייה לאבחון פסיכודידקטי " + psychodidacticNote); addTool(toolsMath); }
      else if (math === "10%") { addRef("נמצאו קשיים בחשבון:\nיש לשקול מתן סיוע פרטני דרך בית הספר או באופן פרטי."); addTool(toolsMath); }
      else if (math === "30%") { addRef("נמצאו קשיים בחשבון: יש לשקול מתן סיוע פרטני."); addTool(toolsMath); }
    }
    if (syms.length || refs.length || tools.length) {
      box("purple", "📚 נמצאו קשיים לימודיים — כיתות א-ג");
      if (syms.length) box("purple", syms.map(s => "📊 " + s).join("\n"));
      refs.forEach(r => box("info", "✅ " + r));
      tools.forEach(t => box("info", t));
      box("info", "📌 ניתן להיוועץ גם עם יועצת בית הספר לתיאום בין הבית למסגרת החינוכית");
    }
    return boxes;
  }

  // ד-ו
  if (ga === "dv") {
    const read    = A.dv_read === "כן";
    const histYes = ["dv_h1", "dv_h2", "dv_h3", "dv_h4", "dv_h5"].filter(k => A[k] === "כן").length;
    const write   = A.dv_write === "כן";
    const comp    = A.dv_comp  === "כן";
    const math    = A.dv_math  || "לא";
    const adhdQ2yn = A.dv_adhd_yn === "כן";
    const inattQ2 = ["dv_ad1", "dv_ad2", "dv_ad3", "dv_ad4", "dv_ad5", "dv_ad6"].filter(k => A[k]).length;
    const hyperQ2 = ["dv_ah1", "dv_ah2", "dv_ah3", "dv_ah4", "dv_ah5", "dv_ah6"].filter(k => A[k]).length;
    const inattR  = ["dv_read_ad1", "dv_read_ad2", "dv_read_ad3", "dv_read_ad4", "dv_read_ad5", "dv_read_ad6"].filter(k => A[k]).length;
    const hyperR  = ["dv_read_ah1", "dv_read_ah2", "dv_read_ah3", "dv_read_ah4", "dv_read_ah5", "dv_read_ah6"].filter(k => A[k]).length;
    const efR = efCountFromPrefix("dv_read");
    const efQ2 = efCountFromPrefix("dv");
    const adhdPosQ2 = inattQ2 >= 4 || hyperQ2 >= 4;
    const adhdAny   = adhdPosQ2 || inattR >= 4 || hyperR >= 4;
    if (!read && !adhdQ2yn && !write && !comp && math === "לא") return boxes;

    const toolsChizuk = "📌 תוכנית חיזוקים — כלים לסיוע בלמידה בכיתה ובבית:\n1. משוב חיובי קבוע — שבחים פשוטים על הצלחה קטנה, עידוד להמשיך ולנסות, מיקוד במאמצים ולא רק בתוצאות.\n2. שילוב תרגילים להרפיה ומדיטציה קלה (נשימות עמוקות, הרפיית שרירים, דמיון מודרך) לפני פעילות לימודית מאתגרת.\n3. התאמת ההוראה לצרכים הייחודיים — בניית מטלות המאפשרות התקדמות בקצב אישי, עם הצלחות קטנות ומדורגות.\n4. למידה בקבוצות קטנות או בעזרת עמיתים.";
    const toolsMath = "📌 כלים לחיזוק חשבון (גיל היסודי הגדול):\nא. שיפור הבנה בסיסית: פירוק משימות לשלבים, שימוש בדוגמאות מחיי היומיום, המחשה בשרטוטים ודיאגרמות.\nב. פיתוח אסטרטגיות: קוד צבעים בנוסחאות, למידה בקבוצות קטנות, הצגת בעיות בדרכים שונות.\nג. כלים טכנולוגיים:\n   • Matific — פלטפורמה חינוכית מבוססת משחקים, פעילויות מתמטיות אינטראקטיביות בעברית.";

    const syms: string[] = [], refs: string[] = [], tools: string[] = [];
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
          const mot = (A.dv_mot1 || 1) + (A.dv_mot2 || 1) + (A.dv_mot3 || 1);
          if (mot >= 7) addRef("נמצאו קשיים רגשיים מול למידה — יש להפנות לטיפול פסיכודינאמי בשילוב הדרכת הורים");
          else { if (!emitADHD(inattR, hyperR, efR)) addRef("הפנייה לאבחון פסיכודידקטי"); }
        }
      } else if (histYes >= 1 && histYes <= 3) {
        const speech = A.dv_read_speech;
        if (speech === "כן") {
          const smotiv = A.dv_speech_motiv;
          if (smotiv === "כן") addRef("יש לבנות תוכנית בית-ספרית — אם אין שיפור לאחר כחודשיים יש לפנות לאבחון פסיכודידקטי");
          else if (smotiv === "לא") {
            addRef("יש לבנות תוכנית בית-ספרית — אם אין שיפור לאחר כחודשיים יש לפנות לאבחון פסיכודידקטי"); addTool(toolsChizuk);
            const smot = (A.dv_smot1 || 1) + (A.dv_smot2 || 1) + (A.dv_smot3 || 1);
            if (smot >= 7) addRef("נמצאו קשיים רגשיים מול למידה — יש להפנות לטיפול פסיכודינאמי בשילוב הדרכת הורים");
            else { if (!emitADHD(inattR, hyperR, efR)) addRef("הפנייה לאבחון פסיכודידקטי"); }
          }
        } else if (speech === "לא") addRef("יש לבחון פנייה לקלינאית תקשורת");
      } else if (histYes >= 4) addRef("הפנייה לאבחון פסיכודידקטי");
    }
    if (adhdQ2yn) emitADHD(inattQ2, hyperQ2, efQ2);
    if (write) {
      addSym("נמצאו סימנים לקשיי כתב יד");
      if (A.dv_write_ot === "כן") addRef("קשיי כתב יד — יש לחזור לבדיקה אצל מרפאה בעיסוק");
      else addRef("קשיי כתב יד — יש לבחון פנייה לריפוי בעיסוק");
    }
    if (comp) {
      addSym("נמצאו סימנים לקשיי הבנה בשיעור");
      if (!read && !adhdAny) addRef("הפנייה לאבחון פסיכודידקטי");
    }
    if (math !== "לא") {
      addSym("נמצאו סימנים לקשיי חשבון");
      const hasRA = read || adhdAny;
      if (math === "5%") { addRef(hasRA ? "נמצאו קשיים משמעותיים בחשבון בשילוב קשיים נוספים:\nא. יש לשקול סיוע פרטני דרך בית הספר או באופן פרטי.\nב. הפנייה לאבחון פסיכודידקטי." : "נמצאו קשיים משמעותיים בחשבון:\nא. יש לשקול סיוע פרטני דרך בית הספר או באופן פרטי.\nב. הפנייה לאבחון פסיכודידקטי."); addTool(toolsMath); }
      else if (math === "10%") { addRef("נמצאו קשיים בחשבון:\nיש לשקול סיוע פרטני דרך בית הספר או באופן פרטי."); addTool(toolsMath); }
      else if (math === "30%") { addRef("נמצאו קשיים קלים בחשבון — יש לשקול סיוע פרטני."); addTool(toolsMath); }
    }
    if (syms.length || refs.length || tools.length) {
      box("purple", "📚 נמצאו קשיים לימודיים — כיתות ד-ו");
      if (syms.length) box("purple", syms.map(s => "📊 " + s).join("\n"));
      refs.forEach(r => box("info", "✅ " + r));
      tools.forEach(t => box("info", t));
      box("info", "📌 ניתן להיוועץ גם עם יועצת בית הספר לתיאום בין הבית למסגרת החינוכית");
    }
    return boxes;
  }

  // ז-ח / ט-יב
  if (ga === "zh" || ga === "tyb") {
    const p = ga, isTyb = ga === "tyb";
    const verbal = A[p + "_verbal"] || "לא", math = A[p + "_math"] || "לא", eng = A[p + "_eng"] || "לא";
    const adhdYn = A[p + "_adhd_yn"] === "כן";
    const inatt = ["_ad1", "_ad2", "_ad3", "_ad4", "_ad5", "_ad6"].filter(k => A[p + k]).length;
    const hyper = ["_ah1", "_ah2", "_ah3", "_ah4", "_ah5", "_ah6"].filter(k => A[p + k]).length;
    const efCountP = efCountFromPrefix(p);
    const adhdPos = inatt >= 4 || hyper >= 4;
    const write = A[p + "_write"] === "כן", comp = A[p + "_comp"] === "כן";
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

    // קשיים ברבי מלל בלבד הם סיבה לאבחון פסיכודידקטי, גם ב-5% וגם ב-20%+
    if (verbal !== "לא") {
      addSym("נמצאו סימנים לקשיים ברבי מלל");
      if (verbal === "5%" || verbal === "20%" || verbal === "מעל 20%") addRef("הפנייה לאבחון פסיכודידקטי");
      addTool(isTyb ? verbalToolsHigh : verbalToolsMid);
    }
    // קשיים במתמטיקה / אנגלית בלבד אינם מצריכים אבחון פסיכודידקטי כשלעצמם.
    // אבחון מומלץ רק אם הם מלווים בקשיים ברבי מלל, בקשב, או ברגשי-לימודי.
    const verbalPos = verbal !== "לא";
    const mathSevere = math === "20%" || math === "מעל 20%";
    const engSevere = eng === "20%" || eng === "מעל 20%";
    if (math !== "לא") {
      addSym("נמצאו סימנים לקשיים במתמטיקה");
      if (mathSevere && (verbalPos || adhdPos)) addRef("הפנייה לאבחון פסיכודידקטי לבירור קשיי הלמידה הכוללים");
      addTool(isTyb ? mathToolsHigh : mathToolsMid);
    }
    if (eng !== "לא") {
      addSym("נמצאו סימנים לקשיים באנגלית");
      if (engSevere && (verbalPos || adhdPos)) addRef("הפנייה לאבחון פסיכודידקטי לבירור קשיי הלמידה הכוללים");
      addTool(engTools);
    }
    if (adhdYn) emitADHD(inatt, hyper, efCountP);
    if (write) {
      addSym("נמצאו סימנים לקשיי כתב יד");
      addRef("קשיי כתב יד — יש לבחון פנייה לריפוי בעיסוק");
      addTool(isTyb ? writeToolsHigh : writeToolsMid);
    }
    if (comp) {
      addSym("נמצאו סימנים לקשיי הבנה בשיעור");
      const hasRel = verbal !== "לא" || adhdPos;
      if (!hasRel) { addRef("קשיים בהבנה שאינם מוסברים ע\"י קשיי קשב או קריאה — יש לפנות לאבחון פסיכו-דידקטי"); }
      addRef("יש לשים לב להתאמות במבחנים — בכיתות ט'-יב' מדובר בהתאמות לבגרויות; בז'-ח' אפשר לבקש התאמות במבחנים פנימיים דרך יועצת בית הספר");
    }
    if (syms.length || refs.length || tools.length) {
      box("purple", "📚 נמצאו קשיים לימודיים — כיתות " + (isTyb ? "ט-יב" : "ז-ח"));
      if (syms.length) box("purple", syms.map(s => "📊 " + s).join("\n"));
      refs.forEach(r => box("info", "✅ " + r));
      tools.forEach(t => box("info", t));
      box("info", "📌 ניתן להיוועץ גם עם יועצת בית הספר לתיאום בין הבית למסגרת החינוכית, ולבדוק זכאות לשעות שילוב");
    }
    return boxes;
  }

  return boxes;
}

// ── Compute developmental results ─────────────────────────────────────────────

function computeDevResults(A: Ans): KidsBox[] {
  if (!["מעט", "הרבה", "הרבה מאוד"].includes(A.a_dev || "")) return [];
  const boxes: KidsBox[] = [];
  function box(cls: BoxCls, txt: string) { boxes.push({ cls, txt }); }
  const age = parseInt(A._age) || 0;
  const ageOk = devAgeOk(A);
  const toiletShow = ageOk || A.toilet === "כן";

  // גמילה
  if (toiletShow && A.dev_toilet === "כן") {
    const ttype = A.dev_toilet_type || "";
    const past  = A.dev_toilet_past || "";
    box("purple", "📊 נמצאו קשיים בגמילה / התרוקנות");

    if (ttype === "א") {
      box("warn", "⚠️ נמצאו סימפטומים של עצירות — יש לפנות לרופא הילדים או לפיזיותרפיה של רצפת אגן בילדים");
      box("info", "✅ הפנייה: רופא ילדים / פיזיותרפיסטית רצפת אגן ילדים (פרטי או דרך הקופה)\n\n📋 הערה — עצירות:\nנראה כי הילד מתמודד עם עצירות: קושי או כאבים במתן צואה, צואה קשה, התרוקנות בתדירות נמוכה.\n\nכלים לניסיון בבית:\n• שתיית מים מרובה — לפחות 35 מ\"ל לכל ק\"ג משקל גוף\n• ישיבה יזומה בשירותים כרבע שעה לאחר ארוחה\n• ישיבה עם שרפרף מתחת לכפות הרגליים כך שהברכיים גבוהות מהירך\n• תרגול נשימה בזמן הישיבה בשירותים\n\nאם אין שיפור תוך כשבועיים → פנייה לפיזיותרפיה רצפת אגן ילדים.");
    } else if (ttype === "ב") {
      const wetType = A.dev_wet_type || "";
      box("warn", "⚠️ נמצאו סימפטומים של הרטבת " + (wetType || "שתן") + " — יש לפנות לאורולוג ילדים או לפיזיותרפיה של רצפת אגן בילדים");
      box("info", "✅ הפנייה: אורולוג ילדים / פיזיותרפיסטית רצפת אגן ילדים (פרטי או דרך הקופה)\n\n📋 הערה — הרטבת יום/לילה:\nב-70–80% מהמקרים הגורם הראשוני הוא עצירות.\n\nכלים לניסיון בבית:\n• שתיית מים מרובה — לפחות 35 מ\"ל לכל ק\"ג משקל גוף\n• ישיבה יזומה בשירותים כרבע שעה לאחר ארוחה\n• ישיבה עם שרפרף מתחת לכפות הרגליים כך שהברכיים גבוהות מהירך\n• תרגול נשימה בזמן הישיבה בשירותים\n\nאם ההרטבה החלה בעקבות אירוע משברי → פנייה לפסיכולוג חינוכי/התפתחותי.\n\n⚠️ חשוב:\n• אין להפעיל לחץ גלוי או סמוי\n• אין להעניש או להעליב\n• אין להכריח את הילד לכבס את מצעיו ובגדיו");
    } else if (ttype === "ג") {
      box("warn", "⚠️ נמצאו סימפטומים של בריחת צואה (אנקופרזיס) — יש לפנות לגסטרולוג ילדים או לפיזיותרפיה של רצפת אגן בילדים");
      box("info", "✅ הפנייה: גסטרולוג ילדים / פיזיותרפיסטית רצפת אגן ילדים (פרטי או דרך הקופה)\n\n📋 הערה — התלכלכות/הצטאות (אנקופרזיס):\nב-80–90% מהמקרים הגורם הראשוני הוא עצירות.\n\nכלים לניסיון בבית:\n• שתיית מים מרובה — לפחות 35 מ\"ל לכל ק\"ג משקל גוף\n• ישיבה יזומה בשירותים כרבע שעה לאחר ארוחה\n• ישיבה עם שרפרף מתחת לכפות הרגליים\n• תרגול נשימה בזמן הישיבה\n\n⚠️ חשוב:\n• חיזוקים חיוביים בלבד — חיזוקים שליליים עלולים להחמיר\n• אין להפעיל מתח, לחץ או חרדה\n• אם יש התלכלכות בגן/ביה\"ס → לערב פסיכולוג הגן");
    } else if (ttype === "ד") {
      box("warn", "⚠️ נמצאו סימפטומים של בריחת שתן וצואה — יש לפנות לגסטרולוג ילדים או לפיזיותרפיה של רצפת אגן בילדים");
      box("info", "✅ הפנייה: גסטרולוג ילדים / פיזיותרפיסטית רצפת אגן ילדים (פרטי או דרך הקופה)\n\n📋 הערה — הרטבה + התלכלכות:\nב-70–90% מהמקרים הגורם הראשוני הוא עצירות.\n\nכלים לניסיון בבית:\n• שתיית מים מרובה — לפחות 35 מ\"ל לכל ק\"ג משקל גוף\n• ישיבה יזומה בשירותים כרבע שעה לאחר ארוחה\n• ישיבה עם שרפרף מתחת לכפות הרגליים\n\n⚠️ חשוב:\n• חיזוקים חיוביים בלבד\n• אין להפעיל לחץ, להעניש, להעליב\n• אם יש התלכלכות בגן/ביה\"ס → לערב פסיכולוג הגן");
    }

    if (past === "לא") {
      box("info", "📌 עשרת כללי הגמילה (לילדים שטרם גמולו):\n\nא. סימנים שאפשר להתחיל:\n   1. יבש/ה 1.5–2 שעות ברצף\n   2. מודעות לכך שעושה צרכים (נעמד בצד, מודיע \"יש לי\")\n   3. מבינ/ה הוראות פשוטות ויודע/ת לזהות איברי גוף\n   4. מביע/ה רצון לעצמאות (\"אני לבד!\")\n\nב. עדיף לא להתחיל בתקופות לחוצות (מעבר דירה, מעבר גן, מתח)\n\nג. עקביות ונחישות: אם מורידים בשעות הערות — להוריד לגמרי, לא לסירוגין\n\nד. התחלה: עדיף כשיש כמה ימים ברצף בבית (סוף שבוע / חגים)\n\nו. תזכורות: בימים הראשונים — להציע ללכת לשירותים כל 45 דקות\n\nז. ציוד נכון: סיר נוח / מקטין אסלה עם שרפרף, בגדים שקל להוריד, סטים להחלפה\n\nח. פספוסים — חלק בלתי נפרד מהלמידה:\n   \"אופס, ברח הפיפי. פיפי עושים בסיר/בשירותים\"\n   אל תכעסו, אל תענישו, אל תגרמו לבושה\n\nט. חיזוקים: שבחו מאמץ ומודעות — \"אמרת לי שיש פיפי — מצוין!\"\n   פרסים: קטנים, מיידיים, קצרי טווח (מדבקה/חותמת)\n\nי. גמילת לילה: מורכבת יותר וקשורה לפיזיולוגיה. מומלץ לגמול ביום קודם.");
    } else if (past === "כן") {
      if (age > 0 && age < 3) {
        box("info", "📌 המלצות לילדים עד גיל 3 (הייתה גמילה מלאה בעבר):\n\nחשוב: יש להימנע מהפעלת לחץ גלוי או סמוי.\n\nמה כן לעשות:\n• חשיפה לנושא הגמילה דרך ספרים\n• צפייה בבני גילו שמשתמשים בשירותים\n• ישיבה על סיר / אסלה לסיפור או משחק — ללא לחץ לתוצאה\n\nאם יש חרדת אסלה / התנגדות:\n→ פנייה לפיזיותרפיסטית רצפת אגן ילדים\n→ הדרכה על ידי פסיכולוג חינוכי/התפתחותי\n\nאם יש חוסר שליטה ובריחות:\n→ שלב ראשון: רופא ילדים לשלילת קושי פיזיולוגי\n→ שלב שני: פיזיותרפיה רצפת אגן ילדים");
      } else {
        box("info", "📌 המלצות לילדים מעל גיל 3 (הייתה גמילה מלאה בעבר):\n\n→ שלב ראשון: רופא ילדים לשלילת קושי פיזיולוגי\n→ שלב שני: פיזיותרפיה רצפת אגן ילדים (פרטי או דרך הקופה)\n\nחשוב: יש להימנע מהפעלת לחץ גלוי או סמוי. אין להעניש או להעליב.");
      }
    }
  }

  // ויסות חושי
  if (ageOk && A.dev_sensory === "כן") {
    const overTot  = ["so1", "so2", "so3", "so4", "so5", "so6", "so7", "so8", "so9", "so10"].reduce((s, k) => s + (A[k] || 0), 0);
    const underTot = ["su1", "su2", "su3", "su4", "su5", "su6", "su7", "su8"].reduce((s, k) => s + (A[k] || 0), 0);
    const hasOver  = overTot  > 0;
    const hasUnder = underTot > 0;

    if (!hasOver && !hasUnder) {
      box("purple", "📊 ישנם תסמינים כלליים לקשיי ויסות חושי");
      box("warn", "⚠️ יש לפנות לרופא המשפחה להמשך בדיקה");
    } else {
      if (hasOver) {
        if (overTot >= 26) { /* תקין */ }
        else if (overTot >= 24) {
          box("purple", "📊 נמצאו סימנים לרגישות יתר תחושתית (הבדל קל, ציון: " + overTot + ")");
          box("warn", "⚠️ ישנם תסמינים כלליים לקשיי ויסות חושי. יש לפנות לרופא המשפחה להמשך בדיקה");
        } else {
          box("purple", "📊 חשד לרגישות יתר תחושתית (הבדל ברור, ציון: " + overTot + ")");
          box("info", "✅ הפנייה: טיפול ויסות חושי על ידי ריפוי בעיסוק");
        }
      }
      if (hasUnder) {
        if (underTot >= 19) { /* תקין */ }
        else if (underTot >= 16) {
          box("purple", "📊 נמצאו סימנים לתת-תגובתיות תחושתית (הבדל קל, ציון: " + underTot + ")");
          box("warn", "⚠️ ישנם תסמינים כלליים לקשיי ויסות חושי. יש לפנות לרופא המשפחה להמשך בדיקה");
        } else {
          box("purple", "📊 חשד לתת-תגובתיות תחושתית (הבדל ברור, ציון: " + underTot + ")");
          box("info", "✅ הפנייה: טיפול ויסות חושי על ידי ריפוי בעיסוק");
        }
      }
    }
  }

  return boxes;
}

// ── Compute behavioral results ────────────────────────────────────────────────

function computeBehResults(A: Ans): KidsBox[] {
  if (!["מעט", "הרבה", "הרבה מאוד"].includes(A.a_beh || "")) return [];
  const ml = A.beh_max_level || 0;
  if (ml <= 0) return [];
  const boxes: KidsBox[] = [];
  function box(cls: BoxCls, txt: string) { boxes.push({ cls, txt }); }
  const finalPlan = gg(A) === "ga" ? "חיובי" : (A.beh_plan || "");
  box("purple", "📊 נמצאו קשיים התנהגותיים");
  if (finalPlan === "חיובי") {
    box("info", "✅ הפנייה: תוכנית התנהגותית ממוקדת מרכיבים חיוביים");
  } else if (finalPlan === "חיובי_שלילי") {
    box("info", "✅ הפנייה: תוכנית התנהגותית ממוקדת מרכיבים חיוביים ושליליים, בשיתוף המורים וההורים");
  } else if (finalPlan === "חיובי_שלילי_פסיכולוגי") {
    box("info", "✅ הפנייה: תוכנית התנהגותית עם מרכיבים חיוביים ושליליים, בשיתוף המורים וההורים — יחד עם טיפול פסיכולוגי");
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

function computeSocResults(A: Ans): KidsBox[] {
  if (!["מעט", "הרבה", "הרבה מאוד"].includes(A.a_soc || "")) return [];
  const boxes: KidsBox[] = [];
  function box(cls: BoxCls, txt: string) { boxes.push({ cls, txt }); }
  const lsas = A.lsas_tot || 0;
  const soc1 = A.soc1 || "", soc2 = A.soc2 || "", soc3 = A.soc3 || "";
  const sev = A.soc2_sev || 0;
  const hasSocIssue = (soc1 === "כן" && lsas >= 8) || soc2 === "כן" || soc3 === "כן";
  if (hasSocIssue) box("purple", "📊 נמצאו קשיים חברתיים");
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
      box("warn", "📊 דווחו סימפטומים קלים של חרדה חברתית");
    } else if (lsas <= 18) {
      box("warn", "📊 דווחו סימפטומים בינוניים של חרדה חברתית");
    } else {
      box("danger", "📊 דווחו סימפטומים משמעותיים של חרדה חברתית");
    }
    box("info", ref);
  }
  if (soc2 === "כן") {
    if (sev >= 5) {
      addSocRef("קשיים חברתיים גבוהים — הפנייה לקבוצה חברתית + כלים לעבודה בכיתה + טיפול פסיכודינאמי ע\"פ מאפייני הילד");
    } else if (sev >= 1) {
      socNonTherapyRefs.push("קשיים חברתיים מתונים — הפנייה לקבוצה חברתית + כלים לעבודה בכיתה");
    }
  }
  if (soc3 === "כן") {
    const allComm = A.comm1 === "כן" && A.comm2 === "כן" && A.comm3 === "כן";
    const hasExtra = A.comm_rep === "כן" || A.comm_rigid === "כן" || A.comm_interest === "כן" || A.comm_sens === "כן";
    const allExtraNo = A.comm_rep === "לא" && A.comm_rigid === "לא" && A.comm_interest === "לא" && A.comm_sens === "לא";
    if (allComm && hasExtra) {
      box("danger", "📊 ייתכנו תסמינים של קשיי תקשורת — יש לפנות ליועצת ופסיכולוג בית הספר לשם הערכה מקיפה");
    } else if (allComm && allExtraNo) {
      addSocRef("נמצאו קשיי תקשורת — הפנייה לטיפול פסיכודינאמי בשילוב הדרכת הורים");
    } else if (A.soc3_early === "לא") {
      addSocRef("נמצאו סימני קושי בתקשורת — הפנייה לטיפול פסיכודינאמי בשילוב הדרכת הורים");
    } else {
      socNonTherapyRefs.push("נמצאו סימני קושי בתקשורת — מומלץ להיוועץ עם יועצת/פסיכולוג");
    }
  }
  socNonTherapyRefs.forEach(r => box("info", "✅ " + r));
  if (socTherapyRefs.length > 0 && !hasEmoTherapyRef) {
    const emoMotVal = (A.aq_mot_bv || 0) + (A.aq_mot_zy || 0);
    const socMotVal = A.soc_motiv_therapy || 0;
    const motVal = emoMotVal > 0 ? emoMotVal : socMotVal;
    if (motVal >= 1) {
      const refTxt = motVal <= 2
        ? "יש להפנות לטיפול פסיכודינאמי + הדרכת הורים והתערבות במסגרת החינוכית"
        : "יש להפנות לטיפול פסיכודינאמי משולב + CBT בשילוב הדרכת הורים והתערבות במסגרת החינוכית";
      box("info", "✅ " + refTxt);
    } else {
      box("info", "✅ יש לענות על שאלת המוטיבציה (בשאלון) לקביעת סוג הטיפול הרגשי המומלץ");
    }
  }
  if (soc2 === "כן" || soc3 === "כן") {
    box("info", "📌 כלים לעבודה בכיתה עם קשיים חברתיים:\n\n• אין לנהל שיח על מקרה מיד לאחר מריבה — יש להשהות לפחות שעתיים עד לרגיעה.\n• תחילת ואמצע השיח — שאלות פתוחות, לא שיפוטיות ולא ביקורתיות; הקשבה לסיבות ולהסברים של הילד/ה, גם אם נשמעים לא הגיוניים.\n• בסוף השיח — להתמקד בדרכים בהן יוכל להימנע מחיכוכים בפעם הבאה, ולשקף מה היו הטריגרים.\n• אין להתייאש — לאחר מספר התערבויות ניתן לראות שיפור.\n• אם ניתן, לחשוב יחד על רגעים בהם הוא מתחיל להתפרץ (עוד לפני שהתפרץ) ולבנות איתו דרך פעולה.\n• המורה אינו מערב רגשות שליליים בשיח (ייאוש, אכזבה, כעס) — מתמקד בהתנהגות, בהקשבה לצרכים ובהתבוננות לעתיד.\n• אין לנהל \"שיחות מוסר\" ארוכות ומייגעות.");
  }
  return boxes;
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface KidsScoreResult {
  emotional:    KidsBox[];
  academic:     KidsBox[];
  developmental: KidsBox[];
  behavioral:   KidsBox[];
  social:       KidsBox[];
}

export function scoreKidsQuestionnaire(answers: Record<string, any>): KidsScoreResult {
  return {
    emotional:    computeResults(answers),
    academic:     computeAcadResults(answers),
    developmental: computeDevResults(answers),
    behavioral:   computeBehResults(answers),
    social:       computeSocResults(answers),
  };
}
