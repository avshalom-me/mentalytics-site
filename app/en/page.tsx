import type { Metadata } from "next";
import Link from "next/link";
import { loadEnglishDirectory } from "@/app/lib/english-directory";
import { OG_FALLBACK_IMAGE } from "@/app/lib/share-metadata";
import PageViewTracker from "@/app/components/PageViewTracker";
import EnglishDirectory from "./EnglishDirectory";
import DocumentLanguage from "./DocumentLanguage";

/*
 * The site's one English page: promoted therapists and clinics who work in
 * English, and a way into the (Hebrew) questionnaires. An exception to the
 * Hebrew-only rule in CLAUDE.md, by the owner's decision (27/9/2026).
 *
 * Only the therapists' and clinics' names stay in Hebrew; every other value is
 * translated in app/lib/english-labels.ts. Who appears is decided live by
 * promotion status (see loadEnglishDirectory), so a therapist who is promoted
 * or loses promotion moves on or off this page within the revalidation window.
 */
export const revalidate = 300;

const URL = "https://www.mentalytics.co.il/en";
const TITLE = "English-Speaking Therapists in Israel";
const DESCRIPTION =
  "Psychologists, social workers and other therapists across Israel who offer therapy in English, in person or online. Credentials verified. Contact them directly, free of charge.";

export const metadata: Metadata = {
  // absolute: the root template would append the Hebrew "| טיפול חכם".
  title: { absolute: `${TITLE} | Tipul Chacham` },
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: URL,
    type: "website",
    locale: "en_US",
    siteName: "Tipul Chacham (Mentalytics)",
    images: [{ ...OG_FALLBACK_IMAGE, alt: "Tipul Chacham" }],
  },
};

const eyebrow: React.CSSProperties = {
  fontSize: "12px", fontWeight: 700, color: "var(--teal)", textTransform: "uppercase",
  letterSpacing: ".16em", marginBottom: "10px",
};
const h2: React.CSSProperties = {
  fontSize: "clamp(1.8rem, 3.2vw, 2.7rem)", fontWeight: 900, lineHeight: 1.12,
  letterSpacing: "-.02em", color: "var(--text)", marginBottom: "14px",
};
const lead: React.CSSProperties = { fontSize: "16px", color: "var(--text-2)", lineHeight: 1.8, maxWidth: "62ch" };
const pillButton: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: "8px", borderRadius: "50px", fontWeight: 700,
  fontSize: "15px", padding: "13px 30px", transition: "all .22s",
};

function faqItems(online: number): { q: string; a: string }[] {
  return [
    {
      q: "How do I find an English-speaking therapist in Israel?",
      a: "Everyone on this page offers therapy in English as well as Hebrew. You can narrow the list by region, by age group and by online sessions, and contact a therapist directly by WhatsApp, phone or a message through the site. If you are not sure what kind of therapy you need, our questionnaire recommends a type of therapy and suitable therapists; for now it is in Hebrew.",
    },
    {
      q: "Are the therapists on this page qualified?",
      a: "Before a therapist appears on Tipul Chacham, our team verifies their professional training certificates. Each card shows the therapist's profession, and the full profile lists their training in detail.",
    },
    {
      q: "Can I use my health fund (kupat holim) or insurance?",
      a: "Some therapists work with the health funds, private insurance, the Ministry of Defense or National Insurance (Bituach Leumi); where they do, it is shown on their card under Funding. What is covered depends on your plan, so it is worth checking with your fund or insurer before the first session.",
    },
    {
      q: "Can I have therapy in English online?",
      a: `Yes. ${online === 1 ? "One therapist" : `${online} of the therapists`} on this page ${online === 1 ? "offers" : "offer"} online sessions. Choose "Online sessions" above the list to see only them.`,
    },
    {
      q: "Is there a fee for using Tipul Chacham?",
      a: "Browsing the list and contacting therapists is free and carries no commitment. Session fees are agreed directly between you and the therapist.",
    },
    {
      q: "Will the questionnaires be available in English?",
      a: "Yes. The adult and child questionnaires are in Hebrew at the moment, and English versions are planned. Until then, every therapist on this page can be contacted directly in English.",
    },
  ];
}

