import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import TherapistsClient, { type PublicTherapist } from "./TherapistsClient";

export const revalidate = 60;

type TherapistRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  bio: string | null;
  gender: string | null;
  online: boolean | null;
  therapist_types: string[] | null;
  training_areas: string[] | null;
  regions: string[] | null;
  cultural_prefs: string[] | null;
  arrangements: string[] | null;
  profile_photo_path: string | null;
  status: string | null;
  created_at: string | null;
};

const NEW_THERAPIST_BOOST_DAYS = 7;

const PROFILE_PHOTOS_BUCKET =
  process.env.SUPABASE_THERAPIST_FILES_BUCKET || "therapist-certificates";

async function loadTherapists(): Promise<PublicTherapist[]> {
  const { data, error } = await supabaseAdmin
    .from("therapists")
    .select(
      `
      id,
      full_name,
      email,
      phone,
      bio,
      gender,
      online,
      therapist_types,
      training_areas,
      regions,
      cultural_prefs,
      arrangements,
      profile_photo_path,
      status,
      created_at
      `
    )
    .in("status", ["approved", "paying"])
    .order("full_name", { ascending: true });

  if (error || !data) return [];

  const rows = data as TherapistRow[];

  const boostCutoff = Date.now() - NEW_THERAPIST_BOOST_DAYS * 24 * 60 * 60 * 1000;
  const isNew = (t: TherapistRow) =>
    t.created_at != null && new Date(t.created_at).getTime() >= boostCutoff;

  const payingNew = rows.filter((t) => t.status === "paying" && isNew(t));
  const payingOld = rows.filter((t) => t.status === "paying" && !isNew(t));
  const approvedNew = rows.filter((t) => t.status !== "paying" && isNew(t));
  const approvedOld = rows.filter((t) => t.status !== "paying" && !isNew(t));

  // Daily rotation within each tier so impressions are distributed fairly.
  // revalidate=60 keeps the order stable within a day; offset changes per UTC day.
  const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  const rotate = <T,>(arr: T[]): T[] => {
    if (arr.length === 0) return arr;
    const offset = dayIndex % arr.length;
    return [...arr.slice(offset), ...arr.slice(0, offset)];
  };

  const ordered = [
    ...rotate(payingNew),
    ...rotate(payingOld),
    ...rotate(approvedNew),
    ...approvedOld,
  ];

  return Promise.all(
    ordered.map(async (t) => {
      let profile_photo_url: string | null = null;

      if (t.profile_photo_path) {
        const { data: signedData, error: signedError } = await supabaseAdmin.storage
          .from(PROFILE_PHOTOS_BUCKET)
          .createSignedUrl(t.profile_photo_path, 60 * 60 * 24);

        if (!signedError && signedData?.signedUrl) {
          profile_photo_url = signedData.signedUrl;
        }
      }

      return {
        id: t.id,
        full_name: t.full_name ?? "",
        email: t.email ?? "",
        phone: t.phone ?? "",
        bio: t.bio ?? "",
        gender: t.gender ?? "",
        online: t.online ?? false,
        therapist_types: t.therapist_types ?? [],
        training_areas: t.training_areas ?? [],
        regions: t.regions ?? [],
        cultural_prefs: t.cultural_prefs ?? [],
        arrangements: t.arrangements ?? [],
        profile_photo_path: t.profile_photo_path ?? null,
        profile_photo_url,
      };
    })
  );
}

export default async function TherapistsPage() {
  const therapists = await loadTherapists();
  return <TherapistsClient therapists={therapists} />;
}
