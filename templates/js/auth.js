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
  apple_not_configured: "Apple login is not configured yet.",
  turnstile: "Complete the human verification first.",
  invalid: "Invalid email or password.",
};

let activeChallenge = null;
let activeWidget = null;
let activeForm = null;

async function turnstileSiteKey() {
  if (window.MISA_TURNSTILE_SITE_KEY) return window.MISA_TURNSTILE_SITE_KEY;
  try {
    const response = await fetch("/api/v1/auth/providers", { credentials: "include", cache: "no-store" });
    if (response.ok) {
      const config = await response.json();
      window.MISA_TURNSTILE_SITE_KEY = config.turnstile_site_key || "";
    }
  } catch {}
  return window.MISA_TURNSTILE_SITE_KEY || "";
}

async function waitForTurnstile() {
  for (let i = 0; i < 100; i++) {
    if (window.turnstile && typeof window.turnstile.render === "function") return window.turnstile;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Human verification could not load. Check your connection and try again.");
}

function clearChallenge(form) {
  activeChallenge = null;
  if (activeWidget !== null && window.turnstile && window.turnstile.remove) {
    try { window.turnstile.remove(activeWidget); } catch {}
  }
  activeWidget = null;
  activeForm = null;
  const box = form.querySelector(".turnstile-box");
  if (box) {
    box.hidden = true;
    const mount = box.querySelector(".cf-turnstile");
    if (mount) mount.replaceChildren();
  }
  const note = form.querySelector("[data-lock-note]");
  if (note) note.hidden = true;
}

async function showChallenge(form, onVerified) {
  const key = await turnstileSiteKey();
  if (!key) {
    showAuthMessage("Human verification is unavailable. Please try again shortly.", "error");
    return;
  }
  const box = form.querySelector(".turnstile-box");
  const mount = box && box.querySelector(".cf-turnstile");
  if (!box || !mount) return;
  if (activeForm && activeForm !== form) clearChallenge(activeForm);
  box.hidden = false;
  const note = form.querySelector("[data-lock-note]");
  if (note) note.hidden = false;
  try {
    const turnstile = await waitForTurnstile();
    activeChallenge = onVerified;
    activeForm = form;
    if (activeWidget !== null) turnstile.reset(activeWidget);
    else activeWidget = turnstile.render(mount, {
      sitekey: key,
      theme: "dark",
      size: "flexible",
      callback: window.misaTurnstileSuccess,
      "expired-callback": window.misaTurnstileExpire,
      "timeout-callback": window.misaTurnstileExpire,
      "error-callback": window.misaTurnstileError,
    });
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (error) {
    showAuthMessage(error.message || "Human verification could not load.", "error");
  }
}

window.misaTurnstileSuccess = function (token) {
  if (!token || !activeChallenge) return;
  const complete = activeChallenge;
  activeChallenge = null;
  void complete(token);
};

window.misaTurnstileExpire = function () {
  showAuthMessage("Human verification expired. Please complete it again.", "error");
};

window.misaTurnstileError = function () {
  showAuthMessage("Human verification failed to load. Please retry or refresh.", "error");
};

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

function clearAuthMessage() {
  const box = authMessageBox();
  if (!box) return;
  box.hidden = true;
  box.textContent = "";
  box.classList.remove("is-visible", "auth-message--error", "auth-message--ok");
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
    if (form.dataset.busy) return;
    clearAuthMessage();
    if (!form.email.value.trim() || !form.password.value || !form.email.checkValidity()) {
      showAuthMessage("Enter a valid email and password first.", "error");
      (!form.email.value.trim() || !form.email.checkValidity() ? form.email : form.password).focus();
      return;
    }
    await showChallenge(form, async (token) => {
      const submit = form.querySelector('[type="submit"]');
      const original = submit ? submit.innerHTML : "";
      form.dataset.busy = "1";
      if (submit) { submit.textContent = "Signing in…"; submit.setAttribute("aria-busy", "true"); }
      try {
        const { response, data } = await sendJson("/api/v1/auth/login", {
          email: form.email.value,
          password: form.password.value,
          remember: Boolean(form.remember?.checked),
          turnstile_token: token,
        });
        clearChallenge(form);
        if (!response.ok) {
          showAuthMessage(errorFromApi(data), "error");
          return;
        }
        if (data.mfa_required && data.ticket) {
          showMfaForm(data.ticket);
          return;
        }
        window.location.href = data.redirect || "/dashboard";
      } catch {
        clearChallenge(form);
        showAuthMessage("Could not reach the server.", "error");
      } finally {
        delete form.dataset.busy;
        if (submit) { submit.innerHTML = original; submit.removeAttribute("aria-busy"); }
      }
    });
  });
}

