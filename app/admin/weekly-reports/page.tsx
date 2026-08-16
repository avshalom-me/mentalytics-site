import { redirect } from "next/navigation";

// הדוח השבועי אוחד עם החודשי לעמוד אחד (/admin/reports) - שני העמודים היו
// זהים ב-97%. הכתובת הישנה נשארת חיה כהפניה, לפי עקרון "כתובות לא נשברות".
export default function WeeklyReportsRedirect() {
  redirect("/admin/reports?type=weekly");
}
