import Link from 'next/link';

export default function NotConfigured() {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">Margin</div>
        <h1>Sign-in isn&rsquo;t set up yet</h1>
        <p className="auth-note">
          Add <code>NEON_AUTH_BASE_URL</code> and <code>NEON_AUTH_COOKIE_SECRET</code> to the environment and redeploy.
          Until then Margin runs without accounts.
        </p>
        <p className="auth-switch">
          <Link href="/">Back to the canvas</Link>
        </p>
      </div>
    </main>
  );
}
