import { notFound } from "next/navigation";
import { listingItemSchema } from "@/app/lib/listing-schema";
import Link from "next/link";
import type { Metadata } from "next";
import { loadPublicTherapists, countListed } from "@/app/lib/therapist-directory";
import {
  slugToCityTopic,
  isOnlineTopicAllowed,
  isYouthTopic,
  onlineTopicSlugs,
  MIN_ONLINE_TOPIC,
  TOPICS,
} from "@/app/lib/topics";
import QuizCta from "@/app/therapists/QuizCta";
import TherapistResultCard from "@/app/components/TherapistResultCard";
import PaidVisitorNotice from "@/app/components/PaidVisitorNotice";
import PageViewTracker from "@/app/components/PageViewTracker";
import { ONLINE_COPY } from "@/app/lib/online-copy";

// Online×topic (phase 3 of the online cluster - see ONLINE_TOPIC_SLUGS in
// app/lib/topics.ts): "טיפול בחרדה אונליין", "טיפול זוגי אונליין". Same
// anti-doorway discipline as the city×topic pilot it mirrors: allow-listed
// combos only, indexable only at ≥MIN_ONLINE_TOPIC listed therapists,
// everything else noindex or 404.
//
// The listing overlap with the parent online page is real (the חרדה filter
// matches most online therapists), which is exactly the city-pilot situation -
// so the differentiation burden falls on the prose, and since 25/9/2026 all of
// it is the page's own: title, description, opening, note and questions come
// from app/lib/online-copy.ts, none of it shared with another page. The notes
// cite only sources verified against their records (see
// /research/online-therapy); where no direct evidence exists (couples, kids)
// they say something honest and practical instead of inventing a study.

const BASE = "https://www.mentalytics.co.il";

export const revalidate = 300;

export function generateStaticParams() {
  return onlineTopicSlugs().map((topic) => ({ topic }));
}

async function resolve(params: Promise<{ topic: string }>) {
  const { topic: topicSlug } = await params;
  const topic = slugToCityTopic(topicSlug);
  if (!topic) return null;
  if (!isOnlineTopicAllowed(topic)) return null;
  // Allowed slugs are exactly OnlineTopicSlug, and ONLINE_COPY is typed to hold
  // an entry for each - the lookup can only miss if the two lists drift.
  const copy = ONLINE_COPY[topic.slug as keyof typeof ONLINE_COPY];
  if (!copy) return null;
  return { topic, copy };
}

export async function generateMetadata({ params }: { params: Promise<{ topic: string }> }): Promise<Metadata> {
  const r = await resolve(params);
  if (!r) return { title: "עמוד לא נמצא" };
  const { topic, copy } = r;
  const { title, description } = copy;
  const url = `${BASE}/therapists/online/${topic.slug}`;
  const count = await countListed({ ...topic.filter, online: true });
  const robots =
    topic.adsOnly || count < MIN_ONLINE_TOPIC ? { index: false as const, follow: true } : undefined;
  return { title, description, alternates: { canonical: url }, robots, openGraph: { title, description, url } };
}

