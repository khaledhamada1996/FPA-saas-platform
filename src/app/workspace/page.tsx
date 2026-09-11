"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Workspace = {
  id: string;
  name: string;
  base_currency: string;
  fiscal_year_start_month: number;
  role: string;
};

export default function WorkspacePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("SAR");
  const [fiscalMonth, setFiscalMonth] = useState("1");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const createdId = searchParams.get("created");
    if (createdId) {
      window.localStorage.setItem("fpa_workspace_id", createdId);
      router.replace("/dashboard");
      return;
    }

    async function loadWorkspaces() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/auth");
        return;
      }

      const { data, error: loadError } = await supabase
        .from("organization_members")
        .select("organization_id, role, organizations(id, name, base_currency, fiscal_year_start_month)")
        .eq("user_id", user.id);

      if (loadError) {
        setError("تعذر تحميل مساحات العمل");
        setLoading(false);
        return;
      }

      const mapped = (data ?? []).flatMap((row) => {
        const organization = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
        if (!organization) return [];
        return [{
          id: organization.id,
          name: organization.name,
          base_currency: organization.base_currency,
          fiscal_year_start_month: organization.fiscal_year_start_month,
          role: row.role,
        }];
      });

      setWorkspaces(mapped);
      setLoading(false);
    }

    void loadWorkspaces();
  }, [router, searchParams]);

  function selectWorkspace(workspace: Workspace) {
    window.localStorage.setItem("fpa_workspace_id", workspace.id);
    window.localStorage.setItem("fpa_workspace", JSON.stringify(workspace));
    router.push("/dashboard");
  }

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError("");

    const form = new FormData();
    form.set("name", name);
    form.set("currency", currency);
    form.set("fiscalMonth", fiscalMonth);

    const response = await fetch("/workspace/create", { method: "POST", body: form, redirect: "manual" });
    const location = response.headers.get("location");
    if (location) {
      router.push(location);
    } else {
      setError("تعذر إنشاء مساحة العمل");
      setCreating(false);
    }
  }

  return (
    <main className="auth-page" dir="rtl">
      <section className="auth-card workspace-card" style={{ maxWidth: 760 }}>
        <div className="auth-mark">ق</div>
        <p className="eyebrow">مساحات العمل</p>
        <h1>اختر مساحة العمل</h1>
        <p>كل مساحة عمل مستقلة ببياناتها المالية وصلاحياتها. لا يتم استخدام مساحة أخرى تلقائيًا.</p>

        {error && <div role="alert" style={{ margin: "16px 0", padding: 12, borderRadius: 10, background: "#fff1f2", color: "#9f1239" }}>{error}</div>}

        {!loading && workspaces.length > 0 && (
          <div style={{ display: "grid", gap: 10, margin: "24px 0" }}>
            {workspaces.map((workspace) => (
              <button
                key={workspace.id}
                type="button"
                onClick={() => selectWorkspace(workspace)}
                style={{ textAlign: "right", padding: 16, border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff", cursor: "pointer" }}
              >
                <strong style={{ display: "block", fontSize: 16 }}>{workspace.name}</strong>
                <span style={{ display: "block", marginTop: 5, color: "#6b7280" }}>{workspace.base_currency} · السنة المالية تبدأ من الشهر {workspace.fiscal_year_start_month} · {workspace.role}</span>
              </button>
            ))}
          </div>
        )}

        <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 24, marginTop: 24 }}>
          <h2 style={{ margin: "0 0 8px" }}>إنشاء مساحة جديدة</h2>
          <p style={{ margin: "0 0 18px", color: "#6b7280" }}>أنشئ شركة أو كيانًا جديدًا ليكون له نموذج مالي مستقل.</p>
          <form className="auth-form" onSubmit={createWorkspace}>
            <label>
              اسم الشركة
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="مثال: شركة النماء التجارية" required minLength={2} maxLength={120} />
            </label>
            <label>
              العملة الأساسية
              <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
                <option value="SAR">ريال سعودي (SAR)</option>
                <option value="AED">درهم إماراتي (AED)</option>
                <option value="KWD">دينار كويتي (KWD)</option>
                <option value="QAR">ريال قطري (QAR)</option>
                <option value="BHD">دينار بحريني (BHD)</option>
                <option value="OMR">ريال عُماني (OMR)</option>
              </select>
            </label>
            <label>
              بداية السنة المالية
              <select value={fiscalMonth} onChange={(event) => setFiscalMonth(event.target.value)}>
                {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
              </select>
            </label>
            <button className="primary-button" type="submit" disabled={creating}>{creating ? "جارٍ إنشاء مساحة العمل..." : "إنشاء مساحة العمل"}</button>
          </form>
        </div>
      </section>
    </main>
  );
}
