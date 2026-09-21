"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Connector={id:string;connector_key:string;display_name:string;category:string;supported_source_type:string;auth_type:string;capabilities:Record<string,unknown>;supported_entities:string[];status:string};
type State={id:string;data_source_id:string;connector_id:string;connector_key:string;enabled:boolean;has_credential:boolean;sync_mode:string;source_status:string;last_success_at:string|null;last_error_at:string|null;last_error_message:string|null};
type Reconciliation={status:"passed"|"failed"|"blocked"|"not_run";difference_minor:number;blocking_reason?:string|null};
type ReviewItem={id:string;sync_run_id:string;account_mapping_id:string|null;account_mapping_created_by:string|null;source_entity_type:string;source_record_key:string;transaction_date:string|null;journal_no:string|null;description:string|null;account_external_id:string|null;account_code:string|null;account_name:string|null;debit_minor:number;credit_minor:number;currency:string|null;normalization_status:string;normalization_message:string|null;mapping_status:string;mapping_message:string|null;dimension_mapping_status:string;dimension_mapping_message:string|null;dimensions:Record<string,string>;mapped_dimensions:Record<string,string>};
type MappingTarget={id:string;name:string;code?:string|null};

const providerMeta:Record<string,{title:string;description:string;stage:string;logo:string}>={
  qoyod:{title:"قيود",logo:"https://www.qoyod.com/favicon.ico",description:"سحب الحسابات والقيود اليومية إلى طبقة البيانات المحلية للمنصة.",stage:"قابل للتفعيل الآن"},
  odoo:{title:"Odoo",logo:"https://www.odoo.com/favicon.ico",description:"موصل محاسبي للبيانات المالية والحسابات والقيود.",stage:"غير منفذ بعد"},
  zoho_books:{title:"Zoho Books",logo:"https://www.zoho.com/favicon.ico",description:"موصل محاسبي للحسابات والقيود والفواتير والمدفوعات.",stage:"غير منفذ بعد"},
  foodics:{title:"Foodics",logo:"https://www.foodics.com/favicon.ico",description:"سحب المبيعات والمدفوعات والمنتجات والعملاء للتحليل المالي.",stage:"طبقة الموصل جاهزة"},
  salla:{title:"Salla",logo:"https://salla.com/favicon.ico",description:"سحب الطلبات والمدفوعات والمنتجات والعملاء.",stage:"طبقة الموصل جاهزة"},
  zid:{title:"Zid",logo:"https://zid.sa/favicon.ico",description:"سحب الطلبات والمدفوعات والمنتجات والعملاء.",stage:"طبقة الموصل جاهزة"},
  smart_life:{title:"Smart Life",logo:"https://smarterp.top/favicon.ico",description:"ربط قاعدة البيانات المحاسبية للمنشأة للقراءة والتحليل.",stage:"قابل للتفعيل بعد بيانات الاتصال"},
};

function fmt(v:string|null){return v?new Intl.DateTimeFormat("ar-SA",{dateStyle:"medium",timeStyle:"short"}).format(new Date(v)):"—"}

