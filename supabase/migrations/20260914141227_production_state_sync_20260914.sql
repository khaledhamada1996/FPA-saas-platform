BEGIN;

-- Canonicalize the production publish/mapping security state in version control.
-- This migration is intentionally idempotent so it can safely represent the
-- final production state after the earlier hardening migrations.

GRANT UPDATE ON TABLE public.imports TO authenticated;
GRANT SELECT ON TABLE public.financial_periods TO authenticated;

INSERT INTO public.organization_permissions
  (permission_key, name, description, permission_type, screen_key, route_path, category, sort_order)
VALUES
  ('actuals.publish', 'نشر البيانات الفعلية', 'نشر بيانات الاستيراد المعتمدة إلى دفتر البيانات الفعلية', 'action', 'actuals', '/workspace/actuals', 'actuals', 100)
ON CONFLICT (permission_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  permission_type = EXCLUDED.permission_type,
  screen_key = EXCLUDED.screen_key,
  route_path = EXCLUDED.route_path,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.organization_role_permissions (organization_id, role_key, permission_key)
SELECT DISTINCT rp.organization_id, rp.role_key, 'actuals.publish'
FROM public.organization_role_permissions rp
WHERE rp.permission_key = 'approve'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.auto_map_import_accounts(p_import_id uuid, p_mapping_version text DEFAULT 'v1'::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  v_user uuid := (select auth.uid());
  v_org uuid;
  v_status text;
  v_created integer := 0;
  v_missing integer := 0;
  v_matched integer := 0;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_import_id is null then raise exception 'Import ID is required'; end if;
  if p_mapping_version is null or btrim(p_mapping_version)='' then raise exception 'Mapping version is required'; end if;
  select organization_id,status into v_org,v_status from public.imports where id=p_import_id for update;
  if v_org is null then raise exception 'Import not found'; end if;
  if not public.has_org_permission(v_org,'import.create') and not public.has_org_permission(v_org,'mapping.create') and not public.has_org_permission(v_org,'mapping.edit') then raise exception 'Import or mapping permission required'; end if;
  if v_status not in ('mapping_required','validated') then raise exception 'Import cannot be auto-mapped from status %',v_status; end if;

  with source_accounts as (
    select distinct btrim(r.payload->>'account_code') source_code,btrim(r.payload->>'account_name') source_name
    from public.import_rows r where r.import_id=p_import_id and r.validation_status='valid'
  ), candidates as (
    select s.source_code,s.source_name,a.id target_id,count(*) over(partition by s.source_code) candidate_count,
      case when btrim(a.code)=s.source_code then 0 else 1 end match_rank
    from source_accounts s
    join public.accounts a on a.organization_id=v_org and (btrim(a.code)=s.source_code or lower(btrim(a.name))=lower(s.source_name))
  ), chosen as (
    select source_code,source_name,target_id from candidates where candidate_count=1 order by match_rank
  ), inserted as (
    insert into public.account_mappings(organization_id,mapping_version,source_code,source_name,target_account_id,status,created_by,approved_by,approved_at)
    select v_org,btrim(p_mapping_version),c.source_code,c.source_name,c.target_id,'draft',v_user,null,null
    from chosen c
    where not exists (
      select 1 from public.account_mappings m
      where m.organization_id=v_org and m.mapping_version=btrim(p_mapping_version) and m.source_code=c.source_code
    ) returning 1
  ) select count(*) into v_created from inserted;

  select count(*) into v_matched from (
    select distinct btrim(r.payload->>'account_code') source_code
    from public.import_rows r
    join public.accounts a on a.organization_id=v_org and (btrim(a.code)=btrim(r.payload->>'account_code') or lower(btrim(a.name))=lower(btrim(r.payload->>'account_name')))
    where r.import_id=p_import_id and r.validation_status='valid'
  ) x;

  select count(*) into v_missing from (
    select distinct btrim(r.payload->>'account_code') source_code
    from public.import_rows r where r.import_id=p_import_id and r.validation_status='valid'
  ) s where not exists (
    select 1 from public.account_mappings m
    where m.organization_id=v_org and m.mapping_version=btrim(p_mapping_version) and m.source_code=s.source_code
  );

  if v_created>0 then
    perform public.write_audit_event(v_org,'mapping.auto_match','import',p_import_id::text,null,jsonb_build_object('mapping_version',btrim(p_mapping_version),'created_count',v_created,'matched_count',v_matched,'missing_count',v_missing,'approval_mode','system_suggested_requires_review'));
  end if;

  return jsonb_build_object('import_id',p_import_id,'mapping_version',btrim(p_mapping_version),'created_count',v_created,'matched_count',v_matched,'missing_count',v_missing);
end;
$function$;

CREATE OR REPLACE FUNCTION public.publish_actuals_from_import(p_import_id uuid, p_mapping_version text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_user uuid := auth.uid();
  v_org uuid;
  v_batch uuid;
  v_rows integer;
  v_bad integer;
  v_status text;
  v_currency text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_import_id is null then raise exception 'Import is required'; end if;
  if nullif(trim(p_mapping_version), '') is null then raise exception 'Mapping version is required'; end if;

  select i.organization_id, i.status into v_org, v_status
  from public.imports i where i.id = p_import_id for update;
  if v_org is null then raise exception 'Import not found'; end if;
  if not public.has_org_permission(v_org, 'approve') then raise exception 'Publish approval permission required for this organization'; end if;
  if v_status = 'rolled_back' then raise exception 'Rolled back imports cannot be published'; end if;
  if v_status = 'published' then raise exception 'Import is already published'; end if;

  select count(*)::integer into v_rows from public.import_rows ir where ir.import_id = p_import_id and ir.validation_status = 'valid';
  select count(*)::integer into v_bad from public.import_rows ir where ir.import_id = p_import_id and ir.validation_status in ('pending','warning','error');
  if v_rows = 0 or v_bad > 0 then raise exception 'Import contains rows that are not valid'; end if;

  if exists (
    select 1 from public.import_rows ir
    where ir.import_id = p_import_id
      and not exists (
        select 1 from public.account_mappings m
        where m.organization_id = ir.organization_id
          and m.mapping_version = trim(p_mapping_version)
          and m.source_code = (ir.payload->>'account_code')
          and m.status = 'approved'
      )
  ) then raise exception 'Every account must have an approved mapping'; end if;

  select o.base_currency into v_currency from public.organizations o where o.id = v_org;

  insert into public.financial_periods(organization_id, period_start, period_end, status)
  select v_org, m.period_start, (m.period_start + interval '1 month - 1 day')::date, 'open'
  from (
    select distinct date_trunc('month', (ir.payload->>'date')::date)::date as period_start
    from public.import_rows ir where ir.import_id = p_import_id and ir.validation_status = 'valid'
  ) m on conflict (organization_id, period_start) do nothing;

  insert into public.financial_facts(
    organization_id, financial_period_id, account_id, currency, amount_minor,
    fact_type, source_import_id, source_row_key, journal_no, description,
    debit_minor, credit_minor
  )
  select
    ir.organization_id, fp.id, m.target_account_id, v_currency,
    round(coalesce(nullif(ir.payload->>'debit','')::numeric,0) * 100)::bigint
      - round(coalesce(nullif(ir.payload->>'credit','')::numeric,0) * 100)::bigint,
    'actual', p_import_id, ir.source_key, ir.payload->>'journal_no', ir.payload->>'description',
    round(coalesce(nullif(ir.payload->>'debit','')::numeric,0) * 100)::bigint,
    round(coalesce(nullif(ir.payload->>'credit','')::numeric,0) * 100)::bigint
  from public.import_rows ir
  join public.account_mappings m on m.organization_id = ir.organization_id and m.mapping_version = trim(p_mapping_version) and m.source_code = (ir.payload->>'account_code') and m.status = 'approved'
  join public.financial_periods fp on fp.organization_id = ir.organization_id and fp.period_start = date_trunc('month', (ir.payload->>'date')::date)::date
  where ir.import_id = p_import_id and ir.validation_status = 'valid';

  insert into public.actuals_publish_batches(organization_id, import_id, mapping_version, status, row_count, published_at, published_by)
  values(v_org, p_import_id, trim(p_mapping_version), 'published', v_rows, now(), v_user)
  returning id into v_batch;

  update public.imports set status = 'published', imported_row_count = v_rows, published_at = now() where id = p_import_id;
  return v_batch;
end;
$function$;

REVOKE ALL ON FUNCTION public.auto_map_import_accounts(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.publish_actuals_from_import(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_map_import_accounts(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_actuals_from_import(uuid, text) TO authenticated;

COMMIT;
