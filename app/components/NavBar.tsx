"use client";

import { useState } from "react";
import Link from "next/link";
import { User, GraduationCap, Menu, X } from "lucide-react";

export default function NavBar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[#E8E1D8] bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" onClick={() => setOpen(false)}>
          <img src="/logo.svg.png" alt="Mentalytics" className="h-16 w-auto" />
        </Link>

        {/* Desktop nav */}
        <nav aria-label="ניווט ראשי" className="hidden md:flex items-center gap-4">
          <Link className="text-sm text-stone-700 hover:text-stone-900 hover:underline" href="/about">אודות</Link>
          <Link className="text-sm text-stone-700 hover:text-stone-900 hover:underline" href="/research">מאמרים ומידע שימושי</Link>
          <a className="text-sm text-stone-700 hover:text-stone-900 hover:underline" href="/#kids">ילדים</a>
          <a className="text-sm text-stone-700 hover:text-stone-900 hover:underline" href="/#adults">מבוגרים</a>
          <Link className="text-sm text-stone-700 hover:text-stone-900 hover:underline" href="/therapists">מטפלים</Link>
          <div className="flex items-center gap-2">
            <Link href="/adults" className="inline-flex items-center gap-2 rounded-xl bg-[#C96B55] px-3 py-2 text-sm font-semibold text-white hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-[#C96B55]/40">
              <User size={16} />
              שאלון למבוגרים
            </Link>
            <Link href="/kids" className="inline-flex items-center gap-2 rounded-xl bg-[#6F8F7A] px-3 py-2 text-sm font-semibold text-white hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-[#6F8F7A]/40">
              <GraduationCap size={16} />
              שאלון לילדים/נוער
            </Link>
          </div>
        </nav>

        {/* Mobile: two CTA buttons + hamburger */}
        <div className="flex items-center gap-2 md:hidden">
          <Link href="/adults" className="inline-flex items-center gap-1 rounded-xl bg-[#C96B55] px-3 py-2 text-xs font-semibold text-white hover:opacity-95">
            <User size={14} />
            מבוגרים
          </Link>
          <Link href="/kids" className="inline-flex items-center gap-1 rounded-xl bg-[#6F8F7A] px-3 py-2 text-xs font-semibold text-white hover:opacity-95">
            <GraduationCap size={14} />
            ילדים
          </Link>
          <button
            onClick={() => setOpen(!open)}
            aria-label={open ? "סגור תפריט" : "פתח תפריט"}
            className="rounded-xl p-2 text-stone-600 hover:bg-stone-100"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <nav aria-label="תפריט נייד" className="md:hidden border-t border-[#E8E1D8] bg-white px-6 py-4 space-y-3">
          <Link className="block text-sm text-stone-700 hover:text-stone-900 py-1" href="/about" onClick={() => setOpen(false)}>אודות</Link>
          <Link className="block text-sm text-stone-700 hover:text-stone-900 py-1" href="/research" onClick={() => setOpen(false)}>מאמרים ומידע שימושי</Link>
          <a className="block text-sm text-stone-700 hover:text-stone-900 py-1" href="/#kids" onClick={() => setOpen(false)}>ילדים</a>
          <a className="block text-sm text-stone-700 hover:text-stone-900 py-1" href="/#adults" onClick={() => setOpen(false)}>מבוגרים</a>
          <Link className="block text-sm text-stone-700 hover:text-stone-900 py-1" href="/therapists" onClick={() => setOpen(false)}>מטפלים</Link>
        </nav>
      )}
    </header>
  );
}
