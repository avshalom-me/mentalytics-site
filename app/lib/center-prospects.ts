import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import { startAgentRun, finishAgentRun, syncAgentAlerts, agentEnabled } from "./agent-infra";
import { REGION_GROUPS, REGION_CITIES, REGION_GROUP_LABELS } from "./regions";
import { placesConfigured, searchCentersInCities } from "./places-search";

// סוכן איתור המכונים: בונה ומתחזק רשימת מרכזים טיפוליים שאפשר להפוך
// ללקוחות, ומתעדף אותה לפי המקום שבו באמת חסרים לנו מטפלים.
//
// שני מקורות, ובכוונה בסדר הזה:
//
//   1. לידים פנימיים - מרכז שכבר קיבל אצלנו הצעה ולא סגר. אלה הלידים
//      הכי חמים שיש, והם היו יושבים שבועות בלי שאיש יידע: בבדיקה שקדמה
//      לסוכן נמצאו שניים כאלה ששכבו שישה שבועות (אחד מהם עם 8 מטפלים).
//   2. Google Places - מכונים באזורים שבהם יש פערי גיוס פתוחים.
//
// הסוכן לא שולח דבר. הוא בונה רשימת שיחות: שם, טלפון, כתובת, ולמה דווקא
// הוא. מייל קר למרכז לא נשלח אוטומטית לעולם - חוק הספאם הישראלי אוסר
// דבר פרסומת בלי הסכמה מראש, ולכן טיוטה נוצרת רק לפי בקשה מפורשת על
// מרכז מסוים שלא הצלחנו לתפוס בטלפון.

export type ProspectRow = {
  id: string;
  name: string;
  source: "places" | "internal_lead" | "manual";
  place_id: string | null;
  center_account_id: string | null;
  city: string | null;
  region_key: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  email: string | null;
  gaps_in_region: number;
  contacted_at: string | null;
  answered_at: string | null;
  answer: "yes" | "no" | "maybe" | null;
  notes: string | null;
  obstacles: string | null;
  draft_subject: string | null;
  draft_body: string | null;
  draft_sent_at: string | null;
  dismissed_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
};

export type ProspectsRun = {
  ok: boolean;
  placesConfigured: boolean;
  found: number; // חדשים שנוספו בריצה הזו
  refreshed: number; // קיימים שנראו שוב
  warmLeads: number;
  calls: number;
  errors: string[];
  error?: string;
};

// כמה ימים מרכז יכול לשבת בהצעה פתוחה לפני שזו התראה.
const STALE_LEAD_DAYS = Number(process.env.CENTER_LEAD_STALE_DAYS ?? 7);
// כמה ערים לחפש בהן בכל אזור. מוגבל כדי לשמור על מספר הקריאות קטן.
const CITIES_PER_REGION = 3;

function normPhone(v: string | null | undefined): string {
  return (v ?? "").replace(/\D/g, "");
}

