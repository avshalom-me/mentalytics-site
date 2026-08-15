"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// CRM-era navigation: a grouped right-hand sidebar (RTL start side) instead
// of the old top bar — the page count outgrew a single row. Every pre-CRM
// route keeps its URL; only the chrome changed.
const NAV_GROUPS: { label: string; items: { href: string; label: string; icon: string }[] }[] = [
  {
    label: "ראשי",
    items: [
      { href: "/admin", label: "לוח בקרה", icon: "🏠" },
      { href: "/admin/tasks", label: "משימות", icon: "✅" },
      { href: "/admin/agents", label: "סוכנים", icon: "🤖" },
      { href: "/admin/guide", label: "מדריך המערכת", icon: "📖" },
    ],
  },
  {
    label: "לקוחות",
    items: [
      { href: "/admin/therapists", label: "מטפלים", icon: "👥" },
      { href: "/admin/centers", label: "מרכזים טיפוליים", icon: "🏥" },
      { href: "/admin/leads", label: "לידים ופניות", icon: "📥" },
      { href: "/admin/guarantee", label: "תקופת ביטחון", icon: "🛡️" },
      { href: "/admin/deals", label: "עסקאות B2B", icon: "🤝" },
    ],
  },
  {
    label: "כספים",
    items: [{ href: "/admin/finance", label: "הכנסות והוצאות", icon: "💰" }],
  },
  {
    label: "צוות",
    items: [{ href: "/admin/staff", label: "שעות עבודה", icon: "🕒" }],
  },
  {
    label: "שיווק",
    items: [
      { href: "/admin/marketing", label: "דשבורד שיווק", icon: "🎛️" },
      { href: "/admin/attribution", label: "מקורות לידים", icon: "🎯" },
      { href: "/admin/recruitment", label: "גיוס מטפלים", icon: "🧲" },
      { href: "/admin/ads", label: "פרסום ממומן", icon: "📣" },
      { href: "/admin/recommendations", label: "המלצות", icon: "💡" },
    ],
  },
  {
    label: "אנליטיקה",
    items: [
      { href: "/admin/analytics", label: "אנליטיקס", icon: "📈" },
      { href: "/admin/seo", label: "SEO אורגני", icon: "🌱" },
      { href: "/admin/stats", label: "לחיצות", icon: "📊" },
      { href: "/admin/supply-demand", label: "היצע/ביקוש", icon: "⚖️" },
    ],
  },
  {
    label: "תוכן ודוחות",
    items: [
      { href: "/admin/articles", label: "מאמרים", icon: "📝" },
      { href: "/admin/weekly-reports", label: "דוח שבועי", icon: "📬" },
      { href: "/admin/monthly-reports", label: "דוח חודשי", icon: "🗓️" },
    ],
  },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  // "/admin" would startsWith-match every admin page — exact-match it.
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname === href || pathname?.startsWith(href + "/");

  return (
    <nav className="flex flex-col gap-5">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <div className="mb-1.5 pe-1 text-[11px] font-semibold text-stone-400">{group.label}</div>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  // Inline color overrides the global `a { color: inherit }` rule
                  // (unlayered CSS beats Tailwind's layered text utilities).
                  style={{ color: active ? "#ffffff" : "#57534e" }}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                    active ? "bg-stone-800" : "hover:bg-stone-100"
                  }`}
                >
                  <span className="text-xs">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Close the mobile drawer on navigation.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>

      {/* Desktop sidebar — fixed at the inline-start (right in RTL). */}
      <aside className="fixed inset-y-0 right-0 z-40 hidden w-52 flex-col overflow-y-auto border-e border-stone-200 bg-white px-3 py-4 lg:flex">
        <Link href="/admin" className="mb-5 block px-3 text-sm font-black text-stone-800">
          טיפול חכם — אדמין
        </Link>
        <NavLinks />
        <div className="mt-auto pt-6">
          <Link href="/" className="block px-3 text-xs text-stone-400 hover:text-stone-600">
            חזרה לאתר ←
          </Link>
        </div>
      </aside>

      {/* Mobile top bar + slide-over. */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-stone-200 bg-white px-4 py-2.5 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="תפריט"
          className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-bold text-stone-600"
        >
          ☰ תפריט
        </button>
        <Link href="/admin" className="text-sm font-black text-stone-800">
          טיפול חכם — אדמין
        </Link>
      </div>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" dir="rtl">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 right-0 w-64 overflow-y-auto bg-white px-3 py-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between px-3">
              <span className="text-sm font-black text-stone-800">טיפול חכם — אדמין</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="סגירה"
                className="rounded-full px-2 py-0.5 text-stone-400"
              >
                ✕
              </button>
            </div>
            <NavLinks onNavigate={() => setMobileOpen(false)} />
            <div className="mt-6">
              <Link href="/" className="block px-3 text-xs text-stone-400">
                חזרה לאתר ←
              </Link>
            </div>
          </aside>
        </div>
      )}

      {/* Content — padded past the fixed sidebar on desktop. */}
      <div className="lg:ps-52">{children}</div>
    </div>
  );
}
