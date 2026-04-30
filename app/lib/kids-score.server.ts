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
    // שלושה אופציות טיפול לטראומה — כל אחת ניתנת להתאמה למטפל בנפרד
    emoStandalones.push({ cls: "info", txt: "✅ הפנייה לטיפול EMDR לעיבוד הטראומה" });
    emoStandalones.push({ cls: "info", txt: "✅ חלופה: טיפול CPT (Cognitive Processing Therapy) — גישה קוגניטיבית מבוססת-ראיות" });
    emoStandalones.push({ cls: "info", txt: "✅ חלופה נוספת: טיפול דינאמי בטראומה — מתאים בעיקר לטראומה מורכבת או הקשורה ליחסים קרובים" });
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
//
// המבנה: computeAcadResults הוא הממשק הציבורי, ועוטף את:
//   1. computeAcadResultsRaw — מחזיר את הממצאים הגולמיים (לפי קבוצת גיל).
//   2. שכבת post-processing — הודעת "ללא ממצאים", הצלבת רגשי-לימודי, מעקב.
//
// הלוגיקה הספציפית לכל קבוצת גיל מפוצלת לפונקציות נפרדות (computeGanAcad,
// computeAGAcad, computeDVAcad, computeZHTYBAcad). כל פונקציה משתמשת ב-Findings
// accumulator לאסוף תסמינים/הפניות/כלים, ואז flush-ת אותם דרך flushFindings.
// זיהוי ADHD נעשה דרך מפעיל יחיד (makeAdhdEmitter) שמונע פליטה כפולה.

// ── Tools (long strings extracted to module level for reuse and clarity) ──────

const ACAD_TOOLS_CHIZUK =
  "📌 תוכנית חיזוקים — כלים לסיוע בלמידה בכיתה ובבית:\n" +
  "1. משוב חיובי קבוע — שבחים פשוטים על הצלחה קטנה, עידוד להמשיך ולנסות, מיקוד במאמצים ולא רק בתוצאות.\n" +
  "2. שילוב תרגילים להרפיה ומדיטציה קלה (נשימות עמוקות, הרפיית שרירים, דמיון מודרך) לפני פעילות לימודית מאתגרת.\n" +
  "3. התאמת ההוראה לצרכים הייחודיים — בניית מטלות המאפשרות התקדמות בקצב אישי, עם הצלחות קטנות ומדורגות.\n" +
  "4. למידה בקבוצות קטנות או בעזרת עמיתים.";

const ACAD_TOOLS_MATH_AG =
  "📌 כלים לחיזוק חשבון:\n" +
  "א. שיפור הבנה בסיסית: פירוק משימות לשלבים, שימוש בדוגמאות מחיי היומיום, המחשה בשרטוטים ודיאגרמות.\n" +
  "ב. פיתוח אסטרטגיות: קוד צבעים בנוסחאות, למידה בקבוצות קטנות, הצגת בעיות בדרכים שונות.\n" +
  "ג. כלים טכנולוגיים:\n" +
  "   • Math Land — משחק הרפתקאות עם תרגילי חשבון ברמות שונות (בתשלום)\n" +
  "   • Pet Bingo — בינגו חוויתי עם תרגילי חיבור/חיסור/כפל/חילוק (חינמי)";

const ACAD_TOOLS_MATH_DV =
  "📌 כלים לחיזוק חשבון (גיל היסודי הגדול):\n" +
  "א. שיפור הבנה בסיסית: פירוק משימות לשלבים, שימוש בדוגמאות מחיי היומיום, המחשה בשרטוטים ודיאגרמות.\n" +
  "ב. פיתוח אסטרטגיות: קוד צבעים בנוסחאות, למידה בקבוצות קטנות, הצגת בעיות בדרכים שונות.\n" +
  "ג. כלים טכנולוגיים:\n" +
  "   • Matific — פלטפורמה חינוכית מבוססת משחקים, פעילויות מתמטיות אינטראקטיביות בעברית.";

