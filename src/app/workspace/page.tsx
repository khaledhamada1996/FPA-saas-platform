import { Suspense } from "react";
import WorkspaceClient from "./WorkspaceClient";

export const dynamic = "force-dynamic";

export default function WorkspacePage() {
  return (
    <Suspense fallback={<main className="auth-page" dir="rtl"><section className="auth-card workspace-card" style={{ maxWidth: 760 }}><p>جاري تحميل مساحة العمل...</p></section></main>}>
      <WorkspaceClient />
    </Suspense>
  );
}
