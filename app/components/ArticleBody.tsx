import Link from "next/link";
import type { ReactNode } from "react";

// Renders an article body written in a small, safe subset of Markdown. Authors
// (therapists + admin) write plain text; a line starting with "## " / "### "
// becomes a heading, consecutive "- " / "• " lines become a bullet list, and
// inline [text](url) / **bold** are supported. Everything is built from parsed
// React nodes (never dangerouslySetInnerHTML), so author text can't inject HTML.
// Plain-text bodies with no markers render exactly as before (all paragraphs).

// Only these href shapes become real links; anything else (e.g. javascript:)
// falls back to plain text so a submitted article can't smuggle a bad URL.
function safeHref(href: string): string | null {
  return /^(https?:\/\/|\/|mailto:)/i.test(href) ? href : null;
}

function parseInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1] !== undefined && m[2] !== undefined) {
      const href = safeHref(m[2].trim());
      if (!href) {
        nodes.push(m[1]);
      } else if (href.startsWith("/")) {
        nodes.push(
          <Link key={key++} href={href} className="font-semibold text-[#2e7d8c] hover:underline">
            {m[1]}
          </Link>
        );
      } else {
        nodes.push(
          <a
            key={key++}
            href={href}
            target={href.startsWith("mailto:") ? undefined : "_blank"}
            rel="noopener noreferrer"
            className="font-semibold text-[#2e7d8c] hover:underline"
          >
            {m[1]}
          </a>
        );
      }
    } else if (m[3] !== undefined) {
      nodes.push(<strong key={key++}>{m[3]}</strong>);
    }
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function ArticleBody({ body }: { body: string }) {
  const blocks = body
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  return (
    <article className="space-y-5">
      {blocks.map((block, i) => {
        // Inline image: a block that is exactly ![alt](url) or ![alt](url "caption").
        const img = block.match(/^!\[([^\]]*)\]\((https?:\/\/[^)\s]+)(?:\s+"([^"]*)")?\)$/);
        if (img) {
          const [, alt, src, caption] = img;
          return (
            <figure key={i} className="my-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={alt} loading="lazy" className="w-full rounded-xl border border-[#E8E0D8]" />
              {caption && <figcaption className="mt-2 text-center text-sm text-stone-500">{caption}</figcaption>}
            </figure>
          );
        }
        // Pull-quote: a block whose every line starts with "> ".
        const qlines = block.split("\n");
        if (qlines.every((l) => /^\s*>\s?/.test(l))) {
          const quote = qlines.map((l) => l.replace(/^\s*>\s?/, "")).join(" ");
          return (
            <blockquote
              key={i}
              className="my-8 flex items-start gap-3 rounded-e-2xl border-s-4 border-[#3D8C8A] bg-[#EAF4F3] py-5 pe-6 ps-5"
            >
              <span aria-hidden className="-mt-1 text-5xl font-black leading-none text-[#3D8C8A]">&#8221;</span>
              <p className="self-center text-[21px] font-bold leading-[1.55] text-[#2A6462] md:text-[25px]">
                {parseInline(quote)}
              </p>
            </blockquote>
          );
        }
        if (block.startsWith("## ")) {
          return (
            <h2 key={i} className="text-2xl md:text-[30px] font-black text-stone-900 pt-4">
              {parseInline(block.slice(3).trim())}
            </h2>
          );
        }
        if (block.startsWith("### ")) {
          return (
            <h3 key={i} className="text-[21px] md:text-[24px] font-bold text-stone-900 pt-2">
              {parseInline(block.slice(4).trim())}
            </h3>
          );
        }
        const lines = block.split("\n");
        const isList = lines.every((l) => /^\s*[-•]\s+/.test(l));
        if (isList) {
          return (
            <ul key={i} className="list-disc space-y-2 pr-6 text-[18px] leading-8 text-stone-700 md:text-[21px] md:leading-9">
              {lines.map((l, j) => (
                <li key={j}>{parseInline(l.replace(/^\s*[-•]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="text-[18px] leading-8 text-stone-700 md:text-[21px] md:leading-9">
            {parseInline(lines.join(" "))}
          </p>
        );
      })}
    </article>
  );
}