const ACAD_TOOLS_VERBAL_MID =
  "📌 כלים לעבודה עם קשיים ברבי מלל (גילאי החטיבה):\n" +
  "1. תוכנית התנהגותית של קריאת ספרים עם תגמול/טבלה.\n" +
  "2. פירוק טקסטים לרכיבים קטנים — \"קריאה פעילה\": קריאת כל פסקה בנפרד וסיכומה במשפט.\n" +
  "3. בניית \"תרשימי זרימה\" צבעוניים שמסבירים בקצרה על מה מדברת כל פסקה.\n" +
  "4. קריאה תוך כדי רישום הנקודות העיקריות בכל פסקה.\n" +
  "5. למידה בקבוצות — הכוונה ללמידה איטית תוך כדי שיח על התסכול שמתעורר.\n" +
  "6. אסטרטגיית SQ3R — Survey ▸ Question ▸ Read ▸ Recite ▸ Review.\n" +
  "⚠️ חשוב: לוקח זמן לראות תוצאות — לאחר מספר חודשים לרוב רואים שיפור.";

const ACAD_TOOLS_VERBAL_HIGH =
  "📌 כלים לעבודה עם קשיים ברבי מלל (גילאי התיכון):\n" +
  "1. תוכנית התנהגותית של קריאת ספרים עם תגמול/טבלה.\n" +
  "2. פירוק טקסטים לרכיבים קטנים — \"קריאה פעילה\".\n" +
  "3. בניית \"תרשימי זרימה\" צבעוניים לפי פסקאות.\n" +
  "4. שימוש בכלי AI לסיכום מאמרים ארוכים לבגרות.\n" +
  "5. פיתוח \"הבנה אינפרנציאלית\": הסקת מידע שנרמז — קשרים סיבתיים, ניתוח עמדות, השוואה.\n" +
  "6. שיטת Obsidian לארגון ידע — יצירת דפים וקישורים בין מושגים.\n" +
  "⚠️ חשוב: לוקח זמן לראות תוצאות — לאחר מספר חודשים לרוב רואים שיפור.";

const ACAD_TOOLS_MATH_MID =
  "📌 כלים לעבודה עם קשיים במתמטיקה (גילאי החטיבה):\n" +
  "1. עזרה פרטנית — שיעורים פרטיים, חלוקה בין זמן בית לזמן בית ספר.\n" +
  "2. למידה בעזרת אפליקציות לימודיות וטכנולוגיה.\n" +
  "3. חזרה לחיזוק יסודות המתמטיקה.\n" +
  "4. שיח: האם מתעוררת חרדה כתוצאה מהקושי.\n" +
  "5. קבוצות תרגול או תגבורים בבית הספר.";

const ACAD_TOOLS_MATH_HIGH =
  "📌 כלים לעבודה עם קשיים במתמטיקה (גילאי התיכון):\n" +
  "א. שיפור הבנה בסיסית: פירוק בעיות לשלבים, שימוש בדוגמאות מחיי היומיום, המחשה בשרטוטים.\n" +
  "ב. אסטרטגיות למידה: קוד צבעים בנוסחאות, למידה בקבוצות קטנות, הצגת בעיות בדרכים שונות.\n" +
  "ג. כלים טכנולוגיים: \"פשוט מתמטיקה\" — קורסים מקוונים בעברית מהטכניון.";

const ACAD_TOOLS_ENG =
  "📌 כלים לעבודה עם קשיים באנגלית:\n" +
  "1. תגבור פרטי ע\"י מורה לאנגלית — חלוקה בין זמן בית לזמן בית ספר.\n" +
  "2. למידה בעזרת אפליקציות (Duolingo, Quizlet) ופלטפורמות דיגיטליות.\n" +
  "3. למידה בהקשר — חשיפה לאנגלית דרך סרטים, שירים ומשחקים.\n" +
  "4. חזרה לחיזוק יסודות: דקדוק, אוצר מילים ומבנה משפטים.\n" +
  "5. קבוצות תרגול או תגבורים בבית הספר.";

const ACAD_TOOLS_WRITE_MID =
  "📌 כלים לעבודה עם קשיי כתיבה (גילאי החטיבה):\n" +
  "תרגול \"כתיבה מהירה\":\n" +
  "שלב 1 — כתיבה חופשית (5 דקות): כתיבה ברצף על נושא חופשי. כללים: לא מרימים עט, לא מתקנים תוך כדי.\n" +
  "שלב 2 — קריאה עצמית + סימון (3 דקות): סימון שגיאות כתיב, חזרות, משפטים לא ברורים.\n" +
  "שלב 3 — \"טעויות חוזרות\": טבלת שיפור אישי — מה גיליתי? דוגמא מכתיבתי. איך לשפר?";

