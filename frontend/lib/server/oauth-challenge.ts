import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { decryptDiscordSecret, encryptDiscordSecret } from "./discord-secrets";
import { redis } from "./redis";
import type { ProviderIdentity } from "./oauth-users";

export type PendingOAuth = {
  identity: ProviderIdentity;
  tokens: Record<string, unknown>;
  next: string;
  link: boolean;
  currentUserId: string | null;
};

function key(ticket: string) {
  return "oauth_challenge:" + createHash("sha256").update(ticket).digest("hex");
}

async function client() {
  const value = redis();
  if (value.status === "wait") await value.connect();
  return value;
}

export async function savePendingOAuth(pending: PendingOAuth) {
  const ticket = randomBytes(32).toString("base64url");
  await (await client()).set(key(ticket), encryptDiscordSecret(JSON.stringify(pending)), "EX", 300);
  return ticket;
}

export async function popPendingOAuth(ticket: string): Promise<PendingOAuth | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(ticket)) return null;
  const encrypted = await (await client()).getdel(key(ticket));
  const plaintext = encrypted && decryptDiscordSecret(encrypted);
  if (!plaintext) return null;
  try {
    const value = JSON.parse(plaintext) as PendingOAuth;
    return value && value.identity && typeof value.identity.providerId === "string"
      && typeof value.next === "string" && typeof value.link === "boolean"
      && (value.currentUserId === null || typeof value.currentUserId === "string")
      ? value : null;
  } catch {
    return null;
  }
}
