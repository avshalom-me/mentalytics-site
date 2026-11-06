import { redirect } from "next/navigation";

// עמוד המורים עבר לענף לימוד חכם (6/11/2026): app/admin/learning. הכתובת
// הישנה נשארת כדי שקישורים ישנים (מיילי ההרשמה לאדמין) ימשיכו לעבוד.
export default function AdminTeachersRedirect() {
  redirect("/admin/learning");
}
