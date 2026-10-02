"use client";
export default function AdminErrorBoundary({ retry }: { retry: () => void }) {
  return (
    <main className="admin-content">
      <section className="admin-panel">
        <h1>Let’s reconnect your workspace</h1>
        <p className="admin-muted">
          The screen could not load. If an action was already submitted, refresh
          its status before trying again.
        </p>
        <button className="admin-button primary" onClick={retry}>
          Try again
        </button>
        <a className="admin-button" href="/admin/login">
          Sign in again
        </a>
      </section>
    </main>
  );
}
