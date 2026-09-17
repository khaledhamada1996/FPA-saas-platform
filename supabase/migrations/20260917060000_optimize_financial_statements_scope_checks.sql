-- Avoid per-row scope lookups for NULL dimensions. A NULL dimension is
-- already permitted by has_org_data_scope(); skip the function call entirely.
-- The predicate remains enforced for non-NULL dimension values.
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'get_financial_statements_date_range_filtered'
    AND p.proargtypes::text = '2950 1082 1082 25 25 2950 2950 2950 2950 2950 2950 2950';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'Target financial statements function not found';
  END IF;

  v_def := replace(v_def, 'and public.has_org_data_scope(f.organization_id,''legal_entity'',f.legal_entity_id)', 'and (f.legal_entity_id is null or public.has_org_data_scope(f.organization_id,''legal_entity'',f.legal_entity_id))');
  v_def := replace(v_def, 'and public.has_org_data_scope(f.organization_id,''branch'',f.branch_id)', 'and (f.branch_id is null or public.has_org_data_scope(f.organization_id,''branch'',f.branch_id))');
  v_def := replace(v_def, 'and public.has_org_data_scope(f.organization_id,''department'',f.department_id)', 'and (f.department_id is null or public.has_org_data_scope(f.organization_id,''department'',f.department_id))');
  v_def := replace(v_def, 'and public.has_org_data_scope(f.organization_id,''cost_center'',f.cost_center_id)', 'and (f.cost_center_id is null or public.has_org_data_scope(f.organization_id,''cost_center'',f.cost_center_id))');
  v_def := replace(v_def, 'and public.has_org_data_scope(f.organization_id,''region'',f.region_id)', 'and (f.region_id is null or public.has_org_data_scope(f.organization_id,''region'',f.region_id))');
  v_def := replace(v_def, 'and public.has_org_data_scope(f.organization_id,''product'',f.product_id)', 'and (f.product_id is null or public.has_org_data_scope(f.organization_id,''product'',f.product_id))');
  v_def := replace(v_def, 'and public.has_org_data_scope(f.organization_id,''project'',f.project_id)', 'and (f.project_id is null or public.has_org_data_scope(f.organization_id,''project'',f.project_id))');

  EXECUTE v_def;
END $$;
