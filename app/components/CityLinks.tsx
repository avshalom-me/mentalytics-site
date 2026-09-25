import Link from "next/link";
import { FEATURED_CITIES, regionToSlug } from "@/app/lib/regions";

/**
 * Crawlable links to the city landing pages, from the pages Google trusts most.
 *
 * See FEATURED_CITIES in regions.ts for why these links exist and why these
 * cities. Two rules shape this block:
 *
 * - `data-nosnippet` on the root. The snippet that converts is the line about
 *   the questionnaire built by researchers and psychologists (the owner's
 *   point, 24/9/2026), and Google picks the snippet per query - a list of
 *   "פסיכולוגים ב..." phrases is exactly what it would lift for a city query.
 *   nosnippet keeps the text out of snippets while the links are still crawled
 *   and followed.
 * - It goes at the bottom of the page, never above the listings or the
 *   questionnaire. When the city note moved above the therapist cards (9/9),
 *   the share of visitors who reached a card fell from 83% to 38%.
 */
export default function CityLinks() {
  return (
    <section data-nosnippet dir="rtl" style={{ padding: "72px 24px 40px", fontFamily: "'Heebo', sans-serif" }}>
      <div style={{ maxWidth: "1080px", margin: "0 auto" }}>
        <p
          style={{
            fontSize: "12px",
            fontWeight: 700,
            color: "var(--teal)",
            textTransform: "uppercase",
            letterSpacing: ".16em",
            marginBottom: "10px",
          }}
        >
          לפי עיר
        </p>
        <h2
          style={{
            fontSize: "clamp(1.4rem, 2.4vw, 1.9rem)",
            fontWeight: 900,
            color: "var(--text)",
            letterSpacing: "-.02em",
            marginBottom: "20px",
          }}
        >
          פסיכולוגים ומטפלים לפי עיר
        </h2>
        <nav aria-label="פסיכולוגים ומטפלים לפי עיר" className="flex flex-wrap gap-2">
          {FEATURED_CITIES.map((city) => (
            <Link
              key={city}
              href={`/therapists/city/${regionToSlug(city)}`}
              className="rounded-full px-4 py-2 text-sm font-semibold hover:bg-[var(--teal-pale)]"
              style={{ border: "1px solid var(--teal-mid)", color: "var(--teal-dark)" }}
            >
              פסיכולוגים ב{city}
            </Link>
          ))}
          {/* Not a city, but the answer for anyone without one nearby - and
              until 25/9/2026 the homepage did not link to the online hub at all. */}
          <Link
            href="/therapists/region/אונליין"
            className="rounded-full px-4 py-2 text-sm font-semibold hover:bg-[var(--teal-pale)]"
            style={{ border: "1px solid var(--teal-mid)", color: "var(--teal-dark)" }}
          >
            🌐 טיפול פסיכולוגי אונליין
          </Link>
          <Link
            href="/therapists/region"
            className="rounded-full px-4 py-2 text-sm font-semibold hover:bg-[var(--teal-pale)]"
            style={{ border: "1px solid var(--line)", color: "var(--text-2)" }}
          >
            כל האזורים ←
          </Link>
        </nav>
      </div>
    </section>
  );
}
