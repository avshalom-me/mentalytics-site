"use client";

/**
 * The committee map as a picture: a flow of the four stations with this
 * student's live tracks lit up, and the school year as a line with the
 * computed deadlines and today on it. The kindergarten map has its own flow -
 * the development institute before the committee, the day-care centre beside
 * it for a toddler, the extra year beside it in גן חובה - on the same year line.
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
import { ganTimelineMarks, ganWindow, type GanGrade, type TimelineMark } from "@/app/lib/gan-tracks";

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

/** A row of downward arrows, one per column, between two rows of nodes. `hideSecond`: the second column leads nowhere. */
function Arrows({ cols, hideSecond = false }: { cols: 1 | 2; hideSecond?: boolean }) {
  return (
    <div className={`grid ${cols === 2 ? "grid-cols-2" : "grid-cols-1"} h-6`}>
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="flex justify-center items-center text-base leading-none" style={{ color: "var(--faint)" }}>{hideSecond && i === 1 ? "" : "↓"}</div>
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
        {showHatamot && <Node title="ערעור לוועדה העליונה" sub={hAppeal === "absent" ? "אם תידחה: 14 יום (21 בחורף ארצי)" : sub("hatamot_appeal", "14 יום (21 בחורף ארצי)")} tone={hAppeal} />}
      </div>
    </div>
  );
}

/**
 * The kindergarten route as a picture.
 *
 * The first station is the kindergarten's team (a toddler has none - it is not
 * yet in the Ministry's system); the prerequisite is the development
 * institute's assessment, or a psychologist's diagnosis on the emotional
 * route; then the committee - for a toddler, the one ahead of kindergarten,
 * beside the rehabilitative day-care centre; in גן חובה, beside the extra
 * year when it was raised.
 */
export function GanTrackFlow({ grade, tracks }: { grade: GanGrade; tracks: SchoolTrack[] }) {
  const toddler = grade === "פעוט";
  const chova = grade === "גן";
  const has = (k: TrackKey) => tracks.some(t => t.key === k);
  const team = toneOf(tracks, "gan_team");
  const devCenter = toneOf(tracks, "dev_center");
  const assessment = toneOf(tracks, "assessment");
  const committeeKey: TrackKey = chova && has("first_grade") ? "first_grade" : "zakaut";
  const committee = toneOf(tracks, committeeKey);
  const appeal = toneOf(tracks, "zakaut_appeal");
  const side: TrackKey | null = toddler && has("rehab_daycare") ? "rehab_daycare" : chova && has("extra_year") ? "extra_year" : null;
  const cols = side ? 2 : 1;
  const sub = (key: TrackKey, fallback: string) => {
    const t = tracks.find(x => x.key === key);
    if (!t?.deadline) return fallback;
    return t.deadline.label.includes("חלף") ? "המועד לשנה זו חלף" : `עד ${formatDateHe(t.deadline.date)}`;
  };
  const prerequisite = has("dev_center")
    ? { title: "הערכה במכון להתפתחות הילד", tone: devCenter, sub: devCenter === "primary" ? "טרם נערכה - מתחילים ברופא/ת הילדים" : devCenter === "consider" ? "ממתינים לתור" : "נערכה או בתהליך" }
    : has("assessment")
      ? { title: "אבחנה קבילה", tone: assessment, sub: "חסרה - פסיכולוג/ית או פסיכיאטר/ית" }
      : { title: "אבחנה קבילה", tone: "absent" as Tone, sub: "קיימת בתיק או שלא נדרשת לפי הממצאים" };

  return (
    <div className="space-y-0">
      {!toddler && (
        <>
          <Node title="צוות רב-מקצועי בגן (מתי&quot;א)" sub={team === "primary" ? "התחנה הראשונה - טרם דן" : team === "absent" ? "הצוות של גן החינוך המיוחד" : "דן בילד/ה"} tone={team} />
          <Arrows cols={1} />
        </>
      )}
      <Node title={prerequisite.title} sub={prerequisite.sub} tone={prerequisite.tone} dashed />
      <Arrows cols={cols} />
      <div className={`grid gap-3 ${side ? "grid-cols-2" : "grid-cols-1"}`}>
        <Node
          title={toddler ? "ועדת זכאות ואפיון - לקראת הגן" : committeeKey === "first_grade" ? "ועדה לקראת כיתה א'" : "ועדת זכאות ואפיון"}
          sub={sub(committeeKey, "זכאות לשירותי חינוך מיוחדים")}
          tone={committee}
        />
        {side === "rehab_daycare" && <Node title="מעון יום שיקומי" sub="מחצי שנה ועד גיל 3" tone={toneOf(tracks, "rehab_daycare")} />}
        {side === "extra_year" && <Node title="השארה בגן חובה" sub={sub("extra_year", "חוות דעת שפ\"ח")} tone={toneOf(tracks, "extra_year")} />}
      </div>
      <Arrows cols={cols} hideSecond={side === "rehab_daycare"} />
      <div className={`grid gap-3 ${side ? "grid-cols-2" : "grid-cols-1"}`}>
        <Node title="השגה" sub={appeal === "absent" ? "אם תידחה: 21 יום" : sub("zakaut_appeal", "21 יום")} tone={appeal} />
        {side === "rehab_daycare" && <div />}
        {side === "extra_year" && <Node title="ערעור ברשות, השגה במחוז" sub="לפי הנוהל ברשות" tone="absent" />}
      </div>
    </div>
  );
}

