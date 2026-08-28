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
 */

var ENDPOINT = 'https://www.mentalytics.co.il/api/ads-sync';
var SECRET = 'PASTE_ADS_SYNC_SECRET_HERE'; // from Vercel env ADS_SYNC_SECRET
var LOOKBACK = 'LAST_7_DAYS';

function main() {
  var payload = {
    campaigns_daily: query(
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
      }),

    campaign_config: campaignConfig(),

    keywords_daily: query(
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
      }),

    keyword_status: query(
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
      }),

    search_terms_daily: query(
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

// The CPC ceiling lives on campaign.target_spend (Maximize clicks). Some
// accounts/campaign types reject that field in GAQL, so fall back to the same
// query without it rather than losing the whole config snapshot.
function campaignConfig() {
  var base =
    "SELECT campaign.id, campaign.name, campaign.status, campaign.end_date, " +
    "campaign.bidding_strategy_type, campaign_budget.amount_micros, " +
    "campaign_budget.total_amount_micros";
  var withCeiling = base + ", campaign.target_spend.cpc_bid_ceiling_micros" +
    " FROM campaign WHERE campaign.status IN ('ENABLED','PAUSED')";
  var withoutCeiling = base + " FROM campaign WHERE campaign.status IN ('ENABLED','PAUSED')";

  function map(r, hasCeiling) {
    var budget = r.campaignBudget || {};
    var ts = r.campaign.targetSpend || {};
    return {
      id: r.campaign.id,
      name: r.campaign.name,
      status: r.campaign.status,
      end_date: r.campaign.endDate || null,
      bidding_strategy: r.campaign.biddingStrategyType,
      daily_budget_micros: budget.amountMicros != null ? budget.amountMicros : null,
      total_budget_micros: budget.totalAmountMicros != null ? budget.totalAmountMicros : null,
      cpc_ceiling_micros: hasCeiling && ts.cpcBidCeilingMicros != null ? ts.cpcBidCeilingMicros : null,
    };
  }

  try {
    return query(withCeiling, function (r) { return map(r, true); });
  } catch (e) {
    Logger.log('cpc ceiling field unavailable (%s), retrying without it', e);
    return query(withoutCeiling, function (r) { return map(r, false); });
  }
}

function query(gaql, mapRow) {
  var out = [];
  var it = AdsApp.search(gaql);
  while (it.hasNext()) {
    try {
      out.push(mapRow(it.next()));
    } catch (e) {
      Logger.log('row skipped: ' + e);
    }
  }
  return out;
}
