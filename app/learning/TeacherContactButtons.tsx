"use client";

import { useEffect, useRef } from "react";
import { getAttribution } from "@/app/lib/attribution";
import { getOrCreateSessionId } from "@/app/lib/session";
import { trackingOptedOut } from "@/app/lib/track-optout";
import { gaEvent } from "@/app/lib/gtag";
import { phoneNationalDigits, foreignPhoneDigits, telHref } from "@/app/lib/phone";

// כפתורי הקשר עם מורה - בכרטיס התוצאה בשאלון הילדים ובעמוד הפרופיל.
// וואטסאפ עם הודעת פתיחה (לנייד או למספר זר) וחיוג (ישראלי בלבד), כמו אצל
// מטפלים; הלחיצה נרשמת ב-teacher_events, לא בטבלאות המטפלים.

export const TEACHER_WHATSAPP_MESSAGE = 'שלום, הגעתי אלייך דרך אתר "טיפול חכם", אשמח לשמוע פרטים לגבי שיעורים';

export function teacherWaLink(phone: string | null | undefined): string | null {
  const digits = phoneNationalDigits(phone);
  if (digits && digits.startsWith("5")) return `https://wa.me/972${digits}?text=${encodeURIComponent(TEACHER_WHATSAPP_MESSAGE)}`;
  const foreign = foreignPhoneDigits(phone);
  if (foreign) return `https://wa.me/${foreign}?text=${encodeURIComponent(TEACHER_WHATSAPP_MESSAGE)}`;
  return null;
}

export type TeacherEventContext = { source: "match" | "profile"; quizType?: "kids" | "school" | null; subject?: string | null };

export function sendTeacherEvent(eventType: "impression" | "whatsapp" | "phone" | "profile_view", teacherIds: string[], ctx: TeacherEventContext) {
  if (trackingOptedOut() || teacherIds.length === 0) return;
  fetch("/api/teacher-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({
      event_type: eventType,
      teacher_ids: teacherIds,
      source: ctx.source,
      quiz_type: ctx.quizType ?? null,
      subject: ctx.subject ?? null,
      session_id: getOrCreateSessionId(),
      ...(getAttribution() ?? {}),
    }),
  }).catch(() => {});
}

/** רישום הופעות - פעם אחת לכל רשימת תוצאות. */
export function useTeacherImpressions(teacherIds: string[], ctx: TeacherEventContext) {
  const key = teacherIds.join(",");
  const sent = useRef("");
  useEffect(() => {
    if (!key || sent.current === key) return;
    sent.current = key;
    sendTeacherEvent("impression", teacherIds, ctx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

const waIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

export default function TeacherContactButtons({ teacherId, phone, ctx, showPhone = true }: { teacherId: string; phone: string | null | undefined; ctx: TeacherEventContext; showPhone?: boolean }) {
  const wa = teacherWaLink(phone);
  const tel = showPhone ? telHref(phone) : null;
  if (!wa && !tel) return null;
  const onClick = (type: "whatsapp" | "phone") => (e: React.MouseEvent) => {
    e.stopPropagation();
    sendTeacherEvent(type, [teacherId], ctx);
    // אירוע משלו ולא generate_lead: ההמרה "פנייה למטפל" ב-GA4 וב-Google Ads
    // נשענת על generate_lead, ופנייה למורה לא אמורה לשנות את מה שהיא סופרת.
    gaEvent("teacher_contact", { method: type, source: ctx.source });
  };
  return (
    <>
      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" onClick={onClick("whatsapp")}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-bold shadow-sm transition-opacity hover:opacity-90 sm:w-auto"
          style={{ background: "#128C42", color: "#fff" }}>
          {waIcon} וואטסאפ
        </a>
      )}
      {tel && (
        <a href={tel} onClick={onClick("phone")}
          className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-[var(--teal-mid)] bg-white px-4 py-2 text-[13px] font-bold text-[var(--teal-dark)] transition-colors hover:bg-[var(--teal-pale)]">
          📞 התקשרות
        </a>
      )}
    </>
  );
}
