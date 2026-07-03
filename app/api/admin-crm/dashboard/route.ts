import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { computeGuarantee } from "@/app/lib/guarantee";
import { missingProfileFields } from "@/app/lib/profile-completeness";
import { fetchAllRows } from "@/app/lib/fetch-all-rows";

type DashTherapist = {
  id: string;
  full_name: string | null;
  email: string | null;
  status: string;
  admin_approved: boolean | null;
  created_at: string | null;
  completion_requested_at: string | null;
  profile_photo_path: string | null;
  regions: string[] | null;
  therapist_types: string[] | null;
  training_areas: string[] | null;
};

// The CRM home: KPI counts, the daily work queue (everything that needs the
// admin's attention today), and actual-vs-business-plan targets.

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function startOfMonthIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export async function GET() {
  try {
    const todayIso = new Date().toISOString().slice(0, 10);

    const [
      therapistsRes,
      certsRes,
      contacts7dRes,
      newLeadsRes,
      dueTasksRes,
      openTasksCountRes,
      failedPaymentsRes,
      pendingArticlesRes,
      quizCompleteMonthRes,
      planTargetsRes,
      guarantee,
    ] = await Promise.all([
      // fetchAllRows: both tables will pass the 1000-row PostgREST cap as the
      // therapist base grows toward the 950 plan target.
      fetchAllRows<DashTherapist>(() =>
        supabaseAdmin
          .from("therapists")
          .select(
            "id, full_name, email, status, admin_approved, created_at, completion_requested_at, profile_photo_path, regions, therapist_types, training_areas"
          )
      ),
      fetchAllRows<{ therapist_id: string }>(() =>
        supabaseAdmin.from("therapist_certificates").select("therapist_id")
      ),
      supabaseAdmin
        .from("therapist_contact_clicks")
        .select("id", { count: "exact", head: true })
        .gte("clicked_at", daysAgoIso(7)),
      supabaseAdmin
        .from("crm_leads")
        .select("id, lead_type, name, contact, message, therapist_id, created_at")
        .eq("status", "new")
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("crm_tasks")
        .select("id, title, entity_type, entity_id, entity_label, due_date, priority, snoozed_until")
        .eq("status", "open")
        .not("due_date", "is", null)
        .lte("due_date", todayIso)
        .order("due_date", { ascending: true })
        .limit(20),
      supabaseAdmin.from("crm_tasks").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabaseAdmin
        .from("payments")
        .select("reference_id, amount, created_at")
        .eq("payment_type", "subscription")
        .eq("status", "failed")
        .gte("created_at", daysAgoIso(7)),
      supabaseAdmin
        .from("therapist_articles")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabaseAdmin
        .from("analytics_events")
        .select("id", { count: "exact", head: true })
        .eq("event_type", "quiz_complete")
        .gte("created_at", startOfMonthIso()),
      supabaseAdmin.from("plan_targets").select("*").order("month", { ascending: true }),
      computeGuarantee(),
    ]);

    const therapists = therapistsRes;
    const certIds = new Set(certsRes.map((c) => c.therapist_id));
    const isStub = (t: { full_name: string | null }) => !(t.full_name ?? "").trim();

    const paying = therapists.filter((t) => t.status === "paying");
    const approvedFree = therapists.filter((t) => t.status === "approved");
    const pendingReview = therapists.filter((t) => t.status === "pending" && !isStub(t));
    const payingUnapproved = paying.filter((t) => !t.admin_approved);

    // "Partial" = non-stub profile still missing a required field (photo is
    // treated as optional here, matching the reminder emails' wording).
    const partials = therapists.filter((t) => {
      if (isStub(t) || t.status === "rejected") return false;
      const missing = missingProfileFields(t, certIds.has(t.id)).filter(
        (m) => m !== "תמונת פרופיל"
      );
      return missing.length > 0;
    });
    const partialsNeverReminded = partials.filter((t) => !t.completion_requested_at);

    // Snoozed tasks stay out of the queue until their snooze date passes.
    const dueTasks = (dueTasksRes.data ?? []).filter(
      (t) => !t.snoozed_until || t.snoozed_until <= todayIso
    );

    const failedPayments = failedPaymentsRes.data ?? [];
    const failedNames: Record<string, string> = {};
    if (failedPayments.length > 0) {
      const ids = Array.from(new Set(failedPayments.map((p) => p.reference_id).filter(Boolean)));
      const byId = new Map(therapists.map((t) => [t.id, t.full_name ?? ""]));
      for (const id of ids) failedNames[id] = byId.get(id) ?? "";
    }

    const guaranteeAttention = guarantee.filter(
      (g) => g.risk === "at_risk" || g.risk === "expired_no_contact"
    );

    return NextResponse.json({
      ok: true,
      kpis: {
        paying_count: paying.length,
        listed_count: paying.filter((t) => t.admin_approved).length + approvedFree.length,
        contacts_7d: contacts7dRes.count ?? 0,
        new_leads_count: (newLeadsRes.data ?? []).length,
        open_tasks_count: openTasksCountRes.count ?? 0,
        quiz_completes_month: quizCompleteMonthRes.count ?? 0,
      },
      queue: {
        pending_review: pendingReview
          .slice(0, 10)
          .map((t) => ({ id: t.id, full_name: t.full_name, created_at: t.created_at })),
        pending_review_count: pendingReview.length,
        paying_unapproved: payingUnapproved.map((t) => ({ id: t.id, full_name: t.full_name })),
        guarantee_attention: guaranteeAttention.slice(0, 10),
        guarantee_attention_count: guaranteeAttention.length,
        due_tasks: dueTasks,
        new_leads: (newLeadsRes.data ?? []).slice(0, 10),
        failed_payments: failedPayments.map((p) => ({
          therapist_id: p.reference_id,
          full_name: failedNames[p.reference_id] ?? "",
          amount: p.amount,
          created_at: p.created_at,
        })),
        partials_count: partials.length,
        partials_never_reminded_count: partialsNeverReminded.length,
        pending_articles_count: pendingArticlesRes.count ?? 0,
      },
      plan: {
        targets: planTargetsRes.data ?? [],
        actuals: {
          therapists_total: paying.length + approvedFree.length,
          questionnaires_month: quizCompleteMonthRes.count ?? 0,
          teachers_total: 0,
        },
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "שגיאה";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
