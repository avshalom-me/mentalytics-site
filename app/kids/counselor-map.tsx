"use client";

/**
 * The committee map as a picture: a flow of the four stations with this
 * student's live tracks lit up, and the school year as a line with the
 * computed deadlines and today on it.
 *
 * Plain HTML and CSS rather than SVG on purpose. The report is captured to
 * PDF by html2canvas, which rasterises inline SVG through an image and loses
 * the page's web font on the way; DOM boxes keep Heebo and keep RTL. Every
 * colour is a page token, so the picture reads the same on screen and in the
 * capture.
 */

import {
  zakautWindow,
  schoolYear,
  isoDiffDays,
  formatDateHe,
  type SchoolTrack,
  type Relevance,
  type TrackKey,
} from "@/app/lib/school-tracks";

type Tone = Relevance | "absent";

const TONE: Record<Tone, { border: string; bg: string; fg: string; badge?: string; opacity: number }> = {
  primary:  { border: "var(--gold)",  bg: "var(--gold-pale)",  fg: "var(--gold-dark)",  badge: "עכשיו",   opacity: 1 },
  consider: { border: "var(--teal)",  bg: "var(--teal-pale)",  fg: "var(--teal-dark)",  badge: "לשיקול", opacity: 1 },
  info:     { border: "var(--line)",  bg: "var(--surface)",    fg: "var(--muted)",                        opacity: 1 },
  absent:   { border: "var(--line)",  bg: "transparent",       fg: "var(--faint)",                        opacity: 0.7 },
};

function toneOf(tracks: SchoolTrack[], key: TrackKey): Tone {
  return tracks.find(t => t.key === key)?.relevance ?? "absent";
}

function Node({ title, sub, tone, dashed = false }: { title: string; sub?: string; tone: Tone; dashed?: boolean }) {
  const t = TONE[tone];
  return (
    <div
      className="rounded-xl px-3 py-2.5 text-center"
      style={{ border: `2px ${dashed ? "dashed" : "solid"} ${t.border}`, background: t.bg, opacity: t.opacity }}
    >
      <div className="flex items-center justify-center gap-2">
        <span className="text-sm font-extrabold" style={{ color: tone === "absent" ? "var(--muted)" : "var(--text)" }}>{title}</span>
        {t.badge && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "white", color: t.fg, border: `1px solid ${t.border}` }}>{t.badge}</span>
        )}
      </div>
      {sub && <div className="text-xs mt-0.5" style={{ color: t.fg }}>{sub}</div>}
    </div>
  );
}

/** A row of downward arrows, one per column, between two rows of nodes. */
function Arrows({ cols }: { cols: 1 | 2 }) {
  return (
    <div className={`grid ${cols === 2 ? "grid-cols-2" : "grid-cols-1"} h-6`}>
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="flex justify-center items-center text-base leading-none" style={{ color: "var(--faint)" }}>↓</div>
      ))}
    </div>
  );
}

/**
 * showHatamot: the accommodations column is drawn only from ח'.
 *
 * The stations are drawn whether or not this student has a live track on them,
 * because the shape of the route is the point - but a station that will not
 * exist for this student for another four years is not part of her route, and
 * drawing it greyed out still puts the words on the page.
 */
export function TrackFlow({ tracks, showHatamot = true }: { tracks: SchoolTrack[]; showHatamot?: boolean }) {
  const team = toneOf(tracks, "school_team");
  const assessment = toneOf(tracks, "assessment");
  const zakaut = toneOf(tracks, "zakaut");
  const hatamot = toneOf(tracks, "hatamot");
  const zAppeal = toneOf(tracks, "zakaut_appeal");
  const hAppeal = toneOf(tracks, "hatamot_appeal");
  const cols = showHatamot ? 2 : 1;
  // A node carries the date only; the full sentence lives on the card below.
  const sub = (key: TrackKey, fallback: string) => {
    const t = tracks.find(x => x.key === key);
    if (!t?.deadline) return fallback;
    return t.deadline.label.includes("חלף") ? "המועד לשנה זו חלף" : `עד ${formatDateHe(t.deadline.date)}`;
  };

  return (
    <div className="space-y-0">
      <Node title="צוות רב-מקצועי בית-ספרי" sub={team === "primary" ? "התחנה הראשונה - טרם התכנס" : "התכנס"} tone={team} />
      <Arrows cols={1} />
      <Node
        title="אבחנה קבילה"
        sub={assessment === "absent" ? "קיימת בתיק" : `תנאי ${showHatamot ? "לשתי הוועדות" : "לוועדה"} - חסרה או לא תקפה`}
        tone={assessment}
        dashed
      />
      <Arrows cols={cols} />
      <div className={`grid gap-3 ${showHatamot ? "grid-cols-2" : "grid-cols-1"}`}>
        <Node title="ועדת זכאות ואפיון" sub={sub("zakaut", "זכאות לשירותי חינוך מיוחדים")} tone={zakaut} />
        {showHatamot && <Node title="התאמות בדרכי היבחנות" sub={sub("hatamot", "בגרויות, מכיתה י'")} tone={hatamot} />}
      </div>
      <Arrows cols={cols} />
      <div className={`grid gap-3 ${showHatamot ? "grid-cols-2" : "grid-cols-1"}`}>
        <Node title="השגה" sub={zAppeal === "absent" ? "אם תידחה: 21 יום" : sub("zakaut_appeal", "21 יום")} tone={zAppeal} />
        {showHatamot && <Node title="ערעור לוועדה העליונה" sub={hAppeal === "absent" ? "אם תידחה: 14 או 21 יום" : sub("hatamot_appeal", "14 או 21 יום")} tone={hAppeal} />}
      </div>
    </div>
  );
}

