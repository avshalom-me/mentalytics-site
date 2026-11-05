"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";
import { TRACKING_OPTOUT_KEY } from "@/app/lib/track-optout";
import { isTagFreePath, isTagFreeUrl } from "@/app/lib/tag-free-paths";

/**
 * Every third-party measurement and advertising tag on the site, in one place.
 *
 * Moved here from app/layout.tsx on 5/11/2026 so that the pages in
 * app/lib/tag-free-paths.ts (the counsellors' questionnaire, /school) load none
 * of them: no request to Google or Taboola, and no Vercel Analytics event. The
 * other pages are unchanged.
 *
 * Arriving at /school by a client-side navigation from a page that had already
 * loaded the tags would leave them running, so in that case the page reloads
 * itself once, and the fresh load has no tags. The links into /school
 * (/counselors) are plain anchors for the same reason, so the reload is a
 * fallback for the back button and for links added later. What can still slip
 * out in that fallback is the one page view Google's own history listener
 * sends at the moment of the navigation, before the reload: the address
 * "/school", nothing typed into the questionnaire.
 */

const GA_ID = "G-V3QQRXSQ0T";
const ADS_ID = "AW-18223934468";

// The team's browsers opt out of measurement (app/lib/track-optout.ts). Our
// own events honoured that from the start; the two third-party tags below did
// not, so every visit of the owner's reached GA4, Google Ads and Taboola.
// Each tag now checks the same flag before it configures itself.
const NOT_OPTED_OUT = `!(function(){try{return localStorage.getItem(${JSON.stringify(TRACKING_OPTOUT_KEY)})==="1"}catch(e){return false}})()`;

/** Set by the Google tag's bootstrap below, so a tag-free page can tell the tags are live. */
const LOADED_FLAG = "__mntThirdPartyTags";

function dropTagFree(event: BeforeSendEvent): BeforeSendEvent | null {
  return isTagFreeUrl(event.url) ? null : event;
}

export default function ThirdPartyTags() {
  const pathname = usePathname();
  const tagFree = isTagFreePath(pathname);

  // A layout effect, not a plain one: layout effects run before any component's
  // passive effects, and the questionnaire fires its first gtag("quiz_step") from
  // a passive effect on the very render that brings it to the screen.
  useLayoutEffect(() => {
    if (!tagFree) return;
    const w = window as unknown as Record<string, unknown>;
    if (!w[LOADED_FLAG]) return;
    // Silence the Google tag at once, then start clean.
    w[`ga-disable-${GA_ID}`] = true;
    w[`ga-disable-${ADS_ID}`] = true;
    window.location.reload();
  }, [tagFree]);

  return (
    <>
      {/* Vercel Analytics drops every event of a tag-free page, including the
          page views of a client-side navigation into one. */}
      <Analytics beforeSend={dropTagFree} />
      {!tagFree && (
        <>
          {/*
            One gtag.js load feeds two destinations: GA4 (G-V3QQRXSQ0T) for
            analytics, and Google Ads (AW-18223934468) for conversion measurement.
            The Ads line was missing, so the account's Google tag sat at "URGENT /
            No data has been received" and its only conversion action ("Page view")
            read Misconfigured with 0 results - which is also why the conversion
            setup wizard refused to advance past "Google Tag: not installed yet".
          */}
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="google-analytics" strategy="afterInteractive">{`
            window.${LOADED_FLAG} = true;
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            if (${NOT_OPTED_OUT}) {
              gtag('js', new Date());
              gtag('config', '${GA_ID}');
              gtag('config', '${ADS_ID}');
            }
          `}</Script>
          {/*
            פיקסל Taboola (חשבון 2102216) עבור קמפייני הנייטיב. הותקן ידנית
            ולא דרך GTM כי לאתר אין מיכל GTM - ה-gtag שמעליו מוגדר ישירות
            בקוד, ולהקים מיכל רק בשביל הפיקסל היה מחייב להעביר אליו גם את
            מעקב ההמרות של Google Ads שכבר עובד.
            כאן נטען הבסיס ונורה page_view; אירועי ההמרה נשלחים מ-app/lib/taboola.ts.
          */}
          <Script id="taboola-pixel" strategy="afterInteractive">{`
            window.${LOADED_FLAG} = true;
            if (${NOT_OPTED_OUT}) {
              window._tfa = window._tfa || [];
              window._tfa.push({notify: 'event', name: 'page_view', id: 2102216});
              !function (t, f, a, x) {
                if (!document.getElementById(x)) {
                  t.async = 1;t.src = a;t.id=x;f.parentNode.insertBefore(t, f);
                }
              }(document.createElement('script'),
              document.getElementsByTagName('script')[0],
              '//cdn.taboola.com/libtrc/unip/2102216/tfa.js',
              'tb_tfa_script');
            }
          `}</Script>
        </>
      )}
    </>
  );
}
