"use client";

/**
 * The counsellor's two charts on screen - the same rows the PDF draws
 * (report-charts.ts), shown above the summary so what she downloads is what she
 * has already seen. Plain HTML and CSS, like the committee map.
 */

import { Fragment } from "react";
import {
  PROFILE_LEVEL_LABELS,
  PROFILE_STATUS_LABELS,
  OUTCOME_COLUMNS,
  OUTCOME_COLUMN_LABELS,
  HELPED_LEGEND,
  exhaustionLine,
  type ProfileChart,
  type TriedChart,
} from "@/app/lib/report-charts";

const card = "rounded-2xl p-4 border bg-white";

export function ProfileChartView({ chart }: { chart: ProfileChart }) {
  return (
    <div data-review-id="chart:profile" data-review-label="גרף: תמונת מצב לפי תחום" className={card} style={{ borderColor: "var(--line)" }}>
      <div className="text-sm font-extrabold" style={{ color: "var(--text)" }}>תמונת מצב לפי תחום</div>
      <div className="text-xs mb-3" style={{ color: "var(--muted)" }}>רמת הקושי לפי הדיווח, ומה עלה בפריטי השאלון</div>
      <div className="grid items-center gap-x-3 gap-y-2" style={{ gridTemplateColumns: "64px minmax(0, 1fr) auto", maxWidth: 520 }}>
        <span />
        <div className="grid grid-cols-3 gap-1">
          {PROFILE_LEVEL_LABELS.map(l => (
            <span key={l} className="text-[10.5px] sm:text-xs text-center leading-tight sm:whitespace-nowrap" style={{ color: "var(--muted)" }}>{l}</span>
          ))}
        </div>
        <span />
        {chart.rows.map(r => (
          <Fragment key={r.key}>
            <span className="text-sm font-bold" style={{ color: r.level ? "var(--text)" : "var(--muted)" }}>{r.label}</span>
            <div className="grid grid-cols-3 gap-1" aria-label={`${r.label}: ${r.level ? PROFILE_LEVEL_LABELS[r.level - 1] : "כלל לא"}`}>
              {[1, 2, 3].map(i => (
                <span key={i} className="block h-3 rounded" style={{ background: i <= r.level ? "var(--teal)" : "var(--line)" }} />
              ))}
            </div>
            <span
              className="text-xs"
              style={{
                color: r.status === "urgent" ? "var(--gold-dark)" : r.status === "found" ? "var(--text-2)" : "var(--muted)",
                fontWeight: r.status === "urgent" ? 700 : 500,
              }}
            >
              {PROFILE_STATUS_LABELS[r.status]}
            </span>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

export function TriedChartView({ chart, gan = false }: { chart: TriedChart; gan?: boolean }) {
  return (
    <div data-review-id="chart:tried" data-review-label="גרף: מה נוסה ומה קרה" className={card} style={{ borderColor: "var(--line)" }}>
      <div className="text-sm font-extrabold" style={{ color: "var(--text)" }}>מה נוסה ומה קרה</div>
      <div className="text-xs mb-3" style={{ color: "var(--muted)" }}>{gan ? "ההתערבויות שנוסו בגן ותוצאתן" : "ההתערבויות שנוסו בבית הספר ותוצאתן"}</div>
      {/* The label column is as wide as the longest label, as in the PDF, so a dot sits near its row. */}
      <div className="grid items-center gap-x-3 gap-y-1.5" style={{ gridTemplateColumns: "fit-content(340px) repeat(3, 52px)", justifyContent: "start" }}>
        <span />
        {OUTCOME_COLUMNS.map(o => (
          <span key={o} className="text-[10.5px] sm:text-xs text-center whitespace-nowrap" style={{ color: "var(--muted)" }}>{OUTCOME_COLUMN_LABELS[o]}</span>
        ))}
        {chart.groups.map(g => (
          <Fragment key={g.title}>
            <div className="text-xs font-bold pt-1 pb-0.5 border-b" style={{ gridColumn: "1 / -1", color: "var(--muted)", borderColor: "var(--line)" }}>{g.title}</div>
            {g.rows.map(r => (
              <Fragment key={r.label}>
                <span className="text-xs leading-snug" style={{ color: "var(--text-2)" }}>{r.label}</span>
                {OUTCOME_COLUMNS.map(o => (
                  <span key={o} className="flex justify-center">
                    {o === r.outcome && (
                      <span
                        aria-label={OUTCOME_COLUMN_LABELS[o]}
                        className="block w-3 h-3 rounded-full"
                        style={o === "helped" ? { border: "2px solid var(--muted)" } : { background: "var(--teal)" }}
                      />
                    )}
                  </span>
                ))}
              </Fragment>
            ))}
          </Fragment>
        ))}
      </div>
      {chart.exhaustion && <div className="text-xs font-bold mt-3" style={{ color: "var(--text-2)" }}>{exhaustionLine(chart.exhaustion, gan)}</div>}
      {chart.anyHelped && <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>{HELPED_LEGEND}</div>}
    </div>
  );
}
