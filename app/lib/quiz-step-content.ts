/**
 * מפת תוכן לשלבי השאלונים - מה כל מסך מציג למשתמש בפועל.
 *
 * משמשת את סוכן ניתוח הנשירה (/api/admin-quiz-dropout) כדי לעגן את ההסברים
 * במה שבאמת קורה בכל שלב (תוכן רגיש? מסך ארוך? שאלת שער?) במקום לנחש לפי
 * שם השלב. התיאורים נכתבו מתוך קריאת הקוד של app/adults/page.tsx
 * ו-app/kids/page.tsx.
 *
 * תחזוקה: כשמוסיפים/ממזגים מסך בשאלון - לעדכן כאן. שלב שחסר במפה לא שובר
 * כלום (הניתוח ייפול חזרה לתיאור גנרי), אבל ההסבר עליו יהיה פחות מדויק.
 * שלבים עם legacy: true אינם קיימים עוד בשאלון הנוכחי אך מופיעים באירועים
 * היסטוריים.
 */

export type QuizStepInfo = {
  /** שם הרובריקה בעברית (תואם לקיבוץ בעמוד האנליטיקס) */
  group: string;
  /** מה המשתמש רואה/נשאל במסך הזה */
  desc: string;
  /** אופי הקלט הנדרש */
  input: "gate" | "checklist" | "scales" | "form" | "choice" | "system";
  /** מספר פריטים משוער שנדרש לענות עליהם (כשרלוונטי) */
  items?: number;
  /** תוכן טעון רגשית: אובדנות, מיניות, אלימות, פסיכוזה */
  sensitive?: boolean;
  /** מסך ארוך / מאמץ קוגניטיבי גבוה */
  heavy?: boolean;
  /** לא קיים עוד בגרסה הנוכחית של השאלון (אירועים היסטוריים בלבד) */
  legacy?: boolean;
};

// ── שאלון מבוגרים ────────────────────────────────────────────────────────────

