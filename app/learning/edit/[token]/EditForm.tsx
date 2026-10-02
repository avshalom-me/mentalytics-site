"use client";

import { useEffect, useState } from "react";
import TeacherProfileFields, { EMPTY_TEACHER_FORM, toApiPayload, type TeacherForm } from "../../TeacherProfileFields";
import { listingStateLabel, TEACHER_PRICE_GROSS } from "@/app/lib/teacher-options";

type Profile = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  gender: string | null;
  slug: string | null;
  subjects: string[];
  remedial: boolean;
  grade_groups: string[];
  regions: string[];
  online: boolean;
  languages: string[];
  price_text: string | null;
  bio: string | null;
  qualification: string | null;
  institution: string | null;
  qualification_year: number | null;
  teaching_certificate: boolean;
  experience_years: number | null;
  has_certificate: boolean;
  photo_url: string | null;
  listing_state: string;
  trial_ends_at: string | null;
  paying_since: string | null;
  paused_until: string | null;
  sumit_recurring_id: boolean;
  sumit_first_charge_on: string | null;
};
type Stats = { impressions_30d: number; contacts_30d: number; impressions_total: number; contacts_total: number; last_contact_at: string | null };

function hebDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" }) : "";
}

function toForm(p: Profile): TeacherForm {
  return {
    ...EMPTY_TEACHER_FORM,
    full_name: p.full_name,
    email: p.email,
    phone: p.phone ?? "",
    gender: (p.gender as TeacherForm["gender"]) || "",
    subjects: p.subjects ?? [],
    remedial: !!p.remedial,
    grade_groups: p.grade_groups ?? [],
    regions: p.regions ?? [],
    online: !!p.online,
    languages: p.languages?.length ? p.languages : ["עברית"],
    price_text: p.price_text ?? "",
    bio: p.bio ?? "",
    qualification: p.qualification ?? "",
    institution: p.institution ?? "",
    qualification_year: p.qualification_year ? String(p.qualification_year) : "",
    teaching_certificate: !!p.teaching_certificate,
    experience_years: p.experience_years != null ? String(p.experience_years) : "",
  };
}

