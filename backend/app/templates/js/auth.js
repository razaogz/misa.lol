/* ============================================
   MISA.LOL — Auth
   Login, signup, session, legacy-page compatibility
   ============================================ */

const AUTH_ERRORS = {
  oauth_denied: "That sign-in was cancelled.",
  oauth_failed: "Sign-in failed. Try again.",
  already_linked: "That account is already linked to a different user.",
  email_taken: "That email is already used by another account.",
  account_exists: "An account with that email already exists. Log in, then connect this provider from the dashboard.",
  google_not_configured: "Google login is not configured yet.",
  discord_not_configured: "Discord login is not configured yet.",
  telegram_not_configured: "Telegram login is not configured yet.",
  turnstile: "Complete the human verification first.",
  invalid: "Invalid email or password.",
};

function setTurnstileToken(token) {
  window.__misaTurnstileToken = token || "";
}

function authLocks() {
  return document.querySelectorAll(".auth-lock");
}

function isFormControl(el) {
  return (
    el instanceof HTMLButtonElement ||
    el instanceof HTMLInputElement ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLTextAreaElement
  );
}

function setAuthLockState(el, locked) {
  el.classList.toggle("is-locked", locked);
  try {
    el.inert = locked;
  } catch {
    /* older browsers ignore the inert property */
  }
  if (locked) el.setAttribute("inert", "");
  else el.removeAttribute("inert");
  if (isFormControl(el)) el.disabled = locked;
  el.querySelectorAll("input, button, textarea, select").forEach((node) => {
    node.disabled = locked;
  });
  el.querySelectorAll("a").forEach((node) => {
    if (locked) node.setAttribute("tabindex", "-1");
    else node.removeAttribute("tabindex");
  });
}

function lockAuthActions() {
  setTurnstileToken("");
  authLocks().forEach((el) => setAuthLockState(el, true));
}

function unlockAuthActions(token) {
  if (!token) return;
  setTurnstileToken(token);
  authLocks().forEach((el) => setAuthLockState(el, false));
}

function currentTurnstileToken() {
  if (window.__misaTurnstileToken) return window.__misaTurnstileToken;
  const inputs = document.querySelectorAll('input[name="cf-turnstile-response"]');
  for (const input of inputs) {
    if (input.value) return input.value;
  }
  return "";
}

function syncTurnstileGate() {
  const token = currentTurnstileToken();
  if (token) unlockAuthActions(token);
}

window.misaTurnstileSuccess = function (token) {
  unlockAuthActions(token);
  syncTurnstileGate();
};

window.misaTurnstileExpire = function () {
  lockAuthActions();
};

window.misaTurnstileError = function () {
  if (currentTurnstileToken()) {
    syncTurnstileGate();
    return;
  }
  showAuthMessage("Human verification failed to load. Refresh and try again.", "error");
};

function watchTurnstileGate() {
  if (!document.querySelector(".auth-lock")) return;
  syncTurnstileGate();
  const root = document.querySelector(".turnstile-box") || document.body;
  const observer = new MutationObserver(syncTurnstileGate);
  observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["value"] });
  const started = Date.now();
  const timer = setInterval(() => {
    syncTurnstileGate();
    if (currentTurnstileToken() || Date.now() - started > 120000) clearInterval(timer);
  }, 200);
}

function consumeTurnstileToken() {
  const token = currentTurnstileToken();
  lockAuthActions();
  if (window.turnstile?.reset) {
    try {
      window.turnstile.reset();
    } catch {
      /* widget may already be gone */
    }
  }
  return token;
}

function authMessageBox() {
  return document.getElementById("auth-message");
}

function showAuthMessage(text, kind) {
  const box = authMessageBox();
  if (!box || !text) return;
  box.hidden = false;
  box.textContent = text;
  box.classList.add("is-visible");
  box.classList.toggle("auth-message--error", kind === "error");
  box.classList.toggle("auth-message--ok", kind !== "error");
}

function errorFromApi(data) {
  if (!data) return "Something went wrong.";
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data.detail) && data.detail[0]?.msg) return data.detail[0].msg;
  return "Something went wrong.";
}

async function sendJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

function bindLoginForm() {
  const form = document.getElementById("login-form");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    const original = submit ? submit.textContent : "";
    if (submit) submit.textContent = "Signing in…";
    try {
      const token = currentTurnstileToken();
      if (!token) {
        showAuthMessage("Complete the human verification first.", "error");
        return;
      }
      const { response, data } = await sendJson("/api/v1/auth/login", {
        email: form.email.value,
        password: form.password.value,
        remember: Boolean(form.remember?.checked),
        turnstile_token: token,
      });
      if (!response.ok) {
        consumeTurnstileToken();
        showAuthMessage(errorFromApi(data), "error");
        return;
      }
      window.location.href = data.redirect || "/dashboard";
    } catch {
      showAuthMessage("Could not reach the server.", "error");
    } finally {
      if (submit) submit.textContent = original;
    }
  });
}

function bindSignupForm() {
  const form = document.getElementById("signup-form");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    const original = submit ? submit.textContent : "";
    if (submit) submit.textContent = "Creating account…";
    try {
      const token = currentTurnstileToken();
      if (!token) {
        showAuthMessage("Complete the human verification first.", "error");
        return;
      }
      const { response, data } = await sendJson("/api/v1/auth/signup", {
        email: form.email.value,
        password: form.password.value,
        confirm_password: form["confirm-password"].value,
        tos: Boolean(form.tos?.checked),
        turnstile_token: token,
      });
      if (!response.ok) {
        consumeTurnstileToken();
        showAuthMessage(errorFromApi(data), "error");
        return;
      }
      window.location.href = data.redirect || "/dashboard";
    } catch {
      showAuthMessage("Could not reach the server.", "error");
    } finally {
      if (submit) submit.textContent = original;
    }
  });
}

