"use client";

/**
 * The counsellor's angle on the kids questionnaire.
 *
 * Everything the school sees that home does not, asked inside the branch it
 * belongs to - attendance where anxiety is explored, organisation where
 * learning is, isolation where the social block is - plus the closing
 * refinement screen (what was tried, what the file holds) and the addendum on
 * the report: the committee map and the summary to paste. The clinical
 * questions themselves stay the questionnaire's own; nothing here is scored.
 *
 * Rendered by KidsQuiz.tsx when audience === "counselor". None of these
 * components is reachable from /kids.
 */

import { useMemo, useState } from "react";
import { CrisisResources } from "@/app/components/CrisisResources";
import type { KidsDomainResult } from "@/app/lib/kids-recommendations";
import {
  SCHOOL_GRADES,
  DIAGNOSING_BODIES,
  israelToday,
  formatDateHe,
  type Diagnosis,
  type DiagnosisKind,
  type SchoolTrack,
  type SchoolGrade,
} from "@/app/lib/school-tracks";
import { mapSchoolTracks } from "@/app/lib/school-tracks-engine";
import {
  INTERVENTIONS,
  FILL_MODE_LABELS,
  PARENTS_LABELS,
  DURATION_LABELS,
  LEVEL_LABELS,
  ATTEND_LABELS,
  SUPPORT_RESPONSE_LABELS,
  BULLY_LABELS,
  OUTCOME_LABELS,
  TEAM_LABELS,
  ZAKAUT_LABELS,
  HATAMOT_LABELS,
  YES_NO_UNKNOWN_LABELS,
  SCHOOL_DIAGNOSIS_KINDS,
  DIAGNOSIS_KIND_LABELS,
  RELEVANCE_LABELS,
  UNKNOWN,
  toTracksInput,
  buildSchoolSummary,
  type CounselorFields,
  type Level,
  type Outcome,
  type Unknown,
} from "@/app/lib/school-report";
import { PAGES, type Ans } from "./quiz-logic";
import { Card, StepTag, StepQ, StepHint, NavRow, YNRow, ob } from "./ui";

type ScreenProps = { A: Ans; setA: (a: Ans) => void; onNext: (a: Ans) => void; onBack?: () => void };
type Entries<T extends string> = [T, string][];
const entries = <T extends string>(o: Record<T, string>) => Object.entries(o) as Entries<T>;

// ── Local drafts ─────────────────────────────────────────────────────────────
// A counsellor is interrupted by the school day and by the parent on the line.
// Drafts live in this browser only, carry no name by construction, expire after
// 21 days, and several may be open at once - she has a caseload, not a child.
// Read through useSyncExternalStore in KidsQuiz: the server renders an empty
// list, the client reads storage on hydration, and every write notifies.
export type Draft = { id: string; savedAt: number; step: string; A: Ans };
const DRAFT_KEY = "school_drafts_v1";
const DRAFT_EVENT = "school-drafts-changed";
const DRAFT_TTL_MS = 21 * 24 * 60 * 60 * 1000;
const MAX_DRAFTS = 5;
export const NO_DRAFTS: Draft[] = [];
let draftsRaw: string | null | undefined;
let draftsCache: Draft[] = NO_DRAFTS;

