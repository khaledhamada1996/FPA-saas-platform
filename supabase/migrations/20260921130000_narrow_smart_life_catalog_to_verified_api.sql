-- Smart Life public API currently verified only for operational resources.
-- Do not advertise accounting journal / account / trial-balance support until
-- an authoritative endpoint is verified and implemented.
update public.connector_catalog
set capabilities = jsonb_build_object(
  'sync',true,
  'read_only',true,
  'incremental',false,
  'read_products',true,
  'read_vendors',true
),
supported_entities = ARRAY['products','suppliers','sales']::text[]
where connector_key='smart_life';
