"use client";

import { useState } from "react";
import Link from "next/link";
import { User, GraduationCap, Menu, X, LogIn } from "lucide-react";

const navLinks = [
  { href: "/about", label: "מי אנחנו" },
  { href: "/research", label: "מאמרים" },
  { href: "/#kids", label: "ילדים", anchor: true },
  { href: "/#adults", label: "מבוגרים", anchor: true },
  { href: "/therapists", label: "המטפלים שלנו" },
];

export default function NavBar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="print:hidden" style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(255,255,255,.96)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", transform: "translateZ(0)", WebkitTransform: "translateZ(0)", borderBottom: "1px solid var(--line)" }}>
      {/* Topbar */}
      <div style={{ background: "var(--surface)", borderBottom: "1px solid var(--line)", padding: "7px 24px", fontSize: "13px", color: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "flex-start", gap: "8px" }}>
        <span>את/ה מטפל/ת?</span>
        <Link
          href="/therapists/join"
          style={{
            display: "inline-flex", alignItems: "center", gap: "5px",
            color: "var(--teal-dark)", fontWeight: 700,
            border: "1px solid var(--teal-mid)", background: "var(--teal-pale)",
            borderRadius: "50px", padding: "3px 12px", transition: "all .15s",
          }}
          className="hover:bg-[var(--teal-mid)]"
        >
          <LogIn size={13} />
          כניסה / הרשמה למטפלים
        </Link>
      </div>

      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        {/* Logo */}
        <Link href="/" onClick={() => setOpen(false)} aria-label="טיפול חכם — דף הבית">
          <img src="/logo-temp.png" alt="טיפול חכם" style={{ height: "52px", width: "auto" }} />
        </Link>

        {/* Desktop nav */}
        <nav aria-label="ניווט ראשי" className="hidden md:flex items-center gap-3 lg:gap-4">
          {navLinks.map(({ href, label, anchor }) =>
            anchor ? (
              <a key={href} href={href} style={{ fontSize: "14px", fontWeight: 500, color: "var(--muted)", transition: "color .18s", position: "relative", paddingBottom: "2px" }}
                className="nav-link hover:text-[var(--teal)]">{label}</a>
            ) : (
              <Link key={href} href={href} style={{ fontSize: "14px", fontWeight: 500, color: "var(--muted)", transition: "color .18s", position: "relative", paddingBottom: "2px" }}
                className="nav-link hover:text-[var(--teal)]">{label}</Link>
            )
          )}
          <Link
            href="/developers"
            style={{ fontSize: "14px", fontWeight: 600, backgroundImage: "linear-gradient(120deg,#7C3AED,#DB2777,#06B6D4)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}
          >
            בית למפתחים בתחומי הטיפול
          </Link>
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-2">
          <Link href="/therapists/join"
            style={{ background: "white", color: "var(--teal-dark)", border: "1.5px solid var(--teal)", borderRadius: "50px", fontFamily: "inherit", fontWeight: 700, fontSize: "13px", padding: "6px 13px", transition: "all .2s", display: "inline-flex", alignItems: "center", gap: "5px" }}
            className="hover:bg-[var(--teal-pale)]">
            <LogIn size={14} />
            כניסה למטפלים
          </Link>
          <Link href="/kids"
            style={{ background: "var(--gold)", color: "white", borderRadius: "50px", fontFamily: "inherit", fontWeight: 700, fontSize: "13px", padding: "7px 13px", transition: "all .2s", display: "inline-flex", alignItems: "center", gap: "5px" }}
            className="hover:bg-[var(--gold-dark)]">
            <GraduationCap size={14} />
            התאמה לילדים
          </Link>
          <Link href="/adults"
            style={{ background: "var(--teal)", color: "white", borderRadius: "50px", fontFamily: "inherit", fontWeight: 700, fontSize: "13px", padding: "7px 13px", transition: "all .2s", display: "inline-flex", alignItems: "center", gap: "5px" }}
            className="hover:bg-[var(--teal-dark)]">
            <User size={14} />
            התאמה למבוגרים
          </Link>
        </div>

        {/* Mobile */}
        <div className="flex items-center gap-2 md:hidden">
          <Link href="/adults" style={{ background: "var(--teal)", color: "white", borderRadius: "50px", padding: "8px 16px", fontSize: "13px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <User size={13} />מבוגרים
          </Link>
          <Link href="/kids" style={{ background: "var(--gold)", color: "white", borderRadius: "50px", padding: "8px 16px", fontSize: "13px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <GraduationCap size={13} />ילדים
          </Link>
          <button onClick={() => setOpen(!open)} aria-label={open ? "סגור תפריט" : "פתח תפריט"}
            style={{ borderRadius: "10px", padding: "8px", color: "var(--muted)", background: "transparent", border: "none", cursor: "pointer" }}
            className="hover:bg-[var(--surface)]">
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <nav aria-label="תפריט נייד" style={{ borderTop: "1px solid var(--line)", background: "white", padding: "16px 24px" }} className="md:hidden space-y-3">
          {navLinks.map(({ href, label, anchor }) =>
            anchor ? (
              <a key={href} href={href} onClick={() => setOpen(false)}
                style={{ display: "block", fontSize: "14px", color: "var(--muted)", padding: "6px 0" }}>{label}</a>
            ) : (
              <Link key={href} href={href} onClick={() => setOpen(false)}
                style={{ display: "block", fontSize: "14px", color: "var(--muted)", padding: "6px 0" }}>{label}</Link>
            )
          )}
          <Link href="/developers" onClick={() => setOpen(false)}
            style={{ display: "block", fontSize: "14px", fontWeight: 600, padding: "6px 0", backgroundImage: "linear-gradient(120deg,#7C3AED,#DB2777,#06B6D4)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
            בית למפתחים בתחומי הטיפול
          </Link>
          <Link href="/therapists/join" onClick={() => setOpen(false)}
            style={{ marginTop: "6px", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "14px", fontWeight: 700, color: "var(--teal-dark)", border: "1.5px solid var(--teal)", background: "var(--teal-pale)", borderRadius: "50px", padding: "8px 16px" }}>
            <LogIn size={15} />
            כניסה / הרשמה למטפלים
          </Link>
        </nav>
      )}
    </header>
  );
}
