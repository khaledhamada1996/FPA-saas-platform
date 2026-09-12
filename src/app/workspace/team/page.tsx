"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Role = { role_key: string; name: string; description: string | null; hierarchy_level: number };
type Permission = { permission_key: string; name: string; description: string | null; permission_type: string; screen_key: string | null; route_path: string | null; category: string | null; sort_order: number };
type Member = { user_id: string; email: string | null; role: string; role_key: string; hierarchy_level: number; parent_user_id: string | null; created_at: string; manageable: boolean; overrides: Record<string, boolean> };
type ScopeItem = { id: string; name: string; code: string | null };
type ScopeCatalog = Record<string, ScopeItem[]>;
type ScopeRow = { scope_type: string; scope_id: string };

const scopeTypes = [
  ["legal_entity", "الكيانات القانونية"],
  ["branch", "الفروع"],
  ["department", "الإدارات"],
  ["cost_center", "مراكز التكلفة"],
  ["region", "المناطق"],
  ["product", "المنتجات"],
  ["project", "المشروعات"],
] as const;

export default function TeamPage() {
  const supabase = getSupabaseBrowserClient();
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [actorLevel, setActorLevel] = useState(0);
  const [actorPermissions, setActorPermissions] = useState<Set<string>>(new Set());
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [editing, setEditing] = useState<Member | null>(null);
  const [saving, setSaving] = useState(false);
  const [scopeCatalog, setScopeCatalog] = useState<ScopeCatalog>({});
  const [actorScopes, setActorScopes] = useState<ScopeRow[]>([]);
  const [editingScopes, setEditingScopes] = useState<ScopeRow[]>([]);
  const [scopeLoading, setScopeLoading] = useState(false);

  const orgId = () => typeof window !== "undefined" ? window.sessionStorage.getItem("activeOrganizationId") : null;
  const manageableRoles = useMemo(() => roles.filter((r) => r.hierarchy_level <= actorLevel), [roles, actorLevel]);
  const manageablePermissions = useMemo(() => permissions.filter((p) => actorPermissions.has(p.permission_key)), [permissions, actorPermissions]);
  const screenPermissions = useMemo(() => manageablePermissions.filter((p) => p.permission_type === "screen"), [manageablePermissions]);
  const actionPermissions = useMemo(() => manageablePermissions.filter((p) => p.permission_type !== "screen"), [manageablePermissions]);
  const canViewScopes = actorPermissions.has("data_scope.view");
  const canManageScopes = actorPermissions.has("data_scope.manage");

  async function load() {
    const id = orgId();
    if (!id) return;
    setError("");
    const [membersResult, rolesResult, permissionsResult, accessResult, manageResult, catalogResult, actorScopeResult] = await Promise.all([
      supabase.rpc("get_team_members", { p_organization_id: id }),
      supabase.from("organization_roles").select("role_key,name,description,hierarchy_level").eq("organization_id", id).order("hierarchy_level", { ascending: false }),
      supabase.from("organization_permissions").select("permission_key,name,description,permission_type,screen_key,route_path,category,sort_order").order("sort_order"),
      supabase.rpc("get_my_org_access", { p_organization_id: id }),
      supabase.rpc("has_org_permission", { p_organization_id: id, p_permission_key: "manage_users" }),
      supabase.rpc("get_team_data_scope_catalog", { p_organization_id: id }),
      supabase.rpc("get_team_member_data_scopes", { p_organization_id: id, p_user_id: (typeof window !== "undefined" ? window.sessionStorage.getItem("currentUserId") : null) }),
    ]);
    if (membersResult.error) { setError(membersResult.error.message); return; }
    if (rolesResult.error) { setError(rolesResult.error.message); return; }
    if (permissionsResult.error) { setError(permissionsResult.error.message); return; }
    if (accessResult.error) { setError(accessResult.error.message); return; }
    setMembers((membersResult.data ?? []) as Member[]);
    setRoles((rolesResult.data ?? []) as Role[]);
    setPermissions((permissionsResult.data ?? []) as Permission[]);
    const access = (accessResult.data ?? []) as Array<{ user_id: string; hierarchy_level: number; permission_key: string; granted: boolean }>;
    setActorLevel(access[0]?.hierarchy_level ?? 0);
    const granted = new Set(access.filter((x) => x.granted).map((x) => x.permission_key));
    setActorPermissions(granted);
    setCanManage(Boolean(manageResult.data));
    if (!catalogResult.error && catalogResult.data) setScopeCatalog((catalogResult.data as ScopeCatalog) ?? {});
    if (!actorScopeResult.error) setActorScopes((actorScopeResult.data ?? []) as ScopeRow[]);
    if (!inviteRole) {
      const first = (rolesResult.data ?? []).filter((r: Role) => r.hierarchy_level <= (access[0]?.hierarchy_level ?? 0))[0];
      if (first) setInviteRole(first.role_key);
    }
  }

  useEffect(() => { void load(); }, []);

  async function invite() {
    const id = orgId(); if (!id || !email.trim() || !inviteRole) return;
    setBusy(true); setError("");
    try {
      const { data, error: e } = await supabase.rpc("create_team_invite_link", { p_organization_id: id, p_email: email.trim(), p_role_key: inviteRole });
      if (e) throw new Error(e.message);
      if (!data?.ok || !data?.token) throw new Error(data?.error || "تعذر إنشاء رابط الدعوة");
      setInviteLink(`${window.location.origin}/invite/${data.token}`); setEmail(""); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر إنشاء رابط الدعوة"); }
    finally { setBusy(false); }
  }

  async function changeRole() {
    if (!editing || !editing.manageable) return;
    const id = orgId(); if (!id) return;
    setSaving(true); setError("");
    const { error: e } = await supabase.rpc("set_team_member_role", { p_organization_id: id, p_user_id: editing.user_id, p_role_key: editing.role_key });
    setSaving(false);
    if (e) { setError(e.message); return; }
    setEditing(null); await load();
  }

  async function togglePermission(permission: string, granted: boolean) {
    if (!editing || !editing.manageable) return;
    const id = orgId(); if (!id) return;
    setSaving(true); setError("");
    const { error: e } = await supabase.rpc("set_team_member_permission_override", { p_organization_id: id, p_user_id: editing.user_id, p_permission_key: permission, p_granted: granted });
    setSaving(false);
    if (e) { setError(e.message); return; }
    setEditing({ ...editing, overrides: { ...editing.overrides, [permission]: granted } }); await load();
  }

  async function openEditor(member: Member) {
    setEditing(member);
    if (!canViewScopes) return;
    const id = orgId(); if (!id) return;
    setScopeLoading(true); setError("");
    const { data, error: e } = await supabase.rpc("get_team_member_data_scopes", { p_organization_id: id, p_user_id: member.user_id });
    setScopeLoading(false);
    if (e) { setError(e.message); setEditingScopes([]); return; }
    setEditingScopes((data ?? []) as ScopeRow[]);
  }

  function actorAllowedScopeIds(scopeType: string) {
    const own = actorScopes.filter((s) => s.scope_type === scopeType).map((s) => s.scope_id);
    return own.length ? new Set(own) : null;
  }

  async function toggleScope(scopeType: string, scopeId: string, granted: boolean) {
    if (!editing || !editing.manageable || !canManageScopes) return;
    const id = orgId(); if (!id) return;
    const ownAllowed = actorAllowedScopeIds(scopeType);
    if (granted && ownAllowed && !ownAllowed.has(scopeId)) {
      setError("لا يمكنك منح عضو نطاقًا أوسع من النطاق المسموح لك به.");
      return;
    }
    setSaving(true); setError("");
    const { error: e } = await supabase.rpc("set_team_member_data_scope", { p_organization_id: id, p_user_id: editing.user_id, p_scope_type: scopeType, p_scope_id: scopeId, p_granted: granted });
    setSaving(false);
    if (e) { setError(e.message); return; }
    setEditingScopes((prev) => granted ? [...prev.filter((x) => !(x.scope_type === scopeType && x.scope_id === scopeId)), { scope_type: scopeType, scope_id: scopeId }] : prev.filter((x) => !(x.scope_type === scopeType && x.scope_id === scopeId)));
    await load();
  }

  async function removeMember(userId: string) {
    const id = orgId(); if (!id || !confirm("هل تريد إزالة هذا العضو من الشركة؟")) return;
    setSaving(true); setError("");
    const { error: e } = await supabase.rpc("remove_team_member", { p_organization_id: id, p_user_id: userId });
    setSaving(false);
    if (e) { setError(e.message); return; }
    setEditing(null); await load();
  }

  const roleName = (key: string) => roles.find((r) => r.role_key === key)?.name ?? key;
  const effectivePermission = (member: Member, permission: string) => member.overrides[permission] === true;
  const effectiveScope = (scopeType: string, scopeId: string) => editingScopes.some((s) => s.scope_type === scopeType && s.scope_id === scopeId);
  const hasAnyScope = (scopeType: string) => editingScopes.some((s) => s.scope_type === scopeType);

  return <main className="min-h-screen bg-[#f7f8fa] text-[#172033]" dir="rtl">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 py-4 sm:px-6 lg:px-8"><Link href="/workspace" className="text-sm font-semibold text-slate-500">العودة لمساحة العمل</Link><div className="text-right"><p className="text-xs font-bold tracking-[.14em] text-slate-400">IDENTITY & ACCESS</p><h1 className="mt-1 font-bold text-slate-950">الفريق والصلاحيات</h1></div></div></header>
    <section className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-5 border-b border-slate-200 pb-7 lg:flex-row lg:items-end lg:justify-between"><div className="max-w-3xl"><p className="text-xs font-bold text-slate-400">RBAC · HIERARCHY · LEAST PRIVILEGE</p><h2 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">إدارة أعضاء الشركة والصلاحيات</h2><p className="mt-3 text-sm leading-7 text-slate-500">كل مستخدم يبدأ بصلاحيات صريحة فقط. يمكنك إدارة من هم تحت مستواك، وتظهر لك فقط الأدوار والصلاحيات التي تملكها أنت.</p></div><button disabled={!canManage} onClick={()=>{setInviteLink("");setShowInvite(true)}} className="w-full rounded-xl bg-slate-950 px-5 py-3.5 text-sm font-bold text-white disabled:opacity-40 sm:w-auto">إنشاء رابط دعوة</button></div>
      {error && <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
      <div className="mt-7 grid gap-4 sm:grid-cols-5"><Stat label="أعضاء الشركة" value={members.length}/><Stat label="الأدوار المتاحة لك" value={manageableRoles.length}/><Stat label="الشاشات التي يمكنك منحها" value={screenPermissions.length}/><Stat label="إجراءات يمكنك منحها" value={actionPermissions.length}/><Stat label="إدارة نطاق البيانات" value={canManageScopes ? 1 : 0}/></div>
      <section className="mt-6 rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 p-5 sm:p-6"><h3 className="font-bold text-slate-950">الهيكل الهرمي للفريق</h3><p className="mt-1 text-sm text-slate-500">لا يمكنك تعديل مستخدم أعلى منك أو خارج شجرتك الإدارية.</p></div><div className="divide-y divide-slate-100">{members.map(m=><div key={m.user_id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold text-slate-900">{m.email || "مستخدم بدون بريد ظاهر"}</p><p className="mt-1 text-xs text-slate-400">{roleName(m.role_key)} · المستوى {m.hierarchy_level}{m.parent_user_id ? " · تابع لمدير" : " · مستوى رئيسي"}</p></div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">{m.manageable ? "ضمن فريقك" : "خارج نطاق إدارتك"}</span><button disabled={!canManage || !m.manageable} onClick={()=>void openEditor(m)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold disabled:opacity-40">إدارة الصلاحيات</button></div></div>)}</div></section>
    </section>
    {showInvite && <Modal title={inviteLink ? "رابط الدعوة جاهز" : "إنشاء رابط دعوة"} onClose={()=>setShowInvite(false)}>{inviteLink ? <><p className="text-sm leading-7 text-slate-600">أرسل الرابط للعضو. الرابط صالح لمدة 7 أيام ويُستخدم مرة واحدة.</p><div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm break-all text-left" dir="ltr">{inviteLink}</div><button onClick={()=>void navigator.clipboard?.writeText(inviteLink)} className="mt-4 w-full rounded-xl bg-slate-950 px-5 py-3.5 text-sm font-bold text-white">نسخ الرابط</button><button onClick={()=>setShowInvite(false)} className="mt-3 w-full rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold">إغلاق</button></> : <><label className="block"><span className="mb-2 block text-sm font-semibold">البريد الإلكتروني</span><input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@company.com"/></label><label className="mt-5 block"><span className="mb-2 block text-sm font-semibold">الدور المتاح تحت مستواك</span><select className="input" value={inviteRole} onChange={e=>setInviteRole(e.target.value)}>{manageableRoles.map(r=><option key={r.role_key} value={r.role_key}>{r.name} — مستوى {r.hierarchy_level}</option>)}</select></label><button disabled={busy||!email.trim()||!inviteRole} onClick={()=>void invite()} className="mt-6 w-full rounded-xl bg-slate-950 px-5 py-3.5 text-sm font-bold text-white disabled:opacity-40">{busy?"جارٍ إنشاء الرابط…":"إنشاء رابط الدعوة"}</button></>}</Modal>}
    {editing && <Modal title="إدارة صلاحيات العضو" onClose={()=>setEditing(null)}><p className="font-bold">{editing.email}</p><label className="mt-5 block"><span className="mb-2 block text-sm font-semibold">الدور الأساسي</span><select className="input" value={editing.role_key} onChange={e=>setEditing({...editing,role_key:e.target.value})}>{manageableRoles.map(r=><option key={r.role_key} value={r.role_key}>{r.name} — مستوى {r.hierarchy_level}</option>)}</select></label><button disabled={saving} onClick={()=>void changeRole()} className="mt-4 w-full rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold">حفظ الدور</button><div className="mt-6 border-t pt-5"><p className="font-bold">صلاحيات الشاشة والإجراءات</p><p className="mt-1 text-xs leading-6 text-slate-500">لا تظهر هنا إلا الصلاحيات التي تملكها أنت. تفعيلها يمنح العضو الصلاحية صراحة.</p><PermissionGroup title="الشاشات" permissions={screenPermissions} member={editing} saving={saving} effective={effectivePermission} onToggle={togglePermission}/><PermissionGroup title="الإجراءات" permissions={actionPermissions} member={editing} saving={saving} effective={effectivePermission} onToggle={togglePermission}/></div>{canViewScopes && <div className="mt-6 border-t pt-5"><p className="font-bold">نطاق البيانات</p><p className="mt-1 text-xs leading-6 text-slate-500">تحديد الكيانات والفروع والإدارات وغيرها التي يستطيع هذا العضو رؤيتها أو العمل عليها. عدم وجود نطاق محدد لنوع معيّن يعني عدم تقييده بهذا النوع.</p>{scopeLoading ? <p className="mt-4 text-sm text-slate-500">جارٍ تحميل نطاق البيانات…</p> : <div className="mt-4 space-y-5">{scopeTypes.map(([type,title])=>{const items=scopeCatalog[type]??[]; const allowed=actorAllowedScopeIds(type); return <div key={type} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><div><h4 className="text-sm font-bold">{title}</h4><p className="mt-1 text-xs text-slate-500">{hasAnyScope(type)?"هذا العضو مقيد بعناصر محددة":"غير مقيد حاليًا بهذا النوع"}</p></div><span className="text-xs font-semibold text-slate-400">{items.length} عنصر</span></div>{items.length===0 ? <p className="mt-3 text-xs text-slate-400">لا توجد عناصر معرفة حاليًا.</p> : <div className="mt-3 grid gap-2 sm:grid-cols-2">{items.map(item=>{const enabled=effectiveScope(type,item.id); const blocked=Boolean(allowed && !allowed.has(item.id)); return <label key={item.id} className={`flex items-center justify-between rounded-xl border p-3 text-sm ${blocked?"bg-slate-50 opacity-60":""}`}><span><span className="font-semibold">{item.name}</span>{item.code&&<span className="mr-2 text-xs text-slate-400">{item.code}</span>}</span><input disabled={saving||!canManageScopes||blocked} type="checkbox" checked={enabled} onChange={e=>void toggleScope(type,item.id,e.target.checked)}/></label>})}</div>}</div>})}</div>}</div>}{!canManageScopes && canViewScopes && <p className="mt-4 text-xs text-amber-700">لديك صلاحية عرض نطاق البيانات، لكن لا تملك صلاحية تعديله.</p>}<button disabled={saving} onClick={()=>void removeMember(editing.user_id)} className="mt-6 w-full rounded-xl border border-red-200 px-5 py-3 text-sm font-bold text-red-700">إزالة العضو من الشركة</button></Modal>}
  </main>;
}

function PermissionGroup({title,permissions,member,saving,effective,onToggle}:{title:string;permissions:Permission[];member:Member;saving:boolean;effective:(m:Member,p:string)=>boolean;onToggle:(p:string,g:boolean)=>void}){return <div className="mt-5"><h4 className="text-sm font-bold text-slate-800">{title}</h4><div className="mt-3 grid gap-2 sm:grid-cols-2">{permissions.map(p=>{const enabled=effective(member,p.permission_key);return <label key={p.permission_key} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-sm"><span>{p.name}</span><input disabled={saving} type="checkbox" checked={enabled} onChange={e=>void onToggle(p.permission_key,e.target.checked)}/></label>})}</div></div>}
function Stat({label,value}:{label:string;value:number}){return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-slate-950">{value}</p></div>}
function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}){return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8"><div className="flex items-center justify-between"><h3 className="text-xl font-bold text-slate-950">{title}</h3><button onClick={onClose} className="rounded-lg px-3 py-2 text-slate-500">إغلاق</button></div><div className="mt-6">{children}</div></div></div>}
