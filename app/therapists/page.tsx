import TherapistsClient from "./TherapistsClient";
import { loadPublicTherapists } from "@/app/lib/therapist-directory";

export const revalidate = 60;

export default async function TherapistsPage() {
  const therapists = await loadPublicTherapists();
  return <TherapistsClient therapists={therapists} />;
}
