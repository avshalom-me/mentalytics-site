"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import HelpTip from "../components/HelpTip";
import {
  AUDIENCES,
  CHANNELS,
  KINDS,
  STATUSES,
  groupByCampaign,
  labelOf,
  linksToText,
  parseLinksText,
  youtubeId,
  type Channel,
  type Publication,
  type PublicationInput,
  type PubStatus,
} from "@/app/lib/publications";

// Every marketing piece in one place (the owner, 3/11/2026): what it is, its status, where the
// file and the public copy live, and where it sends people. Nothing here publishes anything;
// the API route only stores rows (app/api/admin-publications/route.ts).

type Filter = "active" | PubStatus | "all";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "active", label: "באוויר וטיוטות" },
  { value: "live", label: "באוויר" },
  { value: "draft", label: "טיוטות" },
  { value: "retired", label: "הוחלפו" },
  { value: "all", label: "הכול" },
];

const STATUS_CHIP: Record<PubStatus, string> = {
  live: "bg-teal-50 text-teal-800",
  draft: "bg-amber-100 text-amber-800",
  retired: "bg-stone-100 text-stone-500",
};

function israelToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
}

function fmtDate(d: string | null): string {
  if (!d) return "";
  const [y, m, day] = d.split("-").map(Number);
  return `${day}.${m}.${y}`;
}

