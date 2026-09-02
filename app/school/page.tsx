"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { CrisisResources } from "@/app/components/CrisisResources";
import {
  SCHOOL_GRADES,
  DIAGNOSING_BODIES,
  israelToday,
  formatDateHe,
  type Diagnosis,
  type DiagnosisKind,
  type SchoolTrack,
} from "@/app/lib/school-tracks";
import { mapSchoolTracks } from "@/app/lib/school-tracks-engine";
import {
  INTERVENTIONS,
  ROLE_LABELS,
  FILL_MODE_LABELS,
  PARENTS_LABELS,
  INITIATOR_LABELS,
  DURATION_LABELS,
  LEVEL_LABELS,
  ATTENDANCE_LABELS,
  LATENESS_LABELS,
  REFUSAL_LABELS,
  BULLY_LABELS,
  CHANGE_LABELS,
  RESPONSE_LABELS,
  SAFETY_LABELS,
  OUTCOME_LABELS,
  TEAM_LABELS,
  ZAKAUT_LABELS,
  HATAMOT_LABELS,
  COOPERATION_LABELS,
  YES_NO_UNKNOWN_LABELS,
  SUPPORT_OPTIONS,
  HEALTH_OPTIONS,
  SCHOOL_DIAGNOSIS_KINDS,
  DIAGNOSIS_KIND_LABELS,
  RELEVANCE_LABELS,
  toTracksInput,
  buildSchoolSummary,
  type SchoolAnswers,
  type Level,
  type Outcome,
} from "@/app/lib/school-report";

// ── Screens ──────────────────────────────────────────────────────────────────
// Six screens, no skipping: the progress bar is honest because every counsellor
// walks the same path. The clinical core of the kids questionnaire is not here
// yet (see docs/school-questionnaire-plan.md, phase ה).
const PAGES = ["s-consent", "s1", "s2", "s3", "s4", "s-report"] as const;
type Step = (typeof PAGES)[number];

// ── Local drafts ─────────────────────────────────────────────────────────────
// A counsellor is interrupted by the school day and by the parent on the line.
// Drafts live in this browser only, carry no name by construction, and expire
// after 21 days. Several may be open at once - she has a caseload, not a child.
const DRAFT_KEY = "school_drafts_v1";
const DRAFT_TTL_MS = 21 * 24 * 60 * 60 * 1000;
const MAX_DRAFTS = 5;
type Draft = { id: string; savedAt: number; step: Step; A: SchoolAnswers };

// Read through useSyncExternalStore rather than an effect: the server renders
// an empty list, the client reads storage on hydration, and any write - here or
// in another tab - notifies the list. The snapshot keeps its reference while
// storage is unchanged, which is what the store contract requires.
const DRAFT_EVENT = "school-drafts-changed";
const NO_DRAFTS: Draft[] = [];
let draftsRaw: string | null | undefined;
let draftsCache: Draft[] = NO_DRAFTS;

