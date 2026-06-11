/**
 * useEvents — 事件数据层
 * 职责：状态管理 / CRUD / 撤销历史 / API 持久化 / 分段重叠映射 / 搜索过滤
 */
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import { calcDayDensity } from '../utils/calendar';
import { fetchTasks, createTask, updateTask, deleteTask, debouncedUpdateTime } from '../api';

const MAX_HISTORY = 30;

export function useEvents(user) {
  const [events, setEvents] = useState([]);
  const [history, setHistory] = useState([[]]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const nextIdRef = useRef(1);

  // ── 用户变化时从 API 重新加载 ──
  useEffect(() => {
    if (!user) { setEvents([]); setHistory([[]]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const result = await fetchTasks();
        if (cancelled) return;
        const data = result.data || result || [];
        const mapped = (Array.isArray(data) ? data : []).map(e => ({
          ...e,
          start: new Date(e.start),
          end: new Date(e.end),
          description: e.description || '',
          tag: e.tag || null,
        }));
        if (!cancelled) {
          setEvents(mapped);
          setHistory([mapped]);
          setSearchQuery('');
          nextIdRef.current = mapped.length > 0 ? Math.max(...mapped.map(e => e.id), 0) + 1 : 1;
          setLoading(false);
          if (mapped.length > 0) {
            toast.success(`已加载 ${mapped.length} 个任务`);
          }
        }
      } catch {
        if (!cancelled) { setEvents([]); setHistory([[]]); setLoading(false); toast.error('无法连接服务器'); }
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // ── 撤销 ──
  const undo = useCallback(() => {
    setHistory(prev => {
      if (prev.length <= 1) return prev;
      const next = prev.slice(0, -1);
      setEvents(next[next.length - 1]);
      toast('已撤销', { icon: '↩' });
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.target.closest('input,textarea')) {
        e.preventDefault(); undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo]);

  const pushHistory = useCallback((nextEvents) => {
    setHistory(prev => [...prev.slice(-(MAX_HISTORY - 1)), nextEvents]);
  }, []);

  // ── CRUD ──

  const addEvent = useCallback(async (data) => {
    const tempId = nextIdRef.current++;
    const newEvent = { ...data, id: tempId, description: data.description || '', tag: data.tag || null };
    setEvents(prev => { const next = [...prev, newEvent]; pushHistory(next); return next; });
    toast.success(`「${newEvent.title}」已创建`);
    try {
      const saved = await createTask({
        title: newEvent.title, start: newEvent.start, end: newEvent.end,
        description: newEvent.description, tag: newEvent.tag,
      });
      const savedMapped = { ...saved, start: new Date(saved.start), end: new Date(saved.end), description: saved.description || '' };
      setEvents(prev => prev.map(e => e.id === tempId ? ({ ...savedMapped, ...e, id: savedMapped.id }) : e));
      nextIdRef.current = Math.max(nextIdRef.current, savedMapped.id + 1);
    } catch (err) {
      toast.error('保存到服务器失败，数据仅在本机');
    }
  }, [pushHistory]);

  const editEvent = useCallback((id, data) => {
    setEvents(prev => { const next = prev.map(e => e.id === id ? { ...e, ...data } : e); pushHistory(next); return next; });
    toast.success(`「${data.title}」已更新`);
    updateTask(id, data).catch(() => toast.error('同步到服务器失败'));
  }, [pushHistory]);

  const removeEvent = useCallback((id) => {
    setEvents(prev => {
      const target = prev.find(e => e.id === id);
      const next = prev.filter(e => e.id !== id);
      pushHistory(next);
      if (target) toast.success(`「${target.title}」已删除`, { action: { label: '撤销', onClick: () => undo() } });
      return next;
    });
    deleteTask(id).catch(() => {});
  }, [pushHistory, undo]);

  const moveEvent = useCallback((id, start, end) => {
    setEvents(prev => { const next = prev.map(e => e.id === id ? { ...e, start, end } : e); pushHistory(next); return next; });
    toast('时间已调整', { icon: '⏱' });
    debouncedUpdateTime(id, start, end);
  }, [pushHistory]);

  // ── 搜索过滤 ──
  const filteredEvents = useMemo(() => {
    if (!searchQuery.trim()) return events;
    const q = searchQuery.toLowerCase();
    return events.filter(e => e.title.toLowerCase().includes(q) || (e.description && e.description.toLowerCase().includes(q)));
  }, [events, searchQuery]);

  // ── 每日事件密度 ──
  const densityMap = useMemo(() => calcDayDensity(events), [events]);

  return {
    events, filteredEvents, densityMap, history, searchQuery, setSearchQuery,
    loading, addEvent, editEvent, removeEvent, moveEvent, undo,
  };
}
