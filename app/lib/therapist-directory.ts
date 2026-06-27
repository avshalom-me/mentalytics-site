import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { CITY_TO_REGION } from "@/app/lib/regions";
import { isParaMedical, isMainListed } from "@/app/lib/therapist-options";
import type { PublicTherapist } from "@/app/therapists/TherapistsClient";

const NEW_THERAPIST_BOOST_DAYS = 7;
const PROFILE_PHOTOS_BUCKET =
  process.env.SUPABASE_THERAPIST_FILES_BUCKET || "therapist-certificates";

type TherapistRow = {
  id: string;
  full_name: string | null;
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

function rowInRegion(regions: string[] | null, region: string): boolean {
  return (regions ?? []).some((c) => CITY_TO_REGION[c] === region || c === region);
}

async function signRow(t: TherapistRow): Promise<PublicTherapist> {
  let profile_photo_url: string | null = null;
  if (t.profile_photo_path) {
    const { data: signed, error: signedError } = await supabaseAdmin.storage
      .from(PROFILE_PHOTOS_BUCKET)
      .createSignedUrl(t.profile_photo_path, 60 * 60 * 24);
    if (!signedError && signed?.signedUrl) profile_photo_url = signed.signedUrl;
  }
  return {
    id: t.id,
    full_name: t.full_name ?? "",
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
}

// Loads publicly-listed therapists (paying + approved, admin-vetted), ordered
// promoted-first with a new-therapist boost and a daily rotation within each
// tier. An optional filter (region / online) narrows the set BEFORE signing
// photo URLs, so region landing pages only pay for their own subset.
export async function loadPublicTherapists(
  filter?: { region?: string; online?: boolean; category?: "main" | "para" }
): Promise<PublicTherapist[]> {
  const { data, error } = await supabaseAdmin
    .from("therapists")
    .select(
      `id, full_name, phone, bio, gender, online, therapist_types, training_areas, regions, cultural_prefs, arrangements, profile_photo_path, status, created_at`
    )
    .in("status", ["approved", "paying"])
    .eq("admin_approved", true)
    .order("full_name", { ascending: true });

  if (error || !data) return [];

  let rows = data as TherapistRow[];
  // Default to the "main" directory (exclude para-only therapists); the
  // para-medical rubric explicitly asks for "para".
  const category = filter?.category ?? "main";
  rows = rows.filter((t) =>
    category === "para" ? isParaMedical(t.therapist_types) : isMainListed(t.therapist_types)
  );
  if (filter?.online) rows = rows.filter((t) => t.online === true);
  if (filter?.region) rows = rows.filter((t) => rowInRegion(t.regions, filter.region!));

  const boostCutoff = Date.now() - NEW_THERAPIST_BOOST_DAYS * 24 * 60 * 60 * 1000;
  const isNew = (t: TherapistRow) =>
    t.created_at != null && new Date(t.created_at).getTime() >= boostCutoff;

  const payingNew = rows.filter((t) => t.status === "paying" && isNew(t));
  const payingOld = rows.filter((t) => t.status === "paying" && !isNew(t));
  const approvedNew = rows.filter((t) => t.status !== "paying" && isNew(t));
  const approvedOld = rows.filter((t) => t.status !== "paying" && !isNew(t));

  const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  const rotate = <T,>(arr: T[]): T[] => {
    if (arr.length === 0) return arr;
    const offset = dayIndex % arr.length;
    return [...arr.slice(offset), ...arr.slice(0, offset)];
  };

  const ordered = [...rotate(payingNew), ...rotate(payingOld), ...rotate(approvedNew), ...approvedOld];
  return Promise.all(ordered.map(signRow));
}
