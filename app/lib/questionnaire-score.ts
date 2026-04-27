import type {
  QuestionnaireAnswers,
  Recommendation,
  ScoringResult,
} from "./questionnaire-types";

// ===== HELPERS =====

let _idCounter = 0;
function uid(prefix: string): string {
  return `${prefix}-${++_idCounter}`;
}

function sum(arr: number[] | undefined): number {
  return (arr ?? []).reduce((a, b) => a + b, 0);
}

// ===== EMOTIONAL TREATMENT RESOLVER =====
// Based on combined therapistStyleQ1 + therapistStyleQ2 (2-14 range)
// >= 12 → CBT, 7-11 → mixed (returns CBT as primary), 2-6 → dynamic

function resolveEmotionalTreatment(q1: number, q2: number): {
  treatment: string;
  treatmentLabel: string;
  mixed: boolean;
} {
  const total = q1 + q2;
  if (total >= 12) {
    return { treatment: "CBT", treatmentLabel: "CBT", mixed: false };
  } else if (total >= 7) {
    return { treatment: "CBT", treatmentLabel: "CBT", mixed: true };
  } else if (total >= 2) {
    return { treatment: "טיפול דינאמי", treatmentLabel: "טיפול דינאמי", mixed: false };
  }
  // No style answers provided → default to dynamic
  return { treatment: "טיפול דינאמי", treatmentLabel: "טיפול דינאמי", mixed: false };
}

// ===== MAIN SCORING FUNCTION =====

