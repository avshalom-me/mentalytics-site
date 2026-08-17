import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import { fetchAllRows } from "./fetch-all-rows";
import { coversRegion, overlaps } from "./match-fallback";
import { startAgentRun, finishAgentRun, syncAgentAlerts } from "./agent-infra";

// סוכן פערי ההיצע (סוכן 11): מוצא חיתוכים של אזור × סוג טיפול שבהם מטופלים
// ביקשו טיפול ולא היה לנו מטפל משלם להראות להם, ומציע מה לעשות עם כל פער:
//
//   יש אצלנו מטפל חינמי שמתאים  → טיוטת הצעת קידום מתנה לחודשיים
//   אין אף מטפל שמתאים          → פער גיוס: איפה לפרסם כדי לגייס
//
// מקור האמת לביקוש הוא אירוע match_free_fallback שמנוע ההתאמה כבר כותב
// בכל פעם שלא מצא מטפל משלם - כלומר מטופל אמיתי שביקש ולא קיבל. זה מדויק
// יותר מספירת צפיות, כי הוא נרשם רק כשבאמת היה חוסר.
//
// בטיחות: הסוכן לא שולח דבר ולא מקדם אף אחד. הוא מנסח ומציע לתור; השליחה
// והקידום נעשים על ידך אחרי אישור (החלטת המשתמש 16/8).

const LOOKBACK_DAYS = Number(process.env.SUPPLY_GAP_LOOKBACK_DAYS ?? 60);
const GIFT_MONTHS = 2;
// מינימום אירועי פער כדי להציע פעולה - מתחת לזה זה רעש של מטופל בודד.
const MIN_EVENTS = Number(process.env.SUPPLY_GAP_MIN_EVENTS ?? 1);
const MAX_CANDIDATES_PER_GAP = 3;
// עד כמה מטפלים משלמים בחיתוך עדיין נחשב "לא מספיק להציע". 2 = גם חיתוך
// עם מטפל אחד או שניים נחשב פער, לא רק חיתוך ריק לגמרי.
const THIN_SUPPLY_MAX = Number(process.env.SUPPLY_GAP_THIN_MAX ?? 2);

type FallbackEvent = { metadata: Record<string, unknown> | null };

type TherapistRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  status: string;
  promotion_source: string | null;
  admin_approved: boolean | null;
  accepting_new_patients: boolean | null;
  regions: string[] | null;
  training_areas: string[] | null;
  age_groups: string[] | null;
};

export type GapCandidate = {
  therapist_id: string;
  full_name: string;
  email: string;
};

export type SupplyGap = {
  key: string;
  region: string;
  treatment: string;
  events: number; // כמה מטופלים נתקלו בפער
  lastSeen: string;
  payingCovering: number; // מטפלים משלמים שמכסים את החיתוך
  candidates: GapCandidate[]; // מטפלים חינמיים שמתאימים - יעד ההצעה
  kind: "gift" | "recruit";
  draftEmail: string | null; // טיוטה מוכנה למשלוח ידני אחרי אישור
};

export type SupplyGapsResult = {
  ok: boolean;
  gaps: SupplyGap[];
  giftGaps: SupplyGap[];
  recruitGaps: SupplyGap[];
  error?: string;
};

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x)).filter(Boolean);
    } catch {
      return v ? [v] : [];
    }
  }
  return [];
}

// ראשי תיבות לועזיים (cbt/dbt/emdr) נשמרים במאגר באותיות קטנות ונראים
// שבורים בתוך משפט בעברית - מוצגים באותיות גדולות.
function treatmentLabel(t: string): string {
  return /^[a-z0-9\s-]+$/i.test(t) ? t.toUpperCase() : t;
}

