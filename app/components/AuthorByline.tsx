import Link from "next/link";
import { SITE_AUTHOR, SITE_AUTHOR_PATH } from "@/app/lib/author";

/**
 * Visible author attribution for an editorial article.
 *
 * The schema-level identity lives in app/lib/author.ts; this is the human-facing
 * half of the same claim. Both matter: Google's quality raters look for a real,
 * credentialed author on YMYL pages, and readers deciding whether to trust a
 * mental-health guide look for exactly the same thing.
 *
 * `note` states why this author is qualified *for this particular article* -
 * a generic bio says less than "he teaches assessment" on an assessment guide.
 *
 * `coAuthor` credits the editorial team alongside the named author, for guides
 * that were genuinely produced that way. It is deliberately additive rather
 * than a replacement: the credentialed human stays the visible author, because
 * a house byline alone on a YMYL page is exactly what quality raters treat as
 * unattributed.
 */
export function AuthorByline({ note, coAuthor }: { note?: string; coAuthor?: string }) {
  return (
    <div
      style={{
        borderTop: "1px solid var(--line)",
        paddingTop: "28px",
        marginTop: "8px",
        display: "flex",
        gap: "16px",
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          width: "48px",
          height: "48px",
          borderRadius: "50%",
          background: "var(--teal-pale)",
          border: "2px solid var(--teal-mid)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "22px",
          flexShrink: 0,
        }}
        aria-hidden="true"
      >
        🧑‍⚕️
      </div>
      <div>
        <p style={{ fontWeight: 800, fontSize: "15px", marginBottom: "3px" }}>
          <Link href={SITE_AUTHOR_PATH} className="hover:underline" style={{ color: "var(--teal-dark)" }}>
            {SITE_AUTHOR.name}
          </Link>
          {coAuthor && <span style={{ fontWeight: 600, color: "var(--text-2)" }}> ו{coAuthor}</span>}
          {/* The Latin spelling, visible and not only in the structured data:
              it is how the academic profiles (Scholar, ORCID, ResearchGate) and
              any English-language citation spell him, and it is the string a
              reader would paste into a search to check him out. Same exception
              the brand already makes for "Mentalytics" on the homepage. */}
          <span
            dir="ltr"
            lang="en"
            style={{ fontWeight: 500, fontSize: "13px", color: "var(--muted)", marginInlineStart: "8px" }}
          >
            {SITE_AUTHOR.alternateName}
          </span>
        </p>
        <p style={{ fontSize: "13px", color: "var(--teal)", fontWeight: 600, marginBottom: "8px" }}>
          {SITE_AUTHOR.jobTitle}
        </p>
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 8px", display: "flex", flexDirection: "column", gap: "2px" }}>
          {SITE_AUTHOR.credentials.map((c) => (
            <li key={c} style={{ fontSize: "12.5px", color: "var(--muted)", lineHeight: 1.7 }}>
              · {c}
            </li>
          ))}
        </ul>
        {note && <p style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.75 }}>{note}</p>}
      </div>
    </div>
  );
}
