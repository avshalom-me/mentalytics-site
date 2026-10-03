"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Menu, X, LogIn } from "lucide-react";
import { LEARNING_BRAND } from "@/app/lib/learning-door";

// הכותרת העליונה של "לימוד חכם" - כל מה שתחת /learning. NavBar מחליף אליה
// לפי הנתיב, כמו שהוא מחליף לכותרת האנגלית ב-/en.
//
// למה כותרת משלה: הניווט הראשי בנוי סביב שני הקהלים של טיפול חכם (מבוגרים
// וילדים) וסביב המטפלים. הורה שמחפש מורה, ומורה שבא להצטרף, לא צריכים
// "המטפלים שלנו" ו"כניסה למטפלים" - והבעלים ביקש שהדלת הזו תעמוד בפני עצמה.
// הדרך חזרה לאתר הראשי היא הקישור "מבית טיפול חכם" שליד הלוגו.

const links = [
  { href: "/learning#search", label: "חיפוש מורה" },
  { href: "/learning#how", label: "איך זה עובד" },
  { href: "/learning#faq", label: "שאלות נפוצות" },
  { href: "/kids", label: "שאלון לילדים ולנוער" },
];

const linkStyle = { fontSize: "14px", fontWeight: 500, color: "var(--muted)", transition: "color .18s" } as const;

export default function LearningNavBar() {
  const [open, setOpen] = useState(false);
  return (
    <header className="print:hidden" style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(255,255,255,.96)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", borderBottom: "1px solid var(--line)" }}>
      <div style={{ background: "var(--surface)", borderBottom: "1px solid var(--line)", padding: "7px 24px", fontSize: "13px", color: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "flex-start", gap: "8px", flexWrap: "wrap" }}>
        <span>מורה?</span>
        <Link
          href="/learning/join"
          style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "var(--teal-dark)", fontWeight: 700, border: "1px solid var(--teal-mid)", background: "var(--teal-pale)", borderRadius: "50px", padding: "3px 12px", transition: "all .15s" }}
          className="hover:bg-[var(--teal-mid)]"
        >
          הצטרפות למאגר
        </Link>
        <Link href="/learning/me" style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "var(--teal-dark)", fontWeight: 700 }} className="hover:underline">
          <LogIn size={13} />
          הפרופיל שלי
        </Link>
      </div>

      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-3">
        <div className="flex items-end gap-3">
          <Link href="/learning" onClick={() => setOpen(false)} aria-label={`${LEARNING_BRAND} - עמוד הבית`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/limud-chacham-logo.svg" alt={LEARNING_BRAND} width={116} height={52} style={{ height: "52px", width: "auto" }} />
          </Link>
          <Link href="/" style={{ fontSize: "12px", color: "var(--muted)", paddingBottom: "3px", whiteSpace: "nowrap" }} className="hover:text-[var(--teal)]">
            מבית טיפול חכם
          </Link>
        </div>

        <nav aria-label={`ניווט ${LEARNING_BRAND}`} className="hidden items-center gap-4 md:flex lg:gap-5">
          {links.map(({ href, label }) => (
            <a key={href} href={href} style={linkStyle} className="nav-link hover:text-[var(--teal)]">{label}</a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <a href="/learning#search"
            style={{ background: "var(--teal)", color: "white", borderRadius: "50px", fontWeight: 700, fontSize: "13px", padding: "7px 14px", transition: "all .2s", display: "inline-flex", alignItems: "center", gap: "5px" }}
            className="hover:bg-[var(--teal-dark)]">
            <Search size={14} />
            חיפוש מורה
          </a>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <a href="/learning#search" style={{ background: "var(--teal)", color: "white", borderRadius: "50px", padding: "8px 14px", fontSize: "13px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" }}>
            <Search size={13} />חיפוש מורה
          </a>
          <button onClick={() => setOpen(!open)} aria-label={open ? "סגור תפריט" : "פתח תפריט"} aria-expanded={open}
            style={{ borderRadius: "10px", padding: "8px", color: "var(--muted)", background: "transparent", border: "none", cursor: "pointer" }}
            className="hover:bg-[var(--surface)]">
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {open && (
        <nav aria-label="תפריט נייד" style={{ borderTop: "1px solid var(--line)", background: "white", padding: "16px 24px" }} className="space-y-3 md:hidden">
          {links.map(({ href, label }) => (
            <a key={href} href={href} onClick={() => setOpen(false)} style={{ display: "block", fontSize: "14px", color: "var(--muted)", padding: "6px 0" }}>{label}</a>
          ))}
          <Link href="/learning/join" onClick={() => setOpen(false)}
            style={{ marginTop: "6px", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "14px", fontWeight: 700, color: "var(--teal-dark)", border: "1.5px solid var(--teal)", background: "var(--teal-pale)", borderRadius: "50px", padding: "8px 16px" }}>
            מורים: הצטרפות למאגר
          </Link>
          <Link href="/" onClick={() => setOpen(false)} style={{ display: "block", fontSize: "13px", color: "var(--faint)", padding: "6px 0" }}>
            לאתר טיפול חכם
          </Link>
        </nav>
      )}
    </header>
  );
}
