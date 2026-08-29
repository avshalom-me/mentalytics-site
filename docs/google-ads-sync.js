/**
 * Mentalytics ads-console sync
 * ----------------------------
 * Paste into Google Ads > Tools > Scripts, fill SECRET, authorize once,
 * and schedule Daily (e.g. 05:00). Full instructions: docs/ads-console-setup.md.
 *
 * Every run re-sends the trailing LOOKBACK window; the site endpoint upserts
 * on natural keys, so re-runs are harmless and late-arriving cost data heals.
 *
 * Read-only by design: this script only SELECTs and POSTs outward. It never
 * mutates the account, and no Google credential ever leaves Google - the only
 * secret involved is a write-only token for our own ingest endpoint.
 *
 * Resilience contract: every payload section is built inside section(), so a
 * query the Scripts runtime rejects degrades that one section to [] and the
 * sync still delivers the rest. Campaign config avoids GAQL entirely - the
 * Scripts GAQL engine rejected campaign.end_date outright (UNRECOGNIZED_FIELD,
 * seen live 29/08/26), so config reads through the stable object API instead.
 */

var ENDPOINT = 'https://www.mentalytics.co.il/api/ads-sync';
var SECRET = 'PASTE_ADS_SYNC_SECRET_HERE'; // from Vercel env ADS_SYNC_SECRET
var LOOKBACK = 'LAST_7_DAYS';

function main() {
  var payload = {
    campaigns_daily: section('campaigns_daily', function () {
      return query(
        "SELECT segments.date, campaign.id, campaign.name, metrics.impressions, " +
        "metrics.clicks, metrics.cost_micros, metrics.conversions " +
        "FROM campaign WHERE segments.date DURING " + LOOKBACK,
        function (r) {
          return {
            date: r.segments.date,
            id: r.campaign.id,
            name: r.campaign.name,
            impressions: r.metrics.impressions,
            clicks: r.metrics.clicks,
            cost_micros: r.metrics.costMicros,
            conversions: r.metrics.conversions,
          };
        });
    }),

    campaign_config: section('campaign_config', campaignConfig),

    keywords_daily: section('keywords_daily', function () {
      return query(
        "SELECT segments.date, campaign.name, ad_group.name, " +
        "ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, " +
        "metrics.impressions, metrics.clicks, metrics.cost_micros " +
        "FROM keyword_view WHERE segments.date DURING " + LOOKBACK,
        function (r) {
          return {
            date: r.segments.date,
            campaign: r.campaign.name,
            ad_group: r.adGroup.name,
            keyword: r.adGroupCriterion.keyword.text,
            match_type: r.adGroupCriterion.keyword.matchType,
            impressions: r.metrics.impressions,
            clicks: r.metrics.clicks,
            cost_micros: r.metrics.costMicros,
          };
        });
    }),

    keyword_status: section('keyword_status', function () {
      return query(
        "SELECT campaign.name, ad_group.name, ad_group_criterion.keyword.text, " +
        "ad_group_criterion.keyword.match_type, ad_group_criterion.status, " +
        "ad_group_criterion.system_serving_status " +
        "FROM ad_group_criterion " +
        "WHERE ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.status != 'REMOVED'",
        function (r) {
          return {
            campaign: r.campaign.name,
            ad_group: r.adGroup.name,
            keyword: r.adGroupCriterion.keyword.text,
            match_type: r.adGroupCriterion.keyword.matchType,
            status: r.adGroupCriterion.status,
            serving_status: r.adGroupCriterion.systemServingStatus,
          };
        });
    }),

    search_terms_daily: section('search_terms_daily', function () {
      return query(
        "SELECT segments.date, campaign.name, search_term_view.search_term, " +
        "metrics.impressions, metrics.clicks, metrics.cost_micros " +
        "FROM search_term_view WHERE segments.date DURING " + LOOKBACK,
        function (r) {
          return {
            date: r.segments.date,
            campaign: r.campaign.name,
            term: r.searchTermView.searchTerm,
            impressions: r.metrics.impressions,
            clicks: r.metrics.clicks,
            cost_micros: r.metrics.costMicros,
          };
        });
    }),
  };

  var body = JSON.stringify(payload);
  Logger.log('Payload: campaigns=%s config=%s keywords=%s kw_status=%s terms=%s bytes=%s',
    payload.campaigns_daily.length, payload.campaign_config.length,
    payload.keywords_daily.length, payload.keyword_status.length,
    payload.search_terms_daily.length, body.length);

  var res = UrlFetchApp.fetch(ENDPOINT, {
    method: 'post',
    contentType: 'application/json',
    payload: body,
    headers: { 'x-ads-sync-secret': SECRET },
    muteHttpExceptions: true,
  });
  Logger.log('Sync response %s: %s', res.getResponseCode(), res.getContentText());
  if (res.getResponseCode() !== 200) {
    throw new Error('ads-sync failed with HTTP ' + res.getResponseCode());
  }
}

