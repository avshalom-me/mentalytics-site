import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import { startAgentRun, finishAgentRun, syncAgentAlerts, agentEnabled, createAgentAction } from "./agent-infra";
import { REGION_GROUPS, REGION_CITIES, REGION_GROUP_LABELS } from "./regions";
import { canonicalCity, prospectRegionGroup, prospectRegionOfCity } from "./prospect-regions";
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
  // מפתח אזור של רשימת המכונים (PROSPECT_REGION_GROUPS) - "center" כאן הוא גוש
  // דן בלבד, והשפלה היא "shfela". לא אותו דבר כמו המפתח הגס של האנליטיקה.
  region_key: string | null;
  address: string | null;
  // טלפון אחד או כמה, מופרדים ב-" / " - כך הם מגיעים מהאתרים ומהגיליון.
  phone: string | null;
  // רק מספר שפורסם במפורש כוואטסאפ (קישור wa.me או "וואטסאפ" באתר). נייד
  // לבדו אינו וואטסאפ, ולכן לא נגזר אוטומטית מהטלפון.
  whatsapp: string | null;
  website: string | null;
  email: string | null;
  gaps_in_region: number;
  contacted_at: string | null;
  answered_at: string | null;
  answer: "yes" | "no" | "maybe" | null;
  // הסטטוס המפורש - מקור האמת מ-30/8/26 (answer נשאר לתאימות בלבד).
  status: ProspectStatus;
  // מתי הסטטוס השתנה לאחרונה, והרשימה המלאה (29/9/26). נכתבים בכל מסלול
  // שמשנה סטטוס - מהטבלה, בהעברה לעסקאות, ובליד פנימי שהסוכן מעביר לבד.
  status_changed_at: string | null;
  status_history: StatusStamp[] | null;
  follow_up_at: string | null;
  status_note: string | null;
  deal_id: string | null;
  notes: string | null;
  obstacles: string | null;
  draft_subject: string | null;
  draft_body: string | null;
  draft_sent_at: string | null;
  dismissed_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
};

/**
 * כל הסטטוסים שמותרים במסד (center_prospects_status_check). שני ערוצי הפנייה
 * נוספו 14/9/26 לצד "contacted", שנשאר לשורות הקיימות שבהן הערוץ לא ידוע.
 */
export type ProspectStatus =
  | "new"
  | "contacted"
  | "contacted_email"
  | "contacted_phone"
  | "later"
  // "לא רלוונטי כרגע - לעבודה בהמשך" (29/9/26): כמו later אבל בלי תאריך
  // חזרה ובלי תזכורת - חונה בצד עד שמישהו יחליט לחזור אליו.
  | "not_relevant_now"
  | "not_interested"
  | "moved_to_deal";

export const PROSPECT_STATUS_VALUES: readonly ProspectStatus[] = [
  "new", "contacted", "contacted_email", "contacted_phone", "later", "not_relevant_now", "not_interested", "moved_to_deal",
];

export type StatusStamp = { status: ProspectStatus; at: string };

/** חותמת לשינוי סטטוס: מתי, ומה נוסף להיסטוריה (עד 30 אחרונים). */
export function stampStatus(history: unknown, status: ProspectStatus, at: string) {
  const prev = Array.isArray(history) ? (history as StatusStamp[]) : [];
  return { status_changed_at: at, status_history: [...prev, { status, at }].slice(-30) };
}

/** "נוצרה פנייה" בכל ערוץ שהוא. כל מקום שבודק contacted צריך לבדוק את כולם. */
export const CONTACTED_STATUSES: readonly ProspectStatus[] = ["contacted", "contacted_email", "contacted_phone"];

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
  const d = (v ?? "").replace(/\D/g, "");
  // "+972 54-467-2235" ו-"054-4672235" הם אותו מספר.
  return d.startsWith("972") ? `0${d.slice(3)}` : d;
}

