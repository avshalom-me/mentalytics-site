import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { CITY_TO_REGION, ALL_REGIONS } from "@/app/lib/regions";
import { isParaMedical, isMainListed } from "@/app/lib/therapist-options";
import type { PublicTherapist } from "@/app/therapists/TherapistsClient";

const NEW_THERAPIST_BOOST_DAYS = 7;

// A region/city landing page is only worth indexing once it has real content.
// Below this many listed therapists it's near-empty (and near-duplicate of the
// region/other cities), which Google flags as "thin" - so such pages are set to
// noindex and kept out of the sitemap until they fill up.
export const MIN_LISTED_FOR_INDEX = 3;
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
  age_groups: string[] | null;
  profile_photo_path: string | null;
  status: string | null;
  promotion_source: string | null;
  center_account_id: string | null;
  created_at: string | null;
  accepting_new_patients: boolean | null;
};

function rowInRegion(regions: string[] | null, region: string): boolean {
  return (regions ?? []).some((c) => CITY_TO_REGION[c] === region || c === region);
}

// Directory ranking tier for the client-side per-visit shuffle:
//   0 = paying  - real money on the table (individual "paid" + center-subscription)
//   1 = gift    - manual / trial promotions (comped, no payment)
//   2 = free    - approved, unpaid
//   3 = not accepting new patients - still listed, always last
function tierOf(t: TherapistRow): number {
  if (t.accepting_new_patients === false) return 3;
  if (t.status === "paying" && (t.promotion_source === "paid" || t.promotion_source === "center")) return 0;
  if (t.status === "paying") return 1; // manual / trial gift
  return 2; // approved free
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
    tier: tierOf(t),
    accepting_new_patients: t.accepting_new_patients !== false,
  };
}

// Loads publicly-listed therapists (paying + approved, admin-vetted), ordered
// promoted-first with a new-therapist boost and a daily rotation within each
// tier. The promoted tier is split so PAID promotions (promotion_source="paid")
// rank above GIFT promotions (manual/trial), which in turn rank above the free
// approved tier. An optional filter (region / online) narrows the set BEFORE
// signing photo URLs, so region landing pages only pay for their own subset.
type DirectoryFilter = {
  region?: string;
  city?: string;
  online?: boolean;
  specialty?: string;
  /** Topic filters (see app/lib/topics.ts): union WITHIN each list, AND across fields. */
  trainingAreasAny?: string[];
  ageGroupsAny?: string[];
  category?: "main" | "para";
  centerId?: string;
};

// Shared query + in-memory filtering (no photo signing). Used both by the full
// loader and by the lightweight count helpers below.
async function loadFilteredRows(filter?: DirectoryFilter): Promise<TherapistRow[]> {
  const { data, error } = await supabaseAdmin
    .from("therapists")
    .select(
      `id, full_name, phone, bio, gender, online, therapist_types, training_areas, regions, cultural_prefs, arrangements, age_groups, profile_photo_path, status, promotion_source, center_account_id, created_at, accepting_new_patients`
    )
    .in("status", ["approved", "paying"])
    .eq("admin_approved", true)
    .neq("entity_type", "center") // ישות-מרכז מופיעה רק בהתאמות החידון, לא במאגר/עמודים הציבוריים
    .order("full_name", { ascending: true });

  if (error || !data) return [];

  let rows = data as TherapistRow[];
  // A center's public page wants exactly its therapists - skip the main/para
  // category filter there (a center may include para-medical therapists too).
  if (filter?.centerId) return rows.filter((t) => t.center_account_id === filter.centerId);
  // Default to the "main" directory (exclude para-only therapists); the
  // para-medical rubric explicitly asks for "para".
  const category = filter?.category ?? "main";
  rows = rows.filter((t) =>
    category === "para" ? isParaMedical(t.therapist_types) : isMainListed(t.therapist_types)
  );
  if (filter?.online) rows = rows.filter((t) => t.online === true);
  if (filter?.region) rows = rows.filter((t) => rowInRegion(t.regions, filter.region!));
  if (filter?.city) rows = rows.filter((t) => (t.regions ?? []).includes(filter.city!));
  if (filter?.specialty) rows = rows.filter((t) => (t.training_areas ?? []).includes(filter.specialty!));
  if (filter?.trainingAreasAny?.length) {
    rows = rows.filter((t) => filter.trainingAreasAny!.some((a) => (t.training_areas ?? []).includes(a)));
  }
  if (filter?.ageGroupsAny?.length) {
    rows = rows.filter((t) => filter.ageGroupsAny!.some((a) => (t.age_groups ?? []).includes(a)));
  }
  return rows;
}

