import { apiFetch } from "./api.js";
import {
  escapeHtml,
  formatTimestamp,
  labelPriority,
  labelStatus,
  setButtonsDisabled,
  setGlobalLoading,
  showToast,
} from "./ui.js";

let editingTaskId = null;
let calendarDate = new Date();
let cachedTasks = [];

export function initTasks() {
  document
    .getElementById("create-task-form")
    ?.addEventListener("submit", onCreateSubmit);

  // Create modal
  document.getElementById("add-task-btn")?.addEventListener("click", openCreateModal);
  document.getElementById("create-modal-close")?.addEventListener("click", closeCreateModal);
  document.getElementById("create-cancel-btn")?.addEventListener("click", closeCreateModal);

  // Filter pills
  document.getElementById("filter-status-group")?.addEventListener("click", (e) => {
    const pill = e.target.closest(".filter-pill");
    if (!pill) return;
    document.querySelectorAll("#filter-status-group .filter-pill").forEach(p => p.classList.remove("active"));
    pill.classList.add("active");
    document.getElementById("filter-status").value = pill.dataset.value;
    loadTasks();
  });

  document.getElementById("filter-priority-group")?.addEventListener("click", (e) => {
    const pill = e.target.closest(".filter-pill");
    if (!pill) return;
    document.querySelectorAll("#filter-priority-group .filter-pill").forEach(p => p.classList.remove("active"));
    pill.classList.add("active");
    document.getElementById("filter-priority").value = pill.dataset.value;
    loadTasks();
  });

  // Keep hidden select change handlers for backward compatibility
  document.getElementById("filter-status")?.addEventListener("change", loadTasks);
  document.getElementById("filter-priority")?.addEventListener("change", loadTasks);
  document
    .getElementById("refresh-tasks-btn")
    ?.addEventListener("click", () => loadTasks());

  document.getElementById("task-list")?.addEventListener("click", onTaskListClick);

  const editForm = document.getElementById("edit-task-form");
  editForm?.addEventListener("submit", onEditSubmit);

  document.getElementById("edit-modal-close")?.addEventListener("click", closeEditModal);
  document.getElementById("edit-cancel-btn")?.addEventListener("click", closeEditModal);

  // View tabs: List / Calendar
  document.getElementById("tab-list")?.addEventListener("click", () => showView("list"));
  document.getElementById("tab-calendar")?.addEventListener("click", () => showView("calendar"));

  // Calendar navigation
  document.getElementById("cal-prev")?.addEventListener("click", () => {
    calendarDate.setMonth(calendarDate.getMonth() - 1);
    renderCalendar(cachedTasks, calendarDate);
  });
  document.getElementById("cal-next")?.addEventListener("click", () => {
    calendarDate.setMonth(calendarDate.getMonth() + 1);
    renderCalendar(cachedTasks, calendarDate);
  });
}

function showView(view) {
  const tabList = document.getElementById("tab-list");
  const tabCalendar = document.getElementById("tab-calendar");
  const taskList = document.getElementById("task-list");
  const emptyState = document.getElementById("task-list-empty");
  const filters = document.getElementById("list-filters");
  const calView = document.getElementById("calendar-view");

  if (view === "calendar") {
    tabList?.classList.remove("view-tab-active");
    tabCalendar?.classList.add("view-tab-active");
    if (taskList) taskList.hidden = true;
    if (emptyState) emptyState.hidden = true;
    if (filters) filters.hidden = true;
    if (calView) calView.hidden = false;
    renderCalendar(cachedTasks, calendarDate);
  } else {
    tabList?.classList.add("view-tab-active");
    tabCalendar?.classList.remove("view-tab-active");
    if (filters) filters.hidden = false;
    if (calView) calView.hidden = true;
    // Re-show list or empty state based on cached state
    const isEmpty = cachedTasks.length === 0;
    if (taskList) taskList.hidden = isEmpty;
    if (emptyState) emptyState.hidden = !isEmpty;
  }
}

