import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { fetchAllRows } from "@/app/lib/fetch-all-rows";
import { cancelSubscription, listRecurringForCustomer, updateRecurringPrice, SUMIT_RECURRING_ACTIVE_STATUSES, SUMIT_RECURRING_CANCELLED_STATUS } from "@/app/lib/sumit";
import { sendCenterProposalEmail } from "@/app/lib/center-emails";
import { centerMonthlyPricing } from "@/app/lib/center-pricing";
import { promoteCenterTherapists, demoteCenterTherapists, ensureCenterEntityRow, removeCenterEntityRow } from "@/app/lib/center-promotion";
import { ensureUniqueCenterSlug } from "@/app/lib/center-public";
import { loadCentersWithReadiness } from "@/app/lib/center-readiness-load";
import { missingProfileFields } from "@/app/lib/profile-completeness";

// ניהול מרכזים טיפוליים — הצעות מחיר, קישורי תשלום ומנויים.
// מוגן ע"י ה-middleware של האדמין (/api/admin-*).

export const dynamic = "force-dynamic";

// תמחור לפי מסלול: מסלול 1 (מחיר-למטפל × מספר) או מסלול 2 (מחיר חודשי קבוע —
// "מרכז כישות אחת"). מפרסר ומאמת מגוף הבקשה.
type ParsedPricing =
  | { billingTrack: "per_therapist"; pricePerTherapist: number; therapistCount: number }
  | { billingTrack: "center_entity"; fixedMonthlyPrice: number };
