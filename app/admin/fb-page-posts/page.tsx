"use client";

import { useEffect, useState } from "react";
import { copyText } from "@/app/lib/fb-page-posts";

// The weekly post on the company's Facebook page, one card per week. Built for a
// phone, because that is where the owner schedules: once a month he copies each
// coming post, schedules it in Meta Business Suite and marks it here. Nothing on
// this page talks to Facebook (app/lib/fb-page-posts.ts says why).

type Post = {
  id: string;
  planned_on: string;
  day: string;
  status: "planned" | "scheduled";
  upcoming: boolean;
  post_text: string;
  link: string | null;
  article: { title: string; slug: string; image_url: string | null; author: string; has_summary: boolean } | null;
  stats: { visits: number; quiz_started: number; viewed_profile: number; contacting: number };
};

type Payload = { ok: boolean; error?: string; slot_time: string; today: string; remaining: number; posts: Post[] };

async function call(body: Record<string, unknown>): Promise<Payload> {
  const r = await fetch("/api/admin-fb-page-posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = (await r.json()) as Payload;
  if (!j.ok) throw new Error(j.error || "שגיאה");
  return j;
}

export default function FbPagePostsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (body: Record<string, unknown>, key: string) => {
    setBusy(key);
    setError("");
    try {
      setData(await call(body));
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setBusy(null);
    }
  };

  // Opening the page fills the coming weeks (a new article for every empty week).
  useEffect(() => {
    void run({ action: "ensure" }, "load");
  }, []);

  const upcoming = data?.posts.filter((p) => p.upcoming) ?? [];
  const past = (data?.posts.filter((p) => !p.upcoming) ?? []).reverse();
  const toSchedule = upcoming.filter((p) => p.status === "planned").length;

  return (
    <div className="min-h-screen bg-stone-50" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <h1 className="text-2xl font-black text-stone-900">פוסטים לעמוד הפייסבוק</h1>

        <div className="mt-3 rounded-2xl border border-stone-200 bg-white p-4 text-sm leading-6 text-stone-700">
          <div className="font-bold text-stone-900">מה לעשות, פעם בחודש</div>
          <ol className="mt-1 list-decimal space-y-0.5 pe-0 ps-5">
            <li>בכל כרטיס שמסומן &quot;לתזמן&quot;: ללחוץ &quot;העתקת הפוסט&quot;.</li>
            <li>בעמוד בפייסבוק: יצירת פוסט, הדבקה, ותזמון ליום ולשעה שבכרטיס.</li>
            <li>כשתצוגת הקישור מופיעה, אפשר למחוק את הכתובת עצמה מהטקסט.</li>
            <li>לחזור לכאן וללחוץ &quot;סימנתי שתוזמן&quot;.</li>
          </ol>
        </div>

        {data && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
            <span className={`rounded-full px-3 py-1 ${toSchedule ? "bg-amber-100 text-amber-800" : "bg-teal-50 text-teal-800"}`}>
              {toSchedule ? `${toSchedule} לתזמן` : "הכול מתוזמן"}
            </span>
            <span className="rounded-full bg-stone-100 px-3 py-1 text-stone-600">
              נשארו {data.remaining} מאמרים שעוד לא שותפו
            </span>
          </div>
        )}

        {busy === "load" && !data && <p className="mt-6 text-sm text-stone-400">טוען…</p>}
        {error && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        {data && (
          <section className="mt-6">
            <h2 className="mb-3 text-lg font-black text-stone-800">הפוסטים הקרובים</h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-stone-500">אין עוד מאמרים לשתף.</p>
            ) : (
              <div className="space-y-4">
                {upcoming.map((p) => (
                  <PostCard key={p.id} post={p} time={data.slot_time} busy={busy} run={run} />
                ))}
              </div>
            )}
          </section>
        )}

        {past.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-black text-stone-800">מה הביאו הפוסטים</h2>
            <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
              {past.map((p) => (
                <div key={p.id} className="p-4 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-bold text-stone-800">{p.article?.title ?? "מאמר שנמחק"}</span>
                    <span className="shrink-0 text-xs text-stone-400">{p.day}</span>
                  </div>
                  <div className="mt-1 text-xs text-stone-500">
                    {p.status === "scheduled" ? "" : "לא סומן כמתוזמן · "}
                    נכנסו {p.stats.visits} · התחילו שאלון {p.stats.quiz_started} · צפו בפרופיל {p.stats.viewed_profile} · פנו למטפל {p.stats.contacting}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function PostCard({
  post,
  time,
  busy,
  run,
}: {
  post: Post;
  time: string;
  busy: string | null;
  run: (body: Record<string, unknown>, key: string) => Promise<void>;
}) {
  const [text, setText] = useState(post.post_text);
  const [copied, setCopied] = useState(false);
  const scheduled = post.status === "scheduled";

  useEffect(() => setText(post.post_text), [post.post_text]);

  const copy = async () => {
    if (!post.link) return;
    try {
      await navigator.clipboard.writeText(copyText(text, post.link));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard permission (an old in-app browser): the text and link stay on screen to be long-pressed.
      setCopied(false);
    }
  };

  const saveText = () => {
    if (text.trim() && text.trim() !== post.post_text.trim()) void run({ action: "text", id: post.id, text }, `text-${post.id}`);
  };

  return (
    <div className={`rounded-2xl border bg-white p-4 ${scheduled ? "border-teal-200" : "border-amber-200"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-base font-black text-stone-900">
          {post.day} · {time}
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${scheduled ? "bg-teal-50 text-teal-800" : "bg-amber-100 text-amber-800"}`}
        >
          {scheduled ? "תוזמן ✓" : "לתזמן"}
        </span>
      </div>

      {post.article && (
        <div className="mt-3 flex items-start gap-3">
          {post.article.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.article.image_url} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
          )}
          <div className="min-w-0">
            <div className="text-sm font-bold leading-5 text-stone-900">{post.article.title}</div>
            <div className="mt-0.5 text-xs text-stone-500">מאת {post.article.author}</div>
            <a
              href={`/research/community/${encodeURIComponent(post.article.slug)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-xs font-semibold text-teal-700 underline"
            >
              פתיחת המאמר
            </a>
          </div>
        </div>
      )}

      {post.article && !post.article.has_summary && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
          למאמר אין תקציר, ולכן הפוסט פותח בכותרת. אפשר להוסיף משפט משלך.
        </p>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={saveText}
        rows={6}
        className="mt-3 w-full rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm leading-6 text-stone-800 focus:border-teal-400 focus:outline-none"
      />
      {post.link && (
        // One line: the copy button adds the link anyway. Kept on screen, whole, for a
        // browser that blocks the clipboard (a long press selects all of it). break-all,
        // not nowrap: an unbreakable line would widen the admin's flex column past the phone.
        <div className="mt-1 line-clamp-1 select-all break-all text-xs leading-5 text-stone-400" dir="ltr" style={{ textAlign: "start" }}>
          {post.link}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={copy}
          className="rounded-full px-5 py-2 text-sm font-bold text-white transition hover:opacity-90"
          style={{ background: copied ? "var(--teal-dark, #2A6462)" : "var(--teal, #3D8C8A)" }}
        >
          {copied ? "הפוסט הועתק" : "העתקת הפוסט"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void run({ action: scheduled ? "unscheduled" : "scheduled", id: post.id }, `mark-${post.id}`)}
          className={`rounded-full border px-4 py-2 text-sm font-bold transition disabled:opacity-50 ${
            scheduled ? "border-stone-200 text-stone-500 hover:bg-stone-50" : "border-teal-300 text-teal-800 hover:bg-teal-50"
          }`}
        >
          {scheduled ? "ביטול הסימון" : "סימנתי שתוזמן"}
        </button>
        {!scheduled && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => {
              if (window.confirm("להחליף את המאמר בשבוע הזה? המאמר הנוכחי לא יוצע שוב.")) {
                void run({ action: "replace", id: post.id }, `replace-${post.id}`);
              }
            }}
            className="ms-auto text-xs font-semibold text-stone-400 underline hover:text-stone-600 disabled:opacity-50"
          >
            החלפת מאמר
          </button>
        )}
      </div>
    </div>
  );
}
