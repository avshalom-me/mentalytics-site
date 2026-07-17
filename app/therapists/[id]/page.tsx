import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { genderTitle, genderTitles } from "@/app/lib/gender-text";
import { therapistPath, therapistSlug, extractTherapistId } from "@/app/lib/therapist-url";
import ContactButtons from "./ContactButtons";
import TrackView from "./TrackView";
import ProfileBackLink from "./ProfileBackLink";

const BUCKET = process.env.SUPABASE_THERAPIST_FILES_BUCKET || "therapist-certificates";
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
};

async function getTherapist(id: string): Promise<{ therapist: TherapistRow; photoUrl: string | null } | null> {
  const { data, error } = await supabaseAdmin
    .from("therapists")
    .select(`
      id, full_name, bio, gender, online,
      therapist_types, training_areas, assessment_types,
      regions, cultural_prefs, arrangements, languages, age_groups,
      phone, email, profile_photo_path, education, experience
    `)
    .eq("id", id)
    .in("status", ["approved", "paying"])
    .eq("admin_approved", true)
    .single();

  if (error || !data) return null;

  let photoUrl: string | null = null;
  if (data.profile_photo_path) {
    const { data: signed } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(data.profile_photo_path, 60 * 60 * 24);
    if (signed?.signedUrl) photoUrl = signed.signedUrl;
  }

  return { therapist: data as TherapistRow, photoUrl };
}

type ArticleLink = { slug: string; title: string; summary: string; topic: string | null };

async function getTherapistArticles(id: string): Promise<ArticleLink[]> {
  const { data } = await supabaseAdmin
    .from("therapist_articles")
    .select("slug, title, summary, topic")
    .eq("therapist_id", id)
    .eq("status", "approved")
    // House/editorial pieces (author_name set) are backed by a therapist_id for
    // integrity but are NOT the therapist's own work — keep them off the profile.
    .is("author_name", null)
    .order("approved_at", { ascending: false })
    .limit(20);
  return (data ?? []) as ArticleLink[];
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id: param } = await params;
  const id = extractTherapistId(param);
  if (!id) return { title: "מטפל לא נמצא" };
  const result = await getTherapist(id);
  if (!result) return { title: "מטפל לא נמצא" };

  const { therapist } = result;
  const name = therapist.full_name ?? "מטפל";
  const type = genderTitle(therapist.therapist_types?.[0] ?? "מטפל נפשי", therapist.gender);
  const bioSnippet = therapist.bio ? therapist.bio.slice(0, 140) : "";
  const canonical = `${BASE_URL}${therapistPath(id, therapist.full_name)}`;

  return {
    title: `${name} - ${type} | טיפול חכם`,
    description: bioSnippet || `פרופיל של ${name}, ${type}. מצאו מטפל מתאים בטיפול חכם.`,
    alternates: { canonical },
    openGraph: {
      title: `${name} - ${type}`,
      description: bioSnippet,
      url: canonical,
    },
  };
}


export default async function TherapistProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; r?: string; i?: string; a?: string; g?: string; s?: string }>;
}) {
  const { id: param } = await params;
  const sp = await searchParams;
  const id = extractTherapistId(param);
  if (!id) notFound();
  const source: "match" | "directory" = sp.from === "match" ? "match" : "directory";
  const viewerContext = source === "match" ? {
    region: sp.r,
    issue: sp.i,
    age_band: sp.a,
    gender: sp.g,
    match_score: sp.s ? Number(sp.s) : undefined,
  } : undefined;
  const result = await getTherapist(id);
  if (!result) notFound();

  // Canonicalize the URL: redirect bare-UUID / mismatched slugs to the
  // name-slug URL (308), keeping query params so match attribution survives.
  const canonicalSeg = therapistSlug(id, result.therapist.full_name);
  let decodedParam = param;
  try { decodedParam = decodeURIComponent(param); } catch { /* keep raw */ }
  if (decodedParam !== canonicalSeg) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v) qs.set(k, v);
    const query = qs.toString();
    // Encode the (Hebrew) slug — a redirect Location header must be ASCII.
    permanentRedirect(`/therapists/${encodeURIComponent(canonicalSeg)}${query ? `?${query}` : ""}`);
  }

  const articles = await getTherapistArticles(id);
  const { therapist: t, photoUrl } = result;
  const name = t.full_name ?? "מטפל";
  const type = genderTitle(t.therapist_types?.[0] ?? "", t.gender);
  const avatarSrc = t.gender === "נקבה" ? "/avatar-female.svg" : "/avatar-male.svg";
  const waLink = t.phone
    ? `https://wa.me/972${t.phone.replace(/^0/, "").replace(/[-\s]/g, "")}?text=${encodeURIComponent('שלום, הגעתי אלייך דרך אתר "טיפול חכם", אשמח לשמוע פרטים לגבי הטיפול')}`
    : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": name,
    "description": t.bio ?? undefined,
    "jobTitle": type || undefined,
    "url": `${BASE_URL}/therapists/${id}`,
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
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');
        details summary { list-style: none; }
        details summary::-webkit-details-marker { display: none; }
        details[open] .chevron { transform: rotate(180deg); }
        .chevron { transition: transform 0.2s; }
      `}</style>

      <ProfileBackLink source={source} fallbackHref={source === "match" ? (sp.a === "child" ? "/kids" : "/adults") : "/therapists"} />

      {/* Hero — warm teal band, large photo + identity + contact */}
      <div className="rounded-3xl mb-8 p-6 sm:p-8" style={{ background: "var(--teal-pale)", border: "1px solid var(--teal-mid)" }}>
        <div className="flex flex-col sm:flex-row gap-6 items-start">

          {/* Photo — larger, framed */}
          <div className="w-full sm:w-56 flex-shrink-0 mx-auto sm:mx-0" style={{ maxWidth: "240px" }}>
            <div className="rounded-2xl overflow-hidden bg-white w-full aspect-[3/4]"
              style={{ border: "3px solid #fff", boxShadow: "0 6px 22px rgba(42,100,98,.22)" }}>
              <img src={photoUrl ?? avatarSrc} alt={name} className="w-full h-full object-cover object-top" style={{ display: "block" }} />
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

            {quickFacts.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {quickFacts.map((f, i) => (
                  <span key={i} className="rounded-full bg-white px-3.5 py-1.5 text-[13px] font-semibold"
                    style={{ border: "1px solid var(--line)", color: "var(--text-2)" }}>{f}</span>
                ))}
              </div>
            )}

            <ContactButtons
              therapistId={id}
              therapistName={t.full_name ?? ""}
              waLink={waLink}
              phone={t.phone}
              source={source}
              mobileSticky
            />
          </div>

        </div>
      </div>

      {/* Body — two columns on desktop */}
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

        {/* Side column — professional details card */}
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
