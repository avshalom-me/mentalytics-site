// Client-side transformer that converts the flat KidsBox[] returned by the
// score API into structured KidsRecommendation[] grouped by treatment.
//
// The score server emits boxes in a predictable order:
//   purple "📊 …"   → symptom(s) header for the next group
//   info   "✅ …"   → referral/treatment for the current group
//   info   "📌 …"   → tools/practices for the current group
//   warn/danger     → urgent standalone notes (vision/hearing/suicidal/etc.)
//
// The transform groups consecutive boxes that share a symptom block, then
// merges across groups by treatment so identical recommendations collapse.

export type BoxCls = "info" | "warn" | "danger" | "purple" | "ok";
export interface KidsBox { cls: BoxCls; txt: string; isLowStress?: boolean; }

export type RecKind = "treatment" | "assessment" | "external" | "professional";

export interface KidsRecommendation {
  id: string;
  domain: string;
  symptoms: string[];           // raw symptom phrases (without 📊 prefix)
  kind: RecKind;
  treatmentKey: string;         // canonical key for grouping/matching (e.g. "פסיכו-דידקטי")
  treatmentLabel: string;       // human-readable for display
  referralText: string;         // full original referral text (without ✅ prefix)
  notes?: string;               // extra context appended to the referral (e.g. "בעדיפות ל…")
  tools: KidsTool[];            // tools tied to this group
  urgent: boolean;
}

export interface KidsTool {
  text: string;                 // tool body (with 📌 prefix preserved)
  sourceSymptom?: string;       // best-effort match — which symptom triggered this tool
}

export interface KidsDomainResult {
  groups: KidsRecommendationGroup[];     // recommendations bucketed by treatmentKey
  externalNotes: string[];               // cross-domain notes / counselor footer / multi-ref notice
  standaloneWarnings: KidsWarning[];     // vision/hearing/etc. — no treatment, just info
}

export interface KidsRecommendationGroup {
  treatmentKey: string;
  treatmentLabel: string;
  kind: RecKind;
  urgent: boolean;
  recs: KidsRecommendation[];   // each rec contributes its symptoms to the group
}

export interface KidsWarning {
  text: string;                 // raw warning text (prefix preserved)
  urgent: boolean;
}

// ── Treatment classification ─────────────────────────────────────────────────

// Known assessment keys (must mirror ASSESSMENT_TYPES in therapist-options.ts)
const ASSESSMENT_PATTERNS: { rx: RegExp; key: string; label: string }[] = [
  { rx: /פסיכו.?דידקטי/, key: "פסיכו-דידקטי", label: "אבחון פסיכו-דידקטי" },
  { rx: /פסיכו.?דיאגנוסטי/, key: "פסיכו-דיאגנוסטי", label: "אבחון פסיכו-דיאגנוסטי" },
  { rx: /נוירו.?פסיכולוגי/, key: "נוירו-פסיכולוגי", label: "אבחון נוירו-פסיכולוגי" },
  { rx: /אבחון תעסוקתי/, key: "אבחון תעסוקתי", label: "אבחון תעסוקתי" },
  { rx: /הערכה פסיכולוגית/, key: "הערכה פסיכולוגית", label: "הערכה פסיכולוגית" },
  { rx: /הערכת בשלות לגן/, key: "הערכת בשלות לגן", label: "הערכת בשלות לגן" },
  { rx: /אבחון קשיי תקשורת|אבחון.*ASD/i, key: "אבחון קשיי תקשורת ASD", label: "אבחון קשיי תקשורת / ASD" },
];