async function post(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; item?: Publication }> {
  try {
    const res = await fetch("/api/admin-publications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j?.ok) return { ok: false, error: j?.error || "השינוי לא נשמר - נסו שוב" };
    return j;
  } catch {
    return { ok: false, error: "אין חיבור לשרת - נסו שוב" };
  }
}

export default function PublicationsPage() {
  const [items, setItems] = useState<Publication[]>([]);
  // "טוען" רק עד הטעינה הראשונה; רענון אחרי פעולה לא מסתיר את המסך.
  const [loaded, setLoaded] = useState(false);
  // שתי טעינות חופפות: האחרונה מנצחת.
  const loadSeq = useRef(0);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("active");
  const [campaign, setCampaign] = useState("");
  const [editing, setEditing] = useState<string | null>(null); // id, "new" or null
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    const seq = ++loadSeq.current;
    fetch("/api/admin-publications")
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (seq !== loadSeq.current) return;
        if (r.ok && j?.ok) setItems(j.items);
        else setError(j?.error || "הפרסומים לא נטענו - נסו לרענן");
      })
      .catch(() => {
        if (seq === loadSeq.current) setError("אין חיבור לשרת - נסו לרענן");
      })
      .finally(() => {
        if (seq === loadSeq.current) setLoaded(true);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const campaigns = useMemo(() => [...new Set(items.map((p) => p.campaign))].sort((a, b) => a.localeCompare(b, "he")), [items]);
  const counts = useMemo(() => {
    const scope = campaign ? items.filter((p) => p.campaign === campaign) : items;
    return {
      live: scope.filter((p) => p.status === "live").length,
      draft: scope.filter((p) => p.status === "draft").length,
      retired: scope.filter((p) => p.status === "retired").length,
    };
  }, [items, campaign]);
  const groups = useMemo(() => {
    const shown = items.filter(
      (p) =>
        (!campaign || p.campaign === campaign) &&
        (filter === "all" || (filter === "active" ? p.status !== "retired" : p.status === filter)),
    );
    return groupByCampaign(shown);
  }, [items, campaign, filter]);

  // המסך מתעדכן מיד, והשרת מיישר ברענון שקט.
  async function save(id: string | null, item: PublicationInput | Partial<PublicationInput>): Promise<string | null> {
    setError("");
    const r = await post(id ? { action: "update", id, item } : { action: "create", item });
    if (!r.ok || !r.item) {
      load();
      return r.error || "השינוי לא נשמר - נסו שוב";
    }
    const saved = r.item;
    setItems((prev) => (id ? prev.map((p) => (p.id === id ? saved : p)) : [...prev, saved]));
    // רק הטופס שנשמר נסגר: שינוי סטטוס בכרטיס אחר לא סוגר טופס פתוח.
    setEditing((cur) => (cur === (id ?? "new") ? null : cur));
    load();
    return null;
  }

  async function setStatus(p: Publication, status: PubStatus) {
    setBusy(p.id);
    const patch: Partial<PublicationInput> = { status };
    if (status === "live" && !p.published_on) patch.published_on = israelToday();
    setItems((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...patch } : x)));
    const err = await save(p.id, patch);
    if (err) setError(err);
    setBusy(null);
  }

  return (
    <div className="min-h-screen bg-stone-50" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-black text-stone-900">
            פרסומים <HelpTip id="publications" />
          </h1>
          <button
            type="button"
            onClick={() => setEditing(editing === "new" ? null : "new")}
            className="rounded-full bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800"
          >
            {editing === "new" ? "סגירת הטופס" : "+ הוספת פרסום"}
          </button>
        </div>

        <div className="mt-3 rounded-2xl border border-stone-200 bg-white p-4 text-sm leading-6 text-stone-700">
          <div className="font-bold text-stone-900">מה לעשות</div>
          <ul className="mt-1 list-disc space-y-0.5 pe-0 ps-5">
            <li>פרסום עלה לאוויר (יוטיוב, מודעה שתוזמנה, חלוקה): &quot;סימנתי שפורסם&quot;.</li>
            <li>גרסה חדשה מחליפה ישנה: להוסיף את החדשה ולסמן את הישנה &quot;הוחלף או הוסר&quot;. היא נשארת תחת &quot;הוחלפו&quot;.</li>
            <li>לשלוח קישור עם מעקב: &quot;העתקה&quot; ליד הקישור מעתיק אותו עם ה-utm של אותו פרסום.</li>
          </ul>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`rounded-full px-3 py-1 ${filter === f.value ? "bg-stone-800 text-white" : "bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-100"}`}
            >
              {f.label}
              {f.value === "live" ? ` (${counts.live})` : f.value === "draft" ? ` (${counts.draft})` : f.value === "retired" ? ` (${counts.retired})` : ""}
            </button>
          ))}
          {campaigns.length > 1 && (
            <select
              value={campaign}
              onChange={(e) => setCampaign(e.target.value)}
              className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs text-stone-700"
              aria-label="סדרה"
            >
              <option value="">כל הסדרות</option>
              {campaigns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>

        {error && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        {editing === "new" && (
          <div className="mt-4">
            <PubForm campaigns={campaigns} initial={null} defaultCampaign={campaign} onCancel={() => setEditing(null)} onSave={(v) => save(null, v)} />
          </div>
        )}

        {!loaded && <p className="mt-6 text-sm text-stone-400">טוען…</p>}
        {loaded && groups.length === 0 && !error && (
          <p className="mt-6 text-sm text-stone-500">{items.length === 0 ? "עוד אין פרסומים ברשימה." : "אין פרסומים בסינון הזה."}</p>
        )}

        {groups.map((g) => (
          <section key={g.campaign} className="mt-6">
            <h2 className="mb-3 text-lg font-black text-stone-800">{g.campaign}</h2>
            <div className="space-y-3">
              {g.items.map((p) =>
                editing === p.id ? (
                  <PubForm key={p.id} campaigns={campaigns} initial={p} onCancel={() => setEditing(null)} onSave={(v) => save(p.id, v)} />
                ) : (
                  <PubCard key={p.id} pub={p} busy={busy === p.id} onEdit={() => setEditing(p.id)} onStatus={(s) => setStatus(p, s)} />
                ),
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function CopyButton({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setFailed(false);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setFailed(true);
    }
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-stone-50 py-0.5 pe-1 ps-3 ring-1 ring-stone-200">
      <span className="text-xs text-stone-600">{label}</span>
      <button type="button" onClick={copy} className="rounded-full bg-white px-2.5 py-0.5 text-xs font-bold text-teal-800 ring-1 ring-teal-200 hover:bg-teal-50">
        {copied ? "הועתק" : failed ? "לא הועתק" : "העתקה"}
      </button>
      <a href={url} target="_blank" rel="noopener noreferrer" className="rounded-full px-2 py-0.5 text-xs font-bold text-stone-500 hover:bg-stone-100" title={url}>
        פתיחה ↗
      </a>
    </span>
  );
}

function PubCard({ pub: p, busy, onEdit, onStatus }: { pub: Publication; busy: boolean; onEdit: () => void; onStatus: (s: PubStatus) => void }) {
  const yt = youtubeId(p.public_url);
  const [thumbOk, setThumbOk] = useState(true);
  return (
    <div className={`rounded-2xl border border-stone-200 bg-white p-4 ${p.status === "retired" ? "opacity-70" : ""}`}>
      <div className="flex gap-3">
        {yt && thumbOk && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`https://i.ytimg.com/vi/${yt}/mqdefault.jpg`}
            alt=""
            onError={() => setThumbOk(false)}
            // סרטון פרטי או שנמחק: יוטיוב מחזיר ריבוע אפור של 120x90 במקום התמונה (mqdefault היא 320x180).
            onLoad={(e) => {
              if (e.currentTarget.naturalWidth < 200) setThumbOk(false);
            }}
            className="hidden h-[68px] w-[120px] shrink-0 rounded-lg object-cover sm:block"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-bold text-stone-900">{p.title}</span>
            {p.version && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">{p.version}</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
            <span className={`rounded-full px-2 py-0.5 font-bold ${STATUS_CHIP[p.status]}`}>{labelOf(STATUSES, p.status)}</span>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-600">{labelOf(KINDS, p.kind)}</span>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-600">{labelOf(AUDIENCES, p.audience)}</span>
            {p.channels.map((c) => (
              <span key={c} className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-800">
                {labelOf(CHANNELS, c)}
              </span>
            ))}
            {p.published_on && <span className="text-stone-400">פורסם {fmtDate(p.published_on)}</span>}
          </div>
        </div>
      </div>

      {(p.public_url || p.file_url) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {p.public_url && (
            <a href={p.public_url} target="_blank" rel="noopener noreferrer" className="rounded-full bg-teal-700 px-3.5 py-1 text-xs font-bold text-white hover:bg-teal-800">
              {yt ? "צפייה ביוטיוב ↗" : "צפייה ↗"}
            </a>
          )}
          {p.file_url && (
            <a href={p.file_url} target="_blank" rel="noopener noreferrer" className="rounded-full bg-white px-3.5 py-1 text-xs font-bold text-teal-800 ring-1 ring-teal-300 hover:bg-teal-50">
              הקובץ בדרייב ↗
            </a>
          )}
        </div>
      )}

      {p.links.length > 0 && (
        <div className="mt-2.5">
          <div className="mb-1 text-xs font-semibold text-stone-500">לאן הפרסום מוביל</div>
          <div className="flex flex-wrap gap-2">
            {p.links.map((l, i) => (
              <CopyButton key={i} url={l.url} label={l.label} />
            ))}
          </div>
        </div>
      )}

      {p.notes && <p className="mt-2.5 whitespace-pre-line text-xs leading-5 text-stone-500">{p.notes}</p>}

      <div className="mt-3 flex flex-wrap gap-2 border-t border-stone-100 pt-3">
        {p.status === "draft" && (
          <button type="button" disabled={busy} onClick={() => onStatus("live")} className="rounded-full bg-teal-700 px-3.5 py-1 text-xs font-bold text-white hover:bg-teal-800 disabled:opacity-50">
            סימנתי שפורסם
          </button>
        )}
        {p.status !== "retired" && (
          <button type="button" disabled={busy} onClick={() => onStatus("retired")} className="rounded-full bg-white px-3.5 py-1 text-xs font-bold text-stone-600 ring-1 ring-stone-300 hover:bg-stone-100 disabled:opacity-50">
            הוחלף או הוסר
          </button>
        )}
        {p.status === "retired" && (
          <button type="button" disabled={busy} onClick={() => onStatus("draft")} className="rounded-full bg-white px-3.5 py-1 text-xs font-bold text-stone-600 ring-1 ring-stone-300 hover:bg-stone-100 disabled:opacity-50">
            החזרה לטיוטה
          </button>
        )}
        <button type="button" onClick={onEdit} className="rounded-full px-3 py-1 text-xs font-bold text-stone-500 hover:bg-stone-100">
          עריכה
        </button>
      </div>
    </div>
  );
}

function PubForm({
  initial,
  campaigns,
  defaultCampaign = "",
  onCancel,
  onSave,
}: {
  initial: Publication | null;
  campaigns: string[];
  defaultCampaign?: string;
  onCancel: () => void;
  onSave: (v: PublicationInput) => Promise<string | null>;
}) {
  const [f, setF] = useState({
    campaign: initial?.campaign ?? defaultCampaign,
    audience: initial?.audience ?? "counselors",
    kind: initial?.kind ?? "video",
    title: initial?.title ?? "",
    version: initial?.version ?? "",
    status: initial?.status ?? "draft",
    channels: initial?.channels ?? ([] as Channel[]),
    public_url: initial?.public_url ?? "",
    file_url: initial?.file_url ?? "",
    links: initial ? linksToText(initial.links) : "",
    notes: initial?.notes ?? "",
    published_on: initial?.published_on ?? "",
    sort_order: String(initial?.sort_order ?? 0),
  });
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const toggle = (c: Channel) => setF((s) => ({ ...s, channels: s.channels.includes(c) ? s.channels.filter((x) => x !== c) : [...s.channels, c] }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseLinksText(f.links);
    if (parsed.bad.length) {
      setErr(`השורה הזאת בקישורים לא נקראה: "${parsed.bad[0]}". כל שורה: תווית | כתובת שמתחילה ב-https://`);
      return;
    }
    setSaving(true);
    setErr("");
    const e2 = await onSave({
      campaign: f.campaign,
      audience: f.audience,
      kind: f.kind,
      title: f.title,
      version: f.version || null,
      status: f.status,
      channels: f.channels,
      public_url: f.public_url || null,
      file_url: f.file_url || null,
      links: parsed.links,
      notes: f.notes || null,
      published_on: f.published_on || null,
      sort_order: Number(f.sort_order) || 0,
    });
    setSaving(false);
    if (e2) setErr(e2);
  }

  const input = "mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 focus:border-teal-500 focus:outline-none";
  const lbl = "block text-xs font-semibold text-stone-600";

  return (
    <form onSubmit={submit} className="rounded-2xl border border-teal-200 bg-white p-4">
      <div className="text-sm font-black text-stone-900">{initial ? "עריכת פרסום" : "פרסום חדש"}</div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className={lbl}>
          סדרה
          <input className={input} list="pub-campaigns" value={f.campaign} onChange={set("campaign")} placeholder="מצפן היועצת" required />
          <datalist id="pub-campaigns">
            {campaigns.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label className={lbl}>
          שם הפרסום
          <input className={input} value={f.title} onChange={set("title")} placeholder="סרטון מלא - רחב 16x9" required />
        </label>
        <label className={lbl}>
          סוג
          <select className={input} value={f.kind} onChange={set("kind")}>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <label className={lbl}>
          קהל
          <select className={input} value={f.audience} onChange={set("audience")}>
            {AUDIENCES.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className={lbl}>
          גרסה
          <input className={input} value={f.version} onChange={set("version")} placeholder="טיוטה 7" />
        </label>
        <label className={lbl}>
          סטטוס
          <select className={input} value={f.status} onChange={set("status")}>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className={lbl}>
          איפה רואים אותו (קישור ליוטיוב או לפוסט)
          <input className={input} dir="ltr" value={f.public_url} onChange={set("public_url")} placeholder="https://youtu.be/..." />
        </label>
        <label className={lbl}>
          הקובץ (קישור לדרייב)
          <input className={input} dir="ltr" value={f.file_url} onChange={set("file_url")} placeholder="https://drive.google.com/..." />
        </label>
        <label className={lbl}>
          תאריך פרסום
          <input className={input} type="date" value={f.published_on} onChange={set("published_on")} />
        </label>
        <label className={lbl}>
          סדר בתוך הסדרה
          <input className={input} type="number" value={f.sort_order} onChange={set("sort_order")} />
        </label>
      </div>
      <fieldset className="mt-3">
        <legend className={lbl}>ערוצים</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {CHANNELS.map((c) => (
            <label key={c.value} className="inline-flex items-center gap-1.5 rounded-full bg-stone-50 px-3 py-1 text-xs text-stone-700 ring-1 ring-stone-200">
              <input type="checkbox" checked={f.channels.includes(c.value)} onChange={() => toggle(c.value)} />
              {c.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className={`${lbl} mt-3`}>
        לאן הפרסום מוביל: שורה לכל קישור, &quot;תווית | כתובת&quot;
        <textarea className={`${input} h-20 font-mono text-xs`} dir="ltr" value={f.links} onChange={set("links")} placeholder="פיילוט | https://www.mentalytics.co.il/school?access=...&utm_source=..." />
      </label>
      <label className={`${lbl} mt-3`}>
        הערות
        <textarea className={`${input} h-16`} value={f.notes} onChange={set("notes")} />
      </label>
      {err && <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</div>}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={saving} className="rounded-full bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50">
          {saving ? "שומר…" : "שמירה"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm font-bold text-stone-500 hover:bg-stone-100">
          ביטול
        </button>
      </div>
    </form>
  );
}
