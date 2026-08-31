-- Which networks a campaign is allowed to serve on. Added 30/08/26 after
-- g-emek1 was found taking 100% of its clicks from the Display network while
-- its type still read "Search": the campaign type does not exclude Display
-- serving, and nothing we synced could tell them apart. These three booleans
-- make it a day-zero fact rather than something inferred from a week of
-- impressions. Null = the sync ran an older script that does not send them.
alter table ads_campaign_config
  add column if not exists net_search boolean,
  add column if not exists net_partners boolean,
  add column if not exists net_display boolean;

comment on column ads_campaign_config.net_display is
  'true = campaign may serve on the Display network. For a Search campaign this is almost always a misconfiguration (see g-emek1, Aug 2026).';
