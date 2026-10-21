import { redirect } from "next/navigation";

// הכניסה לפורטל נפתחת במבט העל.
export default function PartnerHome() {
  redirect("/partner/schools/overview");
}
