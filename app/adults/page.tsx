"use client";

import { useState, useEffect, useMemo } from "react";
import type {
  QuestionnaireAnswers,
  ScoringResult,
  Recommendation,
} from "@/app/lib/questionnaire-types";
import { REGION_CITIES, CITY_TO_REGION } from "@/app/lib/regions";
import { getFingerprint } from "@/app/lib/fingerprint";
import { trackQuizStep, trackQuizComplete, trackTherapistExplain, trackMatchingClick } from "@/app/lib/useTrack";
import { getAttribution } from "@/app/lib/attribution";
import { downloadResultsPDF } from "@/app/lib/download-pdf";
import { CrisisResources } from "@/app/components/CrisisResources";
import { buildAdultFacts } from "@/app/lib/explain-facts";
import { getTreatmentArticle, getTreatmentArticleHref } from "@/app/lib/treatment-articles";
import { therapistPath } from "@/app/lib/therapist-url";
import QuizPaymentBlock from "@/app/components/QuizPaymentBlock";
import QuizFeedbackBox from "@/app/components/QuizFeedbackBox";

// Anonymous viewer context derived from the questionnaire — used for impression
// tracking and to seed match-attribution params on the profile-page link.
function normalizeAgeBand(a: number): string | null {
  if (!a || isNaN(a)) return null;
  if (a < 18) return "child";
  if (a <= 30) return "18-30";
  if (a <= 45) return "31-45";
  if (a <= 60) return "46-60";
  return "60+";
}
function normalizeGenderKey(g: string): string | null {
  if (g === "זכר" || g === "גבר") return "m";
  if (g === "נקבה" || g === "אישה") return "f";
  return g ? "other" : null;
}
function normalizeRegionKey(r: string, online: boolean): string | null {
  if (online && !r) return "online";
  if (!r) return null;
  if (r.includes("גוש דן") || r.includes("שפלה")) return "center";
  if (r.includes("שרון")) return "sharon";
  if (r.includes("ירושלים")) return "jerusalem";
  if (r.includes("חיפה") || r.includes("קריות")) return "haifa";
  if (r.includes("גליל") || r.includes("עמק")) return "north";
  if (r.includes("דרום") || r.includes("באר שבע") || r.includes("אשדוד") || r.includes("אשקלון")) return "south";
  return "other";
}
// Maps internal questionnaire-domain keys to the analytics-issue taxonomy
// in `app/lib/stats-categories.ts`. Keys must match the union in
// `QuestionnaireAnswers["domains"]`.
const DOMAIN_ISSUE_MAP: Record<string, string> = {
  emotional: "emotional",
  functional: "functional",
  relationship: "relationship",
  addiction: "addiction",
  personal_development: "personal",
};

function getOrCreateSessionId(): string | null {
  try {
    let id = localStorage.getItem("mnt_session_id");
    if (!id) {
      id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
      localStorage.setItem("mnt_session_id", id);
    }
    return id;
  } catch {
    return null;
  }
}


// ── helpers ───────────────────────────────────────────────────────────────────
function ScaleRow({
  label, sublabel, values, value, onChange,
}: { label: string; sublabel?: string; group?: string; values: number[]; value: number; onChange: (v: number) => void }) {
  return (
    <div className="mb-4">
      <div className="mb-1 text-sm leading-snug text-[#1c1c2e]">{label}</div>
      {sublabel && <div className="mb-2 text-xs text-[#6b7280]">{sublabel}</div>}
      <div className="flex flex-wrap gap-1">
        {values.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`h-10 w-10 rounded-lg border-2 text-sm font-bold transition-all ${
              value === v
                ? "border-[var(--teal)] bg-[var(--teal)] text-white"
                : "border-[var(--line)] bg-white text-[var(--text)] hover:border-[var(--teal)]"
            }`}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

function CheckList({
  items, checked, onChange,
}: { items: string[]; checked: number[]; onChange: (idx: number, val: boolean) => void }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, i) => (
        <li key={i}>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-[#ddd6c8] bg-white p-3 text-sm leading-snug transition-all hover:border-[var(--teal)] hover:bg-[var(--teal-pale)]">
            <input
              type="checkbox"
              checked={checked.includes(i)}
              onChange={(e) => onChange(i, e.target.checked)}
              className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[var(--teal)]"
            />
            {item}
          </label>
        </li>
      ))}
    </ul>
  );
}

// Canonical order in which difficulty domains are always presented — regardless
// of the order the user ticked them on the domains screen. Keeping navigation and
// the progress bar locked to this single order is what prevents the timeline from
// jumping backwards (e.g. picking "תעסוקתי" then "רגשי" used to start at 80% and
// drop to 24%). ADULTS_SCREENS_ORDER below must stay consistent with this.
const ADULTS_DOMAIN_ORDER = ["emotional", "relationship", "functional", "addiction", "personal_development"] as const;

// Sort selected domains into the canonical presentation order.
function orderDomains<T extends string>(ds: readonly T[]): T[] {
  const rank = (d: string) => {
    const i = (ADULTS_DOMAIN_ORDER as readonly string[]).indexOf(d);
    return i < 0 ? ADULTS_DOMAIN_ORDER.length : i;
  };
  return [...ds].sort((a, b) => rank(a) - rank(b));
}

// Ordered milestone screens — used for progress calculation. The per-domain blocks
// must follow ADULTS_DOMAIN_ORDER (emotional → relationship → functional → addiction)
// so progress only ever moves forward. therapist-style closes the emotional block.
const ADULTS_SCREENS_ORDER = [
  "disclaimer","domains","intake",
  "e1","e1-q","e2","e2-q","e3","e3-q",
  "e4","e4-contexts","e4-q","e4-social","e4-social-sev",
  "e5","e5-q","e6","e6-q","e7-q","e8c","e9-q",
  "e10","e10a","e10b","e10c",
  "therapist-style",
  "r-intake","r-single","r-single-no-detail","r1","r-abuse","r1-scale","r2-q","r3-conflict","r3-child","r3-child-type",
  "f-vision","f1","f1-adhd","f1-ld","f1-ld-q","f2","f2-q","f3","f3-type","f3-a","f3-b","f3-disability",
  "a-types","a-substances","a-gaming","a-porn-type","a-porn-q","a-sex-q","a-gambling","a-phone",
  "scoring",
];

// Always-visited spine of the questionnaire, regardless of which domains were selected.
const ADULTS_CORE_SCREENS = ["disclaimer", "domains", "intake", "therapist-style", "scoring"];

// Map of which domain each screen belongs to. Screens not listed are core.
function screenDomain(s: string): string | null {
  if (s.startsWith("e")) return "emotional";
  if (s.startsWith("f") || s === "f-vision") return "functional";
  if (s.startsWith("r")) return "relationship";
  if (s.startsWith("a")) return "addiction";
  return null;
}

// Filter the full ordered list down to the screens the user can plausibly visit
// based on which domains they selected. Used to give a more honest progress reading
// than dividing by the static 80-screen total.
function getReachableScreens(domains: string[]): string[] {
  if (!domains || domains.length === 0) return ADULTS_SCREENS_ORDER;
  return ADULTS_SCREENS_ORDER.filter(s => {
    if (ADULTS_CORE_SCREENS.includes(s)) return true;
    const d = screenDomain(s);
    return d !== null && domains.includes(d);
  });
}

function getAdultsProgress(screen: string, domains: string[] = []): number {
  const reachable = getReachableScreens(domains);
  const idx = reachable.indexOf(screen);
  if (idx < 0) return 0;
  if (reachable.length <= 1) return 0;
  return Math.round((idx / (reachable.length - 1)) * 100);
}

function getEncouragement(pct: number): string | null {
  if (pct <= 5)  return null;
  if (pct <= 25) return "יופי, ממשיכים! 💪";
  if (pct <= 45) return "באמצע הדרך, כל הכבוד!";
  if (pct <= 65) return "יותר ממחצית מאחוריך!";
  if (pct <= 80) return "כמעט שם, עוד קצת!";
  if (pct <= 92) return "עוד מעט סיימת! 🎉";
  return "שאלה אחרונה! 🏁";
}

function ProgressBar({ pct }: { pct: number }) {
  const msg = getEncouragement(pct);
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-[#6b7280]">{pct}% הושלם</span>
        {msg && <span className="text-xs font-semibold animate-pulse" style={{ color: "var(--teal)" }}>{msg}</span>}
      </div>
      <div className="h-2 w-full rounded-full bg-stone-200 overflow-hidden">
        <div
          className="h-2 rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: "linear-gradient(90deg, var(--teal), var(--teal-dark))" }}
        />
      </div>
    </div>
  );
}