function parseDrafts(raw: string | null): Draft[] {
  if (!raw) return NO_DRAFTS;
  try {
    const now = Date.now();
    return (JSON.parse(raw) as Draft[])
      .filter(d => d && d.id && now - d.savedAt < DRAFT_TTL_MS)
      .sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return NO_DRAFTS;
  }
}
function readDrafts(): Draft[] {
  let raw: string | null = null;
  try { raw = localStorage.getItem(DRAFT_KEY); } catch { raw = null; }
  if (raw !== draftsRaw) { draftsRaw = raw; draftsCache = parseDrafts(raw); }
  return draftsCache;
}
function subscribeDrafts(onChange: () => void) {
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
function upsertDraft(d: Draft) {
  persistDrafts([d, ...readDrafts().filter(x => x.id !== d.id)]);
}
function removeDraft(id: string) {
  persistDrafts(readDrafts().filter(x => x.id !== id));
}
function draftLabel(d: Draft): string {
  const bits = [d.A.grade ? `כיתה ${d.A.grade}` : "ללא כיתה"];
  if (d.A.role) bits.push(ROLE_LABELS[d.A.role]);
  const idx = PAGES.indexOf(d.step);
  bits.push(d.step === "s-report" ? "דוח מוכן" : `${Math.round((idx / (PAGES.length - 1)) * 100)}%`);
  bits.push(`נשמר ${new Date(d.savedAt).toLocaleDateString("he-IL")}`);
  return bits.join(" · ");
}

// ── UI helpers (same tokens as the kids questionnaire) ───────────────────────
const PILL = "px-4 py-2 min-h-[44px] border-2 rounded-full text-sm font-medium transition-all cursor-pointer";
const PILL_SEL = "bg-[var(--teal)] text-white border-[var(--teal)]";
const PILL_DEF = "bg-white text-[#3a4a5a] border-[#d0dae8] hover:border-[var(--teal)]";
const pill = (sel: boolean) => `${PILL} ${sel ? PILL_SEL : PILL_DEF}`;

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100">{children}</div>;
}
function StepTag({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">{children}</div>;
}
function StepQ({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-bold text-[#1a2a3a] mb-1 leading-snug">{children}</h2>;
}
function StepHint({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-gray-400 mb-5 leading-relaxed">{children}</p>;
}
function SubCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--surface)] rounded-xl p-3 sm:p-5 mt-3 border border-[var(--line)] space-y-4">
      {title && <div className="text-sm font-bold" style={{ color: "var(--teal-dark)" }}>{title}</div>}
      {children}
    </div>
  );
}
function Q({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm font-semibold mb-2" style={{ color: "var(--text)" }}>{label}</div>
      {children}
    </div>
  );
}
function Choice<T extends string | number>({ value, options, onChange }: { value?: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, label]) => (
        <button key={v} type="button" className={pill(value === v)} onClick={() => onChange(v)}>{label}</button>
      ))}
    </div>
  );
}
function LevelRow({ value, onChange }: { value?: Level; onChange: (v: Level) => void }) {
  return <Choice value={value} options={LEVEL_LABELS.map((l, i) => [i as Level, l] as [Level, string])} onChange={onChange} />;
}
function Multi({ value, options, onChange }: { value: string[]; options: readonly string[]; onChange: (v: string[]) => void }) {
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter(x => x !== o) : [...value, o]);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <button key={o} type="button" className={pill(value.includes(o))} onClick={() => toggle(o)}>{o}</button>
      ))}
    </div>
  );
}
function NavRow({ onBack, onNext, nextLabel = "המשך ←", nextDisabled = false }: { onBack?: () => void; onNext?: () => void; nextLabel?: string; nextDisabled?: boolean }) {
  return (
    <div className="flex gap-3 mt-7 flex-wrap print:hidden">
      {onNext && (
        <button type="button" onClick={onNext} disabled={nextDisabled}
          className="px-8 py-3 rounded-full font-bold text-sm text-white shadow-md hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: "var(--teal-dark)" }}>{nextLabel}</button>
      )}
      {onBack && (
        <button type="button" onClick={onBack} className="px-6 py-3 border-2 border-[var(--teal)] text-[var(--teal)] rounded-full font-semibold text-sm hover:bg-[var(--teal-pale)] transition-all">→ חזרה</button>
      )}
    </div>
  );
}
function Missing({ n }: { n: number }) {
  if (n <= 0) return null;
  return <p className="text-red-500 text-sm font-semibold mt-3">⛔ {n === 1 ? "נותר סעיף אחד ללא מענה" : `נותרו ${n} סעיפים ללא מענה`} - יש לענות עליהם כדי להמשיך</p>;
}

type Setter = <K extends keyof SchoolAnswers>(k: K, v: SchoolAnswers[K]) => void;
type ScreenProps = { A: SchoolAnswers; set: Setter; onNext: () => void; onBack?: () => void };

