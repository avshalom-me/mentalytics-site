-- Retire bump_research_count
-- ==========================
-- Superseded by record_quiz_scoring (20260918b_record_quiz_scoring.sql), whose
-- header explains why: the old function let a suicidality count be tied back to
-- the scoring that caused it. Dropped only after production switched over - the
-- deployment of 54d8124 was confirmed live (its instrument hash, 513bf2eecc, came
-- back from the score API) before this ran, so no count written by the previous
-- build was lost in between.
drop function if exists public.bump_research_count(text, text);
