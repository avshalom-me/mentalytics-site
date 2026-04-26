"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function PromotedSignupButton() {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="mt-6 space-y-3">
      <label className="flex items-start gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={e => setAgreed(e.target.checked)}
          className="mt-1 h-4 w-4 flex-shrink-0 accent-[#0F5468]"
        />
        <span className="text-xs leading-5 text-[#1a4a5c]">
          בלחיצה על הרשמה אני מאשר/ת את{" "}
          <Link href="/billing-policy" target="_blank" className="underline font-bold hover:text-[#0F5468]">
            תנאי החיוב וההחזרים
          </Link>
        </span>
      </label>

      {agreed ? (
        <Link
          href="/therapists/login?mode=register&plan=promoted"
          className="block w-full text-center rounded-xl px-6 py-3 text-sm font-bold text-white transition hover:opacity-95"
          style={{ background: "linear-gradient(135deg,#0F5468,#1A7A96)", boxShadow: "0 4px 12px rgba(15,84,104,.25)" }}
        >
          הרשמה + תשלום למסלול המקודם
          <ArrowLeft size={16} className="inline mr-2" />
        </Link>
      ) : (
        <span
          className="block w-full text-center rounded-xl px-6 py-3 text-sm font-bold text-white/50 cursor-not-allowed"
          style={{ background: "linear-gradient(135deg,#0F5468,#1A7A96)", opacity: 0.5 }}
        >
          הרשמה + תשלום למסלול המקודם
          <ArrowLeft size={16} className="inline mr-2" />
        </span>
      )}
    </div>
  );
}
