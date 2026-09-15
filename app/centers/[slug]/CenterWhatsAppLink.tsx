"use client";

import { getOrCreateSessionId } from "@/app/lib/session";
import { getAttribution } from "@/app/lib/attribution";
import { gaEvent } from "@/app/lib/gtag";
import { trackingOptedOut } from "@/app/lib/track-optout";
import { trackCenterEvent } from "@/app/components/CenterTracking";

// קישור וואטסאפ בעמוד מרכז - אותם שני מסלולי רישום כמו CenterPhoneLink:
// ישות (מסלול 2) → therapist_contact_clicks; חשבון מרכז (מסלול 1) →
// center_contact_click. keepalive כי הטאפ קופץ מיד לוואטסאפ.

export default function CenterWhatsAppLink({ entityId, centerId, href, className, children, source = "profile" }: {
  /** מסלול 2: מזהה שורת ישות-המרכז. */
  entityId?: string;
  /** מסלול 1: מזהה חשבון המרכז - נרשם כ-center_contact_click. */
  centerId?: string;
  href: string;
  className?: string;
  children: React.ReactNode;
  /**
   * מאיפה נלחץ: עמוד המרכז (ברירת מחדל), כרטיס במאגר או כרטיס בהתאמות.
   * שלושת המקורות נספרים בנפרד ואסור לערבב אותם - ראו project_contact_source_split.
   */
  source?: "profile" | "directory" | "match";
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
            source,
            session_id: getOrCreateSessionId(),
            ...(getAttribution() ?? {}),
          }),
        }).catch(() => {});
      } else if (centerId) {
        trackCenterEvent("center_contact_click", centerId, { type: "whatsapp" }, source === "profile" ? undefined : source);
      }
      gaEvent("generate_lead", { method: "whatsapp", source: source === "profile" ? "center_page" : source });
    } catch { /* מעקב לא חוסם את הפתיחה */ }
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={track} className={className}>
      {children}
    </a>
  );
}
