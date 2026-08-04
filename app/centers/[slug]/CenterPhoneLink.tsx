"use client";

import { getOrCreateSessionId } from "@/app/lib/session";
import { getAttribution } from "@/app/lib/attribution";
import { gaEvent } from "@/app/lib/gtag";

// קישור טלפון בעמוד מרכז (מסלול 2) - נרשם כלחיצת-קשר על ישות-המרכז, בדיוק
// כמו בפרופיל מטפל: בלעדיו ערוץ הטלפון (הדומיננטי) נעלם מ"לחיצות ליצירת
// קשר" בפורטל וגם מאירוע ה-lead ב-GA. keepalive כדי שהבקשה תשרוד ניווט.

export default function CenterPhoneLink({ entityId, phone, className, style, children }: {
  entityId: string;
  phone: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  function track() {
    try {
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
      gaEvent("generate_lead", { method: "phone", source: "center_page" });
    } catch { /* מעקב לא חוסם חיוג */ }
  }
  return (
    <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} onClick={track} className={className} style={style}>
      {children}
    </a>
  );
}
