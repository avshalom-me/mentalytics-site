import { redirect } from "next/navigation";

// המסך עבר ל-CRM המשותף של ענף בתי הספר ("תיקוני השאלון"), כדי שגם השותפה
// תעבוד עליו. הכתובת הישנה נשארת כהפניה, לקישורים ששמורים אצל מישהו.
export default function SchoolReviewMoved() {
  redirect("/admin/schools/review");
}
