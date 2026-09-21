-- Allow the authenticated Data API role to read legal entities.
-- Row-level security remains the authorization boundary via the existing
-- "members can read legal entities" policy.
grant select on table public.legal_entities to authenticated;