// טיוטת הצעת הקידום. תבנית קבועה בטון עובדתי-מסייע: מובילה בצורך שלנו,
// לא במספרי הביצועים של המטפל, ובלי ניסוחים שיווקיים.
function buildGiftDraft(name: string, region: string, rawTreatment: string, events: number): string {
  const treatment = treatmentLabel(rawTreatment);
  // בטיוטה היוצאת לא מציינים מספר מדויק - "מספר רב" נכון יותר לקריאה
  // ולא מעמיד את המספר במרכז. הספירה המדויקת נשארת בגוף ההצעה באדמין.
  // ל-2 מטופלים נאמר "מספר מטופלים" ולא "מספר רב", כדי לא להגזים.
  const demandLine =
    events > 1
      ? `בחודשיים האחרונים ${events >= 3 ? "מספר רב של מטופלים" : "מספר מטופלים"} חיפשו דרכנו ${treatment} באזור ${region}, ולא היו לנו מספיק מטפלים בתחום ובאזור הזה להציע להם.`
      : `לאחרונה מטופל חיפש דרכנו ${treatment} באזור ${region}, ולא היו לנו מספיק מטפלים בתחום ובאזור הזה להציע לו.`;

  return [
    `שלום ${name},`,
    ``,
    demandLine,
    ``,
    `הפרופיל שלך מתאים לחיתוך הזה, ולכן אנחנו מציעים לך ${GIFT_MONTHS} חודשי קידום במתנה - הפרופיל שלך יוצג למטופלים שמחפשים ${treatment} באזור ${region}, בלי תשלום ובלי התחייבות. בתום התקופה הקידום פשוט מסתיים, אלא אם תבחר/י להמשיך.`,
    ``,
    `אם זה מתאים, מספיק להשיב למייל הזה ונפעיל את הקידום.`,
    ``,
    `בברכה,`,
    `אבשלום, טיפול חכם`,
  ].join("\n");
}

