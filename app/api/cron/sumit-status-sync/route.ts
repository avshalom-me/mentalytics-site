import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";
import { listRecurringForCustomer } from "@/app/lib/sumit";
import { writeAudit } from "@/app/lib/audit";
import { sendPromotionEndedEmail, PromotionEndedReason } from "@/app/lib/therapist-emails";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function verifyCron(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Hourly sync that does two things:
//
// 1. For every paid subscription, check Sumit's standing-order status. If
//    Sumit has cancelled / suspended / let it expire (almost always due to
//    repeated failed charges), demote the therapist locally and notify by
//    email.
//
// 2. For every manual or trial promotion with promoted_until in the past,
//    demote and notify. This is how time-limited gifts auto-clean up.
//
// Sumit does not push payment-event webhooks (only CRM card-view triggers).
// Polling at hourly resolution caps the "free-after-cancel" window at ~60
// minutes, which is acceptable for the size of a chargeback we'd see.
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "server misconfigured" }, { status: 503 });
  }
  if (!verifyCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let checked = 0;
  let demoted = 0;
  let errors = 0;
  let stillActive = 0;
  let trialsExpired = 0;

  // -------- (1) Sumit subscription state for paid therapists --------
  const { data: paidTherapists } = await supabase
    .from("therapists")
    .select("id, full_name, email")
    .eq("status", "paying")
    .eq("promotion_source", "paid");

  for (const t of paidTherapists ?? []) {
    checked++;
    try {
      const items = await listRecurringForCustomer({
        externalIdentifier: t.id,
        includeInactive: true,
      });

      const { data: sub } = await supabase
        .from("subscriptions")
        .select("id, morning_token_id")
        .eq("therapist_id", t.id)
        .eq("status", "active")
        .maybeSingle();

      const target = sub?.morning_token_id
        ? items.find((i) => String(i.ID) === sub.morning_token_id)
        : items.sort((a, b) => Number(b.ID) - Number(a.ID))[0];

      if (!target || target.Status !== 0) {
        // Either nothing matches at Sumit, or what's there is not active.
        // Demote locally and email the therapist.
        if (sub) {
          await supabase
            .from("subscriptions")
            .update({ status: "cancelled", updated_at: new Date().toISOString() })
            .eq("id", sub.id);
        }
        await supabase
          .from("therapists")
          .update({
            status: "approved",
            manually_promoted: false,
            promotion_source: null,
            promoted_since: null,
            promoted_until: null,
          })
          .eq("id", t.id);

        await writeAudit(supabase, {
          therapistId: t.id,
          actorType: "sumit",
          action: "status_change:paying->approved",
          before: { status: "paying", promotion_source: "paid" },
          after: { status: "approved", promotion_source: null },
          reason: target ? `sumit_status=${target.Status}` : "no_active_recurring_at_sumit",
        });

        if (t.email) {
          await sendPromotionEndedEmail({
            to: t.email,
            name: t.full_name ?? "",
            reason: "payment_failed" as PromotionEndedReason,
          });
        }
        demoted++;
      } else {
        stillActive++;
        if (sub && target.Date_NextBilling) {
          await supabase
            .from("subscriptions")
            .update({
              current_period_end: new Date(target.Date_NextBilling).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", sub.id);
        }
      }
    } catch (err) {
      errors++;
      console.error(`Sumit sync failed for therapist ${t.id}:`, err);
    }
  }

  // -------- (2) Expired manual / trial promotions --------
  const nowIso = new Date().toISOString();
  const { data: expiredTrials } = await supabase
    .from("therapists")
    .select("id, full_name, email, promotion_source")
    .in("promotion_source", ["trial", "manual"])
    .not("promoted_until", "is", null)
    .lte("promoted_until", nowIso);

  for (const t of expiredTrials ?? []) {
    try {
      await supabase
        .from("therapists")
        .update({
          status: "approved",
          manually_promoted: false,
          promotion_source: null,
          promoted_since: null,
          promoted_until: null,
        })
        .eq("id", t.id);

      await writeAudit(supabase, {
        therapistId: t.id,
        actorType: "cron",
        action: "status_change:paying->approved",
        before: { status: "paying", promotion_source: t.promotion_source },
        after: { status: "approved", promotion_source: null },
        reason: "trial_or_manual_expired",
      });

      if (t.email) {
        await sendPromotionEndedEmail({
          to: t.email,
          name: t.full_name ?? "",
          reason: "trial_expired",
        });
      }
      trialsExpired++;
    } catch (err) {
      errors++;
      console.error(`Trial expiry failed for therapist ${t.id}:`, err);
    }
  }

  return NextResponse.json({
    checked,
    stillActive,
    demoted,
    trialsExpired,
    errors,
  });
}
