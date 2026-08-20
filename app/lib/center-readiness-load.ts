import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import { missingProfileFields } from "./profile-completeness";
import {
  centerReadiness,
  type CenterReadiness,
  type CenterRowForReadiness,
  type CenterTherapistStats,
} from "./center-readiness";

// שליפה אחת שמרכיבה את מצב המוכנות של כל המרכזים הפעילים. משותפת לשלושה
// צרכנים - סוכן השימור, קרון הנדנודים ועמוד המרכזים באדמין - כדי שכולם
// יראו בדיוק את אותו מספר. מדד שמחושב בשלושה מקומות מתפצל תוך שבוע.

export type CenterWithReadiness = {
  id: string;
  name: string;
  email: string | null;
  payerEmail: string | null;
  token: string | null;
  hasAccount: boolean;
  paidAt: string | null;
  monthlyValue: number;
  readiness: CenterReadiness;
};

// טיפוס מקומי לשורה שנשלפת. בלעדיו הלקוח המוקלד לא מצליח להסיק את הצורה
// משרשור המחרוזות של רשימת העמודות, וכל שדה מקבל GenericStringError.
type CenterRow = CenterRowForReadiness & {
  id: string;
  name: string | null;
  email: string | null;
  payer_email: string | null;
  user_id: string | null;
  token: string | null;
  paid_at: string | null;
  price_per_therapist: number | string | null;
  fixed_monthly_price: number | string | null;
};

const CENTER_COLUMNS =
  "id, name, status, email, payer_email, user_id, token, paid_at, billing_track, therapist_count, " +
  "price_per_therapist, fixed_monthly_price, public_page_enabled, logo_path, public_description, " +
  "team_members, gallery, public_director, public_founded_year, public_team_size, public_address, " +
  "public_hours, public_faq";

export async function loadCentersWithReadiness(): Promise<CenterWithReadiness[]> {
  const { data: centers, error } = await supabaseAdmin
    .from("therapy_center_accounts")
    .select(CENTER_COLUMNS)
    .eq("status", "active");
  if (error) throw new Error(`טעינת המרכזים נכשלה: ${error.message}`);
  const rows = (centers ?? []) as unknown as CenterRow[];
  if (rows.length === 0) return [];

  const ids = rows.map((c) => c.id);

  const [therapistsRes, invitesRes] = await Promise.all([
    supabaseAdmin
      .from("therapists")
      .select(
        "id, center_account_id, entity_type, status, admin_approved, full_name, profile_photo_path, " +
          "regions, therapist_types, training_areas, age_groups, languages, bio"
      )
      .in("center_account_id", ids),
    supabaseAdmin
      .from("center_therapist_invites")
      .select("center_account_id, used_at")
      .in("center_account_id", ids)
      .is("used_at", null),
  ]);

  type TherapistRow = {
    id: string;
    center_account_id: string | null;
    entity_type: string | null;
    status: string | null;
    admin_approved: boolean | null;
    full_name: string | null;
    profile_photo_path: string | null;
    regions: string[] | null;
    therapist_types: string[] | null;
    training_areas: string[] | null;
    age_groups: string[] | null;
    languages: string[] | null;
    bio: string | null;
  };
  const allTherapists = (therapistsRes.data ?? []) as unknown as TherapistRow[];

  // התעודה יושבת בטבלה נפרדת (therapist_certificates) והיא אחד מפריטי
  // השלמות של פרופיל מטפל - בלעדיה הפרופיל לא עובר אישור.
  const realIds = allTherapists.filter((t) => t.entity_type !== "center").map((t) => t.id);
  const certIds = new Set<string>();
  if (realIds.length > 0) {
    const { data: certs } = await supabaseAdmin
      .from("therapist_certificates")
      .select("therapist_id")
      .in("therapist_id", realIds);
    for (const c of certs ?? []) certIds.add(c.therapist_id as string);
  }

  const openInvitesByCenter = new Map<string, number>();
  for (const i of invitesRes.data ?? []) {
    const k = i.center_account_id as string;
    openInvitesByCenter.set(k, (openInvitesByCenter.get(k) ?? 0) + 1);
  }

  return rows.map((c) => {
    const centerId = c.id;
    const mine = allTherapists.filter((t) => t.center_account_id === centerId);
    const entityRow = mine.find((t) => t.entity_type === "center") ?? null;
    const realTherapists = mine.filter((t) => t.entity_type !== "center");

    const stats: CenterTherapistStats = {
      linked: realTherapists.length,
      promoted: realTherapists.filter((t) => t.status === "paying").length,
      awaitingOurApproval: realTherapists.filter((t) => !t.admin_approved && t.status !== "paying").length,
      incompleteProfiles: realTherapists.filter(
        (t) =>
          missingProfileFields(
            {
              full_name: t.full_name ?? "",
              profile_photo_path: t.profile_photo_path,
              regions: t.regions,
              therapist_types: t.therapist_types,
              training_areas: t.training_areas,
            },
            certIds.has(t.id)
          ).length > 0
      ).length,
      openInvites: openInvitesByCenter.get(centerId) ?? 0,
    };

    const readiness = centerReadiness(
      c,
      stats,
      entityRow
        ? {
            therapist_types: entityRow.therapist_types,
            training_areas: entityRow.training_areas,
            regions: entityRow.regions,
            age_groups: entityRow.age_groups,
            languages: entityRow.languages,
            bio: entityRow.bio,
          }
        : null
    );

    const perT = Number(c.price_per_therapist) || 0;
    const count = Number(c.therapist_count) || 0;
    const monthlyValue =
      c.billing_track === "center_entity" ? Number(c.fixed_monthly_price) || 0 : perT * count;

    return {
      id: centerId,
      name: c.name ?? "מרכז ללא שם",
      email: c.email,
      payerEmail: c.payer_email,
      token: c.token,
      hasAccount: !!c.user_id,
      paidAt: c.paid_at,
      monthlyValue,
      readiness,
    };
  });
}
