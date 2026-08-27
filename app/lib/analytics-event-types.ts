// רשימת סוגי האירועים הקנונית של analytics_events - מקור אמת אחד בקוד.
// חייבת להתאים ל-CHECK constraint בבסיס הנתונים (המיגרציה האחרונה שעדכנה
// אותו: 20260813_quiz_treatments_event.sql). אירוע חדש = להוסיף כאן + מיגרציה
// שמרחיבה את ה-constraint; שומר הלילה משווה את הרשימה הזו מול ה-DB כל לילה,
// כך שהוספה כאן בלי מיגרציה נתפסת תוך יום (הדריפט שכבר "בלע" אירועים פעמיים).
//
// isomorphic בכוונה (בלי server-only): גם ראוט הטראקינג וגם שומר הלילה
// צורכים אותה.

export const ANALYTICS_EVENT_TYPES = [
  "page_view",
  "profile_impression",
  "filter_used",
  "quiz_step",
  "quiz_complete",
  "quiz_treatments",
  "recommendation_explain_click",
  "match_free_fallback",
  "recruit_page_view",
  "therapist_explain_click",
  "matching_click",
  // שליחת החיפוש בפועל (matching_click = הטופס נפתח). נושא את האזור שנבחר,
  // שאינו קיים בשום אירוע אחר. מיגרציה: 20260819_match_search_event.sql
  "match_search",
  // כמה אפשרויות הוחזרו בפועל - האות שמבדיל "יש מטפלים באזור" מ"היו
  // אפשרויות על המסך". מיגרציה: 20260827_match_results_event.sql
  "match_results",
  "match_saved",
  // אירועי עמוד-מרכז (מיגרציה: 20260820_center_page_events.sql). מסלול 1
  // בלי שורת ישות - אלה המדדים היחידים של העמוד שלו; במסלול 2 הם נוספים
  // על therapist_profile_views של הישות (תנועת עמוד מול צפיות התאמה).
  "center_page_view",
  "center_website_click",
  "center_contact_click",
] as const;

// תת-הקבוצה שמותרת דרך /api/track (הלקוח). שני הנותרים נכתבים רק בצד
// השרת: recommendation_explain_click ב-track-explain, match_free_fallback
// במנוע ההתאמה.
export const CLIENT_ANALYTICS_EVENT_TYPES = ANALYTICS_EVENT_TYPES.filter(
  (e) => e !== "recommendation_explain_click" && e !== "match_free_fallback"
);
