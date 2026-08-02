-- Verifiable credentials on a therapist profile: the Ministry of Health
-- psychologist registry number, and links to peer-reviewed publications.
--
-- Why: mental health is YMYL, where Google weighs "who is behind this" more
-- heavily than anywhere else. Until now the site asserted "all therapists are
-- verified" with nothing a reader or a crawler could check. A registry number
-- is checkable against the public registry, and a paper in an indexed journal
-- is checkable by DOI. No Israeli competitor surfaces either.
--
-- Both are optional and self-declared. The registry number is displayed as the
-- therapist entered it - it is not validated against the registry here, so the
-- UI must not word it as if the site verified it.

ALTER TABLE public.therapists
  ADD COLUMN IF NOT EXISTS license_number text,
  -- Free-form URLs to the therapist's own publications / professional writing.
  ADD COLUMN IF NOT EXISTS publication_links text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.therapists.license_number IS
  'מספר רישום בפנקס המקצוע (מוצהר על ידי המטפל, לא מאומת אוטומטית)';
COMMENT ON COLUMN public.therapists.publication_links IS
  'קישורים לפרסומים מקצועיים שהמטפל כתב (URLs)';

-- Cap the array so a profile cannot become a link farm. Ten is well above what
-- any real therapist lists and far below anything that looks like spam.
ALTER TABLE public.therapists
  DROP CONSTRAINT IF EXISTS therapists_publication_links_max;
ALTER TABLE public.therapists
  ADD CONSTRAINT therapists_publication_links_max
  CHECK (array_length(publication_links, 1) IS NULL OR array_length(publication_links, 1) <= 10);

-- Per docs: every new migration grants explicitly to service_role.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.therapists TO service_role;
