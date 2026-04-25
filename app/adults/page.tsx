"use client";

import { useState, useEffect } from "react";
import type {
  QuestionnaireAnswers,
  ScoringResult,
  Recommendation,
} from "@/app/lib/questionnaire-types";
import { REGION_CITIES, CITY_TO_REGION } from "@/app/lib/regions";
import { genderTitle } from "@/app/lib/gender-text";
import { getFingerprint } from "@/app/lib/fingerprint";

function trackClick(therapistId: string, clickType: "whatsapp" | "phone" | "email") {
  fetch("/api/track-click", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ therapist_id: therapistId, click_type: clickType, source: "match" }),
  }).catch(() => {});
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
                ? "border-[#2e7d8c] bg-[#2e7d8c] text-white"
                : "border-[#ddd6c8] bg-white text-[#1c1c2e] hover:border-[#2e7d8c]"
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
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-[#ddd6c8] bg-white p-3 text-sm leading-snug transition-all hover:border-[#2e7d8c] hover:bg-[#f0fafc]">
            <input
              type="checkbox"
              checked={checked.includes(i)}
              onChange={(e) => onChange(i, e.target.checked)}
              className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#2e7d8c]"
            />
            {item}
          </label>
        </li>
      ))}
    </ul>
  );
}

// Ordered milestone screens — used for progress calculation
const ADULTS_SCREENS_ORDER = [
  "disclaimer","intake","domains",
  "e1","e1-q","e2","e2-2","e2-q","e3","e3-q",
  "e4","e4-chronic","e4-medical","e4-q","e4-social","e4-social-sev","e4-flight","e4-medanx","e4-stresspain",
  "e5","e5-q","e6","e6-q","e7-q","e8","e8c","e8d","e9","e9-q",
  "e10","e10a","e10b","e10c",
  "therapist-style",
  "f-vision","f1","f1-subs","f1-adhd","f1-ld","f1-ld-q","f2","f2-q","f3","f3-type","f3-a","f3-b",
  "r-intake","r1","r1-scale","r2-q","r3","r3-partner",
  "a-types","a-substances","a-gaming","a-porn-type","a-porn-q","a-sex-q","a-gambling","a-phone",
  "scoring",
];

function getAdultsProgress(screen: string): number {
  const idx = ADULTS_SCREENS_ORDER.indexOf(screen);
  if (idx < 0) return 0;
  return Math.round((idx / (ADULTS_SCREENS_ORDER.length - 1)) * 100);
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
        {msg && <span className="text-xs font-semibold text-[#2e7d8c] animate-pulse">{msg}</span>}
      </div>
      <div className="h-2 w-full rounded-full bg-stone-200 overflow-hidden">
        <div
          className="h-2 rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: "linear-gradient(90deg, #2e7d8c, #1a3a5c)" }}
        />
      </div>
    </div>
  );
}

const NO_BAR = ["disclaimer","intake","domains","scoring","results","match-form","match-results"];
function Layout({ screen, children }: { screen: string; children: React.ReactNode }) {
  const pct = getAdultsProgress(screen);
  const showBar = pct > 0 && !NO_BAR.includes(screen);
  return (
    <main className="min-h-screen bg-[#f0ece4]" dir="rtl">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-5 text-center">
          <img src="/logo.svg.png" alt="טיפול חכם" className="mx-auto mb-3 h-16 w-auto" />
          <h1 className="text-2xl font-black text-[#1a3a5c]" style={{ fontFamily: "serif" }}>טיפול חכם</h1>
          <p className="text-sm text-[#6b7280]">שאלון הפניה לטיפול – מבוגרים</p>
        </div>
        {showBar && <ProgressBar pct={pct} />}
        {children}
      </div>
    </main>
  );
}

