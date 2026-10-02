// ערוצי גיוס המורים - הרשימה שעמוד האדמין מציג, עם קישור הצטרפות מתויג לכל
// ערוץ. המורה שנרשם/ת דרך הקישור נשמר/ת עם utm_campaign של הערוץ, וכך רואים
// מאיפה הגיעו ההרשמות בלי כלי נוסף.
//
// מקור הרשימה: בירור 2/10/2026. אין רישוי ממלכתי להוראה מתקנת, ולכן מי
// שמחזיק/ה בהכשרה הם בוגרי תוכניות התעודה במכללות ורשתות המורים שלהלן.
// כל האינדקסים הכלליים של מורים פרטיים נותנים רישום חינם, ולכן הפנייה היא
// לגופים המכשירים ולרשתות המקצועיות, לא לאינדקסים.
//
// בלי דיוור קר: פנייה במייל למורים שלא ביקשו אותה כפופה לסעיף 30א לחוק
// התקשורת. הקישורים כאן מיועדים לפנייה אישית לרכזי התוכניות ולמנהלי הקהילות,
// שמעבירים אותם הלאה מרצונם.

export type RecruitmentChannel = {
  key: string;
  kind: "college" | "network" | "community";
  name: string;
  note: string;
  url: string | null;
};

export const TEACHER_RECRUITMENT_CHANNELS: RecruitmentChannel[] = [
  { key: "levinsky", kind: "college", name: "לוינסקי-וינגייט (קמפוס לוינסקי)", note: "לימודי תעודה בהוראה מתקנת", url: "https://www.levinsky.ac.il/program/%D7%9C%D7%99%D7%9E%D7%95%D7%93%D7%99-%D7%AA%D7%A2%D7%95%D7%93%D7%94-%D7%95%D7%A4%D7%99%D7%AA%D7%95%D7%97-%D7%9E%D7%A7%D7%A6%D7%95%D7%A2%D7%99/%D7%94%D7%95%D7%A8%D7%90%D7%94-%D7%9E%D7%AA%D7%A7%D7%A0%D7%AA/" },
  { key: "wingate", kind: "college", name: "המכללה האקדמית בוינגייט", note: "לימודי הוראה מתקנת", url: "https://www.wincol.ac.il/center/diploma/counseling-guidance-treatment/remedial-teaching/" },
  { key: "dyellin", kind: "college", name: "דוד ילין", note: "הוראה מותאמת (מתקנת) - קריאה, כתיבה, חשבון ואסטרטגיות למידה", url: "https://www.dyellin.ac.il/continuing_studies/corrective_teaching" },
  { key: "kaye", kind: "college", name: "מכללת קיי, באר שבע", note: "קורס מורה מומחה בהוראה מותאמת", url: "https://kaye.ac.il/%D7%A7%D7%95%D7%A8%D7%A1-%D7%9E%D7%95%D7%A8%D7%94-%D7%9E%D7%95%D7%9E%D7%97%D7%94-%D7%91%D7%94%D7%95%D7%A8%D7%90%D7%94-%D7%9E%D7%95%D7%AA%D7%90%D7%9E%D7%AA/" },
  { key: "achva", kind: "college", name: "מכללת אחוה", note: "הוראה מותאמת (מתקנת) בחשבון", url: "https://www.achva.ac.il/%D7%94%D7%95%D7%A8%D7%90%D7%94-%D7%9E%D7%95%D7%AA%D7%90%D7%9E%D7%AA-%D7%9E%D7%AA%D7%A7%D7%A0%D7%AA-%D7%91%D7%97%D7%A9%D7%91%D7%95%D7%9F-%D7%AA%D7%A9%D7%A4%D7%92" },
  { key: "biu", kind: "college", name: "בר-אילן, היחידה לפיתוח מקצועי", note: "הכשרת מומחים להוראה מתקנת ופיתוח כשרי למידה, כיתות א-ו", url: "https://www.pmbiu.co.il/course/%D7%94%D7%9B%D7%A9%D7%A8%D7%AA-%D7%9E%D7%95%D7%9E%D7%97%D7%99%D7%9D-%D7%9C%D7%94%D7%95%D7%A8%D7%90%D7%94-%D7%9E%D7%AA%D7%A7%D7%A0%D7%AA-%D7%95%D7%A4%D7%99%D7%AA%D7%95%D7%97-%D7%9B%D7%A9%D7%A8/" },
  { key: "colleges-other", kind: "college", name: "מכללות נוספות: בית ברל, אורנים, הרצוג", note: "תוכניות תעודה בהוראה מתקנת; לאתר את רכז/ת התוכנית", url: null },
  { key: "etz", kind: "network", name: "עץ החשיבה", note: "רשת של מורים להוראה מותאמת, מסודרת לפי אזורים", url: "https://lomdiml.co.il/%D7%90%D7%99%D7%AA%D7%95%D7%A8-%D7%9E%D7%95%D7%A8%D7%99%D7%9D-%D7%9C%D7%94%D7%95%D7%A8%D7%90%D7%94-%D7%9E%D7%95%D7%AA%D7%90%D7%9E%D7%AA/" },
  { key: "nitzan", kind: "network", name: "אגודת ניצן", note: "38 סניפים; הוראה מתקנת ואסטרטגיות למידה", url: "https://nitzan-israel.org.il/" },
  { key: "egdal", kind: "community", name: 'אגד"ל - האגודה הישראלית של מומחים ללקויות למידה', note: "ארגון מקצועי של מומחי לקויות למידה", url: "https://www.facebook.com/egdal.org" },
  { key: "achiya", kind: "community", name: "אחיה ידע", note: "לוח דרושים ומאגר מחפשי עבודה בחינוך, במגזר החרדי", url: "https://achiyayeda.org/drushim/" },
  { key: "referral", kind: "community", name: "חבר מביא חבר", note: "מורה רשום/ה שמעביר/ה את הקישור לעמיתים", url: null },
];

export const teacherCampaign = (channelKey: string) => `teachers-${channelKey}`;

/** קישור ההצטרפות המתויג של הערוץ. */
export function teacherJoinUrl(channel: Pick<RecruitmentChannel, "key" | "kind">, site: string): string {
  const q = new URLSearchParams({ utm_source: channel.kind, utm_medium: "referral", utm_campaign: teacherCampaign(channel.key) });
  return `${site}/learning/join?${q.toString()}`;
}
