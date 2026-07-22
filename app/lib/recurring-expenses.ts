import { supabaseAdmin } from "./supabaseAdmin";
import { fetchAllRows } from "./fetch-all-rows";

// Recurring (fixed) monthly expenses: `recurring_expenses` rows are templates
// that materialize into real `expenses` rows, one per month, on the template's
// day-of-month (clamped in shorter months: started on the 31st → Feb 28).
// Materialization is lazy — the finance read routes call it before reading —
// and idempotent via the unique (recurring_id, recurring_occurrence) index.

export type RecurringExpense = {
  id: string;
  start_date: string;
  months_total: number | null;
  category: string;
  vendor: string | null;
  description: string | null;
  amount: number;
  vat_amount: number | null;
  is_rnd: boolean;
  channel: string | null;
  note: string | null;
  active: boolean;
  created_by: string;
  created_at: string;
};

// Hard stop per template (50 years of months) — safety net against bad dates.
const MAX_OCCURRENCES = 600;

export function occurrenceDate(startDate: string, occurrence: number): string {
  const [y, m, d] = startDate.split("-").map(Number);
  const monthIndex = y * 12 + (m - 1) + occurrence;
  const yy = Math.floor(monthIndex / 12);
  const mm = monthIndex % 12; // 0-based
  const daysInMonth = new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate();
  const dd = Math.min(d, daysInMonth);
  return `${yy}-${String(mm + 1).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

// First occurrence strictly after `today`, or null when a capped template is done.
export function nextOccurrence(r: Pick<RecurringExpense, "start_date" | "months_total">, today: string): string | null {
  const limit = Math.min(r.months_total ?? MAX_OCCURRENCES, MAX_OCCURRENCES);
  for (let i = 0; i < limit; i++) {
    const date = occurrenceDate(r.start_date, i);
    if (date > today) return date;
  }
  return null;
}

// How many occurrences are due by `today` (date arrived, capped by months_total).
export function occurrencesDue(r: Pick<RecurringExpense, "start_date" | "months_total">, today: string): number {
  const limit = Math.min(r.months_total ?? MAX_OCCURRENCES, MAX_OCCURRENCES);
  let n = 0;
  for (let i = 0; i < limit; i++) {
    if (occurrenceDate(r.start_date, i) > today) break;
    n++;
  }
  return n;
}

// Insert every due-but-missing occurrence of every active template. Best-effort:
// failures are logged, never thrown — the finance screen should still render.
export async function materializeRecurringExpenses(): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data: templates, error } = await supabaseAdmin
      .from("recurring_expenses")
      .select("*")
      .eq("active", true)
      .lte("start_date", today);
    if (error) throw new Error(error.message);
    if (!templates?.length) return;

    const existing = await fetchAllRows<{ recurring_id: string; recurring_occurrence: number }>(() =>
      supabaseAdmin
        .from("expenses")
        .select("recurring_id, recurring_occurrence")
        .in("recurring_id", templates.map((t) => t.id))
    );
    const have = new Set(existing.map((e) => `${e.recurring_id}:${e.recurring_occurrence}`));

    const inserts = [];
    for (const t of templates as RecurringExpense[]) {
      const due = occurrencesDue(t, today);
      for (let i = 0; i < due; i++) {
        if (have.has(`${t.id}:${i}`)) continue;
        inserts.push({
          expense_date: occurrenceDate(t.start_date, i),
          category: t.category,
          vendor: t.vendor,
          description: t.description,
          amount: t.amount,
          vat_amount: t.vat_amount,
          is_rnd: t.is_rnd,
          channel: t.channel,
          note: t.note,
          created_by: t.created_by,
          recurring_id: t.id,
          recurring_occurrence: i,
        });
      }
    }
    if (!inserts.length) return;

    // Concurrent readers may race here — ON CONFLICT DO NOTHING keeps it safe.
    const { error: insErr } = await supabaseAdmin.from("expenses").upsert(inserts, {
      onConflict: "recurring_id,recurring_occurrence",
      ignoreDuplicates: true,
    });
    if (insErr) throw new Error(insErr.message);
  } catch (e) {
    console.error("recurring expenses materialization failed:", e instanceof Error ? e.message : e);
  }
}