const MONTHS = ["ספט", "אוק", "נוב", "דצמ", "ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג"];

export function TrackTimeline({ tracks, today }: { tracks: SchoolTrack[]; today: string }) {
  const win = zakautWindow(today);
  // Short on purpose: at phone width 31.3 and 15.7 sit about 90px apart in
  // the same label band, and the full wording - it is on the cards - ran the
  // two together.
  const marks: TimelineMark[] = [
    { iso: win.deadline, label: "הפניה לוועדה", tone: "teal" },
    { iso: win.committeesFinishBy, label: "סיום דיוני הוועדה", tone: "teal" },
    { iso: win.followUpAfterAssessmentBy, label: "דיון המשך", tone: "teal" },
  ];
  for (const key of ["zakaut_appeal", "hatamot_appeal"] as const) {
    const t = tracks.find(x => x.key === key);
    if (t?.deadline && t.relevance === "primary") marks.push({ iso: t.deadline.date, label: key === "zakaut_appeal" ? "סוף חלון ההשגה" : "סוף חלון הערעור", tone: "gold" });
  }
  marks.sort((a, b) => (a.iso < b.iso ? -1 : 1));
  return <YearTimeline marks={marks} today={today} phases={{ referral: win.deadline, hearingsEnd: win.committeesFinishBy, hearings: "דיוני הוועדות" }} />;
}

/** The kindergarten year: the team's opening, the referral, the end of the hearings - see ganTimelineMarks. */
export function GanTimeline({ grade, tracks, today }: { grade: GanGrade; tracks: SchoolTrack[]; today: string }) {
  const win = ganWindow(today);
  return <YearTimeline marks={ganTimelineMarks(grade, tracks, today)} today={today} phases={{ referral: win.deadline, hearingsEnd: win.committeesFinishBy, hearings: "דיוני הגנים" }} />;
}

/**
 * The year as a ribbon of months coloured by what they are for: preparing the
 * file up to the referral month, the referral month itself in gold, the
 * hearings in pink, and what is left of the year plain. Months already behind
 * are faded; the dates themselves stay on the marks above.
 */
type Phases = { referral: string; hearingsEnd: string; hearings: string };
const PHASE_COLORS = { prep: "var(--teal-mid)", referral: "var(--gold)", hearings: "var(--pink)", rest: "var(--surface-2)" } as const;

