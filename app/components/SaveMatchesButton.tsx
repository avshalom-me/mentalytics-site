"use client";

import { useState } from "react";
import { getAttribution } from "@/app/lib/attribution";
import { getOrCreateSessionId } from "@/app/lib/session";
import { trackMatchSaved } from "@/app/lib/useTrack";

// "שלח לעצמך את ההתאמות" - creates an anonymous permalink (POST /api/match-token,
// which stores the list + the ORIGINAL attribution) and opens WhatsApp with a
// ready message the patient sends to themselves. We never see their number.
// Solves the half-of-quiz-completers-never-contact leak: gives a durable,
// cross-device way back that keeps campaign credit.

type MatchLike = { id: string; full_name?: string | null; entity_type?: string | null };

export default function SaveMatchesButton({
  matches,
  quizType,
  treatmentLabel,
}: {
  matches: MatchLike[];
  quizType: "adults" | "kids";
  treatmentLabel?: string | null;
}) {
  const [state, setState] = useState<"idle" | "loading" | "copied" | "error">("idle");

  // Centers live at a different URL shape and are rare in matches - the saved
  // page loads therapists only, so keep the token to real therapist ids.
  const therapistIds = matches.filter((m) => m.entity_type !== "center").map((m) => m.id);
  if (therapistIds.length === 0) return null;

  async function createToken(): Promise<string | null> {
    try {
      const res = await fetch("/api/match-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          therapist_ids: therapistIds.slice(0, 20),
          quiz_type: quizType,
          session_id: getOrCreateSessionId(),
          treatment_label: treatmentLabel ?? null,
          ...(getAttribution() ?? {}),
        }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return typeof json?.token === "string" ? json.token : null;
    } catch {
      return null;
    }
  }

  function buildMessage(url: string): string {
    const names = matches
      .slice(0, 6)
      .map((m, i) => `${i + 1}. ${m.full_name ?? ""}`.trim())
      .filter((s) => s.length > 2)
      .join("\n");
    return `ההתאמות שלי מטיפול חכם 💚\n${names}\n\nלצפייה ולפנייה למטפלים:\n${url}`;
  }

  async function onWhatsApp() {
    if (state === "loading") return;
    setState("loading");
    const token = await createToken();
    if (!token) {
      setState("error");
      setTimeout(() => setState("idle"), 3000);
      return;
    }
    trackMatchSaved(quizType, token, therapistIds.length);
    const url = `https://www.mentalytics.co.il/match/${token}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(buildMessage(url))}`, "_blank", "noopener");
    setState("idle");
  }

  async function onCopy() {
    if (state === "loading") return;
    setState("loading");
    const token = await createToken();
    if (!token) {
      setState("error");
      setTimeout(() => setState("idle"), 3000);
      return;
    }
    trackMatchSaved(quizType, token, therapistIds.length);
    try {
      await navigator.clipboard.writeText(`https://www.mentalytics.co.il/match/${token}`);
      setState("copied");
      setTimeout(() => setState("idle"), 3000);
    } catch {
      setState("idle");
    }
  }

  return (
    <div dir="rtl" className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--teal-mid)] bg-[var(--teal-pale)] px-4 py-3">
      <span className="text-sm font-bold" style={{ color: "var(--teal-dark)" }}>
        רוצים לחזור לרשימה אחר־כך?
      </span>
      <button
        type="button"
        onClick={onWhatsApp}
        disabled={state === "loading"}
        className="rounded-full px-4 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
        style={{ background: "#25D366" }}
      >
        {state === "loading" ? "רגע..." : "📲 שלחו לעצמכם בוואטסאפ"}
      </button>
      <button
        type="button"
        onClick={onCopy}
        disabled={state === "loading"}
        className="rounded-full px-4 py-2 text-sm font-bold transition hover:bg-white disabled:opacity-60"
        style={{ border: "1.5px solid var(--teal)", color: "var(--teal-dark)" }}
      >
        {state === "copied" ? "✓ הועתק" : "העתקת קישור"}
      </button>
      {state === "error" && <span className="text-xs text-red-600">משהו השתבש - נסו שוב</span>}
    </div>
  );
}
