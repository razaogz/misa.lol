"use client";

import { useEffect, useRef, useState } from "react";

type Props = { ticket: string; siteKey: string; initialError: string };

export default function VerifyChallenge({ ticket, siteKey, initialError }: Props) {
  const form = useRef<HTMLFormElement>(null);
  const mount = useRef<HTMLDivElement>(null);
  const token = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState(
    initialError === "turnstile" ? "Verification failed. Please try again."
      : initialError === "rate_limited" ? "Too many attempts. Please wait a minute and retry."
      : initialError ? "Sign-in could not be completed. Please try again." : ""
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!ticket || !siteKey || !mount.current) return;
    let disposed = false;
    let widgetId: string | null = null;
    const render = () => {
      if (disposed || !window.turnstile || !mount.current || widgetId !== null) return;
      widgetId = window.turnstile.render(mount.current, {
        sitekey: siteKey,
        callback: (value) => {
          if (!token.current || !form.current || disposed) return;
          token.current.value = value;
          setSubmitting(true);
          form.current.requestSubmit();
        },
        "expired-callback": () => setMessage("Verification expired. Please complete it again."),
        "error-callback": () => setMessage("Verification could not load. Please refresh and retry."),
      });
    };
    if (window.turnstile) render();
    else {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = render;
      script.onerror = () => setMessage("Verification could not load. Please check your connection.");
      document.head.appendChild(script);
    }
    return () => {
      disposed = true;
      if (widgetId && window.turnstile?.remove) window.turnstile.remove(widgetId);
    };
  }, [ticket, siteKey]);

  if (!/^[A-Za-z0-9_-]{43}$/.test(ticket)) return <p className="mt-6 text-sm text-red-300">This sign-in link is invalid or expired.</p>;
  if (!siteKey) return <p className="mt-6 text-sm text-red-300">Human verification is not configured. Please contact support.</p>;
  return (
    <form ref={form} action="/api/v1/auth/verify" method="post" className="mt-6">
      <input type="hidden" name="ticket" value={ticket} />
      <input ref={token} type="hidden" name="turnstile_token" />
      <div ref={mount} className="flex min-h-16 justify-center" />
      {message && <p role="alert" className="mt-4 text-sm text-red-300">{message}</p>}
      {submitting && <p role="status" className="mt-4 text-center text-sm text-zinc-400">Finishing sign-in…</p>}
    </form>
  );
}
