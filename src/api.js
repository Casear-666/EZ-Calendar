/**
 * API 服务层 — 与后端 Express 通信（含 JWT 认证）
 */

const BASE_URL = '/api';

function token() { return localStorage.getItem('ec-token'); }
export function setToken(t) { localStorage.setItem('ec-token', t); }
export function clearToken() { localStorage.removeItem('ec-token'); }

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const t = token();
  if (t) headers['Authorization'] = `Bearer ${t}`;
  const res = await fetch(`${BASE_URL}${path}`, { headers, ...options });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.error || `API ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// ── 认证 ──

export async function login(username, password) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function register(username, password) {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function getMe() {
  return request('/auth/me');
}

// ── CRUD ──

export async function fetchTasks() {
  const data = await request('/tasks');
  return Array.isArray(data) ? data : (data.data || []);
}

export async function createTask({ title, start, end, description = '', tag = null }) {
  return request('/tasks', {
    method: 'POST',
    body: JSON.stringify({ title, start, end, description, tag }),
  });
}

export async function updateTask(id, { title, start, end, description, tag }) {
  return request(`/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ title, start, end, description, tag }),
  });
}

async function updateTaskTime(id, start, end) {
  return request(`/tasks/${id}/time`, {
    method: 'PATCH',
    body: JSON.stringify({ start, end }),
  });
}

export async function deleteTask(id) {
  return request(`/tasks/${id}`, { method: 'DELETE' });
}

// ── 防抖队列 ──

const timeQueue = new Map();

export function debouncedUpdateTime(id, start, end) {
  const key = `time_${id}`;
  if (timeQueue.has(key)) clearTimeout(timeQueue.get(key));
  const timer = setTimeout(async () => {
    timeQueue.delete(key);
    try { await updateTaskTime(id, start, end); } catch {}
  }, 300);
  timeQueue.set(key, timer);
}