export async function loadTasks() {
  const listEl = document.getElementById("task-list");
  const emptyEl = document.getElementById("task-list-empty");
  if (!listEl) return;

  const status = document.getElementById("filter-status")?.value || "";
  const priority = document.getElementById("filter-priority")?.value || "";

  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (priority) params.set("priority", priority);
  const qs = params.toString();
  const path = qs ? `/tasks?${qs}` : "/tasks";

  setGlobalLoading(true);
  setButtonsDisabled(true);

  try {
    const tasks = await apiFetch(path);
    cachedTasks = Array.isArray(tasks) ? tasks : [];
    renderTaskList(cachedTasks);
    const isEmpty = cachedTasks.length === 0;

    // Only update visibility if we're in list view
    const calView = document.getElementById("calendar-view");
    if (!calView || calView.hidden) {
      emptyEl.hidden = !isEmpty;
      listEl.hidden = isEmpty;
    } else {
      renderCalendar(cachedTasks, calendarDate);
    }
  } catch (err) {
    showToast(err.message, "error");
    cachedTasks = [];
    renderTaskList([]);
    const calView = document.getElementById("calendar-view");
    if (!calView || calView.hidden) {
      emptyEl.hidden = false;
      listEl.hidden = true;
    }
  } finally {
    setGlobalLoading(false);
    setButtonsDisabled(false);
  }
}

function renderTaskList(tasks) {
  const listEl = document.getElementById("task-list");
  listEl.innerHTML = tasks
    .map((task) => {
      const statusClass = `status-${task.status.replace("_", "-")}`;
      const isDone = task.status === "done";
      const desc = task.description
        ? `<p class="task-description">${escapeHtml(task.description)}</p>`
        : "";
      const due = task.due_date
        ? `<span>Due ${escapeHtml(task.due_date)}</span>`
        : "";
      const updated = formatTimestamp(task.updated_at || task.created_at);
      const dates = [due, updated && `<span>Updated ${escapeHtml(updated)}</span>`]
        .filter(Boolean)
        .join(" · ");

      return `
        <li class="task-card" data-id="${escapeHtml(task.id)}" data-status="${escapeHtml(task.status)}">
          <div class="task-card-header">
            <button type="button" class="status-toggle ${statusClass}" aria-label="Cycle status" title="Click to advance status"></button>
            <h3 class="${isDone ? "task-title-done" : ""}">${escapeHtml(task.title)}</h3>
            <div class="task-actions">
              <button type="button" class="btn btn-ghost btn-sm edit-btn">Edit</button>
              <button type="button" class="btn btn-danger btn-sm delete-btn">Delete</button>
            </div>
          </div>
          ${desc}
          <div class="task-meta">
            <span class="badge badge-status ${escapeHtml(task.status)}">${escapeHtml(labelStatus(task.status))}</span>
            <span class="badge badge-priority ${escapeHtml(task.priority)}">${escapeHtml(labelPriority(task.priority))}</span>
          </div>
          ${dates ? `<div class="task-dates">${dates}</div>` : ""}
        </li>
      `;
    })
    .join("");
}

function renderCalendar(tasks, date) {
  const grid = document.getElementById("cal-grid");
  const label = document.getElementById("cal-month-label");
  if (!grid) return;

  const year = date.getFullYear();
  const month = date.getMonth();

  label.textContent = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Build a map: "YYYY-MM-DD" → [task, ...]
  const taskMap = {};
  for (const task of tasks) {
    if (!task.due_date) continue;
    const key = task.due_date.slice(0, 10);
    if (!taskMap[key]) taskMap[key] = [];
    taskMap[key].push(task);
  }

  // Grid starts on Monday (ISO)
  const firstDay = new Date(year, month, 1);
  // getDay(): 0=Sun…6=Sat → shift to Mon=0
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  let html = DAY_NAMES.map(d => `<div class="cal-day-header">${d}</div>`).join("");

  // Cells before the 1st (prev month)
  for (let i = 0; i < startOffset; i++) {
    const dayNum = daysInPrevMonth - startOffset + 1 + i;
    html += `<div class="cal-cell cal-other-month"><span class="cal-day-num">${dayNum}</span></div>`;
  }

  // Days in this month
  for (let d = 1; d <= daysInMonth; d++) {
    const cellDate = new Date(year, month, d);
    cellDate.setHours(0, 0, 0, 0);
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const isToday = cellDate.getTime() === today.getTime();
    const isPast = cellDate < today;
    const dayTasks = taskMap[key] || [];
    const hasUnfinishedPast = isPast && dayTasks.some(t => t.status !== "done");

    const classes = ["cal-cell"];
    if (isToday) classes.push("cal-today");
    if (hasUnfinishedPast) classes.push("cal-overdue");

    const chips = dayTasks.map(t =>
      `<span class="cal-task-chip ${t.status === "done" ? "is-done" : ""}" title="${escapeHtml(t.title)}">${escapeHtml(t.title)}</span>`
    ).join("");

    html += `
      <div class="${classes.join(" ")}">
        <span class="cal-day-num">${d}</span>
        <div class="cal-task-list">${chips}</div>
      </div>`;
  }

  // Fill remaining cells with next month days
  const totalCells = startOffset + daysInMonth;
  const remainder = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 1; i <= remainder; i++) {
    html += `<div class="cal-cell cal-other-month"><span class="cal-day-num">${i}</span></div>`;
  }

  grid.innerHTML = html;
}