// Treatments offered by therapists in our DB (must mirror TREATMENT_TYPES / training_areas)
const TREATMENT_PATTERNS: { rx: RegExp; key: string; label: string }[] = [
  { rx: /טיפול CBT.*חרדת היפרדות/, key: "CBT", label: "טיפול CBT לחרדת היפרדות" },
  { rx: /טיפול CBT.*חרדה/, key: "CBT", label: "טיפול CBT לחרדה" },
  { rx: /טיפול CBT.*התמכר/, key: "CBT", label: "טיפול CBT בהתמכרויות" },
  { rx: /\bCBT\b/, key: "CBT", label: "טיפול CBT" },
  { rx: /טיפול דינאמי בטראומה/, key: "טיפול דינאמי", label: "טיפול דינאמי בטראומה" },
  { rx: /(טיפול\s+)?פסיכודינאמי|טיפול דינאמי/, key: "טיפול דינאמי", label: "טיפול דינאמי" },
  { rx: /\bDBT\b/, key: "DBT", label: "טיפול DBT" },
  { rx: /\bEMDR\b/, key: "EMDR", label: "טיפול EMDR" },
  { rx: /\bCPT\b/, key: "CPT", label: "טיפול CPT" },
  { rx: /COG[-\s]?FUN/i, key: "טיפול COG-FUN לקשיי קשב וריכוז", label: "טיפול COG-FUN" },
  { rx: /הדרכת הורים טיפולית/, key: "הדרכת הורים טיפולית", label: "הדרכת הורים טיפולית" },
  { rx: /הדרכת הורים/, key: "הדרכת הורים", label: "הדרכת הורים" },
  { rx: /טיפול דיאדי/, key: "טיפול דיאדי", label: "טיפול דיאדי" },
  { rx: /טיפול בהבעה ויצירה/, key: "טיפול בהבעה ויצירה", label: "טיפול בהבעה ויצירה" },
  { rx: /קבוצה חברתית/, key: "קבוצה חברתית", label: "קבוצה חברתית" },
  { rx: /טיפול ויסות חושי|ריפוי בעיסוק|מרפאה בעיסוק/, key: "ריפוי בעיסוק", label: "ריפוי בעיסוק" },
  { rx: /קלינאית תקשורת|קלינאי תקשורת/, key: "קלינאית תקשורת", label: "קלינאית תקשורת" },
  { rx: /פיזיותרפיסטית רצפת אגן|פיזיותרפיה.*רצפת אגן/, key: "פיזיותרפיה רצפת אגן", label: "פיזיותרפיה רצפת אגן ילדים" },
  { rx: /טיפול בהתמכר/, key: "טיפול בהתמכרויות", label: "טיפול בהתמכרויות" },
  { rx: /טיפול תעסוקתי/, key: "טיפול תעסוקתי", label: "טיפול תעסוקתי" },
  { rx: /טיפול בהפרעות אכילה/, key: "טיפול בהפרעות אכילה", label: "טיפול בהפרעות אכילה" },
  { rx: /טיפול באנקופרזיס/, key: "טיפול באנקופרזיס", label: "טיפול באנקופרזיס" },
];

// Professional types — clinicians whose primary identifier is the professional
// type (matched against `therapist_types`), not a training area. These get a
// hard-filter search button that returns ONLY therapists of this type.
const PROFESSIONAL_PATTERNS: { rx: RegExp; key: string; label: string }[] = [
  { rx: /דיאטנית קלינית|דיאטנ\/?ית קליני\/?ת/, key: "דיאטנ/ית קליני/ת", label: "דיאטנ/ית קליני/ת" },
];

