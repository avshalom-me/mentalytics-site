-- Newsletter consent for therapists (opt-in for informational emails, articles, and professional content)
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS newsletter_consent boolean NOT NULL DEFAULT false;
