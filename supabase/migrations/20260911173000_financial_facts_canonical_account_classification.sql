begin;

-- Canonical financial facts: one authority for actual, budget, forecast and scenario data.
alter table public.financial_facts add column if not exists journal_no text;
alter table public.financial_facts add column if not exists description text;
alter table public.financial_facts add column if not exists debit_minor bigint;
alter table public.financial_facts add column if not exists credit_minor bigint;
create unique index if not exists financial_facts_org_source_row_key_uidx on public.financial_facts (organization_id, source_row_key) where source_row_key is not null;
create index if not exists financial_facts_org_journal_idx on public.financial_facts (organization_id, journal_no);

-- Deterministic account classification and statement mapping.
alter table public.accounts add column if not exists account_type text;
alter table public.accounts add column if not exists statement_type text;
alter table public.accounts add column if not exists statement_section text;
alter table public.accounts add column if not exists is_contra boolean not null default false;
alter table public.accounts add column if not exists parent_account_id uuid references public.accounts(id) on delete restrict;

alter table public.accounts drop constraint if exists accounts_account_type_check;
alter table public.accounts add constraint accounts_account_type_check check (account_type is null or account_type in ('asset','liability','equity','revenue','expense'));
alter table public.accounts drop constraint if exists accounts_statement_type_check;
alter table public.accounts add constraint accounts_statement_type_check check (statement_type is null or statement_type in ('income_statement','balance_sheet','cash_flow'));

-- Migrate any legacy actual facts before removing the old table.
insert into public.financial_facts (
 organization_id, legal_entity_id, financial_period_id, account_id, branch_id, department_id,
 cost_center_id, region_id, product_id, project_id, currency, amount_minor, fact_type,
 source_row_key, journal_no, description, debit_minor, credit_minor
)
select
 a.organization_id, a.legal_entity_id, a.financial_period_id, a.account_id, a.branch_id, a.department_id,
 a.cost_center_id, a.region_id, a.product_id, a.project_id,
 coalesce(o.base_currency,'SAR'), round(a.amount * 100)::bigint, 'actual',
 a.source_key, a.journal_no, a.description,
 round(coalesce(a.debit,0) * 100)::bigint, round(coalesce(a.credit,0) * 100)::bigint
from public.actual_financial_facts a
join public.organizations o on o.id=a.organization_id
where not exists (
 select 1 from public.financial_facts f
 where f.organization_id=a.organization_id and f.source_row_key=a.source_key
);

-- Repoint the statement view to the canonical model.
drop view if exists public.actual_income_statement;
create view public.actual_income_statement as
select f.organization_id, f.financial_period_id, ac.code as account_code, ac.name as account_name,
       (f.amount_minor::numeric / 100) as amount
from public.financial_facts f
join public.accounts ac on ac.id=f.account_id
where f.fact_type='actual';

-- Remove the parallel actuals table. financial_facts is now authoritative.
drop table public.actual_financial_facts;

