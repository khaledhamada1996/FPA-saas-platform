do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname in (
        'get_actuals_summary','get_ai_financial_context','get_data_lineage','get_data_monitoring',
        'get_dimension_analysis','get_executive_dashboard','get_executive_dashboard_filtered',
        'get_financial_analysis','get_financial_analysis_filtered','get_financial_data_date_range',
        'get_financial_report_journal_options','get_financial_report_opening_balances',
        'get_financial_statement_account_lines','get_financial_statement_account_lines_core',
        'get_financial_statement_reporting_context','get_financial_statements_date_range',
        'get_financial_statements_date_range_exact','get_financial_statements_date_range_filtered',
        'get_financial_statements_report_router','get_financial_statements_v2',
        'get_opening_balances','get_trial_balance','get_trial_balance_date_range_filtered',
        'get_workspace_profile','seed_activity_chart_of_accounts','update_workspace_profile'
      )
  loop
    execute format('revoke execute on function %s from anon', r.sig);
  end loop;
end $$;