export const ADULTS_STEP_INFO: Record<string, QuizStepInfo> = {
  disclaimer: { group: "פתיחה", desc: "הצהרה משפטית ארוכה + צ'קבוקס הסכמה חובה לפני התחלה", input: "gate" },
  intake: { group: "פתיחה", desc: "גיל ומין (שדות חובה); מתחת ל-18 מופנים לשאלון ילדים", input: "form", items: 2 },
  domains: { group: "פתיחה", desc: "בחירת תחומי קושי: רגשי / תפקודי / זוגיות / התמכרות / התפתחות אישית", input: "choice", items: 1 },

  e1: { group: "E1 - דיכאון", desc: "שאלת שער: מצב רוח ירוד / עצבות מתמשכת (כן/לא)", input: "gate" },
  "e1-q": { group: "E1 - דיכאון", desc: "צ'קליסט 9 תסמיני מצב רוח לשבועיים האחרונים, כולל פריט אובדנות", input: "checklist", items: 9, sensitive: true },
  e2: { group: "E2 - מאניה", desc: "שער דו-שלבי: מצב רוח מרומם/רוגזני + פרץ אנרגיה (חשיפה הדרגתית)", input: "gate" },
  "e2-2": { group: "E2 - מאניה", desc: "שאלת ההמשך הישנה של שער המאניה (מוזגה לתוך e2)", input: "gate", legacy: true },
  "e2-q": { group: "E2 - מאניה", desc: "צ'קליסט תסמיני מאניה + צ'קבוקס מחשבות על מוות", input: "checklist", items: 7, sensitive: true },
  e3: { group: "E3 - פסיכוזה/סומטי", desc: "מסך משולב: הזיות / אמונות חריגות / תסמינים גופניים (3 צ'קבוקסים או דילוג), ובחשיפה הדרגתית גם פריטי הפרעת חשיבה ומחשבות אובדניות", input: "gate", sensitive: true },
  "e3-q": { group: "E3 - פסיכוזה/סומטי", desc: "צ'קליסט היגדים פרודרומליים + מחשבות אובדניות - מוזג לתוך e3 ב-8/8/26", input: "checklist", items: 8, sensitive: true, legacy: true },
  e4: { group: "E4 - חרדה", desc: "שאלת שער: דאגות מתמשכות / חרדה / פחד (כן/לא)", input: "gate" },
  "e4-contexts": { group: "E4 - חרדה", desc: "הקשרי חרדה: כאב כרוני (+שאלת המשך רפואית), טיסות, חרדה רפואית, תסמינים גופניים", input: "checklist", items: 4 },
  "e4-q": { group: "E4 - חרדה", desc: "שאלון חרדה בסגנון GAD-7: 9 סולמות 1-3, אף אחד אינו חובה - דילוג מפיק המלצת \"חרדה ללא הגדרה ספציפית\" + CBT", input: "scales", items: 9, heavy: true },
  "e4-social": { group: "E4 - חרדה", desc: "שאלת שער: חרדה חברתית (כן/לא)", input: "gate" },
  "e4-social-sev": { group: "E4 - חרדה", desc: "סולם יחיד 1-7: עד כמה החרדה החברתית פוגעת בתפקוד", input: "scales", items: 1 },
  "e4-chronic": { group: "E4 - חרדה", desc: "כאבים כרוניים (מוזג ל-e4-contexts)", input: "gate", legacy: true },
  "e4-medical": { group: "E4 - חרדה", desc: "שלילת גורם רפואי (מוזג ל-e4-contexts)", input: "gate", legacy: true },
  "e4-flight": { group: "E4 - חרדה", desc: "חרדת טיסות (מוזג ל-e4-contexts)", input: "gate", legacy: true },
  "e4-medanx": { group: "E4 - חרדה", desc: "חרדה רפואית (מוזג ל-e4-contexts)", input: "gate", legacy: true },
  "e4-stresspain": { group: "E4 - חרדה", desc: "תסמינים גופניים במתח (מוזג ל-e4-contexts)", input: "gate", legacy: true },
  e5: { group: "E5 - OCD", desc: "שאלת שער: מחשבות/פעולות חוזרות כפייתיות (כן/לא)", input: "gate" },
  "e5-q": { group: "E5 - OCD", desc: "סולמות OCD 1-3 לכל פריט", input: "scales", items: 6 },
  e6: { group: "E6 - אכילה/שינה", desc: "בחירה: קשיי אכילה ומשקל ו/או בעיות שינה (או דילוג)", input: "gate" },
  "e6-q": { group: "E6 - אכילה/שינה", desc: "שאלון אכילה: 3 קבוצות צ'קליסט (הגבלה/אכילת יתר/הימנעות) + גובה ומשקל ל-BMI", input: "checklist", items: 9, heavy: true, sensitive: true },
  "e7-q": { group: "E7 - שינה", desc: "צ'קליסט קשיי שינה", input: "checklist", items: 6 },
  e8: { group: "E8 - סומטי", desc: "שער סומטי ישן (מוזג לתוך e3)", input: "gate", legacy: true },
  e8c: { group: "E8 - סומטי", desc: "צ'קבוקסים: טיקים / טנטון (או דילוג)", input: "checklist", items: 2 },
  e8d: { group: "E8 - סומטי", desc: "מסך המשך סומטי ישן", input: "checklist", legacy: true },
  e9: { group: "E9 - טראומה", desc: "שער טראומה ישן (מוזג לתוך e9-q)", input: "gate", legacy: true },
  "e9-q": { group: "E9 - טראומה", desc: "מסך טראומה מלא: בחירת סוג אירוע (כולל פגיעה מינית/שכול), תדירות, סולמות PCL 0-4 + פריט אובדנות; דילוג בכפתור אחד", input: "scales", items: 10, heavy: true, sensitive: true },
  e10: { group: "E10 - אישיות", desc: "שאלת שער: חוסר עקביות מתמשכת בקשרים (כן/לא)", input: "gate" },
  e10a: { group: "E10 - אישיות", desc: "2 סולמות 1-5 על פגיעה בתפקוד היומיומי", input: "scales", items: 2 },
  e10b: { group: "E10 - אישיות", desc: "4 שאלות כן/לא על סימני תקשורת (רמזים חברתיים, שגרה, עיסוק אינטנסיבי, רגישות חושית)", input: "scales", items: 4 },
  e10c: { group: "E10 - אישיות", desc: "סולמות אישיות 1-5 + צ'קבוקסים על ריק פנימי ותגובות רגשיות קיצוניות", input: "scales", items: 8, sensitive: true },
  "therapist-style": { group: "סגנון טיפול", desc: "3 סולמות 1-7 על העדפות סגנון טיפולי (עומק מול פרקטיקה, מובנות, אקטיביות המטפל) - ניסוחים ארוכים", input: "scales", items: 3, heavy: true },

  "f-vision": { group: "תפקוד", desc: "2 שאלות חובה על קשיי ראייה/שמיעה - נמחק 8/8/26, התשובות מעולם לא נקראו בניקוד", input: "gate", items: 2, legacy: true },
  f1: { group: "תפקוד", desc: "קשיי למידה: בחירת סוג - קשב (ADHD) / הבנה ועיבוד (או דילוג)", input: "gate" },
  "f1-subs": { group: "תפקוד", desc: "תת-בחירה ישנה של סוג קושי למידה", input: "choice", legacy: true },
  "f1-adhd": { group: "תפקוד", desc: "שאלון ADHD: 2 בלוקים של 6 פריטי צ'קליסט (קשב + היפראקטיביות)", input: "checklist", items: 12, heavy: true },
  "f1-ld": { group: "תפקוד", desc: "שאלת שער: קושי ברכישת קריאה בילדות (כן/לא)", input: "gate" },
  "f1-ld-q": { group: "תפקוד", desc: "סולמות לקויות למידה 1-3", input: "scales", items: 5 },
  f2: { group: "תפקוד", desc: "שאלת שער: קשיי התארגנות (כן/לא)", input: "gate" },
  "f2-q": { group: "תפקוד", desc: "סולמות תפקודים ניהוליים 1-3", input: "scales", items: 6 },
  f3: { group: "תפקוד", desc: "שאלת שער: קושי/שחיקה תעסוקתית (כן/לא)", input: "gate" },
  "f3-type": { group: "תפקוד", desc: "בחירת סטטוס תעסוקתי: צעיר / שינוי קריירה / מוגבלות / שחיקה / אחר", input: "choice", items: 1 },
  "f3-a": { group: "תפקוד", desc: "צ'קליסט תעסוקתי לצעירים (5 פריטים)", input: "checklist", items: 5 },
  "f3-b": { group: "תפקוד", desc: "צ'קליסט תעסוקתי לבוגרים/שחיקה (5 פריטים, החמישי מנתב לשאלון התפקודים הניהוליים ואינו נספר בציון)", input: "checklist", items: 5 },
  "f3-disability": { group: "תפקוד", desc: "שאלה: האם פנית לביטוח לאומי (כן/לא)", input: "gate" },

  "r-intake": { group: "זוגיות / משפחה", desc: "סטטוס: בזוגיות / יש ילדים / ללא זוגיות (צ'קבוקסים)", input: "form", items: 1 },
  "r-single": { group: "זוגיות / משפחה", desc: "שער ליחידים: דפוסים חוזרים בזוגיות / קושי בקשרים / פרידה (כן/לא)", input: "gate" },
  "r-single-no-detail": { group: "זוגיות / משפחה", desc: "2 סולמות חובה 1-5 על סוג העזרה המבוקשת סביב זוגיות", input: "scales", items: 2 },
  r1: { group: "זוגיות / משפחה", desc: "שאלת שער: קשיים בתפקוד המיני (כן/לא)", input: "gate", sensitive: true },
  "r-abuse": { group: "זוגיות / משפחה", desc: "שאלת שער: אלימות / הפחדות / שליטה מצד בן/בת הזוג (כן/לא)", input: "gate", sensitive: true },
  "r1-scale": { group: "זוגיות / משפחה", desc: "סולם חובה 1-7: עוצמת הקושי בזוגיות", input: "scales", items: 1 },
  "r2-q": { group: "זוגיות / משפחה", desc: "שאלון זוגי משולש: 12 סולמות 1-7 בשלוש קבוצות של 4 (EFT / דינאמי / מבני), נדרשת תשובה בכל קבוצה. קוצר מ-21 סולמות ב-13/8/26", input: "scales", items: 12, heavy: true },
  "r3-conflict": { group: "זוגיות / משפחה", desc: "קונפליקטים משפחתיים: עד 3 שאלות כן/לא בחשיפה הדרגתית", input: "gate", items: 3 },
  "r3-child": { group: "זוגיות / משפחה", desc: "שאלת שער: קשיים רגשיים/התנהגותיים אצל הילדים (כן/לא)", input: "gate" },
  "r3-child-type": { group: "זוגיות / משפחה", desc: "בחירה: הקושי אצל הילד עצמו / בדינמיקה המשפחתית", input: "choice", items: 1 },
  r3: { group: "זוגיות / משפחה", desc: "שער קונפליקט משפחתי ישן (הוחלף ב-r3-conflict)", input: "gate", legacy: true },
  "r3-partner": { group: "זוגיות / משפחה", desc: "שאלת שיתוף פעולה ישנה (מוזגה ל-r3-conflict)", input: "gate", legacy: true },

  "a-types": { group: "התמכרויות", desc: "בחירת סוגי התמכרות: חומרים / משחקים / פורנוגרפיה-מין / הימורים / טלפון", input: "choice", items: 1, sensitive: true },
  "a-substances": { group: "התמכרויות", desc: "צ'קליסט 11 קריטריונים לשימוש בחומרים (DSM)", input: "checklist", items: 11, heavy: true, sensitive: true },
  "a-gaming": { group: "התמכרויות", desc: "צ'קליסט 9 פריטים על התמכרות למשחקים", input: "checklist", items: 9, heavy: true },
  "a-porn-type": { group: "התמכרויות", desc: "בחירה: הקושי בפורנוגרפיה או במין", input: "choice", items: 1, sensitive: true },
  "a-porn-q": { group: "התמכרויות", desc: "סולמות 1-7 על צריכת פורנוגרפיה", input: "scales", items: 18, heavy: true, sensitive: true },
  "a-sex-q": { group: "התמכרויות", desc: "צ'קליסט SAST: 9 היגדים אינטימיים מאוד על התנהגות מינית (כולל פריט על חוקיות)", input: "checklist", items: 9, heavy: true, sensitive: true },
  "a-gambling": { group: "התמכרויות", desc: "צ'קליסט 9 פריטים על הימורים", input: "checklist", items: 9, heavy: true },
  "a-phone": { group: "התמכרויות", desc: "סולמות 1-6 על שימוש בטלפון/רשתות", input: "scales", items: 10 },

  scoring: { group: "סיום", desc: "מסך עיבוד אוטומטי ('מעבד תשובות...') - המשתמש לא נדרש לכלום; נטישה כאן מרמזת על תקלה טכנית או זמן עיבוד ארוך", input: "system" },
  results: { group: "אחרי השאלון", desc: "עמוד התוצאות וההמלצות (אחרי השלמת השאלון)", input: "system" },
  "match-form": { group: "אחרי השאלון", desc: "טופס העדפות התאמה: אזור, אונליין, מגדר מטפל, שפה", input: "form" },
  "match-results": { group: "אחרי השאלון", desc: "רשימת המטפלים המותאמים", input: "system" },
};

