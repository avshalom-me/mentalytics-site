"use client";

import { useState } from "react";
import Link from "next/link";
import { FAQS } from "./faqs";
import { ResearchBreadcrumbLd } from "@/app/components/ResearchBreadcrumbLd";

export default function FAQPage() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <main className="mx-auto max-w-3xl px-5 py-12 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <ResearchBreadcrumbLd slug="faq" title="שאלות נפוצות" />

      <Link href="/research" className="text-sm text-stone-500 hover:underline mb-6 inline-block">← חזרה למאמרים ומידע שימושי</Link>

      <h1 className="text-3xl font-black text-stone-900 mb-3">שאלות נפוצות</h1>
      <p className="text-stone-600 leading-7 mb-10">
        תשובות לשאלות שעולות לפני, במהלך ואחרי הטיפול.
      </p>

      <div className="space-y-3">
        {FAQS.map((item, idx) => (
          <div
            key={idx}
            className="rounded-2xl bg-white border border-[#EAE0D5] overflow-hidden"
            style={{ boxShadow: "0 2px 8px rgba(100,60,30,.05)" }}
          >
            <button
              className="w-full flex items-center justify-between gap-4 px-5 py-4 text-right font-bold text-stone-900 hover:bg-stone-50 transition"
              onClick={() => setOpen(open === idx ? null : idx)}
            >
              <span>{item.q}</span>
              <span
                className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-lg transition-transform"
                style={{
                  background: "#F4E8DC",
                  color: "#8B2E0A",
                  transform: open === idx ? "rotate(45deg)" : "rotate(0deg)",
                  fontWeight: 300,
                }}
              >
                +
              </span>
            </button>
            {open === idx && (
              <div className="px-5 pb-5 pt-1 border-t border-[#EAE0D5]">
                <p className="leading-7 text-stone-700 text-sm">{item.a}</p>
                {item.link && (
                  <Link href={item.link} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#0F5468] hover:underline">
                    {item.linkLabel} →
                  </Link>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-2xl border border-[#E8E0D8] bg-[#f8f5f0] p-6">
        <h2 className="mb-4 text-base font-extrabold text-stone-800">קריאה נוספת</h2>
        <ul className="space-y-2 text-sm">
          <li><Link href="/research/which-therapy" className="text-[#2e7d8c] hover:underline">← איזה טיפול פסיכולוגי מתאים לי?</Link></li>
          <li><Link href="/research/therapist-types" className="text-[#2e7d8c] hover:underline">← סוגי המטפלים בישראל</Link></li>
          <li><Link href="/research/choosing-therapist" className="text-[#2e7d8c] hover:underline">← מה חשוב לבדוק כשבוחרים מטפל?</Link></li>
          <li><Link href="/research/online-therapy" className="text-[#2e7d8c] hover:underline">← טיפול אונליין - כן או לא?</Link></li>
        </ul>
      </div>
    </main>
  );
}