const ACAD_TOOLS_WRITE_HIGH =
  "📌 כלים לעבודה עם קשיי כתיבה (גילאי התיכון):\n" +
  "1. מעבר מכתב-יד להקלדה בבחינות.\n" +
  "2. מפות מושגים לפני כתיבה — ארגון רעיונות לפני ניסוח.\n" +
  "3. דף עבודה \"לפני כתיבה\": מה אני טוען? אילו דוגמאות? למי אני כותב?";

// ── Constants for referrals and notes ─────────────────────────────────────────

const PSYCHODIDACTIC_NOTE_AG =
  "(אבחון פסיכודידקטי מומלץ לרוב מכיתה ג' ומעלה, כשיש מספיק נתונים על תפקוד לימודי בסיסי)";

const REF_PSYCHODIDACTIC_AG = "הפנייה לאבחון פסיכודידקטי " + PSYCHODIDACTIC_NOTE_AG;
const REF_PSYCHODIDACTIC = "הפנייה לאבחון פסיכודידקטי";

const REF_EMOTIONAL_LEARNING_AG =
  "נמצאו קשיים רגשיים מול למידה — יש להפנות לטיפול בהבעה ויצירה בשילוב הדרכת הורים";
const REF_EMOTIONAL_LEARNING_DV =
  "נמצאו קשיים רגשיים מול למידה — יש להפנות לטיפול פסיכודינאמי בשילוב הדרכת הורים";

const REF_SCHOOL_SHILUV =
  "יש לבנות תוכנית חיזוקים. כדאי לבדוק עם יועצת בית הספר זכאות לשעות שילוב במסגרת הכיתתית";

const COUNSELOR_FOOTER_AG_DV =
  "📌 ניתן להיוועץ גם עם יועצת בית הספר לתיאום בין הבית למסגרת החינוכית";
const COUNSELOR_FOOTER_ZHTYB =
  "📌 ניתן להיוועץ גם עם יועצת בית הספר לתיאום בין הבית למסגרת החינוכית, ולבדוק זכאות לשעות שילוב";

// ── Findings accumulator ──────────────────────────────────────────────────────

interface Findings {
  syms: string[];
  refs: string[];
  tools: string[];
}
function newFindings(): Findings { return { syms: [], refs: [], tools: [] }; }
function addSym(f: Findings, s: string) { if (!f.syms.includes(s)) f.syms.push(s); }
function addRef(f: Findings, r: string) { if (!f.refs.includes(r)) f.refs.push(r); }
function addTool(f: Findings, t: string) { if (!f.tools.includes(t)) f.tools.push(t); }

function flushFindings(boxes: KidsBox[], headerTxt: string, f: Findings, footerTxt?: string) {
  if (!(f.syms.length || f.refs.length || f.tools.length)) return;
  boxes.push({ cls: "purple", txt: headerTxt });
  if (f.syms.length) boxes.push({ cls: "purple", txt: f.syms.map(s => "📊 " + s).join("\n") });
  f.refs.forEach(r => boxes.push({ cls: "info", txt: "✅ " + r }));
  f.tools.forEach(t => boxes.push({ cls: "info", txt: t }));
  if (footerTxt) boxes.push({ cls: "info", txt: footerTxt });
}

// ── Vision/hearing ────────────────────────────────────────────────────────────

function emitVisionHearing(A: Ans, boxes: KidsBox[]) {
  if (A.vision === "לא" && A.vis_sym === "כן") {
    boxes.push({ cls: "warn", txt: "⚠️ דווחו סימנים לקשיי ראייה ללא בדיקה — מומלץ לערוך בדיקת ראייה אצל אופטומטריסט/רופא עיניים לפני המשך הבירור הלימודי, כדי לשלול גורם ראייתי לקשיים." });
  }
  if (A.hearing === "לא" && A.hear_sym === "כן") {
    boxes.push({ cls: "warn", txt: "⚠️ דווחו סימנים לקשיי שמיעה ללא בדיקה — מומלץ לערוך בדיקת שמיעה אצל קלינאית תקשורת או רופא אא\"ג לפני המשך הבירור הלימודי." });
  }
}

// ── ADHD emitter (de-duped across multiple call sites in same grade group) ────

interface AdhdEmitter {
  emit: (prefix: string) => boolean;
  isPositive: (prefix: string) => boolean;
}