function showMfaForm(ticket) {
  const form = document.getElementById("mfa-form");
  if (!form || !ticket) return;
  form.dataset.ticket = ticket;
  form.hidden = false;
  const login = document.getElementById("login-form");
  if (login) login.hidden = true;
  const or = document.querySelector(".auth__or");
  const providers = document.querySelector(".oauth");
  if (or) or.hidden = true;
  if (providers) providers.hidden = true;
  const code = form.querySelector('input[name="code"]');
  if (code) code.focus();
}

function bindMfaForm() {
  const form = document.getElementById("mfa-form");
  if (!form) return;
  const ticket = new URLSearchParams(location.search).get("mfa_ticket");
  if (ticket) {
    showMfaForm(ticket);
    history.replaceState(null, "", "/login");
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (form.dataset.busy) return;
    const code = form.querySelector('input[name="code"]');
    if (!code || !code.value.trim()) return;
    const submit = form.querySelector('[type="submit"]');
    const original = submit ? submit.innerHTML : "";
    form.dataset.busy = "1";
    if (submit) { submit.textContent = "Verifying…"; submit.setAttribute("aria-busy", "true"); }
    try {
      const { response, data } = await sendJson("/api/v1/auth/login/mfa", {
        ticket: form.dataset.ticket,
        code: code.value.trim(),
      });
      if (!response.ok) {
        showAuthMessage(errorFromApi(data), "error");
        return;
      }
      window.location.href = data.redirect || "/dashboard";
    } catch {
      showAuthMessage("Could not reach the server.", "error");
    } finally {
      delete form.dataset.busy;
      if (submit) { submit.innerHTML = original; submit.removeAttribute("aria-busy"); }
    }
  });
}

function bindSignupForm() {
  const form = document.getElementById("signup-form");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (form.dataset.busy) return;
    clearAuthMessage();
    await showChallenge(form, async (token) => {
      const submit = form.querySelector('[type="submit"]');
      const original = submit ? submit.innerHTML : "";
      form.dataset.busy = "1";
      if (submit) { submit.textContent = "Creating account…"; submit.setAttribute("aria-busy", "true"); }
      try {
        const { response, data } = await sendJson("/api/v1/auth/signup", {
          email: form.email.value,
          password: form.password.value,
          confirm_password: form["confirm-password"].value,
          tos: Boolean(form.tos?.checked),
          username: form.username?.value?.trim().toLowerCase() || null,
          turnstile_token: token,
        });
        clearChallenge(form);
        if (!response.ok) {
          showAuthMessage(errorFromApi(data), "error");
          return;
        }
        window.location.href = data.redirect || "/dashboard";
      } catch {
        clearChallenge(form);
        showAuthMessage("Could not reach the server.", "error");
      } finally {
        delete form.dataset.busy;
        if (submit) { submit.innerHTML = original; submit.removeAttribute("aria-busy"); }
      }
    });
  });
}

function bindSocialAuth() {
  document.querySelectorAll(".social-auth__button").forEach((link) => {
    link.addEventListener("click", (event) => {
      if (link.getAttribute("aria-disabled") !== "true") return;
      event.preventDefault();
      showAuthMessage("This sign-in provider is not configured yet.", "error");
    });
  });
}