// External referrals — clinicians/doctors not in our DB (no search button)
const EXTERNAL_PATTERNS: { rx: RegExp; key: string; label: string }[] = [
  { rx: /נוירולוג|רופא ילדים המומחה בקשיי קשב/, key: "נוירולוג קשב", label: "פנייה לנוירולוג / רופא ילדים מומחה בקשיי קשב" },
  { rx: /אופטומטריסט|רופא עיניים/, key: "בדיקת ראייה", label: "בדיקת ראייה" },
  { rx: /רופא אא.?ג/, key: "בדיקת שמיעה", label: "בדיקת שמיעה" },
  { rx: /אורולוג ילדים/, key: "אורולוג ילדים", label: "פנייה לאורולוג ילדים" },
  { rx: /גסטרולוג ילדים/, key: "גסטרולוג ילדים", label: "פנייה לגסטרולוג ילדים" },
  { rx: /רופא משפחה|רופא.ת המשפחה|רופא הילדים/, key: "רופא משפחה", label: "פנייה לרופא המשפחה / ילדים" },
  { rx: /פסיכיאטר ילדים|פסיכיאטר/, key: "פסיכיאטר ילדים", label: "פנייה לפסיכיאטר ילדים" },
  { rx: /יועצת בית הספר|יועצת.*ופסיכולוג/, key: "יועצת בית ספר", label: "התייעצות עם יועצת בית הספר" },
  { rx: /פסיכולוג הגן|פסיכולוג בית הספר/, key: "פסיכולוג מסגרת", label: "פנייה לפסיכולוג המסגרת" },
  { rx: /פסיכולוג חינוכי|פסיכולוג התפתחותי/, key: "פסיכולוג חינוכי", label: "פנייה לפסיכולוג חינוכי / התפתחותי" },
  { rx: /פסיכולוג קליני/, key: "פסיכולוג קליני", label: "פנייה לפסיכולוג קליני" },
  { rx: /תוכנית התנהגותית/, key: "תוכנית התנהגותית", label: "תוכנית התנהגותית במסגרת החינוכית" },
  { rx: /תוכנית חיזוקים/, key: "תוכנית חיזוקים", label: "תוכנית חיזוקים בית-ספרית" },
  { rx: /שעות שילוב/, key: "שעות שילוב", label: "בדיקת זכאות לשעות שילוב" },
  { rx: /התאמות.*בגרויות|התאמות במבחנים|התאמות בבחינות/, key: "התאמות בחינה", label: "בדיקת התאמות בבחינות" },
  { rx: /הערכת סיכון/, key: "הערכת סיכון", label: "הערכת סיכון דחופה" },
];

// Heuristic: classify a referral text into kind + key + label
function classifyReferral(text: string): { kind: RecKind; key: string; label: string } {
  for (const p of ASSESSMENT_PATTERNS) if (p.rx.test(text)) return { kind: "assessment", key: p.key, label: p.label };
  // Professional-type patterns must run before TREATMENT_PATTERNS in case of
  // overlapping wording (e.g. "טיפול ע"י דיאטנית").
  for (const p of PROFESSIONAL_PATTERNS) if (p.rx.test(text)) return { kind: "professional", key: p.key, label: p.label };
  for (const p of TREATMENT_PATTERNS) if (p.rx.test(text)) return { kind: "treatment", key: p.key, label: p.label };
  for (const p of EXTERNAL_PATTERNS) if (p.rx.test(text)) return { kind: "external", key: p.key, label: p.label };
  // Fallback: short summary of the text
  const compact = text.replace(/\s+/g, " ").trim().slice(0, 80);
  return { kind: "external", key: compact || "אחר", label: compact || "המלצה כללית" };
}

// ── Tool ↔ symptom association ───────────────────────────────────────────────

const TOOL_SYMPTOM_HINTS: { rx: RegExp; symptomHint: RegExp }[] = [
  { rx: /כלים? לחיזוק חשבון|כלים? לעבודה עם קשיים במתמטיקה/, symptomHint: /חשבון|מתמטיקה/ },
  { rx: /כלים? לעבודה עם קשיים ברבי מלל/, symptomHint: /רבי מלל|הבנת הנקרא|קריאה/ },
  { rx: /כלים? לעבודה עם קשיים באנגלית/, symptomHint: /אנגלית/ },
  { rx: /כלים? לעבודה עם קשיי כתיבה/, symptomHint: /כתב יד|כתיבה/ },
  { rx: /תוכנית חיזוקים/, symptomHint: /קריאה|למידה/ },
  { rx: /להפחתת מתח|הרפיה|נשימות/, symptomHint: /חרד|מתח|פחד/ },
  { rx: /קשיים חברתיים|חיכוכים והתנגדויות/, symptomHint: /חברת|התנהגות/ },
  { rx: /תוכנית התנהגותית/, symptomHint: /התנהגות/ },
  { rx: /גמילה|התרוקנות|עצירות|הרטבה|אנקופרזיס/, symptomHint: /גמילה|התרוקנות/ },
  { rx: /אובססי|קומפולסי|OCD/i, symptomHint: /אובססי|קומפולסי/ },
  { rx: /טראומה|EMDR/i, symptomHint: /טראומה|אירוע טראומטי/ },
  { rx: /אכילה|דיאט/, symptomHint: /אכילה/ },
  { rx: /ויסות|חוש/, symptomHint: /חוש|ויסות|רגישות/ },
];

