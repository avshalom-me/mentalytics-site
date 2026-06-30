// Ground-truth rationale for each treatment / referral, fed to the LLM in
// /api/explain-recommendation so the "what this treatment is" paragraph rests on
// curated, accurate content instead of being invented by the model.
//
// Keyed on the exact treatment identifier the questionnaire emits
// (`Recommendation.treatment` — same Hebrew strings as treatment-articles.ts).
// The client may still pass a more specific `treatment_rationale` (e.g. the
// couples-modality "why"), which OVERRIDES anything here.
//
// `why`              — why the approach helps, in lay terms (no efficacy stats).
// `typical_duration` — qualitative shape/length of the work (never invent
//                      session counts in the model; supply them here if known).
// `evidence_strength`— "high" | "moderate" | "low" — research backing.

export type TreatmentRationale = {
  why?: string;
  typical_duration?: string;
  evidence_strength?: "high" | "moderate" | "low";
};

const CBT: TreatmentRationale = {
  why: "CBT עוזר לזהות את הקשר בין מחשבות, רגשות והתנהגות, ולתרגל דרכי חשיבה ופעולה חדשות שמקלות על המצוקה בחיי היומיום. העבודה ממוקדת בהווה, מעשית, וכוללת לרוב כלים ומשימות לתרגול בין הפגישות.",
  typical_duration: "טיפול ממוקד, לרוב קצר עד בינוני בטווחו — סדרה של מפגשים שבועיים על פני כמה חודשים.",
  evidence_strength: "high",
};

const DYNAMIC: TreatmentRationale = {
  why: "טיפול דינאמי מתמקד בהבנת השורשים של הקושי — חוויות עבר, רגשות עמוקים ודפוסים לא-מודעים שחוזרים על עצמם בקשרים ובחיים. דרך מערכת היחסים הטיפולית נוצר מרחב להבין ולשנות את הדפוסים האלה לעומק.",
  typical_duration: "תהליך פתוח ומתמשך, שמתפתח בהדרגה לאורך זמן.",
  evidence_strength: "moderate",
};

const EMDR: TreatmentRationale = {
  why: "EMDR היא שיטה לעיבוד זיכרונות קשים או טראומטיים. בעזרת גירוי דו-צדדי (כמו תנועות עיניים) המוח מצליח לעבד מחדש את הזיכרון, כך שהוא מאבד מעוצמתו הרגשית המציפה ומפסיק להשתלט על ההווה.",
  typical_duration: "תהליך מובנה בשלבים; מספר המפגשים משתנה לפי מורכבות וכמות האירועים.",
  evidence_strength: "high",
};

const DBT: TreatmentRationale = {
  why: "DBT משלב קבלה ושינוי, ומלמד מיומנויות מעשיות לוויסות רגשי, התמודדות עם מצוקה חריפה, תשומת לב (מיינדפולנס) ושיפור קשרים בין-אישיים — במיוחד כשהרגשות עוצמתיים ומשתנים במהירות.",
  typical_duration: "תהליך מובנה ויסודי יותר, לרוב על פני חודשים, לעיתים בשילוב קבוצת מיומנויות.",
  evidence_strength: "high",
};

const ACT: TreatmentRationale = {
  why: "ACT עוזר לפתח גמישות נפשית — ללמוד לשאת מחשבות ורגשות קשים בלי שינהלו אותך, ובמקביל לפעול לפי הערכים והדברים שחשובים לך באמת.",
  typical_duration: "טיפול ממוקד, לרוב קצר עד בינוני בטווחו.",
  evidence_strength: "moderate",
};

const TRAUMA: TreatmentRationale = {
  why: "טיפול ממוקד-טראומה עוזר לעבד אירוע קשה בקצב בטוח ומבוקר, להפחית את עוצמת התגובות הגופניות והרגשיות שנקשרו אליו, ולהחזיר תחושת שליטה ובטחון בהווה.",
  typical_duration: "תהליך מדורג שמתחיל בייצוב ותחושת בטחון, ורק אז בעיבוד עצמו.",
  evidence_strength: "high",
};

const COUPLES: TreatmentRationale = {
  why: "טיפול זוגי יוצר מרחב משותף ובטוח לבחון את דפוסי הקשר, לשפר את התקשורת ואת ההבנה ההדדית, ולהתמודד יחד עם הקשיים שעלו במקום כל אחד לבדו.",
  typical_duration: "תהליך משותף לשני בני הזוג, שמשכו נגזר מהמטרות שתגדירו יחד עם המטפל/ת.",
  evidence_strength: "moderate",
};

const FAMILY: TreatmentRationale = {
  why: "טיפול משפחתי מתבונן במשפחה כמערכת: במקום למקד את הקושי באדם אחד, הוא עובד על דפוסי התקשורת, התפקידים והדינמיקה בין בני המשפחה, כדי לייצר שינוי שמיטיב עם כולם.",
  typical_duration: "תהליך משותף לכמה מבני המשפחה, שמשכו נגזר מהמטרות המשותפות.",
  evidence_strength: "moderate",
};

const PARENT_GUIDANCE: TreatmentRationale = {
  why: "הדרכת הורים נותנת לכם ככלים מעשיים להבין את ההתנהגות של הילד/ה ולהגיב אליה בצורה שמפחיתה חיכוכים ומחזקת את הקשר. השינוי מושג דרך ההורים, מה שהופך אותו ליעיל ומהיר יחסית עבור ילדים.",
  typical_duration: "תהליך ממוקד יחסית, לרוב סדרה של מפגשים על פני כמה חודשים.",
  evidence_strength: "high",
};

