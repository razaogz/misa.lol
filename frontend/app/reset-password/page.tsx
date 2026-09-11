import Link from "next/link";

export default function ResetPasswordPage() {
  return <main className="grid min-h-[100svh] place-items-center bg-[#07070a] px-5 text-center text-white"><div className="max-w-md"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#a899ff]">Password recovery</p><h1 className="mt-4 text-3xl font-semibold tracking-[-.04em]">Recovery is not enabled yet</h1><p className="mt-4 text-sm leading-6 text-zinc-500">The connected FastAPI service does not currently expose a password-reset endpoint. Configure that provider endpoint before enabling recovery emails.</p><Link href="/login" className="mt-7 inline-flex rounded-xl bg-[#9b87f5] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#aa99ff]">Back to sign in</Link></div></main>;
}
