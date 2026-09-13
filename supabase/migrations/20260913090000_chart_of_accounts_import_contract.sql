begin;

-- Chart of Accounts import foundation.
-- This is intentionally separate from journal ingestion: a chart of accounts is
-- master data and must never be treated as Actuals.
create table if not exists public.account_import_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  file_name text not null,
  file_hash text,
  status text not null default 'draft' check (status in ('draft','validated','applied','failed','cancelled')),
  row_count integer not null default 0,
  accepted_count integer not null default 0,
  rejected_count integer not null default 0,
  error_count integer not null default 0,
  warning_count integer not null default 0,
  created_by uuid not null references auth.users(id),
  applied_at timestamptz,
  applied_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.account_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.account_import_batches(id) on delete cascade,
  row_number integer not null,
  account_code text,
  account_name text,
  parent_account_code text,
  account_type text,
  statement_classification text,
  normal_balance text,
  is_contra boolean,
  is_active boolean,
  source_payload jsonb not null default '{}'::jsonb,
  validation_status text not null default 'pending' check (validation_status in ('pending','valid','warning','error')),
  validation_errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique(batch_id,row_number)
);

create index if not exists idx_account_import_batches_org_created
  on public.account_import_batches(organization_id, created_at desc);
create index if not exists idx_account_import_rows_batch_status
  on public.account_import_rows(batch_id, validation_status);
create index if not exists idx_account_import_rows_batch_code
  on public.account_import_rows(batch_id, account_code);

alter table public.account_import_batches enable row level security;
alter table public.account_import_rows enable row level security;
drop policy if exists account_import_batches_deny_direct on public.account_import_batches;
create policy account_import_batches_deny_direct on public.account_import_batches for all to authenticated using (false) with check (false);
drop policy if exists account_import_rows_deny_direct on public.account_import_rows;
create policy account_import_rows_deny_direct on public.account_import_rows for all to authenticated using (false) with check (false);
revoke all on public.account_import_batches, public.account_import_rows from public, anon, authenticated;

insert into public.organization_permissions(permission_key, permission_name, permission_type, category, sort_order)
values
 ('account_import.view','عرض استيراد دليل الحسابات','action','data',120),
 ('account_import.create','إنشاء استيراد دليل الحسابات','action','data',121),
 ('account_import.validate','التحقق من استيراد دليل الحسابات','action','data',122),
 ('account_import.apply','تطبيق دليل الحسابات','action','data',123)
on conflict (permission_key) do update set permission_name=excluded.permission_name;

-- Only top-level administrators receive the new actions automatically. Other
-- users must be granted explicitly through the existing permission hierarchy.
insert into public.organization_role_permissions(role_key, permission_key)
select r.role_key, p.permission_key
from public.organization_roles r
cross join public.organization_permissions p
where r.hierarchy_level >= 90
  and p.permission_key in ('account_import.view','account_import.create','account_import.validate','account_import.apply')
on conflict do nothing;

create or replace function public.create_account_import_batch(
  p_organization_id uuid,
  p_file_name text,
  p_file_hash text,
  p_rows jsonb
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare
  v_uid uuid := auth.uid();
  v_batch uuid;
  v_row jsonb;
  v_n integer := 0;
  v_code text;
  v_name text;
  v_parent text;
  v_type text;
  v_class text;
  v_balance text;
  v_contra boolean;
  v_active boolean;
  v_errors jsonb;
  v_status text;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.has_org_permission(p_organization_id,'account_import.create') then raise exception 'FORBIDDEN'; end if;
  if p_file_name is null or btrim(p_file_name)='' then raise exception 'FILE_NAME_REQUIRED'; end if;
  if p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)=0 then raise exception 'ROWS_REQUIRED'; end if;
  if jsonb_array_length(p_rows)>100000 then raise exception 'ROW_LIMIT_EXCEEDED'; end if;

  insert into public.account_import_batches(organization_id,file_name,file_hash,status,row_count,created_by)
  values(p_organization_id,p_file_name,p_file_hash,'draft',jsonb_array_length(p_rows),v_uid)
  returning id into v_batch;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_n:=v_n+1;
    v_code:=nullif(btrim(v_row->>'account_code'),'');
    v_name:=nullif(btrim(v_row->>'account_name'),'');
    v_parent:=nullif(btrim(v_row->>'parent_account_code'),'');
    v_type:=nullif(lower(btrim(v_row->>'account_type')),'');
    v_class:=nullif(lower(btrim(v_row->>'statement_classification')),'');
    v_balance:=nullif(lower(btrim(v_row->>'normal_balance')),'');
    v_contra:=case when lower(coalesce(v_row->>'is_contra','false')) in ('true','1','yes','نعم') then true else false end;
    v_active:=case when lower(coalesce(v_row->>'is_active','true')) in ('false','0','no','لا') then false else true end;
    v_errors:='[]'::jsonb;
    if v_code is null then v_errors:=v_errors||jsonb_build_array('كود الحساب مفقود'); end if;
    if v_name is null then v_errors:=v_errors||jsonb_build_array('اسم الحساب مفقود'); end if;
    if v_type is not null and v_type not in ('asset','liability','equity','revenue','expense','income','other_income','other_expense') then v_errors:=v_errors||jsonb_build_array('نوع الحساب غير مدعوم'); end if;
    if v_balance is not null and v_balance not in ('debit','credit') then v_errors:=v_errors||jsonb_build_array('طبيعة الرصيد يجب أن تكون debit أو credit'); end if;
    v_status:=case when jsonb_array_length(v_errors)=0 then 'valid' else 'error' end;
    insert into public.account_import_rows(batch_id,row_number,account_code,account_name,parent_account_code,account_type,statement_classification,normal_balance,is_contra,is_active,source_payload,validation_status,validation_errors)
    values(v_batch,v_n,v_code,v_name,v_parent,v_type,v_class,v_balance,v_contra,v_active,v_row,v_status,v_errors);
  end loop;

  update public.account_import_batches b
  set accepted_count=(select count(*) from public.account_import_rows r where r.batch_id=b.id and r.validation_status='valid'),
      rejected_count=(select count(*) from public.account_import_rows r where r.batch_id=b.id and r.validation_status='error'),
      error_count=(select count(*) from public.account_import_rows r where r.batch_id=b.id and r.validation_status='error'),
      status=case when exists(select 1 from public.account_import_rows r where r.batch_id=b.id and r.validation_status='error') then 'draft' else 'validated' end,
      updated_at=now()
  where b.id=v_batch;
  return v_batch;
end;
$$;

revoke all on function public.create_account_import_batch(uuid,text,text,jsonb) from public, anon;
grant execute on function public.create_account_import_batch(uuid,text,text,jsonb) to authenticated;

create or replace function public.get_account_import_batch(p_batch_id uuid)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_org uuid; v_result jsonb;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  select organization_id into v_org from public.account_import_batches where id=p_batch_id;
  if v_org is null then raise exception 'BATCH_NOT_FOUND'; end if;
  if not public.has_org_permission(v_org,'account_import.view') then raise exception 'FORBIDDEN'; end if;
  select jsonb_build_object('batch',to_jsonb(b),'rows',coalesce((select jsonb_agg(to_jsonb(r) order by r.row_number) from public.account_import_rows r where r.batch_id=b.id),'[]'::jsonb)) into v_result
  from public.account_import_batches b where b.id=p_batch_id;
  return v_result;
end;
$$;

revoke all on function public.get_account_import_batch(uuid) from public, anon;
grant execute on function public.get_account_import_batch(uuid) to authenticated;

commit;