// Compact "tabs" header rendered above match-form / match-results so the user
// can switch between their recommendations (or jump back to the full list) at
// any point in the matching flow — without losing context.
function RecommendationsStrip({
  groups,
  combinableGroups,
  activeTreatment,
  isCombinedActive,
  onSelectGroup,
  onSelectCombined,
  onBack,
}: {
  groups: Array<{ treatment: string; treatmentLabel: string; urgent: boolean }>;
  combinableGroups: Array<{ treatment: string; treatmentLabel: string }>;
  activeTreatment: string | null;
  isCombinedActive: boolean;
  onSelectGroup: (treatment: string) => void;
  onSelectCombined: () => void;
  onBack: () => void;
}) {
  if (groups.length === 0) return null;
  return (
    <div className="mb-4 rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-xs font-semibold text-[#2e7d8c] hover:underline mb-2"
      >
        ◂ חזרה לכל ההמלצות
      </button>
      <p className="mb-2 text-[10px] uppercase tracking-wider font-bold text-stone-400">המעבר בין ההמלצות שלך</p>
      <div className="flex flex-wrap gap-2">
        {combinableGroups.length >= 2 && (
          <button
            type="button"
            onClick={onSelectCombined}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
              isCombinedActive
                ? "bg-gradient-to-r from-violet-600 via-fuchsia-600 to-rose-500 text-white shadow-sm"
                : "border border-violet-400 bg-violet-50 text-violet-800 hover:bg-violet-100"
            }`}
          >
            ✦ חיפוש משולב (רגשי)
          </button>
        )}
        {groups.map((g) => {
          const isActive = !isCombinedActive && activeTreatment === g.treatment;
          return (
            <button
              key={g.treatment + (g.urgent ? "-urgent" : "")}
              type="button"
              onClick={() => onSelectGroup(g.treatment)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                isActive
                  ? "bg-[#1a3a5c] text-white shadow-sm"
                  : g.urgent
                    ? "border border-red-300 bg-red-50 text-red-800 hover:bg-red-100"
                    : "border border-stone-300 bg-white text-stone-700 hover:border-[#1a3a5c] hover:text-[#1a3a5c]"
              }`}
            >
              {g.urgent && "⚠️ "}{g.treatmentLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const NO_BAR = ["disclaimer","intake","domains","scoring","results","match-form","match-results"];
function Layout({ screen, domains, children }: { screen: string; domains?: string[]; children: React.ReactNode }) {
  const pct = getAdultsProgress(screen, domains ?? []);
  const showBar = pct > 0 && !NO_BAR.includes(screen);
  return (
    <main className="min-h-screen" style={{ background: "var(--surface)" }} dir="rtl">
      <div className="mx-auto max-w-2xl px-4 py-8">
        {screen !== "results" && (
          <div className="mb-5 text-center">
            <img src="/logo-temp.png" alt="טיפול חכם" style={{ height: "52px", width: "auto", margin: "0 auto 8px", display: "block" }} />
            <p className="text-sm" style={{ color: "var(--muted)" }}>שאלון הפניה לטיפול – מבוגרים</p>
          </div>
        )}
        {showBar && <ProgressBar pct={pct} />}
        {children}
      </div>
    </main>
  );
}

function Card({ children, badge, badgeColor = "blue" }: { children: React.ReactNode; badge?: string; badgeColor?: "blue" | "green" | "teal" }) {
  const colors = { blue: "bg-[var(--teal-dark)]", green: "bg-emerald-700", teal: "bg-[var(--teal)]" };
  return (
    <div className="animate-fadeIn rounded-2xl bg-white p-6 shadow-lg">
      {badge && (
        <span className={`mb-3 inline-block rounded-full px-3 py-0.5 text-xs font-bold uppercase tracking-wide text-white ${colors[badgeColor]}`}>
          {badge}
        </span>
      )}
      {children}
    </div>
  );
}

function NavRow({ onBack: _onBack, onNext, nextLabel = "המשך ←", nextDisabled = false }: {
  onBack?: () => void; onNext?: () => void; nextLabel?: string; nextDisabled?: boolean;
}) {
  return (
    <div className="mt-6 flex items-center justify-end gap-3">
      {onNext && (
        <button type="button" onClick={onNext} disabled={nextDisabled} style={{ background: "var(--teal)", borderRadius: "50px", padding: "8px 20px", fontSize: "14px", fontWeight: 700, color: "white", border: "none", cursor: "pointer", transition: "background .2s" }} className="disabled:opacity-40 hover:bg-[var(--teal-dark)]">
          {nextLabel}
        </button>
      )}
    </div>
  );
}

function YesNo({ onYes, onNo, value }: { onYes: () => void; onNo: () => void; value?: boolean }) {
  // When `value` is provided, render in stateful mode (button reflects the
  // current selection) — used in screens where the user can change their answer
  // before pressing Continue. When omitted, falls back to the original
  // immediate-action behaviour.
  const yesSelected = value === true;
  const noSelected = value === false;
  return (
    <div className="mt-4 flex gap-3">
      <button
        type="button"
        onClick={onYes}
        className={`flex-1 rounded-xl py-3 text-sm font-bold transition-all ${
          yesSelected
            ? "bg-[#2d7a4f] text-white ring-2 ring-[#2d7a4f] ring-offset-2"
            : value === undefined
            ? "bg-[#2d7a4f] text-white hover:bg-[#1f5a38]"
            : "border-2 border-[#2d7a4f] bg-white text-[#2d7a4f] hover:bg-[#e8f4ec]"
        }`}
      >כן</button>
      <button
        type="button"
        onClick={onNo}
        className={`flex-1 rounded-xl py-3 text-sm font-bold transition-all ${
          noSelected
            ? "bg-[#1a3a5c] text-white ring-2 ring-[#1a3a5c] ring-offset-2"
            : value === undefined
            ? "bg-[#1a3a5c] text-white hover:bg-[#0f2540]"
            : "border-2 border-[#1a3a5c] bg-white text-[#1a3a5c] hover:bg-[#eaf0f6]"
        }`}
      >לא</button>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────
type Screen = string;

type MatchPrefs = {
  region: string;
  city: string;
  online: boolean;
  genderPref: string;
  culturalPrefs: string[];
  language: string;
  arrangements: string[];
};

export default function AdultsPage() {
  const [screen, setScreen] = useState<Screen>("disclaimer");
  const [agreed, setAgreed] = useState(false);
  const [answers, setAnswers] = useState<QuestionnaireAnswers>({ age: 0, gender: "", domains: [] });

  useEffect(() => {
    const pct = getAdultsProgress(screen, answers.domains);
    (window as any).gtag?.("event", "quiz_step", { quiz_type: "adults", step: screen, progress: pct });
    trackQuizStep("adults", screen, pct);
  }, [screen, answers.domains]);

  const [scoring, setScoring] = useState<ScoringResult | null>(null);
  const [selectedRec, setSelectedRec] = useState<Recommendation | null>(null);
  const [matchPrefs, setMatchPrefs] = useState<MatchPrefs>({ region: "", city: "", online: false, genderPref: "", culturalPrefs: [], language: "עברית", arrangements: [] });
  const [matchResults, setMatchResults] = useState<any[] | null>(null);
  const [addictionCbtFallback, setAddictionCbtFallback] = useState(false);
  const [combinedTreatments, setCombinedTreatments] = useState<string[] | null>(null);
  const [combinedLabels, setCombinedLabels] = useState<string[] | null>(null);
  const [combinedCouplesModality, setCombinedCouplesModality] = useState<string | undefined>(undefined);
  const [combinedNeedsSexualTherapy, setCombinedNeedsSexualTherapy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [explainData, setExplainData] = useState<Record<string, { title: string; explanation: string; tone_note: string } | null>>({});
  const [explainLoading, setExplainLoading] = useState<Record<string, boolean>>({});
  // Per-recommendation AI explanation ("למה הוצע לי?") — keyed on treatment string.
  const [recExplainData, setRecExplainData] = useState<Record<string, { title: string; explanation: string; evidence_note: string } | null>>({});
  const [recExplainLoading, setRecExplainLoading] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState("");
  const [domainIdx, setDomainIdx] = useState(0);
  const [addictionIdx, setAddictionIdx] = useState(0);
  const [usageAllowed, setUsageAllowed] = useState<boolean | null>(null);

  // Build the recommendation groups once and share between the results screen,
  // the match-form/match-results strip, and any other consumer. Same grouping
  // logic as the inline version that used to live inside `if (screen === "results")`.
  type RecGroup = { treatment: string; treatmentLabel: string; recs: Recommendation[]; urgent: boolean };
  const recommendationGroups = useMemo<RecGroup[]>(() => {
    const recs = scoring?.recommendations ?? [];
    const groups: RecGroup[] = [];
    for (const rec of recs) {
      if (rec.urgent) {
        groups.push({ treatment: rec.treatment, treatmentLabel: rec.treatmentLabel, recs: [rec], urgent: true });
        continue;
      }
      const existing = groups.find(g => !g.urgent && g.treatment === rec.treatment);
      if (existing) existing.recs.push(rec);
      else groups.push({ treatment: rec.treatment, treatmentLabel: rec.treatmentLabel, recs: [rec], urgent: false });
    }
    return groups;
  }, [scoring]);

  // Only emotional, non-urgent, non-professional groups can be combined into one search.
  const combinableEmotionalGroups = useMemo(() => {
    return recommendationGroups.filter(g =>
      !g.urgent
      && g.recs[0]?.domain === "מורכבויות בתחום הרגשי/האישי"
      && !g.recs[0]?.professionalType
    );
  }, [recommendationGroups]);

  // Relationship groups eligible for combined search — excludes parenting/child referrals
  // which target a different professional type and don't make sense to bundle with couple/sexual therapy.
  const NON_COMBINABLE_RELATIONSHIP = new Set(["הדרכת הורים", "טיפול ילדים"]);
  const combinableRelationshipGroups = useMemo(() => {
    return recommendationGroups.filter(g =>
      !g.urgent
      && g.recs[0]?.domain === "זוגיות ומשפחה"
      && !g.recs[0]?.professionalType
      && !NON_COMBINABLE_RELATIONSHIP.has(g.treatment)
    );
  }, [recommendationGroups]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Staff bypass: the token from ?staff= is persisted and later sent to the
    // server, which validates it against STAFF_BYPASS_TOKEN. No token literal
    // is shipped in this bundle; this flag only controls the UI optimistically.
    const staffParam = params.get("staff");
    if (staffParam) localStorage.setItem("staff_token", staffParam);
    if (localStorage.getItem("staff_token")) { setUsageAllowed(true); return; }
    getFingerprint()
      .then(fp => fetch(`/api/usage/check?type=adults&fp=${fp}`))
      .then(r => r.json())
      .then(d => setUsageAllowed(d.allowed))
      .catch(() => setUsageAllowed(true));
  }, []);

  // Restore match-results state when the user navigates back from a therapist profile.
  // Gated on referrer so a fresh /adults visit always starts at the disclaimer.
  useEffect(() => {
    try {
      const referrer = document.referrer || "";
      const cameFromProfile = /\/therapists\/[^/]+/.test(referrer);
      if (!cameFromProfile) return;
      const raw = sessionStorage.getItem("adults_match_state_v1");
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved || typeof saved.ts !== "number") return;
      if (Date.now() - saved.ts > 60 * 60_000) return;
      if (saved.answers) setAnswers(saved.answers);
      if (saved.scoring) setScoring(saved.scoring);
      if (saved.selectedRec) setSelectedRec(saved.selectedRec);
      if (saved.matchPrefs) setMatchPrefs(saved.matchPrefs);
      if (saved.combinedTreatments) setCombinedTreatments(saved.combinedTreatments);
      if (saved.combinedLabels) setCombinedLabels(saved.combinedLabels);
      if (saved.combinedCouplesModality) setCombinedCouplesModality(saved.combinedCouplesModality);
      if (typeof saved.combinedNeedsSexualTherapy === "boolean") setCombinedNeedsSexualTherapy(saved.combinedNeedsSexualTherapy);
      if (typeof saved.addictionCbtFallback === "boolean") setAddictionCbtFallback(saved.addictionCbtFallback);
      if (Array.isArray(saved.matchResults)) setMatchResults(saved.matchResults);
      if (saved.screen) setScreen(saved.screen);
      setAgreed(true);
    } catch {}
  }, []);

  // Track impressions for every card shown in the match-results list (source="match_card").
  // The profile page fires its own track-view with source="match" on entry, so the user gets
  // counted both as a card-impression and as a profile-entry.
  useEffect(() => {
    if (!matchResults || matchResults.length === 0) return;
    const sessionId = getOrCreateSessionId();
    const firstDomain = answers.domains?.[0];
    const viewer = {
      viewer_region: normalizeRegionKey(matchPrefs.region, matchPrefs.online),
      viewer_issue: firstDomain ? DOMAIN_ISSUE_MAP[firstDomain] ?? null : null,
      viewer_age_band: normalizeAgeBand(answers.age),
      viewer_gender: normalizeGenderKey(answers.gender),
      session_id: sessionId,
    };
    // Attribution rides along so match-card impressions stop landing under the
    // "unknown" channel in the attribution report (they carried no channel/utm).
    const attribution = getAttribution() ?? {};
    for (const t of matchResults) {
      fetch("/api/track-view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          therapist_id: t.id,
          source: "match_card",
          match_score: t.combined_score ?? t.match_score ?? null,
          ...viewer,
          ...attribution,
        }),
      }).catch(() => {});
    }
  }, [matchResults, answers.age, answers.gender, answers.domains, matchPrefs.region, matchPrefs.online]);

  // Persist match-results state so back-navigation from the profile page restores the list.
  useEffect(() => {
    if (screen !== "match-results" || !matchResults) return;
    try {
      sessionStorage.setItem("adults_match_state_v1", JSON.stringify({
        ts: Date.now(),
        screen,
        matchResults,
        selectedRec,
        matchPrefs,
        combinedTreatments,
        combinedLabels,
        combinedCouplesModality,
        combinedNeedsSexualTherapy,
        addictionCbtFallback,
        scoring,
        answers,
      }));
    } catch {}
  }, [screen, matchResults, selectedRec, matchPrefs, combinedTreatments, combinedLabels, combinedCouplesModality, combinedNeedsSexualTherapy, addictionCbtFallback, scoring, answers]);

  // Build the profile-page link for a given therapist with match-attribution params.
  function profileHrefForMatch(t: any): string {
    const params = new URLSearchParams({ from: "match" });
    const score = t.combined_score ?? t.match_score;
    if (typeof score === "number") params.set("s", String(score));
    const firstDomain = answers.domains?.[0];
    const issue = firstDomain ? DOMAIN_ISSUE_MAP[firstDomain] : null;
    if (issue) params.set("i", issue);
    const age = normalizeAgeBand(answers.age);
    if (age) params.set("a", age);
    const gender = normalizeGenderKey(answers.gender);
    if (gender) params.set("g", gender);
    const region = normalizeRegionKey(matchPrefs.region, matchPrefs.online);
    if (region) params.set("r", region);
    return `${therapistPath(t.id, t.full_name)}?${params.toString()}`;
  }

  const [qItems, setQItems] = useState<Record<string, string[]> | null>(null);
  const [qItemsError, setQItemsError] = useState(false);
  function fetchQItems() {
    setQItemsError(false);
    fetch("/api/questionnaire/adults/questions")
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setQItems)
      .catch(() => setQItemsError(true));
  }
  useEffect(() => { fetchQItems(); }, []);

  // temp state (not in answers)
  const [localAge, setLocalAge] = useState<number>(0);
  const [ageTouched, setAgeTouched] = useState(false);
  // Optional height/weight for BMI — asked only inside the eating-disorder
  // screen (e6-q), where it's clinically relevant.
  const [bmiH, setBmiH] = useState<number>(0);
  const [bmiW, setBmiW] = useState<number>(0);
  const [visionAns, setVisionAns] = useState<boolean | null>(null);
  const [hearingAns, setHearingAns] = useState<boolean | null>(null);

  // local form state (committed to answers on next)
  const [moodChecked, setMoodChecked] = useState<number[]>([]);
  const [maniaChecked, setManiaChecked] = useState<number[]>([]);
  const [maniaDeath, setManiaDeath] = useState(false);
  const [prodromeChecked, setProdromeChecked] = useState<number[]>([]);
  const [prodromeSuicidal, setProdromeSuicidal] = useState(false);
  const [gad7, setGad7] = useState<number[]>(Array(9).fill(0));
  const [socialSeverity, setSocialSeverity] = useState(0);
  const [ocd, setOcd] = useState<number[]>(Array(6).fill(0));
  const [sleepChecked, setSleepChecked] = useState<number[]>([]);
  const [e6EatingChecked, setE6EatingChecked] = useState(false);
  const [e6SleepChecked, setE6SleepChecked] = useState(false);
  const [eating1Checked, setEating1Checked] = useState<number[]>([]);
  const [eating2Checked, setEating2Checked] = useState<number[]>([]);
  const [eating3Checked, setEating3Checked] = useState<number[]>([]);
  const [traumaScores, setTraumaScores] = useState<number[]>(Array(10).fill(0));
  const [traumaSuicidal, setTraumaSuicidal] = useState(false);
  const [traumaType, setTraumaType] = useState("");
  const [traumaTypeOther, setTraumaTypeOther] = useState("");
  const [traumaFreq, setTraumaFreq] = useState("single");
  const [persMain, setPersMain] = useState<number[]>([0, 0]);
  const [disQ, setDisQ] = useState<number[]>([0, 0, 0, 0]);
  const [persScores, setPersScores] = useState<number[]>(Array(6).fill(0));
  const [persQ7, setPersQ7] = useState(false);
  const [persQ8, setPersQ8] = useState(false);
  const [styleQ1, setStyleQ1] = useState(0);
  const [styleQ2, setStyleQ2] = useState(0);
  const [styleQ3, setStyleQ3] = useState(0);
  const [adhd1Checked, setAdhd1Checked] = useState<number[]>([]);
  const [adhd2Checked, setAdhd2Checked] = useState<number[]>([]);
  const [ldScores, setLdScores] = useState<number[]>(Array(5).fill(0));
  const [execScores, setExecScores] = useState<number[]>(Array(6).fill(0));
  const [empAChecked, setEmpAChecked] = useState<boolean[]>([false, false, false, false, false]);
  const [empBChecked, setEmpBChecked] = useState<boolean[]>([false, false, false, false]);
  const [inRelationship, setInRelationship] = useState(false);
  const [hasChildren, setHasChildren] = useState(false);
  const [noRelationship, setNoRelationship] = useState(false);
  const [coupleScale, setCoupleScale] = useState(0);
  const [rSingleCBTScale, setRSingleCBTScale] = useState(0);
  const [rSingleDynScale, setRSingleDynScale] = useState(0);
  const [eftScores, setEftScores] = useState<number[]>(Array(7).fill(0));
  const [dynScores, setDynScores] = useState<number[]>(Array(7).fill(0));
  const [structScores, setStructScores] = useState<number[]>(Array(7).fill(0));
  const [substanceChecked, setSubstanceChecked] = useState<number[]>([]);
  const [gamingChecked, setGamingChecked] = useState<number[]>([]);
  const [pornScores, setPornScores] = useState<number[]>(Array(18).fill(1));
  const [sastChecked, setSastChecked] = useState<number[]>([]);
  const [gamblingChecked, setGamblingChecked] = useState<number[]>([]);
  const [phoneScores, setPhoneScores] = useState<number[]>(Array(10).fill(1));

  // ── navigation ──────────────────────────────────────────────────────────────
  function upd(patch: Partial<QuestionnaireAnswers>) {
    setAnswers((p) => ({ ...p, ...patch }));
  }
  function updE(patch: Partial<NonNullable<QuestionnaireAnswers["emotional"]>>): QuestionnaireAnswers {
    setAnswers((p) => ({ ...p, emotional: { ...p.emotional, ...patch } }));
    return { ...answers, emotional: { ...answers.emotional, ...patch } };
  }
  function updF(patch: Partial<NonNullable<QuestionnaireAnswers["functional"]>>): QuestionnaireAnswers {
    setAnswers((p) => ({ ...p, functional: { ...p.functional, ...patch } }));
    return { ...answers, functional: { ...answers.functional, ...patch } };
  }
  function updR(patch: Partial<NonNullable<QuestionnaireAnswers["relationship"]>>): QuestionnaireAnswers {
    setAnswers((p) => ({ ...p, relationship: { ...p.relationship, ...patch } }));
    return { ...answers, relationship: { ...answers.relationship, ...patch } };
  }
  function updA(patch: Partial<NonNullable<QuestionnaireAnswers["addiction"]>>): QuestionnaireAnswers {
    setAnswers((p) => ({ ...p, addiction: { ...p.addiction, types: p.addiction?.types ?? [], ...patch } }));
    return { ...answers, addiction: { ...answers.addiction, types: answers.addiction?.types ?? [], ...patch } };
  }

  // If personal_development is combined with any other domain, its flow is
  // skipped — the other domains run as usual and scoring ignores it too.
  function effectiveDomains(ds: QuestionnaireAnswers["domains"]): QuestionnaireAnswers["domains"] {
    const filtered = ds.length > 1 ? ds.filter((d) => d !== "personal_development") : ds;
    return orderDomains(filtered) as QuestionnaireAnswers["domains"];
  }

  function startDomains() {
    const domains = effectiveDomains(answers.domains);
    if (domains.length === 0) return;
    setDomainIdx(0);
    setScreen(firstScreenForDomain(domains[0]));
  }

  function firstScreenForDomain(d: string): Screen {
    if (d === "emotional") return "e1";
    if (d === "functional") return "f-vision";
    if (d === "relationship") return "r-intake";
    if (d === "addiction") return "a-types";
    if (d === "personal_development") return "therapist-style";
    return "scoring";
  }

  function nextDomain(ao?: QuestionnaireAnswers) {
    const doms = effectiveDomains(answers.domains);
    const next = domainIdx + 1;
    if (next >= doms.length) { goScoring(ao); return; }
    setDomainIdx(next);
    setScreen(firstScreenForDomain(doms[next]));
  }

  function nextAddiction(ao?: QuestionnaireAnswers) {
    const types = answers.addiction?.types ?? [];
    const next = addictionIdx + 1;
    if (next >= types.length) { nextDomain(ao); return; }
    setAddictionIdx(next);
    setScreen(addictionScreen(types[next]));
  }

  function addictionScreen(type: string): Screen {
    if (type === "substances") return "a-substances";
    if (type === "gaming") return "a-gaming";
    if (type === "porn") return "a-porn-type";
    if (type === "gambling") return "a-gambling";
    return "a-phone";
  }

  async function goScoring(ao?: QuestionnaireAnswers) {
    setScreen("scoring");
    setLoading(true);
    setErr("");
    const fp = await getFingerprint().catch(() => null);
    const staffToken = localStorage.getItem("staff_token") || undefined;
    try {
      const res = await fetch("/api/questionnaire/adults/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(ao ?? answers), _fp: fp, _staffToken: staffToken }),
      });
      // Server enforced the free limit and refused to score — show the paywall.
      if (res.status === 402) { setUsageAllowed(false); return; }
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "שגיאה");
      setScoring({ recommendations: json.recommendations });
      setScreen("results");
      trackQuizComplete("adults");
    } catch (e) {
      // Scoring failed — the user sees an error, not results, so this is NOT a
      // completion. Firing quiz_complete here inflated the funnel top on every
      // server hiccup. (The inline gtag "quiz_completed" duplicate is gone too:
      // trackQuizComplete already reports quiz_complete to GA4, matching the DB
      // event name.)
      setErr(e instanceof Error ? e.message : "שגיאה בניקוד");
      setScreen("results");
    } finally {
      setLoading(false);
    }
  }

  async function doMatch() {
    if (!selectedRec && !combinedTreatments) return;
    setLoading(true);
    setErr("");
    try {
      const styleP1 = answers.emotional?.therapistStyleQ1 ?? 0;
      const styleP2 = answers.emotional?.therapistStyleQ2 ?? 0;
      const styleP3 = answers.emotional?.therapistStyleQ3 ?? 0;
      const isProfessional = !!selectedRec?.professionalType;
      const body: Record<string, unknown> = {
        treatmentTypes: isProfessional ? [] : (combinedTreatments ?? (selectedRec?.treatment ? [selectedRec.treatment] : [])),
        requiredTherapistTypes: isProfessional ? [selectedRec!.professionalType!] : undefined,
        city: matchPrefs.city || null,
        region: matchPrefs.city ? CITY_TO_REGION[matchPrefs.city] || matchPrefs.region || null : matchPrefs.region || null,
        onlineRequired: matchPrefs.online,
        genderPreference: matchPrefs.genderPref || null,
        culturalPreferences: matchPrefs.culturalPrefs.filter(p => p !== "מטפל/ת עם ניסיון בגיל השלישי"),
        arrangements: matchPrefs.arrangements,
        ageGroups: matchPrefs.culturalPrefs.includes("מטפל/ת עם ניסיון בגיל השלישי") ? ["מבוגרים", "הגיל השלישי"] : ["מבוגרים"],
        languages: matchPrefs.language ? [matchPrefs.language] : ["עברית"],
        styleP1: styleP1 > 0 ? styleP1 : undefined,
        styleP2: styleP2 > 0 ? styleP2 : undefined,
        styleP3: styleP3 > 0 ? styleP3 : undefined,
        couplesModality: selectedRec?.couplesModality ?? (!selectedRec && combinedTreatments ? combinedCouplesModality : undefined),
        needsSexualTherapy: selectedRec?.needsSexualTherapy ?? (!selectedRec && combinedTreatments ? combinedNeedsSexualTherapy : false),
        limit: 10,
      };
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "שגיאה");
      setMatchResults(json.matches ?? []);
      setAddictionCbtFallback(json.addiction_cbt_fallback ?? false);
      setScreen("match-results");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "שגיאה בחיפוש");
    } finally {
      setLoading(false);
    }
  }

  async function fetchExplanation(t: any) {
    if (explainLoading[t.id] || explainData[t.id]) return;
    trackTherapistExplain(t.id, "adults");
    setExplainLoading(prev => ({ ...prev, [t.id]: true }));
    try {
      const recommendedTreatments = scoring?.recommendations.map(r => r.treatment) ?? [];
      // The couples modality this search was run for (EFT / דינאמי / מבני), if any.
      const couplesModality = selectedRec?.couplesModality ?? (combinedTreatments ? combinedCouplesModality : undefined);
      const userSummary = {
        age_group: answers.age ? `${answers.age}` : undefined,
        region_preference: matchPrefs.city || matchPrefs.region || undefined,
        online_preference: matchPrefs.online || undefined,
        therapist_gender_preference: matchPrefs.genderPref || undefined,
        main_needs: scoring?.recommendations.map(r => r.symptomText) ?? [],
        recommended_treatment_types: recommendedTreatments,
        couples_modality: couplesModality,
        cultural_preferences: matchPrefs.culturalPrefs.length ? matchPrefs.culturalPrefs : undefined,
      };
      const res = await fetch("/api/explain-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionnaire_type: "adult",
          search_mode: combinedTreatments ? "combined" : "single",
          user_summary: userSummary,
          therapist: {
            id: t.id,
            full_name: t.full_name,
            therapist_types: t.therapist_types ?? [],
            training_areas: t.training_areas ?? [],
            couples_modalities: t.couples_modalities ?? [],
            regions: t.regions ?? [],
            online: t.online ?? false,
            gender: t.gender ?? null,
            bio: t.bio ?? null,
          },
          match_result: {
            match_score: t.match_score,
            personality_score: t.personality_score ?? null,
            match_reasons: t.match_reasons ?? [],
          },
          addiction_cbt_fallback: addictionCbtFallback || undefined,
        }),
      });
      const data = await res.json();
      setExplainData(prev => ({ ...prev, [t.id]: data }));
    } catch {
      setExplainData(prev => ({ ...prev, [t.id]: null }));
    } finally {
      setExplainLoading(prev => ({ ...prev, [t.id]: false }));
    }
  }

  // Fetch a per-recommendation explanation ("why was X recommended to me?").
  // Keyed on group.treatment + urgent flag so two cards for the same treatment
  // (one urgent, one not) get separate entries. Also fires an analytics event
  // (fire-and-forget) so admin can see who clicks and on what.
  async function fetchRecommendationExplanation(group: { treatment: string; treatmentLabel: string; urgent: boolean; recs: Array<{ symptomText: string; domain: string; couplesModality?: string }> }) {
    const key = group.treatment + (group.urgent ? "-urgent" : "");
    if (recExplainLoading[key] || recExplainData[key]) return;
    setRecExplainLoading(prev => ({ ...prev, [key]: true }));
    const domain = group.recs[0]?.domain ?? "";
    const firstDomain = answers.domains?.[0];

    // Fire-and-forget analytics event — captures who clicks and on what.
    try {
      fetch("/api/track-explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionnaire_type: "adult",
          treatment_key: group.treatment,
          treatment_label: group.treatmentLabel,
          domain,
          urgent: group.urgent,
          session_id: getOrCreateSessionId(),
          viewer_region: normalizeRegionKey(matchPrefs.region, matchPrefs.online),
          viewer_issue: firstDomain ? DOMAIN_ISSUE_MAP[firstDomain] ?? undefined : undefined,
          viewer_age_band: normalizeAgeBand(answers.age),
          viewer_gender: normalizeGenderKey(answers.gender),
        }),
      }).catch(() => {});
    } catch {}

    try {
      const symptoms = group.recs.map(r => r.symptomText).filter(Boolean);
      const facts = buildAdultFacts(answers, domain);
      const factsWithSymptoms = {
        ...facts,
        summary: [...(symptoms.length ? [`ממצאי השאלון: ${symptoms.join("; ")}`] : []), ...(facts.summary ?? [])],
      };
      const coupleModality = group.recs[0]?.couplesModality;
      const COUPLE_MODALITY_WHY: Record<string, string> = {
        EFT: "EFT (Emotionally Focused Therapy) מתמקד בזיהוי דפוסי תגובה שליליים חוזרים בזוגיות, גישה לרגשות עמוקים שמניעים אותם, ובניית קשר רגשי בטוח ואינטימי יותר בין בני הזוג.",
        "דינאמי": "טיפול זוגי דינאמי בוחן כיצד ההיסטוריה האישית של כל אחד מבני הזוג — דפוסים לא-מודעים, קונפליקטים פנימיים וחוויות עבר — משפיעים על הדינמיקה הזוגית, ומסייע בהפחתת דפוסים בעייתיים חוזרים.",
        "מבני": "טיפול זוגי מבני מתמקד בשיפור דפוסי התקשורת, חלוקת התפקידים, הגבולות ומבנה הכוח בזוגיות ובמשפחה — עם דגש על שינוי מעשי באינטראקציות היומיומיות.",
      };
      const treatmentRationale = coupleModality && COUPLE_MODALITY_WHY[coupleModality]
        ? { why: COUPLE_MODALITY_WHY[coupleModality] }
        : undefined;
      const res = await fetch("/api/explain-recommendation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionnaire_type: "adult",
          recommendation: {
            treatment: group.treatment,
            treatment_label: group.treatmentLabel,
            domain,
            urgent: group.urgent,
            symptom_text: symptoms[0],
          },
          user_facts: factsWithSymptoms,
          ...(treatmentRationale ? { treatment_rationale: treatmentRationale } : {}),
        }),
      });
      const data = await res.json();
      setRecExplainData(prev => ({ ...prev, [key]: data }));
    } catch {
      setRecExplainData(prev => ({ ...prev, [key]: null }));
    } finally {
      setRecExplainLoading(prev => ({ ...prev, [key]: false }));
    }
  }

  // ── USAGE LIMIT ────────────────────────────────────────────────────────────
  if (usageAllowed === false) return (
    <Layout screen={screen} domains={answers.domains}>
      <QuizPaymentBlock quizType="adults" />
    </Layout>
  );

  if (qItemsError) return (
    <Layout screen={screen} domains={answers.domains}>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-stone-900 mb-3">לא ניתן לטעון את השאלון</h2>
        <p className="text-stone-500 mb-6 max-w-sm">בדוק את חיבור האינטרנט ונסה שוב.</p>
        <button
          onClick={fetchQItems}
          className="px-6 py-3 bg-[#2c3e7a] text-white rounded-full font-semibold text-sm hover:opacity-90 transition-all"
        >נסה שוב</button>
      </div>
    </Layout>
  );

  if (!qItems) return (
    <Layout screen={screen} domains={answers.domains}>
      <div className="flex justify-center py-20 text-[#6b7280]">טוען שאלון…</div>
    </Layout>
  );

  // ── DISCLAIMER ─────────────────────────────────────────────────────────────
  if (screen === "disclaimer") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card>
        <div className="mb-4 rounded-xl p-4 text-sm font-semibold" style={{ background: "var(--teal-pale)", border: "1px solid var(--teal-mid)", color: "var(--teal-dark)" }}>
          🔒 מילוי השאלון אנונימי לחלוטין — לא נשמר שום מידע, ואין למלא שם או פרטים מזהים.
        </div>
        <div className="mb-6 rounded-xl p-6 leading-relaxed" style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--text-2)" }}>
          <p className="mb-3 text-sm font-bold" style={{ color: "var(--text)" }}>📋 הצהרה והבהרה</p>
          <p className="mb-3 text-sm">שאלון זה נועד אך ורק לסייע בהתאמה של סוג הטיפול לקושי המדווח ואינו מהווה אבחון פסיכולוגי, פסיכיאטרי או רפואי מכל סוג שהוא.</p>
          <p className="mb-3 text-sm">המידע המוצג בשאלון הינו כללי בלבד ואינו מחליף ייעוץ מקצועי, אבחון או טיפול על ידי גורמים מוסמכים. השאלון אינו מתיימר לאבחן הפרעות נפשיות, מחלות או כל מצב בריאותי אחר.</p>
          <p className="text-sm">המשתמש/ת בשאלון זה מצהיר/ה כי הוא/היא מבין/ה שהתשובות המתקבלות אינן מחייבות מבחינה קלינית, ואין לסמוך עליהן כתחליף לאבחון מקצועי. הגורמים המפעילים את השאלון אינם נושאים בכל אחריות לנזק, ישיר או עקיף, שייגרם כתוצאה מהשימוש בו.</p>
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl p-4 text-sm hover:opacity-90" style={{ background: "var(--teal-pale)", border: "1px solid var(--teal-mid)", color: "var(--teal-dark)" }}>
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[var(--teal)]" />
          <span>קראתי את ההצהרה לעיל, הבנתי את תנאיה ואני מסכים/ה להמשיך</span>
        </label>
        <div className="mt-5">
          <button type="button" disabled={!agreed} onClick={() => setScreen("domains")} className="w-full rounded-xl bg-[#1a3a5c] py-3 text-base font-bold text-white disabled:opacity-40 hover:bg-[#0f2540]">
            קראתי והסכמתי – נמשיך ←
          </button>
        </div>
      </Card>
    </Layout>
  );

  // ── INTAKE ─────────────────────────────────────────────────────────────────
  if (screen === "intake") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card badge="פרטים ראשוניים">
        <p className="mb-4 font-semibold text-[#1a3a5c]">עוד שתי שאלות כלליות לפני שנמשיך</p>
        <div className="mb-4 flex gap-4">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-[#6b7280]">גיל</label>
            <input type="number" min={18} max={120} value={localAge || ""}
              onChange={(e) => setLocalAge(Number(e.target.value))}
              onBlur={() => setAgeTouched(true)}
              className="w-full rounded-lg border-2 border-[#ddd6c8] px-3 py-2 text-sm focus:border-[#2e7d8c] focus:outline-none" placeholder="למשל 35" />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-[#6b7280]">מין</label>
            <select value={answers.gender} onChange={(e) => upd({ gender: e.target.value })}
              className="w-full rounded-lg border-2 border-[#ddd6c8] px-3 py-2 text-sm focus:border-[#2e7d8c] focus:outline-none">
              <option value="">בחר/י</option>
              <option value="זכר">זכר</option>
              <option value="נקבה">נקבה</option>
              <option value="לא מעוניין/ת לענות">לא מעוניין/ת לענות</option>
            </select>
          </div>
        </div>
        {ageTouched && localAge > 0 && localAge < 18 && (
          <div className="mt-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
            ⚠️ מתחת לגיל 18 יש לעבור לשאלון ילדים
          </div>
        )}

        <NavRow onBack={() => setScreen("domains")} onNext={() => {
          upd({ age: localAge });
          startDomains();
        }}
          nextDisabled={!localAge || localAge < 18 || !answers.gender} />
      </Card>
    </Layout>
  );

  // ── DOMAINS ─────────────────────────────────────────────────────────────────
  if (screen === "domains") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card badge="תחומי קושי">
        <p className="mb-4 font-semibold text-[#1a3a5c]">בחר/י את התחומים בהם חווה/ת קושי (ניתן לסמן יותר מאחד)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {([
            ["emotional","/icons/emotional.svg","מורכבויות בתחום הרגשי/האישי","חרדות, מצב רוח, טראומה, שינה, אכילה"],
            ["functional","/icons/functional.svg","סימני שאלה לגבי התחומים התפקודיים, התעסוקתיים או האקדמאיים","קשיי למידה, ריכוז, כיוון מקצועי"],
            ["relationship","/icons/relationship.png","זוגיות ומשפחה","קשיים זוגיים, הורות, מיניות"],
            ["addiction","/icons/addiction.svg","קשיי התמכרות","אלכוהול, סמים, מסכים, הימורים"],
          ] as const).map(([id, icon, title, desc]) => {
            const sel = answers.domains.includes(id as any);
            return (
              <button key={id} type="button"
                onClick={() => upd({ domains: sel ? answers.domains.filter((d) => d !== id) : [...answers.domains, id as any] })}
                className={`rounded-xl border-2 p-4 text-right transition-all ${sel ? "border-[#2e7d8c] bg-[#e0f4fa]" : "border-[#ddd6c8] bg-white hover:border-[var(--teal)] hover:bg-[var(--teal-pale)]"}`}>
                <img src={icon} alt="" width={34} height={34} style={{ display: "block" }} />
                <div className="mt-1 text-xs font-bold text-[#1a3a5c]">{title}</div>
                <div className="mt-0.5 text-xs text-[#6b7280]">{desc}</div>
              </button>
            );
          })}
        </div>
        <div className="mt-3">
          {(() => {
            const id = "personal_development" as const;
            const sel = answers.domains.includes(id);
            return (
              <button key={id} type="button"
                onClick={() => upd({ domains: sel ? answers.domains.filter((d) => d !== id) : [...answers.domains, id] })}
                className={`w-full rounded-xl border-2 p-4 text-right transition-all ${sel ? "border-[#2e7d8c] bg-[#e0f4fa]" : "border-[#ddd6c8] bg-white hover:border-[var(--teal)] hover:bg-[var(--teal-pale)]"}`}>
                <img src="/icons/personal-development.svg" alt="" width={34} height={34} style={{ display: "block" }} />
                <div className="mt-0.5 text-xs text-[#6b7280]">אני לא מתמודד/ת עם קושי אלא מעוניין/ת בהבנה עצמית</div>
              </button>
            );
          })()}
        </div>
        <NavRow onBack={() => setScreen("disclaimer")} onNext={() => setScreen("intake")} nextDisabled={answers.domains.length === 0} />
      </Card>
    </Layout>
  );

  // ═══════════════════════════════════════════════════════
  // EMOTIONAL DOMAIN
  // ═══════════════════════════════════════════════════════

  if (screen === "e1") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card badge="תחום רגשי" badgeColor="green">
        <p className="mb-1 font-semibold text-[#1a3a5c]">1. האם חווה/ת <strong>מצב רוח ירוד, עצבות מתמשכת, חוסר חשק, או העדר הנאה ממושכים</strong>?</p>
        <p className="mb-3 rounded-lg bg-gray-50 p-2 text-xs text-[#6b7280]">כולל: עצב, עצבנות, אובדן עניין, שינויים במשקל/שינה, עייפות, קשיי ריכוז</p>
        <YesNo onYes={() => { updE({ e1: true }); setScreen("e1-q"); }} onNo={() => { updE({ e1: false }); setScreen("e2"); }} />
      </Card>
    </Layout>
  );

  if (screen === "e1-q") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card badge="שאלון מצב רוח" badgeColor="green">
        <p className="mb-3 font-semibold text-[#1a3a5c]">בשבועיים האחרונים, כמה מהתסמינים הבאים חווית? סמן/י את התסמינים המתאימים:</p>
        <CheckList items={qItems.mood} checked={moodChecked}
          onChange={(i, v) => setMoodChecked((p) => v ? [...p, i] : p.filter((x) => x !== i))} />
        {moodChecked.includes(8) && <CrisisResources className="mt-4" />}
        <NavRow onBack={() => setScreen("e1")}
          onNext={() => {
            const suicidal = moodChecked.includes(8);
            updE({ moodItems: moodChecked, moodSuicidal: suicidal });
            setScreen("e2");
          }} />
      </Card>
    </Layout>
  );

  // Mania screening — DSM-5 requires BOTH elevated mood AND increased energy.
  // We ask both in one screen with progressive reveal: the second question only
  // shows once the first is answered. The maniaScreen1 / maniaScreen2 booleans
  // are stored separately so downstream scoring sees the same shape as before.
  if (screen === "e2") {
    const m1 = answers.emotional?.maniaScreen1;
    const m2 = answers.emotional?.maniaScreen2;
    const canContinue = m1 !== undefined && (m1 === false || m2 !== undefined);
    return (
      <Layout screen={screen} domains={answers.domains}>
        <Card badge="תחום רגשי" badgeColor="green">
          <p className="mb-1 font-semibold text-[#1a3a5c]">2. האם בשבועות האחרונים חווית <strong>מצב רוח מרומם או רוגזני באופן קיצוני</strong>?</p>
          <YesNo
            onYes={() => updE({ maniaScreen1: true })}
            onNo={() => { updE({ maniaScreen1: false, maniaScreen2: false }); setScreen("e3"); }}
            value={m1}
          />
          {m1 === true && (
            <div className="mt-5 pt-4 border-t border-dashed border-[#c8dce0]">
              <p className="mb-1 font-semibold text-[#1a3a5c]">האם חווית גם <strong>פרץ אנרגיה יוצא דופן</strong> בתקופה זו?</p>
              <YesNo
                onYes={() => updE({ maniaScreen2: true })}
                onNo={() => updE({ maniaScreen2: false })}
                value={m2}
              />
            </div>
          )}
          <NavRow
            onNext={() => {
              if (m1 && m2) setScreen("e2-q");
              else setScreen("e3");
            }}
            nextDisabled={!canContinue}
          />
        </Card>
      </Layout>
    );
  }

  if (screen === "e2-q") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card badge="תחום רגשי" badgeColor="green">
        <p className="mb-3 font-semibold text-[#1a3a5c]">סמן/י את התסמינים הנוספים הרלוונטיים:</p>
        <CheckList items={qItems.mania} checked={maniaChecked}
          onChange={(i, v) => setManiaChecked((p) => v ? [...p, i] : p.filter((x) => x !== i))} />
        <div className="mt-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={maniaDeath} onChange={(e) => setManiaDeath(e.target.checked)} className="accent-[var(--teal)]" />
            מחשבות על מוות
          </label>
        </div>
        {maniaDeath && <CrisisResources className="mt-4" />}
        <NavRow onBack={() => setScreen("e2")}
          onNext={() => { updE({ maniaItems: maniaChecked, maniaDeath }); setScreen("e3"); }} />
      </Card>
    </Layout>
  );

  // Merged screening for 3א + 3ב + 7 — three uncommon, often-stigmatising "do
  // any of these apply?" gates that previously took 3 sequential YesNo screens.
  // Most users will leave everything unchecked and skip; positives still trigger
  // the same follow-up branches (prodrome questionnaire for 3א/3ב, tics+tinnitus
  // for 7) so no clinical info is lost.
  if (screen === "e3") {
    const e3a = answers.emotional?.e3a ?? false;
    const e3b = answers.emotional?.e3b ?? false;
    const e8 = answers.emotional?.e8 ?? false;
    return (
      <Layout screen={screen} domains={answers.domains}>
        <Card badge="תחום רגשי" badgeColor="green">
          <p className="mb-3 font-semibold text-[#1a3a5c]">סמן/י את הרלוונטי (או דלג/י אם אין):</p>
          <ul className="flex flex-col gap-2">
            <li>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-[#ddd6c8] bg-white p-3 text-sm leading-snug transition-all hover:border-[#2e7d8c] hover:bg-[#f0fafc]">
                <input
                  type="checkbox"
                  checked={e3a}
                  onChange={(e) => updE({ e3a: e.target.checked, e3: e.target.checked || e3b })}
                  className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#2e7d8c]"
                />
                ראיתי או שמעתי דברים שאחרים אמרו שאינם קיימים
              </label>
            </li>
            <li>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-[#ddd6c8] bg-white p-3 text-sm leading-snug transition-all hover:border-[#2e7d8c] hover:bg-[#f0fafc]">
                <input
                  type="checkbox"
                  checked={e3b}
                  onChange={(e) => updE({ e3b: e.target.checked, e3: e3a || e.target.checked })}
                  className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#2e7d8c]"
                />
                יש לי אמונות או חשדות יוצאי דופן שאחרים סביבי לא חולקים
              </label>
            </li>
            <li>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-[#ddd6c8] bg-white p-3 text-sm leading-snug transition-all hover:border-[#2e7d8c] hover:bg-[#f0fafc]">
                <input
                  type="checkbox"
                  checked={e8}
                  onChange={(e) => updE({ e8: e.target.checked })}
                  className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#2e7d8c]"
                />
                יש לי תסמינים גופניים שגורמים מצוקה, ומקורם אינו רפואי ואינו חרדה
              </label>
            </li>
          </ul>
          <button
            type="button"
            onClick={() => { updE({ e3a: false, e3b: false, e8: false, e3: false }); setScreen("e4"); }}
            className="mt-3 w-full rounded-xl border-2 border-[#ddd6c8] bg-white px-4 py-2.5 text-sm font-semibold text-[#6b7280] transition-all hover:border-[var(--teal)] hover:text-[var(--teal-dark)]"
          >
            לא — אף אחד מהמשפטים אינו מתאר אותי (דלג/י)
          </button>
          <NavRow
            onNext={() => {
              const cur = answers.emotional ?? {};
              const ce3a = cur.e3a ?? false;
              const ce3b = cur.e3b ?? false;
              // The tics/tinnitus follow-up for the somatic checkbox runs at the
              // original e8 position (after the sleep/eating sub-questionnaires),
              // not here — so continue linearly even when e8 was checked.
              if (ce3a || ce3b) setScreen("e3-q");
              else setScreen("e4");
            }}
          />
        </Card>
      </Layout>
    );
  }

  if (screen === "e3-q") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card badgeColor="green">
        <p className="mb-3 font-semibold text-[#1a3a5c]">סמן/י את ההצהרות המתאימות לך:</p>
        <CheckList items={qItems.prodrome} checked={prodromeChecked}
          onChange={(i, v) => setProdromeChecked((p) => v ? [...p, i] : p.filter((x) => x !== i))} />
        <div className="mt-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={prodromeSuicidal} onChange={(e) => setProdromeSuicidal(e.target.checked)} className="accent-[var(--teal)]" />
            קיימות מחשבות אובדניות
          </label>
        </div>
        {prodromeSuicidal && <CrisisResources className="mt-4" />}
        <NavRow onNext={() => {
          updE({ prodromeItems: prodromeChecked, prodromeSuicidal });
          // Tics/tinnitus follow-up runs at the original e8 position (after
          // eating/sleep). Don't branch on e8 here.
          setScreen("e4");
        }} />
      </Card>
    </Layout>
  );

  if (screen === "e4") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card badge="תחום רגשי" badgeColor="green">
        <p className="mb-1 font-semibold text-[#1a3a5c]">4. האם חווה <strong>דאגות מתמשכות, חרדה, או פחד ממצבים מסוימים</strong>?</p>
        <YesNo onYes={() => { updE({ e4: true }); setScreen("e4-contexts"); }}
          onNo={() => { updE({ e4: false }); setScreen("e5"); }} />
      </Card>
    </Layout>
  );

  // Merged anxiety-contexts screen replaces five separate YesNo screens:
  // e4-chronic, e4-medical, e4-flight, e4-medanx, e4-stresspain.
  // Each checkbox writes to the same underlying field the original screen did,
  // so the scoring logic in questionnaire-score.ts is unchanged.
  if (screen === "e4-contexts") {
    const e = answers.emotional ?? {};
    const chronic = e.e4Chronic ?? false;
    return (
      <Layout screen={screen} domains={answers.domains}>
        <Card badge="תחום רגשי" badgeColor="green">
          <p className="mb-3 font-semibold text-[#1a3a5c]">סמן/י הקשרים שבהם החרדה באה לידי ביטוי (או דלג/י אם לא רלוונטי):</p>
          <ul className="flex flex-col gap-2">
            <li>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-[#ddd6c8] bg-white p-3 text-sm leading-snug transition-all hover:border-[#2e7d8c] hover:bg-[#f0fafc]">
                <input
                  type="checkbox"
                  checked={chronic}
                  onChange={(ev) => updE({ e4Chronic: ev.target.checked, e4Medical: ev.target.checked ? e.e4Medical : undefined })}
                  className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#2e7d8c]"
                />
                כאבים כרוניים (כאבי בטן, כאבי ראש שחוזרים)
              </label>
              {chronic && (
                <div className="mt-2 mr-7 rounded-lg bg-amber-50 border border-amber-200 p-3">
                  <p className="mb-2 text-xs font-semibold text-amber-900">האם נשללו בעיות רפואיות כגורם לכאבים?</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => updE({ e4Medical: true })}
                      className={`flex-1 rounded-lg border-2 py-1.5 text-xs font-bold transition-all ${e.e4Medical === true ? "border-amber-700 bg-amber-700 text-white" : "border-amber-300 bg-white text-amber-900 hover:border-amber-700"}`}>כן</button>
                    <button type="button" onClick={() => updE({ e4Medical: false })}
                      className={`flex-1 rounded-lg border-2 py-1.5 text-xs font-bold transition-all ${e.e4Medical === false ? "border-amber-700 bg-amber-700 text-white" : "border-amber-300 bg-white text-amber-900 hover:border-amber-700"}`}>לא</button>
                  </div>
                </div>
              )}
            </li>
            <li>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-[#ddd6c8] bg-white p-3 text-sm leading-snug transition-all hover:border-[#2e7d8c] hover:bg-[#f0fafc]">
                <input
                  type="checkbox"
                  checked={e.flightAnxiety ?? false}
                  onChange={(ev) => updE({ flightAnxiety: ev.target.checked })}
                  className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#2e7d8c]"
                />
                חרדה בהקשר של טיסות
              </label>
            </li>
            <li>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-[#ddd6c8] bg-white p-3 text-sm leading-snug transition-all hover:border-[#2e7d8c] hover:bg-[#f0fafc]">
                <input
                  type="checkbox"
                  checked={e.medicalAnxiety ?? false}
                  onChange={(ev) => updE({ medicalAnxiety: ev.target.checked })}
                  className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#2e7d8c]"
                />
                חרדה רפואית (חשש ממחטים, מבדיקות, או חשש מתמיד ממחלות)
              </label>
            </li>
            <li>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-[#ddd6c8] bg-white p-3 text-sm leading-snug transition-all hover:border-[#2e7d8c] hover:bg-[#f0fafc]">
                <input
                  type="checkbox"
                  checked={e.stressPain ?? false}
                  onChange={(ev) => updE({ stressPain: ev.target.checked })}
                  className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#2e7d8c]"
                />
                תסמינים גופניים בעת מתח (כאבי ראש, סחרחורות)
              </label>
            </li>
          </ul>
          <NavRow
            onBack={() => setScreen("e4")}
            onNext={() => setScreen("e4-q")}
            nextDisabled={chronic && e.e4Medical === undefined}
          />
        </Card>
      </Layout>
    );
  }

  if (screen === "e4-q") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card badge="שאלון חרדה" badgeColor="green">
        <p className="mb-3 font-semibold text-[#1a3a5c]">עד כמה כל אחד מהדברים הבאים מפריע לך? (1=כלל לא, 3=לעיתים קרובות)</p>
        {qItems.gad7.map((item, i) => (
          <ScaleRow key={i} label={item} group={`gad-${i}`} values={[1, 2, 3]} value={gad7[i]}
            onChange={(v) => setGad7((p) => { const n = [...p]; n[i] = v; return n; })} />
        ))}
        <NavRow
          onNext={() => {
            updE({ gad7Scores: gad7 });
            setScreen("e4-social");
          }} />
      </Card>
    </Layout>
  );

  if (screen === "e4-social") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card badge="חרדה חברתית" badgeColor="green">
        <p className="mb-3 font-semibold text-[#1a3a5c]">האם יש לך <strong>חרדה חברתית</strong>? (חשש מהערכה שלילית, הימנעות ממצבים חברתיים)</p>
        <YesNo onYes={() => { updE({ socialAnxiety: true }); setScreen("e4-social-sev"); }}
          onNo={() => { updE({ socialAnxiety: false }); setScreen("e5"); }} />
      </Card>
    </Layout>
  );

  if (screen === "e4-social-sev") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card badge="חרדה חברתית" badgeColor="green">
        <p className="mb-3 font-semibold text-[#1a3a5c]">עד כמה החרדה החברתית פוגעת בתפקוד שלך? (1=כלל לא, 7=מאוד)</p>
        <ScaleRow label="" group="social-sev" values={[1,2,3,4,5,6,7]} value={socialSeverity} onChange={setSocialSeverity} />
        <NavRow onBack={() => setScreen("e4-social")}
          onNext={() => { updE({ socialSeverity }); setScreen("e5"); }} />
      </Card>
    </Layout>
  );
  // e4-flight, e4-medanx, e4-stresspain merged into "e4-contexts" above.

  if (screen === "e5") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card badge="תחום רגשי" badgeColor="green">
        <p className="mb-1 font-semibold text-[#1a3a5c]">5. האם חש/ה <strong>הכרח לחשוב שוב ושוב מחשבות מסוימות, או לעשות שוב ושוב פעולות מסוימות</strong>?</p>
        <YesNo onYes={() => { updE({ e5: true }); setScreen("e5-q"); }}
          onNo={() => { updE({ e5: false }); setScreen("e6"); }} />
      </Card>
    </Layout>
  );

  if (screen === "e5-q") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card badge="תחום רגשי" badgeColor="green">
        <p className="mb-3 font-semibold text-[#1a3a5c]">עד כמה כל אחד מהדברים הבאים מתאר אותך? (1=אף פעם, 3=תמיד)</p>
        {qItems.ocd.map((item, i) => (
          <ScaleRow key={i} label={item} group={`ocd-${i}`} values={[1,2,3]} value={ocd[i]}
            onChange={(v) => setOcd((p) => { const n = [...p]; n[i] = v; return n; })} />
        ))}
        <NavRow onBack={() => setScreen("e5")}
          onNext={() => { updE({ ocdScores: ocd }); setScreen("e6"); }} />
      </Card>
    </Layout>
  );

  // Eating/sleep — gate removed. We show the two checkboxes directly; the
  // underlying e6 / e7 booleans are populated based on what was checked, so the
  // downstream sub-questionnaires (e6-q for eating, e7-q for sleep) still receive
  // the same triggers. Neither checked → skip straight to e8.
  if (screen === "e6") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card badge="תחום רגשי" badgeColor="green">
        <p className="mb-3 font-semibold text-[#1a3a5c]">6. האם חווה/ת קשיים באחד מהבאים? (סמן/י את הרלוונטי או דלג/י)</p>
        <div className="space-y-3">
          {[
            { key: "eating", label: "אכילה ומשקל", state: e6EatingChecked, setter: setE6EatingChecked },
            { key: "sleep",  label: "בעיות שינה",  state: e6SleepChecked,  setter: setE6SleepChecked  },
          ].map(({ key, label, state, setter }) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer rounded-xl border-2 px-4 py-3 transition-all"
              style={{ borderColor: state ? "#2e7d8c" : "#ddd6c8", background: state ? "#e0f4fa" : "white" }}>
              <input type="checkbox" checked={state} onChange={e => setter(e.target.checked)}
                className="h-4 w-4 accent-[#2e7d8c]" />
              <span className="text-sm font-medium text-[#1a3a5c]">{label}</span>
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            setE6EatingChecked(false);
            setE6SleepChecked(false);
            updE({ e6: false, e7: false });
            setScreen(answers.emotional?.e8 ? "e8c" : "e9-q");
          }}
          className="mt-3 w-full rounded-xl border-2 border-[#ddd6c8] bg-white px-4 py-2.5 text-sm font-semibold text-[#6b7280] transition-all hover:border-[var(--teal)] hover:text-[var(--teal-dark)]"
        >
          לא — איני חווה אף אחד מהקשיים האלה (דלג/י)
        </button>
        <NavRow
          onNext={() => {
            const hasEating = e6EatingChecked;
            const hasSleep = e6SleepChecked;
            updE({ e6: hasEating, e7: hasSleep });
            if (hasEating) setScreen("e6-q");
            else if (hasSleep) setScreen("e7-q");
            else setScreen(answers.emotional?.e8 ? "e8c" : "e9-q");
          }}
        />
      </Card>
    </Layout>
  );

  if (screen === "e6-q") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card badge="שאלון אכילה" badgeColor="green">
        <p className="mb-3 font-semibold text-[#1a3a5c]">סמן/י כמה מהדברים הבאים רלוונטיים (כל קבוצה בנפרד):</p>
        <p className="mb-2 text-sm font-bold text-[#2d7a4f]">א. הגבלה והקפדה על משקל:</p>
        <CheckList items={["אני מתאמץ/ת לשמור על משקל נמוך מהמומלץ לי","פחד עז מעלייה במשקל","עיוות בתפיסת הגוף"]}
          checked={eating1Checked}
          onChange={(i, v) => {
            const next = v ? [...eating1Checked, i] : eating1Checked.filter(x => x !== i);
            setEating1Checked(next);
            updE({ eating1Count: next.length });
          }} />
        <p className="mb-2 mt-3 text-sm font-bold text-[#2d7a4f]">ב. אכילת יתר ופעולות פיצוי:</p>
        <CheckList items={["פרקי אכילת יתר מתמשכים","הקאות מכוונות / שימוש במשלשלים","פעילות גופנית כפייתית"]}
          checked={eating2Checked}
          onChange={(i, v) => {
            const next = v ? [...eating2Checked, i] : eating2Checked.filter(x => x !== i);
            setEating2Checked(next);
            updE({ eating2Count: next.length, eating2Purge: next.includes(1) });
          }} />
        <p className="mb-2 mt-3 text-sm font-bold text-[#2d7a4f]">ג. הימנעות סלקטיבית ממזון:</p>
        <CheckList items={["הימנעות ממזון בשל מרקם/מראה","פחד מחנק/הקאה בעת אכילה","תזונה מוגבלת מאוד"]}
          checked={eating3Checked}
          onChange={(i, v) => {
            const next = v ? [...eating3Checked, i] : eating3Checked.filter(x => x !== i);
            setEating3Checked(next);
            updE({ eating3Count: next.length });
          }} />
        <div className="mt-4 border-t border-[#eee] pt-4">
          <p className="mb-2 text-sm font-semibold text-[#1a3a5c]">גובה ומשקל <span className="font-normal text-[#6b7280]">(לחישוב BMI — אופציונלי)</span></p>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-[#6b7280]">גובה (ס&quot;מ)</label>
              <input type="number" min={100} max={250} value={bmiH || ""}
                onChange={(e) => setBmiH(Number(e.target.value))}
                className="w-full rounded-lg border-2 border-[#ddd6c8] px-3 py-2 text-sm focus:border-[#2e7d8c] focus:outline-none" placeholder="175" />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs text-[#6b7280]">משקל (ק&quot;ג)</label>
              <input type="number" min={20} max={300} value={bmiW || ""}
                onChange={(e) => setBmiW(Number(e.target.value))}
                className="w-full rounded-lg border-2 border-[#ddd6c8] px-3 py-2 text-sm focus:border-[#2e7d8c] focus:outline-none" placeholder="70" />
            </div>
          </div>
          {bmiH > 0 && bmiW > 0 && (() => { const bmi = bmiW / Math.pow(bmiH / 100, 2); const ok = bmi >= 18.5 && bmi <= 24.9; return (
            <p className={`mt-2 rounded-lg p-2 text-xs ${ok ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"}`}>
              BMI: {bmi.toFixed(1)} – {ok ? "תקין ✓" : "אינו תקין – הפנייה לרופא משפחה"}
            </p>
          ); })()}
        </div>
        <NavRow onBack={() => setScreen("e6")} onNext={() => {
          const bmi = (bmiH > 0 && bmiW > 0) ? bmiW / Math.pow(bmiH / 100, 2) : undefined;
          upd({ bmi });
          setScreen(e6SleepChecked ? "e7-q" : (answers.emotional?.e8 ? "e8c" : "e9-q"));
        }} />
      </Card>
    </Layout>
  );

  if (screen === "e7-q") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card badge="שאלון שינה" badgeColor="green">
        <p className="mb-3 font-semibold text-[#1a3a5c]">סמן/י את הרלוונטי לך:</p>
        <CheckList items={qItems.sleep} checked={sleepChecked}
          onChange={(i, v) => setSleepChecked((p) => v ? [...p, i] : p.filter((x) => x !== i))} />
        <NavRow onBack={() => setScreen(e6EatingChecked ? "e6-q" : "e6")}
          onNext={() => {
            updE({ sleepItems: qItems.sleep.map((_, i) => sleepChecked.includes(i)) });
            setScreen(answers.emotional?.e8 ? "e8c" : "e9-q");
          }} />
      </Card>
    </Layout>
  );

  // The standalone "e8" somatic question was merged into the psychosis/somatic
  // super-question at e3. The tics+tinnitus follow-up below runs at the same
  // sequence position the standalone screen used to occupy, but only when the
  // somatic checkbox was actually marked on the merged screen.
  if (screen === "e8c") {
    const e = answers.emotional ?? {};
    const tics = e.tics ?? false;
    const tinnitus = e.tinnitus ?? false;
    return (
      <Layout screen={screen} domains={answers.domains}>
        <Card badge="תחום רגשי" badgeColor="green">
          <p className="mb-3 font-semibold text-[#1a3a5c]">סמן/י את הרלוונטי לגבי התסמינים הגופניים (או דלג/י):</p>
          <ul className="flex flex-col gap-2">
            <li>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-[#ddd6c8] bg-white p-3 text-sm leading-snug transition-all hover:border-[#2e7d8c] hover:bg-[#f0fafc]">
                <input
                  type="checkbox"
                  checked={tics}
                  onChange={(ev) => updE({ tics: ev.target.checked })}
                  className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#2e7d8c]"
                />
                טיקים (תנועות או קולות בלתי רצוניים חוזרים)
              </label>
            </li>
            <li>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-[#ddd6c8] bg-white p-3 text-sm leading-snug transition-all hover:border-[#2e7d8c] hover:bg-[#f0fafc]">
                <input
                  type="checkbox"
                  checked={tinnitus}
                  onChange={(ev) => updE({ tinnitus: ev.target.checked })}
                  className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#2e7d8c]"
                />
                צפצופים באוזניים (טנטון)
              </label>
            </li>
          </ul>
          <NavRow onNext={() => setScreen("e9-q")} />
        </Card>
      </Layout>
    );
  }

  // Trauma gate (e9) was merged into e9-q: instead of a standalone yes/no
  // followed by the full PCL-5 form, we surface a single "no trauma" option in
  // the same screen so users who don't need the questionnaire skip in one tap.
  if (screen === "e9-q") {
    const noTrauma = traumaType === "__none__";
    return (
      <Layout screen={screen} domains={answers.domains}>
        <Card badge="8. אירוע טראומטי" badgeColor="green">
          <p className="mb-3 font-semibold text-[#1a3a5c]">האם חווית בעבר <strong>אירוע טראומטי</strong>? (תאונת דרכים, פיגוע, רעידת אדמה, פגיעה מינית, לחימה וכד')</p>
          <div className="mb-3">
            <button
              type="button"
              onClick={() => { setTraumaType("__none__"); updE({ e9: false }); setScreen("e10"); }}
              className={`w-full rounded-xl border-2 px-4 py-3 text-right text-sm font-semibold transition-all ${noTrauma ? "border-[#1a3a5c] bg-[#1a3a5c] text-white" : "border-[#ddd6c8] bg-white text-[#1a3a5c] hover:border-[#1a3a5c]"}`}
            >
              לא חוויתי אירוע טראומטי — דלג/י
            </button>
          </div>
          <p className="mb-2 text-xs text-[#6b7280]">או — בחר/י סוג אירוע למילוי השאלון:</p>
          <select value={noTrauma ? "" : traumaType} onChange={(e) => setTraumaType(e.target.value)}
            className="mb-3 w-full rounded-lg border-2 border-[#ddd6c8] px-3 py-2 text-sm focus:border-[#2e7d8c] focus:outline-none">
            <option value="">בחר/י סוג אירוע</option>
            <option value="accident">תאונת דרכים</option>
            <option value="disaster">אסון טבע</option>
            <option value="terror">פיגוע או נפילת רקטה</option>
            <option value="combat">השתתפות/נוכחות בזירת לחימה</option>
            <option value="sexual">פגיעה מינית</option>
            <option value="loss">אובדן/שכול של אדם קרוב</option>
            <option value="medical">אירוע רפואי קשה (אבחנה, ניתוח, אשפוז)</option>
            <option value="abuse">התעללות גופנית או רגשית</option>
            <option value="other">אחר</option>
          </select>
          {!noTrauma && traumaType === "other" && (
            <input
              type="text"
              value={traumaTypeOther}
              onChange={(e) => setTraumaTypeOther(e.target.value)}
              placeholder="פרט/י בקצרה את האירוע"
              className="mb-3 w-full rounded-lg border-2 border-[#ddd6c8] px-3 py-2 text-sm focus:border-[#2e7d8c] focus:outline-none"
            />
          )}
          {!noTrauma && traumaType && (
            <>
              <p className="mb-2 font-semibold text-[#1a3a5c]">תדירות:</p>
              <div className="mb-3 flex gap-2">
                {[["single","חד-פעמי"],["multiple","מספר פעמים"],["ongoing","מתמשך"]].map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setTraumaFreq(v)}
                    className={`flex-1 rounded-lg border-2 py-2 text-xs font-semibold ${traumaFreq === v ? "border-[#2e7d8c] bg-[#2e7d8c] text-white" : "border-[#ddd6c8] bg-white"}`}>{l}</button>
                ))}
              </div>
              <p className="mb-2 font-semibold text-[#1a3a5c]">חלק ב' – ענה/י בהתייחס לחודש האחרון (0=כלל לא, 4=חמור מאוד):</p>
              {qItems.trauma.map((item, i) => (
                <ScaleRow key={i} label={item} group={`trauma-${i}`} values={[0,1,2,3,4]} value={traumaScores[i]}
                  onChange={(v) => setTraumaScores((p) => { const n = [...p]; n[i] = v; return n; })} />
              ))}
              <div className="mt-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={traumaSuicidal} onChange={(e) => setTraumaSuicidal(e.target.checked)} className="accent-[#2e7d8c]" />
                  קיימות מחשבות אובדניות בהקשר הטראומה
                </label>
              </div>
              {traumaSuicidal && <CrisisResources className="mt-3" />}
            </>
          )}
          <NavRow
            onNext={() => {
              if (noTrauma) {
                updE({ e9: false });
                setScreen("e10");
                return;
              }
              if (!traumaType) return;
              updE({
                e9: true,
                traumaScores,
                traumaSuicidal,
                traumaType,
                traumaTypeOther: traumaType === "other" ? traumaTypeOther : undefined,
                traumaFreq,
              });
              setScreen("e10");
            }}
            nextDisabled={!noTrauma && !traumaType}
          />
        </Card>
      </Layout>
    );
  }

  if (screen === "e10") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card badge="תחום רגשי" badgeColor="green">
        <p className="mb-1 font-semibold text-[#1a3a5c]">9. האם את/ה מרגיש/ה שקיימת <strong>חוסר עקביות מתמשכת</strong> באופן שבו את/ה מנהל/ת את הקשרים עם אחרים?</p>
        <YesNo onYes={() => { updE({ e10: true }); setScreen("e10a"); }}
          onNo={() => { updE({ e10: false }); setScreen("therapist-style"); }} />
      </Card>
    </Layout>
  );

  if (screen === "e10a") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card badge="שאלון אישיות" badgeColor="green">
        <p className="mb-3 font-semibold text-[#1a3a5c]">דרג/י כל שאלה מ-1 (כלל לא) עד 5 (מאוד):</p>
        {[
          "קשיים ניכרים בתפקוד היומיומי (עבודה, מערכות יחסים, פנאי)",
          "הסביבה הקרובה ציינה קשיים ניכרים בתפקוד שלך",
        ].map((q, i) => (
          <ScaleRow key={i} label={q} group={`pm-${i}`} values={[1,2,3,4,5]} value={persMain[i]}
            onChange={(v) => setPersMain((p) => { const n = [...p]; n[i] = v; return n; })} />
        ))}
        <NavRow onBack={() => setScreen("e10")}
          onNext={() => {
            updE({ persMainScores: persMain });
            const s = persMain[0] + persMain[1];
            setScreen(s >= 5 ? "e10b" : "therapist-style");
          }} />
      </Card>
    </Layout>
  );

  if (screen === "e10b") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card badge="שאלון אישיות" badgeColor="green">
        <p className="mb-3 font-semibold text-[#1a3a5c]">ענה/י על כל שאלה: 1=כן, 2=לא</p>
        {[
          "קושי בהבנת כוונות חברתיות/רמזים לא-מילוליים?",
          "העדפה חזקה לשגרה וקושי עם שינויים?",
          "עיסוק אינטנסיבי בנושא מסוים?",
          "רגישות חושית חריגה?",
        ].map((q, i) => (
          <div key={i} className="mb-3">
            <p className="mb-1 text-sm">{q}</p>
            <div className="flex gap-2">
              {[1, 2].map((v) => (
                <button key={v} type="button" onClick={() => setDisQ((p) => { const n = [...p]; n[i] = v; return n; })}
                  className={`flex-1 rounded-lg border-2 py-2 text-sm font-bold ${disQ[i] === v ? "border-[var(--teal)] bg-[var(--teal)] text-white" : "border-[#ddd6c8] bg-white"}`}>
                  {v === 1 ? "כן" : "לא"}
                </button>
              ))}
            </div>
          </div>
        ))}
        <NavRow
          onNext={() => {
            updE({ disQAnswers: disQ });
            // 1=כן, 2=לא לכל אחד מ-4 פריטים. סכום נמוך = הרבה "כן" = סימני אוטיזם.
            // סכום <= 5 (3+ "כן") → ההפניה היא לאבחון תקשורת, מדלגים על שאלון אישיות.
            const total = disQ.reduce((a, b) => a + b, 0);
            setScreen(total <= 5 ? "therapist-style" : "e10c");
          }} />
      </Card>
    </Layout>
  );

  if (screen === "e10c") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card badge="שאלון אישיות" badgeColor="green">
        <p className="mb-3 font-semibold text-[#1a3a5c]">דרג/י כל היגד מ-1 (כלל לא) עד 5 (מאוד):</p>
        {qItems.pers.map((item, i) => (
          <ScaleRow key={i} label={item} group={`pers-${i}`} values={[1,2,3,4,5]} value={persScores[i]}
            onChange={(v) => setPersScores((p) => { const n = [...p]; n[i] = v; return n; })} />
        ))}
        <div className="mt-2 flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={persQ7} onChange={(e) => setPersQ7(e.target.checked)} className="accent-[var(--teal)]" />
            יש לי תחושה של "ריק פנימי" או חוסר בתחושת זהות יציבה
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={persQ8} onChange={(e) => setPersQ8(e.target.checked)} className="accent-[var(--teal)]" />
            הסביבה הקרובה אומרת שיש לי תגובות רגשיות קיצוניות ומהירות
          </label>
        </div>
        <NavRow onBack={() => setScreen("e10b")}
          onNext={() => { updE({ persScores, persQ7, persQ8 }); setScreen("therapist-style"); }} />
      </Card>
    </Layout>
  );

  if (screen === "therapist-style") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card badge="סגנון טיפול מועדף" badgeColor="teal">
        <p className="mb-3 font-semibold text-[#1a3a5c]">שלוש שאלות על סגנון הטיפול המועדף עליך:</p>
        <ScaleRow label="כדי ליצור שינוי אמיתי בחיי, אני מאמין/ה שעלי קודם כל להבין לעומק את שורשי הבעיה בעברי ואת הדפוסים הלא-מודעים שמנהלים אותי." sublabel="1 = בכלל לא מסכים/ה – מעדיף/ה הקלה מיידית ומעשית  |  7 = מסכים/ה מאוד – מחפש/ת תובנה עמוקה" group="ts-q1" values={[1,2,3,4,5,6,7]} value={styleQ1} onChange={setStyleQ1} />
        <ScaleRow label="בבואי לפתור קושי רגשי, אני מעדיף/ה שהמטפל יספק לי תוכנית עבודה מוגדרת, כלים פרקטיים ומשימות לתרגול בין הפגישות." sublabel="1 = בכלל לא מסכים/ה – מעדיף/ה מרחב פתוח וחופשי  |  7 = מסכים/ה מאוד – זקוק/ה למסגרת ברורה, כלים ומשימות" group="ts-q2" values={[1,2,3,4,5,6,7]} value={styleQ2} onChange={setStyleQ2} />
        <ScaleRow label="בטיפול רגשי, נוח לי יותר עם מטפל שמגיב באופן פעיל, שואל, מכוון, מסכם ומביע את עמדתו, מאשר עם מטפל שמכיל יותר, שוהה ומתבונן." sublabel="1 = בכלל לא מסכים/ה – מעדיף/ה מטפל מכיל, שקט ומתבונן  |  7 = מסכים/ה מאוד – מעדיף/ה מטפל פעיל, מכוון ומעורב מילולית" group="ts-q3" values={[1,2,3,4,5,6,7]} value={styleQ3} onChange={setStyleQ3} />
        <NavRow onBack={() => {
            const onlyPD = answers.domains.length === 1 && answers.domains[0] === "personal_development";
            setScreen(onlyPD ? "domains" : "e10");
          }}
          onNext={() => {
            nextDomain(updE({ therapistStyleQ1: styleQ1, therapistStyleQ2: styleQ2, therapistStyleQ3: styleQ3 }));
          }} />
      </Card>
    </Layout>
  );

  // ═══════════════════════════════════════════════════════
  // FUNCTIONAL DOMAIN
  // ═══════════════════════════════════════════════════════

  if (screen === "f-vision") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card badge="תחום תפקודי">
        <p className="mb-4 font-semibold text-[#1a3a5c]">לפני השאלות על תפקוד אקדמאי ותעסוקתי:</p>
        <div className="mb-5">
          <p className="mb-2 text-sm font-semibold text-[#1a3a5c]">האם ישנם סימנים או רמזים לקשיי ראייה?</p>
          <div className="flex gap-3">
            <button type="button" onClick={() => setVisionAns(true)}
              className={`flex-1 rounded-xl border-2 py-2 text-sm font-bold transition-all ${visionAns === true ? "border-[var(--teal)] bg-[var(--teal)] text-white" : "border-[#ddd6c8] bg-white hover:border-[#2e7d8c]"}`}>כן</button>
            <button type="button" onClick={() => setVisionAns(false)}
              className={`flex-1 rounded-xl border-2 py-2 text-sm font-bold transition-all ${visionAns === false ? "border-[#1a3a5c] bg-[#1a3a5c] text-white" : "border-[#ddd6c8] bg-white hover:border-[#1a3a5c]"}`}>לא</button>
          </div>
          {visionAns === true && (
            <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">📌 הפנייה לבדיקת ראייה (תוצאה זו תיכלל בפלט הסופי)</p>
          )}
        </div>
        <div className="mb-2">
          <p className="mb-2 text-sm font-semibold text-[#1a3a5c]">האם ישנם סימנים או רמזים לקשיי שמיעה?</p>
          <div className="flex gap-3">
            <button type="button" onClick={() => setHearingAns(true)}
              className={`flex-1 rounded-xl border-2 py-2 text-sm font-bold transition-all ${hearingAns === true ? "border-[var(--teal)] bg-[var(--teal)] text-white" : "border-[#ddd6c8] bg-white hover:border-[#2e7d8c]"}`}>כן</button>
            <button type="button" onClick={() => setHearingAns(false)}
              className={`flex-1 rounded-xl border-2 py-2 text-sm font-bold transition-all ${hearingAns === false ? "border-[#1a3a5c] bg-[#1a3a5c] text-white" : "border-[#ddd6c8] bg-white hover:border-[#1a3a5c]"}`}>לא</button>
          </div>
          {hearingAns === true && (
            <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">📌 הפנייה לבדיקת שמיעה (תוצאה זו תיכלל בפלט הסופי)</p>
          )}
        </div>
        <NavRow onNext={() => {
          upd({ vision: visionAns ?? undefined, hearing: hearingAns ?? undefined });
          setScreen("f1");
        }} nextDisabled={visionAns === null || hearingAns === null} />
      </Card>
    </Layout>
  );

  // f1 gate + sub-type picker merged into one screen. Selecting either checkbox
  // implicitly sets f1=true; unchecking both means no learning difficulties and
  // skips straight to f2.
  if (screen === "f1") {
    const att = answers.functional?.f1Attention ?? false;
    const proc = answers.functional?.f1Processing ?? false;
    return (
      <Layout screen={screen} domains={answers.domains}>
        <Card badge="תחום תפקודי">
          <p className="mb-3 font-semibold text-[#1a3a5c]">1. האם חווית <strong>קשיים משמעותיים ומתמשכים בלמידה</strong>? סמן/י את סוג הקושי (ניתן לסמן שניים, או לדלג):</p>
          <div className="flex flex-col gap-3">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-[#ddd6c8] bg-white p-3 text-sm leading-snug hover:border-[#2e7d8c] hover:bg-[#f0fafc]">
              <input type="checkbox" checked={att}
                onChange={(e) => updF({ f1Attention: e.target.checked, f1: e.target.checked || proc })}
                className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#2e7d8c]" />
              קושי בריכוז — חוסר ריכוז / קושי להתמיד במשימה (ADHD)
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-[#ddd6c8] bg-white p-3 text-sm leading-snug hover:border-[#2e7d8c] hover:bg-[#f0fafc]">
              <input type="checkbox" checked={proc}
                onChange={(e) => updF({ f1Processing: e.target.checked, f1: e.target.checked || att })}
                className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#2e7d8c]" />
              קושי בהבנה ועיבוד — המשימה קשה להבנה גם עם ריכוז מלא (לקויות למידה)
            </label>
          </div>
          <NavRow
            onNext={() => {
              const cur = answers.functional ?? {};
              const a = cur.f1Attention ?? false;
              const p = cur.f1Processing ?? false;
              updF({ f1: a || p });
              if (a) setScreen("f1-adhd");
              else if (p) setScreen("f1-ld");
              else setScreen("f2");
            }}
          />
        </Card>
      </Layout>
    );
  }

  if (screen === "f1-adhd") {
    const ADHD1 = ["שמירה על ריכוז במשימות או פעילויות","ארגון משימות או פעילויות","נטייה לאבד חפצים הנחוצים לביצוע משימה","הסחה בקלות מרעשים/קולות","שכחה בביצוע משימות יומיומיות","קושי להקדיש תשומת לב לפרטים / טעויות מרובות בעבודה"];
    const ADHD2 = ["תחושת חוסר מנוחה או קוצר רוח","קושי לשבת במקום לאורך זמן ו/או תנועות ידיים ורגליים מוגברות","קושי להירגע ולהשתחרר כשיש לך זמן לעצמך","קושי להמתין לתורך","נטייה להפריע לאחרים או להתפרץ לדבריהם","נטייה לענות על שאלות לפני השלמתן"];
    return (
      <Layout screen={screen} domains={answers.domains}>
        <Card badge="שאלון ADHD">
          <p className="mb-1 text-xs text-[#6b7280]">סמן/י את הרלוונטי (3 מתוך 6 בכל בלוק = סף)</p>
          <p className="mb-2 font-bold text-[#1a3a5c]">בלוק א – חוסר קשב:</p>
          <CheckList items={ADHD1} checked={adhd1Checked} onChange={(i,v) => setAdhd1Checked((p) => v ? [...p,i] : p.filter((x) => x !== i))} />
          <p className="mb-2 mt-4 font-bold text-[#1a3a5c]">בלוק ב – היפראקטיביות:</p>
          <CheckList items={ADHD2} checked={adhd2Checked} onChange={(i,v) => setAdhd2Checked((p) => v ? [...p,i] : p.filter((x) => x !== i))} />
          <NavRow onBack={() => setScreen("f1")}
            onNext={() => {
              updF({ adhd1Count: adhd1Checked.length, adhd2Count: adhd2Checked.length });
              setScreen(answers.functional?.f1Processing ? "f1-ld" : "f2");
            }} />
        </Card>
      </Layout>
    );
  }

  if (screen === "f1-ld") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card badge="שאלון קשיי למידה">
        <p className="mb-2 font-semibold text-[#1a3a5c]">האם בילדותך היה קושי ברכישת הקריאה?</p>
        <YesNo onYes={() => { updF({ ldReading: true }); setScreen("f1-ld-q"); }}
          onNo={() => { updF({ ldReading: false }); setScreen("f2"); }} />
      </Card>
    </Layout>
  );

  if (screen === "f1-ld-q") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card badge="שאלון קשיי למידה">
        <p className="mb-3 font-semibold text-[#1a3a5c]">עד כמה כל אחד מהדברים הבאים מתאר אותך? (1=כלל לא, 3=תמיד)</p>
        {qItems.ld.map((item, i) => (
          <ScaleRow key={i} label={item} group={`ld-${i}`} values={[1,2,3]} value={ldScores[i]}
            onChange={(v) => setLdScores((p) => { const n = [...p]; n[i] = v; return n; })} />
        ))}
        <NavRow onBack={() => setScreen("f1-ld")}
          onNext={() => { updF({ ldScores }); setScreen("f2"); }} />
      </Card>
    </Layout>
  );

  if (screen === "f2") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card badge="תחום תפקודי">
        <p className="mb-1 font-semibold text-[#1a3a5c]">2. האם יש לך <strong>קשיי התארגנות</strong> (תכנון, ניהול זמן, ניהול משימות)?</p>
        <YesNo onYes={() => { updF({ f2: true }); setScreen("f2-q"); }}
          onNo={() => { updF({ f2: false }); setScreen("f3"); }} />
      </Card>
    </Layout>
  );

  if (screen === "f2-q") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card badge="שאלון תפקודים ניהוליים">
        <p className="mb-3 font-semibold text-[#1a3a5c]">עד כמה כל אחד מהדברים הבאים מתאר אותך? (1=כלל לא, 3=תמיד)</p>
        {qItems.exec.map((item, i) => (
          <ScaleRow key={i} label={item} group={`exec-${i}`} values={[1,2,3]} value={execScores[i]}
            onChange={(v) => setExecScores((p) => { const n = [...p]; n[i] = v; return n; })} />
        ))}
        <NavRow onBack={() => setScreen("f2")}
          onNext={() => { updF({ execScores }); setScreen("f3"); }} />
      </Card>
    </Layout>
  );

  if (screen === "f3") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card badge="תחום תפקודי">
        <p className="mb-1 font-semibold text-[#1a3a5c]">3. האם יש לך <strong>קושי, אי-בהירות, או שחיקה</strong> בתחום התעסוקתי שלך?</p>
        <YesNo onYes={() => { updF({ f3: true }); setScreen("f3-type"); }}
          onNo={() => { nextDomain(updF({ f3: false })); }} />
      </Card>
    </Layout>
  );

  if (screen === "f3-type") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card badge="תחום תעסוקתי">
        <p className="mb-3 font-semibold text-[#1a3a5c]">מה הסטאטוס הנוכחי?</p>
        <div className="flex flex-col gap-2">
          {([
            ["young", "צעיר/ה בתחילת דרכי", "טרם התחלתי לעבוד, לפני / במהלך לימודים"],
            ["career-change", "אדם בוגר — שינוי קריירה", "כבר עובד/ת, מחפש/ת שינוי כיוון מקצועי"],
            ["disability", "בעל/ת מוגבלות", ""],
            ["burnout", "שחיקה בעבודה / דכדוך / חוסר כיוון", "עובד/ת, אך מרגיש/ה ירידה במוטיבציה או בשביעות רצון"],
            ["other", "אחר", ""],
          ] as [string, string, string][]).map(([v, l, sub]) => (
            <button key={v} type="button"
              onClick={() => { updF({ employmentType: v }); setScreen(v === "disability" ? "f3-disability" : v === "young" ? "f3-a" : "f3-b"); }}
              className="rounded-xl border-2 border-[#ddd6c8] bg-white px-4 py-3 text-right text-sm font-semibold hover:border-[var(--teal)] hover:bg-[var(--teal-pale)]">
              <div>{l}</div>
              {sub && <div className="mt-0.5 text-xs font-normal text-stone-500">{sub}</div>}
            </button>
          ))}
        </div>
        <NavRow onBack={() => setScreen("f3")} />
      </Card>
    </Layout>
  );

  if (screen === "f3-a") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card badge="שאלון תעסוקתי">
        <p className="mb-3 font-semibold text-[#1a3a5c]">סמן/י את הרלוונטי לך:</p>
        <CheckList items={[
          "האם חש/ה כי ישנו קושי רגשי שקשור לתחום שהיית רוצה לעסוק בו? (דימוי עצמי נמוך, לחצים ועוד)",
          "האם את/ה מחשיב/ה את עצמך כאדם ורבאלי?",
          "האם יש לך רצון לעסוק בתחומי הטיפול או החינוך?",
          "האם את/ה מעוניין/ת במידע אובייקטיבי ומבוסס מבחנים לגבי התאמה מקצועית?",
          "האם אתה מחפש כיוון לימודי או מקצועי?",
        ]} checked={empAChecked.map((v, i) => v ? i : -1).filter(i => i >= 0)}
          onChange={(i, v) => setEmpAChecked((p) => { const n = [...p]; n[i] = v; return n; })} />
        <NavRow onBack={() => setScreen("f3-type")}
          onNext={() => { nextDomain(updF({ empAItems: empAChecked })); }} />
      </Card>
    </Layout>
  );

  if (screen === "f3-b") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card badge="שאלון תעסוקתי">
        <p className="mb-3 font-semibold text-[#1a3a5c]">סמן/י את הרלוונטי לך:</p>
        <CheckList items={[
          "האם חש/ה כי ישנו קושי רגשי שקשור לתחום העבודה שלך? (דימוי עצמי נמוך, לחצים ועוד)",
          "האם יש תחושה של שחיקה בעבודה, רצון לשינוי, אבל לא ברור מה הבעיה או מה הכיוון?",
          "האם יש ענין לבחון כיוונים תעסוקתיים חדשים שלא חשבת עליהם, או שיש קושי להבין מה הכישורים הנוספים שיש לך?",
          "האם את/ה מעוניין/ת במידע אובייקטיבי ומבוסס מבחנים לגבי התאמה מקצועית?",
        ]} checked={empBChecked.map((v, i) => v ? i : -1).filter(i => i >= 0)}
          onChange={(i, v) => setEmpBChecked((p) => { const n = [...p]; n[i] = v; return n; })} />
        <NavRow onBack={() => setScreen("f3-type")}
          onNext={() => { nextDomain(updF({ empBItems: empBChecked })); }} />
      </Card>
    </Layout>
  );

  if (screen === "f3-disability") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card badge="תחום תעסוקתי">
        <p className="mb-1 font-semibold text-[#1a3a5c]">האם כבר פנית לביטוח לאומי בנושא?</p>
        <YesNo
          onYes={() => { nextDomain(updF({ disabilityNl: true })); }}
          onNo={() => { nextDomain(updF({ disabilityNl: false })); }} />
      </Card>
    </Layout>
  );

  // ═══════════════════════════════════════════════════════
  // RELATIONSHIP DOMAIN
  // ═══════════════════════════════════════════════════════

  if (screen === "r-intake") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card badge="זוגיות ומשפחה">
        <p className="mb-4 font-semibold text-[#1a3a5c]">כדי להתאים את השאלות, ענה/י על השאלות הבאות:</p>
        <div className="space-y-3">
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-[#ddd6c8] bg-white p-3 text-sm transition-all hover:border-[#2e7d8c]">
            <input type="checkbox" checked={inRelationship} onChange={(e) => { setInRelationship(e.target.checked); if (e.target.checked) setNoRelationship(false); }} className="h-4 w-4 accent-[var(--teal)]" />
            <span>אני <strong>בזוגיות</strong> כרגע</span>
          </label>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-[#ddd6c8] bg-white p-3 text-sm transition-all hover:border-[#2e7d8c]">
            <input type="checkbox" checked={hasChildren} onChange={(e) => setHasChildren(e.target.checked)} className="h-4 w-4 accent-[var(--teal)]" />
            <span>יש לי <strong>ילדים</strong></span>
          </label>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-[#ddd6c8] bg-white p-3 text-sm transition-all hover:border-[#2e7d8c]">
            <input type="checkbox" checked={noRelationship} onChange={(e) => { setNoRelationship(e.target.checked); if (e.target.checked) setInRelationship(false); }} className="h-4 w-4 accent-[var(--teal)]" />
            <span><strong>ללא זוגיות</strong> כרגע</span>
          </label>
        </div>
        <NavRow onBack={() => { setDomainIdx((p) => Math.max(0, p - 1)); setScreen("domains"); }}
          onNext={() => {
            // "ללא זוגיות כרגע" מתנהג כמו דילוג על שאלות הזוגיות — עובר למסלול היחיד/ה (r-single)
            if (noRelationship && !hasChildren) { setScreen("r-single"); }
            else if (inRelationship || hasChildren) { setScreen("r1"); }
            else { setScreen("r-single"); }
          }} />
      </Card>
    </Layout>
  );

  if (screen === "r-single") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card badge="זוגיות ומשפחה">
        <p className="mb-1 font-semibold text-[#1a3a5c]">האם את/ה מחפש/ת עזרה סביב <strong>דפוסים חוזרים בזוגיות</strong>, קושי ביצירת קשרים קרובים, או עיבוד פרידה / גירושין?</p>
        <YesNo
          onYes={() => { updR({ rSingle: true }); setScreen("r1"); }}
          onNo={() => { updR({ rSingle: false }); setScreen("r-single-no-detail"); }} />
      </Card>
    </Layout>
  );

  if (screen === "r-single-no-detail") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card badge="זוגיות ומשפחה">
        <p className="mb-3 font-semibold text-[#1a3a5c]">כמה כל אחד מהדברים הבאים מעניין אותך? (1=כלל לא, 5=מאוד)</p>
        <ScaleRow
          label="עזרה ממוקדת והדרכתית שנועדה לסייע להשגת זוגיות"
          values={[1, 2, 3, 4, 5]}
          value={rSingleCBTScale}
          onChange={setRSingleCBTScale}
        />
        <ScaleRow
          label="טיפול מעמיק שנועד להבין מכשולים ומורכבויות הנוגעות לתחום הזוגי"
          values={[1, 2, 3, 4, 5]}
          value={rSingleDynScale}
          onChange={setRSingleDynScale}
        />
        <NavRow
          onBack={() => setScreen("r-single")}
          onNext={() => {
            updR({ rSingleCBTScale, rSingleDynScale });
            setScreen("r1");
          }}
          nextDisabled={rSingleCBTScale === 0 || rSingleDynScale === 0}
        />
      </Card>
    </Layout>
  );

  if (screen === "r1") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card badge="זוגיות ומשפחה">
        <p className="mb-1 font-semibold text-[#1a3a5c]">האם יש <strong>קשיים בתפקוד המיני</strong>?</p>
        <YesNo
          onYes={() => {
            const a = updR({ r1: true, r1InRelationship: inRelationship });
            if (inRelationship) { setScreen("r-abuse"); }
            else if (hasChildren) { setScreen("r3-conflict"); }
            else { nextDomain(a); }
          }}
          onNo={() => {
            const a = updR({ r1: false, r1InRelationship: inRelationship });
            if (inRelationship) { setScreen("r-abuse"); }
            else if (hasChildren) { setScreen("r3-conflict"); }
            else { nextDomain(a); }
          }} />
      </Card>
    </Layout>
  );

  if (screen === "r-abuse") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card badge="זוגיות ומשפחה">
        <p className="mb-1 font-semibold text-[#1a3a5c]">האם חווית/חווה <strong>אלימות, הפחדות, או שליטה</strong> מצד בן/בת הזוג?</p>
        <YesNo
          onYes={() => {
            const a = updR({ rAbuse: true });
            if (hasChildren) { setScreen("r3-conflict"); } else { nextDomain(a); }
          }}
          onNo={() => { updR({ rAbuse: false }); setScreen("r1-scale"); }} />
      </Card>
    </Layout>
  );

  if (screen === "r1-scale") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card badge="זוגיות ומשפחה">
        <p className="mb-3 font-semibold text-[#1a3a5c]">עד כמה את/ה חווה קושי בזוגיות? (1=כלל לא, 7=קושי גדול מאוד)</p>
        <ScaleRow label="" group="couple" values={[1,2,3,4,5,6,7]} value={coupleScale} onChange={setCoupleScale} />
        <NavRow onBack={() => setScreen("r-abuse")}
          onNext={() => {
            const a = updR({ coupleScale, coupleInRelationship: true });
            if (coupleScale >= 4) { setScreen("r2-q"); }
            else if (hasChildren) { setScreen("r3-conflict"); }
            else { nextDomain(a); }
          }}
          nextDisabled={coupleScale === 0} />
      </Card>
    </Layout>
  );

  if (screen === "r2-q") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card badge="שאלון טיפול זוגי">
        <p className="mb-1 font-semibold text-[#1a3a5c]">דרג/י כל היגד מ-1 עד 7 עבור הזוגיות שלך:</p>
        <p className="mb-4 text-xs text-stone-500">1 = אין בכלל &nbsp;·&nbsp; 4 = במידה בינונית &nbsp;·&nbsp; 7 = הרבה מאוד</p>
        <p className="mb-2 text-sm font-bold text-[#2d7a4f]">EFT (ממוקד רגש):</p>
        {qItems.eft.map((item, i) => (
          <ScaleRow key={i} label={item} group={`eft-${i}`} values={[1,2,3,4,5,6,7]} value={eftScores[i]}
            onChange={(v) => setEftScores((p) => { const n = [...p]; n[i] = v; return n; })} />
        ))}
        <p className="mb-2 mt-2 text-sm font-bold text-[#2d7a4f]">דינאמי:</p>
        {qItems.dyn.map((item, i) => (
          <ScaleRow key={i} label={item} group={`dyn-${i}`} values={[1,2,3,4,5,6,7]} value={dynScores[i]}
            onChange={(v) => setDynScores((p) => { const n = [...p]; n[i] = v; return n; })} />
        ))}
        <p className="mb-2 mt-2 text-sm font-bold text-[#2d7a4f]">מבני:</p>
        {qItems.struct.map((item, i) => (
          <ScaleRow key={i} label={item} group={`str-${i}`} values={[1,2,3,4,5,6,7]} value={structScores[i]}
            onChange={(v) => setStructScores((p) => { const n = [...p]; n[i] = v; return n; })} />
        ))}
        <NavRow onBack={() => setScreen("r1-scale")}
          onNext={() => {
            const a = updR({ eftScores, dynScores, structScores });
            if (hasChildren) { setScreen("r3-conflict"); } else { nextDomain(a); }
          }}
          nextDisabled={!eftScores.some(s => s > 0) || !dynScores.some(s => s > 0) || !structScores.some(s => s > 0)} />
      </Card>
    </Layout>
  );

  // Family-conflict triplet merged into a single progressive-disclosure screen.
  // The follow-ups (r3AffectsAll, r3PartnerWilling) only reveal when the
  // preceding answer keeps them relevant, preserving the original branching
  // logic in questionnaire-score.ts.
  if (screen === "r3-conflict") {
    const r = answers.relationship ?? {};
    const conflict = r.r3Conflict;
    const affects = r.r3AffectsAll;
    const willing = r.r3PartnerWilling;
    const fullyAnswered =
      conflict === false ||
      (conflict === true && affects === false) ||
      (conflict === true && affects === true && willing !== undefined);
    return (
      <Layout screen={screen} domains={answers.domains}>
        <Card badge="זוגיות ומשפחה">
          <p className="mb-1 font-semibold text-[#1a3a5c]">האם יש <strong>קונפליקטים מתמשכים בתא המשפחתי</strong>?</p>
          <YesNo
            value={conflict}
            onYes={() => updR({ r3Conflict: true })}
            onNo={() => updR({ r3Conflict: false, r3AffectsAll: undefined, r3PartnerWilling: undefined })}
          />
          {conflict === true && (
            <div className="mt-5 pt-4 border-t border-dashed border-[#c8dce0]">
              <p className="mb-1 font-semibold text-[#1a3a5c]">האם הקושי משפיע על <strong>כלל בני המשפחה</strong>?</p>
              <YesNo
                value={affects}
                onYes={() => updR({ r3AffectsAll: true })}
                onNo={() => updR({ r3AffectsAll: false, r3PartnerWilling: undefined })}
              />
            </div>
          )}
          {conflict === true && affects === true && (
            <div className="mt-5 pt-4 border-t border-dashed border-[#c8dce0]">
              <p className="mb-1 font-semibold text-[#1a3a5c]">האם <strong>כולם מוכנים</strong> לשתף פעולה עם טיפול?</p>
              <YesNo
                value={willing}
                onYes={() => updR({ r3PartnerWilling: true })}
                onNo={() => updR({ r3PartnerWilling: false })}
              />
            </div>
          )}
          <NavRow
            onNext={() => setScreen("r3-child")}
            nextDisabled={!fullyAnswered}
          />
        </Card>
      </Layout>
    );
  }

  if (screen === "r3-child") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card badge="זוגיות ומשפחה">
        <p className="mb-1 font-semibold text-[#1a3a5c]">האם יש <strong>בעיות התנהגות, קשיים חברתיים, או קשיים רגשיים</strong> אצל הילד/ים?</p>
        <YesNo
          onYes={() => { updR({ r3ChildIssues: true }); setScreen("r3-child-type"); }}
          onNo={() => { nextDomain(updR({ r3ChildIssues: false })); }} />
      </Card>
    </Layout>
  );

  if (screen === "r3-child-type") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card badge="זוגיות ומשפחה">
        <p className="mb-3 font-semibold text-[#1a3a5c]">הקושי הוא בעיקר:</p>
        <div className="flex flex-col gap-3">
          <button type="button"
            onClick={() => { nextDomain(updR({ r3ChildType: "child" })); }}
            className="rounded-xl bg-[#2d7a4f] px-4 py-3 text-right text-sm font-bold text-white hover:bg-[#1f5a38]">
            אצל הילד עצמו (רגשי, התנהגותי, חברתי)
          </button>
          <button type="button"
            onClick={() => { nextDomain(updR({ r3ChildType: "family" })); }}
            className="rounded-xl bg-[#1a3a5c] px-4 py-3 text-right text-sm font-bold text-white hover:bg-[#0f2540]">
            בדינמיקה המשפחתית (יחסים בין בני המשפחה)
          </button>
        </div>
      </Card>
    </Layout>
  );

  // ═══════════════════════════════════════════════════════
  // ADDICTION DOMAIN
  // ═══════════════════════════════════════════════════════

  if (screen === "a-types") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card badge="קשיי התמכרות">
        <p className="mb-3 font-semibold text-[#1a3a5c]">בחר/י את סוגי ההתמכרות הרלוונטיים:</p>
        <div className="flex flex-col gap-2">
          {([
            ["substances","חומרים ממכרים (אלכוהול, סמים, תרופות)"],
            ["gaming","משחקי מחשב/וידאו"],
            ["porn","פורנוגרפיה / מין"],
            ["gambling","הימורים"],
            ["phone","טלפון סלולארי / רשתות חברתיות"],
          ] as const).map(([id, label]) => {
            const types = answers.addiction?.types ?? [];
            const sel = types.includes(id);
            return (
              <label key={id} className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 text-sm transition-all ${sel ? "border-[#2e7d8c] bg-[#e0f4fa]" : "border-[#ddd6c8] bg-white hover:border-[#2e7d8c]"}`}>
                <input type="checkbox" checked={sel}
                  onChange={(e) => updA({ types: e.target.checked ? [...types, id] : types.filter((t) => t !== id) })}
                  className="h-4 w-4 accent-[var(--teal)]" />
                {label}
              </label>
            );
          })}
        </div>
        <NavRow onBack={() => { setDomainIdx((p) => Math.max(0, p - 1)); setScreen("domains"); }}
          onNext={() => {
            const types = answers.addiction?.types ?? [];
            if (types.length === 0) { nextDomain(); return; }
            setAddictionIdx(0);
            setScreen(addictionScreen(types[0]));
          }}
          nextDisabled={(answers.addiction?.types ?? []).length === 0} />
      </Card>
    </Layout>
  );

  if (screen === "a-substances") {
    const SUB_ITEMS = [
      "שימוש בכמויות גדולות יותר או לפרק זמן ארוך מהמתוכנן.",
      "רצון או ניסיונות כושלים להפסיק או לצמצם את השימוש.",
      "השקעת זמן מרובה בהשגת החומר, שימוש בו, או החלמה מהשפעותיו.",
      "תשוקה עזה או דחף לשימוש בחומר.",
      "כישלון בעמידה בהתחייבויות בעבודה, בבית הספר או בבית עקב השימוש.",
      "המשך השימוש למרות בעיות חברתיות או בין-אישיות שנגרמות כתוצאה מהשימוש.",
      "ויתור על פעילויות חברתיות, מקצועיות או פנאי בשל השימוש.",
      "שימוש חוזר בסיטואציות שבהן הדבר מסוכן פיזית.",
      "המשך השימוש למרות הידיעה שיש בעיה פיזית או פסיכולוגית שהחומר מחמיר.",
      "יש צורך במנות גדולות יותר כדי להשיג את אותו אפקט, או אפקט מופחת משימוש במנה קבועה.",
      "תסמיני גמילה: הופעת תסמינים פיזיים או נפשיים כאשר מפסיקים את השימוש או מצמצמים אותו.",
    ];
    return (
      <Layout screen={screen} domains={answers.domains}>
        <Card badge="שאלון חומרים ממכרים">
          <p className="mb-3 font-semibold text-[#1a3a5c]">סמן/י כן לתסמינים הרלוונטיים:</p>
          <CheckList items={SUB_ITEMS} checked={substanceChecked}
            onChange={(i,v) => setSubstanceChecked((p) => v ? [...p,i] : p.filter((x) => x !== i))} />
          <NavRow onBack={() => setScreen("a-types")} onNext={() => { nextAddiction(updA({ substanceCount: substanceChecked.length })); }} />
        </Card>
      </Layout>
    );
  }

  if (screen === "a-gaming") {
    const GAME_ITEMS = [
      "עיסוק יתר במשחקי מחשב: חושב/ת כל הזמן על משחקים, גם כאשר אינך משחק/ת.",
      "תסמיני גמילה: תסמינים כמו עצבנות, חרדה או כעס כשאין גישה למשחקים.",
      "צורך לשחק במשך יותר ויותר זמן: יש צורך לשחק זמן רב יותר כדי להשיג את אותה הנאה.",
      "ניסיונות כושלים להפסיק או לצמצם את זמן המשחק.",
      "הזנחת פעילויות אחרות: הזנחה של חיי חברה, לימודים או עבודה בשל משחק יתר.",
      "המשך המשחק למרות בעיות: משחק למרות הידיעה שהוא גורם לבעיות פיזיות, חברתיות או נפשיות.",
      "שקרים להסתיר את מידת המשחק: שקרים להורים, מורים או חברים כדי להסתיר את הזמן המושקע במשחקים.",
      "שימוש במשחקים כדי לברוח מרגשות שליליים: משחק כדי לברוח מתחושות של חוסר אונים, אשמה או חרדה.",
      "סיכון בקשרים או הזדמנויות בשל המשחק: סיכון של קשרים חשובים או הזדמנויות חינוכיות או מקצועיות בשל משחקים.",
    ];
    return (
      <Layout screen={screen} domains={answers.domains}>
        <Card badge="שאלון התמכרות למשחקים">
          <p className="mb-3 font-semibold text-[#1a3a5c]">סמן/י כן לתסמינים הרלוונטיים:</p>
          <CheckList items={GAME_ITEMS} checked={gamingChecked}
            onChange={(i,v) => setGamingChecked((p) => v ? [...p,i] : p.filter((x) => x !== i))} />
          <NavRow onBack={() => setScreen("a-types")} onNext={() => { nextAddiction(updA({ gamingCount: gamingChecked.length })); }} />
        </Card>
      </Layout>
    );
  }

  if (screen === "a-porn-type") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card badge="קשיי התמכרות">
        <p className="mb-3 font-semibold text-[#1a3a5c]">מה הקושי הספציפי?</p>
        <div className="flex gap-3">
          <button type="button" onClick={() => { updA({ pornType: "porn" }); setScreen("a-porn-q"); }}
            className="flex-1 rounded-xl border-2 border-[#ddd6c8] bg-white py-3 text-sm font-bold hover:border-[#2e7d8c]">פורנוגרפיה</button>
          <button type="button" onClick={() => { updA({ pornType: "sex" }); setScreen("a-sex-q"); }}
            className="flex-1 rounded-xl border-2 border-[#ddd6c8] bg-white py-3 text-sm font-bold hover:border-[#2e7d8c]">מין / יחסי מין</button>
        </div>
      </Card>
    </Layout>
  );

  if (screen === "a-porn-q") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card badge="שאלון פורנוגרפיה">
        <p className="mb-3 font-semibold text-[#1a3a5c]">עד כמה כל היגד מתאר אותך? (1=כלל לא, 7=מאוד)</p>
        {qItems.porn.map((item, i) => (
          <ScaleRow key={i} label={item} group={`porn-${i}`} values={[1,2,3,4,5,6,7]} value={pornScores[i]}
            onChange={(v) => setPornScores((p) => { const n = [...p]; n[i] = v; return n; })} />
        ))}
        <NavRow onBack={() => setScreen("a-porn-type")} onNext={() => { nextAddiction(updA({ pornScores })); }} />
      </Card>
    </Layout>
  );

  if (screen === "a-sex-q") {
    const SAST_ITEMS = [
      "האם לעיתים קרובות את/ה מוצא/ת את עצמך עסוק/ה במחשבות, דחפים או התנהגויות מיניות באופן שמפריע לך?",
      "האם ניסית להפחית או להפסיק התנהגות מינית מסוימת, אך לא הצלחת לאורך זמן?",
      'האם את/ה מרגיש/ה לפעמים שהדחף המיני "חזק ממך" או שולט בך?',
      "האם ההתנהגות המינית שלך גרמה לקשיים בזוגיות, במשפחה, בעבודה, בלימודים או בתחומים חשובים אחרים?",
      "האם את/ה מסתיר/ה מאחרים חלק מההתנהגויות המיניות שלך או חושש/ת שיגלו עליהן?",
      "האם הרגשת בושה, אשמה, עצב או ירידה במצב הרוח בעקבות ההתנהגות המינית שלך?",
      "האם את/ה משתמש/ת בהתנהגות מינית כדרך לברוח ממתח, בדידות, חרדה, עצב או בעיות אחרות?",
      "האם אדם קרוב העיר לך, דאג או התלונן על ההתנהגות המינית שלך?",
      "האם הייתה מעורבות בהתנהגות מינית שעלולה להיות לא חוקית, פוגענית, מסכנת או מערבת אדם שאינו יכול להסכים באופן חופשי ובוגר?",
    ];
    return (
      <Layout screen={screen} domains={answers.domains}>
        <Card badge="שאלון קשיים בשליטה בהתנהגות מינית">
          <p className="mb-3 font-semibold text-[#1a3a5c]">סמן/י כן לכל היגד שמתאר אותך:</p>
          <CheckList items={SAST_ITEMS} checked={sastChecked}
            onChange={(i,v) => setSastChecked((p) => v ? [...p,i] : p.filter((x) => x !== i))} />
          <NavRow onBack={() => setScreen("a-porn-type")} onNext={() => { nextAddiction(updA({ sastCount: sastChecked.length })); }} />
        </Card>
      </Layout>
    );
  }

  if (screen === "a-gambling") {
    const GAMBLE_ITEMS = [
      "עיסוק יתר בהימורים – מחשבות מתמשכות על הימורים (למשל, תכנון הימורים עתידיים, חשיבה על דרכים להשיג כסף להימורים).",
      "צורך להמר בסכומים הולכים וגדלים כדי להשיג את אותו ריגוש.",
      "ניסיונות כושלים לחתוך או להפסיק את ההימורים – חוסר יכולת לשלוט בהרגלי ההימורים למרות ניסיונות חוזרים להפסיק.",
      "תחושת אי-שקט או עצבנות כשמנסים לצמצם את ההימורים.",
      "הימור כדרך לברוח מבעיות או כדי להקל על מצב רגשי שלילי (כגון תחושת אשמה, חרדה, דיכאון).",
      'חזרה להמר אחרי הפסדים – ניסיון "להחזיר" את הכסף שאבד באמצעות הימורים נוספים (תופעה שמכונה "ריצה אחרי הפסדים").',
      "שקרים על מידת ההימורים – שקרים לבני משפחה, חברים או מטפלים כדי להסתיר את היקף ההימורים.",
      "סיכון בקשרים אישיים, עבודה או לימודים – פגיעה במערכות יחסים, תעסוקה או הזדמנויות לימודיות כתוצאה מהימורים.",
      "הסתמכות על אחרים לסיוע כלכלי – פנייה לאנשים אחרים כדי להשיג כסף ולחלץ את עצמך ממצב כלכלי שנגרם כתוצאה מההימורים.",
    ];
    return (
      <Layout screen={screen} domains={answers.domains}>
        <Card badge="שאלון הימורים">
          <p className="mb-3 font-semibold text-[#1a3a5c]">סמן/י כן לכל היגד שמתאר אותך:</p>
          <CheckList items={GAMBLE_ITEMS} checked={gamblingChecked}
            onChange={(i,v) => setGamblingChecked((p) => v ? [...p,i] : p.filter((x) => x !== i))} />
          <NavRow onBack={() => setScreen("a-types")} onNext={() => { nextAddiction(updA({ gamblingYes: gamblingChecked.length })); }} />
        </Card>
      </Layout>
    );
  }

  if (screen === "a-phone") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card badge="שאלון טלפון סלולארי">
        <p className="mb-3 font-semibold text-[#1a3a5c]">עד כמה כל היגד מתאר אותך? (1=לא מסכים/ה, 6=מסכים/ה מאוד)</p>
        {qItems.phone.map((item, i) => (
          <ScaleRow key={i} label={item} group={`phone-${i}`} values={[1,2,3,4,5,6]} value={phoneScores[i]}
            onChange={(v) => setPhoneScores((p) => { const n = [...p]; n[i] = v; return n; })} />
        ))}
        <NavRow onBack={() => setScreen("a-types")} onNext={() => { nextAddiction(updA({ phoneScores })); }} />
      </Card>
    </Layout>
  );

  // ═══════════════════════════════════════════════════════
  // SCORING / RESULTS
  // ═══════════════════════════════════════════════════════

  if (screen === "scoring") return (
    <Layout screen={screen} domains={answers.domains}>
      <Card>
        <div className="py-8 text-center">
          <div className="mb-3 text-4xl">⏳</div>
          <p className="font-semibold text-[#1a3a5c]">מעבד תשובות...</p>
        </div>
      </Card>
    </Layout>
  );

  if (screen === "results") {
    const recs = scoring?.recommendations ?? [];
    const groups = recommendationGroups;
    const multipleGroups = groups.filter((g) => !g.urgent).length > 1;
    const emotionalGroups = combinableEmotionalGroups;
    const showCombined = emotionalGroups.length >= 2;
    const relationshipGroups = combinableRelationshipGroups;
    const showRelationshipCombined = relationshipGroups.length >= 2;

    // Group the result cards into rubric sections so each domain is visually
    // separate. The combined-search buttons live inside their respective domain
    // section only and never mix domains.
    const EMOTIONAL_DOMAIN = "מורכבויות בתחום הרגשי/האישי";
    const RELATIONSHIP_DOMAIN = "זוגיות ומשפחה";
    const DOMAIN_SECTIONS: { key: string; label: string }[] = [
      { key: EMOTIONAL_DOMAIN, label: "🧠 התחום הרגשי" },
      { key: "זוגיות ומשפחה", label: "💑 זוגיות ומשפחה" },
      { key: "קשיי התמכרות", label: "🧩 התמכרויות" },
      { key: "סימני שאלה לגבי התחומים התפקודיים, התעסוקתיים או האקדמאיים", label: "📚 תחום תפקודי / תעסוקתי / אקדמי" },
      { key: "התפתחות אישית", label: "🌱 התפתחות אישית" },
    ];
    const sections: { key: string; label: string; groups: RecGroup[] }[] = [];
    const seenDomains = new Set<string>();
    for (const d of DOMAIN_SECTIONS) {
      const gs = groups.filter((g) => (g.recs[0]?.domain ?? "") === d.key);
      if (gs.length) { sections.push({ ...d, groups: gs }); seenDomains.add(d.key); }
    }
    // Append any domains not in the known list so nothing is ever dropped.
    for (const g of groups) {
      const dom = g.recs[0]?.domain ?? "אחר";
      if (seenDomains.has(dom)) continue;
      seenDomains.add(dom);
      sections.push({ key: dom, label: dom, groups: groups.filter((x) => (x.recs[0]?.domain ?? "אחר") === dom) });
    }

    const renderGroupCard = (group: RecGroup) => {
      const firstRec = group.recs[0];
      const allNotes = Array.from(new Set(group.recs.map((r) => r.notes).filter(Boolean) as string[]));
      const notes = allNotes.length ? allNotes.join("\n\n") : undefined;
      const allTools = group.recs
        .filter((r) => r.tools)
        .map((r) => (group.recs.length > 1 ? `▸ ${r.symptomText}\n${r.tools}` : r.tools));
      const tools = allTools.length ? allTools.join("\n\n――――――\n\n") : undefined;
      const key = group.treatment + (group.urgent ? "-urgent" : "");
      const aiData = recExplainData[key];
      const aiLoading = recExplainLoading[key];
      const article = getTreatmentArticle(group.treatment);
      const articleHref = getTreatmentArticleHref(group.treatment);
      const accent = group.urgent ? "border-red-300 bg-red-50" : "border-[var(--teal-mid)] bg-white";
      return (
        <div key={key} className={`rounded-2xl border p-5 mb-3 ${accent}`}>
          {group.urgent && (
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-red-700">⚠️ דחוף</div>
          )}
          {group.recs.length === 1 ? (
            <p className="font-semibold text-[#1a2a3a] text-sm leading-relaxed">{firstRec.symptomText}</p>
          ) : (
            <ul className="space-y-1">
              {group.recs.map((r) => (
                <li key={r.id} className="flex items-start gap-2 text-sm font-semibold text-[#1a2a3a] leading-relaxed">
                  <span className="mt-1 text-[var(--teal)]">•</span>{r.symptomText}
                </li>
              ))}
            </ul>
          )}
          {notes && <div className="mt-2 text-xs text-gray-500 leading-relaxed">{notes}</div>}
          {tools && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">🛠 כלים להתמודדות</div>
              <div className="whitespace-pre-wrap text-xs leading-relaxed text-amber-900">{tools}</div>
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => { setSelectedRec(firstRec); setCombinedTreatments(null); setScreen("match-form"); trackMatchingClick("adults", group.treatment); }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--teal-dark)] hover:bg-[var(--teal)] px-4 py-2 text-sm font-bold text-white transition-colors"
            >
              🔍 מצא/י לי מטפל — {group.treatmentLabel} ←
            </button>
            <button
              type="button"
              onClick={() => fetchRecommendationExplanation(group)}
              disabled={aiLoading}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white shadow-sm bg-gradient-to-r from-violet-500 via-fuchsia-500 to-rose-400 hover:opacity-90 transition-all disabled:opacity-60"
            >
              {aiLoading ? "טוען..." : "✦ למה הוצע לי?"}
            </button>
          </div>
          {aiData && (
            <div className="mt-3 rounded-xl border border-purple-200 bg-purple-50 p-3">
              <p className="text-xs font-bold text-purple-800 mb-2">✦ {aiData.title}</p>
              <p className="text-xs text-purple-900 mb-2 leading-relaxed whitespace-pre-line">{aiData.explanation}</p>
              <p className="text-[10px] text-purple-500 mb-3">{aiData.evidence_note}</p>
              {articleHref ? (
                <a href={articleHref} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--teal-dark)] hover:underline">
                  📖 קרא עוד על {group.treatmentLabel} ←
                </a>
              ) : article.status === "pending" && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400">
                  📖 מאמר בהכנה
                </span>
              )}
            </div>
          )}
        </div>
      );
    };

    const renderCombinedButton = () => (
      <button
        type="button"
        onClick={() => {
          setCombinedTreatments(emotionalGroups.map(g => g.treatment));
          setCombinedLabels(emotionalGroups.map(g => g.treatmentLabel));
          setCombinedCouplesModality(undefined);
          setCombinedNeedsSexualTherapy(false);
          setSelectedRec(null);
          setScreen("match-form");
          trackMatchingClick("adults", "combined_emotional");
        }}
        className="mt-3 w-full rounded-2xl p-4 text-right transition hover:opacity-95"
        style={{ background: "linear-gradient(120deg, var(--teal-dark), var(--teal))", border: "1px solid #5AADAB" }}
      >
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#C2DFDE]">חיפוש מתקדם ✦</div>
        <div className="font-bold text-sm text-white">חפש/י מטפל שמשלב את הגישות הרגשיות ←</div>
        <div className="mt-1 text-xs text-white/75">החיפוש המשולב מתייחס לתחום הרגשי בלבד — טיפול זוגי/התמכרות מטופלים בנפרד. כולל: {emotionalGroups.map(g => g.treatmentLabel).join(", ")}</div>
      </button>
    );

    const renderCombinedRelationshipButton = () => (
      <button
        type="button"
        onClick={() => {
          const modality = relationshipGroups.find(g => g.recs[0]?.couplesModality)?.recs[0]?.couplesModality;
          const needsSexual = relationshipGroups.some(g => g.recs.some(r => r.treatment === "טיפול מיני"));
          setCombinedTreatments(relationshipGroups.map(g => g.treatment));
          setCombinedLabels(relationshipGroups.map(g => g.treatmentLabel));
          setCombinedCouplesModality(modality);
          setCombinedNeedsSexualTherapy(needsSexual);
          setSelectedRec(null);
          setScreen("match-form");
          trackMatchingClick("adults", "combined_relationship");
        }}
        className="mt-3 w-full rounded-2xl p-4 text-right transition hover:opacity-95"
        style={{ background: "linear-gradient(120deg, var(--gold-dark), var(--gold))", border: "1px solid #C8961A" }}
      >
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#FDF6E3]">חיפוש מתקדם ✦</div>
        <div className="font-bold text-sm text-white">חפש/י מטפל שמשלב תחומים בטיפול הזוגי ←</div>
        <div className="mt-1 text-xs text-white/75">כולל: {relationshipGroups.map(g => g.treatmentLabel).join(", ")}</div>
      </button>
    );

    return (
      <Layout screen={screen} domains={answers.domains}>
        <div id="adults-results-card">
          {/* Logo */}
          <div className="mb-4 flex justify-center">
            <img src="/logo-temp.png" alt="טיפול חכם" style={{ height: "46px", width: "auto" }} />
          </div>

          {/* Summary + demographics + "what now?" */}
          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 mb-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--teal-dark)] mb-2">סיכום שאלון</p>
            <h2 className="text-xl font-bold text-[#1a2a3a] mb-4">דוח ממצאים</h2>
            <div className="bg-gray-50 rounded-xl p-4 mb-4 text-sm space-y-1.5 text-[#2a3a4a]">
              <div className="flex justify-between">
                <span className="font-semibold">גיל:</span>
                <span>{answers.age || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">מגדר:</span>
                <span>{answers.gender || "—"}</span>
              </div>
              <div className="pt-1 border-t border-gray-200">
                <div className="font-semibold mb-1">תחומי קושי שסומנו:</div>
                {answers.domains.map(d => (
                  <div key={d} className="flex justify-between">
                    <span>{({
                      emotional: "מורכבויות בתחום הרגשי/האישי",
                      functional: "תחומים תפקודיים / תעסוקתיים / אקדמאיים",
                      relationship: "זוגיות ומשפחה",
                      addiction: "קשיי התמכרות",
                      personal_development: "התפתחות אישית",
                    } as Record<string, string>)[d] ?? d}</span>
                  </div>
                ))}
              </div>
            </div>
            {recs.length > 0 && (
              <div className="rounded-2xl border p-5" style={{ background: "var(--teal-pale)", borderColor: "var(--teal-mid)" }}>
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--teal-dark)]">מה עכשיו?</p>
                <div className="flex flex-col gap-2.5 text-sm text-[#2a3a4a]">
                  <div className="flex items-start gap-2.5">
                    <span className="flex-shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-[var(--teal-dark)] border border-[var(--teal-mid)]">1</span>
                    <span>קרא/י את הממצאים למטה</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex-shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-[var(--teal-dark)] border border-[var(--teal-mid)]">2</span>
                    <span>לחץ/י על "מצא/י לי מטפל" בממצא הרלוונטי ביותר עבורך</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex-shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-[var(--teal-dark)] border border-[var(--teal-mid)]">3</span>
                    <span>לחלופין — חפש/י מטפל שמשלב כמה גישות בכפתור שבתחתית</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Alerts */}
          {err && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-5 text-center">
              <p className="font-bold text-red-900 mb-1">אירעה תקלה זמנית בחישוב התוצאות</p>
              <p className="text-sm text-red-700 mb-4">התשובות שלך נשמרו — אפשר לנסות שוב, לא ייגבה תשלום נוסף.</p>
              <button
                type="button"
                onClick={() => goScoring()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 transition-colors"
              >
                🔄 נסה/י שוב
              </button>
            </div>
          )}
          {(answers.emotional?.moodSuicidal || answers.emotional?.prodromeSuicidal || answers.emotional?.maniaDeath || answers.emotional?.traumaSuicidal) && (
            <CrisisResources className="mb-4" />
          )}
          {(() => {
            const bmi = answers.bmi;
            if (bmi == null || (bmi >= 18.5 && bmi <= 24.9)) return null;
            const severe = bmi < 16.5;
            const under = bmi < 18.5;
            const cat = under ? "תת-משקל" : bmi < 30 ? "עודף משקל" : "השמנה";
            const cls = severe ? "border-red-300 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900";
            const msg = severe
              ? `ה-BMI שדיווחת עליו (${bmi.toFixed(1)} — ${cat}) נמוך באופן משמעותי. מעבר לטיפול הנפשי, חשוב לפנות בהקדם לבירור רפואי אצל רופא/ת המשפחה.`
              : under
                ? `ה-BMI שדיווחת עליו (${bmi.toFixed(1)} — ${cat}) מתחת לטווח התקין. לצד הטיפול הנפשי, שווה בירור אצל רופא/ת המשפחה.`
                : `ה-BMI שדיווחת עליו (${bmi.toFixed(1)} — ${cat}) מעל הטווח התקין. אם רלוונטי, ליווי תזונתי/רפואי עשוי לתמוך — אין באמור משום אבחנה.`;
            return (
              <div className={`mb-4 rounded-xl border p-4 text-sm leading-relaxed ${cls}`}>
                ⚕️ {msg}
              </div>
            );
          })()}
          {multipleGroups && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
              📌 שים/י לב: נמצאו מספר סימנים עם הפניות שונות. המערכת סיננה את הפחות דחופות כך שבפניך מופיעות ההפניות העיקריות. יש לפנות ע"פ הקושי המשמעותי ביותר שאת/ה חווה.
            </div>
          )}

          {/* No results */}
          {!err && recs.length === 0 && (
            <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 mb-4 space-y-3">
              <p className="font-bold text-[#1a2a3a]">לא נמצאו ממצאים מובהקים בשאלון.</p>
              <p className="text-sm text-gray-600">מומלץ לפנות לטיפול פסיכודינאמי לצורך עיבוד והבנת הקשיים.</p>
              <button
                type="button"
                onClick={() => {
                  setSelectedRec({ id: "default", symptomText: "לא נמצאו ממצאים מובהקים", treatment: "טיפול דינאמי", treatmentLabel: "טיפול דינאמי", domain: "מורכבויות בתחום הרגשי/האישי", urgent: false });
                  setCombinedTreatments(null);
                  setScreen("match-form");
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--teal-dark)] px-3 py-2 text-xs font-bold text-white hover:bg-[var(--teal)] transition-colors"
              >
                🔍 חיפוש מטפל/ת לטיפול דינאמי
              </button>
            </div>
          )}

          {/* Domain sections */}
          {sections.map((section) => (
            <section key={section.key} className="mt-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-sm font-bold text-[var(--teal-dark)] px-3 py-1 rounded-full bg-[var(--teal-pale)] border border-[var(--teal-mid)] whitespace-nowrap">
                  {section.label}
                </span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>
              <div className="space-y-3">
                {section.groups.map((group) => renderGroupCard(group))}
              </div>
              {section.key === EMOTIONAL_DOMAIN && showCombined && renderCombinedButton()}
              {section.key === RELATIONSHIP_DOMAIN && showRelationshipCombined && renderCombinedRelationshipButton()}
            </section>
          ))}

          {/* Disclaimer */}
          <div className="mt-6 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-xs leading-6 text-stone-500">
            התוצאות מבוססות על תשובותיך לשאלון ומהוות הערכה כללית בלבד.<br />
            אין לראות בתוצאות אלו אבחון, המלצה טיפולית מחייבת או תחליף לייעוץ מקצועי.<br />
            מומלץ לפנות לאיש מקצוע מוסמך לצורך הערכה מלאה.
          </div>
          <p className="mt-3 text-center text-xs text-gray-400">טיפול חכם</p>

          {/* Actions */}
          <div className="mt-4 flex gap-3 justify-end print:hidden" data-html2canvas-ignore="true">
            <button
              onClick={() => downloadResultsPDF("adults-results-card", "תוצאות-השאלון", "#ffffff")}
              id="adults-download-pdf-btn"
              className="px-5 py-2 rounded-xl border-2 border-[var(--teal)] text-[var(--teal)] text-sm font-semibold hover:bg-[var(--teal)] hover:text-white transition-all disabled:opacity-60"
            >
              💾 שמירה כ-PDF
            </button>
          </div>

          {/* Anonymous feedback — why did you stop / what was unclear */}
          <div className="print:hidden" data-html2canvas-ignore="true">
            <QuizFeedbackBox quizType="adults" />
          </div>
        </div>
      </Layout>
    );
  }

  if (screen === "match-form") return (
    <Layout screen={screen} domains={answers.domains}>
      <RecommendationsStrip
        groups={recommendationGroups}
        combinableGroups={combinableEmotionalGroups}
        activeTreatment={selectedRec?.treatment ?? null}
        isCombinedActive={!!combinedTreatments}
        onSelectGroup={(treatment) => {
          const g = recommendationGroups.find(r => r.treatment === treatment);
          if (!g) return;
          setSelectedRec(g.recs[0]);
          setCombinedTreatments(null);
          setCombinedLabels(null);
          setMatchResults(null);
        }}
        onSelectCombined={() => {
          setCombinedTreatments(combinableEmotionalGroups.map(g => g.treatment));
          setCombinedLabels(combinableEmotionalGroups.map(g => g.treatmentLabel));
          setSelectedRec(null);
          setMatchResults(null);
        }}
        onBack={() => {
          setScreen("results");
          setCombinedTreatments(null);
          setCombinedLabels(null);
        }}
      />
      <Card badge="חיפוש מטפל">
        {combinedTreatments ? (
          <>
            <p className="mb-1 font-semibold text-[#1a3a5c]">חיפוש משולב — <span className="text-[#2e7d8c]">כל הצרכים הרגשיים</span></p>
            <p className="mb-4 text-xs text-[#6b7280]">מחפש מטפל שמכסה את מירב הטיפולים המומלצים: {(combinedLabels ?? combinedTreatments).join(", ")}</p>
          </>
        ) : (
          <>
            <p className="mb-1 font-semibold text-[#1a3a5c]">חיפוש מטפל עבור: <span className="text-[#2e7d8c]">{selectedRec?.treatmentLabel}</span></p>
            <p className="mb-4 text-xs text-[#6b7280]">{selectedRec?.symptomText}</p>
          </>
        )}

        <div className="mb-3">
          <label className="mb-1 block text-xs text-[#6b7280]">אזור גיאוגרפי</label>
          <select value={matchPrefs.region} onChange={(e) => setMatchPrefs((p) => ({ ...p, region: e.target.value, city: "" }))}
            className="w-full rounded-lg border-2 border-[#ddd6c8] px-3 py-2 text-sm focus:border-[#2e7d8c] focus:outline-none mb-2">
            <option value="">בחר אזור</option>
            {Object.keys(REGION_CITIES).map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          {matchPrefs.region && (
            <>
              <label className="mb-1 block text-xs text-[#6b7280]">עיר</label>
              <select value={matchPrefs.city} onChange={(e) => setMatchPrefs((p) => ({ ...p, city: e.target.value }))}
                className="w-full rounded-lg border-2 border-[#ddd6c8] px-3 py-2 text-sm focus:border-[#2e7d8c] focus:outline-none">
                <option value="">כל הערים באזור</option>
                {(REGION_CITIES[matchPrefs.region] ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </>
          )}
        </div>

        <label className="mb-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={matchPrefs.online} onChange={(e) => setMatchPrefs((p) => ({ ...p, online: e.target.checked }))} className="accent-[var(--teal)]" />
          פתוח/ה גם לטיפול אונליין
        </label>

        <div className="mb-3">
          <label className="mb-1 block text-xs text-[#6b7280]">העדפת מגדר מטפל</label>
          <select value={matchPrefs.genderPref} onChange={(e) => setMatchPrefs((p) => ({ ...p, genderPref: e.target.value }))}
            className="w-full rounded-lg border-2 border-[#ddd6c8] px-3 py-2 text-sm focus:border-[#2e7d8c] focus:outline-none">
            <option value="">ללא העדפה</option>
            <option value="זכר">זכר</option>
            <option value="נקבה">נקבה</option>
          </select>
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-xs text-[#6b7280]">שפת הטיפול</label>
          <select value={matchPrefs.language} onChange={(e) => setMatchPrefs((p) => ({ ...p, language: e.target.value }))}
            className="w-full rounded-lg border-2 border-[#ddd6c8] px-3 py-2 text-sm focus:border-[#2e7d8c] focus:outline-none">
            {["עברית","אנגלית","ערבית","רוסית","צרפתית","ספרדית","פורטוגזית","אמהרית"].map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <div className="mb-3">
          <p className="mb-1 text-xs text-[#6b7280]">מימון הטיפול (אפשר לסמן יותר מאחד)</p>
          {["קופות החולים", "ביטוח לאומי", "משרד הביטחון", "ביטוחים פרטיים"].map((arr) => (
            <label key={arr} className="mb-1 flex items-center gap-2 text-sm">
              <input type="checkbox"
                checked={matchPrefs.arrangements.includes(arr)}
                onChange={(e) => setMatchPrefs((p) => ({ ...p, arrangements: e.target.checked ? [...p.arrangements, arr] : p.arrangements.filter((x) => x !== arr) }))}
                className="accent-[var(--teal)]" />
              {arr}
            </label>
          ))}
        </div>

        <div className="mb-3">
          <p className="mb-1 text-xs text-[#6b7280]">העדפות תרבותיות</p>
          {qItems.culturalPrefs.map((cp) => (
            <label key={cp} className="mb-1 flex items-center gap-2 text-sm">
              <input type="checkbox"
                checked={matchPrefs.culturalPrefs.includes(cp)}
                onChange={(e) => setMatchPrefs((p) => ({ ...p, culturalPrefs: e.target.checked ? [...p.culturalPrefs, cp] : p.culturalPrefs.filter((x) => x !== cp) }))}
                className="accent-[var(--teal)]" />
              {cp}
            </label>
          ))}
        </div>

        {err && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</p>}

        <NavRow onBack={() => { setScreen("results"); setCombinedTreatments(null); setCombinedLabels(null); }}
          onNext={doMatch}
          nextLabel={loading ? "מחפש..." : "חפש/י מטפל ←"}
          nextDisabled={loading} />
      </Card>
    </Layout>
  );

  if (screen === "match-results") return (
    <Layout screen={screen} domains={answers.domains}>
      <RecommendationsStrip
        groups={recommendationGroups}
        combinableGroups={combinableEmotionalGroups}
        activeTreatment={selectedRec?.treatment ?? null}
        isCombinedActive={!!combinedTreatments}
        onSelectGroup={(treatment) => {
          const g = recommendationGroups.find(r => r.treatment === treatment);
          if (!g) return;
          setSelectedRec(g.recs[0]);
          setCombinedTreatments(null);
          setCombinedLabels(null);
          setMatchResults(null);
          setScreen("match-form");
        }}
        onSelectCombined={() => {
          setCombinedTreatments(combinableEmotionalGroups.map(g => g.treatment));
          setCombinedLabels(combinableEmotionalGroups.map(g => g.treatmentLabel));
          setSelectedRec(null);
          setMatchResults(null);
          setScreen("match-form");
        }}
        onBack={() => {
          setScreen("results");
          setCombinedTreatments(null);
          setCombinedLabels(null);
        }}
      />
      <h2 className="mb-4 text-xl font-bold text-[#1a3a5c]">מטפלים מומלצים – {selectedRec?.treatmentLabel ?? "חיפוש משולב"}</h2>
      {err && <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      {(matchResults ?? []).length === 0 && (
        <div className="rounded-2xl bg-white p-6 text-center text-sm text-[#6b7280] shadow">לא נמצאו מטפלים מתאימים. נסה/י לשנות את הפרמטרים.</div>
      )}
      {addictionCbtFallback && (matchResults ?? []).length > 0 && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800" dir="rtl">
          <strong>שימו לב:</strong> לא נמצאו מטפלים המתמחים ספציפית בהתמכרויות. המטפלים המוצגים מתאימים מבחינת פרמטרים אחרים. מומלץ לשקול גם פנייה למטפל/ת CBT (טיפול קוגניטיבי-התנהגותי), שהוכח כיעיל בטיפול בהתמכרויות.
        </div>
      )}
      <div className="space-y-4">
        {(matchResults ?? []).map((t: any) => {
          const overall = t.combined_score ?? t.match_score;
          const pref = selectedRec?.couplesModality ?? combinedCouplesModality;
          const tMods = Array.isArray(t.couples_modalities) ? t.couples_modalities : [];
          const matchesPref = pref && tMods.some((m: string) => String(m).trim().toLowerCase() === String(pref).trim().toLowerCase());
          return (
            <div
              key={t.id}
              className="rounded-[18px] border border-[var(--line)] bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-stretch gap-4">
                <img
                  src={t.profile_photo_url || (t.gender === "נקבה" ? "/avatar-female.svg" : "/avatar-male.svg")}
                  alt={t.full_name ?? ""}
                  className="h-[78px] w-[78px] flex-shrink-0 self-start rounded-2xl object-cover"
                />
                <div className="min-w-0 flex-1 text-right">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-extrabold text-[var(--text)]">{t.full_name || "ללא שם"}</h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--teal-pale)] px-2.5 py-0.5 text-[12px] font-bold text-[var(--teal-dark)]">✓ מאומת</span>
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">{t.gender} • {t.online ? "אונליין" : "פנים אל פנים"}</p>
                  {t.bio && <p className="mt-1.5 line-clamp-2 text-sm text-[var(--text-2)]">{t.bio}</p>}
                  {t.regions?.length > 0 && (
                    <p className="mt-1.5 text-xs text-[var(--muted)]">📍 {(Array.isArray(t.regions) ? t.regions : [t.regions]).join(", ")}</p>
                  )}
                  {matchesPref && (
                    <div className="mt-2 inline-block rounded-full border border-[var(--teal-mid)] bg-[var(--teal-pale)] px-3 py-1 text-xs font-semibold text-[var(--teal-dark)]">
                      ✓ עובד/ת בגישת {pref} שהותאמה לך
                    </div>
                  )}
                </div>
                <div className="flex w-[110px] flex-shrink-0 flex-col items-center justify-center rounded-2xl bg-[var(--teal-pale)] px-2 py-3 text-center">
                  <div className="text-[2.4rem] font-black leading-none tracking-tight text-[var(--teal-dark)]">
                    {overall}<span className="align-super text-base font-extrabold">%</span>
                  </div>
                  <div className="mt-1 text-[10.5px] font-bold text-[var(--teal)]">{t.personality_score != null ? "התאמה כוללת" : "התאמה"}</div>
                  {t.personality_score != null && (
                    <>
                      <div className="my-2 h-px w-2/3 bg-[var(--teal-mid)]" />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10.5px] text-[var(--muted)]">מקצועי <b className="font-extrabold text-[var(--teal-dark)]">{t.match_score}%</b></span>
                        <span className="text-[10.5px] text-[var(--muted)]">אישיותי <b className="font-extrabold text-[var(--teal-dark)]">{t.personality_score}%</b></span>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
                <a
                  href={profileHrefForMatch(t)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[var(--teal)] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[var(--teal-dark)]"
                >
                  פרופיל מלא ←
                </a>
                <button
                  onClick={() => fetchExplanation(t)}
                  disabled={explainLoading[t.id]}
                  className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-[#EAD9B0] bg-white px-4 py-2 text-[13px] font-bold text-[var(--gold-dark)] transition-colors hover:border-[var(--gold)] hover:bg-[var(--gold-pale)] disabled:opacity-60"
                >
                  <span
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] text-white"
                    style={{ background: "linear-gradient(135deg,var(--teal),var(--gold))" }}
                  >✦</span>
                  {explainLoading[t.id] ? "טוען..." : "למה הותאמ/ה לי?"}
                </button>
              </div>
              {explainData[t.id] && (
                <div
                  className="mt-3 rounded-2xl bg-[var(--gold-pale)] p-3.5 text-right"
                  style={{ borderInlineStart: "3px solid var(--gold)" }}
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <span
                      className="inline-flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full text-[13px] text-white shadow-sm"
                      style={{ background: "linear-gradient(135deg,var(--teal),var(--gold))" }}
                    >✦</span>
                    <span className="text-[12.5px] font-extrabold text-[var(--gold-dark)]">{explainData[t.id]!.title}</span>
                    <span
                      className="rounded-full border border-[#EAD9B0] bg-white px-2 py-[1px] text-[9.5px] font-bold text-[var(--gold-dark)]"
                      style={{ marginInlineStart: "auto" }}
                    >ניתוח AI</span>
                  </div>
                  <p className="whitespace-pre-line text-[13px] leading-relaxed text-[var(--text-2)]">{explainData[t.id]!.explanation}</p>
                  <p className="mt-2 text-[10.5px] text-[var(--faint)]">{explainData[t.id]!.tone_note}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Layout>
  );

  return (
    <Layout screen={screen} domains={answers.domains}>
      <Card>
        <div className="py-8 text-center">
          <p className="text-[#6b7280]">טוען...</p>
        </div>
      </Card>
    </Layout>
  );
}
