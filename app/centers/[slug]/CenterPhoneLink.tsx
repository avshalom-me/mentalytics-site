"use client";

import { getOrCreateSessionId } from "@/app/lib/session";
import { getAttribution } from "@/app/lib/attribution";
import { gaEvent } from "@/app/lib/gtag";
import { trackingOptedOut } from "@/app/lib/track-optout";
import { trackCenterEvent } from "@/app/components/CenterTracking";

// קישור טלפון בעמוד מרכז. שני מסלולי רישום:
//   מסלול 2 (יש שורת ישות): therapist_contact_clicks על הישות - כמו מטפל.
//   מסלול 1 (אין ישות):     center_contact_click ב-analytics_events. עד
//   20/8/2026 הענף הזה רונדר כ-<a> חשוף - ערוץ הטלפון של מרכזי מסלול 1
//   פשוט לא נמדד (ממצא 12 בביקורת המרכזים).
// keepalive כדי שהבקשה תשרוד את הקפיצה לחייגן.

export default function CenterPhoneLink({ entityId, centerId, phone, className, style, children }: {
  /** מסלול 2: מזהה שורת ישות-המרכז. */
  entityId?: string;
  /** מסלול 1: מזהה חשבון המרכז - נרשם כ-center_contact_click. */
  centerId?: string;
  phone: string;
  className?: string;
  style?: React.CSSProperties;
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
            click_type: "phone",
            source: "profile",
            session_id: getOrCreateSessionId(),
            ...(getAttribution() ?? {}),
          }),
        }).catch(() => {});
      } else if (centerId) {
        trackCenterEvent("center_contact_click", centerId, { type: "phone" });
      }
      gaEvent("generate_lead", { method: "phone", source: "center_page" });
    } catch { /* מעקב לא חוסם חיוג */ }
  }
  return (
    <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} onClick={track} className={className} style={style}>
      {children}
    </a>
  );
}
