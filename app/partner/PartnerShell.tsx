"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";

// המעטפת של פורטל השותפה: בודקת שיש סשן ושהמשתמשת רשומה כשותפה פעילה, ומציגה
// תפריט עליון של מסכי הענף. המסכים עצמם הם המסכים של האדמין
// (app/admin/schools/*), שמנתבים את הקריאות שלהם לנתיבי הפורטל כשהם רצים כאן.
// עמוד הכניסה עובר בלי בדיקה.

type Me = { name: string; email: string };
type Check = { state: "ok"; me: Me } | { state: "denied" } | { state: "signed_out" };

async function checkPartner(): Promise<Check> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { state: "signed_out" };
  try {
    const r = await fetch("/api/partner-schools/me", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const j = await r.json().catch(() => null);
    if (r.ok && j?.ok) return { state: "ok", me: { name: j.name, email: j.email } };
    return { state: "denied" };
  } catch {
    return { state: "denied" };
  }
}

const NAV = [
  { href: "/partner/schools/pipeline", label: "צינור" },
  { href: "/partner/schools", label: "בתי ספר" },
  { href: "/partner/schools/owners", label: "בעלויות" },
  { href: "/partner/schools/payments", label: "רישיונות ותשלומים" },
  { href: "/partner/tasks", label: "משימות" },
];

export default function PartnerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const isLogin = pathname.startsWith("/partner/login");
  const [check, setCheck] = useState<Check | null>(null);

  useEffect(() => {
    if (isLogin) return;
    let cancelled = false;
    checkPartner().then((c) => {
      if (cancelled) return;
      if (c.state === "signed_out") window.location.href = "/partner/login";
      else setCheck(c);
    });
    return () => {
      cancelled = true;
    };
  }, [isLogin]);

  if (isLogin) return <>{children}</>;
  if (!check || check.state === "signed_out") return <div dir="rtl" className="p-8 text-sm text-stone-500">טוען...</div>;

  if (check.state === "denied") {
    return (
      <main dir="rtl" className="mx-auto max-w-md px-5 py-16">
        <h1 className="text-2xl font-black text-stone-900">אין גישה לפורטל</h1>
        <p className="mt-3 leading-7 text-stone-600">החשבון הזה אינו רשום כשותפה פעילה של ענף בתי הספר. אם זו טעות, פונים לאבשלום.</p>
        <button
          type="button"
          onClick={async () => {
            await supabase.auth.signOut().catch(() => {});
            window.location.href = "/partner/login";
          }}
          className="mt-6 rounded-full border border-stone-300 px-5 py-2 text-sm font-bold text-stone-700"
        >
          יציאה
        </button>
      </main>
    );
  }

  const active = (href: string) =>
    href === "/partner/schools"
      ? pathname === href || (/^\/partner\/schools\/[^/]+$/.test(pathname) && !NAV.some((n) => n.href === pathname))
      : pathname === href || pathname.startsWith(href + "/");

  return (
    <div dir="rtl" className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <div className="text-base font-black text-stone-900">בתי ספר | טיפול חכם</div>
          <nav className="flex flex-wrap gap-1.5">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-full px-3 py-1.5 text-sm font-bold ${active(n.href) ? "bg-[#3D8C8A] text-white" : "text-stone-600 hover:bg-stone-100"}`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-3 text-sm text-stone-500">
            <span>{check.me.name}</span>
            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut().catch(() => {});
                window.location.href = "/partner/login";
              }}
              className="font-bold text-[#2A6462] underline"
            >
              יציאה
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl">{children}</div>
    </div>
  );
}
