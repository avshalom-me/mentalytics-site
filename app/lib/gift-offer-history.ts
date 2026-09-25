import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import {
  buildGiftOfferHistory,
  TOKEN_WINDOW_BEFORE_MS,
  type GiftOfferHistoryRow,
  type GiftOfferRow,
  type GiftTherapistRow,
  type GiftTokenRow,
} from "./gift-offer-outcome";

// הטבלה "מי לחץ ומי נרשם" בעמוד הסוכנים (פערי היצע). נטענת רק כשפותחים
// אותה, ולכן לא מאטה את טעינת העמוד.

// היום יש עשרות הצעות. התקרה רחוקה מ-1000 השורות ש-PostgREST מחזיר לכל
// היותר, כדי שגם הטוקנים של אותו חלון ייכנסו בשאילתה אחת.
const MAX_OFFERS = 500;
const ID_CHUNK = 100;

export async function loadGiftOfferHistory(): Promise<GiftOfferHistoryRow[]> {
  const { data, error } = await supabaseAdmin
    .from("gift_offers")
    .select("id, therapist_id, region, treatment, sent_at")
    .order("sent_at", { ascending: false })
    .limit(MAX_OFFERS);
  if (error) throw new Error(`קריאת ההצעות שנשלחו נכשלה: ${error.message}`);
  const offers = (data ?? []) as GiftOfferRow[];
  if (offers.length === 0) return [];

  const oldest = offers[offers.length - 1].sent_at;
  const since = new Date(Date.parse(oldest) - TOKEN_WINDOW_BEFORE_MS).toISOString();
  const ids = Array.from(new Set(offers.map((o) => o.therapist_id)));

  const [tokens, therapists] = await Promise.all([loadTokens(since), loadTherapists(ids)]);
  return buildGiftOfferHistory(offers, tokens, therapists);
}

async function loadTokens(sinceIso: string): Promise<GiftTokenRow[]> {
  const { data, error } = await supabaseAdmin
    .from("gift_checkout_tokens")
    .select("therapist_id, created_at, expires_at, used_at, view_count, first_viewed_at, last_viewed_at")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(`קריאת קישורי ההצטרפות נכשלה: ${error.message}`);
  return (data ?? []) as GiftTokenRow[];
}

async function loadTherapists(ids: string[]): Promise<GiftTherapistRow[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK) chunks.push(ids.slice(i, i + ID_CHUNK));
  const results = await Promise.all(
    chunks.map((chunk) =>
      supabaseAdmin
        .from("therapists")
        .select("id, full_name, gender, status, promotion_source, promoted_until")
        .in("id", chunk),
    ),
  );
  const out: GiftTherapistRow[] = [];
  for (const r of results) {
    if (r.error) throw new Error(`קריאת פרטי המטפלים נכשלה: ${r.error.message}`);
    out.push(...((r.data ?? []) as GiftTherapistRow[]));
  }
  return out;
}
