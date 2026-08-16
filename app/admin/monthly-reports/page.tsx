import { redirect } from "next/navigation";

// הדוח החודשי אוחד עם השבועי לעמוד אחד (/admin/reports) - שני העמודים היו
// זהים ב-97%. הכתובת הישנה נשארת חיה כהפניה, לפי עקרון "כתובות לא נשברות".
export default function MonthlyReportsRedirect() {
  redirect("/admin/reports?type=monthly");
}
