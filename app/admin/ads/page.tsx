"use client";

import { useEffect, useState } from "react";

type Tier = "paid" | "gift" | "free";
type Therapist = { tier: Tier; full_name: string; regions: string[]; types: string[]; online: boolean };
type RegionRow = { region: string; slug: string; paid: number; gift: number; free: number; sw: boolean };
type Data = {
  counts: { paid: number; gift: number; free: number };
  online: { paid: number; gift: number; free: number };
  onlineSlug: string;
  byRegion: RegionRow[];
  therapists: Therapist[];
  generated_at: string;
};

const SITE = "https://www.mentalytics.co.il";

// Static recommendation templates (my advice, applied to the live data).
const NEGATIVE_KEYWORDS = ["חינם", "קופת חולים", 'קופ"ח', "דרושים", "משרות", "עבודה", "לימודים", "תואר", "קורס", "פסיכומטרי", "מבחן פסיכולוגי"];
const ONLINE_KEYWORDS = ["פסיכולוג אונליין", "טיפול פסיכולוגי אונליין", "פסיכותרפיה אונליין", "פסיכולוג בזום", "טיפול נפשי אונליין"];

function keywordsFor(region: string, sw: boolean): string[] {
  const k = [`פסיכולוג ${region}`, `פסיכולוג קליני ${region}`, `טיפול פסיכולוגי ${region}`, `פסיכותרפיה ${region}`, `מטפל ${region}`];
  if (sw) k.push(`עובד סוציאלי קליני ${region}`);
  return k;
}

const TIER_LABEL: Record<Tier, string> = { paid: "💳 מקודמים בתשלום", gift: "🎁 מקודמים במתנה", free: "⚪ חינמיים" };

function CopyBtn({ text, label = "העתק" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() =>
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        })
      }
      className="whitespace-nowrap rounded-md border border-stone-300 bg-white px-2.5 py-0.5 text-xs font-semibold text-stone-600 hover:bg-stone-50"
    >
      {done ? "✓ הועתק" : label}
    </button>
  );
}

function prio(paid: number, gift: number) {
  if (paid > 0) return <span className="font-bold text-green-700">🟢 גבוהה</span>;
  if (gift > 0) return <span className="font-semibold text-amber-600">🟡 שנייה</span>;
  return <span className="text-stone-400">⚪ נמוכה</span>;
}

export default function AdsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin-ads")
      .then((r) => r.json())
      .then((j) => (j.ok ? setData(j) : setError(j.error || "שגיאה")))
      .catch(() => setError("שגיאה בטעינה"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-stone-50" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-2xl font-black text-stone-900 mb-1">פרסום ממומן — המקודמים והמלצות</h1>
        <p className="text-sm text-stone-500 mb-6">
          איפה לפרסם, אילו מילים, ואילו קישורים — מחושב אוטומטית לפי המקודמים <strong>בתשלום</strong> שלך. המטרה: להזרים מטופלים קודם למשלמים. מתעדכן לבד כשהמקודמים משתנים.
        </p>

        {loading && <p className="text-sm text-stone-400">טוען…</p>}
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {data && !loading && <AdsContent data={data} />}
      </div>
    </div>
  );
}

