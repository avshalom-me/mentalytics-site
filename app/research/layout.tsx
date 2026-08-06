import Link from "next/link";
import ResearchViewTracker from "./ResearchViewTracker";

// Shared layout for ALL /research pages (editorial articles + community
// therapist articles): appends a "מחפשים מטפל?" internal-links block after
// every article. SEO purpose: the articles earn topical authority - this
// funnels it (and readers) to the money pages (city / online / specialty
// landings + the quiz) with descriptive anchor text.

const LINKS: { href: string; label: string }[] = [
  { href: "/adults", label: "✦ שאלון התאמה אישי" },
  { href: "/therapists/region/אונליין", label: "טיפול אונליין" },
  { href: "/therapists/city/תל-אביב", label: "פסיכולוגים בתל אביב" },
  { href: "/therapists/city/ירושלים", label: "פסיכולוגים בירושלים" },
  { href: "/therapists/city/חיפה", label: "פסיכולוגים בחיפה" },
  { href: "/therapists/specialty/CBT", label: "טיפול CBT" },
  { href: "/therapists/specialty/טיפול-זוגי", label: "טיפול זוגי" },
  { href: "/therapists/topic/טיפול-בחרדה", label: "טיפול בחרדה" },
  { href: "/therapists/topic/פסיכולוג-ילדים", label: "פסיכולוג ילדים" },
  { href: "/therapists", label: "כל המטפלים" },
];

export default function ResearchLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ResearchViewTracker />
      {children}
      <aside dir="rtl" className="mx-auto max-w-3xl px-5 pb-16" style={{ fontFamily: "'Heebo', sans-serif" }}>
        <div className="rounded-2xl p-6" style={{ background: "var(--surface, #F7FAF9)", border: "1px solid var(--line, #DDE9E8)" }}>
          <p className="font-extrabold mb-3" style={{ color: "var(--text, #131F1E)" }}>
            מחפשים מטפל או פסיכולוג?
          </p>
          <div className="flex flex-wrap gap-2">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-full px-3.5 py-1.5 text-sm font-semibold transition hover:opacity-90"
                style={{ background: "#fff", border: "1px solid var(--teal-mid, #C2DFDE)", color: "var(--teal-dark, #2A6462)" }}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}
