/**
 * ============================================================
 *  STUDENT TASK MANAGER - Frontend JavaScript
 *  File: frontend/script.js
 * ============================================================
 *
 *  This file handles all frontend logic:
 *   - Authentication (Register / Login / Logout)
 *   - Task CRUD operations (Add / Fetch / Complete / Delete)
 *   - UI state management (tabs, filters, toasts, spinners)
 *
 *  It communicates with the backend via the fetch() API
 *  (REST calls to Express routes on http://localhost:5000)
 *
 *  ─── AWS DEPLOYMENT NOTE ────────────────────────────────
 *  When deploying to AWS:
 *   1. Change API_URL below to your EC2 Public IP/DNS:
 *      const API_URL = 'http://YOUR_EC2_PUBLIC_IP:5000';
 *      OR if you use a domain + HTTPS:
 *      const API_URL = 'https://api.yourdomain.com';
 *   2. Upload this file to Amazon S3 along with index.html
 *      and style.css for static website hosting.
 *   3. On EC2: open port 5000 in the Security Group inbound rules.
 *
 *  Amazon SNS NOTE:
 *   The backend can use SNS to send email alerts when tasks
 *   are near their deadline. This JS file would call the
 *   backend endpoint that triggers the SNS publish.
 *
 *  Amazon CloudWatch NOTE:
 *   All fetch() errors caught here can also be reported to
 *   the backend which then logs them to CloudWatch.
 * ============================================================
 */

'use strict';

// ── Configuration ──────────────────────────────────────────────
/**
 * Backend API base URL.
 * Change this to your EC2 public DNS when deploying to AWS.
 * Example: 'http://ec2-xx-xx-xx-xx.compute-1.amazonaws.com:5000'
 */
const API_URL = 'http://localhost:5001';

// ── App State ──────────────────────────────────────────────────
/**
 * Global state object that holds the currently logged-in user's info.
 * In a production app, this would be stored in a JWT token or session.
 */
let currentUser = {
  id:       null,    // User's unique ID (from backend)
  username: null     // User's display name
};

/** All fetched tasks for the current user */
let allTasks = [];

/** Current active filter: 'all' | 'pending' | 'done' */
let currentFilter = 'all';

// ══════════════════════════════════════════════════════════════
//  UTILITY FUNCTIONS
// ══════════════════════════════════════════════════════════════

/**
 * Shows a toast notification at the bottom-right corner.
 * @param {string} message - Text to display
 * @param {'success'|'error'|'info'} type - Toast style
 */
function showToast(message, type = 'info') {
  const toast   = document.getElementById('toast');
  const icon    = document.getElementById('toast-icon');
  const msgEl   = document.getElementById('toast-message');

  // Icons per type
  const icons = {
    success: '✅',
    error:   '❌',
    info:    'ℹ️'
  };

  // Set content and class
  icon.textContent    = icons[type] || 'ℹ️';
  msgEl.textContent   = message;
  toast.className     = `toast toast-${type}`;

  // Show toast
  toast.classList.remove('hidden');

  // Auto-hide after 3.5 seconds
  clearTimeout(toast._hideTimeout);
  toast._hideTimeout = setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => {
      toast.classList.add('hidden');
      toast.classList.remove('hiding');
    }, 350);
  }, 3500);
}

/**
 * Displays a status message inside auth panels (login/register).
 * @param {string} elementId - ID of the message div
 * @param {string} text      - Message text
 * @param {'success'|'error'} type - Message style
 */
function showAuthMessage(elementId, text, type) {
  const el = document.getElementById(elementId);
  el.textContent = text;
  el.className   = `auth-message show ${type}`;
  // Auto-clear after 4 seconds
  setTimeout(() => { el.className = 'auth-message'; el.textContent = ''; }, 4000);
}

/**
 * Displays a status message inside the task add form.
 * @param {string} text - Message text
 * @param {'success'|'error'} type - Style
 */
function showTaskMessage(text, type) {
  const el = document.getElementById('task-message');
  el.textContent = text;
  el.className   = `task-message show ${type}`;
  setTimeout(() => { el.className = 'task-message'; el.textContent = ''; }, 3000);
}

/**
 * Sets a button into loading state (spinner + disabled).
 * @param {string} btnId - Button element ID
 * @param {boolean} loading - true = show spinner, false = restore
 */
function setButtonLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.classList.toggle('loading', loading);
}

/**
 * Formats a date string (YYYY-MM-DD) to a readable label.
 * Returns the formatted date and a status class.
 * @param {string} deadline - ISO date string
 * @returns {{ label: string, cls: string }}
 */