function makeAdhdEmitter(A: Ans, boxes: KidsBox[]): AdhdEmitter {
  let emitted = false;
  // inatt items 2,3,5 (1-indexed) הם פונקציות ניהוליות (ארגון, איבוד חפצים, שכחה)
  function count(prefix: string) {
    const inatt = ["_ad1", "_ad2", "_ad3", "_ad4", "_ad5", "_ad6"].filter(k => A[prefix + k]).length;
    const hyper = ["_ah1", "_ah2", "_ah3", "_ah4", "_ah5", "_ah6"].filter(k => A[prefix + k]).length;
    const efCount = ["_ad2", "_ad3", "_ad5"].filter(k => A[prefix + k]).length;
    return { inatt, hyper, efCount };
  }
  function isPositive(prefix: string): boolean {
    const c = count(prefix);
    return c.inatt >= 4 || c.hyper >= 4;
  }
  function emit(prefix: string): boolean {
    const { inatt, hyper, efCount } = count(prefix);
    const pi = inatt >= 4, ph = hyper >= 4;
    if (!(pi || ph)) return false;
    if (emitted) return true;
    emitted = true;
    const syms: string[] = [];
    if (pi) syms.push("📊 ישנם סימנים לקשיי ריכוז וקשב");
    if (ph) syms.push("📊 ישנם סימנים לקשיים בתחום ההיפראקטיביות/אימפולסיביות");
    if (syms.length) boxes.push({ cls: "purple", txt: syms.join("\n") });
    boxes.push({ cls: "info", txt: "✅ יש לפנות לנוירולוג/רופא ילדים המומחה בקשיי קשב להמשך אבחון" });
    boxes.push({ cls: "info", txt: "📌 ניתן לפנות גם ליועצת בית הספר לתיאום עם הצוות החינוכי וליווי משפחתי" });
    if (pi && efCount >= 2) {
      boxes.push({ cls: "info", txt: "✅ ישנם סימנים לקשיים בפונקציות הניהוליות (ארגון, שליפת חפצים, שכחה) — מתאים טיפול/אימון מסוג Cog-Fun" });
    }
    boxes.push({ cls: "info", txt: "📚 לקריאה נוספת: אנפ\"ר (איגוד נפגעי הפרעת קשב) — anpar.org.il" });
    return true;
  }
  return { emit, isPositive };
}

// ── Math grading helpers ──────────────────────────────────────────────────────

function gradeMathAG(math: string, f: Findings) {
  if (math === "לא") return;
  addSym(f, "נמצאו סימנים לקשיי חשבון");
  if (math === "5%") {
    addRef(f, "נמצאו קשיים בחשבון:\nא. יש לשקול מתן סיוע פרטני דרך בית הספר או באופן פרטי.\nב. במידה ולא נראה שיפור משמעותי — הפנייה לאבחון פסיכודידקטי " + PSYCHODIDACTIC_NOTE_AG);
  } else if (math === "10%") {
    addRef(f, "נמצאו קשיים בחשבון:\nיש לשקול מתן סיוע פרטני דרך בית הספר או באופן פרטי.");
  } else if (math === "30%") {
    addRef(f, "נמצאו קשיים בחשבון: יש לשקול מתן סיוע פרטני.");
  }
  addTool(f, ACAD_TOOLS_MATH_AG);
}

function gradeMathDV(math: string, hasReadingOrAdhd: boolean, f: Findings) {
  if (math === "לא") return;
  addSym(f, "נמצאו סימנים לקשיי חשבון");
  if (math === "5%") {
    addRef(f, hasReadingOrAdhd
      ? "נמצאו קשיים משמעותיים בחשבון בשילוב קשיים נוספים:\nא. יש לשקול סיוע פרטני דרך בית הספר או באופן פרטי.\nב. הפנייה לאבחון פסיכודידקטי."
      : "נמצאו קשיים משמעותיים בחשבון:\nא. יש לשקול סיוע פרטני דרך בית הספר או באופן פרטי.\nב. הפנייה לאבחון פסיכודידקטי.");
  } else if (math === "10%") {
    addRef(f, "נמצאו קשיים בחשבון:\nיש לשקול סיוע פרטני דרך בית הספר או באופן פרטי.");
  } else if (math === "30%") {
    addRef(f, "נמצאו קשיים קלים בחשבון — יש לשקול סיוע פרטני.");
  }
  addTool(f, ACAD_TOOLS_MATH_DV);
}

