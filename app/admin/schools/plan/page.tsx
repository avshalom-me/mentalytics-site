"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  GATE_METRICS,
  PLAN_KINDS,
  PLAN_STATUSES,
  PLAN_TASK,
  PLAN_TRACKS,
  addMonths,
  barGeometry,
  gateProgress,
  isLate,
  labelOf,
  positionPct,
  quarterStart,
  timeline,
  type PlanItem,
  type Timeline,
} from "@/app/lib/schools-workspace";
import { Field, Modal, Notice, btnGhost, btnPrimary, cardCls, errText, getJson, hebDate, inputCls, sendJson, shekel, todayIso } from "../shared";
import TaskForm, { type BranchTask } from "../TaskForm";

// התוכנית השנתית של הענף: גנט של שנה (או רבעון בתקריב), מחולק לרבעונים ולחודשים.
// שלבים הם פסים, אבני דרך הן מעוינים, ומשימות עם תאריך יושבות מתחת לשלב שלהן
// (או בשורת "משימות הענף"). אבן דרך יכולה להיות שער כספי: היא מראה כמה כבר נכנס
// מול הסף. הזמן זורם מימין לשמאל, כמו הטקסט.

type Totals = { received_gross: number; received_net: number };
type Zoom = "year" | "quarter";

const LABEL_W = "w-44 sm:w-56";

function StatusPill({ item, today }: { item: PlanItem; today: string }) {
  const late = isLate(item, today);
  const cls = late
    ? "bg-red-50 text-red-700 border-red-200"
    : item.status === "done"
      ? "bg-[#EAF4F3] text-[#2A6462] border-[#C2DFDE]"
      : item.status === "active"
        ? "bg-[#FDF6E3] text-[#A87010] border-[#F0D9A8]"
        : item.status === "dropped"
          ? "bg-stone-100 text-stone-400 border-stone-200"
          : "bg-white text-stone-500 border-stone-200";
  return <span className={`shrink-0 rounded-full border px-1.5 py-px text-[10px] font-bold ${cls}`}>{late ? "באיחור" : labelOf(PLAN_STATUSES, item.status)}</span>;
}

function Bar({ t, start, end, color, pale, solid, late, label, onClick, thin }: {
  t: Timeline;
  start: string;
  end: string | null;
  color: string;
  pale: string;
  solid: boolean;
  late?: boolean;
  label: string;
  onClick: () => void;
  thin?: boolean;
}) {
  const g = barGeometry(t, start, end);
  if (!g) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${label} · ${hebDate(start)}${end && end !== start ? ` עד ${hebDate(end)}` : ""}`}
      style={{ insetInlineStart: `${g.startPct}%`, width: `max(${g.widthPct}%, 6px)`, background: solid ? color : pale, borderColor: late ? "#DC2626" : color }}
      className={`absolute top-1/2 -translate-y-1/2 overflow-hidden border text-start ${thin ? "h-3 rounded-full" : "h-6 rounded-full"} ${late ? "ring-2 ring-red-200" : ""} ${g.cutStart ? "rounded-s-none" : ""} ${g.cutEnd ? "rounded-e-none" : ""}`}
    >
      {!thin && g.widthPct > 7 ? <span className={`block truncate px-2 text-[11px] font-bold leading-6 ${solid ? "text-white" : "text-stone-700"}`}>{label}</span> : null}
    </button>
  );
}

function Diamond({ t, date, color, label, onClick, done, late, progress }: {
  t: Timeline;
  date: string;
  color: string;
  label: string;
  onClick: () => void;
  done: boolean;
  late: boolean;
  progress?: number;
}) {
  if (date < t.start || date >= t.end) return null;
  const pct = positionPct(t, date);
  // קרוב לסוף החלון, השם עובר לצד השני של המעוין כדי לא להיחתך.
  const flip = pct > 70;
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${label} · ${hebDate(date)}`}
      style={flip ? { insetInlineEnd: `${100 - pct}%`, marginInlineEnd: -8 } : { insetInlineStart: `${pct}%`, marginInlineStart: -8 }}
      className={`absolute top-1/2 z-[1] flex -translate-y-1/2 items-center gap-1.5 ${flip ? "flex-row-reverse" : ""}`}
    >
      <span
        style={{ background: done ? color : "#fff", borderColor: late ? "#DC2626" : color }}
        className="block h-4 w-4 shrink-0 rotate-45 border-2 shadow-sm"
      />
      <span className="whitespace-nowrap rounded bg-white/90 px-1 text-[11px] font-bold text-stone-700">
        {label}
        {progress !== undefined ? ` · ${Math.round(progress)}%` : ""}
      </span>
    </button>
  );
}

