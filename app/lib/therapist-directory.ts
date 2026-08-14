import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { CITY_TO_REGION, ALL_REGIONS, CITY_SEO_LIST, neighborsOf, CITY_POOL_EXCLUDED } from "@/app/lib/regions";
import { isParaMedical, isMainListed } from "@/app/lib/therapist-options";
import type { PublicTherapist } from "@/app/therapists/TherapistsClient";

const NEW_THERAPIST_BOOST_DAYS = 7;

// A region/city landing page is only worth indexing once it has real content.
// Below this many listed therapists it's near-empty (and near-duplicate of the
// region/other cities), which Google flags as "thin" - so such pages are set to
// noindex and kept out of the sitemap until they fill up.
export const MIN_LISTED_FOR_INDEX = 3;
// A small city can also earn indexing on its ADJACENT-city pool: someone in
// גני תקווה genuinely drives 7 minutes to קריית אונו, so a page listing those
// therapists answers the query rather than dodging it. The bar is higher than
// the in-city one (5 vs 3) because pooled supply is a weaker promise, and the
// pool only counts cities in CITY_NEIGHBORS (10-20 min), never a whole region.
export const MIN_POOL_FOR_INDEX = 5;
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
  assessment_types: string[] | null;
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
  /** 'center' = שורת ישות-מרכז (מסלול 2). מוצגת ככרטיס מרכז, לא כמטפל. */
  entity_type: string | null;
  /**
   * כרטיס מרכז מסלול-1: שורה מסונתזת מחשבון המרכז, לא שורה אמיתית בטבלת
   * therapists (למסלול הזה אין ישות - כל מטפל עומד בפני עצמו). מסומנת כדי
   * שתדורג בשכבת "מטפלי מרכז" ולא בשכבת המנויים הפרטיים, ושלא ידווחו עליה
   * חשיפות (ל-analytics_events יש FK ל-therapists - מזהה שאינו קיים שם היה
   * מפיל כל insert בשקט).
   */
  synthetic_center?: boolean;
};

/** slug, שם ולוגו של מרכז - לכרטיס המרכז במאגר ולשיוך על כרטיס מטפל. */
type CenterCard = { slug: string | null; name: string | null; logoUrl: string | null };

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

async function signRow(t: TherapistRow, centerCards?: Map<string, CenterCard>): Promise<PublicTherapist> {
  const isEntity = t.entity_type === "center";
  // גם למטפל בודד - שם ה-slug של המרכז מזינים את השיוך "מצוות X".
  const card = t.center_account_id ? centerCards?.get(t.center_account_id) : undefined;

  let profile_photo_url: string | null = null;
  if (isEntity) {
    // למרכז אין תמונת פרופיל - הלוגו נכנס לחריץ התמונה. בלעדיו הכרטיס היה
    // מקבל אווטאר מגדרי, כלומר פרצוף של אדם על ישות עסקית.
    profile_photo_url = card?.logoUrl ?? null;
  } else if (t.profile_photo_path) {
    const { data: signed, error: signedError } = await supabaseAdmin.storage
      .from(PROFILE_PHOTOS_BUCKET)
      .createSignedUrl(t.profile_photo_path, 60 * 60 * 24);
    if (!signedError && signed?.signedUrl) profile_photo_url = signed.signedUrl;
  }
  return {
    id: t.id,
    full_name: (t.full_name ?? "").trim(),
    // הטלפון בשורת הישות הוא הקו הפנימי של המרכז ואינו לפרסום - אותה הכרעה
    // כמו בכרטיס ההתאמות. הפנייה נעשית מעמוד המרכז.
    phone: isEntity ? "" : t.phone ?? "",
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
    is_center: isEntity,
    // ה-slug משמש לשני דברים: יעד הקישור של כרטיס מרכז, והשיוך הגלוי על כרטיס
    // מטפל ("מצוות X"). בשני המקרים הוא נשלף רק כשלמרכז יש עמוד ציבורי חי.
    center_slug: card?.slug ?? null,
    ...(!isEntity && card?.name ? { center_name: card.name } : {}),
    // כרטיס מסלול-1 מסונתז: אין לו שורת מטפל, ולכן אסור לדווח עליו חשיפה.
    ...(t.synthetic_center ? { trackable: false as const } : {}),
  };
}

/**
 * נתוני המרכז לכל שורה שמשויכת למרכז - גם ישות (הכרטיס עצמו) וגם מטפל בודד
 * (השיוך "מצוות X"). נטענים רק מרכזים שהעמוד הציבורי שלהם חי, באותם תנאים
 * שאוכף getPublicCenterBySlug: אחרת היה נוצר קישור ל-404.
 */