// ── Reading flow helpers (per-grade) ──────────────────────────────────────────

function emoMotSum(A: Ans, prefix: "ag" | "dv", suffix: "" | "s"): number {
  const k = prefix + "_" + (suffix === "s" ? "smot" : "mot");
  return (A[k + "1"] || 1) + (A[k + "2"] || 1) + (A[k + "3"] || 1);
}

function readingFlowAG(A: Ans, adhd: AdhdEmitter, f: Findings) {
  const read = A.ag_read || "לא";
  if (read === "לא") return;
  addSym(f, "נמצאו סימנים לקשיי קריאה");
  if (A.ag_h6 === "כן") addRef(f, "יש לפנות לקלינאית תקשורת (קושי/לקות בדיבור)");
  const histYes = ["ag_h1", "ag_h2", "ag_h3", "ag_h4", "ag_h5", "ag_h6"].filter(k => A[k] === "כן").length;
  if (histYes === 0) {
    const motiv = A.ag_read_motiv;
    if (motiv === "כן") {
      addRef(f, "יש לבחון פנייה לקלינאית תקשורת");
    } else if (motiv === "לא") {
      addRef(f, "יש לבנות תוכנית חיזוקים");
      addTool(f, ACAD_TOOLS_CHIZUK);
      if (emoMotSum(A, "ag", "") >= 7) {
        addRef(f, REF_EMOTIONAL_LEARNING_AG);
      } else if (!adhd.emit("ag")) {
        addRef(f, REF_PSYCHODIDACTIC_AG);
      }
    }
  } else if (histYes >= 1 && histYes <= 3) {
    const speech = A.ag_read_speech;
    if (speech === "כן") {
      const smotiv = A.ag_speech_motiv;
      if (smotiv === "כן") {
        addRef(f, REF_SCHOOL_SHILUV);
      } else if (smotiv === "לא") {
        addRef(f, REF_SCHOOL_SHILUV);
        addTool(f, ACAD_TOOLS_CHIZUK);
        if (emoMotSum(A, "ag", "s") >= 7) {
          addRef(f, REF_EMOTIONAL_LEARNING_AG);
        } else if (!adhd.emit("ag")) {
          addRef(f, REF_PSYCHODIDACTIC_AG);
        }
      }
    } else if (speech === "לא") {
      addRef(f, "יש לבחון פנייה לקלינאית תקשורת");
    }
  } else if (histYes >= 4) {
    addRef(f, REF_PSYCHODIDACTIC_AG);
    addRef(f, "יש לבחון פנייה לריפוי בעיסוק");
  }
}

function readingFlowDV(A: Ans, adhd: AdhdEmitter, f: Findings) {
  if (A.dv_read !== "כן") return;
  addSym(f, "נמצאו סימנים לקשיי קריאה");
  const histYes = ["dv_h1", "dv_h2", "dv_h3", "dv_h4", "dv_h5"].filter(k => A[k] === "כן").length;
  if (histYes === 0) {
    const motiv = A.dv_read_motiv;
    if (motiv === "כן") {
      addRef(f, "יש לבחון פנייה לקלינאית תקשורת");
      addRef(f, "יש לבנות תוכנית חיזוקים");
      addTool(f, ACAD_TOOLS_CHIZUK);
    } else if (motiv === "לא") {
      addRef(f, "יש לבנות תוכנית חיזוקים");
      addTool(f, ACAD_TOOLS_CHIZUK);
      if (emoMotSum(A, "dv", "") >= 7) {
        addRef(f, REF_EMOTIONAL_LEARNING_DV);
      } else if (!adhd.emit("dv_read")) {
        addRef(f, REF_PSYCHODIDACTIC);
      }
    }
  } else if (histYes >= 1 && histYes <= 3) {
    const speech = A.dv_read_speech;
    if (speech === "כן") {
      const smotiv = A.dv_speech_motiv;
      if (smotiv === "כן") {
        addRef(f, "יש לבנות תוכנית בית-ספרית — אם אין שיפור לאחר כחודשיים יש לפנות לאבחון פסיכודידקטי");
      } else if (smotiv === "לא") {
        addRef(f, "יש לבנות תוכנית בית-ספרית — אם אין שיפור לאחר כחודשיים יש לפנות לאבחון פסיכודידקטי");
        addTool(f, ACAD_TOOLS_CHIZUK);
        if (emoMotSum(A, "dv", "s") >= 7) {
          addRef(f, REF_EMOTIONAL_LEARNING_DV);
        } else if (!adhd.emit("dv_read")) {
          addRef(f, REF_PSYCHODIDACTIC);
        }
      }
    } else if (speech === "לא") {
      addRef(f, "יש לבחון פנייה לקלינאית תקשורת");
    }
  } else if (histYes >= 4) {
    addRef(f, REF_PSYCHODIDACTIC);
  }
}

