export default function WorkspaceLoading() {
  return (
    <main className="auth-page" dir="rtl" aria-busy="true">
      <section className="auth-card workspace-card" style={{ maxWidth: 760 }}>
        <div className="auth-mark">ق</div>
        <p className="eyebrow">مساحات العمل</p>
        <h1>جاري التحميل</h1>
        <p>جاري تجهيز مساحة العمل...</p>
      </section>
    </main>
  );
}
