import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { fetchAllRows } from "@/app/lib/fetch-all-rows";
import { therapistPath } from "@/app/lib/therapist-url";
import { resolveCenter } from "@/app/lib/center-auth";
import { signCenterAssets, type CenterTeamMember, type CenterGalleryPhoto, type CenterDirector, type CenterFaqItem } from "@/app/lib/center-public";

// פורטל המרכז הטיפולי - API מאומת שמחזיר את מטפלי המרכז + סטטיסטיקות
// מצטברות לכל המרכז. הכניסה היא בחשבון Supabase Auth של המרכז (מקביל למטפל).

export const dynamic = "force-dynamic";

// הגבלת קצב לפי IP - הנתיב מאומת בטוקן, אבל זה חוסם ניסיונות claim חוזרים
// וקריאות מוגזמות. in-memory, מתאפס ב-cold start.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 60) return false;
  entry.count++;
  return true;
}

// אימות משותף לכל נתיבי הפורטל - resolveCenter ב-app/lib/center-auth.ts.

type TherapistRow = {
  id: string;
  full_name: string | null;
  status: string;
  admin_approved: boolean | null;
  profile_photo_path: string | null;
  regions: string[] | null;
  online: boolean | null;
  promoted_since: string | null;
  created_at: string | null;
};

const monthAgo = () => new Date(Date.now() - 30 * 86_400_000);
const weekAgo = () => new Date(Date.now() - 7 * 86_400_000);

