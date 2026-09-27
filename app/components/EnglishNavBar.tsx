"use client";

import { useState } from "react";
import Link from "next/link";
import { User, GraduationCap, Menu, X, LogIn } from "lucide-react";

// The header of the English section (/en). Same shell as NavBar, in English
// and left to right. The questionnaires and the therapist area it links to are
// still in Hebrew, and the labels say so where it matters.
const navLinks = [
  { href: "/en#therapists", label: "Therapists" },
  { href: "/en#questionnaire", label: "Questionnaires" },
  { href: "/en/therapy-for-olim", label: "Guide for olim" },
  { href: "/en#faq", label: "FAQ" },
];

const linkStyle: React.CSSProperties = { fontSize: "14px", fontWeight: 500, color: "var(--muted)", transition: "color .18s", paddingBottom: "2px" };

export default function EnglishNavBar() {
  const [open, setOpen] = useState(false);

  return (
    <header dir="ltr" lang="en" className="print:hidden" style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(255,255,255,.96)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", borderBottom: "1px solid var(--line)" }}>
      <div style={{ background: "var(--surface)", borderBottom: "1px solid var(--line)", padding: "7px 24px", fontSize: "13px", color: "var(--muted)", display: "flex", alignItems: "center", gap: "8px" }}>
        <span>Are you a therapist?</span>
        <Link
          href="/therapists/join"
          style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "var(--teal-dark)", fontWeight: 700, border: "1px solid var(--teal-mid)", background: "var(--teal-pale)", borderRadius: "50px", padding: "3px 12px", transition: "all .15s" }}
          className="hover:bg-[var(--teal-mid)]"
        >
          <LogIn size={13} />
          Sign in / join <span style={{ fontWeight: 400 }}>(Hebrew)</span>
        </Link>
      </div>

      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/en" onClick={() => setOpen(false)} aria-label="Tipul Chacham - English home">
          <img src="/logo-temp.png" alt="Tipul Chacham" style={{ height: "52px", width: "auto" }} />
        </Link>

        <nav aria-label="Main" className="hidden md:flex items-center gap-4">
          {navLinks.map(({ href, label }) => (
            <a key={href} href={href} style={linkStyle} className="hover:text-[var(--teal)]">{label}</a>
          ))}
          <Link href="/" lang="he" hrefLang="he" style={{ ...linkStyle, fontWeight: 700, color: "var(--teal-dark)" }} className="hover:text-[var(--teal)]">
            עברית
          </Link>
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <Link href="/adults"
            style={{ background: "var(--teal)", color: "white", borderRadius: "50px", fontWeight: 700, fontSize: "13px", padding: "7px 13px", transition: "all .2s", display: "inline-flex", alignItems: "center", gap: "5px" }}
            className="hover:bg-[var(--teal-dark)]">
            <User size={14} />
            Adult questionnaire
          </Link>
          <Link href="/kids"
            style={{ background: "var(--gold)", color: "white", borderRadius: "50px", fontWeight: 700, fontSize: "13px", padding: "7px 13px", transition: "all .2s", display: "inline-flex", alignItems: "center", gap: "5px" }}
            className="hover:bg-[var(--gold-dark)]">
            <GraduationCap size={14} />
            Child questionnaire
          </Link>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <Link href="/adults" style={{ background: "var(--teal)", color: "white", borderRadius: "50px", padding: "8px 16px", fontSize: "13px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <User size={13} />Adults
          </Link>
          <Link href="/kids" style={{ background: "var(--gold)", color: "white", borderRadius: "50px", padding: "8px 16px", fontSize: "13px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <GraduationCap size={13} />Children
          </Link>
          <button onClick={() => setOpen(!open)} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}
            style={{ borderRadius: "10px", padding: "8px", color: "var(--muted)", background: "transparent", border: "none", cursor: "pointer" }}
            className="hover:bg-[var(--surface)]">
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {open && (
        <nav aria-label="Mobile menu" style={{ borderTop: "1px solid var(--line)", background: "white", padding: "16px 24px" }} className="md:hidden space-y-3">
          {navLinks.map(({ href, label }) => (
            <a key={href} href={href} onClick={() => setOpen(false)} style={{ display: "block", fontSize: "14px", color: "var(--muted)", padding: "6px 0" }}>{label}</a>
          ))}
          <Link href="/" lang="he" hrefLang="he" onClick={() => setOpen(false)} style={{ display: "block", fontSize: "14px", fontWeight: 700, color: "var(--teal-dark)", padding: "6px 0" }}>
            עברית
          </Link>
          <Link href="/therapists/join" onClick={() => setOpen(false)}
            style={{ marginTop: "6px", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "14px", fontWeight: 700, color: "var(--teal-dark)", border: "1.5px solid var(--teal)", background: "var(--teal-pale)", borderRadius: "50px", padding: "8px 16px" }}>
            <LogIn size={15} />
            Therapist sign in / join (Hebrew)
          </Link>
        </nav>
      )}
    </header>
  );
}
