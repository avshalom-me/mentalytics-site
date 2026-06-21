"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Grouped into 3 categories so the bar reads as clusters, not a wall of tabs.
const NAV_GROUPS: { label: string; items: { href: string; label: string; icon: string }[] }[] = [
  {
    label: "ניהול",
    items: [
      { href: "/admin/therapists", label: "מטפלים", icon: "👥" },
      { href: "/admin/articles", label: "מאמרים", icon: "📝" },
      { href: "/admin/recommendations", label: "המלצות", icon: "💡" },
    ],
  },
  {
    label: "אנליטיקה",
    items: [
      { href: "/admin/analytics", label: "אנליטיקס", icon: "📈" },
      { href: "/admin/stats", label: "לחיצות", icon: "📊" },
      { href: "/admin/supply-demand", label: "היצע/ביקוש", icon: "⚖️" },
      { href: "/admin/attribution", label: "מקורות לידים", icon: "🎯" },
    ],
  },
  {
    label: "דוחות",
    items: [
      { href: "/admin/weekly-reports", label: "דוח שבועי", icon: "📬" },
      { href: "/admin/monthly-reports", label: "דוח חודשי", icon: "🗓️" },
    ],
  },
];

function AdminNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + "/");

  return (
    <nav className="border-b border-stone-200 bg-white sticky top-0 z-40" dir="rtl"
      style={{ fontFamily: "'Heebo', sans-serif" }}>
      <div className="mx-auto max-w-6xl px-6 flex items-end justify-between gap-4 min-h-16 py-2">
        <div className="flex items-end gap-4 flex-wrap">
          <span className="text-sm font-black text-stone-800 mb-1.5">טיפול חכם — אדמין</span>
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.label} className="flex items-end gap-4">
              {gi > 0 && <div className="self-stretch w-px bg-stone-200" />}
              <div>
                <div className="text-[11px] font-semibold text-stone-400 mb-1 pr-1">{group.label}</div>
                <div className="flex rounded-lg border border-stone-200 overflow-hidden">
                  {group.items.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        // Inline color overrides the global `a { color: inherit }` rule
                        // (unlayered CSS beats Tailwind's layered text utilities).
                        style={{ color: active ? "#ffffff" : "#78716c" }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold transition-colors ${
                          active
                            ? "bg-stone-800 text-white"
                            : "bg-white text-stone-500 hover:bg-stone-50 hover:text-stone-700"
                        }`}
                      >
                        <span className="text-xs">{item.icon}</span>
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
        <Link href="/" className="text-xs text-stone-400 hover:text-stone-600 whitespace-nowrap mb-1.5">
          חזרה לאתר →
        </Link>
      </div>
    </nav>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');`}</style>
      <AdminNav />
      {children}
    </>
  );
}
