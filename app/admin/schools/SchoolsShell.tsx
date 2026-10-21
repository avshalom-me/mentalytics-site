"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

// המעטפת של ה-CRM המשותף של ענף בתי הספר: תפריט צד עם מסכי הענף, זהה אצל
// הבעלים (/admin/schools, נכנס מהאדמין הראשי) ואצל השותפה (/partner/schools).
// לבעלים נוספים "שותפות הענף" וחזרה ל-CRM הראשי; לשותפה, השם שלה ויציאה.
// בטלפון התפריט נפתח מכפתור, כמו באדמין.

type Item = { path: string; label: string; icon: string };
const ITEMS: Item[] = [
  { path: "/overview", label: "מבט על", icon: "📊" },
  { path: "/pipeline", label: "צינור", icon: "📋" },
  { path: "", label: "בתי ספר", icon: "🏫" },
  { path: "/owners", label: "בעלויות", icon: "🏛️" },
  { path: "/payments", label: "רישיונות ותשלומים", icon: "💳" },
  { path: "/tasks", label: "משימות", icon: "✅" },
];
const OWNER_ITEMS: Item[] = [{ path: "/partners", label: "שותפות הענף", icon: "🔑" }];

export default function SchoolsShell({
  mode,
  userName,
  onSignOut,
  children,
}: {
  mode: "admin" | "partner";
  userName?: string;
  onSignOut?: () => void;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const base = mode === "admin" ? "/admin/schools" : "/partner/schools";
  // המגירה בטלפון נסגרת בלחיצה על קישור, לא מתוך effect על הנתיב.
  const [open, setOpen] = useState(false);

  const items = mode === "admin" ? [...ITEMS, ...OWNER_ITEMS] : ITEMS;
  const named = items.filter((i) => i.path).map((i) => base + i.path);
  // "בתי ספר" דולק ברשימה ובעמוד של בית ספר, לא בשאר מסכי הענף.
  const active = (i: Item) => {
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

  const title = (
    <div className="px-3">
      <div className="text-sm font-black text-stone-900">CRM בתי ספר</div>
      <div className="text-xs text-stone-500">ענף שאלון היועצות, משותף</div>
    </div>
  );

  const footer = (
    <div className="space-y-2 px-3 text-xs">
      {mode === "admin" ? (
        <Link href="/admin" className="block font-bold text-[#2A6462] hover:underline">
          ← ל-CRM הראשי של טיפול חכם
        </Link>
      ) : (
        <>
          {userName ? <div className="text-stone-500">{userName}</div> : null}
          <button type="button" onClick={onSignOut} className="font-bold text-[#2A6462] underline">
            יציאה
          </button>
        </>
      )}
    </div>
  );

  return (
    <div dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <aside className="fixed inset-y-0 right-0 z-40 hidden w-52 flex-col gap-5 overflow-y-auto border-e border-stone-200 bg-white py-4 ps-3 pe-3 lg:flex">
        {title}
        {nav}
        <div className="mt-auto">{footer}</div>
      </aside>

      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-stone-200 bg-white px-4 py-2.5 lg:hidden">
        <button type="button" onClick={() => setOpen(true)} aria-label="תפריט" className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-bold text-stone-600">
          ☰ תפריט
        </button>
        <span className="text-sm font-black text-stone-800">CRM בתי ספר</span>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 right-0 flex w-64 flex-col gap-5 overflow-y-auto bg-white px-3 py-4 shadow-2xl">
            <div className="flex items-start justify-between">
              {title}
              <button type="button" onClick={() => setOpen(false)} aria-label="סגירה" className="rounded-full px-2 py-0.5 text-stone-400">
                ✕
              </button>
            </div>
            {nav}
            {footer}
          </aside>
        </div>
      )}

      <div className="min-h-screen bg-stone-50 lg:ps-52">{children}</div>
    </div>
  );
}
