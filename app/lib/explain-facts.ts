// Helpers that distill a user's raw questionnaire answers into a small bag of
// derived facts safe to send to the LLM in /api/explain-recommendation.
//
// The contract: ONLY share things the user explicitly answered and that map to
// the recommendation logic. No free-text fields (trauma descriptions, etc.),
// no PII (name, contact info), no exact ages.

import type { QuestionnaireAnswers } from "./questionnaire-types";

export type UserFacts = {
  summary?: string[];
  scores?: Record<string, number | string>;
  age_band?: string;
  gender?: string;
  flags?: string[];
};

// ───────────────────────────────────────────────────────────────────────────
// ADULTS
// ───────────────────────────────────────────────────────────────────────────

function ageBand(age: number | undefined): string | undefined {
  if (!age || isNaN(age)) return undefined;
  if (age < 18) return "מתחת ל-18";
  if (age <= 30) return "18-30";
  if (age <= 45) return "31-45";
  if (age <= 60) return "46-60";
  return "60+";
}

function genderText(g: string | undefined): string | undefined {
  if (!g) return undefined;
  return g; // already Hebrew (זכר / נקבה / אחר)
}

// Translate a raw score/count into a qualitative severity word the LLM is
// allowed to use. We never send the number or the measure name to the model
// (those are forbidden in the prompt), so the summary must carry the meaning.
function severityWord(value: number, min: number, max: number): "קלה" | "בינונית" | "גבוהה" {
  const r = max > min ? (value - min) / (max - min) : 0;
  if (r >= 0.66) return "גבוהה";
  if (r >= 0.33) return "בינונית";
  return "קלה";
}

/**
 * Build sanitised facts from an adult's questionnaire answers, scoped to the
 * domain of the recommendation. Different domains surface different things.
 */
