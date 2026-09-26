"use client";

import { useEffect } from "react";

/**
 * The site has one root layout, and it renders <html lang="he" dir="rtl"> for
 * every route. The English page's own content already sits in a lang="en"
 * dir="ltr" wrapper from the server; this sets the document itself once the
 * page is live (screen readers and the page-level scrollbar go by it), and
 * gives the Hebrew values back when the visitor navigates on to a Hebrew page.
 */
export default function DocumentLanguage({ lang, dir }: { lang: string; dir: "ltr" | "rtl" }) {
  useEffect(() => {
    const html = document.documentElement;
    const previous = { lang: html.lang, dir: html.dir };
    html.lang = lang;
    html.dir = dir;
    return () => {
      html.lang = previous.lang;
      html.dir = previous.dir;
    };
  }, [lang, dir]);
  return null;
}