export async function runSupplyGaps(): Promise<SupplyGapsResult> {
  const runId = await startAgentRun("supply_gaps", "monitor");
  try {
    const sinceIso = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();

    // אות ביקוש שני, ההכרחי לאיתור חיתוכים דלילים: כל צפייה שהגיעה ממסלול
    // ההתאמה נושאת את האזור והטיפול שהמטופל ביקש - גם כשכן היו מטפלים
    // להציע. אירוע הפער (למטה) נרשם רק כשלא היה אף משלם, ולכן הוא לבדו
    // לא יכול לגלות חיתוך שיש בו מטפל אחד או שניים.
    const [viewsRes, eventsRes, therapists] = await Promise.all([
      fetchAllRows<{ viewer_region: string | null; viewer_treatment: string | null; session_id: string | null }>(
        () =>
          supabaseAdmin
            .from("therapist_profile_views")
            .select("viewer_region, viewer_treatment, session_id")
            .not("viewer_region", "is", null)
            .not("viewer_treatment", "is", null)
            .gte("viewed_at", sinceIso)
      ),
      supabaseAdmin
        .from("analytics_events")
        .select("metadata, created_at")
        .eq("event_type", "match_free_fallback")
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(1000),
      fetchAllRows<TherapistRow>(() =>
        supabaseAdmin
          .from("therapists")
          .select(
            "id, full_name, email, status, promotion_source, admin_approved, accepting_new_patients, regions, training_areas, age_groups"
          )
          .in("status", ["paying", "approved"])
      ),
    ]);

    // צבירה לפי אזור × טיפול. events = כמה מטופלים נתקלו בחיתוך הזה,
    // נספרים לפי סשן כדי שרפרוש לא ייספר כביקוש נוסף.
    type Agg = { region: string; treatment: string; sessions: Set<string>; events: number; lastSeen: string };
    const agg = new Map<string, Agg>();
    const touch = (region: string, treatment: string, sessionKey: string | null, at: string): void => {
      const key = `${region}|${treatment}`;
      const prev = agg.get(key);
      if (prev) {
        if (sessionKey) prev.sessions.add(sessionKey);
        else prev.events += 1;
        if (at > prev.lastSeen) prev.lastSeen = at;
        return;
      }
      agg.set(key, {
        region,
        treatment,
        sessions: new Set(sessionKey ? [sessionKey] : []),
        events: sessionKey ? 0 : 1,
        lastSeen: at,
      });
    };

    for (const v of viewsRes) {
      const region = String(v.viewer_region ?? "").trim();
      const treatment = String(v.viewer_treatment ?? "").trim();
      if (!region || !treatment) continue;
      touch(region, treatment, v.session_id ?? `anon:${region}|${treatment}`, sinceIso);
    }
    for (const row of (eventsRes.data ?? []) as (FallbackEvent & { created_at: string })[]) {
      const md = row.metadata ?? {};
      const region = String(md.region ?? "").trim();
      if (!region) continue;
      const treatments = asStringArray(md.requested_treatments);
      // בלי טיפול מפורש - הפער הוא אזורי; נרשם תחת "כללי".
      const list = treatments.length > 0 ? treatments : ["כללי"];
      for (const treatment of list) {
        touch(region, treatment, null, row.created_at);
      }
    }

    const paying = therapists.filter((t) => t.status === "paying");
    const freePool = therapists.filter(
      (t) => t.status === "approved" && t.admin_approved && t.accepting_new_patients !== false
    );

    const matchesGap = (t: TherapistRow, region: string, treatment: string): boolean => {
      if (!coversRegion(t.regions ?? [], region)) return false;
      if (treatment === "כללי") return true;
      return overlaps(t.training_areas ?? [], [treatment]);
    };

    const gaps: SupplyGap[] = [];
    for (const a of agg.values()) {
      const demand = a.events + a.sessions.size;
      if (demand < MIN_EVENTS) continue;
      const payingCovering = paying.filter((t) => matchesGap(t, a.region, a.treatment)).length;
      // "לא מספיק להציע": חיתוך ריק, או חיתוך דליל של מטפל אחד או שניים.
      if (payingCovering > THIN_SUPPLY_MAX) continue;

      const candidates = freePool
        .filter((t) => matchesGap(t, a.region, a.treatment))
        .slice(0, MAX_CANDIDATES_PER_GAP)
        .map((t) => ({
          therapist_id: t.id,
          full_name: t.full_name ?? "",
          email: t.email ?? "",
        }));

      const kind: "gift" | "recruit" = candidates.length > 0 ? "gift" : "recruit";
      gaps.push({
        key: `gap:${kind}:${a.region}|${a.treatment}`,
        region: a.region,
        treatment: a.treatment,
        events: demand,
        lastSeen: a.lastSeen,
        payingCovering,
        candidates,
        kind,
        draftEmail:
          kind === "gift"
            ? buildGiftDraft(candidates[0].full_name || "", a.region, a.treatment, demand)
            : null,
      });
    }

    gaps.sort((x, y) => y.events - x.events);
    const giftGaps = gaps.filter((g) => g.kind === "gift");
    const recruitGaps = gaps.filter((g) => g.kind === "recruit");

    // הצעות לתור, עם החלמה אוטומטית: פער שנסגר (נוסף מטפל משלם) סוגר את
    // ההצעה שלו בריצה הבאה.
    await syncAgentAlerts(
      "supply_gaps",
      gaps.map((g) =>
        g.kind === "gift"
          ? {
              actionType: "gift_offer",
              title: `הצעת קידום מתנה: ${g.treatment} · ${g.region}`,
              body:
                `${g.events} מטופלים חיפשו ${g.treatment} באזור ${g.region}; ` +
                `${g.payingCovering === 0 ? "אין אף מטפל משלם" : `רק ${g.payingCovering} מטפלים משלמים`} בחיתוך הזה.\n` +
                `מועמדים מתאימים במאגר: ${g.candidates.map((c) => `${c.full_name} (${c.email})`).join(", ")}\n\n` +
                `--- טיוטת מייל למשלוח ידני אחרי אישור ---\n${g.draftEmail}`,
              entityType: "therapist",
              entityId: g.candidates[0].therapist_id,
              entityLabel: g.candidates[0].full_name,
              dedupeKey: g.key,
              payload: {
                region: g.region,
                treatment: g.treatment,
                gift_months: GIFT_MONTHS,
                candidates: g.candidates,
              },
            }
          : {
              actionType: "recruit_gap",
              title: `פער גיוס: אין מספיק מטפלים ל${g.treatment} באזור ${g.region}`,
              body:
                `${g.events} מטופלים חיפשו ${g.treatment} באזור ${g.region}, ` +
                `${g.payingCovering === 0 ? "ואין אף מטפל משלם" : `ויש רק ${g.payingCovering} מטפלים משלמים`} בחיתוך הזה - ` +
                `וגם אין במאגר אף מטפל חינמי מאושר שמתאים. זה אזור/תחום לפרסום גיוס ממוקד.`,
              dedupeKey: g.key,
              payload: { region: g.region, treatment: g.treatment },
            }
      ),
      {
        managedKeys: gaps.map((g) => g.key),
        recoveryNote: "הפער נסגר (נמצא כיסוי משלם) - ההצעה נסגרה אוטומטית",
      }
    );

    await finishAgentRun(runId, {
      status: gaps.length > 0 ? "ok" : "empty",
      summary:
        gaps.length > 0
          ? `${gaps.length} פערי היצע: ${giftGaps.length} להצעת מתנה, ${recruitGaps.length} לגיוס`
          : "אין פערי היצע פתוחים",
      details: {
        gift: giftGaps.map((g) => ({ region: g.region, treatment: g.treatment, events: g.events })),
        recruit: recruitGaps.map((g) => ({ region: g.region, treatment: g.treatment, events: g.events })),
      },
    });

    return { ok: true, gaps, giftGaps, recruitGaps };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finishAgentRun(runId, { status: "error", error: msg });
    return { ok: false, gaps: [], giftGaps: [], recruitGaps: [], error: msg };
  }
}