function phaseOf(month: string, p: Phases): keyof typeof PHASE_COLORS {
  const ref = p.referral.slice(0, 7);
  if (month < ref) return "prep";
  if (month === ref) return "referral";
  return month <= p.hearingsEnd.slice(0, 7) ? "hearings" : "rest";
}

function YearTimeline({ marks, today, phases }: { marks: TimelineMark[]; today: string; phases: Phases }) {
  const sy = schoolYear(today);
  const start = `${sy.start}-09-01`;
  const span = isoDiffDays(start, `${sy.start + 1}-08-31`);
  // Right-to-left: the year starts at the right edge, like the page reads.
  const pct = (iso: string) => Math.min(100, Math.max(0, (isoDiffDays(start, iso) / span) * 100));
  const upcoming = marks.filter(m => m.iso >= today).map(m => m.iso)[0];

  // Two label bands, fully separate: even marks sit in the upper band with a
  // long stem, odd marks in the lower band with a short one. Neighbours 45
  // days apart (31.3 and 15.5) would otherwise overlap on a phone.
  const BAR = 92;
  const todayPct = pct(today);
  const todayAtEdge = todayPct < 16;

  const months = MONTHS.map((m, i) => {
    const y = i < 4 ? sy.start : sy.start + 1;
    const month = ((8 + i) % 12) + 1;
    const key = `${y}-${String(month).padStart(2, "0")}`;
    const ny = month === 12 ? y + 1 : y;
    const nextKey = `${ny}-${String((month % 12) + 1).padStart(2, "0")}`;
    const from = pct(`${key}-01`);
    const to = i === MONTHS.length - 1 ? 100 : pct(`${nextKey}-01`);
    return { m, key, from, to, past: `${nextKey}-01` <= today, phase: phaseOf(key, phases) };
  });

  return (
    <div dir="rtl">
    <div className="relative" style={{ height: 150 }}>
      {/* the year, month by month, coloured by phase */}
      {months.map(x => (
        <div
          key={x.key}
          className="absolute rounded-[3px]"
          style={{ top: BAR - 4, height: 14, insetInlineStart: `${x.from}%`, width: `calc(${x.to - x.from}% - 2px)`, background: PHASE_COLORS[x.phase], opacity: x.past ? 0.5 : 1 }}
        />
      ))}

      {/* month names, centred in their month */}
      {months.map(x => (
        <div key={x.m} className="absolute text-[10px]" style={{ top: BAR + 14, insetInlineStart: `${(x.from + x.to) / 2}%`, transform: "translateX(50%)", color: "var(--muted)" }}>{x.m}</div>
      ))}

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

      {/* today: the line sits on the true date; the label hugs the edge when the date is near it.
          Ink rather than gold, so it still shows across the gold referral month. */}
      <div className="absolute" style={{ right: `${todayPct}%`, top: BAR - 14, transform: "translateX(50%)" }}>
        <div style={{ width: 3, height: 32, background: "var(--text)", borderRadius: 2 }} />
      </div>
      <div
        className="absolute text-[10px] font-extrabold whitespace-nowrap"
        style={{ top: BAR + 30, right: todayAtEdge ? 0 : `${todayPct}%`, transform: todayAtEdge ? "none" : "translateX(50%)", color: "var(--text)" }}
      >היום · {formatDateHe(today)}</div>
    </div>
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] mt-1" style={{ color: "var(--text-2)" }}>
      {([
        ["prep", "הכנת התיק ומיצוי"],
        ["referral", `הפניה עד ${formatDateHe(phases.referral)}`],
        ["hearings", `${phases.hearings} עד ${formatDateHe(phases.hearingsEnd)}`],
      ] as const).map(([k, label]) => (
        <span key={k} className="inline-flex items-center gap-1.5">
          <span className="inline-block rounded-[3px]" style={{ width: 14, height: 10, background: PHASE_COLORS[k] }} />
          {label}
        </span>
      ))}
    </div>
    </div>
  );
}
