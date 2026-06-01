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

export function initTasks() {
  document
    .getElementById("create-task-form")
    ?.addEventListener("submit", onCreateSubmit);

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
    renderTaskList(Array.isArray(tasks) ? tasks : []);
    const isEmpty = !tasks?.length;
    emptyEl.hidden = !isEmpty;
    listEl.hidden = isEmpty;
  } catch (err) {
    showToast(err.message, "error");
    renderTaskList([]);
    emptyEl.hidden = false;
    listEl.hidden = true;
  } finally {
    setGlobalLoading(false);
    setButtonsDisabled(false);
  }
}

function renderTaskList(tasks) {
  const listEl = document.getElementById("task-list");
  listEl.innerHTML = tasks
    .map((task) => {
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
        <li class="task-card" data-id="${escapeHtml(task.id)}">
          <div class="task-card-header">
            <h3>${escapeHtml(task.title)}</h3>
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

async function onCreateSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const title = document.getElementById("title").value.trim();
  const description = document.getElementById("description").value.trim();
  const priority = document.getElementById("priority").value;
  const dueDate = document.getElementById("due_date").value;

  const body = {
    title,
    description: description || null,
    priority,
    due_date: dueDate || null,
  };

  setButtonsDisabled(true, form);
  try {
    await apiFetch("/tasks", "POST", body);
    form.reset();
    document.getElementById("priority").value = "medium";
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
