/**
 * JWT 认证模块 — 签发 & 验证
 */
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const SECRET = process.env.JWT_SECRET || 'ec-calendar-secret-key-change-in-production';
const TOKEN_EXPIRES = '7d';

/** SHA-256 哈希密码 */
export function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

/** 验证密码 */
export function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
}

/** 签发 JWT */
export function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, SECRET, { expiresIn: TOKEN_EXPIRES });
}

/** Express 中间件：验证 JWT */
export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, SECRET);
    req.user = { id: payload.id, username: payload.username };
    next();
  } catch {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}