export default async function OnlineTopicPage({ params }: { params: Promise<{ topic: string }> }) {
  const r = await resolve(params);
  if (!r) notFound();
  const { topic, copy } = r;

  const list = await loadPublicTherapists({ ...topic.filter, online: true });
  const heading = copy.h1;
  const youth = isYouthTopic(topic);
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: copy.faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: heading,
    inLanguage: "he",
    url: `${BASE}/therapists/online/${topic.slug}`,
    hasPart: list.slice(0, 50).map(listingItemSchema),
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "בית", item: BASE },
      { "@type": "ListItem", position: 2, name: "המטפלים שלנו", item: `${BASE}/therapists` },
      { "@type": "ListItem", position: 3, name: "טיפול אונליין", item: `${BASE}/therapists/region/אונליין` },
      { "@type": "ListItem", position: 4, name: topic.name, item: `${BASE}/therapists/online/${topic.slug}` },
    ],
  };

  // Sister online-topic pages, only those indexable themselves.
  const sisters: { slug: string; name: string }[] = [];
  for (const slug of onlineTopicSlugs()) {
    if (slug === topic.slug) continue;
    const t = slugToCityTopic(slug);
    if (!t || t.adsOnly) continue;
    const n = await countListed({ ...t.filter, online: true });
    if (n >= MIN_ONLINE_TOPIC) sisters.push({ slug: t.slug, name: ONLINE_COPY[slug].h1 });
  }
  const isNamedTopic = TOPICS.some((t) => t.slug === topic.slug);

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd).replace(/</g, "\\u003c") }} />
      <PageViewTracker page={`online_topic:${topic.slug}`} source="online_topic" />

      <Link href="/therapists/region/אונליין" className="text-sm text-stone-500 hover:underline mb-6 inline-block">
        ← כל המטפלים אונליין
      </Link>

      <div className="mb-8">
        <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--teal)", textTransform: "uppercase", letterSpacing: ".16em", marginBottom: "8px" }}>
          טיפול מרחוק לפי נושא
        </p>
        <h1 style={{ fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 900, color: "var(--text)", letterSpacing: "-.02em" }}>{heading}</h1>
        {/* The quotable intro, one per page (see app/lib/online-copy.ts). With
            the meta description, the only text here Google may use as the
            snippet: both lead with the questionnaire. */}
        <p className="mt-3 text-stone-600 leading-8" style={{ maxWidth: "60ch" }}>
          {copy.intro}
        </p>
        <p data-nosnippet className="mt-2 text-sm text-stone-500">{topic.supplyNote}, שמטפלים גם בשיחת וידאו - מכל מקום בארץ או בחו&quot;ל.</p>
      </div>

      {/* Quiz CTA */}
      {/* This box used to be hand-rolled with href="/adults" hardcoded, on a
          route that carries kids topics too - and the FAQ heading directly
          below it says "שאלות של הורים". A parent reading a page written for
          parents was offered the questionnaire that asks about themselves.
          QuizCta reads the topic instead, which is the whole reason it
          exists. */}
      <QuizCta audience={youth ? "youth" : "both"} body={copy.quiz} />

      <PaidVisitorNotice rows={list} />
      {list.length === 0 ? (
        <div className="rounded-2xl border border-[#E8E0D8] bg-[var(--surface)] p-6 text-stone-600">
          כרגע אין מטפלים מוצגים בשילוב הזה. אפשר לראות את{" "}
          <Link href="/therapists/region/אונליין" className="font-semibold text-[#2e7d8c] hover:underline">כל המטפלים אונליין</Link>{" "}
          או למלא <Link href="/adults" className="font-semibold text-[#2e7d8c] hover:underline">שאלון התאמה</Link>.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((t) => (
            <TherapistResultCard key={t.id} t={t} backHref={`/therapists/online/${topic.slug}`} />
          ))}
        </div>
      )}

      {/* Everything below the listing is this page's own text and stays out of
          snippets (data-nosnippet - still indexed, never quoted), so the result
          Google shows is the questionnaire line above. Until 25/9/2026 this
          spot held the topic's general intro and parent FAQ, word for word the
          text of /therapists/topic/<slug> and of every city page of the topic. */}
      <section data-nosnippet className="mt-14 pt-10 border-t border-[var(--line)]" style={{ maxWidth: "72ch" }}>
        <h2 className="text-xl font-extrabold mb-4" style={{ color: "var(--text)" }}>
          {copy.noteTitle}
        </h2>
        <p className="text-[15px] leading-8 text-stone-600">{copy.note}</p>
        <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
          למחקרים המלאים על יעילות הטיפול מרחוק:{" "}
          <Link href="/research/online-therapy" className="font-semibold hover:underline" style={{ color: "var(--teal-dark)" }}>
            טיפול פסיכולוגי אונליין - האם זה עובד ולמי מתאים?
          </Link>
        </p>
      </section>

      <section data-nosnippet className="mt-10" style={{ maxWidth: "72ch" }}>
        <h2 className="text-xl font-extrabold mb-3" style={{ color: "var(--text)" }}>
          {heading} - {youth ? "שאלות של הורים" : "שאלות נפוצות"}
        </h2>
        <div className="rounded-2xl" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          {copy.faq.map((f, i) => (
            <details key={f.q} className="group" style={{ borderTop: i === 0 ? "none" : "1px solid var(--line)" }}>
              <summary className="cursor-pointer list-none px-5 py-4 text-[15.5px] font-bold text-stone-800 flex items-center justify-between gap-4">
                <span>{f.q}</span>
                <span aria-hidden="true" className="shrink-0 transition group-open:rotate-45" style={{ color: "var(--teal)", fontSize: "22px", lineHeight: 1 }}>+</span>
              </summary>
              <p className="px-5 pb-5 text-[15px] leading-8 text-stone-600">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <div data-nosnippet className="mt-8 pt-6 border-t border-[var(--line)]">
        <h2 className="text-base font-extrabold text-stone-800 mb-3">המשך עיון</h2>
        <div className="flex flex-wrap gap-2">
          {isNamedTopic && (
            <Link
              href={`/therapists/topic/${topic.slug}`}
              className="rounded-full px-3.5 py-1.5 text-sm font-semibold hover:bg-[var(--teal-pale)]"
              style={{ border: "1px solid var(--line)", color: "var(--text-2)" }}
            >
              {topic.name} - בכל הארץ
            </Link>
          )}
          <Link
            href="/therapists/region/אונליין"
            className="rounded-full px-3.5 py-1.5 text-sm font-semibold hover:bg-[var(--teal-pale)]"
            style={{ border: "1px solid var(--line)", color: "var(--text-2)" }}
          >
            🌐 כל המטפלים אונליין
          </Link>
          {sisters.map((s) => (
            <Link
              key={s.slug}
              href={`/therapists/online/${s.slug}`}
              className="rounded-full px-3.5 py-1.5 text-sm font-semibold hover:bg-[var(--teal-pale)]"
              style={{ border: "1px solid var(--line)", color: "var(--text-2)" }}
            >
              {s.name}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