function Card({ children, badge, badgeColor = "blue" }: { children: React.ReactNode; badge?: string; badgeColor?: "blue" | "green" | "teal" }) {
  const colors = { blue: "bg-[#1a3a5c]", green: "bg-[#2d7a4f]", teal: "bg-[#2e7d8c]" };
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

function NavRow({ onBack, onNext, nextLabel = "המשך ▸", nextDisabled = false }: {
  onBack?: () => void; onNext?: () => void; nextLabel?: string; nextDisabled?: boolean;
}) {
  return (
    <div className="mt-6 flex items-center justify-between gap-3">
      {onBack ? (
        <button type="button" onClick={onBack} className="rounded-xl border-2 border-[#1a3a5c] px-4 py-2 text-sm font-semibold text-[#1a3a5c] hover:bg-[#1a3a5c] hover:text-white">
          ◂ חזרה
        </button>
      ) : <span />}
      {onNext && (
        <button type="button" onClick={onNext} disabled={nextDisabled} className="rounded-xl bg-[#2e7d8c] px-5 py-2 text-sm font-semibold text-white disabled:opacity-40 hover:bg-[#1f5f6e]">
          {nextLabel}
        </button>
      )}
    </div>
  );
}

function YesNo({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
  return (
    <div className="mt-4 flex gap-3">
      <button type="button" onClick={onYes} className="flex-1 rounded-xl bg-[#2d7a4f] py-3 text-sm font-bold text-white hover:bg-[#1f5a38]">כן</button>
      <button type="button" onClick={onNo} className="flex-1 rounded-xl bg-[#1a3a5c] py-3 text-sm font-bold text-white hover:bg-[#0f2540]">לא</button>
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

  useEffect(() => {
    const pct = getAdultsProgress(screen);
    (window as any).gtag?.("event", "quiz_step", { quiz_type: "adults", step: screen, progress: pct });
  }, [screen]);

  const [agreed, setAgreed] = useState(false);
  const [answers, setAnswers] = useState<QuestionnaireAnswers>({ age: 0, gender: "", domains: [] });
  const [scoring, setScoring] = useState<ScoringResult | null>(null);
  const [selectedRec, setSelectedRec] = useState<Recommendation | null>(null);
  const [matchPrefs, setMatchPrefs] = useState<MatchPrefs>({ region: "", city: "", online: false, genderPref: "", culturalPrefs: [], language: "עברית", arrangements: [] });
  const [matchResults, setMatchResults] = useState<any[] | null>(null);
  const [addictionCbtFallback, setAddictionCbtFallback] = useState(false);
  const [selectedTherapist, setSelectedTherapist] = useState<any | null>(null);
  const [combinedTreatments, setCombinedTreatments] = useState<string[] | null>(null);
  const [combinedLabels, setCombinedLabels] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [explainData, setExplainData] = useState<Record<string, { title: string; explanation: string; tone_note: string } | null>>({});
  const [explainLoading, setExplainLoading] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState("");
  const [domainIdx, setDomainIdx] = useState(0);
  const [addictionIdx, setAddictionIdx] = useState(0);
  const [usageAllowed, setUsageAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("staff") === "6454a9b616f5") {
      localStorage.setItem("quiz_bypass", "1");
    }
    if (localStorage.getItem("quiz_bypass") === "1") { setUsageAllowed(true); return; }
    getFingerprint()
      .then(fp => fetch(`/api/usage/check?type=adults&fp=${fp}`))
      .then(r => r.json())
      .then(d => setUsageAllowed(d.allowed))
      .catch(() => setUsageAllowed(true));
  }, []);

  // Track profile-modal views with anonymous context for promoted-therapist stats
  useEffect(() => {
    if (!selectedTherapist?.id) return;
    const normalizeAgeBand = (a: number): string | null => {
      if (!a || isNaN(a)) return null;
      if (a < 18) return "child";
      if (a <= 30) return "18-30";
      if (a <= 45) return "31-45";
      if (a <= 60) return "46-60";
      return "60+";
    };
    const normalizeGenderKey = (g: string): string | null => {
      if (g === "זכר" || g === "גבר") return "m";
      if (g === "נקבה" || g === "אישה") return "f";
      return g ? "other" : null;
    };
    const normalizeRegionKey = (r: string, online: boolean): string | null => {
      if (online && !r) return "online";
      if (!r) return null;
      if (r.includes("גוש דן") || r.includes("שפלה")) return "center";
      if (r.includes("שרון")) return "sharon";
      if (r.includes("ירושלים")) return "jerusalem";
      if (r.includes("חיפה") || r.includes("קריות")) return "haifa";
      if (r.includes("גליל") || r.includes("עמק")) return "north";
      if (r.includes("דרום") || r.includes("באר שבע") || r.includes("אשדוד") || r.includes("אשקלון")) return "south";
      return "other";
    };
    const issueMap: Record<string, string> = {
      emotional: "emotional",
      functional: "functional",
      family: "relationship",
      sexual: "sexual",
      addiction: "addiction",
      personal: "personal",
    };
    const firstDomain = answers.domains?.[0];
    let sessionId: string | null = null;
    try {
      sessionId = localStorage.getItem("mnt_session_id");
      if (!sessionId) {
        sessionId = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
        localStorage.setItem("mnt_session_id", sessionId);
      }
    } catch {}
    fetch("/api/track-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        therapist_id: selectedTherapist.id,
        source: "match",
        viewer_region: normalizeRegionKey(matchPrefs.region, matchPrefs.online),
        viewer_issue: firstDomain ? issueMap[firstDomain] ?? null : null,
        viewer_age_band: normalizeAgeBand(answers.age),
        viewer_gender: normalizeGenderKey(answers.gender),
        match_score: selectedTherapist.combined_score ?? selectedTherapist.match_score ?? null,
        session_id: sessionId,
      }),
    }).catch(() => {});
  }, [selectedTherapist?.id, answers.age, answers.gender, answers.domains, matchPrefs.region, matchPrefs.online]);

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
  const [visionAns, setVisionAns] = useState<boolean | null>(null);
  const [hearingAns, setHearingAns] = useState<boolean | null>(null);
  const [height, setHeight] = useState<number>(0);
  const [heightTouched, setHeightTouched] = useState(false);
  const [weight, setWeight] = useState<number>(0);
  const [weightTouched, setWeightTouched] = useState(false);

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
  const [coupleScale, setCoupleScale] = useState(0);
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
  function updE(patch: Partial<NonNullable<QuestionnaireAnswers["emotional"]>>) {
    setAnswers((p) => ({ ...p, emotional: { ...p.emotional, ...patch } }));
  }
  function updF(patch: Partial<NonNullable<QuestionnaireAnswers["functional"]>>) {
    setAnswers((p) => ({ ...p, functional: { ...p.functional, ...patch } }));
  }
  function updR(patch: Partial<NonNullable<QuestionnaireAnswers["relationship"]>>) {
    setAnswers((p) => ({ ...p, relationship: { ...p.relationship, ...patch } }));
  }
  function updA(patch: Partial<NonNullable<QuestionnaireAnswers["addiction"]>>) {
    setAnswers((p) => ({ ...p, addiction: { ...p.addiction, types: p.addiction?.types ?? [], ...patch } }));
  }

  // If personal_development is combined with any other domain, its flow is
  // skipped — the other domains run as usual and scoring ignores it too.
  function effectiveDomains(ds: QuestionnaireAnswers["domains"]): QuestionnaireAnswers["domains"] {
    if (ds.length > 1) return ds.filter((d) => d !== "personal_development");
    return ds;
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

  function nextDomain() {
    const doms = effectiveDomains(answers.domains);
    const next = domainIdx + 1;
    if (next >= doms.length) { goScoring(); return; }
    setDomainIdx(next);
    setScreen(firstScreenForDomain(doms[next]));
  }

  function nextAddiction() {
    const types = answers.addiction?.types ?? [];
    const next = addictionIdx + 1;
    if (next >= types.length) { nextDomain(); return; }
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

  async function goScoring() {
    setScreen("scoring");
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/questionnaire/adults/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answers),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "שגיאה");
      setScoring({ recommendations: json.recommendations });
      if (localStorage.getItem("quiz_bypass") !== "1") {
        getFingerprint().then(fp =>
          fetch("/api/usage/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "adults", fp }) })
        ).then(r => r.json()).then(d => setUsageAllowed(d.allowed));
      }
      setScreen("results");
      (window as any).gtag?.("event", "quiz_completed", { quiz_type: "adults" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "שגיאה בניקוד");
      if (localStorage.getItem("quiz_bypass") !== "1") {
        getFingerprint().then(fp =>
          fetch("/api/usage/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "adults", fp }) })
        ).then(r => r.json()).then(d => setUsageAllowed(d.allowed));
      }
      setScreen("results");
      (window as any).gtag?.("event", "quiz_completed", { quiz_type: "adults" });
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
      const body: Record<string, unknown> = {
        treatmentTypes: combinedTreatments ?? (selectedRec?.treatment ? [selectedRec.treatment] : []),
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
        couplesModality: selectedRec?.couplesModality ?? undefined,
        needsSexualTherapy: selectedRec?.needsSexualTherapy ?? false,
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
    setExplainLoading(prev => ({ ...prev, [t.id]: true }));
    try {
      const recommendedTreatments = scoring?.recommendations.map(r => r.treatment) ?? [];
      const userSummary = {
        age_group: answers.age ? `${answers.age}` : undefined,
        region_preference: matchPrefs.city || matchPrefs.region || undefined,
        online_preference: matchPrefs.online || undefined,
        therapist_gender_preference: matchPrefs.genderPref || undefined,
        main_needs: scoring?.recommendations.map(r => r.symptomText) ?? [],
        recommended_treatment_types: recommendedTreatments,
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

  // ── USAGE LIMIT ────────────────────────────────────────────────────────────
  if (usageAllowed === false) return (
    <Layout screen={screen}>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6" dir="rtl">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-2xl font-black text-stone-900 mb-3">הגעת למגבלת השימוש החינמי</h2>
        <p className="text-stone-600 leading-7 max-w-sm">
          ניתן למלא את השאלון עד 3 פעמים ללא תשלום.<br />
          בקרוב נפתח אפשרות לתשלום — עקבו אחרינו לעדכונים.
        </p>
      </div>
    </Layout>
  );

  if (qItemsError) return (
    <Layout screen={screen}>
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
    <Layout screen={screen}>
      <div className="flex justify-center py-20 text-[#6b7280]">טוען שאלון…</div>
    </Layout>
  );

  // ── DISCLAIMER ─────────────────────────────────────────────────────────────
  if (screen === "disclaimer") return (
    <Layout screen={screen}>
      <Card>
        <div className="mb-6 rounded-xl border-2 border-amber-300 bg-amber-50 p-6 leading-relaxed text-amber-900">
          <p className="mb-3 text-base font-bold">⚠️ הצהרה והבהרה משפטית</p>
          <p className="mb-3 text-sm">שאלון זה נועד אך ורק לסייע בהתאמה של סוג הטיפול לקושי המדווח ואינו מהווה אבחון פסיכולוגי, פסיכיאטרי או רפואי מכל סוג שהוא.</p>
          <p className="mb-3 text-sm">המידע המוצג בשאלון הינו כללי בלבד ואינו מחליף ייעוץ מקצועי, אבחון או טיפול על ידי גורמים מוסמכים. השאלון אינו מתיימר לאבחן הפרעות נפשיות, מחלות או כל מצב בריאותי אחר.</p>
          <p className="mb-3 text-sm">המשתמש/ת בשאלון זה מצהיר/ה כי הוא/היא מבין/ה שהתשובות המתקבלות אינן מחייבות מבחינה קלינית, ואין לסמוך עליהן כתחליף לאבחון מקצועי. הגורמים המפעילים את השאלון אינם נושאים בכל אחריות לנזק, ישיר או עקיף, שייגרם כתוצאה מהשימוש בו.</p>
          <p className="text-sm font-semibold">🚨 אם אתה/את נמצא/ת במצב של מצוקה נפשית חריפה או סכנה מיידית, פנה/י מיד לחדר מיון הקרוב, לקו החירום 101 (מד&quot;א) או לסיוע ראשוני 1201.</p>
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 hover:bg-amber-100">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#2e7d8c]" />
          <span>קראתי את ההצהרה לעיל, הבנתי את תנאיה ואני מסכים/ה להמשיך</span>
        </label>
        <div className="mt-5">
          <button type="button" disabled={!agreed} onClick={() => setScreen("intake")} className="w-full rounded-xl bg-[#1a3a5c] py-3 text-base font-bold text-white disabled:opacity-40 hover:bg-[#0f2540]">
            קראתי והסכמתי – נמשיך ▸
          </button>
        </div>
      </Card>
    </Layout>
  );

  // ── INTAKE ─────────────────────────────────────────────────────────────────
  if (screen === "intake") return (
    <Layout screen={screen}>
      <Card badge="פרטים ראשוניים">
        <p className="mb-4 font-semibold text-[#1a3a5c]">נתחיל עם כמה שאלות כלליות</p>
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
            </select>
          </div>
        </div>
        {ageTouched && localAge > 0 && localAge < 18 && (
          <div className="mt-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
            ⚠️ מתחת לגיל 18 יש לעבור לשאלון ילדים
          </div>
        )}

        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold text-[#1a3a5c]">גובה ומשקל (לחישוב BMI)</p>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-[#6b7280]">גובה (ס&quot;מ)</label>
              <input type="number" min={100} max={250} value={height || ""}
                onChange={(e) => setHeight(Number(e.target.value))}
                onBlur={() => setHeightTouched(true)}
                className="w-full rounded-lg border-2 border-[#ddd6c8] px-3 py-2 text-sm focus:border-[#2e7d8c] focus:outline-none" placeholder="175" />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs text-[#6b7280]">משקל (ק&quot;ג)</label>
              <input type="number" min={20} max={300} value={weight || ""}
                onChange={(e) => setWeight(Number(e.target.value))}
                onBlur={() => setWeightTouched(true)}
                className="w-full rounded-lg border-2 border-[#ddd6c8] px-3 py-2 text-sm focus:border-[#2e7d8c] focus:outline-none" placeholder="70" />
            </div>
          </div>
          <div className="mt-2 min-h-[2.5rem]">
            {heightTouched && weightTouched && height > 0 && weight > 0 && (() => { const bmi = weight / Math.pow(height / 100, 2); const ok = bmi >= 18.5 && bmi <= 24.9; return (
              <p className={`rounded-lg p-2 text-xs ${ok ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"}`}>
                BMI: {bmi.toFixed(1)} – {ok ? "תקין ✓" : "אינו תקין – הפנייה לרופא משפחה"}
              </p>
            ); })()}
          </div>
        </div>

        <NavRow onBack={() => setScreen("disclaimer")} onNext={() => {
          const bmiAbnormal = (height > 0 && weight > 0)
            ? (weight / Math.pow(height / 100, 2)) < 18.5 || (weight / Math.pow(height / 100, 2)) > 24.9
            : undefined;
          upd({ age: localAge, bmiAbnormal });
          setScreen("domains");
        }}
          nextDisabled={!localAge || localAge < 18 || !answers.gender} />
      </Card>
    </Layout>
  );

  // ── DOMAINS ─────────────────────────────────────────────────────────────────
  if (screen === "domains") return (
    <Layout screen={screen}>
      <Card badge="תחומי קושי">
        <p className="mb-4 font-semibold text-[#1a3a5c]">בחר/י את התחומים בהם חווה/ת קושי (ניתן לסמן יותר מאחד)</p>
        <div className="grid grid-cols-2 gap-3">
          {([
            ["emotional","🧠","מורכבויות בתחום הרגשי/האישי","חרדות, מצב רוח, טראומה, שינה, אכילה"],
            ["functional","📚","סימני שאלה לגבי התחומים התפקודיים, התעסוקתיים או האקדמאיים","קשיי למידה, ריכוז, כיוון מקצועי"],
            ["relationship","💑","זוגיות ומשפחה","קשיים זוגיים, הורות, מיניות"],
            ["addiction","🔄","קשיי התמכרות","אלכוהול, סמים, מסכים, הימורים"],
          ] as const).map(([id, icon, title, desc]) => {
            const sel = answers.domains.includes(id as any);
            return (
              <button key={id} type="button"
                onClick={() => upd({ domains: sel ? answers.domains.filter((d) => d !== id) : [...answers.domains, id as any] })}
                className={`rounded-xl border-2 p-4 text-right transition-all ${sel ? "border-[#2e7d8c] bg-[#e0f4fa]" : "border-[#ddd6c8] bg-white hover:border-[#2e7d8c] hover:bg-[#f0fafc]"}`}>
                <div className="text-2xl">{icon}</div>
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
                className={`w-full rounded-xl border-2 p-4 text-right transition-all ${sel ? "border-[#2e7d8c] bg-[#e0f4fa]" : "border-[#ddd6c8] bg-white hover:border-[#2e7d8c] hover:bg-[#f0fafc]"}`}>
                <div className="text-2xl">🌱</div>
                <div className="mt-1 text-xs font-bold text-[#1a3a5c]">התפתחות אישית</div>
                <div className="mt-0.5 text-xs text-[#6b7280]">אני לא מתמודד/ת עם קושי אלא מעוניין/ת בהבנה עצמית</div>
              </button>
            );
          })()}
        </div>
        <NavRow onBack={() => setScreen("intake")} onNext={startDomains} nextDisabled={answers.domains.length === 0} />
      </Card>
    </Layout>
  );

  // ═══════════════════════════════════════════════════════
  // EMOTIONAL DOMAIN
  // ═══════════════════════════════════════════════════════

  if (screen === "e1") return (
    <Layout screen={screen}>
      <Card badge="תחום רגשי" badgeColor="green">
        <p className="mb-1 font-semibold text-[#1a3a5c]">1. האם חווה/ת <strong>מצב רוח ירוד, עצבות מתמשכת, חוסר חשק, או העדר הנאה ממושכים</strong>?</p>
        <p className="mb-3 rounded-lg bg-gray-50 p-2 text-xs text-[#6b7280]">כולל: עצב, עצבנות, אובדן עניין, שינויים במשקל/שינה, עייפות, קשיי ריכוז</p>
        <YesNo onYes={() => { updE({ e1: true }); setScreen("e1-q"); }} onNo={() => { updE({ e1: false }); setScreen("e2"); }} />
      </Card>
    </Layout>
  );

  if (screen === "e1-q") return (
    <Layout screen={screen}>
      <Card badge="שאלון מצב רוח" badgeColor="green">
        <p className="mb-3 font-semibold text-[#1a3a5c]">בשבועיים האחרונים, כמה מהתסמינים הבאים חווית? סמן/י את התסמינים המתאימים:</p>
        <CheckList items={qItems.mood} checked={moodChecked}
          onChange={(i, v) => setMoodChecked((p) => v ? [...p, i] : p.filter((x) => x !== i))} />
        <NavRow onBack={() => setScreen("e1")}
          onNext={() => {
            const suicidal = moodChecked.includes(8);
            updE({ moodItems: moodChecked, moodSuicidal: suicidal });
            setScreen("e2");
          }} />
      </Card>
    </Layout>
  );

  if (screen === "e2") return (
    <Layout screen={screen}>
      <Card badge="תחום רגשי" badgeColor="green">
        <p className="mb-1 font-semibold text-[#1a3a5c]">2. האם בשבועות האחרונים חווית <strong>מצב רוח מרומם או רוגזני באופן קיצוני</strong>?</p>
        <YesNo onYes={() => { updE({ maniaScreen1: true }); setScreen("e2-2"); }}
          onNo={() => { updE({ maniaScreen1: false }); setScreen("e3"); }} />
      </Card>
    </Layout>
  );

  if (screen === "e2-2") return (
    <Layout screen={screen}>
      <Card badge="תחום רגשי" badgeColor="green">
        <p className="mb-1 font-semibold text-[#1a3a5c]">האם חווית גם <strong>פרץ אנרגיה יוצא דופן</strong> בתקופה זו?</p>
        <YesNo onYes={() => { updE({ maniaScreen2: true }); setScreen("e2-q"); }}
          onNo={() => { updE({ maniaScreen2: false }); setScreen("e3"); }} />
      </Card>
    </Layout>
  );

  if (screen === "e2-q") return (
    <Layout screen={screen}>
      <Card badge="שאלון מניה" badgeColor="green">
        <p className="mb-3 font-semibold text-[#1a3a5c]">סמן/י את התסמינים הנוספים הרלוונטיים:</p>
        <CheckList items={qItems.mania} checked={maniaChecked}
          onChange={(i, v) => setManiaChecked((p) => v ? [...p, i] : p.filter((x) => x !== i))} />
        <div className="mt-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={maniaDeath} onChange={(e) => setManiaDeath(e.target.checked)} className="accent-[#2e7d8c]" />
            מחשבות על מוות
          </label>
        </div>
        <NavRow onBack={() => setScreen("e2-2")}
          onNext={() => { updE({ maniaItems: maniaChecked, maniaDeath }); setScreen("e3"); }} />
      </Card>
    </Layout>
  );

  if (screen === "e3") return (
    <Layout screen={screen}>
      <Card badge="תחום רגשי" badgeColor="green">
        <p className="mb-1 font-semibold text-[#1a3a5c]">3. האם ראית/שמעת דברים שאחרים אמרו שאינם קיימים? או שיש לך אמונות/חשדות יוצאי דופן?</p>
        <YesNo onYes={() => { updE({ e3: true }); setScreen("e3-q"); }}
          onNo={() => { updE({ e3: false }); setScreen("e4"); }} />
      </Card>
    </Layout>
  );

  if (screen === "e3-q") return (
    <Layout screen={screen}>
      <Card badgeColor="green">
        <p className="mb-3 font-semibold text-[#1a3a5c]">סמן/י את ההצהרות המתאימות לך:</p>
        <CheckList items={qItems.prodrome} checked={prodromeChecked}
          onChange={(i, v) => setProdromeChecked((p) => v ? [...p, i] : p.filter((x) => x !== i))} />
        <div className="mt-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={prodromeSuicidal} onChange={(e) => setProdromeSuicidal(e.target.checked)} className="accent-[#2e7d8c]" />
            קיימות מחשבות אובדניות
          </label>
        </div>
        <NavRow onBack={() => setScreen("e3")}
          onNext={() => { updE({ prodromeItems: prodromeChecked, prodromeSuicidal }); setScreen("e4"); }} />
      </Card>
    </Layout>
  );

  if (screen === "e4") return (
    <Layout screen={screen}>
      <Card badge="תחום רגשי" badgeColor="green">
        <p className="mb-1 font-semibold text-[#1a3a5c]">4. האם חווה <strong>דאגות מתמשכות, חרדה, או פחד ממצבים מסוימים</strong>?</p>
        <YesNo onYes={() => { updE({ e4: true }); setScreen("e4-chronic"); }}
          onNo={() => { updE({ e4: false }); setScreen("e5"); }} />
      </Card>
    </Layout>
  );

  if (screen === "e4-chronic") return (
    <Layout screen={screen}>
      <Card badge="תחום רגשי" badgeColor="green">
        <p className="mb-1 font-semibold text-[#1a3a5c]">האם ישנם <strong>כאבים כרוניים</strong> כגון כאבי בטן או כאבי ראש?</p>
        <YesNo onYes={() => { updE({ e4Chronic: true }); setScreen("e4-medical"); }}
          onNo={() => { updE({ e4Chronic: false }); setScreen("e4-q"); }} />
      </Card>
    </Layout>
  );

  if (screen === "e4-medical") return (
    <Layout screen={screen}>
      <Card badge="תחום רגשי" badgeColor="green">
        <p className="mb-1 font-semibold text-[#1a3a5c]">האם <strong>נשללו בעיות רפואיות</strong> כגורם לכאבים?</p>
        <YesNo onYes={() => { updE({ e4Medical: true }); setScreen("e4-q"); }}
          onNo={() => { updE({ e4Medical: false }); setScreen("e4-q"); }} />
      </Card>
    </Layout>
  );

  if (screen === "e4-q") return (
    <Layout screen={screen}>
      <Card badge="שאלון חרדה" badgeColor="green">
        <p className="mb-3 font-semibold text-[#1a3a5c]">עד כמה כל אחד מהדברים הבאים מפריע לך? (1=כלל לא, 3=לעיתים קרובות)</p>
        {qItems.gad7.map((item, i) => (
          <ScaleRow key={i} label={item} group={`gad-${i}`} values={[1, 2, 3]} value={gad7[i]}
            onChange={(v) => setGad7((p) => { const n = [...p]; n[i] = v; return n; })} />
        ))}
        <NavRow onBack={() => setScreen("e4")}
          onNext={() => {
            const total = gad7.reduce((a, b) => a + b, 0);
            updE({ gad7Scores: gad7 });
            setScreen(total > 13 ? "e4-social" : "e4-flight");
          }} />
      </Card>
    </Layout>
  );

  if (screen === "e4-social") return (
    <Layout screen={screen}>
      <Card badge="חרדה חברתית" badgeColor="green">
        <p className="mb-3 font-semibold text-[#1a3a5c]">האם יש לך <strong>חרדה חברתית</strong>? (חשש מהערכה שלילית, הימנעות ממצבים חברתיים)</p>
        <YesNo onYes={() => { updE({ socialAnxiety: true }); setScreen("e4-social-sev"); }}
          onNo={() => { updE({ socialAnxiety: false }); setScreen("e4-flight"); }} />
      </Card>
    </Layout>
  );

  if (screen === "e4-social-sev") return (
    <Layout screen={screen}>
      <Card badge="חרדה חברתית" badgeColor="green">
        <p className="mb-3 font-semibold text-[#1a3a5c]">עד כמה החרדה החברתית פוגעת בתפקוד שלך? (1=כלל לא, 7=מאוד)</p>
        <ScaleRow label="" group="social-sev" values={[1,2,3,4,5,6,7]} value={socialSeverity} onChange={setSocialSeverity} />
        <NavRow onBack={() => setScreen("e4-social")}
          onNext={() => { updE({ socialSeverity }); setScreen("e4-flight"); }} />
      </Card>
    </Layout>
  );

  if (screen === "e4-flight") return (
    <Layout screen={screen}>
      <Card badge="חרדה – שאלות נוספות" badgeColor="green">
        <p className="mb-1 font-semibold text-[#1a3a5c]">האם החרדה מתעוררת בהקשר של <strong>טיסות</strong>?</p>
        <YesNo onYes={() => { updE({ flightAnxiety: true }); setScreen("e4-medanx"); }}
          onNo={() => { updE({ flightAnxiety: false }); setScreen("e4-medanx"); }} />
      </Card>
    </Layout>
  );

  if (screen === "e4-medanx") return (
    <Layout screen={screen}>
      <Card badge="חרדה – שאלות נוספות" badgeColor="green">
        <p className="mb-1 font-semibold text-[#1a3a5c]">האם החרדה קשורה ל<strong>טיפול רפואי, חשיפה למחטים, או חשש מתמיד ממחלות</strong>?</p>
        <YesNo onYes={() => { updE({ medicalAnxiety: true }); setScreen("e4-stresspain"); }}
          onNo={() => { updE({ medicalAnxiety: false }); setScreen("e4-stresspain"); }} />
      </Card>
    </Layout>
  );

  if (screen === "e4-stresspain") return (
    <Layout screen={screen}>
      <Card badge="חרדה – שאלות נוספות" badgeColor="green">
        <p className="mb-1 font-semibold text-[#1a3a5c]">האם בתקופות של מתח ישנם תסמינים של <strong>כאבים פיסיים כגון כאבי ראש או סחרחורות</strong>?</p>
        <YesNo onYes={() => { updE({ stressPain: true }); setScreen("e5"); }}
          onNo={() => { updE({ stressPain: false }); setScreen("e5"); }} />
      </Card>
    </Layout>
  );

  if (screen === "e5") return (
    <Layout screen={screen}>
      <Card badge="תחום רגשי" badgeColor="green">
        <p className="mb-1 font-semibold text-[#1a3a5c]">5. האם חש/ה <strong>הכרח לחשוב שוב ושוב מחשבות מסוימות, או לעשות שוב ושוב פעולות מסוימות</strong>?</p>
        <YesNo onYes={() => { updE({ e5: true }); setScreen("e5-q"); }}
          onNo={() => { updE({ e5: false }); setScreen("e6"); }} />
      </Card>
    </Layout>
  );

  if (screen === "e5-q") return (
    <Layout screen={screen}>
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

  if (screen === "e6") return (
    <Layout screen={screen}>
      <Card badge="תחום רגשי" badgeColor="green">
        <p className="mb-3 font-semibold text-[#1a3a5c]">6. האם חווה/ת <strong>קשיים בנוגע למשקל, אכילה או שינה</strong>?</p>
        <YesNo
          onYes={() => updE({ e6: true, e7: true })}
          onNo={() => { updE({ e6: false, e7: false }); setScreen("e8"); }}
        />
        {answers.emotional?.e6 === true && (
          <div className="mt-4 space-y-3 border-t border-dashed border-[#c8dce0] pt-4">
            <p className="text-sm font-semibold text-[#1a3a5c] mb-2">מה הרלוונטי לך? (ניתן לבחור שניים)</p>
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
            {(e6EatingChecked || e6SleepChecked) && (
              <button onClick={() => {
                if (e6EatingChecked) setScreen("e6-q");
                else setScreen("e7-q");
              }}
                className="mt-2 rounded-xl bg-[#2e7d8c] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1f5f6e]">
                המשך ←
              </button>
            )}
          </div>
        )}
      </Card>
    </Layout>
  );

  if (screen === "e6-q") return (
    <Layout screen={screen}>
      <Card badge="שאלון אכילה" badgeColor="green">
        <p className="mb-3 font-semibold text-[#1a3a5c]">סמן/י כמה מהדברים הבאים רלוונטיים (כל קבוצה בנפרד):</p>
        <p className="mb-2 text-sm font-bold text-[#2d7a4f]">א. הגבלת אכילה / אנורקסיה:</p>
        <CheckList items={["סירוב לשמור על משקל גוף תקין","פחד עז מעלייה במשקל","עיוות בתפיסת הגוף"]}
          checked={eating1Checked}
          onChange={(i, v) => {
            const next = v ? [...eating1Checked, i] : eating1Checked.filter(x => x !== i);
            setEating1Checked(next);
            updE({ eating1Count: next.length });
          }} />
        <p className="mb-2 mt-3 text-sm font-bold text-[#2d7a4f]">ב. אכילת יתר / בולימיה:</p>
        <CheckList items={["פרקי אכילת יתר מתמשכים","הקאות מכוונות / שימוש במשלשלים","פעילות גופנית כפייתית"]}
          checked={eating2Checked}
          onChange={(i, v) => {
            const next = v ? [...eating2Checked, i] : eating2Checked.filter(x => x !== i);
            setEating2Checked(next);
            updE({ eating2Count: next.length, eating2Purge: next.includes(1) });
          }} />
        <p className="mb-2 mt-3 text-sm font-bold text-[#2d7a4f]">ג. הימנעות מסוגי מזון (ARFID):</p>
        <CheckList items={["הימנעות ממזון בשל מרקם/מראה","פחד מחנק/הקאה בעת אכילה","תזונה מוגבלת מאוד"]}
          checked={eating3Checked}
          onChange={(i, v) => {
            const next = v ? [...eating3Checked, i] : eating3Checked.filter(x => x !== i);
            setEating3Checked(next);
            updE({ eating3Count: next.length });
          }} />
        <NavRow onBack={() => setScreen("e6")} onNext={() => setScreen(e6SleepChecked ? "e7-q" : "e8")} />
      </Card>
    </Layout>
  );

  if (screen === "e7-q") return (
    <Layout screen={screen}>
      <Card badge="שאלון שינה" badgeColor="green">
        <p className="mb-3 font-semibold text-[#1a3a5c]">סמן/י את הרלוונטי לך:</p>
        <CheckList items={qItems.sleep} checked={sleepChecked}
          onChange={(i, v) => setSleepChecked((p) => v ? [...p, i] : p.filter((x) => x !== i))} />
        <NavRow onBack={() => setScreen(e6EatingChecked ? "e6-q" : "e6")}
          onNext={() => { updE({ sleepItems: qItems.sleep.map((_, i) => sleepChecked.includes(i)) }); setScreen("e8"); }} />
      </Card>
    </Layout>
  );

  if (screen === "e8") return (
    <Layout screen={screen}>
      <Card badge="תחום רגשי" badgeColor="green">
        <p className="mb-1 font-semibold text-[#1a3a5c]">7. האם ישנם <strong>תסמינים גופניים שגורמים מצוקה</strong> ומקורם אינו רפואי ואינו חרדה?</p>
        <YesNo onYes={() => { updE({ e8: true }); setScreen("e8c"); }}
          onNo={() => { updE({ e8: false }); setScreen("e9"); }} />
      </Card>
    </Layout>
  );

if (screen === "e8c") return (
    <Layout screen={screen}>
      <Card badge="תחום רגשי" badgeColor="green">
        <p className="mb-1 font-semibold text-[#1a3a5c]">האם ישנם <strong>טיקים</strong> (תנועות או קולות בלתי רצוניים חוזרים)?</p>
        <YesNo onYes={() => { updE({ tics: true }); setScreen("e9"); }}
          onNo={() => { updE({ tics: false }); setScreen("e8d"); }} />
      </Card>
    </Layout>
  );

  if (screen === "e8d") return (
    <Layout screen={screen}>
      <Card badge="תחום רגשי" badgeColor="green">
        <p className="mb-1 font-semibold text-[#1a3a5c]">האם יש <strong>צפצופים באוזניים</strong> (טנטון)?</p>
        <YesNo onYes={() => { updE({ tinnitus: true }); setScreen("e9"); }}
          onNo={() => { updE({ tinnitus: false }); setScreen("e9"); }} />
      </Card>
    </Layout>
  );

  if (screen === "e9") return (
    <Layout screen={screen}>
      <Card badge="תחום רגשי" badgeColor="green">
        <p className="mb-1 font-semibold text-[#1a3a5c]">8. האם חווית בעבר <strong>אירוע טראומטי</strong> כגון: תאונת דרכים, פיגוע, רעידת אדמה, פגיעה מינית, לחימה וכד'?</p>
        <YesNo onYes={() => { updE({ e9: true }); setScreen("e9-q"); }}
          onNo={() => { updE({ e9: false }); setScreen("e10"); }} />
      </Card>
    </Layout>
  );

  if (screen === "e9-q") return (
    <Layout screen={screen}>
      <Card badge="שאלון טראומה" badgeColor="green">
        <p className="mb-2 font-semibold text-[#1a3a5c]">סוג האירוע:</p>
        <select value={traumaType} onChange={(e) => setTraumaType(e.target.value)}
          className="mb-3 w-full rounded-lg border-2 border-[#ddd6c8] px-3 py-2 text-sm focus:border-[#2e7d8c] focus:outline-none">
          <option value="">בחר/י</option>
          <option value="accident">תאונת דרכים</option>
          <option value="disaster">אסון טבע</option>
          <option value="terror">פיגוע או נפילת רקטה</option>
          <option value="combat">השתתפות/נוכחות בזירת לחימה</option>
          <option value="sexual">פגיעה מינית</option>
        </select>
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
        <NavRow onBack={() => setScreen("e9")}
          onNext={() => { updE({ traumaScores, traumaSuicidal, traumaType, traumaFreq }); setScreen("e10"); }} />
      </Card>
    </Layout>
  );

  if (screen === "e10") return (
    <Layout screen={screen}>
      <Card badge="תחום רגשי" badgeColor="green">
        <p className="mb-1 font-semibold text-[#1a3a5c]">9. האם את/ה מרגיש/ה שקיימת <strong>חוסר עקביות מתמשכת</strong> באופן שבו את/ה מנהל/ת את הקשרים עם אחרים?</p>
        <YesNo onYes={() => { updE({ e10: true }); setScreen("e10a"); }}
          onNo={() => { updE({ e10: false }); setScreen("therapist-style"); }} />
      </Card>
    </Layout>
  );

  if (screen === "e10a") return (
    <Layout screen={screen}>
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
    <Layout screen={screen}>
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
                  className={`flex-1 rounded-lg border-2 py-2 text-sm font-bold ${disQ[i] === v ? "border-[#2e7d8c] bg-[#2e7d8c] text-white" : "border-[#ddd6c8] bg-white"}`}>
                  {v === 1 ? "כן" : "לא"}
                </button>
              ))}
            </div>
          </div>
        ))}
        <NavRow onBack={() => setScreen("e10a")}
          onNext={() => {
            updE({ disQAnswers: disQ });
            const total = disQ.reduce((a, b) => a + b, 0);
            setScreen(total === 8 ? "therapist-style" : "e10c");
          }} />
      </Card>
    </Layout>
  );

  if (screen === "e10c") return (
    <Layout screen={screen}>
      <Card badge="שאלון אישיות" badgeColor="green">
        <p className="mb-3 font-semibold text-[#1a3a5c]">דרג/י כל היגד מ-1 (כלל לא) עד 5 (מאוד):</p>
        {qItems.pers.map((item, i) => (
          <ScaleRow key={i} label={item} group={`pers-${i}`} values={[1,2,3,4,5]} value={persScores[i]}
            onChange={(v) => setPersScores((p) => { const n = [...p]; n[i] = v; return n; })} />
        ))}
        <div className="mt-2 flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={persQ7} onChange={(e) => setPersQ7(e.target.checked)} className="accent-[#2e7d8c]" />
            יש לי תחושה של "ריק פנימי" או חוסר בתחושת זהות יציבה
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={persQ8} onChange={(e) => setPersQ8(e.target.checked)} className="accent-[#2e7d8c]" />
            הסביבה הקרובה אומרת שיש לי תגובות רגשיות קיצוניות ומהירות
          </label>
        </div>
        <NavRow onBack={() => setScreen("e10b")}
          onNext={() => { updE({ persScores, persQ7, persQ8 }); setScreen("therapist-style"); }} />
      </Card>
    </Layout>
  );

  if (screen === "therapist-style") return (
    <Layout screen={screen}>
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
            updE({ therapistStyleQ1: styleQ1, therapistStyleQ2: styleQ2, therapistStyleQ3: styleQ3 });
            nextDomain();
          }} />
      </Card>
    </Layout>
  );

  // ═══════════════════════════════════════════════════════
  // FUNCTIONAL DOMAIN
  // ═══════════════════════════════════════════════════════

  if (screen === "f-vision") return (
    <Layout screen={screen}>
      <Card badge="תחום תפקודי">
        <p className="mb-4 font-semibold text-[#1a3a5c]">לפני השאלות על תפקוד אקדמאי ותעסוקתי:</p>
        <div className="mb-5">
          <p className="mb-2 text-sm font-semibold text-[#1a3a5c]">האם ישנם סימנים או רמזים לקשיי ראייה?</p>
          <div className="flex gap-3">
            <button type="button" onClick={() => setVisionAns(true)}
              className={`flex-1 rounded-xl border-2 py-2 text-sm font-bold transition-all ${visionAns === true ? "border-[#2e7d8c] bg-[#2e7d8c] text-white" : "border-[#ddd6c8] bg-white hover:border-[#2e7d8c]"}`}>כן</button>
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
              className={`flex-1 rounded-xl border-2 py-2 text-sm font-bold transition-all ${hearingAns === true ? "border-[#2e7d8c] bg-[#2e7d8c] text-white" : "border-[#ddd6c8] bg-white hover:border-[#2e7d8c]"}`}>כן</button>
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

  if (screen === "f1") return (
    <Layout screen={screen}>
      <Card badge="תחום תפקודי">
        <p className="mb-1 font-semibold text-[#1a3a5c]">1. האם חווית <strong>קשיים משמעותיים ומתמשכים בלמידה</strong> או בביצוע מטלות אקדמיות (כגון קריאה, כתיבה, או חשבון)?</p>
        <YesNo onYes={() => { updF({ f1: true }); setScreen("f1-subs"); }}
          onNo={() => { updF({ f1: false }); setScreen("f2"); }} />
      </Card>
    </Layout>
  );

  if (screen === "f1-subs") return (
    <Layout screen={screen}>
      <Card badge="תחום תפקודי">
        <p className="mb-3 font-semibold text-[#1a3a5c]">האם הקושי נובע מחוסר ריכוז, או שהמשימה עצמה קשה גם כשמתרכזים? (ניתן לסמן שניים)</p>
        <div className="flex flex-col gap-3">
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-[#ddd6c8] bg-white p-3 text-sm hover:border-[#2e7d8c]">
            <input type="checkbox" checked={answers.functional?.f1Attention ?? false} onChange={(e) => updF({ f1Attention: e.target.checked })} className="h-4 w-4 accent-[#2e7d8c]" />
            ריכוז – חוסר ריכוז / קושי להתמיד במשימה (ADHD)
          </label>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-[#ddd6c8] bg-white p-3 text-sm hover:border-[#2e7d8c]">
            <input type="checkbox" checked={answers.functional?.f1Processing ?? false} onChange={(e) => updF({ f1Processing: e.target.checked })} className="h-4 w-4 accent-[#2e7d8c]" />
            קושי בהבנה – המשימה קשה להבנה ולעיבוד גם עם ריכוז מלא
          </label>
        </div>
        <NavRow onBack={() => setScreen("f1")}
          onNext={() => setScreen(answers.functional?.f1Attention ? "f1-adhd" : (answers.functional?.f1Processing ? "f1-ld" : "f2"))} />
      </Card>
    </Layout>
  );

  if (screen === "f1-adhd") {
    const ADHD1 = ["שמירה על ריכוז במשימות או פעילויות","ארגון משימות או פעילויות","נטייה לאבד חפצים הנחוצים לביצוע משימה","הסחה בקלות מרעשים/קולות","שכחה בביצוע משימות יומיומיות","קושי להקדיש תשומת לב לפרטים / טעויות מרובות בעבודה"];
    const ADHD2 = ["תחושת חוסר מנוחה או קוצר רוח","קושי לשבת במקום לאורך זמן ו/או תנועות ידיים ורגליים מוגברות","קושי להירגע ולהשתחרר כשיש לך זמן לעצמך","קושי להמתין לתורך","נטייה להפריע לאחרים או להתפרץ לדבריהם","נטייה לענות על שאלות לפני השלמתן"];
    return (
      <Layout screen={screen}>
        <Card badge="שאלון ADHD">
          <p className="mb-1 text-xs text-[#6b7280]">סמן/י את הרלוונטי (3 מתוך 6 בכל בלוק = סף)</p>
          <p className="mb-2 font-bold text-[#1a3a5c]">בלוק א – חוסר קשב:</p>
          <CheckList items={ADHD1} checked={adhd1Checked} onChange={(i,v) => setAdhd1Checked((p) => v ? [...p,i] : p.filter((x) => x !== i))} />
          <p className="mb-2 mt-4 font-bold text-[#1a3a5c]">בלוק ב – היפראקטיביות:</p>
          <CheckList items={ADHD2} checked={adhd2Checked} onChange={(i,v) => setAdhd2Checked((p) => v ? [...p,i] : p.filter((x) => x !== i))} />
          <NavRow onBack={() => setScreen("f1-subs")}
            onNext={() => {
              updF({ adhd1Count: adhd1Checked.length, adhd2Count: adhd2Checked.length });
              setScreen(answers.functional?.f1Processing ? "f1-ld" : "f2");
            }} />
        </Card>
      </Layout>
    );
  }

  if (screen === "f1-ld") return (
    <Layout screen={screen}>
      <Card badge="שאלון קשיי למידה">
        <p className="mb-2 font-semibold text-[#1a3a5c]">האם בילדותך היה קושי ברכישת הקריאה?</p>
        <YesNo onYes={() => { updF({ ldReading: true }); setScreen("f1-ld-q"); }}
          onNo={() => { updF({ ldReading: false }); setScreen("f2"); }} />
      </Card>
    </Layout>
  );

  if (screen === "f1-ld-q") return (
    <Layout screen={screen}>
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
    <Layout screen={screen}>
      <Card badge="תחום תפקודי">
        <p className="mb-1 font-semibold text-[#1a3a5c]">2. האם יש לך <strong>קשיי התארגנות</strong> (תכנון, ניהול זמן, ניהול משימות)?</p>
        <YesNo onYes={() => { updF({ f2: true }); setScreen("f2-q"); }}
          onNo={() => { updF({ f2: false }); setScreen("f3"); }} />
      </Card>
    </Layout>
  );

  if (screen === "f2-q") return (
    <Layout screen={screen}>
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
    <Layout screen={screen}>
      <Card badge="תחום תפקודי">
        <p className="mb-1 font-semibold text-[#1a3a5c]">3. האם אינך בטוח/ה לגבי <strong>התחום התעסוקתי</strong> שלך, בהווה או בעתיד?</p>
        <YesNo onYes={() => { updF({ f3: true }); setScreen("f3-type"); }}
          onNo={() => { updF({ f3: false }); nextDomain(); }} />
      </Card>
    </Layout>
  );

  if (screen === "f3-type") return (
    <Layout screen={screen}>
      <Card badge="תחום תעסוקתי">
        <p className="mb-3 font-semibold text-[#1a3a5c]">מה הסטאטוס הנוכחי?</p>
        <div className="flex flex-col gap-2">
          {[
            ["young","א. צעיר/ה בתחילת דרכי"],
            ["career-change","ב. אדם בוגר בשאלות לגבי שינוי קריירה"],
            ["disability","ג. בעל/ת מוגבלות"],
            ["burnout","ד. מתמודד/ת עם שחיקה בעבודה, דכדוך, חוסר כיוון"],
            ["other","ה. אחר"],
          ].map(([v, l]) => (
            <button key={v} type="button"
              onClick={() => { updF({ employmentType: v }); setScreen(v === "disability" ? "f3-done" : v === "young" ? "f3-a" : "f3-b"); }}
              className="rounded-xl border-2 border-[#ddd6c8] bg-white px-4 py-3 text-right text-sm font-semibold hover:border-[#2e7d8c] hover:bg-[#f0fafc]">
              {l}
            </button>
          ))}
        </div>
        <NavRow onBack={() => setScreen("f3")} />
      </Card>
    </Layout>
  );

  if (screen === "f3-done") {
    nextDomain(); return null;
  }

  if (screen === "f3-a") return (
    <Layout screen={screen}>
      <Card badge="שאלון תעסוקתי">
        <p className="mb-3 font-semibold text-[#1a3a5c]">סמן/י את הרלוונטי לך:</p>
        <CheckList items={[
          "האם חש/ה כי ישנו קושי רגשי שקשור לתחום שהיית רוצה לעסוק בו? (דימוי עצמי נמוך, לחצים ועוד)",
          "האם אתה מחשיב את עצמך כאדם ורבאלי?",
          "האם יש לך רצון לעסוק בתחומי הטיפול או החינוך?",
          "האם את/ה מעוניין/ת במידע אובייקטיבי ומבוסס מבחנים לגבי התאמה מקצועית?",
          "האם אתה מחפש כיוון לימודי או מקצועי?",
        ]} checked={empAChecked.map((v, i) => v ? i : -1).filter(i => i >= 0)}
          onChange={(i, v) => setEmpAChecked((p) => { const n = [...p]; n[i] = v; return n; })} />
        <NavRow onBack={() => setScreen("f3-type")}
          onNext={() => { updF({ empAItems: empAChecked }); nextDomain(); }} />
      </Card>
    </Layout>
  );

  if (screen === "f3-b") return (
    <Layout screen={screen}>
      <Card badge="שאלון תעסוקתי">
        <p className="mb-3 font-semibold text-[#1a3a5c]">סמן/י את הרלוונטי לך:</p>
        <CheckList items={[
          "האם חש/ה כי ישנו קושי רגשי שקשור לתחום העבודה שלך? (דימוי עצמי נמוך, לחצים ועוד)",
          "האם יש תחושה של שחיקה בעבודה, רצון לשינוי, אבל לא ברור מה הבעיה או מה הכיוון?",
          "האם יש ענין לבחון כיוונים תעסוקתיים חדשים?",
          "האם את/ה מעוניין/ת במידע אובייקטיבי ומבוסס מבחנים לגבי התאמה מקצועית?",
        ]} checked={empBChecked.map((v, i) => v ? i : -1).filter(i => i >= 0)}
          onChange={(i, v) => setEmpBChecked((p) => { const n = [...p]; n[i] = v; return n; })} />
        <NavRow onBack={() => setScreen("f3-type")}
          onNext={() => { updF({ empBItems: empBChecked }); nextDomain(); }} />
      </Card>
    </Layout>
  );

  // ═══════════════════════════════════════════════════════
  // RELATIONSHIP DOMAIN
  // ═══════════════════════════════════════════════════════

  if (screen === "r-intake") return (
    <Layout screen={screen}>
      <Card badge="זוגיות ומשפחה">
        <p className="mb-4 font-semibold text-[#1a3a5c]">כדי להתאים את השאלות, ענה/י על השאלות הבאות:</p>
        <div className="space-y-3">
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-[#ddd6c8] bg-white p-3 text-sm transition-all hover:border-[#2e7d8c]">
            <input type="checkbox" checked={inRelationship} onChange={(e) => setInRelationship(e.target.checked)} className="h-4 w-4 accent-[#2e7d8c]" />
            <span>אני <strong>בזוגיות</strong> כרגע</span>
          </label>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-[#ddd6c8] bg-white p-3 text-sm transition-all hover:border-[#2e7d8c]">
            <input type="checkbox" checked={hasChildren} onChange={(e) => setHasChildren(e.target.checked)} className="h-4 w-4 accent-[#2e7d8c]" />
            <span>יש לי <strong>ילדים</strong></span>
          </label>
        </div>
        <NavRow onBack={() => { setDomainIdx((p) => Math.max(0, p - 1)); setScreen("domains"); }}
          onNext={() => {
            if (inRelationship) { setScreen("r1"); }
            else if (hasChildren) { setScreen("r3"); }
            else { nextDomain(); }
          }} />
      </Card>
    </Layout>
  );

  if (screen === "r1") return (
    <Layout screen={screen}>
      <Card badge="זוגיות ומשפחה">
        <p className="mb-1 font-semibold text-[#1a3a5c]">1. האם חווה <strong>קשיים בתפקוד המיני</strong>?</p>
        <YesNo onYes={() => { updR({ r1: true, r1InRelationship: true }); setScreen("r1-scale"); }}
          onNo={() => { updR({ r1: false, r1InRelationship: true }); setScreen("r1-scale"); }} />
      </Card>
    </Layout>
  );

  if (screen === "r1-scale") return (
    <Layout screen={screen}>
      <Card badge="זוגיות ומשפחה">
        <p className="mb-3 font-semibold text-[#1a3a5c]">2. עד כמה את/ה חווה קושי בזוגיות? (1=כלל לא, 7=קושי גדול מאוד)</p>
        <ScaleRow label="" group="couple" values={[1,2,3,4,5,6,7]} value={coupleScale} onChange={setCoupleScale} />
        <NavRow onBack={() => setScreen("r1")}
          onNext={() => {
            updR({ coupleScale, coupleInRelationship: true });
            if (coupleScale >= 3) { setScreen("r2-q"); }
            else if (hasChildren) { setScreen("r3"); }
            else { nextDomain(); }
          }}
          nextDisabled={coupleScale === 0} />
      </Card>
    </Layout>
  );

  if (screen === "r2-q") return (
    <Layout screen={screen}>
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
            updR({ eftScores, dynScores, structScores });
            if (hasChildren) { setScreen("r3"); } else { nextDomain(); }
          }} />
      </Card>
    </Layout>
  );

  if (screen === "r3") return (
    <Layout screen={screen}>
      <Card badge="זוגיות ומשפחה">
        <p className="mb-1 font-semibold text-[#1a3a5c]">{inRelationship ? "3." : "1."} האם יש <strong>קונפליקטים מתמשכים בתא המשפחתי</strong>, או בעיות התנהגות / קשיים חברתיים של הילדים?</p>
        <YesNo onYes={() => { updR({ r3: true }); setScreen("r3-partner"); }}
          onNo={() => { updR({ r3: false }); nextDomain(); }} />
      </Card>
    </Layout>
  );

  if (screen === "r3-partner") return (
    <Layout screen={screen}>
      <Card badge="זוגיות ומשפחה">
        <p className="mb-1 font-semibold text-[#1a3a5c]">האם הבעיה משפיעה על כלל בני המשפחה וכולם מוכנים לשתף פעולה עם טיפול?</p>
        <YesNo onYes={() => { updR({ r3WithPartner: true }); nextDomain(); }}
          onNo={() => { updR({ r3WithPartner: false }); nextDomain(); }} />
      </Card>
    </Layout>
  );

  // ═══════════════════════════════════════════════════════
  // ADDICTION DOMAIN
  // ═══════════════════════════════════════════════════════

  if (screen === "a-types") return (
    <Layout screen={screen}>
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
                  className="h-4 w-4 accent-[#2e7d8c]" />
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
    const SUB_ITEMS = ["שתיית אלכוהול יתרה","שימוש בסמים","תלות בכדורי שינה/הרגעה","שימוש בסמי מרשם שלא לפי הוראות","ירידה בתפקוד בגלל שימוש","ניסיונות כושלים להפסיק","המשך שימוש למרות נזקים בריאותיים","בעיות חברתיות/משפחתיות בגלל שימוש","מינון גדל עם הזמן"];
    return (
      <Layout screen={screen}>
        <Card badge="שאלון חומרים ממכרים">
          <p className="mb-3 font-semibold text-[#1a3a5c]">סמן/י כן לתסמינים הרלוונטיים:</p>
          <CheckList items={SUB_ITEMS} checked={substanceChecked}
            onChange={(i,v) => setSubstanceChecked((p) => v ? [...p,i] : p.filter((x) => x !== i))} />
          <NavRow onBack={() => setScreen("a-types")} onNext={() => { updA({ substanceCount: substanceChecked.length }); nextAddiction(); }} />
        </Card>
      </Layout>
    );
  }

  if (screen === "a-gaming") {
    const GAME_ITEMS = ["עיסוק יתר במשחקים גם כשאינך משחק/ת","עצבנות/חרדה כשאין גישה למשחקים","צורך לשחק זמן רב יותר לאותה הנאה","ניסיונות כושלים לצמצם זמן משחק","הזנחת חיי חברה/לימודים/עבודה","המשך למרות בעיות","שקרים להסתיר מידת המשחק","משחק לברוח מרגשות שליליים","סיכון קשרים/הזדמנויות בשל משחקים"];
    return (
      <Layout screen={screen}>
        <Card badge="שאלון התמכרות למשחקים">
          <p className="mb-3 font-semibold text-[#1a3a5c]">סמן/י כן לתסמינים הרלוונטיים:</p>
          <CheckList items={GAME_ITEMS} checked={gamingChecked}
            onChange={(i,v) => setGamingChecked((p) => v ? [...p,i] : p.filter((x) => x !== i))} />
          <NavRow onBack={() => setScreen("a-types")} onNext={() => { updA({ gamingCount: gamingChecked.length }); nextAddiction(); }} />
        </Card>
      </Layout>
    );
  }

  if (screen === "a-porn-type") return (
    <Layout screen={screen}>
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
    <Layout screen={screen}>
      <Card badge="שאלון פורנוגרפיה">
        <p className="mb-3 font-semibold text-[#1a3a5c]">עד כמה כל היגד מתאר אותך? (1=כלל לא, 7=מאוד)</p>
        {qItems.porn.map((item, i) => (
          <ScaleRow key={i} label={item} group={`porn-${i}`} values={[1,2,3,4,5,6,7]} value={pornScores[i]}
            onChange={(v) => setPornScores((p) => { const n = [...p]; n[i] = v; return n; })} />
        ))}
        <NavRow onBack={() => setScreen("a-porn-type")} onNext={() => { updA({ pornScores }); nextAddiction(); }} />
      </Card>
    </Layout>
  );

  if (screen === "a-sex-q") {
    const SAST_ITEMS = [
      "האם חווית התעללות מינית בילדותך או בגיל ההתבגרות?",
      "האם נרשמת או רכשת באופן קבוע מגזינים עם תוכן מיני מפורש?",
      "האם להוריך היו בעיות בהתנהגות מינית?",
      "האם לעיתים קרובות אתה מוצא את עצמך טרוד במחשבות מיניות?",
      "האם אתה מרגיש שהתנהגותך המינית אינה נורמלית?",
      "האם בן/בת הזוג שלך דואגים או מתלוננים על התנהגותך המינית?",
      "האם יש לך קושי להפסיק התנהגות מינית כשאתה יודע שהיא אינה ראויה?",
      "האם אי פעם הרגשת רע לגבי ההתנהגות המינית שלך?",
      "האם התנהגותך המינית יצרה אי פעם בעיות עבורך ועבור משפחתך?",
      "האם אי פעם חיפשת עזרה בשל התנהגות מינית שלא אהבת?",
      "האם אי פעם דאגת שאנשים יגלו על הפעילויות המיניות שלך?",
      "האם מישהו נפגע רגשית בגלל ההתנהגות המינית שלך?",
      "האם חלק מהפעילויות המיניות שלך אינן חוקיות?",
      "האם הבטחת לעצמך להפסיק סוג מסוים של פעילות מינית ונכשלת?",
      "האם ניסית להפסיק סוג מסוים של פעילות מינית ונכשלת?",
      "האם אתה מסתיר חלק מהתנהגויותיך המיניות מאחרים?",
      "האם ניסית להפסיק חלק מהפעילויות המיניות שלך?",
      "האם אי פעם הרגשת מושפל בגלל ההתנהגות המינית שלך?",
      "האם מין היה עבורך דרך לברוח מבעיות?",
      "כאשר אתה מקיים יחסי מין, האם אתה מרגיש מדוכא לאחר מכן?",
      "האם הרגשת צורך להפסיק סוג מסוים של פעילות מינית?",
      "האם הפעילות המינית שלך השפיעה לרעה על חיי המשפחה שלך?",
      "האם היית מעורב בפעילות מינית עם קטינים?",
      "האם אתה מרגיש שהיצר המיני שלך שולט בך?",
      "האם אתה מרגיש שלפעמים היצר המיני שלך חזק ממך?",
    ];
    return (
      <Layout screen={screen}>
        <Card badge="שאלון התמכרות מינית (SAST)">
          <p className="mb-3 font-semibold text-[#1a3a5c]">סמן/י את המשפטים שאתה מסכים אליהם:</p>
          <CheckList items={SAST_ITEMS} checked={sastChecked}
            onChange={(i,v) => setSastChecked((p) => v ? [...p,i] : p.filter((x) => x !== i))} />
          <NavRow onBack={() => setScreen("a-porn-type")} onNext={() => { updA({ sastCount: sastChecked.length }); nextAddiction(); }} />
        </Card>
      </Layout>
    );
  }

  if (screen === "a-gambling") {
    const GAMBLE_ITEMS = ["מרגיש/ה צורך להמר בסכומים גדלים","מנסה להשיג בחזרה כסף שאבד","שיקרתי על היקף ההימורים","הימורים גרמו לבעיות כלכליות","הימורים פגעו ביחסים עם הקרובים","נמנע/ת מחברים/משפחה בגלל הימורים","מרגיש/ה חוסר שקט כשלא מהמר/ת","הימורים כבריחה מבעיות","ניסיתי להפסיק ולא הצלחתי"];
    return (
      <Layout screen={screen}>
        <Card badge="שאלון הימורים">
          <CheckList items={GAMBLE_ITEMS} checked={gamblingChecked}
            onChange={(i,v) => setGamblingChecked((p) => v ? [...p,i] : p.filter((x) => x !== i))} />
          <NavRow onBack={() => setScreen("a-types")} onNext={() => { updA({ gamblingYes: gamblingChecked.length }); nextAddiction(); }} />
        </Card>
      </Layout>
    );
  }

  if (screen === "a-phone") return (
    <Layout screen={screen}>
      <Card badge="שאלון טלפון סלולארי">
        <p className="mb-3 font-semibold text-[#1a3a5c]">עד כמה כל היגד מתאר אותך? (1=לא מסכים/ה, 6=מסכים/ה מאוד)</p>
        {qItems.phone.map((item, i) => (
          <ScaleRow key={i} label={item} group={`phone-${i}`} values={[1,2,3,4,5,6]} value={phoneScores[i]}
            onChange={(v) => setPhoneScores((p) => { const n = [...p]; n[i] = v; return n; })} />
        ))}
        <NavRow onBack={() => setScreen("a-types")} onNext={() => { updA({ phoneScores }); nextAddiction(); }} />
      </Card>
    </Layout>
  );

  // ═══════════════════════════════════════════════════════
  // SCORING / RESULTS
  // ═══════════════════════════════════════════════════════

  if (screen === "scoring") return (
    <Layout screen={screen}>
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

    // קבץ לפי treatment — דחוף תמיד נשאר לבד
    const groups: { treatment: string; treatmentLabel: string; recs: typeof recs; urgent: boolean }[] = [];
    recs.forEach((rec) => {
      if (rec.urgent) {
        groups.push({ treatment: rec.treatment, treatmentLabel: rec.treatmentLabel, recs: [rec], urgent: true });
        return;
      }
      const existing = groups.find((g) => !g.urgent && g.treatment === rec.treatment);
      if (existing) existing.recs.push(rec);
      else groups.push({ treatment: rec.treatment, treatmentLabel: rec.treatmentLabel, recs: [rec], urgent: false });
    });

    const multipleGroups = groups.filter((g) => !g.urgent).length > 1;
    const emotionalGroups = groups.filter((g) => !g.urgent && g.recs[0]?.domain === "מורכבויות בתחום הרגשי/האישי");
    const showCombined = emotionalGroups.length >= 2;

    return (
      <Layout screen={screen}>
        <div className="rounded-2xl bg-[#1a3a5c] p-6 text-white">
          <div className="mb-4 flex justify-center">
            <img src="/logo.svg.png" alt="Mentalytics" className="h-14 w-auto" />
          </div>
          <h2 className="mb-1 text-2xl font-black" style={{ fontFamily: "serif" }}>תוצאות השאלון</h2>
          <p className="mb-4 text-sm opacity-75">לחץ/י על אחד מהממצאים כדי לחפש מטפל מתאים</p>
          {err && <p className="mb-3 rounded-lg bg-red-800 p-3 text-sm">{err}</p>}
          {recs.length === 0 && (
            <div className="rounded-xl bg-white/10 p-4 text-sm space-y-3">
              <p>לא נמצאו ממצאים מובהקים בשאלון. מומלץ לפנות לטיפול פסיכודינאמי לצורך עיבוד והבנת הקשיים.</p>
              <button
                type="button"
                onClick={() => {
                  setSelectedRec({ id: "default", symptomText: "לא נמצאו ממצאים מובהקים", treatment: "טיפול דינאמי", treatmentLabel: "טיפול דינאמי", domain: "מורכבויות בתחום הרגשי/האישי", urgent: false });
                  setCombinedTreatments(null);
                  setScreen("match-form");
                }}
                className="w-full rounded-xl border-r-4 border-[#8ecfdb] bg-white/10 p-4 text-right transition-all hover:bg-white/20"
              >
                <div className="mb-1 text-xs font-bold uppercase tracking-wide text-[#8ecfdb]">מורכבויות בתחום הרגשי/האישי</div>
                <div className="font-semibold">לא נמצאו ממצאים מובהקים — לחץ/י להפנייה למטפל</div>
                <div className="mt-2 inline-block rounded-lg bg-white/20 px-3 py-1 text-xs font-bold">→ טיפול דינאמי</div>
              </button>
            </div>
          )}
          {multipleGroups && (
            <div className="mb-4 rounded-xl border border-yellow-400/40 bg-yellow-900/20 p-4 text-sm leading-relaxed text-yellow-100">
              📌 שים/י לב: נמצאו מספר סימנים עם הפניות שונות. המערכת סיננה את הפחות דחופות כך שבפניך מופיעות ההפניות העיקריות. יש לפנות ע"פ הקושי המשמעותי ביותר שאת/ה חווה.
            </div>
          )}
          <div className="space-y-3">
            {groups.map((group) => {
              const firstRec = group.recs[0];
              const tools = group.recs.find((r) => r.tools)?.tools;
              const notes = group.recs.find((r) => r.notes)?.notes;
              return (
                <button key={group.treatment + (group.urgent ? "-urgent" : "")} type="button"
                  onClick={() => { setSelectedRec(firstRec); setCombinedTreatments(null); setScreen("match-form"); (window as any).gtag?.("event", "matching_click", { treatment: group.treatment }); }}
                  className={`w-full rounded-xl p-4 text-right transition-all hover:scale-[1.01] ${group.urgent ? "border-r-4 border-red-400 bg-red-900/30 hover:bg-red-900/40" : "border-r-4 border-[#8ecfdb] bg-white/10 hover:bg-white/20"}`}>
                  <div className={`mb-1 text-xs font-bold uppercase tracking-wide ${group.urgent ? "text-red-300" : "text-[#8ecfdb]"}`}>
                    {firstRec.domain} {group.urgent && "⚠️"}
                  </div>
                  {group.recs.length === 1 ? (
                    <div className="font-semibold">{firstRec.symptomText}</div>
                  ) : (
                    <ul className="mb-1 space-y-1">
                      {group.recs.map((r) => (
                        <li key={r.id} className="flex items-start gap-2 font-semibold">
                          <span className="mt-1 text-[#8ecfdb]">•</span>{r.symptomText}
                        </li>
                      ))}
                    </ul>
                  )}
                  {notes && <div className="mt-1 text-xs opacity-75">{notes}</div>}
                  {tools && (
                    <div className="mt-3 rounded-xl border border-amber-400/40 bg-amber-900/20 p-3 text-right">
                      <div className="mb-1 text-xs font-bold uppercase tracking-wide text-amber-300">🛠 כלים להתמודדות</div>
                      <div className="whitespace-pre-wrap text-xs leading-relaxed text-amber-100">{tools}</div>
                    </div>
                  )}
                  <div className="mt-2 inline-block rounded-lg bg-white/20 px-3 py-1 text-xs font-bold">
                    → {group.treatmentLabel}
                  </div>
                </button>
              );
            })}
          </div>
          {showCombined && (
            <button
              type="button"
              onClick={() => {
                setCombinedTreatments(emotionalGroups.map(g => g.treatment));
                setCombinedLabels(emotionalGroups.map(g => g.treatmentLabel));
                setSelectedRec(null);
                setScreen("match-form");
                (window as any).gtag?.("event", "matching_click", { treatment: "combined_emotional" });
              }}
              className="mt-3 w-full rounded-xl border-2 border-[#8ecfdb] bg-white/5 p-4 text-right transition-all hover:bg-white/15"
            >
              <div className="mb-1 text-xs font-bold uppercase tracking-wide text-[#8ecfdb]">חיפוש מתקדם ✦</div>
              <div className="font-semibold">חיפוש משולב — כל הצרכים הרגשיים</div>
              <div className="mt-1 text-xs opacity-70">מציאת מטפל שמכסה את מירב הצרכים שעלו: {emotionalGroups.map(g => g.treatmentLabel).join(", ")}</div>
            </button>
          )}
          <div className="mt-5 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-xs leading-6 text-white/70">
            התוצאות מבוססות על תשובותיך לשאלון ומהוות הערכה כללית בלבד.<br />
            אין לראות בתוצאות אלו אבחון, המלצה טיפולית מחייבת או תחליף לייעוץ מקצועי.<br />
            מומלץ לפנות לאיש מקצוע מוסמך לצורך הערכה מלאה.
          </div>
          <p className="mt-3 text-center text-xs opacity-50">טיפול חכם</p>
          <div className="mt-4 flex justify-center print:hidden">
            <button onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl border border-white/40 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">
              💾 שמירה כ-PDF
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  if (screen === "match-form") return (
    <Layout screen={screen}>
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
          <input type="checkbox" checked={matchPrefs.online} onChange={(e) => setMatchPrefs((p) => ({ ...p, online: e.target.checked }))} className="accent-[#2e7d8c]" />
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
                className="accent-[#2e7d8c]" />
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
                className="accent-[#2e7d8c]" />
              {cp}
            </label>
          ))}
        </div>

        {err && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</p>}

        <NavRow onBack={() => { setScreen("results"); setCombinedTreatments(null); setCombinedLabels(null); }}
          onNext={doMatch}
          nextLabel={loading ? "מחפש..." : "חפש/י מטפל ▸"}
          nextDisabled={loading} />
      </Card>
    </Layout>
  );

  if (screen === "match-results") return (
    <Layout screen={screen}>
      {/* ── Modal פרופיל מלא ── */}
      {selectedTherapist && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedTherapist(null)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl text-right"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedTherapist(null)}
              className="absolute left-4 top-4 text-gray-400 hover:text-gray-700 text-xl font-bold"
            >✕</button>

            {/* תמונה + שם */}
            <div className="flex items-center gap-4 mb-4">
              <img
                src={selectedTherapist.profile_photo_url || (selectedTherapist.gender === "נקבה" ? "/avatar-female.svg" : "/avatar-male.svg")}
                alt={selectedTherapist.full_name ?? ""}
                className="h-20 w-20 flex-shrink-0 rounded-xl object-cover"
              />
              <div>
                <h2 className="text-xl font-bold text-[#1a3a5c]">{selectedTherapist.full_name || "ללא שם"}</h2>
                <p className="text-sm text-gray-500 mt-0.5">{selectedTherapist.gender} • {selectedTherapist.online ? "🌐 אונליין" : "📍 פנים אל פנים"}</p>
              </div>
            </div>

            {/* ציונים */}
            <div className="flex flex-wrap gap-2 mb-4">
              <div className={`rounded-full px-3 py-1 text-xs font-bold text-white ${
                (selectedTherapist.combined_score ?? selectedTherapist.match_score) >= 85 ? "bg-[#1a3a5c]" :
                (selectedTherapist.combined_score ?? selectedTherapist.match_score) >= 70 ? "bg-[#2a5a8c]" :
                (selectedTherapist.combined_score ?? selectedTherapist.match_score) >= 55 ? "bg-amber-700" : "bg-gray-500"
              }`}>✦ התאמה כוללת: {selectedTherapist.combined_score ?? selectedTherapist.match_score}%</div>
              <div className="rounded-full border border-[#1a3a5c] px-3 py-1 text-xs font-semibold text-[#1a3a5c]">
                מקצועי: {selectedTherapist.match_score}%
              </div>
              {selectedTherapist.personality_score != null && (
                <div className={`rounded-full px-3 py-1 text-xs font-semibold text-white ${
                  selectedTherapist.personality_score >= 85 ? "bg-emerald-600" :
                  selectedTherapist.personality_score >= 70 ? "bg-teal-600" :
                  selectedTherapist.personality_score >= 55 ? "bg-amber-600" : "bg-gray-500"
                }`}>אישיותי: {selectedTherapist.personality_score}%</div>
              )}
            </div>

            {/* ביו */}
            {selectedTherapist.bio && (
              <div className="mb-4">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">כמה מילים עלי</div>
                <p className="text-sm text-gray-700 leading-6">{selectedTherapist.bio}</p>
              </div>
            )}

            {/* סוגי מטפל */}
            {selectedTherapist.therapist_types?.length > 0 && (
              <div className="mb-4">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">הכשרה</div>
                <div className="flex flex-wrap gap-1">
                  {(Array.isArray(selectedTherapist.therapist_types) ? selectedTherapist.therapist_types : [selectedTherapist.therapist_types]).map((t: string, i: number) => (
                    <span key={i} className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs text-blue-800">{genderTitle(t, selectedTherapist.gender)}</span>
                  ))}
                </div>
              </div>
            )}

            {/* תחומי הכשרה */}
            {selectedTherapist.training_areas?.length > 0 && (
              <div className="mb-4">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">תחומי טיפול</div>
                <div className="flex flex-wrap gap-1">
                  {(Array.isArray(selectedTherapist.training_areas) ? selectedTherapist.training_areas : [selectedTherapist.training_areas]).map((t: string, i: number) => (
                    <span key={i} className="rounded-full bg-teal-50 border border-teal-200 px-2 py-0.5 text-xs text-teal-800">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* אזורים */}
            {selectedTherapist.regions?.length > 0 && (
              <div className="mb-4">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">אזורי פעילות</div>
                <div className="flex flex-wrap gap-1">
                  {(Array.isArray(selectedTherapist.regions) ? selectedTherapist.regions : [selectedTherapist.regions]).map((r: string, i: number) => (
                    <span key={i} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">📍 {r}</span>
                  ))}
                </div>
              </div>
            )}

            {/* הסדרים */}
            {selectedTherapist.arrangements?.length > 0 && (
              <div className="mb-4">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">הסדרים</div>
                <div className="flex flex-wrap gap-1">
                  {(Array.isArray(selectedTherapist.arrangements) ? selectedTherapist.arrangements : [selectedTherapist.arrangements]).map((a: string, i: number) => (
                    <span key={i} className="rounded-full bg-purple-50 border border-purple-200 px-2 py-0.5 text-xs text-purple-800">{a}</span>
                  ))}
                </div>
              </div>
            )}

            {/* סיבות התאמה */}
            {selectedTherapist.match_reasons?.length > 0 && (
              <div className="mb-2">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">סיבות ההתאמה</div>
                <div className="flex flex-wrap gap-1">
                  {selectedTherapist.match_reasons.map((r: string, i: number) => (
                    <span key={i} className="rounded-full bg-[#e0f4fa] px-2 py-0.5 text-xs text-[#2e7d8c]">{r}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mb-4">
        <button type="button" onClick={() => { setScreen("results"); setCombinedTreatments(null); setCombinedLabels(null); }} className="text-sm text-[#2e7d8c] hover:underline">
          ◂ חזרה לתוצאות
        </button>
      </div>
      <h2 className="mb-4 text-xl font-bold text-[#1a3a5c]">מטפלים מומלצים – {selectedRec?.treatmentLabel}</h2>
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
        {(matchResults ?? []).map((t: any) => (
          <div key={t.id} className="rounded-2xl bg-white p-5 shadow-lg cursor-pointer hover:shadow-xl transition-shadow" onClick={() => setSelectedTherapist(t)}>
            <div className="flex items-start gap-4">
              <img
                src={t.profile_photo_url || (t.gender === "נקבה" ? "/avatar-female.svg" : "/avatar-male.svg")}
                alt={t.full_name ?? ""}
                className="h-16 w-16 flex-shrink-0 rounded-xl object-cover"
              />
              <div className="flex-1 text-right">
                <h3 className="text-lg font-bold text-[#1a3a5c]">{t.full_name || "ללא שם"}</h3>
                <p className="text-xs text-[#6b7280]">{t.gender} • {t.online ? "אונליין" : "פנים אל פנים"}</p>
                {t.bio && <p className="mt-1 text-sm text-gray-700 line-clamp-2">{t.bio}</p>}
                {t.regions?.length > 0 && (
                  <p className="mt-1 text-xs text-gray-500">📍 {(Array.isArray(t.regions) ? t.regions : [t.regions]).join(", ")}</p>
                )}
                {t.match_reasons?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {t.match_reasons.map((r: string, i: number) => (
                      <span key={i} className="rounded-full bg-[#e0f4fa] px-2 py-0.5 text-xs text-[#2e7d8c]">{r}</span>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-2 items-center">
                  <div className={`inline-block rounded-full px-3 py-1 text-xs font-bold text-white ${
                    (t.combined_score ?? t.match_score) >= 85 ? "bg-[#1a3a5c]" :
                    (t.combined_score ?? t.match_score) >= 70 ? "bg-[#2a5a8c]" :
                    (t.combined_score ?? t.match_score) >= 55 ? "bg-amber-700" : "bg-gray-500"
                  }`}>
                    ✦ התאמה כוללת: {t.combined_score ?? t.match_score}%
                  </div>
                  <div className="inline-block rounded-full border border-[#1a3a5c] px-3 py-1 text-xs font-semibold text-[#1a3a5c]">
                    מקצועי: {t.match_score}%
                  </div>
                  {t.personality_score != null && (
                    <div className={`inline-block rounded-full px-3 py-1 text-xs font-semibold text-white ${
                      t.personality_score >= 85 ? "bg-emerald-600" :
                      t.personality_score >= 70 ? "bg-teal-600" :
                      t.personality_score >= 55 ? "bg-amber-600" : "bg-gray-500"
                    }`}>
                      אישיותי: {t.personality_score}%
                    </div>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2" onClick={e => e.stopPropagation()}>
                  {t.phone && (
                    <a href={`https://wa.me/972${t.phone.replace(/^0/, "").replace(/[-\s]/g, "")}?text=${encodeURIComponent('שלום, הגעתי אלייך דרך אתר "טיפול חכם", אשמח לשמוע פרטים לגבי הטיפול')}`}
                      target="_blank" rel="noopener noreferrer"
                      onClick={() => trackClick(t.id, "whatsapp")}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-green-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-600">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      וואטסאפ
                    </a>
                  )}
                  {t.phone && (
                    <a href={`tel:${t.phone}`}
                      onClick={() => trackClick(t.id, "phone")}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-stone-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-stone-700">
                      📞 התקשרו
                    </a>
                  )}
                  {t.email && (
                    <a href={`mailto:${t.email}?subject=פנייה דרך אתר טיפול חכם&body=${encodeURIComponent('שלום, הגעתי אלייך דרך אתר "טיפול חכם", אשמח לשמוע פרטים לגבי הטיפול')}`}
                      onClick={() => trackClick(t.id, "email")}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#2e7d8c] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
                      ✉ מייל
                    </a>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); fetchExplanation(t); }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#1a3a5c] px-3 py-1.5 text-xs font-semibold text-[#1a3a5c] hover:bg-[#f0f6ff]"
                  >
                    {explainLoading[t.id] ? "טוען..." : "✦ למה זה מתאים לי?"}
                  </button>
                </div>
                {explainData[t.id] && (
                  <div className="mt-3 rounded-xl bg-[#f0f8ff] border border-[#c0dff0] p-3 text-right" onClick={e => e.stopPropagation()}>
                    <p className="text-xs font-bold text-[#1a3a5c] mb-1">{explainData[t.id]!.title}</p>
                    <p className="text-xs text-gray-700 mb-2 leading-relaxed">{explainData[t.id]!.explanation}</p>
                    <p className="text-[10px] text-gray-400">{explainData[t.id]!.tone_note}</p>
                  </div>
                )}
                <p className="mt-2 text-xs text-[#2e7d8c] font-semibold">לפרטים נוספים ◂</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );

  return (
    <Layout screen={screen}>
      <Card>
        <div className="py-8 text-center">
          <p className="text-[#6b7280]">טוען...</p>
        </div>
      </Card>
    </Layout>
  );
}
