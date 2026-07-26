import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---------------------------------------------------------------------------
// Firebase setup
// ---------------------------------------------------------------------------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const tasksCol = collection(db, "tasks");
const settingsRef = doc(db, "settings", "main");

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------
const loginScreen = document.getElementById("loginScreen");
const appRoot = document.getElementById("appRoot");
const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginError = document.getElementById("loginError");
const signOutBtn = document.getElementById("signOutBtn");

const tableBody = document.getElementById("taskTableBody");
const emptyState = document.getElementById("emptyState");
const totalTasksEl = document.getElementById("totalTasks");
const pendingTasksEl = document.getElementById("pendingTasks");
const dateTodayEl = document.getElementById("dateToday");
const programInput = document.getElementById("programInput");
const affirmationInput = document.getElementById("affirmationInput");
const addTaskBtn = document.getElementById("addTaskBtn");
const connectionStatus = document.getElementById("connectionStatus");
const chartEmpty = document.getElementById("chartEmpty");

const STATUS_OPTIONS = ["New", "Working on it", "Finished"];
const PRIORITY_OPTIONS = ["High", "Medium", "Low"];

const PENDING_STATUSES = ["New", "Working on it"];

const CHART_COLORS = [
  "#8c2f2f", "#c9973f", "#5b8fd6", "#7a9e6b", "#b06bb0",
  "#d68a4c", "#4fa3a3", "#c25b7c", "#7f7f4f", "#5c6ac4"
];

let currentTasks = [];
let chart;

// ---------------------------------------------------------------------------
// Today's date
// ---------------------------------------------------------------------------
dateTodayEl.textContent = new Date().toLocaleDateString("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric"
});

// ---------------------------------------------------------------------------
// Auth — show the app only once signed in; the Firestore listeners below
// are only started after login, since the security rules now require it.
// ---------------------------------------------------------------------------
let appStarted = false;
let unsubscribeSettings = null;
let unsubscribeTasks = null;

function showApp() {
  loginScreen.hidden = true;
  appRoot.hidden = false;
  loginError.textContent = "";
}

function hideApp() {
  loginScreen.hidden = false;
  appRoot.hidden = true;
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    showApp();
    if (!appStarted) {
      appStarted = true;
      startApp();
    }
  } else {
    hideApp();
    appStarted = false;
    if (unsubscribeSettings) unsubscribeSettings();
    if (unsubscribeTasks) unsubscribeTasks();
    unsubscribeSettings = null;
    unsubscribeTasks = null;
  }
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";
  try {
    const userCredential = await signInWithEmailAndPassword(auth, loginEmail.value.trim(), loginPassword.value);
    if (userCredential.user) {
      showApp();
      if (!appStarted) {
        appStarted = true;
        startApp();
      }
    }
    loginPassword.value = "";
  } catch (err) {
    console.error("sign-in failed", err);
    const code = err?.code;
    const message = code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found"
      ? "Wrong email or password."
      : `Sign-in failed. ${code || "Please try again."}`;
    loginError.textContent = message;
  }
});

signOutBtn?.addEventListener("click", () => signOut(auth));

// ---------------------------------------------------------------------------
// Everything below only runs once signed in
// ---------------------------------------------------------------------------
function startApp() {
  let savingSettings = false;

  unsubscribeSettings = onSnapshot(
    settingsRef,
    (snap) => {
      clearConnectionError();
      if (savingSettings) return;
      if (snap.exists()) {
        const data = snap.data();
        if (programInput && document.activeElement !== programInput) {
          programInput.value = data.program || "";
        }
        if (affirmationInput && document.activeElement !== affirmationInput) {
          affirmationInput.value = data.affirmation || "";
        }
      }
    },
    (err) => {
      console.error("settings listener error", err);
      showConnectionError();
    }
  );

  async function saveSettings() {
    savingSettings = true;
    try {
      const updates = {};
      if (programInput) updates.program = programInput.value;
      if (affirmationInput) updates.affirmation = affirmationInput.value;

      await setDoc(settingsRef, updates, { merge: true });
    } catch (err) {
      console.error("save settings failed", err);
      showConnectionError();
    } finally {
      savingSettings = false;
    }
  }

  let settingsSaveTimer;
  function queueSaveSettings() {
    clearTimeout(settingsSaveTimer);
    settingsSaveTimer = setTimeout(saveSettings, 500);
  }

  programInput?.addEventListener("input", queueSaveSettings);
  affirmationInput?.addEventListener("input", queueSaveSettings);

  unsubscribeTasks = onSnapshot(
    tasksCol,
    (snapshot) => {
      clearConnectionError();
      currentTasks = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      currentTasks.sort((a, b) => {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline) - new Date(b.deadline);
      });
      renderTasks();
    },
    (err) => {
      console.error("tasks listener error", err);
      showConnectionError();
    }
  );
}

function daysLeft(deadline) {
  if (!deadline) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(deadline);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - today) / (1000 * 60 * 60 * 24));
}

