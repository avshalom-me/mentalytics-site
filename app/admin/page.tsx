"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import HelpTip from "./components/HelpTip";
import { labelOf, LEAD_TYPES } from "@/app/lib/crm";

type GuaranteeRow = {
  therapist_id: string;
  full_name: string;
  days_left: number;
  contacts_in_window: number;
  risk: string;
};

type DueTask = {
  id: string;
  title: string;
  entity_label: string | null;
  due_date: string | null;
  priority: string;
};

type NewLead = {
  id: string;
  lead_type: string;
  name: string | null;
  contact: string | null;
  created_at: string;
};

type PlanTarget = { metric: string; month: string; scenario: string; target: number };

type Dashboard = {
  kpis: {
    paying_count: number;
    listed_count: number;
    contacts_7d: number;
    new_leads_count: number;
    open_tasks_count: number;
    quiz_completes_month: number;
  };
  queue: {
    pending_review: { id: string; full_name: string | null; created_at: string | null }[];
    pending_review_count: number;
    paying_unapproved: { id: string; full_name: string | null }[];
    guarantee_attention: GuaranteeRow[];
    guarantee_attention_count: number;
    due_tasks: DueTask[];
    new_leads: NewLead[];
    failed_payments: { therapist_id: string; full_name: string; amount: number; created_at: string }[];
    partials_count: number;
    partials_never_reminded_count: number;
    pending_articles_count: number;
  };
  plan: {
    targets: PlanTarget[];
    actuals: { therapists_total: number; questionnaires_month: number; teachers_total: number };
  };
};

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}`;
}

// The next milestone at-or-after the current month, or the last one if the
// plan horizon has passed.
function nextTarget(targets: PlanTarget[], metric: string, scenario: string): PlanTarget | null {
  const rows = targets
    .filter((t) => t.metric === metric && t.scenario === scenario)
    .sort((a, b) => (a.month < b.month ? -1 : 1));
  if (rows.length === 0) return null;
  const nowMonth = new Date().toISOString().slice(0, 7);
  return rows.find((r) => r.month.slice(0, 7) >= nowMonth) ?? rows[rows.length - 1];
}

function monthName(iso: string): string {
  const months = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
  const d = new Date(iso);
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyTask, setBusyTask] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    fetch("/api/admin-crm/dashboard")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setData(j);
        else setError(j.error || "שגיאה בטעינה");
      })
      .catch(() => setError("שגיאה בטעינה"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function completeTask(id: string) {
    setBusyTask(id);
    try {
      await fetch("/api/admin-crm/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "done" }),
      });
      load();
    } finally {
      setBusyTask(null);
    }
  }

  const q = data?.queue;
  const queueEmpty =
    q &&
    q.guarantee_attention.length === 0 &&
    q.pending_review_count === 0 &&
    q.paying_unapproved.length === 0 &&
    q.due_tasks.length === 0 &&
    q.new_leads.length === 0 &&
    q.failed_payments.length === 0 &&
    q.partials_never_reminded_count === 0 &&
    q.pending_articles_count === 0;

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-black text-stone-900">
            לוח בקרה <HelpTip id="dashboard" />
          </h1>
          <button
            onClick={load}
            disabled={loading}
            className="rounded-full border border-stone-200 bg-white px-4 py-1.5 text-sm font-bold text-stone-600 hover:bg-stone-100 disabled:opacity-50"
          >
            {loading ? "טוען…" : "רענון"}
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {data && (
          <>
            {/* KPI row */}
            <div className="mb-2 flex items-center gap-2 text-sm font-black text-stone-500">
              מדדי מפתח <HelpTip id="kpis" />
            </div>
            <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Kpi label="משלמים" value={data.kpis.paying_count} accent />
              <Kpi label="מוצגים באתר" value={data.kpis.listed_count} />
              <Kpi label="פניות 7 ימים" value={data.kpis.contacts_7d} />
              <Kpi label="לידים חדשים" value={data.kpis.new_leads_count} link="/admin/leads" />
              <Kpi label="משימות פתוחות" value={data.kpis.open_tasks_count} link="/admin/tasks" />
              <Kpi label="שאלונים החודש" value={data.kpis.quiz_completes_month} />
            </div>

            {/* Work queue */}
            <div className="mb-2 flex items-center gap-2 text-sm font-black text-stone-500">
              תור עבודה להיום <HelpTip id="work-queue" />
            </div>
            <div className="mb-8 overflow-hidden rounded-2xl border border-stone-200 bg-white">
              {queueEmpty && (
                <div className="p-6 text-center text-sm text-stone-400">
                  התור ריק — הכול מטופל 🎉
                </div>
              )}

              {q!.guarantee_attention.map((g) => (
                <QueueRow
                  key={`g-${g.therapist_id}`}
                  tone={g.risk === "expired_no_contact" ? "red" : "amber"}
                  icon="🛡️"
                  title={
                    g.risk === "expired_no_contact"
                      ? `${g.full_name} — חלון הביטחון נסגר ללא פנייה`
                      : `${g.full_name} — ${g.contacts_in_window} פניות, נותרו ${g.days_left} ימים בחלון הביטחון`
                  }
                  action={{ label: "למעקב ביטחון", href: "/admin/guarantee" }}
                />
              ))}

              {q!.paying_unapproved.map((t) => (
                <QueueRow
                  key={`pu-${t.id}`}
                  tone="amber"
                  icon="⭐"
                  title={`${t.full_name || "מטפל/ת"} — שילם/ה וממתין/ה לאישור פרסום`}
                  action={{ label: "לאישור", href: "/admin/therapists" }}
                />
              ))}

              {q!.pending_review_count > 0 && (
                <QueueRow
                  tone="amber"
                  icon="⏳"
                  title={`${q!.pending_review_count} פרופילים ממתינים לבדיקה ואישור`}
                  subtitle={q!.pending_review
                    .slice(0, 3)
                    .map((t) => t.full_name)
                    .filter(Boolean)
                    .join(" · ")}
                  action={{ label: "לרשימה", href: "/admin/therapists" }}
                />
              )}

              {q!.due_tasks.map((t) => (
                <QueueRow
                  key={`t-${t.id}`}
                  tone="blue"
                  icon="🔔"
                  title={t.title}
                  subtitle={[t.entity_label, t.due_date ? `יעד: ${fmtDate(t.due_date)}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                  action={{
                    label: busyTask === t.id ? "…" : "בוצע ✓",
                    onClick: () => completeTask(t.id),
                  }}
                />
              ))}

              {q!.new_leads.map((l) => (
                <QueueRow
                  key={`l-${l.id}`}
                  tone="blue"
                  icon="📥"
                  title={`ליד חדש (${labelOf(LEAD_TYPES, l.lead_type)}): ${l.name || l.contact || ""}`}
                  subtitle={fmtDate(l.created_at)}
                  action={{ label: "ללידים", href: "/admin/leads" }}
                />
              ))}

              {q!.failed_payments.map((p, i) => (
                <QueueRow
                  key={`fp-${i}`}
                  tone="red"
                  icon="💳"
                  title={`חיוב נכשל — ${p.full_name || p.therapist_id} (₪${p.amount})`}
                  subtitle={fmtDate(p.created_at)}
                  action={{ label: "למטפלים", href: "/admin/therapists" }}
                />
              ))}

              {q!.partials_never_reminded_count > 0 && (
                <QueueRow
                  tone="stone"
                  icon="📄"
                  title={`${q!.partials_never_reminded_count} פרופילים חלקיים שטרם קיבלו תזכורת (${q!.partials_count} חלקיים סה"כ)`}
                  action={{ label: "לטיפול", href: "/admin/therapists" }}
                />
              )}

              {q!.pending_articles_count > 0 && (
                <QueueRow
                  tone="stone"
                  icon="📝"
                  title={`${q!.pending_articles_count} מאמרים ממתינים לעריכה`}
                  action={{ label: "למאמרים", href: "/admin/articles" }}
                />
              )}
            </div>

            {/* Plan vs actual */}
            <div className="mb-2 flex items-center gap-2 text-sm font-black text-stone-500">
              בפועל מול התוכנית <HelpTip id="plan" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <PlanCard
                label="מטפלים באתר"
                actual={data.plan.actuals.therapists_total}
                optimistic={nextTarget(data.plan.targets, "therapists_total", "optimistic")}
                pessimistic={nextTarget(data.plan.targets, "therapists_total", "pessimistic")}
              />
              <PlanCard
                label="שאלונים החודש"
                actual={data.plan.actuals.questionnaires_month}
                optimistic={nextTarget(data.plan.targets, "questionnaires_month", "base")}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, accent, link }: { label: string; value: number; accent?: boolean; link?: string }) {
  const inner = (
    <div
      className={`rounded-xl border p-3 ${
        accent ? "border-teal-200 bg-teal-50" : "border-stone-200 bg-white"
      } ${link ? "transition-colors hover:border-stone-300" : ""}`}
    >
      <div className="text-xs text-stone-500">{label}</div>
      <div className={`text-2xl font-black ${accent ? "text-teal-700" : "text-stone-900"}`}>{value}</div>
    </div>
  );
  return link ? <Link href={link}>{inner}</Link> : inner;
}

