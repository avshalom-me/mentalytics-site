-- The publications library (3/11/2026): every marketing piece the company puts out, in one place
-- in the admin (/admin/publications). The owner asked for it after the counsellors' set ("מצפן
-- היועצת") grew to videos on YouTube, ads, a brochure and a one-pager: from now on every
-- publication, YouTube links included, is also listed here.
--
-- Nothing here publishes anything. The files live in Dropbox and the shared Drive, the videos on
-- YouTube, the ads are scheduled by the owner in Meta; a row only says what exists and where.
--
--   campaign      the series the piece belongs to, free text ("מצפן היועצת")
--   audience      who it is for (counselors, kindergarten, parents, adults, therapists, centers,
--                 teachers, general)
--   kind          video / ad / brochure / onepager / post / article / other
--   version       the draft label the file carries ("טיוטה 7")
--   status        draft   - ready or in work, not out yet
--                 live    - out: public on YouTube, running as an ad, handed out
--                 retired - replaced by a newer version or taken down (kept, not deleted)
--   channels      where it appears or is meant to (youtube, facebook, instagram, whatsapp,
--                 email, print, pdf, web, other)
--   public_url    where the public sees it (the YouTube watch link, a post)
--   file_url      the file itself (the shared Drive), to download or pass on
--   links         where it sends people: [{label, url}], with the utm of that piece
--   published_on  the day it went out

CREATE TABLE IF NOT EXISTS public.marketing_publications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign      text NOT NULL,
  audience      text NOT NULL
    CHECK (audience IN ('counselors', 'kindergarten', 'parents', 'adults', 'therapists', 'centers', 'teachers', 'general')),
  kind          text NOT NULL
    CHECK (kind IN ('video', 'ad', 'brochure', 'onepager', 'post', 'article', 'other')),
  title         text NOT NULL,
  version       text,
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'live', 'retired')),
  channels      text[] NOT NULL DEFAULT '{}'
    CHECK (channels <@ ARRAY['youtube', 'facebook', 'instagram', 'whatsapp', 'email', 'print', 'pdf', 'web', 'other']::text[]),
  public_url    text,
  file_url      text,
  links         jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(links) = 'array'),
  notes         text,
  published_on  date,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketing_publications_campaign_idx ON public.marketing_publications (campaign, sort_order);

ALTER TABLE public.marketing_publications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON public.marketing_publications;
CREATE POLICY "Service role full access" ON public.marketing_publications
  FOR ALL TO service_role USING (true) WITH CHECK (true);
REVOKE ALL ON public.marketing_publications FROM anon, authenticated;
GRANT ALL ON public.marketing_publications TO service_role;
