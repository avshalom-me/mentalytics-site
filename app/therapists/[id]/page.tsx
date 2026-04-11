import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import ContactButtons from "./ContactButtons";

const BUCKET = process.env.SUPABASE_THERAPIST_FILES_BUCKET || "therapist-certificates";
const BASE_URL = "https://www.tipolchacham.co.il";

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

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const result = await getTherapist(id);
  if (!result) return { title: "מטפל לא נמצא" };

  const { therapist } = result;
  const name = therapist.full_name ?? "מטפל";
  const type = therapist.therapist_types?.[0] ?? "מטפל נפשי";
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


export default async function TherapistProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getTherapist(id);
  if (!result) notFound();

  const { therapist: t, photoUrl } = result;
  const name = t.full_name ?? "מטפל";
  const type = t.therapist_types?.[0] ?? "";
  const avatarSrc = t.gender === "נקבה" ? "/avatar-female.svg" : "/avatar-male.svg";
  const waLink = t.phone
    ? `https://wa.me/972${t.phone.replace(/^0/, "").replace(/[-\s]/g, "")}`
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
    (t.training_areas?.length ?? 0) > 0 ||
    (t.assessment_types?.length ?? 0) > 0 ||
    (t.age_groups?.length ?? 0) > 0 ||
    (t.regions?.length ?? 0) > 0 ||
    (t.languages?.length ?? 0) > 0 ||
    (t.cultural_prefs?.length ?? 0) > 0 ||
    (t.arrangements?.length ?? 0) > 0;

  return (
    <main className="mx-auto max-w-2xl px-5 py-10 pb-24" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
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
      <div className="rounded-3xl overflow-hidden bg-white mb-8" style={{ boxShadow: "0 4px 24px rgba(60,40,20,.10)", border: "1px solid #E8E0D8" }}>

        {/* Photo */}
        <div className="h-80 w-full overflow-hidden bg-stone-100">
          <img src={photoUrl ?? avatarSrc} alt={name} className="h-full w-full object-cover object-center" />
        </div>

        {/* Identity + contact */}
        <div className="p-6">
          <h1 className="text-3xl font-black text-stone-900 leading-tight">{name}</h1>
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
            waLink={waLink}
            phone={t.phone}
            email={t.email}
          />
        </div>
      </div>

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
              {t.therapist_types && t.therapist_types.length > 0 && <DetailRow label="הכשרה" value={t.therapist_types.join(", ")} />}
              {t.training_areas && t.training_areas.length > 0 && <DetailRow label="תחומי טיפול" value={t.training_areas.join(", ")} />}
              {t.assessment_types && t.assessment_types.length > 0 && <DetailRow label="אבחונים" value={t.assessment_types.join(", ")} />}
              {t.age_groups && t.age_groups.length > 0 && <DetailRow label="גיל מטופלים" value={t.age_groups.join(", ")} />}
              {t.regions && t.regions.length > 0 && <DetailRow label="אזורי פעילות" value={t.regions.join(", ")} />}
              {t.languages && t.languages.length > 0 && <DetailRow label="שפות טיפול" value={t.languages.join(", ")} />}
              {t.cultural_prefs && t.cultural_prefs.length > 0 && <DetailRow label="העדפות תרבותיות" value={t.cultural_prefs.join(", ")} />}
              {t.arrangements && t.arrangements.length > 0 && <DetailRow label="הסדרים" value={t.arrangements.join(", ")} />}
            </div>
          </Accordion>
        )}

      </div>

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
