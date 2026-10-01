"use client";

/**
 * מצב הביקורת של שאלון היועצות - השכבה שבודק/ת מקצועי/ת עובד/ת בה.
 *
 * It sits on top of the live questionnaire rather than beside a copy of it:
 * what a reviewer sees is the screen a counsellor sees, produced by the same
 * code from the same answers, and a note is taken on that. The layer adds four
 * things and changes nothing underneath:
 *
 *  - the case bank: an invented child is opened onto any screen, already
 *    answered, so the whole questionnaire can be read without being filled in;
 *  - a way to any screen, and the atlas of the committee map;
 *  - a note on any piece of any screen, saved with the answers of that moment
 *    so the exact state can be opened again;
 *  - a list of what has and has not been looked at yet.
 *
 * Mounted by KidsQuiz for a reviewer only (see review/session.ts). It talks to
 * the questionnaire through the bridge and to nothing else of it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { israelToday } from "@/app/lib/school-tracks";
import {
  ATLAS_STEP, NOTE_KINDS, NOTE_KIND_LABELS, NOTE_SEVERITIES, NOTE_SEVERITY_LABELS, NOTE_STATUS_LABELS,
  type NoteInput, type NoteKind, type NoteSeverity, type ReviewNote,
} from "@/app/lib/school-review";
import { PAGES, skipPage, type Ans, type KidsScoreResult, type PageId } from "../quiz-logic";
import { UI_ATTR, anchorOf, currentSelection, pickTarget, surfaceOf, type Anchor } from "./anchor";
import Atlas from "./Atlas";
import { REVIEW_CASES, caseAnswers, findCase, type ReviewCase } from "./cases";
import {
  PAGE_NAMES, atlasKey, caseKey, coverageGroups, coverageTotals, pageKey, pageVariant, seenKeys, shownOnReport,
} from "./coverage";
import { routeOf } from "./derive";
import {
  ReviewApiError, forgetReviewToken, readSeenLocal, reviewApi, reviewToken, takeRestore, writeSeenLocal, type RestorePayload,
} from "./session";
import WHERE from "./where.generated.json";

export interface ReviewBridge {
  step: string;
  A: Ans;
  score: KidsScoreResult | null;
  scoreError: boolean;
  /** Replace the questionnaire state and open a screen. */
  load: (answers: Ans, step: string) => void;
  /** Open a screen with the answers as they are. */
  jump: (step: string) => void;
  setA: (update: (prev: Ans) => Ans) => void;
}

type Panel = "cases" | "screens" | "notes" | "coverage" | "help" | null;

/** Set once the reviewer has been shown how the mode works. */
const INTRO_KEY = "school_review_intro_v1";

/** What the note form is filled in about. */
interface Draft {
  anchor: Anchor;
  step: string;
  /** Set when an existing note is being edited rather than a new one written. */
  editing?: ReviewNote;
}

const WHERE_TO_SEE = WHERE as Record<string, string[]>;
const ui = { [UI_ATTR]: "" };

// The facts a score writes back into the answers, and the "answered for real"
// marks a click leaves behind: neither is a change a reviewer made to a case.
const DERIVED = new Set(["_found", "_findingKeys", "_route"]);
function stateKey(A: Ans): string {
  return JSON.stringify(
    Object.keys(A)
      .filter(k => !DERIVED.has(k) && !(k.endsWith("__unk") && A[k] === false) && A[k] !== undefined && A[k] !== "")
      .sort()
      .map(k => [k, A[k]]),
  );
}

const pill = "rounded-full px-4 py-2 text-sm font-bold whitespace-nowrap transition-colors";
const chip = "rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap";

const STATUS_TONE: Record<ReviewNote["status"], { bg: string; fg: string }> = {
  open: { bg: "var(--surface-2)", fg: "var(--text-2)" },
  accepted: { bg: "var(--teal-pale)", fg: "var(--teal-dark)" },
  rejected: { bg: "#FBEDE9", fg: "#A83B22" },
  done: { bg: "#E6F4EA", fg: "#1E6B3A" },
};
const SEVERITY_TONE: Record<NoteSeverity, string> = { high: "#A83B22", medium: "var(--gold-dark)", low: "var(--muted)" };

const stepName = (step: string) =>
  step === ATLAS_STEP ? "אטלס הוועדות" : PAGE_NAMES[step as PageId] ?? step;

// ── The drawer every panel sits in ───────────────────────────────────────────

