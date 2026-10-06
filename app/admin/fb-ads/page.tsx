"use client";

import { useEffect, useState } from "react";
import {
  buildFbAdsReport,
  shareOfVisits,
  type FbAdReport,
  type FbAudience,
  type FbFunnelRow,
  type FbRecruitRow,
} from "@/app/lib/fb-ads";

// The Facebook ads, one card each: how many arrived from the ad and what they
// did next. Built for a phone first, because that is where the owner sets the
// ads up: one column, big numbers, and a button that copies the ad's link.
//
// Nothing here talks to Facebook. An ad is recognised by the link pasted into
// it (app/lib/fb-ads.ts), and the numbers come from the two reports the admin
// already has: the campaign funnel and the recruitment campaigns.

type Period = "week" | "month" | "all";

const PERIODS: { value: Period; label: string }[] = [
  { value: "week", label: "7 ימים" },
  { value: "month", label: "30 ימים" },
  { value: "all", label: "מההתחלה" },
];

const SECTIONS: { audience: FbAudience; title: string; arrived: string }[] = [
  { audience: "patients", title: "מטופלים", arrived: "הגיעו לאתר" },
  { audience: "recruit", title: "גיוס מטפלים", arrived: "הגיעו לדף ההצטרפות" },
];

const num = (n: number) => n.toLocaleString("he-IL");

export default function FbAdsPage() {
  const [period, setPeriod] = useState<Period>("month");
  const [ads, setAds] = useState<FbAdReport[] | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    const asJson = (url: string) => fetch(url).then((r) => r.json());
    Promise.all([
      asJson(`/api/admin-campaign-funnel?period=${period}`),
      asJson(`/api/admin-therapist-campaigns?period=${period}`),
    ])
      .then(([funnel, recruit]) => {
        if (cancelled) return;
        // A report that failed must not read as "nobody came": say so instead.
        if (!funnel?.ok || !recruit?.ok) {
          setAds(null);
          setError(funnel?.error || recruit?.error || "שגיאה בטעינת הנתונים");
          return;
        }
        setAds(buildFbAdsReport((funnel.rows ?? []) as FbFunnelRow[], (recruit.campaigns ?? []) as FbRecruitRow[]));
        setUpdatedAt(funnel.generated_at ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setAds(null);
          setError("שגיאה בטעינת הנתונים");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  return (
    <div className="min-h-screen bg-stone-50" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <h1 className="text-2xl font-black text-stone-900">מודעות פייסבוק</h1>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          כמה הגיעו מכל מודעה ומה עשו באתר. כל מודעה מזוהה לפי הקישור שהודבק בה, ולכן הספירה כאן היא של האתר עצמו, בלי
          כניסה לפייסבוק.
        </p>

        <div className="mt-4 inline-flex overflow-hidden rounded-full border border-stone-200 bg-white">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={`px-4 py-2 text-sm font-bold transition-colors ${
                period === p.value ? "bg-stone-800 text-white" : "text-stone-500 hover:bg-stone-50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {loading && <p className="mt-6 text-sm text-stone-400">טוען…</p>}
        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        )}

        {ads &&
          !loading &&
          SECTIONS.map((section) => {
            const rows = ads.filter((a) => a.audience === section.audience);
            return (
              <section key={section.audience} className="mt-8">
                <h2 className="mb-3 text-lg font-black text-stone-800">{section.title}</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {rows.map((ad) => (
                    <AdCard key={ad.campaign} ad={ad} arrived={section.arrived} />
                  ))}
                </div>
              </section>
            );
          })}

        {ads && !loading && (
          <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-4 text-xs leading-6 text-stone-500">
            <p>
              <strong className="text-stone-700">איך קוראים את המספרים:</strong> &quot;הגיעו&quot; הם דפדפנים שונים שנכנסו עם
              הקישור של המודעה, וכל שלב אחריו נספר באנשים ולא בלחיצות. המספר כאן יהיה נמוך במעט ממספר הקליקים שפייסבוק מציג:
              חלק מהגולשים חוסמים מדידה, וחלק לוחצים ועוזבים לפני שהעמוד נטען.
            </p>
            <p className="mt-2">
              מודעה חדשה שלא מופיעה כאן: מספיק ששם הקמפיין בקישור שלה (utm_campaign) יתחיל ב-fb-, והיא תופיע לבד אחרי הכניסה הראשונה.
            </p>
            {updatedAt && <p className="mt-2 text-stone-400">עודכן: {new Date(updatedAt).toLocaleString("he-IL")}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function AdCard({ ad, arrived }: { ad: FbAdReport; arrived: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!ad.link) return;
    try {
      await navigator.clipboard.writeText(ad.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard permission (an old in-app browser): the link stays on screen to be long-pressed.
      setCopied(false);
    }
  };

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <div className="text-base font-black text-stone-900">{ad.label}</div>
      {/* An ad that is not in the list has only its campaign name, already shown as the title. */}
      {ad.label !== ad.campaign && (
        <div className="mt-0.5 text-xs text-stone-400" dir="ltr" style={{ textAlign: "end" }}>
          {ad.campaign}
        </div>
      )}

      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-4xl font-black" style={{ color: "var(--teal, #3D8C8A)" }}>
          {num(ad.visits)}
        </span>
        <span className="text-sm font-semibold text-stone-500">{arrived}</span>
      </div>

      <ul className="mt-4 space-y-2.5">
        {ad.steps.map((step) => {
          const share = shareOfVisits(step.value, ad.visits);
          return (
            <li key={step.label}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-semibold text-stone-700">{step.label}</span>
                {/* Two boxes, not one run of text: side by side the digits read as a single number ("6129%"). */}
                <span className="flex items-baseline gap-2.5">
                  <span className="font-black text-stone-900">{num(step.value)}</span>
                  {share !== null && (
                    <span className="min-w-[2.75rem] text-xs font-semibold text-stone-400" style={{ textAlign: "end" }}>
                      {share}%
                    </span>
                  )}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-100">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, share ?? 0)}%`, background: "var(--gold, #D49018)" }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {ad.link && (
        <div className="mt-5 border-t border-stone-100 pt-4">
          <div className="text-xs font-semibold text-stone-500">הקישור שמדביקים במודעה</div>
          <div
            className="mt-1.5 select-all break-all rounded-xl bg-stone-50 px-3 py-2 text-xs leading-5 text-stone-600"
            dir="ltr"
            style={{ textAlign: "start" }}
          >
            {ad.link}
          </div>
          <button
            type="button"
            onClick={copy}
            className="mt-2.5 rounded-full px-5 py-2 text-sm font-bold text-white transition hover:opacity-90"
            style={{ background: copied ? "var(--teal-dark, #2A6462)" : "var(--teal, #3D8C8A)" }}
          >
            {copied ? "הקישור הועתק" : "העתקת הקישור"}
          </button>
        </div>
      )}
    </div>
  );
}
