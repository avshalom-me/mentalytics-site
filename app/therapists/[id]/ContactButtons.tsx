"use client";

import { useState } from "react";
import SiteMessageModal from "../SiteMessageModal";
import { getAttribution } from "@/app/lib/attribution";
import { getOrCreateSessionId } from "@/app/lib/session";
import { gaEvent } from "@/app/lib/gtag";

const wasvg = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const phonesvg = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.06 6.06l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);

const messagesvg = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
  </svg>
);

function track(
  therapistId: string,
  clickType: "whatsapp" | "phone" | "email",
  source: "match" | "profile",
) {
  const attribution = getAttribution() ?? {};
  fetch("/api/track-click", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // keepalive: on mobile the tap immediately jumps to WhatsApp / the dialer,
    // backgrounding the page - without it the in-flight request can be killed
    // and the contact silently undercounted.
    keepalive: true,
    body: JSON.stringify({
      therapist_id: therapistId,
      click_type: clickType,
      source,
      session_id: getOrCreateSessionId(),
      ...attribution,
    }),
  }).catch(() => {});
  // GA4 conversion: the patient reached out to a therapist - the key patient-side
  // lead. Mark it a Key Event + import to Google Ads so paid search optimizes to it.
  gaEvent("generate_lead", { method: clickType, source });
}

// Shared pill styling for the large, prominent profile contact buttons.
const pill = "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-[15px] font-extrabold transition-colors";

export default function ContactButtons({
  therapistId,
  therapistName,
  waLink,
  phone,
  source = "directory",
  mobileSticky = false,
}: {
  therapistId: string;
  therapistName: string;
  waLink: string | null;
  phone: string | null;
  source?: "match" | "directory";
  mobileSticky?: boolean;
}) {
  const [messageOpen, setMessageOpen] = useState(false);
  // These buttons only ever render on the profile page, so a non-match visitor
  // clicking here is a "profile" contact - not a "directory" one. Match-origin
  // visitors stay "match" so the matching system keeps its attribution (every
  // report here splits on source === "match").
  const clickSource: "match" | "profile" = source === "match" ? "match" : "profile";
  const messageSource = clickSource;
  const hasDirect = Boolean(waLink || phone);

  return (
    <>
      {/* Inline buttons (in the hero) */}
      <div className="mt-6 flex flex-wrap gap-3">
        {waLink && (
          <a href={waLink} target="_blank" rel="noopener noreferrer"
            onClick={() => track(therapistId, "whatsapp", clickSource)}
            className={`${pill} bg-green-500 text-white hover:bg-green-600`}>
            {wasvg} שליחת וואטסאפ
          </a>
        )}
        {phone && (
          <a href={`tel:${phone}`}
            onClick={() => track(therapistId, "phone", clickSource)}
            className={`${pill} bg-[#3D8C8A] text-white hover:bg-[#2A6462]`}>
            {phonesvg} חיוג
          </a>
        )}
        <button
          type="button"
          onClick={() => setMessageOpen(true)}
          className={`${pill} bg-white border-[1.5px] border-[#3D8C8A] text-[#2A6462] hover:bg-[#EAF4F3]`}>
          {messagesvg} הודעה דרך האתר
        </button>
      </div>

      {/* Sticky mobile contact bar - always reachable while scrolling */}
      {mobileSticky && (
        <div className="fixed inset-x-0 bottom-0 z-40 sm:hidden bg-white/95 backdrop-blur border-t border-[#DDE9E8] px-4 py-3"
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
          <div className="flex gap-2">
            {waLink ? (
              <a href={waLink} target="_blank" rel="noopener noreferrer"
                onClick={() => track(therapistId, "whatsapp", clickSource)}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-green-500 text-white py-3 text-[15px] font-extrabold">
                {wasvg} וואטסאפ
              </a>
            ) : null}
            {phone ? (
              <a href={`tel:${phone}`}
                onClick={() => track(therapistId, "phone", clickSource)}
                className={`${waLink ? "" : "flex-1 "}inline-flex items-center justify-center gap-2 rounded-full bg-[#3D8C8A] text-white px-5 py-3 text-[15px] font-extrabold`}>
                {phonesvg} חיוג
              </a>
            ) : null}
            {!hasDirect && (
              <button type="button" onClick={() => setMessageOpen(true)}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-[#3D8C8A] text-white py-3 text-[15px] font-extrabold">
                {messagesvg} שליחת הודעה
              </button>
            )}
          </div>
        </div>
      )}

      <SiteMessageModal
        therapistId={therapistId}
        therapistName={therapistName}
        source={messageSource}
        open={messageOpen}
        onClose={() => setMessageOpen(false)}
      />
    </>
  );
}