function normName(v: string): string {
  return v.trim().toLowerCase().replace(/["'׳״]/g, "").replace(/\s+/g, " ");
}

export async function runCenterProspects(): Promise<ProspectsRun> {
  const base: ProspectsRun = {
    ok: true,
    placesConfigured: placesConfigured(),
    found: 0,
    refreshed: 0,
    warmLeads: 0,
    calls: 0,
    errors: [],
  };
  if (!agentEnabled("center_prospects")) return base;

  const runId = await startAgentRun("center_prospects", "discover");
  try {
    const nowIso = new Date().toISOString();

    // ── מה כבר קיים אצלנו, כדי לא להציע לקוח קיים כמועמד ─────────────
    const [{ data: accounts }, { data: existing }, { data: gapActions }] = await Promise.all([
      supabaseAdmin
        .from("therapy_center_accounts")
        .select("id, name, status, email, payer_email, phone, payer_phone, created_at, therapist_count"),
      supabaseAdmin.from("center_prospects").select("id, place_id, name, phone, center_account_id"),
      supabaseAdmin
        .from("agent_actions")
        .select("title")
        .eq("agent", "supply_gaps")
        .eq("action_type", "recruit_gap")
        .eq("status", "pending"),
    ]);

    const allAccounts = accounts ?? [];
    const knownNames = new Set(allAccounts.map((a) => normName(String(a.name ?? ""))));
    const knownPhones = new Set(
      allAccounts.flatMap((a) => [normPhone(a.phone as string), normPhone(a.payer_phone as string)]).filter(Boolean)
    );
    const existingByPlace = new Map((existing ?? []).filter((p) => p.place_id).map((p) => [p.place_id as string, p]));
    const existingByName = new Map((existing ?? []).map((p) => [normName(String(p.name ?? "")), p]));

    // ── פערי הגיוס לפי אזור - זה הדירוג ────────────────────────────────
    const gapsByRegionLabel = new Map<string, number>();
    for (const a of gapActions ?? []) {
      const label = String(a.title ?? "").split(" באזור ")[1]?.trim();
      if (!label) continue;
      gapsByRegionLabel.set(label, (gapsByRegionLabel.get(label) ?? 0) + 1);
    }
    const gapsByRegionKey = new Map<string, number>();
    for (const [key, label] of Object.entries(REGION_GROUP_LABELS)) {
      const n = gapsByRegionLabel.get(label);
      if (n) gapsByRegionKey.set(key, n);
    }

    // ── 1. לידים פנימיים: מרכז שקיבל הצעה ולא סגר ──────────────────────
    const staleCut = Date.now() - STALE_LEAD_DAYS * 86_400_000;
    const warm = allAccounts.filter(
      (a) => ["draft", "sent"].includes(String(a.status)) && new Date(String(a.created_at)).getTime() < staleCut
    );

    for (const a of warm) {
      const payload = {
        name: String(a.name ?? "מרכז ללא שם"),
        source: "internal_lead" as const,
        center_account_id: a.id as string,
        phone: (a.payer_phone as string) ?? (a.phone as string) ?? null,
        email: (a.payer_email as string) ?? (a.email as string) ?? null,
        gaps_in_region: 0,
        last_seen_at: nowIso,
        updated_at: nowIso,
      };
      const { data: hit } = await supabaseAdmin
        .from("center_prospects")
        .select("id")
        .eq("center_account_id", a.id as string)
        .maybeSingle();
      if (hit) {
        await supabaseAdmin
          .from("center_prospects")
          .update({ last_seen_at: nowIso, updated_at: nowIso })
          .eq("id", hit.id);
        base.refreshed++;
      } else {
        const { error } = await supabaseAdmin.from("center_prospects").insert(payload);
        if (error) base.errors.push(`ליד פנימי ${payload.name}: ${error.message}`);
        else base.found++;
      }
    }
    base.warmLeads = warm.length;

    // ── 2. Google Places באזורים עם פערי גיוס ──────────────────────────
    if (placesConfigured()) {
      // סדר עדיפות: אזור עם יותר פערים נסרק קודם. "אונליין" אינו מקום.
      const regions = [...gapsByRegionKey.entries()]
        .filter(([key]) => key !== "online" && REGION_GROUPS[key])
        .sort((a, b) => b[1] - a[1]);

      const cities: { city: string; regionKey: string }[] = [];
      for (const [key] of regions) {
        for (const regionName of REGION_GROUPS[key] ?? []) {
          for (const c of (REGION_CITIES[regionName] ?? []).slice(0, CITIES_PER_REGION)) {
            cities.push({ city: c, regionKey: key });
          }
        }
      }

      const cityRegion = new Map(cities.map((c) => [c.city, c.regionKey]));
      const search = await searchCentersInCities(cities.map((c) => c.city));
      base.calls = search.calls;
      base.errors.push(...search.errors);

      for (const p of search.results) {
        const regionKey = cityRegion.get(p.city) ?? null;
        const nName = normName(p.name);
        const nPhone = normPhone(p.phone);

        // כבר לקוח שלנו - לא מועמד.
        if (knownNames.has(nName) || (nPhone && knownPhones.has(nPhone))) continue;

        const known = existingByPlace.get(p.placeId) ?? existingByName.get(nName);
        if (known) {
          // רענון: פרטים מתעדכנים, אבל לא נוגעים במעקב הפנייה.
          await supabaseAdmin
            .from("center_prospects")
            .update({
              phone: p.phone ?? null,
              website: p.website ?? null,
              address: p.address ?? null,
              gaps_in_region: regionKey ? gapsByRegionKey.get(regionKey) ?? 0 : 0,
              last_seen_at: nowIso,
              updated_at: nowIso,
            })
            .eq("id", known.id);
          base.refreshed++;
          continue;
        }

        const { error } = await supabaseAdmin.from("center_prospects").insert({
          name: p.name,
          source: "places",
          place_id: p.placeId,
          city: p.city,
          region_key: regionKey,
          address: p.address,
          phone: p.phone,
          website: p.website,
          gaps_in_region: regionKey ? gapsByRegionKey.get(regionKey) ?? 0 : 0,
          last_seen_at: nowIso,
        });
        if (error) base.errors.push(`${p.name}: ${error.message}`);
        else base.found++;
      }
    }

    // ── התראה על ליד פנימי שנתקע ───────────────────────────────────────
    // זו הצעה שכבר יצאה ולא נסגרה, ולכן היא ממצא ולא משימה חדשה: היא
    // נסגרת מעצמה ברגע שהמרכז משלם או שההצעה מבוטלת.
    const alerts = warm.map((a) => {
      const days = Math.floor((Date.now() - new Date(String(a.created_at)).getTime()) / 86_400_000);
      const count = Number(a.therapist_count) || 0;
      return {
        actionType: "alert",
        kind: "finding" as const,
        title: `${a.name} קיבל הצעה לפני ${days} ימים ולא סגר`,
        body:
          `ההצעה נוצרה ב-${String(a.created_at).slice(0, 10)} והמרכז עדיין בסטטוס "${a.status}"` +
          (count > 0 ? ` · ${count} מטפלים` : "") +
          ". זה הליד החם ביותר שיש - שווה טלפון לפני שמחפשים מכונים חדשים.",
        dedupeKey: `prospect:stale_lead:${a.id}`,
      };
    });
    const { recovered } = await syncAgentAlerts("center_prospects", alerts, {
      managedKeys: allAccounts.map((a) => `prospect:stale_lead:${a.id}`),
      recoveryNote: "הליד נסגר או בוטל - הממצא נסגר אוטומטית",
    });

    await finishAgentRun(runId, {
      status: base.found > 0 || alerts.length > 0 ? "ok" : "empty",
      summary:
        `${base.found} מועמדים חדשים · ${base.refreshed} עודכנו · ${alerts.length} לידים חמים תקועים` +
        (base.placesConfigured ? ` · ${base.calls} חיפושים בגוגל` : " · Places לא מוגדר"),
      details: {
        found: base.found,
        refreshed: base.refreshed,
        warm_leads: alerts.length,
        calls: base.calls,
        places_configured: base.placesConfigured,
        errors: base.errors.slice(0, 10),
        recovered_alerts: recovered,
      },
    });

    return base;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finishAgentRun(runId, { status: "error", error: msg });
    return { ...base, ok: false, error: msg };
  }
}

/** רשימת המועמדים לתצוגה בטבלה - הפתוחים קודם, לפי דירוג. */
export async function listProspects(): Promise<ProspectRow[]> {
  const { data, error } = await supabaseAdmin
    .from("center_prospects")
    .select("*")
    .is("dismissed_at", null)
    .order("gaps_in_region", { ascending: false })
    .order("first_seen_at", { ascending: true })
    .limit(300);
  if (error) throw new Error(`טעינת המועמדים נכשלה: ${error.message}`);
  // לידים פנימיים תמיד בראש: הם הכי חמים, ואין טעם לחייג למכון חדש
  // כשמרכז שכבר ביקש הצעה יושב בלי מענה.
  const rows = (data ?? []) as ProspectRow[];
  return [
    ...rows.filter((r) => r.source === "internal_lead"),
    ...rows.filter((r) => r.source !== "internal_lead"),
  ];
}

/** עדכון שורה מהטבלה באדמין. רק שדות המעקב ניתנים לעריכה. */
export async function updateProspect(
  id: string,
  patch: Partial<Pick<ProspectRow, "contacted_at" | "answer" | "notes" | "obstacles" | "phone" | "email">> & {
    dismissed?: boolean;
  }
): Promise<void> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("contacted_at" in patch) update.contacted_at = patch.contacted_at;
  if ("phone" in patch) update.phone = patch.phone;
  if ("email" in patch) update.email = patch.email;
  if ("notes" in patch) update.notes = patch.notes;
  if ("obstacles" in patch) update.obstacles = patch.obstacles;
  if ("answer" in patch) {
    update.answer = patch.answer;
    // "ענו" נגזר מהתשובה: אין מצב שיש תשובה בלי שענו.
    update.answered_at = patch.answer ? new Date().toISOString() : null;
  }
  if (patch.dismissed !== undefined) {
    update.dismissed_at = patch.dismissed ? new Date().toISOString() : null;
  }
  const { error } = await supabaseAdmin.from("center_prospects").update(update).eq("id", id);
  if (error) throw new Error(`העדכון נכשל: ${error.message}`);
}