function formatDeadline(deadline) {
  if (!deadline) return { label: 'No deadline', cls: '' };

  const today     = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate   = new Date(deadline + 'T00:00:00'); // force local time

  const diffDays  = Math.round((dueDate - today) / (1000 * 60 * 60 * 24));

  // Format readable date
  const label = dueDate.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  });

  let cls = '';
  if (diffDays < 0)      cls = 'overdue';
  else if (diffDays <= 3) cls = 'soon';

  const relative = diffDays < 0
    ? `(${Math.abs(diffDays)}d overdue)`
    : diffDays === 0
    ? '(Today!)'
    : diffDays === 1
    ? '(Tomorrow)'
    : diffDays <= 3
    ? `(${diffDays}d left)`
    : '';

  return { label: `${label} ${relative}`.trim(), cls };
}

/**
 * Updates the header statistics (total / done / pending counts).
 */
function updateStats() {
  const total   = allTasks.length;
  const done    = allTasks.filter(t => t.completed).length;
  const pending = total - done;

  document.getElementById('stat-total').textContent   = total;
  document.getElementById('stat-done').textContent    = done;
  document.getElementById('stat-pending').textContent = pending;
}

// ══════════════════════════════════════════════════════════════
//  AUTH: TAB SWITCHING
// ══════════════════════════════════════════════════════════════

/**
 * Switches between Login and Register tabs.
 * @param {'login'|'register'} tab
 */
function switchTab(tab) {
  const loginPanel    = document.getElementById('login-panel');
  const registerPanel = document.getElementById('register-panel');
  const tabLogin      = document.getElementById('tab-login');
  const tabRegister   = document.getElementById('tab-register');
  const indicator     = document.getElementById('tab-indicator');

  if (tab === 'login') {
    loginPanel.classList.add('active');
    registerPanel.classList.remove('active');
    tabLogin.classList.add('active');
    tabLogin.setAttribute('aria-selected', 'true');
    tabRegister.classList.remove('active');
    tabRegister.setAttribute('aria-selected', 'false');
    indicator.classList.remove('right');
  } else {
    registerPanel.classList.add('active');
    loginPanel.classList.remove('active');
    tabRegister.classList.add('active');
    tabRegister.setAttribute('aria-selected', 'true');
    tabLogin.classList.remove('active');
    tabLogin.setAttribute('aria-selected', 'false');
    indicator.classList.add('right');
  }
}

// ══════════════════════════════════════════════════════════════
//  AUTH: REGISTER
// ══════════════════════════════════════════════════════════════

/**
 * Handles the Register form submission.
 * Calls POST /register with username and password.
 * @param {Event} event - Form submit event
 */
