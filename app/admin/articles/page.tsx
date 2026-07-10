"use client";

import { useEffect, useState } from "react";
import { ARTICLE_TOPICS, ARTICLE_LIMITS } from "@/app/lib/articles";

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
  image_url: string | null;
  image_alt: string | null;
  image_credit: string | null;
  canonical_url: string | null;
  author_name: string | null;
};

type TherapistLite = { id: string; full_name: string };
type Data = { pending: AdminArticle[]; approved: AdminArticle[]; rejected: AdminArticle[] };

// The image fields a picker resolves and an article carries.
type ImageValue = {
  image_url: string;
  image_alt: string;
  image_credit: string;
  download_location: string;
};
const EMPTY_IMAGE: ImageValue = { image_url: "", image_alt: "", image_credit: "", download_location: "" };

type UnsplashResult = {
  thumb: string;
  url: string;
  alt: string;
  credit: string;
  credit_url: string;
  download_location: string;
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ── Image picker: search Unsplash by topic/title, pick a candidate, or paste a
// URL by hand. Falls back to manual-only when no UNSPLASH_ACCESS_KEY is set. ──
function ImagePicker({ value, onChange, defaultQuery }: {
  value: ImageValue;
  onChange: (v: ImageValue) => void;
  defaultQuery?: string;
}) {
  const [query, setQuery] = useState("");
  const [touched, setTouched] = useState(false);
  const [results, setResults] = useState<UnsplashResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Until the admin types in the search box, fall back to the article's
  // topic/title so the field is pre-filled and the button is clickable.
  const effectiveQuery = touched ? query : (query || defaultQuery || "");

  async function search() {
    const q = effectiveQuery.trim();
    if (!q) return;
    setSearching(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin-articles/unsplash?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) {
        setErr(json.error ?? "החיפוש נכשל");
        setResults([]);
      } else {
        setConfigured(json.configured);
        setResults(json.results ?? []);
      }
    } catch {
      setErr("החיפוש נכשל");
    }
    setSearching(false);
  }

  function pick(r: UnsplashResult) {
    onChange({
      image_url: r.url,
      image_alt: r.alt,
      image_credit: r.credit ? `צילום: ${r.credit} / Unsplash` : "",
      download_location: r.download_location,
    });
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <input
          value={effectiveQuery}
          onChange={(e) => { setTouched(true); setQuery(e.target.value); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); search(); } }}
          placeholder="חיפוש תמונה (באנגלית מומלץ)..."
          className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm"
        />
        <button type="button" onClick={search} disabled={searching || !effectiveQuery.trim()}
          className="rounded-lg bg-[#2e7d8c] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
          {searching ? "מחפש..." : "חיפוש"}
        </button>
      </div>

      {err && <p className="text-xs text-red-600">{err}</p>}
      {configured === false && (
        <p className="text-xs text-stone-500">
          חיפוש Unsplash לא מוגדר (חסר מפתח API). אפשר להדביק כתובת תמונה ידנית למטה.
        </p>
      )}

      {results.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {results.map((r, i) => {
            const selected = value.image_url === r.url;
            return (
              <button type="button" key={i} onClick={() => pick(r)}
                className={`relative rounded-lg overflow-hidden border-2 ${selected ? "border-[#2e7d8c]" : "border-transparent"}`}
                title={r.credit ? `צילום: ${r.credit}` : ""}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.thumb} alt={r.alt || "תמונה מועמדת"} className="w-full h-20 object-cover" loading="lazy" />
                {selected && <span className="absolute top-1 right-1 bg-[#2e7d8c] text-white text-[10px] rounded px-1">נבחר ✓</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Manual URL + preview */}
      <input
        value={value.image_url}
        onChange={(e) => onChange({ ...value, image_url: e.target.value, download_location: "" })}
        placeholder="או הדבקת כתובת תמונה (https://...)"
        className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" dir="ltr"
      />
      {value.image_url && (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value.image_url} alt="תצוגה מקדימה" className="w-full max-h-40 object-cover rounded-lg" />
          <input
            value={value.image_alt}
            onChange={(e) => onChange({ ...value, image_alt: e.target.value })}
            placeholder="טקסט חלופי לתמונה (alt) — לנגישות ו-SEO"
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-xs"
          />
          <input
            value={value.image_credit}
            onChange={(e) => onChange({ ...value, image_credit: e.target.value })}
            placeholder="קרדיט צילום (אופציונלי)"
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-xs"
          />
          <button type="button" onClick={() => onChange(EMPTY_IMAGE)}
            className="text-xs font-semibold text-red-600 hover:underline">הסרת תמונה</button>
        </div>
      )}
    </div>
  );
}

export default function AdminArticlesPage() {
  const [data, setData] = useState<Data | null>(null);
  const [therapists, setTherapists] = useState<TherapistLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", summary: "", body: "", topic: "", canonical_url: "", author_name: "" });
  const [editImage, setEditImage] = useState<ImageValue>(EMPTY_IMAGE);

  // Create-form state
  const [showCreate, setShowCreate] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({ therapist_id: "", title: "", summary: "", body: "", topic: "", canonical_url: "", author_name: "" });
  const [createImage, setCreateImage] = useState<ImageValue>(EMPTY_IMAGE);

  async function load() {
    const res = await fetch("/api/admin-articles", { cache: "no-store" });
    const json = await res.json();
    if (json.ok) {
      setData({ pending: json.pending, approved: json.approved, rejected: json.rejected });
      setTherapists(json.therapists ?? []);
    }
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

  async function createArticle() {
    setCreateErr(null);
    if (!createForm.therapist_id) { setCreateErr("יש לבחור מטפל/ת לשיוך"); return; }
    setCreateBusy(true);
    const res = await fetch("/api/admin-articles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...createForm, ...createImage }),
    });
    const json = await res.json();
    setCreateBusy(false);
    if (!json.ok) {
      setCreateErr(json.error ?? "שגיאה ביצירת המאמר");
      return;
    }
    setCreateForm({ therapist_id: "", title: "", summary: "", body: "", topic: "", canonical_url: "", author_name: "" });
    setCreateImage(EMPTY_IMAGE);
    setShowCreate(false);
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
    setEditForm({ title: a.title, summary: a.summary, body: a.body, topic: a.topic ?? "", canonical_url: a.canonical_url ?? "", author_name: a.author_name ?? "" });
    setEditImage({
      image_url: a.image_url ?? "",
      image_alt: a.image_alt ?? "",
      image_credit: a.image_credit ?? "",
      download_location: "",
    });
  }
  function saveEdit(a: AdminArticle) {
    patch({ id: a.id, action: "edit", ...editForm, ...editImage }, a.id);
  }

  function Card({ a }: { a: AdminArticle }) {
    const isOpen = openId === a.id;
    const isEditing = editId === a.id;
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-3 min-w-0">
            {a.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.image_url} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
            )}
            <div className="min-w-0">
              <h3 className="font-bold text-stone-900">{a.title}</h3>
              <p className="text-xs text-stone-500 mt-0.5">
                מאת {a.author_name?.trim() || a.therapist_name || "מטפל/ת"}
                {a.author_name?.trim() ? ` (מערכת · משויך: ${a.therapist_name ?? "—"})` : ""} · {fmt(a.created_at)}
                {a.topic ? ` · ${a.topic}` : ""}
              </p>
            </div>
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
            <div>
              <p className="text-xs font-semibold text-stone-600 mb-1">תמונה</p>
              <ImagePicker value={editImage} onChange={setEditImage} defaultQuery={editForm.topic || editForm.title} />
            </div>
            <div>
              <p className="text-xs font-semibold text-stone-600 mb-1">שם מחבר להצגה (אופציונלי)</p>
              <input value={editForm.author_name} onChange={(e) => setEditForm({ ...editForm, author_name: e.target.value })}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" placeholder='למשל "צוות טיפול חכם" — מאמר מערכת ללא שיוך למטפל/ת' />
              <p className="text-[11px] text-stone-400 mt-1">אם ממלאים — הבייליין יוצג בשם זה ללא קישור לפרופיל, והמאמר לא יופיע תחת המטפל/ת המשויך/ת. להשאיר ריק כדי לייחס למטפל/ת.</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-stone-600 mb-1">כתובת מקור מקורית (canonical)</p>
              <input value={editForm.canonical_url} onChange={(e) => setEditForm({ ...editForm, canonical_url: e.target.value })}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" dir="ltr" placeholder="https://... (אם המאמר פורסם קודם באתר אחר)" />
              <p className="text-[11px] text-stone-400 mt-1">אם המאמר פורסם קודם במקום אחר (למשל האתר של המטפל/ת), הדבק כאן את הכתובת המקורית — גוגל ייחס את התוכן למקור ולא יראה בו כפילות. להשאיר ריק אם זה מקור ראשוני.</p>
            </div>
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-stone-900">מאמרים</h1>
        <button onClick={() => setShowCreate((s) => !s)}
          className="rounded-lg bg-[#2e7d8c] px-4 py-2 text-sm font-bold text-white hover:bg-[#266876]">
          {showCreate ? "סגירה" : "+ כתיבת מאמר חדש"}
        </button>
      </div>

      {showCreate && (
        <div className="mb-10 rounded-2xl border border-[#2e7d8c]/30 bg-[#f3f9fa] p-5 space-y-3">
          <h2 className="text-sm font-extrabold text-stone-800">מאמר עריכותי חדש</h2>
          <p className="text-xs text-stone-500">המאמר יתפרסם מיד וישויך למטפל/ת שתבחר/י — עם קישור לפרופיל, ויופיע גם בעמוד הפרופיל שלו/ה.</p>

          <select value={createForm.therapist_id} onChange={(e) => setCreateForm({ ...createForm, therapist_id: e.target.value })}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm bg-white">
            <option value="">— בחירת מטפל/ת לשיוך —</option>
            {therapists.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </select>

          <input value={createForm.title} onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" placeholder={`כותרת (${ARTICLE_LIMITS.titleMin}–${ARTICLE_LIMITS.titleMax} תווים)`} />

          <select value={createForm.topic} onChange={(e) => setCreateForm({ ...createForm, topic: e.target.value })}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm bg-white">
            <option value="">ללא נושא</option>
            {ARTICLE_TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          <textarea value={createForm.summary} onChange={(e) => setCreateForm({ ...createForm, summary: e.target.value })}
            rows={2} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" placeholder={`תקציר (עד ${ARTICLE_LIMITS.summaryMax} תווים, מוצג בכרטיס)`} />

          <textarea value={createForm.body} onChange={(e) => setCreateForm({ ...createForm, body: e.target.value })}
            rows={12} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm leading-7"
            placeholder={`גוף המאמר (${ARTICLE_LIMITS.bodyMin}–${ARTICLE_LIMITS.bodyMax} תווים, שורה ריקה = פסקה חדשה)`} />

          <div>
            <p className="text-xs font-semibold text-stone-600 mb-1">תמונה ראשית</p>
            <ImagePicker value={createImage} onChange={setCreateImage} defaultQuery={createForm.topic || createForm.title} />
          </div>

          <div>
            <p className="text-xs font-semibold text-stone-600 mb-1">שם מחבר להצגה (אופציונלי)</p>
            <input value={createForm.author_name} onChange={(e) => setCreateForm({ ...createForm, author_name: e.target.value })}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" placeholder='למשל "צוות טיפול חכם" — מאמר מערכת ללא שיוך למטפל/ת' />
            <p className="text-[11px] text-stone-400 mt-1">אם ממלאים — הבייליין יוצג בשם זה ללא קישור לפרופיל, והמאמר לא יופיע תחת המטפל/ת המשויך/ת (עדיין חובה לבחור מטפל/ת לשיוך פנימי). להשאיר ריק כדי לייחס למטפל/ת.</p>
          </div>

          <div>
            <p className="text-xs font-semibold text-stone-600 mb-1">כתובת מקור מקורית (canonical)</p>
            <input value={createForm.canonical_url} onChange={(e) => setCreateForm({ ...createForm, canonical_url: e.target.value })}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" dir="ltr" placeholder="https://... (אם המאמר פורסם קודם באתר אחר)" />
            <p className="text-[11px] text-stone-400 mt-1">אם המאמר פורסם קודם במקום אחר (למשל האתר של המטפל/ת), הדבק כאן את הכתובת המקורית — גוגל ייחס את התוכן למקור ולא יראה בו כפילות. להשאיר ריק אם זה מקור ראשוני.</p>
          </div>

          {createErr && <p className="text-xs text-red-600">{createErr}</p>}
          <div className="flex gap-2">
            <button onClick={createArticle} disabled={createBusy}
              className="rounded-lg bg-green-600 px-5 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50">
              {createBusy ? "מפרסם..." : "פרסום המאמר"}
            </button>
            <button onClick={() => setShowCreate(false)}
              className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-600">ביטול</button>
          </div>
        </div>
      )}

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
