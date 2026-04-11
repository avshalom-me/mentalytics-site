-- Run this in the Supabase SQL Editor
alter table therapists
  add column if not exists manually_promoted boolean not null default false;
