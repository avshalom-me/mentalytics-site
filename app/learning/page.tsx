import { redirect } from "next/navigation";

// אין עמוד שער למענה הלימודי - הכניסה היחידה למורים היא טופס ההצטרפות.
export default function LearningIndex() {
  redirect("/learning/join");
}