export default function IntegrationsPage(){
 const supabase=getSupabaseBrowserClient();
 const [catalog,setCatalog]=useState<Connector[]>([]);
 const [legalEntities,setLegalEntities]=useState<{id:string;name:string;code?:string|null}[]>([]);
 const [legalEntityId,setLegalEntityId]=useState("");
 const [states,setStates]=useState<State[]>([]);
 const [selected,setSelected]=useState("qoyod");
 const [apiKey,setApiKey]=useState("");
 const [smartBaseUrl,setSmartBaseUrl]=useState("https://smarterp.top/api/v1.0");
 const [smartCompany,setSmartCompany]=useState("");
 const [smartUsername,setSmartUsername]=useState("");
 const [smartPassword,setSmartPassword]=useState("");
 const [companyName,setCompanyName]=useState("قيود");
 const [showDetails,setShowDetails]=useState(false);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState("");
 const [notice,setNotice]=useState("");
 const [error,setError]=useState("");
 const [canManage,setCanManage]=useState(false);
 const [canPublish,setCanPublish]=useState(false);
 const [review,setReview]=useState<any|null>(null);
 const [reconciliation,setReconciliation]=useState<Reconciliation>({status:"not_run",difference_minor:0});
 const [reviewQueue,setReviewQueue]=useState<ReviewItem[]>([]);
 const [reviewQueueTotal,setReviewQueueTotal]=useState(0);
 const [reviewQueueFilter,setReviewQueueFilter]=useState<"needs_review"|"rejected"|"unmapped"|"all">("needs_review");
 const [publishConfirm,setPublishConfirm]=useState(false); const [publishPreview,setPublishPreview]=useState<{row_count:number;debit_minor:number;credit_minor:number;net_minor:number;date_from:string|null;date_to:string|null;currencies:string[]}|null>(null);
 const [accounts,setAccounts]=useState<MappingTarget[]>([]);
 const [mappingTargets,setMappingTargets]=useState<Record<string,string>>({});
 const [mappingBusy,setMappingBusy]=useState("");
 const [dimensionTypes,setDimensionTypes]=useState<Record<string,string>>({});
 const [dimensionTargets,setDimensionTargets]=useState<Record<string,string>>({});
 const [dimensionOptions,setDimensionOptions]=useState<Record<string,MappingTarget[]>>({});

 async function load(){
   setLoading(true);setError("");
   const {data:userData}=await supabase.auth.getUser();
   if(!userData.user){window.location.assign("/login?next=/workspace/integrations");return}
   const org=sessionStorage.getItem("activeOrganizationId");
   if(!org){window.location.assign("/start");return}
   const [{data:cat,error:ce},{data:st,error:se},{data:access,error:ae},{data:le,error:lee}]=await Promise.all([
     supabase.rpc("get_connector_catalog",{p_organization_id:org}),
     supabase.rpc("get_connector_connection_state",{p_organization_id:org}),
     supabase.rpc("get_my_org_access",{p_organization_id:org}),
     supabase.from("legal_entities").select("id,name,code").eq("organization_id",org).order("name")
   ]);
   const first=ce||se||ae||lee;if(first){setError(first.message);setLoading(false);return}
   setCatalog((cat??[]) as Connector[]);
   const entities=(le??[]) as {id:string;name:string;code?:string|null}[];
   setLegalEntities(entities);
   setLegalEntityId(entities[0]?.id??"");
   setStates((st??[]) as State[]);
   const {data:acc,error:acce}=await supabase.from("accounts").select("id,name,code").eq("organization_id",org).order("code");
   if(!acce)setAccounts((acc??[]) as MappingTarget[]);
   setCanManage((access??[]).some((x:{permission_key?:string;granted?:boolean})=>x.permission_key==="connector.manage"&&x.granted===true));
   setCanPublish((access??[]).some((x:{permission_key?:string;granted?:boolean})=>x.permission_key==="actuals.publish"&&x.granted===true));
   const targetTables:Record<string,string>={legal_entity:"legal_entities",branch:"branches",department:"departments",cost_center:"cost_centers",region:"regions",product:"products",project:"projects"};
   const targetEntries=await Promise.all(Object.entries(targetTables).map(async([type,table])=>{const {data}=await supabase.from(table).select("id,name,code").eq("organization_id",org).order("code");return [type,(data??[]) as MappingTarget[]] as const;}));
   setDimensionOptions(Object.fromEntries(targetEntries));
   setLoading(false);
 }
 useEffect(()=>{void load()},[]);
 const providers=useMemo(()=>catalog.filter(c=>providerMeta[c.connector_key]),[catalog]);
 const current=providers.find(c=>c.connector_key===selected)||providers[0];
 const currentState=states.find(s=>s.connector_id===current?.id);
 useEffect(()=>{if(currentState?.data_source_id)void refreshReview(currentState.data_source_id)},[currentState?.data_source_id,reviewQueueFilter]);
 const isQoyod=selected==="qoyod";
 const isSmartLife=selected==="smart_life";

 async function refreshReview(dataSourceId:string,syncRunId?:string|null){ const {data,error:e}=await supabase.rpc("get_integration_review_summary",{p_data_source_id:dataSourceId,p_sync_run_id:syncRunId??null}); if(e){setError(e.message);return} setReview(data??null); const runId=syncRunId??data?.sync_run_id??null; if(runId){ const [{data:rec,error:re},{data:q,error:qe}]=await Promise.all([supabase.from("integration_reconciliations").select("status,difference_minor,blocking_reason").eq("data_source_id",dataSourceId).eq("sync_run_id",runId).maybeSingle(),supabase.rpc("get_integration_review_queue",{p_data_source_id:dataSourceId,p_sync_run_id:runId,p_status:reviewQueueFilter,p_limit:100,p_offset:0})]); if(!re)setReconciliation((rec??{status:"not_run",difference_minor:0}) as Reconciliation); if(!qe){const payload=q as {total?:number;items?:ReviewItem[]}|null;setReviewQueue(payload?.items??[]);setReviewQueueTotal(payload?.total??0)} } else {setReviewQueue([]);setReviewQueueTotal(0);setReconciliation({status:"not_run",difference_minor:0});} }

 async function connect(){
   const org=sessionStorage.getItem("activeOrganizationId");
   if(!org||!current)return;
   setBusy("connect");setError("");setNotice("");
   try{
     let sourceId=currentState?.data_source_id;
     if(!legalEntityId)throw new Error("اختر الشركة/الكيان القانوني أولًا");
     if(!sourceId){
       const {data,error:e}=await supabase.rpc("manage_data_source",{
         p_organization_id:org,p_data_source_id:null,p_action:"create",
         p_source_type:"api",p_system_name:companyName.trim()||providerMeta[selected].title,
         p_connection_key:null,p_sync_mode:"near_real_time",p_legal_entity_id:legalEntityId
       });
       if(e)throw e; sourceId=String(data);
       const {error:ae}=await supabase.rpc("attach_data_source_connector",{
         p_organization_id:org,p_data_source_id:sourceId,p_connector_id:current.id,
         p_connection_ref:null,p_sync_config:{mode:"near_real_time",read_only:true}
       });
       if(ae)throw ae;
     }else{
       const {error:ue}=await supabase.rpc("manage_data_source",{p_organization_id:org,p_data_source_id:sourceId,p_action:"update",p_source_type:"api",p_system_name:companyName.trim()||providerMeta[selected].title,p_connection_key:null,p_sync_mode:"near_real_time",p_legal_entity_id:legalEntityId});
       if(ue)throw ue;
     }
     if(isQoyod){
       if(!apiKey.trim())throw new Error("أدخل مفتاح API أولًا");
       const {error:se}=await supabase.rpc("save_connector_secret",{p_organization_id:org,p_connector_id:current.id,p_secret:apiKey.trim()});
       if(se)throw se;
       setApiKey("");
     }
     if(isSmartLife){
       if(!smartBaseUrl.trim()||!smartCompany.trim()||!smartUsername.trim()||!smartPassword.trim()) throw new Error("أكمل عنوان API واسم الشركة واسم المستخدم وكلمة المرور");
       const credential=JSON.stringify({base_url:smartBaseUrl.trim().replace(/\/$/, ""),company:smartCompany.trim(),username:smartUsername.trim(),password:smartPassword});
       const {error:se}=await supabase.rpc("save_connector_secret",{p_organization_id:org,p_connector_id:current.id,p_secret:credential});
       if(se)throw se;
       setSmartPassword("");
     }
     setNotice("تم حفظ إعداد الاتصال داخل Vault بشكل آمن. النظام الخارجي سيُعامل كمصدر قراءة فقط.");
     await load();
   }catch(e){setError(e instanceof Error?e.message:"تعذر إعداد الاتصال");}
   finally{setBusy("")}
 }

 async function run(mode:"test"|"sync"){
   const org=sessionStorage.getItem("activeOrganizationId");
   if(!org||!currentState)return;
   setBusy(mode);setError("");setNotice("");
   const {data,error:e}=await supabase.functions.invoke("integration-sync",{body:{organization_id:org,connector_id:currentState.connector_id,mode}});
   if(e){setError(e.message);setBusy("");return}
   if(data?.error){setError(String(data.error));setBusy("");return}
   if(mode==="sync" && data?.run_id){
     const normalized=await supabase.functions.invoke("integration-normalize",{body:{organization_id:org,sync_run_id:data.run_id}});
     if(normalized.error){setError(`تم سحب البيانات، لكن تعذر تشغيل طبقة التطبيع: ${normalized.error.message}`);setBusy("");return}
     if(normalized.data?.error){setError(`تم سحب البيانات، لكن تعذر تشغيل طبقة التطبيع: ${String(normalized.data.error)}`);setBusy("");return}
     const mapped=await supabase.rpc("apply_integration_account_mappings",{p_data_source_id:currentState.data_source_id,p_sync_run_id:data.run_id,p_mapping_version:"v1"}); if(mapped.error){setError(`تم التطبيع، لكن تعذر تطبيق مطابقة الحسابات: ${mapped.error.message}`);setBusy("");return}
     const dimensions=await supabase.rpc("apply_integration_dimension_mappings",{p_data_source_id:currentState.data_source_id,p_sync_run_id:data.run_id}); if(dimensions.error){setError(`تمت مطابقة الحسابات، لكن تعذر تطبيق مطابقة الأبعاد: ${dimensions.error.message}`);setBusy("");return}
     const reconciled=await supabase.rpc("reconcile_integration",{p_data_source_id:currentState.data_source_id,p_sync_run_id:data.run_id}); if(reconciled.error){setError(`تمت المزامنة والمطابقة، لكن تعذرت المصالحة: ${reconciled.error.message}`);setBusy("");return}
     await refreshReview(currentState.data_source_id,data.run_id);
     setNotice(`اكتملت المزامنة: ${data.accepted??0} سجل خام، ثم التطبيع والمطابقة. راجع لوحة الحالة قبل المصالحة.`);
   }else{
     setNotice("تم اختبار الاتصال بنجاح دون تعديل النظام الخارجي.");
   }
   await load();setBusy("");
 }

 async function publishCurrent(){ if(!currentState?.data_source_id||!review?.sync_run_id)return; setBusy("publish");setError("");setNotice(""); try{ const check=await supabase.rpc("validate_integration_publishability",{p_data_source_id:currentState.data_source_id,p_sync_run_id:review.sync_run_id}); if(check.error)throw check.error; if(!(check.data as {publishable?:boolean})?.publishable)throw new Error("المصدر غير جاهز للنشر. أكمل المراجعة والمطابقة والمصالحة أولًا."); if(!publishConfirm){const preview=await supabase.rpc("get_integration_publish_preview",{p_data_source_id:currentState.data_source_id,p_sync_run_id:review.sync_run_id}); if(preview.error)throw preview.error; setPublishPreview(preview.data as unknown as {row_count:number;debit_minor:number;credit_minor:number;net_minor:number;date_from:string|null;date_to:string|null;currencies:string[]}); setPublishConfirm(true); return} const {error:e}=await supabase.rpc("publish_integration_actuals",{p_data_source_id:currentState.data_source_id,p_sync_run_id:review.sync_run_id}); if(e)throw e; setPublishConfirm(false); setNotice("تم نشر البيانات الفعلية إلى القوائم المالية بنجاح. يمكنك متابعة القوائم والتحليل الآن."); await refreshReview(currentState.data_source_id,review.sync_run_id); }catch(e){setError(e instanceof Error?e.message:"تعذر نشر البيانات")}finally{setBusy("")} }
 async function saveReviewDimension(item:ReviewItem,sourceDimension:string){ const targetType=dimensionTypes[item.id+":"+sourceDimension]; const targetId=dimensionTargets[item.id+":"+sourceDimension]; if(!targetType||!targetId){setError("اختر نوع البعد والقيمة المستهدفة أولًا");return} const org=sessionStorage.getItem("activeOrganizationId"); if(!org||!currentState)return; setMappingBusy(item.id+":"+sourceDimension);setError(""); try{ const sourceValue=String(item.dimensions?.[sourceDimension]??"").trim(); if(!sourceValue)throw new Error("لا توجد قيمة مصدر لهذا البعد"); const {error:e}=await supabase.rpc("upsert_integration_dimension_mapping",{p_data_source_id:currentState.data_source_id,p_source_dimension:sourceDimension,p_source_value:sourceValue,p_target_dimension_type:targetType,p_target_id:targetId}); if(e)throw e; const applied=await supabase.rpc("apply_integration_dimension_mappings",{p_data_source_id:currentState.data_source_id,p_sync_run_id:item.sync_run_id}); if(applied.error)throw applied.error; await refreshReview(currentState.data_source_id,item.sync_run_id); setNotice("تم حفظ مطابقة البعد كمسودة. يمكن اعتمادها من صاحب صلاحية الاعتماد."); }catch(e){setError(e instanceof Error?e.message:"تعذر حفظ مطابقة البعد")}finally{setMappingBusy("")} }
 async function approveReviewDimension(item:ReviewItem,sourceDimension:string){ const sourceValue=String(item.dimensions?.[sourceDimension]??"").trim(); if(!sourceValue||!currentState)return; setMappingBusy(item.id+":"+sourceDimension);setError(""); try{ const result=await supabase.from("integration_dimension_mappings").select("id,created_by").eq("data_source_id",currentState.data_source_id).eq("source_dimension",sourceDimension).eq("source_value",sourceValue).maybeSingle(); const me=result.error; const m=(result.data as unknown as {id:string;created_by:string|null}|null); if(me)throw me; if(!m?.id)throw new Error("لم يتم العثور على مسودة مطابقة لهذا البعد"); const {error:e}=await supabase.rpc("review_integration_dimension_mapping",{p_mapping_id:m.id,p_action:"approve"}); if(e)throw e; const applied=await supabase.rpc("apply_integration_dimension_mappings",{p_data_source_id:currentState.data_source_id,p_sync_run_id:item.sync_run_id}); if(applied.error)throw applied.error; const rec=await supabase.rpc("reconcile_integration",{p_data_source_id:currentState.data_source_id,p_sync_run_id:item.sync_run_id}); if(rec.error)throw rec.error; await refreshReview(currentState.data_source_id,item.sync_run_id); setNotice("تم اعتماد مطابقة البعد وإعادة تطبيق المطابقة والمصالحة."); }catch(e){setError(e instanceof Error?e.message:"تعذر اعتماد مطابقة البعد")}finally{setMappingBusy("")} }
 async function saveReviewAccount(item:ReviewItem){ const target=mappingTargets[item.id]; if(!target){setError("اختر الحساب المالي المستهدف أولًا");return} const org=sessionStorage.getItem("activeOrganizationId"); if(!org||!currentState)return; setMappingBusy(item.id);setError(""); try{ const sourceCode=item.account_external_id||item.account_code||item.account_name||item.source_record_key; const sourceName=item.account_name||item.description||item.source_record_key; const {error:e}=await supabase.rpc("upsert_account_mapping",{p_organization_id:org,p_mapping_version:"v1",p_source_code:sourceCode,p_source_name:sourceName,p_target_account_id:target}); if(e)throw e; const mapped=await supabase.rpc("apply_integration_account_mappings",{p_data_source_id:currentState.data_source_id,p_sync_run_id:item.sync_run_id,p_mapping_version:"v1"}); if(mapped.error)throw mapped.error; const dimensions=await supabase.rpc("apply_integration_dimension_mappings",{p_data_source_id:currentState.data_source_id,p_sync_run_id:item.sync_run_id}); if(dimensions.error)throw dimensions.error; const rec=await supabase.rpc("reconcile_integration",{p_data_source_id:currentState.data_source_id,p_sync_run_id:item.sync_run_id}); if(rec.error)throw rec.error; await refreshReview(currentState.data_source_id,item.sync_run_id); setNotice("تم حفظ المطابقة كمسودة وإعادة تطبيق المطابقة والمصالحة. اعتمادها يتم من صاحب صلاحية الاعتماد."); }catch(e){setError(e instanceof Error?e.message:"تعذر حفظ المطابقة")}finally{setMappingBusy("")} }
 async function approveReviewAccount(item:ReviewItem){ if(!item.account_mapping_id||!currentState)return; setMappingBusy(item.id);setError(""); try{ const {error:e}=await supabase.rpc("review_account_mapping",{p_mapping_id:item.account_mapping_id,p_action:"approve"}); if(e)throw e; const mapped=await supabase.rpc("apply_integration_account_mappings",{p_data_source_id:currentState.data_source_id,p_sync_run_id:item.sync_run_id,p_mapping_version:"v1"}); if(mapped.error)throw mapped.error; const dimensions=await supabase.rpc("apply_integration_dimension_mappings",{p_data_source_id:currentState.data_source_id,p_sync_run_id:item.sync_run_id}); if(dimensions.error)throw dimensions.error; const rec=await supabase.rpc("reconcile_integration",{p_data_source_id:currentState.data_source_id,p_sync_run_id:item.sync_run_id}); if(rec.error)throw rec.error; await refreshReview(currentState.data_source_id,item.sync_run_id); setNotice("تم اعتماد مطابقة الحساب وإعادة تطبيق المطابقة والمصالحة."); }catch(e){setError(e instanceof Error?e.message:"تعذر اعتماد المطابقة")}finally{setMappingBusy("")} }
 return <main dir="rtl" className="min-h-screen bg-white text-[#292929]">
  <header className="border-b border-slate-200 bg-white">
   <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
    <div><p className="text-[10px] font-bold tracking-[0.16em] text-slate-400">SYSTEM INTEGRATIONS</p><h1 className="mt-1 text-xl font-bold text-[#292929] sm:text-2xl">تكامل الأنظمة</h1><p className="mt-1 text-sm text-slate-500">اربط الأنظمة التي تعمل منها المنشأة، واسحب البيانات إلى المنصة دون أي كتابة أو تعديل على النظام المصدر.</p></div>
    <Link href="/workspace/data-monitoring" className="border border-slate-300 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700">مراقبة البيانات</Link>
   </div>
  </header>
  <section className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
   <div className="border border-slate-200 bg-slate-50 p-4 sm:p-5"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold text-[#292929]">قاعدة التكامل</p><p className="mt-1 text-xs leading-6 text-slate-600">النظام الخارجي = مصدر قراءة فقط. البيانات تدخل: مصدر خارجي → بيانات خام → تطبيع ومطابقة محلية → القوائم والتحليل.</p></div><span className="border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-600">READ ONLY</span></div></div>
   {notice&&<div className="mt-4 border border-slate-300 bg-slate-100 p-4 text-sm font-semibold text-slate-700">{notice}</div>}
   {error&&<div className="mt-4 border border-slate-300 bg-slate-100 p-4 text-sm text-red-700">{error}</div>}
   {loading?<div className="mt-6 border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">جارٍ تحميل التكاملات…</div>:<>
    <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
     {providers.map(c=>{const m=providerMeta[c.connector_key];const s=states.find(x=>x.connector_id===c.id);return <button key={c.id} type="button" onClick={()=>setSelected(c.connector_key)} className={`group relative min-h-[104px] border px-3.5 py-3 text-right transition-all duration-200 ${selected===c.connector_key?"border-slate-400 bg-slate-50 shadow-sm":"border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}><div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center border bg-white p-1.5 ${selected===c.connector_key?"border-slate-400":"border-slate-200"}`}><img src={m.logo} alt={`${m.title} logo`} className="h-full w-full object-contain" loading="lazy" /></span><div className="min-w-0"><h2 className="truncate text-sm font-bold text-[#292929]">{m.title}</h2><p className="mt-0.5 truncate text-[11px] text-slate-500">{m.description}</p></div></div><span className="shrink-0 text-[9px] font-bold text-slate-500">{s?.has_credential?"متصل":"غير متصل"}</span></div><div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5"><span className="text-[9px] font-bold text-slate-400">{m.stage}</span><span className="text-[10px] text-slate-400">›</span></div></button>})}
    </div>
    {current&&<section className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
      <div className="border border-slate-200 bg-white p-5 sm:p-6">
       <div className="border-b border-slate-100 pb-5"><p className="text-[10px] font-bold tracking-[0.14em] text-slate-400">CONNECTION SETUP</p><h2 className="mt-1 text-xl font-bold text-[#292929]">إعداد {providerMeta[selected].title}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{isQoyod?"أدخل مفتاح API الخاص بالمنشأة في قيود. لن يظهر المفتاح مرة أخرى بعد حفظه.":isSmartLife?"أدخل بيانات API الخاصة بحساب Smart Life. سيتم استخدامها لتسجيل الدخول إلى API وسحب البيانات فقط، ولن تُرسل أي عمليات تعديل إلى Smart Life.":"تم تجهيز طبقة الموصل وقاعدة البيانات لهذا النظام؛ تنفيذ الموصل التنفيذي يتم تباعًا بعد اعتماد مخطط المصادقة الخاص بالمزوّد."}</p></div>
       {(isQoyod||isSmartLife)?<div className="mt-6 max-w-2xl space-y-4">
         <label className="block text-sm font-semibold">الشركة / الكيان القانوني<select value={legalEntityId} onChange={e=>setLegalEntityId(e.target.value)} className="mt-2 w-full border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500"><option value="">اختر الشركة</option>{legalEntities.map(le=><option key={le.id} value={le.id}>{le.name}{le.code?` — ${le.code}`:""}</option>)}</select></label>
         {legalEntities.length===0&&<p className="text-xs leading-5 text-slate-500">لا توجد كيانات قانونية مسجلة لهذه المنظمة. أنشئ الشركة أولًا من إعدادات الشركة قبل ربط مصدر خارجي.</p>}
         <label className="block text-sm font-semibold">اسم المصدر<input value={companyName} onChange={e=>setCompanyName(e.target.value)} className="mt-2 w-full border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500" placeholder="مثال: قيود — الشركة الرئيسية"/></label>
         {isSmartLife&&<><label className="block text-sm font-semibold">عنوان API<input value={smartBaseUrl} onChange={e=>setSmartBaseUrl(e.target.value)} className="mt-2 w-full border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500" placeholder="https://.../api/v1.0"/></label><label className="block text-sm font-semibold">اسم الشركة في Smart Life<input value={smartCompany} onChange={e=>setSmartCompany(e.target.value)} className="mt-2 w-full border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500" placeholder="اسم الشركة / الشركة في API"/></label><label className="block text-sm font-semibold">اسم المستخدم<input value={smartUsername} onChange={e=>setSmartUsername(e.target.value)} className="mt-2 w-full border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500" placeholder="اسم مستخدم API"/></label><label className="block text-sm font-semibold">كلمة المرور<input type="password" autoComplete="new-password" value={smartPassword} onChange={e=>setSmartPassword(e.target.value)} className="mt-2 w-full border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500" placeholder="كلمة مرور API"/></label></>}{isQoyod&&<label className="block text-sm font-semibold">مفتاح API<input type="password" autoComplete="off" value={apiKey} onChange={e=>setApiKey(e.target.value)} className="mt-2 w-full border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-slate-500" placeholder="أدخل المفتاح هنا"/></label>}
         <div className="flex flex-wrap gap-2"><button disabled={!canManage||busy==="connect"} onClick={()=>void connect()} className="border border-slate-400 bg-slate-200 px-5 py-3 text-sm font-bold text-[#292929] disabled:opacity-50">{busy==="connect"?"جارٍ الحفظ…":"حفظ الاتصال"}</button>{currentState?.has_credential&&<><button disabled={!!busy} onClick={()=>void run("test")} className="border border-slate-400 bg-slate-100 px-5 py-3 text-sm font-bold text-[#292929] disabled:opacity-50">{busy==="test"?"جارٍ الاختبار…":"اختبار الاتصال"}</button><button disabled={!!busy} onClick={()=>void run("sync")} className="border border-slate-400 bg-slate-200 px-5 py-3 text-sm font-bold text-[#292929] disabled:opacity-50">{busy==="sync"?"جارٍ المزامنة…":"مزامنة الآن"}</button></>}</div>
         {!canManage&&<p className="text-xs text-slate-500">لا تملك صلاحية إدارة التكاملات في هذه الشركة.</p>}
       </div>:<div className="mt-6 border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-600">هذا الموصل موجود في الكتالوج ومصمم ليعمل بالقراءة فقط. لن يتم تفعيل اتصال خارجي له قبل تنفيذ طبقة المصادقة والمزامنة الخاصة بالمزوّد.</div>}
      </div>
      <aside className="border border-slate-200 bg-slate-50 p-4.5">
       <h3 className="font-bold text-[#292929]">حالة الاتصال</h3>
       <dl className="mt-5 space-y-3 text-sm"><div className="flex justify-between gap-4"><dt className="text-slate-500">الموصل</dt><dd className="font-semibold">{current.display_name}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">الوضع</dt><dd className="font-semibold">قراءة فقط</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">الاعتماد</dt><dd className="font-semibold">{currentState?.has_credential?"موجود":"غير محفوظ"}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">آخر نجاح</dt><dd className="font-semibold text-left">{fmt(currentState?.last_success_at??null)}</dd></div></dl>
       {currentState?.last_error_message&&<div className="mt-5 border border-slate-300 bg-white p-3 text-xs leading-5 text-red-700">{currentState.last_error_message}</div>}
      </aside>
    </section>}
    {currentState&&review&&reviewQueueTotal>0&&<section className="mt-5 border border-slate-200 bg-white p-5 sm:p-6"><div className="flex items-center justify-between border-b border-slate-100 pb-4"><div><p className="text-[10px] font-bold tracking-[0.14em] text-slate-400">REVIEW QUEUE</p><h2 className="mt-1 text-lg font-bold">سجلات تحتاج مراجعة</h2><p className="mt-1 text-xs text-slate-500">لا يتم نشر أي سجل غير مكتمل. هذه القائمة للمراجعة قبل المصالحة والنشر.</p></div><span className="border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600">{reviewQueueTotal} سجل</span></div><div className="mt-4 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-4"><span className="text-[11px] font-semibold text-slate-500">عرض:</span>{[["needs_review","تحتاج مراجعة"],["unmapped","غير مطابقة"],["rejected","مرفوضة"],["all","الكل"]].map(([value,label])=><button key={value} type="button" onClick={()=>setReviewQueueFilter(value as typeof reviewQueueFilter)} className={`border px-3 py-1.5 text-[11px] font-bold ${reviewQueueFilter===value?"border-slate-500 bg-slate-800 text-white":"border-slate-300 bg-white text-slate-600"}`}>{label}</button>)}</div><div className="mt-4 overflow-x-auto"><table className="min-w-full text-right text-xs"><thead><tr className="border-b border-slate-200 text-slate-500"><th className="px-3 py-2 font-semibold">التاريخ</th><th className="px-3 py-2 font-semibold">المرجع</th><th className="px-3 py-2 font-semibold">الحساب المصدر</th><th className="px-3 py-2 font-semibold">مدين</th><th className="px-3 py-2 font-semibold">دائن</th><th className="px-3 py-2 font-semibold">الحالة والإجراء</th></tr></thead><tbody>{reviewQueue.map(item=><tr key={item.id} className="border-b border-slate-100"><td className="whitespace-nowrap px-3 py-2">{item.transaction_date??"—"}</td><td className="px-3 py-2">{item.journal_no||item.source_record_key}</td><td className="max-w-[280px] px-3 py-2"><div className="font-semibold">{item.account_code||"—"} {item.account_name||""}</div><div className="mt-0.5 text-[10px] text-slate-400">{item.account_external_id||item.description||"—"}</div></td><td className="px-3 py-2 tabular-nums">{item.debit_minor}</td><td className="px-3 py-2 tabular-nums">{item.credit_minor}</td><td className="min-w-[360px] px-3 py-2"><span className="font-semibold text-slate-700">{item.mapping_status!=="mapped"?"مطابقة الحساب تحتاج مراجعة":item.dimension_mapping_status!=="mapped"?"مطابقة الأبعاد تحتاج مراجعة":"يحتاج مراجعة"}</span><div className="mt-1 text-[10px] leading-4 text-slate-500">{item.mapping_message||item.dimension_mapping_message||item.normalization_message||""}</div>{item.mapping_status!=="mapped"&&<div className="mt-2 flex flex-wrap gap-2"><select value={mappingTargets[item.id]??""} onChange={e=>setMappingTargets(x=>({...x,[item.id]:e.target.value}))} className="min-w-[210px] border border-slate-300 bg-white px-2 py-1.5 text-[11px]"><option value="">اختر الحساب المستهدف</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.code?a.code+" — ":""}{a.name}</option>)}</select><button disabled={mappingBusy===item.id} onClick={()=>void saveReviewAccount(item)} className="border border-slate-300 bg-slate-100 px-3 py-1.5 text-[11px] font-bold">{mappingBusy===item.id?"جارٍ الحفظ…":"حفظ المطابقة"}</button>{item.account_mapping_id&&<button disabled={mappingBusy===item.id} onClick={()=>void approveReviewAccount(item)} className="border border-slate-400 bg-slate-200 px-3 py-1.5 text-[11px] font-bold">{mappingBusy===item.id?"جارٍ التنفيذ…":"اعتماد المطابقة"}</button>}</div>}{item.dimension_mapping_status!=="mapped"&&Object.entries(item.dimensions??{}).map(([sourceDimension,sourceValue])=><div key={sourceDimension} className="mt-2 border border-slate-200 bg-slate-50 p-2"><div className="mb-1 text-[10px] font-semibold text-slate-600">{sourceDimension}: {String(sourceValue)}</div><div className="flex flex-wrap gap-2"><select value={dimensionTypes[item.id+":"+sourceDimension]??""} onChange={e=>setDimensionTypes(x=>({...x,[item.id+":"+sourceDimension]:e.target.value}))} className="min-w-[150px] border border-slate-300 bg-white px-2 py-1.5 text-[11px]"><option value="">نوع البعد</option>{[["legal_entity","شركة"],["branch","فرع"],["department","إدارة"],["cost_center","مركز تكلفة"],["region","منطقة"],["product","منتج"],["project","مشروع"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><select disabled={!dimensionTypes[item.id+":"+sourceDimension]} value={dimensionTargets[item.id+":"+sourceDimension]??""} onChange={e=>setDimensionTargets(x=>({...x,[item.id+":"+sourceDimension]:e.target.value}))} className="min-w-[190px] border border-slate-300 bg-white px-2 py-1.5 text-[11px]"><option value="">القيمة المستهدفة</option>{(dimensionOptions[dimensionTypes[item.id+":"+sourceDimension]??""]??[]).map(a=><option key={a.id} value={a.id}>{a.code?a.code+" — ":""}{a.name}</option>)}</select><button disabled={!!mappingBusy} onClick={()=>void saveReviewDimension(item,sourceDimension)} className="border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-bold">{mappingBusy===item.id+":"+sourceDimension?"جارٍ الحفظ…":"حفظ البعد"}</button>{item.dimension_mapping_status==="mapped"?null:<button disabled={!!mappingBusy} onClick={()=>void approveReviewDimension(item,sourceDimension)} className="border border-slate-400 bg-slate-200 px-3 py-1.5 text-[11px] font-bold">اعتماد البعد</button>}</div></div>)}</td></tr>)}</tbody></table></div></section>
    {currentState&&review&&<section className="mt-5 border border-slate-200 bg-white p-5 sm:p-6"><div className="flex flex-wrap items-center gap-2">{publish}<span className="text-[11px] text-slate-500">{reviewQueueTotal>0?"بعد إكمال المراجعة والمصالحة يصبح النشر متاحًا.":"لا توجد سجلات تحتاج مراجعة حاليًا؛ راجع حالة المصالحة ثم نفّذ النشر إذا اجتازت الدفعة جميع البوابات."}</span></div></section>}
    {currentState&&review&&<section className="mt-5 border border-slate-200 bg-white p-5 sm:p-6"><div className="flex items-center justify-between border-b border-slate-100 pb-4"><div><p className="text-[10px] font-bold tracking-[0.14em] text-slate-400">INTEGRATION REVIEW</p><h2 className="mt-1 text-lg font-bold">حالة دورة البيانات</h2></div><button type="button" disabled={!!busy} onClick={()=>void refreshReview(currentState.data_source_id,review.sync_run_id)} className="border border-slate-300 bg-slate-100 px-4 py-2 text-xs font-bold">تحديث</button></div><div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{[["إجمالي السجلات",review.total],["تم التطبيع",review.normalized],["مطابقة الحسابات",review.account_mapped],["مطابقة الأبعاد",review.dimension_mapped],["حسابات تحتاج مراجعة",review.account_needs_review],["أبعاد تحتاج مراجعة",review.dimension_needs_review],["مرفوض",review.rejected],["جاهز للمصالحة",review.ready_for_reconciliation]].map(([label,value],i)=><div key={String(label)} className="border border-slate-200 p-3"><p className="text-[11px] text-slate-500">{String(label)}</p><p className="mt-1 text-xl font-bold">{String(value)}</p></div>)}</div><div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2"><div className="text-xs font-semibold text-slate-600">المسار: خام → تطبيع → مطابقة الحسابات → مطابقة الأبعاد → مراجعة → مصالحة → نشر</div><div className="border border-slate-200 bg-slate-50 p-3 text-xs"><span className="text-slate-500">المصالحة: </span><b>{reconciliation.status==="passed"?"ناجحة":reconciliation.status==="blocked"?"متوقفة بسبب سجلات غير مكتملة":reconciliation.status==="failed"?"فشلت":"لم تُنفذ"}</b>{reconciliation.difference_minor!==0&&<span className="mr-2 text-red-700">الفرق: {reconciliation.difference_minor}</span>}{reconciliation.blocking_reason&&<p className="mt-1 text-slate-500">{reconciliation.blocking_reason}</p>}</div></div></section>}
   </>}
  </section>
 </main>
}