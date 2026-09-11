"use client";

import dynamic from "next/dynamic";

const WorkspaceClient = dynamic(() => import("./WorkspaceClient"), {
  ssr: false,
  loading: () => (
    <main className="auth-page" dir="rtl">
      <section className="auth-card workspace-card" style={{ maxWidth: 760 }}>
        <p>جاري تحميل مساحة العمل...</p>
      </section>
    </main>
  ),
});

export default function WorkspaceLoader() {
  return <WorkspaceClient />;
}