function bindSocialAuth() {
  document.querySelectorAll(".social-auth__button").forEach((link) => {
    link.addEventListener("click", (event) => {
      if (!document.querySelector(".auth-page")) return;
      if (currentTurnstileToken()) return;
      event.preventDefault();
      showAuthMessage("Complete the human verification first.", "error");
    });
  });
}

function bindForgotPassword() {
  document.querySelectorAll(".forgot-link").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      showAuthMessage("Password reset is not enabled yet. Use Google, Discord, or Telegram, or sign in with your password.", "error");
    });
  });
}

function bindLogout() {
  const button = document.getElementById("logout-btn");
  if (!button) return;
  button.addEventListener("click", async () => {
    await sendJson("/api/v1/auth/logout", {});
    window.location.href = "/";
  });
}

function providerRow(name) {
  return document.querySelector(`.connection-row[data-provider="${name}"]`);
}

function setProviderState(name, connected, extra) {
  const row = providerRow(name);
  if (!row) return;
  const status = row.querySelector("[data-status]");
  const toggle = row.querySelector(".connection-row__toggle");
  if (status) status.textContent = connected ? extra || "Connected" : "Not connected";
  if (!toggle) return;
  toggle.classList.toggle("connection-row__toggle--connected", connected);
  toggle.classList.toggle("connection-row__toggle--connect", !connected);
  if (toggle.tagName === "A") {
    toggle.textContent = connected ? "Connected" : "Connect";
  } else {
    toggle.textContent = connected ? "Connected" : "Password";
  }
}

function renderDashboard(user) {
  const name = user.display_name || user.username || user.email || "misa user";
  const handle = user.username ? `misa.lol/${user.username}` : "username not set";
  const navName = document.getElementById("nav-name");
  const navHandle = document.getElementById("nav-handle");
  const navAvatar = document.getElementById("nav-avatar");
  if (navName) navName.textContent = name;
  if (navHandle) navHandle.textContent = handle;
  if (navAvatar && user.avatar_url) navAvatar.src = user.avatar_url;
  const email = document.getElementById("account-email");
  const accountName = document.getElementById("account-name");
  const accountId = document.getElementById("account-id");
  if (email) email.textContent = user.email || "No email on this account";
  if (accountName) accountName.textContent = name;
  if (accountId) accountId.textContent = user.id;
  const usernameInput = document.getElementById("username");
  if (usernameInput && user.username) usernameInput.value = user.username;
  setProviderState("email", Boolean(user.providers?.email), user.email || "Password login enabled");
  setProviderState("google", Boolean(user.providers?.google));
  setProviderState("discord", Boolean(user.providers?.discord));
  setProviderState("telegram", Boolean(user.providers?.telegram), user.telegram_username ? `@${user.telegram_username}` : "Connected");
}

async function loadDashboard() {
  if (!document.querySelector(".dashboard")) return;
  const response = await fetch("/api/v1/me", { credentials: "include", headers: { Accept: "application/json" } });
  if (response.status === 401) {
    window.location.href = "/login";
    return;
  }
  if (!response.ok) {
    showAuthMessage("Could not load your account.", "error");
    return;
  }
  renderDashboard(await response.json());
}

function bindUsernameForm() {
  const form = document.getElementById("username-form");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    const original = submit ? submit.textContent : "";
    if (submit) submit.textContent = "Saving…";
    try {
      const response = await fetch("/api/v1/me/username", {
        method: "PATCH",
        credentials: "include",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.username.value }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        showAuthMessage(errorFromApi(data), "error");
        return;
      }
      showAuthMessage("Username saved.", "ok");
      renderDashboard(data);
    } catch {
      showAuthMessage("Could not save username.", "error");
    } finally {
      if (submit) submit.textContent = original;
    }
  });
}

async function markLoggedInNav() {
  if (document.querySelector(".auth-page") || document.querySelector(".dashboard")) return;
  try {
    const response = await fetch("/api/v1/me", { credentials: "include", headers: { Accept: "application/json" } });
    if (!response.ok) return;
    document.querySelectorAll('a[href="/login"]').forEach((link) => {
      link.href = "/dashboard";
      if (link.textContent.trim().toLowerCase() === "login") link.textContent = "Dashboard";
    });
  } catch {
    /* public pages still work offline from the API */
  }
}

function completeTelegramAuthFromHash() {
  const prefix = "#tgAuthResult=";
  if (!location.hash.startsWith(prefix)) return false;
  let data;
  try {
    const raw = location.hash.slice(prefix.length);
    const padded = raw + "=".repeat((4 - (raw.length % 4)) % 4);
    data = JSON.parse(atob(padded));
  } catch {
    return false;
  }
  const params = new URLSearchParams();
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  });
  if (!params.get("id") || !params.get("hash")) return false;
  window.location.replace("/api/v1/auth/telegram/callback?" + params.toString());
  return true;
}

document.addEventListener("DOMContentLoaded", () => {
  if (completeTelegramAuthFromHash()) return;
  const params = new URLSearchParams(window.location.search);
  const error = params.get("error");
  if (error) showAuthMessage(AUTH_ERRORS[error] || "Sign-in failed. Try again.", "error");

  watchTurnstileGate();

  bindLoginForm();
  bindSignupForm();
  bindSocialAuth();
  bindForgotPassword();
  bindLogout();
  bindUsernameForm();
  loadDashboard();
  markLoggedInNav();
});
