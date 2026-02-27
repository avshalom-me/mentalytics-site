"use client";

import React, { useEffect, useMemo, useState } from "react";

type SourceItem = {
  id: string;
  origin?: string;
  raw?: string;
  authors?: string[];
  year?: number | string;
  title?: string;
  container?: string;
  type?: "article" | "book" | "web" | string;
  doi?: string;
  url?: string;
  abstract_url?: string;
  full_text_url?: string;
  tags?: string[];
  annotation_he?: string;
  verification_status?: "verified" | "corrected" | "unverified" | "error" | string;
  verification_notes?: string;
};

const DATA_URL = "/assets/validated_sources.json"; // הקובץ שיושב ב: public/assets/validated_sources.json

function safeText(v: unknown) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function norm(v: unknown) {
  return safeText(v).toLowerCase().trim();
}

function doiToUrl(doi?: string) {
  const d = safeText(doi);
  if (!d || d === "לא צוינו/unspecified") return "";
  if (d.startsWith("http")) return d;
  return `https://doi.org/${d}`;
}

function formatAuthors(authors?: string[]) {
  if (!authors || authors.length === 0) return "לא צוינו/unspecified";
  // בקובץ הנוכחי שמרתי "מחרוזת מחברים" בתא הראשון של המערך (כדי לא לשבור שמות)
  return authors.join("; ");
}

function buildCitation(it: SourceItem) {
  const authors = formatAuthors(it.authors);
  const year = safeText(it.year) || "לא צוינו/unspecified";
  const title = safeText(it.title) || "לא צוינו/unspecified";
  const container = safeText(it.container) || "לא צוינו/unspecified";
  return `${authors} (${year}). ${title}. ${container}`;
}

function bestLinks(it: SourceItem) {
  const links: { label: string; url: string }[] = [];

  const doiUrl = doiToUrl(it.doi);
  if (doiUrl) links.push({ label: "DOI", url: doiUrl });

  const abs = safeText(it.abstract_url);
  if (abs && abs !== "לא צוינו/unspecified") links.push({ label: "תקציר/עמוד מקור", url: abs });

  const full = safeText(it.full_text_url);
  if (full && full !== "לא צוינו/unspecified") links.push({ label: "טקסט מלא/PMC", url: full });

  const url = safeText(it.url);
  if (url && url !== "לא צוינו/unspecified" && !doiUrl) links.push({ label: "Publisher/Source", url });

  const title = safeText(it.title);
  if (title) {
    links.push({
      label: "Google Scholar",
      url: `https://scholar.google.com/scholar?q=${encodeURIComponent(title)}`,
    });
  }

  return links;
}