export function scoreQuestionnaire(answers: QuestionnaireAnswers): ScoringResult {
  _idCounter = 0;
  const recs: Recommendation[] = [];

  // מוסיף הערה ל-CBT קיים באותו domain, או יוצר ערך חדש
  function addOrMergeCBT(domain: string, symptomText: string, notes: string) {
    const existing = recs.find(
      (r) => r.treatment === "CBT" && r.domain === domain
    );
    if (existing) {
      existing.symptomText += `\n${symptomText}`;
      existing.notes = existing.notes
        ? `${existing.notes}\n${notes}`
        : notes;
    } else {
      recs.push({
        id: uid("cbt-merged"),
        symptomText,
        treatment: "CBT",
        treatmentLabel: "CBT",
        domain,
        urgent: false,
        notes,
      });
    }
  }

  const styleQ1 = answers.emotional?.therapistStyleQ1 ?? 0;
  const styleQ2 = answers.emotional?.therapistStyleQ2 ?? 0;

  const { treatment: emotTreatment, treatmentLabel: emotLabel, mixed } =
    resolveEmotionalTreatment(styleQ1, styleQ2);

  // ===== EMOTIONAL DOMAIN =====
  if (answers.domains.includes("emotional") && answers.emotional) {
    const e = answers.emotional;

    // --- E1: Mood ---
    const moodCount = e.moodItems?.length ?? 0;
    if (e.moodSuicidal) {
      recs.push({
        id: uid("mood-suicidal"),
        symptomText: "נמצאו סימנים של אובדנות.",
        treatment: emotTreatment,
        treatmentLabel: emotLabel,
        domain: "מורכבויות בתחום הרגשי/האישי",
        urgent: true,
        notes: "יש לפנות בהקדם לפסיכיאטר לשם הערכת סיכון.",
      });
    }
    if (moodCount >= 6) {
      recs.push({
        id: uid("mood-severe"),
        symptomText: "נמצאו סימנים מובהקים של מצב רוח ירוד.",
        treatment: emotTreatment,
        treatmentLabel: emotLabel,
        domain: "מורכבויות בתחום הרגשי/האישי",
        urgent: false,
        notes: "מומלץ לפנות במקביל לפסיכיאטר לבירור התאמה לטיפול תרופתי.",
      });
    } else if (moodCount >= 4) {
      recs.push({
        id: uid("mood-mild"),
        symptomText: "נמצאו סימנים אפשריים של מצב רוח ירוד.",
        treatment: emotTreatment,
        treatmentLabel: emotLabel,
        domain: "מורכבויות בתחום הרגשי/האישי",
        urgent: false,
      });
    }

    // --- E2: Mania ---
    const maniaCount = e.maniaItems?.length ?? 0;
    if (maniaCount >= 3) {
      if (e.maniaDeath) {
        recs.push({
          id: uid("mania-suicidal"),
          symptomText:
            "נמצאו סימנים של מצב רוח מרומם/רוגזני, כולל סימני אובדנות.",
          treatment: "CBT",
          treatmentLabel: "CBT",
          domain: "מורכבויות בתחום הרגשי/האישי",
          urgent: true,
          notes: 'ייעוץ פסיכיאטרי ופנייה לפסיכולוג קליני.',
        });
      } else {
        recs.push({
          id: uid("mania"),
          symptomText: "נמצאו סימנים של מצב רוח מרומם/רוגזני.",
          treatment: emotTreatment,
          treatmentLabel: emotLabel,
          domain: "מורכבויות בתחום הרגשי/האישי",
          urgent: false,
        });
      }
    }

    // --- E3: Prodrome ---
    // הזיות (e3a) = סימן חמור גם בעוצמה נמוכה → סף 1 פריט
    // אמונות יוצאות דופן בלבד (e3b ללא e3a) = סף גבוה יותר → 3 פריטים
    const prodromeCount = e.prodromeItems?.length ?? 0;
    const prodromeThreshold = e.e3a ? 1 : (e.e3b ? 3 : Infinity);
    if (prodromeCount >= prodromeThreshold) {
      if (e.prodromeSuicidal) {
        recs.push({
          id: uid("prodrome-suicidal"),
          symptomText:
            'נמצאו סימנים לקשיים סביב בוחן מציאות/שיפוט שאינו תקין, כולל סימני אובדנות.',
          treatment: emotTreatment,
          treatmentLabel: emotLabel,
          domain: "מורכבויות בתחום הרגשי/האישי",
          urgent: true,
          notes: 'ייעוץ אצל רופא פסיכיאטר ופנייה לטיפול רגשי ע"י פסיכולוג קליני (עדיפות).',
        });
      } else {
        recs.push({
          id: uid("prodrome"),
          symptomText:
            "נמצאו סימנים לקשיים סביב בוחן מציאות/שיפוט שאינו תקין.",
          treatment: emotTreatment,
          treatmentLabel: emotLabel,
          domain: "מורכבויות בתחום הרגשי/האישי",
          urgent: false,
          notes: 'ייעוץ אצל רופא פסיכיאטר ופנייה לטיפול רגשי ע"י פסיכולוג קליני (עדיפות).',
        });
      }
    }

    // --- E4: Chronic pain (psychological) ---
    if (e.e4 && e.e4Chronic && e.e4Medical) {
      recs.push({
        id: uid("chronic-pain"),
        symptomText: "נמצאו כאבים כרוניים שמקורם נפשי.",
        treatment: "CBT",
        treatmentLabel: "CBT",
        domain: "מורכבויות בתחום הרגשי/האישי",
        urgent: false,
        notes: "עדיפות: פסיכולוג רפואי.",
      });
    }

    // --- E4: Anxiety (GAD7) ---
    // 9 פריטים × סקאלת 1-3 (טווח 9-27)
    // > 15 = חרדה כללית מובהקת | > 12 = סימני מתח קלים
    const gad7Total = sum(e.gad7Scores);
    if (gad7Total > 15) {
      recs.push({
        id: uid("gad7-severe"),
        symptomText: "נמצאו סימנים של חרדה כללית.",
        treatment: emotTreatment,
        treatmentLabel: emotLabel,
        domain: "מורכבויות בתחום הרגשי/האישי",
        urgent: false,
      });
    } else if (gad7Total > 12) {
      recs.push({
        id: uid("gad7-mild"),
        symptomText: "נמצאו סימנים קלים של מתח.",
        treatment: emotTreatment,
        treatmentLabel: emotLabel,
        domain: "מורכבויות בתחום הרגשי/האישי",
        urgent: false,
      });
    }

    // Social anxiety
    // המשתמש אישר חרדה חברתית - לפחות "low" תמיד יוקפץ, גם אם לא דורגה חומרה
    if (e.socialAnxiety) {
      const sev = e.socialSeverity ?? 0;
      if (sev >= 4) {
        recs.push({
          id: uid("social-anxiety-high"),
          symptomText: "נמצאו סימנים של חרדה חברתית בעוצמה גבוהה.",
          treatment: emotTreatment,
          treatmentLabel: emotLabel,
          domain: "מורכבויות בתחום הרגשי/האישי",
          urgent: false,
        });
      } else {
        recs.push({
          id: uid("social-anxiety-low"),
          symptomText: "נמצאו סימנים של חרדה חברתית.",
          treatment: emotTreatment,
          treatmentLabel: emotLabel,
          domain: "מורכבויות בתחום הרגשי/האישי",
          urgent: false,
        });
      }
    }

    if (e.flightAnxiety) {
      recs.push({
        id: uid("anxiety-flight"),
        symptomText: "נמצאו סימנים של חרדת טיסות.",
        treatment: "CBT",
        treatmentLabel: "CBT",
        domain: "מורכבויות בתחום הרגשי/האישי",
        urgent: false,
        notes: "פנייה לסדנה לטיפול בחרדת טיסות.",
      });
    }

    if (e.medicalAnxiety) {
      recs.push({
        id: uid("anxiety-medical"),
        symptomText: "נמצאו סימנים של חרדה רפואית.",
        treatment: "CBT",
        treatmentLabel: "CBT",
        domain: "מורכבויות בתחום הרגשי/האישי",
        urgent: false,
        notes: "עדיפות: פסיכולוג רפואי.",
      });
    }

    if (e.stressPain) {
      recs.push({
        id: uid("stress-pain"),
        symptomText: "נמצאו סימנים של כאבי ראש או סחרחורות בזמן מתח.",
        treatment: "CBT",
        treatmentLabel: "CBT",
        domain: "מורכבויות בתחום הרגשי/האישי",
        urgent: false,
        notes: "בשילוב מרכיבים של מיינדפולנס ומדיטציה.",
      });
    }

    // --- E5: OCD ---
    // 6 פריטים × סקאלת 1-3 (טווח 6-18)
    // > 13 = משמעותי | >= 10 = מתון
    const ocdTotal = sum(e.ocdScores);
    if (ocdTotal > 13) {
      recs.push({
        id: uid("ocd-sig"),
        symptomText: "נמצאו קשיים משמעותיים בתחום המחשבות האובססיביות.",
        treatment: "CBT",
        treatmentLabel: "CBT",
        domain: "מורכבויות בתחום הרגשי/האישי",
        urgent: false,
        notes: 'בעדיפות על-ידי פסיכולוג או עו"ס קליני.',
      });
    } else if (ocdTotal >= 10) {
      recs.push({
        id: uid("ocd-mild"),
        symptomText: "נמצאו קשיים בתחום המחשבות האובססיביות.",
        treatment: "CBT",
        treatmentLabel: "CBT",
        domain: "מורכבויות בתחום הרגשי/האישי",
        urgent: false,
      });
    }

    // --- E6: Eating ---
    const eating1 = e.eating1Count ?? 0;
    const eating2 = e.eating2Count ?? 0;
    const eating3 = e.eating3Count ?? 0;
    if (eating1 >= 2 || eating2 >= 2 || eating3 >= 2) {
      recs.push({
        id: uid("eating"),
        symptomText: "נמצאו סימנים לקשיים סביב אכילה.",
        treatment: emotTreatment,
        treatmentLabel: emotLabel,
        domain: "מורכבויות בתחום הרגשי/האישי",
        urgent: false,
        notes:
          'הפנייה למרכז לטיפול בהפרעות אכילה, הכולל מענה של פסיכולוג קליני/עו"ס קליני, של דיאטן ושל פסיכיאטר.',
      });
    }

    // --- E7: Sleep ---
    // פריטים 0-1 (קושי בהירדמות / איכות השינה) = הפרעות שינה קלות → טיפים
    // פריטים 2-4 (שינה מרובה / סהרוריות / ביעותים) = פתולוגיים יותר → נוירולוג
    // פריט 5 (נזלת כרונית) = הפניה לאף-אוזן-גרון
    const sleepItems = e.sleepItems ?? [];
    const hasSleepNeuro = sleepItems[2] || sleepItems[3] || sleepItems[4];
    const hasSleepMild = sleepItems[0] || sleepItems[1];
    if (hasSleepNeuro) {
      recs.push({
        id: uid("sleep-neuro"),
        symptomText: "נמצאו סימנים להפרעת שינה.",
        treatment: emotTreatment,
        treatmentLabel: emotLabel,
        domain: "מורכבויות בתחום הרגשי/האישי",
        urgent: false,
        notes: "התייעצות עם רופא המשפחה או נוירולוג.",
      });
    } else if (hasSleepMild) {
      recs.push({
        id: uid("sleep-mild"),
        symptomText: "דווחו קשיי שינה קלים.",
        treatment: emotTreatment,
        treatmentLabel: emotLabel,
        domain: "מורכבויות בתחום הרגשי/האישי",
        urgent: false,
        notes: "מומלץ לאמץ היגיינת שינה: שעות שינה קבועות, הימנעות מקפאין אחר הצהריים, צמצום מסכים שעה לפני השינה, וחשיפה לאור טבעי בבוקר.",
        tools: [
          "כלים בסיסיים לשיפור איכות השינה:",
          "",
          "1. שעות שינה קבועות – ללכת לישון ולהתעורר בערך באותה שעה כל יום, גם בסופי שבוע.",
          "",
          "2. שעת חוסך אור – להפסיק שימוש במסכים (טלפון, מחשב, טלוויזיה) שעה לפני השינה. אור כחול מדכא מלטונין.",
          "",
          "3. קפאין רק עד הצהריים – חצי חיים של קפאין הוא 5–6 שעות. קפה אחרי 14:00 עלול להפריע לאיכות השינה גם אם נרדמים.",
          "",
          "4. חדר שינה רק לשינה – לא לעבוד או לאכול במיטה. המוח לומד לקשר את המיטה עם פעילות במקום עם רוגע.",
          "",
          "5. אם לא נרדמים תוך 20 דקות – לקום, לעשות פעילות שקטה (קריאה לאור עמום) ולחזור למיטה רק כשעייפים.",
          "",
          "6. חשיפה לאור טבעי בבוקר – 15–30 דקות בשעה הראשונה לאחר ההתעוררות מסייעות לכוון את השעון הביולוגי.",
        ].join("\n"),
      });
    }
    if (sleepItems[5]) {
      recs.push({
        id: uid("sleep-ent"),
        symptomText: "דווח על נזלת כרונית מרובה.",
        treatment: emotTreatment,
        treatmentLabel: emotLabel,
        domain: "מורכבויות בתחום הרגשי/האישי",
        urgent: false,
        notes: "התייעצות עם רופא משפחה או רופא אף-אוזן-גרון.",
      });
    }

    // --- E8: Somatic / Dissociation / Tics / Tinnitus ---
    const EMO = "מורכבויות בתחום הרגשי/האישי";
    if (e.e8 && !e.tics && !e.tinnitus) {
      addOrMergeCBT(EMO,
        "נמצאו תסמינים גופניים לא מוגדרים.",
        "הפניה לטיפול CBT או היפנוזה. עדיפות על ידי פסיכולוג רפואי או פסיכולוג קליני."
      );
    }
    if (e.e8b) {
      addOrMergeCBT(EMO,
        "נמצאו תסמינים דיסוציאטיביים.",
        "היפנוזה או טיפול התנהגותי על-ידי פסיכולוג רפואי."
      );
    }
    if (e.tics) {
      addOrMergeCBT(EMO,
        "מתוארים טיקים.",
        "מומלץ טיפול CBT. יש להתייעץ עם רופא משפחה ונוירולוג. ניתן גם לפנות לאחת ממרפאות הטיקים ותסמונת טורט."
      );
    }
    if (e.tinnitus) {
      addOrMergeCBT(EMO,
        "עולה חשד לטנטון.",
        'הפניה לטיפול CBT ע"י פסיכולוג או עו"ס קליני. יש להתייעץ עם רופא אא"ג.'
      );
    }

    // --- E9: Trauma ---
    const traumaTotal = sum(e.traumaScores);
    if (e.traumaSuicidal) {
      recs.push({
        id: uid("trauma-suicidal"),
        symptomText: "נמצאו מחשבות אובדניות בהקשר טראומה.",
        treatment: "EMDR",
        treatmentLabel: "EMDR",
        domain: "מורכבויות בתחום הרגשי/האישי",
        urgent: true,
        notes: "הערכת סיכון אצל פסיכיאטר.",
      });
    }
    if (traumaTotal >= 15) {
      const traumaType = e.traumaType ?? "";
      const traumaFreq = e.traumaFreq ?? "single";
      let traumaTreatment = "EMDR";
      let traumaLabel = "EMDR";

      if (
        traumaType === "sexual" &&
        (traumaFreq === "multiple" || traumaFreq === "ongoing")
      ) {
        traumaTreatment = "DBT";
        traumaLabel = "DBT-PTSD / EMDR";
      }
      // All other types → EMDR (optionally CBT for some, but EMDR is primary)

      recs.push({
        id: uid("trauma"),
        symptomText: "נמצאו סימנים לקשיים סביב אירוע טראומטי.",
        treatment: traumaTreatment,
        treatmentLabel: traumaLabel,
        domain: "מורכבויות בתחום הרגשי/האישי",
        urgent: false,
      });
    }

    // --- E10: Personality ---
    const persMainSum = sum(e.persMainScores);
    if (persMainSum >= 5) {
      const disTotal = sum(e.disQAnswers);
      // 1=כן, 2=לא × 4 פריטים: 4=כל "כן", 8=כל "לא".
      // disTotal <= 5 (לפחות 3 "כן") → סימני אוטיזם נוכחים → אבחון תקשורת.
      if (disTotal <= 5) {
        recs.push({
          id: uid("comm-diagnosis"),
          symptomText: "נמצאו סימנים לקשיים בתקשורת הבינאישית.",
          treatment: emotTreatment,
          treatmentLabel: emotLabel,
          domain: "מורכבויות בתחום הרגשי/האישי",
          urgent: false,
          notes: "אבחון תקשורת למבוגרים.",
        });
      } else {
        // Personality questionnaire
        const p = e.persScores ?? [0, 0, 0, 0, 0, 0];
        const q7 = e.persQ7 ?? false;
        const q8 = e.persQ8 ?? false;
        let found = false;

        if (!found && q8 && (p[4] >= 4 || p[5] >= 4)) {
          recs.push({
            id: uid("pers-dbt"),
            symptomText:
              "נמצאו סימנים לקשיים בקשרים בין-אישיים ובוויסות רגשי.",
            treatment: "DBT",
            treatmentLabel: "DBT",
            domain: "מורכבויות בתחום הרגשי/האישי",
            urgent: false,
          });
          found = true;
        }
        if (!found && !q8 && q7 && (p[4] >= 4 || p[5] >= 4)) {
          recs.push({
            id: uid("pers-dbt-mbt"),
            symptomText: "נמצאו סימנים לקשיים בקשרים בין-אישיים.",
            treatment: "DBT",
            treatmentLabel: "DBT / MBT",
            domain: "מורכבויות בתחום הרגשי/האישי",
            urgent: false,
          });
          found = true;
        }
        if (!found && (p[0] >= 4 || p[2] >= 4) && p[4] <= 3 && p[5] <= 3) {
          recs.push({
            id: uid("pers-dynamic"),
            symptomText: "נמצאו סימנים לקשיים בקשרים בין-אישיים.",
            treatment: "טיפול דינאמי",
            treatmentLabel: "טיפול דינאמי",
            domain: "מורכבויות בתחום הרגשי/האישי",
            urgent: false,
            notes: 'עדיפות: פסיכולוג קליני או עו"ס קליני.',
          });
          found = true;
        }
        if (!found && p[0] >= 4 && p[4] >= 4 && p[5] <= 3) {
          recs.push({
            id: uid("pers-dyn2"),
            symptomText: "נמצאו סימנים לקשיים בקשרים בין-אישיים.",
            treatment: "DBT",
            treatmentLabel: "טיפול דינאמי / DBT",
            domain: "מורכבויות בתחום הרגשי/האישי",
            urgent: false,
          });
          found = true;
        }
        if (
          !found &&
          (p[1] >= 4 || p[3] >= 4) &&
          p[4] <= 3 &&
          p[5] <= 3
        ) {
          recs.push({
            id: uid("pers-social"),
            symptomText: "נמצאו סימנים לקשיים בקשרים בין-אישיים.",
            treatment: "טיפול דינאמי",
            treatmentLabel: "טיפול דינאמי / קבוצתי",
            domain: "מורכבויות בתחום הרגשי/האישי",
            urgent: false,
            notes: 'עדיפות: פסיכולוג קליני או עו"ס קליני.',
          });
          found = true;
        }
        if (!found) {
          recs.push({
            id: uid("pers-gen"),
            symptomText: "נמצאו סימנים לקשיים בקשרים בין-אישיים.",
            treatment: "טיפול דינאמי",
            treatmentLabel: "טיפול דינאמי",
            domain: "מורכבויות בתחום הרגשי/האישי",
            urgent: false,
            notes: 'עדיפות: פסיכולוג קליני או עו"ס קליני.',
          });
        }
      }
    }

    // Default emotional recommendation if domain was chosen but nothing triggered
    const emotionalRecs = recs.filter(
      (r) => r.domain === "מורכבויות בתחום הרגשי/האישי"
    );
    if (emotionalRecs.length === 0) {
      recs.push({
        id: uid("emotional-default"),
        symptomText: "נמצאו סימנים כלליים בתחום הרגשי.",
        treatment: emotTreatment,
        treatmentLabel: emotLabel,
        domain: "מורכבויות בתחום הרגשי/האישי",
        urgent: false,
      });
    }

    // For mixed style: also offer a dynamic option alongside CBT-tagged recs
    if (mixed) {
      recs.push({
        id: uid("emotional-dynamic-mixed"),
        symptomText: "בנוסף לגישה CBT, מומלץ גם טיפול דינאמי.",
        treatment: "טיפול דינאמי",
        treatmentLabel: "טיפול דינאמי",
        domain: "מורכבויות בתחום הרגשי/האישי",
        urgent: false,
      });
    }
  }

  // ===== FUNCTIONAL DOMAIN =====
  if (answers.domains.includes("functional") && answers.functional) {
    const f = answers.functional;

    // --- F1: ADHD ---
    if (f.f1 && f.f1Attention) {
      const adhd1 = f.adhd1Count ?? 0;
      const adhd2 = f.adhd2Count ?? 0;
      if (adhd1 >= 3) {
        recs.push({
          id: uid("adhd-att"),
          symptomText: "ישנם סימנים לקשיי ריכוז וקשב.",
          treatment: "טיפול COG-FUN לקשיי קשב וריכוז",
          treatmentLabel: "COG-FUN",
          domain: "סימני שאלה לגבי התחומים התפקודיים, התעסוקתיים או האקדמאיים",
          urgent: false,
          notes: "יש לפנות לנוירולוג או פסיכיאטר המומחים בקשיי קשב.",
        });
      }
      if (adhd2 >= 3) {
        recs.push({
          id: uid("adhd-hyp"),
          symptomText: "ישנם סימנים לקשיי ריכוז וקשב עם היפראקטיביות.",
          treatment: "טיפול COG-FUN לקשיי קשב וריכוז",
          treatmentLabel: "COG-FUN",
          domain: "סימני שאלה לגבי התחומים התפקודיים, התעסוקתיים או האקדמאיים",
          urgent: false,
          notes: "יש לפנות לנוירולוג או פסיכיאטר המומחים בקשיי קשב.",
        });
      }
    }

    // --- F1: Learning Disabilities ---
    if (f.f1 && f.f1Processing && f.ldReading) {
      const ldScores = f.ldScores ?? [0, 0, 0, 0, 0];
      const ld14 = ldScores.slice(0, 4).reduce((a, b) => a + b, 0);
      const ld5v = ldScores[4] ?? 0;
      if (ld14 >= 7) {
        recs.push({
          id: uid("ld-language"),
          symptomText: "ישנם סימנים לקשיי למידה שפתיים.",
          treatment: "טיפול תעסוקתי",
          treatmentLabel: "טיפול תעסוקתי",
          domain: "סימני שאלה לגבי התחומים התפקודיים, התעסוקתיים או האקדמאיים",
          urgent: false,
          notes: "יש לפנות לאבחון דידקטי או לאבחון נוירופסיכולוגי.",
        });
      }
      if (ld5v >= 2) {
        recs.push({
          id: uid("ld-math"),
          symptomText: "ישנם סימנים לקשיי למידה בתחום המתמטי.",
          treatment: "טיפול תעסוקתי",
          treatmentLabel: "טיפול תעסוקתי",
          domain: "סימני שאלה לגבי התחומים התפקודיים, התעסוקתיים או האקדמאיים",
          urgent: false,
          notes: "יש לפנות לאבחון דידקטי או לאבחון נוירופסיכולוגי.",
        });
      }
    }

    // --- F2: Executive Functions ---
    if (f.f2) {
      const execTotal = sum(f.execScores);
      if (execTotal >= 12) {
        recs.push({
          id: uid("exec-func"),
          symptomText: "נמצאו סימנים של קשיים בתפקודים הניהוליים.",
          treatment: "טיפול COG-FUN לקשיי קשב וריכוז",
          treatmentLabel: "COG-FUN",
          domain: "סימני שאלה לגבי התחומים התפקודיים, התעסוקתיים או האקדמאיים",
          urgent: false,
          notes: "כדאי לפנות גם לרופא נוירולוג.",
        });
      }
    }

    // --- F3: Employment ---
    if (f.f3) {
      const empType = f.employmentType ?? "";
      if (empType === "disability") {
        recs.push({
          id: uid("employment-dis"),
          symptomText: "מדווחים קשיים בתחום התעסוקתי.",
          treatment: "טיפול תעסוקתי",
          treatmentLabel: "טיפול תעסוקתי",
          domain: "סימני שאלה לגבי התחומים התפקודיים, התעסוקתיים או האקדמאיים",
          urgent: false,
          notes: "יש לפנות לאבחון תעסוקתי ולבדוק מול ביטוח לאומי.",
        });
      } else if (empType === "young") {
        const a = f.empAItems ?? [false, false, false, false, false];
        // items 0,1,2 scored directly; 3,4 are inverted
        const scoreA =
          (a[0] ? 1 : 0) +
          (a[1] ? 1 : 0) +
          (a[2] ? 1 : 0) +
          (a[3] ? 0 : 1) +
          (a[4] ? 0 : 1);
        if (scoreA >= 3) {
          recs.push({
            id: uid("employment-psy"),
            symptomText: "מדווחים קשיים בתחום התעסוקתי.",
            treatment: "טיפול תעסוקתי",
            treatmentLabel: "פסיכולוג תעסוקתי",
            domain: "סימני שאלה לגבי התחומים התפקודיים, התעסוקתיים או האקדמאיים",
            urgent: false,
            notes: "יש לפנות לפסיכולוג תעסוקתי עבור ייעוץ בתחום.",
          });
        } else {
          recs.push({
            id: uid("employment-assess"),
            symptomText: "מדווחים קשיים בתחום התעסוקתי.",
            treatment: "אבחון תעסוקתי",
            treatmentLabel: "אבחון תעסוקתי",
            domain: "סימני שאלה לגבי התחומים התפקודיים, התעסוקתיים או האקדמאיים",
            urgent: false,
            notes: "יש לפנות לאבחון תעסוקתי להבנת מרכיבי החוזק והחולשה.",
          });
        }
      } else if (empType) {
        // career-change, burnout, other → questionnaire B
        const b = f.empBItems ?? [false, false, false, false];
        // items 0,1 direct; 2,3 inverted
        const scoreB =
          (b[0] ? 1 : 0) +
          (b[1] ? 1 : 0) +
          (b[2] ? 0 : 1) +
          (b[3] ? 0 : 1);
        if (scoreB >= 2) {
          recs.push({
            id: uid("employment-psy"),
            symptomText: "מדווחים קשיים בתחום התעסוקתי.",
            treatment: "טיפול תעסוקתי",
            treatmentLabel: "פסיכולוג תעסוקתי",
            domain: "סימני שאלה לגבי התחומים התפקודיים, התעסוקתיים או האקדמאיים",
            urgent: false,
            notes: "יש לפנות לפסיכולוג תעסוקתי עבור ייעוץ בתחום.",
          });
        } else {
          recs.push({
            id: uid("employment-assess"),
            symptomText: "מדווחים קשיים בתחום התעסוקתי.",
            treatment: "אבחון תעסוקתי",
            treatmentLabel: "אבחון תעסוקתי",
            domain: "סימני שאלה לגבי התחומים התפקודיים, התעסוקתיים או האקדמאיים",
            urgent: false,
            notes: "יש לפנות לאבחון תעסוקתי.",
          });
        }
      }
    }
  }

  // ===== RELATIONSHIP DOMAIN =====
  if (answers.domains.includes("relationship") && answers.relationship) {
    const r = answers.relationship;

    // --- R1: Sexual dysfunction ---
    const hasSexualNeed = !!r.r1;
    if (r.r1) {
      if (r.r1InRelationship) {
        recs.push({
          id: uid("sexual-couple"),
          symptomText: "נמצא קושי בתפקוד המיני בזוגיות.",
          treatment: "טיפול מיני",
          treatmentLabel: "טיפול מיני וזוגי",
          domain: "זוגיות ומשפחה",
          urgent: false,
        });
      } else {
        recs.push({
          id: uid("sexual-solo"),
          symptomText: "נמצא קושי בתפקוד המיני.",
          treatment: "טיפול מיני",
          treatmentLabel: "טיפול מיני",
          domain: "זוגיות ומשפחה",
          urgent: false,
        });
      }
    }

    // --- R1 / R2: Couple therapy ---
    const coupleScore = r.coupleScale ?? 0;
    if (coupleScore >= 3 && r.coupleInRelationship) {
      const eftSum = sum(r.eftScores);
      const dynSum = sum(r.dynScores);
      const struSum = sum(r.structScores);
      const maxSum = Math.max(eftSum, dynSum, struSum);

      let approachLabel = "טיפול זוגי";
      let modality: string | undefined;
      if (maxSum === eftSum) { approachLabel = "EFT (טיפול ממוקד רגש)"; modality = "EFT"; }
      else if (maxSum === dynSum) { approachLabel = "טיפול זוגי דינמי"; modality = "דינאמי"; }
      else { approachLabel = "טיפול זוגי מבני"; modality = "מבני"; }

      recs.push({
        id: uid("couple-therapy"),
        symptomText: `נמצא קושי בקשר הזוגי. מומלץ ${approachLabel}.`,
        treatment: "טיפול זוגי",
        treatmentLabel: "טיפול זוגי",
        domain: "זוגיות ומשפחה",
        urgent: false,
        couplesModality: modality,
        needsSexualTherapy: hasSexualNeed,
      });
    }

    // --- R3: Family therapy ---
    if (r.r3) {
      if (r.r3WithPartner) {
        recs.push({
          id: uid("family-therapy"),
          symptomText: "נמצא קושי בתא המשפחתי.",
          treatment: "טיפול משפחתי",
          treatmentLabel: "טיפול משפחתי",
          domain: "זוגיות ומשפחה",
          urgent: false,
        });
      } else {
        recs.push({
          id: uid("family-guidance"),
          symptomText: "נמצא קושי בתא המשפחתי.",
          treatment: "הדרכת הורים",
          treatmentLabel: "הדרכת הורים",
          domain: "זוגיות ומשפחה",
          urgent: false,
        });
      }
    }
  }

  // ===== ADDICTION DOMAIN =====
  if (answers.domains.includes("addiction") && answers.addiction) {
    const a = answers.addiction;

    if (a.types.includes("substances")) {
      const cnt = a.substanceCount ?? 0;
      if (cnt > 8) {
        recs.push({
          id: uid("substances-severe"),
          symptomText: "נמצאו סימנים משמעותיים להתמכרות לחומרים ממכרים.",
          treatment: "טיפול בהתמכרויות",
          treatmentLabel: "טיפול בהתמכרויות",
          domain: "קשיי התמכרות",
          urgent: false,
          notes:
            "מומלץ לשלב עזרה פסיכיאטרית יחד עם טיפול נפשי בהתמכרויות. במידה והיו מספר ניסיונות גמילה שלא צלחו, מומלץ לפנות במקביל גם לקבוצת תמיכה בהתמכרויות.",
          tools: [
            "כלים להתמודדות עם דחף לשימוש:",
            "",
            "1. זיהוי טריגרים – ניהול יומן יומי שבו רושמים מתי ובאילו מצבים עלה הדחף לשימוש (אנשים, מקומות, רגשות, שעות ביום). מודעות לטריגרים היא תנאי הכרחי לשינוי.",
            "",
            "2. תכנון מראש למצבי סיכון – לפני אירוע חברתי, סוף שבוע או נסיעה, כדאי להחליט מראש מה יהיו דרכי ההתמודדות אם יעלה דחף לשימוש.",
            "",
            "3. רשת תמיכה זמינה – לסכם עם בן/בת זוג, חבר/ה קרוב/ה או חבר/ת קבוצה שאפשר להתקשר אליהם ברגעי דחף, גם בלילה.",
            "",
            "4. קבוצות תמיכה – AA (אלכוהוליסטים אנונימיים) ו-NA (נרקומנים אנונימיים) פועלות בעברית בכל הארץ עם מפגשים פרונטליים ומקוונים. בארץ: 03-7510270 (AA).",
            "",
            "5. אפליקציות תמיכה – I Am Sober (ספירת ימי נקיון, יומן רגשות), Sober Time, ו-WEconnect (תזכורות יומיות וקבוצות מקוונות).",
          ].join("\n"),
        });
      } else if (cnt > 2) {
        recs.push({
          id: uid("substances-mild"),
          symptomText: "נמצאו סימנים להתמכרות לחומרים ממכרים.",
          treatment: "טיפול בהתמכרויות",
          treatmentLabel: "טיפול בהתמכרויות",
          domain: "קשיי התמכרות",
          urgent: false,
          notes: "מומלץ לפנות לטיפול בהתמכרויות.",
          tools: [
            "כלים להתמודדות עם דחף לשימוש:",
            "",
            "1. זיהוי טריגרים – ניהול יומן יומי שבו רושמים מתי ובאילו מצבים עלה הדחף לשימוש. מודעות לטריגרים היא תנאי הכרחי לשינוי.",
            "",
            "2. תכנון מראש למצבי סיכון – לפני אירוע חברתי או סוף שבוע, להחליט מראש מה יהיו דרכי ההתמודדות אם יעלה דחף.",
            "",
            "3. רשת תמיכה זמינה – לסכם עם אדם קרוב שאפשר להתקשר אליו ברגעי דחף.",
            "",
            "4. קבוצות תמיכה – AA ו-NA פועלות בעברית בכל הארץ עם מפגשים פרונטליים ומקוונים.",
            "",
            "5. אפליקציות תמיכה – I Am Sober, Sober Time, WEconnect.",
          ].join("\n"),
        });
      }
    }

    if (a.types.includes("gaming")) {
      const cnt = a.gamingCount ?? 0;
      if (cnt >= 4) {
        recs.push({
          id: uid("gaming"),
          symptomText: "נמצאו סימנים להתמכרות למשחקי מחשב.",
          treatment: "טיפול בהתמכרויות",
          treatmentLabel: "טיפול בהתמכרויות",
          domain: "קשיי התמכרות",
          urgent: false,
          notes: "מומלץ לפנות לטיפול בהתמכרויות.",
          tools: [
            "כלים לצמצום שימוש מופרז במשחקים:",
            "",
            "1. הגדרת חלונות משחק קבועים – לקבוע מראש שעות מוגדרות למשחק (לדוגמה: 19:00–21:00 בלבד), ולהשתמש בטיימר כדי לסיים בזמן.",
            "",
            "2. תחביב חלופי שמייצר תחושת הישג – משחקים מציעים פידבק מיידי והישג ברור. כדאי למצוא פעילות פיזית, יצירתית או חברתית שמספקת תחושה דומה (ספורט קבוצתי, נגינה, התנדבות, פאזלים מורכבים).",
            "",
            "3. הסרת התראות וגישה מהירה – להסיר את הקיצורים מהמסך הראשי, לכבות הודעות פוש, ולהוציא את הקונסולה מחדר השינה.",
            "",
            "4. שינוי הקשר חברתי – אם הדחף למשחק נובע מצורך חברתי, לחפש קהילות שלא מבוססות על משחק (חוגים, קבוצות לימוד, מועדונים).",
            "",
            "5. כלי חסימה – Cold Turkey ו-Freedom חוסמים גישה למשחקים בשעות שהוגדרו מראש; Forest מעודדת זמן ללא מסך.",
          ].join("\n"),
        });
      }
    }

    if (a.types.includes("porn")) {
      if (a.pornType === "sex") {
        const cnt = a.sastCount ?? 0;
        if (cnt >= 5) {
          recs.push({
            id: uid("sex-addiction-severe"),
            symptomText: "נמצאו סימנים משמעותיים לקשיי שליטה בהתנהגות מינית.",
            treatment: "טיפול בהתמכרויות",
            treatmentLabel: "טיפול בהתמכרויות",
            domain: "קשיי התמכרות",
            urgent: false,
            notes:
              "מומלץ לפנות לטיפול בהתמכרויות. ניתן לשקול גם השתתפות בקבוצת תמיכה (SA / SAA).",
            tools: [
              "כלים להתמודדות עם דחפים מיניים מופרזים:",
              "",
              "1. זיהוי טריגרים רגשיים ומצביים – ברוב המקרים הדחף עולה ברגעים של בדידות, מתח, שעמום או רגשות שליליים. ניהול יומן עוזר לזהות את הדפוס.",
              "",
              "2. תכנית פעולה למצבי דחף – להגדיר מראש 2–3 פעולות חלופיות שניתן לעשות בתוך דקה (יציאה החוצה, התקשרות לאדם תומך, תרגול נשימה ארוך).",
              "",
              "3. הסרת גישה זמינה – הגבלת הגישה לרשתות חברתיות, אפליקציות היכרות ופלטפורמות מסוימות בשעות בעלות סיכון גבוה.",
              "",
              "4. קבוצות תמיכה – SA (Sexaholics Anonymous) ו-SAA פועלות בעברית עם מפגשים פרונטליים ומקוונים.",
              "",
              "5. שגרת בוקר וערב מובנית – חוסר מבנה הוא טריגר משמעותי. שגרה קבועה של שינה, ספורט וארוחות מפחיתה את עומס הדחפים.",
            ].join("\n"),
          });
        } else if (cnt >= 3) {
          recs.push({
            id: uid("sex-addiction-mild"),
            symptomText: "נמצאו סימנים לקשיי שליטה בהתנהגות מינית.",
            treatment: "טיפול בהתמכרויות",
            treatmentLabel: "טיפול בהתמכרויות",
            domain: "קשיי התמכרות",
            urgent: false,
            notes: "מומלץ לפנות לטיפול בהתמכרויות.",
            tools: [
              "כלים להתמודדות עם דחפים מיניים מופרזים:",
              "",
              "1. זיהוי טריגרים – ניהול יומן רגשי לזיהוי הקשר בין מצבי רוח, בדידות או מתח לבין עליית הדחף.",
              "",
              "2. תכנית פעולה חלופית – להגדיר מראש פעולות שניתן לעשות בתוך דקה (יציאה החוצה, שיחה לאדם תומך, תרגול נשימה).",
              "",
              "3. הגבלת גישה זמינה – צמצום הגישה לפלטפורמות שמעוררות את הדחף בשעות בעלות סיכון גבוה.",
              "",
              "4. שגרה מובנית – שגרת שינה, ספורט וארוחות קבועות מפחיתה את עומס הדחפים.",
            ].join("\n"),
          });
        }
      } else {
        // Porn usage scoring: 18 items, 1-7 each, threshold > 76
        const pornTotal = sum(a.pornScores);
        if (pornTotal > 76) {
          recs.push({
            id: uid("porn"),
            symptomText: "נמצאו סימנים לשימוש בעייתי בפורנוגרפיה.",
            treatment: "טיפול בהתמכרויות",
            treatmentLabel: "טיפול בהתמכרויות",
            domain: "קשיי התמכרות",
            urgent: false,
            notes: "מומלץ לשלב מרכיבים של מיינדפולנס וגוף-נפש בטיפול.",
            tools: [
              "כלים להתמודדות עם דחפים לצפייה:",
              "",
              "1. חוסמי תוכן – Covenant Eyes, BlockerX ו-Freedom חוסמים אתרי תוכן מיני בכל המכשירים. רצוי שאדם תומך יחזיק בסיסמת הביטול כדי שלא ניתן לבטל בקלות ברגע של דחף.",
              "",
              "2. “גלישה על הגל” (Urge Surfing) – טכניקה ממיינדפולנס. כשעולה דחף, לא מנסים להילחם בו אלא להתבונן בו: היכן הוא נמצא בגוף, איך הוא משתנה. רוב הדחפים שוככים תוך 15–20 דקות אם לא נענים להם.",
              "",
              "3. יומן טריגרים – לזהות מתי עולה הדחף (שעמום, בדידות, מתח, אחרי מריבה?). זיהוי הדפוס הוא תנאי לשינוי.",
              "",
              "4. שגרת ערב מסודרת – שעות הסיכון הגבוהות ביותר הן שעות ערב מאוחר במיטה. כדאי לקבוע שהטלפון/מחשב לא נכנסים לחדר השינה אחרי שעה מסוימת.",
              "",
              "5. קבוצות תמיכה – SA ו-SAA פועלות בעברית. למי שמעדיף תמיכה אנונימית מקוונת: r/NoFap עם קהילה גדולה.",
            ].join("\n"),
          });
        }
      }
    }

    if (a.types.includes("gambling")) {
      const cnt = a.gamblingYes ?? 0;
      if (cnt >= 4) {
        const sev =
          cnt >= 8 ? "בחומרה גבוהה" : cnt >= 6 ? "בחומרה בינונית" : "בחומרה קלה";
        recs.push({
          id: uid("gambling"),
          symptomText: `נמצאו סימנים להתמכרות להימורים ${sev}.`,
          treatment: "טיפול בהתמכרויות",
          treatmentLabel: "טיפול בהתמכרויות",
          domain: "קשיי התמכרות",
          urgent: false,
          notes:
            "מומלץ לפנות לטיפול בהתמכרויות. בנוסף, מומלצת קבוצת תמיכה למכורים להימורים (GA).",
          tools: [
            "כלים לצמצום הימורים:",
            "",
            "1. חסימת אתרי הימורים בכל המכשירים – שירותים כמו Gamban ו-BetBlocker (שניהם חינמיים) חוסמים אלפי אתרי הימורים בטלפון, במחשב ובטאבלט. רצוי שאדם תומך יחזיק בסיסמה כדי שלא יהיה ניתן לבטל בקלות.",
            "",
            "2. העברת ניהול הכספים – בתקופת ההתאוששות מומלץ להעביר את ניהול הכספים השוטף לבן/בת זוג או אדם קרוב, ולהחזיק רק סכום מזומן יומי מוגבל. ניתן גם לבקש מהבנק לחסום העברות לאתרי הימורים.",
            "",
            "3. הימנעות ממקומות וחברה שמעוררים דחף – לזהות אילו חברים, מקומות (פאבים מסוימים, מכוני הימורים) או טקסים (ערבי שישי, משחקי ספורט) מעוררים את הדחף, ולתכנן חלופות.",
            "",
            "4. הימנעות מ“ריצה אחרי הפסדים” – ההכרה בכך שניסיון להחזיר כסף שאבד באמצעות הימור נוסף הוא הסימן המובהק להתמכרות, ולא לפתרון. מי שמרגיש את הדחף לרוץ אחרי הפסד צריך להתקשר מיד לאדם תומך.",
            "",
            "5. קבוצת תמיכה GA (Gamblers Anonymous) – פועלת בעברית בכל הארץ, יחד עם קבוצת Gam-Anon לבני משפחה.",
          ].join("\n"),
        });
      }
    }

    if (a.types.includes("phone")) {
      // 10 items, 1-6 each, threshold > 33
      const phoneTotal = sum(a.phoneScores);
      if (phoneTotal > 33) {
        recs.push({
          id: uid("phone"),
          symptomText: "נמצאו סימנים לשימוש מופרז בטלפון הסלולארי.",
          treatment: "טיפול בהתמכרויות",
          treatmentLabel: "טיפול בהתמכרויות",
          domain: "קשיי התמכרות",
          urgent: false,
          notes: "מומלץ טיפול מבוסס מיינדפולנס / גוף-נפש.",
          tools: [
            "כלים לעזרה לשימוש מופרז בטלפון הסלולארי:",
            "",
            "1. מעקב ויומן שימוש – ניהול יומן יומי שבו כותבים מתי, כמה זמן ולמה השתמשתי בטלפון. מודעות = שלב ראשון לשינוי.",
            "",
            '2. הגדרת גבולות זמן (Time Blocking) – לקבוע "חלונות שימוש" ברורים (למשל: לבדוק וואטסאפ רק בשעות 9:00, 13:00, 18:00). לשלב טקסי פתיחה/סגירה (כמו לשים את הטלפון בקופסה כשמסתיים הזמן).',
            "",
            "3. עבודה על הטריגרים – לזהות מה מפעיל את השימוש: שעמום? חרדה? בדידות? להחליף תגובה: כשמרגיש משעמם → לצאת להליכה; כשמרגיש חרד → תרגול נשימות וכו'.",
            "",
            '4. טכניקת "30 שניות של בחירה" – כל פעם שמתחשק לבדוק את הטלפון, לעצור ל-30 שניות, לנשום, ולשאול: האם אני באמת צריך את זה עכשיו? או שאני פשוט פועל על אוטומט?',
            "",
            "אפליקציות מומלצות לניהול שימוש בסמארטפון:",
            "",
            '• Forest (חינמית / בתשלום סמלי) – שותלת "עץ" בכל פעם שאתה נמנע מלהשתמש בטלפון. אם תיכנס לאפליקציה אחרת – העץ "ימות". יוצרת מוטיבציה פנימית וגיימיפיקציה חיובית. אפשר גם "לשתול יערות" עם חברים. forestapp.cc',
            "",
            "• StayFree (חינמית – אנדרואיד בלבד) – מציגה נתונים סטטיסטיים על זמן מסך, אפליקציות בשימוש-יתר, ומציבה גבולות יומיים. כוללת התראות כאשר חורגים מהמגבלות שהוגדרו.",
            "",
            '• Freedom (בתשלום – iOS / אנדרואיד / מחשב) – מאפשרת לחסום זמנית גישה לאפליקציות ואתרים לפי בחירה. כוללת תזמון מראש (Scheduled Sessions) ואפילו "מצב בלתי שביר" שבו אי אפשר לבטל את החסימה. freedom.to',
          ].join("\n"),
        });
      }
    }
  }

  // ===== PERSONAL DEVELOPMENT DOMAIN =====
  // Only applies when personal_development is the sole selected domain.
  // When combined with other domains, it's intentionally ignored.
  if (
    answers.domains.includes("personal_development") &&
    answers.domains.length === 1
  ) {
    recs.push({
      id: uid("personal-dev"),
      symptomText: "צורך בהתפתחות אישית והבנה עצמית.",
      treatment: "טיפול דינאמי",
      treatmentLabel: "טיפול דינאמי",
      domain: "התפתחות אישית",
      urgent: false,
    });
  }

  // Urgent recommendations first, then by domain order
  const domainOrder = [
    "מורכבויות בתחום הרגשי/האישי",
    "סימני שאלה לגבי התחומים התפקודיים, התעסוקתיים או האקדמאיים",
    "זוגיות ומשפחה",
    "קשיי התמכרות",
    "התפתחות אישית",
  ];
  const sorted = [...recs].sort((a, b) => {
    if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
    return domainOrder.indexOf(a.domain) - domainOrder.indexOf(b.domain);
  });

  return {
    recommendations: sorted,
  };
}