async function loadCenterCards(rows: TherapistRow[]): Promise<Map<string, CenterCard>> {
  const ids = [...new Set(
    rows.filter((t) => t.center_account_id).map((t) => t.center_account_id as string),
  )];
  const map = new Map<string, CenterCard>();
  if (ids.length === 0) return map;

  const { data } = await supabaseAdmin
    .from("therapy_center_accounts")
    .select("id, name, slug, logo_path")
    .in("id", ids)
    .eq("status", "active")
    .not("slug", "is", null)
    .or("public_page_enabled.eq.true,billing_track.eq.center_entity");
  const withLogo = (data ?? []).filter((c) => c.logo_path);
  const signedByPath = new Map<string, string>();
  if (withLogo.length > 0) {
    const paths = withLogo.map((c) => c.logo_path as string);
    const { data: signed } = await supabaseAdmin.storage
      .from(PROFILE_PHOTOS_BUCKET)
      .createSignedUrls(paths, 60 * 60 * 24);
    (signed ?? []).forEach((s, i) => { if (s.signedUrl) signedByPath.set(paths[i], s.signedUrl); });
  }
  for (const c of data ?? []) {
    map.set(c.id as string, {
      slug: (c.slug as string) ?? null,
      name: (c.name as string) ?? null,
      logoUrl: c.logo_path ? signedByPath.get(c.logo_path as string) ?? null : null,
    });
  }
  return map;
}

/**
 * כרטיסי מרכז למסלול 1 (מטפלים בנפרד). למסלול הזה אין שורת ישות ב-therapists,
 * ולכן עד כה המרכז עצמו נעדר לגמרי מהמאגר ומעמודי האזור - רק המטפלים שלו הופיעו,
 * בלי שום דרך להגיע ממנו לעמוד המרכז. כאן נבנית שורה מסונתזת לכל מרכז כזה
 * שהעמוד הציבורי שלו חי ויש לו לפחות מטפל אחד מוצג.
 *
 * האזורים והמקצועות נגזרים מהמטפלים המוצגים של המרכז בלבד - עובדה, לא הצהרה
 * שיווקית של המרכז על עצמו. הדירוג נעשה בשכבת "מטפלי מרכז" (ולא בשכבת המנויים
 * הפרטיים כמו ישות מסלול-2): במסלול 1 המרכז כבר מיוצג ברשימה דרך המטפלים שלו,
 * וכרטיס נוסף מעל מנוי פרטי מלא היה מטה את ההוגנות.
 */
