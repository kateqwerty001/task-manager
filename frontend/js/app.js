import {
  initGoogleSignIn,
  signOut,
  getTokenProfile,
  isGoogleConfigured,
} from "./auth.js";
import { setUnauthorizedHandler, isApiConfigured } from "./api.js";
import { initTasks, loadTasks } from "./tasks.js";
import { detectAdminAccess, initAdmin, resetAdminState } from "./admin.js";
import { showToast } from "./ui.js";

function showLogin() {
  document.getElementById("login-screen").hidden = false;
  document.getElementById("app").hidden = true;
}

function showApp() {
  document.getElementById("login-screen").hidden = true;
  document.getElementById("app").hidden = false;

  const profile = getTokenProfile();
  const emailEl = document.getElementById("user-email");
  if (emailEl) {
    emailEl.textContent = profile?.email || profile?.name || "Signed in";
  }
}

function showConfigWarnings() {
  const warn = document.getElementById("config-warning");
  if (!warn) return;
  const missing = !isGoogleConfigured() || !isApiConfigured();
  warn.hidden = !missing;
}

async function onSignedIn() {
  showApp();
  await loadTasks();
  await detectAdminAccess();
}

function initSignOut() {
  document.getElementById("sign-out-btn")?.addEventListener("click", () => {
    signOut();
    resetAdminState();
    showLogin();
    showToast("Signed out.", "info", 2500);
  });
}

function init() {
  showConfigWarnings();

  if (!isGoogleConfigured() || !isApiConfigured()) {
    console.warn(
      "Configure js/config.js with GOOGLE_CLIENT_ID and API_BASE_URL before use."
    );
  }

  setUnauthorizedHandler(() => {
    signOut();
    showLogin();
    showToast("Session expired. Please sign in again.", "error", 5000);
  });

  initTasks();
  initAdmin();
  initSignOut();

  const gsiReady = initGoogleSignIn(onSignedIn);
  if (!gsiReady) {
    showToast("Configure Google Client ID in js/config.js", "error", 8000);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
