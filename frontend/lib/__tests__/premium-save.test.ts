import test from "node:test";
import assert from "node:assert/strict";
import { mergePremiumSettings, PREMIUM_DEFAULTS, sanitizeIntegrationCard, sanitizePremiumSettings, type PremiumSettings } from "../premium.ts";
import { profileFingerprint, resolveSavedDraft } from "../profile-save.ts";
import type { ProfileConfig } from "../types.ts";

const complete: PremiumSettings = {
  version: 1,
  cursorEffect: "Ghost Cursor",
  cursorColor: "#123456",
  clickPreset: "Pixel Click",
  entrySubtitle: "welcome back",
  typewriterTexts: ["first", "second"],
  hero: "Centered",
  borderType: "Shimmer",
  borderOpacity: 47,
  borderEnabled: false,
  lyricsHeight: 735,
  effectColors: { Fireflies: "#abcdef", Snowflakes: "#112233", Snow: "#445566", Sakura: "#ff7788" },
};

function config(premium: PremiumSettings = PREMIUM_DEFAULTS): ProfileConfig {
  return { settings: { premium } } as ProfileConfig;
}

test("all Premium settings survive backend sanitization and reload", () => {
  const saved = sanitizePremiumSettings(complete, PREMIUM_DEFAULTS);
  const reloaded = sanitizePremiumSettings(JSON.parse(JSON.stringify(saved)), PREMIUM_DEFAULTS);
  assert.deepEqual(saved, complete);
  assert.deepEqual(reloaded, complete);
  assert.deepEqual(sanitizePremiumSettings(undefined, saved), complete);
});

test("effect colors persist independently and an explicit reset stays reset", () => {
  const previous = sanitizePremiumSettings(complete, PREMIUM_DEFAULTS);
  const changed = sanitizePremiumSettings({ ...previous, effectColors: { ...previous.effectColors, Snow: "#010203" } }, previous);
  assert.equal(changed.effectColors?.Fireflies, "#abcdef");
  assert.equal(changed.effectColors?.Snow, "#010203");

  const { Sakura: _removed, ...withoutSakura } = changed.effectColors || {};
  const reset = sanitizePremiumSettings({ ...changed, effectColors: withoutSakura }, changed);
  assert.equal(reset.effectColors?.Sakura, undefined);
  assert.equal(reset.effectColors?.Snow, "#010203");
});

test("functional Premium updates do not overwrite another setting with stale state", () => {
  const first = mergePremiumSettings(config(), { cursorColor: "#101010" });
  const second = mergePremiumSettings(first, { effectColors: { Fireflies: "#202020" } });
  const third = mergePremiumSettings(second, { borderOpacity: 31 });
  assert.equal(third.settings.premium?.cursorColor, "#101010");
  assert.equal(third.settings.premium?.effectColors?.Fireflies, "#202020");
  assert.equal(third.settings.premium?.borderOpacity, 31);
});

test("dirty state ignores object key order and stale responses keep newer edits", () => {
  const submitted = config({ ...complete, effectColors: { Fireflies: "#abcdef", Snow: "#445566" } });
  const server = config({ ...complete, effectColors: { Snow: "#445566", Fireflies: "#abcdef" } });
  assert.equal(profileFingerprint(submitted), profileFingerprint(server));
  assert.equal(resolveSavedDraft(submitted, profileFingerprint(submitted), server), server);

  const newer = mergePremiumSettings(submitted, { cursorColor: "#999999" });
  assert.equal(resolveSavedDraft(newer, profileFingerprint(submitted), server), newer);
});
test("Premium integration cards survive sanitization with bounded public values", () => {
  assert.deepEqual(sanitizeIntegrationCard({ enabled: true, type: "github", value: "razaog" }), { enabled: true, type: "github", value: "razaog" });
  assert.deepEqual(sanitizeIntegrationCard({ enabled: true, type: "presence", value: "ignored" }), { enabled: true, type: "presence", value: "" });
  assert.equal(sanitizeIntegrationCard({ enabled: true, type: "private-provider", value: "secret" }), undefined);
});