/** כל מספר בשדה בנפרד - שדה הטלפון יכול להחזיק כמה מספרים מופרדים ב-" / ". */
function phoneKeys(v: string | null | undefined): string[] {
  return String(v ?? "")
    .split(/[/,;]|\s+או\s+/)
    .map(normPhone)
    .filter((d) => d.length >= 4);
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
      allAccounts.flatMap((a) => [...phoneKeys(a.phone as string), ...phoneKeys(a.payer_phone as string)])
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
          // המפתח העדין (מרכז/שפלה) לתצוגה; הדירוג למעלה נשאר לפי הקבוצה הכללית.
          region_key: prospectRegionOfCity(p.city) ?? regionKey,
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

    // ── תזכורות "לחזור בעוד X" שהגיע זמנן ──────────────────────────────
    // מכון שסומן "לא כרגע, אולי בעתיד" עם תאריך חזרה. כשהתאריך מגיע,
    // נפתחת משימה בתור - פעם אחת (dedupe), והיא נסגרת ידנית כשמטפלים בה.
    {
      const { data: due } = await supabaseAdmin
        .from("center_prospects")
        .select("id, name, phone, status_note, follow_up_at")
        .eq("status", "later")
        .lte("follow_up_at", nowIso)
        .limit(20);
      for (const d of due ?? []) {
        await createAgentAction({
          agent: "center_prospects",
          actionType: "prospect_follow_up",
          kind: "action",
          title: `הגיע הזמן לחזור אל ${d.name}`,
          body:
            `סומן "לא כרגע - אולי בעתיד" עם תזכורת ל-${String(d.follow_up_at).slice(0, 10)}.` +
            (d.status_note ? `
מה נאמר אז: ${d.status_note}` : "") +
            (d.phone ? `
טלפון: ${d.phone}` : ""),
          dedupeKey: `prospect:follow_up:${d.id}`,
        });
      }
    }

    // ── ליד פנימי → עסקה פתוחה ─────────────────────────────────────────
    // מרכז שכבר קיבל מאיתנו הצעה והלינק אצלו הוא בדיוק "נשלח לינק
    // הרשמה" - התחנה החמה ביותר בצינור. עד היום הוא חי רק כהתראה בתור,
    // כלומר הליד הכי קרוב לכסף היה היחיד שלא נוהל כעסקה.
    for (const a of warm) {
      const { data: pr } = await supabaseAdmin
        .from("center_prospects")
        .select("id, name, phone, email, region_key, notes, deal_id, status_history")
        .eq("center_account_id", a.id as string)
        .maybeSingle();
      if (!pr || pr.deal_id) continue;

      const { data: deal, error: dealErr } = await supabaseAdmin
        .from("crm_deals")
        .insert({
          title: pr.name,
          deal_type: "center",
          stage: "link_sent",
          contact_name: pr.name,
          contact_info: [pr.phone, pr.email].filter(Boolean).join(" · ") || null,
          region_key: pr.region_key,
          prospect_id: pr.id,
          next_step: "לוודא שההרשמה הושלמה",
          notes:
            `נפתח אוטומטית: ההצעה נשלחה ב-${String(a.created_at).slice(0, 10)} והמרכז עדיין בסטטוס "${a.status}".` +
            (pr.notes ? `\n${pr.notes}` : ""),
        })
        .select("id")
        .single();
      if (dealErr || !deal) {
        base.errors.push(`עסקה ל${pr.name}: ${dealErr?.message ?? "נכשלה"}`);
        continue;
      }
      await supabaseAdmin
        .from("center_prospects")
        .update({
          status: "moved_to_deal",
          deal_id: deal.id,
          updated_at: nowIso,
          ...stampStatus(pr.status_history, "moved_to_deal", nowIso),
        })
        .eq("id", pr.id);
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

/** עדכון שורה מהטבלה באדמין: שדות המעקב, פרטי הקשר והעיר. */
export async function updateProspect(
  id: string,
  patch: Partial<
    Pick<
      ProspectRow,
      | "contacted_at"
      | "answer"
      | "notes"
      | "obstacles"
      | "phone"
      | "whatsapp"
      | "email"
      | "website"
      | "address"
      | "city"
      | "status"
      | "follow_up_at"
      | "status_note"
    >
  > & {
    dismissed?: boolean;
  }
): Promise<void> {
  const nowIso = new Date().toISOString();
  const update: Record<string, unknown> = { updated_at: nowIso };
  if ("status" in patch && patch.status) {
    update.status = patch.status;
    const { data: cur } = await supabaseAdmin
      .from("center_prospects").select("status, contacted_at, status_history").eq("id", id).maybeSingle();
    // חותמת רק כשהסטטוס באמת השתנה - שמירה חוזרת של אותו סטטוס אינה אירוע.
    if (cur && cur.status !== patch.status) Object.assign(update, stampStatus(cur.status_history, patch.status, nowIso));
    // כל סוג של "נוצרה פנייה" גורר תאריך פנייה - אין פנייה בלי תאריך. רק אם
    // עוד אין: מעבר מ"פנייה ראשונה" ל"פנייה טלפונית" הוא פנייה נוספת, לא
    // הראשונה, והתאריך המקורי הוא מה ששווה לשמור.
    if (CONTACTED_STATUSES.includes(patch.status) && !cur?.contacted_at) update.contacted_at = nowIso;
    // יציאה ממצב ההמתנה מנקה את התזכורת.
    if (patch.status !== "later") update.follow_up_at = null;
  }
  // !== undefined ולא "in" (אותה מלכודת כמו contacted_at למטה): בלי זה המפתח
  // הריק מה-API דרס את ה-null שלמעלה, ויציאה מ"אולי בעתיד" לא ניקתה תזכורת.
  if (patch.follow_up_at !== undefined) update.follow_up_at = patch.follow_up_at;
  if (patch.status_note !== undefined) update.status_note = patch.status_note;
  // !== undefined ולא "in": הנתיב מה-API מעביר תמיד את המפתח, גם כשהוא ריק.
  // עם "in" המפתח הריק דרס את החותמת שנקבעה שורות ספורות למעלה, ובגלל ש-
  // undefined נופל ב-JSON - בחירת "נוצרה פנייה ראשונה" לא רשמה תאריך אף פעם.
  // נמדד 14/9/26: שלוש מתוך שש שורות "contacted" בלי contacted_at.
  if (patch.contacted_at !== undefined) update.contacted_at = patch.contacted_at;
  // שדות הקשר: !== undefined מאותה סיבה, ומחרוזת ריקה = מחיקה ולא "".
  for (const field of ["phone", "whatsapp", "email", "website", "address"] as const) {
    if (patch[field] !== undefined) update[field] = patch[field]?.trim() || null;
  }
  if (patch.city !== undefined) {
    const typed = patch.city?.trim() || null;
    // עיר שבמילון נשמרת בכתיב הקנוני וגוררת את האזור. עיר שאינה במילון
    // נשמרת כפי שהוקלדה, והאזור נשאר כמו שהוא - לא מנחשים.
    update.city = canonicalCity(typed) ?? typed;
    const regionKey = prospectRegionOfCity(typed);
    if (regionKey) update.region_key = regionKey;
  }
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

// ── העברה לעסקאות B2B ──────────────────────────────────────────────────
// מכון שאמר "רוצים" עובר מרשימת החיוג לצינור העסקאות, עם כל מה שנאסף
// עליו: שם, קשר, אזור, הערות. המעבר חד-כיווני ומקושר - העסקה זוכרת את
// המכון, והסגירה האוטומטית משתמשת בקישור הזה לזהות תשלום.

export async function moveProspectToDeal(
  id: string,
  stage: "first_contact" | "negotiation" | "link_sent"
): Promise<{ ok: boolean; dealId?: string; error?: string }> {
  const { data: p } = await supabaseAdmin
    .from("center_prospects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!p) return { ok: false, error: "המכון לא נמצא" };
  if (p.deal_id) return { ok: false, error: "המכון כבר בעסקאות" };

  const contact = [p.phone, p.whatsapp ? `וואטסאפ ${p.whatsapp}` : null, p.email].filter(Boolean).join(" · ");
  const noteParts = [p.notes, p.obstacles ? `מכשולים: ${p.obstacles}` : null].filter(Boolean);
  const { data: deal, error } = await supabaseAdmin
    .from("crm_deals")
    .insert({
      title: p.name,
      deal_type: "center",
      stage,
      contact_name: p.name,
      contact_info: contact || null,
      notes: noteParts.length > 0 ? noteParts.join("\n") : null,
      next_step:
        stage === "first_contact" ? "לתאם שיחת היכרות"
        : stage === "link_sent" ? "לוודא שההרשמה הושלמה"
        : "להמשיך משא ומתן",
      prospect_id: p.id,
      region_key: p.region_key,
    })
    .select("id")
    .single();
  if (error || !deal) return { ok: false, error: error?.message ?? "יצירת העסקה נכשלה" };

  const { error: updErr } = await supabaseAdmin
    .from("center_prospects")
    .update({
      status: "moved_to_deal",
      deal_id: deal.id,
      follow_up_at: null,
      updated_at: new Date().toISOString(),
      ...stampStatus(p.status_history, "moved_to_deal", new Date().toISOString()),
    })
    .eq("id", id);
  if (updErr) return { ok: false, error: updErr.message };
  return { ok: true, dealId: deal.id as string };
}

// ── הוספה ידנית ────────────────────────────────────────────────────────
// המשתמש כבר מחזיק רשימת מכונים, ומכונים חדשים לא נפתחים בקצב שמצדיק
// המתנה לריצה שבועית. ההדבקה תומכת בפורמטים שאנשים באמת מדביקים: שורה
// מגיליון (טאבים), שורה מופרדת בפסיקים, מקף, או סתם שם.

export type ParsedProspect = {
  name: string;
  // אחד או כמה מספרים, מופרדים ב-" / ".
  phone: string | null;
  email: string | null;
  city: string | null;
  website: string | null;
  // כל מה שנשאר בשורה אחרי השם: אנשי קשר, כתובת, "דרך טופס באתר" וכו'.
  notes: string | null;
};

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

// ערכי מילוי מגיליון שאין בהם מידע. בלי הסינון "לא נמצא" נשמר כעיר (נמדד
// 28/9/26: 9 מתוך 68 שורות עם "לא נמצא" או "דרך טופס באתר" בשדה העיר).
const PLACEHOLDER_RE = /^(לא נמצא|לא פורסם|לא ידוע|אין|-+|—+)$/;

/** מספר ישראלי אחד: 9-11 ספרות שמתחילות ב-0, קו 1-800/1-700/1-599, או כוכבית. */
function looksLikePhone(v: string): boolean {
  const t = v.trim();
  if (/^\*\d{3,5}$|^\d{3,5}\*$/.test(t)) return true;
  const digits = t.replace(/\D/g, "");
  if (/^1(800|700|599)\d{6}$/.test(digits)) return true;
  if (/^972\d{8,9}$/.test(digits) && /^\+?972/.test(t.replace(/[\s-]/g, ""))) return true;
  return digits.length >= 9 && digits.length <= 11 && /^0/.test(digits);
}

/**
 * מקטע שכולו טלפונים: "03-9040655 / 052-6940094" או "מוקד 5806*". מחזיר את
 * המספרים, או null אם יש בו משהו שאינו טלפון. עד 28/9/26 צמד כזה נבלע בשם
 * המכון, כי 19 ספרות אינן "טלפון" - ושדה הטלפון נשאר ריק.
 */
function phonesIn(part: string): string[] | null {
  const pieces = part
    .replace(/^(טל(פון)?|טל'|נייד|מוקד)[:\s]*/, "")
    .split(/\s*[/,;]\s*|\s+או\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (pieces.length === 0 || !pieces.every(looksLikePhone)) return null;
  return pieces;
}

function looksLikeUrl(v: string): boolean {
  const t = v.trim();
  // מייל מסתיים גם הוא ב-.co.il - בלי הבדיקה הזו office@x.co.il נשמר כאתר
  // "https://office@x.co.il", שמוביל למקום לא קיים, והמייל עצמו אבד.
  if (EMAIL_RE.test(t)) return false;
  return /^(https?:\/\/|www\.)/i.test(t) || /\.(co\.il|org\.il|com|org|net|center)(\/|$)/i.test(t);
}

/**
 * פירוק שורה אחת. הסדר לא חשוב - כל מקטע מזוהה לפי הצורה שלו: מייל, טלפונים,
 * אתר, עיר מהמילון. המקטע הראשון שנשאר הוא השם; השאר נשמר בהערות, לא בשם.
 */
export function parseProspectLine(line: string): ParsedProspect | null {
  const raw = line.trim();
  if (!raw) return null;
  // טאב קודם לפסיק: הדבקה מגיליון היא המקרה הנפוץ, ובתוך תא יכול להיות פסיק.
  const parts = (raw.includes("\t") ? raw.split("\t") : raw.split(/\s*[,|]\s*|\s+-\s+/))
    .map((x) => x.trim())
    .filter((x) => x && !PLACEHOLDER_RE.test(x));
  if (parts.length === 0) return null;

  const phones: string[] = [];
  let email: string | null = null;
  let city: string | null = null;
  let website: string | null = null;
  const rest: string[] = [];

  for (const part of parts) {
    const mail = part.match(EMAIL_RE);
    if (!email && mail && part.replace(EMAIL_RE, "").replace(/^(מייל|דוא"ל|email)[:\s]*/i, "").trim() === "") {
      email = mail[0];
      continue;
    }
    const nums = phonesIn(part);
    if (nums) {
      phones.push(...nums);
      continue;
    }
    if (!website && looksLikeUrl(part)) {
      website = /^https?:\/\//i.test(part) ? part : `https://${part}`;
      continue;
    }
    const canonical = canonicalCity(part);
    if (!city && canonical) {
      city = canonical;
      continue;
    }
    rest.push(part);
  }

  const name = rest[0]?.trim();
  if (!name) return null;
  return {
    name,
    phone: phones.length > 0 ? phones.join(" / ") : null,
    email,
    city,
    website,
    notes: rest.length > 1 ? rest.slice(1).join(" · ") : null,
  };
}

export type AddResult = { added: number; duplicates: number; skipped: number; names: string[] };

/** קליטת רשימה מודבקת. מדלג על מה שכבר קיים - ברשימה או כלקוח. */
export async function addProspectsFromText(text: string): Promise<AddResult> {
  const lines = String(text ?? "").split(/\r?\n/);
  const parsed = lines.map(parseProspectLine).filter((x): x is ParsedProspect => x !== null);
  const result: AddResult = { added: 0, duplicates: 0, skipped: lines.filter((l) => l.trim()).length - parsed.length, names: [] };
  if (parsed.length === 0) return result;

  const [{ data: existing }, { data: accounts }, { data: gapActions }] = await Promise.all([
    supabaseAdmin.from("center_prospects").select("name, phone, whatsapp"),
    supabaseAdmin.from("therapy_center_accounts").select("name, phone, payer_phone"),
    supabaseAdmin
      .from("agent_actions")
      .select("title")
      .eq("agent", "supply_gaps")
      .eq("action_type", "recruit_gap")
      .eq("status", "pending"),
  ]);

  const taken = new Set<string>();
  for (const e of existing ?? []) {
    taken.add(normName(String(e.name ?? "")));
    for (const ph of [...phoneKeys(e.phone as string), ...phoneKeys(e.whatsapp as string)]) taken.add(ph);
  }
  for (const a of accounts ?? []) {
    taken.add(normName(String(a.name ?? "")));
    for (const ph of [...phoneKeys(a.phone as string), ...phoneKeys(a.payer_phone as string)]) taken.add(ph);
  }

  // אותו דירוג כמו במסלול האוטומטי: כמה פערים פתוחים בקבוצת האזור של המכון.
  const gapsByRegionLabel = new Map<string, number>();
  for (const a of gapActions ?? []) {
    const label = String(a.title ?? "").split(" באזור ")[1]?.trim();
    if (label) gapsByRegionLabel.set(label, (gapsByRegionLabel.get(label) ?? 0) + 1);
  }
  const gapsByKey = new Map<string, number>();
  for (const [key, label] of Object.entries(REGION_GROUP_LABELS)) {
    const n = gapsByRegionLabel.get(label);
    if (n) gapsByKey.set(key, n);
  }

  for (const p of parsed) {
    const nName = normName(p.name);
    const nPhones = phoneKeys(p.phone);
    if (taken.has(nName) || nPhones.some((ph) => taken.has(ph))) {
      result.duplicates++;
      continue;
    }
    taken.add(nName);
    for (const ph of nPhones) taken.add(ph);

    const regionKey = prospectRegionOfCity(p.city);

    const { error } = await supabaseAdmin.from("center_prospects").insert({
      name: p.name,
      source: "manual",
      city: p.city,
      region_key: regionKey,
      phone: p.phone,
      email: p.email,
      website: p.website,
      notes: p.notes,
      gaps_in_region: regionKey ? gapsByKey.get(prospectRegionGroup(regionKey)) ?? 0 : 0,
    });
    if (error) result.skipped++;
    else {
      result.added++;
      result.names.push(p.name);
    }
  }
  return result;
}
