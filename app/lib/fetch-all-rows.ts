/**
 * Fetch ALL rows for a Supabase query, paging past PostgREST's per-response
 * row cap (db-max-rows, 1000 on this project).
 *
 * A plain `.select()` silently returns at most 1000 rows, so any code that
 * then counts/aggregates the result in JS undercounts once the set exceeds
 * 1000 (it freezes at exactly 1000). Use this for analytics aggregations that
 * genuinely need the rows. For a pure total, prefer `{ count: 'exact', head:
 * true }`; for grouped counts on very large tables, prefer a SQL aggregation
 * (RPC) over fetching everything.
 *
 * Paging is PARALLEL past the first page: sequential paging cost one network
 * round-trip per 1000 rows, which put /api/admin-analytics (analytics_events
 * is tens of thousands of rows) at 20-30s wall time. Page 0 is fetched alone -
 * a small table stays a single request - and only if it comes back full do we
 * fan out in waves of concurrent range requests.
 *
 * Pass a THUNK that builds a fresh query each call - `.range()` must be applied
 * to a clean builder, and an awaited builder can't be reused.
 *
 *   const rows = await fetchAllRows<{ channel: string | null }>(
 *     () => supabaseAdmin.from("therapist_profile_views").select("channel"),
 *   );
 */

type RangeQuery<T> = {
  range: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
};

const PAGE_SIZE = 1000;
// Concurrent range requests per wave once the table is known to exceed one page.
const WAVE_PAGES = 10;
// Backstop so a runaway/huge table can't spin forever. Past this, the call site
// should aggregate in SQL instead of fetching every row.
const MAX_ROWS = 200_000;

export async function fetchAllRows<T>(buildQuery: () => RangeQuery<T>): Promise<T[]> {
  const rows: T[] = [];

  // First page alone: most tables fit in it, and it tells us whether to fan out.
  const first = await buildQuery().range(0, PAGE_SIZE - 1);
  if (first.error) throw new Error(first.error.message);
  rows.push(...(first.data ?? []));
  if ((first.data ?? []).length < PAGE_SIZE) return rows;

  // Waves of concurrent pages. Pages are contiguous and Promise.all preserves
  // order, so concatenation keeps row order; the first short page marks the end
  // of the set (pages beyond it are empty).
  outer: for (let waveStart = PAGE_SIZE; waveStart < MAX_ROWS; waveStart += PAGE_SIZE * WAVE_PAGES) {
    const offsets = Array.from({ length: WAVE_PAGES }, (_, i) => waveStart + i * PAGE_SIZE);
    const results = await Promise.all(
      offsets.map((from) => buildQuery().range(from, from + PAGE_SIZE - 1)),
    );
    for (const { data, error } of results) {
      if (error) throw new Error(error.message);
      const batch = data ?? [];
      rows.push(...batch);
      if (batch.length < PAGE_SIZE) break outer;
    }
  }

  // If we stopped on the backstop rather than a short page, the result may be
  // truncated silently - log loudly so it's caught before it skews a report.
  if (rows.length >= MAX_ROWS) {
    console.warn(
      `fetchAllRows: hit the ${MAX_ROWS}-row backstop - result may be truncated. ` +
        `Aggregate this query in SQL (COUNT/GROUP BY via RPC) instead of paging.`,
    );
  }

  return rows;
}
