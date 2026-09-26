import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { loadPublicTherapists } from "@/app/lib/therapist-directory";
import { therapistPath } from "@/app/lib/therapist-url";
import type { PublicTherapist } from "@/app/therapists/TherapistsClient";
import {
  EN_AGE_GROUPS, EN_ARRANGEMENTS, EN_CULTURAL_PREFS, EN_LANGUAGES, EN_TRAINING_AREAS,
  englishPlaces, englishRegions, englishTitle, toEnglish,
} from "@/app/lib/english-labels";

const ENGLISH = "אנגלית";
const ADULT_AGES = ["מבוגרים", "הגיל השלישי"];
const CHILD_AGES = ["גיל הרך", "ילדים", "נוער"];

/**
 * One card on the English page, already in English. The page never receives a
 * PublicTherapist: that carries the Hebrew bio and every raw Hebrew value, and
 * the English page shows only the name in Hebrew.
 */
export type EnglishCard = {
  id: string;
  /** As written, in Hebrew - the one field that is not translated. */
  name: string;
  isCenter: boolean;
  gender: "f" | "m" | "";
  title: string | null;
  approaches: string[];
  ages: string[];
  /** For the "works with" filter. Both false = unknown (a clinic card), which matches any filter. */
  adults: boolean;
  children: boolean;
  languages: string[];
  places: string[];
  regions: string[];
  online: boolean;
  funding: string[];
  cultural: string[];
  photoUrl: string | null;
  /** Hebrew profile or clinic page. null = a clinic without a live page. */
  href: string | null;
  /** The clinic a therapist belongs to, in Hebrew. */
  centerName: string | null;
  /** Clinic cards: how many of its listed therapists speak English. */
  englishTeam: number | null;
  phone: string;
  centerWhatsapp: string | null;
  centerAccountId: string | null;
  /** false = synthetic clinic card with no therapist row (no impressions, no site message). */
  trackable: boolean;
  accepting: boolean;
  tier: number;
};

/**
 * Who speaks English, from one light query: therapist ids, and per clinic the
 * number of listed therapists on its team who do.
 */
async function loadEnglishSpeakers(): Promise<{ ids: Set<string>; languages: Map<string, string[]>; teams: Map<string, number> }> {
  const { data } = await supabaseAdmin
    .from("therapists")
    .select("id, center_account_id, entity_type, languages")
    .in("status", ["approved", "paying"])
    .eq("admin_approved", true);
  const ids = new Set<string>();
  const languages = new Map<string, string[]>();
  const teams = new Map<string, number>();
  for (const row of data ?? []) {
    const langs = (row.languages as string[] | null) ?? [];
    languages.set(row.id as string, langs);
    if (!langs.includes(ENGLISH)) continue;
    ids.add(row.id as string);
    const center = row.center_account_id as string | null;
    if (center && row.entity_type !== "center") teams.set(center, (teams.get(center) ?? 0) + 1);
  }
  return { ids, languages, teams };
}

/** English first, then the rest in the therapist's own order. */
function englishFirst(labels: string[]): string[] {
  return labels.includes("English") ? ["English", ...labels.filter((l) => l !== "English")] : labels;
}

function toCard(t: PublicTherapist, langs: string[], englishTeam: number | null): EnglishCard {
  const isCenter = t.is_center === true;
  const ages = t.age_groups ?? [];
  return {
    id: t.id,
    name: t.full_name,
    isCenter,
    gender: t.gender === "נקבה" ? "f" : t.gender === "זכר" ? "m" : "",
    title: isCenter ? null : englishTitle(t.therapist_types, ages),
    approaches: toEnglish(t.training_areas, EN_TRAINING_AREAS).slice(0, 3),
    ages: toEnglish(ages, EN_AGE_GROUPS),
    adults: ages.some((a) => ADULT_AGES.includes(a)),
    children: ages.some((a) => CHILD_AGES.includes(a)),
    languages: englishFirst(toEnglish(langs, EN_LANGUAGES)),
    places: englishPlaces(t.regions),
    regions: englishRegions(t.regions),
    online: t.online,
    funding: toEnglish(t.arrangements, EN_ARRANGEMENTS),
    cultural: toEnglish(t.cultural_prefs, EN_CULTURAL_PREFS),
    photoUrl: t.profile_photo_url,
    href: isCenter ? (t.center_slug ? `/centers/${t.center_slug}` : null) : therapistPath(t.id, t.full_name),
    centerName: isCenter ? null : t.center_name ?? null,
    englishTeam,
    phone: t.phone,
    centerWhatsapp: t.center_whatsapp ?? null,
    centerAccountId: t.center_account_id ?? null,
    trackable: t.trackable !== false,
    accepting: t.accepting_new_patients !== false,
    tier: t.tier ?? 1,
  };
}

/**
 * The English page's list: promoted cards only (paid, clinic, clinic team,
 * gift and trial - status "paying"), of therapists who list English, and of
 * clinics that either list English themselves or have an English speaker on
 * the team. Free listings never appear here.
 *
 * Built on loadPublicTherapists, so who counts as listed, which clinics have a
 * live page and how cards are ranked stay exactly what the Hebrew directory
 * shows; a therapist promoted or demoted there moves here on the next
 * revalidation. The main and para-medical lists are both read, because an
 * English-speaking speech or occupational therapist is exactly who many
 * families arriving from abroad are looking for.
 */
export async function loadEnglishDirectory(): Promise<EnglishCard[]> {
  const [main, para, speakers] = await Promise.all([
    loadPublicTherapists(),
    loadPublicTherapists({ category: "para" }),
    loadEnglishSpeakers(),
  ]);

  const seen = new Set<string>();
  const cards: EnglishCard[] = [];
  for (const t of [...main, ...para]) {
    if (seen.has(t.id) || t.free !== false) continue;
    seen.add(t.id);
    if (t.is_center) {
      const team = t.center_account_id ? speakers.teams.get(t.center_account_id) ?? 0 : 0;
      // A track-2 clinic has its own therapists row and languages; a track-1
      // clinic card is synthetic ("center:<id>") and speaks through its team.
      const own = speakers.ids.has(t.id);
      if (!own && team === 0) continue;
      cards.push(toCard(t, speakers.languages.get(t.id) ?? [], team));
    } else if (speakers.ids.has(t.id)) {
      cards.push(toCard(t, speakers.languages.get(t.id) ?? [], null));
    }
  }
  // Tier order across the two lists (stable, so each list keeps its daily
  // rotation); the page reshuffles within each tier on every visit.
  return cards.sort((a, b) => a.tier - b.tier);
}

