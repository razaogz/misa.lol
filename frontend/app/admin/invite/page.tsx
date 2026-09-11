"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui";

export default function AdminInvitePage() {
  const [token, setToken] = useState(""); const [state, setState] = useState<"loading" | "ready" | "done" | "error">("loading"); const [message, setMessage] = useState("");
  useEffect(() => { const value = new URLSearchParams(window.location.search).get("token") || ""; setToken(value); setState(value ? "ready" : "error"); if (!value) setMessage("This invitation link is missing its token."); }, []);
  const accept = async () => { setState("loading"); try { const response = await fetch("/api/v1/admin-auth/invites/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) }); const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.detail || "This invitation is invalid or expired."); setMessage(`Invitation accepted for ${result.email}. You can now sign in with an emailed OTP.`); setState("done"); } catch (e) { setMessage(e instanceof Error ? e.message : "Could not accept invitation."); setState("error"); } };
  return <main className="grid min-h-[100svh] place-items-center bg-[#07070a] px-5 text-white"><section className="surface w-full max-w-[430px] rounded-2xl p-8 text-center"><ShieldCheck className="mx-auto mb-5 text-[#b8acff]" size={28} /><h1 className="text-2xl font-semibold">Admin invitation</h1><p className="mt-3 text-sm leading-6 text-zinc-500">{message || "Accept this secure invitation to join the misa.lol administration team."}</p>{state === "ready" && <Button variant="accent" className="mt-7" onClick={() => void accept()}>Accept invitation</Button>}{state === "done" && <Link href="/admin/login" className="mt-7 inline-flex rounded-xl bg-[#9b87f5] px-4 py-2.5 text-sm">Go to admin login</Link>}{state === "error" && <Link href="/admin/login" className="mt-7 inline-flex rounded-xl bg-white/[.06] px-4 py-2.5 text-sm">Admin login</Link>}</section></main>;
}