// Count listed therapists matching a filter - no photo signing, for deciding
// whether a landing page is populated enough to index.
export async function countListed(filter?: DirectoryFilter): Promise<number> {
  return (await loadFilteredRows(filter)).length;
}

// One-query counts for every region, city and specialty string, so the sitemap
// can decide which landing pages to include without 30+ round-trips.
export async function countListedByRegionAndCity(): Promise<{
  regions: Record<string, number>;
  cities: Record<string, number>;
  specialties: Record<string, number>;
}> {
  const rows = await loadFilteredRows();
  const regions: Record<string, number> = {};
  const cities: Record<string, number> = {};
  const specialties: Record<string, number> = {};
  for (const t of rows) {
    for (const region of ALL_REGIONS) {
      if (rowInRegion(t.regions, region)) regions[region] = (regions[region] ?? 0) + 1;
    }
    for (const c of t.regions ?? []) cities[c] = (cities[c] ?? 0) + 1;
    for (const a of t.training_areas ?? []) specialties[a] = (specialties[a] ?? 0) + 1;
  }
  return { regions, cities, specialties };
}

export async function loadPublicTherapists(
  filter?: DirectoryFilter
): Promise<PublicTherapist[]> {
  const allRows = await loadFilteredRows(filter);

  // Therapists not accepting new patients stay listed but always sort last -
  // no point showcasing someone patients can't currently reach.
  const unavailable = allRows.filter((t) => t.accepting_new_patients === false);
  const rows = allRows.filter((t) => t.accepting_new_patients !== false);

  const boostCutoff = Date.now() - NEW_THERAPIST_BOOST_DAYS * 24 * 60 * 60 * 1000;
  const isNew = (t: TherapistRow) =>
    t.created_at != null && new Date(t.created_at).getTime() >= boostCutoff;

  // Promoted = status "paying". Tiers, highest first:
  //   paid   - individual full-price subscribers (promotion_source="paid")
  //   center - promoted via their center's subscription (promotion_source="center")
  //   gift   - manual/trial gift promotions
  //   free   - approved, unpaid
  // Center therapists rank as a distinct promoted tier (a paid-plan benefit:
  // "all center therapists appear at the top of their region"), above gift
  // promotions and above the free tier. The new-therapist boost is preserved
  // WITHIN each class.
  const isPaid = (t: TherapistRow) => t.status === "paying" && t.promotion_source === "paid";
  const isCenter = (t: TherapistRow) => t.status === "paying" && t.promotion_source === "center";
  const isGift = (t: TherapistRow) =>
    t.status === "paying" && t.promotion_source !== "paid" && t.promotion_source !== "center";

  const paidNew = rows.filter((t) => isPaid(t) && isNew(t));
  const paidOld = rows.filter((t) => isPaid(t) && !isNew(t));
  const centerNew = rows.filter((t) => isCenter(t) && isNew(t));
  const centerOld = rows.filter((t) => isCenter(t) && !isNew(t));
  const giftNew = rows.filter((t) => isGift(t) && isNew(t));
  const giftOld = rows.filter((t) => isGift(t) && !isNew(t));
  const approvedNew = rows.filter((t) => t.status !== "paying" && isNew(t));
  const approvedOld = rows.filter((t) => t.status !== "paying" && !isNew(t));

  const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  const rotate = <T,>(arr: T[]): T[] => {
    if (arr.length === 0) return arr;
    const offset = dayIndex % arr.length;
    return [...arr.slice(offset), ...arr.slice(0, offset)];
  };

  const ordered = [
    ...rotate(paidNew),
    ...rotate(paidOld),
    ...rotate(centerNew),
    ...rotate(centerOld),
    ...rotate(giftNew),
    ...rotate(giftOld),
    ...rotate(approvedNew),
    ...approvedOld,
    ...rotate(unavailable),
  ];
  return Promise.all(ordered.map(signRow));
}
