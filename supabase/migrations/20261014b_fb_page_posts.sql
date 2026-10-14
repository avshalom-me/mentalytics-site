-- The weekly post on the company's Facebook page (14/10/2026).
--
-- Once a week the page shares one approved article by one of the site's writers.
-- Nothing here talks to Facebook: the owner copies each post from
-- /admin/fb-page-posts and schedules it himself in Meta Business Suite, a month at
-- a time. This table is the queue and its memory:
--
--   planned_on           the Israel date the post is planned for (the hour is a constant in
--                        app/lib/fb-page-posts.ts)
--   post_text            the text to copy, editable on the admin page; the link is added on copy
--   status               planned   - waiting to be scheduled in Facebook
--                        scheduled - the owner marked it as scheduled there
--                        skipped   - replaced by another article; the article never comes back
--   scheduled_marked_at  when the owner marked it
--
-- An article is shared once ever (unique article_id, skipped rows included), and a day
-- holds one live post (a replaced row leaves the day free for its replacement).

CREATE TABLE IF NOT EXISTS public.fb_page_posts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id          uuid NOT NULL REFERENCES public.therapist_articles(id) ON DELETE CASCADE,
  planned_on          date NOT NULL,
  post_text           text NOT NULL,
  status              text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'scheduled', 'skipped')),
  scheduled_marked_at timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS fb_page_posts_article_once ON public.fb_page_posts (article_id);
CREATE UNIQUE INDEX IF NOT EXISTS fb_page_posts_one_per_day ON public.fb_page_posts (planned_on) WHERE status <> 'skipped';

ALTER TABLE public.fb_page_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON public.fb_page_posts;
CREATE POLICY "Service role full access" ON public.fb_page_posts
  FOR ALL TO service_role USING (true) WITH CHECK (true);
REVOKE ALL ON public.fb_page_posts FROM anon, authenticated;
GRANT ALL ON public.fb_page_posts TO service_role;