async function loadTrack1CenterRows(): Promise<TherapistRow[]> {
  const { data: centers } = await supabaseAdmin
    .from("therapy_center_accounts")
    .select("id, name, slug, public_description")
    .eq("status", "active")
    .eq("public_page_enabled", true)
    .neq("billing_track", "center_entity")
    .not("slug", "is", null);
  if (!centers || centers.length === 0) return [];

  const { data: members } = await supabaseAdmin
    .from("therapists")
    .select("center_account_id, regions, online, therapist_types")
    .in("center_account_id", centers.map((c) => c.id as string))
    .in("status", ["approved", "paying"])
    .eq("admin_approved", true)
    .neq("entity_type", "center");

  const byCenter = new Map<string, { regions: Set<string>; types: Set<string>; online: boolean; count: number }>();
  for (const m of members ?? []) {
    const key = m.center_account_id as string;
    const agg = byCenter.get(key) ?? { regions: new Set<string>(), types: new Set<string>(), online: false, count: 0 };
    for (const r of (m.regions as string[] | null) ?? []) if (r) agg.regions.add(r);
    for (const t of (m.therapist_types as string[] | null) ?? []) if (t) agg.types.add(t);
    agg.online = agg.online || m.online === true;
    agg.count++;
    byCenter.set(key, agg);
  }

  return centers.flatMap((c) => {
    const agg = byCenter.get(c.id as string);
    // בלי מטפלים מוצגים אין למרכז נוכחות אמיתית במאגר - ולא נגזרים לו אזורים.
    if (!agg || agg.count === 0 || agg.regions.size === 0) return [];
    return [{
      // תחילית "center:" - מזהה שאינו UUID של מטפל, כדי שלא יתנגש ולא ידלוף
      // לשום נתיב שמצפה למזהה מטפל אמיתי. ראו synthetic_center.
      id: `center:${c.id as string}`,
      full_name: (c.name as string) ?? "",
      phone: null,
      bio: (c.public_description as string) ?? null,
      gender: null,
      online: agg.online,
      therapist_types: [...agg.types],
      training_areas: null,
      assessment_types: null,
      regions: [...agg.regions],
      cultural_prefs: null,
      arrangements: null,
      age_groups: null,
      profile_photo_path: null,
      status: "paying",
      promotion_source: "center",
      center_account_id: c.id as string,
      created_at: null,
      accepting_new_patients: true,
      entity_type: "center",
      synthetic_center: true,
    } satisfies TherapistRow];
  });
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
  /** Any of these cities (used for the adjacent-city pool on small-city pages). */
  citiesAny?: string[];
  online?: boolean;
  specialty?: string;
  /** Exact value from ASSESSMENT_TYPES - powers /therapists/assessment/[type]. */
  assessmentType?: string;
  /** Exact value from ARRANGEMENTS - powers /therapists/arrangement/[slug]. */
  arrangement?: string;
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
      `id, full_name, phone, bio, gender, online, therapist_types, training_areas, assessment_types, regions, cultural_prefs, arrangements, age_groups, profile_photo_path, status, promotion_source, center_account_id, created_at, accepting_new_patients, entity_type`
    )
    .in("status", ["approved", "paying"])
    .eq("admin_approved", true)
    // ישות-מרכז (מסלול 2) נכללת במאגר ובעמודי האזור/עיר. עד 12/8/2026 היא
    // הוסננה החוצה והופיעה רק בהתאמות החידון - מרכז ששילם לא נמצא בחיפוש
    // "מטפלים בחיפה". הכרטיס מסומן כמרכז ומקשר ל-/centers/<slug>, כי עמוד
    // המטפל שלה מחזיר 404 במכוון (app/therapists/[id]/page.tsx).
    .order("full_name", { ascending: true });

  if (error || !data) return [];

  let rows = data as TherapistRow[];
  // A center's public page wants exactly its therapists - skip the main/para
  // category filter there (a center may include para-medical therapists too).
  // שורת הישות עצמה מוחרגת: העמוד לא מציג את המרכז כחבר בצוות של עצמו.
  if (filter?.centerId) {
    return rows.filter((t) => t.center_account_id === filter.centerId && t.entity_type !== "center");
  }
  // Default to the "main" directory (exclude para-only therapists); the
  // para-medical rubric explicitly asks for "para".
  const category = filter?.category ?? "main";
  rows = rows.filter((t) =>
    category === "para" ? isParaMedical(t.therapist_types) : isMainListed(t.therapist_types)
  );
  if (filter?.online) rows = rows.filter((t) => t.online === true);
  if (filter?.region) rows = rows.filter((t) => rowInRegion(t.regions, filter.region!));
  if (filter?.city) rows = rows.filter((t) => (t.regions ?? []).includes(filter.city!));
  if (filter?.citiesAny?.length) {
    const wanted = new Set(filter.citiesAny);
    rows = rows.filter((t) => (t.regions ?? []).some((c) => wanted.has(c)));
  }
  if (filter?.specialty) rows = rows.filter((t) => (t.training_areas ?? []).includes(filter.specialty!));
  if (filter?.assessmentType) {
    rows = rows.filter((t) => (t.assessment_types ?? []).includes(filter.assessmentType!));
  }
  if (filter?.arrangement) {
    rows = rows.filter((t) => (t.arrangements ?? []).includes(filter.arrangement!));
  }
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
  /** City + its adjacent cities, counting each therapist ONCE (they overlap heavily). */
  cityPools: Record<string, number>;
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
  // Distinct-therapist pool per city. Summing cities[] would double-count anyone
  // who lists two neighbouring cities, which is common and would inflate every
  // small city over the threshold.
  const cityPools: Record<string, number> = {};
  for (const city of CITY_SEO_LIST) {
    const wanted = new Set([city, ...neighborsOf(city)]);
    cityPools[city] = rows.filter((t) => (t.regions ?? []).some((c) => wanted.has(c))).length;
  }
  return { regions, cities, cityPools, specialties };
}

/**
 * Is this city page worth indexing: real in-city supply, or a real adjacent-city
 * pool. Real in-city supply always wins, including for cities we deliberately
 * keep out of the pooled route (see CITY_POOL_EXCLUDED).
 */
export function cityIsIndexable(city: string, inCity: number, pool: number): boolean {
  if (inCity >= MIN_LISTED_FOR_INDEX) return true;
  return pool >= MIN_POOL_FOR_INDEX && !(city in CITY_POOL_EXCLUDED);
}

