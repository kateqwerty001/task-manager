import { GOOGLE_CLIENT_ID } from "./config.js";

/** Google ID token — kept in memory only */
let googleToken = null;

export function getToken() {
  return googleToken;
}

export function isGoogleConfigured() {
  return (
    GOOGLE_CLIENT_ID &&
    !GOOGLE_CLIENT_ID.includes("YOUR_CLIENT_ID")
  );
}

/** Decode JWT payload for display (email, name) — not verified here; API verifies. */
export function getTokenProfile() {
  if (!googleToken) return null;
  try {
    const payload = googleToken.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function initGoogleSignIn(onSignedIn) {
  if (!isGoogleConfigured()) {
    return false;
  }

  window.handleCredentialResponse = (response) => {
    googleToken = response.credential;
    onSignedIn();
  };

  const init = () => {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: window.handleCredentialResponse,
      auto_select: false,
    });

    const container = document.getElementById("sign-in-btn");
    if (container) {
      google.accounts.id.renderButton(container, {
        theme: "filled_blue",
        size: "large",
        text: "signin_with",
        shape: "rectangular",
      });
    }
  };

  if (window.google?.accounts?.id) {
    init();
  } else {
    window.addEventListener("load", init, { once: true });
  }

  return true;
}

export function signOut() {
  googleToken = null;
  if (window.google?.accounts?.id) {
    google.accounts.id.disableAutoSelect();
  }
}