function findToolSymptom(toolText: string, symptoms: string[]): string | undefined {
  for (const hint of TOOL_SYMPTOM_HINTS) {
    if (!hint.rx.test(toolText)) continue;
    const match = symptoms.find(s => hint.symptomHint.test(s));
    if (match) return match;
  }
  return symptoms.length === 1 ? symptoms[0] : undefined;
}

// ── Box parsing ──────────────────────────────────────────────────────────────

const SYMPTOM_PREFIX = "📊";
const REF_PREFIX = "✅";
const TOOL_PREFIX = "📌";
const READING_PREFIX = "📚";
const WARN_PREFIX = "⚠️";
const URGENT_PREFIX = "🚨";

function stripPrefix(line: string, prefix: string): string {
  return line.startsWith(prefix) ? line.slice(prefix.length).trim() : line;
}

interface PendingGroup {
  symptoms: string[];
  symptomCls: BoxCls;
  refs: { kind: RecKind; key: string; label: string; text: string; notes?: string }[];
  tools: string[];
  urgent: boolean;
}

function emptyGroup(): PendingGroup {
  return { symptoms: [], symptomCls: "purple", refs: [], tools: [], urgent: false };
}

// Some referrals combine a treatment with an external auxiliary action via
// "במקביל ל…" (e.g. "טיפול דינאמי במקביל לייעוץ אצל פסיכיאטר ילדים"). Split
// such phrasings into two separate recommendations so the matching/non-matching
// classification is correct and the user can act on each part independently.
function splitParallelRefs(primary: string): string[] {
  const parts = primary.split(/\s+במקביל\s+ל/);
  if (parts.length === 1) return [primary];
  const head = parts[0].trim();
  const tail = parts.slice(1).map(p => "פנייה ל" + p.trim());
  return [head, ...tail];
}

// Parse a referral box that may contain a primary line (✅ …) followed by
// embedded notes (📌 בעדיפות ל…) on subsequent lines. Preserves blank lines
// inside notes so paragraph breaks survive to the rendered output.
function parseRefBox(text: string): { primary: string; notes?: string }[] {
  const lines = text.split(/\n/);
  const out: { primary: string; notes?: string }[] = [];
  let currentNotes: string[] = [];
  let currentPrimary: string | null = null;

  function flush() {
    if (currentPrimary !== null) {
      // Trim leading/trailing blank lines from notes; keep internal ones
      while (currentNotes.length && !currentNotes[0].trim()) currentNotes.shift();
      while (currentNotes.length && !currentNotes[currentNotes.length - 1].trim()) currentNotes.pop();
      out.push({
        primary: currentPrimary,
        notes: currentNotes.length ? currentNotes.join("\n") : undefined,
      });
      currentPrimary = null;
      currentNotes = [];
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith(REF_PREFIX)) {
      flush();
      currentPrimary = trimmed.slice(REF_PREFIX.length).trim().replace(/^הפנייה[:\s]+/, "").trim();
    } else if (currentPrimary !== null) {
      currentNotes.push(line);
    }
  }
  flush();
  return out;
}

