import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

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
    .eq("status", "approved")
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

  return (
    <main className="mx-auto max-w-2xl px-5 py-10 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');`}</style>

      <Link href="/therapists" className="text-sm text-stone-500 hover:underline mb-6 inline-block">← חזרה לכל המטפלים</Link>

      {/* Photo + name header */}
      <div className="rounded-2xl overflow-hidden border border-[#E8E0D8] bg-white mb-6" style={{ boxShadow: "0 2px 12px rgba(100,60,30,.08)" }}>
        <div className="h-64 w-full overflow-hidden bg-gray-100">
          <img
            src={photoUrl ?? avatarSrc}
            alt={name}
            className="h-full w-full object-cover object-center"
          />
        </div>
        <div className="p-6">
          <h1 className="text-2xl font-black text-stone-900">{name}</h1>
          {type && <p className="text-stone-500 text-sm mt-1">{type}</p>}

          <div className="mt-3 flex flex-wrap gap-2">
            {t.online && (
              <span className="rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs text-blue-700">🌐 זמין/ה לטיפול אונליין</span>
            )}
            {t.regions && t.regions.length > 0 && (
              <span className="rounded-full bg-stone-100 border border-stone-200 px-3 py-1 text-xs text-stone-600">📍 {t.regions.slice(0, 2).join(", ")}</span>
            )}
          </div>
        </div>
      </div>

      {/* Bio */}
      {t.bio && (
        <div className="rounded-2xl p-6 bg-white border border-[#E8E0D8] mb-5">
          <h2 className="font-extrabold text-stone-900 text-base mb-3">כמה מילים עלי</h2>
          <p className="text-sm leading-7 text-stone-700 whitespace-pre-line">{t.bio}</p>
        </div>
      )}

      {/* Education */}
      {t.education && (
        <div className="rounded-2xl p-6 bg-white border border-[#E8E0D8] mb-5">
          <h2 className="font-extrabold text-stone-900 text-base mb-3">השכלה והכשרה</h2>
          <p className="text-sm leading-7 text-stone-700 whitespace-pre-line">{t.education}</p>
        </div>
      )}

      {/* Experience */}
      {t.experience && (
        <div className="rounded-2xl p-6 bg-white border border-[#E8E0D8] mb-5">
          <h2 className="font-extrabold text-stone-900 text-base mb-3">ניסיון מקצועי</h2>
          <p className="text-sm leading-7 text-stone-700 whitespace-pre-line">{t.experience}</p>
        </div>
      )}

      {/* Details grid */}
      <div className="space-y-4 mb-6">
        {t.therapist_types && t.therapist_types.length > 0 && (
          <DetailRow label="הכשרה" value={t.therapist_types.join(", ")} />
        )}
        {t.training_areas && t.training_areas.length > 0 && (
          <DetailRow label="תחומי טיפול" value={t.training_areas.join(", ")} />
        )}
        {t.assessment_types && t.assessment_types.length > 0 && (
          <DetailRow label="אבחונים" value={t.assessment_types.join(", ")} />
        )}
        {t.age_groups && t.age_groups.length > 0 && (
          <DetailRow label="גיל מטופלים" value={t.age_groups.join(", ")} />
        )}
        {t.regions && t.regions.length > 0 && (
          <DetailRow label="אזורי פעילות" value={t.regions.join(", ")} />
        )}
        {t.languages && t.languages.length > 0 && (
          <DetailRow label="שפות טיפול" value={t.languages.join(", ")} />
        )}
        {t.cultural_prefs && t.cultural_prefs.length > 0 && (
          <DetailRow label="העדפות תרבותיות" value={t.cultural_prefs.join(", ")} />
        )}
        {t.arrangements && t.arrangements.length > 0 && (
          <DetailRow label="הסדרים" value={t.arrangements.join(", ")} />
        )}
      </div>

      {/* Contact */}
      {(waLink || t.email) && (
        <div className="rounded-2xl p-6 bg-white border border-[#E8E0D8] mb-6">
          <h2 className="font-extrabold text-stone-900 text-base mb-4">יצירת קשר</h2>
          <div className="flex flex-wrap gap-3">
            {waLink && (
              <a href={waLink} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-green-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-green-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                וואטסאפ
              </a>
            )}
            {t.email && (
              <a href={`mailto:${t.email}`}
                className="inline-flex items-center gap-2 rounded-xl bg-[#2e7d8c] px-4 py-2.5 text-sm font-bold text-white hover:opacity-90">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2"/>
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
                מייל
              </a>
            )}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="rounded-2xl p-6 bg-[#f0f8fa] border border-[#b0d8e0]">
        <p className="text-sm leading-7 text-stone-700 mb-4">
          רוצה לבדוק האם {name} מתאים/ה לצרכים שלך? מלא/י את שאלון ההתאמה וקבל/י המלצות אישיות.
        </p>
        <Link href="/adults"
          className="inline-flex items-center gap-2 rounded-xl bg-[#2e7d8c] px-5 py-2.5 text-sm font-bold text-white hover:opacity-90">
          לשאלון ההתאמה ←
        </Link>
      </div>
    </main>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white border border-[#E8E0D8] px-4 py-3 flex gap-3 items-start text-sm">
      <span className="font-semibold text-stone-600 flex-shrink-0 min-w-[100px]">{label}</span>
      <span className="text-stone-800">{value}</span>
    </div>
  );
}
