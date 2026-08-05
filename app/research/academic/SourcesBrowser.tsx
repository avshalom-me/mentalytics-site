"use client";

import { useMemo, useState } from "react";
import {
  type SourceItem,
  safeText,
  norm,
  doiToUrl,
  formatAuthors,
  buildCitation,
  bestLinks,
} from "./sources";

/**
 * Search / filter / sort over the bibliography.
 *
 * The data arrives as a prop rather than being fetched in an effect, which is
 * the whole point of the split: a client component with its data already in
 * hand still renders on the server, so every citation lands in the initial
 * HTML. The previous version fetched in useEffect, so the page served a
 * "טוען מקורות…" spinner and 129 words to a crawler.
 */
export default function SourcesBrowser({ items }: { items: SourceItem[] }) {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [type, setType] = useState("");
  const [sort, setSort] = useState<"year_desc" | "year_asc" | "title_asc">("year_desc");

  const allTags = useMemo(() => {
    const s = new Set<string>();
    items.forEach((it) => (it.tags || []).forEach((t) => t && s.add(t)));
    return Array.from(s).sort((a, b) => a.localeCompare(b, "he"));
  }, [items]);

  const filtered = useMemo(() => {
    const query = norm(q);
    const list = items.filter((it) => {
      if (tag && !(it.tags || []).includes(tag)) return false;
      if (type && safeText(it.type) !== type) return false;
      if (!query) return true;
      const hay = [formatAuthors(it.authors), it.title, it.container, it.year, it.doi, (it.tags || []).join(" ")]
        .map(norm)
        .join(" | ");
      return hay.includes(query);
    });

    return [...list].sort((a, b) => {
      const ya = Number(a.year || 0);
      const yb = Number(b.year || 0);
      if (sort === "year_asc") return ya - yb;
      if (sort === "year_desc") return yb - ya;
      return safeText(a.title).localeCompare(safeText(b.title), "he");
    });
  }, [items, q, tag, type, sort]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    filtered.forEach((it) => {
      const k = safeText(it.verification_status) || "unverified";
      c[k] = (c[k] || 0) + 1;
    });
    return c;
  }, [filtered]);

  const field = {
    width: "100%",
    padding: 10,
    border: "1px solid var(--line)",
    borderRadius: 10,
    fontSize: "0.95rem",
    background: "var(--bg)",
    color: "var(--text)",
    fontFamily: "inherit",
  } as const;

  const label = { fontSize: "0.85rem", color: "var(--muted)", marginBottom: 6 } as const;

  // No `white-space: nowrap` here, deliberately: the tags pill can hold a long
  // comma-separated list, and a nowrap flex item cannot shrink below its content
  // - which pushed the whole list 674px wide inside a 335px column on a phone.
  const pill = {
    borderRadius: 999,
    padding: "4px 8px",
    fontSize: "0.78rem",
    maxWidth: "100%",
    overflowWrap: "anywhere",
  } as const;

  function badgeStyle(badge: string) {
    if (badge === "verified") return { border: "1px solid var(--teal-mid)", background: "var(--teal-pale)", color: "var(--teal-dark)" };
    if (badge === "corrected") return { border: "1px solid var(--gold)", background: "var(--gold-pale)", color: "var(--gold-dark)" };
    if (badge === "error") return { border: "1px solid var(--pink)", background: "#FDF0F1", color: "#8A3A3E" };
    return { border: "1px solid var(--line)", background: "var(--surface)", color: "var(--muted)" };
  }

  return (
    <>
      <div className="mb-4 grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", alignItems: "end" }}>
        <label>
          <div style={label}>חיפוש</div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            type="search"
            placeholder="כותרת / מחבר / שנה / DOI / תג…"
            style={field}
          />
        </label>

        <label>
          <div style={label}>תג רלוונטיות</div>
          <select value={tag} onChange={(e) => setTag(e.target.value)} style={field}>
            <option value="">הכל</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label>
          <div style={label}>סוג מקור</div>
          <select value={type} onChange={(e) => setType(e.target.value)} style={field}>
            <option value="">הכל</option>
            <option value="article">מאמר</option>
            <option value="book">ספר מקצועי</option>
            <option value="web">מקור רשמי/אתר</option>
          </select>
        </label>

        <label>
          <div style={label}>מיון</div>
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} style={field}>
            <option value="year_desc">שנה (חדש→ישן)</option>
            <option value="year_asc">שנה (ישן→חדש)</option>
            <option value="title_asc">כותרת (א→ת)</option>
          </select>
        </label>
      </div>

      <div aria-live="polite" className="mb-4 flex flex-wrap items-center gap-2" style={{ fontSize: "0.95rem", color: "var(--text-2)" }}>
        <span>
          מוצגים <strong>{filtered.length}</strong> מקורות.
        </span>
        <span style={{ ...pill, ...badgeStyle("verified") }}>verified: {counts.verified || 0}</span>
        <span style={{ ...pill, ...badgeStyle("corrected") }}>corrected: {counts.corrected || 0}</span>
        <span style={{ ...pill, ...badgeStyle("unverified") }}>unverified: {counts.unverified || 0}</span>
      </div>

      <div className="grid gap-2.5">
        {filtered.map((it, idx) => {
          const badge = safeText(it.verification_status || "unverified");
          const tagsTxt = (it.tags || []).length ? (it.tags || []).join(", ") : "לא צוינו/unspecified";
          const links = bestLinks(it);

          return (
            <article
              key={`${it.id}-${idx}`}
              className="rounded-2xl"
              style={{ border: "1px solid var(--line)", padding: "12px 14px", background: "var(--bg)", overflowWrap: "anywhere" }}
            >
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <span style={{ ...pill, ...badgeStyle(badge) }}>{badge}</span>
                <span style={{ ...pill, ...badgeStyle("") }}>{safeText(it.type || "article")}</span>
                <span style={{ ...pill, ...badgeStyle("") }}>{tagsTxt}</span>
                {it.origin ? <span style={{ ...pill, ...badgeStyle("") }}>מקור: {safeText(it.origin)}</span> : null}
              </div>

              <p className="mb-1.5" style={{ color: "var(--text)" }}>
                {buildCitation(it)}
              </p>

              {it.annotation_he ? (
                <p className="mb-1.5" style={{ fontSize: "0.92rem", color: "var(--text-2)" }}>
                  <strong>אנוטציה:</strong> {it.annotation_he}
                </p>
              ) : null}

              {it.verification_notes ? (
                <p className="mb-1.5" style={{ fontSize: "0.92rem", color: "var(--text-2)" }}>
                  <strong>הערות אימות:</strong> {it.verification_notes}
                </p>
              ) : null}

              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1" style={{ fontSize: "0.95rem" }}>
                {links.map((l) => (
                  <a
                    key={l.label}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    style={{ color: "var(--teal-dark)", textDecoration: "none", borderBottom: "1px dotted var(--faint)" }}
                  >
                    {l.label}
                  </a>
                ))}
              </div>
            </article>
          );
        })}
      </div>

      <h2 className="mt-6 mb-3 text-lg font-extrabold" style={{ color: "var(--text)" }}>
        טבלת השוואה
      </h2>

      <div className="table-scroll rounded-xl" style={{ overflow: "auto", border: "1px solid var(--line)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 780 }}>
          <thead>
            <tr>
              {["מחברים", "שנה", "סוג", "DOI/URL", "תג", "אימות"].map((h) => (
                <th
                  key={h}
                  style={{
                    position: "sticky",
                    top: 0,
                    background: "var(--surface)",
                    textAlign: "right",
                    padding: 10,
                    borderBottom: "1px solid var(--line)",
                    color: "var(--muted)",
                    fontSize: "0.85rem",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((it) => {
              const primary = doiToUrl(it.doi) || (safeText(it.url) !== "לא צוינו/unspecified" ? safeText(it.url) : "");
              const td = { padding: 10, borderBottom: "1px solid var(--line)", verticalAlign: "top", color: "var(--text-2)" } as const;
              return (
                <tr key={`row-${it.id}`}>
                  <td style={td}>{formatAuthors(it.authors)}</td>
                  <td style={td}>{safeText(it.year) || "לא צוינו/unspecified"}</td>
                  <td style={td}>{safeText(it.type) || "לא צוינו/unspecified"}</td>
                  <td style={td}>
                    {primary ? (
                      <a href={primary} target="_blank" rel="noopener noreferrer nofollow" style={{ color: "var(--teal-dark)" }}>
                        קישור
                      </a>
                    ) : (
                      "לא צוינו/unspecified"
                    )}
                  </td>
                  <td style={td}>{(it.tags || []).join(", ") || "לא צוינו/unspecified"}</td>
                  <td style={td}>{safeText(it.verification_status) || "unverified"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
