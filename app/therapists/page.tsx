import TherapistsClient from "./TherapistsClient";
import CityLinks from "@/app/components/CityLinks";
import { loadPublicTherapists } from "@/app/lib/therapist-directory";

export const revalidate = 60;

export default async function TherapistsPage() {
  const therapists = await loadPublicTherapists();
  return (
    <>
      <TherapistsClient therapists={therapists} />
      {/* After the listing, never above it: the directory's region filter is a
          dropdown Google cannot follow, so without this the page linked to no
          city page at all (24/9/2026). */}
      <CityLinks />
    </>
  );
}
