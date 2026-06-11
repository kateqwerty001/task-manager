let toastTimer = null;

export function showModalError(elementId, message) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
}

export function clearModalError(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = "";
  el.hidden = true;
}

export function showToast(message, type = "info", durationMs = 4000) {
  const el = document.getElementById("toast");
  if (!el) return;

  clearTimeout(toastTimer);
  el.textContent = message;
  el.className = `toast ${type}`;
  el.hidden = false;

  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, durationMs);
}

export function setGlobalLoading(visible) {
  const el = document.getElementById("global-loading");
  if (el) el.hidden = !visible;
}

export function setButtonsDisabled(disabled, root = document) {
  root.querySelectorAll("button, input[type='submit']").forEach((btn) => {
    if (btn.id === "sign-out-btn") return;
    btn.disabled = disabled;
  });
}

export function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function formatTimestamp(value) {
  if (!value) return "";
  let date;
  if (typeof value === "string") {
    date = new Date(value);
  } else if (value._seconds != null) {
    date = new Date(value._seconds * 1000);
  } else if (value.seconds != null) {
    date = new Date(value.seconds * 1000);
  } else {
    return "";
  }
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function labelStatus(status) {
  const map = {
    todo: "To do",
    in_progress: "In progress",
    done: "Done",
  };
  return map[status] || status;
}

export function labelPriority(priority) {
  return priority ? priority.charAt(0).toUpperCase() + priority.slice(1) : "";
}