// ── Per-grade compute functions ───────────────────────────────────────────────

function computeGanAcad(A: Ans, boxes: KidsBox[]) {
  const yesCount = ["gan_q1", "gan_q2", "gan_q3", "gan_q4", "gan_q5"].filter(k => A[k] === "כן").length;
  if (yesCount === 0) return;
  const push = (cls: BoxCls, txt: string) => boxes.push({ cls, txt });
  push("purple", "📚 נמצאו קשיים לימודיים — גן");
  if (A.gan_q1 === "כן") {
    if (A.gan_q1_speech === "כן") push("info", "✅ קשיים בזיהוי אותיות/מספרים — יש לחזור לקלינאית תקשורת לטיפול נוסף\n✅ יש לפנות לפסיכולוג הגן לבחינת שעות שילוב");
    else push("warn", "⚠️ קשיים בזיהוי אותיות/מספרים — יש לבחון פנייה לקלינאית תקשורת + פסיכולוג הגן");
    push("info", "📌 כלים: אפליקציות לימוד קריאה, שירים, לוח מגנטי, ציור אותיות, פלסטלינה, ספירת חפצים");
  }
  if (A.gan_q2 === "כן") {
    if (A.gan_q2_speech === "כן") push("info", "✅ קשיים שפתיים — יש לחזור לקלינאית תקשורת לטיפול נוסף");
    else push("warn", "⚠️ קשיים בזכירת צורות/צבעים — יש לבחון פנייה לקלינאית תקשורת");
  }
  if (A.gan_q3 === "כן") push("info", "📌 קשיי מודעות פונולוגית — כלים: שירים וחרוזים, \"צליל פותח של היום\", קלפי תמונות, משחקי חריזה");
  if (A.gan_q4 === "כן") push("warn", "⚠️ קשיים בביטוי עצמי ואוצר מילים — מומלץ להפנות לקלינאית תקשורת להערכה");
  if (A.gan_q5 === "כן") {
    if (A.gan_q5_ot === "כן") push("info", "✅ קשיים מוטוריים — יש לחזור למרפאה בעיסוק לטיפול נוסף");
    else {
      push("warn", "⚠️ קשיים באחזקת עיפרון/ציור — יש לבחון פנייה לריפוי בעיסוק");
      push("info", "📌 כלים: טושים עבים, פלסטלינה, גזירה לפי קווים, השלחת חרוזים");
    }
  }
  if (yesCount >= 4) push("danger", "🚨 ניכרים סימפטומים משמעותיים בגן — יש לפנות להיוועצות עם הגננת ופסיכולוג הגן לגבי התאמת המסגרת");
  else if (yesCount === 3) push("warn", "⚠️ 3 קשיים לימודיים — מומלץ להיוועץ עם פסיכולוג הגן ולבדוק זכאות לשעות שילוב במסגרת");
}

function computeAGAcad(A: Ans, boxes: KidsBox[], adhd: AdhdEmitter) {
  const read = A.ag_read || "לא";
  const write = A.ag_write === "כן";
  const comp = A.ag_comp === "כן";
  const math = A.ag_math || "לא";
  const adhdYn = A.ag_adhd_yn === "כן";
  if (read === "לא" && !write && !comp && math === "לא" && !adhdYn) return;

  const f = newFindings();
  readingFlowAG(A, adhd, f);
  if (adhdYn) adhd.emit("ag");
  if (write) {
    addSym(f, "נמצאו סימנים לקשיי כתב יד");
    if (read !== "לא") addRef(f, "נראה שיש שילוב של מספר קשיים — יש לפנות לאבחון פסיכו-דידקטי " + PSYCHODIDACTIC_NOTE_AG);
    else if (A.ag_write_ot === "כן") addRef(f, "קשיי כתב יד — יש לחזור לבדיקה אצל מרפאה בעיסוק");
    else addRef(f, "קשיי כתב יד — יש לבחון פנייה לריפוי בעיסוק");
  }
  if (comp) {
    addSym(f, "נמצאו סימנים לקשיי הבנה בשיעור");
    if (!(read !== "לא" || adhd.isPositive("ag"))) addRef(f, REF_PSYCHODIDACTIC_AG);
  }
  gradeMathAG(math, f);
  flushFindings(boxes, "📚 נמצאו קשיים לימודיים — כיתות א-ג", f, COUNSELOR_FOOTER_AG_DV);
}