export default async function EnglishPage() {
  const cards = await loadEnglishDirectory();
  const therapists = cards.filter((c) => !c.isCenter);
  const clinics = cards.length - therapists.length;
  const online = therapists.filter((c) => c.online).length;
  const places = new Set(therapists.flatMap((c) => c.places)).size;
  const faq = faqItems(online);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: "en",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const stats = [
    { n: therapists.length, l: "therapists who work in English" },
    ...(clinics > 0 ? [{ n: clinics, l: clinics === 1 ? "therapy clinic" : "therapy clinics" }] : []),
    { n: online, l: "offer online sessions" },
    { n: places, l: "towns and cities" },
  ];

  return (
    <div lang="en" dir="ltr" style={{ textAlign: "left" }}>
      <DocumentLanguage lang="en" dir="ltr" />
      <PageViewTracker page="english-directory" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <style>{`
        .en-faq summary::-webkit-details-marker { display: none; }
        .en-faq details[open] { background: white; border-color: var(--teal) !important; }
        .en-faq details[open] .faq-icon { transform: rotate(45deg); background: var(--teal); color: white; }
        .en-faq .faq-icon { transition: transform .2s, background .2s; }
        @media (max-width: 640px) {
          .en-stats { padding: 20px 12px !important; flex-wrap: wrap !important; row-gap: 18px; }
          .en-stat { flex: 1 1 42% !important; border-inline-end: none !important; padding: 0 8px !important; }
        }
      `}</style>

      {/* ─── HERO ─── */}
      <section style={{ padding: "88px 24px 72px", textAlign: "center", background: "white", position: "relative", overflow: "hidden" }}>
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: "radial-gradient(ellipse at 70% 10%, rgba(212,144,24,.07) 0%, transparent 55%), radial-gradient(ellipse at 20% 80%, rgba(61,140,138,.07) 0%, transparent 55%)",
        }} />
        <div style={{ position: "relative", maxWidth: "860px", margin: "0 auto" }}>
          <p style={{ ...eyebrow, display: "inline-flex", alignItems: "center", gap: "8px", background: "var(--teal-pale)", padding: "6px 14px", borderRadius: "50px", marginBottom: "22px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--teal)", display: "inline-block" }} />
            Tipul Chacham · Mentalytics
          </p>
          <h1 style={{ fontSize: "clamp(2.6rem, 5.4vw, 4.8rem)", fontWeight: 900, lineHeight: 1.06, letterSpacing: "-.02em", color: "var(--text)", marginBottom: "22px" }}>
            English-speaking{" "}
            <em style={{ fontStyle: "normal", color: "var(--teal)" }}>therapists</em>{" "}
            in Israel
          </h1>
          <p style={{ fontSize: "1.12rem", color: "var(--text-2)", lineHeight: 1.8, maxWidth: "52ch", margin: "0 auto 34px" }}>
            Psychologists, social workers and other therapists who work in English as well as Hebrew, in their
            clinics across the country or online. Our team verifies every therapist&apos;s training certificates,
            and you contact them directly.
          </p>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
            <a href="#therapists" style={{ ...pillButton, background: "var(--teal)", color: "white" }} className="hover:bg-[var(--teal-dark)] hover:-translate-y-0.5">
              Browse the therapists ↓
            </a>
            <a href="#questionnaire" style={{ ...pillButton, background: "white", color: "var(--gold-dark)", border: "1.5px solid var(--gold)" }} className="hover:bg-[var(--gold-pale)] hover:-translate-y-0.5">
              Take the matching questionnaire
            </a>
          </div>
        </div>
      </section>

      {/* ─── STATS ─── Live counts of this page's own list. */}
      <div className="en-stats" style={{
        background: "var(--surface)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)",
        padding: "24px 40px", display: "flex", justifyContent: "center", flexWrap: "nowrap",
      }}>
        {stats.map(({ n, l }, i) => (
          <div key={l} className="en-stat" style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", padding: "0 30px",
            borderInlineEnd: i < stats.length - 1 ? "1px solid var(--line)" : "none", flex: "0 1 auto", minWidth: 0,
          }}>
            <span style={{ fontSize: "2rem", fontWeight: 900, color: "var(--teal)", lineHeight: 1 }}>{n}</span>
            <span style={{ fontSize: "13px", color: "var(--muted)", textAlign: "center" }}>{l}</span>
          </div>
        ))}
      </div>

      {/* ─── QUESTIONNAIRES ─── */}
      <section id="questionnaire" style={{ padding: "96px 24px", scrollMarginTop: "90px" }}>
        <div style={{ maxWidth: "1080px", margin: "0 auto" }}>
          <p style={eyebrow}>Matching questionnaires</p>
          <h2 style={h2}>Not sure what kind of therapy you need?</h2>
          <p style={{ ...lead, marginBottom: "36px" }}>
            Our questionnaires were built by clinical psychologists. They look at what you, or your child, are going
            through, recommend a type of therapy and suggest therapists who fit. Free of charge, with no
            commitment (fair use: up to five times per questionnaire).
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div style={{ background: "var(--teal-pale)", border: "1px solid var(--teal-mid)", borderRadius: "20px", padding: "32px" }}>
              <h3 style={{ fontSize: "1.45rem", fontWeight: 900, color: "var(--text)", marginBottom: "8px" }}>For adults</h3>
              <p style={{ fontSize: "15px", color: "var(--text-2)", lineHeight: 1.75, marginBottom: "22px" }}>
                Anxiety, low mood, stress, relationships, life changes. A few minutes of questions, then a
                recommendation and therapists who match it.
              </p>
              <Link href="/adults" style={{ ...pillButton, background: "var(--teal)", color: "white" }} className="hover:bg-[var(--teal-dark)]">
                Start the adult questionnaire <span style={{ fontWeight: 400, opacity: .85 }}>(in Hebrew)</span>
              </Link>
            </div>
            <div style={{ background: "var(--gold-pale)", border: "1px solid #f0e0b8", borderRadius: "20px", padding: "32px" }}>
              <h3 style={{ fontSize: "1.45rem", fontWeight: 900, color: "var(--text)", marginBottom: "8px" }}>For children and teens</h3>
              <p style={{ fontSize: "15px", color: "var(--text-2)", lineHeight: 1.75, marginBottom: "22px" }}>
                For parents: questions about your child&apos;s emotional, social or learning difficulties, then the
                kind of help that fits and therapists who provide it.
              </p>
              <Link href="/kids" style={{ ...pillButton, background: "var(--gold)", color: "white" }} className="hover:bg-[var(--gold-dark)]">
                Start the child questionnaire <span style={{ fontWeight: 400, opacity: .85 }}>(in Hebrew)</span>
              </Link>
            </div>
          </div>
          <p style={{ marginTop: "18px", fontSize: "14.5px", color: "var(--text-2)", lineHeight: 1.75, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "14px", padding: "16px 20px" }}>
            <strong style={{ color: "var(--text)" }}>Please note:</strong> the questionnaires are in Hebrew for now.
            English versions are on the way. Until then, you can contact any therapist on this page directly -
            they all work in English.
          </p>
        </div>
      </section>

      {/* ─── DIRECTORY ─── */}
      <section id="therapists" style={{ padding: "88px 24px 96px", background: "var(--surface)", scrollMarginTop: "90px" }}>
        <div className="mx-auto max-w-6xl">
          <p style={eyebrow}>The therapists</p>
          <h2 style={h2}>Therapists who work in English</h2>
          <p style={{ ...lead, marginBottom: "28px" }}>
            Everyone here offers sessions in English. Names appear as the therapists write them, in Hebrew, and
            the full profiles are in Hebrew for now.
          </p>
          <EnglishDirectory cards={cards} />
        </div>
      </section>

      {/* ─── WHY LANGUAGE ─── */}
      <section style={{ padding: "96px 24px", background: "white", textAlign: "center" }}>
        <div style={{ maxWidth: "740px", margin: "0 auto" }}>
          <h2 style={{ ...h2, marginBottom: "22px" }}>Why therapy in your own language matters</h2>
          <p style={{ fontSize: "clamp(1.05rem, 1.8vw, 1.3rem)", fontWeight: 300, color: "var(--text)", lineHeight: 1.85, marginBottom: "18px" }}>
            Many people find it easier to put feelings, memories and family stories into the language they grew
            up with, and to switch languages when a word in the other one fits better.
          </p>
          <p style={{ fontSize: "clamp(1.05rem, 1.8vw, 1.3rem)", fontWeight: 300, color: "var(--text)", lineHeight: 1.85 }}>
            After aliyah or a relocation, work, school meetings and paperwork already happen in a second language.
            Therapy is one place where you should not have to <strong style={{ fontWeight: 700, color: "var(--teal)" }}>translate yourself</strong>.
          </p>
          <div style={{ width: "48px", height: "3px", borderRadius: "2px", background: "var(--gold)", margin: "28px auto 0" }} />
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" className="en-faq" style={{ background: "var(--surface)", padding: "96px 24px 80px", scrollMarginTop: "90px" }}>
        <div style={{ maxWidth: "1080px", margin: "0 auto" }}>
          <p style={eyebrow}>Questions</p>
          <h2 style={{ ...h2, marginBottom: "32px" }}>Frequently asked questions</h2>
          <div style={{ maxWidth: "820px" }}>
            {faq.map((item) => (
              <details key={item.q} style={{ borderRadius: "14px", border: "1px solid var(--line)", background: "var(--surface)", marginBottom: "6px", overflow: "hidden" }}>
                <summary style={{
                  padding: "20px 24px", fontSize: "15.5px", fontWeight: 600, color: "var(--text)", cursor: "pointer",
                  listStyle: "none", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px",
                }}>
                  <span>{item.q}</span>
                  <span className="faq-icon" style={{
                    width: "26px", height: "26px", borderRadius: "50%", background: "var(--teal-pale)", display: "flex",
                    alignItems: "center", justifyContent: "center", color: "var(--teal)", fontSize: "17px", fontWeight: 300, flexShrink: 0,
                  }}>+</span>
                </summary>
                <div style={{ padding: "0 24px 20px", fontSize: "14.5px", color: "var(--muted)", lineHeight: 1.8 }}>{item.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FOR THERAPISTS ─── */}
      <section style={{ padding: "72px 24px 88px", background: "white" }}>
        <div style={{ maxWidth: "820px", margin: "0 auto", border: "1px solid var(--line)", borderRadius: "20px", padding: "32px" }}>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 900, color: "var(--text)", marginBottom: "8px" }}>Are you a therapist who works in English?</h2>
          <p style={{ fontSize: "15px", color: "var(--text-2)", lineHeight: 1.75, marginBottom: "20px" }}>
            Therapists and clinics in Israel can join Tipul Chacham. The sign-up form is in Hebrew.
          </p>
          <Link href="/therapists/join" style={{ ...pillButton, background: "white", color: "var(--teal-dark)", border: "1.5px solid var(--teal)" }} className="hover:bg-[var(--teal-pale)]">
            Join as a therapist <span style={{ fontWeight: 400, color: "var(--muted)" }}>(Hebrew)</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