export function buildAdultFacts(
  answers: QuestionnaireAnswers,
  domain: string,
): UserFacts {
  const facts: UserFacts = {
    summary: [],
    scores: {},
    flags: [],
    age_band: ageBand(answers.age),
    gender: genderText(answers.gender),
  };

  const e = answers.emotional ?? {};
  const f = answers.functional ?? {};
  const r = answers.relationship ?? {};
  const ad = answers.addiction ?? { types: [] };

  const isEmotional = domain.includes("רגשי");
  const isFunctional = domain.includes("תפקודי") || domain.includes("לימודי");
  const isRelationship = domain.includes("זוגיות") || domain.includes("משפחה");
  const isAddiction = domain.includes("התמכרות");

  if (isEmotional) {
    if (e.moodItems && e.moodItems.length > 0) {
      facts.summary!.push(`דווח מצב רוח ירוד בעוצמה ${severityWord(e.moodItems.length, 0, 9)}`);
    }
    if (e.moodSuicidal) facts.flags!.push("מחשבות אובדניות בהקשר מצב רוח");
    if (e.maniaScreen1 && e.maniaScreen2) {
      facts.summary!.push("דווחו תקופות של מצב רוח מרומם ופרץ אנרגיה");
    }
    if (e.e3a) facts.flags!.push("דווח על תפיסות שאחרים לא חולקים");
    if (e.e3b) facts.flags!.push("דווח על אמונות יוצאות דופן");
    if (e.prodromeSuicidal) facts.flags!.push("מחשבות אובדניות בהקשר הסקרינינג הפסיכוטי");
    if (e.gad7Scores && e.gad7Scores.length > 0) {
      const total = e.gad7Scores.reduce((a, b) => a + b, 0);
      const len = e.gad7Scores.length;
      facts.summary!.push(`דווחו דאגות וחרדה מתמשכות בעוצמה ${severityWord(total, len, len * 3)}`);
    }
    if (e.socialAnxiety) {
      facts.summary!.push(
        e.socialSeverity
          ? `דווח קושי בחרדה חברתית בעוצמה ${severityWord(e.socialSeverity, 1, 7)}`
          : "דווחו קשיים בתחום החרדה החברתית",
      );
    }
    if (e.e4Chronic) facts.flags!.push("כאבים כרוניים");
    if (e.flightAnxiety) facts.flags!.push("קשיי חרדה בהקשר טיסות");
    if (e.medicalAnxiety) facts.flags!.push("קשיי חרדה בהקשר רפואי");
    if (e.stressPain) facts.flags!.push("תסמינים גופניים בעת מתח");
    if (e.ocdScores && e.ocdScores.length > 0) {
      const total = e.ocdScores.reduce((a, b) => a + b, 0);
      const len = e.ocdScores.length;
      facts.summary!.push(`דווחו מחשבות חוזרות וצורך בפעולות חוזרות בעוצמה ${severityWord(total, len, len * 3)}`);
    }
    if (e.e6) facts.summary!.push("דווחו קשיים בהקשר אכילה ומשקל");
    if (e.e7) facts.summary!.push("דווחו קשיי שינה");
    if (e.tics) facts.flags!.push("דווחו טיקים");
    if (e.tinnitus) facts.flags!.push("דווח טנטון");
    if (e.e9) {
      if (e.traumaScores && e.traumaScores.length > 0) {
        const total = e.traumaScores.reduce((a, b) => a + b, 0);
        facts.summary!.push(`דווח על אירוע טראומטי בעבר, עם תסמינים נמשכים בעוצמה ${severityWord(total, 0, e.traumaScores.length * 4)}`);
      } else {
        facts.summary!.push("דווח על אירוע טראומטי בעבר");
      }
      if (e.traumaSuicidal) facts.flags!.push("מחשבות אובדניות בהקשר טראומה");
    }
    if (e.e10) facts.summary!.push("דווחה חוסר עקביות בניהול קשרים בין-אישיים");
  }

  if (isFunctional) {
    if (f.f1Attention) facts.summary!.push("דווחו קשיי קשב וריכוז");
    if (f.f1Processing) facts.summary!.push("דווחו קשיי הבנה ועיבוד");
    if (f.adhd1Count != null) {
      facts.summary!.push(`דווחו קשיי קשב וריכוז בעוצמה ${severityWord(f.adhd1Count, 0, 6)}`);
    }
    if (f.adhd2Count != null) {
      facts.summary!.push(`דווחו סימני אי-שקט ואנרגיה עודפת בעוצמה ${severityWord(f.adhd2Count, 0, 6)}`);
    }
    if (f.ldScores && f.ldScores.length > 0) {
      const total = f.ldScores.reduce((a, b) => a + b, 0);
      const len = f.ldScores.length;
      facts.summary!.push(`דווחו קשיי למידה בעוצמה ${severityWord(total, len, len * 3)}`);
    }
    if (f.execScores && f.execScores.length > 0) {
      const total = f.execScores.reduce((a, b) => a + b, 0);
      const len = f.execScores.length;
      facts.summary!.push(`דווחו קשיים בארגון ובתפקודים הניהוליים בעוצמה ${severityWord(total, len, len * 3)}`);
    }
    if (f.disabilityNl) facts.flags!.push("פנייה קודמת לביטוח לאומי");
  }

  if (isRelationship) {
    if (r.rSingle) facts.summary!.push("מחפש/ת עזרה עם דפוסי זוגיות, קושי ביצירת קשרים קרובים, או עיבוד פרידה/גירושין");
    if (r.rSingleCBTScale !== undefined && r.rSingleDynScale !== undefined) {
      if (r.rSingleCBTScale > r.rSingleDynScale) {
        facts.summary!.push("מעוניין/ת בעזרה ממוקדת ומכוונת-מטרה לעולם הזוגי");
      } else {
        facts.summary!.push("מעוניין/ת בטיפול מעמיק להבנת מכשולים ומורכבויות בתחום הזוגי");
      }
    }
    if (r.r1) facts.summary!.push("דווחו קשיים בתפקוד המיני");
    if (r.rAbuse) facts.flags!.push("דווחה אלימות / שליטה בקשר זוגי");
    if (r.coupleScale) {
      facts.summary!.push(`דווח קושי בזוגיות בעוצמה ${severityWord(r.coupleScale, 1, 7)}`);
    }
    if (r.eftScores && r.dynScores && r.structScores) {
      const eftSum = r.eftScores.reduce((a, b) => a + b, 0);
      const dynSum = r.dynScores.reduce((a, b) => a + b, 0);
      const struSum = r.structScores.reduce((a, b) => a + b, 0);
      const maxSum = Math.max(eftSum, dynSum, struSum);
      if (maxSum > 0) {
        const modality = maxSum === eftSum ? "EFT (טיפול ממוקד רגש)"
          : maxSum === dynSum ? "טיפול זוגי דינאמי"
          : "טיפול זוגי מבני";
        facts.summary!.push(`גישה זוגית שנמצאה מתאימה: ${modality}`);
      }
    }
    if (r.r3Conflict) facts.summary!.push("דווחו קונפליקטים מתמשכים בתא המשפחתי");
    if (r.r3ChildIssues) facts.summary!.push("דווחו קשיים אצל הילדים");
  }

  if (isAddiction) {
    if (ad.types && ad.types.length > 0) {
      const typeMap: Record<string, string> = {
        substances: "חומרים",
        gaming: "גיימינג",
        porn: "פורנו",
        gambling: "הימורים",
        phone: "מסכים",
      };
      const labels = ad.types.map(t => typeMap[t] ?? t).join(", ");
      facts.summary!.push(`סוגי התמכרות שסומנו: ${labels}`);
    }
    if (ad.substanceCount) facts.scores!.substance_items = ad.substanceCount;
    if (ad.gamblingYes) facts.scores!.gambling_items = ad.gamblingYes;
  }

  // Trim empty arrays so JSON stays small
  if (facts.summary!.length === 0) delete facts.summary;
  if (facts.flags!.length === 0) delete facts.flags;
  // Never send raw scores / measure names to the model - severity is conveyed
  // qualitatively in `summary`. Keeps numbers and instrument names out of the LLM.
  delete facts.scores;

  return facts;
}

