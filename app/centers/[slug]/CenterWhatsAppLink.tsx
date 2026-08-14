"use client";

import { getOrCreateSessionId } from "@/app/lib/session";
import { getAttribution } from "@/app/lib/attribution";
import { gaEvent } from "@/app/lib/gtag";
import { trackingOptedOut } from "@/app/lib/track-optout";

// קישור וואטסאפ בעמוד מרכז (מסלול 2) - נרשם כלחיצת-קשר על ישות-המרכז, כמו
// אצל מטפל בודד. keepalive כי הטאפ קופץ מיד לוואטסאפ והעמוד עובר לרקע.

export default function CenterWhatsAppLink({ entityId, href, className, children }: {
  entityId: string;
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  function track() {
    if (trackingOptedOut()) return; // מכשיר של הצוות
    try {
      fetch("/api/track-click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          therapist_id: entityId,
          click_type: "whatsapp",
          source: "profile",
          session_id: getOrCreateSessionId(),
          ...(getAttribution() ?? {}),
        }),
      }).catch(() => {});
      gaEvent("generate_lead", { method: "whatsapp", source: "center_page" });
    } catch { /* מעקב לא חוסם את הפתיחה */ }
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={track} className={className}>
      {children}
    </a>
  );
}
