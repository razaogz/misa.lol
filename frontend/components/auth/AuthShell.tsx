"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail, Sparkles, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-store";
import { Button, TextInput } from "@/components/ui";

declare global {
  interface Window {
    turnstile?: { render: (element: HTMLElement, options: { sitekey: string; callback: (token: string) => void; "expired-callback"?: () => void; "error-callback"?: () => void }) => string; remove?: (widgetId: string) => void };
  }
}

export function AuthShell({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const { login, signUp, finalizeCaptcha, verifyMfa } = useAuth();
  const signup = mode === "signup";
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [captchaChallenge, setCaptchaChallenge] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!signup) return;
    void fetch("/api/auth/providers", { cache: "no-store" }).then((response) => response.json()).then((value: { turnstile_site_key?: string }) => setTurnstileSiteKey(value.turnstile_site_key || "")).catch(() => undefined);
  }, [signup]);

  useEffect(() => {
    if (signup || !captchaChallenge || turnstileSiteKey) return;
    void fetch("/api/auth/providers", { cache: "no-store" }).then((response) => response.json()).then((value: { turnstile_site_key?: string }) => setTurnstileSiteKey(value.turnstile_site_key || "")).catch(() => undefined);
  }, [captchaChallenge, signup, turnstileSiteKey]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (signup) {
      if (!turnstileToken) { setError("Complete the human verification before continuing."); return; }
      if (password !== confirmPassword) { setError("Passwords do not match."); return; }
      const result = await signUp({ username: username.trim().toLowerCase(), displayName, email, password, confirmPassword, turnstileToken });
      if (!result.ok) { if ("mfaRequired" in result) { const code = window.prompt("Enter the six-digit code from your authenticator app.") || ""; const verified = await verifyMfa(result.challenge, code); if (!verified.ok) { setError("error" in verified ? verified.error : "MFA verification failed."); return; } } else { setError("error" in result ? result.error : "Something went wrong. Please try again."); return; } }
    } else {
      const result = captchaChallenge ? await finalizeCaptcha(captchaChallenge, turnstileToken) : await login(identifier, password, remember);
      if (!result.ok) {
        if ("captchaRequired" in result) { setCaptchaChallenge(result.challenge); setTurnstileToken(""); return; }
        if ("mfaRequired" in result) { const code = window.prompt("Enter the six-digit code from your authenticator app.") || ""; const verified = await verifyMfa(result.challenge, code); if (!verified.ok) { setError("error" in verified ? verified.error : "MFA verification failed."); return; } }
        else { setError("error" in result ? result.error : "Something went wrong. Please try again."); return; }
      }
    }
    router.push("/dashboard");
  };

  return <main className="flex min-h-[100svh] bg-[#07070a] text-white">
    <div className="relative hidden w-[45%] overflow-hidden border-r border-white/[.07] lg:block"><div className="absolute inset-0 bg-[radial-gradient(circle_at_32%_25%,rgba(155,135,245,.22),transparent_30%),radial-gradient(circle_at_75%_75%,rgba(112,67,170,.18),transparent_31%),linear-gradient(145deg,#0d0d14,#08080b)]" /><div className="relative flex h-full flex-col justify-between p-10 xl:p-16"><Link href="/" className="flex items-center gap-3 text-[15px] font-semibold"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#c5b8ff] via-[#8c75eb] to-[#5946b8]">M</span>Misa<span className="text-[#a899ff]">.lol</span></Link><div className="max-w-md"><motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}><span className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#b0a1ff]/20 bg-[#9b87f5]/10 text-[#b9aeff]"><Sparkles size={21} /></span><h1 className="text-4xl font-semibold leading-[1.05] tracking-[-.055em] xl:text-5xl">Your corner of the internet,<br /><span className="text-[#aa9dff]">made yours.</span></h1><p className="mt-6 max-w-sm text-sm leading-6 text-zinc-400">A beautiful profile, one link, and a little more personality. Welcome to Misa.lol.</p><div className="mt-8 space-y-3 text-sm text-zinc-300">{["Share your whole world in one place", "Make every visit feel personal", "Keep your identity in your hands"].map((item) => <div key={item} className="flex items-center gap-3"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-400"><Check size={12} /></span>{item}</div>)}</div></motion.div></div><p className="text-xs text-zinc-600">© 2026 Misa.lol</p></div></div>
    <div className="flex flex-1 items-center justify-center p-5 sm:p-8"><div className="w-full max-w-[420px]"><div className="mb-10 flex items-center gap-3 lg:hidden"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#c5b8ff] via-[#8c75eb] to-[#5946b8] text-sm font-bold">M</span><span className="text-[15px] font-semibold">Misa<span className="text-[#a899ff]">.lol</span></span></div><div className="mb-8"><p className="mb-3 text-xs font-semibold uppercase tracking-[.18em] text-[#a899ff]">{signup ? "Create your space" : "Welcome back"}</p><h2 className="text-3xl font-semibold tracking-[-.045em]">{signup ? "Create your account" : "Sign in to Misa.lol"}</h2><p className="mt-2 text-sm text-zinc-500">{signup ? "Start building a profile that feels like you." : "Pick up where you left off."}</p></div><form onSubmit={submit} className="space-y-4">{signup && <><div><label htmlFor="username" className="mb-2 block text-xs font-medium text-zinc-400">Username <span className="text-zinc-600">(permanent)</span></label><div className="relative"><UserRound size={15} className="absolute left-3 top-3.5 text-zinc-600" /><TextInput id="username" name="username" autoComplete="username" value={username} onChange={setUsername} placeholder="yourname" className="pl-9" /></div></div><div><label htmlFor="display-name" className="mb-2 block text-xs font-medium text-zinc-400">Display name</label><TextInput id="display-name" name="display-name" autoComplete="name" value={displayName} onChange={setDisplayName} placeholder="Your name" /></div></>}<div><label htmlFor="email" className="mb-2 block text-xs font-medium text-zinc-400">Email address</label><div className="relative"><Mail size={15} className="absolute left-3 top-3.5 text-zinc-600" /><TextInput id="email" name="email" autoComplete="email" value={signup ? email : identifier} onChange={signup ? setEmail : setIdentifier} placeholder="you@example.com" type="email" className="pl-9" /></div></div><div><label htmlFor="password" className="mb-2 block text-xs font-medium text-zinc-400">Password</label><div className="relative"><LockKeyhole size={15} className="absolute left-3 top-3.5 text-zinc-600" /><TextInput id="password" name="password" autoComplete={signup ? "new-password" : "current-password"} value={password} onChange={setPassword} placeholder="••••••••" type={showPassword ? "text" : "password"} className="pl-9 pr-10" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg text-zinc-600 hover:text-white" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={15} /> : <Eye size={15} />}</button></div></div>{signup && <div><label htmlFor="confirm-password" className="mb-2 block text-xs font-medium text-zinc-400">Confirm password</label><TextInput id="confirm-password" name="confirm-password" autoComplete="new-password" value={confirmPassword} onChange={setConfirmPassword} placeholder="••••••••" type="password" /></div>}{!signup && <div className="flex items-center justify-between py-1"><label className="flex items-center gap-2 text-xs text-zinc-500"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 rounded border-white/10 bg-white/[.05] accent-[#9b87f5]" />Remember me</label><Link href="/reset-password" className="text-xs text-[#b1a5ff] hover:text-white">Forgot password?</Link></div>}{turnstileSiteKey && <Turnstile siteKey={turnstileSiteKey} onToken={setTurnstileToken} />}{error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/[.06] px-3 py-2.5 text-xs leading-5 text-red-200">{error}</p>}<Button type="submit" variant="accent" className="mt-2 h-12 w-full">{signup ? "Create account" : "Sign in"}<ArrowRight size={16} /></Button></form><p className="mt-8 text-center text-sm text-zinc-500">{signup ? "Already have an account?" : "New to Misa.lol?"}{" "}<Link href={signup ? "/login" : "/signup"} className="font-medium text-[#b1a5ff] hover:text-white">{signup ? "Sign in" : "Create an account"}</Link></p></div></div>
  </main>;
}

function Turnstile({ siteKey, onToken }: { siteKey: string; onToken: (token: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const render = () => { if (ref.current && window.turnstile) window.turnstile.render(ref.current, { sitekey: siteKey, callback: onToken, "expired-callback": () => onToken(""), "error-callback": () => onToken("") }); };
    if (window.turnstile) render();
    else { const script = document.createElement("script"); script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js"; script.async = true; script.defer = true; script.addEventListener("load", render); document.head.appendChild(script); return () => script.removeEventListener("load", render); }
  }, [onToken, siteKey]);
  return <div ref={ref} className="min-h-[65px]" aria-label="Human verification" />;
}