// ───────────────────────────────────────────────────────────────────────────
// KIDS
// ───────────────────────────────────────────────────────────────────────────

type KidsAns = Record<string, unknown>;

function kidsAgeBand(grade: string | undefined): string | undefined {
  // grade values are short codes like "ga" (גן), "ab" (א-ב), etc.
  if (!grade) return "child";
  return "child"; // intentionally keep coarse - exact grade isn't sent.
}

/**
 * Build sanitised facts from a parent's questionnaire about their child.
 * Scoped to the recommendation's domain so we don't send irrelevant data.
 */
export function buildKidsFacts(
  A: KidsAns,
  domainLabel: string,
): UserFacts {
  const facts: UserFacts = {
    summary: [],
    scores: {},
    flags: [],
    age_band: kidsAgeBand(A._grade as string | undefined),
    gender: genderText(A.gender as string | undefined),
  };

  const isEmotional = domainLabel.includes("רגשי");
  const isAcademic = domainLabel.includes("לימודי");
  const isBehavioral = domainLabel.includes("התנהגותי");
  const isSocial = domainLabel.includes("חברתי");
  const isDevelopmental = domainLabel.includes("התפתחותי");

  if (isEmotional) {
    if (typeof A.q1 === "number" && A.q1 > 0) {
      facts.summary!.push(`דווחו דאגות/לחצים בעוצמה ${severityWord(A.q1, 1, 5)}`);
    }
    if (typeof A.q2 === "number" && A.q2 > 0) {
      facts.summary!.push(`דווח קושי בדימוי עצמי בעוצמה ${severityWord(A.q2, 1, 5)}`);
    }
    if (typeof A.q3 === "number" && A.q3 > 0) {
      facts.summary!.push(`דווח מצב רוח ירוד בעוצמה ${severityWord(A.q3, 1, 5)}`);
    }
    if (A.q3_sui === "כן") facts.flags!.push("דווח על מחשבות אובדניות");
    if (typeof A.aq_tot === "number" && A.aq_tot > 0) facts.scores!.aq_total = A.aq_tot;
    if (typeof A.mq_tot === "number" && A.mq_tot > 0) facts.scores!.mq_total = A.mq_tot;
    if (typeof A.oq_tot === "number" && A.oq_tot > 0) facts.scores!.ocd_total = A.oq_tot;
    if (typeof A.tq_tot === "number" && A.tq_tot > 0) facts.scores!.trauma_total = A.tq_tot;
    if (typeof A.pq_tot === "number" && A.pq_tot > 0) facts.scores!.psychosis_total = A.pq_tot;
    if (typeof A.bq_tot === "number" && A.bq_tot > 0) facts.scores!.borderline_total = A.bq_tot;
    if (A.q4 === "כן") facts.summary!.push("דווחו סימני התמכרות");
    if (A.q6 === "כן") facts.summary!.push("דווחה חשיפה לאירוע טראומטי");
    if (A.q8 === "כן") facts.summary!.push("דווחה אכילה רגשית / קשיי משקל");
  }

  if (isAcademic) {
    if (A.a_aca && A.a_aca !== "כלל לא") facts.summary!.push(`רמת קושי לימודי: ${A.a_aca}`);
    if (A.a_emo === "הרבה" || A.a_emo === "הרבה מאוד") {
      facts.flags!.push("דווחו גם קשיים רגשיים משמעותיים שעשויים להשפיע על תפקוד לימודי");
    }
  }

  if (isBehavioral) {
    if (A.a_beh && A.a_beh !== "כלל לא") facts.summary!.push(`רמת קושי התנהגותי: ${A.a_beh}`);
  }

  if (isSocial) {
    if (A.a_soc && A.a_soc !== "כלל לא") facts.summary!.push(`רמת קושי חברתי: ${A.a_soc}`);
    if (A.soc1 === "כן") facts.flags!.push("דווחה ביישנות / חרדה חברתית");
    if (A.soc2 === "כן") facts.flags!.push("דווחו חיכוכים עם בני גילו");
    if (A.soc3 === "כן") facts.flags!.push("דווחו קשיי תקשורת");
  }

  if (isDevelopmental) {
    if (A.a_dev && A.a_dev !== "כלל לא") facts.summary!.push(`רמת קושי התפתחותי: ${A.a_dev}`);
  }

  if (facts.summary!.length === 0) delete facts.summary;
  if (facts.flags!.length === 0) delete facts.flags;
  // Never send raw scores / measure names to the model - severity is conveyed
  // qualitatively in `summary`. Keeps numbers and instrument names out of the LLM.
  delete facts.scores;

  return facts;
}
