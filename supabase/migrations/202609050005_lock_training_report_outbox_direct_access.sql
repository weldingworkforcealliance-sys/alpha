-- Training report envelopes are accessed only through SECURITY DEFINER RPCs.
-- Keep RLS deny-by-default and remove direct PostgREST table privileges from app roles.

revoke all privileges on table public.training_report_outbox from anon, authenticated;
