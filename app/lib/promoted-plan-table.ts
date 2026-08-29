// טבלת ההשוואה בין המסלול החינמי למסלול המקודם, כפי שהיא מופיעה בעמוד
// ההרשמה. חולצה לכאן כדי ששני המיילים שמשתמשים בה (הזמנת מאמר והצעת
// הקידום מהסוכן) יציגו בדיוק את אותה רשימה - טבלה שמועתקת מתפצלת עם הזמן,
// והמטפל מקבל שתי הבטחות שונות על אותו מוצר.

function yes(): string {
  return `<td style="text-align:center;padding:11px 8px;border-bottom:1px solid #EAF0EE;color:#2A8C6A;font-weight:800;font-size:16px;">✓</td>`;
}
function no(): string {
  return `<td style="text-align:center;padding:11px 8px;border-bottom:1px solid #EAF0EE;color:#C9D4D2;font-weight:800;font-size:16px;">✗</td>`;
}

// מיוצא: בסיס הידע של סוכן שירות הלקוחות קורא מכאן, כדי שהטיוטות יתארו
// את המסלול מאותה רשימה שהמיילים מציגים. בלי זה המודל שאב את התכולה
// מהציטוט שבשרשור הנכנס - מקור שמתיישן ואינו בשליטתנו.
export const PROMOTED_PLAN_ROWS: { label: string; free: boolean }[] = [
  { label: "דף פרופיל אישי - תמונה, ביוגרפיה ותחומי התמחות", free: true },
  { label: "הופעה בחיפוש לפי אזור או עיר", free: true },
  { label: "הופעה ראשונה בתוצאות החיפוש", free: false },
  { label: "מערכת ההתאמה החכמה - פניות לפי גיל, אזור, שפה וסגנון טיפולי", free: false },
  { label: "דו&quot;ח צפיות, לחיצות ואחוזי המרה", free: false },
  { label: "פילוח הפונים + השוואה לממוצע + סוכן AI אישי", free: false },
];

// footnote - השורה שמתחת לטבלה. משתנה בין המיילים כי התנאים שונים
// (מתנה מלאה מול חודשיים ראשונים ללא תשלום), ולכן היא לא מקובעת כאן.
export function promotedPlanTable(footnote?: string): string {
  const rows = PROMOTED_PLAN_ROWS.map(
    (r) => `
          <tr>
            <td style="padding:11px 8px;border-bottom:1px solid #EAF0EE;">${r.label}</td>
            ${r.free ? yes() : no()}${yes()}
          </tr>`
  ).join("");

  return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 8px;font-size:13.5px;color:#1a4a5c;">
        <thead>
          <tr>
            <th style="text-align:right;padding:10px 8px;border-bottom:2px solid #DDE9E8;font-weight:800;color:#0F5468;">מה מקבלים</th>
            <th style="text-align:center;padding:10px 8px;border-bottom:2px solid #DDE9E8;font-weight:800;color:#6B807E;width:78px;">חינמי</th>
            <th style="text-align:center;padding:10px 8px;border-bottom:2px solid #DDE9E8;font-weight:800;color:#0F5468;width:110px;">מקודם</th>
          </tr>
        </thead>
        <tbody>${rows}
        </tbody>
      </table>${footnote ? `\n      <p style="margin:0 0 4px;font-size:12px;color:#6B807E;">${footnote}</p>` : ""}`;
}
