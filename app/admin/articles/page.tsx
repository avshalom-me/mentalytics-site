"use client";

import { useEffect, useState } from "react";
import { ARTICLE_TOPICS } from "@/app/lib/articles";

type AdminArticle = {
  id: string;
  therapist_id: string;
  title: string;
  slug: string;
  summary: string;
  body: string;
  topic: string | null;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  created_at: string;
  approved_at: string | null;
  therapist_name: string | null;
};

type Data = { pending: AdminArticle[]; approved: AdminArticle[]; rejected: AdminArticle[] };

function fmt(d: string) {
  return new Date(d).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function AdminArticlesPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", summary: "", body: "", topic: "" });

  async function load() {
    const res = await fetch("/api/admin-articles", { cache: "no-store" });
    const json = await res.json();
    if (json.ok) setData({ pending: json.pending, approved: json.approved, rejected: json.rejected });
    setLoading(false);
  }

  useEffect(() => {
    async function init() {
      await load();
    }
    init();
  }, []);

  async function patch(payload: Record<string, unknown>, id: string) {
    setBusy(id);
    const res = await fetch("/api/admin-articles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setBusy(null);
    if (!json.ok) {
      alert(json.error ?? "שגיאה");
      return;
    }
    setEditId(null);
    await load();
  }

  function approve(a: AdminArticle) {
    patch({ id: a.id, action: "approve" }, a.id);
  }
  function reject(a: AdminArticle) {
    const reason = window.prompt("סיבת הדחייה (תישלח למטפל/ת):", a.rejection_reason ?? "");
    if (reason === null) return;
    patch({ id: a.id, action: "reject", reason }, a.id);
  }
  function startEdit(a: AdminArticle) {
    setEditId(a.id);
    setOpenId(a.id);
    setEditForm({ title: a.title, summary: a.summary, body: a.body, topic: a.topic ?? "" });
  }
  function saveEdit(a: AdminArticle) {
    patch({ id: a.id, action: "edit", ...editForm }, a.id);
  }

  function Card({ a }: { a: AdminArticle }) {
    const isOpen = openId === a.id;
    const isEditing = editId === a.id;
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-stone-900">{a.title}</h3>
            <p className="text-xs text-stone-500 mt-0.5">
              מאת {a.therapist_name ?? "מטפל/ת"} · {fmt(a.created_at)}
              {a.topic ? ` · ${a.topic}` : ""}
            </p>
          </div>
          {a.status === "approved" && (
            <a href={`/research/community/${a.slug}`} target="_blank" rel="noreferrer"
              className="text-xs font-semibold text-[#2e7d8c] hover:underline whitespace-nowrap">
              צפייה באתר ←
            </a>
          )}
        </div>

        {a.status === "rejected" && a.rejection_reason && (
          <p className="mt-2 text-xs text-red-600">סיבת דחייה: {a.rejection_reason}</p>
        )}

        {!isEditing && (
          <button onClick={() => setOpenId(isOpen ? null : a.id)}
            className="mt-3 text-xs font-semibold text-stone-500 hover:text-stone-700">
            {isOpen ? "הסתר תוכן ▲" : "הצג תוכן ▼"}
          </button>
        )}

        {isOpen && !isEditing && (
          <div className="mt-3 rounded-xl bg-stone-50 border border-stone-100 p-4 text-sm text-stone-700 leading-7 whitespace-pre-wrap">
            {a.summary && <p className="font-semibold mb-2">{a.summary}</p>}
            {a.body}
          </div>
        )}

        {isEditing && (
          <div className="mt-3 space-y-3">
            <input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" placeholder="כותרת" />
            <select value={editForm.topic} onChange={(e) => setEditForm({ ...editForm, topic: e.target.value })}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm">
              <option value="">ללא נושא</option>
              {ARTICLE_TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <textarea value={editForm.summary} onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
              rows={2} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" placeholder="תקציר" />
            <textarea value={editForm.body} onChange={(e) => setEditForm({ ...editForm, body: e.target.value })}
              rows={12} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm leading-7" placeholder="גוף המאמר" />
            <div className="flex gap-2">
              <button onClick={() => saveEdit(a)} disabled={busy === a.id}
                className="rounded-lg bg-[#2e7d8c] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">שמירה</button>
              <button onClick={() => setEditId(null)}
                className="rounded-lg border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-600">ביטול</button>
            </div>
          </div>
        )}

        {!isEditing && (
          <div className="mt-4 flex flex-wrap gap-2">
            {a.status !== "approved" && (
              <button onClick={() => approve(a)} disabled={busy === a.id}
                className="rounded-lg bg-green-600 px-4 py-2 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-50">
                אישור ופרסום
              </button>
            )}
            {a.status !== "rejected" && (
              <button onClick={() => reject(a)} disabled={busy === a.id}
                className="rounded-lg bg-red-100 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-200 disabled:opacity-50">
                {a.status === "approved" ? "הסרה מפרסום" : "דחייה"}
              </button>
            )}
            <button onClick={() => startEdit(a)}
              className="rounded-lg border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50">
              עריכה
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <h1 className="text-2xl font-black text-stone-900 mb-6">מאמרים ממטפלים</h1>

      {loading ? (
        <p className="text-sm text-stone-400">טוען...</p>
      ) : !data ? (
        <p className="text-sm text-red-500">שגיאה בטעינה</p>
      ) : (
        <>
          <section className="mb-10">
            <h2 className="text-sm font-extrabold text-stone-700 mb-3">
              ממתינים לאישור {data.pending.length > 0 && <span className="text-yellow-700">({data.pending.length})</span>}
            </h2>
            {data.pending.length === 0 ? (
              <p className="text-sm text-stone-400">אין מאמרים הממתינים לאישור.</p>
            ) : (
              <div className="space-y-3">{data.pending.map((a) => <Card key={a.id} a={a} />)}</div>
            )}
          </section>

          <section className="mb-10">
            <h2 className="text-sm font-extrabold text-stone-700 mb-3">פורסמו ({data.approved.length})</h2>
            {data.approved.length === 0 ? (
              <p className="text-sm text-stone-400">אין מאמרים שפורסמו.</p>
            ) : (
              <div className="space-y-3">{data.approved.map((a) => <Card key={a.id} a={a} />)}</div>
            )}
          </section>

          {data.rejected.length > 0 && (
            <section>
              <h2 className="text-sm font-extrabold text-stone-700 mb-3">נדחו ({data.rejected.length})</h2>
              <div className="space-y-3">{data.rejected.map((a) => <Card key={a.id} a={a} />)}</div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