function Drawer({ title, hint, onClose, children }: { title: string; hint?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div {...ui} dir="rtl" className="fixed bottom-[60px] end-0 top-0 z-[158] flex w-full max-w-md flex-col border-s bg-white shadow-2xl print:hidden" style={{ borderColor: "var(--line)", fontFamily: "'Heebo', sans-serif" }}>
      <div className="flex items-start gap-3 border-b px-4 py-3" style={{ borderColor: "var(--line)" }}>
        <div className="min-w-0 flex-1">
          <div className="text-lg font-black" style={{ color: "var(--text)" }}>{title}</div>
          {hint && <div className="mt-0.5 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>{hint}</div>}
        </div>
        <button type="button" onClick={onClose} aria-label="סגירה" className="rounded-full px-3 py-1 text-sm font-bold" style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>סגירה</button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3">{children}</div>
    </div>
  );
}

// ── מקרים ───────────────────────────────────────────────────────────────────

function CaseCard({ c, seen, current, onOpen }: { c: ReviewCase; seen: boolean; current: boolean; onOpen: (c: ReviewCase, step: string) => void }) {
  return (
    <div data-review-id={`case:${c.id}`} data-review-label={`מקרה: ${c.title}`} className="rounded-2xl border p-3" style={{ borderColor: current ? "var(--teal)" : "var(--line)", background: current ? "var(--teal-pale)" : "white" }}>
      <div className="mb-1 flex items-center gap-2">
        <span className="text-base font-extrabold" style={{ color: "var(--text)" }}>{c.title}</span>
        {seen && <span className={chip} style={{ background: "#E6F4EA", color: "#1E6B3A" }}>נפתח</span>}
      </div>
      <p className="mb-2 text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>{c.story}</p>
      <div className="mb-1 text-xs font-bold" style={{ color: "var(--teal-dark)" }}>מה לבדוק כאן</div>
      <ul className="mb-2 list-disc space-y-0.5 ps-5 text-xs leading-relaxed" style={{ color: "var(--text-2)" }}>
        {c.focus.map((f, i) => <li key={i}>{f}</li>)}
      </ul>
      {c.tryAlso && (
        <>
          <div className="mb-1 text-xs font-bold" style={{ color: "var(--gold-dark)" }}>אפשר גם לשנות ולראות</div>
          <ul className="mb-2 list-disc space-y-0.5 ps-5 text-xs leading-relaxed" style={{ color: "var(--text-2)" }}>
            {c.tryAlso.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onOpen(c, "p-result")} className="rounded-full px-3 py-1.5 text-xs font-bold text-white" style={{ background: "var(--teal-dark)" }}>לדוח</button>
        <button type="button" onClick={() => onOpen(c, "p-demo")} className="rounded-full border px-3 py-1.5 text-xs font-bold" style={{ borderColor: "var(--teal)", color: "var(--teal-dark)" }}>מהשאלה הראשונה</button>
        <button type="button" onClick={() => onOpen(c, "p-refine")} className="rounded-full border px-3 py-1.5 text-xs font-bold" style={{ borderColor: "var(--teal)", color: "var(--teal-dark)" }}>למסך &quot;מה כבר נעשה&quot;</button>
      </div>
    </div>
  );
}

function CasesPanel({ seen, currentId, onOpen }: { seen: ReadonlySet<string>; currentId: string | null; onOpen: (c: ReviewCase, step: string) => void }) {
  return (
    <div className="space-y-5">
      {(["school", "gan"] as const).map(role => (
        <div key={role}>
          <div className="mb-2 text-sm font-black" style={{ color: "var(--text)" }}>{role === "school" ? "בית ספר" : "גן"}</div>
          <div className="space-y-3">
            {REVIEW_CASES.filter(c => c.role === role).map(c => (
              <CaseCard key={c.id} c={c} seen={seen.has(caseKey(c.id))} current={c.id === currentId} onOpen={onOpen} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── מסכים ───────────────────────────────────────────────────────────────────

function ScreensPanel({ step, A, seen, notesByStep, onJump }: { step: string; A: Ans; seen: ReadonlySet<string>; notesByStep: Record<string, number>; onJump: (pid: PageId) => void }) {
  return (
    <ul className="space-y-1">
      {PAGES.map(pid => {
        const off = skipPage(pid, A);
        const here = pid === step;
        const wasSeen = seen.has(pageKey(pid, pageVariant(pid, A)));
        return (
          <li key={pid}>
            <button
              type="button"
              onClick={() => onJump(pid)}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-start text-sm"
              style={{ background: here ? "var(--teal-pale)" : "transparent", color: off ? "var(--faint)" : "var(--text)", fontWeight: here ? 800 : 500 }}
            >
              <span className="w-4 flex-shrink-0 text-xs" style={{ color: "#1E6B3A" }} aria-hidden="true">{wasSeen ? "✓" : ""}</span>
              <span className="flex-1">{PAGE_NAMES[pid]}</span>
              {off && <span className="text-xs">לא במסלול של התשובות האלה</span>}
              {notesByStep[pid] > 0 && <span className={chip} style={{ background: "var(--gold-pale)", color: "var(--gold-dark)" }}>{notesByStep[pid]}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ── ההערות שלי ──────────────────────────────────────────────────────────────

function NoteRow({ n, onOpen, onEdit, onWithdraw }: { n: ReviewNote; onOpen: (n: ReviewNote) => void; onEdit: (n: ReviewNote) => void; onWithdraw: (n: ReviewNote) => void }) {
  const tone = STATUS_TONE[n.status];
  const caseTitle = findCase(n.case_id)?.title;
  return (
    <div className="rounded-2xl border bg-white p-3" style={{ borderColor: "var(--line)" }}>
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <span className={chip} style={{ background: tone.bg, color: tone.fg }}>{NOTE_STATUS_LABELS[n.status]}</span>
        <span className={chip} style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>{NOTE_KIND_LABELS[n.kind]}</span>
        <span className="text-xs font-bold" style={{ color: SEVERITY_TONE[n.severity] }}>חומרה {NOTE_SEVERITY_LABELS[n.severity]}</span>
      </div>
      <div className="text-xs" style={{ color: "var(--muted)" }}>
        {stepName(n.step)}{n.block_label ? ` · ${n.block_label}` : ""}{caseTitle ? ` · ${caseTitle}${n.case_modified ? " (שונה)" : ""}` : ""}
      </div>
      {n.quote && <blockquote className="my-2 border-s-2 ps-2 text-xs leading-relaxed" style={{ borderColor: "var(--gold)", color: "var(--text-2)" }}>{n.quote.length > 220 ? `${n.quote.slice(0, 220)}…` : n.quote}</blockquote>}
      <p className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: "var(--text)" }}>{n.note}</p>
      {n.suggestion && <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed" style={{ color: "var(--teal-dark)" }}><strong>נוסח מוצע:</strong> {n.suggestion}</p>}
      {n.response && (
        <div className="mt-2 rounded-xl p-2 text-sm leading-relaxed" style={{ background: tone.bg, color: "var(--text)" }}>
          <strong>תשובה:</strong> {n.response}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => onOpen(n)} className="rounded-full border px-3 py-1 text-xs font-bold" style={{ borderColor: "var(--teal)", color: "var(--teal-dark)" }}>לפתוח את המצב</button>
        {n.status === "open" && (
          <>
            <button type="button" onClick={() => onEdit(n)} className="rounded-full border px-3 py-1 text-xs font-bold" style={{ borderColor: "var(--line)", color: "var(--text-2)" }}>עריכה</button>
            <button type="button" onClick={() => onWithdraw(n)} className="rounded-full border px-3 py-1 text-xs font-bold" style={{ borderColor: "var(--line)", color: "var(--muted)" }}>ביטול ההערה</button>
          </>
        )}
      </div>
    </div>
  );
}

function NotesPanel({ notes, step, ...row }: { notes: ReviewNote[]; step: string; onOpen: (n: ReviewNote) => void; onEdit: (n: ReviewNote) => void; onWithdraw: (n: ReviewNote) => void }) {
  const [onlyHere, setOnlyHere] = useState(false);
  const shown = onlyHere ? notes.filter(n => n.step === step) : notes;
  const answered = notes.filter(n => n.status !== "open").length;
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
        <span>{notes.length} הערות, {answered} מהן כבר נענו</span>
        <button type="button" onClick={() => setOnlyHere(v => !v)} className="rounded-full border px-3 py-1 font-bold" style={{ borderColor: "var(--line)", color: onlyHere ? "var(--teal-dark)" : "var(--text-2)", background: onlyHere ? "var(--teal-pale)" : "white" }}>
          רק במסך הזה
        </button>
      </div>
      {shown.length === 0
        ? <p className="text-sm" style={{ color: "var(--muted)" }}>{notes.length ? "אין הערות במסך הזה." : "עוד לא נכתבו הערות. כדי לכתוב אחת, לחצו על \"הערה\" בסרגל למטה."}</p>
        : <div className="space-y-3">{shown.map(n => <NoteRow key={n.id} n={n} {...row} />)}</div>}
    </div>
  );
}

// ── כיסוי ───────────────────────────────────────────────────────────────────

function CoveragePanel({ seen, onOpenCase, onOpenAtlas }: { seen: ReadonlySet<string>; onOpenCase: (id: string) => void; onOpenAtlas: (section: string) => void }) {
  const groups = useMemo(() => coverageGroups(seen, REVIEW_CASES), [seen]);
  const totals = coverageTotals(groups);
  return (
    <div>
      <p className="mb-3 text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
        ראית {totals.seen} מתוך {totals.total}. &quot;ראית&quot; פירושו שהדבר הופיע על המסך שלך - זו רשימה שעוזרת לא לפספס, ולא מדד.
      </p>
      <div className="space-y-4">
        {groups.map(g => {
          const done = g.items.filter(i => i.seen).length;
          const left = g.items.filter(i => !i.seen);
          return (
            <div key={g.id} className="rounded-2xl border p-3" style={{ borderColor: "var(--line)" }}>
              <div className="mb-1 flex items-center justify-between text-sm font-extrabold" style={{ color: "var(--text)" }}>
                <span>{g.name}</span>
                <span style={{ color: left.length ? "var(--gold-dark)" : "#1E6B3A" }}>{done} / {g.items.length}</span>
              </div>
              <div className="mb-2 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
                <div className="h-full rounded-full" style={{ width: `${(done / g.items.length) * 100}%`, background: "var(--teal)" }} />
              </div>
              {left.length === 0
                ? <p className="text-xs" style={{ color: "#1E6B3A" }}>הכול נראה.</p>
                : (
                  <ul className="space-y-1.5">
                    {left.map(i => {
                      const where = (WHERE_TO_SEE[i.key] ?? []).map(findCase).filter((c): c is ReviewCase => !!c);
                      const section = i.key.startsWith("atlas:") ? i.key.slice(6) : null;
                      const ownCase = i.key.startsWith("case:") ? i.key.slice(5) : null;
                      return (
                        <li key={i.key} className="text-xs leading-relaxed" style={{ color: "var(--text-2)" }}>
                          <span className="font-semibold" style={{ color: "var(--text)" }}>{i.name}</span>
                          {ownCase && <button type="button" onClick={() => onOpenCase(ownCase)} className="ms-2 font-bold underline" style={{ color: "var(--teal-dark)" }}>לפתוח</button>}
                          {section && <button type="button" onClick={() => onOpenAtlas(section)} className="ms-2 font-bold underline" style={{ color: "var(--teal-dark)" }}>לפתוח באטלס</button>}
                          {where.length > 0 && (
                            <span className="ms-2">
                              נמצא ב:{" "}
                              {where.map((c, idx) => (
                                <span key={c.id}>
                                  {idx > 0 && ", "}
                                  <button type="button" onClick={() => onOpenCase(c.id)} className="font-bold underline" style={{ color: "var(--teal-dark)" }}>{c.title}</button>
                                </span>
                              ))}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── איך עובדים כאן ──────────────────────────────────────────────────────────

const HELP_STEPS: [string, string][] = [
  ["מקרים", "ילדים בדויים שהשאלון כבר מולא עליהם. בוחרים מקרה ופותחים אותו ישר בדוח, או מהשאלה הראשונה כדי לעבור על המסכים אחד אחד. ליד כל מקרה כתוב מה כדאי לבדוק בו."],
  ["הערה", "לוחצים על \"+ הערה\" ואז על הטקסט שעליו רוצים להעיר. אפשר גם לסמן קודם כמה מילים בעכבר ואז ללחוץ \"+ הערה\". בוחרים סוג וחומרה, כותבים, ואם יש ניסוח חלופי מוסיפים אותו. ההערה נשמרת מיד, יחד עם כל התשובות שעל המסך."],
  ["מסכים", "מעבר ישיר לכל מסך של השאלון, בלי ללחוץ \"המשך\" עשרים פעם."],
  ["אטלס הוועדות", "כל מה שהמערכת יודעת לומר על ועדות, מועדים, מסמכים וערר, במקום אחד: מתי נפתח כל כיוון, כל כרטיס עם כל הנוסחים שלו, ומי רשאי לחתום על מה. גם שם אפשר להעיר על כל שורה."],
  ["שינוי תשובות", "כל מקרה אפשר לשנות: חוזרים למסך, משנים תשובה, וחוזרים לדוח דרך \"מסכים\". כך רואים מה משתנה בהפניה ובמפה."],
  ["ראיתי", "רשימה של מה שכבר הופיע על המסך ומה עוד לא, עם קישור למקרה שבו אפשר לראות כל דבר שחסר."],
  ["ההערות שלי", "כל מה שכתבת. כשהערה נבדקת, התשובה מופיעה שם לידה. הערה שעוד לא טופלה אפשר לערוך או לבטל."],
];

function HelpPanel() {
  return (
    <div>
      <p className="mb-3 rounded-xl p-3 text-sm leading-relaxed" style={{ background: "var(--gold-pale)", color: "var(--text)" }}>
        המקרים כאן בדויים. ההערות נשמרות יחד עם התשובות שעל המסך, ולכן אין למלא כאן תלמיד או ילד אמיתי.
      </p>
      <ol className="space-y-3">
        {HELP_STEPS.map(([title, text], i) => (
          <li key={title} className="flex gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-black text-white" style={{ background: "var(--teal)" }}>{i + 1}</span>
            <span className="text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
              <strong style={{ color: "var(--text)" }}>{title}.</strong> {text}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
        מה שנפתח במצב הביקורת לא נספר במדידה של האתר. ההסברים &quot;למה זה הוצע?&quot; נכתבים מחדש בכל לחיצה, ולכן הערה עליהם נשמרת עם הנוסח שהופיע אצלך.
      </p>
    </div>
  );
}

// ── טופס ההערה ──────────────────────────────────────────────────────────────

function NoteForm({ draft, busy, error, onSave, onCancel }: {
  draft: Draft;
  busy: boolean;
  error: string | null;
  onSave: (v: { kind: NoteKind; severity: NoteSeverity; note: string; suggestion: string; quote: string }) => void;
  onCancel: () => void;
}) {
  const e = draft.editing;
  const [kind, setKind] = useState<NoteKind | null>(e?.kind ?? null);
  const [severity, setSeverity] = useState<NoteSeverity>(e?.severity ?? "medium");
  const [note, setNote] = useState(e?.note ?? "");
  const [suggestion, setSuggestion] = useState(e?.suggestion ?? "");
  const [quote, setQuote] = useState(e ? e.quote ?? "" : draft.anchor.quote ?? "");
  const where = [stepName(draft.step), e ? e.block_label : draft.anchor.blockLabel].filter(Boolean).join(" · ");
  const ready = !!kind && note.trim().length > 0 && !busy;
  const option = (on: boolean) => ({
    className: "rounded-full border-2 px-3 py-1.5 text-sm font-bold",
    style: on
      ? { background: "var(--teal)", borderColor: "var(--teal)", color: "white" }
      : { background: "white", borderColor: "var(--line)", color: "var(--text-2)" },
  });
  const field = "w-full rounded-xl border-2 px-3 py-2 text-sm leading-relaxed outline-none focus:border-[var(--teal)]";
  return (
    <div {...ui} dir="rtl" className="fixed inset-0 z-[170] flex items-end justify-center p-0 sm:items-center sm:p-4 print:hidden" style={{ background: "rgba(19,31,30,0.45)", fontFamily: "'Heebo', sans-serif" }}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl">
        <div className="mb-1 text-lg font-black" style={{ color: "var(--text)" }}>{e ? "עריכת הערה" : "הערה חדשה"}</div>
        <div className="mb-3 text-xs" style={{ color: "var(--muted)" }}>{where}</div>

        {!e && (
          <div className="mb-4">
            <label className="mb-1 block text-xs font-bold" style={{ color: "var(--text-2)" }}>על מה ההערה - אפשר לקצר לחלק המדויק</label>
            <textarea value={quote} onChange={ev => setQuote(ev.target.value)} rows={quote.length > 160 ? 4 : 2} className={field} style={{ borderColor: "var(--line)", background: "var(--gold-pale)", color: "var(--text)" }} placeholder="הערה על המסך כולו" />
          </div>
        )}

        <div className="mb-3">
          <div className="mb-1 text-xs font-bold" style={{ color: "var(--text-2)" }}>סוג</div>
          <div className="flex flex-wrap gap-2">
            {NOTE_KINDS.map(k => <button key={k} type="button" onClick={() => setKind(k)} {...option(kind === k)}>{NOTE_KIND_LABELS[k]}</button>)}
          </div>
        </div>
        <div className="mb-3">
          <div className="mb-1 text-xs font-bold" style={{ color: "var(--text-2)" }}>חומרה</div>
          <div className="flex flex-wrap gap-2">
            {NOTE_SEVERITIES.map(s => <button key={s} type="button" onClick={() => setSeverity(s)} {...option(severity === s)}>{NOTE_SEVERITY_LABELS[s]}</button>)}
          </div>
        </div>
        <div className="mb-3">
          <label className="mb-1 block text-xs font-bold" style={{ color: "var(--text-2)" }}>ההערה</label>
          <textarea autoFocus value={note} onChange={ev => setNote(ev.target.value)} rows={4} className={field} style={{ borderColor: "var(--line)", color: "var(--text)" }} placeholder="מה לא נכון, מה חסר, או מה מעורר שאלה" />
        </div>
        <div className="mb-4">
          <label className="mb-1 block text-xs font-bold" style={{ color: "var(--text-2)" }}>נוסח מוצע (לא חובה)</label>
          <textarea value={suggestion} onChange={ev => setSuggestion(ev.target.value)} rows={3} className={field} style={{ borderColor: "var(--line)", color: "var(--text)" }} placeholder="אם יש לך ניסוח חלופי, כתבו אותו כאן כפי שהוא צריך להופיע" />
        </div>

        {error && <p className="mb-3 rounded-xl p-2 text-sm" style={{ background: "#FBEDE9", color: "#A83B22" }}>{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className={pill} style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>ביטול</button>
          <button type="button" disabled={!ready} onClick={() => kind && onSave({ kind, severity, note, suggestion, quote })} className={`${pill} text-white disabled:opacity-40`} style={{ background: "var(--teal-dark)" }}>
            {busy ? "שומר…" : "שמירה"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── The layer ────────────────────────────────────────────────────────────────

export default function ReviewLayer({ bridge }: { bridge: ReviewBridge }) {
  const { step, A, score, load, jump, setA } = bridge;
  const today = useMemo(() => israelToday(), []);
  const hasToken = useMemo(() => reviewToken() !== null, []);

  const [me, setMe] = useState<{ name: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [restored, setRestored] = useState<RestorePayload["note"] | null>(null);
  const [notes, setNotes] = useState<ReviewNote[]>([]);
  const [seen, setSeen] = useState<Set<string>>(() => new Set(readSeenLocal()));
  const [panel, setPanel] = useState<Panel>(null);
  const [atlas, setAtlas] = useState<{ open: boolean; section: string | null }>({ open: false, section: null });
  const [picking, setPicking] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [opened, setOpened] = useState<{ id: string; key: string } | null>(null);
  const hover = useRef<HTMLDivElement>(null);
  const unsent = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!hasToken) return;
    try {
      if (localStorage.getItem(INTRO_KEY)) return;
      localStorage.setItem(INTRO_KEY, "1");
      setPanel("help");
    } catch { /* storage blocked: the help stays one click away */ }
  }, [hasToken]);

  const say = useCallback((text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(t => (t === text ? null : t)), 2600);
  }, []);

  // ── Who is reviewing, and a state handed over from the admin page ──
  useEffect(() => {
    const handed = takeRestore();
    if (handed) {
      setRestored(handed.note);
      load(handed.A, (PAGES as readonly string[]).includes(handed.step) ? handed.step : "p-result");
    }
    if (!hasToken) return;
    let alive = true;
    reviewApi.session()
      .then(s => {
        if (!alive) return;
        setMe(s.reviewer);
        setNotes(s.notes);
        setSeen(prev => new Set([...prev, ...s.seen]));
      })
      .catch((err: unknown) => {
        if (!alive) return;
        if (err instanceof ReviewApiError && err.status === 401) {
          forgetReviewToken();
          setProblem("קישור הביקורת אינו תקף או שבוטל. אפשר לבקש קישור חדש.");
        } else {
          setProblem("לא הצלחנו להתחבר לשרת הביקורת. ההערות לא יישמרו עד שהחיבור יחזור - נסו לרענן את הדף.");
        }
      });
    return () => { alive = false; };
    // Runs once: `load` is a new function on every render of the questionnaire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── What has been on screen ──
  const markSeen = useCallback((keys: string[]) => {
    setSeen(prev => {
      const fresh = keys.filter(k => !prev.has(k));
      if (!fresh.length) return prev;
      const next = new Set(prev);
      for (const k of fresh) { next.add(k); unsent.current.add(k); }
      writeSeenLocal(next);
      return next;
    });
  }, []);
  useEffect(() => {
    markSeen(seenKeys(step, A, score, today));
  }, [step, A, score, today, markSeen]);
  useEffect(() => {
    if (!hasToken || problem) return;
    const t = window.setInterval(() => {
      if (!unsent.current.size) return;
      const batch = [...unsent.current];
      unsent.current = new Set();
      reviewApi.seen(batch).catch(() => { for (const k of batch) unsent.current.add(k); });
    }, 4000);
    return () => window.clearInterval(t);
  }, [hasToken, problem]);

  // ── The route, for a state that did not walk through "מה כבר נעשה" ──
  // That screen decides on the way out whether "מה קיים בתיק" is part of the
  // walk. A case opened straight onto the report never passed it, so the same
  // decision is made here once the score has landed - see derive.ts.
  useEffect(() => {
    if (step !== "p-result" || A._audience !== "counselor" || !Array.isArray(A._found)) return;
    const route = routeOf(A);
    if (A._route !== route) setA(prev => ({ ...prev, _route: routeOf(prev) }));
  }, [step, A, setA]);

  // ── Opening things ──
  const openCase = useCallback((c: ReviewCase, to: string) => {
    const answers = caseAnswers(c, today);
    load(answers, to);
    setOpened({ id: c.id, key: stateKey(answers) });
    markSeen([caseKey(c.id)]);
    setPanel(null);
    setAtlas({ open: false, section: null });
    say(`נפתח: ${c.title}`);
  }, [load, markSeen, say, today]);
  const openCaseById = useCallback((id: string) => { const c = findCase(id); if (c) openCase(c, "p-result"); }, [openCase]);

  const current = opened ? findCase(opened.id) ?? null : null;
  const modified = !!opened && stateKey(A) !== opened.key;

  const openNote = useCallback((n: ReviewNote) => {
    setPanel(null);
    if (n.step === ATLAS_STEP) {
      setAtlas({ open: true, section: typeof n.context?.atlas_section === "string" ? n.context.atlas_section : null });
      return;
    }
    setAtlas({ open: false, section: null });
    if (n.answers) {
      load(n.answers, n.step);
      setOpened(n.case_id && !n.case_modified ? { id: n.case_id, key: stateKey(n.answers) } : null);
      say("המצב שבו נכתבה ההערה נפתח");
    } else {
      jump(n.step);
    }
  }, [jump, load, say]);

  // ── Taking a note ──
  const startNote = useCallback(() => {
    setPanel(null);
    const sel = currentSelection();
    if (sel) {
      setFormError(null);
      setDraft({ anchor: anchorOf(sel.el, sel.text), step: sel.el.closest("[data-atlas-section]") ? ATLAS_STEP : step });
      return;
    }
    setPicking(p => !p);
  }, [step]);

  const noteOnWholeScreen = useCallback(() => {
    setPicking(false);
    setFormError(null);
    setDraft({
      anchor: { blockId: null, blockLabel: "המסך כולו", quote: null, scenario: null, atlasSection: null, explainText: null },
      step: atlas.open ? ATLAS_STEP : step,
    });
  }, [atlas.open, step]);

  // Note mode: the pointer outlines the piece of text under it, a click takes
  // it. Clicks on the review chrome itself go through untouched.
  useEffect(() => {
    if (!picking) return;
    const box = hover.current;
    const place = (el: HTMLElement | null) => {
      if (!box) return;
      if (!el) { box.style.display = "none"; return; }
      const r = el.getBoundingClientRect();
      Object.assign(box.style, { display: "block", top: `${r.top - 3}px`, left: `${r.left - 3}px`, width: `${r.width + 6}px`, height: `${r.height + 6}px` });
    };
    let last: HTMLElement | null = null;
    const onMove = (e: MouseEvent) => {
      const t = e.target instanceof Element ? pickTarget(e.target) : null;
      last = t;
      place(t);
    };
    const onScroll = () => place(last);
    const onClick = (e: MouseEvent) => {
      if (!(e.target instanceof Element) || !surfaceOf(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      const t = pickTarget(e.target);
      if (!t) return;
      setPicking(false);
      setFormError(null);
      setDraft({ anchor: anchorOf(t), step: t.closest("[data-atlas-section]") ? ATLAS_STEP : step });
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPicking(false); };
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("scroll", onScroll, true);
    document.addEventListener("keydown", onKey, true);
    document.body.style.cursor = "crosshair";
    return () => {
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("keydown", onKey, true);
      document.body.style.cursor = "";
      place(null);
    };
  }, [picking, step]);

  const saveNote = useCallback(async (v: { kind: NoteKind; severity: NoteSeverity; note: string; suggestion: string; quote: string }) => {
    if (!draft) return;
    setSaving(true);
    setFormError(null);
    try {
      if (draft.editing) {
        const { note } = await reviewApi.updateNote(draft.editing.id, { kind: v.kind, severity: v.severity, note: v.note, suggestion: v.suggestion });
        setNotes(prev => prev.map(n => (n.id === note.id ? note : n)));
        say("ההערה עודכנה");
      } else {
        const onAtlas = draft.step === ATLAS_STEP;
        const onReport = !onAtlas && draft.step === "p-result" && !!score;
        const shown = onReport ? shownOnReport(A, score, today) : null;
        const input: NoteInput = {
          step: draft.step,
          variant: onAtlas ? null : pageVariant(draft.step as PageId, A) || null,
          block_id: draft.anchor.blockId,
          block_label: draft.anchor.blockLabel,
          quote: v.quote.trim() || null,
          kind: v.kind,
          severity: v.severity,
          note: v.note,
          suggestion: v.suggestion,
          case_id: onAtlas ? null : opened?.id ?? null,
          case_modified: onAtlas ? false : modified,
          // The atlas is not a questionnaire state; its cards come from the
          // scenario named in the context.
          answers: onAtlas ? null : A,
          context: {
            page_name: stepName(draft.step),
            case_title: onAtlas ? undefined : current?.title,
            scenario: draft.anchor.scenario ?? undefined,
            atlas_section: draft.anchor.atlasSection ?? undefined,
            explain_text: draft.anchor.explainText ?? undefined,
            referrals: shown?.referralKeys,
            tracks: shown?.tracks.map(t => `${t.key}:${t.relevance}`),
            tips: shown?.tipKeys,
            today,
            algo: process.env.NEXT_PUBLIC_QUIZ_ALGO_VERSION ?? undefined,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
          },
        };
        const { note } = await reviewApi.addNote(input);
        setNotes(prev => [note, ...prev]);
        say("ההערה נשמרה");
      }
      setDraft(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "השמירה נכשלה");
    } finally {
      setSaving(false);
    }
  }, [A, current, draft, modified, opened, say, score, today]);

  const withdraw = useCallback(async (n: ReviewNote) => {
    if (!window.confirm("לבטל את ההערה? היא תוסר מהרשימה שלך.")) return;
    try {
      await reviewApi.withdrawNote(n.id);
      setNotes(prev => prev.filter(x => x.id !== n.id));
      say("ההערה בוטלה");
    } catch (err) {
      say(err instanceof Error ? err.message : "הביטול נכשל");
    }
  }, [say]);

  const notesByStep = useMemo(() => {
    const out: Record<string, number> = {};
    for (const n of notes) out[n.step] = (out[n.step] ?? 0) + 1;
    return out;
  }, [notes]);
  const totals = useMemo(() => coverageTotals(coverageGroups(seen, REVIEW_CASES)), [seen]);
  const here = atlas.open ? ATLAS_STEP : step;
  const canNote = hasToken && !!me && !problem;
  const barButton = (on: boolean) => ({
    className: pill,
    style: on
      ? { background: "var(--teal-pale)", color: "var(--teal-dark)" }
      : { background: "transparent", color: "var(--text-2)" },
  });

  return (
    <>
      {/* Room under the last button of a screen for the bar. */}
      <div aria-hidden="true" className="h-24 print:hidden" />

      {atlas.open && (
        <Atlas
          today={today}
          section={atlas.section}
          onClose={() => setAtlas({ open: false, section: null })}
          onSeen={id => markSeen([atlasKey(id)])}
        />
      )}

      {restored && (
        <div {...ui} dir="rtl" className="fixed inset-x-0 top-0 z-[159] border-b px-4 py-2 text-sm print:hidden" style={{ background: "var(--gold-pale)", borderColor: "var(--line)", color: "var(--text)", fontFamily: "'Heebo', sans-serif" }}>
          <div className="mx-auto flex max-w-3xl items-start gap-3">
            <div className="min-w-0 flex-1 leading-relaxed">
              <strong>המצב שבו נכתבה ההערה</strong> · {restored.reviewer} · {restored.kindLabel}{restored.blockLabel ? ` · ${restored.blockLabel}` : ""}
              {restored.quote && <div className="text-xs" style={{ color: "var(--text-2)" }}>על: {restored.quote.length > 160 ? `${restored.quote.slice(0, 160)}…` : restored.quote}</div>}
              <div>{restored.text}</div>
            </div>
            <button type="button" onClick={() => setRestored(null)} className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: "white", color: "var(--text-2)" }}>הסתרה</button>
          </div>
        </div>
      )}

      {picking && (
        <>
          <div ref={hover} className="pointer-events-none fixed z-[157] hidden rounded-lg" style={{ border: "2px solid var(--gold)", background: "rgba(212,144,24,0.10)" }} />
          <div {...ui} dir="rtl" className="fixed inset-x-0 top-3 z-[159] flex justify-center px-3 print:hidden" style={{ fontFamily: "'Heebo', sans-serif" }}>
            <div className="flex flex-wrap items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-white shadow-lg" style={{ background: "var(--gold-dark)" }}>
              <span>לחצו על הטקסט שעליו ההערה</span>
              <button type="button" onClick={noteOnWholeScreen} className="rounded-full bg-white px-3 py-1 text-xs font-bold" style={{ color: "var(--gold-dark)" }}>הערה על המסך כולו</button>
              <button type="button" onClick={() => setPicking(false)} className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: "rgba(255,255,255,0.22)" }}>ביטול</button>
            </div>
          </div>
        </>
      )}

      {panel === "cases" && (
        <Drawer title="מקרים" hint="ילדים בדויים שהשאלון כבר מולא עליהם. כל מקרה נבחר כדי להראות ענף אחר של השאלון ושל מפת הוועדות. אחרי שנפתח מקרה אפשר לשנות בו כל תשובה." onClose={() => setPanel(null)}>
          <CasesPanel seen={seen} currentId={opened?.id ?? null} onOpen={openCase} />
        </Drawer>
      )}
      {panel === "screens" && (
        <Drawer title="מסכים" hint="מעבר ישיר לכל מסך, עם התשובות כפי שהן עכשיו. מסך שאינו במסלול של התשובות האלה נפתח בכל זאת, כדי שאפשר יהיה לקרוא אותו." onClose={() => setPanel(null)}>
          <ScreensPanel step={step} A={A} seen={seen} notesByStep={notesByStep} onJump={pid => { setAtlas({ open: false, section: null }); jump(pid); setPanel(null); }} />
        </Drawer>
      )}
      {panel === "notes" && (
        <Drawer title="ההערות שלי" hint="כל הערה נשמרת עם התשובות שהיו על המסך, כך שאפשר לחזור בדיוק לאותו מצב. כשהערה נבדקת, התשובה מופיעה כאן." onClose={() => setPanel(null)}>
          <NotesPanel notes={notes} step={here} onOpen={openNote} onEdit={n => { setPanel(null); setFormError(null); setDraft({ anchor: anchorOfNote(n), step: n.step, editing: n }); }} onWithdraw={withdraw} />
        </Drawer>
      )}
      {panel === "coverage" && (
        <Drawer title="מה עוד לא ראיתי" onClose={() => setPanel(null)}>
          <CoveragePanel seen={seen} onOpenCase={openCaseById} onOpenAtlas={section => { setPanel(null); setAtlas({ open: true, section }); }} />
        </Drawer>
      )}

      {panel === "help" && (
        <Drawer title="איך עובדים כאן" hint={'שבעה דברים, ואפשר לחזור לכאן בכל רגע דרך "עזרה" בסרגל.'} onClose={() => setPanel(null)}>
          <HelpPanel />
        </Drawer>
      )}

      {draft && <NoteForm key={draft.editing?.id ?? "new"} draft={draft} busy={saving} error={formError} onSave={saveNote} onCancel={() => setDraft(null)} />}

      {toast && (
        <div {...ui} dir="rtl" className="fixed inset-x-0 bottom-[76px] z-[171] flex justify-center px-3 print:hidden" style={{ fontFamily: "'Heebo', sans-serif" }}>
          <div className="rounded-full px-4 py-2 text-sm font-bold text-white shadow-lg" style={{ background: "var(--text)" }}>{toast}</div>
        </div>
      )}

      {/* The bar. */}
      <div {...ui} dir="rtl" className="fixed inset-x-0 bottom-0 z-[160] border-t bg-white print:hidden" style={{ borderColor: "var(--line)", fontFamily: "'Heebo', sans-serif", boxShadow: "0 -6px 24px rgba(19,31,30,0.08)" }}>
        {problem && <div className="px-4 py-1.5 text-center text-xs font-semibold" style={{ background: "#FBEDE9", color: "#A83B22" }}>{problem}</div>}
        <div className="mx-auto flex max-w-5xl items-center gap-1 overflow-x-auto px-3 py-2">
          <div className="me-2 flex-shrink-0 leading-tight">
            <div className="text-xs font-black" style={{ color: "var(--gold-dark)" }}>מצב ביקורת{me ? ` · ${me.name}` : ""}</div>
            <div className="text-[11px]" style={{ color: "var(--muted)" }}>
              {current ? `${current.title}${modified ? " · שונה" : ""}` : "מקרים בדויים בלבד - לא למלא כאן תלמיד אמיתי"}
            </div>
          </div>
          <button type="button" onClick={() => setPanel(p => (p === "cases" ? null : "cases"))} {...barButton(panel === "cases")}>מקרים</button>
          <button type="button" onClick={() => setPanel(p => (p === "screens" ? null : "screens"))} {...barButton(panel === "screens")}>מסכים</button>
          <button type="button" onClick={() => { setPanel(null); setAtlas(a => ({ open: !a.open, section: null })); }} {...barButton(atlas.open)}>אטלס הוועדות</button>
          <button type="button" onClick={() => setPanel(p => (p === "help" ? null : "help"))} {...barButton(panel === "help")}>עזרה</button>
          <span className="flex-1" />
          {hasToken && (
            <>
              <button type="button" onClick={() => setPanel(p => (p === "coverage" ? null : "coverage"))} {...barButton(panel === "coverage")}>ראיתי {totals.seen}/{totals.total}</button>
              <button type="button" onClick={() => setPanel(p => (p === "notes" ? null : "notes"))} {...barButton(panel === "notes")}>
                ההערות שלי{notes.length ? ` (${notes.length})` : ""}{notesByStep[here] ? ` · ${notesByStep[here]} כאן` : ""}
              </button>
              <button type="button" disabled={!canNote} onClick={startNote} className={`${pill} text-white disabled:opacity-40`} style={{ background: picking ? "var(--gold-dark)" : "var(--teal-dark)" }}>
                {picking ? "בוחרים…" : "+ הערה"}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/** The anchor of a note already written, for the edit form's header. */
function anchorOfNote(n: ReviewNote): Anchor {
  return { blockId: n.block_id, blockLabel: n.block_label, quote: n.quote, scenario: null, atlasSection: null, explainText: null };
}
