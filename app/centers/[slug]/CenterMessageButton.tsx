"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import SiteMessageModal from "@/app/therapists/SiteMessageModal";

// כפתור "שליחת הודעה למרכז" בעמוד הציבורי - פותח את מודאל ההודעות הרגיל של
// טיפול חכם, ממוען לשורת ישות-המרכז (מסלול 2). ההודעה נשלחת למייל המרכז,
// נספרת בפניות בפורטל ונקלטת כליד ב-CRM - בדיוק כמו פנייה למטפל בודד.

export default function CenterMessageButton({ entityId, centerName, className, label }: {
  entityId: string;
  centerName: string;
  className?: string; // דריסת עיצוב מלאה (למשל בפס הדביק או ב-CTA הכהה); בלעדיה - הפיל הלבן המקורי
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}
        className={className ?? "inline-flex items-center gap-2 rounded-full border-[1.5px] border-[var(--teal-mid)] bg-white px-7 py-3 text-base font-bold transition hover:bg-[var(--teal-pale)]"}
        style={className ? undefined : { color: "var(--teal-dark)" }}>
        <MessageCircle size={16} /> {label ?? "שליחת הודעה למרכז"}
      </button>
      <SiteMessageModal
        therapistId={entityId}
        therapistName={centerName}
        source="profile"
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
