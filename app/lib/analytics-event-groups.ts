/**
 * The admin analytics report reads analytics_events one row per event. The
 * database now sends them grouped (admin_analytics_event_groups): one row per
 * distinct combination of the fields the report reads, with a count. This turns
 * the groups back into one row per event, so the report's aggregation code runs
 * unchanged whichever way the events were fetched.
 */

/** One analytics event, in the shape /api/admin-analytics aggregates. */
export type AnalyticsEventRow = {
  event_type: string;
  therapist_id: string | null;
  metadata: Record<string, string>;
  created_at: string;
};

/** Positional columns of admin_analytics_event_groups - see its migration. */
export type EventGroup = [
  event_type: string,
  week: string | null,
  therapist_id: string | null,
  page: unknown,
  quiz_type: unknown,
  step: unknown,
  filter_value: unknown,
  questionnaire_type: unknown,
  treatment_label: unknown,
  viewer_age_band: unknown,
  viewer_gender: unknown,
  viewer_region: unknown,
  domain: unknown,
  n: number,
];

const GROUP_METADATA_KEYS = [
  "page", "quiz_type", "step", "filter_value", "questionnaire_type", "treatment_label",
  "viewer_age_band", "viewer_gender", "viewer_region", "domain",
] as const;

/**
 * One row per event, in the order each group first occurred - which is also the
 * order in which every name, step and therapist first appears, the tie-break of
 * each sort in the report.
 *
 * A row carries only what the report reads: metadata holds just the keys the
 * SQL projected for that event type (a JSON null reads the same as a missing key
 * in every check there), and created_at is the group's week, a Monday. The
 * report's only use of the timestamp is getWeek(), which maps a Monday to itself.
 * Rows of one group share one object; the report never mutates them.
 */
export function expandEventGroups(groups: EventGroup[]): AnalyticsEventRow[] {
  const events: AnalyticsEventRow[] = [];
  for (const g of groups) {
    const metadata: Record<string, unknown> = {};
    GROUP_METADATA_KEYS.forEach((key, i) => {
      const value = g[3 + i];
      if (value !== null && value !== undefined) metadata[key] = value;
    });
    const row: AnalyticsEventRow = {
      event_type: g[0],
      therapist_id: g[2] ?? null,
      metadata: metadata as Record<string, string>,
      // Unused for event types without a week; a Monday, so harmless anyway.
      created_at: g[1] ?? "1970-01-05",
    };
    const n = Number(g[13]) || 0;
    for (let i = 0; i < n; i++) events.push(row);
  }
  return events;
}
