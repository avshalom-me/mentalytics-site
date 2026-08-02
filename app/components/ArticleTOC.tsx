"use client";

import { useEffect, useState } from "react";

type Item = { id: string; text: string };

/**
 * Table of contents for a long article.
 *
 * Built from the DOM rather than from the source, on purpose: the seventeen
 * editorial guides are hand-written JSX and the community articles are markdown
 * parsed at render time. Scanning the rendered headings is the one approach
 * that works for both without touching a single article's content.
 *
 * Headings without an id get a generated one so the anchors work regardless of
 * how the article was authored.
 */
export default function ArticleTOC() {
  const [items, setItems] = useState<Item[]>([]);
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    const body = document.getElementById("article-body");
    if (!body) return;

    const headings = Array.from(body.querySelectorAll("h2")).filter((h) => (h.textContent ?? "").trim().length > 1);
    const next: Item[] = headings.map((h, i) => {
      if (!h.id) h.id = `section-${i + 1}`;
      // Anchor targets sit under a sticky header on some viewports; the offset
      // keeps the heading visible after a jump.
      h.style.scrollMarginTop = "80px";
      return { id: h.id, text: (h.textContent ?? "").trim() };
    });
    setItems(next);
    if (next.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -65% 0px", threshold: 0 }
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, []);

  // Below four headings a contents list is noise, not navigation.
  if (items.length < 4) return null;

  return (
    <nav aria-label="תוכן העניינים">
      <p
        style={{
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: ".12em",
          color: "var(--muted)",
          marginBottom: "10px",
        }}
      >
        בעמוד הזה
      </p>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "2px" }}>
        {items.map((it) => {
          const on = it.id === active;
          return (
            <li key={it.id}>
              <a
                href={`#${it.id}`}
                style={{
                  display: "block",
                  fontSize: "13.5px",
                  lineHeight: 1.55,
                  padding: "5px 10px",
                  borderRadius: "8px",
                  textDecoration: "none",
                  color: on ? "var(--teal-dark)" : "var(--text-2)",
                  background: on ? "var(--teal-pale)" : "transparent",
                  fontWeight: on ? 700 : 400,
                  borderInlineStart: on ? "2px solid var(--teal)" : "2px solid transparent",
                  transition: "background .18s, color .18s",
                }}
              >
                {it.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
