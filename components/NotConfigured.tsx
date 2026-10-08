import Link from 'next/link';

export default function NotConfigured() {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">Margin</div>
        <h1>Sign-in isn’t set up yet</h1>
        <p className="auth-note">
          Add <code>NEXT_PUBLIC_CONVEX_URL</code> from a Convex deployment and redeploy. Until then Margin
          runs without accounts, with boards stored in this browser.
        </p>
        <p className="auth-switch">
          <Link href="/">Back to the canvas</Link>
        </p>
      </div>
    </main>
  );
}
