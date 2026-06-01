import { API_BASE_URL } from "./config.js";
import { getToken } from "./auth.js";

export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

let onUnauthorized = null;

/** Register callback when API returns 401 (e.g. expired token). */
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

export function isApiConfigured() {
  return (
    API_BASE_URL &&
    !API_BASE_URL.includes("YOUR_GATEWAY") &&
    API_BASE_URL.startsWith("http")
  );
}

export async function apiFetch(path, method = "GET", body = null) {
  if (!isApiConfigured()) {
    throw new ApiError(
      "Set API_BASE_URL in js/config.js to your Cloud API Gateway URL.",
      0
    );
  }

  const token = getToken();
  if (!token) {
    throw new ApiError("Not signed in.", 401);
  }

  const headers = {
    Authorization: `Bearer ${token}`,
  };
  if (body != null) {
    headers["Content-Type"] = "application/json";
  }

  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : null,
    });
  } catch (err) {
    throw new ApiError(
      err.message === "Failed to fetch"
        ? "Network or CORS error reaching the API. Hard-refresh the page and try again."
        : err.message,
      0
    );
  }

  if (res.status === 204) {
    return null;
  }

  let data;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || res.statusText };
  }

  if (!res.ok) {
    if (res.status === 401 && onUnauthorized) {
      onUnauthorized();
    }
    throw new ApiError(
      data.error || `Request failed (${res.status})`,
      res.status,
      data
    );
  }

  return data;
}
