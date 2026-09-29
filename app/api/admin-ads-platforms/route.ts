import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { CURRENCIES, PLATFORMS, fetchBoiRate, type SpendCurrency } from "@/app/lib/ads-platforms";

// Spend outside Google, entered by hand from the platforms' invoices (budget
// agent step 3). This route never talks to Taboola or Meta: the only outside
// call is the Bank of Israel's public rate feed, for invoices in dollars or euros.

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const text = (v: unknown, max: number) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, max) : null;
};

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("ads_platform_spend")
    .select("*")
    .order("period_end", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, rows: data ?? [] });
}

export async function POST(req: NextRequest) {
  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  }

  const platform = String(b.platform ?? "");
  const currency = String(b.currency ?? "ILS") as SpendCurrency;
  const start = String(b.period_start ?? "");
  const end = String(b.period_end ?? "");
  const amount = Number(b.amount);
  const vat = b.vat == null || b.vat === "" ? null : Number(b.vat);
  const manualRate = b.fx_rate == null || b.fx_rate === "" ? null : Number(b.fx_rate);

  if (!PLATFORMS.some((p) => p.key === platform)) {
    return NextResponse.json({ ok: false, error: "פלטפורמה לא מוכרת" }, { status: 400 });
  }
  if (!CURRENCIES.includes(currency)) {
    return NextResponse.json({ ok: false, error: "מטבע לא נתמך" }, { status: 400 });
  }
  if (!DAY.test(start) || !DAY.test(end) || end < start) {
    return NextResponse.json({ ok: false, error: "תקופה לא תקינה: צריך תאריך התחלה ותאריך סיום שאחריו" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, error: "סכום לא תקין" }, { status: 400 });
  }
  if (vat != null && (!Number.isFinite(vat) || vat < 0)) {
    return NextResponse.json({ ok: false, error: "מע\"מ לא תקין" }, { status: 400 });
  }
  if (manualRate != null && (!Number.isFinite(manualRate) || manualRate <= 0)) {
    return NextResponse.json({ ok: false, error: "שער לא תקין" }, { status: 400 });
  }

  // The rate of the period's last day, so an invoice's shekels never change later.
  let rate = manualRate;
  let rateNote: string | null = manualRate != null ? "שער שהוזן ידנית" : null;
  if (rate == null) {
    const boi = await fetchBoiRate(currency, end);
    if (!boi) {
      return NextResponse.json(
        { ok: false, error: "לא הצלחתי למשוך את השער היציג מבנק ישראל. אפשר להזין שער ידנית." },
        { status: 502 }
      );
    }
    rate = boi.rate;
    if (currency !== "ILS") rateNote = `שער יציג ${boi.date}`;
  }

  const note = [text(b.note, 500), rateNote].filter(Boolean).join(" · ") || null;
  const { data, error } = await supabaseAdmin
    .from("ads_platform_spend")
    .insert({
      platform,
      campaign_key: text(b.campaign_key, 60),
      period_start: start,
      period_end: end,
      amount_orig: Math.round(amount * 100) / 100,
      currency,
      fx_rate: rate,
      amount_ils: Math.round(amount * rate * 100) / 100,
      vat_orig: vat == null ? null : Math.round(vat * 100) / 100,
      source: "manual",
      source_ref: text(b.source_ref, 120),
      note,
      created_by: text(b.created_by, 60) ?? "admin",
    })
    .select()
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, row: data });
}

export async function DELETE(req: NextRequest) {
  let id = "";
  try {
    id = String((await req.json())?.id ?? "");
  } catch {
    /* handled below */
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ ok: false, error: "חסר מזהה" }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from("ads_platform_spend").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