export function parseKidsBoxes(boxes: KidsBox[], domain: string): KidsDomainResult {
  const externalNotes: string[] = [];
  const standaloneWarnings: KidsWarning[] = [];
  const allRecs: KidsRecommendation[] = [];
  let pending = emptyGroup();
  let recCounter = 0;

  function flushPending() {
    if (!pending.symptoms.length && !pending.refs.length) {
      pending = emptyGroup();
      return;
    }
    // Convert each ref into a Recommendation. Tools attach by best match.
    for (const ref of pending.refs) {
      const tools: KidsTool[] = pending.tools.map(t => ({
        text: t,
        sourceSymptom: findToolSymptom(t, pending.symptoms),
      }));
      allRecs.push({
        id: `${domain}-${recCounter++}`,
        domain,
        symptoms: [...pending.symptoms],
        kind: ref.kind,
        treatmentKey: ref.key,
        treatmentLabel: ref.label,
        referralText: ref.text,
        notes: ref.notes,
        tools,
        urgent: pending.urgent,
      });
    }
    // Symptoms with no ref (e.g. low-stress only) — emit as a "no-treatment" rec
    // so the UI can still show the symptoms.
    if (pending.symptoms.length && !pending.refs.length) {
      allRecs.push({
        id: `${domain}-${recCounter++}`,
        domain,
        symptoms: [...pending.symptoms],
        kind: "external",
        treatmentKey: "_no_action",
        treatmentLabel: "אין צורך בפעולה ספציפית",
        referralText: "",
        tools: pending.tools.map(t => ({ text: t, sourceSymptom: pending.symptoms[0] })),
        urgent: pending.urgent,
      });
    }
    pending = emptyGroup();
  }

  for (const box of boxes) {
    const txt = box.txt || "";

    // Domain header (e.g. "📚 נמצאו קשיים לימודיים — כיתות ז-ח") — skip, the UI provides its own header
    if (box.cls === "purple" && txt.startsWith(READING_PREFIX) && !txt.includes(SYMPTOM_PREFIX) && !txt.includes(REF_PREFIX)) {
      flushPending();
      continue;
    }

    // Cross-domain notes
    if (box.cls === "info" && (
      txt.startsWith("📌 חשוב לזכור") ||
      txt.startsWith("📌 ניתן להיוועץ") ||
      txt.startsWith("📌 נמצאו 3 הפניות") ||
      txt.startsWith("📅")
    )) {
      externalNotes.push(txt);
      continue;
    }

    if (box.cls === "warn" && txt.startsWith("⚠️ נמצאו מספר הפניות")) {
      externalNotes.push(txt);
      continue;
    }

    // Reading link — keep with current group as a tool/note
    if (box.cls === "info" && txt.startsWith(READING_PREFIX)) {
      pending.tools.push(txt);
      continue;
    }

    // Symptom block (purple/danger/warn with 📊)
    const hasSymptomPrefix = txt.includes(SYMPTOM_PREFIX);
    if (hasSymptomPrefix && (box.cls === "purple" || box.cls === "danger" || box.cls === "warn")) {
      flushPending();
      pending.symptomCls = box.cls;
      pending.urgent = box.cls === "danger";
      pending.symptoms = txt
        .split(/\n/)
        .map(line => stripPrefix(line.trim(), SYMPTOM_PREFIX))
        .filter(Boolean);
      continue;
    }

    // Standalone urgent warning (no 📊) — danger or warn
    if ((box.cls === "danger" || box.cls === "warn") && (txt.startsWith(WARN_PREFIX) || txt.startsWith(URGENT_PREFIX))) {
      // 🚨 (URGENT_PREFIX) is ALWAYS standalone — flush any pending group first
      // so the warning never gets glued to an unrelated treatment recommendation.
      // ⚠️ (WARN_PREFIX) attaches to the current pending group if one exists
      // (e.g. "⚠️ דווח על כאבים כרוניים" inside a current Q1 anxiety group).
      if (txt.startsWith(URGENT_PREFIX)) {
        flushPending();
        standaloneWarnings.push({ text: txt, urgent: true });
      } else if (pending.symptoms.length || pending.refs.length) {
        const cls = classifyReferral(txt);
        pending.refs.push({ kind: cls.kind, key: cls.key, label: cls.label, text: stripPrefix(txt, WARN_PREFIX) });
      } else {
        standaloneWarnings.push({ text: txt, urgent: box.cls === "danger" });
      }
      continue;
    }

    // Referral (info, ✅)
    if (box.cls === "info" && txt.includes(REF_PREFIX)) {
      const refs = parseRefBox(txt);
      for (const r of refs) {
        const splits = splitParallelRefs(r.primary);
        for (let i = 0; i < splits.length; i++) {
          const text = splits[i];
          const cls = classifyReferral(text);
          // Notes only attach to the first ref (they describe the original referral context)
          pending.refs.push({
            kind: cls.kind,
            key: cls.key,
            label: cls.label,
            text,
            notes: i === 0 ? r.notes : undefined,
          });
        }
      }
      continue;
    }

    // Tool (info, 📌)
    if (box.cls === "info" && txt.startsWith(TOOL_PREFIX)) {
      pending.tools.push(txt);
      continue;
    }

    // Generic info — skip silently (rare)
  }

  flushPending();

  // Group by treatmentKey (urgent recs stay separate)
  const groupMap = new Map<string, KidsRecommendationGroup>();
  for (const rec of allRecs) {
    const groupId = rec.urgent
      ? `urgent::${rec.treatmentKey}::${rec.id}`
      : rec.treatmentKey;
    let group = groupMap.get(groupId);
    if (!group) {
      group = {
        treatmentKey: rec.treatmentKey,
        treatmentLabel: rec.treatmentLabel,
        kind: rec.kind,
        urgent: rec.urgent,
        recs: [],
      };
      groupMap.set(groupId, group);
    }
    group.recs.push(rec);
  }

  return {
    groups: Array.from(groupMap.values()),
    externalNotes,
    standaloneWarnings,
  };
}

