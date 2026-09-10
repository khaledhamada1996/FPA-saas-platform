export default function HomePage() {
  return (
    <main style={{ maxWidth: 1120, margin: "0 auto", padding: "64px 24px" }}>
      <section>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: 1, color: "#64748b" }}>
          FINANCIAL PLANNING & ANALYSIS
        </p>
        <h1 style={{ maxWidth: 760, margin: "16px 0", fontSize: "clamp(40px, 6vw, 72px)", lineHeight: 1.05 }}>
          Plan with clarity. Forecast with confidence.
        </h1>
        <p style={{ maxWidth: 680, margin: 0, fontSize: 20, lineHeight: 1.6, color: "#475569" }}>
          A financial planning workspace that connects actual performance, budgets, forecasts, scenarios and cash into one decision-ready model.
        </p>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 56 }}>
        {[
          ["Actuals", "Import, validate and understand financial performance."],
          ["Budget", "Build versioned plans from company and department assumptions."],
          ["Forecast", "Keep the outlook current with rolling forecast versions."],
          ["Scenarios", "Test changes before they become decisions."],
        ].map(([title, description]) => (
          <article key={title} style={{ padding: 24, border: "1px solid #e2e8f0", borderRadius: 16, background: "#fff" }}>
            <h2 style={{ margin: "0 0 10px", fontSize: 20 }}>{title}</h2>
            <p style={{ margin: 0, lineHeight: 1.6, color: "#64748b" }}>{description}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