function tallyBy<T>(rows: T[], key: (r: T) => string | null | undefined) {
  const counts: Record<string, number> = {};
  for (const r of rows) {
    const v = key(r);
    if (v) counts[v] = (counts[v] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ ok: false, error: "יותר מדי בקשות - נסו שוב בעוד רגע" }, { status: 429 });
  }

  const center = await resolveCenter(req);
  if (!center) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    // מסלול 2 (מרכז כישות): שורת ישות-המרכז אינה מוצגת ברשימת המטפלים - היא
    // הפרופיל שהמרכז עורך. שולפים את מזההּ וסטטוסהּ כדי שהדשבורד יקשר לעריכה.
    const isEntity = (center.billing_track as string) === "center_entity";
    let entity: { id: string; status: string; admin_approved: boolean; matching_filled: boolean; since: string | null } | null = null;
    if (isEntity) {
      const { data: e } = await supabaseAdmin
        .from("therapists")
        .select("id, status, admin_approved, training_areas, therapist_types, age_groups, regions, online, promoted_since, created_at")
        .eq("center_account_id", center.id)
        .eq("entity_type", "center")
        .maybeSingle();
      if (e) {
        // "מולא להתאמות" = יש לפחות תחום/סוג טיפול + קהל (גילאים) + כיסוי
        // (אזור או אונליין). בלי אלה המרכז לא ייתפס באף שאלון - הדשבורד
        // מציג אזהרה בולטת עד שימולאו.
        const arr = (v: unknown) => (Array.isArray(v) ? v : []);
        const matchingFilled =
          (arr(e.training_areas).length > 0 || arr(e.therapist_types).length > 0) &&
          arr(e.age_groups).length > 0 &&
          (arr(e.regions).length > 0 || !!e.online);
        entity = {
          id: e.id as string,
          status: e.status as string,
          admin_approved: !!e.admin_approved,
          matching_filled: matchingFilled,
          // עוגן תקופת ההשוואה למסלול 2: שורת הישות לא נכללת ברשימת המטפלים
          // למטה, ובלי השדה הזה העוגן היה נופל על תאריך הפעילות המוקדם ביותר.
          since: ((e.promoted_since ?? e.created_at) as string | null) ?? null,
        };
      }
    }

    const { data: therapistsData } = await supabaseAdmin
      .from("therapists")
      .select("id, full_name, status, admin_approved, profile_photo_path, regions, online, promoted_since, created_at")
      .eq("center_account_id", center.id)
      .neq("entity_type", "center")
      .order("full_name", { ascending: true });
    const therapists = (therapistsData ?? []) as TherapistRow[];
    const ids = therapists.map((t) => t.id);
    // מסלול 2: הסטטיסטיקות המרוכזות מתייחסות לשורת ישות-המרכז (רובריקה אחת).
    const statIds = isEntity && entity ? [entity.id] : ids;

    // חתימות תמונה (batch אחד) לתצוגת רשימת המטפלים.
    const photoById = new Map<string, string>();
    const photoPaths = therapists.filter((t) => t.profile_photo_path).map((t) => t.profile_photo_path!) as string[];
    if (photoPaths.length > 0) {
      const { data: signed } = await supabaseAdmin.storage
        .from("therapist-certificates")
        .createSignedUrls(photoPaths, 60 * 60 * 24);
      (signed ?? []).forEach((s, i) => {
        if (s.signedUrl) photoById.set(photoPaths[i], s.signedUrl);
      });
    }

    // תווית המנוי במודל החדש: מספר מטפלים (התמחור המלא מוצג רק באדמין).
    const planTitle = isEntity
      ? "מרכז כישות אחת"
      : (Number(center.therapist_count) > 0 ? `מנוי ל-${center.therapist_count} מטפלים` : null);

    // מידע העמוד הציבורי - משותף לשני מסלולי המענה (עם/בלי מטפלים).
    const teamRaw: CenterTeamMember[] = Array.isArray(center.team_members)
      ? (center.team_members as CenterTeamMember[])
      : [];
    const galleryRaw: CenterGalleryPhoto[] = Array.isArray(center.gallery)
      ? (center.gallery as CenterGalleryPhoto[])
      : [];
    const directorRaw: CenterDirector =
      center.public_director && typeof center.public_director === "object" && !Array.isArray(center.public_director)
        ? (center.public_director as CenterDirector)
        : {};
    const faqRaw: CenterFaqItem[] = Array.isArray(center.public_faq) ? (center.public_faq as CenterFaqItem[]) : [];
    const signedAssets = await signCenterAssets({
      logo_path: (center.logo_path as string | null) ?? null,
      team_members: teamRaw,
      gallery: galleryRaw,
      public_director: directorRaw,
    });
    const publicPage = {
      slug: center.slug,
      enabled: !!center.public_page_enabled,
      description: center.public_description,
      managers: center.public_managers,
      city: center.public_city,
      website: center.public_website,
      phone: center.public_phone,
      founded_year: center.public_founded_year ?? null,
      team_size: center.public_team_size ?? null,
      address: center.public_address,
      hours: center.public_hours,
      accessibility: center.public_accessibility,
      director: {
        name: directorRaw.name ?? "",
        role: directorRaw.role ?? "",
        note: directorRaw.note ?? "",
        photo_path: directorRaw.photo_path ?? null,
        photo_url: signedAssets.directorPhotoUrl,
      },
      faq: faqRaw.map((f) => ({ q: f.q ?? "", a: f.a ?? "" })),
      logo_path: (center.logo_path as string | null) ?? null,
      logo_url: signedAssets.logoUrl,
      team: teamRaw.map((m, i) => ({ name: m.name, role: m.role, photo_path: m.photo_path ?? null, photo_url: signedAssets.team[i]?.photoUrl ?? null })),
      gallery: galleryRaw.map((g, i) => ({ path: g.path, caption: g.caption ?? null, url: signedAssets.gallery[i]?.url ?? null })),
    };

    // אין נתונים להצגה - מחזירים שלד ריק (מרכז חדש / טרם שויכו מטפלים / ישות
    // שטרם נכנסה להתאמות).
    if (statIds.length === 0) {
      return NextResponse.json({
        ok: true,
        center: {
          name: center.name,
          status: center.status,
          billing_track: center.billing_track,
          entity,
          plan_title: planTitle,
          billing_starts_at: center.billing_starts_at,
          therapist_quota: Math.floor(Number(center.therapist_count) || 0),
          linked_count: 0,
          public_page: publicPage,
        },
        therapists: [],
        stats: null,
        generated_at: new Date().toISOString(),
      });
    }

    const mAgo = monthAgo().toISOString();
    const wAgo = weekAgo().toISOString();
    const sixMonthsAgo = new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1).toISOString();

    // מצטבר, בלי חלון של 30 יום (יושר עם דשבורד המטפל, 10/8/26): הפילוחים
    // לפי אזור/קושי/גיל היו נחתכים לחודש האחרון בזמן שהחלק העליון הראה
    // מספרים מצטברים - אותה סתירה שדווחה בפרופיל האישי. הקליקים כבר נשלפו
    // ל-6 חודשים לצורך המגמה; עכשיו גם הם ללא חסם, והמגמה עדיין חותכת ל-6.
    const [clicks, views, dirImpressions] = await Promise.all([
      fetchAllRows<{ therapist_id: string; click_type: string; clicked_at: string; source: string | null }>(() =>
        supabaseAdmin
          .from("therapist_contact_clicks")
          .select("therapist_id, click_type, clicked_at, source")
          .in("therapist_id", statIds),
      ),
      fetchAllRows<{ therapist_id: string; viewed_at: string; source: string | null; viewer_region: string | null; viewer_issue: string | null; viewer_age_band: string | null; viewer_gender: string | null }>(() =>
        supabaseAdmin
          .from("therapist_profile_views")
          .select("therapist_id, viewed_at, source, viewer_region, viewer_issue, viewer_age_band, viewer_gender")
          .in("therapist_id", statIds),
      ),
      // הופעות במאגר המטפלים - נרשמות כאירוע analytics ולא כ-profile_view,
      // ולכן נעדרו מהפורטל לגמרי. זו החשיפה הגדולה מבין השתיים.
      // count בלבד: הטבלה גדולה (42K+ שורות) ואנחנו צריכים רק מספר.
      supabaseAdmin
        .from("analytics_events")
        .select("*", { count: "exact", head: true })
        .eq("event_type", "profile_impression")
        .in("therapist_id", statIds),
    ]);

    const clicksMonth = clicks.filter((c) => c.clicked_at >= mAgo);
    const clicksWeek = clicks.filter((c) => c.clicked_at >= wAgo);
    // צפיות אמיתיות בפרופיל (לא חשיפת כרטיס במאטצ'ינג) + הופעות במאטצ'ינג בנפרד.
    const realViews = views.filter((v) => v.source !== "match_card");
    const matchImpressions = views.length - realViews.length;

    // ── משפך לפי מקור החשיפה ────────────────────────────────────────────
    // "7 הופעות מאגר, 3 מאטצ'ינג" לא אומר כלום בלי לדעת מה קרה אחר כך.
    // הפילוח הזה עונה על השאלה המעשית: מאיזה מקור באמת מגיעות הפניות -
    // ולכן איפה כדאי למרכז להשקיע (פרופיל ציבורי מול סימון תחומי הטיפול).
    // הערה: לחיצות עם source='profile' נעשו בעמוד הפרופיל עצמו, כשהמבקר
    // הגיע לשם ישירות (גוגל/קישור) - הן נספרות בנפרד ולא מיוחסות לאף מקור.
    const funnelFor = (viewSource: string, impressions: number) => {
      const entries = realViews.filter((v) => v.source === viewSource).length;
      const contacts = clicks.filter((c) => c.source === viewSource).length;
      return {
        impressions,
        entries,
        contacts,
        entry_rate: impressions > 0 ? Math.round((entries / impressions) * 1000) / 10 : 0,
        contact_rate: entries > 0 ? Math.round((contacts / entries) * 1000) / 10 : 0,
      };
    };
    const bySource = {
      match: funnelFor("match", matchImpressions),
      directory: funnelFor("directory", dirImpressions.count ?? 0),
      // פניות ישירות מעמוד הפרופיל - בלי מקור פנימי מזוהה.
      direct_contacts: clicks.filter((c) => c.source === "profile").length,
    };

    const clicksByType = (rows: { click_type: string }[]) => ({
      whatsapp: rows.filter((r) => r.click_type === "whatsapp").length,
      phone: rows.filter((r) => r.click_type === "phone").length,
      email: rows.filter((r) => r.click_type === "email").length,
      site_message: rows.filter((r) => r.click_type === "site_message").length,
      total: rows.length,
    });

    // ── השוואה לממוצע מטפל ללא קידום ────────────────────────────────────
    // ההשוואה נעשית על *אותו חלון תאריכים* לשני הצדדים, ולא כממוצע-ליום על
    // פני כל ההיסטוריה. שתי סיבות, שתיהן נמדדו בנתונים:
    //
    // 1) התנועה באתר גדלה - מ-24 צפיות ליום ביולי ל-100 בתחילת אוגוסט.
    //    ממוצע-ליום היסטורי היה מייצר בנצ'מרק נמוך מלאכותית, כלומר מנפח את
    //    היתרון שאנחנו מציגים למרכז. זה בדיוק סוג ההטעיה שאסור למכור בה.
    // 2) מטפל חינמי ותיק צבר חשיפה בתקופות אחרות. לכן נכללים רק חינמיים
    //    שהיו רשומים כבר בתחילת החלון - כך לכולם אותו פרק זמן בדיוק.
    //
    // שערי איכות: לפחות 14 ימי חשיפה למרכז, ולפחות BENCH_MIN_PEERS חינמיים
    // ותיקים להשוואה. מתחת לזה לא מציגים כלום - השוואה על בסיס דל גרועה מכלום.
    //
    // החלון נבחר בנסיגה: הכי ארוך שעדיין עומד בסף העמיתים. המאגר החינמי
    // התחיל להתמלא ב-23/6, ולכן חלון של 60 יום מוצא כמעט אף עמית ותיק -
    // בלי הנסיגה דווקא המרכזים הוותיקים היו נשארים בלי השוואה בכלל.
    const BENCH_WINDOWS = [60, 45, 30, 21, 14];
    const BENCH_MIN_PEERS = 20;

    let benchmark: {
      days: number; peers: number;
      per_therapist_views: number; per_therapist_contacts: number;
      free_avg_views: number; free_avg_contacts: number;
    } | null = null;
    try {
      // עוגן התקופה: מתי המרכז התחיל לצבור חשיפה בפועל. מסלול 1 - התאריך
      // המוקדם מבין מטפלי המרכז; מסלול 2 - שורת הישות עצמה. לא נופלים על
      // תאריך הפעילות המוקדם ביותר: פרופיל שהיה במאגר לפני שהמרכז הצטרף
      // גורר את העוגן אחורה ומייצר חלון השוואה ארוך מגיל המנוי.
      const therapistAnchor = isEntity
        ? entity?.since ?? null
        : therapists
            .map((t) => t.promoted_since ?? t.created_at)
            .filter((d): d is string => !!d)
            .sort()[0] ?? null;
      const startIso = therapistAnchor ?? center.billing_starts_at ?? null;
      const rawDays = startIso
        ? Math.floor((Date.now() - new Date(startIso).getTime()) / 86_400_000)
        : 0;

      // שליפה אחת של כל החינמיים עם תאריך ההצטרפות; ממנה נגזרות כל הבדיקות.
      const { data: freeRows } = await supabaseAdmin
        .from("therapists")
        .select("id, created_at")
        .eq("status", "approved")
        .eq("admin_approved", true)
        .eq("accepting_new_patients", true)
        .neq("entity_type", "center");
      const freePeers = (freeRows ?? []).map((r) => ({
        id: r.id as string,
        joined: new Date(r.created_at as string).getTime(),
      }));

      // המועמד הראשון הוא גיל המרכז עצמו (עד 60 יום) - כך מרכז בן 20 יום
      // נמדד על 20 יום מלאים ולא נופל לשלב הבא בסולם.
      const candidates = [Math.min(rawDays, BENCH_WINDOWS[0]), ...BENCH_WINDOWS]
        .filter((d, i, a) => d <= rawDays && d >= BENCH_WINDOWS[BENCH_WINDOWS.length - 1] && a.indexOf(d) === i)
        .sort((a, b) => b - a);

      let windowDays = 0;
      let freeIds: string[] = [];
      for (const days of candidates) {
        const cutoff = Date.now() - days * 86_400_000;
        const eligible = freePeers.filter((p) => p.joined <= cutoff);
        if (eligible.length >= BENCH_MIN_PEERS) {
          windowDays = days;
          freeIds = eligible.map((p) => p.id);
          break;
        }
      }

      if (windowDays > 0) {
        const windowStart = new Date(Date.now() - windowDays * 86_400_000).toISOString();
        // ספירה במנות: רשימת מזהים ב-in() נכנסת ל-URL, וכשהמאגר החינמי יגדל
        // רשימה אחת תחרוג ממגבלת אורך הבקשה ותפיל את הבנצ'מרק בשקט.
        const CHUNK = 80;
        const chunks: string[][] = [];
        for (let i = 0; i < freeIds.length; i += CHUNK) chunks.push(freeIds.slice(i, i + CHUNK));
        const sumCounts = async (
          build: (ids: string[]) => PromiseLike<{ count: number | null }>,
        ) => (await Promise.all(chunks.map(build))).reduce((s, r) => s + (r.count ?? 0), 0);
        {
          const [fv, fc] = await Promise.all([
            sumCounts((ids) =>
              supabaseAdmin.from("therapist_profile_views").select("*", { count: "exact", head: true })
                .in("therapist_id", ids).in("source", ["match", "directory"])
                .gte("viewed_at", windowStart),
            ).then((count) => ({ count })),
            sumCounts((ids) =>
              supabaseAdmin.from("therapist_contact_clicks").select("*", { count: "exact", head: true })
                .in("therapist_id", ids).gte("clicked_at", windowStart),
            ).then((count) => ({ count })),
          ]);
          // צד המרכז נמדד על אותו חלון בדיוק.
          const mineViews = realViews.filter((v) => v.viewed_at >= windowStart).length;
          const mineClicks = clicks.filter((c) => c.clicked_at >= windowStart).length;
          const unitCount = isEntity ? 1 : Math.max(1, statIds.length);
          benchmark = {
            days: windowDays,
            peers: freeIds.length,
            per_therapist_views: Math.round((mineViews / unitCount) * 10) / 10,
            per_therapist_contacts: Math.round((mineClicks / unitCount) * 10) / 10,
            free_avg_views: Math.round(((fv.count ?? 0) / freeIds.length) * 10) / 10,
            free_avg_contacts: Math.round(((fc.count ?? 0) / freeIds.length) * 10) / 10,
          };
        }
      }
    } catch {
      benchmark = null; // לא קריטי - הפורטל עובד גם בלעדיו
    }

    // מגמה חודשית (6 חודשים) של פניות.
    const now = new Date();
    const trend: { label: string; clicks: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const label = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
      const n = clicks.filter((c) => {
        const t = new Date(c.clicked_at);
        return t >= start && t < end;
      }).length;
      trend.push({ label, clicks: n });
    }

    // פניות פר-מטפל לטבלת המטפלים - מצטבר, כדי שיתאים לעמודת הצפיות שלצידו
    // ולכרטיסים שלמעלה.
    const clicksPerTherapist = new Map<string, number>();
    for (const c of clicks) clicksPerTherapist.set(c.therapist_id, (clicksPerTherapist.get(c.therapist_id) ?? 0) + 1);
    const viewsPerTherapist = new Map<string, number>();
    for (const v of realViews) viewsPerTherapist.set(v.therapist_id, (viewsPerTherapist.get(v.therapist_id) ?? 0) + 1);

    const therapistList = therapists.map((t) => ({
      id: t.id,
      name: t.full_name || "-",
      status: t.status,
      approved: Boolean(t.admin_approved),
      online: Boolean(t.online),
      photo_url: t.profile_photo_path ? (photoById.get(t.profile_photo_path) ?? null) : null,
      profile_path: therapistPath(t.id, t.full_name),
      month_views: viewsPerTherapist.get(t.id) ?? 0,
      month_clicks: clicksPerTherapist.get(t.id) ?? 0,
    }));

    return NextResponse.json({
      ok: true,
      center: {
        name: center.name,
        status: center.status,
        billing_track: center.billing_track,
        entity,
        plan_title: planTitle,
        billing_starts_at: center.billing_starts_at,
        therapist_quota: Math.floor(Number(center.therapist_count) || 0),
        linked_count: therapists.length,
        public_page: publicPage,
      },
      therapists: therapistList,
      stats: {
        // "בהתאמות" = מקודם בפועל (מנוי המרכז) ואושר על-ידי אדמין.
        listed_count: therapists.filter((t) => t.status === "paying" && t.admin_approved).length,
        // מצטבר מאז ההצטרפות. השמות נשמרו לתאימות לאחור עם הלקוח, אך
        // המשמעות היא all-time - התוויות בממשק עודכנו בהתאם.
        views_month: realViews.length,
        impressions_month: matchImpressions,
        directory_impressions: dirImpressions.count ?? 0,
        clicks_total: clicksByType(clicks),
        by_source: bySource,
        benchmark,
        // נשמרים לתאימות לאחור בלבד - הממשק אינו מציג עוד חלונות של 30/7 יום.
        clicks_week: clicksByType(clicksWeek),
        clicks_month: clicksByType(clicksMonth),
        by_region: tallyBy(realViews, (v) => v.viewer_region),
        by_issue: tallyBy(realViews, (v) => v.viewer_issue),
        by_age: tallyBy(realViews, (v) => v.viewer_age_band),
        by_gender: tallyBy(realViews, (v) => v.viewer_gender),
        trend,
      },
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

// עריכת העמוד הציבורי של המרכז ע"י מנהלי המרכז (action: "update_public_page").
// המרכז שולט בתוכן שלו; slug נוצר אוטומטית מהשם אם עדיין אין.
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ ok: false, error: "יותר מדי בקשות - נסו שוב בעוד רגע" }, { status: 429 });
  }
  const center = await resolveCenter(req);
  if (!center) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (center.status !== "active") {
    return NextResponse.json({ ok: false, error: "המנוי של המרכז אינו פעיל" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  }
  if (body.action !== "update_public_page") {
    return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
  }

  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  // נתיב תמונת-מרכז חוקי: רק מתוך תיקיית center-assets. חוסם שתילת נתיב שרירותי
  // מה-bucket (למשל תעודה של מטפל) שהיה נחתם ומוצג בעמוד הציבורי.
  // חייב להתחיל ב-center-assets/ *ובלי* קטעי .. - אחרת נתיב כמו
  // "center-assets/../certificates/x.pdf" היה נחתם ומוצג בעמוד הציבורי.
  const assetPath = (v: unknown): string | null =>
    typeof v === "string" && v.startsWith("center-assets/") && v.length <= 300 && !v.split("/").includes("..")
      ? v
      : null;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.public_description !== undefined) update.public_description = str(body.public_description, 5000) || null;
  if (body.public_managers !== undefined) update.public_managers = str(body.public_managers, 500) || null;
  if (body.public_city !== undefined) update.public_city = str(body.public_city, 80) || null;
  if (body.public_website !== undefined) update.public_website = str(body.public_website, 300) || null;
  if (body.public_phone !== undefined) update.public_phone = str(body.public_phone, 40) || null;
  if (body.public_page_enabled !== undefined) update.public_page_enabled = !!body.public_page_enabled;
  // פרופיל ויזואלי: לוגו + צוות/ראשי-המרכז + גלריית המרכז - self-serve מהפורטל.
  if (body.logo_path !== undefined) update.logo_path = assetPath(body.logo_path);
  if (body.team_members !== undefined) {
    const raw = Array.isArray(body.team_members) ? body.team_members : [];
    update.team_members = raw.slice(0, 12).map((m) => {
      const mm = (m ?? {}) as Record<string, unknown>;
      return {
        name: str(mm.name, 80),
        role: str(mm.role, 80),
        photo_path: assetPath(mm.photo_path),
      };
    }).filter((m) => m.name);
  }
  if (body.gallery !== undefined) {
    const raw = Array.isArray(body.gallery) ? body.gallery : [];
    update.gallery = raw.slice(0, 8).map((g) => {
      const gg = (g ?? {}) as Record<string, unknown>;
      return { path: assetPath(gg.path), caption: str(gg.caption, 120) || null };
    }).filter((g): g is { path: string; caption: string | null } => !!g.path);
  }
  // עובדות-אמון: שנת ייסוד + גודל צוות (מוצגים רק כשמולאו).
  const intOrNull = (v: unknown, min: number, max: number): number | null => {
    // null/"" → null (ולא 0: Number(null)===0 היה הופך שדה שנוקה ל-0, ומד
    // השלמות בשרת היה סופר אותו כ"מולא" בעוד הפורטל מציג אותו כחסר).
    if (v === null || v === undefined || (typeof v === "string" && v.trim() === "")) return null;
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n >= min && n <= max ? n : null;
  };
  if (body.founded_year !== undefined) update.public_founded_year = intOrNull(body.founded_year, 1900, 2100);
  if (body.team_size !== undefined) update.public_team_size = intOrNull(body.team_size, 0, 10000);
  // מידע פרקטי: כתובת, שעות פעילות, נגישות.
  if (body.address !== undefined) update.public_address = str(body.address, 200) || null;
  if (body.hours !== undefined) update.public_hours = str(body.hours, 500) || null;
  if (body.accessibility !== undefined) update.public_accessibility = str(body.accessibility, 500) || null;
  // דבר המנהל/ת: {name, role, note, photo_path}.
  if (body.director !== undefined) {
    const d = (body.director ?? {}) as Record<string, unknown>;
    const name = str(d.name, 80);
    update.public_director = name
      ? { name, role: str(d.role, 120), note: str(d.note, 600), photo_path: assetPath(d.photo_path) }
      : {};
  }
  // שאלות נפוצות: עד 6 זוגות {q, a} - נשמרות רק שורות מלאות.
  if (body.faq !== undefined) {
    const raw = Array.isArray(body.faq) ? body.faq : [];
    update.public_faq = raw.slice(0, 6).map((f) => {
      const ff = (f ?? {}) as Record<string, unknown>;
      return { q: str(ff.q, 200), a: str(ff.a, 1000) };
    }).filter((f) => f.q && f.a);
  }

  // ודא slug (מרכזים שנוצרו לפני פיצ'ר העמוד הציבורי).
  const { ensureUniqueCenterSlug } = await import("@/app/lib/center-public");
  const slug = center.slug ?? (await ensureUniqueCenterSlug(center.name, center.id));
  if (!center.slug) update.slug = slug;

  const { error } = await supabaseAdmin
    .from("therapy_center_accounts")
    .update(update)
    .eq("id", center.id);
  if (error) {
    console.error(`center-portal update_public_page failed (center=${center.id}):`, error.message);
    return NextResponse.json({ ok: false, error: "העדכון נכשל" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, slug });
}
