import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { GUEST_ARTICLES_BY_THERAPIST } from "@/app/lib/article-taxonomy";
import { CITY_TO_REGION, CITY_SEO_LIST, regionToSlug, ONLINE_SLUG } from "@/app/lib/regions";
import { TRAINING_AREAS } from "@/app/lib/therapist-options";
import { specialtyToSlug } from "@/app/lib/specialties";
import { genderTitle, genderTitles, publicTherapistTitle } from "@/app/lib/gender-text";
import { therapistPath, therapistSlug, extractTherapistId } from "@/app/lib/therapist-url";
import ContactButtons from "./ContactButtons";
import TrackView from "./TrackView";
import ProfileBackLink from "./ProfileBackLink";
import { waLinkFor, telHref } from "@/app/lib/phone";
import { siteAuthorProfileFields } from "@/app/lib/author";

const BASE_URL = "https://www.mentalytics.co.il";

type TherapistRow = {
  id: string;
  full_name: string | null;
  bio: string | null;
  gender: string | null;
  online: boolean | null;
  therapist_types: string[] | null;
  training_areas: string[] | null;
  assessment_types: string[] | null;
  regions: string[] | null;
  cultural_prefs: string[] | null;
  arrangements: string[] | null;
  languages: string[] | null;
  age_groups: string[] | null;
  phone: string | null;
  email: string | null;
  profile_photo_path: string | null;
  education: string | null;
  experience: string | null;
  license_number: string | null;
  publication_links: string[] | null;
  accepting_new_patients: boolean | null;
  center_account_id: string | null;
};

/**
 * המרכז שהמטפל/ת שייך/ת אליו - רק כשהעמוד הציבורי שלו חי (אותם תנאים
 * שאוכף getPublicCenterBySlug), אחרת הקישור היה מוביל ל-404.
 */
async function getAffiliatedCenter(
  centerId: string | null
): Promise<{ name: string; slug: string; phone: string | null } | null> {
  if (!centerId) return null;
  const { data } = await supabaseAdmin
    .from("therapy_center_accounts")
    .select("name, slug, phone, public_phone")
    .eq("id", centerId)
    .eq("status", "active")
    .not("slug", "is", null)
    .or("public_page_enabled.eq.true,billing_track.eq.center_entity")
    .maybeSingle();
  if (!data) return null;
  // הטלפון הציבורי לפני הטלפון התפעולי: הראשון נבחר להצגה למטופלים,
  // השני עלול להיות הקו האישי של מי שחתם על המנוי.
  const clean = (v: unknown): string | null => {
    const x = typeof v === "string" ? v.trim() : "";
    return x.length > 0 ? x : null;
  };
  return {
    name: data.name as string,
    slug: data.slug as string,
    phone: clean(data.public_phone) ?? clean(data.phone),
  };
}

async function getTherapist(id: string): Promise<TherapistRow | null> {
  const { data, error } = await supabaseAdmin
    .from("therapists")
    .select(`
      id, full_name, bio, gender, online,
      therapist_types, training_areas, assessment_types,
      regions, cultural_prefs, arrangements, languages, age_groups,
      phone, email, profile_photo_path, education, experience,
      license_number, publication_links,
      accepting_new_patients, center_account_id
    `)
    .eq("id", id)
    .in("status", ["approved", "paying"])
    .eq("admin_approved", true)
    .neq("entity_type", "center") // עמוד ישות-מרכז אינו פרופיל מטפל ציבורי (404)
    .single();

  if (error || !data) return null;
  // Photos are served via the stable /therapist-photo/<id> route (indexable),
  // so no signed URL is generated here.
  return data as TherapistRow;
}

type SimilarTherapist = {
  id: string;
  full_name: string | null;
  gender: string | null;
  therapist_types: string[] | null;
  regions: string[] | null;
  profile_photo_path: string | null;
  status: string | null;
  /** נדרש לכלל התואר הציבורי - בלעדיו הכרטיס הזה היה היחיד בעמוד שמציג
   *  "מטפלת בהבעה ויצירה" בזמן שהכותרת למעלה אומרת "פסיכותרפיסטית". */
  age_groups: string[] | null;
};

