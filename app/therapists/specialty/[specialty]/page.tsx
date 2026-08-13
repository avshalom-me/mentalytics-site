import { notFound } from "next/navigation";
import { listingItemSchema } from "@/app/lib/listing-schema";
import Link from "next/link";
import type { Metadata } from "next";
import { loadPublicTherapists, countListed, MIN_LISTED_FOR_INDEX } from "@/app/lib/therapist-directory";
import { SPECIALTY_LIST, SPECIALTY_CONTENT, SPECIALTY_DEEP_DIVE, specialtyToSlug, slugToSpecialty, specialtyTitle, specialtyIntro } from "@/app/lib/specialties";
import { loadArticlesByTopics } from "@/app/lib/local-articles";
import { ALL_REGIONS, regionToSlug, ONLINE_SLUG } from "@/app/lib/regions";
import TherapistResultCard from "@/app/components/TherapistResultCard";
import CouplesDepthSection from "@/app/therapists/CouplesDepthSection";
import PageViewTracker from "@/app/components/PageViewTracker";
import { introPlusOffer, therapistOffers } from "@/app/lib/meta-description";

const BASE = "https://www.mentalytics.co.il";

export const revalidate = 300;

export function generateStaticParams() {
  return SPECIALTY_LIST.map((s) => ({ specialty: specialtyToSlug(s) }));
}

export async function generateMetadata({ params }: { params: Promise<{ specialty: string }> }): Promise<Metadata> {
  const { specialty: slug } = await params;
  const specialty = slugToSpecialty(slug);
  if (!specialty) return { title: "התמחות לא נמצאה" };
  const title = specialtyTitle(specialty);
  const url = `${BASE}/therapists/specialty/${slug}`;
  // Same thin-page gate as the city pages: no index until there are real
  // therapists to show.
  const count = await countListed({ specialty });
  const description = introPlusOffer(specialtyIntro(specialty), ...therapistOffers(count, MIN_LISTED_FOR_INDEX));
  const robots = count < MIN_LISTED_FOR_INDEX ? { index: false as const, follow: true } : undefined;
  return { title, description, alternates: { canonical: url }, robots, openGraph: { title, description, url } };
}

