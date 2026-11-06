"use client";

import Link from "next/link";
import BranchShell, { type BranchItem } from "../components/BranchShell";

// תפריט הצד של ענף לימוד חכם. "מורים" הוא הפריט הריק (הרשימה ועמוד המורה).
const ITEMS: BranchItem[] = [
  { path: "/overview", label: "מבט על", icon: "📊" },
  { path: "", label: "מורים", icon: "🎓" },
  { path: "/recruitment", label: "גיוס", icon: "🧲" },
  { path: "/demand", label: "ביקוש", icon: "🔎" },
  { path: "/emails", label: "מיילים", icon: "✉️" },
];

export default function LearningShell({ children }: { children: React.ReactNode }) {
  const footer = (
    <div className="space-y-2 px-3 text-xs">
      <a href="/learning" target="_blank" rel="noopener noreferrer" className="block text-stone-400 hover:underline">
        הדלת הציבורית ↗
      </a>
      <Link href="/admin" className="block font-bold text-[#2A6462] hover:underline">
        ← ל-CRM הראשי של טיפול חכם
      </Link>
    </div>
  );
  return (
    <BranchShell base="/admin/learning" title="לימוד חכם" subtitle="ענף המורים, מבית טיפול חכם" items={ITEMS} footer={footer}>
      {children}
    </BranchShell>
  );
}