// ── s-consent ────────────────────────────────────────────────────────────────
function PageConsent({ onNext, drafts, onResume, onDelete }: { onNext: () => void; drafts: Draft[]; onResume: (d: Draft) => void; onDelete: (id: string) => void }) {
  const [agreed, setAgreed] = useState(false);
  return (
    <div>
      <h1 className="mb-2 text-xl font-black leading-snug" style={{ color: "var(--text)" }}>כלי עבודה ליועצות ולצוותים חינוכיים</h1>
      <p className="mb-5 text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
        מיפוי מסודר של מצב התלמיד/ה, מפת המסלולים הרלוונטיים - צוות רב-מקצועי, ועדת זכאות ואפיון והתאמות - עם המועדים והמסמכים לכל אחד, וטיוטת סיכום מוכנה להעתקה למסמכי ההפניה.
      </p>
      <ul className="mb-5 flex flex-col gap-2">
        {[
          ["🔒", "ללא פרטים מזהים", "אין שדה שם ואין טקסט חופשי. הטיוטה נשמרת בדפדפן הזה בלבד, עד 21 יום"],
          ["⏱️", "כ-8 דקות", "אפשר לעצור באמצע ולהמשיך מאותו מחשב"],
          ["📋", "תוצר לעבודה", "מפת מסלולים עם מועדים מחושבים, וסיכום להדבקה במסמך שלך"],
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
        חשוב לומר מראש: הכלי מסייע בהתארגנות ובהכוונה. הוא <strong>אינו אבחון</strong>, אינו קובע זכאות, ואינו מחליף את שיקול הדעת המקצועי שלך או את החלטת הוועדה.
      </p>
      <details className="mb-5 rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        <summary className="cursor-pointer select-none text-sm font-bold" style={{ color: "var(--teal-dark)" }}>לנוסח המלא</summary>
        <div className="mt-3 leading-relaxed" style={{ color: "var(--text-2)" }}>
          <p className="mb-3 text-sm">השאלון מיועד לאנשי מקצוע בצוות החינוכי, הממלאים אותו במסגרת תפקידם. אין להזין בו שם, מספר זהות, כתובת או כל פרט מזהה אחר של התלמיד/ה או המשפחה, והשאלון בנוי כך שאינו מבקש פרטים כאלה.</p>
          <p className="mb-3 text-sm">התוצרים - מפת המסלולים וטיוטת הסיכום - הם כלי עזר להתארגנות. הם אינם אבחון פסיכולוגי, פסיכיאטרי או חינוכי, אינם קובעים זכאות לשירותי חינוך מיוחדים או להתאמות, ואינם מחליפים הערכה של גורם מוסמך או החלטה של ועדה.</p>
          <p className="mb-3 text-sm">המועדים והכללים המוצגים נלקחו מפרסומים רשמיים של משרד החינוך ומצוין לצידם מועד האימות. הם עשויים להשתנות, ולרשות המקומית עשויים להיות מועדים פנימיים משלה - יש לאמת מול הרשות ומול חוזרי המנכ&quot;ל העדכניים לפני כל הגשה.</p>
          <p className="text-sm">האחריות המקצועית וההחלטות נשארות בידי הממלא/ת ובידי הגורמים המוסמכים. הטיוטות נשמרות בדפדפן שבו מולא השאלון בלבד ואינן נשלחות לשרת. הגורמים המפעילים את הכלי אינם נושאים באחריות לנזק, ישיר או עקיף, שייגרם כתוצאה מהשימוש בו.</p>
        </div>
      </details>
      <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl p-4 text-sm hover:opacity-90" style={{ background: "var(--teal-pale)", border: "1px solid var(--teal-mid)", color: "var(--teal-dark)" }}>
        <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="mt-0.5 h-5 w-5 flex-shrink-0 accent-[#2e7d8c]" />
        <span>אני ממלא/ת את השאלון במסגרת תפקידי המקצועי, לא אזין פרטים מזהים, וקראתי את ההצהרה</span>
      </label>
      <div className="mt-5">
        <button type="button" disabled={!agreed} onClick={onNext}
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

// ── S1 ───────────────────────────────────────────────────────────────────────
function PageS1({ A, set, onNext, onBack }: ScreenProps) {
  const missing = [A.role, A.fillMode, A.parents, A.grade].filter(x => !x).length;
  return (
    <div>
      <StepTag>שלב 1 מתוך 4</StepTag>
      <StepQ>מי ממלא, ואיך</StepQ>
      <StepHint>הפרטים האלה קובעים איך ינוסח הסיכום ומה ייכתב בו על מקור המידע.</StepHint>
      <div className="space-y-5">
        <Q label="תפקיד הממלא/ת">
          <Choice value={A.role} options={Object.entries(ROLE_LABELS) as [SchoolAnswers["role"] & string, string][]} onChange={v => set("role", v)} />
        </Q>
        <Q label="אופן המילוי">
          <Choice value={A.fillMode} options={Object.entries(FILL_MODE_LABELS) as [SchoolAnswers["fillMode"] & string, string][]} onChange={v => set("fillMode", v)} />
        </Q>
        <Q label="ההורים">
          <Choice value={A.parents} options={Object.entries(PARENTS_LABELS) as [SchoolAnswers["parents"] & string, string][]} onChange={v => set("parents", v)} />
        </Q>
        <Q label="מי יזם את הפנייה">
          <Choice value={A.initiator} options={Object.entries(INITIATOR_LABELS) as [SchoolAnswers["initiator"] & string, string][]} onChange={v => set("initiator", v)} />
        </Q>
        <SubCard title="התלמיד/ה">
          <Q label="כיתה">
            <Choice value={A.grade} options={SCHOOL_GRADES.map(g => [g, g] as [typeof g, string])} onChange={v => set("grade", v)} />
          </Q>
          <Q label="מין">
            <Choice value={A.gender} options={[["זכר", "בן"], ["נקבה", "בת"]]} onChange={v => set("gender", v)} />
          </Q>
          <Q label="מזה כמה זמן הקושי מורגש">
            <Choice value={A.duration} options={Object.entries(DURATION_LABELS) as [SchoolAnswers["duration"] & string, string][]} onChange={v => set("duration", v)} />
          </Q>
        </SubCard>
      </div>
      <Missing n={missing} />
      <NavRow onBack={onBack} onNext={onNext} nextDisabled={missing > 0} />
    </div>
  );
}

// ── S2 ───────────────────────────────────────────────────────────────────────
function PageS2({ A, set, onNext, onBack }: ScreenProps) {
  const missing = [A.attendance, A.refusal, A.safety].filter(x => !x).length;
  return (
    <div>
      <StepTag>שלב 2 מתוך 4</StepTag>
      <StepQ>תפקוד בבית הספר</StepQ>
      <StepHint>מה שרואים בבית הספר ולא רואים בבית. סעיף שאין לגביו מידע אפשר להשאיר ריק - הוא לא ייכנס לסיכום.</StepHint>
      <div className="space-y-3">
        <SubCard title="ביקור סדיר">
          <Q label="היעדרויות"><Choice value={A.attendance} options={Object.entries(ATTENDANCE_LABELS) as [SchoolAnswers["attendance"] & string, string][]} onChange={v => set("attendance", v)} /></Q>
          <Q label="איחורים"><Choice value={A.lateness} options={Object.entries(LATENESS_LABELS) as [SchoolAnswers["lateness"] & string, string][]} onChange={v => set("lateness", v)} /></Q>
          <Q label="סרבנות בית ספר"><Choice value={A.refusal} options={Object.entries(REFUSAL_LABELS) as [SchoolAnswers["refusal"] & string, string][]} onChange={v => set("refusal", v)} /></Q>
        </SubCard>
        <SubCard title="בכיתה">
          <Q label="קושי בקשב ובהתמדה במשימות בשיעור"><LevelRow value={A.cls_attention} onChange={v => set("cls_attention", v)} /></Q>
          <Q label="קושי בהתארגנות (ציוד, שיעורי בית, זמנים)"><LevelRow value={A.cls_org} onChange={v => set("cls_org", v)} /></Q>
          <Q label="קושי בהתנהלות מול סמכות"><LevelRow value={A.cls_authority} onChange={v => set("cls_authority", v)} /></Q>
          <Q label="קושי בוויסות רגשי בכיתה ובהפסקות"><LevelRow value={A.cls_regulation} onChange={v => set("cls_regulation", v)} /></Q>
        </SubCard>
        <SubCard title="חברתי">
          <Q label="בידוד או דחייה חברתית"><LevelRow value={A.soc_isolation} onChange={v => set("soc_isolation", v)} /></Q>
          <Q label="חיכוכים ומריבות עם בני הגיל"><LevelRow value={A.soc_conflict} onChange={v => set("soc_conflict", v)} /></Q>
          <Q label="נפגע/ת מהצקות או חרם"><Choice value={A.bully_victim} options={Object.entries(BULLY_LABELS) as [SchoolAnswers["bully_victim"] & string, string][]} onChange={v => set("bully_victim", v)} /></Q>
          <Q label="מעורבות כפוגע/ת"><Choice value={A.bully_perp} options={Object.entries(BULLY_LABELS) as [SchoolAnswers["bully_perp"] & string, string][]} onChange={v => set("bully_perp", v)} /></Q>
        </SubCard>
        <SubCard title="רגשי, כפי שנצפה בבית הספר">
          <Q label="מופנמות, עצב או חרדה נצפית"><LevelRow value={A.emo_internal} onChange={v => set("emo_internal", v)} /></Q>
          <Q label="החצנה והתפרצויות"><LevelRow value={A.emo_external} onChange={v => set("emo_external", v)} /></Q>
          <Q label="שינוי חד בהתנהגות או במצב הרוח השנה"><Choice value={A.emo_change} options={Object.entries(CHANGE_LABELS) as [SchoolAnswers["emo_change"] & string, string][]} onChange={v => set("emo_change", v)} /></Q>
        </SubCard>
        <SubCard title="לימודי">
          <Q label="פער לימודי ביחס לכיתה"><LevelRow value={A.acad_gap} onChange={v => set("acad_gap", v)} /></Q>
          <Q label="תגובה לתמיכה שניתנה"><Choice value={A.acad_response} options={Object.entries(RESPONSE_LABELS) as [SchoolAnswers["acad_response"] & string, string][]} onChange={v => set("acad_response", v)} /></Q>
        </SubCard>
        <SubCard title="בטיחות">
          <Q label="האם עלה חשש לפגיעה עצמית או נשמעו אמירות אובדניות?">
            <Choice value={A.safety} options={Object.entries(SAFETY_LABELS) as [SchoolAnswers["safety"] & string, string][]} onChange={v => set("safety", v)} />
          </Q>
          {A.safety === "yes" && <SafetyNotice />}
        </SubCard>
      </div>
      <Missing n={missing} />
      <NavRow onBack={onBack} onNext={onNext} nextDisabled={missing > 0} />
    </div>
  );
}

function SafetyNotice() {
  return (
    <div className="rounded-xl p-4 text-sm leading-relaxed" style={{ background: "#FBEDE9", border: "1px solid #E8C4B8", color: "var(--text)" }}>
      <div className="font-bold mb-1" style={{ color: "#A83B22" }}>נושא בטיחות עלה</div>
      <p>לפי הנהלים המחייבים בבית הספר יש ליידע מיד את פסיכולוג/ית בית הספר ואת המנהל/ת, ולא להשאיר את התלמיד/ה ללא ליווי. הכלי הזה אינו תחליף להערכת סיכון. אפשר להמשיך במילוי אחרי שהדיווח נעשה.</p>
      <CrisisResources className="mt-3" />
    </div>
  );
}

// ── S3 ───────────────────────────────────────────────────────────────────────
function PageS3({ A, set, onNext, onBack }: ScreenProps) {
  const cur = A.interventions ?? {};
  const setOutcome = (k: (typeof INTERVENTIONS)[number]["key"], o: Outcome) => set("interventions", { ...cur, [k]: o });
  return (
    <div>
      <StepTag>שלב 3 מתוך 4</StepTag>
      <StepQ>מה כבר נוסה בבית הספר</StepQ>
      <StepHint>זה בדיוק החומר שוועדת זכאות ואפיון מבקשת כ&quot;סיכום התערבויות&quot;. מה שלא סומן נרשם כ&quot;לא נוסה&quot;.</StepHint>
      <div className="space-y-3">
        {INTERVENTIONS.map(it => (
          <SubCard key={it.key}>
            <Q label={it.label}>
              <Choice value={cur[it.key] ?? "not_tried"} options={Object.entries(OUTCOME_LABELS) as [Outcome, string][]} onChange={v => setOutcome(it.key, v)} />
            </Q>
          </SubCard>
        ))}
      </div>
      <NavRow onBack={onBack} onNext={() => { if (!A.interventions) set("interventions", {}); onNext(); }} />
    </div>
  );
}

// ── S4 ───────────────────────────────────────────────────────────────────────
function PageS4({ A, set, onNext, onBack }: ScreenProps) {
  const thisYear = Number(israelToday().slice(0, 4));
  const years = Array.from({ length: 15 }, (_, i) => thisYear - i);
  const diagnoses = A.diagnoses ?? [];
  const [adding, setAdding] = useState<{ kind?: DiagnosisKind; year?: number; signedBy?: string }>({});
  const add = () => {
    if (!adding.kind || !adding.year) return;
    const d: Diagnosis = { kind: adding.kind, year: adding.year, signedBy: adding.signedBy as Diagnosis["signedBy"] };
    if (!d.signedBy) delete d.signedBy;
    set("diagnoses", [...diagnoses, d]);
    setAdding({});
  };
  const remove = (i: number) => set("diagnoses", diagnoses.filter((_, j) => j !== i));
  const missing = [A.schoolTeam, A.zakautStatus, A.hatamotStatus].filter(x => !x).length;
  const selectCls = "w-full rounded-xl border-2 border-[#d0dae8] bg-white px-3 py-2 text-sm min-h-[44px]";

  return (
    <div>
      <StepTag>שלב 4 מתוך 4</StepTag>
      <StepQ>מה כבר יש בתיק</StepQ>
      <StepHint>אבחונים, ועדות ותמיכות שכבר קיימים. מכאן המנוע מחשב מה תקף, מה חסר, ומה המועד הקרוב.</StepHint>
      <div className="space-y-3">
        <SubCard title="אבחונים וחוות דעת בתיק">
          {diagnoses.length > 0 && (
            <ul className="flex flex-col gap-2">
              {diagnoses.map((d, i) => (
                <li key={i} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm border border-[var(--line)]">
                  <span>{DIAGNOSIS_KIND_LABELS[d.kind]} ({d.year}){d.signedBy ? ` · ${d.signedBy}` : ""}</span>
                  <button type="button" onClick={() => remove(i)} className="text-xs font-semibold" style={{ color: "var(--muted)" }}>הסרה</button>
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
          <button type="button" onClick={add} disabled={!adding.kind || !adding.year} className={`${pill(false)} disabled:opacity-40`}>+ הוספה לתיק</button>
          <p className="text-xs" style={{ color: "var(--muted)" }}>החותם/ת קובע/ת אם המסמך קביל לוועדת זכאות: התוספת הראשונה לתיקון 11 מונה התמחות, לא רק מקצוע. אם לא ידוע, המפה תבקש לבדוק.</p>
        </SubCard>
        <SubCard title="ועדות">
          <Q label="צוות רב-מקצועי בית-ספרי"><Choice value={A.schoolTeam} options={Object.entries(TEAM_LABELS) as [SchoolAnswers["schoolTeam"] & string, string][]} onChange={v => set("schoolTeam", v)} /></Q>
          <Q label="ועדת זכאות ואפיון"><Choice value={A.zakautStatus} options={Object.entries(ZAKAUT_LABELS) as [SchoolAnswers["zakautStatus"] & string, string][]} onChange={v => set("zakautStatus", v)} /></Q>
          {A.zakautStatus === "decided" && (
            <Q label="תאריך קבלת ההחלטה אצל ההורים (לחישוב חלון ההשגה)">
              <input type="date" className={selectCls} value={A.zakautDecisionOn ?? ""} onChange={e => set("zakautDecisionOn", e.target.value || undefined)} />
            </Q>
          )}
          <Q label="התאמות בדרכי היבחנות"><Choice value={A.hatamotStatus} options={Object.entries(HATAMOT_LABELS) as [SchoolAnswers["hatamotStatus"] & string, string][]} onChange={v => set("hatamotStatus", v)} /></Q>
          {A.hatamotStatus === "district_decided" && (
            <Q label="תאריך קבלת תשובת הוועדה המחוזית (לחישוב חלון הערעור)">
              <input type="date" className={selectCls} value={A.hatamotAnswerOn ?? ""} onChange={e => set("hatamotAnswerOn", e.target.value || undefined)} />
            </Q>
          )}
        </SubCard>
        <SubCard title="תמיכות ומעקב">
          <Q label="תמיכות פעילות בבית הספר"><Multi value={A.supports ?? []} options={SUPPORT_OPTIONS} onChange={v => set("supports", v)} /></Q>
          <Q label="מעקב וטיפול מחוץ לבית הספר"><Multi value={A.health ?? []} options={HEALTH_OPTIONS} onChange={v => set("health", v)} /></Q>
        </SubCard>
        <SubCard title="המשפחה">
          <Q label="שיתוף פעולה הורי צפוי"><Choice value={A.fam_cooperation} options={Object.entries(COOPERATION_LABELS) as [SchoolAnswers["fam_cooperation"] & string, string][]} onChange={v => set("fam_cooperation", v)} /></Q>
          <Q label="מגבלה כלכלית מוכרת"><Choice value={A.fam_economic} options={Object.entries(YES_NO_UNKNOWN_LABELS) as [SchoolAnswers["fam_economic"] & string, string][]} onChange={v => set("fam_economic", v)} /></Q>
          <Q label="המשפחה מוכרת לרווחה"><Choice value={A.fam_welfare} options={Object.entries(YES_NO_UNKNOWN_LABELS) as [SchoolAnswers["fam_welfare"] & string, string][]} onChange={v => set("fam_welfare", v)} /></Q>
        </SubCard>
      </div>
      <Missing n={missing} />
      <NavRow onBack={onBack} onNext={onNext} nextLabel="למפה ולסיכום ←" nextDisabled={missing > 0} />
    </div>
  );
}

// ── s-report ─────────────────────────────────────────────────────────────────
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

function PageReport({ A, onRestart, onBack }: { A: SchoolAnswers; onRestart: () => void; onBack: () => void }) {
  const today = useMemo(() => israelToday(), []);
  const input = useMemo(() => toTracksInput(A, today), [A, today]);
  const tracks = useMemo(() => (input ? mapSchoolTracks(input) : []), [input]);
  const summary = useMemo(() => buildSchoolSummary(A, tracks, today), [A, tracks, today]);
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
    <div className="space-y-5">
      <div>
        <StepTag>מפת המסלולים</StepTag>
        <StepQ>מה רלוונטי עכשיו, ומתי</StepQ>
        <StepHint>
          מחושב לתאריך {formatDateHe(today)} לפי הכיתה ומה שבתיק. המפה מבוססת על כללי מועדים ומסמכים ממקורות רשמיים בלבד; ההיבטים הקליניים - מה מצדיק הפניה ובאיזו דחיפות - נשארים בידיך.
        </StepHint>
        {A.safety === "yes" && <div className="mb-4"><SafetyNotice /></div>}
        {A.parents === "not_aware" && (
          <div className="rounded-xl p-3 text-sm mb-4" style={{ background: "var(--gold-pale)", border: "1px solid var(--line)", color: "var(--text)" }}>
            ההורים טרם יודעו: כל הפניה לוועדה או לגורם חוץ מותנית ביידוע ובהסכמת ההורים (בהורים פרודים - שני ההורים).
          </div>
        )}
        <div className="space-y-3">{tracks.map(t => <TrackCard key={t.key} t={t} />)}</div>
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

      <div className="flex flex-wrap gap-3 print:hidden">
        <button type="button" onClick={onBack} className="px-6 py-3 border-2 border-[var(--teal)] text-[var(--teal)] rounded-full font-semibold text-sm">→ חזרה לעריכה</button>
        <button type="button" onClick={onRestart} className="px-6 py-3 rounded-full font-semibold text-sm border" style={{ color: "var(--muted)", borderColor: "var(--line)" }}>שאלון חדש</button>
      </div>
    </div>
  );
}

// ── Root ─────────────────────────────────────────────────────────────────────
export default function SchoolPage() {
  const [step, setStep] = useState<Step>("s-consent");
  const [A, setA] = useState<SchoolAnswers>({});
  const [draftId, setDraftId] = useState<string | null>(null);
  const drafts = useSyncExternalStore(subscribeDrafts, readDrafts, () => NO_DRAFTS);
  const saveTimer = useRef<number | null>(null);

  // Autosave, debounced, from the first real screen on. Consent is not saved:
  // a draft that is nothing but a ticked checkbox would only clutter the list.
  useEffect(() => {
    if (step === "s-consent" || !draftId) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      upsertDraft({ id: draftId, savedAt: Date.now(), step, A });
    }, 600);
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
  }, [A, step, draftId]);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [step]);

  const set: Setter = (k, v) => setA(prev => ({ ...prev, [k]: v }));
  const idx = PAGES.indexOf(step);
  const go = (s: Step) => setStep(s);
  const next = () => go(PAGES[Math.min(idx + 1, PAGES.length - 1)]);
  const back = () => go(PAGES[Math.max(idx - 1, 0)]);
  const start = () => { setA({}); setDraftId(crypto.randomUUID()); go("s1"); };
  const resume = (d: Draft) => { setA(d.A); setDraftId(d.id); go(d.step); };
  const remove = (id: string) => removeDraft(id);
  const restart = () => { setDraftId(null); setA({}); go("s-consent"); };

  const progress = step === "s-consent" || step === "s-report" ? 0 : Math.round((idx / (PAGES.length - 1)) * 100);

  return (
    <main className="quiz-shell min-h-screen mx-auto max-w-2xl px-4 py-8 pb-20" style={{ background: "var(--surface)" }} dir="rtl">
      <header className="mb-6 print:hidden">
        <div className="flex items-center justify-between mb-2">
          {step === "s-consent" ? (
            <div className="w-full text-center mb-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-temp.png" alt="טיפול חכם" style={{ height: "52px", width: "auto", margin: "0 auto 8px", display: "block" }} />
              <p className="text-sm" style={{ color: "var(--muted)" }}>שאלון הפניה לצוותי חינוך</p>
            </div>
          ) : (
            <>
              <span className="text-xl font-extrabold" style={{ color: "var(--teal)" }}>טיפול חכם</span>
              <span className="text-xs px-3 py-1 rounded-full" style={{ color: "var(--muted)", background: "var(--surface-2)" }}>שאלון לצוותי חינוך</span>
            </>
          )}
        </div>
        {progress > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-[#6b7280]">{progress}% הושלם</span>
              {draftId && <span className="text-xs" style={{ color: "var(--muted)" }}>נשמר בדפדפן ✓</span>}
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: "linear-gradient(90deg, var(--teal), var(--teal-dark))" }} />
            </div>
          </div>
        )}
      </header>

      {step === "s-consent" && <Card><PageConsent onNext={start} drafts={drafts} onResume={resume} onDelete={remove} /></Card>}
      {step === "s1" && <Card><PageS1 A={A} set={set} onNext={next} /></Card>}
      {step === "s2" && <Card><PageS2 A={A} set={set} onNext={next} onBack={back} /></Card>}
      {step === "s3" && <Card><PageS3 A={A} set={set} onNext={next} onBack={back} /></Card>}
      {step === "s4" && <Card><PageS4 A={A} set={set} onNext={next} onBack={back} /></Card>}
      {step === "s-report" && <Card><PageReport A={A} onRestart={restart} onBack={back} /></Card>}
    </main>
  );
}
