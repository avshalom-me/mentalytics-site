import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { genderTitle, genderTitles } from "@/app/lib/gender-text";
import ContactButtons from "./ContactButtons";
import TrackView from "./TrackView";

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
    .order("approved_at", { ascending: false })
    .limit(20);
  return (data ?? []) as ArticleLink[];
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const result = await getTherapist(id);
  if (!result) return { title: "מטפל לא נמצא" };

  const { therapist } = result;
  const name = therapist.full_name ?? "מטפל";
  const type = genderTitle(therapist.therapist_types?.[0] ?? "מטפל נפשי", therapist.gender);
  const bioSnippet = therapist.bio ? therapist.bio.slice(0, 140) : "";

  return {
    title: `${name} — ${type} | טיפול חכם`,
    description: bioSnippet || `פרופיל של ${name}, ${type}. מצאו מטפל מתאים בטיפול חכם.`,
    openGraph: {
      title: `${name} — ${type}`,
      description: bioSnippet,
      url: `${BASE_URL}/therapists/${id}`,
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
  const { id } = await params;
  const sp = await searchParams;
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

  return (
    <main className="mx-auto max-w-2xl px-5 py-10 pb-24" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <TrackView therapistId={id} source={source} context={viewerContext} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');
        details summary { list-style: none; }
        details summary::-webkit-details-marker { display: none; }
        details[open] .chevron { transform: rotate(180deg); }
        .chevron { transition: transform 0.2s; }
      `}</style>

      <Link href="/therapists" className="text-sm text-stone-500 hover:underline mb-6 inline-block">← חזרה לכל המטפלים</Link>

      {/* Hero card — photo + identity + contact */}
      <div className="rounded-3xl bg-white mb-8 p-5 sm:p-6" style={{ boxShadow: "0 4px 24px rgba(60,40,20,.10)", border: "1px solid #E8E0D8" }}>
        <div className="flex flex-col sm:flex-row gap-5 items-start">

          {/* Photo — portrait, no forced crop */}
          <div className="w-full sm:w-44 flex-shrink-0">
            <div className="rounded-2xl overflow-hidden bg-stone-100 w-full sm:aspect-[3/4]" style={{ maxHeight: "260px" }}>
              <img
                src={photoUrl ?? avatarSrc}
                alt={name}
                className="w-full h-full object-cover object-top"
                style={{ display: "block", maxHeight: "260px" }}
              />
            </div>
          </div>

          {/* Identity + contact */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-black text-stone-900 leading-tight">{name}</h1>
            {type && <p className="text-[#2e7d8c] font-semibold text-base mt-1">{type}</p>}

            <div className="mt-3 flex flex-wrap gap-2">
              {t.online && (
                <span className="rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-medium text-blue-700">🌐 טיפול אונליין</span>
              )}
              {t.regions && t.regions.length > 0 && (
                <span className="rounded-full bg-stone-100 border border-stone-200 px-3 py-1 text-xs font-medium text-stone-600">📍 {t.regions.slice(0, 2).join(", ")}</span>
              )}
              {t.languages && t.languages.length > 0 && (
                <span className="rounded-full bg-stone-100 border border-stone-200 px-3 py-1 text-xs font-medium text-stone-600">🗣 {t.languages.join(", ")}</span>
              )}
            </div>

            {/* Contact buttons */}
            <ContactButtons
              therapistId={id}
              therapistName={t.full_name ?? ""}
              waLink={waLink}
              phone={t.phone}
              email={t.email}
              source={source}
            />
          </div>

        </div>
      </div>

      {/* Specialties — surfaced above the fold */}
      {hasSpecialties && (
        <div className="mb-8 px-1 space-y-4">
          {t.training_areas && t.training_areas.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-stone-500 mb-2">תחומי טיפול</h2>
              <div className="flex flex-wrap gap-1.5">
                {t.training_areas.map((area, i) => (
                  <span key={i} className="rounded-full bg-teal-50 border border-teal-200 px-3 py-1 text-xs font-medium text-teal-800">{area}</span>
                ))}
              </div>
            </div>
          )}
          {t.age_groups && t.age_groups.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-stone-500 mb-2">גיל מטופלים</h2>
              <div className="flex flex-wrap gap-1.5">
                {t.age_groups.map((g, i) => (
                  <span key={i} className="rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-xs font-medium text-indigo-800">{g}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bio — open, large and prominent */}
      {t.bio && (
        <div className="mb-8 px-1">
          <h2 className="text-lg font-extrabold text-stone-800 mb-3">כמה מילים עלי</h2>
          <p className="text-base leading-8 text-stone-700 whitespace-pre-line">{t.bio}</p>
        </div>
      )}

      {/* Collapsible sections */}
      <div className="space-y-3">

        {t.education && (
          <Accordion title="השכלה והכשרה">
            <p className="text-sm leading-7 text-stone-700 whitespace-pre-line">{t.education}</p>
          </Accordion>
        )}

        {t.experience && (
          <Accordion title="ניסיון מקצועי">
            <p className="text-sm leading-7 text-stone-700 whitespace-pre-line">{t.experience}</p>
          </Accordion>
        )}

        {hasDetails && (
          <Accordion title="פרטים מקצועיים">
            <div className="space-y-3">
              {t.therapist_types && t.therapist_types.length > 0 && <DetailRow label="הכשרה" value={genderTitles(t.therapist_types, t.gender).join(", ")} />}
              {t.assessment_types && t.assessment_types.length > 0 && <DetailRow label="אבחונים" value={t.assessment_types.join(", ")} />}
              {t.regions && t.regions.length > 0 && <DetailRow label="אזורי פעילות" value={t.regions.join(", ")} />}
              {t.languages && t.languages.length > 0 && <DetailRow label="שפות טיפול" value={t.languages.join(", ")} />}
              {t.cultural_prefs && t.cultural_prefs.length > 0 && <DetailRow label="העדפות תרבותיות" value={t.cultural_prefs.join(", ")} />}
              {t.arrangements && t.arrangements.length > 0 && <DetailRow label="הסדרים" value={t.arrangements.join(", ")} />}
            </div>
          </Accordion>
        )}

      </div>

      {/* Articles written by / attributed to this therapist */}
      {articles.length > 0 && (
        <div className="mt-8 px-1">
          <h2 className="text-lg font-extrabold text-stone-800 mb-3">מאמרים מאת {name}</h2>
          <div className="space-y-3">
            {articles.map((art) => (
              <Link key={art.slug} href={`/research/community/${art.slug}`}
                className="block rounded-2xl border border-[#E8E0D8] bg-white p-4 transition hover:shadow-md">
                {art.topic && (
                  <div className="text-xs font-bold text-[#2e7d8c] mb-1">{art.topic}</div>
                )}
                <h3 className="font-bold text-stone-900 text-sm">{art.title}</h3>
                {art.summary && <p className="mt-1 text-xs text-stone-500 leading-6 line-clamp-2">{art.summary}</p>}
              </Link>
            ))}
          </div>
        </div>
      )}

    </main>
  );
}

function Accordion({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="rounded-2xl border border-[#E8E0D8] bg-white overflow-hidden group">
      <summary className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer select-none hover:bg-stone-50 transition-colors">
        <span className="font-extrabold text-stone-900 text-sm">{title}</span>
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
    <div className="flex gap-3 items-start text-sm py-2 border-b border-stone-100 last:border-0">
      <span className="font-semibold text-stone-500 flex-shrink-0 min-w-[110px]">{label}</span>
      <span className="text-stone-800">{value}</span>
    </div>
  );
}
