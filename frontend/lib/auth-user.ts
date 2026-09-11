import type { AuthUser } from "./types";

export function mapBackendUser(value: Record<string, unknown>): AuthUser {
  return {
    id: String(value.id || ""),
    username: typeof value.username === "string" ? value.username : null,
    displayName: String(value.display_name || value.displayName || ""),
    email: String(value.email || ""),
    emailVerified: Boolean(value.email_verified ?? value.emailVerified),
    avatarUrl: typeof value.avatar_url === "string" ? value.avatar_url : null,
    isAdmin: Boolean(value.is_admin ?? value.isAdmin),
    providers: value.providers as AuthUser["providers"],
  };
}
