import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";
import { listRecurringForCustomer } from "@/app/lib/sumit";

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

// Daily sync between Sumit and our DB. Sumit handles the actual monthly
// charges on their servers — they do not push webhooks for charge events,
// only for card-view changes (a CRM trigger, not a payment-event stream).
// So we poll: for every subscription that is still "active" locally,
// check Sumit's status. If Sumit has cancelled / suspended / let it
// expire, we mirror that locally and demote the therapist.
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "server misconfigured" }, { status: 503 });
  }
  if (!verifyCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: subs } = await supabase
    .from("subscriptions")
    .select("id, therapist_id, morning_token_id")
    .eq("status", "active");

  if (!subs || subs.length === 0) {
    return NextResponse.json({ checked: 0, demoted: 0 });
  }

  let demoted = 0;
  let stillActive = 0;
  let errors = 0;

  for (const sub of subs) {
    try {
      const items = await listRecurringForCustomer({
        externalIdentifier: sub.therapist_id,
        includeInactive: true,
      });

      // Find the standing order we created (by stored id) or the most
      // recent one if we never captured the id.
      const target = sub.morning_token_id
        ? items.find((i) => String(i.ID) === sub.morning_token_id)
        : items.sort((a, b) => Number(b.ID) - Number(a.ID))[0];

      if (!target) {
        // No matching standing order at Sumit — treat as cancelled.
        await supabase
          .from("subscriptions")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("id", sub.id);
        await supabase
          .from("therapists")
          .update({ status: "approved", manually_promoted: false })
          .eq("id", sub.therapist_id);
        demoted++;
        continue;
      }

      if (target.Status === 0) {
        stillActive++;
        // Refresh the next-billing date locally so admins / dashboards can
        // surface it without re-querying Sumit.
        if (target.Date_NextBilling) {
          await supabase
            .from("subscriptions")
            .update({
              current_period_end: new Date(target.Date_NextBilling).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", sub.id);
        }
      } else {
        // Sumit considers this inactive — cancel locally and demote.
        await supabase
          .from("subscriptions")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("id", sub.id);
        await supabase
          .from("therapists")
          .update({ status: "approved", manually_promoted: false })
          .eq("id", sub.therapist_id);
        demoted++;
      }
    } catch (err) {
      errors++;
      console.error(`Sumit status sync failed for sub ${sub.id}:`, err);
    }
  }

  return NextResponse.json({
    checked: subs.length,
    stillActive,
    demoted,
    errors,
  });
}
