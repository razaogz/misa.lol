import VerifyChallenge from "./verify-challenge";

export const dynamic = "force-dynamic";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ ticket?: string; error?: string }>;
}) {
  const { ticket = "", error = "" } = await searchParams;
  const siteKey = (process.env.MISA_TURNSTILE_SECRET_KEY || process.env.TURNSTILE_SECRET_KEY)
    ? (process.env.MISA_TURNSTILE_SITE_KEY || process.env.TURNSTILE_SITE_KEY || "") : "";
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#09090b] px-4 text-white">
      <meta name="referrer" content="no-referrer" />
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-[#151518] p-8 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-rose-400">misa.lol</p>
        <h1 className="mt-3 text-2xl font-semibold">One last security check</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Your sign-in provider has verified you. Complete the human check to finish signing in.
        </p>
        <VerifyChallenge ticket={ticket} siteKey={siteKey} initialError={error} />
        <a className="mt-7 block text-sm text-zinc-400 underline hover:text-white" href="/login">Back to login</a>
      </section>
    </main>
  );
}
