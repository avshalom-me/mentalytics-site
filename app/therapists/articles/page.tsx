"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabaseClient";
import { ARTICLE_LIMITS, ARTICLE_TOPICS } from "@/app/lib/articles";

type MyArticle = {
  id: string;
  title: string;
  slug: string;
  topic: string | null;
  summary: string;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  created_at: string;
  approved_at: string | null;
};

const STATUS_BADGE: Record<MyArticle["status"], { text: string; cls: string }> = {
  pending: { text: "ממתין לאישור", cls: "bg-yellow-100 text-yellow-800" },
  approved: { text: "פורסם", cls: "bg-green-100 text-green-800" },
  rejected: { text: "נדחה", cls: "bg-red-100 text-red-700" },
};

export default function TherapistArticlesPage() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [canSubmit, setCanSubmit] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [articles, setArticles] = useState<MyArticle[]>([]);

  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function refresh(tok: string) {
    const res = await fetch("/api/therapists/articles", {
      headers: { Authorization: `Bearer ${tok}` },
    });
    const json = await res.json();
    if (json.ok) {
      setArticles(json.articles ?? []);
      setCanSubmit(Boolean(json.canSubmit));
      setStatus(json.status ?? "");
    }
  }

  useEffect(() => {
    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/therapists/login";
        return;
      }
      setToken(session.access_token);
      await refresh(session.access_token);
      setLoading(false);
    }
    init();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    setErr("");

    // Fresh token at submit — the one captured at load may have expired during
    // a long edit (Supabase JWTs last ~1h), which would surface as "Unauthorized".
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    if (!accessToken) {
      setErr("פג תוקף החיבור. רענן/י את העמוד והתחבר/י מחדש.");
      setSaving(false);
      return;
    }
    setToken(accessToken);

    const res = await fetch("/api/therapists/articles", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ title, topic, summary, body }),
    });
    const json = await res.json();
    if (!json.ok) {
      setErr(json.error === "Unauthorized" ? "פג תוקף החיבור. רענן/י את העמוד והתחבר/י מחדש." : (json.error ?? "שגיאה בשליחה"));
      setSaving(false);
      return;
    }
    setMsg("המאמר נשלח לאישור! נעדכן אותך כשהוא יפורסם.");
    setTitle("");
    setTopic("");
    setSummary("");
    setBody("");
    await refresh(accessToken);
    setSaving(false);
  }

  if (loading) return <div className="p-10 text-center">טוען...</div>;

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');`}</style>

      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-black text-stone-900">המאמרים שלי</h1>
        <Link href="/therapists/dashboard" className="text-xs text-stone-500 underline hover:text-stone-700">
          ← ללוח הבקרה
        </Link>
      </div>
      <p className="text-sm text-stone-600 leading-6 mb-8">
        כתיבת מידע מקצועי קצר מגבירה מאוד את הפנייה אליך. זה לא חייב להיות מאמר מדעי — מספיק מידע פשוט וברור שיעזור
        למטופלים פוטנציאליים להכיר אותך דרך הכתיבה. כל מאמר מאושר מתפרסם במאגר המאמרים של האתר עם שמך וקישור לפרופיל.
      </p>

      {!canSubmit ? (
        <div className="mb-8 rounded-2xl bg-yellow-50 border border-yellow-200 px-5 py-4 text-sm text-yellow-800 leading-6">
          {status === "pending"
            ? "הפרופיל שלך עדיין ממתין לאישור. ברגע שהוא יאושר תוכל/י לשלוח מאמרים."
            : "כדי לשלוח מאמרים דרוש פרופיל מאושר באתר."}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mb-10 rounded-2xl border border-[#E8E0D8] bg-white p-6 space-y-4">
          <h2 className="text-lg font-extrabold text-stone-900">מאמר חדש</h2>

          <div>
            <label className="mb-1 block text-sm font-semibold text-stone-700">כותרת *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={ARTICLE_LIMITS.titleMax}
              placeholder="לדוגמה: 3 דברים שכדאי לדעת לפני שמתחילים טיפול בחרדה"
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#2e7d8c]"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-stone-700">נושא</label>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#2e7d8c]"
            >
              <option value="">בחר/י נושא (רשות)</option>
              {ARTICLE_TOPICS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-stone-700">
              תקציר קצר <span className="text-stone-400 font-normal">(רשות — מוצג בכרטיס המאמר)</span>
            </label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={2}
              maxLength={ARTICLE_LIMITS.summaryMax}
              placeholder="משפט או שניים שמתארים על מה המאמר"
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#2e7d8c]"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-stone-700">גוף המאמר *</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={12}
              maxLength={ARTICLE_LIMITS.bodyMax}
              placeholder="כתבו בחופשיות. שורה ריקה = פסקה חדשה. לכותרת משנה התחילו שורה ב-##, ולקישור השתמשו ב-[טקסט](כתובת)."
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm leading-7 outline-none focus:border-[#2e7d8c]"
            />
            <p className="mt-1 text-xs text-stone-400">
              {body.length} תווים (מינימום {ARTICLE_LIMITS.bodyMin}) · עיצוב: <code>## כותרת</code>, <code>[טקסט](כתובת)</code> לקישור, <code>**מודגש**</code>, <code>-</code> לרשימה
            </p>
          </div>

          {msg && <p className="text-sm text-emerald-600 font-semibold">{msg}</p>}
          {err && <p className="text-sm text-red-600">{err}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-[#2e7d8c] py-3 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "שולח..." : "שליחה לאישור"}
          </button>
        </form>
      )}

      <h2 className="text-lg font-extrabold text-stone-900 mb-3">ההגשות שלי</h2>
      {articles.length === 0 ? (
        <p className="text-sm text-stone-400">עדיין לא שלחת מאמרים.</p>
      ) : (
        <div className="space-y-3">
          {articles.map((a) => {
            const badge = STATUS_BADGE[a.status];
            return (
              <div key={a.id} className="rounded-2xl border border-[#E8E0D8] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-stone-900">{a.title}</h3>
                    {a.topic && <span className="text-xs text-stone-500">{a.topic}</span>}
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${badge.cls}`}>
                    {badge.text}
                  </span>
                </div>
                {a.status === "approved" && (
                  <Link
                    href={`/research/community/${a.slug}`}
                    className="mt-2 inline-block text-xs font-semibold text-[#2e7d8c] hover:underline"
                  >
                    צפייה במאמר באתר ←
                  </Link>
                )}
                {a.status === "rejected" && a.rejection_reason && (
                  <p className="mt-2 text-xs text-red-600 leading-5">סיבת הדחייה: {a.rejection_reason}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
