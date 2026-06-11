/**
 * useAuth — 认证状态管理
 * 登录 / 注册 / 登出 / 自动恢复
 */
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import * as api from '../api';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // 页面加载时尝试恢复登录
  useEffect(() => {
    const token = localStorage.getItem('ec-token');
    if (!token) {
      setAuthLoading(false);
      return;
    }
    api.getMe()
      .then(data => setUser(data.user))
      .catch(() => api.clearToken())
      .finally(() => setAuthLoading(false));
  }, []);

  const handleLogin = useCallback(async (username, password) => {
    const data = await api.login(username, password);
    api.setToken(data.token);
    setUser(data.user);
    toast.success(`欢迎，${data.user.username}`);
  }, []);

  const handleRegister = useCallback(async (username, password) => {
    const data = await api.register(username, password);
    api.setToken(data.token);
    setUser(data.user);
    toast.success(`注册成功，${data.user.username}`);
  }, []);

  const handleLogout = useCallback(() => {
    api.clearToken();
    setUser(null);
    toast('已退出登录');
  }, []);

  return { user, authLoading, login: handleLogin, register: handleRegister, logout: handleLogout };
}
