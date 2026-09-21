-- Secure external integration credentials in Vault and expose connection state safely.
create or replace function public.save_connector_secret(p_organization_id uuid,p_connector_id uuid,p_secret text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_uid uuid:=(select auth.uid()); v_binding uuid; v_provider text; v_name text; v_id uuid;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if not public.has_org_permission(p_organization_id,'connector.manage') then raise exception 'PERMISSION_DENIED'; end if;
 if p_secret is null or btrim(p_secret)='' then raise exception 'SECRET_REQUIRED'; end if;
 if length(p_secret)>10000 then raise exception 'SECRET_TOO_LARGE'; end if;
 select dsc.id,c.connector_key into v_binding,v_provider
 from public.data_source_connectors dsc join public.connector_catalog c on c.id=dsc.connector_id
 where dsc.organization_id=p_organization_id and dsc.connector_id=p_connector_id and dsc.enabled=true limit 1;
 if v_binding is null then raise exception 'CONNECTOR_BINDING_NOT_FOUND'; end if;
 v_name:='fpna/'||p_organization_id::text||'/'||v_provider||'/'||p_connector_id::text||'/credential';
 select id into v_id from vault.secrets where name=v_name limit 1;
 if v_id is null then select vault.create_secret(p_secret,v_name,'FP&A external integration credential for '||v_provider) into v_id;
 else perform vault.update_secret(v_id,p_secret,v_name,'FP&A external integration credential for '||v_provider); end if;
 update public.data_source_connectors set sync_config=jsonb_set(coalesce(sync_config,'{}'::jsonb),'{credential_ref}',to_jsonb(v_name),true),updated_at=now()
 where id=v_binding and organization_id=p_organization_id;
 perform public.write_audit_event(p_organization_id,'connector.secret_updated','data_source_connector',v_binding::text,null,jsonb_build_object('connector_key',v_provider));
 return v_id;
end; $$;

create or replace function public.get_connector_connection_state(p_organization_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_uid uuid:=(select auth.uid()); v_out jsonb;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if not public.has_org_permission(p_organization_id,'connector.view') then raise exception 'PERMISSION_DENIED'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',dsc.id,'data_source_id',dsc.data_source_id,'connector_id',dsc.connector_id,'connector_key',c.connector_key,
 'enabled',dsc.enabled,'has_credential',coalesce(nullif(dsc.sync_config->>'credential_ref',''),'')<>'',
 'sync_mode',ds.sync_mode,'source_status',ds.status,'last_success_at',dsc.last_success_at,
 'last_error_at',dsc.last_error_at,'last_error_message',dsc.last_error_message
 ) order by c.display_name),'[]'::jsonb') into v_out
 from public.data_source_connectors dsc join public.connector_catalog c on c.id=dsc.connector_id join public.data_sources ds on ds.id=dsc.data_source_id
 where dsc.organization_id=p_organization_id;
 return v_out;
end; $$;

revoke all on function public.save_connector_secret(uuid,uuid,text) from public,anon;
grant execute on function public.save_connector_secret(uuid,uuid,text) to authenticated;
revoke all on function public.get_connector_connection_state(uuid) from public,anon;
grant execute on function public.get_connector_connection_state(uuid) to authenticated;