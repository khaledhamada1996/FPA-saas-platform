create unique index if not exists budget_lines_planning_version_period_account_dims_key
on public.budget_lines using btree
(planning_version_id, financial_period_id, account_id, legal_entity_id, branch_id, department_id, cost_center_id, region_id, product_id, project_id);
