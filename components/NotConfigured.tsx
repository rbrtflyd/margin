import Link from 'next/link';

export default function NotConfigured() {
  return (
    <main className="fixed inset-0 grid place-items-center overflow-auto bg-stone-100 bg-[radial-gradient(circle,#d6d3d1_1px,transparent_1.2px)] bg-size-[24px_24px] px-4 py-6">
      <div className="grid w-full max-w-[360px] gap-3.5 rounded-xl border border-stone-300 bg-white px-[22px] pt-[22px] pb-[18px] shadow-xl">
        <div className="flex items-center gap-2.5 text-[15px] font-bold">
          <span className="h-[18px] w-[5px] border-x-[1.5px] border-sky-700" aria-hidden />
          Margin
        </div>
        <h1 className="m-0 font-serif text-[26px] leading-tight font-normal italic">Sign-in isn&rsquo;t set up yet</h1>
        <p className="m-0 text-[13px] text-zinc-500">
          Add <code className="font-mono text-xs">NEON_AUTH_BASE_URL</code> and{' '}
          <code className="font-mono text-xs">NEON_AUTH_COOKIE_SECRET</code> to the environment and redeploy. Until then
          Margin runs without accounts.
        </p>
        <p className="m-0 text-[13px] text-zinc-500">
          <Link href="/" className="text-sky-800">
            Back to the canvas
          </Link>
        </p>
      </div>
    </main>
  );
}
