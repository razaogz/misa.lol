import type { ProfileConfig } from "./types";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(item => item === undefined ? null : canonical(item));
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(source).filter(key => source[key] !== undefined).sort().map(key => [key, canonical(source[key])]));
  }
  return typeof value === "number" && !Number.isFinite(value) ? null : value;
}

export function profileFingerprint(value: unknown) {
  return JSON.stringify(canonical(value));
}

export function resolveSavedDraft(current: ProfileConfig, submittedFingerprint: string, saved: ProfileConfig) {
  return profileFingerprint(current) === submittedFingerprint ? saved : current;
}