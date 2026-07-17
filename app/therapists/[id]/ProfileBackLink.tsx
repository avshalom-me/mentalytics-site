"use client";

import Link from "next/link";

// Back link on the therapist profile. When the visitor arrived from the
// matching results (source="match"), "back" should return them to that exact
// results list — which lives as in-page state on /adults|/kids, not a URL.
// So we use the browser's history back (restored from bfcache), with a sane
// fallback to the relevant quiz when there's no history to go back to (e.g. a
// shared/deep link).
export default function ProfileBackLink({
  source,
  fallbackHref,
}: {
  source: "match" | "directory";
  fallbackHref: string;
}) {
  const cls = "text-sm text-stone-500 hover:underline mb-6 inline-block";

  if (source !== "match") {
    // Returns to the exact listing the visitor came from (region / city /
    // online / center), or /therapists as a fallback. A real link — works
    // without JS and is crawlable.
    return <Link href={fallbackHref} className={cls}>← חזרה לרשימה</Link>;
  }

  return (
    <button
      type="button"
      className={cls}
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          window.history.back();
        } else {
          window.location.href = fallbackHref;
        }
      }}
    >
      ← חזרה לתוצאות ההתאמה
    </button>
  );
}
