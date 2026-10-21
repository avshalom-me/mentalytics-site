import { redirect } from "next/navigation";

// הכניסה לפורטל נפתחת בלוח הצינור.
export default function PartnerHome() {
  redirect("/partner/schools/pipeline");
}
