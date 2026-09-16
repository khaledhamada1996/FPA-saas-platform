create or replace function public.repair_published_actual_dimension_links(p_import_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_org uuid;
  v_status text;
  v_hash text;
  v_updated integer := 0;
  v_uid uuid := auth.uid();
  v_missing jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select organization_id,status,file_hash into v_org,v_status,v_hash from public.imports where id=p_import_id;
  if v_org is null then raise exception 'IMPORT_NOT_FOUND'; end if;
  if v_status <> 'published' then raise exception 'IMPORT_NOT_PUBLISHED'; end if;
  if not public.has_org_permission(v_org,'actuals.publish') then raise exception 'PERMISSION_DENIED'; end if;

  select coalesce(jsonb_agg(jsonb_build_object('dimension_type',x.dimension_type,'source_value',x.source_value)),'[]'::jsonb)
  into v_missing
  from (
    select distinct d.dimension_type, trim(d.source_value) source_value
    from public.import_rows ir
    cross join lateral jsonb_each_text(ir.payload) p(key,value)
    cross join lateral (values
      ('legal_entity', case when p.key='legal_entity' then p.value end),
      ('branch', case when p.key='branch' then p.value end),
      ('department', case when p.key='department' then p.value end),
      ('cost_center', case when p.key='cost_center' then p.value end),
      ('region', case when p.key='region' then p.value end),
      ('product', case when p.key='product' then p.value end),
      ('project', case when p.key='project' then p.value end)
    ) d(dimension_type,source_value)
    where ir.import_id=p_import_id and ir.validation_status='valid' and nullif(trim(d.source_value),'') is not null
      and not exists (
        select 1 from public.import_dimension_mappings m
        where m.import_id=p_import_id and m.status='approved'
          and m.dimension_type=d.dimension_type and lower(trim(m.source_value))=lower(trim(d.source_value))
      )
  ) x;
  if jsonb_array_length(v_missing)>0 then raise exception 'DIMENSION_MAPPING_INCOMPLETE:%',v_missing::text; end if;

  update public.financial_facts f
  set legal_entity_id=m.legal_entity_id, branch_id=m.branch_id, department_id=m.department_id,
      cost_center_id=m.cost_center_id, region_id=m.region_id, product_id=m.product_id, project_id=m.project_id
  from (
    select ir.row_number,
      max(case when d.dimension_type='legal_entity' then d.target_id end) legal_entity_id,
      max(case when d.dimension_type='branch' then d.target_id end) branch_id,
      max(case when d.dimension_type='department' then d.target_id end) department_id,
      max(case when d.dimension_type='cost_center' then d.target_id end) cost_center_id,
      max(case when d.dimension_type='region' then d.target_id end) region_id,
      max(case when d.dimension_type='product' then d.target_id end) product_id,
      max(case when d.dimension_type='project' then d.target_id end) project_id
    from public.import_rows ir
    left join public.import_dimension_mappings d on d.import_id=p_import_id and d.status='approved' and (
      (d.dimension_type='legal_entity' and lower(trim(d.source_value))=lower(trim(coalesce(ir.payload->>'legal_entity','')))) or
      (d.dimension_type='branch' and lower(trim(d.source_value))=lower(trim(coalesce(ir.payload->>'branch','')))) or
      (d.dimension_type='department' and lower(trim(d.source_value))=lower(trim(coalesce(ir.payload->>'department','')))) or
      (d.dimension_type='cost_center' and lower(trim(d.source_value))=lower(trim(coalesce(ir.payload->>'cost_center','')))) or
      (d.dimension_type='region' and lower(trim(d.source_value))=lower(trim(coalesce(ir.payload->>'region','')))) or
      (d.dimension_type='product' and lower(trim(d.source_value))=lower(trim(coalesce(ir.payload->>'product','')))) or
      (d.dimension_type='project' and lower(trim(d.source_value))=lower(trim(coalesce(ir.payload->>'project',''))))
    )
    where ir.import_id=p_import_id and ir.validation_status='valid'
    group by ir.row_number
  ) m
  where f.source_import_id=p_import_id
    and f.source_row_key=v_hash||':'||m.row_number::text
    and f.fact_type='actual' and f.status='published';
  get diagnostics v_updated = row_count;

  perform public.write_audit_event(v_org,'actuals.dimension_links_repaired','import',p_import_id::text,null,jsonb_build_object('updated_facts',v_updated,'source','approved_import_dimension_mappings'));
  return jsonb_build_object('import_id',p_import_id,'status','repaired','updated_facts',v_updated);
end;
$$;
