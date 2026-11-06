"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

// מעטפת של "ענף" באדמין: תפריט צד משלו במקום התפריט הראשי, אותו מבנה אצל
// ענף בתי הספר (SchoolsShell, גם בפורטל השותפה) ואצל ענף לימוד חכם. בטלפון
// התפריט נפתח מכפתור. הכותרת של האתר דביקה ובגובה משתנה; התפריט מתחיל
// מתחתיה, אחרת הפריט הראשון נבלע מאחוריה.

export type BranchItem = { path: string; label: string; icon: string };

export default function BranchShell({
  base,
  title,
  subtitle,
  items,
  /** נתיבים (יחסית ל-base) שאינם בתפריט אבל "שייכים" למסך משלהם, ולא לפריט הריק. */
  extraNamed = [],
  footer,
  children,
  after,
}: {
  base: string;
  title: string;
  subtitle?: string;
  items: BranchItem[];
  extraNamed?: string[];
  footer?: ReactNode;
  children: ReactNode;
  /** רכיבים שיושבים מחוץ לדף (תזכורות צפות וכדומה). */
  after?: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  // המגירה בטלפון נסגרת בלחיצה על קישור, לא מתוך effect על הנתיב.
  const [open, setOpen] = useState(false);
  const [headerH, setHeaderH] = useState(0);
  useEffect(() => {
    const h = document.querySelector("header");
    if (!h) return;
    const ro = new ResizeObserver(() => setHeaderH(Math.round(h.getBoundingClientRect().height)));
    ro.observe(h);
    return () => ro.disconnect();
  }, []);

  const named = [...items.filter((i) => i.path).map((i) => base + i.path), ...extraNamed.map((p) => base + p)];
  // הפריט הריק (הרשימה) דולק גם בעמוד של ישות, אבל לא בשאר מסכי הענף.
  const active = (i: BranchItem) => {
    const href = base + i.path;
    if (i.path) return pathname === href || pathname.startsWith(href + "/");
    return pathname === base || (pathname.startsWith(base + "/") && !named.some((n) => pathname === n || pathname.startsWith(n + "/")));
  };

  const nav = (
    <nav className="space-y-0.5">
      {items.map((i) => (
        <Link
          key={i.label}
          href={base + i.path}
          onClick={() => setOpen(false)}
          className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${active(i) ? "bg-[#3D8C8A] text-white" : "text-stone-600 hover:bg-stone-100"}`}
        >
          <span aria-hidden>{i.icon}</span>
          {i.label}
        </Link>
      ))}
    </nav>
  );

  const head = (
    <div className="px-3">
      <div className="text-sm font-black text-stone-900">{title}</div>
      {subtitle && <div className="text-xs text-stone-500">{subtitle}</div>}
    </div>
  );

  return (
    <div dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <aside style={{ top: headerH }} className="fixed bottom-0 right-0 z-40 hidden w-52 flex-col gap-5 overflow-y-auto border-e border-stone-200 bg-white py-4 ps-3 pe-3 lg:flex">
        {head}
        {nav}
        {footer && <div className="mt-auto" onClick={() => setOpen(false)}>{footer}</div>}
      </aside>

      <div style={{ top: headerH }} className="sticky z-40 flex items-center justify-between border-b border-stone-200 bg-white px-4 py-2.5 lg:hidden">
        <button type="button" onClick={() => setOpen(true)} aria-label="תפריט" className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-bold text-stone-600">
          ☰ תפריט
        </button>
        <span className="text-sm font-black text-stone-800">{title}</span>
      </div>
      {open && (
        <div className="fixed inset-0 z-[110] lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 right-0 flex w-64 flex-col gap-5 overflow-y-auto bg-white px-3 py-4 shadow-2xl">
            <div className="flex items-start justify-between">
              {head}
              <button type="button" onClick={() => setOpen(false)} aria-label="סגירה" className="rounded-full px-2 py-0.5 text-stone-400">
                ✕
              </button>
            </div>
            {nav}
            {footer && <div onClick={() => setOpen(false)}>{footer}</div>}
          </aside>
        </div>
      )}

      <div className="min-h-screen bg-stone-50 lg:ps-52">{children}</div>
      {after}
    </div>
  );
}
