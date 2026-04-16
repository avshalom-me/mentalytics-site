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

  // Compute therapist style score (average of Q1+Q2 as 1-7, for matching)
  const styleQ1 = answers.emotional?.therapistStyleQ1 ?? 0;
  const styleQ2 = answers.emotional?.therapistStyleQ2 ?? 0;
  const therapistStyleScore =
    styleQ1 > 0 || styleQ2 > 0 ? Math.round((styleQ1 + styleQ2) / 2) : null;

  const { treatment: emotTreatment, treatmentLabel: emotLabel, mixed } =
    resolveEmotionalTreatment(styleQ1, styleQ2);

  // ===== EMOTIONAL DOMAIN =====
  if (answers.domains.includes("emotional") && answers.emotional) {
    const e = answers.emotional;

    // --- E1: Mood ---
    const moodCount = e.moodItems?.length ?? 0;
    if (moodCount >= 4) {
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
      recs.push({
        id: uid("mood-low"),
        symptomText: "נמצאו סימנים של מצב רוח ירוד.",
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
    const prodromeCount = e.prodromeItems?.length ?? 0;
    if (prodromeCount >= 2) {
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
    const gad7Total = sum(e.gad7Scores);
    if (gad7Total > 13) {
      recs.push({
        id: uid("gad7-severe"),
        symptomText: "נמצאו סימנים של חרדה כללית.",
        treatment: emotTreatment,
        treatmentLabel: emotLabel,
        domain: "מורכבויות בתחום הרגשי/האישי",
        urgent: false,
      });
    } else if (gad7Total >= 3) {
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
      } else if (sev >= 1) {
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
    } else if (ocdTotal >= 8) {
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
    const sleepItems = e.sleepItems ?? [];
    if (sleepItems.slice(0, 5).some(Boolean)) {
      recs.push({
        id: uid("sleep-neuro"),
        symptomText: "נמצאו סימנים להפרעת שינה.",
        treatment: emotTreatment,
        treatmentLabel: emotLabel,
        domain: "מורכבויות בתחום הרגשי/האישי",
        urgent: false,
        notes: "התייעצות עם רופא המשפחה או נוירולוג.",
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
      if (disTotal === 8) {
        // All answered "2" → communication/autism assessment
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
            treatment: "טיפול תעסוקתי",
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
            treatment: "טיפול תעסוקתי",
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
      if (maxSum === eftSum) approachLabel = "EFT (טיפול ממוקד רגש)";
      else if (maxSum === dynSum) approachLabel = "טיפול זוגי דינמי";
      else approachLabel = "טיפול זוגי מבני";

      recs.push({
        id: uid("couple-therapy"),
        symptomText: `נמצא קושי בקשר הזוגי. מומלץ ${approachLabel}.`,
        treatment: "טיפול זוגי",
        treatmentLabel: "טיפול זוגי",
        domain: "זוגיות ומשפחה",
        urgent: false,
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
          notes: "שילוב עזרה פסיכיאטרית עם טיפול CBT אינטנסיבי.",
        });
      } else if (cnt > 2) {
        recs.push({
          id: uid("substances-mild"),
          symptomText: "נמצאו סימנים להתמכרות לחומרים ממכרים.",
          treatment: "טיפול בהתמכרויות",
          treatmentLabel: "טיפול בהתמכרויות",
          domain: "קשיי התמכרות",
          urgent: false,
          notes: "CBT בשילוב גישה מוטיבציונית.",
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
          notes: "CBT בשילוב גישה מוטיבציונית.",
        });
      }
    }

    if (a.types.includes("porn")) {
      if (a.pornType === "sex") {
        const cnt = a.sastCount ?? 0;
        if (cnt > 5) {
          recs.push({
            id: uid("sex-addiction"),
            symptomText: "נמצאו סימנים להתמכרות למין.",
            treatment: "טיפול בהתמכרויות",
            treatmentLabel: "טיפול בהתמכרויות",
            domain: "קשיי התמכרות",
            urgent: false,
            notes:
              "קבוצת תמיכה SA. ללא הפרעות נוספות: מטפל מיני. עם הפרעות נוספות: פסיכולוג קליני CBT.",
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
            notes: "CBT בשילוב מיינדפולנס.",
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
          notes: "CBT וקבוצת תמיכה GA.",
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
          notes: "טיפול מבוסס מיינדפולנס.",
          tools: [
            "כמה עצות לצמצום השימוש המופרז בטלפון הסלולרי:",
            "",
            "1. מעקב אחרי שימוש – רשום לעצמך כמה זמן ביום אתה משתמש בטלפון. המודעות = שלב ראשון לשינוי.",
            "",
            "2. הגדרת חלונות זמן (Time Blocking) – קבע \"חלונות שימוש\" בלוח-השנה (לדוגמה: בדיקת הודעות רק בשעות 9:00, 13:00, 18:00). השאר את הטלפון פתוח/סגור (אבל השבת את הטלפון בקופסה/בשלשת הכיסים).",
            "",
            "3. עצירה עם מודעות – זהה את הדפוסים שמפעילים את השימוש: מתי? איפה? ממה? המלאכול תבנית: \"כשאני מרגיש X – אצא לטיול; כשאני מרגיש Y – תרגול נשימות\".",
            "",
            "4. טכניקת \"30 שניות של המתנה\" – כל פעם שמתחשק לבדוק את הטלפון, לעצור 30 שניות, לשאול: מה אני באמת צריך עכשיו? לא פעם זה פשוט פחד להיות לבד עם המחשבות.",
            "",
            "אפליקציות מומלצות לניהול שימוש בסמארטפון:",
            "",
            "• Forest (iOS / אנדרואיד) – שותלת \"עץ\" כל פעם שאתה נמנע מלהשתמש בטלפון. אם תנסה לגלוש – העץ \"מת\". מוצר גמיפיקציה פשוט ואפקטיבי. אפשר גם \"לשתול יערות\" עם חברים. forestapp.cc",
            "",
            "• StayFree (אנדרואיד – חינמי) – מציג נתוני שימוש מפורטים על כל אפליקציה, מגדיר מגבלות שימוש-יתר, ומציג התראות חכמות. כולל לוח-תרשים שמראה מגמות השתפרות. Play Store → StayFree",
            "",
            "• Freedom (מנוי – iOS / אנדרואיד / מחשב) – מאפשרת לחסום בבת-אחת את כל אתרי האינטרנט ואפליקציות בצורה מוגדרת-מראש. כוללת תכנון \"מועד שמירה\" שאי-אפשר לבטל בקלות. freedom.to",
          ].join("\n"),
        });
      }
    }
  }

  // Urgent recommendations first, then by domain order
  const domainOrder = [
    "מורכבויות בתחום הרגשי/האישי",
    "סימני שאלה לגבי התחומים התפקודיים, התעסוקתיים או האקדמאיים",
    "זוגיות ומשפחה",
    "קשיי התמכרות",
  ];
  const sorted = [...recs].sort((a, b) => {
    if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
    return domainOrder.indexOf(a.domain) - domainOrder.indexOf(b.domain);
  });

  return {
    recommendations: sorted,
    therapistStyleScore,
  };
}
