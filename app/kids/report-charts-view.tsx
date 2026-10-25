"use client";

/**
 * The counsellor's charts on screen - the same rows and the same colours the
 * PDF draws (report-charts.ts), shown above the summary so what she downloads
 * is what she has already seen. Plain HTML and CSS, like the committee map.
 */

import {
  LEVEL_TONES,
  URGENT_RING,
  URGENT_FG,
  OUTCOME_TONES,
  OUTCOME_ORDER,
  OUTCOME_LABELS_SHORT,
  PROFILE_LEVEL_LABELS,
  PROFILE_TILE_LEVELS,
  PROFILE_STATUS_LABELS,
  PROFILE_URGENT_LEGEND,
  HELPED_LEGEND,
  PATH_NOTE,
  type PathChart,
  type ProfileChart,
  type TriedChart,
} from "@/app/lib/report-charts";

const card = "rounded-2xl p-4 border bg-white";

function Swatch({ fill, border = fill, label }: { fill: string; border?: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--muted)" }}>
      <span className="inline-block rounded-[3px]" style={{ width: 14, height: 10, background: fill, border: `1.5px solid ${border}`, boxSizing: "border-box" }} />
      {label}
    </span>
  );
}

export function ProfileChartView({ chart }: { chart: ProfileChart }) {
  return (
    <div data-review-id="chart:profile" data-review-label="גרף: תמונת מצב לפי תחום" className={card} style={{ borderColor: "var(--line)" }}>
      <div className="text-sm font-extrabold" style={{ color: "var(--text)" }}>תמונת מצב לפי תחום</div>
      <div className="text-xs mb-3" style={{ color: "var(--muted)" }}>רמת הקושי לפי הדיווח, ומה עלה בפריטי השאלון</div>
      <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))", maxWidth: 560 }}>
        {chart.rows.map(r => {
          const tone = LEVEL_TONES[r.level];
          return (
            <div key={r.key}>
              <div className="rounded-[15px] p-[2px]" style={{ border: `2px solid ${r.status === "urgent" ? URGENT_RING : "transparent"}` }}>
                <div
                  className="rounded-xl text-center px-1 pt-3 pb-2.5"
                  style={{ background: tone.bg, border: `1px ${r.level === 0 ? "dashed" : "solid"} ${tone.border}` }}
                  aria-label={`${r.label}: ${PROFILE_TILE_LEVELS[r.level]}`}
                >
                  <div className="text-[15px] font-extrabold leading-tight" style={{ color: tone.fg }}>{r.label}</div>
                  <div className="text-xs mt-0.5" style={{ color: tone.fg }}>{PROFILE_TILE_LEVELS[r.level]}</div>
                </div>
              </div>
              <div
                className="text-[11px] text-center mt-1 leading-snug"
                style={{
                  color: r.status === "urgent" ? URGENT_FG : r.status === "found" ? "var(--teal-dark)" : "var(--muted)",
                  fontWeight: r.status === "urgent" || r.status === "found" ? 700 : 500,
                }}
              >
                {PROFILE_STATUS_LABELS[r.status] || " "}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3.5 gap-y-1 mt-3">
        {PROFILE_LEVEL_LABELS.map((l, i) => <Swatch key={l} fill={LEVEL_TONES[i + 1].bg} border={LEVEL_TONES[i + 1].border} label={l} />)}
        {chart.rows.some(r => r.status === "urgent") && <Swatch fill="#FFFFFF" border={URGENT_RING} label={PROFILE_URGENT_LEGEND} />}
      </div>
    </div>
  );
}

export function TriedChartView({ chart, path, gan = false }: { chart: TriedChart; path?: PathChart | null; gan?: boolean }) {
  const present = OUTCOME_ORDER.filter(o => chart.counts[o] > 0);
  return (
    <div data-review-id="chart:tried" data-review-label="גרף: מה נוסה ומה קרה" className={card} style={{ borderColor: "var(--line)" }}>
      <div className="text-sm font-extrabold" style={{ color: "var(--text)" }}>מה נוסה ומה קרה</div>
      <div className="text-xs mb-3" style={{ color: "var(--muted)" }}>{gan ? "ההתערבויות שנוסו בגן ותוצאתן" : "ההתערבויות שנוסו בבית הספר ותוצאתן"}</div>
      <div className="flex items-center gap-3 mb-1.5">
        <span className="text-sm font-extrabold whitespace-nowrap" style={{ color: "var(--text)" }}>{chart.total} ניסיונות</span>
        <div className="flex gap-0.5 h-3 flex-1 rounded-full overflow-hidden" style={{ maxWidth: 380 }}>
          {present.map(o => <span key={o} className="block" style={{ flex: `${chart.counts[o]} 1 0`, background: OUTCOME_TONES[o].fill }} />)}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-3.5 gap-y-1 mb-3">
        {present.map(o => <Swatch key={o} fill={OUTCOME_TONES[o].fill} label={`${OUTCOME_LABELS_SHORT[o]} ${chart.counts[o]}`} />)}
      </div>
      <div className="space-y-2">
        {chart.groups.map(g => (
          <div key={g.title} className="grid gap-x-2.5 items-start" style={{ gridTemplateColumns: "56px minmax(0, 1fr)" }}>
            <div className="text-xs font-bold pt-1" style={{ color: "var(--muted)" }}>{g.title}</div>
            <div className="flex flex-wrap gap-1.5">
              {g.rows.map(r => {
                const t = OUTCOME_TONES[r.outcome];
                return (
                  <span key={r.label} className="inline-block rounded-full px-2.5 py-0.5 text-xs leading-relaxed" style={{ background: t.bg, border: `1.5px solid ${t.border}`, color: "var(--text-2)" }}>
                    {r.label}
                    <span className="font-bold" style={{ color: t.fg }}> · {OUTCOME_LABELS_SHORT[r.outcome]}</span>
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {chart.anyHelped && <div className="text-xs mt-2.5" style={{ color: "var(--muted)" }}>{HELPED_LEGEND}</div>}
      {path && <PathView path={path} />}
    </div>
  );
}

/** The way to the committee on its own, when too little was tried for the attempts chart. */
export function PathChartView({ path }: { path: PathChart }) {
  return (
    <div className={card} style={{ borderColor: "var(--line)" }}>
      <PathView path={path} first />
    </div>
  );
}

/** The way to the committee - inside the attempts card, because it is read from them. */
function PathView({ path, first = false }: { path: PathChart; first?: boolean }) {
  const reached = (i: number) => path.stations.slice(0, i + 1).every(s => s.state === "done" || s.state === "next");
  return (
    <div data-review-id="chart:path" data-review-label="גרף: הדרך לוועדה" className={first ? "" : "mt-4 pt-3"} style={first ? undefined : { borderTop: "1px solid var(--line)" }}>
      <div className="text-xs font-bold mb-3" style={{ color: "var(--muted)" }}>{path.title}</div>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${path.stations.length}, minmax(0, 1fr))`, maxWidth: 620 }}>
        {path.stations.map((s, i) => (
          <div key={s.key} className="relative text-center px-1">
            {i < path.stations.length - 1 && (
              <div className="absolute" style={{ top: 12, height: 3, width: "100%", insetInlineStart: "50%", background: reached(i + 1) ? "var(--teal)" : "var(--line)" }} />
            )}
            <div
              className="relative mx-auto rounded-full flex items-center justify-center text-[13px] font-extrabold"
              style={{
                width: 26, height: 26, boxSizing: "border-box",
                ...(s.state === "done" ? { background: "var(--teal)", color: "white" }
                  : s.state === "missing" ? { background: "white", border: `2px solid ${URGENT_RING}`, color: URGENT_FG }
                    : s.state === "next" ? { background: URGENT_RING, border: "4px solid var(--gold-pale)" }
                      : { background: "white", border: "2px solid var(--teal-mid)" }),
              }}
            >
              {s.state === "done" ? "✓" : s.state === "missing" ? "!" : ""}
            </div>
            <div className="text-xs font-bold mt-1.5 leading-snug" style={{ color: s.state === "ahead" ? "var(--muted)" : "var(--text)" }}>{s.label}</div>
            <div
              className="text-[11px] leading-snug"
              style={{ color: s.state === "done" ? "var(--teal-dark)" : s.state === "ahead" ? "var(--muted)" : URGENT_FG, fontWeight: s.state === "ahead" ? 500 : 700 }}
            >
              {s.state === "next" ? `השלב הבא · ${s.sub}` : s.sub}
            </div>
          </div>
        ))}
      </div>
      <div className="text-[11px] mt-2.5" style={{ color: "var(--muted)" }}>{PATH_NOTE}</div>
    </div>
  );
}