function computeDVAcad(A: Ans, boxes: KidsBox[], adhd: AdhdEmitter) {
  const read = A.dv_read === "כן";
  const write = A.dv_write === "כן";
  const comp = A.dv_comp === "כן";
  const math = A.dv_math || "לא";
  const adhdQ2yn = A.dv_adhd_yn === "כן";
  if (!read && !adhdQ2yn && !write && !comp && math === "לא") return;

  const f = newFindings();
  readingFlowDV(A, adhd, f);
  if (adhdQ2yn) adhd.emit("dv");
  const adhdAny = adhd.isPositive("dv") || adhd.isPositive("dv_read");
  if (write) {
    addSym(f, "נמצאו סימנים לקשיי כתב יד");
    if (A.dv_write_ot === "כן") addRef(f, "קשיי כתב יד — יש לחזור לבדיקה אצל מרפאה בעיסוק");
    else addRef(f, "קשיי כתב יד — יש לבחון פנייה לריפוי בעיסוק");
  }
  if (comp) {
    addSym(f, "נמצאו סימנים לקשיי הבנה בשיעור");
    if (!read && !adhdAny) addRef(f, REF_PSYCHODIDACTIC);
  }
  gradeMathDV(math, read || adhdAny, f);
  flushFindings(boxes, "📚 נמצאו קשיים לימודיים — כיתות ד-ו", f, COUNSELOR_FOOTER_AG_DV);
}

function computeZHTYBAcad(A: Ans, ga: "zh" | "tyb", boxes: KidsBox[], adhd: AdhdEmitter) {
  const isTyb = ga === "tyb";
  const verbal = A[ga + "_verbal"] || "לא";
  const math = A[ga + "_math"] || "לא";
  const eng = A[ga + "_eng"] || "לא";
  const adhdYn = A[ga + "_adhd_yn"] === "כן";
  const adhdPos = adhd.isPositive(ga);
  const write = A[ga + "_write"] === "כן";
  const comp = A[ga + "_comp"] === "כן";
  if (verbal === "לא" && math === "לא" && eng === "לא" && !adhdYn && !write && !comp) return;

  const f = newFindings();
  const multiDomains = [verbal !== "לא", math !== "לא", adhdPos, comp].filter(Boolean).length;
  if (multiDomains >= 3) addRef(f, REF_PSYCHODIDACTIC);

  // קשיים ברבי מלל בלבד הם סיבה לאבחון פסיכודידקטי, גם ב-5% וגם ב-20%+
  if (verbal !== "לא") {
    addSym(f, "נמצאו סימנים לקשיים ברבי מלל");
    if (verbal === "5%" || verbal === "20%" || verbal === "מעל 20%") addRef(f, REF_PSYCHODIDACTIC);
    addTool(f, isTyb ? ACAD_TOOLS_VERBAL_HIGH : ACAD_TOOLS_VERBAL_MID);
  }
  // קשיים במתמטיקה / אנגלית בלבד אינם מצריכים אבחון פסיכודידקטי כשלעצמם.
  // אבחון מומלץ רק אם הם מלווים בקשיים ברבי מלל, בקשב, או ברגשי-לימודי.
  const verbalPos = verbal !== "לא";
  const mathSevere = math === "20%" || math === "מעל 20%";
  const engSevere = eng === "20%" || eng === "מעל 20%";
  if (math !== "לא") {
    addSym(f, "נמצאו סימנים לקשיים במתמטיקה");
    if (mathSevere && (verbalPos || adhdPos)) addRef(f, "הפנייה לאבחון פסיכודידקטי לבירור קשיי הלמידה הכוללים");
    addTool(f, isTyb ? ACAD_TOOLS_MATH_HIGH : ACAD_TOOLS_MATH_MID);
  }
  if (eng !== "לא") {
    addSym(f, "נמצאו סימנים לקשיים באנגלית");
    if (engSevere && (verbalPos || adhdPos)) addRef(f, "הפנייה לאבחון פסיכודידקטי לבירור קשיי הלמידה הכוללים");
    addTool(f, ACAD_TOOLS_ENG);
  }
  if (adhdYn) adhd.emit(ga);
  if (write) {
    addSym(f, "נמצאו סימנים לקשיי כתב יד");
    addRef(f, "קשיי כתב יד — יש לבחון פנייה לריפוי בעיסוק");
    addTool(f, isTyb ? ACAD_TOOLS_WRITE_HIGH : ACAD_TOOLS_WRITE_MID);
  }
  if (comp) {
    addSym(f, "נמצאו סימנים לקשיי הבנה בשיעור");
    if (!(verbalPos || adhdPos)) addRef(f, "קשיים בהבנה שאינם מוסברים ע\"י קשיי קשב או קריאה — יש לפנות לאבחון פסיכו-דידקטי");
    addRef(f, "יש לשים לב להתאמות במבחנים — בכיתות ט'-יב' מדובר בהתאמות לבגרויות; בז'-ח' אפשר לבקש התאמות במבחנים פנימיים דרך יועצת בית הספר");
  }
  flushFindings(boxes, "📚 נמצאו קשיים לימודיים — כיתות " + (isTyb ? "ט-יב" : "ז-ח"), f, COUNSELOR_FOOTER_ZHTYB);
}