function parseDrafts(raw: string | null): Draft[] {
  if (!raw) return NO_DRAFTS;
  try {
    const now = Date.now();
    // A draft whose step is not a screen of this questionnaire came from an
    // earlier shape of the rubric and cannot be resumed; it is dropped quietly.
    return (JSON.parse(raw) as Draft[])
      .filter(d => d && d.id && now - d.savedAt < DRAFT_TTL_MS && (PAGES as readonly string[]).includes(d.step))
      .sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return NO_DRAFTS;
  }
}
export function readDrafts(): Draft[] {
  let raw: string | null = null;
  try { raw = localStorage.getItem(DRAFT_KEY); } catch { raw = null; }
  if (raw !== draftsRaw) { draftsRaw = raw; draftsCache = parseDrafts(raw); }
  return draftsCache;
}
export function subscribeDrafts(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(DRAFT_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(DRAFT_EVENT, onChange);
  };
}
function persistDrafts(list: Draft[]) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(list.slice(0, MAX_DRAFTS))); } catch { /* storage may be unavailable */ }
  window.dispatchEvent(new Event(DRAFT_EVENT));
}
export function upsertDraft(d: Draft) {
  persistDrafts([d, ...readDrafts().filter(x => x.id !== d.id)]);
}
export function removeDraft(id: string) {
  persistDrafts(readDrafts().filter(x => x.id !== id));
}
export function draftLabel(d: Draft): string {
  const f = d.A as CounselorFields;
  const idx = PAGES.indexOf(d.step as (typeof PAGES)[number]);
  const where = d.step === "p-result" ? "דוח מוכן" : idx > 0 ? `${Math.round((idx / (PAGES.length - 1)) * 100)}%` : "התחלה";
  return [f._grade ? `כיתה ${f._grade}` : "ללא כיתה", where, `נשמר ${new Date(d.savedAt).toLocaleDateString("he-IL")}`].join(" · ");
}

// ── Small pieces ─────────────────────────────────────────────────────────────
function Choice<T extends string | number>({ value, options, onChange }: { value?: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, label]) => (
        <button key={v} type="button" className={ob(value === v)} onClick={() => onChange(v)}>{label}</button>
      ))}
    </div>
  );
}

/**
 * The same row with a "לא יודע/ת" option on the end.
 *
 * A counsellor sees six hours of the day, and on her own observations not
 * knowing is not the same as answering "no": the summary and the tracks engine
 * both leave such a field out rather than report an absence of difficulty. That
 * is the opposite of the emotional items, which are summed against thresholds
 * and therefore store a real "no" - see markUnknown in quiz-logic.
 */
function ChoiceU<T extends string | number>({ value, options, onChange }: {
  value?: T | Unknown; options: [T, string][]; onChange: (v: T | Unknown) => void;
}) {
  const all: [T | Unknown, string][] = [...options, [UNKNOWN, "לא יודע/ת"]];
  return <Choice value={value} options={all} onChange={onChange} />;
}
function LevelRow({ value, onChange }: { value?: Level | Unknown; onChange: (v: Level | Unknown) => void }) {
  return <ChoiceU value={value} options={LEVEL_LABELS.map((l, i) => [i as Level, l] as [Level, string])} onChange={onChange} />;
}
function Q({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm font-semibold mb-2" style={{ color: "var(--text)" }}>{label}</div>
      {children}
    </div>
  );
}
function Box({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--surface)] rounded-xl p-3 sm:p-5 mt-3 border border-[var(--line)] space-y-4">
      {title && <div className="text-sm font-bold" style={{ color: "var(--teal-dark)" }}>{title}</div>}
      {children}
    </div>
  );
}

/** The frame around every in-branch counsellor block, so it reads as one voice across the questionnaire. */
function CounselorBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-5 rounded-xl p-4 space-y-4" style={{ background: "var(--teal-pale)", border: "1px solid var(--teal-mid)" }}>
      <div className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--teal-dark)" }}>🏫 מה רואים בבית הספר</div>
      {children}
    </div>
  );
}

const setField = (A: Ans, setA: (a: Ans) => void) => <K extends keyof CounselorFields>(k: K, v: CounselorFields[K]) => setA({ ...A, [k]: v });

