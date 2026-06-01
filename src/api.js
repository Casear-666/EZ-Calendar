/**
 * API 服务层 — 与后端 Express 通信
 * 后端不可用时静默降级，前端仍可正常使用本地状态
 */

// 优先使用 Vite 注入的环境变量，未设置时回退到相对路径 `/api`（方便 dev proxy / production）
const BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) ? import.meta.env.VITE_API_BASE : '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = new Error(`API ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// ── CRUD ──

export async function fetchTasks() {
  return request('/tasks');
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

/** 仅更新时间字段（拖拽/拉伸专用） */
export async function updateTaskTime(id, start, end) {
  return request(`/tasks/${id}/time`, {
    method: 'PATCH',
    body: JSON.stringify({ start, end }),
  });
}

export async function deleteTask(id) {
  return request(`/tasks/${id}`, { method: 'DELETE' });
}

// ── 防抖队列（按任务 ID 合并，300ms 窗口）──

const timeQueue = new Map();

export function debouncedUpdateTime(id, start, end) {
  const key = `time_${id}`;
  if (timeQueue.has(key)) {
    clearTimeout(timeQueue.get(key));
  }
  const timer = setTimeout(async () => {
    timeQueue.delete(key);
    try {
      await updateTaskTime(id, start, end);
    } catch {
      // 静默失败 — 下次刷新时从数据库恢复
    }
  }, 300);
  timeQueue.set(key, timer);
}
