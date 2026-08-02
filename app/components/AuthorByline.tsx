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
 */
export function AuthorByline({ note }: { note?: string }) {
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