async function handleRegister(event) {
  event.preventDefault(); // Prevent page reload

  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value.trim();

  // Basic client-side validation
  if (!username || !password) {
    showAuthMessage('register-message', 'Please fill in all fields.', 'error');
    return;
  }
  if (username.length < 3) {
    showAuthMessage('register-message', 'Username must be at least 3 characters.', 'error');
    return;
  }
  if (password.length < 4) {
    showAuthMessage('register-message', 'Password must be at least 4 characters.', 'error');
    return;
  }

  setButtonLoading('register-btn', true);

  try {
    // ── API Call: POST /register ──────────────────────────
    const response = await fetch(`${API_URL}/register`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (response.ok) {
      // Success: clear form and switch to login
      showAuthMessage('register-message', `${data.message} Now login!`, 'success');
      showToast('Account created! Please log in.', 'success');
      document.getElementById('register-form').reset();
      setTimeout(() => switchTab('login'), 1500);
    } else {
      // Backend returned an error (e.g., username exists)
      showAuthMessage('register-message', data.message, 'error');
    }

  } catch (err) {
    // Network error: backend might not be running
    console.error('[REGISTER ERROR]', err);
    showAuthMessage('register-message', 'Cannot connect to server. Is the backend running?', 'error');
  } finally {
    setButtonLoading('register-btn', false);
  }
}

// ══════════════════════════════════════════════════════════════
//  AUTH: LOGIN
// ══════════════════════════════════════════════════════════════

/**
 * Handles the Login form submission.
 * Calls POST /login and, on success, redirects to the dashboard.
 * @param {Event} event - Form submit event
 */
async function handleLogin(event) {
  event.preventDefault();

  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value.trim();

  if (!username || !password) {
    showAuthMessage('login-message', 'Please enter username and password.', 'error');
    return;
  }

  setButtonLoading('login-btn', true);

  try {
    // ── API Call: POST /login ─────────────────────────────
    const response = await fetch(`${API_URL}/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (response.ok) {
      // Store user info in state
      currentUser.id       = data.userId;
      currentUser.username = data.username;

      // Update greeting in dashboard
      document.getElementById('user-greeting').textContent = `Welcome, ${data.username}! 🎓`;

      // Switch views
      showDashboard();

      // Fetch tasks immediately
      fetchTasks();

      showToast(`Welcome back, ${data.username}!`, 'success');
    } else {
      showAuthMessage('login-message', data.message, 'error');
    }

  } catch (err) {
    console.error('[LOGIN ERROR]', err);
    showAuthMessage('login-message', 'Cannot connect to server. Is the backend running?', 'error');
  } finally {
    setButtonLoading('login-btn', false);
  }
}

// ══════════════════════════════════════════════════════════════
//  AUTH: LOGOUT
// ══════════════════════════════════════════════════════════════

/**
 * Logs the user out by clearing state and showing the auth screen.
 */
function handleLogout() {
  // Clear user state
  currentUser = { id: null, username: null };
  allTasks    = [];
  currentFilter = 'all';

  // Reset forms
  document.getElementById('login-form').reset();
  document.getElementById('register-form').reset();
  document.getElementById('task-form').reset();

  // Switch views
  showAuthSection();
  switchTab('login');

  showToast('Logged out successfully.', 'info');
}

// ══════════════════════════════════════════════════════════════
//  VIEW SWITCHING
// ══════════════════════════════════════════════════════════════

/** Shows the dashboard and hides the auth section */
function showDashboard() {
  document.getElementById('auth-section').classList.add('hidden');
  document.getElementById('dashboard-section').classList.remove('hidden');
}

/** Shows the auth section and hides the dashboard */
function showAuthSection() {
  document.getElementById('dashboard-section').classList.add('hidden');
  document.getElementById('auth-section').classList.remove('hidden');
}

// ══════════════════════════════════════════════════════════════
//  TASKS: FETCH ALL TASKS
// ══════════════════════════════════════════════════════════════

/**
 * Fetches all tasks for the current user from the backend.
 * Calls GET /tasks?userId=<id>
 *
 * AWS CloudWatch NOTE: The backend logs this call and it appears
 * in CloudWatch Logs when deployed on EC2.
 */
async function fetchTasks() {
  // Show loading spinner
  document.getElementById('tasks-loading').classList.remove('hidden');
  document.getElementById('task-list').classList.add('hidden');
  document.getElementById('tasks-empty').classList.add('hidden');

  try {
    // ── API Call: GET /tasks?userId=... ───────────────────
    const response = await fetch(`${API_URL}/tasks?userId=${currentUser.id}`);
    const data     = await response.json();

    if (response.ok) {
      allTasks = data.tasks || [];
      updateStats();
      renderTasks();
    } else {
      showToast(data.message || 'Failed to fetch tasks.', 'error');
    }

  } catch (err) {
    console.error('[FETCH TASKS ERROR]', err);
    showToast('Cannot load tasks. Check backend connection.', 'error');
  } finally {
    document.getElementById('tasks-loading').classList.add('hidden');
  }
}

// ══════════════════════════════════════════════════════════════
//  TASKS: ADD TASK
// ══════════════════════════════════════════════════════════════

/**
 * Handles the Add Task form submission.
 * Calls POST /tasks with title, description, deadline.
 *
 * AWS SNS NOTE: After adding, the backend can optionally
 * publish to an SNS Topic to schedule a deadline reminder email.
 *
 * @param {Event} event - Form submit event
 */
async function handleAddTask(event) {
  event.preventDefault();

  const title       = document.getElementById('task-title').value.trim();
  const description = document.getElementById('task-description').value.trim();
  const deadline    = document.getElementById('task-deadline').value;

  // Client-side validation
  if (!title) {
    showTaskMessage('Task title is required.', 'error');
    return;
  }
  if (!deadline) {
    showTaskMessage('Please set a deadline date.', 'error');
    return;
  }

  setButtonLoading('add-task-btn', true);

  try {
    // ── API Call: POST /tasks ─────────────────────────────
    const response = await fetch(`${API_URL}/tasks`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        userId:      currentUser.id,
        title,
        description,
        deadline
      })
    });

    const data = await response.json();

    if (response.ok) {
      // Add new task to local state without refetching
      allTasks.push(data.task);
      updateStats();
      renderTasks();

      // Reset form
      document.getElementById('task-form').reset();

      showTaskMessage('Task added successfully!', 'success');
      showToast(`Task "${title}" added!`, 'success');
    } else {
      showTaskMessage(data.message, 'error');
    }

  } catch (err) {
    console.error('[ADD TASK ERROR]', err);
    showTaskMessage('Failed to add task. Check backend.', 'error');
  } finally {
    setButtonLoading('add-task-btn', false);
  }
}

// ══════════════════════════════════════════════════════════════
//  TASKS: MARK AS COMPLETE
// ══════════════════════════════════════════════════════════════

/**
 * Marks a task as completed.
 * Calls PUT /tasks/:id
 * @param {string} taskId - The task's unique ID
 */
async function handleCompleteTask(taskId) {
  try {
    // ── API Call: PUT /tasks/:id ──────────────────────────
    const response = await fetch(`${API_URL}/tasks/${taskId}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ userId: currentUser.id })
    });

    const data = await response.json();

    if (response.ok) {
      // Update local state
      const task = allTasks.find(t => t.id === taskId);
      if (task) task.completed = true;

      updateStats();
      renderTasks();
      showToast('Task completed! Great job! 🎉', 'success');
    } else {
      showToast(data.message || 'Failed to mark task.', 'error');
    }

  } catch (err) {
    console.error('[COMPLETE TASK ERROR]', err);
    showToast('Error completing task. Check backend.', 'error');
  }
}