function AdsContent({ data }: { data: Data }) {
  const priority = data.byRegion.filter((r) => r.paid > 0);
  const onlineUrl = `${SITE}/therapists/region/${data.onlineSlug}?utm_source=google&utm_medium=cpc&utm_campaign=g-online`;

  return (
    <>
      {/* Counts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label="מקודמים בתשלום 💳" value={data.counts.paid} accent="#3D8C8A" />
        <Stat label="מקודמים במתנה 🎁" value={data.counts.gift} accent="#D49018" />
        <Stat label="חינמיים ⚪" value={data.counts.free} accent="#78716c" />
        <Stat label="משלמים באונליין 🌐" value={data.online.paid} accent="#3D8C8A" />
      </div>

      {/* Priority recommendation */}
      <div className="rounded-2xl border p-5 mb-6" style={{ borderColor: "#C2DFDE", background: "#EAF4F3" }}>
        <h2 className="text-base font-black mb-2" style={{ color: "#1a5c46" }}>📣 המלצת פתיחה</h2>
        <p className="text-sm leading-7" style={{ color: "#1a4a44" }}>
          פרסם קודם איפה שיש <strong>מקודמים בתשלום</strong> — שם הפרסום מזרים הכנסה. לפי הנתונים כרגע התחל ב:{" "}
          <strong>
            {data.online.paid > 0 ? `אונליין (${data.online.paid} משלמים) · ` : ""}
            {priority.slice(0, 4).map((r) => `${r.region} (${r.paid})`).join(" · ") || "—"}
          </strong>
          . אזורים עם מתנה בלבד — עדיפות שנייה. אזורים בלי מקודמים בתשלום — <strong>לא לפרסם</strong> (המטופל ינחת על כמעט-ריק).
        </p>
      </div>

      {/* Geography */}
      <Card title="גיאוגרפיה — איפה לפרסם">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-stone-500 text-xs border-b border-stone-200">
              <th className="text-right font-semibold py-2 px-2">אזור</th>
              <th className="text-center font-semibold py-2 px-2">💳 בתשלום</th>
              <th className="text-center font-semibold py-2 px-2">🎁 מתנה</th>
              <th className="text-center font-semibold py-2 px-2">⚪ חינמי</th>
              <th className="text-center font-semibold py-2 px-2">עדיפות</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-stone-100" style={{ background: "#F3FAF9" }}>
              <td className="py-2.5 px-2 font-bold text-stone-800">🌐 אונליין (כל הארץ)</td>
              <td className="text-center px-2 font-bold text-stone-900">{data.online.paid || "—"}</td>
              <td className="text-center px-2 text-stone-600">{data.online.gift || "—"}</td>
              <td className="text-center px-2 text-stone-400">{data.online.free || "—"}</td>
              <td className="text-center px-2">{prio(data.online.paid, data.online.gift)}</td>
            </tr>
            {data.byRegion.map((r) => (
              <tr key={r.region} className="border-b border-stone-100">
                <td className="py-2.5 px-2 font-semibold text-stone-700">{r.region}</td>
                <td className="text-center px-2 font-bold text-stone-900">{r.paid || "—"}</td>
                <td className="text-center px-2 text-stone-600">{r.gift || "—"}</td>
                <td className="text-center px-2 text-stone-400">{r.free || "—"}</td>
                <td className="text-center px-2">{prio(r.paid, r.gift)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Keywords + tagged URLs */}
      <Card title="מילות מפתח + קישורים מתויגים (מוכן להעתקה)">
        <p className="text-xs text-stone-500 mb-4">
          לכל אזור עם מקודם בתשלום — קמפיין מומלץ. השתמש ב-<strong>Phrase / Exact match</strong> (לא Broad). הקישור המתויג נוחת על העמוד המתאים, מזין משלמים ראשונים, ונמדד ב-
          <span dir="ltr"> /admin/attribution</span>.
        </p>
        <div className="space-y-4">
          {data.online.paid > 0 && (
            <KeywordCard title="🌐 אונליין (כל הארץ)" keywords={ONLINE_KEYWORDS} url={onlineUrl} />
          )}
          {priority.map((r) => (
            <KeywordCard
              key={r.region}
              title={r.region}
              keywords={keywordsFor(r.region, r.sw)}
              url={`${SITE}/therapists/city/${r.slug}?utm_source=google&utm_medium=cpc&utm_campaign=g-${r.slug}`}
            />
          ))}
        </div>
        {priority.length === 0 && data.online.paid === 0 && (
          <p className="text-sm text-stone-400">אין כרגע מקודמים בתשלום — קדם מטפל כדי לקבל המלצות פרסום.</p>
        )}
      </Card>

      {/* Negative keywords */}
      <Card title="🚫 מילים שליליות — להוסיף בכל קמפיין (חוסך תקציב)">
        <div className="flex flex-wrap gap-2 mb-3">
          {NEGATIVE_KEYWORDS.map((k) => (
            <span key={k} className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs text-red-700">{k}</span>
          ))}
        </div>
        <CopyBtn text={NEGATIVE_KEYWORDS.join("\n")} label="העתק הכל" />
      </Card>

      {/* Setup tips */}
      <Card title="💡 טיפים להקמה (לפי ההמלצות)">
        <ul className="list-disc space-y-2 pr-5 text-sm leading-6 text-stone-700">
          <li><strong>תקציב ₪2,000/חודש:</strong> ~₪500 לבדיקה בשבועיים הראשונים, ואז ~₪1,500 על הקמפיין / המילים שהמירו.</li>
          <li><strong>יעד קמפיין:</strong> Traffic / Link Clicks — <strong>לא</strong> &quot;קידום פוסט&quot;.</li>
          <li><strong>סוג התאמה:</strong> Phrase או Exact — לא Broad (מבזבז תקציב).</li>
          <li><strong>מעקב המרות:</strong> להגדיר Conversion (GA4 → ייבוא לגוגל) כדי שגוגל יְמַטֵּב להמרות, לא רק לקליקים.</li>
          <li><strong>אל תשפוט מוקדם:</strong> לגוגל &quot;שלב למידה&quot; של ~שבועיים.</li>
        </ul>
      </Card>

      {/* Therapist tables */}
      <TierTable tier="paid" therapists={data.therapists.filter((t) => t.tier === "paid")} />
      <TierTable tier="gift" therapists={data.therapists.filter((t) => t.tier === "gift")} />
      <TierTable tier="free" therapists={data.therapists.filter((t) => t.tier === "free")} defaultOpen={false} />

      <p className="text-xs text-stone-400 mt-4">עודכן: {new Date(data.generated_at).toLocaleString("he-IL")}</p>
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 text-center">
      <div className="text-3xl font-black" style={{ color: accent }}>{value.toLocaleString("he-IL")}</div>
      <div className="text-xs font-semibold text-stone-500 mt-1">{label}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 mb-6 overflow-x-auto">
      <h2 className="text-base font-black text-stone-800 mb-4">{title}</h2>
      {children}
    </div>
  );
}

function KeywordCard({ title, keywords, url }: { title: string; keywords: string[]; url: string }) {
  return (
    <div className="rounded-xl border border-stone-200 p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="font-black text-stone-800">{title}</h3>
        <CopyBtn text={keywords.join("\n")} label="העתק מילים" />
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        {keywords.map((k) => (
          <span key={k} className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-xs text-teal-800">{k}</span>
        ))}
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
        <code className="flex-1 truncate text-xs text-stone-600" dir="ltr">{url}</code>
        <CopyBtn text={url} label="העתק קישור" />
      </div>
    </div>
  );
}

function TierTable({ tier, therapists, defaultOpen = true }: { tier: Tier; therapists: Therapist[]; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="rounded-2xl border border-stone-200 bg-white p-5 mb-4">
      <summary className="cursor-pointer text-base font-black text-stone-800">
        {TIER_LABEL[tier]} — {therapists.length} מטפלים
      </summary>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-stone-500 text-xs border-b border-stone-200">
              <th className="text-right font-semibold py-2 px-2">שם</th>
              <th className="text-right font-semibold py-2 px-2">אזורים</th>
              <th className="text-right font-semibold py-2 px-2">סוג</th>
              <th className="text-center font-semibold py-2 px-2">אונליין</th>
            </tr>
          </thead>
          <tbody>
            {therapists.map((t, i) => (
              <tr key={`${t.full_name}-${i}`} className="border-b border-stone-100">
                <td className="py-2 px-2 font-semibold text-stone-700">{t.full_name}</td>
                <td className="py-2 px-2 text-stone-600">{t.regions.length ? t.regions.join(", ") : "—"}</td>
                <td className="py-2 px-2 text-stone-600">{t.types.length ? t.types.join(", ") : "—"}</td>
                <td className="py-2 px-2 text-center">{t.online ? "✓" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
