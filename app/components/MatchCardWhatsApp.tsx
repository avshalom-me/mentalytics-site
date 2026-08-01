"use client";

import { getAttribution } from "@/app/lib/attribution";
import { getOrCreateSessionId } from "@/app/lib/session";
import { gaEvent } from "@/app/lib/gtag";
import { waLinkFor } from "@/app/lib/phone";

// WhatsApp-only contact straight from the match card.
//
// A full contact row used to live here and was removed because it flooded
// therapists. This restores ONE channel only - WhatsApp, the least intrusive
// (asynchronous, the therapist answers when they can, and the patient's own
// message text signals real intent), and never phone/email/site-message.
// Rationale: only ~6% of patients who see a match card open the profile, so
// the 17% visit-to-contact rate never gets its chance.
//
// UX guardrails: secondary styling (outline, not a filled CTA) so the card's
// primary action stays "open the profile"; a pre-written message so nobody
// has to compose one cold; hidden entirely when the therapist has no phone.

const waIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

export { waLinkFor };

export default function MatchCardWhatsApp({
  therapistId,
  phone,
}: {
  therapistId: string;
  phone: string | null | undefined;
}) {
  const href = waLinkFor(phone);
  if (!href) return null;

  function onClick(e: React.MouseEvent) {
    // The card itself is often wrapped in a link - don't open the profile too.
    e.stopPropagation();
    const attribution = getAttribution() ?? {};
    fetch("/api/track-click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Mobile backgrounds the page the instant WhatsApp opens.
      keepalive: true,
      body: JSON.stringify({
        therapist_id: therapistId,
        click_type: "whatsapp",
        source: "match",
        session_id: getOrCreateSessionId(),
        ...attribution,
      }),
    }).catch(() => {});
    gaEvent("generate_lead", { method: "whatsapp", source: "match" });
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-colors hover:bg-green-50"
      style={{ border: "1.5px solid #25D366", color: "#128C42" }}
    >
      {waIcon} וואטסאפ
    </a>
  );
}
