"use client";

import { useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";

// עורך העמוד הציבורי של המרכז — קומפוננטה עצמאית (state מקומי כדי שהקלדה לא
// תרנדר את הדף המארח). מוצגת בעמוד העריכה /centers/dashboard/profile.

export type PublicPage = {
  slug: string | null;
  enabled: boolean;
  description: string | null;
  managers: string | null;
  city: string | null;
  website: string | null;
  phone: string | null;
  logo_path: string | null;
  logo_url: string | null;
  team: { name: string; role: string; photo_path: string | null; photo_url: string | null }[];
  gallery: { path: string; caption: string | null; url: string | null }[];
};

type TeamRow = { name: string; role: string; photo_path: string | null; photo_url: string | null };
type GalleryRow = { path: string; caption: string; url: string | null };

export default function PublicPageEditor({ initial }: { initial: PublicPage }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [description, setDescription] = useState(initial.description ?? "");
  const [managers, setManagers] = useState(initial.managers ?? "");
  const [city, setCity] = useState(initial.city ?? "");
  const [website, setWebsite] = useState(initial.website ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [slug, setSlug] = useState(initial.slug);
  const [logoPath, setLogoPath] = useState<string | null>(initial.logo_path);
  const [logoPreview, setLogoPreview] = useState<string | null>(initial.logo_url);
  const [logoBusy, setLogoBusy] = useState(false);
  const [team, setTeam] = useState<TeamRow[]>(initial.team ?? []);
  const [gallery, setGallery] = useState<GalleryRow[]>((initial.gallery ?? []).map((g) => ({ path: g.path, caption: g.caption ?? "", url: g.url })));
  const [galleryBusy, setGalleryBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // העלאת תמונת מרכז (לוגו / חבר צוות / גלריה) — מחזירה נתיב אחסון שנשמר בשמירה.
  async function uploadCenterImage(file: File, kind: "center_image" | "center_gallery"): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = "/centers/login"; return null; }
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", kind);
    const res = await fetch("/api/center-portal/upload", {
      method: "POST", headers: { Authorization: `Bearer ${session.access_token}` }, body: fd,
    });
    const json = await res.json();
    if (!json.ok) { setErr(json.error ?? "העלאת התמונה נכשלה"); return null; }
    return json.path as string;
  }

  async function onLogoFile(file: File | null) {
    if (!file) return;
    setLogoBusy(true); setErr("");
    const path = await uploadCenterImage(file, "center_image");
    if (path) { setLogoPath(path); setLogoPreview(URL.createObjectURL(file)); }
    setLogoBusy(false);
  }

  async function onMemberPhoto(idx: number, file: File | null) {
    if (!file) return;
    setErr("");
    const path = await uploadCenterImage(file, "center_image");
    if (path) setTeam((prev) => prev.map((m, i) => i === idx ? { ...m, photo_path: path, photo_url: URL.createObjectURL(file) } : m));
  }

  async function onGalleryFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setErr(""); setGalleryBusy(true);
    // העלאה סדרתית — עד המכסה (8 תמונות).
    const room = Math.max(0, 8 - gallery.length);
    for (const file of Array.from(files).slice(0, room)) {
      const path = await uploadCenterImage(file, "center_gallery");
      if (path) setGallery((prev) => [...prev, { path, caption: "", url: URL.createObjectURL(file) }]);
      else break; // שגיאה — נעצור, ההודעה כבר מוצגת
    }
    setGalleryBusy(false);
  }

  function setMember(idx: number, patch: Partial<TeamRow>) {
    setTeam((prev) => prev.map((m, i) => i === idx ? { ...m, ...patch } : m));
  }

  async function save() {
    setSaving(true); setMsg(""); setErr("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = "/centers/login"; return; }
      const res = await fetch("/api/center-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          action: "update_public_page",
          public_page_enabled: enabled,
          public_description: description,
          public_managers: managers,
          public_city: city,
          public_website: website,
          public_phone: phone,
          logo_path: logoPath,
          team_members: team.filter((m) => m.name.trim()).map((m) => ({ name: m.name.trim(), role: m.role.trim(), photo_path: m.photo_path })),
          gallery: gallery.map((g) => ({ path: g.path, caption: g.caption.trim() || null })),
        }),
      });
      const json = await res.json();
      if (!json.ok) { setErr(json.error ?? "שמירה נכשלה"); return; }
      if (json.slug) setSlug(json.slug);
      setMsg("נשמר ✓");
    } catch {
      setErr("שגיאת רשת");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-8 rounded-2xl border border-teal-200 bg-teal-50/40 p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-black text-stone-800">🌐 עמוד המרכז הציבורי</h2>
        <label className="flex items-center gap-2 text-sm font-semibold text-stone-700">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 accent-[var(--teal)]" />
          פרסום העמוד באתר
        </label>
      </div>
      <p className="mb-4 text-xs text-stone-500">
        עמוד ציבורי מקודם בגוגל עם הלוגו, המידע על המרכז והצוות המוביל.
        {slug && (
          <> הכתובת שלכם: <a href={`/centers/${slug}`} target="_blank" className="font-bold text-teal-700 underline">/centers/{slug}</a></>
        )}
      </p>

      {/* לוגו המרכז */}
      <label className="mb-1 block text-sm font-semibold text-stone-700">לוגו המרכז</label>
      <div className="mb-4 flex items-center gap-3">
        {logoPreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoPreview} alt="לוגו" className="h-16 w-16 rounded-xl border border-stone-200 bg-white object-contain p-1" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-stone-300 bg-white text-[10px] text-stone-400">ללא לוגו</div>
        )}
        <label className="cursor-pointer rounded-full border border-stone-300 bg-white px-4 py-1.5 text-xs font-bold text-stone-600 hover:bg-stone-50">
          {logoBusy ? "מעלה…" : logoPreview ? "החלפת לוגו" : "העלאת לוגו"}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => onLogoFile(e.target.files?.[0] ?? null)} />
        </label>
        {logoPreview && (
          <button onClick={() => { setLogoPath(null); setLogoPreview(null); }} className="text-xs font-semibold text-red-600 hover:underline">הסרה</button>
        )}
      </div>

      {/* צוות / ראשי המרכז */}
      <label className="mb-1 block text-sm font-semibold text-stone-700">הצוות המוביל / ראשי המרכז</label>
      <p className="mb-2 text-xs text-stone-500">אנשי המקצוע הבכירים שיוצגו בעמוד — שם, תפקיד ותמונה.</p>
      <div className="mb-2 space-y-2">
        {team.map((m, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-stone-200 bg-white p-2.5">
            <label className="cursor-pointer">
              {m.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.photo_url} alt="" className="h-11 w-11 rounded-full object-cover" />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-50 text-[9px] text-teal-700">תמונה</div>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => onMemberPhoto(i, e.target.files?.[0] ?? null)} />
            </label>
            <input value={m.name} onChange={(e) => setMember(i, { name: e.target.value })} placeholder="שם מלא"
              className="min-w-[120px] flex-1 rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm" />
            <input value={m.role} onChange={(e) => setMember(i, { role: e.target.value })} placeholder="תפקיד (למשל מנהל קליני)"
              className="min-w-[140px] flex-1 rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm" />
            <button onClick={() => setTeam((prev) => prev.filter((_, x) => x !== i))} className="px-1.5 text-stone-400 hover:text-red-600" title="הסרה">✕</button>
          </div>
        ))}
      </div>
      {team.length < 12 && (
        <button onClick={() => setTeam((prev) => [...prev, { name: "", role: "", photo_path: null, photo_url: null }])}
          className="mb-4 rounded-full border border-teal-300 bg-teal-50 px-4 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-100">
          ➕ הוספת איש/אשת צוות
        </button>
      )}

      {/* גלריית המרכז */}
      <label className="mb-1 block text-sm font-semibold text-stone-700">📷 תמונות המרכז</label>
      <p className="mb-2 text-xs text-stone-500">
        הכניסה למרכז, חדרי הטיפול, חלל ההמתנה — עד 8 תמונות. תמונות אמיתיות של המקום מחזקות מאוד את תחושת האמון של פונים.
      </p>
      {gallery.length > 0 && (
        <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {gallery.map((g, i) => (
            <div key={g.path} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
              {g.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={g.url} alt={g.caption || "תמונת המרכז"} className="h-24 w-full object-cover" />
              ) : (
                <div className="flex h-24 w-full items-center justify-center bg-stone-100 text-[10px] text-stone-400">תמונה</div>
              )}
              <div className="flex items-center gap-1 p-1.5">
                <input value={g.caption} onChange={(e) => setGallery((prev) => prev.map((x, xi) => xi === i ? { ...x, caption: e.target.value } : x))}
                  placeholder="כיתוב (למשל: חדר טיפולים)"
                  className="min-w-0 flex-1 rounded-md border border-stone-200 px-1.5 py-1 text-[11px]" />
                <button onClick={() => setGallery((prev) => prev.filter((_, xi) => xi !== i))}
                  className="px-1 text-stone-400 hover:text-red-600" title="הסרת התמונה">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {gallery.length < 8 && (
        <label className="mb-4 inline-block cursor-pointer rounded-full border border-teal-300 bg-teal-50 px-4 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-100">
          {galleryBusy ? "מעלה…" : `➕ הוספת תמונות (${gallery.length}/8)`}
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { onGalleryFiles(e.target.files); e.target.value = ""; }} />
        </label>
      )}

      <label className="mb-1 block text-sm font-semibold text-stone-700">תיאור המרכז</label>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
        placeholder="ספרו על המרכז, הגישה הטיפולית, תחומי ההתמחות והצוות…"
        className="mb-3 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-[var(--teal)]" />

      <label className="mb-1 block text-sm font-semibold text-stone-700">שמות המנהלים / הצוות</label>
      <input value={managers} onChange={(e) => setManagers(e.target.value)}
        placeholder="ד״ר כהן, גב׳ לוי…"
        className="mb-3 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-[var(--teal)]" />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-semibold text-stone-700">עיר / כתובת</label>
          <input value={city} onChange={(e) => setCity(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-[var(--teal)]" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-stone-700">טלפון ציבורי</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-[var(--teal)]" />
        </div>
      </div>

      <label className="mb-1 mt-3 block text-sm font-semibold text-stone-700">אתר המרכז</label>
      <input value={website} onChange={(e) => setWebsite(e.target.value)} dir="ltr" placeholder="https://…"
        className="mb-4 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-[var(--teal)]" />

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving}
          className="rounded-full px-6 py-2 text-sm font-bold text-white transition hover:opacity-95 disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,var(--teal-dark),var(--teal))" }}>
          {saving ? "שומר…" : "שמירת העמוד"}
        </button>
        {msg && <span className="text-sm font-semibold text-green-700">{msg}</span>}
        {err && <span className="text-sm font-semibold text-red-600">{err}</span>}
      </div>
    </section>
  );
}
