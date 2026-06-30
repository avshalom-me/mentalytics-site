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
 * Pass a THUNK that builds a fresh query each call — `.range()` must be applied
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
// Backstop so a runaway/huge table can't spin forever. Past this, the call site
// should aggregate in SQL instead of fetching every row.
const MAX_ROWS = 200_000;

export async function fetchAllRows<T>(buildQuery: () => RangeQuery<T>): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);

    const batch = data ?? [];
    rows.push(...batch);

    // A short page means we've reached the end.
    if (batch.length < PAGE_SIZE) break;
  }

  return rows;
}
