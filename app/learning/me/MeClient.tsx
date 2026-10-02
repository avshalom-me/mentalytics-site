"use client";

import { useEffect, useState } from "react";
import TeacherProfileFields, { EMPTY_TEACHER_FORM, toApiPayload, type TeacherForm } from "../TeacherProfileFields";
import { uploadTeacherCertificate, uploadTeacherPhoto } from "../teacher-upload-client";
import { listingStateLabel } from "@/app/lib/teacher-options";

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
  qualification_locked: boolean;
  trial_ends_at: string | null;
  trial_phase: "free" | "closing" | "last_day" | "ended" | null;
  paused_until: string | null;
  subscribed: boolean;
  first_charge_on: string | null;
  can_subscribe: boolean;
  price_gross: number;
};
type Stats = { impressions_30d: number; contacts_30d: number; impressions_total: number; contacts_total: number };

function hebDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem", day: "numeric", month: "long", year: "numeric" }) : "";
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

/** בלי עוגייה: שליחת הקישור האישי למייל הרשום. התשובה זהה לכל מייל. */
function LinkRequest({ invalidLink }: { invalidLink: boolean }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const r = await fetch("/api/teachers/link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || "השליחה נכשלה");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-3xl border border-[var(--line)] bg-white p-8 text-center">
      <h1 className="mb-2 text-xl font-black text-[var(--text)]">{invalidLink ? "הקישור אינו תקף" : "כניסה לפרופיל"}</h1>
      <p className="mb-5 text-sm leading-6 text-[var(--text-2)]">
        {invalidLink ? "ייתכן שהקישור הועתק חלקית. " : ""}
        הכניסה לפרופיל היא דרך הקישור האישי שנשלח אליך במייל. אפשר לקבל אותו שוב לכתובת המייל שאיתה נרשמת:
      </p>
      {sent ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-800">
          אם הכתובת רשומה אצלנו, שלחנו אליה את הקישור האישי. הקישור נשלח לכל היותר פעם ביממה.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="המייל שאיתו נרשמת" className="w-full rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--teal)]" dir="ltr" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={busy} className="w-full rounded-full bg-[var(--teal)] px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50">
            {busy ? "שולחים..." : "שליחת הקישור למייל"}
          </button>
        </form>
      )}
      <p className="mt-5 text-xs text-[var(--muted)]">עדיין לא נרשמת? <a href="/learning/join" className="font-bold underline">להצטרפות</a></p>
    </div>
  );
}