function parseCenterPricing(body: Record<string, unknown>): ParsedPricing | { error: string } {
  const track = body.billing_track === "center_entity" ? "center_entity" : "per_therapist";
  if (track === "center_entity") {
    const fixed =
      typeof body.fixed_monthly_price === "number" ? body.fixed_monthly_price : Number(body.fixed_monthly_price);
    if (isNaN(fixed) || fixed <= 0 || fixed > 1_000_000) return { error: "מחיר חודשי קבוע לא תקין" };
    return { billingTrack: "center_entity", fixedMonthlyPrice: Math.round(fixed * 100) / 100 };
  }
  const price =
    typeof body.price_per_therapist === "number" ? body.price_per_therapist : Number(body.price_per_therapist);
  const count =
    typeof body.therapist_count === "number" ? body.therapist_count : Number(body.therapist_count);
  if (isNaN(price) || price <= 0 || price > 100_000) return { error: "מחיר לכל מטפל לא תקין" };
  if (isNaN(count) || count < 1 || count > 1000) return { error: "מספר מטפלים לא תקין (1–1000)" };
  return { billingTrack: "per_therapist", pricePerTherapist: Math.round(price * 100) / 100, therapistCount: Math.floor(count) };
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// הנחה (₪ קבוע לחודש) ומספר מיקומים (מכפיל מחיר) — חלים על שני המסלולים.
function parseDiscount(v: unknown): number { const n = Number(v); return isNaN(n) || n < 0 ? 0 : Math.round(n * 100) / 100; }
function parseLocations(v: unknown): number { const n = Math.floor(Number(v)); return isNaN(n) || n < 1 ? 1 : Math.min(n, 100); }

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("therapy_center_accounts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;

    // כמה מטפלים משויכים לכל מרכז (לתצוגה בכרטיס + כפתור ניהול המטפלים),
    // וכמה מהם ממתינים לאישור. הפרופילים המשויכים אינם מוצגים ב"ניהול
    // מטפלים" הכללי — כרטיס המרכז הוא הכניסה היחידה אליהם, ולכן הוא חייב
    // לסמן כשמשהו מחכה לאישור (כולל שורת ישות-המרכז במסלול 2).
    const { data: linked } = await supabaseAdmin
      .from("therapists")
      .select("id, center_account_id, status, entity_type")
      .not("center_account_id", "is", null);
    const counts = new Map<string, number>();
    const pendingCounts = new Map<string, number>();
    (linked ?? []).forEach((t) => {
      const cid = t.center_account_id as string;
      if (t.entity_type !== "center") counts.set(cid, (counts.get(cid) ?? 0) + 1); // שורת ישות אינה "מטפל משויך"
      if (t.status === "pending") pendingCounts.set(cid, (pendingCounts.get(cid) ?? 0) + 1);
    });
    // ── מדדי מעורבות לכרטיס המרכז ────────────────────────────────────────
    // עד 19/8/26 האדמין לא הציג לחיצות/צפיות למרכזים בכלל - התשובה ל"כמה
    // פניות מכון X ייצר" חייבה כניסה לתצוגת הפרופילים וסיכום ידני. הסכימה:
    // מסלול 1 = סכום המטפלים המשויכים; מסלול 2 = שורת הישות (שהיא השורה
    // המקושרת היחידה שם, כך שאותה קבוצה משרתת את שני המסלולים).
    // "צפיות" = כניסות לפרופיל (match+directory), אותה הגדרה כמו הפורטל,
    // האדמין-מטפלים והדשבורד. פילוח הערוץ נותן את ההבחנה ממומן/אורגני/ישיר.
    const byCenter = new Map<string, string>();
    (linked ?? []).forEach((t) => byCenter.set(t.id as string, t.center_account_id as string));
    const linkedIds = [...byCenter.keys()];

    type Eng = {
      views_30: number; clicks_30: number; views_total: number; clicks_total: number;
      clicks_30_by_channel: { paid: number; organic: number; direct: number; other: number };
      // "פניות - חלוקה לפי סוגים" (20/8/26): הודעה באתר = ודאית (הטקסט אצלנו),
      // וואטסאפ/טלפון/מייל = כוונה בלבד. אותה הבחנה כמו עמוד הערבות.
      clicks_30_by_type: Record<string, number>;
      // אירועי העמוד הציבורי (analytics_events, מיגרציה 20260820): תנועת
      // העמוד, לחיצות לאתר המרכז, ולחיצות קשר של מסלול 1 (שאין לו ישות).
      page_views_30: number; page_views_total: number;
      website_clicks_30: number; website_clicks_total: number;
      page_contact_30: number; page_contact_total: number;
      // הודעות אתר של מסלול 1 (crm_leads.center_account_id) - במסלול 2 הן
      // כבר בתוך clicks_30_by_type.site_message של הישות, בלי כפילות.
      site_messages_30: number; site_messages_total: number;
    };
    const engByCenter = new Map<string, Eng>();
    const engOf = (cid: string): Eng => {
      let e = engByCenter.get(cid);
      if (!e) engByCenter.set(cid, (e = {
        views_30: 0, clicks_30: 0, views_total: 0, clicks_total: 0,
        clicks_30_by_channel: { paid: 0, organic: 0, direct: 0, other: 0 },
        clicks_30_by_type: {},
        page_views_30: 0, page_views_total: 0,
        website_clicks_30: 0, website_clicks_total: 0,
        page_contact_30: 0, page_contact_total: 0,
        site_messages_30: 0, site_messages_total: 0,
      }));
      return e;
    };

    const cutoff30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
    if (linkedIds.length > 0) {
      const [viewRows, clickRows] = await Promise.all([
        fetchAllRows<{ therapist_id: string; viewed_at: string }>(() =>
          supabaseAdmin
            .from("therapist_profile_views")
            .select("therapist_id, viewed_at")
            .in("therapist_id", linkedIds)
            .in("source", ["match", "directory"]),
        ),
        fetchAllRows<{ therapist_id: string; clicked_at: string; channel: string | null; click_type: string | null }>(() =>
          supabaseAdmin
            .from("therapist_contact_clicks")
            .select("therapist_id, clicked_at, channel, click_type")
            .in("therapist_id", linkedIds),
        ),
      ]);
      for (const v of viewRows) {
        const cid = byCenter.get(v.therapist_id);
        if (!cid) continue;
        const e = engOf(cid);
        e.views_total++;
        if (v.viewed_at >= cutoff30) e.views_30++;
      }
      for (const c of clickRows) {
        const cid = byCenter.get(c.therapist_id);
        if (!cid) continue;
        const e = engOf(cid);
        e.clicks_total++;
        if (c.clicked_at >= cutoff30) {
          e.clicks_30++;
          const ch = c.channel ?? "";
          if (ch === "google_paid" || ch === "meta_paid") e.clicks_30_by_channel.paid++;
          else if (ch === "google_organic") e.clicks_30_by_channel.organic++;
          else if (ch === "direct") e.clicks_30_by_channel.direct++;
          else e.clicks_30_by_channel.other++;
          const ty = c.click_type ?? "other";
          e.clicks_30_by_type[ty] = (e.clicks_30_by_type[ty] ?? 0) + 1;
        }
      }
    }

    // אירועי העמוד הציבורי + הודעות מסלול 1 - לכל המרכזים (גם בלי מטפלים
    // מקושרים: מרכז מסלול 1 עם עמוד ציבורי ובלי אף שיוך עדיין נמדד).
    const [pageEvents, centerLeads] = await Promise.all([
      fetchAllRows<{ event_type: string; created_at: string; metadata: { center_id?: string } | null }>(() =>
        supabaseAdmin
          .from("analytics_events")
          .select("event_type, created_at, metadata")
          .in("event_type", ["center_page_view", "center_website_click", "center_contact_click"]),
      ),
      fetchAllRows<{ center_account_id: string; created_at: string }>(() =>
        supabaseAdmin
          .from("crm_leads")
          .select("center_account_id, created_at")
          .not("center_account_id", "is", null)
          .eq("source", "site_message"),
      ),
    ]);
    for (const ev of pageEvents) {
      const cid = ev.metadata?.center_id;
      if (!cid) continue;
      const e = engOf(cid);
      const recent = ev.created_at >= cutoff30;
      if (ev.event_type === "center_page_view") { e.page_views_total++; if (recent) e.page_views_30++; }
      else if (ev.event_type === "center_website_click") { e.website_clicks_total++; if (recent) e.website_clicks_30++; }
      else { e.page_contact_total++; if (recent) e.page_contact_30++; }
    }
    for (const l of centerLeads) {
      const e = engOf(l.center_account_id);
      e.site_messages_total++;
      if (l.created_at >= cutoff30) e.site_messages_30++;
    }

    // מוכנות לפי מסלול (center-readiness) - למרכזים פעילים. אותו מקור אמת
    // כמו סוכן השימור וקרון הנדנודים, כדי שהאדמין יראה בדיוק את אותו מצב.
    const readinessById = new Map<string, unknown>();
    try {
      for (const r of await loadCentersWithReadiness()) {
        readinessById.set(r.id, {
          pct: r.readiness.pct,
          track_label: r.readiness.trackLabel,
          headline: r.readiness.headline,
          slots: r.readiness.slots,
          missing: r.readiness.missingForCenter.map((i) => ({ label: i.label, critical: i.critical, hint: i.hint ?? null })),
          blocked_on_us: r.readiness.blockedOnUs.map((i) => i.label),
        });
      }
    } catch (e) {
      console.error("admin-centers: readiness load failed:", e instanceof Error ? e.message : e);
    }

    // linked_therapist_count = כמה פרופילי מטפלים משויכים למרכז (שונה מ-
    // therapist_count שבטבלה, שהוא מספר המטפלים שבתמחור ההצעה).
    const centers = (data ?? []).map((c) => ({
      ...c,
      linked_therapist_count: counts.get(c.id as string) ?? 0,
      pending_therapist_count: pendingCounts.get(c.id as string) ?? 0,
      engagement: engByCenter.get(c.id as string) ?? null,
      readiness: readinessById.get(c.id as string) ?? null,
    }));
    return NextResponse.json({ ok: true, centers });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  }
  const action = typeof body.action === "string" ? body.action : "";

  try {
    if (action === "create") {
      const name = str(body.name, 120);
      if (!name) return NextResponse.json({ ok: false, error: "חסר שם מרכז" }, { status: 400 });
      const priced = parseCenterPricing(body);
      if ("error" in priced) return NextResponse.json({ ok: false, error: priced.error }, { status: 400 });
      const gift = Number(body.gift_months ?? 0);
      if (isNaN(gift) || gift < 0 || gift > 12) return NextResponse.json({ ok: false, error: "חודשי מתנה: 0-12" }, { status: 400 });

      const { data, error } = await supabaseAdmin
        .from("therapy_center_accounts")
        .insert({
          name,
          contact_name: str(body.contact_name, 80) || null,
          email: str(body.email, 200) || null,
          phone: str(body.phone, 30) || null,
          notes: str(body.notes, 2000) || null,
          gift_months: Math.round(gift),
          billing_track: priced.billingTrack,
          price_per_therapist: priced.billingTrack === "per_therapist" ? priced.pricePerTherapist : null,
          therapist_count: priced.billingTrack === "per_therapist" ? priced.therapistCount : null,
          fixed_monthly_price: priced.billingTrack === "center_entity" ? priced.fixedMonthlyPrice : null,
          discount_amount: parseDiscount(body.discount_amount),
          num_locations: parseLocations(body.num_locations),
          slug: await ensureUniqueCenterSlug(name),
          token: randomBytes(24).toString("hex"),
        })
        .select("*")
        .single();
      if (error) throw error;
      // מסלול 2: שורת ישות-המרכז נוצרת מיד (נערכת ע"י אדמין/פורטל, מקודמת בתשלום+אישור).
      if (priced.billingTrack === "center_entity" && data?.id) {
        await ensureCenterEntityRow(data.id as string);
      }
      return NextResponse.json({ ok: true, center: data });
    }

    // רשימת מטפלים לבורר השיוך — מי כבר משויך למרכז כלשהו (וכותרתו).
    if (action === "list_therapists") {
      const q = str(body.q, 60).toLowerCase();
      let query = supabaseAdmin
        .from("therapists")
        .select("id, full_name, email, status, center_account_id")
        .neq("entity_type", "center") // שורת ישות-מרכז אינה מטפל שניתן לשייך
        .order("full_name", { ascending: true })
        .limit(500);
      if (q) query = query.ilike("full_name", `%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      const centerNames = new Map<string, string>();
      const { data: centers } = await supabaseAdmin.from("therapy_center_accounts").select("id, name");
      (centers ?? []).forEach((c) => centerNames.set(c.id as string, c.name as string));
      return NextResponse.json({
        ok: true,
        therapists: (data ?? []).map((t) => ({
          id: t.id,
          full_name: t.full_name || "(ללא שם)",
          email: t.email,
          status: t.status,
          center_account_id: t.center_account_id,
          center_name: t.center_account_id ? centerNames.get(t.center_account_id as string) ?? null : null,
        })),
      });
    }

    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return NextResponse.json({ ok: false, error: "missing id" }, { status: 400 });

    const { data: center } = await supabaseAdmin
      .from("therapy_center_accounts")
      .select("*")
      .eq("id", id)
      .single();
    if (!center) return NextResponse.json({ ok: false, error: "מרכז לא נמצא" }, { status: 404 });

    // מחיקת מרכז — רק כשאין מנוי חי (טיוטה/נשלחה/מבוטל). מרכז פעיל יש לבטל קודם.
    if (action === "delete") {
      if (center.status === "active") {
        return NextResponse.json({ ok: false, error: "אי אפשר למחוק מרכז פעיל — בטלו קודם את המנוי" }, { status: 400 });
      }
      // מסירים שורת ישות-מרכז (אם נוצרה) ומנתקים מטפלים משויכים לפני המחיקה.
      await supabaseAdmin.from("therapists").delete().eq("center_account_id", id).eq("entity_type", "center");
      await supabaseAdmin.from("therapists").update({ center_account_id: null }).eq("center_account_id", id);
      const { error } = await supabaseAdmin.from("therapy_center_accounts").delete().eq("id", id);
      if (error) throw error;
      return NextResponse.json({ ok: true, deleted: true });
    }

    if (action === "update") {
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      let syncEntity: "ensure" | "remove" | null = null; // מסלול 2: יצירה/הסרה של שורת ישות-המרכז
      if (body.name !== undefined) {
        const name = str(body.name, 120);
        if (!name) return NextResponse.json({ ok: false, error: "חסר שם מרכז" }, { status: 400 });
        update.name = name;
      }
      if (body.contact_name !== undefined) update.contact_name = str(body.contact_name, 80) || null;
      if (body.email !== undefined) update.email = str(body.email, 200) || null;
      if (body.phone !== undefined) update.phone = str(body.phone, 30) || null;
      if (body.notes !== undefined) update.notes = str(body.notes, 2000) || null;

      // שדות העמוד הציבורי (SEO) — ניתנים לעריכה בכל סטטוס.
      if (body.public_description !== undefined) update.public_description = str(body.public_description, 5000) || null;
      if (body.public_managers !== undefined) update.public_managers = str(body.public_managers, 500) || null;
      if (body.public_city !== undefined) update.public_city = str(body.public_city, 80) || null;
      if (body.public_website !== undefined) update.public_website = str(body.public_website, 300) || null;
      if (body.public_phone !== undefined) update.public_phone = str(body.public_phone, 40) || null;
      if (body.public_page_enabled !== undefined) update.public_page_enabled = !!body.public_page_enabled;
      // ודא slug כשמדליקים את העמוד או עורכים תוכן ציבורי (מרכזים ותיקים בלי slug).
      const touchesPublic =
        body.public_page_enabled !== undefined || body.public_description !== undefined ||
        body.public_managers !== undefined || body.public_city !== undefined ||
        body.public_website !== undefined || body.public_phone !== undefined;
      if (touchesPublic && !center.slug) {
        update.slug = await ensureUniqueCenterSlug((update.name as string) ?? center.name, id);
      }

      // חודשי מתנה משפיעים על מועד החיוב הראשון שנקבע בעת ההצטרפות — נעולים
      // אחרי תשלום כדי לא ליצור פער מול Date_Start שכבר נשמר ב-Sumit.
      const editable = center.status === "draft" || center.status === "sent";
      if (body.gift_months !== undefined) {
        if (!editable) return NextResponse.json({ ok: false, error: "אי אפשר לשנות חודשי מתנה אחרי תשלום" }, { status: 400 });
        const gift = Number(body.gift_months);
        if (isNaN(gift) || gift < 0 || gift > 12) return NextResponse.json({ ok: false, error: "חודשי מתנה: 0-12" }, { status: 400 });
        update.gift_months = Math.round(gift);
      }

      // תמחור — לפי מסלול המרכז (מסלול 1: מחיר×מספר · מסלול 2: מחיר חודשי קבוע).
      // ניתן לעדכן גם אחרי תשלום; במרכז פעיל השינוי מתפרסם מיד להוראת הקבע
      // ב-Sumit, ורק אם Sumit אישר — מעדכנים את הסכום המוסכם בטבלה.
      const touchesPricing =
        body.billing_track !== undefined ||
        body.price_per_therapist !== undefined || body.therapist_count !== undefined ||
        body.fixed_monthly_price !== undefined ||
        body.discount_amount !== undefined || body.num_locations !== undefined;
      if (touchesPricing && center.status === "cancelled") {
        return NextResponse.json({ ok: false, error: "אי אפשר לעדכן תמחור למרכז מבוטל" }, { status: 400 });
      }
      if (touchesPricing) {
        const currentTrack = (center.billing_track as string) ?? "per_therapist";
        const effTrack =
          body.billing_track === "center_entity" || body.billing_track === "per_therapist"
            ? body.billing_track
            : currentTrack;
        // החלפת מסלול חיוב במרכז פעיל אסורה (מורכבות מול הוראת הקבע ב-Sumit).
        if (center.status === "active" && effTrack !== currentTrack) {
          return NextResponse.json({ ok: false, error: "אי אפשר להחליף מסלול חיוב במרכז פעיל" }, { status: 400 });
        }

        let newTotal = 0;
        if (effTrack === "center_entity") {
          // מעבר למסלול 2 כשעדיין משויכים מטפלים בודדים — חוסם עד ניתוקם, אחרת
          // הם נשארים משויכים ומקודמים יחד עם הישות בתשלום (מרכז משלם מחיר קבוע
          // אחד ומקבל את הרובריקה + N פרופילים).
          if (currentTrack !== "center_entity") {
            const { count: linkedIndiv } = await supabaseAdmin
              .from("therapists")
              .select("id", { count: "exact", head: true })
              .eq("center_account_id", id)
              .neq("entity_type", "center");
            if ((linkedIndiv ?? 0) > 0) {
              return NextResponse.json({ ok: false, error: `למרכז משויכים ${linkedIndiv} מטפלים בודדים — נתקו אותם (ניהול מטפלים) לפני מעבר למסלול "מרכז כישות אחת".` }, { status: 400 });
            }
          }
          const fixed = body.fixed_monthly_price !== undefined ? Number(body.fixed_monthly_price) : Number(center.fixed_monthly_price);
          if (isNaN(fixed) || fixed <= 0 || fixed > 1_000_000) return NextResponse.json({ ok: false, error: "מחיר חודשי קבוע לא תקין" }, { status: 400 });
          update.billing_track = "center_entity";
          update.fixed_monthly_price = Math.round(fixed * 100) / 100;
          update.price_per_therapist = null;
          update.therapist_count = null;
          syncEntity = "ensure";
        } else {
          const newPrice = body.price_per_therapist !== undefined ? Number(body.price_per_therapist) : Number(center.price_per_therapist);
          const newCount = body.therapist_count !== undefined ? Number(body.therapist_count) : Number(center.therapist_count);
          if (isNaN(newPrice) || newPrice <= 0 || newPrice > 100_000) return NextResponse.json({ ok: false, error: "מחיר לכל מטפל לא תקין" }, { status: 400 });
          if (isNaN(newCount) || newCount < 1 || newCount > 1000) return NextResponse.json({ ok: false, error: "מספר מטפלים לא תקין (1–1000)" }, { status: 400 });
          const pp = Math.round(newPrice * 100) / 100;
          const cnt = Math.floor(newCount);

          // אי אפשר להקטין את המכסה מתחת למספר המטפלים המשויכים בפועל (לא כולל
          // שורת ישות-המרכז עצמה) — קודם מנתקים מטפלים.
          const { count: linkedNow } = await supabaseAdmin
            .from("therapists")
            .select("id", { count: "exact", head: true })
            .eq("center_account_id", id)
            .neq("entity_type", "center");
          if ((linkedNow ?? 0) > cnt) {
            return NextResponse.json(
              { ok: false, error: `למרכז משויכים כרגע ${linkedNow} מטפלים — אי אפשר להקטין את המכסה ל-${cnt}. נתקו מטפלים קודם (ניהול מטפלים).` },
              { status: 400 },
            );
          }

          update.billing_track = "per_therapist";
          update.price_per_therapist = pp;
          update.therapist_count = cnt;
          update.fixed_monthly_price = null;
          if (currentTrack === "center_entity") syncEntity = "remove"; // הוחזר ממסלול 2 למסלול 1
        }

        // מיקומים והנחה — חלים על שני המסלולים; הסכום הסופי מחושב דרך הדיספצ'ר.
        const effLocations = body.num_locations !== undefined ? parseLocations(body.num_locations) : (Number(center.num_locations) || 1);
        const effDiscount = body.discount_amount !== undefined ? parseDiscount(body.discount_amount) : (Number(center.discount_amount) || 0);
        if (body.num_locations !== undefined) update.num_locations = effLocations;
        if (body.discount_amount !== undefined) update.discount_amount = effDiscount;
        newTotal = centerMonthlyPricing({
          billing_track: effTrack,
          price_per_therapist: effTrack === "per_therapist" ? ((update.price_per_therapist as number | null) ?? center.price_per_therapist) : null,
          therapist_count: effTrack === "per_therapist" ? ((update.therapist_count as number | null) ?? center.therapist_count) : null,
          fixed_monthly_price: effTrack === "center_entity" ? ((update.fixed_monthly_price as number | null) ?? center.fixed_monthly_price) : null,
          num_locations: effLocations,
          discount_amount: effDiscount,
        }).monthlyTotal;

        if (center.status === "active") {
          const oldTotal = Number(center.agreed_monthly_price) || 0;
          // רצפת מחיר: בלעדיה הנחה שגויה (או גדולה מהבסיס) דוחפת UnitPrice=0
          // ל-Sumit, השירות ממשיך והגבייה נעצרת בשקט. subscribe כבר חוסם ≤0.
          if (newTotal <= 0) {
            return NextResponse.json(
              { ok: false, error: "הסכום החודשי לאחר ההנחה יוצא 0 או פחות. לעצירת גבייה יש לבטל את המנוי, לא לאפס את המחיר." },
              { status: 400 },
            );
          }
          if (Math.round(newTotal * 100) !== Math.round(oldTotal * 100)) {
            if (!center.sumit_recurring_id) {
              return NextResponse.json({ ok: false, error: "לא ניתן לעדכן חיוב — חסר מזהה הוראת קבע ב-Sumit. עדכנו ידנית בממשק Sumit." }, { status: 400 });
            }
            try {
              await updateRecurringPrice({
                recurringItemId: Number(center.sumit_recurring_id),
                customerExternalId: `center:${center.id}`,
                unitPrice: newTotal,
              });
            } catch (e) {
              console.error(`admin-centers update: Sumit price update failed for center=${center.id}:`, e instanceof Error ? e.message : e);
              return NextResponse.json({ ok: false, error: "עדכון החיוב ב-Sumit נכשל — לא בוצע שינוי. נסו שוב." }, { status: 502 });
            }
            update.agreed_monthly_price = newTotal;
          }
        }
      }

      const { error } = await supabaseAdmin.from("therapy_center_accounts").update(update).eq("id", id);
      if (error) throw error;
      if (syncEntity === "ensure") await ensureCenterEntityRow(id);
      else if (syncEntity === "remove") await removeCenterEntityRow(id);
      // מסלול 2: שינוי מייל/טלפון/שם המרכז מתפשט לשורת הישות. השם היה חסר
      // כאן (ממצא 9 בביקורת 4/8/26): מרכז ששינה שם המשיך להופיע בכרטיס
      // ההתאמה בשם הישן, כי הכרטיס נבנה מ-full_name של שורת הישות.
      const centerNowEntity =
        update.billing_track === "center_entity" ||
        (update.billing_track === undefined && (center.billing_track as string) === "center_entity");
      if (centerNowEntity && (body.email !== undefined || body.phone !== undefined || update.name !== undefined)) {
        const contactPatch: Record<string, unknown> = {};
        if (body.email !== undefined) contactPatch.email = str(body.email, 200) || null;
        if (body.phone !== undefined) contactPatch.phone = str(body.phone, 30) || null;
        if (update.name !== undefined) contactPatch.full_name = update.name;
        await supabaseAdmin.from("therapists").update(contactPatch).eq("center_account_id", id).eq("entity_type", "center");
      }
      return NextResponse.json({ ok: true });
    }

    // שיוך מטפלים למרכז: קובע center_account_id למטפלים שנבחרו, ומנתק כל מטפל
    // שהיה משויך למרכז הזה ולא נכלל ברשימה החדשה. שיוך למרכז אחד בכל רגע.
    if (action === "set_therapists") {
      // מסלול 2 (מרכז כישות) — אין ניהול מטפלים בודדים; המרכז הוא רובריקה אחת.
      if ((center.billing_track as string) === "center_entity") {
        return NextResponse.json({ ok: false, error: "מרכז במסלול 'מרכז כישות אחת' מיוצג כרובריקה אחת ואינו מנהל מטפלים בודדים." }, { status: 400 });
      }
      const raw = Array.isArray(body.therapist_ids) ? body.therapist_ids : [];
      // רק UUID תקינים — הערכים נכנסים למחרוזת filter גולמית (not.in.(...)),
      // אז ערך עם פסיק/סוגר היה שובר או משנה את משמעות ה-filter.
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const idsSet = [...new Set(raw.filter((x): x is string => typeof x === "string" && UUID_RE.test(x)))].slice(0, 500);

      // אכיפת המכסה: המרכז משלם לפי therapist_count — אי אפשר לשייך יותר.
      const quota = Math.floor(Number(center.therapist_count) || 0);
      if (quota > 0 && idsSet.length > quota) {
        return NextResponse.json(
          { ok: false, error: `ההצעה של המרכז כוללת ${quota} מטפלים — נבחרו ${idsSet.length}. להוספת מטפלים יש להגדיל את מספר המטפלים בעריכת המרכז (יעדכן את החיוב).` },
          { status: 400 },
        );
      }

      // מי משויך כרגע — כדי להוריד מקידום 'center' את מי שמנותק עכשיו.
      const { data: currentLinked } = await supabaseAdmin
        .from("therapists")
        .select("id")
        .eq("center_account_id", id)
        .neq("entity_type", "center");
      const removedIds = (currentLinked ?? []).map((t) => t.id).filter((tid) => !idsSet.includes(tid));

      // נתק מטפלים שהיו משויכים למרכז ואינם ברשימה החדשה.
      let unassign = supabaseAdmin
        .from("therapists")
        .update({ center_account_id: null })
        .eq("center_account_id", id)
        .neq("entity_type", "center"); // לעולם לא לנתק את שורת ישות-המרכז
      if (idsSet.length > 0) unassign = unassign.not("id", "in", `(${idsSet.join(",")})`);
      await unassign.throwOnError();

      // מטפל שנותק מאבד את קידום המרכז (רק promotion_source='center').
      if (removedIds.length > 0) {
        await demoteCenterTherapists({ therapistIds: removedIds }, `unlinked from center ${id}`);
      }

      // שייך את הנבחרים (דורס שיוך קודם למרכז אחר — שיוך יחיד).
      if (idsSet.length > 0) {
        await supabaseAdmin
          .from("therapists")
          .update({ center_account_id: id })
          .in("id", idsSet)
          .throwOnError();
      }

      // מרכז פעיל ⇒ מטפלים מאושרים שזה עתה שויכו נכנסים להתאמות מיד.
      const promoted = await promoteCenterTherapists(id);
      return NextResponse.json({ ok: true, count: idsSet.length, promoted });
    }

    // שליחת ההצעה במייל למרכז — מפרט מסלולים/מחיר/מתנה + קישור ההצטרפות.
    // רלוונטי רק להצעה שטרם שולמה, וגם מסמן אותה אוטומטית כ"נשלחה".
    if (action === "send_proposal") {
      if (center.status !== "draft" && center.status !== "sent") {
        return NextResponse.json({ ok: false, error: "רלוונטי רק להצעה שטרם שולמה" }, { status: 400 });
      }
      if (!center.email) {
        return NextResponse.json({ ok: false, error: "למרכז אין כתובת מייל — עדכנו אימייל בעריכת ההצעה" }, { status: 400 });
      }
      const centerTrack = (center.billing_track as string) ?? "per_therapist";
      if (centerTrack === "center_entity") {
        if (!(Number(center.fixed_monthly_price) > 0)) {
          return NextResponse.json({ ok: false, error: "יש להגדיר מחיר חודשי קבוע לפני שליחת ההצעה" }, { status: 400 });
        }
      } else if (!(Number(center.price_per_therapist) > 0) || !(Number(center.therapist_count) > 0)) {
        return NextResponse.json({ ok: false, error: "יש להגדיר מחיר לכל מטפל ומספר מטפלים לפני שליחת ההצעה" }, { status: 400 });
      }
      const sent = await sendCenterProposalEmail({
        to: center.email as string,
        centerName: center.name as string,
        contactName: (center.contact_name as string | null) ?? null,
        billingTrack: centerTrack,
        pricePerTherapist: Number(center.price_per_therapist),
        therapistCount: Number(center.therapist_count),
        fixedMonthlyPrice: Number(center.fixed_monthly_price),
        discountAmount: Number(center.discount_amount) || 0,
        numLocations: Number(center.num_locations) || 1,
        giftMonths: Number(center.gift_months ?? 0),
        token: center.token as string,
      });
      if (!sent.ok) {
        return NextResponse.json({ ok: false, error: sent.error || "email failed" }, { status: 502 });
      }
      await supabaseAdmin
        .from("therapy_center_accounts")
        .update({ status: "sent", updated_at: new Date().toISOString() })
        .eq("id", id)
        .throwOnError();
      return NextResponse.json({ ok: true, status: "sent" });
    }

    if (action === "mark_sent") {
      if (center.status !== "draft" && center.status !== "sent") {
        return NextResponse.json({ ok: false, error: "רלוונטי רק להצעה שטרם שולמה" }, { status: 400 });
      }
      const next = center.status === "sent" ? "draft" : "sent";
      await supabaseAdmin
        .from("therapy_center_accounts")
        .update({ status: next, updated_at: new Date().toISOString() })
        .eq("id", id)
        .throwOnError();
      return NextResponse.json({ ok: true, status: next });
    }

    // חידוש קישור ההצטרפות: מנפיק טוקן חדש ומבטל את הישן, בלי לגעת בתמחור
    // שנסגר בשיחת המכירה. שימושי כשקישור דלף/הועבר הלאה, או כשרוצים לשלוח
    // הצעה "נקייה" אחרי תקלה. חסום למרכז פעיל - שם הטוקן הוא גם קישור הקמת
    // חשבון הניהול, וחידושו ינתק את המרכז מהמייל שכבר נשלח אליו.
    if (action === "regenerate_token") {
      if (center.status !== "draft" && center.status !== "sent") {
        return NextResponse.json(
          { ok: false, error: "אפשר לחדש קישור רק להצעה שטרם שולמה" },
          { status: 400 },
        );
      }
      const { randomBytes } = await import("crypto");
      const newToken = randomBytes(24).toString("hex");
      await supabaseAdmin
        .from("therapy_center_accounts")
        .update({ token: newToken, updated_at: new Date().toISOString() })
        .eq("id", id)
        .throwOnError();
      console.log(`admin-centers: token regenerated for center=${id} (${center.name}) - old link revoked`);
      return NextResponse.json({ ok: true, token: newToken });
    }

    if (action === "cancel_subscription") {
      if (center.status !== "active" || !center.sumit_recurring_id) {
        return NextResponse.json({ ok: false, error: "אין מנוי פעיל לביטול" }, { status: 400 });
      }
      // cancelSubscription מאמת מול Sumit שההוראה באמת בוטלה — זורק אם לא.
      await cancelSubscription({
        recurringItemId: Number(center.sumit_recurring_id),
        customerExternalId: `center:${center.id}`,
      });
      await supabaseAdmin
        .from("therapy_center_accounts")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", id)
        .throwOnError();
      // מטפלי המרכז יוצאים ממערכת ההתאמות (נשארים במאגר החינמי אם אושרו).
      const demoted = await demoteCenterTherapists({ centerId: id }, "center subscription cancelled by admin");
      return NextResponse.json({ ok: true, demoted });
    }

    if (action === "sync_sumit") {
      // מצב חי מ-Sumit: חיוב הבא, מחיר, וסטטוס ההוראה. אם בוטלה בצד Sumit —
      // מעדכנים גם אצלנו.
      const items = await listRecurringForCustomer({
        externalIdentifier: `center:${center.id}`,
        includeInactive: true,
      });
      const ours = center.sumit_recurring_id
        ? items.find((i) => Number(i.ID) === Number(center.sumit_recurring_id))
        : items.sort((a, b) => Number(b.ID) - Number(a.ID))[0];
      // מבטלים אצלנו רק כשההוראה באמת בוטלה ב-Sumit (Status=1). 0=פעילה
      // ו-12=מתוזמנת (חודשי מתנה) הן חיות. הבדיקה הישנה (Status !== 0) ביטלה
      // מרכז בתקופת מתנה בכל לחיצה על "סטטוס מ-Sumit" - אותו באג שהיה ב-cron.
      const isLive = ours ? SUMIT_RECURRING_ACTIVE_STATUSES.includes(Number(ours.Status)) : false;
      if (ours && ours.Status === SUMIT_RECURRING_CANCELLED_STATUS && center.status === "active") {
        await supabaseAdmin
          .from("therapy_center_accounts")
          .update({ status: "cancelled", cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", id);
        await demoteCenterTherapists({ centerId: id }, "center standing order cancelled at Sumit (sync)");
      } else if (ours && !isLive && ours.Status !== SUMIT_RECURRING_CANCELLED_STATUS) {
        console.warn(`admin-centers sync_sumit: unknown Sumit status ${ours.Status} for center ${id} - not cancelling`);
      }
      return NextResponse.json({
        ok: true,
        sumit: ours
          ? { status: ours.Status, next_billing: ours.Date_NextBilling ?? null, unit_price: ours.UnitPrice ?? null }
          : null,
      });
    }

    // פירוט לפי מטפל למרכז אחד - נטען בפתיחת "פירוט" בכרטיס המרכז באדמין.
    // מסלול 1: שורה לכל מטפל מקושר; מסלול 2: שורת הישות היא השורה היחידה.
    if (action === "center_engagement") {
      const { data: mine } = await supabaseAdmin
        .from("therapists")
        .select("id, full_name, status, promotion_source, entity_type, admin_approved, email, profile_photo_path, regions, therapist_types, training_areas")
        .eq("center_account_id", id);
      const rows = mine ?? [];
      if (rows.length === 0) return NextResponse.json({ ok: true, therapists: [] });

      const ids2 = rows.map((t) => t.id as string);
      const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const [views2, clicks2, certRows] = await Promise.all([
        fetchAllRows<{ therapist_id: string; viewed_at: string }>(() =>
          supabaseAdmin
            .from("therapist_profile_views")
            .select("therapist_id, viewed_at")
            .in("therapist_id", ids2)
            .in("source", ["match", "directory"]),
        ),
        fetchAllRows<{ therapist_id: string; clicked_at: string; click_type: string | null }>(() =>
          supabaseAdmin
            .from("therapist_contact_clicks")
            .select("therapist_id, clicked_at, click_type")
            .in("therapist_id", ids2),
        ),
        supabaseAdmin.from("therapist_certificates").select("therapist_id").in("therapist_id", ids2),
      ]);
      const certSet = new Set((certRows.data ?? []).map((r) => r.therapist_id as string));

      type Per = { views_30: number; views_total: number; clicks_30: number; clicks_total: number; by_type_30: Record<string, number> };
      const per = new Map<string, Per>();
      const perOf = (tid: string): Per => {
        let x = per.get(tid);
        if (!x) per.set(tid, (x = { views_30: 0, views_total: 0, clicks_30: 0, clicks_total: 0, by_type_30: {} }));
        return x;
      };
      for (const v of views2) { const x = perOf(v.therapist_id); x.views_total++; if (v.viewed_at >= cutoff) x.views_30++; }
      for (const cl of clicks2) {
        const x = perOf(cl.therapist_id);
        x.clicks_total++;
        if (cl.clicked_at >= cutoff) {
          x.clicks_30++;
          const ty = cl.click_type ?? "other";
          x.by_type_30[ty] = (x.by_type_30[ty] ?? 0) + 1;
        }
      }

      const therapists = rows
        .map((t) => {
          const x = per.get(t.id as string) ?? { views_30: 0, views_total: 0, clicks_30: 0, clicks_total: 0, by_type_30: {} };
          // לשורת ישות-מרכז אין "תעודת רישיון" - זה ארגון, לא אדם מוסמך.
          const missing = missingProfileFields(
            {
              full_name: (t.full_name as string) ?? "",
              profile_photo_path: t.profile_photo_path as string | null,
              regions: t.regions as string[] | null,
              therapist_types: t.therapist_types as string[] | null,
              training_areas: t.training_areas as string[] | null,
            },
            t.entity_type === "center" || certSet.has(t.id as string),
          );
          return {
            id: t.id,
            full_name: (t.full_name as string) || "(ללא שם)",
            is_entity: t.entity_type === "center",
            status: t.status,
            promoted: t.status === "paying",
            admin_approved: !!t.admin_approved,
            email: (t.email as string) || null,
            missing_fields: missing,
            ...x,
          };
        })
        // הישות ראשונה, אחריה לפי לחיצות 30 יום - מי שמייצר הכי הרבה למעלה.
        .sort((a, b) => (b.is_entity ? 1 : 0) - (a.is_entity ? 1 : 0) || b.clicks_30 - a.clicks_30);

      return NextResponse.json({ ok: true, therapists });
    }

    return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
