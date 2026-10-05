export function SessionLoading() {
  return (
    <main className="app-shell" aria-busy="true" aria-live="polite">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="noise" />
      <section className="welcome-card session-loading-card reveal-up">
        <div className="brand-mark">V</div>
        <p className="eyebrow">VIBE</p>
        <h1>Restoring your session</h1>
        <p className="lead">Just a moment while we check if you're signed in.</p>
        <div className="session-spinner" role="status" aria-label="Loading" />
      </section>
    </main>
  );
}
