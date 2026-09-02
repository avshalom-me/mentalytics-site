/**
 * Shared UI helpers of the kids questionnaire: buttons, cards, the nav row.
 *
 * Lifted verbatim out of KidsQuiz.tsx so the counsellor screens in
 * counselor.tsx can use the same pieces without a circular import. Pure
 * presentation - none of these close over quiz state.
 */

import type { Ans } from "./quiz-logic";

// ── Shared UI helpers ─────────────────────────────────────────────────────────
// min-h-[44px] on every tappable control: the option pills were 27-32px tall,
// well under the 44px minimum touch target, which is a big part of why the quiz
// felt fiddly on a phone.
export const BTN_BASE  = "px-5 py-2 min-h-[44px] border-2 rounded-full font-medium text-sm transition-all cursor-pointer";
export const BTN_SEL   = "bg-[var(--teal)] text-white border-[var(--teal)]";
export const BTN_DEF   = "bg-white text-[#3a4a5a] border-[#d0dae8] hover:border-[var(--teal)]";
// min-w-0 instead of min-w-[40px]: the fixed floor meant a 7-point scale needed
// 316px and only 282px were available inside a card on a 375px phone, so every
// one of them wrapped onto a second line. flex-1 alone divides the row evenly.
export const SB_BASE   = "min-w-0 h-11 border-2 rounded-lg font-semibold text-sm transition-all cursor-pointer flex-1";
export const SB_SEL    = "bg-[var(--teal)] text-white border-[var(--teal)]";
export const SB_DEF    = "bg-white text-[#3a4a5a] border-[#d0dae8] hover:border-[var(--teal)]";
// flex-1 + min-w-0: these pills sit in plain `flex gap-2` rows with no wrap, so a
// 7-point scale used to run off the side of a phone. Sharing the row width keeps
// every scale on one line at any width instead of overflowing or breaking in two.
export const SO_BASE   = "flex-1 min-w-0 px-2 py-1.5 min-h-[44px] border-2 rounded-2xl text-sm font-medium transition-all cursor-pointer";
export const SO_SEL    = "bg-[var(--teal)] text-white border-[var(--teal)]";
export const SO_DEF    = "bg-white text-[#3a4a5a] border-[#d0dae8] hover:border-[var(--teal)]";
export const CB_BASE   = "px-4 py-2 min-h-[44px] border-2 rounded-full text-sm font-medium transition-all cursor-pointer";
export const CB_SEL    = "bg-[var(--teal)] text-white border-[var(--teal)]";
export const CB_DEF    = "bg-white text-[#3a4a5a] border-[#d0dae8] hover:border-[var(--teal)]";

export function ob(selected: boolean) { return `${BTN_BASE} ${selected ? BTN_SEL : BTN_DEF}`; }
export function sb(selected: boolean) { return `${SB_BASE} ${selected ? SB_SEL : SB_DEF}`; }
export function so(selected: boolean) { return `${SO_BASE} ${selected ? SO_SEL : SO_DEF}`; }
export function cb(selected: boolean) { return `${CB_BASE} ${selected ? CB_SEL : CB_DEF}`; }

