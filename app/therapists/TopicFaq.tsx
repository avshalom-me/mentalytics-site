import type { Topic } from "@/app/lib/topics";

/**
 * A topic's parent-facing Q&A, rendered BELOW the listings as an accordion and
 * emitted as FAQPage JSON-LD.
 *
 * It went above the cards on 9/9/26, after a SERP check found every page
 * ranking for "פסיכולוג ילדים ב<עיר>" leads with 1,000+ words of parent
 * questions. It came back down on 16/9: the Tel Aviv kids page is also the
 * landing page of the paid kids campaign, and in that week the share of its
 * visitors who ever reached a therapist card fell from 83% to 38%. The text and
 * the JSON-LD are unchanged, so the page still answers the questions; a parent
 * who came for the list simply meets the list first.
 *
 * Answers are the same text on every city page on purpose: they claim no
 * counts and no prices, so they are true everywhere. What makes a city page
 * differ is its own listing and the data-derived note beside it, not this.
 */
export default function TopicFaq({ topic, title }: { topic: Topic; title: string }) {
  const faq = topic.faq ?? [];
  if (faq.length === 0) return null;
  const ld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  return (
    <section className="mt-10" style={{ maxWidth: "72ch" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <h2 className="text-xl font-extrabold mb-3" style={{ color: "var(--text)" }}>{title}</h2>
      <div className="rounded-2xl" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        {faq.map((f, i) => (
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
  );
}
