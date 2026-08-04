/**
 * Appeal windows drawn to scale.
 *
 * The point this chart exists to make is a single one: the windows for
 * appealing to a committee are an order of magnitude shorter than the window
 * for going to the labour court, and people miss them because a letter arrives
 * during a bad month and nothing on it looks urgent. A table states that; a
 * linear scale shows it. That is the whole reason the bars are linear rather
 * than normalised - flattening the difference would delete the finding.
 *
 * Windows are parsed from the same strings the table renders, so the chart can
 * never drift from the sourced data. Anything unparseable (a track where the
 * official page does not state a window) renders as a labelled row without a
 * bar rather than being silently dropped or given an invented number.
 */

type Appeal = { against: string; window: string; to: string };

const DAY = /(\d+)\s*(?:ימים|יום)/;
const MONTH = /(\d+)\s*(?:חודשים|חודש)/;

/** Returns days, or null when the source text states no number. */
export function windowInDays(window: string): number | null {
  if (window.includes("חודשיים")) return 60;
  const m = MONTH.exec(window);
  if (m) return Number(m[1]) * 30;
  const d = DAY.exec(window);
  if (d) return Number(d[1]);
  return null;
}

export default function BtlDeadlines({ appeals }: { appeals: Appeal[] }) {
  const rows = appeals.map((a) => ({ ...a, days: windowInDays(a.window) }));
  const max = Math.max(...rows.map((r) => r.days ?? 0), 1);

  return (
    <figure style={{ margin: 0 }}>
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "16px",
          padding: "22px 20px",
        }}
      >
        {rows.map((r, idx) => {
          // Short windows are the ones that matter, so they get a floor: a
          // 30-day bar at true scale against 365 is 8% wide and reads as noise.
          const pct = r.days ? Math.max((r.days / max) * 100, 7) : 0;
          const urgent = r.days !== null && r.days <= 90;
          return (
            <div key={r.against} style={{ marginBottom: idx === rows.length - 1 ? 0 : "18px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: "12px",
                  marginBottom: "6px",
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)" }}>{r.against}</span>
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 800,
                    color: urgent ? "var(--gold-dark)" : "var(--teal-dark)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.window}
                </span>
              </div>

              {r.days !== null ? (
                <div
                  style={{
                    background: "var(--bg)",
                    border: "1px solid var(--line)",
                    borderRadius: "50px",
                    height: "14px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: "100%",
                      borderRadius: "50px",
                      background: urgent ? "var(--gold)" : "var(--teal)",
                    }}
                  />
                </div>
              ) : (
                <p style={{ fontSize: "12.5px", color: "var(--muted)", fontStyle: "italic", margin: 0 }}>
                  העמוד הרשמי אינו נוקב במועד - יש לברר מול הסניף
                </p>
              )}

              <p style={{ fontSize: "12.5px", color: "var(--muted)", marginTop: "5px" }}>{r.to}</p>
            </div>
          );
        })}
      </div>

      <figcaption style={{ fontSize: "12.5px", color: "var(--muted)", marginTop: "10px", lineHeight: 1.7 }}>
        אורך העמודות ביחס נכון זה לזה. הפער הוא הנקודה: לוועדות יש חלון של שבועות, ולבית הדין
        חלון של שנה - ולכן דווקא המכתב שנראה הכי פחות דחוף הוא זה שצריך לטפל בו ראשון.
      </figcaption>
    </figure>
  );
}