// Alternatives shown on an unavailable therapist's profile: same professional
// type, overlapping region (city-level or region-level), currently accepting.
// Paying therapists first, then up to `limit` total.
async function getSimilarTherapists(t: TherapistRow, limit = 3): Promise<SimilarTherapist[]> {
  const types = (t.therapist_types ?? []).filter(Boolean);
  const regionSet = new Set(
    (t.regions ?? []).map((c) => CITY_TO_REGION[c] ?? c)
  );
  if (types.length === 0 || regionSet.size === 0) return [];

  const { data } = await supabaseAdmin
    .from("therapists")
    .select("id, full_name, gender, therapist_types, regions, profile_photo_path, status, accepting_new_patients, age_groups")
    .in("status", ["approved", "paying"])
    .eq("admin_approved", true)
    .eq("accepting_new_patients", true)
    .neq("entity_type", "center")
    .neq("id", t.id)
    .overlaps("therapist_types", types);

  const candidates = ((data ?? []) as (SimilarTherapist & { accepting_new_patients: boolean | null })[])
    .filter((c) => (c.regions ?? []).some((city) => regionSet.has(CITY_TO_REGION[city] ?? city)));
  candidates.sort((a, b) => (a.status === "paying" ? 0 : 1) - (b.status === "paying" ? 0 : 1));
  return candidates.slice(0, limit);
}

type ArticleLink = { slug: string; title: string; summary: string; topic: string | null };

async function getTherapistArticles(id: string): Promise<ArticleLink[]> {
  const { data } = await supabaseAdmin
    .from("therapist_articles")
    .select("slug, title, summary, topic")
    .eq("therapist_id", id)
    .eq("status", "approved")
    // House/editorial pieces (author_name set) are backed by a therapist_id for
    // integrity but are NOT the therapist's own work - keep them off the profile.
    .is("author_name", null)
    .order("approved_at", { ascending: false })
    .limit(20);
  return (data ?? []) as ArticleLink[];
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id: param } = await params;
  const id = extractTherapistId(param);
  if (!id) return { title: "מטפל לא נמצא" };
  const therapist = await getTherapist(id);
  if (!therapist) return { title: "מטפל לא נמצא" };

  const name = therapist.full_name ?? "מטפל";
  const type = publicTherapistTitle(
    therapist.therapist_types?.[0] ?? "מטפל נפשי",
    therapist.gender,
    therapist.age_groups
  );
  const bioSnippet = therapist.bio ? therapist.bio.slice(0, 140) : "";
  const canonical = `${BASE_URL}${therapistPath(id, therapist.full_name)}`;
  // Stable, crawlable photo URL (see app/therapist-photo/[id]/route.ts). Gives
  // the profile an indexable og:image instead of an expiring signed URL.
  const ogImage = therapist.profile_photo_path ? `${BASE_URL}/therapist-photo/${id}` : `${BASE_URL}/logo.svg.png`;

  return {
    title: `${name} - ${type} | טיפול חכם`,
    description: bioSnippet || `פרופיל של ${name}, ${type}. מצאו מטפל מתאים בטיפול חכם.`,
    alternates: { canonical },
    openGraph: {
      title: `${name} - ${type}`,
      description: bioSnippet,
      url: canonical,
      images: [{ url: ogImage, alt: name }],
    },
    twitter: {
      card: therapist.profile_photo_path ? "summary_large_image" : "summary",
      title: `${name} - ${type}`,
      description: bioSnippet,
      images: [ogImage],
    },
  };
}


