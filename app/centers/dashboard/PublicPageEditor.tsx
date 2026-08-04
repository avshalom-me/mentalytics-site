"use client";

import { useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";

// עורך העמוד הציבורי של המרכז - קומפוננטה עצמאית (state מקומי כדי שהקלדה לא
// תרנדר את הדף המארח). מוצגת בעמוד העריכה /centers/dashboard/profile.

export type PublicPage = {
  slug: string | null;
  enabled: boolean;
  description: string | null;
  managers: string | null;
  city: string | null;
  website: string | null;
  phone: string | null;
  founded_year: number | null;
  team_size: number | null;
  address: string | null;
  hours: string | null;
  accessibility: string | null;
  director: { name: string; role: string; note: string; photo_path: string | null; photo_url: string | null };
  faq: { q: string; a: string }[];
  logo_path: string | null;
  logo_url: string | null;
  team: { name: string; role: string; photo_path: string | null; photo_url: string | null }[];
  gallery: { path: string; caption: string | null; url: string | null }[];
};

type TeamRow = { name: string; role: string; photo_path: string | null; photo_url: string | null };
type GalleryRow = { path: string; caption: string; url: string | null };
type FaqRow = { q: string; a: string };

export default function PublicPageEditor({ initial, isEntity = false }: { initial: PublicPage; isEntity?: boolean }) {
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
  // עובדות-אמון + מידע פרקטי + דבר המנהל/ת + שאלות נפוצות
  const [foundedYear, setFoundedYear] = useState(initial.founded_year ? String(initial.founded_year) : "");
  const [teamSize, setTeamSize] = useState(initial.team_size ? String(initial.team_size) : "");
  const [address, setAddress] = useState(initial.address ?? "");
  const [hours, setHours] = useState(initial.hours ?? "");
  const [accessibility, setAccessibility] = useState(initial.accessibility ?? "");
  const [dirName, setDirName] = useState(initial.director?.name ?? "");
  const [dirRole, setDirRole] = useState(initial.director?.role ?? "");
  const [dirNote, setDirNote] = useState(initial.director?.note ?? "");
  const [dirPhotoPath, setDirPhotoPath] = useState<string | null>(initial.director?.photo_path ?? null);
  const [dirPhotoPreview, setDirPhotoPreview] = useState<string | null>(initial.director?.photo_url ?? null);
  const [faq, setFaq] = useState<FaqRow[]>(initial.faq ?? []);
  const [profileCopied, setProfileCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  // העתקת קישור הפרופיל הציבורי - להטמעה באתר של המרכז (backlink).
  async function copyProfileUrl() {
    if (!slug) return;
    const url = `https://www.mentalytics.co.il/centers/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // דפדפן בלי clipboard API (או בלי הרשאה) - נפילה לשיטה הישנה.
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch { /* יועתק ידנית מהתיבה */ }
      document.body.removeChild(ta);
    }
    setProfileCopied(true);
    setTimeout(() => setProfileCopied(false), 2000);
  }
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // מד שלמות פרופיל - מחושב חי מה-state, כולל רמזים למה שחסר.
  const completeness: { label: string; done: boolean }[] = [
    { label: "לוגו", done: !!logoPath },
    { label: "תיאור המרכז", done: description.trim().length >= 40 },
    { label: "איש/אשת צוות אחד לפחות", done: team.some((m) => m.name.trim()) },
    { label: "2+ תמונות של המרכז", done: gallery.length >= 2 },
    { label: "דבר המנהל/ת", done: !!(dirName.trim() && dirNote.trim()) },
    { label: "שנת ייסוד", done: !!foundedYear.trim() },
    { label: "גודל הצוות", done: !!teamSize.trim() },
    { label: "כתובת", done: !!address.trim() },
    { label: "שעות פעילות", done: !!hours.trim() },
    { label: "שאלה נפוצה אחת לפחות", done: faq.some((f) => f.q.trim() && f.a.trim()) },
  ];
  const donePct = Math.round((completeness.filter((c) => c.done).length / completeness.length) * 100);

  // העלאת תמונת מרכז (לוגו / חבר צוות / גלריה) - מחזירה נתיב אחסון שנשמר בשמירה.
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

  async function onDirectorPhoto(file: File | null) {
    if (!file) return;
    setErr("");
    const path = await uploadCenterImage(file, "center_image");
    if (path) { setDirPhotoPath(path); setDirPhotoPreview(URL.createObjectURL(file)); }
  }

  async function onGalleryFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setErr(""); setGalleryBusy(true);
    // העלאה סדרתית - עד המכסה (8 תמונות).
    const room = Math.max(0, 8 - gallery.length);
    for (const file of Array.from(files).slice(0, room)) {
      const path = await uploadCenterImage(file, "center_gallery");
      if (path) setGallery((prev) => [...prev, { path, caption: "", url: URL.createObjectURL(file) }]);
      else break; // שגיאה - נעצור, ההודעה כבר מוצגת
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
          founded_year: foundedYear.trim() || null,
          team_size: teamSize.trim() || null,
          address,
          hours,
          accessibility,
          director: { name: dirName, role: dirRole, note: dirNote, photo_path: dirPhotoPath },
          faq: faq.filter((f) => f.q.trim() && f.a.trim()),
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
        {/* מסלול 2: העמוד הוא המוצר (כרטיס ההתאמה מקשר אליו) ולכן תמיד מפורסם -
            אין להציג מתג שלא משפיע. מסלול 1: העמוד אופציונלי, המתג אמיתי. */}
        {isEntity ? (
          <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-bold text-green-800">
            ✓ מפורסם - חלק מהמנוי
          </span>
        ) : (
          <label className="flex items-center gap-2 text-sm font-semibold text-stone-700">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 accent-[var(--teal)]" />
            פרסום העמוד באתר
          </label>
        )}
      </div>
      <p className="mb-4 text-xs text-stone-500">
        עמוד ציבורי מקודם בגוגל עם הלוגו, המידע על המרכז והצוות המוביל.
        {slug && (
          <> הכתובת שלכם: <a href={`/centers/${slug}`} target="_blank" className="font-bold text-teal-700 underline">/centers/{slug}</a></>
        )}
      </p>

      {/* מד שלמות פרופיל - פרופיל מלא = יותר אמון ויותר פניות */}
      <div className="mb-5 rounded-xl border border-stone-200 bg-white p-3.5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-black text-stone-700">שלמות הפרופיל</span>
          <span className="text-sm font-black" style={{ color: donePct >= 80 ? "#15803d" : donePct >= 50 ? "var(--gold-dark)" : "#b91c1c" }}>{donePct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-stone-100">
          <div className="h-full rounded-full transition-all" style={{ width: `${donePct}%`, background: "linear-gradient(90deg,var(--teal),var(--teal-dark))" }} />
        </div>
        {donePct < 100 && (
          <p className="mt-2 text-[11px] leading-5 text-stone-500">
            חסר: {completeness.filter((c) => !c.done).map((c) => c.label).join(" · ")}
          </p>
        )}
      </div>

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

      {/* דבר המנהל/ת - פנים, שם והסמכה שהופכים "ישות" לאנשים */}
      <div className="mb-4 rounded-xl border border-stone-200 bg-white p-3.5">
        <label className="mb-1 block text-sm font-semibold text-stone-700">💬 דבר מנהל/ת המרכז</label>
        <p className="mb-2 text-xs text-stone-500">2-3 משפטים אישיים וחמים מהמנהל/ת - האלמנט שהופך את המרכז מאנונימי לאנושי.</p>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <label className="cursor-pointer">
            {dirPhotoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={dirPhotoPreview} alt="" className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-[9px] text-teal-700">תמונה</div>
            )}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => onDirectorPhoto(e.target.files?.[0] ?? null)} />
          </label>
          <input value={dirName} onChange={(e) => setDirName(e.target.value)} placeholder="שם המנהל/ת"
            className="min-w-[130px] flex-1 rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm" />
          <input value={dirRole} onChange={(e) => setDirRole(e.target.value)} placeholder='תפקיד והסמכה (למשל: פסיכולוגית קלינית, מנהלת המרכז)'
            className="min-w-[180px] flex-[1.4] rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm" />
        </div>
        <textarea value={dirNote} onChange={(e) => setDirNote(e.target.value)} rows={3} maxLength={600}
          placeholder='למשל: "הקמנו את המרכז מתוך אמונה שלכל אדם מגיע טיפול שמותאם באמת אליו…"'
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-[var(--teal)]" />
      </div>

      {/* צוות / ראשי המרכז */}
      <label className="mb-1 block text-sm font-semibold text-stone-700">הצוות המוביל / ראשי המרכז</label>
      <p className="mb-2 text-xs text-stone-500">אנשי המקצוע הבכירים שיוצגו בעמוד - שם, תפקיד ותמונה.</p>
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
        הכניסה למרכז, חדרי הטיפול, חלל ההמתנה - עד 8 תמונות. תמונות אמיתיות של המקום מחזקות מאוד את תחושת האמון של פונים.
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

      {/* עובדות-אמון - מוצגות כמספרים גדולים בעמוד, רק כשמולאו */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-semibold text-stone-700">שנת ייסוד המרכז</label>
          <input value={foundedYear} onChange={(e) => setFoundedYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric" placeholder="למשל 2012" dir="ltr"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-[var(--teal)]" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-stone-700">מספר אנשי צוות</label>
          <input value={teamSize} onChange={(e) => setTeamSize(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric" placeholder="למשל 14" dir="ltr"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-[var(--teal)]" />
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
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

      {/* מידע פרקטי - השאלות האמיתיות של פונה חרד */}
      <label className="mb-1 mt-3 block text-sm font-semibold text-stone-700">כתובת מלאה (לניווט)</label>
      <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="למשל: רח' הרצל 12, קומה 2, תל אביב"
        className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-[var(--teal)]" />
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-semibold text-stone-700">שעות פעילות</label>
          <textarea value={hours} onChange={(e) => setHours(e.target.value)} rows={2}
            placeholder={"א'-ה' 8:00-20:00\nו' 8:00-13:00"}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-[var(--teal)]" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-stone-700">נגישות</label>
          <textarea value={accessibility} onChange={(e) => setAccessibility(e.target.value)} rows={2}
            placeholder="למשל: גישה לכיסאות גלגלים, מעלית, חניית נכים בסמוך"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-[var(--teal)]" />
        </div>
      </div>

      <label className="mb-1 mt-3 block text-sm font-semibold text-stone-700">אתר המרכז</label>
      <input value={website} onChange={(e) => setWebsite(e.target.value)} dir="ltr" placeholder="https://…"
        className="mb-3 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-[var(--teal)]" />

      {/* קישור הפרופיל אצלנו - להטמעה באתר של המרכז (עוזר למטופלים + מחזק בגוגל) */}
      {slug && (
        <div className="mb-4 rounded-xl border border-[var(--teal-mid)] bg-white p-3.5">
          <p className="text-sm font-bold text-stone-800">🔗 הקישור לפרופיל שלכם בטיפול חכם</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code dir="ltr" className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs text-stone-700">
              {`https://www.mentalytics.co.il/centers/${slug}`}
            </code>
            <button type="button" onClick={copyProfileUrl}
              className="rounded-full border border-teal-300 bg-teal-50 px-4 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-100">
              {profileCopied ? "✓ הועתק!" : "העתקה"}
            </button>
          </div>
          <p className="mt-2 text-xs leading-5 text-stone-600">
            <strong>יש להזין את הלינק באתר האינטרנט של המרכז הטיפולי</strong> - קישור מהאתר שלכם
            עוזר למטופלים להגיע לפרופיל, ומחזק את מיקום העמוד שלכם בגוגל.
          </p>
        </div>
      )}

      {/* שאלות נפוצות */}
      <label className="mb-1 block text-sm font-semibold text-stone-700">❓ שאלות נפוצות (עד 6)</label>
      <p className="mb-2 text-xs text-stone-500">מה שפונים שואלים אתכם בטלפון שוב ושוב - עלויות, זמני המתנה, למי מתאים. עוזר גם לקידום בגוגל.</p>
      <div className="mb-2 space-y-2">
        {faq.map((f, i) => (
          <div key={i} className="rounded-xl border border-stone-200 bg-white p-2.5">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1 space-y-1.5">
                <input value={f.q} onChange={(e) => setFaq((prev) => prev.map((x, xi) => xi === i ? { ...x, q: e.target.value } : x))}
                  placeholder="השאלה (למשל: כמה זמן ממתינים לפגישה ראשונה?)" maxLength={200}
                  className="w-full rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm font-semibold" />
                <textarea value={f.a} onChange={(e) => setFaq((prev) => prev.map((x, xi) => xi === i ? { ...x, a: e.target.value } : x))}
                  placeholder="התשובה" rows={2} maxLength={1000}
                  className="w-full rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm" />
              </div>
              <button onClick={() => setFaq((prev) => prev.filter((_, xi) => xi !== i))} className="px-1.5 text-stone-400 hover:text-red-600" title="הסרה">✕</button>
            </div>
          </div>
        ))}
      </div>
      {faq.length < 6 && (
        <button onClick={() => setFaq((prev) => [...prev, { q: "", a: "" }])}
          className="mb-4 rounded-full border border-teal-300 bg-teal-50 px-4 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-100">
          ➕ הוספת שאלה
        </button>
      )}

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