// ══════════════════════════════════════════════════════════════
//  TASKS: DELETE TASK
// ══════════════════════════════════════════════════════════════

/**
 * Deletes a task permanently.
 * Calls DELETE /tasks/:id
 *
 * AWS CloudWatch NOTE: Deletion events are logged on the backend
 * and visible in CloudWatch Logs for audit trails.
 *
 * @param {string} taskId    - The task's unique ID
 * @param {string} taskTitle - Task title (for the confirmation message)
 */
async function handleDeleteTask(taskId, taskTitle) {
  // Simple confirmation dialog
  const confirmed = confirm(`Delete task "${taskTitle}"?\n\nThis action cannot be undone.`);
  if (!confirmed) return;

  try {
    // ── API Call: DELETE /tasks/:id ───────────────────────
    const response = await fetch(`${API_URL}/tasks/${taskId}`, {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ userId: currentUser.id })
    });

    const data = await response.json();

    if (response.ok) {
      // Remove from local state
      allTasks = allTasks.filter(t => t.id !== taskId);
      updateStats();
      renderTasks();
      showToast(`Task "${taskTitle}" deleted.`, 'info');
    } else {
      showToast(data.message || 'Failed to delete task.', 'error');
    }

  } catch (err) {
    console.error('[DELETE TASK ERROR]', err);
    showToast('Error deleting task. Check backend.', 'error');
  }
}

// ══════════════════════════════════════════════════════════════
//  TASKS: FILTER
// ══════════════════════════════════════════════════════════════

/**
 * Changes the current task filter and re-renders the list.
 * @param {'all'|'pending'|'done'} filter
 */
function filterTasks(filter) {
  currentFilter = filter;

  // Update active filter button
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`filter-${filter}`).classList.add('active');

  renderTasks();
}

// ══════════════════════════════════════════════════════════════
//  TASKS: RENDER LIST
// ══════════════════════════════════════════════════════════════

/**
 * Renders the task list based on allTasks and currentFilter.
 * Builds HTML for each task card dynamically.
 */