// ── Public + orchestrator ─────────────────────────────────────────────────────

function computeAcadResults(A: Ans): KidsBox[] {
  if (!["מעט", "הרבה", "הרבה מאוד"].includes(A.a_aca || "")) return [];
  const boxes = computeAcadResultsRaw(A);
  const ga = acadGg(A);
  const hasFindings = boxes.some(b =>
    b.txt?.startsWith("📚") || b.txt?.startsWith("📊") || b.txt?.startsWith("✅") ||
    b.txt?.startsWith("⚠️") || b.txt?.startsWith("🚨")
  );
  if (!hasFindings) {
    const noFindingsTxt = ga === "gan"
      ? "✅ לא נמצאו סימנים מובהקים לקשיים לימודיים מובהקים. אם בכל זאת קיימת דאגה, מומלץ להיוועץ עם הגננת ועם פסיכולוג הגן."
      : "✅ לא נמצאו סימנים מובהקים לקשיים לימודיים מובהקים. אם בכל זאת קיימת דאגה, מומלץ להיוועץ עם המחנכ/ת או יועצת בית הספר.";
    boxes.push({ cls: "info", txt: noFindingsTxt });
    return boxes;
  }
  // הצלבה עם החלק הרגשי — חרדה / דיכאון משפיעים על תפקוד לימודי
  const highAnxiety = (A.q1 || 0) >= 7;
  const highMood = (A.q3 || 0) >= 5 && (A.mq_tot || 0) >= 4;
  if (highAnxiety || highMood) {
    boxes.push({
      cls: "info",
      txt: "📌 חשוב לזכור: " +
        (highMood ? "דווחו סימני מצב רוח ירוד משמעותי" : "דווחה רמת חרדה גבוהה") +
        " — לעיתים קושי רגשי משפיע ישירות על התפקוד הלימודי. מומלץ לטפל קודם בקושי הרגשי, ולעקוב אם הקשיים הלימודיים נמשכים גם לאחר מכן.",
    });
  }
  boxes.push({ cls: "info", txt: "📅 מומלץ לחזור על השאלון בעוד 3-6 חודשים, לבחון התקדמות לאחר יישום ההמלצות." });
  return boxes;
}

function computeAcadResultsRaw(A: Ans): KidsBox[] {
  const ga = acadGg(A);
  const boxes: KidsBox[] = [];
  emitVisionHearing(A, boxes);
  const adhd = makeAdhdEmitter(A, boxes);
  if (ga === "gan")           computeGanAcad(A, boxes);
  else if (ga === "ag")       computeAGAcad(A, boxes, adhd);
  else if (ga === "dv")       computeDVAcad(A, boxes, adhd);
  else if (ga === "zh" || ga === "tyb") computeZHTYBAcad(A, ga, boxes, adhd);
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
