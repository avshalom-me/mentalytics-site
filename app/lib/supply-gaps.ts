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
  const demandLine =
    events > 1
      ? `בחודשיים האחרונים ${events} מטופלים חיפשו דרכנו ${treatment} באזור ${region} ולא היה לנו מטפל מקודם להציע להם.`
      : `לאחרונה מטופל חיפש דרכנו ${treatment} באזור ${region} ולא היה לנו מטפל מקודם להציע לו.`;

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

    const [eventsRes, therapists] = await Promise.all([
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

    // צבירה לפי אזור × טיפול.
    type Agg = { region: string; treatment: string; events: number; lastSeen: string };
    const agg = new Map<string, Agg>();
    for (const row of (eventsRes.data ?? []) as (FallbackEvent & { created_at: string })[]) {
      const md = row.metadata ?? {};
      const region = String(md.region ?? "").trim();
      if (!region) continue;
      const treatments = asStringArray(md.requested_treatments);
      // בלי טיפול מפורש - הפער הוא אזורי; נרשם תחת "כללי".
      const list = treatments.length > 0 ? treatments : ["כללי"];
      for (const treatment of list) {
        const key = `${region}|${treatment}`;
        const prev = agg.get(key);
        if (prev) prev.events += 1;
        else agg.set(key, { region, treatment, events: 1, lastSeen: row.created_at });
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
      if (a.events < MIN_EVENTS) continue;
      const payingCovering = paying.filter((t) => matchesGap(t, a.region, a.treatment)).length;
      // אם בינתיים יש כיסוי משלם - הפער נסגר מעצמו ואין מה להציע.
      if (payingCovering > 0) continue;

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
        events: a.events,
        lastSeen: a.lastSeen,
        payingCovering,
        candidates,
        kind,
        draftEmail:
          kind === "gift"
            ? buildGiftDraft(candidates[0].full_name || "", a.region, a.treatment, a.events)
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
                `${g.events} מטופלים חיפשו ${g.treatment} באזור ${g.region} ולא היה מטפל משלם להציע.\n` +
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
              title: `פער גיוס: אין אף מטפל ל${g.treatment} באזור ${g.region}`,
              body:
                `${g.events} מטופלים חיפשו ${g.treatment} באזור ${g.region} ולא קיבלו אף תוצאה משלמת, ` +
                `ואין במאגר אף מטפל מאושר שמתאים לחיתוך הזה. זה אזור/תחום לפרסום גיוס ממוקד.`,
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
