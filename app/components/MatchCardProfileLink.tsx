"use client";

import { stashMatchContext, type SensitiveMatchContext } from "@/app/lib/match-view-context";

/**
 * "פרופיל מלא ←". הצבע בסגנון מוטבע כי נכתב כשהכלל `a { color: inherit }`
 * ב-globals.css ישב מחוץ לשכבות של Tailwind וגבר על כל מחלקת צבע על קישור.
 * מ-19/9/26 הכלל יושב ב-@layer base, ומחלקת text-* עובדת גם כאן.
 *
 * Client component only for the click: the health-revealing context (which
 * finding and which treatment led here) is handed to the profile through
 * sessionStorage instead of the URL - see app/lib/match-view-context.ts. The
 * href itself must therefore never carry i / t / sy.
 */
export default function MatchCardProfileLink({
  href,
  therapistId,
  context,
}: {
  href: string;
  therapistId?: string;
  context?: SensitiveMatchContext;
}) {
  return (
    <a
      href={href}
      onClick={() => {
        if (therapistId && context) stashMatchContext(therapistId, context);
      }}
      className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-3 py-2 text-[13px] font-bold transition-colors hover:bg-[var(--teal-pale)] sm:px-4"
      style={{ borderColor: "var(--teal-mid)", color: "var(--teal-dark)" }}
    >
      פרופיל מלא ←
    </a>
  );
}