function renderTasks() {
  tableBody.innerHTML = "";
  emptyState.hidden = currentTasks.length > 0;

  currentTasks.forEach((task, index) => {
    const tr = document.createElement("tr");
    const left = daysLeft(task.deadline);
    const leftClass = left !== "" && left < 0 ? "days-overdue" : "";

    tr.innerHTML = `
      <td class="id-cell">${index + 1}</td>
      <td class="col-date"><input type="date" value="${task.deadline || ""}" data-field="deadline" /></td>
      <td class="col-course"><input type="text" value="${escapeHtml(task.course || "")}" data-field="course" placeholder="Course" /></td>
      <td class="col-details"><input type="text" value="${escapeHtml(task.details || "")}" data-field="details" placeholder="Task details" /></td>
      <td class="col-status">${buildSelect(STATUS_OPTIONS, task.status, "status")}</td>
      <td class="col-days ${leftClass}">${left}</td>
      <td class="col-priority">${buildSelect(PRIORITY_OPTIONS, task.priority, "priority")}</td>
      <td class="col-notes"><input type="text" value="${escapeHtml(task.notes || "")}" data-field="notes" placeholder="Notes" /></td>
      <td class="col-date"><input type="date" value="${task.finishedOn || ""}" data-field="finishedOn" /></td>
      <td class="col-actions"><button class="delete-btn" type="button" title="Delete task">🗑</button></td>
    `;

    const statusSelect = tr.querySelector('select[data-field="status"]');
    applyStatusClass(statusSelect, task.status);
    statusSelect.addEventListener("change", (e) => {
      applyStatusClass(statusSelect, e.target.value);
      const updates = { status: e.target.value };
      if (e.target.value === "Finished" && !task.finishedOn) {
        updates.finishedOn = new Date().toISOString().slice(0, 10);
      }
      updateTask(task.id, updates);
    });

    const prioritySelect = tr.querySelector('select[data-field="priority"]');
    applyPriorityClass(prioritySelect, task.priority);
    prioritySelect.addEventListener("change", (e) => {
      applyPriorityClass(prioritySelect, e.target.value);
      updateTask(task.id, { priority: e.target.value });
    });

    tr.querySelectorAll("input[data-field]").forEach((input) => {
      input.addEventListener("change", (e) => {
        updateTask(task.id, { [e.target.dataset.field]: e.target.value });
      });
    });

    tr.querySelector(".delete-btn").addEventListener("click", () => {
      if (confirm("Delete this task?")) deleteTask(task.id);
    });

    tableBody.appendChild(tr);
  });

  updateStats();
  updateChart();
}

function buildSelect(options, selected, field) {
  const opts = options
    .map((o) => `<option value="${o}" ${o === selected ? "selected" : ""}>${o}</option>`)
    .join("");
  return `<select data-field="${field}">${opts}</select>`;
}

function applyStatusClass(select, value) {
  select.className = "status-select";
  if (value === "New") select.classList.add("status-new");
  if (value === "Working on it") select.classList.add("status-working");
  if (value === "Finished") select.classList.add("status-finished");
}

function applyPriorityClass(select, value) {
  select.className = "priority-select";
  if (value === "High") select.classList.add("priority-high");
  if (value === "Medium") select.classList.add("priority-medium");
  if (value === "Low") select.classList.add("priority-low");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function updateTask(id, updates) {
  try {
    await updateDoc(doc(db, "tasks", id), updates);
  } catch (err) {
    console.error("update failed", err);
    showConnectionError();
  }
}

async function deleteTask(id) {
  try {
    await deleteDoc(doc(db, "tasks", id));
  } catch (err) {
    console.error("delete failed", err);
    showConnectionError();
  }
}

addTaskBtn.addEventListener("click", async () => {
  try {
    await addDoc(tasksCol, {
      deadline: "",
      course: "",
      details: "",
      status: "New",
      priority: "Medium",
      notes: "",
      finishedOn: "",
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.error("add failed", err);
    showConnectionError();
  }
});

function updateStats() {
  totalTasksEl.textContent = currentTasks.length;
  const pending = currentTasks.filter((t) => PENDING_STATUSES.includes(t.status)).length;
  pendingTasksEl.textContent = pending;
}

function updateChart() {
  const totals = {};
  currentTasks.forEach((t) => {
    const key = t.course && t.course.trim() ? t.course.trim() : "Uncategorized";
    totals[key] = (totals[key] || 0) + 1;
  });

  const labels = Object.keys(totals);
  const data = Object.values(totals);
  const colors = labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

  chartEmpty.hidden = labels.length > 0;

  const ctx = document.getElementById("courseChart").getContext("2d");

  if (!chart) {
    chart = new Chart(ctx, {
      type: "pie",
      data: { labels, datasets: [{ data, backgroundColor: colors }] },
      options: {
        plugins: {
          legend: {
            position: "right",
            labels: { color: "#3a231f", font: { family: "Inter" } }
          }
        }
      }
    });
  } else {
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.data.datasets[0].backgroundColor = colors;
    chart.update();
  }
}

function showConnectionError() {
  connectionStatus.textContent =
    "Couldn't reach Firebase. Check js/firebase-config.js and your Firestore security rules (see README.md).";
}

function clearConnectionError() {
  connectionStatus.textContent = "";
}
