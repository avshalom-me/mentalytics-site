"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";

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
            תקנון הרכישה
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

export function UpgradeToPromotedButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleUpgrade() {
    setLoading(true);
    setError("");

    try {
      const { createClient } = await import("@supabase/supabase-js");
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data: { session } } = await sb.auth.getSession();

      if (!session) {
        setError("יש להתחבר תחילה");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/payments/create-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error === "already subscribed" ? "כבר יש לך מנוי פעיל" : "שגיאה ביצירת תשלום");
        setLoading(false);
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("שגיאה בלתי צפויה");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleUpgrade}
        disabled={loading}
        className="w-full rounded-xl px-6 py-3 text-sm font-bold text-white transition hover:opacity-95 disabled:opacity-50"
        style={{ background: "linear-gradient(135deg,#0F5468,#1A7A96)", boxShadow: "0 4px 12px rgba(15,84,104,.25)" }}
      >
        {loading ? (
          <Loader2 size={16} className="inline animate-spin" />
        ) : (
          <>
            שדרוג למסלול המקודם — ₪120/חודש
            <ArrowLeft size={16} className="inline mr-2" />
          </>
        )}
      </button>
      {error && <p className="text-xs text-red-600 text-center">{error}</p>}
    </div>
  );
}