export default async function SpecialtyPage({ params }: { params: Promise<{ specialty: string }> }) {
  const { specialty: slug } = await params;
  const specialty = slugToSpecialty(slug);
  if (!specialty) notFound();

  const list = await loadPublicTherapists({ specialty });
  const onlineHere = list.filter((t) => t.online).length;
  const heading = specialtyTitle(specialty);
  const content = SPECIALTY_CONTENT[specialty] ?? null;
  const deepDive = SPECIALTY_DEEP_DIVE[specialty] ?? null;
  const communityArticles = content ? await loadArticlesByTopics(content.topics) : [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: heading,
    inLanguage: "he",
    url: `${BASE}/therapists/specialty/${slug}`,
    hasPart: list.slice(0, 50).map(listingItemSchema),
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "בית", item: BASE },
      { "@type": "ListItem", position: 2, name: "המטפלים שלנו", item: `${BASE}/therapists` },
      { "@type": "ListItem", position: 3, name: specialty, item: `${BASE}/therapists/specialty/${slug}` },
    ],
  };

  const otherSpecialties = SPECIALTY_LIST.filter((s) => s !== specialty).slice(0, 14);

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }} />
      <PageViewTracker page={`specialty:${specialty}`} source="specialty" />

      <Link href="/therapists" className="text-sm text-stone-500 hover:underline mb-6 inline-block">← כל המטפלים</Link>

      <div className="mb-8">
        <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--teal)", textTransform: "uppercase", letterSpacing: ".16em", marginBottom: "8px" }}>לפי התמחות</p>
        <h1 style={{ fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 900, color: "var(--text)", letterSpacing: "-.02em" }}>{heading}</h1>
        {list.length >= 3 && (
          <p className="mt-2 text-sm text-stone-500">
            {`בטיפול חכם ${list.length} מטפלים מאומתים בתחום${onlineHere > 0 ? `, ${onlineHere} מהם זמינים גם אונליין` : ""}.`}
          </p>
        )}
      </div>

      {/* Quiz CTA - same offer as the city/region pages */}
      <div
        className="mb-10 flex flex-col gap-4 rounded-2xl p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7"
        style={{ background: "var(--teal-pale)", border: "1px solid var(--teal-mid)" }}
      >
        <div>
          <p style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--teal-dark)" }}>
            לא בטוחים שזו הגישה המתאימה לכם?
          </p>
          <p className="mt-1.5 leading-7 text-stone-600" style={{ maxWidth: "48ch" }}>
            {"ענו על שאלון קצר מבוסס מחקר שנבנה על ידי פסיכולוגים - נזהה את הצורך, נמליץ על סוג הטיפול, ונתאים לכם מטפל/ת."}
          </p>
        </div>
        <Link
          href="/adults"
          className="shrink-0 inline-flex items-center justify-center whitespace-nowrap font-bold transition hover:opacity-95"
          style={{ background: "var(--teal)", color: "#fff", borderRadius: "50px", padding: "13px 30px", fontSize: "15px" }}
        >
          למילוי השאלון
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-[#E8E0D8] bg-[var(--surface)] p-6 text-stone-600">
          עדיין אין מטפלים מוצגים בהתמחות זו. אפשר לעיין ב<Link href="/therapists" className="font-semibold text-[#2e7d8c] hover:underline">כל המטפלים</Link> או למלא <Link href="/adults" className="font-semibold text-[#2e7d8c] hover:underline">שאלון התאמה</Link>.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((t) => <TherapistResultCard key={t.id} t={t} backHref={`/therapists/specialty/${slug}`} />)}
        </div>
      )}

      {/* Couples is 63% of all measured demand in the field (Keyword Planner,
          8/8/26) and this page carried none of its big phrases, so it gets a
          depth section of its own rather than a new competing page. */}
      {specialty === "טיפול זוגי" && <CouplesDepthSection />}

      {/* Treatment deep-dive - below the listings (the city-pages pattern):
          prose distilled from our own editorial articles + links into them. */}
      <section className="mt-14 pt-10 border-t border-[var(--line)]" style={{ maxWidth: "72ch" }}>
        <h2 className="text-xl font-extrabold mb-4" style={{ color: "var(--text)" }}>
          על {specialty} - מה חשוב לדעת
        </h2>
        <div className="space-y-4">
          <p className="text-[15px] leading-8 text-stone-600">{specialtyIntro(specialty)}</p>
          {content?.paragraphs.map((p, i) => (
            <p key={i} className="text-[15px] leading-8 text-stone-600">{p}</p>
          ))}
        </div>
      </section>

      {content && (
        <section className="mt-8 pt-6 border-t border-[var(--line)]" style={{ maxWidth: "72ch" }}>

          {/* Expert deep-dive (theory, techniques, structure) - technique lists
              collapsed so the page stays calm; fully server-rendered for SEO. */}
          {deepDive && (
            <div className="mt-6">
              {deepDive.sections.map((sec, si) =>
                sec.collapsible ? (
                  <details key={si} className="mt-3 rounded-xl px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
                    <summary className="cursor-pointer text-[15px] font-bold" style={{ color: "var(--text-2)" }}>
                      {sec.heading}
                    </summary>
                    {sec.bullets && (
                      <ul className="mt-3 space-y-2">
                        {sec.bullets.map((b, bi) => (
                          <li key={bi} className="text-sm leading-7 text-stone-600">
                            <strong style={{ color: "var(--text-2)" }}>{b.term}</strong> - {b.desc}
                          </li>
                        ))}
                      </ul>
                    )}
                  </details>
                ) : (
                  <div key={si} className={si === 0 ? "" : "mt-5"}>
                    {sec.heading && (
                      <h3 className="text-base font-extrabold mb-2" style={{ color: "var(--text)" }}>{sec.heading}</h3>
                    )}
                    {sec.paragraphs?.map((p, pi) => (
                      <p key={pi} className="text-[15px] leading-8 text-stone-600">{p}</p>
                    ))}
                    {sec.bullets && (
                      <ul className="mt-2 space-y-2">
                        {sec.bullets.map((b, bi) => (
                          <li key={bi} className="text-sm leading-7 text-stone-600">
                            <strong style={{ color: "var(--text-2)" }}>{b.term}</strong> - {b.desc}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              )}
            </div>
          )}

          <div className="mt-8">
            <h3 className="text-base font-extrabold mb-3" style={{ color: "var(--text)" }}>להעמקה באתר</h3>
            <ul className="space-y-2">
              {content.related.map((r) => (
                <li key={r.href} className="text-sm leading-7">
                  <Link href={r.href} className="font-semibold hover:underline" style={{ color: "var(--teal-dark)" }}>
                    {r.label} ←
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {communityArticles.length > 0 && (
            <div className="mt-6">
              <h3 className="text-base font-extrabold mb-3" style={{ color: "var(--text)" }}>מאמרים ממטפלים בנושא</h3>
              <ul className="space-y-2">
                {communityArticles.map((a) => (
                  <li key={a.slug} className="text-sm leading-7">
                    <Link href={`/research/community/${encodeURIComponent(a.slug)}`} className="font-semibold hover:underline" style={{ color: "var(--teal-dark)" }}>
                      {a.title}
                    </Link>
                    <span className="text-stone-500"> - מאת {a.author}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Internal linking: other specialties + regions */}
      <div className="mt-12 pt-8 border-t border-[var(--line)]">
        <h2 className="text-base font-extrabold text-stone-800 mb-3">התמחויות נוספות</h2>
        <div className="flex flex-wrap gap-2">
          {otherSpecialties.map((s) => (
            <Link key={s} href={`/therapists/specialty/${specialtyToSlug(s)}`} className="rounded-full px-3.5 py-1.5 text-sm font-semibold hover:bg-[var(--teal-pale)]"
              style={{ border: "1px solid var(--line)", color: "var(--text-2)" }}>{s}</Link>
          ))}
        </div>
      </div>
      <div className="mt-8 pt-6 border-t border-[var(--line)]">
        <h2 className="text-base font-extrabold text-stone-800 mb-3">לפי אזור</h2>
        <div className="flex flex-wrap gap-2">
          <Link href={`/therapists/region/${ONLINE_SLUG}`} className="rounded-full px-3.5 py-1.5 text-sm font-semibold hover:bg-[var(--teal-pale)]"
            style={{ border: "1px solid var(--line)", color: "var(--text-2)" }}>🌐 טיפול אונליין</Link>
          {ALL_REGIONS.map((reg) => (
            <Link key={reg} href={`/therapists/region/${regionToSlug(reg)}`} className="rounded-full px-3.5 py-1.5 text-sm font-semibold hover:bg-[var(--teal-pale)]"
              style={{ border: "1px solid var(--line)", color: "var(--text-2)" }}>{reg}</Link>
          ))}
        </div>
      </div>
    </main>
  );
}
