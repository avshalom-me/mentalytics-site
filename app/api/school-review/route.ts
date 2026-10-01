import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { clientIp, rateLimit, tooManyRequests } from "@/app/lib/rate-limit";
import { LIMITS } from "@/app/lib/school-review";
import { NOTE_COLUMNS, cleanNoteEdit, cleanNoteInput, findReviewer } from "@/app/lib/school-review.server";

// The reviewer's side of the /school review mode. Public by URL - a reviewer
// is not an admin and never sees /admin - and closed by the token in their
// personal link: every action is refused without one that belongs to an active
// reviewer, and each reviewer reaches only their own notes.
//
// POST { action, token, ... }:
//   session        - who am I, my notes, what I have seen
//   add_note       - write a note
//   update_note    - edit a note of mine that is still open
//   withdraw_note  - take back a note of mine that is still open
//   seen           - record coverage keys I have had on screen

export const dynamic = "force-dynamic";

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: NextRequest) {
  const gate = rateLimit("school-review", clientIp(req), 240, 60_000);
  if (!gate.ok) return tooManyRequests(gate.retryAfterSeconds, "יותר מדי בקשות. נסו שוב בעוד רגע.");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return bad("בקשה לא תקינה");
  }
  if (!body || typeof body !== "object") return bad("בקשה לא תקינה");

  const reviewer = await findReviewer(body.token);
  if (!reviewer) return bad("קישור הביקורת אינו תקף או שבוטל", 401);
  const action = typeof body.action === "string" ? body.action : "";
  const now = new Date().toISOString();

  try {
    if (action === "session") {
      const [{ data: notes, error }] = await Promise.all([
        supabaseAdmin
          .from("school_review_notes")
          .select(NOTE_COLUMNS)
          .eq("reviewer_id", reviewer.id)
          .is("withdrawn_at", null)
          .order("created_at", { ascending: false })
          .limit(LIMITS.notesPerReviewer),
        supabaseAdmin.from("school_reviewers").update({ last_seen_at: now }).eq("id", reviewer.id),
      ]);
      if (error) throw error;
      return NextResponse.json({ ok: true, reviewer: { name: reviewer.name }, notes: notes ?? [], seen: Object.keys(reviewer.seen ?? {}) });
    }

    if (action === "add_note") {
      const clean = cleanNoteInput(body.note);
      if (!clean.ok) return bad(clean.error);
      const { count } = await supabaseAdmin
        .from("school_review_notes")
        .select("id", { count: "exact", head: true })
        .eq("reviewer_id", reviewer.id);
      if ((count ?? 0) >= LIMITS.notesPerReviewer) return bad("הגעת למספר ההערות המרבי. פנו למנהל המערכת.");
      const { data, error } = await supabaseAdmin
        .from("school_review_notes")
        .insert({ ...clean.value, reviewer_id: reviewer.id })
        .select(NOTE_COLUMNS)
        .single();
      if (error) throw error;
      return NextResponse.json({ ok: true, note: data });
    }

    if (action === "update_note" || action === "withdraw_note") {
      const id = typeof body.id === "string" && /^[0-9a-f-]{36}$/i.test(body.id) ? body.id : null;
      if (!id) return bad("חסר מזהה ההערה");
      let patch: Record<string, unknown>;
      if (action === "withdraw_note") {
        patch = { withdrawn_at: now, updated_at: now };
      } else {
        const clean = cleanNoteEdit(body.note);
        if (!clean.ok) return bad(clean.error);
        patch = { ...clean.value, updated_at: now };
      }
      // Only a note of this reviewer, and only while nobody has acted on it:
      // once it was accepted or answered, changing it would rewrite what the
      // answer was given to.
      const { data, error } = await supabaseAdmin
        .from("school_review_notes")
        .update(patch)
        .eq("id", id)
        .eq("reviewer_id", reviewer.id)
        .eq("status", "open")
        .is("withdrawn_at", null)
        .select(NOTE_COLUMNS)
        .maybeSingle();
      if (error) throw error;
      if (!data) return bad("אי אפשר לשנות את ההערה: היא כבר טופלה או שאינה קיימת", 409);
      return NextResponse.json({ ok: true, note: data });
    }

    if (action === "seen") {
      const keys = Array.isArray(body.keys) ? body.keys.filter((k): k is string => typeof k === "string" && k.length > 0 && k.length <= 160) : [];
      if (!keys.length) return NextResponse.json({ ok: true });
      const seen: Record<string, string> = { ...(reviewer.seen ?? {}) };
      for (const k of keys) if (!seen[k] && Object.keys(seen).length < LIMITS.seenKeys) seen[k] = now;
      const { error } = await supabaseAdmin.from("school_reviewers").update({ seen, last_seen_at: now }).eq("id", reviewer.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    return bad("פעולה לא מוכרת");
  } catch (err) {
    return bad(err instanceof Error ? err.message : "שגיאה", 500);
  }
}
