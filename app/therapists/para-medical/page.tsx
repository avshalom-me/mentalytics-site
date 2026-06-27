import type { Metadata } from "next";
import TherapistsClient from "../TherapistsClient";
import { loadPublicTherapists } from "@/app/lib/therapist-directory";

const BASE = "https://www.mentalytics.co.il";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "מטפלים פרה-רפואיים — קלינאות תקשורת, ריפוי בעיסוק, תזונה, פיזיותרפיה | טיפול חכם",
  description:
    "מטפלים פרה-רפואיים מאומתים: קלינאות תקשורת, ריפוי בעיסוק, דיאטנ/ית קליני/ת ופיזיותרפיה — חיפוש לפי אזור ואונליין.",
  alternates: { canonical: `${BASE}/therapists/para-medical` },
};

export default async function ParaMedicalPage() {
  const therapists = await loadPublicTherapists({ category: "para" });
  return <TherapistsClient therapists={therapists} variant="para" />;
}