-- Publish actual journal imports directly into canonical financial_facts.
create or replace function public.publish_actual_import(target_organization_id uuid, target_file_name text, target_rows jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 v_batch_id uuid; v_existing jsonb; v_row jsonb; v_row_no integer:=0; v_date date; v_debit numeric; v_credit numeric;
 v_account_code text; v_journal_no text; v_account_id uuid; v_period_id uuid; v_period_status text;
 v_legal_entity_id uuid; v_branch_id uuid; v_department_id uuid; v_cost_center_id uuid; v_region_id uuid; v_project_id uuid;
 v_payload_hash text; v_source_key text; v_inserted integer:=0;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if not exists(select 1 from public.organization_members om where om.organization_id=target_organization_id and om.user_id=auth.uid()) then raise exception 'ORGANIZATION_ACCESS_DENIED'; end if;
 if target_rows is null or jsonb_typeof(target_rows)<>'array' or jsonb_array_length(target_rows)=0 then raise exception 'NO_ROWS'; end if;
 v_payload_hash:=md5(target_rows::text);
 select jsonb_build_object('batch_id',id,'row_count',row_count,'status',status) into v_existing
 from public.actual_import_batches where organization_id=target_organization_id and payload_hash=v_payload_hash and status='published' order by created_at desc limit 1;
 if v_existing is not null then return v_existing; end if;
 if exists(select 1 from (select coalesce(nullif(trim(x.journal_no),''),'') journal_no,coalesce(sum(coalesce(x.debit,0)),0) debit_total,coalesce(sum(coalesce(x.credit,0)),0) credit_total from jsonb_to_recordset(target_rows) x(journal_no text,debit numeric,credit numeric) group by coalesce(nullif(trim(x.journal_no),''),'')) g where g.journal_no='' or g.debit_total<>g.credit_total) then raise exception 'JOURNAL_NOT_BALANCED'; end if;
 insert into public.actual_import_batches(organization_id,file_name,source_type,status,row_count,payload_hash) values(target_organization_id,coalesce(nullif(trim(target_file_name),''),'import.xlsx'),'journal_entries','uploaded',jsonb_array_length(target_rows),v_payload_hash) returning id into v_batch_id;
 for v_row in select value from jsonb_array_elements(target_rows) loop
  v_row_no:=v_row_no+1;
  begin
   v_date:=(v_row->>'date')::date; v_debit:=coalesce(nullif(trim(v_row->>'debit'),''),'0')::numeric; v_credit:=coalesce(nullif(trim(v_row->>'credit'),''),'0')::numeric;
   v_account_code:=nullif(trim(v_row->>'account'),''); v_journal_no:=nullif(trim(v_row->>'journal_no'),'');
  exception when others then raise exception 'INVALID_ROW:%',v_row_no; end;
  if v_date is null or v_account_code is null or v_journal_no is null then raise exception 'INVALID_ROW:%',v_row_no; end if;
  if v_debit<0 or v_credit<0 or (v_debit=0 and v_credit=0) or (v_debit>0 and v_credit>0) then raise exception 'INVALID_DEBIT_CREDIT:%',v_row_no; end if;
  select a.id into v_account_id from public.accounts a where a.organization_id=target_organization_id and a.code=v_account_code;
  if v_account_id is null then raise exception 'ACCOUNT_NOT_FOUND:%:%',v_row_no,v_account_code; end if;
  select fp.id,fp.status::text into v_period_id,v_period_status from public.financial_periods fp where fp.organization_id=target_organization_id and v_date between fp.period_start and fp.period_end limit 1;
  if v_period_id is null then raise exception 'PERIOD_NOT_FOUND:%:%',v_row_no,v_date; end if;
  if v_period_status<>'open' then raise exception 'PERIOD_NOT_OPEN:%:%',v_row_no,v_date; end if;
  v_legal_entity_id:=null; v_branch_id:=null; v_department_id:=null; v_cost_center_id:=null; v_region_id:=null; v_project_id:=null;
  if nullif(trim(v_row->>'legal_entity'),'') is not null then select id into v_legal_entity_id from public.legal_entities where organization_id=target_organization_id and (code=v_row->>'legal_entity' or name=v_row->>'legal_entity') limit 1; if v_legal_entity_id is null then raise exception 'DIMENSION_NOT_FOUND:legal_entity:%:%',v_row_no,v_row->>'legal_entity'; end if; end if;
  if nullif(trim(v_row->>'branch'),'') is not null then select id into v_branch_id from public.branches where organization_id=target_organization_id and (code=v_row->>'branch' or name=v_row->>'branch') limit 1; if v_branch_id is null then raise exception 'DIMENSION_NOT_FOUND:branch:%:%',v_row_no,v_row->>'branch'; end if; end if;
  if nullif(trim(v_row->>'department'),'') is not null then select id into v_department_id from public.departments where organization_id=target_organization_id and (code=v_row->>'department' or name=v_row->>'department') limit 1; if v_department_id is null then raise exception 'DIMENSION_NOT_FOUND:department:%:%',v_row_no,v_row->>'department'; end if; end if;
  if nullif(trim(v_row->>'cost_center'),'') is not null then select id into v_cost_center_id from public.cost_centers where organization_id=target_organization_id and (code=v_row->>'cost_center' or name=v_row->>'cost_center') limit 1; if v_cost_center_id is null then raise exception 'DIMENSION_NOT_FOUND:cost_center:%:%',v_row_no,v_row->>'cost_center'; end if; end if;
  if nullif(trim(v_row->>'region'),'') is not null then select id into v_region_id from public.regions where organization_id=target_organization_id and (code=v_row->>'region' or name=v_row->>'region') limit 1; if v_region_id is null then raise exception 'DIMENSION_NOT_FOUND:region:%:%',v_row_no,v_row->>'region'; end if; end if;
  if nullif(trim(v_row->>'project'),'') is not null then select id into v_project_id from public.projects where organization_id=target_organization_id and (code=v_row->>'project' or name=v_row->>'project') limit 1; if v_project_id is null then raise exception 'DIMENSION_NOT_FOUND:project:%:%',v_row_no,v_row->>'project'; end if; end if;
  v_source_key:=md5(v_payload_hash||':'||v_row_no::text);
  insert into public.financial_facts(organization_id,financial_period_id,account_id,legal_entity_id,branch_id,department_id,cost_center_id,region_id,project_id,currency,amount_minor,fact_type,source_import_id,source_row_key,journal_no,description,debit_minor,credit_minor)
  values(target_organization_id,v_period_id,v_account_id,v_legal_entity_id,v_branch_id,v_department_id,v_cost_center_id,v_region_id,v_project_id,'SAR',round((v_debit-v_credit)*100)::bigint,'actual',v_batch_id,v_source_key,nullif(trim(v_row->>'journal_no'),''),nullif(trim(v_row->>'description'),''),round(v_debit*100)::bigint,round(v_credit*100)::bigint);
  v_inserted:=v_inserted+1;
 end loop;
 update public.actual_import_batches set status='published',published_at=now(),row_count=v_inserted where id=v_batch_id;
 return jsonb_build_object('batch_id',v_batch_id,'row_count',v_inserted,'status','published');
exception when others then
 if v_batch_id is not null then update public.actual_import_batches set status='failed' where id=v_batch_id; end if;
 raise;
end; $$;

commit;