export default function MeClient({ invalidLink }: { invalidLink: boolean }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [form, setForm] = useState<TeacherForm>(EMPTY_TEACHER_FORM);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function load(resetForm: boolean) {
    try {
      const r = await fetch("/api/teachers/profile");
      if (r.status === 401) {
        setSignedOut(true);
        return;
      }
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "שגיאה בטעינה");
      setProfile(j.teacher);
      setStats(j.stats);
      if (resetForm) setForm(toForm(j.teacher));
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בטעינה");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load(true);
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    setBusy(true);
    try {
      const { email: _email, ...payload } = toApiPayload(form);
      void _email;
      const r = await fetch("/api/teachers/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || "השמירה נכשלה");
      setProfile(j.teacher);
      setForm(toForm(j.teacher));
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
    setBusy(true);
    try {
      const problem = type === "photo" ? await uploadTeacherPhoto(file) : await uploadTeacherCertificate(file);
      if (problem) setError(problem);
      else {
        setMsg(type === "photo" ? "התמונה הועלתה." : "התעודה הועלתה.");
        // בלי לאפס את הטופס - שינויים שעוד לא נשמרו נשארים.
        await load(false);
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-center text-sm text-[var(--muted)]">טוען...</p>;
  if (signedOut) return <LinkRequest invalidLink={invalidLink} />;
  if (!profile) return <p className="text-center text-sm text-red-600">{error || "שגיאה בטעינה"}</p>;

  const state = profile.listing_state;
  const listed = (state === "trial" || state === "paying") && !(profile.paused_until && new Date(profile.paused_until) > new Date());
  const price = profile.price_gross;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[var(--line)] bg-white p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-black text-[var(--text)]">{profile.full_name}</h1>
          <span className="rounded-full border border-[var(--line)] px-2.5 py-0.5 text-xs font-bold text-[var(--text-2)]">{listingStateLabel(state)}</span>
        </div>
        <div className="mt-3 space-y-1.5 text-sm leading-6 text-[var(--text-2)]">
          {state === "pending" && (
            <p>
              הפרופיל ממתין לאימות ההכשרה. נעדכן במייל כשיאושר.{" "}
              {!profile.has_certificate && <strong className="text-amber-700">עדיין לא הועלתה תעודה - בלי תעודה לא נוכל לאשר.</strong>}
            </p>
          )}
          {state === "trial" && !profile.subscribed && profile.trial_phase === "free" && (
            <p>
              תקופת הניסיון עד <strong>{hebDate(profile.trial_ends_at)}</strong>, ללא תשלום. לקראת סוף התקופה נשלח מייל עם אפשרות להמשיך ב-{price} ש"ח לחודש
              כולל מע"מ, ללא התחייבות. עד אז אין צורך לעשות דבר.
            </p>
          )}
          {state === "trial" && !profile.subscribed && profile.trial_phase !== "free" && (
            <p>
              תקופת הניסיון מסתיימת {profile.trial_phase === "last_day" ? <strong>היום</strong> : <>ב-<strong>{hebDate(profile.trial_ends_at)}</strong></>}. כדי להמשיך
              להופיע להורים: {price} ש"ח לחודש כולל מע"מ, ללא התחייבות. בלי הרשמה, הפרופיל יעבור לארכיון.
            </p>
          )}
          {state === "paying" && (
            <p>
              המנוי פעיל{profile.first_charge_on ? `; החיוב הראשון ${hebDate(`${profile.first_charge_on}T12:00:00Z`)}` : ""}. לביטול - בהודעת מייל ל-admin@getmentalytics.com.
            </p>
          )}
          {state === "archived" && <p>תקופת הניסיון הסתיימה, והפרופיל נמצא בארכיון ואינו מוצג להורים. אפשר להפעיל אותו מחדש בכל רגע: {price} ש"ח לחודש כולל מע"מ, ללא התחייבות.</p>}
          {state === "rejected" && <p>הפרופיל לא אושר. אם יש בידך תעודה שלא צורפה, אפשר להעלות אותה כאן ולכתוב לנו.</p>}
          {profile.paused_until && new Date(profile.paused_until) > new Date() && <p className="text-amber-700">הפרופיל אינו מוצג זמנית, עד {hebDate(profile.paused_until)}.</p>}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          {profile.can_subscribe && (
            <a href="/learning/pay" className="inline-block rounded-full bg-[var(--gold)] px-6 py-2.5 text-sm font-black text-white hover:bg-[var(--gold-dark)]">
              {state === "archived" ? "להפעלת הפרופיל מחדש" : "להמשך ההופעה במאגר"} ←
            </a>
          )}
          {listed && profile.slug && (
            <a href={`/learning/t/${encodeURIComponent(profile.slug)}`} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-[var(--teal-dark)] underline">
              איך ההורים רואים אותי ↗
            </a>
          )}
        </div>
      </section>

      {stats && state !== "pending" && state !== "rejected" && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ["הופעות ב-30 יום", stats.impressions_30d],
              ["פניות ב-30 יום", stats.contacts_30d],
              ["הופעות סה״כ", stats.impressions_total],
              ["פניות סה״כ", stats.contacts_total],
            ] as [string, number][]
          ).map(([l, v]) => (
            <div key={l} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 text-center">
              <div className="text-2xl font-black text-[var(--teal-dark)]">{v}</div>
              <div className="text-xs text-[var(--muted)]">{l}</div>
            </div>
          ))}
          <p className="col-span-2 text-xs leading-5 text-[var(--muted)] sm:col-span-4">
            "הופעה" = הפרופיל הוצג להורה בתוצאות השאלון. "פנייה" = לחיצה על וואטסאפ או חיוג, מהכרטיס או מהפרופיל. ההורים פונים ישירות אליך, ולכן השיחה עצמה לא נמדדת.
          </p>
        </section>
      )}

      <form onSubmit={save} className="space-y-6 rounded-3xl border border-[var(--line)] bg-white p-6">
        <h2 className="text-lg font-black text-[var(--text)]">עריכת הפרופיל</h2>
        <TeacherProfileFields form={form} setForm={setForm} emailLocked qualificationLocked={profile.qualification_locked} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-bold text-[var(--text-2)]">
              תמונה {profile.photo_url && <span className="font-normal text-emerald-700">(קיימת)</span>}
            </label>
            <input type="file" accept="image/*" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload("photo", f); }} className="text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-[var(--text-2)]">
              תעודה {profile.has_certificate ? <span className="font-normal text-emerald-700">(קיימת)</span> : <span className="font-normal text-amber-700">(חסרה)</span>}
            </label>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload("certificate", f); }} className="text-sm" />
          </div>
        </div>
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {msg && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{msg}</div>}
        <button type="submit" disabled={busy} className="rounded-full bg-[var(--teal)] px-8 py-3 text-base font-bold text-white hover:bg-[var(--teal-dark)] disabled:opacity-50">
          {busy ? "רגע..." : "שמירה"}
        </button>
      </form>
    </div>
  );
}
