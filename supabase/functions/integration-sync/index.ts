import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const JSON_HEADERS={ "Content-Type":"application/json" };
const QOYOD_BASE="https://api.qoyod.com/2.0";
const QOYOD_RESOURCES=["accounts","journal_entries"] as const;
const SMART_LIFE_RESOURCES=["sales","products","suppliers"] as const;

function pickRows(body:unknown,resource:string):unknown[]{
  if(Array.isArray(body)) return body;
  if(!body||typeof body!=="object") return [];
  const o=body as Record<string,unknown>;
  if(Array.isArray(o[resource])) return o[resource] as unknown[];
  if(Array.isArray(o.results)) return o.results as unknown[];
  const d=o.data;
  if(Array.isArray(d)) return d;
  if(d&&typeof d==="object"){
    const x=d as Record<string,unknown>;
    if(Array.isArray(x[resource])) return x[resource] as unknown[];
    if(Array.isArray(x.results)) return x.results as unknown[];
  }
  return [];
}

async function recordKey(row:unknown,resource:string,index:number){
  if(row&&typeof row==="object"){
    const o=row as Record<string,unknown>;
    for(const k of["id","uuid","entry_id","journal_entry_id","account_id","code","index"]){
      if(o[k]!=null&&String(o[k]).trim()) return String(o[k]);
    }
  }
  const bytes=new TextEncoder().encode(JSON.stringify(row??null));
  const digest=await crypto.subtle.digest("SHA-256",bytes);
  const hex=Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join("");
  return `${resource}:sha256:${hex}`;
}

async function userId(req:Request,url:string,key:string){
  const auth=req.headers.get("Authorization");
  if(!auth) throw new Error("AUTH_REQUIRED");
  const c=createClient(url,key,{global:{headers:{Authorization:auth}},auth:{autoRefreshToken:false,persistSession:false}});
  const{data,error}=await c.auth.getUser();
  if(error||!data.user) throw new Error("AUTH_REQUIRED");
  return data.user.id;
}

