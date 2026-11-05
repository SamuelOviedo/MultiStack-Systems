-- =============================================================================
-- Fix S4 (rate limiting) — per-sender attempt log for the public contact form
--
-- send-contact-email records one row per attempt with a keyed hash of the
-- client IP (HMAC; the raw address is never stored) and rejects senders above
-- the per-IP limit, so changing the e-mail address no longer resets the limit.
-- Rows older than 24 h are purged by the function itself.
--
-- Access: service role only. RLS is enabled with no policies and the API roles
-- have no privileges, so the table is invisible through the public API.
-- =============================================================================

CREATE TABLE public.contact_rate_events (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bucket     text NOT NULL CHECK (char_length(bucket) <= 80),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX contact_rate_events_bucket_time ON public.contact_rate_events (bucket, created_at DESC);
CREATE INDEX contact_rate_events_time        ON public.contact_rate_events (created_at);

ALTER TABLE public.contact_rate_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contact_rate_events FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.contact_rate_events IS
  'Contact-form attempts per keyed IP hash (S4). Service role only; purged after 24 h.';