async function configureSocialAuth() {
  const links = document.querySelectorAll(".social-auth__button");
  if (!links.length) return;
  let providers;
  try {
    const response = await fetch("/api/v1/auth/providers", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    providers = response.ok ? await response.json() : null;
  } catch {
    providers = null;
  }
  if (providers?.turnstile_site_key) {
    window.MISA_TURNSTILE_SITE_KEY = providers.turnstile_site_key;
  }
  const routes = {
    google: "/api/v1/auth/google?next=/dashboard",
    discord: "/api/v1/auth/discord?next=/dashboard",
    telegram: "/api/v1/auth/telegram",
    apple: "/api/v1/auth/apple?next=/dashboard",
  };
  links.forEach((link) => {
    const provider = ["google", "discord", "telegram", "apple"].find((name) =>
      link.classList.contains(`social-auth__button--${name}`),
    );
    if (!provider) return;
    const enabled = providers?.[provider] !== false;
    if (enabled) {
      link.href = routes[provider];
      link.removeAttribute("tabindex");
    } else {
      link.href = "#";
      link.setAttribute("aria-disabled", "true");
    }
  });
}

function bindForgotPassword() {
  document.querySelectorAll(".forgot-link").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      showAuthMessage("Password reset is not enabled yet. Use Google, Discord, Telegram, or Apple, or sign in with your password.", "error");
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
    // v3.84: three "Connect" links read the same to a screen reader — carry the provider in the name
    const who = row.querySelector(".connection-row__info b");
    if (who) toggle.setAttribute("aria-label", (connected ? "Connected: " : "Connect ") + who.textContent.trim());
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
  if (accountId) accountId.textContent = user.account_id || "Generating...";
  const usernameInput = document.getElementById("username");
  if (usernameInput && user.username) usernameInput.value = user.username;
  setProviderState("email", Boolean(user.providers?.email), user.email || "Password login enabled");
  setProviderState("google", Boolean(user.providers?.google));
  setProviderState("discord", Boolean(user.providers?.discord));
  setProviderState("telegram", Boolean(user.providers?.telegram), user.telegram_username ? `@${user.telegram_username}` : "Connected");
  setProviderState("apple", Boolean(user.providers?.apple));
}

async function loadDashboard() {
  if (!document.querySelector(".dashboard")) return;
  let response;
  try {
    response = await fetch("/api/v1/me", { credentials: "include", headers: { Accept: "application/json" } });
  } catch {
    // v3.68: a dead network used to leave "loading…" in the nav and an unhandled rejection in the console; v2.js shows the message
    const name = document.getElementById("nav-name");
    if (name) name.textContent = "—";
    return;
  }
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

function bindAccountCopy() {
  const button = document.getElementById("account-copy");
  if (!button) return;
  button.addEventListener("click", async () => {
    const value = document.getElementById("account-id")?.textContent?.trim();
    if (!value || value === "—" || value === "Generating...") return;
    try {
      await navigator.clipboard.writeText(value);
      button.textContent = "Copied";
      window.setTimeout(() => { button.textContent = "Copy"; }, 1400);
    } catch {
      button.textContent = "Copy unavailable";
    }
  });
}

function bindUsernameForm() {
  const form = document.getElementById("username-form");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (form.dataset.busy) return; // v3.96: a second Enter while it saves sends nothing
    const submit = form.querySelector('[type="submit"]');
    const original = submit ? submit.textContent : "";
    form.dataset.busy = "1";
    if (submit) { submit.textContent = "Saving…"; submit.setAttribute("aria-busy", "true"); }
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
      delete form.dataset.busy;
      if (submit) { submit.textContent = original; submit.removeAttribute("aria-busy"); }
    }
  });
}

async function markLoggedInNav() {
  if (document.querySelector(".auth-page") || document.querySelector(".dashboard")) return;
  try {
    const response = await fetch("/api/v1/me", { credentials: "include", headers: { Accept: "application/json" } });
    if (!response.ok) return;
    document.documentElement.classList.add("is-signed-in"); // v3.33: lets the phone nav drop "Claim" for members
    document.querySelectorAll('a[href="/login"]').forEach((link) => {
      link.href = "/dashboard";
      if (link.textContent.trim().toLowerCase() === "login") link.textContent = "Dashboard";
    });
    // v3.107: a member has an account — the nav's “Claim username” button becomes “Dashboard” (the text link hides on
    // wide screens, css); the phone menu's claim button hides (its Login entry already reads Dashboard)
    document.querySelectorAll(".nav__actions [data-claim]").forEach((btn) => {
      btn.href = "/dashboard";
      const label = btn.querySelector("span");
      if (label) label.textContent = "Dashboard";
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

  bindLoginForm();
  bindMfaForm();
  bindSignupForm();
  configureSocialAuth();
  bindSocialAuth();
  bindForgotPassword();
  bindLogout();
  bindUsernameForm();
  bindAccountCopy();
  loadDashboard();
  markLoggedInNav();
});
