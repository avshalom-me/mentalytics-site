"use client";

import { useEffect } from "react";

// Guards against the page loading horizontally offset on RTL — a symptom seen
// in in-app WebViews (e.g. the Facebook ad browser on Android), which mis-size
// their viewport while their own chrome animates in. That can leave the page
// scrolled sideways ("half screen, half white, nudge to fix") even though the
// layout itself has no horizontal overflow. The site never intends horizontal
// scroll, so we simply snap any non-zero horizontal offset back to 0 on load
// and on the resize/orientation events that follow the WebView settling.
export default function ScrollXGuard() {
  useEffect(() => {
    const reset = () => {
      const el = document.scrollingElement || document.documentElement;
      if (el && el.scrollLeft !== 0) el.scrollLeft = 0;
      if (window.scrollX !== 0) window.scrollTo(0, window.scrollY);
    };
    // Re-check across the first moments after load — the WebView resizes its
    // viewport a beat or two after the page appears.
    const burst = () => {
      reset();
      requestAnimationFrame(reset);
      setTimeout(reset, 150);
      setTimeout(reset, 600);
    };
    burst();
    window.addEventListener("pageshow", burst);     // load + bfcache restore
    window.addEventListener("resize", reset);       // WebView chrome collapse
    window.addEventListener("orientationchange", burst);
    return () => {
      window.removeEventListener("pageshow", burst);
      window.removeEventListener("resize", reset);
      window.removeEventListener("orientationchange", burst);
    };
  }, []);
  return null;
}
