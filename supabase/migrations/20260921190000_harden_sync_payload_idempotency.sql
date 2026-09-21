-- Prevent duplicate source records when an integration is re-synced.
create unique index if not exists sync_payloads_source_record_unique
  on public.sync_payloads (data_source_id, source_entity_type, source_record_key)
  where source_record_key is not null and btrim(source_record_key) <> '';

create index if not exists idx_sync_payloads_source_received
  on public.sync_payloads (data_source_id, source_entity_type, received_at desc);