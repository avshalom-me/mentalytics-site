import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

// Nightly ingest for the Google Ads Script (docs/google-ads-sync.js).
//
// This path is deliberately OUTSIDE the /api/admin- Basic-Auth guard: the
// script must not carry the admin password. It authenticates with a single
// write-only shared secret instead, so a leaked script exposes exactly one
// capability - writing ad stats into these tables - and no Google credential
// ever lives on our side.
//
// The script re-sends a trailing window (7 days) every night and everything
// here is an upsert on natural keys, so late-arriving cost/conversion data
// heals itself and re-runs are harmless.

export const maxDuration = 60;

const MAX_ROWS = 20_000; // sanity cap per array; real payloads are ~2k rows
const CHUNK = 500;

type Row = Record<string, unknown>;

function num(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
}
function micros(v: unknown): number {
  return Math.round((num(v) / 1_000_000) * 100) / 100;
}
function str(v: unknown, max = 300): string | null {
  return typeof v === "string" && v.length > 0 ? v.slice(0, max) : null;
}
// Google sends dates as "2026-08-28"; anything else is dropped row-wise
// rather than failing the whole batch.
function isoDate(v: unknown): string | null {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

async function upsertChunks(table: string, rows: Row[], onConflict: string): Promise<number> {
  let written = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabaseAdmin.from(table).upsert(chunk, { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
    written += chunk.length;
  }
  return written;
}

export async function POST(req: NextRequest) {
  const secret = process.env.ADS_SYNC_SECRET;
  if (!secret) {
    // Fail closed until the env var exists in this environment.
    return NextResponse.json({ ok: false, error: "sync not configured" }, { status: 503 });
  }
  if (req.headers.get("x-ads-sync-secret") !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown[]>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const arr = (key: string): Row[] => {
    const v = body[key];
    if (!Array.isArray(v)) return [];
    return v.slice(0, MAX_ROWS) as Row[];
  };

  try {
    const campaignsDaily = arr("campaigns_daily")
      .map((r) => ({
        date: isoDate(r.date),
        campaign_id: num(r.id),
        campaign_name: str(r.name) ?? "",
        impressions: num(r.impressions),
        clicks: num(r.clicks),
        cost: micros(r.cost_micros),
        conversions: num(r.conversions),
      }))
      .filter((r) => r.date && r.campaign_id > 0 && r.campaign_name);

    const config = arr("campaign_config")
      .map((r) => ({
        campaign_id: num(r.id),
        campaign_name: str(r.name) ?? "",
        status: str(r.status, 40),
        end_date: isoDate(r.end_date),
        daily_budget: r.daily_budget_micros == null ? null : micros(r.daily_budget_micros),
        total_budget: r.total_budget_micros == null ? null : micros(r.total_budget_micros),
        bidding_strategy: str(r.bidding_strategy, 60),
        cpc_ceiling: r.cpc_ceiling_micros == null ? null : micros(r.cpc_ceiling_micros),
        synced_at: new Date().toISOString(),
      }))
      .filter((r) => r.campaign_id > 0 && r.campaign_name);

    const keywordsDaily = arr("keywords_daily")
      .map((r) => ({
        date: isoDate(r.date),
        campaign_name: str(r.campaign) ?? "",
        ad_group: str(r.ad_group) ?? "",
        keyword: str(r.keyword) ?? "",
        match_type: str(r.match_type, 40),
        impressions: num(r.impressions),
        clicks: num(r.clicks),
        cost: micros(r.cost_micros),
      }))
      .filter((r) => r.date && r.campaign_name && r.keyword);

    const keywordStatus = arr("keyword_status")
      .map((r) => ({
        campaign_name: str(r.campaign) ?? "",
        ad_group: str(r.ad_group) ?? "",
        keyword: str(r.keyword) ?? "",
        match_type: str(r.match_type, 40),
        status: str(r.status, 40),
        serving_status: str(r.serving_status, 60),
        synced_at: new Date().toISOString(),
      }))
      .filter((r) => r.campaign_name && r.keyword);

    const searchTerms = arr("search_terms_daily")
      .map((r) => ({
        date: isoDate(r.date),
        campaign_name: str(r.campaign) ?? "",
        term: str(r.term) ?? "",
        impressions: num(r.impressions),
        clicks: num(r.clicks),
        cost: micros(r.cost_micros),
      }))
      .filter((r) => r.date && r.campaign_name && r.term);

    const summary = {
      campaigns_daily: await upsertChunks("ads_campaign_daily", campaignsDaily, "date,campaign_id"),
      campaign_config: await upsertChunks("ads_campaign_config", config, "campaign_id"),
      keywords_daily: await upsertChunks("ads_keyword_daily", keywordsDaily, "date,campaign_name,ad_group,keyword"),
      keyword_status: await upsertChunks("ads_keyword_status", keywordStatus, "campaign_name,ad_group,keyword"),
      search_terms_daily: await upsertChunks("ads_search_term_daily", searchTerms, "date,campaign_name,term"),
    };

    await supabaseAdmin.from("ads_sync_log").insert({ summary });
    return NextResponse.json({ ok: true, written: summary });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("ads-sync failed:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