const EXPRESSIVE: TreatmentRationale = {
  why: "טיפול בהבעה ויצירה משתמש באמנות, משחק או תנועה כשפה נוספת לביטוי — מתאים במיוחד לילדים ולמי שקשה לו לבטא רגשות במילים, ומאפשר לעבד חוויות דרך עשייה.",
  typical_duration: "תהליך מתמשך שמתפתח בקצב של המטופל/ת.",
  evidence_strength: "moderate",
};

const COGFUN: TreatmentRationale = {
  why: "COG-FUN היא התערבות בריפוי בעיסוק לקשיי קשב וריכוז, שמלמדת אסטרטגיות מעשיות לניהול זמן, ארגון ותפקוד יומיומי, תוך התאמה לסביבה ולחיים האמיתיים של המטופל/ת.",
  typical_duration: "תהליך ממוקד-מטרה, לרוב על פני כמה חודשים.",
  evidence_strength: "moderate",
};

const ADDICTION: TreatmentRationale = {
  why: "טיפול בהתמכרות עוזר להבין את התפקיד שההתנהגות הממכרת ממלאת, לפתח דרכי התמודדות חלופיות עם דחפים ומצבי לחץ, ולבנות בהדרגה שליטה וחיים מאוזנים יותר.",
  typical_duration: "תהליך מתמשך שמשלב התמודדות עם הדחף לצד עבודה על הגורמים שמתחתיו.",
  evidence_strength: "moderate",
};

const SEXUAL: TreatmentRationale = {
  why: "טיפול מיני עוסק בצורה מקצועית ולא-שיפוטית בקשיים בתחום המיני והזוגי, ומשלב הבנה רגשית עם כלים מעשיים להקלה על הקושי ולשיפור הקרבה.",
  typical_duration: "תהליך שמשכו נגזר מאופי הקושי ומהמטרות שתגדירו.",
  evidence_strength: "moderate",
};

const EATING: TreatmentRationale = {
  why: "טיפול בהפרעות אכילה משלב עבודה על היחס לאוכל ולגוף עם התמודדות עם המצוקה הרגשית שמתחת, לרוב במסגרת צוות רב-מקצועי, מתוך גישה זהירה ותומכת.",
  typical_duration: "תהליך מתמשך ויסודי, לעיתים בליווי גורמים מקצועיים נוספים.",
  evidence_strength: "high",
};

const PSYCHIATRIST: TreatmentRationale = {
  why: "פסיכיאטר/ית הוא/היא רופא/ה שיכול/ה להעריך את התמונה הרפואית, לסייע באבחנה ולהציע טיפול תרופתי כשהוא רלוונטי — לעיתים לצד טיפול רגשי, ולא במקומו.",
  typical_duration: "מתחיל בהערכה, ובהמשך מעקב לפי הצורך.",
  evidence_strength: "high",
};

// Keyed exactly on the questionnaire's `Recommendation.treatment` strings.
export const TREATMENT_RATIONALE: Record<string, TreatmentRationale> = {
  "CBT": CBT,
  "CPT": { ...CBT, why: "CPT היא צורה ממוקדת-טראומה של CBT, שעוזרת לבחון ולשנות מחשבות 'תקועות' שנותרו בעקבות האירוע הקשה, וכך להפחית את השפעתו על ההווה." },
  "DBT": DBT,
  "EMDR": EMDR,
  "ACT": ACT,
  "טיפול דינאמי": DYNAMIC,
  "פסיכואנליזה": { ...DYNAMIC, why: "פסיכואנליזה היא תהליך עומק שבוחן לאורך זמן את הדפוסים הלא-מודעים, הרגשות והחוויות המוקדמות שמעצבים את חיי הנפש, כדי להבין ולשנות אותם מהשורש." },
  "טיפול דינאמי בטראומה": { ...DYNAMIC, why: "טיפול דינאמי בטראומה משלב הבנה של דפוסי עומק עם עיבוד זהיר של החוויה הקשה והשפעתה על הקשרים והתחושות בהווה." },
  "טיפול בטראומה": TRAUMA,
  "טיפול זוגי": COUPLES,
  "טיפול משפחתי": FAMILY,
  "טיפול דיאדי": { ...FAMILY, why: "טיפול דיאדי עובד עם ההורה והילד יחד, כדי לחזק את הקשר ביניהם ולעבד דרכו חוויות קשות — מתוך ההבנה שהקשר הבטוח הוא מנוע הריפוי המרכזי בגיל הצעיר." },
  "הדרכת הורים": PARENT_GUIDANCE,
  "טיפול בהבעה ויצירה": EXPRESSIVE,
  "טיפול COG-FUN לקשיי קשב וריכוז": COGFUN,
  "טיפול בהתמכרויות": ADDICTION,
  "טיפול מיני": SEXUAL,
  "טיפול בהפרעות אכילה": EATING,
  "פסיכיאטר": PSYCHIATRIST,
  "פסיכיאטר ילדים": { ...PSYCHIATRIST, why: "פסיכיאטר/ית ילדים הוא/היא רופא/ה המתמחה בילדים ונוער, שיכול/ה להעריך את התמונה הרפואית, לסייע באבחנה ולשקול טיפול תרופתי כשהוא רלוונטי — לצד הטיפול הרגשי ולא במקומו." },
};

/**
 * Look up curated rationale for a treatment. Tries the exact treatment key
 * first, then the human-readable label as a fallback. Returns undefined when
 * nothing is curated (the caller then sends no rationale — current behaviour).
 */
export function getTreatmentRationale(
  treatment?: string | null,
  treatmentLabel?: string | null,
): TreatmentRationale | undefined {
  if (treatment && TREATMENT_RATIONALE[treatment]) return TREATMENT_RATIONALE[treatment];
  if (treatmentLabel && TREATMENT_RATIONALE[treatmentLabel]) return TREATMENT_RATIONALE[treatmentLabel];
  return undefined;
}
