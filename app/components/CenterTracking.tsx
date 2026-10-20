"use client";

import { useEffect } from "react";
import { getOrCreateSessionId } from "@/app/lib/session";
import { getAttribution } from "@/app/lib/attribution";
import { trackingOptedOut } from "@/app/lib/track-optout";
import { centerWebsiteHref } from "@/app/lib/center-page-details";

// אירועי עמוד-מרכז (מיגרציה 20260820): צפיית עמוד, לחיצה לאתר המרכז,
// ולחיצת קשר במסלול 1 - שם אין שורת ישות ב-therapists ולכן אין לאן לרשום
// דרך המסלול הרגיל. metadata.center_id הוא המפתח שהאדמין מצרף לפיו.

export function trackCenterEvent(
  eventType: "center_page_view" | "center_website_click" | "center_contact_click",
  centerId: string,
  extra?: Record<string, string>,
  /**
   * מאיפה נלחץ - "directory"/"match" לכרטיס, ריק לעמוד המרכז. נשמר בעמודת
   * source של analytics_events; האדמין מפריד לפיו "לחיצות קשר מהעמוד" מ"מהכרטיסים".
   */
  source?: string,
) {
  if (trackingOptedOut()) return; // מכשיר של הצוות
  try {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true, // לחיצות אתר/טלפון מנווטות מיד - בלעדיו הבקשה נהרגת
      body: JSON.stringify({
        event_type: eventType,
        ...(source ? { source } : {}),
        session_id: getOrCreateSessionId(),
        metadata: { center_id: centerId, ...(extra ?? {}) },
        ...(getAttribution() ?? {}),
      }),
    }).catch(() => {});
  } catch {
    /* מעקב לא חוסם ניווט */
  }
}

/** צפיית עמוד מרכז - נורית פעם אחת בטעינה, בשני המסלולים. */
export function CenterPageView({ centerId, track }: { centerId: string; track: string }) {
  useEffect(() => {
    trackCenterEvent("center_page_view", centerId, { track });
  }, [centerId, track]);
  return null;
}

/**
 * עוגן "אתר המרכז" - נספר לפני היציאה החוצה, והלחיצות מוצגות למרכז בפורטל.
 *
 * מ-20/10/2026 שלושה דברים, כדי שהמרכז יוכל לאמת את המספר גם אצלו:
 * - הכתובת נושאת utm_source=mentalytics (center-page-details.ts), כך שהביקורים
 *   מסומנים בגוגל אנליטיקס של המרכז.
 * - בלי noreferrer: עד אז הדפדפן מחק את כתובת המקור, והביקור נרשם אצל המרכז
 *   כ"ישיר". noopener נשאר (אבטחה); nofollow נשאר, כי זה קישור לעסק שמשלם לנו.
 * - גם לחיצה בכפתור האמצעי (פתיחה בלשונית חדשה) נספרת.
 */
export function CenterWebsiteLink({ centerId, href, className, style, children }: {
  centerId: string;
  href: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <a
      href={centerWebsiteHref(href) ?? href}
      target="_blank"
      rel="noopener nofollow"
      onClick={() => trackCenterEvent("center_website_click", centerId)}
      onAuxClick={(e) => { if (e.button === 1) trackCenterEvent("center_website_click", centerId); }}
      className={className}
      style={style}
    >
      {children}
    </a>
  );
}
