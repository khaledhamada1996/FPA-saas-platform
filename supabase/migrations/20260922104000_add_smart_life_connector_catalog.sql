insert into public.connector_catalog(
 connector_key,display_name,category,supported_source_type,auth_type,capabilities,supported_entities,status
) values (
 'smart_life','Smart Life','accounting','api','secret_reference',
 '{"sync":true,"incremental":true,"read_accounts":true,"read_journal_entries":true,"read_trial_balance":true,"read_customers":true,"read_vendors":true,"read_products":true,"read_invoices":true,"read_payments":true,"read_only":true}',
 ARRAY['accounts','journal_transactions','trial_balance','customers','vendors','products','invoices','payments'],
 'available'
)
on conflict (connector_key) do update set
 display_name=excluded.display_name,category=excluded.category,supported_source_type=excluded.supported_source_type,
 auth_type=excluded.auth_type,capabilities=excluded.capabilities,supported_entities=excluded.supported_entities,status=excluded.status,updated_at=now();