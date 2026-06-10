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

let mediaRecorder = null;
let voiceActive = false;
let audioChunks = [];

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

  document.getElementById("filter-status")?.addEventListener("change", loadTasks);
  document.getElementById("filter-priority")?.addEventListener("change", loadTasks);
  document.getElementById("sort-by")?.addEventListener("change", () => renderTaskList(cachedTasks));
  document
    .getElementById("refresh-tasks-btn")
    ?.addEventListener("click", () => loadTasks());

  document.getElementById("task-list")?.addEventListener("click", onTaskListClick);

  const editForm = document.getElementById("edit-task-form");
  editForm?.addEventListener("submit", onEditSubmit);

  document.getElementById("edit-modal-close")?.addEventListener("click", closeEditModal);
  document.getElementById("edit-cancel-btn")?.addEventListener("click", closeEditModal);

  initVoice();

  // View tabs: List / Calendar
  document.getElementById("tab-list")?.addEventListener("click", () => showView("list"));
  document.getElementById("tab-calendar")?.addEventListener("click", () => showView("calendar"));

  // Calendar chip click → open edit modal; overflow label → list view
  document.getElementById("cal-grid")?.addEventListener("click", async (e) => {
    if (e.target.classList.contains("cal-overflow")) {
      showView("list");
      return;
    }
    const chip = e.target.closest(".cal-task-chip");
    if (chip?.dataset.id) await openEditModal(chip.dataset.id);
  });

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
  const sortBy = document.getElementById("sort-by")?.value ?? "priority";
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const sorted = [...tasks].sort((a, b) => {
    if (a.status === "done" && b.status !== "done") return 1;
    if (b.status === "done" && a.status !== "done") return -1;
    if (sortBy === "date") {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    }
    return (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1);
  });
  listEl.innerHTML = sorted
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
        <li class="task-card${isDone ? " task-card-done" : ""}" data-id="${escapeHtml(task.id)}" data-status="${escapeHtml(task.status)}">
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

    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const sorted = [...dayTasks].sort((a, b) => {
      if (a.status === "done" && b.status !== "done") return 1;
      if (b.status === "done" && a.status !== "done") return -1;
      return (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1);
    });
    const MAX_CHIPS = 2;
    const visible = sorted.slice(0, MAX_CHIPS);
    const overflow = sorted.length - MAX_CHIPS;
    const chips = visible.map(t =>
      `<span class="cal-task-chip ${t.status === "done" ? "is-done" : "priority-" + t.priority}" data-id="${escapeHtml(t.id)}" title="${escapeHtml(t.title)}">${escapeHtml(t.title)}</span>`
    ).join("") + (overflow > 0 ? `<span class="cal-overflow">+${overflow} more</span>` : "");

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
  stopVoice();
  setVoiceStatus("");
  modal?.showModal();
}

function closeCreateModal() {
  stopVoice();
  document.getElementById("create-modal")?.close();
}

function initVoice() {
  const btn = document.getElementById("voice-btn");
  if (!btn) return;

  if (!navigator.mediaDevices?.getUserMedia) {
    document.querySelector(".voice-section")?.remove();
    return;
  }

  btn.addEventListener("click", () => {
    if (voiceActive) {
      stopVoice();
    } else {
      startVoice();
    }
  });
}

async function startVoice() {
  const btn = document.getElementById("voice-btn");
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    showToast("Microphone access denied", "error");
    return;
  }

  audioChunks = [];
  mediaRecorder = new MediaRecorder(stream);

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) audioChunks.push(e.data);
  };

  mediaRecorder.onstop = async () => {
    stream.getTracks().forEach((t) => t.stop());
    const mimeType = mediaRecorder.mimeType.split(";")[0];
    const blob = new Blob(audioChunks, { type: mimeType });
    setVoiceStatus("Processing…");
    await parseVoiceAudio(blob, mimeType);
  };

  voiceActive = true;
  btn?.classList.add("voice-btn-active");
  setVoiceStatus("Recording… click mic again to stop");
  mediaRecorder.start();
}

function stopVoice() {
  voiceActive = false;
  document.getElementById("voice-btn")?.classList.remove("voice-btn-active");
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
}

function setVoiceStatus(text) {
  const el = document.getElementById("voice-status");
  if (!el) return;
  el.textContent = text;
  el.hidden = !text;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function parseVoiceAudio(blob, mimeType) {
  try {
    const audioData = await blobToBase64(blob);
    const parsed = await apiFetch("/voice/parse", "POST", {
      audio_data: audioData,
      audio_mime_type: mimeType,
    });
    if (parsed.title) document.getElementById("create-title").value = parsed.title;
    if (parsed.description) document.getElementById("create-description").value = parsed.description;
    if (parsed.priority) document.getElementById("create-priority").value = parsed.priority;
    if (parsed.due_date) document.getElementById("create-due_date").value = parsed.due_date;
    setVoiceStatus("Done — review and adjust the fields below");
  } catch (err) {
    showToast(err.message, "error");
    setVoiceStatus("");
  }
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
