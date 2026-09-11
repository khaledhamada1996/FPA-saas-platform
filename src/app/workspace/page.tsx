import { Suspense } from "react";
import WorkspaceClient from "./WorkspaceClient";

export default function WorkspacePage() {
  return (
    <Suspense fallback={<main className="auth-page" dir="rtl"><section className="auth-card workspace-card" style={{ maxWidth: 760 }}><p>جاري تحميل مساحة العمل...</p></section></main>}>
      <WorkspaceClient />
    </Suspense>
  );
}