const MONTHS = ["ספט", "אוק", "נוב", "דצמ", "ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג"];

export function TrackTimeline({ tracks, today }: { tracks: SchoolTrack[]; today: string }) {
  const sy = schoolYear(today);
  const start = `${sy.start}-09-01`;
  const span = isoDiffDays(start, `${sy.start + 1}-08-31`);
  // Right-to-left: the year starts at the right edge, like the page reads.
  const pct = (iso: string) => Math.min(100, Math.max(0, (isoDiffDays(start, iso) / span) * 100));
  const win = zakautWindow(today);

  type Mark = { iso: string; label: string; tone: "gold" | "teal" };
  const marks: Mark[] = [
    { iso: win.deadline, label: "הפניה לוועדת זכאות", tone: "teal" },
    { iso: win.committeesFinishBy, label: "סיום דיוני הוועדה", tone: "teal" },
    { iso: win.followUpAfterAssessmentBy, label: "דיון המשך אחרי אבחון", tone: "teal" },
  ];
  for (const key of ["zakaut_appeal", "hatamot_appeal"] as const) {
    const t = tracks.find(x => x.key === key);
    if (t?.deadline && t.relevance === "primary") marks.push({ iso: t.deadline.date, label: key === "zakaut_appeal" ? "סוף חלון ההשגה" : "סוף חלון הערעור", tone: "gold" });
  }
  marks.sort((a, b) => (a.iso < b.iso ? -1 : 1));
  const upcoming = marks.filter(m => m.iso >= today).map(m => m.iso)[0];

  // Two label bands, fully separate: even marks sit in the upper band with a
  // long stem, odd marks in the lower band with a short one. Neighbours 45
  // days apart (31.3 and 15.5) would otherwise overlap on a phone.
  const BAR = 92;
  const todayPct = pct(today);
  const todayAtEdge = todayPct < 16;

  return (
    <div dir="rtl" className="relative" style={{ height: 150 }}>
      {/* the year */}
      <div className="absolute inset-x-0 rounded-full" style={{ top: BAR, height: 6, background: "var(--line)" }} />
      {/* elapsed part of the year */}
      <div className="absolute rounded-full" style={{ top: BAR, height: 6, right: 0, width: `${todayPct}%`, background: "var(--teal-mid)" }} />

      {/* month ticks */}
      {MONTHS.map((m, i) => {
        const y = i < 4 ? sy.start : sy.start + 1;
        const month = ((8 + i) % 12) + 1;
        const iso = `${y}-${String(month).padStart(2, "0")}-01`;
        return (
          <div key={m} className="absolute text-[10px]" style={{ top: BAR + 12, right: `${pct(iso)}%`, transform: "translateX(50%)", color: "var(--faint)" }}>{m}</div>
        );
      })}

      {/* deadlines */}
      {marks.map((m, i) => {
        const past = m.iso < today;
        const isNext = m.iso === upcoming;
        const upper = i % 2 === 0;
        const color = m.tone === "gold" || isNext ? "var(--gold-dark)" : "var(--teal-dark)";
        const dot = m.tone === "gold" || isNext ? "var(--gold)" : "var(--teal)";
        const labelTop = upper ? 0 : 42;
        return (
          <div key={m.label + m.iso} className="absolute" style={{ right: `${pct(m.iso)}%`, top: 0, transform: "translateX(50%)", opacity: past ? 0.45 : 1 }}>
            <div className="text-[11px] leading-tight whitespace-nowrap text-center" style={{ color, fontWeight: isNext ? 800 : 600, marginTop: labelTop }}>
              {m.label}
              <div className="text-[10px] font-semibold" style={{ color: "var(--muted)" }}>{formatDateHe(m.iso)}</div>
            </div>
            <div className="mx-auto" style={{ width: 2, height: BAR - labelTop - 30, background: "var(--line)" }} />
            <div className="mx-auto rounded-full" style={{ width: 10, height: 10, background: dot, border: "2px solid white", marginTop: -2 }} />
          </div>
        );
      })}

      {/* today: the line sits on the true date; the label hugs the edge when the date is near it */}
      <div className="absolute" style={{ right: `${todayPct}%`, top: BAR - 16, transform: "translateX(50%)" }}>
        <div style={{ width: 3, height: 36, background: "var(--gold)", borderRadius: 2 }} />
      </div>
      <div
        className="absolute text-[10px] font-extrabold whitespace-nowrap"
        style={{ top: BAR + 26, right: todayAtEdge ? 0 : `${todayPct}%`, transform: todayAtEdge ? "none" : "translateX(50%)", color: "var(--gold-dark)" }}
      >היום · {formatDateHe(today)}</div>
    </div>
  );
}