function Dot({ t, date, color, label, onClick, done }: { t: Timeline; date: string; color: string; label: string; onClick: () => void; done: boolean }) {
  if (date < t.start || date >= t.end) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${label} · עד ${hebDate(date)}`}
      style={{ insetInlineStart: `${positionPct(t, date)}%`, marginInlineStart: -6, borderColor: color, background: done ? color : "#fff" }}
      className="absolute top-1/2 block h-3 w-3 -translate-y-1/2 rounded-full border-2"
    />
  );
}

/** הקווים של החודשים, של תחילת הרבעון ושל היום, מאחורי שורה אחת. */
function Grid({ t, today }: { t: Timeline; today: string }) {
  return (
    <>
      {t.months.slice(1).map((m) => (
        <span
          key={m.start}
          style={{ insetInlineStart: `${positionPct(t, m.start)}%` }}
          className={`pointer-events-none absolute inset-y-0 border-s ${m.start === quarterStart(m.start) ? "border-stone-300" : "border-stone-100"}`}
        />
      ))}
      {today >= t.start && today < t.end ? (
        <span style={{ insetInlineStart: `${positionPct(t, today)}%` }} className="pointer-events-none absolute inset-y-0 border-s-2 border-[#D49018]/70" />
      ) : null}
    </>
  );
}

export default function PlanPage() {
  const today = todayIso();
  const [items, setItems] = useState<PlanItem[]>([]);
  const [tasks, setTasks] = useState<BranchTask[]>([]);
  const [totals, setTotals] = useState<Totals>({ received_gross: 0, received_net: 0 });
  const [assignees, setAssignees] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [zoom, setZoom] = useState<Zoom>("year");
  const [from, setFrom] = useState(quarterStart(today));
  const [showDone, setShowDone] = useState(false);
  const [editItem, setEditItem] = useState<PlanItem | "new" | null>(null);
  const [editTask, setEditTask] = useState<{ task: BranchTask | null; planItem?: string; start?: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const j = await getJson<{ items: PlanItem[]; tasks: BranchTask[]; totals: Totals }>("/api/admin-schools/plan");
      setItems(j.items.map((i) => ({ ...i, gate_threshold: i.gate_threshold === null ? null : Number(i.gate_threshold) })));
      setTasks(j.tasks);
      setTotals(j.totals);
      setError("");
    } catch (e) {
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    getJson<{ assignees: string[] }>("/api/admin-schools/assignees")
      .then((j) => setAssignees(j.assignees))
      .catch(() => setAssignees([]));
  }, [load]);

  const say = (msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash(""), 3500);
  };

  const t = useMemo(() => timeline(from, zoom === "year" ? 12 : 3), [from, zoom]);
  const step = zoom === "year" ? 3 : 1;
  const visibleTasks = tasks.filter((x) => showDone || x.status !== "done");
  const tasksOf = (id: string) => visibleTasks.filter((x) => x.entity_type === PLAN_TASK && x.entity_id === id);
  const looseTasks = visibleTasks.filter((x) => !(x.entity_type === PLAN_TASK && items.some((i) => i.id === x.entity_id)));
  const lanes = PLAN_TRACKS.map((tr) => ({ track: tr, items: items.filter((i) => i.track === tr.value) })).filter((l) => l.items.length > 0);
  const received = (m: PlanItem["gate_metric"]) => (m === "received_net" ? totals.received_net : totals.received_gross);

  // שורת המצב: מה באיחור, מה בעבודה, ומה הבא.
  const late = items.filter((i) => isLate(i, today));
  const activeNow = items.filter((i) => i.status !== "done" && i.status !== "dropped" && i.start_date <= today && (i.end_date ?? i.start_date) >= today);
  const next = items.filter((i) => i.status === "planned" && i.start_date > today).sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
  const gates = items.filter((i) => i.kind === "milestone" && i.gate_metric && i.gate_threshold);
  const lateTasks = tasks.filter((x) => x.status !== "done" && x.due_date && x.due_date < today).length;

  const row = "relative h-10 border-b border-stone-100";

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-stone-900">תוכנית שנתית</h1>
          <p className="text-sm text-stone-500">שלבים, אבני דרך ומשימות של הענף על ציר זמן אחד.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setEditItem("new")} className={btnPrimary}>
            + שלב או אבן דרך
          </button>
          <button type="button" onClick={() => setEditTask({ task: null })} className="rounded-full border border-[#3D8C8A] px-5 py-2 text-sm font-bold text-[#2A6462] hover:bg-[#EAF4F3]">
            + משימה
          </button>
        </div>
      </div>
      <Notice error={error} flash={flash} />

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className={cardCls}>
          <div className="text-xs font-bold text-stone-500">באיחור</div>
          <div className={`text-2xl font-black ${late.length || lateTasks ? "text-red-700" : "text-stone-300"}`}>{late.length + lateTasks}</div>
          <div className="text-xs text-stone-500">{late.length} שלבים · {lateTasks} משימות</div>
        </div>
        <div className={cardCls}>
          <div className="text-xs font-bold text-stone-500">בעבודה עכשיו</div>
          <div className="text-2xl font-black text-[#3D8C8A]">{activeNow.length}</div>
          <div className="truncate text-xs text-stone-500">{activeNow.map((i) => i.title).join(" · ") || "אין שלב פתוח היום"}</div>
        </div>
        <div className={cardCls}>
          <div className="text-xs font-bold text-stone-500">הבא בתור</div>
          {next ? (
            <>
              <button type="button" onClick={() => setEditItem(next)} className="block truncate text-start text-sm font-black text-stone-900 hover:underline">
                {next.title}
              </button>
              <div className="text-xs text-stone-500">מתחיל ב-{hebDate(next.start_date)}</div>
            </>
          ) : (
            <div className="text-sm text-stone-400">אין שלב מתוכנן</div>
          )}
        </div>
        {gates.length ? (
          gates.slice(0, 1).map((g) => {
            const p = gateProgress(received(g.gate_metric), g.gate_threshold!);
            return (
              <button key={g.id} type="button" onClick={() => setEditItem(g)} className={`${cardCls} text-start hover:border-[#D49018]`}>
                <div className="truncate text-xs font-bold text-stone-500">שער: {g.title}</div>
                <div className="text-sm font-black text-stone-900">
                  {shekel(received(g.gate_metric))} מתוך {shekel(g.gate_threshold)}
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-stone-100">
                  <div className="h-full rounded-full bg-[#D49018]" style={{ width: `${p.pct}%` }} />
                </div>
                <div className="mt-1 text-[11px] text-stone-500">{p.reached ? "השער נפתח" : `חסרים ${shekel(p.missing)}`} · {labelOf(GATE_METRICS, g.gate_metric)}</div>
              </button>
            );
          })
        ) : (
          <div className={cardCls}>
            <div className="text-xs font-bold text-stone-500">נכנס עד היום</div>
            <div className="text-2xl font-black text-[#3D8C8A]">{shekel(totals.received_net)}</div>
            <div className="text-xs text-stone-500">בלי מע&quot;מ, בלי בתי ספר להדגמה</div>
          </div>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <div className="flex overflow-hidden rounded-full border border-stone-200">
          {(["year", "quarter"] as const).map((z) => (
            <button key={z} type="button" onClick={() => setZoom(z)} className={`px-4 py-1.5 font-bold ${zoom === z ? "bg-[#3D8C8A] text-white" : "bg-white text-stone-600"}`}>
              {z === "year" ? "שנה" : "רבעון"}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setFrom(addMonths(from, -step))} className={btnGhost} aria-label="אחורה">
          → קודם
        </button>
        <button type="button" onClick={() => setFrom(quarterStart(today))} className={btnGhost}>
          היום
        </button>
        <button type="button" onClick={() => setFrom(addMonths(from, step))} className={btnGhost} aria-label="קדימה">
          הבא ←
        </button>
        <label className="ms-auto flex items-center gap-1.5 text-xs text-stone-600">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
          להציג גם משימות שבוצעו
        </label>
      </div>

      {loading ? (
        <p className="text-sm text-stone-500">טוען...</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
          <div className={zoom === "year" ? "min-w-[1000px]" : "min-w-[760px]"}>
            {/* כותרות: רבעונים, ואז חודשים */}
            <div className="flex border-b border-stone-200 bg-stone-50">
              <div className={`${LABEL_W} sticky start-0 z-10 shrink-0 border-e border-stone-200 bg-stone-50`} />
              <div className="flex flex-1">
                {t.quarters.map((q) => (
                  <div key={q.start} style={{ width: `${(q.days / t.days) * 100}%` }} className="border-s border-stone-300 px-2 py-1.5 text-xs font-black text-stone-700 first:border-s-0">
                    {q.label}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex border-b border-stone-200">
              <div className={`${LABEL_W} sticky start-0 z-10 shrink-0 border-e border-stone-200 bg-white px-3 py-1 text-[11px] text-stone-400`}>
                הקו הזהוב = היום
              </div>
              <div className="flex flex-1">
                {t.months.map((m) => (
                  <div key={m.start} style={{ width: `${(m.days / t.days) * 100}%` }} className={`border-s px-1.5 py-1 text-[11px] text-stone-500 first:border-s-0 ${m.start === quarterStart(m.start) ? "border-stone-300" : "border-stone-100"}`}>
                    {m.label}
                  </div>
                ))}
              </div>
            </div>

            {lanes.length === 0 && looseTasks.length === 0 ? (
              <div className="p-6 text-sm text-stone-500">התוכנית ריקה. מתחילים ב&quot;+ שלב או אבן דרך&quot;.</div>
            ) : null}

            {lanes.map(({ track, items: laneItems }) => (
              <div key={track.value}>
                <div className="flex border-b border-stone-100" style={{ background: track.pale }}>
                  <div className={`${LABEL_W} sticky start-0 z-10 shrink-0 border-e border-stone-200 px-3 py-1 text-xs font-black`} style={{ background: track.pale, color: track.color }}>
                    {track.label}
                  </div>
                  <div className="flex-1" />
                </div>
                {laneItems.map((item) => {
                  const itemLate = isLate(item, today);
                  const own = tasksOf(item.id);
                  const gate = item.gate_metric && item.gate_threshold ? gateProgress(received(item.gate_metric), item.gate_threshold) : null;
                  return (
                    <div key={item.id}>
                      <div className="flex">
                        <button
                          type="button"
                          onClick={() => setEditItem(item)}
                          className={`${LABEL_W} sticky start-0 z-10 flex shrink-0 items-center gap-1.5 border-b border-e border-stone-100 bg-white px-3 text-start text-xs hover:bg-stone-50`}
                        >
                          <span aria-hidden>{item.kind === "milestone" ? "◆" : "▬"}</span>
                          <span className={`min-w-0 flex-1 truncate font-bold ${item.status === "dropped" ? "text-stone-400 line-through" : "text-stone-800"}`}>{item.title}</span>
                          <StatusPill item={item} today={today} />
                        </button>
                        <div className={`${row} flex-1`}>
                          <Grid t={t} today={today} />
                          {item.kind === "milestone" ? (
                            <Diamond t={t} date={item.start_date} color={gate ? "#D49018" : track.color} label={item.title} done={item.status === "done" || !!gate?.reached} late={itemLate} progress={gate?.pct} onClick={() => setEditItem(item)} />
                          ) : (
                            <Bar t={t} start={item.start_date} end={item.end_date} color={track.color} pale={track.pale} solid={item.status === "active" || item.status === "done"} late={itemLate} label={item.title} onClick={() => setEditItem(item)} />
                          )}
                        </div>
                      </div>
                      {own.map((task) => (
                        <TaskRow key={task.id} t={t} today={today} task={task} color={track.color} pale={track.pale} onClick={() => setEditTask({ task })} />
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}

            {looseTasks.length ? (
              <div>
                <div className="flex border-b border-stone-100 bg-stone-50">
                  <div className={`${LABEL_W} sticky start-0 z-10 shrink-0 border-e border-stone-200 bg-stone-50 px-3 py-1 text-xs font-black text-stone-600`}>משימות הענף</div>
                  <div className="flex-1" />
                </div>
                {looseTasks.map((task) => (
                  <TaskRow key={task.id} t={t} today={today} task={task} color="#6B807E" pale="#EFF5F5" onClick={() => setEditTask({ task })} />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {editItem ? (
        <Modal title={editItem === "new" ? "שלב או אבן דרך חדשים" : editItem.title} onClose={() => setEditItem(null)}>
          <ItemEditor
            item={editItem === "new" ? null : editItem}
            assignees={assignees}
            tasks={editItem === "new" ? [] : tasks.filter((x) => x.entity_type === PLAN_TASK && x.entity_id === editItem.id)}
            received={received}
            onAddTask={(id, start) => {
              setEditItem(null);
              setEditTask({ task: null, planItem: id, start });
            }}
            onOpenTask={(task) => {
              setEditItem(null);
              setEditTask({ task });
            }}
            onDone={async (msg) => {
              setEditItem(null);
              say(msg);
              await load();
            }}
          />
        </Modal>
      ) : null}

      {editTask ? (
        <Modal title={editTask.task ? "משימה" : "משימה חדשה"} onClose={() => setEditTask(null)}>
          <TaskForm
            task={editTask.task}
            planItems={items.map((i) => ({ id: i.id, title: i.title }))}
            assignees={assignees}
            defaultPlanItem={editTask.planItem}
            defaultStart={editTask.start}
            onCancel={() => setEditTask(null)}
            onDone={async (msg) => {
              setEditTask(null);
              say(msg);
              await load();
            }}
          />
        </Modal>
      ) : null}
    </div>
  );
}

function TaskRow({ t, today, task, color, pale, onClick }: { t: Timeline; today: string; task: BranchTask; color: string; pale: string; onClick: () => void }) {
  const done = task.status === "done";
  const late = !done && !!task.due_date && task.due_date < today;
  return (
    <div className="flex">
      <button
        type="button"
        onClick={onClick}
        className={`${LABEL_W} sticky start-0 z-10 flex shrink-0 items-center gap-1.5 border-b border-e border-stone-100 bg-white py-1 pe-3 ps-6 text-start text-[11px] hover:bg-stone-50`}
      >
        <span className={done ? "text-[#3D8C8A]" : "text-stone-300"} aria-hidden>
          {done ? "✓" : "○"}
        </span>
        <span className={`min-w-0 flex-1 truncate ${done ? "text-stone-400 line-through" : late ? "font-bold text-red-700" : "text-stone-600"}`}>{task.title}</span>
        {task.assignee ? <span className="shrink-0 text-stone-400">{task.assignee.split(" ")[0]}</span> : null}
      </button>
      <div className="relative h-7 flex-1 border-b border-stone-100">
        <Grid t={t} today={today} />
        {task.start_date ? (
          <Bar t={t} start={task.start_date} end={task.due_date} color={color} pale={pale} solid={done} late={late} label={task.title} onClick={onClick} thin />
        ) : task.due_date ? (
          <Dot t={t} date={task.due_date} color={late ? "#DC2626" : color} label={task.title} done={done} onClick={onClick} />
        ) : null}
      </div>
    </div>
  );
}

function ItemEditor({
  item,
  assignees,
  tasks,
  received,
  onAddTask,
  onOpenTask,
  onDone,
}: {
  item: PlanItem | null;
  assignees: string[];
  tasks: BranchTask[];
  received: (m: PlanItem["gate_metric"]) => number;
  onAddTask: (planItemId: string, start: string) => void;
  onOpenTask: (t: BranchTask) => void;
  onDone: (msg: string) => void | Promise<void>;
}) {
  const [kind, setKind] = useState<PlanItem["kind"]>(item?.kind ?? "phase");
  const [title, setTitle] = useState(item?.title ?? "");
  const [track, setTrack] = useState<PlanItem["track"]>(item?.track ?? "product");
  const [start, setStart] = useState(item?.start_date ?? todayIso());
  const [end, setEnd] = useState(item?.end_date ?? "");
  const [status, setStatus] = useState<PlanItem["status"]>(item?.status ?? "planned");
  const [owner, setOwner] = useState(item?.owner ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [gateOn, setGateOn] = useState(!!item?.gate_metric);
  const [metric, setMetric] = useState<NonNullable<PlanItem["gate_metric"]>>(item?.gate_metric ?? "received_net");
  const [threshold, setThreshold] = useState(item?.gate_threshold ? String(item.gate_threshold) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    const gate = kind === "milestone" && gateOn;
    const fields = {
      kind,
      title,
      track,
      start_date: start,
      end_date: kind === "phase" ? end || null : null,
      status,
      owner: owner || null,
      description: description || null,
      gate_metric: gate ? metric : null,
      gate_threshold: gate ? threshold : null,
    };
    try {
      if (item) await sendJson("/api/admin-schools/plan", { action: "update", id: item.id, ...fields });
      else await sendJson("/api/admin-schools/plan", { action: "create", ...fields });
      await onDone(item ? "נשמר." : "נוסף לתוכנית.");
    } catch (e) {
      setError(errText(e));
      setBusy(false);
    }
  }

  async function archive() {
    if (!item || !window.confirm(`להסיר את "${item.title}" מהתוכנית? המשימות שלו לא נמחקות.`)) return;
    setBusy(true);
    try {
      await sendJson("/api/admin-schools/plan", { action: "archive", id: item.id });
      await onDone("הוסר מהתוכנית.");
    } catch (e) {
      setError(errText(e));
      setBusy(false);
    }
  }

  const gate = item?.gate_metric && item.gate_threshold ? gateProgress(received(item.gate_metric), item.gate_threshold) : null;

  return (
    <div className="space-y-3">
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div> : null}
      <div className="flex gap-1.5">
        {PLAN_KINDS.map((k) => (
          <button key={k.value} type="button" onClick={() => setKind(k.value)} className={`rounded-full px-4 py-1.5 text-sm font-bold ${kind === k.value ? "bg-[#3D8C8A] text-white" : "border border-stone-200 text-stone-600"}`}>
            {k.value === "milestone" ? "◆ " : "▬ "}
            {k.label}
          </button>
        ))}
      </div>
      <Field label="שם">
        <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} autoFocus={!item} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="שורה בגנט">
          <select className={inputCls} value={track} onChange={(e) => setTrack(e.target.value as PlanItem["track"])}>
            {PLAN_TRACKS.map((tr) => (
              <option key={tr.value} value={tr.value}>
                {tr.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="מצב">
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as PlanItem["status"])}>
            {PLAN_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={kind === "milestone" ? "תאריך" : "התחלה"}>
          <input type="date" className={inputCls} value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        {kind === "phase" ? (
          <Field label="סיום">
            <input type="date" className={inputCls} value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        ) : (
          <div />
        )}
        <Field label="באחריות">
          <select className={inputCls} value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">משותף</option>
            {assignees.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
            {owner && !assignees.includes(owner) ? <option value={owner}>{owner}</option> : null}
          </select>
        </Field>
      </div>
      <Field label="מה זה כולל">
        <textarea className={inputCls} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} />
      </Field>

      {kind === "milestone" ? (
        <div className="rounded-xl border border-[#F0D9A8] bg-[#FDF6E3] p-3 text-sm">
          <label className="flex items-center gap-2 font-bold text-stone-800">
            <input type="checkbox" checked={gateOn} onChange={(e) => setGateOn(e.target.checked)} />
            שער כספי: אבן הדרך נפתחת כשנכנס סכום מסוים
          </label>
          {gateOn ? (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <select className={inputCls} value={metric} onChange={(e) => setMetric(e.target.value as NonNullable<PlanItem["gate_metric"]>)}>
                {GATE_METRICS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <input className={inputCls} inputMode="decimal" placeholder='סף בש"ח' value={threshold} onChange={(e) => setThreshold(e.target.value)} />
            </div>
          ) : null}
          {gate ? (
            <div className="mt-2 text-xs text-stone-600">
              נכנסו עד היום {shekel(received(item!.gate_metric))}. {gate.reached ? "השער נפתח." : `חסרים ${shekel(gate.missing)}.`}
            </div>
          ) : null}
        </div>
      ) : null}

      {item ? (
        <div className="rounded-xl border border-stone-200 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-sm font-black text-stone-800">{item.kind === "milestone" ? "משימות לאבן הדרך" : "משימות בשלב הזה"} ({tasks.length})</div>
            <button type="button" onClick={() => onAddTask(item.id, item.start_date > todayIso() ? item.start_date : todayIso())} className={btnGhost}>
              + משימה
            </button>
          </div>
          {tasks.length ? (
            <ul className="space-y-1 text-sm">
              {tasks.map((task) => (
                <li key={task.id}>
                  <button type="button" onClick={() => onOpenTask(task)} className="flex w-full items-center gap-2 text-start hover:underline">
                    <span aria-hidden>{task.status === "done" ? "✓" : "○"}</span>
                    <span className={`flex-1 truncate ${task.status === "done" ? "text-stone-400 line-through" : "text-stone-700"}`}>{task.title}</span>
                    <span className="shrink-0 text-xs text-stone-400">
                      {task.assignee ?? ""} {task.due_date ? `· ${hebDate(task.due_date)}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-stone-500">אין עדיין משימות. משימה עם תאריכים מופיעה בגנט מתחת לשלב.</p>
          )}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={save} disabled={busy} className={btnPrimary}>
          {busy ? "שומר..." : item ? "שמירה" : "הוספה לתוכנית"}
        </button>
        {item ? (
          <button type="button" onClick={archive} disabled={busy} className="rounded-full border border-red-200 px-3 py-1 text-xs font-bold text-red-700 hover:bg-red-50">
            הסרה מהתוכנית
          </button>
        ) : null}
        {item ? <span className="ms-auto text-[11px] text-stone-400">נוצר על ידי {item.created_by} · עודכן {hebDate(item.updated_at)}</span> : null}
      </div>
    </div>
  );
}
