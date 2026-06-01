import { apiFetch, ApiError } from "./api.js";
import { setGlobalLoading, showToast } from "./ui.js";

let isAdmin = false;

export function getIsAdmin() {
  return isAdmin;
}

export async function detectAdminAccess() {
  const navBtn = document.getElementById("nav-analytics");
  isAdmin = false;
  if (navBtn) navBtn.hidden = true;

  try {
    await apiFetch("/admin/analytics");
    isAdmin = true;
    if (navBtn) navBtn.hidden = false;
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) {
      return;
    }
    if (err instanceof ApiError && err.status !== 403) {
      console.warn("Admin check failed:", err.message);
    }
  }
}

export function initAdmin() {
  document.getElementById("nav-tasks")?.addEventListener("click", () => showView("tasks"));
  document.getElementById("nav-analytics")?.addEventListener("click", () => {
    showView("analytics");
    loadAnalytics();
  });
  document.getElementById("refresh-analytics-btn")?.addEventListener("click", () => loadAnalytics());
}

function showView(name) {
  const tasksView = document.getElementById("view-tasks");
  const analyticsView = document.getElementById("view-analytics");
  const navTasks = document.getElementById("nav-tasks");
  const navAnalytics = document.getElementById("nav-analytics");

  const isTasks = name === "tasks";
  if (tasksView) tasksView.hidden = !isTasks;
  if (analyticsView) analyticsView.hidden = isTasks;
  navTasks?.classList.toggle("nav-tab-active", isTasks);
  navAnalytics?.classList.toggle("nav-tab-active", !isTasks);
}

export async function loadAnalytics() {
  if (!isAdmin) return;

  setGlobalLoading(true);
  try {
    const data = await apiFetch("/admin/analytics");
    renderAnalytics(data);
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    setGlobalLoading(false);
  }
}

function renderAnalytics(data) {
  setStat("stat-total-users", data.total_users);
  setStat("stat-total-tasks", data.total_tasks);

  const status = data.tasks_by_status || {};
  setStat("stat-status-todo", status.todo ?? 0);
  setStat("stat-status-in-progress", status.in_progress ?? 0);
  setStat("stat-status-done", status.done ?? 0);

  const priority = data.tasks_by_priority || {};
  setStat("stat-priority-low", priority.low ?? 0);
  setStat("stat-priority-medium", priority.medium ?? 0);
  setStat("stat-priority-high", priority.high ?? 0);

  renderBarChart("chart-status", [
    { label: "To do", value: status.todo ?? 0, className: "bar-todo" },
    { label: "In progress", value: status.in_progress ?? 0, className: "bar-in-progress" },
    { label: "Done", value: status.done ?? 0, className: "bar-done" },
  ]);

  renderBarChart("chart-priority", [
    { label: "Low", value: priority.low ?? 0, className: "bar-priority-low" },
    { label: "Medium", value: priority.medium ?? 0, className: "bar-priority-medium" },
    { label: "High", value: priority.high ?? 0, className: "bar-priority-high" },
  ]);
}

function renderBarChart(containerId, bars) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const max = Math.max(...bars.map((b) => b.value), 1);

  el.innerHTML = bars
    .map(
      (bar) => `
    <div class="bar-chart-col">
      <span class="bar-chart-value">${bar.value}</span>
      <div class="bar-chart-track">
        <div
          class="bar-chart-fill ${bar.className}"
          style="height: ${bar.value === 0 ? 0 : Math.max((bar.value / max) * 100, 8)}%"
          role="presentation"
        ></div>
      </div>
      <span class="bar-chart-label">${bar.label}</span>
    </div>
  `
    )
    .join("");
}

function setStat(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value ?? 0);
}

export function resetAdminState() {
  isAdmin = false;
  const navBtn = document.getElementById("nav-analytics");
  if (navBtn) navBtn.hidden = true;
  showView("tasks");
}
