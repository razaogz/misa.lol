import "server-only";

// Native routes are the default. An explicit false is an emergency kill switch.
export function nativeCoreEnabled() {
  return process.env.MISA_NEXT_CORE_ROLLOUT !== "false";
}