// ── Aggregation across domains for matching ─────────────────────────────────

export interface KidsAggregatedRecommendations {
  treatmentKeys: string[];
  treatmentLabels: string[];
  assessmentKeys: string[];
  assessmentLabels: string[];
  professionalKeys: string[];
  professionalLabels: string[];
}

export function aggregateForMatch(domains: KidsDomainResult[]): KidsAggregatedRecommendations {
  const treatmentKeys = new Set<string>();
  const treatmentLabels = new Map<string, string>();
  const assessmentKeys = new Set<string>();
  const assessmentLabels = new Map<string, string>();
  const professionalKeys = new Set<string>();
  const professionalLabels = new Map<string, string>();

  for (const d of domains) {
    for (const g of d.groups) {
      if (g.kind === "treatment" && g.treatmentKey !== "_no_action") {
        treatmentKeys.add(g.treatmentKey);
        treatmentLabels.set(g.treatmentKey, g.treatmentLabel);
      } else if (g.kind === "assessment") {
        assessmentKeys.add(g.treatmentKey);
        assessmentLabels.set(g.treatmentKey, g.treatmentLabel);
      } else if (g.kind === "professional") {
        professionalKeys.add(g.treatmentKey);
        professionalLabels.set(g.treatmentKey, g.treatmentLabel);
      }
    }
  }
  return {
    treatmentKeys: Array.from(treatmentKeys),
    treatmentLabels: Array.from(treatmentKeys).map(k => treatmentLabels.get(k) || k),
    assessmentKeys: Array.from(assessmentKeys),
    assessmentLabels: Array.from(assessmentKeys).map(k => assessmentLabels.get(k) || k),
    professionalKeys: Array.from(professionalKeys),
    professionalLabels: Array.from(professionalKeys).map(k => professionalLabels.get(k) || k),
  };
}
