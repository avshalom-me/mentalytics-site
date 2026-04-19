// ===== INPUT: תשובות גולמיות מהשאלון =====

export type QuestionnaireAnswers = {
  // --- אינטייק ---
  age: number;
  gender: string;
  vision?: boolean;
  hearing?: boolean;
  bmiAbnormal?: boolean;

  // --- תחומים שנבחרו ---
  domains: ("emotional" | "functional" | "relationship" | "addiction")[];

  // --- תחום רגשי ---
  emotional?: {
    e1?: boolean;                    // מצב רוח ירוד
    moodItems?: number[];            // פריטים שסומנו (0-9)
    moodSuicidal?: boolean;
    e1b?: boolean;                   // אנהדוניה
    maniaScreen1?: boolean;
    maniaScreen2?: boolean;
    maniaItems?: number[];           // פריטים שסומנו (0-6)
    maniaDeath?: boolean;
    e3?: boolean;                    // פסיכוזה
    prodromeItems?: number[];        // פריטים שסומנו (0-5)
    prodromeSuicidal?: boolean;
    e4?: boolean;                    // חרדה
    e4Chronic?: boolean;
    e4Medical?: boolean;
    gad7Scores?: number[];           // 9 פריטים, 1-3
    socialAnxiety?: boolean;
    socialSeverity?: number;         // 1-7
    flightAnxiety?: boolean;
    medicalAnxiety?: boolean;
    stressPain?: boolean;
    e5?: boolean;                    // OCD
    ocdScores?: number[];            // 6 פריטים, 1-3
    e6?: boolean;                    // אכילה
    eating1Count?: number;
    eating2Count?: number;
    eating2Purge?: boolean;
    eating3Count?: number;
    e7?: boolean;                    // שינה
    sleepItems?: boolean[];          // 6 פריטים
    e8?: boolean;                    // סומטי
    e8b?: boolean;                   // דיסוציאציה
    tics?: boolean;
    tinnitus?: boolean;
    e9?: boolean;                    // טראומה
    traumaType?: string;
    traumaFreq?: string;
    traumaScores?: number[];         // 10 פריטים, 0-4
    traumaSuicidal?: boolean;
    e10?: boolean;                   // יציבות רגשית
    persMainScores?: number[];       // 2 פריטים, 1-5
    disQAnswers?: number[];          // 4 פריטים, 1 או 2
    persScores?: number[];           // 6 פריטים, 1-5
    persQ7?: boolean;
    persQ8?: boolean;
    therapistStyleQ1?: number;       // 1-7
    therapistStyleQ2?: number;       // 1-7
    therapistStyleQ3?: number;       // 1-7
  };

  // --- תחום תפקודי ---
  functional?: {
    f1?: boolean;
    f1Attention?: boolean;
    f1Processing?: boolean;
    adhd1Count?: number;             // מספר פריטים שסומנו בבלוק א
    adhd2Count?: number;             // מספר פריטים שסומנו בבלוק ב
    ldReading?: boolean;
    ldScores?: number[];             // 5 פריטים, 1-3
    f2?: boolean;
    execScores?: number[];           // 6 פריטים, 1-3
    f3?: boolean;
    employmentType?: string;
    empAItems?: boolean[];           // 5 פריטים
    empBItems?: boolean[];           // 4 פריטים
  };

  // --- תחום זוגי/משפחתי ---
  relationship?: {
    r1?: boolean;
    r1InRelationship?: boolean;
    coupleScale?: number;            // 1-7
    coupleInRelationship?: boolean;
    eftScores?: number[];            // 7 פריטים, 1-7
    dynScores?: number[];            // 7 פריטים, 1-7
    structScores?: number[];         // 7 פריטים, 1-7
    r3?: boolean;
    r3WithPartner?: boolean;
  };

  // --- תחום התמכרויות ---
  addiction?: {
    types: ("substances" | "gaming" | "porn" | "gambling" | "phone")[];
    substanceCount?: number;
    gamingCount?: number;
    pornType?: "porn" | "sex";
    pornScores?: number[];           // 18 פריטים, 1-7
    sastCount?: number;              // מספר פריטים שסומנו מתוך 25
    gamblingYes?: number;            // מספר "כן" מתוך 9
    phoneScores?: number[];          // 10 פריטים, 1-6
  };
};

// ===== OUTPUT: המלצות לתצוגה + קלט ל-matching =====

export type Recommendation = {
  id: string;
  symptomText: string;              // טקסט לתצוגה למשתמש
  treatment: string;                // ערך מדויק מ-TRAINING_AREAS
  treatmentLabel: string;           // שם לתצוגה על הכפתור
  domain: string;                   // לצורך קיבוץ בתצוגה
  urgent: boolean;
  notes?: string;                   // הערות נוספות
  tools?: string;                   // כלים להתמודדות עצמית
  couplesModality?: string;         // EFT / דינאמי / מבני
  needsSexualTherapy?: boolean;     // שילוב טיפול מיני
};

export type ScoringResult = {
  recommendations: Recommendation[];
};