export default async function TherapistProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; r?: string; i?: string; a?: string; g?: string; s?: string; t?: string; sy?: string; ret?: string }>;
}) {
  const { id: param } = await params;
  const sp = await searchParams;
  const id = extractTherapistId(param);
  if (!id) notFound();
  const source: "match" | "directory" = sp.from === "match" ? "match" : "directory";
  // Where "back to the list" returns for a directory visitor: the listing page
  // they came from (region / city / online / center), passed as ?ret=. Only
  // internal listing paths are honoured - never an arbitrary/attacker URL.
  const directoryBack =
    typeof sp.ret === "string" && /^\/(therapists|centers)\/[^/]/.test(sp.ret) && !sp.ret.startsWith("//")
      ? sp.ret
      : "/therapists";
  const viewerContext = source === "match" ? {
    region: sp.r,
    issue: sp.i,
    age_band: sp.a,
    gender: sp.g,
    match_score: sp.s ? Number(sp.s) : undefined,
    treatment: sp.t,
    symptom: sp.sy,
  } : undefined;
  const therapistRow = await getTherapist(id);
  if (!therapistRow) notFound();

  // Canonicalize the URL: redirect bare-UUID / mismatched slugs to the
  // name-slug URL (308), keeping query params so match attribution survives.
  const canonicalSeg = therapistSlug(id, therapistRow.full_name);
  let decodedParam = param;
  try { decodedParam = decodeURIComponent(param); } catch { /* keep raw */ }
  if (decodedParam !== canonicalSeg) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v) qs.set(k, v);
    const query = qs.toString();
    // Encode the (Hebrew) slug - a redirect Location header must be ASCII.
    permanentRedirect(`/therapists/${encodeURIComponent(canonicalSeg)}${query ? `?${query}` : ""}`);
  }

  const unavailable = therapistRow.accepting_new_patients === false;
  const [articles, similar, affiliatedCenter] = await Promise.all([
    getTherapistArticles(id),
    unavailable ? getSimilarTherapists(therapistRow) : Promise.resolve([]),
    getAffiliatedCenter(therapistRow.center_account_id),
  ]);
  const t = therapistRow;
  const name = t.full_name ?? "מטפל";
  // הכותרת, ה-H1 ו-jobTitle בסכמה. שורת "הכשרה" בגוף העמוד נשארת על
  // genderTitles ומציגה את ההסמכה כלשונה - זו כל הנקודה של ההפרדה.
  const type = publicTherapistTitle(t.therapist_types?.[0] ?? "", t.gender, t.age_groups);
  const avatarSrc = t.gender === "נקבה" ? "/avatar-female.svg" : "/avatar-male.svg";
  // Stable public photo URL (indexable) - replaces the 24h signed URL for both
  // display and structured data. Falls back to the gender avatar when no photo.
  const photoSrc = t.profile_photo_path ? `${BASE_URL}/therapist-photo/${id}` : avatarSrc;
  // Validated: a `phone` holding something that is not a number (one paying
  // therapist has an email address there) yields null, so the button is hidden
  // rather than linking to wa.me/972ZJOURY@GMAIL.COM.
  // מטפל/ת של מרכז בלי קו אישי: הקו של המרכז הוא דרך הקשר המהירה, והוא
  // מסומן ככזה בכפתורים. בלי הנפילה הזו הפרופיל נשאר בלי אף כפתור מהיר -
  // רק טופס הודעה - וזה מה שקרה לשמעון ערנרייך, מקודם ומשולם, עד 21/8/2026.
  const ownPhone = (t.phone ?? "").trim();
  const centerPhone = ownPhone ? null : affiliatedCenter?.phone ?? null;
  const contactPhone = ownPhone || centerPhone;
  const waLink = waLinkFor(contactPhone);
  const telLink = telHref(contactPhone);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    // Stable entity id. Articles elsewhere on the site reference this exact @id
    // as their author (see app/lib/author.ts), which is what tells Google the
    // byline and this profile are one person rather than a coincidence of name.
    "@id": `${BASE_URL}${therapistPath(id, t.full_name)}#person`,
    "name": name,
    // Latin-script name + alma mater, for the one profile we hold them for.
    ...siteAuthorProfileFields(id),
    "description": t.bio ?? undefined,
    "jobTitle": type || undefined,
    "image": t.profile_photo_path ? `${BASE_URL}/therapist-photo/${id}` : undefined,
    // Must match alternates.canonical (the name-slug path). The bare-UUID form
    // used to be emitted here, which 308-redirects - so the structured data
    // pointed at a URL that is not the canonical one.
    "url": `${BASE_URL}${therapistPath(id, t.full_name)}`,
    "worksFor": { "@type": "Organization", "name": "טיפול חכם", "url": BASE_URL },
  };

  const hasDetails =
    (t.therapist_types?.length ?? 0) > 0 ||
    (t.assessment_types?.length ?? 0) > 0 ||
    (t.regions?.length ?? 0) > 0 ||
    (t.languages?.length ?? 0) > 0 ||
    (t.cultural_prefs?.length ?? 0) > 0 ||
    (t.arrangements?.length ?? 0) > 0;
  const hasSpecialties =
    (t.training_areas?.length ?? 0) > 0 ||
    (t.age_groups?.length ?? 0) > 0;

  // Compact "quick facts" chips surfaced in the hero.
  const quickFacts: string[] = [];
  if (t.regions && t.regions.length > 0) quickFacts.push(`📍 ${t.regions.slice(0, 2).join(", ")}`);
  if (t.languages && t.languages.length > 0) quickFacts.push(`🗣 ${t.languages.join(", ")}`);
  if (t.online) quickFacts.push("🌐 גם אונליין");
  if (t.age_groups && t.age_groups.length > 0) quickFacts.push(`👤 ${t.age_groups.slice(0, 2).join(", ")}`);

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 pb-28 sm:pb-12" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <TrackView therapistId={id} source={source} context={viewerContext} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <style>{`
        details summary { list-style: none; }
        details summary::-webkit-details-marker { display: none; }
        details[open] .chevron { transform: rotate(180deg); }
        .chevron { transition: transform 0.2s; }
      `}</style>

      <ProfileBackLink source={source} fallbackHref={source === "match" ? (sp.a === "child" ? "/kids" : "/adults") : directoryBack} />

      {/* Hero - warm teal band, large photo + identity + contact */}
      <div className="rounded-3xl mb-8 p-6 sm:p-8" style={{ background: "var(--teal-pale)", border: "1px solid var(--teal-mid)" }}>
        <div className="flex flex-col sm:flex-row gap-6 items-start">

          {/* Photo - larger, framed */}
          <div className="w-full sm:w-56 flex-shrink-0 mx-auto sm:mx-0" style={{ maxWidth: "240px" }}>
            <div className="rounded-2xl overflow-hidden bg-white w-full aspect-[3/4]"
              style={{ border: "3px solid #fff", boxShadow: "0 6px 22px rgba(42,100,98,.22)" }}>
              <img src={photoSrc} alt={name} className="w-full h-full object-cover object-top" style={{ display: "block" }} />
            </div>
          </div>

          {/* Identity + contact */}
          <div className="flex-1 min-w-0 w-full">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 style={{ fontSize: "clamp(2rem,5vw,2.75rem)", fontWeight: 900, color: "var(--text)", letterSpacing: "-.02em", lineHeight: 1.1, margin: 0 }}>{name}</h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[13px] font-bold"
                style={{ border: "1px solid var(--teal)", color: "var(--teal-dark)" }}>✓ מאומת</span>
            </div>
            {type && <p className="mt-1.5" style={{ fontSize: "clamp(1.05rem,2.5vw,1.35rem)", fontWeight: 700, color: "var(--gold-dark)" }}>{type}</p>}
            {/* שיוך למרכז - שער דו-כיווני: מעמוד המרכז מגיעים למטפל/ת, ומכאן
                חזרה למרכז ולשאר הצוות. מוצג רק כשלמרכז יש עמוד ציבורי חי. */}
            {affiliatedCenter && (
              <p className="mt-2.5">
                <Link href={`/centers/${affiliatedCenter.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-[13.5px] font-bold transition hover:bg-[var(--teal-pale)]"
                  style={{ border: "1px solid var(--line)", color: "var(--teal-dark)" }}>
                  <span aria-hidden>🏢</span> מצוות {affiliatedCenter.name}
                </Link>
              </p>
            )}

            {quickFacts.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {quickFacts.map((f, i) => (
                  <span key={i} className="rounded-full bg-white px-3.5 py-1.5 text-[13px] font-semibold"
                    style={{ border: "1px solid var(--line)", color: "var(--text-2)" }}>{f}</span>
                ))}
              </div>
            )}

            {unavailable ? (
              <div className="mt-6 rounded-2xl bg-white p-4 sm:p-5" style={{ border: "1.5px solid var(--gold)" }}>
                <p className="font-extrabold text-stone-900">
                  🕐 {name} {t.gender === "נקבה" ? "אינה זמינה" : "אינו זמין"} כרגע לקבלת מטופלים / אבחונים חדשים
                </p>
                <p className="mt-1 text-sm text-stone-600 leading-6">
                  אפשר להתרשם מהפרופיל, אך לא ניתן לשלוח פנייה חדשה בשלב זה. כדי למצוא מטפל/ת פנוי/ה שמתאים/ה לכם:
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href="/adults" className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-extrabold text-white hover:opacity-90" style={{ background: "var(--teal)" }}>
                    🎯 שאלון התאמה למבוגרים
                  </Link>
                  <Link href="/kids" className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-extrabold hover:bg-[#EAF4F3]" style={{ border: "1.5px solid var(--teal)", color: "var(--teal-dark)", background: "white" }}>
                    שאלון לילדים ונוער
                  </Link>
                  <Link href="/therapists" className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-extrabold hover:bg-stone-50" style={{ border: "1px solid var(--line)", color: "var(--text-2)", background: "white" }}>
                    לכל המטפלים במאגר
                  </Link>
                </div>
              </div>
            ) : (
              <ContactButtons
                therapistId={id}
                therapistName={t.full_name ?? ""}
                waLink={waLink}
                telLink={telLink}
                source={source}
                mobileSticky
                viaCenterName={centerPhone ? affiliatedCenter?.name ?? null : null}
              />
            )}
          </div>

        </div>
      </div>

      {/* Unavailable therapist → offer available colleagues of the same type + area */}
      {unavailable && similar.length > 0 && (
        <section className="mb-10">
          <SectionTitle>מטפלים מאותו תחום ואזור שזמינים כעת</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((s) => (
              <Link key={s.id} href={therapistPath(s.id, s.full_name)}
                className="flex items-center gap-4 rounded-2xl bg-white p-4 transition hover:shadow-md"
                style={{ border: "1px solid var(--line)" }}>
                <img
                  src={s.profile_photo_path ? `/therapist-photo/${s.id}` : (s.gender === "נקבה" ? "/avatar-female.svg" : "/avatar-male.svg")}
                  alt={s.full_name ?? ""}
                  className="h-16 w-16 rounded-full object-cover object-top flex-shrink-0"
                  style={{ border: "2px solid var(--teal-mid)" }}
                  loading="lazy"
                />
                <div className="min-w-0">
                  <div className="font-extrabold text-stone-900 truncate">{s.full_name}</div>
                  {s.therapist_types?.[0] && (
                    <div className="text-sm font-semibold" style={{ color: "var(--teal)" }}>
                      {publicTherapistTitle(s.therapist_types[0], s.gender, s.age_groups)}
                    </div>
                  )}
                  {(s.regions?.length ?? 0) > 0 && (
                    <div className="text-xs text-stone-500 truncate">📍 {s.regions!.slice(0, 2).join(", ")}</div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Body - two columns on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">

        {/* Main column */}
        <div className="lg:col-span-2 space-y-8">

          {t.bio && (
            <section>
              <SectionTitle>כמה מילים עליי</SectionTitle>
              <p className="text-stone-700 whitespace-pre-line" style={{ fontSize: "19px", lineHeight: 1.9 }}>{t.bio}</p>
            </section>
          )}

          {hasSpecialties && (
            <section className="space-y-5">
              {t.training_areas && t.training_areas.length > 0 && (
                <div>
                  <SectionTitle>תחומי טיפול</SectionTitle>
                  <div className="flex flex-wrap gap-2.5">
                    {t.training_areas.map((area, i) => (
                      <span key={i} className="rounded-full px-4 py-2 text-[15px] font-semibold"
                        style={{ background: "var(--teal-pale)", border: "1px solid var(--teal-mid)", color: "var(--teal-dark)" }}>{area}</span>
                    ))}
                  </div>
                </div>
              )}
              {t.age_groups && t.age_groups.length > 0 && (
                <div>
                  <SectionTitle>גיל מטופלים</SectionTitle>
                  <div className="flex flex-wrap gap-2.5">
                    {t.age_groups.map((g, i) => (
                      <span key={i} className="rounded-full px-4 py-2 text-[15px] font-semibold"
                        style={{ background: "var(--gold-pale)", border: "1px solid #f0e0b8", color: "var(--gold-dark)" }}>{g}</span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {t.education && (
            <Accordion title="השכלה והכשרה">
              <p className="text-[15px] leading-8 text-stone-700 whitespace-pre-line">{t.education}</p>
            </Accordion>
          )}

          {t.experience && (
            <Accordion title="ניסיון מקצועי">
              <p className="text-[15px] leading-8 text-stone-700 whitespace-pre-line">{t.experience}</p>
            </Accordion>
          )}

          {/* Verifiable credentials. Worded as self-declared, because the site
              does not check the number against the registry - it just makes the
              claim checkable by anyone who wants to. */}
          {t.license_number && (
            <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-5 py-4">
              <p className="text-sm font-bold text-stone-800">מספר רישום בפנקס</p>
              <p className="mt-1 text-[15px] text-stone-700" dir="ltr" style={{ textAlign: "start" }}>
                {t.license_number}
              </p>
              <p className="mt-1 text-xs text-stone-500">
                כפי שנמסר על ידי המטפל/ת. ניתן לאמת מול הפנקס הציבורי של משרד הבריאות.
              </p>
            </section>
          )}

          {(t.publication_links?.length ?? 0) > 0 && (
            <Accordion title="פרסומים מקצועיים">
              <ul className="list-none space-y-2 p-0">
                {t.publication_links!.map((u) => {
                  let host = u;
                  try { host = new URL(u).hostname.replace(/^www\./, ""); } catch { /* show raw */ }
                  return (
                    <li key={u}>
                      <a
                        href={u}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[15px] font-semibold hover:underline"
                        style={{ color: "var(--teal-dark)" }}
                        dir="ltr"
                      >
                        {host}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </Accordion>
          )}

          {/* Guest articles this therapist wrote that live as editorial pages
              (not therapist_articles rows) - see GUEST_ARTICLES_BY_THERAPIST. */}
          {(GUEST_ARTICLES_BY_THERAPIST[id] ?? []).length > 0 && (
            <section>
              <SectionTitle>מאמרים מאת {name}</SectionTitle>
              <div className="space-y-3">
                {(GUEST_ARTICLES_BY_THERAPIST[id] ?? []).map((art) => (
                  <Link key={art.href} href={art.href}
                    className="block rounded-2xl border border-[#E8E0D8] bg-white p-4 transition hover:shadow-md">
                    <h3 className="font-bold text-stone-900 text-[15px]">{art.title}</h3>
                    <p className="mt-1 text-sm text-stone-500 leading-6">{art.desc}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Articles written by / attributed to this therapist */}
          {articles.length > 0 && (
            <section>
              <SectionTitle>מאמרים מאת {name}</SectionTitle>
              <div className="space-y-3">
                {articles.map((art) => (
                  <Link key={art.slug} href={`/research/community/${art.slug}`}
                    className="block rounded-2xl border border-[#E8E0D8] bg-white p-4 transition hover:shadow-md">
                    {art.topic && <div className="text-xs font-bold text-[#2e7d8c] mb-1">{art.topic}</div>}
                    <h3 className="font-bold text-stone-900 text-[15px]">{art.title}</h3>
                    {art.summary && <p className="mt-1 text-sm text-stone-500 leading-6 line-clamp-2">{art.summary}</p>}
                  </Link>
                ))}
              </div>
            </section>
          )}

        </div>

        {/* Side column - professional details card */}
        {hasDetails && (
          <aside className="lg:sticky lg:top-6 self-start">
            <div className="rounded-2xl bg-white p-5 sm:p-6" style={{ border: "1px solid var(--line)", boxShadow: "0 2px 14px rgba(61,140,138,.06)" }}>
              <h2 className="text-base font-extrabold text-stone-900 mb-3">פרטים מקצועיים</h2>
              <div>
                {t.therapist_types && t.therapist_types.length > 0 && <DetailRow label="הכשרה" value={genderTitles(t.therapist_types, t.gender).join(", ")} />}
                {t.assessment_types && t.assessment_types.length > 0 && <DetailRow label="אבחונים" value={t.assessment_types.join(", ")} />}
                {t.regions && t.regions.length > 0 && <DetailRow label="אזורי פעילות" value={t.regions.join(", ")} />}
                {t.languages && t.languages.length > 0 && <DetailRow label="שפות טיפול" value={t.languages.join(", ")} />}
                {t.cultural_prefs && t.cultural_prefs.length > 0 && <DetailRow label="העדפות תרבותיות" value={t.cultural_prefs.join(", ")} />}
                {t.arrangements && t.arrangements.length > 0 && <DetailRow label="הסדרים" value={t.arrangements.join(", ")} />}
              </div>
            </div>
          </aside>
        )}

      </div>

      {/* Internal linking (SEO M5): therapist profiles are the site's
          strongest-ranking pages (name searches) - flow that equity to the
          city / specialty / online landing pages with descriptive anchors. */}
      {(() => {
        const cityLinks = (t.regions ?? []).filter((c: string) => (CITY_SEO_LIST as readonly string[]).includes(c)).slice(0, 3);
        // Cities cap at 3 (only one live profile has more, so nothing is lost).
        // Specialties cap higher: at 3, the "first three areas" rule silently
        // dropped 304 internal links across 115 profiles - and it hit hardest
        // exactly where we least want it. טיפול זוגי is our largest demand
        // cluster (8,480 searches/month, Keyword Planner 8/8/26) and had 28
        // therapists but only 5 rendered links; טיפול באומנות had 15 and zero.
        // Profiles are the site's strongest-ranking pages, so this is the
        // cheapest equity we own.
        const AREA_LINK_CAP = 8;
        const allAreas = (t.training_areas ?? []).filter((a: string) => (TRAINING_AREAS as readonly string[]).includes(a));
        const areaLinks = allAreas.slice(0, AREA_LINK_CAP);
        if (cityLinks.length === 0 && areaLinks.length === 0 && !t.online) return null;
        return (
          <div className="mx-auto mt-10 max-w-5xl border-t border-[var(--line)] pt-6">
            <h2 className="text-sm font-extrabold text-stone-500 mb-3">עוד בטיפול חכם</h2>
            <div className="flex flex-wrap gap-2">
              {cityLinks.map((c: string) => (
                <Link key={c} href={`/therapists/city/${regionToSlug(c)}`} className="rounded-full px-3.5 py-1.5 text-sm font-semibold hover:bg-[var(--teal-pale)]"
                  style={{ border: "1px solid var(--line)", color: "var(--text-2)" }}>פסיכולוגים ומטפלים ב{c}</Link>
              ))}
              {areaLinks.map((a: string) => (
                <Link key={a} href={`/therapists/specialty/${specialtyToSlug(a)}`} className="rounded-full px-3.5 py-1.5 text-sm font-semibold hover:bg-[var(--teal-pale)]"
                  style={{ border: "1px solid var(--line)", color: "var(--text-2)" }}>מטפלי {a}</Link>
              ))}
              {t.online && (
                <Link href={`/therapists/region/${ONLINE_SLUG}`} className="rounded-full px-3.5 py-1.5 text-sm font-semibold hover:bg-[var(--teal-pale)]"
                  style={{ border: "1px solid var(--line)", color: "var(--text-2)" }}>🌐 מטפלים אונליין</Link>
              )}
            </div>
          </div>
        );
      })()}

    </main>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 text-xl sm:text-2xl font-extrabold text-stone-900"
      style={{ borderInlineStart: "4px solid var(--gold)", paddingInlineStart: "12px" }}>
      {children}
    </h2>
  );
}

function Accordion({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="rounded-2xl border border-[#E8E0D8] bg-white overflow-hidden group">
      <summary className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer select-none hover:bg-stone-50 transition-colors">
        <span className="font-extrabold text-stone-900 text-base">{title}</span>
        <span className="chevron text-stone-400 text-lg leading-none flex-shrink-0">▾</span>
      </summary>
      <div className="px-5 pb-5 pt-2 border-t border-[#EAE0D5]">
        {children}
      </div>
    </details>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-2.5 border-b border-stone-100 last:border-0">
      <div className="text-xs font-semibold text-stone-400 mb-0.5">{label}</div>
      <div className="text-sm text-stone-800 leading-relaxed">{value}</div>
    </div>
  );
}