function openCreateModal() {
  const modal = document.getElementById("create-modal");
  document.getElementById("create-task-form")?.reset();
  modal?.showModal();
}

function closeCreateModal() {
  document.getElementById("create-modal")?.close();
}

async function onCreateSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const title = document.getElementById("create-title").value.trim();
  const description = document.getElementById("create-description").value.trim();
  const priority = document.getElementById("create-priority").value;
  const dueDate = document.getElementById("create-due_date").value;

  const body = {
    title,
    description: description || null,
    priority,
    due_date: dueDate || null,
  };

  setButtonsDisabled(true, form);
  try {
    await apiFetch("/tasks", "POST", body);
    closeCreateModal();
    showToast("Task created.", "success");
    await loadTasks();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    setButtonsDisabled(false, form);
  }
}

async function onTaskListClick(e) {
  const card = e.target.closest(".task-card");
  if (!card) return;
  const id = card.dataset.id;
  const currentStatus = card.dataset.status;

  if (e.target.classList.contains("status-toggle")) {
    const cycle = { todo: "in_progress", in_progress: "done", done: "todo" };
    const newStatus = cycle[currentStatus] || "todo";
    setButtonsDisabled(true);
    try {
      await apiFetch(`/tasks/${id}`, "PATCH", { status: newStatus });
      await loadTasks();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setButtonsDisabled(false);
    }
    return;
  }

  if (e.target.classList.contains("delete-btn")) {
    if (!confirm("Delete this task?")) return;
    setButtonsDisabled(true);
    try {
      await apiFetch(`/tasks/${id}`, "DELETE");
      showToast("Task deleted.", "success");
      await loadTasks();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setButtonsDisabled(false);
    }
    return;
  }

  if (e.target.classList.contains("edit-btn")) {
    await openEditModal(id);
  }
}

async function openEditModal(taskId) {
  setGlobalLoading(true);
  try {
    const task = await apiFetch(`/tasks/${taskId}`);
    editingTaskId = taskId;

    document.getElementById("edit-task-id").value = taskId;
    document.getElementById("edit-title").value = task.title || "";
    document.getElementById("edit-description").value = task.description || "";
    document.getElementById("edit-priority").value = task.priority || "medium";
    document.getElementById("edit-status").value = task.status || "todo";
    document.getElementById("edit-due_date").value = task.due_date || "";

    document.getElementById("edit-modal").showModal();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    setGlobalLoading(false);
  }
}

function closeEditModal() {
  document.getElementById("edit-modal")?.close();
  editingTaskId = null;
}

async function onEditSubmit(e) {
  e.preventDefault();
  const id = document.getElementById("edit-task-id").value || editingTaskId;
  if (!id) return;

  const body = {
    title: document.getElementById("edit-title").value.trim(),
    description: document.getElementById("edit-description").value.trim() || null,
    priority: document.getElementById("edit-priority").value,
    status: document.getElementById("edit-status").value,
    due_date: document.getElementById("edit-due_date").value || null,
  };

  setButtonsDisabled(true, document.getElementById("edit-task-form"));
  try {
    await apiFetch(`/tasks/${id}`, "PATCH", body);
    closeEditModal();
    showToast("Task updated.", "success");
    await loadTasks();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    setButtonsDisabled(false, document.getElementById("edit-task-form"));
  }
}