// ── p-consent (counsellor) ───────────────────────────────────────────────────
export function PageConsentCounselor({ onStart, drafts, onResume, onDelete }: { onStart: () => void; drafts: Draft[]; onResume: (d: Draft) => void; onDelete: (id: string) => void }) {
  const [agreed, setAgreed] = useState(false);
  return (
    <div>
      <h1 className="mb-2 text-xl font-black leading-snug" style={{ color: "var(--text)" }}>שאלון מסייע להפניות ליועצות ולצוותי חינוך</h1>
      <p className="mb-5 text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
        אותו שאלון שהורים ממלאים על ילדיהם, מנקודת המבט של בית הספר: בכל תחום נוספות שאלות על מה שרואים בכיתה, ובסוף כמה שאלות שמדייקות את ההפניה.
      </p>
      <ul className="mb-5 flex flex-col gap-2">
        {[
          ["🔒", "ללא פרטים מזהים", "אין שדה שם ואין טקסט חופשי. הטיוטה נשמרת בדפדפן הזה בלבד, עד 21 יום"],
          ["⏱️", "בין 4 - 6 דק'", "עונים רק על התחומים שסומנו; אפשר לעצור ולהמשיך מאותו מחשב"],
          ["📋", "תוצר לעבודה", "הבנה ראשונית של מוקד הקושי/הקשיים בכל אחד מהמסלולים (רגשי, לימודי, חברתי, התנהגותי), הפנייה + הסבר לטיפול/אבחון המדויק ביותר, ומפת הוועדות עם המועדים"],
        ].map(([icon, title, desc]) => (
          <li key={title} className="flex items-start gap-3 rounded-xl p-3 text-sm" style={{ background: "var(--teal-pale)", border: "1px solid var(--teal-mid)" }}>
            <span aria-hidden className="text-base leading-none">{icon}</span>
            <span>
              <strong style={{ color: "var(--teal-dark)" }}>{title}</strong>
              <span className="block text-xs" style={{ color: "var(--text-2)" }}>{desc}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mb-3 text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
        חשוב לומר מראש: השאלון מסייע בהכוונה ובהתארגנות. הוא <strong>אינו אבחון</strong>, אינו קובע זכאות, ואינו מחליף את שיקול הדעת המקצועי שלך או את החלטת הוועדה.
      </p>
      <details className="mb-5 rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        <summary className="cursor-pointer select-none text-sm font-bold" style={{ color: "var(--teal-dark)" }}>לנוסח המלא</summary>
        <div className="mt-3 leading-relaxed" style={{ color: "var(--text-2)" }}>
          <p className="mb-3 text-sm">השאלון מיועד לאנשי מקצוע בצוות החינוכי, הממלאים אותו במסגרת תפקידם. אין להזין בו שם, מספר זהות, כתובת או כל פרט מזהה אחר של התלמיד/ה או המשפחה, והשאלון בנוי כך שאינו מבקש פרטים כאלה.</p>
          <p className="mb-3 text-sm">התוצרים - הממצאים, ההמלצות, מפת המסלולים וטיוטת הסיכום - הם כלי עזר להכוונה. הם אינם אבחון פסיכולוגי, פסיכיאטרי או חינוכי, אינם קובעים זכאות לשירותי חינוך מיוחדים או להתאמות, ואינם מחליפים הערכה של גורם מוסמך או החלטה של ועדה.</p>
          <p className="mb-3 text-sm">המועדים והכללים המוצגים נלקחו מפרסומים רשמיים של משרד החינוך ומצוין לצידם מועד האימות. הם עשויים להשתנות, ולרשות המקומית עשויים להיות מועדים פנימיים משלה - יש לאמת מול הרשות ומול חוזרי המנכ&quot;ל העדכניים לפני כל הגשה.</p>
          <p className="text-sm">האחריות המקצועית וההחלטות נשארות בידי הממלא/ת ובידי הגורמים המוסמכים. הטיוטות נשמרות בדפדפן שבו מולא השאלון בלבד ואינן נשלחות לשרת. הגורמים המפעילים את הכלי אינם נושאים באחריות לנזק, ישיר או עקיף, שייגרם כתוצאה מהשימוש בו.</p>
        </div>
      </details>
      <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl p-4 text-sm hover:opacity-90" style={{ background: "var(--teal-pale)", border: "1px solid var(--teal-mid)", color: "var(--teal-dark)" }}>
        <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="mt-0.5 h-5 w-5 flex-shrink-0 accent-[#2e7d8c]" />
        <span>אני ממלא/ת את השאלון במסגרת תפקידי המקצועי, לא אזין פרטים מזהים, וקראתי את ההצהרה</span>
      </label>
      <div className="mt-5">
        <button type="button" disabled={!agreed} onClick={onStart}
          className="w-full rounded-xl bg-[var(--teal-dark)] py-4 text-base font-bold text-white disabled:opacity-40 hover:opacity-90">
          מתחילים ←
        </button>
      </div>
      {drafts.length > 0 && (
        <div className="mt-6">
          <div className="text-sm font-bold mb-2" style={{ color: "var(--text)" }}>טיוטות שמורות בדפדפן זה</div>
          <ul className="flex flex-col gap-2">
            {drafts.map(d => (
              <li key={d.id} className="flex items-center justify-between gap-2 rounded-xl p-3 text-sm" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
                <span style={{ color: "var(--text-2)" }}>{draftLabel(d)}</span>
                <span className="flex gap-2 flex-shrink-0">
                  <button type="button" onClick={() => onResume(d)} className="px-3 py-1.5 rounded-full text-xs font-bold text-white" style={{ background: "var(--teal)" }}>המשך</button>
                  <button type="button" onClick={() => onDelete(d.id)} className="px-3 py-1.5 rounded-full text-xs font-semibold border" style={{ color: "var(--muted)", borderColor: "var(--line)" }}>מחיקה</button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── p-demo (counsellor): age, grade, duration ────────────────────────────────
export function PageDemoCounselor({ A, setA, onNext, onBack }: ScreenProps) {
  const [showErr, setShowErr] = useState(false);
  const f = A as CounselorFields;
  const age = parseInt(A._age) || 0;
  const ageValid = age >= 5 && age <= 19;
  const set = setField(A, setA);
  function handleNext() {
    if (!ageValid || !f._grade || !f.c_duration) { setShowErr(true); return; }
    setShowErr(false);
    onNext(A);
  }
  return (
    <div>
      <Card>
        <StepTag>שלב 1 מתוך 2</StepTag>
        <StepQ>קצת על התלמיד/ה</StepQ>
        <StepHint>שלוש שאלות קצרות, ומתחילים</StepHint>
        <div className="mb-5">
          <label className="text-sm font-semibold text-gray-600 block mb-2">גיל</label>
          <input type="number" min={5} max={19} placeholder="גיל" value={A._age || ""}
            onChange={e => setA({ ...A, _age: e.target.value })}
            className="border-2 border-[#d0dae8] rounded-xl px-3 py-2 w-24 focus:border-[var(--teal)] outline-none" />
        </div>
        <div className="mb-5">
          <label className="text-sm font-semibold text-gray-600 block mb-2">כיתה</label>
          <Choice value={f._grade} options={SCHOOL_GRADES.map(g => [g, g] as [SchoolGrade, string])} onChange={v => set("_grade", v)} />
        </div>
        <div>
          <label className="text-sm font-semibold text-gray-600 block mb-2">מזה כמה זמן הקושי מורגש</label>
          <Choice value={f.c_duration} options={entries(DURATION_LABELS)} onChange={v => set("c_duration", v)} />
        </div>
      </Card>
      <NavRow onBack={onBack} onNext={handleNext} />
      {showErr && (
        <p className="text-red-500 text-sm font-semibold mt-3">
          {!ageValid ? "⛔ יש למלא גיל בין 5 ל-19" : "⛔ יש לבחור כיתה ומשך קושי לפני המשך"}
        </p>
      )}
    </div>
  );
}

// ── In-branch blocks ─────────────────────────────────────────────────────────
export function CounselorQ1Block({ A, setA }: { A: Ans; setA: (a: Ans) => void }) {
  const f = A as CounselorFields; const set = setField(A, setA);
  return (
    <CounselorBlock>
      <Q label="ביקור סדיר"><ChoiceU value={f.c_attend} options={entries(ATTEND_LABELS)} onChange={v => set("c_attend", v)} /></Q>
      <Q label="שינוי חד בהתנהגות או במצב הרוח השנה">
        <ChoiceU value={f.c_change} options={[["כן", "כן"], ["לא", "לא"]]} onChange={v => set("c_change", v as CounselorFields["c_change"])} />
      </Q>
    </CounselorBlock>
  );
}
export function CounselorAcadBlock({ A, setA }: { A: Ans; setA: (a: Ans) => void }) {
  const f = A as CounselorFields; const set = setField(A, setA);
  return (
    <CounselorBlock>
      <Q label="תגובה לתמיכה לימודית שניתנה"><ChoiceU value={f.c_support} options={entries(SUPPORT_RESPONSE_LABELS)} onChange={v => set("c_support", v)} /></Q>
      <Q label="קושי בהתארגנות (ציוד, שיעורי בית, זמנים)"><LevelRow value={f.c_org} onChange={v => set("c_org", v)} /></Q>
    </CounselorBlock>
  );
}
export function CounselorBehBlock({ A, setA }: { A: Ans; setA: (a: Ans) => void }) {
  const f = A as CounselorFields; const set = setField(A, setA);
  return (
    <CounselorBlock>
      <Q label="קושי בוויסות בכיתה ובהפסקות"><LevelRow value={f.c_regulation} onChange={v => set("c_regulation", v)} /></Q>
      <Q label="מעורבות כפוגע/ת בהצקות או בחרם"><ChoiceU value={f.c_bully_perp} options={entries(BULLY_LABELS)} onChange={v => set("c_bully_perp", v)} /></Q>
    </CounselorBlock>
  );
}
export function CounselorSocBlock({ A, setA }: { A: Ans; setA: (a: Ans) => void }) {
  const f = A as CounselorFields; const set = setField(A, setA);
  return (
    <CounselorBlock>
      <Q label="בידוד או דחייה חברתית בכיתה"><LevelRow value={f.c_isolation} onChange={v => set("c_isolation", v)} /></Q>
      <Q label="נפגע/ת מהצקות או חרם"><ChoiceU value={f.c_bully_victim} options={entries(BULLY_LABELS)} onChange={v => set("c_bully_victim", v)} /></Q>
    </CounselorBlock>
  );
}

export function CounselorSafetyNotice() {
  return (
    <div className="mt-4 rounded-xl p-4 text-sm leading-relaxed" style={{ background: "#FBEDE9", border: "1px solid #E8C4B8", color: "var(--text)" }}>
      <div className="font-bold mb-1" style={{ color: "#A83B22" }}>נושא בטיחות עלה</div>
      <p>לפי הנהלים המחייבים בבית הספר יש ליידע מיד את פסיכולוג/ית בית הספר ואת המנהל/ת, ולא להשאיר את התלמיד/ה ללא ליווי. השאלון אינו תחליף להערכת סיכון. אפשר להמשיך במילוי אחרי שהדיווח נעשה.</p>
      <CrisisResources className="mt-3" />
    </div>
  );
}

// ── p-refine: right before the report ────────────────────────────────────────
export function PageRefine({ A, setA, onNext, onBack }: ScreenProps) {
  const f = A as CounselorFields; const set = setField(A, setA);
  const thisYear = Number(israelToday().slice(0, 4));
  const years = Array.from({ length: 15 }, (_, i) => thisYear - i);
  const diagnoses = f.c_diag ?? [];
  const tried = f.c_tried ?? {};
  const [adding, setAdding] = useState<{ kind?: DiagnosisKind; year?: number; signedBy?: string }>({});
  const add = () => {
    if (!adding.kind || !adding.year) return;
    const d: Diagnosis = { kind: adding.kind, year: adding.year };
    if (adding.signedBy) d.signedBy = adding.signedBy as Diagnosis["signedBy"];
    set("c_diag", [...diagnoses, d]);
    setAdding({});
  };
  const toggleTried = (k: keyof typeof tried) => {
    const next = { ...tried };
    if (next[k]) delete next[k]; else next[k] = "partial";
    set("c_tried", next);
  };
  const missing = [f.c_fill, f.c_parents, f.c_team, f.c_zakaut, f.c_hatamot].filter(x => !x).length;
  const selectCls = "w-full rounded-xl border-2 border-[#d0dae8] bg-white px-3 py-2 text-sm min-h-[44px]";

  return (
    <div>
      <Card>
        <StepTag>לפני הדוח</StepTag>
        <StepQ>כמה שאלות שמדייקות את ההפניה</StepQ>
        <StepHint>מה כבר נוסה, מה כבר יש בתיק, ומי היה שותף למילוי. מכאן המנוע מחשב מה תקף, מה חסר ומה המועד הקרוב.</StepHint>

        <Box title="המילוי">
          <Q label="איך מולא השאלון"><Choice value={f.c_fill} options={entries(FILL_MODE_LABELS)} onChange={v => set("c_fill", v)} /></Q>
          <Q label="ההורים"><Choice value={f.c_parents} options={entries(PARENTS_LABELS)} onChange={v => set("c_parents", v)} /></Q>
        </Box>

        <Box title="מה כבר נוסה בבית הספר">
          <p className="text-xs" style={{ color: "var(--muted)" }}>סמני מה נוסה; לכל מה שסומן - מה קרה. זה בדיוק מה שוועדת זכאות מבקשת כ&quot;סיכום התערבויות&quot;.</p>
          <div className="flex flex-wrap gap-2">
            {INTERVENTIONS.map(it => (
              <button key={it.key} type="button" className={ob(!!tried[it.key])} onClick={() => toggleTried(it.key)}>{it.label}</button>
            ))}
          </div>
          {INTERVENTIONS.filter(it => tried[it.key]).map(it => (
            <Q key={it.key} label={it.label}>
              <Choice value={tried[it.key]} options={entries(OUTCOME_LABELS)} onChange={v => set("c_tried", { ...tried, [it.key]: v as Outcome })} />
            </Q>
          ))}
        </Box>

        <Box title="אבחונים וחוות דעת בתיק">
          {diagnoses.length > 0 && (
            <ul className="flex flex-col gap-2">
              {diagnoses.map((d, i) => (
                <li key={i} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm border border-[var(--line)]">
                  <span>{DIAGNOSIS_KIND_LABELS[d.kind]} ({d.year}){d.signedBy ? ` · ${d.signedBy}` : ""}</span>
                  <button type="button" onClick={() => set("c_diag", diagnoses.filter((_, j) => j !== i))} className="text-xs font-semibold" style={{ color: "var(--muted)" }}>הסרה</button>
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-2 sm:grid-cols-3">
            <select className={selectCls} value={adding.kind ?? ""} onChange={e => setAdding(a => ({ ...a, kind: (e.target.value || undefined) as DiagnosisKind | undefined }))}>
              <option value="">סוג האבחון</option>
              {SCHOOL_DIAGNOSIS_KINDS.map(k => <option key={k} value={k}>{DIAGNOSIS_KIND_LABELS[k]}</option>)}
            </select>
            <select className={selectCls} value={adding.year ?? ""} onChange={e => setAdding(a => ({ ...a, year: e.target.value ? Number(e.target.value) : undefined }))}>
              <option value="">שנה</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select className={selectCls} value={adding.signedBy ?? ""} onChange={e => setAdding(a => ({ ...a, signedBy: e.target.value || undefined }))}>
              <option value="">מי חתום/ה (אם ידוע)</option>
              {DIAGNOSING_BODIES.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <button type="button" onClick={add} disabled={!adding.kind || !adding.year} className={`${ob(false)} disabled:opacity-40`}>+ הוספה לתיק</button>
          <p className="text-xs" style={{ color: "var(--muted)" }}>החותם/ת קובע/ת אם המסמך קביל לוועדת זכאות: התוספת הראשונה לתיקון 11 מונה התמחות, לא רק מקצוע. אם לא ידוע, המפה תבקש לבדוק.</p>
        </Box>

        <Box title="ועדות">
          <Q label="צוות רב-מקצועי בית-ספרי"><Choice value={f.c_team} options={entries(TEAM_LABELS)} onChange={v => set("c_team", v)} /></Q>
          <Q label="ועדת זכאות ואפיון"><Choice value={f.c_zakaut} options={entries(ZAKAUT_LABELS)} onChange={v => set("c_zakaut", v)} /></Q>
          {f.c_zakaut === "decided" && (
            <Q label="תאריך קבלת ההחלטה אצל ההורים (לחישוב חלון ההשגה)">
              <input type="date" className={selectCls} value={f.c_zakaut_on ?? ""} onChange={e => set("c_zakaut_on", e.target.value || undefined)} />
            </Q>
          )}
          <Q label="התאמות בדרכי היבחנות"><Choice value={f.c_hatamot} options={entries(HATAMOT_LABELS)} onChange={v => set("c_hatamot", v)} /></Q>
          {f.c_hatamot === "district_decided" && (
            <Q label="תאריך קבלת תשובת הוועדה המחוזית (לחישוב חלון הערעור)">
              <input type="date" className={selectCls} value={f.c_hatamot_on ?? ""} onChange={e => set("c_hatamot_on", e.target.value || undefined)} />
            </Q>
          )}
          <Q label="מגבלה כלכלית מוכרת במשפחה"><Choice value={f.c_economic} options={entries(YES_NO_UNKNOWN_LABELS)} onChange={v => set("c_economic", v)} /></Q>
        </Box>
      </Card>
      {missing > 0 && <p className="text-red-500 text-sm font-semibold mt-3">⛔ {missing === 1 ? "נותר סעיף אחד ללא מענה" : `נותרו ${missing} סעיפים ללא מענה`} - המילוי, ההורים ושלוש שאלות הוועדות</p>}
      <NavRow onBack={onBack} onNext={() => onNext(A)} nextLabel="לדוח ←" nextDisabled={missing > 0} />
    </div>
  );
}

// ── The addendum on the report ───────────────────────────────────────────────
const REL_STYLE: Record<SchoolTrack["relevance"], { bg: string; fg: string }> = {
  primary: { bg: "var(--gold-pale)", fg: "var(--gold-dark)" },
  consider: { bg: "var(--teal-pale)", fg: "var(--teal-dark)" },
  info: { bg: "var(--surface-2)", fg: "var(--muted)" },
};

function TrackCard({ t }: { t: SchoolTrack }) {
  const s = REL_STYLE[t.relevance];
  return (
    <div className="rounded-2xl p-4 sm:p-5 border bg-white" style={{ borderColor: "var(--line)" }}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-base font-extrabold" style={{ color: "var(--text)" }}>{t.name}</h3>
        <span className="text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap" style={{ background: s.bg, color: s.fg }}>{RELEVANCE_LABELS[t.relevance]}</span>
      </div>
      <ul className="text-sm space-y-1 mb-2" style={{ color: "var(--text-2)" }}>{t.why.map((w, i) => <li key={i}>{w}</li>)}</ul>
      {t.deadline && (
        <div className="rounded-xl p-3 text-sm mb-2" style={{ background: s.bg, color: "var(--text)" }}>
          <div className="font-bold" style={{ color: s.fg }}>📅 {t.deadline.label}</div>
          {t.deadline.note && <div className="text-xs mt-1" style={{ color: "var(--text-2)" }}>{t.deadline.note}</div>}
        </div>
      )}
      {t.cautions.length > 0 && (
        <ul className="text-sm space-y-1 mb-2" style={{ color: "#A83B22" }}>{t.cautions.map((c, i) => <li key={i}>⚠️ {c}</li>)}</ul>
      )}
      <details className="text-sm">
        <summary className="cursor-pointer font-semibold" style={{ color: "var(--teal-dark)" }}>צעדים, מסמכים וערר</summary>
        <div className="mt-2 space-y-3" style={{ color: "var(--text-2)" }}>
          {t.steps.length > 0 && <div><div className="font-bold text-xs mb-1" style={{ color: "var(--text)" }}>צעדים</div><ol className="list-decimal ps-5 space-y-1">{t.steps.map((x, i) => <li key={i}>{x}</li>)}</ol></div>}
          {t.documents.length > 0 && <div><div className="font-bold text-xs mb-1" style={{ color: "var(--text)" }}>מסמכים</div><ul className="list-disc ps-5 space-y-1">{t.documents.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
          {t.appeals.length > 0 && <div><div className="font-bold text-xs mb-1" style={{ color: "var(--text)" }}>ערר</div><ul className="list-disc ps-5 space-y-1">{t.appeals.map((a, i) => <li key={i}>על {a.against}: {a.window}, אל {a.to}</li>)}</ul></div>}
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">{t.officialLinks.map(l => <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--teal)" }}>{l.label}</a>)}</div>
          <div className="text-xs" style={{ color: "var(--muted)" }}>אומת מול: {t.verified}</div>
        </div>
      </details>
    </div>
  );
}

export function CounselorAddendum({ A, domains }: { A: Ans; domains: { label: string; result: KidsDomainResult }[] }) {
  const f = A as CounselorFields;
  const today = useMemo(() => israelToday(), []);
  const input = useMemo(() => toTracksInput(A, today), [A, today]);
  const tracks = useMemo(() => (input ? mapSchoolTracks(input) : []), [input]);
  const summary = useMemo(() => buildSchoolSummary(A, tracks, today, domains), [A, tracks, today, domains]);
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");

  const copy = async () => {
    try {
      const clip = navigator.clipboard;
      if (clip && "write" in clip && typeof ClipboardItem !== "undefined") {
        await clip.write([new ClipboardItem({
          "text/html": new Blob([summary.html], { type: "text/html" }),
          "text/plain": new Blob([summary.text], { type: "text/plain" }),
        })]);
      } else {
        await clip.writeText(summary.text);
      }
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
    setTimeout(() => setCopied("idle"), 2500);
  };

  return (
    <div className="mt-8 space-y-6" data-html2canvas-ignore="true">
      <div>
        <StepTag>מפת המסלולים</StepTag>
        <StepQ>מה רלוונטי עכשיו, ומתי</StepQ>
        <StepHint>
          מחושב לתאריך {formatDateHe(today)} לפי הכיתה ומה שבתיק, מכללי מועדים ומסמכים במקורות רשמיים בלבד. השיפוט הקליני - מה מצדיק הפניה ובאיזו דחיפות - נשאר בידיך.
        </StepHint>
        {A.q3_sui === "כן" && <CounselorSafetyNotice />}
        {f.c_parents === "not_aware" && (
          <div className="rounded-xl p-3 text-sm my-4" style={{ background: "var(--gold-pale)", border: "1px solid var(--line)", color: "var(--text)" }}>
            ההורים טרם יודעו: כל הפניה לוועדה או לגורם חוץ מותנית ביידוע ובהסכמת ההורים (בהורים פרודים - שני ההורים).
          </div>
        )}
        <div className="space-y-3 mt-3">{tracks.map(t => <TrackCard key={t.key} t={t} />)}</div>
      </div>

      <div>
        <StepTag>טיוטת סיכום להפניה</StepTag>
        <StepQ>להעתקה למסמך שלך</StepQ>
        <StepHint>ללא פרטים מזהים - את השם משלימים במסמך. ההעתקה שומרת על הכותרות והרשימות בוורד ובדוקס.</StepHint>
        <div className="flex flex-wrap gap-2 mb-3 print:hidden">
          <button type="button" onClick={copy} className="px-6 py-2.5 rounded-full font-bold text-sm text-white" style={{ background: "var(--teal-dark)" }}>
            {copied === "ok" ? "הועתק ✓" : copied === "fail" ? "ההעתקה נכשלה - סמני והעתיקי ידנית" : "העתקת הסיכום"}
          </button>
          <button type="button" onClick={() => window.print()} className="px-6 py-2.5 rounded-full font-semibold text-sm border-2 border-[var(--teal)] text-[var(--teal)]">הדפסה</button>
        </div>
        <pre dir="rtl" className="whitespace-pre-wrap rounded-2xl p-4 sm:p-5 text-sm leading-relaxed bg-white border font-[inherit]" style={{ borderColor: "var(--line)", color: "var(--text)" }}>{summary.text}</pre>
      </div>
    </div>
  );
}
