"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isEnglishPath } from "@/app/lib/english-path";

// Moved out of app/layout.tsx (27/9/2026) so it can follow the route: the
// layout is a server component and cannot know which page it wraps, and the
// English section (/en) needs its footer in English.

type FooterLink = { href: string; label: string; lang?: string };

const HEBREW_LINKS: FooterLink[] = [
  { href: "/therapists", label: "מאגר המטפלים" },
  // The online hub had no link from the homepage, the menu or
  // the footer (25/9/2026), though online is the paid landing
  // that converts best. One sitewide link fixes all three.
  { href: "/therapists/region/אונליין", label: "טיפול אונליין" },
  { href: "/research", label: "מאמרים ומידע" },
  { href: "/centers", label: "למרכזים טיפוליים" },
  { href: "/counselors", label: "לצוותי חינוך" },
  { href: "/centers/login", label: "כניסה למרכזים" },
  { href: "/privacy", label: "מדיניות פרטיות" },
  { href: "/terms", label: "תנאי שימוש" },
  { href: "/billing-policy", label: "תקנון רכישה" },
  { href: "/accessibility", label: "הצהרת נגישות" },
  // The English page's one sitewide link, so it is not an orphan.
  { href: "/en", label: "English", lang: "en" },
];

const ENGLISH_LINKS: FooterLink[] = [
  { href: "/en#therapists", label: "Therapists who work in English" },
  { href: "/", label: "עברית", lang: "he" },
  { href: "/privacy", label: "Privacy policy (Hebrew)" },
  { href: "/terms", label: "Terms of use (Hebrew)" },
  { href: "/accessibility", label: "Accessibility statement (Hebrew)" },
];

export default function SiteFooter() {
  const english = isEnglishPath(usePathname());
  const links = english ? ENGLISH_LINKS : HEBREW_LINKS;
  return (
    <footer className="print:hidden" style={{ background: "var(--surface)", borderTop: "1px solid var(--line)" }} dir={english ? "ltr" : "rtl"} lang={english ? "en" : undefined}>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span style={{ fontSize: "12px", color: "var(--faint)" }}>
            © {new Date().getFullYear()} {english ? "Tipul Chacham (Mentalytics)" : "טיפול חכם - Mentalytics"}
          </span>
          <ul className="flex flex-wrap gap-5 list-none">
            {links.map(({ href, label, lang }) => (
              <li key={href}>
                <Link href={href} lang={lang} hrefLang={lang} style={{ fontSize: "12.5px", color: "var(--faint)", transition: "color .18s" }}
                  className="hover:text-[var(--teal)]">{label}</Link>
              </li>
            ))}
          </ul>
          <div style={{ fontSize: "12px", color: "var(--faint)" }} className="flex flex-wrap gap-4">
            <a href="mailto:admin@getmentalytics.com" className="hover:text-[var(--teal)]">admin@getmentalytics.com</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
