"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BranchShell, { type BranchItem } from "../components/BranchShell";
import Reminders from "./Reminders";

// המעטפת של ה-CRM המשותף של ענף בתי הספר: תפריט צד עם מסכי הענף, זהה אצל
// הבעלים (/admin/schools, נכנס מהאדמין הראשי) ואצל השותפה (/partner/schools).
// לבעלים נוספים "שותפות הענף" וחזרה ל-CRM הראשי; לשותפה, השם שלה ויציאה.
// הפריסה עצמה (תפריט קבוע, מגירה בטלפון, מתחת לכותרת האתר) משותפת לכל
// ענף באדמין: app/admin/components/BranchShell.tsx. התזכורות מלוח העבודה קופצות מכאן.

const ITEMS: BranchItem[] = [
  { path: "/overview", label: "מבט על", icon: "📊" },
  { path: "/pipeline", label: "צינור", icon: "📋" },
  { path: "", label: "בתי ספר", icon: "🏫" },
  { path: "/owners", label: "בעלויות", icon: "🏛️" },
  { path: "/payments", label: "רישיונות ותשלומים", icon: "💳" },
  { path: "/tasks", label: "משימות", icon: "✅" },
  { path: "/plan", label: "תוכנית שנתית", icon: "🗓️" },
  { path: "/board", label: "לוח עבודה וקבצים", icon: "📌" },
  { path: "/review", label: "תיקוני השאלון", icon: "🔎" },
];
const OWNER_ITEMS: BranchItem[] = [{ path: "/partners", label: "שותפות הענף", icon: "🔑" }];

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
  const items = mode === "admin" ? [...ITEMS, ...OWNER_ITEMS] : ITEMS;

  // "מצב לפי ההסכם" (שלבי הסולם והשערים) בכוונה כאן, קטן, ולא בתפריט: "זה לא העיקר" (הבעלים, 21/10/2026).
  const footer = (
    <div className="space-y-2 px-3 text-xs">
      <Link href={`${base}/agreement`} className={`block hover:underline ${pathname.startsWith(`${base}/agreement`) ? "font-bold text-stone-700" : "text-stone-400"}`}>
        מצב לפי ההסכם
      </Link>
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
    <BranchShell base={base} title="CRM בתי ספר" subtitle="ענף שאלון היועצות, משותף" items={items} extraNamed={["/agreement"]} footer={footer} after={<Reminders boardHref={`${base}/board`} />}>
      {children}
    </BranchShell>
  );
}