export default function AcademicArticlesPage() {
  const [data, setData] = useState<SourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [type, setType] = useState("");
  const [sort, setSort] = useState<"year_desc" | "year_asc" | "title_asc">("year_desc");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const res = await fetch(DATA_URL, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!Array.isArray(json)) throw new Error("JSON is not an array");
        setData(json);
      } catch (e: any) {
        setErr(e?.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    data.forEach((it) => (it.tags || []).forEach((t) => t && s.add(t)));
    return Array.from(s).sort((a, b) => a.localeCompare(b, "he"));
  }, [data]);

  const filtered = useMemo(() => {
    const query = norm(q);

    const list = data.filter((it) => {
      if (tag && !(it.tags || []).includes(tag)) return false;
      if (type && safeText(it.type) !== type) return false;

      if (!query) return true;
      const hay = [
        formatAuthors(it.authors),
        it.title,
        it.container,
        it.year,
        it.doi,
        (it.tags || []).join(" "),
      ]
        .map(norm)
        .join(" | ");

      return hay.includes(query);
    });

    const sorted = [...list].sort((a, b) => {
      const ya = Number(a.year || 0);
      const yb = Number(b.year || 0);

      if (sort === "year_asc") return ya - yb;
      if (sort === "year_desc") return yb - ya;

      const ta = safeText(a.title);
      const tb = safeText(b.title);
      return ta.localeCompare(tb, "he");
    });

    return sorted;
  }, [data, q, tag, type, sort]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    filtered.forEach((it) => {
      const k = safeText(it.verification_status) || "unverified";
      c[k] = (c[k] || 0) + 1;
    });
    return c;
  }, [filtered]);

  return (
    <section dir="rtl" lang="he" style={{ maxWidth: 980, margin: "0 auto", padding: 16, fontFamily: "system-ui, Arial", lineHeight: 1.6 }}>
      <h2 style={{ marginTop: 0 }}>המאמרים האקדמאיים</h2>

      <p style={{ fontSize: "1.05rem", margin: "0 0 14px" }}>
        השאלונים וההתאמה בנויים על בסיס מחקר בן כשנתיים המבוסס על מאות מחקרים אקדמאיים. אנו מצרפים את המאמרים הללו ואת המקורות שלהם.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 0.9fr 0.8fr 0.8fr",
          gap: 10,
          alignItems: "end",
          marginBottom: 14,
        }}
      >
        <label>
          <div style={{ fontSize: "0.85rem", opacity: 0.85, marginBottom: 6 }}>חיפוש</div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            type="search"
            placeholder="כותרת / מחבר / שנה / DOI / תג…"
            style={{ width: "100%", padding: 10, border: "1px solid #d7d7d7", borderRadius: 10, fontSize: "0.95rem" }}
          />
        </label>

        <label>
          <div style={{ fontSize: "0.85rem", opacity: 0.85, marginBottom: 6 }}>תג רלוונטיות</div>
          <select
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            style={{ width: "100%", padding: 10, border: "1px solid #d7d7d7", borderRadius: 10, fontSize: "0.95rem" }}
          >
            <option value="">הכל</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label>
          <div style={{ fontSize: "0.85rem", opacity: 0.85, marginBottom: 6 }}>סוג מקור</div>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            style={{ width: "100%", padding: 10, border: "1px solid #d7d7d7", borderRadius: 10, fontSize: "0.95rem" }}
          >
            <option value="">הכל</option>
            <option value="article">מאמר</option>
            <option value="book">ספר מקצועי</option>
            <option value="web">מקור רשמי/אתר</option>
          </select>
        </label>

        <label>
          <div style={{ fontSize: "0.85rem", opacity: 0.85, marginBottom: 6 }}>מיון</div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            style={{ width: "100%", padding: 10, border: "1px solid #d7d7d7", borderRadius: 10, fontSize: "0.95rem" }}
          >
            <option value="year_desc">שנה (חדש→ישן)</option>
            <option value="year_asc">שנה (ישן→חדש)</option>
            <option value="title_asc">כותרת (א→ת)</option>
          </select>
        </label>
      </div>

      <div aria-live="polite" style={{ margin: "10px 0 14px", fontSize: "0.95rem" }}>
        {loading ? (
          <div style={{ border: "1px solid #e6e6e6", borderRadius: 14, padding: 12, background: "#fff" }}>טוען מקורות…</div>
        ) : err ? (
          <div style={{ border: "1px solid #ffb4b4", borderRadius: 14, padding: 12, background: "#fff0f0" }}>
            <strong>שגיאה בטעינת מקורות.</strong>
            <div style={{ marginTop: 6 }}>
              ודא שהקובץ נמצא בנתיב: <code>public/assets/validated_sources.json</code>
            </div>
            <div style={{ marginTop: 6, opacity: 0.9 }}>פרטים: {err}</div>
          </div>
        ) : (
          <div>
            מוצגים <strong>{filtered.length}</strong> מקורות.&nbsp;
            <span style={{ border: "1px solid #a7d7a7", background: "#effbea", borderRadius: 999, padding: "4px 8px", fontSize: "0.78rem" }}>
              verified: {counts.verified || 0}
            </span>{" "}
            <span style={{ border: "1px solid #ffd38a", background: "#fff6e6", borderRadius: 999, padding: "4px 8px", fontSize: "0.78rem" }}>
              corrected: {counts.corrected || 0}
            </span>{" "}
            <span style={{ border: "1px solid #d6d6d6", background: "#f7f7f7", borderRadius: 999, padding: "4px 8px", fontSize: "0.78rem" }}>
              unverified: {counts.unverified || 0}
            </span>
          </div>
        )}
      </div>

      {!loading && !err && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
            {filtered.map((it) => {
              const badge = safeText(it.verification_status || "unverified");
              const tagsTxt = (it.tags || []).length ? (it.tags || []).join(", ") : "לא צוינו/unspecified";
              const links = bestLinks(it);

              const badgeStyle: React.CSSProperties =
                badge === "verified"
                  ? { border: "1px solid #a7d7a7", background: "#effbea" }
                  : badge === "corrected"
                  ? { border: "1px solid #ffd38a", background: "#fff6e6" }
                  : badge === "error"
                  ? { border: "1px solid #ffb4b4", background: "#fff0f0" }
                  : { border: "1px solid #d6d6d6", background: "#f7f7f7" };

              return (
                <article key={it.id} style={{ border: "1px solid #e6e6e6", borderRadius: 14, padding: "12px 14px", background: "#fff" }}>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ ...badgeStyle, borderRadius: 999, padding: "4px 8px", fontSize: "0.78rem", whiteSpace: "nowrap" }}>{badge}</span>
                    <span style={{ border: "1px solid #ddd", background: "#f7f7f7", borderRadius: 999, padding: "4px 8px", fontSize: "0.78rem" }}>
                      {safeText(it.type || "article")}
                    </span>
                    <span style={{ border: "1px solid #ddd", background: "#f7f7f7", borderRadius: 999, padding: "4px 8px", fontSize: "0.78rem" }}>
                      {tagsTxt}
                    </span>
                    {it.origin ? (
                      <span style={{ border: "1px solid #ddd", background: "#f7f7f7", borderRadius: 999, padding: "4px 8px", fontSize: "0.78rem" }}>
                        מקור: {safeText(it.origin)}
                      </span>
                    ) : null}
                  </div>

                  <p style={{ margin: "0 0 6px" }}>{buildCitation(it)}</p>

                  {it.annotation_he ? (
                    <p style={{ fontSize: "0.92rem", opacity: 0.95, margin: "0 0 6px" }}>
                      <strong>אנוטציה:</strong> {it.annotation_he}
                    </p>
                  ) : null}

                  {it.verification_notes ? (
                    <p style={{ fontSize: "0.92rem", opacity: 0.95, margin: "0 0 6px" }}>
                      <strong>הערות אימות:</strong> {it.verification_notes}
                    </p>
                  ) : null}

                  <div style={{ marginTop: 6, fontSize: "0.95rem" }}>
                    {links.map((l) => (
                      <a key={l.label} href={l.url} target="_blank" rel="noopener" style={{ marginLeft: 10, textDecoration: "none", borderBottom: "1px dotted #666" }}>
                        {l.label}
                      </a>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>

          <h3 style={{ marginTop: 18 }}>טבלת השוואה</h3>

          <div style={{ overflow: "auto", border: "1px solid #e6e6e6", borderRadius: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 780 }}>
              <thead>
                <tr>
                  {["מחברים", "שנה", "סוג", "DOI/URL", "תג", "אימות"].map((h) => (
                    <th key={h} style={{ position: "sticky", top: 0, background: "#fafafa", textAlign: "right", padding: 10, borderBottom: "1px solid #eee" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((it) => {
                  const primary = doiToUrl(it.doi) || (safeText(it.url) !== "לא צוינו/unspecified" ? safeText(it.url) : "");
                  return (
                    <tr key={`row-${it.id}`}>
                      <td style={{ padding: 10, borderBottom: "1px solid #eee", verticalAlign: "top" }}>{formatAuthors(it.authors)}</td>
                      <td style={{ padding: 10, borderBottom: "1px solid #eee", verticalAlign: "top" }}>{safeText(it.year) || "לא צוינו/unspecified"}</td>
                      <td style={{ padding: 10, borderBottom: "1px solid #eee", verticalAlign: "top" }}>{safeText(it.type) || "לא צוינו/unspecified"}</td>
                      <td style={{ padding: 10, borderBottom: "1px solid #eee", verticalAlign: "top" }}>
                        {primary ? (
                          <a href={primary} target="_blank" rel="noopener" style={{ textDecoration: "none", borderBottom: "1px dotted #666" }}>
                            קישור
                          </a>
                        ) : (
                          "לא צוינו/unspecified"
                        )}
                      </td>
                      <td style={{ padding: 10, borderBottom: "1px solid #eee", verticalAlign: "top" }}>{(it.tags || []).join(", ") || "לא צוינו/unspecified"}</td>
                      <td style={{ padding: 10, borderBottom: "1px solid #eee", verticalAlign: "top" }}>{safeText(it.verification_status) || "unverified"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <details style={{ marginTop: 14 }}>
            <summary>הערות על סטטוס אימות</summary>
            <p style={{ marginTop: 8 }}>
              <strong>verified</strong> = יש DOI/קישור רשמי; <strong>corrected</strong> = תוקן מול מקור;{" "}
              <strong>unverified</strong> = חסרים פרטים/אין DOI או קישור רשמי.
            </p>
          </details>
        </>
      )}
    </section>
  );
}