const TONE_CLS: Record<string, string> = {
  red: "bg-red-50 text-red-700",
  amber: "bg-amber-50 text-amber-700",
  blue: "bg-blue-50 text-blue-700",
  stone: "bg-stone-100 text-stone-500",
};

function QueueRow({
  tone,
  icon,
  title,
  subtitle,
  action,
}: {
  tone: string;
  icon: string;
  title: string;
  subtitle?: string | null;
  action?: { label: string; href?: string; onClick?: () => void };
}) {
  return (
    <div className="flex items-center gap-3 border-b border-stone-100 px-4 py-3 last:border-b-0">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${TONE_CLS[tone] ?? TONE_CLS.stone}`}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-stone-800">{title}</div>
        {subtitle && <div className="truncate text-xs text-stone-400">{subtitle}</div>}
      </div>
      {action &&
        (action.href ? (
          <Link
            href={action.href}
            className="shrink-0 rounded-full border border-stone-200 px-3 py-1 text-xs font-bold text-stone-600 hover:bg-stone-100"
          >
            {action.label}
          </Link>
        ) : (
          <button
            onClick={action.onClick}
            className="shrink-0 rounded-full border border-stone-200 px-3 py-1 text-xs font-bold text-stone-600 hover:bg-stone-100"
          >
            {action.label}
          </button>
        ))}
    </div>
  );
}

function PlanCard({
  label,
  actual,
  optimistic,
  pessimistic,
}: {
  label: string;
  actual: number;
  optimistic: PlanTarget | null;
  pessimistic?: PlanTarget | null;
}) {
  if (!optimistic) return null;
  const pct = Math.min(100, Math.round((actual / Number(optimistic.target)) * 100));
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-sm font-bold text-stone-700">{label}</span>
        <span className="text-xs text-stone-400">יעד {monthName(optimistic.month)}</span>
      </div>
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-2xl font-black text-stone-900">{actual}</span>
        <span className="text-sm text-stone-400">
          / {Number(optimistic.target)}
          {pessimistic ? ` (פסימי: ${Number(pessimistic.target)})` : ""}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-stone-100">
        <div className="h-full rounded-full bg-teal-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-xs text-stone-400">{pct}% מהיעד האופטימי</div>
    </div>
  );
}
