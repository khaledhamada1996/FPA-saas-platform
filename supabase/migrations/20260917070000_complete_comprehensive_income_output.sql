-- Expose a complete statement of comprehensive income in addition to the
-- separate OCI section: net income + OCI = total comprehensive income.
-- Also expose YTD OCI for fiscal-year reporting.
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname='public'
    AND p.proname='get_financial_statements_date_range_filtered_core'
    AND p.proargtypes::text = '2950 1082 1082 25 25 2950 2950 2950 2950 2950 2950 2950';
  IF v_def IS NULL THEN RAISE EXCEPTION 'Core financial statements function not found'; END IF;

  v_def := replace(v_def,
    'oci as (select coalesce(sum(debit_minor-credit_minor),0)::bigint total,coalesce(jsonb_agg(jsonb_build_object(''code'',code,''name'',name,''amount'',debit_minor-credit_minor) order by code),''[]''::jsonb) rows from period where statement_subclassification=''other_comprehensive_income''),',
    'oci as (select coalesce(sum(debit_minor-credit_minor),0)::bigint total,coalesce(jsonb_agg(jsonb_build_object(''code'',code,''name'',name,''amount'',debit_minor-credit_minor) order by code),''[]''::jsonb) rows,coalesce((select sum(debit_minor-credit_minor) from ytd where statement_subclassification=''other_comprehensive_income''),0)::bigint ytd_total from period where statement_subclassification=''other_comprehensive_income''),');

  v_def := replace(v_def,
    'oci.total oci_total,oci.rows oci_rows,eq.rows eq_rows',
    'oci.total oci_total,oci.rows oci_rows,oci.ytd_total oci_ytd_total,eq.rows eq_rows');

  v_def := replace(v_def,
    '''other_comprehensive_income'',jsonb_build_object(''period'',jsonb_build_object(''rows'',oci_rows,''total'',oci_total),''ytd'',jsonb_build_object()),',
    '''other_comprehensive_income'',jsonb_build_object(''period'',jsonb_build_object(''rows'',oci_rows,''total'',oci_total),''ytd'',jsonb_build_object(''total'',oci_ytd_total)),''comprehensive_income'',jsonb_build_object(''period'',jsonb_build_object(''net_income'',net_income,''other_comprehensive_income'',oci_total,''total_comprehensive_income'',net_income+oci_total),''ytd'',jsonb_build_object(''net_income'',ytd_net_income,''other_comprehensive_income'',oci_ytd_total,''total_comprehensive_income'',ytd_net_income+oci_ytd_total)),');

  EXECUTE v_def;
END $$;