Deno.serve(async(req)=>{
  if(req.method!=="POST") return new Response(JSON.stringify({error:"Method not allowed"}),{status:405,headers:JSON_HEADERS});
  try{
    const url=Deno.env.get("SUPABASE_URL"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),anon=Deno.env.get("SUPABASE_ANON_KEY");
    if(!url||!service||!anon) throw new Error("FUNCTION_ENV_INCOMPLETE");
    const admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}});
    const uid=await userId(req,url,anon);
    const body=await req.json().catch(()=>({}));
    const org=String(body?.organization_id||"").trim(),connectorId=String(body?.connector_id||"").trim(),mode=body?.mode==="test"?"test":"sync";
    if(!org||!connectorId) throw new Error("ORGANIZATION_AND_CONNECTOR_REQUIRED");

    const userClient=createClient(url,anon,{global:{headers:{Authorization:req.headers.get("Authorization")||""}},auth:{autoRefreshToken:false,persistSession:false}});
    const{data:access,error:ae}=await userClient.rpc("get_my_org_access",{p_organization_id:org});
    if(ae) throw ae;
    if(!(access??[]).some((x:{permission_key?:string;granted?:boolean})=>x.permission_key==="connector.manage"&&x.granted===true)) throw new Error("PERMISSION_DENIED");

    const{data:connector,error:ce}=await admin.from("data_source_connectors")
      .select("id,organization_id,data_source_id,enabled,sync_config,connector_catalog:connector_id(connector_key,display_name)")
      .eq("id",connectorId).eq("organization_id",org).maybeSingle();
    if(ce) throw ce;
    if(!connector||!connector.enabled) throw new Error("CONNECTOR_NOT_ENABLED");

    const catalog=connector.connector_catalog as {connector_key?:string}|null;
    const provider=catalog?.connector_key;
    if(provider!=="qoyod" && provider!=="smart_life") throw new Error("PROVIDER_NOT_IMPLEMENTED_YET");

    const ref=String((connector.sync_config as Record<string,unknown>|null)?.credential_ref||"");
    if(!ref) throw new Error("CREDENTIAL_NOT_CONFIGURED");
    const{data:secret,error:se}=await admin.schema("vault").from("decrypted_secrets").select("decrypted_secret").eq("name",ref).maybeSingle();
    if(se) throw se;
    const rawSecret=secret?.decrypted_secret;
    if(!rawSecret) throw new Error("CREDENTIAL_NOT_FOUND");

    let smartCredential:{base_url:string;company:string;username:string;password:string}|null=null;
    if(provider==="smart_life"){
      try{smartCredential=JSON.parse(rawSecret)}catch{throw new Error("SMART_LIFE_CREDENTIAL_INVALID")}
      if(!smartCredential?.base_url||!smartCredential?.company||!smartCredential?.username||!smartCredential?.password) throw new Error("SMART_LIFE_CREDENTIAL_INCOMPLETE");
    }

    async function getQoyod(resource:string,page=1){
      const u=new URL(QOYOD_BASE+"/"+resource);
      u.searchParams.set("page",String(page)); u.searchParams.set("per_page","100");
      const r=await fetch(u,{method:"GET",headers:{"API-KEY":rawSecret,"Accept":"application/json"}});
      const t=await r.text(); let p:unknown; try{p=JSON.parse(t)}catch{p={raw:t.slice(0,2000)}}
      if(!r.ok) throw new Error("QOYOD_"+r.status+"_"+resource); return p;
    }

    async function loginSmartLife(){
      if(!smartCredential) throw new Error("SMART_LIFE_CREDENTIAL_INCOMPLETE");
      const u=new URL(smartCredential.base_url.replace(/\/$/,"")+"/login");
      const form=new URLSearchParams({company:smartCredential.company,username:smartCredential.username,password:smartCredential.password});
      const r=await fetch(u,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"},body:form.toString()});
      const t=await r.text(); let p:Record<string,unknown>; try{p=JSON.parse(t) as Record<string,unknown>}catch{throw new Error("SMART_LIFE_INVALID_LOGIN_RESPONSE")}
      if(!r.ok||p.error===true||!p.token) throw new Error("SMART_LIFE_LOGIN_"+r.status); return String(p.token);
    }

    async function getSmartLife(resource:string,token:string){
      if(!smartCredential) throw new Error("SMART_LIFE_CREDENTIAL_INCOMPLETE");
      const u=new URL(smartCredential.base_url.replace(/\/$/,"")+"/"+resource+"/index");
      u.searchParams.set("token",token); u.searchParams.set("company",smartCredential.company);
      const r=await fetch(u,{method:"POST",headers:{"Accept":"application/json"}});
      const t=await r.text(); let p:unknown; try{p=JSON.parse(t)}catch{p={raw:t.slice(0,2000)}}
      if(!r.ok) throw new Error("SMART_LIFE_"+r.status+"_"+resource);
      if(p&&typeof p==="object"&&(p as Record<string,unknown>).error===true) throw new Error("SMART_LIFE_API_ERROR_"+resource); return p;
    }

    if(mode==="test"){
      if(provider==="qoyod"){
        const a=await getQoyod("accounts",1);
        return new Response(JSON.stringify({ok:true,provider,mode,accounts_sample_count:pickRows(a,"accounts").length,read_only:true}),{status:200,headers:JSON_HEADERS});
      }
      const token=await loginSmartLife(); const p=await getSmartLife("products",token);
      return new Response(JSON.stringify({ok:true,provider,mode,token_obtained:true,products_sample_count:pickRows(p,"products").length,read_only:true}),{status:200,headers:JSON_HEADERS});
    }

    const{data:run,error:re}=await admin.from("data_sync_runs")
      .insert({organization_id:org,data_source_id:connector.data_source_id,status:"running",created_by:uid})
      .select("id").single();
    if(re) throw re;

    const startedAt=new Date().toISOString();
    await admin.from("data_source_connectors").update({last_started_at:startedAt,updated_at:startedAt}).eq("id",connectorId).eq("organization_id",org);

    let received=0,accepted=0,errors=0,updated=0;
    try{
      const resources=provider==="qoyod"?QOYOD_RESOURCES:SMART_LIFE_RESOURCES;
      const smartToken=provider==="smart_life"?await loginSmartLife():null;
      for(const resource of resources){
        const isSmartLife=provider==="smart_life";
        const maxPages=isSmartLife?1:100;
        for(let page=1;page<=maxPages;page++){
          const payload=provider==="qoyod"?await getQoyod(resource,page):await getSmartLife(resource,smartToken!); const rows=pickRows(payload,resource);
          received+=rows.length;
          if(!rows.length) break;

          const records=[];
          for(let i=0;i<rows.length;i++){
            records.push({
              organization_id:org,
              data_source_id:connector.data_source_id,
              sync_run_id:run.id,
              source_entity_type:resource,
              source_record_key:await recordKey(rows[i],resource,i),
              payload:rows[i],
              received_at:new Date().toISOString()
            });
          }

          const{data:upserted,error}=await admin.from("sync_payloads")
            .upsert(records,{onConflict:"data_source_id,source_entity_type,source_record_key",ignoreDuplicates:false})
            .select("id");
          if(error){errors+=rows.length;throw error}
          accepted+=upserted?.length??rows.length;
          updated+=upserted?.length??rows.length;
          if(isSmartLife || rows.length<100) break;
        }
      }

      const finishedAt=new Date().toISOString();
      const status=errors>0?(accepted>0?"partial":"failed"):"succeeded";
      await admin.from("data_sync_runs").update({
        completed_at:finishedAt,status,records_received:received,records_accepted:accepted,
        records_rejected:errors,error_count:errors,error_message:errors?"Some source records could not be stored":null
      }).eq("id",run.id).eq("organization_id",org);

      await admin.from("data_source_connectors").update({
        last_completed_at:finishedAt,last_success_at:status!=="failed"?finishedAt:null,
        last_error_at:status==="failed"?finishedAt:null,last_error_message:errors?"Some source records could not be stored":null,
        updated_at:finishedAt
      }).eq("id",connectorId).eq("organization_id",org);

      await admin.from("data_sources").update({
        last_sync_at:finishedAt,last_success_at:status!=="failed"?finishedAt:null,
        last_error_at:status==="failed"?finishedAt:null,last_error_message:errors?"Some source records could not be stored":null,
        status:status==="failed"?"error":"active",updated_at:finishedAt
      }).eq("id",connector.data_source_id).eq("organization_id",org);

      return new Response(JSON.stringify({ok:status!=="failed",provider,mode,run_id:run.id,status,received,accepted,updated,errors,read_only:true,idempotent:true}),{status:status==="failed"?502:200,headers:JSON_HEADERS});
    }catch(e){
      const m=e instanceof Error?e.message:"SYNC_FAILED";
      const finishedAt=new Date().toISOString();
      await admin.from("data_sync_runs").update({completed_at:finishedAt,status:"failed",error_count:1,error_message:m}).eq("id",run.id).eq("organization_id",org);
      await admin.from("data_source_connectors").update({last_completed_at:finishedAt,last_error_at:finishedAt,last_error_message:m,updated_at:finishedAt}).eq("id",connectorId).eq("organization_id",org);
      throw e;
    }
  }catch(e){
    return new Response(JSON.stringify({error:e instanceof Error?e.message:"INTEGRATION_SYNC_FAILED"}),{status:400,headers:JSON_HEADERS});
  }
});