export default function EditForm({ token }: { token: string }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [form, setForm] = useState<TeacherForm>(EMPTY_TEACHER_FORM);
  const [loading, setLoading] = useState(true);
  const [gateError, setGateError] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const r = await fetch(`/api/teachers/profile?token=${encodeURIComponent(token)}`);
      const j = await r.json();
      if (!j.ok) {
        setGateError(j.error || "הקישור אינו תקף");
        return;
      }
      setProfile(j.teacher);
      setStats(j.stats);
      setForm(toForm(j.teacher));
    } catch {
      setGateError("שגיאה בטעינה");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    setBusy(true);
    try {
      const { email: _email, ...payload } = toApiPayload(form);
      void _email;
      const r = await fetch("/api/teachers/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...payload }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || "השמירה נכשלה");
      setProfile(j.teacher);
      setMsg("נשמר.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setBusy(false);
    }
  }

  async function upload(type: "certificate" | "photo", file: File) {
    setError("");
    setMsg("");
    const fd = new FormData();
    fd.append("token", token);
    fd.append("type", type);
    fd.append("file", file);
    const r = await fetch("/api/teachers/upload", { method: "POST", body: fd });
    const j = await r.json();
    if (!j.ok) setError(j.error || "ההעלאה נכשלה");
    else {
      setMsg(type === "photo" ? "התמונה הועלתה." : "התעודה הועלתה.");
      await load();
    }
  }

  if (loading) return <p className="text-sm text-[var(--muted)]">טוען...</p>;
  if (gateError || !profile) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-[var(--line)] bg-white p-10 text-center">
        <div className="mb-3 text-4xl">🔗</div>
        <h1 className="mb-2 text-xl font-black">הקישור אינו תקף</h1>
        <p className="text-sm leading-6 text-[var(--text-2)]">{gateError} - אם הקישור הועתק חלקית, נסו שוב מהמייל. אפשר גם לכתוב לנו ונשלח קישור חדש.</p>
      </div>
    );
  }

  const state = profile.listing_state;
  const listed = state === "trial" || state === "paying";
  const payUrl = `/learning/pay/${encodeURIComponent(token)}`;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[var(--line)] bg-white p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-black text-[var(--text)]">{profile.full_name}</h1>
          <span className="rounded-full border px-2.5 py-0.5 text-xs font-bold">{listingStateLabel(state)}</span>
        </div>
        <div className="mt-3 space-y-1.5 text-sm leading-6 text-[var(--text-2)]">
          {state === "pending" && <p>הפרופיל ממתין לאימות ההכשרה. נעדכן במייל כשיאושר. {!profile.has_certificate && <strong className="text-amber-700">עדיין לא הועלתה תעודה - בלי תעודה לא נוכל לאשר.</strong>}</p>}
          {state === "trial" && (
            <p>
              תקופת הניסיון עד <strong>{hebDate(profile.trial_ends_at)}</strong>.{" "}
              {profile.sumit_recurring_id
                ? `התשלום הוסדר; החיוב הראשון ב-${hebDate(profile.sumit_first_charge_on)}.`
                : `להמשך ההופעה במאגר אחרי התאריך הזה: ${TEACHER_PRICE_GROSS} ש"ח לחודש כולל מע"מ, ללא התחייבות. אפשר להסדיר כבר עכשיו - החיוב הראשון ייצא רק בסוף הניסיון.`}
            </p>
          )}
          {state === "paying" && <p>המנוי פעיל{profile.sumit_first_charge_on ? `; החיוב הראשון ${hebDate(profile.sumit_first_charge_on)}` : ""}. לביטול - בהודעת מייל אלינו.</p>}
          {state === "expired" && <p>תקופת הניסיון הסתיימה והפרופיל אינו מוצג. אפשר להחזיר אותו בכל רגע.</p>}
          {state === "paused" && <p>הפרופיל מוקפא זמנית.</p>}
          {state === "rejected" && <p>הפרופיל לא אושר. אם יש בידך תעודה שלא צורפה, העלו אותה כאן וכתבו לנו.</p>}
          {profile.paused_until && new Date(profile.paused_until) > new Date() && <p className="text-amber-700">הפרופיל מוקפא עד {hebDate(profile.paused_until)}.</p>}
        </div>
        {(state === "trial" || state === "expired") && !profile.sumit_recurring_id && (
          <a href={payUrl} className="mt-4 inline-block rounded-full bg-[var(--gold)] px-6 py-2.5 text-sm font-black text-white hover:bg-[var(--gold-dark)]">
            {state === "expired" ? "להחזרת הפרופיל למאגר" : "להסדרת התשלום לסוף הניסיון"} ←
          </a>
        )}
        {listed && profile.slug && (
          <a href={`/learning/t/${encodeURIComponent(profile.slug)}`} target="_blank" className="mt-4 ms-3 inline-block text-sm font-bold text-[var(--teal-dark)] underline">
            איך ההורים רואים אותי ↗
          </a>
        )}
      </section>

      {stats && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["הופעות ב-30 יום", stats.impressions_30d],
            ["פניות ב-30 יום", stats.contacts_30d],
            ["הופעות סה״כ", stats.impressions_total],
            ["פניות סה״כ", stats.contacts_total],
          ].map(([l, v]) => (
            <div key={String(l)} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 text-center">
              <div className="text-2xl font-black text-[var(--teal-dark)]">{v}</div>
              <div className="text-xs text-[var(--muted)]">{l}</div>
            </div>
          ))}
          <p className="col-span-2 text-xs leading-5 text-[var(--muted)] sm:col-span-4">
            "הופעה" = הפרופיל הוצג להורה בתוצאות השאלון. "פנייה" = לחיצה על וואטסאפ או חיוג מהכרטיס או מהפרופיל. ההורים פונים ישירות, ולכן השיחה עצמה לא נמדדת.
          </p>
        </section>
      )}

      <form onSubmit={save} className="space-y-6 rounded-3xl border border-[var(--line)] bg-white p-6">
        <h2 className="text-lg font-black">עריכת הפרופיל</h2>
        <TeacherProfileFields form={form} setForm={setForm} emailLocked />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-bold text-[var(--text-2)]">תמונה {profile.photo_url && <span className="font-normal text-emerald-700">(קיימת)</span>}</label>
            <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && upload("photo", e.target.files[0])} className="text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-[var(--text-2)]">תעודה {profile.has_certificate ? <span className="font-normal text-emerald-700">(קיימת)</span> : <span className="font-normal text-amber-700">(חסרה)</span>}</label>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => e.target.files?.[0] && upload("certificate", e.target.files[0])} className="text-sm" />
          </div>
        </div>
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {msg && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{msg}</div>}
        <button type="submit" disabled={busy} className="rounded-full bg-[var(--teal)] px-8 py-3 text-base font-bold text-white hover:bg-[var(--teal-dark)] disabled:opacity-50">
          {busy ? "שומרים..." : "שמירה"}
        </button>
      </form>
    </div>
  );
}
