"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin/therapists", label: "מטפלים", icon: "👥" },
  { href: "/admin/stats",      label: "לחיצות", icon: "📊" },
  { href: "/admin/analytics",  label: "אנליטיקס", icon: "📈" },
];

function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-stone-200 bg-white sticky top-0 z-40" dir="rtl"
      style={{ fontFamily: "'Heebo', sans-serif" }}>
      <div className="mx-auto max-w-6xl px-6 flex items-center justify-between h-14">
        <div className="flex items-center gap-1">
          <span className="text-sm font-black text-stone-800 ml-4">טיפול חכם — אדמין</span>
          <div className="flex rounded-lg border border-stone-200 overflow-hidden">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold transition-colors ${
                    isActive
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
        <Link href="/" className="text-xs text-stone-400 hover:text-stone-600">
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
