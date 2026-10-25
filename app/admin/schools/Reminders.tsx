"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BOARD_NOTE_KINDS, type BoardNote } from "@/app/lib/schools-workspace";
import { errText, getJson, hebStamp, sendJson } from "./shared";

// התזכורות של לוח הענף שקופצות למי שהן מיועדות אליו: בתוך ה-CRM המשותף (לבעלים
// ולשותפה), ואצל הבעלים גם באדמין הראשי. רק בתוך המסך, בלי מייל ובלי וואטסאפ.
// בודק כשנכנסים, כל שלוש דקות, וכשחוזרים ללשונית. "סגירה" סוגרת רק אצל מי
// שלחץ; "אחר כך" דוחה אצלו בלבד. ממוקם קצת פנימה מהפינה, כדי לא לכסות את כפתור
// הנגישות.

const POLL_MS = 3 * 60_000;
/** נשלח אחרי סגירה או דחייה, כדי שלוח העבודה (אם פתוח) יתעדכן. */
export const REMINDERS_CHANGED = "school-reminders-changed";

/** מחר ב-9:00 שעון ישראל. ההפרש מ-UTC מחושב לפי התאריך עצמו (שעון קיץ או חורף). */
function tomorrowNine(): string {
  const d = new Date(Date.now() + 86_400_000);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(d);
  const guess = new Date(`${day}T09:00:00Z`);
  const ilHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", hour: "2-digit", hour12: false }).format(guess));
  return new Date(guess.getTime() - (ilHour - 9) * 3_600_000).toISOString();
}

export default function Reminders({ boardHref }: { boardHref: string }) {
  const [items, setItems] = useState<BoardNote[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const j = await getJson<{ reminders: BoardNote[] }>("/api/admin-schools/reminders");
      setItems(j.reminders);
    } catch {
      // תזכורת שלא נטענה תקפוץ בבדיקה הבאה; לא מציגים שגיאה על כל המסך בשביל זה.
    }
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), POLL_MS);
    const onFocus = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [load]);

  async function act(n: BoardNote, action: "dismiss" | "snooze", until?: string) {
    try {
      await sendJson("/api/admin-schools/board", { action, id: n.id, until });
      setItems((xs) => xs.filter((x) => x.id !== n.id));
      setError("");
      window.dispatchEvent(new Event(REMINDERS_CHANGED));
    } catch (e) {
      setError(errText(e));
    }
  }

  if (items.length === 0) return null;
  return (
    <div dir="rtl" className="fixed bottom-4 end-14 z-[120] w-[min(22rem,calc(100vw-5rem))] space-y-2" role="region" aria-label="תזכורות">
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</div> : null}
      {items.slice(0, 3).map((n) => {
        const kind = BOARD_NOTE_KINDS.find((k) => k.value === n.kind);
        return (
          <div key={n.id} className="rounded-2xl border border-[#E8C77A] bg-[#FDF6E3] p-4 text-sm shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-bold text-[#A87010]">
                  ⏰ תזכורת · {kind?.label ?? "פתק"}
                  {n.created_by ? ` · מ${n.created_by}` : ""}
                </div>
                {n.title ? <div className="mt-0.5 font-black text-stone-900">{n.title}</div> : null}
              </div>
              <span className="shrink-0 text-[11px] text-stone-500">{hebStamp(n.remind_at, true)}</span>
            </div>
            {n.body ? <p className="mt-1 line-clamp-4 whitespace-pre-line text-stone-700">{n.body}</p> : null}
            {n.url ? (
              <a href={n.url} target="_blank" rel="noopener noreferrer" className="mt-1 block truncate text-xs font-bold text-[#2A6462] underline">
                {n.url}
              </a>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button type="button" onClick={() => act(n, "dismiss")} className="rounded-full bg-[#3D8C8A] px-3 py-1 text-xs font-bold text-white hover:bg-[#2A6462]">
                סגירה
              </button>
              <button type="button" onClick={() => act(n, "snooze", new Date(Date.now() + 3_600_000).toISOString())} className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs font-bold text-stone-600">
                בעוד שעה
              </button>
              <button type="button" onClick={() => act(n, "snooze", tomorrowNine())} className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs font-bold text-stone-600">
                מחר ב-9:00
              </button>
              <Link href={`${boardHref}#note-${n.id}`} className="rounded-full px-2 py-1 text-xs font-bold text-[#2A6462] underline">
                לפתק
              </Link>
            </div>
          </div>
        );
      })}
      {items.length > 3 ? (
        <Link href={boardHref} className="block rounded-xl bg-white/90 p-2 text-center text-xs font-bold text-[#2A6462] shadow">
          ועוד {items.length - 3} תזכורות בלוח
        </Link>
      ) : null}
    </div>
  );
}
