import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

// B2B/B2G opportunity pipeline (schools, kupot, colleges, psychologists
// integration, education-ministry deal). Small volume, high value.

import { autoCloseWonDeals } from "@/app/lib/deal-autoclose";
import { syncDealReminders } from "@/app/lib/deal-reminders";

const VALID_STAGES = ["first_contact", "negotiation", "link_sent", "closed", "lost"];
const VALID_LOST_REASONS = ["price", "competitor", "not_relevant", "no_response", "timing", "other"];

export async function GET() {
  // סגירה אוטומטית לפני הקריאה: מרכז שהשלים הרשמה ותשלום סוגר את העסקה
  // שלו לבד. רץ בטעינת העמוד - זה הרגע שבו עדכניות חשובה.
  await autoCloseWonDeals().catch((e) =>
    console.error("autoCloseWonDeals failed:", e instanceof Error ? e.message : e)
  );
  // רענון התזכורות מיד אחרי: עסקה שנסגרה כרגע לא צריכה להישאר "תקועה".
  await syncDealReminders().catch((e) =>
    console.error("syncDealReminders failed:", e instanceof Error ? e.message : e)
  );
  const { data, error } = await supabaseAdmin
    .from("crm_deals")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, deals: data ?? [] });
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const title = String(b.title ?? "").trim();
    if (!title) return NextResponse.json({ ok: false, error: "חסרה כותרת" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("crm_deals")
      .insert({
        title: title.slice(0, 300),
        deal_type: b.deal_type ? String(b.deal_type) : null,
        stage: VALID_STAGES.includes(b.stage) ? b.stage : "first_contact",
        value_ils: b.value_ils != null && b.value_ils !== "" ? Number(b.value_ils) : null,
        owner: b.owner ? String(b.owner).slice(0, 60) : null,
        contact_name: b.contact_name ? String(b.contact_name).slice(0, 120) : null,
        contact_info: b.contact_info ? String(b.contact_info).slice(0, 300) : null,
        next_step: b.next_step ? String(b.next_step).slice(0, 500) : null,
        next_step_due: b.next_step_due ? String(b.next_step_due) : null,
        notes: b.notes ? String(b.notes).slice(0, 4000) : null,
        organization_id: b.organization_id ? String(b.organization_id) : null,
        prospect_id: b.prospect_id ? String(b.prospect_id) : null,
        region_key: b.region_key ? String(b.region_key) : null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, deal: data });
  } catch {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const b = await req.json();
    if (!b.id) return NextResponse.json({ ok: false, error: "חסר id" }, { status: 400 });

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (b.stage && VALID_STAGES.includes(b.stage)) {
      update.stage = b.stage;
      update.closed_at = b.stage === "closed" || b.stage === "lost" ? new Date().toISOString() : null;
      // עסקה שחוזרת לצינור מאבדת את סיבת האבודה - אחרת היא נשארת תלויה
      // על עסקה פעילה ומזהמת את הספירה.
      if (b.stage !== "lost") update.lost_reason = null;
    }
    if ("title" in b && String(b.title).trim()) update.title = String(b.title).trim().slice(0, 300);
    if ("deal_type" in b) update.deal_type = b.deal_type ? String(b.deal_type) : null;
    if ("value_ils" in b) update.value_ils = b.value_ils != null && b.value_ils !== "" ? Number(b.value_ils) : null;
    if ("owner" in b) update.owner = b.owner ? String(b.owner).slice(0, 60) : null;
    if ("contact_name" in b) update.contact_name = b.contact_name ? String(b.contact_name).slice(0, 120) : null;
    if ("contact_info" in b) update.contact_info = b.contact_info ? String(b.contact_info).slice(0, 300) : null;
    if ("next_step" in b) update.next_step = b.next_step ? String(b.next_step).slice(0, 500) : null;
    if ("next_step_due" in b) update.next_step_due = b.next_step_due ? String(b.next_step_due) : null;
    if ("notes" in b) update.notes = b.notes ? String(b.notes).slice(0, 4000) : null;
    if ("lost_reason" in b) {
      update.lost_reason = VALID_LOST_REASONS.includes(b.lost_reason) ? b.lost_reason : null;
    }

    const { error } = await supabaseAdmin.from("crm_deals").update(update).eq("id", b.id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ ok: false, error: "חסר id" }, { status: 400 });
    const { error } = await supabaseAdmin.from("crm_deals").delete().eq("id", id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  }
}
