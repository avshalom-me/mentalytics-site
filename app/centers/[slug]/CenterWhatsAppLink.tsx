"use client";

import { getOrCreateSessionId } from "@/app/lib/session";
import { getAttribution } from "@/app/lib/attribution";
import { gaEvent } from "@/app/lib/gtag";
import { trackingOptedOut } from "@/app/lib/track-optout";
import { trackCenterEvent } from "@/app/components/CenterTracking";

// קישור וואטסאפ בעמוד מרכז - אותם שני מסלולי רישום כמו CenterPhoneLink:
// ישות (מסלול 2) → therapist_contact_clicks; חשבון מרכז (מסלול 1) →
// center_contact_click. keepalive כי הטאפ קופץ מיד לוואטסאפ.

export default function CenterWhatsAppLink({ entityId, centerId, href, className, children }: {
  entityId?: string;
  centerId?: string;
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  function track() {
    if (trackingOptedOut()) return; // מכשיר של הצוות
    try {
      if (entityId) {
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
      } else if (centerId) {
        trackCenterEvent("center_contact_click", centerId, { type: "whatsapp" });
      }
      gaEvent("generate_lead", { method: "whatsapp", source: "center_page" });
    } catch { /* מעקב לא חוסם את הפתיחה */ }
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={track} className={className}>
      {children}
    </a>
  );
}