// ── שאלון ילדים (ממולא ע\"י הורה) ────────────────────────────────────────────

export const KIDS_STEP_INFO: Record<string, QuizStepInfo> = {
  "p-consent": { group: "פתיחה", desc: "הצהרה משפטית + הסכמה (ההורה הממלא)", input: "gate" },
  "p-demo": { group: "פתיחה", desc: "גיל ומין בלבד (חובה); הכיתה נגזרת מהגיל ונשאלת רק בגילאי 6/7/9/12/14. קוצר מ-9 שדות ב-8/8/26", input: "form", items: 2 },
  "p-areas": { group: "פתיחה", desc: "דירוג תחומי הקושי העיקריים (4-5 תחומים, סולם כלל-לא/מעט/הרבה/הרבה-מאוד; בגילאי 1-2 מוצגים רק שניים - התפתחותי והתנהגותי)", input: "choice", items: 1 },

  "p-q1": { group: "חרדה", desc: "שאלת שער: דאגות/לחצים מתמשכים אצל הילד (כן/לא)", input: "gate" },
  "p-q1-pain": { group: "חרדה", desc: "שאלת שער: כאבים כרוניים (כן/לא); תשובה חיובית פותחת שאלת המשך על שלילת גורם רפואי", input: "gate" },
  "p-aq": { group: "חרדה", desc: "שאלון חרדה: 10 סעיפים בסולם 1-3", input: "scales", items: 10, heavy: true },
  "p-aq-grade": { group: "חרדה", desc: "שאלות משלימות לפי שכבת גיל - מוזג ל-p-traits ב-8/8/26", input: "scales", items: 3, legacy: true },
  "p-q1-ga": { group: "חרדה", desc: "הסכמת הילד לטיפול (גיל רך) - מוזג ל-p-traits ב-8/8/26", input: "gate", items: 1, legacy: true },

  "p-q2": { group: "מצב רוח", desc: "שאלת שער: הילד חש שאינו שווה / אינו מוערך (כן/לא)", input: "gate" },
  "p-q2-grade": { group: "מצב רוח", desc: "שאלות משלימות לפי גיל - מוזג ל-p-traits ב-8/8/26", input: "scales", items: 3, legacy: true },
  "p-q3": { group: "מאניה/דיכאון", desc: "שאלת שער: מצב רוח ירוד או עצוב (כן/לא)", input: "gate" },
  "p-mq": { group: "מאניה/דיכאון", desc: "שאלון מצב רוח: 9 סעיפים", input: "scales", items: 9, heavy: true },
  "p-mq-sui": { group: "מאניה/דיכאון", desc: "שאלה ישירה: האם קיימות מחשבות אובדניות חוזרות אצל הילד", input: "gate", sensitive: true },

  "p-q4": { group: "התמכרות", desc: "שאלת שער: סימני התמכרות לחומרים/התנהגויות (כן/לא)", input: "gate", sensitive: true },
  "p-q4-types": { group: "התמכרות", desc: "בחירת סוגי ההתמכרות", input: "choice", items: 1 },
  "p-q4-s": { group: "התמכרות", desc: "שאלון חומרים: 6 סעיפים", input: "checklist", items: 6, sensitive: true },
  "p-q4-g": { group: "התמכרות", desc: "שאלון משחקי מחשב: 7 סעיפים", input: "checklist", items: 7 },
  "p-q4-b": { group: "התמכרות", desc: "שאלון הימורים: 7 סעיפים", input: "checklist", items: 7 },
  "p-q4-ctrl": { group: "התמכרות", desc: "עד כמה הילד בשליטה על ההתנהגות", input: "scales", items: 1 },

  "p-q5": { group: "OCD", desc: "שאלת שער: מחשבות חוזרות / טקסים (כן/לא)", input: "gate" },
  "p-oq": { group: "OCD", desc: "שאלון OCD: 6 סעיפים", input: "scales", items: 6 },
  "p-oq-grade": { group: "OCD", desc: "מסך טקסט סטטי + שדה שלא נקרא - נמחק 8/8/26", input: "scales", items: 3, legacy: true },

  "p-q6": { group: "טראומה", desc: "שאלת שער: הילד חווה אירוע טראומטי (כן/לא)", input: "gate", sensitive: true },
  "p-tq": { group: "טראומה", desc: "שאלון טראומה: 10 סעיפים", input: "scales", items: 10, heavy: true, sensitive: true },

  "p-q7": { group: "פסיכוזה", desc: "שער חוויות פנימיות חריגות: ראה/שמע דברים שאינם קיימים (כן/לא)", input: "gate", sensitive: true },
  "p-pq": { group: "פסיכוזה", desc: "שאלון הפרעת חשיבה: 3 סעיפים כן/לא. מוצג רק במסלול אמונות-בלבד; דיווח הזיות מדלג עליו", input: "scales", items: 3, sensitive: true },

  "p-q8": { group: "אכילה", desc: "שאלת שער: דפוסי אכילה מדאיגים (כן/לא)", input: "gate" },
  "p-eq": { group: "אכילה", desc: "שאלון אכילה מפורט (2 בלוקים לפי גיל) + גובה ומשקל אופציונליים ל-BMI, שעברו לכאן מהמסך הדמוגרפי", input: "scales", items: 8, sensitive: true },

  "p-q9": { group: "התנהגות/ויסות", desc: "שער: חוסר יציבות ביחסים, קושי בוויסות רגשות ואימפולסיביות (כן/לא)", input: "gate" },
  "p-bq": { group: "התנהגות/ויסות", desc: "שאלון ויסות רגשות ויחסים בינאישיים", input: "scales", items: 7 },
  "p-q9-adhd": { group: "התנהגות/ויסות", desc: "שאלון קשב (ADHD): 6 פריטי קשב + 6 פריטי היפראקטיביות", input: "checklist", items: 12, heavy: true },

  "p-q10": { group: "מצוקה כללית", desc: "קשיים רגשיים אחרים שלא עלו בשאלון (כן/לא)", input: "gate" },
  "p-q10-par": { group: "מצוקה כללית", desc: "האם הקושי קשור לקשר עם אחד ההורים (כן/לא)", input: "gate", sensitive: true },
  "p-q10-grade": { group: "מצוקה כללית", desc: "שאלות משלימות לפי גיל - מוזג ל-p-traits ב-8/8/26", input: "scales", items: 3, legacy: true },

  "p-ga-traits": { group: "התפתחות ותפקוד", desc: "הסכמת הילד ותחומי עניין - מוזג ל-p-traits ב-8/8/26", input: "choice", items: 2, legacy: true },
  "p-acad": { group: "התפתחות ותפקוד", desc: "תפקוד לימודי בגן/בבית הספר - מסך ארוך התלוי בשכבת הגיל", input: "form", items: 8, heavy: true },
  "p-dev-toilet": { group: "התפתחות ותפקוד", desc: "קשיי גמילה / התרוקנות (כן/לא + פירוט)", input: "gate", sensitive: true },
  "p-dev-sensory": { group: "התפתחות ותפקוד", desc: "קשיי ויסות חושי (כן/לא + פירוט)", input: "gate" },
  "p-beh": { group: "התפתחות ותפקוד", desc: "שאלות על קשיים התנהגותיים", input: "scales", items: 3 },
  "p-soc": { group: "התפתחות ותפקוד", desc: "שאלות על קשיים חברתיים: 3 שאלות פתיחה, ולאחריהן בלוק LSAS לפי שכבת הגיל", input: "scales", items: 3 },
  "p-traits": { group: "מאפייני הילד", desc: "צעד מאוחד בסוף השאלון: מוטיבציה לטיפול, ורבליות, יכולת תרגול, תחומי עניין והסכמת הילד - לפי מה שהניקוד באמת קורא עבור הילד הזה", input: "scales", items: 3 },

  "p-result": { group: "תוצאות", desc: "עמוד התוצאות (השלמת השאלון)", input: "system" },
};

/**
 * שלבים שמסמנים שהמשתמש סיים לענות על השאלון - נטישה בהם (או אחריהם)
 * אינה "נשירה מהשאלון". scoring הוא מסך העיבוד שלפני התוצאות.
 */
export const ADULTS_TERMINAL_STEPS = new Set(["scoring", "results", "match-form", "match-results"]);
export const KIDS_TERMINAL_STEPS = new Set(["p-result"]);

export function stepInfo(quiz: "adults" | "kids", step: string): QuizStepInfo {
  const map = quiz === "adults" ? ADULTS_STEP_INFO : KIDS_STEP_INFO;
  return map[step] ?? { group: "לא מזוהה", desc: `שלב ${step} (אין תיאור במפה - ייתכן שנוסף לשאלון ולא עודכן ב-quiz-step-content.ts)`, input: "form" };
}