// A section that fails sends [] instead of killing the whole sync. The log
// line makes the gap visible in Script history without costing the night's
// cost data for everything else.
function section(name, fn) {
  try {
    return fn();
  } catch (e) {
    Logger.log('section %s failed, sending empty: %s', name, e);
    return [];
  }
}

// Campaign config via the object API, not GAQL. Every accessor is feature-
// tested (typeof) because the Scripts object model varies by entity age and
// account: a missing getter yields null for that field, never a crash.
function campaignConfig() {
  var out = [];
  var it = AdsApp.campaigns().withCondition('Status IN [ENABLED, PAUSED]').get();
  while (it.hasNext()) {
    var c = it.next();
    var budget = safeCall(c, 'getBudget');
    out.push({
      id: safeCall(c, 'getId'),
      name: safeCall(c, 'getName'),
      status: c.isPaused() ? 'PAUSED' : 'ENABLED',
      end_date: formatAdsDate(safeCall(c, 'getEndDate')),
      bidding_strategy: safeCall(c, 'getBiddingStrategyType'),
      daily_budget_micros: toMicros(safeCall(budget, 'getAmount')),
      total_budget_micros: toMicros(safeCall(budget, 'getTotalAmount')),
      cpc_ceiling_micros: null, // filled below when the GAQL engine allows it
    });
  }

  // The CPC ceiling (Maximize clicks bid limit) has no object-API getter, so
  // try a minimal GAQL probe for it. If this account's engine rejects the
  // field too, the ceiling stays null and everything else still ships.
  try {
    var ceilings = {};
    query(
      "SELECT campaign.id, campaign.target_spend.cpc_bid_ceiling_micros " +
      "FROM campaign WHERE campaign.status IN ('ENABLED','PAUSED')",
      function (r) {
        var ts = r.campaign.targetSpend || {};
        if (ts.cpcBidCeilingMicros != null) ceilings[r.campaign.id] = ts.cpcBidCeilingMicros;
        return null;
      });
    for (var i = 0; i < out.length; i++) {
      if (ceilings[out[i].id] != null) out[i].cpc_ceiling_micros = ceilings[out[i].id];
    }
  } catch (e) {
    Logger.log('cpc ceiling probe unavailable, leaving null: %s', e);
  }

  return out;
}

// obj.method() if it exists, else null - never a crash on a missing getter.
function safeCall(obj, method) {
  try {
    return obj && typeof obj[method] === 'function' ? obj[method]() : null;
  } catch (e) {
    return null;
  }
}

// The object API returns dates as {year, month, day} - historically with
// direct properties, in places as getters. Emit YYYY-MM-DD or null.
function formatAdsDate(d) {
  if (!d) return null;
  var y = typeof d.getYear === 'function' ? d.getYear() : d.year;
  var m = typeof d.getMonth === 'function' ? d.getMonth() : d.month;
  var day = typeof d.getDay === 'function' ? d.getDay() : d.day;
  if (y == null || m == null || day == null) return null;
  return y + '-' + pad2(m) + '-' + pad2(day);
}

function pad2(n) {
  n = Number(n);
  return (n < 10 ? '0' : '') + n;
}

// Budget getters return currency units (e.g. 113.33); the endpoint speaks
// micros like the GAQL metrics do.
function toMicros(amount) {
  return typeof amount === 'number' && isFinite(amount) ? Math.round(amount * 1000000) : null;
}

function query(gaql, mapRow) {
  var out = [];
  var it = AdsApp.search(gaql);
  while (it.hasNext()) {
    try {
      var mapped = mapRow(it.next());
      if (mapped != null) out.push(mapped);
    } catch (e) {
      Logger.log('row skipped: ' + e);
    }
  }
  return out;
}