function renderTasks() {
  const taskListEl = document.getElementById('task-list');
  const emptyEl    = document.getElementById('tasks-empty');
  const emptyTitle = document.getElementById('empty-title');
  const emptySub   = document.getElementById('empty-subtitle');

  // Apply filter
  let filteredTasks;
  if (currentFilter === 'pending') {
    filteredTasks = allTasks.filter(t => !t.completed);
  } else if (currentFilter === 'done') {
    filteredTasks = allTasks.filter(t => t.completed);
  } else {
    filteredTasks = [...allTasks];
  }

  // Sort: pending first, then by deadline ascending
  filteredTasks.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return new Date(a.deadline) - new Date(b.deadline);
  });

  taskListEl.classList.remove('hidden');

  if (filteredTasks.length === 0) {
    // Show empty state
    taskListEl.classList.add('hidden');
    emptyEl.classList.remove('hidden');

    // Tailor empty message per filter
    if (currentFilter === 'done') {
      emptyTitle.textContent = 'No completed tasks yet.';
      emptySub.textContent   = 'Complete a task to see it here!';
    } else if (currentFilter === 'pending') {
      emptyTitle.textContent = 'All tasks are done! 🎉';
      emptySub.textContent   = 'Great job! Add new tasks above.';
    } else {
      emptyTitle.textContent = 'No tasks yet!';
      emptySub.textContent   = 'Add your first task above to get started.';
    }
    return;
  }

  emptyEl.classList.add('hidden');

  // Build task item HTML
  taskListEl.innerHTML = filteredTasks.map(task => {
    const { label: deadlineLabel, cls: deadlineCls } = formatDeadline(task.deadline);

    // Determine badge
    let badgeHtml;
    if (task.completed) {
      badgeHtml = `<span class="task-badge badge-done">✓ Done</span>`;
    } else if (deadlineCls === 'overdue') {
      badgeHtml = `<span class="task-badge badge-overdue">⚠ Overdue</span>`;
    } else {
      badgeHtml = `<span class="task-badge badge-pending">Pending</span>`;
    }

    // Deadline clock icon SVG (inline for simplicity)
    const clockSVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12,6 12,12 16,14"/>
    </svg>`;

    // Complete button (only shown if task is not already done)
    const completeBtn = !task.completed
      ? `<button
           class="btn btn-icon btn-complete"
           onclick="handleCompleteTask('${task.id}')"
           title="Mark as completed"
           aria-label="Mark task '${escapeAttr(task.title)}' as completed"
         >
           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
             <polyline points="20,6 9,17 4,12"/>
           </svg>
         </button>`
      : `<button
           class="btn btn-icon btn-complete"
           disabled
           title="Already completed"
           aria-label="Task already completed"
           style="opacity:0.4; cursor:default;"
         >
           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
             <polyline points="20,6 9,17 4,12"/>
           </svg>
         </button>`;

    return `
      <li class="task-item ${task.completed ? 'completed' : ''}" data-task-id="${task.id}" role="listitem">
        <div class="task-content">
          <div class="task-header">
            <span class="task-title-text">${escapeHtml(task.title)}</span>
            ${badgeHtml}
          </div>
          ${task.description
            ? `<p class="task-description">${escapeHtml(task.description)}</p>`
            : ''}
          <div class="task-deadline ${deadlineCls}" aria-label="Deadline: ${deadlineLabel}">
            ${clockSVG}
            <span>${deadlineLabel}</span>
          </div>
        </div>
        <div class="task-actions">
          ${completeBtn}
          <button
            class="btn btn-icon btn-delete"
            onclick="handleDeleteTask('${task.id}', '${escapeAttr(task.title)}')"
            title="Delete task"
            aria-label="Delete task '${escapeAttr(task.title)}'"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
              <polyline points="3,6 5,6 21,6"/>
              <path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/>
              <path d="M10,11v6"/>
              <path d="M14,11v6"/>
              <path d="M9,6V4a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1v2"/>
            </svg>
          </button>
        </div>
      </li>
    `;
  }).join('');
}

// ══════════════════════════════════════════════════════════════
//  SECURITY HELPERS: HTML Escaping
// ══════════════════════════════════════════════════════════════

/**
 * Escapes special HTML characters to prevent XSS attacks.
 * Always escape user-generated content before inserting into DOM.
 * @param {string} str
 * @returns {string} Safe HTML string
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Escapes characters for use inside HTML attributes (e.g., onclick="...").
 * @param {string} str
 * @returns {string} Safe attribute string
 */
function escapeAttr(str) {
  if (!str) return '';
  return String(str).replace(/'/g, "\\'").replace(/"/g, '\\"');
}

// ══════════════════════════════════════════════════════════════
//  INITIALIZATION
// ══════════════════════════════════════════════════════════════

/**
 * Runs once when the DOM is fully loaded.
 * Sets the minimum date for the deadline picker to today.
 */
document.addEventListener('DOMContentLoaded', () => {
  // Set the date picker minimum to today so students can't set past deadlines for new tasks
  const deadlineInput = document.getElementById('task-deadline');
  if (deadlineInput) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    deadlineInput.min = today;
  }

  // Log app startup info (visible in browser console)
  console.log('%c🎓 Student Task Manager', 'font-size:18px; font-weight:bold; color:#6c63ff;');
  console.log('%c📡 Backend URL:', 'color:#8892b0;', API_URL);
  console.log('%c☁️  AWS: EC2 + S3 + RDS + IAM + CloudWatch + SNS', 'color:#ff9900;');
});
