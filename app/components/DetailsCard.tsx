/**
 * Collapsible card built on native <details>.
 *
 * Replaces the useState accordion that /research/faq, /research/assessments and
 * /research/therapist-types each hand-rolled. That pattern forced the whole page
 * to be a client component and - the actual cost - kept every answer out of the
 * server-rendered HTML: the pages shipped 184-466 words where the source held
 * thousands. Google does render JavaScript, but on a slower second pass, which
 * is the worst thing to depend on while the site's bottleneck is getting pages
 * indexed at all.
 *
 * <details> collapses without a single line of JavaScript, keeps the content in
 * the initial HTML, and is keyboard- and screen-reader-native for free.
 *
 * Server component on purpose - it must not drag a "use client" boundary back
 * into the pages it was written to free.
 */
export function DetailsCard({
  summary,
  meta,
  icon,
  badge,
  children,
  defaultOpen = false,
}: {
  summary: string;
  /** Optional one-line hint shown under the title while collapsed. */
  meta?: string;
  icon?: string;
  /** Small pill beside the title - a licence, a category. */
  badge?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="details-card overflow-hidden rounded-2xl"
      style={{ background: "var(--bg)", border: "1px solid var(--line)" }}
    >
      <summary
        className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 transition hover:bg-[var(--surface)] [&::-webkit-details-marker]:hidden"
      >
        {icon && (
          <span aria-hidden className="flex-shrink-0 text-2xl">
            {icon}
          </span>
        )}
        <span className="min-w-0 flex-1">
          {/* A real heading, not a styled span: on these pages each card *is* a
              section (a question, an assessment, a profession), and headings are
              how both a screen reader and a crawler find them. */}
          <span className="mb-1 flex flex-wrap items-center gap-2">
            <h2 className="text-base font-extrabold" style={{ color: "var(--text)" }}>
              {summary}
            </h2>
            {badge && (
              <span
                className="rounded-full px-2 py-0.5 text-xs"
                style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--muted)" }}
              >
                {badge}
              </span>
            )}
          </span>
          {meta && (
            <span className="mt-1 block text-[13px] leading-6" style={{ color: "var(--muted)" }}>
              {meta}
            </span>
          )}
        </span>
        <span
          aria-hidden
          className="details-card-toggle flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-lg"
          style={{ background: "var(--teal-pale)", color: "var(--teal-dark)", fontWeight: 300 }}
        >
          +
        </span>
      </summary>
      <div className="px-5 pb-6 pt-3" style={{ borderTop: "1px solid var(--line)" }}>
        {children}
      </div>
    </details>
  );
}