/**
 * האם לצרף לתצוגה הזו כרטיסי מרכז של מסלול 1. רק במאגר הכללי ובעמודי
 * אזור/עיר/אונליין - העמודים שבהם השאלה היא "מי נותן טיפול כאן".
 *
 * לא בעמודי גישה/אבחון/הסדר/נושא: לכרטיס המרכז אין הצהרה משלו על גישות
 * טיפול (במסלול 1 המרכז אינו נרשם להתאמות), וגזירה מהמטפלים הייתה מייצרת
 * הבטחה שהמרכז לא נתן. גם לא בעמוד מרכז (centerId) - מרכז אינו חבר בצוות
 * של עצמו, ולא ברשימת הפרה-רפואיים.
 */
function centerCardsAllowed(filter?: DirectoryFilter): boolean {
  if (!filter) return true;
  if (filter.centerId || filter.category === "para") return false;
  return !filter.specialty && !filter.assessmentType && !filter.arrangement
    && !filter.trainingAreasAny?.length && !filter.ageGroupsAny?.length;
}

/** סינון כרטיס מרכז מסלול-1 לפי הכיסוי שנגזר ממטפליו. */
function centerRowMatches(row: TherapistRow, filter?: DirectoryFilter): boolean {
  if (filter?.online && row.online !== true) return false;
  if (filter?.region && !rowInRegion(row.regions, filter.region)) return false;
  if (filter?.city && !(row.regions ?? []).includes(filter.city)) return false;
  if (filter?.citiesAny?.length) {
    const wanted = new Set(filter.citiesAny);
    if (!(row.regions ?? []).some((c) => wanted.has(c))) return false;
  }
  return true;
}

export async function loadPublicTherapists(
  filter?: DirectoryFilter
): Promise<PublicTherapist[]> {
  const [therapistRows, centerRows] = await Promise.all([
    loadFilteredRows(filter),
    centerCardsAllowed(filter) ? loadTrack1CenterRows() : Promise.resolve([]),
  ]);
  // ההזרקה כאן ולא ב-loadFilteredRows במכוון: אותה פונקציה מזינה גם את מוני
  // countListed*, שמהם נגזר שער האינדוקס של עמודי הערים. כרטיס מרכז אינו
  // מטפל, ולא צריך לפתוח עמוד עיר לאינדוקס בזכות עצמו.
  const allRows = [...therapistRows, ...centerRows.filter((r) => centerRowMatches(r, filter))];

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
  // ישות-מרכז נכנסת לקבוצת הרוטציה העליונה יחד עם המנויים הפרטיים, ולא
  // לדרגת "מטפלי מרכז" שמתחתיה: המרכז הוא הלקוח המשלם עצמו (כאן ₪80×3
  // לחודש), וכרטיס אחד מייצג מרפאה שלמה. הדרגה שמתחת נשארת למטפלים בודדים
  // שמקודמים דרך מנוי המרכז - הטבה, לא לקוח.
  // ישות מסלול-2 בלבד. כרטיס מסלול-1 המסונתז נשאר בשכבת "מטפלי מרכז" שמתחת -
  // שם ממילא יושבים המטפלים שלו, ולכן הוא אינו דוחק מנוי פרטי מלא למטה.
  const isEntity = (t: TherapistRow) => t.entity_type === "center" && !t.synthetic_center;
  const isPaid = (t: TherapistRow) =>
    t.status === "paying" && (t.promotion_source === "paid" || isEntity(t));
  const isCenter = (t: TherapistRow) =>
    t.status === "paying" && t.promotion_source === "center" && !isEntity(t);
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
  // ישות-מרכז נופלת מעצמה לדרגת centerNew/centerOld שכבר קיימת כאן (status
  // 'paying' + promotion_source 'center'), כלומר מיד אחרי המנויים הפרטיים
  // ובתוך אותה רוטציה יומית - בדיוק "אחד המקומות הראשונים בתורנות".
  const centerCards = await loadCenterCards(ordered);
  const signed = await Promise.all(ordered.map((t) => signRow(t, centerCards)));
  // בעמוד המרכז עצמו השיוך מיותר: כל כרטיס היה אומר "מצוות X" בזמן שהמבקר
  // כבר נמצא בעמוד של X, וגם מקשר חזרה לעמוד שהוא עומד בו.
  return filter?.centerId
    ? signed.map(({ center_name: _omit, ...rest }) => rest)
    : signed;
}
