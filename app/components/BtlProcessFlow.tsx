import type { TrackStep } from "@/app/lib/btl-tracks";

/**
 * The bureaucratic route, drawn.
 *
 * A claims process is a sequence with gates, and prose hides that: a reader
 * three paragraphs in has lost track of whether they are before or after the
 * committee. Drawing it as a numbered spine with the form number attached to
 * the step that needs it lets someone find where they are standing without
 * reading from the top.
 *
 * Built from divs rather than an SVG so it reflows on a phone and the text
 * stays selectable and readable by a screen reader - the people who need this
 * page are often filling forms one-handed on a phone in a waiting room.
 */
export default function BtlProcessFlow({ steps }: { steps: TrackStep[] }) {
  return (
    <ol
      style={{ listStyle: "none", margin: "0 0 8px", padding: 0, display: "flex", flexDirection: "column", gap: 0 }}
      aria-label="שלבי התהליך"
    >
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={s.title} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "16px" }}>
            {/* Spine: numbered node + connector down to the next step */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "50%",
                  background: "var(--teal)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 900,
                  fontSize: "17px",
                  flexShrink: 0,
                  fontVariantNumeric: "tabular-nums",
                }}
                aria-hidden="true"
              >
                {i + 1}
              </div>
              {!last && <div style={{ width: "2px", flex: 1, background: "var(--teal-mid)", minHeight: "18px" }} aria-hidden="true" />}
            </div>

            <div style={{ paddingBottom: last ? 0 : "26px" }}>
              <div className="flex flex-wrap items-center gap-2" style={{ marginBottom: "6px" }}>
                <h3 style={{ fontSize: "16.5px", fontWeight: 800, color: "var(--text)", margin: 0 }}>{s.title}</h3>
                {s.form && (
                  <span
                    dir="ltr"
                    style={{
                      background: "var(--gold-pale)",
                      border: "1px solid var(--gold)",
                      color: "var(--gold-dark)",
                      borderRadius: "50px",
                      padding: "2px 10px",
                      fontSize: "12.5px",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    טופס {s.form}
                  </span>
                )}
              </div>
              <p style={{ fontSize: "15px", lineHeight: 1.85, color: "var(--text-2)", margin: 0 }}>{s.body}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * "Which track am I on?" - the question that has to be answered before any of
 * the guides are useful, and the one the official site answers worst because
 * each benefit lives on its own page with no map between them.
 */
export function BtlTrackChooser({
  tracks,
}: {
  tracks: { slug: string; name: string; trigger: string; fundsTherapyDirectly: boolean }[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {tracks.map((t) => (
        <a
          key={t.slug}
          href={`/research/btl/${t.slug}`}
          className="rounded-2xl bg-white p-5 transition hover:shadow-md hover:-translate-y-0.5"
          style={{ border: "1px solid var(--line)", textDecoration: "none", display: "block" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div style={{ fontSize: "12.5px", color: "var(--faint)", marginBottom: "2px" }}>אם</div>
              <div style={{ fontSize: "15px", color: "var(--text-2)", lineHeight: 1.6, marginBottom: "10px" }}>{t.trigger}</div>
              <div style={{ fontSize: "17px", fontWeight: 900, color: "var(--teal-dark)" }}>{t.name} ←</div>
            </div>
          </div>
          <div
            style={{
              marginTop: "12px",
              paddingTop: "10px",
              borderTop: "1px solid var(--line)",
              fontSize: "12.5px",
              fontWeight: 600,
              color: t.fundsTherapyDirectly ? "var(--teal)" : "var(--muted)",
            }}
          >
            {t.fundsTherapyDirectly ? "✓ מממן טיפול נפשי ישירות" : "○ קצבה כספית, לא מימון טיפול"}
          </div>
        </a>
      ))}
    </div>
  );
}
