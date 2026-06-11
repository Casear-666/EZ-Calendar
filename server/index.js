/**
 * 精力感知日历 — Express API 服务器（含 JWT 认证）
 */
import express from 'express';
import cors from 'cors';
import pool from './db.js';
import { authMiddleware, hashPassword, verifyPassword, signToken } from './auth.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

function rowToEvent(row) {
  return {
    id: row.id,
    title: row.title,
    start: new Date(row.start_time),
    end: new Date(row.end_time),
    description: row.description || '',
    tag: row.tag || null,
  };
}

/** 输入验证，返回错误数组，空数组 = 通过 */
function validate(body) {
  const errors = [];
  const ALLOWED_TAGS = ['work', 'meeting', 'urgent', 'personal', 'other'];
  if (body.title !== undefined) {
    const t = (body.title || '').trim();
    if (!t) errors.push('title 不能为空');
    else if (t.length > 200) errors.push('title 不能超过 200 字符');
  }
  if (body.start !== undefined) {
    if (!body.start || isNaN(new Date(body.start).getTime()))
      errors.push('start 不是有效日期');
  }
  if (body.end !== undefined) {
    if (!body.end || isNaN(new Date(body.end).getTime()))
      errors.push('end 不是有效日期');
  }
  if (body.description && body.description.length > 5000)
    errors.push('description 不能超过 5000 字符');
  if (body.tag !== undefined && body.tag !== null && body.tag !== '') {
    if (!ALLOWED_TAGS.includes(body.tag))
      errors.push(`tag 必须为: ${ALLOWED_TAGS.join(', ')} 之一`);
  }
  return errors;
}

// ═══════════════ AUTH ROUTES ═══════════════

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: '用户名和密码为必填' });
    if (username.length < 2 || username.length > 20)
      return res.status(400).json({ error: '用户名需要 2-20 个字符' });
    if (password.length < 4)
      return res.status(400).json({ error: '密码至少需要 4 个字符' });

    const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0)
      return res.status(409).json({ error: '用户名已被占用' });

    const hash = hashPassword(password);
    const [result] = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)',
      [username, hash]
    );
    const user = { id: result.insertId, username };
    const token = signToken(user);
    res.status(201).json({ user, token });
  } catch (err) {
    console.error('POST /api/auth/register error:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: '用户名和密码为必填' });

    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length === 0)
      return res.status(401).json({ error: '用户名或密码错误' });

    const userRow = rows[0];
    if (!verifyPassword(password, userRow.password_hash))
      return res.status(401).json({ error: '用户名或密码错误' });

    const user = { id: userRow.id, username: userRow.username };
    const token = signToken(user);
    res.json({ user, token });
  } catch (err) {
    console.error('POST /api/auth/login error:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: { id: req.user.id, username: req.user.username } });
});

// ═══════════════ TASK ROUTES（需认证）═══════════════

app.get('/api/tasks', authMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 200));
    const offset = (page - 1) * limit;
    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) as total FROM tasks WHERE user_id = ?', [req.user.id]
    );
    const [rows] = await pool.query(
      'SELECT id, title, start_time, end_time, description, tag FROM tasks WHERE user_id = ? ORDER BY start_time LIMIT ? OFFSET ?',
      [req.user.id, limit, offset]
    );
    res.json({ data: rows.map(rowToEvent), total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('GET /api/tasks error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/tasks', authMiddleware, async (req, res) => {
  try {
    const { title, start, end, description = '', tag = null } = req.body;
    const errors = validate({ title, start, end, description, tag });
    if (errors.length > 0) return res.status(400).json({ error: errors.join('; ') });

    const [result] = await pool.query(
      'INSERT INTO tasks (user_id, title, start_time, end_time, description, tag) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, title.trim(), new Date(start), new Date(end), description.trim(), tag || null]
    );
    const [rows] = await pool.query('SELECT * FROM tasks WHERE id = ?', [result.insertId]);
    res.status(201).json(rowToEvent(rows[0]));
  } catch (err) {
    console.error('POST /api/tasks error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.patch('/api/tasks/:id', authMiddleware, async (req, res) => {
  try {
    const { title, start, end, description, tag } = req.body;
    const errors = validate({
      title: title !== undefined ? title : 'placeholder',
      start: start !== undefined ? start : new Date(),
      end: end !== undefined ? end : new Date(),
      description: description !== undefined ? description : '',
      tag: tag !== undefined ? tag : null,
    });
    if (errors.length > 0) return res.status(400).json({ error: errors.join('; ') });

    const [result] = await pool.query(
      'UPDATE tasks SET title = ?, start_time = ?, end_time = ?, description = ?, tag = ? WHERE id = ? AND user_id = ?',
      [title.trim(), new Date(start), new Date(end), (description || '').trim(), tag || null, req.params.id, req.user.id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ error: '任务不存在' });

    const [rows] = await pool.query('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
    res.json(rowToEvent(rows[0]));
  } catch (err) {
    console.error(`PATCH /api/tasks/${req.params.id} error:`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.patch('/api/tasks/:id/time', authMiddleware, async (req, res) => {
  try {
    const { start, end } = req.body;
    if (!start || !end)
      return res.status(400).json({ error: 'start, end 为必填字段' });

    const [result] = await pool.query(
      'UPDATE tasks SET start_time = ?, end_time = ? WHERE id = ? AND user_id = ?',
      [new Date(start), new Date(end), req.params.id, req.user.id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ error: '任务不存在' });

    const [rows] = await pool.query('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
    res.json(rowToEvent(rows[0]));
  } catch (err) {
    console.error(`PATCH /api/tasks/${req.params.id}/time error:`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/tasks/:id', authMiddleware, async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM tasks WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ error: '任务不存在' });

    res.json({ success: true });
  } catch (err) {
    console.error(`DELETE /api/tasks/${req.params.id} error:`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ 日历 API 服务器已启动 → http://localhost:${PORT}`);
  console.log('   POST   /api/auth/register');
  console.log('   POST   /api/auth/login');
  console.log('   GET    /api/auth/me');
  console.log('   GET    /api/tasks');
  console.log('   POST   /api/tasks');
  console.log('   PATCH  /api/tasks/:id');
  console.log('   PATCH  /api/tasks/:id/time');
  console.log('   DELETE /api/tasks/:id');
});
