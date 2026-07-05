import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { cancelSubscription, listRecurringForCustomer } from "@/app/lib/sumit";

// ניהול מרכזים טיפוליים — הצעות מחיר, קישורי תשלום ומנויים.
// מוגן ע"י ה-middleware של האדמין (/api/admin-*).

export const dynamic = "force-dynamic";

export type CenterPlan = { key: string; title: string; monthly_price: number; features: string[] };

function sanitizePlans(raw: unknown): CenterPlan[] | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { error: "נדרש לפחות מסלול אחד" };
  if (raw.length > 4) return { error: "עד 4 מסלולים" };
  const plans: CenterPlan[] = [];
  for (let i = 0; i < raw.length; i++) {
    const p = raw[i] as Record<string, unknown>;
    const title = typeof p.title === "string" ? p.title.trim().slice(0, 80) : "";
    const price = typeof p.monthly_price === "number" ? p.monthly_price : Number(p.monthly_price);
    const features = Array.isArray(p.features)
      ? p.features.filter((f): f is string => typeof f === "string" && f.trim() !== "").map((f) => f.trim().slice(0, 200)).slice(0, 15)
      : [];
    if (!title) return { error: `מסלול ${i + 1}: חסרה כותרת` };
    if (isNaN(price) || price <= 0 || price > 100_000) return { error: `מסלול "${title}": מחיר חודשי לא תקין` };
    plans.push({ key: `plan-${i + 1}`, title, monthly_price: Math.round(price * 100) / 100, features });
  }
  return plans;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("therapy_center_accounts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ ok: true, centers: data ?? [] });
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
      const plans = sanitizePlans(body.plans);
      if ("error" in plans) return NextResponse.json({ ok: false, error: plans.error }, { status: 400 });
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
          plans,
          token: randomBytes(24).toString("hex"),
        })
        .select("*")
        .single();
      if (error) throw error;
      return NextResponse.json({ ok: true, center: data });
    }

    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return NextResponse.json({ ok: false, error: "missing id" }, { status: 400 });

    const { data: center } = await supabaseAdmin
      .from("therapy_center_accounts")
      .select("*")
      .eq("id", id)
      .single();
    if (!center) return NextResponse.json({ ok: false, error: "מרכז לא נמצא" }, { status: 404 });

    if (action === "update") {
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.name !== undefined) {
        const name = str(body.name, 120);
        if (!name) return NextResponse.json({ ok: false, error: "חסר שם מרכז" }, { status: 400 });
        update.name = name;
      }
      if (body.contact_name !== undefined) update.contact_name = str(body.contact_name, 80) || null;
      if (body.email !== undefined) update.email = str(body.email, 200) || null;
      if (body.phone !== undefined) update.phone = str(body.phone, 30) || null;
      if (body.notes !== undefined) update.notes = str(body.notes, 2000) || null;

      // תנאי ההצעה (מסלולים, מחיר, מתנה) נעולים אחרי שהמרכז שילם — שינוי
      // שלהם לא היה משנה את הוראת הקבע ב-Sumit והיה יוצר פער מסוכן.
      const editable = center.status === "draft" || center.status === "sent";
      if (body.plans !== undefined) {
        if (!editable) return NextResponse.json({ ok: false, error: "אי אפשר לשנות מסלולים אחרי תשלום — יש לבטל וליצור הצעה חדשה" }, { status: 400 });
        const plans = sanitizePlans(body.plans);
        if ("error" in plans) return NextResponse.json({ ok: false, error: plans.error }, { status: 400 });
        update.plans = plans;
      }
      if (body.gift_months !== undefined) {
        if (!editable) return NextResponse.json({ ok: false, error: "אי אפשר לשנות חודשי מתנה אחרי תשלום" }, { status: 400 });
        const gift = Number(body.gift_months);
        if (isNaN(gift) || gift < 0 || gift > 12) return NextResponse.json({ ok: false, error: "חודשי מתנה: 0-12" }, { status: 400 });
        update.gift_months = Math.round(gift);
      }

      const { error } = await supabaseAdmin.from("therapy_center_accounts").update(update).eq("id", id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
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
      return NextResponse.json({ ok: true });
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
      if (ours && ours.Status !== 0 && center.status === "active") {
        await supabaseAdmin
          .from("therapy_center_accounts")
          .update({ status: "cancelled", cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", id);
      }
      return NextResponse.json({
        ok: true,
        sumit: ours
          ? { status: ours.Status, next_billing: ours.Date_NextBilling ?? null, unit_price: ours.UnitPrice ?? null }
          : null,
      });
    }

    return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
