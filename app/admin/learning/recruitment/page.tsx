"use client";

import { useEffect, useMemo, useState } from "react";
import HelpTip from "../../components/HelpTip";
import { Section, num } from "../../components/BranchWidgets";
import { TEACHER_RECRUITMENT_CHANNELS, teacherCampaign, teacherJoinUrl } from "@/app/lib/teacher-recruitment";
import { SIGNUP_CHANNEL_LABELS, btn, getJson, type Teacher } from "../shared";

// גיוס מורים: ערוצי הגיוס עם קישור הצטרפות מתויג לכל אחד, ומשפך לכל ערוץ
// (ביקורים בדף ההצטרפות, הרשמות, מאושרים). הבעלים מפרסם בעצמו (קבוצות
// פייסבוק, מכללות); אף סוכן לא מפרסם. הקישור המתויג הוא מה שמאפשר לדעת
// איזה ערוץ הביא מי.

type Overview = { tiles: { signups_30d: number; join_views_30d: number }; channels: Record<string, { total: number; last30: number }> };

export default function LearningRecruitmentPage() {
  const [rows, setRows] = useState<Teacher[]>([]);
  const [ov, setOv] = useState<Overview | null>(null);
  useEffect(() => {
    getJson<{ teachers: Teacher[] }>("/api/admin-teachers").then((j) => j.ok && setRows(j.teachers)).catch(() => {});
    getJson<Overview>("/api/admin-teachers/overview").then((j) => j.ok && setOv(j)).catch(() => {});
  }, []);
  const byCampaign = useMemo(() => {
    const c: Record<string, { signups: number; listed: number }> = {};
    for (const r of rows) {
      if (!r.signup_utm_campaign) continue;
      const x = (c[r.signup_utm_campaign] ??= { signups: 0, listed: 0 });
      x.signups++;
      if (r.listing_state === "trial" || r.listing_state === "paying") x.listed++;
    }
    return c;
  }, [rows]);
  const site = typeof window !== "undefined" ? window.location.origin : "";
  const copy = (text: string) => navigator.clipboard?.writeText(text).then(() => alert("הועתק"));

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-black text-stone-900">גיוס</h1>
        <HelpTip id="teachers" />
      </div>

      <Section title="המשפך ב-30 הימים האחרונים" sub="ביקורים בדף ההצטרפות מול הרשמות. מורה נספר/ת לפי מה שהקישור שלו/ה נשא.">
        {ov ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-stone-50 p-3"><div className="text-xs text-stone-500">ביקורים בדף ההצטרפות</div><div className="text-xl font-black text-[#2A6462]">{num(ov.tiles.join_views_30d)}</div></div>
            <div className="rounded-xl bg-stone-50 p-3"><div className="text-xs text-stone-500">הרשמות</div><div className="text-xl font-black text-[#2A6462]">{num(ov.tiles.signups_30d)}</div></div>
            <div className="rounded-xl bg-stone-50 p-3">
              <div className="text-xs text-stone-500">לפי ערוץ (30 יום / סה״כ)</div>
              <div className="mt-1 space-y-0.5 text-xs text-stone-700">
                {Object.entries(ov.channels).filter(([, v]) => v.total).map(([k, v]) => (
                  <div key={k}>{SIGNUP_CHANNEL_LABELS[k] ?? k}: <b>{v.last30}</b> / {v.total}</div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-xs text-stone-400">טוען...</p>
        )}
      </Section>

      <Section title="ערוצי גיוס וקישורי הצטרפות" sub="לכל ערוץ קישור הצטרפות משלו. מורה שנרשם/ת דרכו נספר/ת כאן, וכך רואים איזה ערוץ מביא הרשמות ומי מהן אושרו.">
        <div className="mt-3 space-y-2">
          {TEACHER_RECRUITMENT_CHANNELS.map((c) => {
            const n = byCampaign[teacherCampaign(c.key)];
            return (
              <div key={c.key} className="flex flex-wrap items-center gap-2 border-b border-stone-100 pb-2 text-xs last:border-b-0">
                <div className="min-w-0 flex-1">
                  <span className="font-bold text-stone-800">{c.name}</span>
                  <span className="text-stone-500"> · {c.note}</span>
                </div>
                <span className="rounded-full bg-stone-100 px-2 py-0.5 font-bold text-stone-700">{n?.signups ?? 0} הרשמות{n?.listed ? `, ${n.listed} מוצגים` : ""}</span>
                {c.url && <a href={c.url} target="_blank" rel="noopener noreferrer" className={btn}>לאתר ↗</a>}
                <button type="button" onClick={() => copy(teacherJoinUrl(c, site))} className={btn}>העתקת קישור ההצטרפות</button>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
