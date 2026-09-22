// Root-level usernames are rewritten to /p/:username by Next.js. Client routing
// still sees the visible /:username path, so keep those pages outside auth guards.
const reserved = new Set([
  "about", "account", "admin", "analytics", "api", "auth", "badges",
  "c", "community", "constellations", "css", "customize", "dashboard",
  "discord", "explore", "forgot-password", "google", "help", "host",
  "icons", "images", "index", "js", "leaderboard", "links", "login",
  "logout", "lyrics", "me", "misa", "plus", "premium", "preview",
  "pricing", "privacy", "reset-password", "root", "security", "settings",
  "signup", "static", "status", "support", "telegram", "templates",
  "terms", "www",
]);

export function isPublicProfilePath(pathname: string): boolean {
  const match = /^\/([a-z][a-z0-9_]{2,23})\/?$/i.exec(pathname);
  return Boolean(match && !reserved.has(match[1].toLowerCase()));
}
