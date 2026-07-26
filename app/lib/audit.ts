import type { SupabaseClient } from "@supabase/supabase-js";

// Records a row in therapist_audit_log for any promotion / status change.
// Callers pass a service-role supabase client so the insert always succeeds
// regardless of the request's auth context.
//
// before/after are JSON snapshots of the relevant fields - pick whichever
// columns matter for the change (status, promotion_source, promoted_until,
// subscription state, etc.). Schema is intentionally loose so we can
// extend without migrations.

export type AuditActorType = "admin" | "self" | "sumit" | "cron" | "system" | "center";

export interface AuditEntry {
  therapistId: string;
  actorType: AuditActorType;
  actorId?: string | null;
  action: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
}

export async function writeAudit(
  supabase: SupabaseClient,
  entry: AuditEntry
): Promise<void> {
  // Best-effort. We never want an audit-log failure to abort the actual
  // business operation that triggered it - but do log so the admin sees
  // there's a problem with the audit pipeline.
  const { error } = await supabase.from("therapist_audit_log").insert({
    therapist_id: entry.therapistId,
    actor_type: entry.actorType,
    actor_id: entry.actorId ?? null,
    action: entry.action,
    before_state: entry.before ?? null,
    after_state: entry.after ?? null,
    reason: entry.reason ?? null,
  });

  if (error) {
    console.error(
      `audit log failed for therapist=${entry.therapistId} action=${entry.action}:`,
      error.message
    );
  }
}
