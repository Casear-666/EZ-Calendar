/**
 * LoginModal — 登录/注册弹窗
 */
import { useState } from 'react';
import { X, LogIn, UserPlus, Zap } from 'lucide-react';

export default function LoginModal({ onLogin, onRegister, onClose }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        await onRegister(username, password);
      } else {
        await onLogin(username, password);
      }
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="login-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close-btn login-close" onClick={onClose}><X size={18} /></button>

        <div className="login-icon">
          <Zap size={32} />
        </div>
        <h2>{isRegister ? '创建账号' : '欢迎回来'}</h2>
        <p className="login-subtitle">
          {isRegister ? '注册新账号开始使用精力感知日历' : '登录以同步你的任务数据'}
        </p>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label>用户名</label>
          <input
            className="modal-input"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="输入用户名"
            autoFocus
            required
            minLength={2}
            maxLength={20}
          />

          <label>密码</label>
          <input
            className="modal-input"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="输入密码"
            required
            minLength={4}
          />

          <button className="login-submit-btn" type="submit" disabled={loading}>
            {isRegister ? <UserPlus size={16} /> : <LogIn size={16} />}
            {loading ? '处理中...' : (isRegister ? '注册' : '登录')}
          </button>
        </form>

        <p className="login-switch">
          {isRegister ? '已有账号？' : '还没有账号？'}
          <button type="button" onClick={() => { setIsRegister(!isRegister); setError(''); }}>
            {isRegister ? '去登录' : '去注册'}
          </button>
        </p>
      </div>
    </div>
  );
}