export function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100">{children}</div>;
}
export function StepTag({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">{children}</div>;
}
export function StepQ({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-bold text-[#1a2a3a] mb-1 leading-snug">{children}</h2>;
}
export function StepHint({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-gray-400 mb-5 leading-relaxed">{children}</p>;
}
export function EqNum({ n }: { n: number }) {
  return <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[var(--teal)] text-white text-sm font-bold mb-3">{n}</div>;
}
// showBack defaults to true now: the parent passes onBack only while a step back
// is actually available (see pageProps), so the presence of the handler is the
// switch. It used to be wired up at every call site and rendered at none.
// nextDisabled greys the button out; passing onNext={undefined} removes it
// entirely. On a screen with unanswered required questions the second reads as
// "the questionnaire ended here" - especially on the last screen - so anything
// waiting for an answer should stay visible and disabled.
export function NavRow({ onBack, onNext, backLabel = "→ חזרה", nextLabel = "המשך ←", showBack = true, nextDisabled = false }: {
  onBack?: () => void; onNext?: () => void; backLabel?: string; nextLabel?: string; showBack?: boolean; nextDisabled?: boolean;
}) {
  return (
    <div className="flex gap-3 mt-7 flex-wrap">
      {onNext && (
        <button onClick={onNext} disabled={nextDisabled} className="px-8 py-3 bg-gradient-to-r from-[#2c3e7a] to-[#4a6fa5] text-white rounded-full font-bold text-sm shadow-md hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed">{nextLabel}</button>
      )}
      {showBack && onBack && (
        <button onClick={onBack} className="px-6 py-3 border-2 border-[var(--teal)] text-[var(--teal)] rounded-full font-semibold text-sm hover:bg-blue-50 transition-all">{backLabel}</button>
      )}
    </div>
  );
}
/**
 * "You still have N unanswered items" under a blocked Continue.
 *
 * Every screen that uses this sits behind a gate the parent already answered
 * yes to, so tapping past the detail questionnaire scores that section 0 and
 * the report then contradicts what they just said: it stays silent about a
 * difficulty they flagged, or - on the anxiety screen - states low stress
 * outright. Blocking is the fix at source; the informed fallbacks in the scorer
 * are the second line, for a client that malfunctions rather than a parent who
 * skips.
 */
/**
 * How many of `keys` carry no answer.
 *
 * Tests for undefined rather than falsiness on purpose: the trauma scale starts
 * at 0, so a genuine "כלל לא" is falsy and would otherwise be counted as
 * unanswered and block a screen the parent had in fact completed.
 */
export function countMissing(A: Ans, keys: string[]): number {
  return keys.filter(k => A[k] === undefined || A[k] === null || A[k] === "").length;
}
export function IncompleteHint({ missing }: { missing: number }) {
  if (missing <= 0) return null;
  return (
    <p className="text-red-500 text-sm font-semibold mt-3">
      ⛔ {missing === 1 ? "נותר סעיף אחד ללא מענה" : `נותרו ${missing} סעיפים ללא מענה`} - יש לענות על כולם כדי להמשיך
    </p>
  );
}
export function SubCard({ children }: { children: React.ReactNode }) {
  return <div className="bg-[var(--surface)] rounded-xl p-3 sm:p-5 mt-2 border border-[var(--line)] space-y-4">{children}</div>;
}
export function GradeBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#fdf8ff] border-2 border-purple-300 rounded-xl p-3 sm:p-4 mt-3">
      <div className="text-sm font-bold text-purple-700 mb-3">{title}</div>
      {children}
    </div>
  );
}

// Scale 1–N (auto-advance on click)
export function ScaleRow({ max, val, onChange }: { max: number; val: number; onChange: (v: number) => void }) {
  return (
    <div className="scale-grid mt-1" style={{ ["--scale-cols" as string]: max }}>
      {Array.from({length: max}, (_, i) => i + 1).map(n => (
        <button key={n} className={sb(val === n)} onClick={() => onChange(n)}>{n}</button>
      ))}
    </div>
  );
}
// Yes/No row
export function YNRow({ val, onChange }: { val: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-3 mt-1">
      <button className={`flex-1 text-center py-3 text-base font-bold rounded-xl border-2 transition-all ${val==="כן" ? "bg-[var(--teal)] text-white border-[var(--teal)]" : "bg-white border-[#d0dae8] text-[#3a4a5a] hover:border-[var(--teal)]"}`} onClick={() => onChange("כן")}>כן</button>
      <button className={`flex-1 text-center py-3 text-base font-bold rounded-xl border-2 transition-all ${val==="לא" ? "bg-[var(--teal)] text-white border-[var(--teal)]" : "bg-white border-[#d0dae8] text-[#3a4a5a] hover:border-[var(--teal)]"}`} onClick={() => onChange("לא")}>לא</button>
    </div>
  );
}

