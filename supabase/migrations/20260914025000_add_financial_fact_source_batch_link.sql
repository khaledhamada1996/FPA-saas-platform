alter table public.financial_facts add column if not exists source_batch_id uuid;

create index if not exists financial_facts_source_batch_id_idx
  on public.financial_facts (source_batch_id);

DO $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'financial_facts_source_batch_id_fkey'
      and conrelid = 'public.financial_facts'::regclass
  ) then
    alter table public.financial_facts
      add constraint financial_facts_source_batch_id_fkey
      foreign key (source_batch_id)
      references public.actuals_publish_batches(id);
  end if;
end $$;
