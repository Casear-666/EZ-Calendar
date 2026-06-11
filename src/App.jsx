/**
 * App — 精力感知日历主编排层
 * 集成：FullCalendar + 分段重叠着色 + 暗色模式 + 搜索 + 快捷键 + JWT 认证
 */
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Toaster } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import { useHotkeys } from 'react-hotkeys-hook';
import { Zap, Plus, Undo2, Sun, Moon, Search, X, LogOut, LogIn } from 'lucide-react';
import './App.css';
import { colorForOverlap, eventGradient, legendGradient, TAG_PALETTE } from './colors';
import { dayKey } from './utils/calendar';
import { useEvents } from './hooks/useEvents';
import { useAuth } from './hooks/useAuth';
import EventModal from './components/EventModal';
import EventTooltip from './components/EventTooltip';
import LoginModal from './components/LoginModal';

export default function App() {
  // ── 认证 ──
  const { user, authLoading, login, register, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  // ── 数据层（user 变化时自动重新加载）──
  const {
    events, filteredEvents, densityMap, history, searchQuery, setSearchQuery,
    addEvent, editEvent, removeEvent, moveEvent, undo, loading,
  } = useEvents(user);

  // ── 弹窗状态 ──
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [selectedRange, setSelectedRange] = useState(null);

  // ── 暗色模式 ──
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('ec-dark');
    return saved ? saved === '1' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('ec-dark', dark ? '1' : '0');
  }, [dark]);

  // ── 悬浮提示 ──
  const [tooltip, setTooltip] = useState(null);
  const tooltipTimer = useRef(null);
  const showTooltip = useCallback((info) => {
    clearTimeout(tooltipTimer.current);
    setTooltip({ event: info.event, x: info.jsEvent.clientX, y: info.jsEvent.clientY });
  }, []);
  const hideTooltip = useCallback(() => {
    tooltipTimer.current = setTimeout(() => setTooltip(null), 200);
  }, []);
  const clearHideTooltip = useCallback(() => clearTimeout(tooltipTimer.current), []);

  // ── 边缘拉伸 ghost ──
  const resizeRef = useRef(null);
  const [resizeGhost, setResizeGhost] = useState(null);
  const [createGhost, setCreateGhost] = useState(null);
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const moveEventRef = useRef(moveEvent);
  moveEventRef.current = moveEvent;

  const getDateFromPoint = useCallback((x, y) => {
    const els = document.elementsFromPoint(x, y);
    for (const el of els) {
      const cell = el?.closest?.('[data-date]');
      if (cell) {
        const d = new Date(cell.getAttribute('data-date') + 'T00:00:00');
        if (!isNaN(d.getTime())) return d;
      }
    }
    return null;
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      const r = resizeRef.current;
      if (!r) return;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      const td = getDateFromPoint(e.clientX, e.clientY);
      if (td) {
        if (r.edge === 'start') {
          const ns = new Date(td);
          ns.setHours(r.origStart.getHours(), r.origStart.getMinutes(), 0, 0);
          if (ns < new Date(r.origEnd)) setResizeGhost({ ...r._event, start: ns, end: new Date(r.origEnd), _ghost: true, _eventId: r.eventId });
        } else {
          const ne = new Date(td);
          ne.setDate(ne.getDate() + 1);
          ne.setHours(r.origEnd.getHours(), r.origEnd.getMinutes(), 0, 0);
          if (ne > new Date(r.origStart)) setResizeGhost({ ...r._event, start: new Date(r.origStart), end: ne, _ghost: true, _eventId: r.eventId });
        }
      }
    };
    const onUp = (e) => {
      const r = resizeRef.current;
      if (!r) return;
      resizeRef.current = null; setResizeGhost(null);
      document.body.style.cursor = ''; document.body.style.userSelect = '';
      const td = getDateFromPoint(e.clientX, e.clientY);
      if (!td) return;
      if (r.edge === 'start') {
        const ns = new Date(td);
        ns.setHours(r.origStart.getHours(), r.origStart.getMinutes(), 0, 0);
        if (ns < new Date(r.origEnd)) moveEventRef.current(r.eventId, ns, new Date(r.origEnd));
      } else {
        const ne = new Date(td);
        ne.setDate(ne.getDate() + 1);
        ne.setHours(r.origEnd.getHours(), r.origEnd.getMinutes(), 0, 0);
        if (ne > new Date(r.origStart)) moveEventRef.current(r.eventId, new Date(r.origStart), ne);
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [getDateFromPoint]);

  // ── FullCalendar ref ──
  const calRef = useRef(null);

  // ── 快捷键 ──
  useHotkeys('n', (e) => {
    if (e.target.closest('input,textarea')) return;
    e.preventDefault();
    const now = new Date();
    setSelectedRange({ start: now, end: new Date(now.getTime() + 3600000) });
    setEditingEvent(null); setShowModal(true);
  }, { enableOnFormTags: false });

  useHotkeys('t', (e) => {
    if (e.target.closest('input,textarea')) return;
    e.preventDefault();
    calRef.current?.getApi().today();
  }, { enableOnFormTags: false });

  // ── FullCalendar 回调 ──
  const handleSelect = useCallback((selectInfo) => {
    setCreateGhost(null);
    const { start, end, allDay } = selectInfo;
    let ts, te;
    if (allDay || start.toDateString() !== end.toDateString()) {
      ts = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 9, 0);
      te = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1, 18, 0);
      if (te <= ts) te = new Date(ts.getTime() + 3600000);
    } else {
      ts = new Date(start); te = new Date(start.getTime() + 3600000);
    }
    setSelectedRange({ start: ts, end: te });
    setEditingEvent(null); setShowModal(true);
  }, []);

  const handleEventClick = useCallback((clickInfo) => {
    setEditingEvent(clickInfo.event); setSelectedRange(null); setShowModal(true);
  }, []);

  const handleEventDrop = useCallback((dropInfo) => {
    const { event } = dropInfo;
    if (!event.start || !event.end) return;
    moveEvent(parseInt(event.id), event.start, event.end);
  }, [moveEvent]);

  const handleEventResize = useCallback((resizeInfo) => {
    const { event } = resizeInfo;
    if (!event.start || !event.end) return;
    moveEvent(parseInt(event.id), event.start, event.end);
  }, [moveEvent]);

  const handleEventDidMount = useCallback((info) => {
    const el = info.el;
    const eventId = parseInt(info.event.id);
    const onCtx = (e) => { e.preventDefault(); removeEvent(eventId); };
    el.addEventListener('contextmenu', onCtx);
    const onMove = (e) => {
      if (resizeRef.current) return;
      const rect = el.getBoundingClientRect();
      const zone = Math.min(rect.width * 0.2, 18);
      const x = e.clientX - rect.left;
      if (x < zone) el.style.cursor = 'w-resize';
      else if (x > rect.width - zone) el.style.cursor = 'e-resize';
      else el.style.cursor = 'grab';
    };
    const onDown = (e) => {
      const rect = el.getBoundingClientRect();
      const zone = Math.min(rect.width * 0.2, 18);
      const x = e.clientX - rect.left;
      let edge = null;
      if (x < zone) edge = 'start';
      else if (x > rect.width - zone) edge = 'end';
      if (edge) {
        e.preventDefault(); e.stopPropagation();
        const evData = eventsRef.current.find(ev => ev.id === eventId);
        resizeRef.current = { eventId, edge, origStart: info.event.start, origEnd: info.event.end, _event: evData ? { ...evData } : { id: eventId, title: info.event.title, start: info.event.start, end: info.event.end } };
      }
    };
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mousedown', onDown);
    return () => { el.removeEventListener('contextmenu', onCtx); el.removeEventListener('mousemove', onMove); el.removeEventListener('mousedown', onDown); };
  }, [removeEvent]);

  const handleEventMouseEnter = useCallback((info) => showTooltip(info), [showTooltip]);
  const handleEventMouseLeave = useCallback(() => hideTooltip(), [hideTooltip]);
  const handleModalSave = useCallback((data) => {
    if (data.id) editEvent(data.id, data); else addEvent(data);
  }, [addEvent, editEvent]);

  // ── 格子背景着色 ──
  const applyCellColors = useCallback(() => {
    const cells = document.querySelectorAll('.fc-daygrid-day[data-date]');
    cells.forEach(cell => {
      const ds = cell.getAttribute('data-date');
      const count = densityMap.get(ds) || 0;
      if (count > 0) {
        const c = colorForOverlap(count);
        cell.style.setProperty('background-color', `hsl(${c.h},${c.s}%,${c.l}%,0.28)`, 'important');
      } else {
        cell.style.setProperty('background-color', '', 'important');
      }
    });
  }, [densityMap]);

  // 首次挂载着色
  const handleDayCellDidMount = useCallback((info) => {
    const ds = info.el.getAttribute('data-date');
    const count = ds ? (densityMap.get(ds) || 0) : 0;
    if (count > 0) {
      const c = colorForOverlap(count);
      info.el.style.backgroundColor = `hsl(${c.h},${c.s}%,${c.l}%,0.28)`;
    } else {
      info.el.style.backgroundColor = '';
    }
  }, [densityMap]);

  // 事件变化时实时更新所有格子
  useEffect(() => {
    applyCellColors();
    // FullCalendar 可能异步渲染，加延迟兜底
    const t1 = setTimeout(() => applyCellColors(), 50);
    const t2 = setTimeout(() => applyCellColors(), 200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [applyCellColors]);

  // ═══════════════ 自定义事件渲染 ═══════════════
  const renderEventContent = useCallback((eventInfo) => {
    const isGhost = eventInfo.event.extendedProps?._ghost;
    const isCreate = eventInfo.event.extendedProps?._create;
    const c = colorForOverlap(1);

    if (isGhost) {
      return (
        <div className={`ec-event-content ${isCreate ? 'ec-event-create' : 'ec-event-ghost'}`}
          style={{
            background: isCreate
              ? `linear-gradient(135deg, ${c.bg}66, ${c.bg}33)`
              : `repeating-linear-gradient(45deg, ${c.bg}44, ${c.bg}44 4px, ${c.bg}22 4px, ${c.bg}22 8px)`,
            color: c.text, borderRadius: '6px', padding: '2px 6px',
            height: '100%', overflow: 'hidden', opacity: 0.7,
            outline: !isCreate ? '2px dashed rgba(255,255,255,0.6)' : 'none',
            outlineOffset: '-2px',
            boxShadow: isCreate ? '0 0 12px rgba(92,107,192,0.4)' : 'none',
          }}>
          <div className="ec-event-time">{eventInfo.timeText}</div>
          <div className="ec-event-title-row"><span className="ec-event-title">{eventInfo.event.title}</span></div>
        </div>
      );
    }

    const isMultiDay = eventInfo.event.start.toDateString() !== eventInfo.event.end.toDateString();
    const tagKey = eventInfo.event.extendedProps?.tag;
    const tagInfo = tagKey ? TAG_PALETTE[tagKey] : null;

    return (
      <div className="ec-event-content"
        style={{ borderRadius: '6px', padding: isMultiDay ? '3px 8px' : '2px 6px', height: '100%', overflow: 'hidden' }}>
        <div className="ec-event-time">{eventInfo.timeText}</div>
        <div className="ec-event-title-row">
          {tagInfo && <span className="ec-event-tag" style={{ background: tagInfo.dot }} title={tagInfo.label} />}
          <span className="ec-event-title">{eventInfo.event.title}</span>
        </div>
      </div>
    );
  }, [removeEvent]);

  const gradient = useMemo(() => legendGradient(), []);

  return (
    <div className="app-container">
      <Toaster position="bottom-center" richColors closeButton toastOptions={{ duration: 2500, style: { borderRadius: '10px', fontSize: '14px' } }} />

      {/* ── 顶部栏 ── */}
      <div className="header">
        <div className="header-left">
          <h2><Zap size={22} className="header-icon" /> 精力感知日历</h2>
          <span className="header-subtitle">任务密度可视化</span>
        </div>
        <div className="header-search">
          <Search size={15} className="search-icon" />
          <input className="search-input" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="搜索任务..." />
          {searchQuery && <button className="search-clear" onClick={() => setSearchQuery('')}><X size={14} /></button>}
        </div>
        <div className="header-btns">
          {user ? (
            <>
              <button className="add-btn" onClick={() => { setEditingEvent(null); const now = new Date(); setSelectedRange({ start: now, end: new Date(now.getTime() + 3600000) }); setShowModal(true); }}>
                <Plus size={16} /> 添加
              </button>
              <button className="undo-btn" onClick={undo} disabled={history.length <= 1}><Undo2 size={15} /> 撤销</button>
              <button className="theme-btn" onClick={() => setDark(d => !d)} title={dark ? '切换亮色' : '切换暗色'}>
                {dark ? <Sun size={17} /> : <Moon size={17} />}
              </button>
              <span className="header-user">{user.username}</span>
              <button className="logout-btn" onClick={logout} title="退出登录"><LogOut size={14} /></button>
            </>
          ) : (
            <button className="add-btn" onClick={() => setShowLogin(true)}><LogIn size={16} /> 登录</button>
          )}
        </div>
      </div>

      {/* ── 认证状态 ── */}
      {authLoading ? (
        <div className="loading-overlay"><div className="loading-spinner" /><span>登录中...</span></div>
      ) : !user ? (
        <div className="auth-prompt">
          <div className="auth-prompt-card">
            <Zap size={40} />
            <h3>请先登录</h3>
            <p>登录后可以同步你的任务数据</p>
            <button className="add-btn add-btn-lg" onClick={() => setShowLogin(true)}><LogIn size={16} /> 登录 / 注册</button>
          </div>
        </div>
      ) : (
        <>
          {/* ── 图例 ── */}
          <div className="legend">
            <div className="legend-item">
              <span className="legend-label">低压力</span>
              <span className="legend-gradient" style={{ background: gradient }} />
              <span className="legend-label">高压力</span>
            </div>
            <div className="legend-info">
              {searchQuery ? <span>找到 {filteredEvents.length}/{events.length} 个任务</span> : <span>共 {events.length} 个任务</span>}
            </div>
            <div className="legend-hint">右键删除 · 拖拽移动 · 边缘拉伸 · 按 <kbd>N</kbd> 新建</div>
          </div>

          {/* ── 加载中 ── */}
          {loading && <div className="loading-overlay"><div className="loading-spinner" /><span>加载任务数据...</span></div>}

          {/* ── 日历 ── */}
          {!loading && (
            <div className="calendar-wrapper">
              <FullCalendar
                ref={calRef}
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                locale="zh-cn"
                firstDay={1}
                events={(() => {
                  let evs = filteredEvents;
                  if (resizeGhost) evs = evs.map(e => e.id === resizeGhost._eventId ? { ...resizeGhost, id: e.id, _ghost: true, editable: false, startEditable: false, durationEditable: false } : e);
                  if (createGhost) evs = [...evs, { ...createGhost, editable: false, startEditable: false, durationEditable: false }];
                  return evs;
                })()}
                editable={true}
                eventStartEditable={true}
                eventDurationEditable={true}
                eventResizableFromStart={false}
                selectable={true}
                selectMirror={true}
                selectAllow={(info) => {
                  const gs = info.start;
                  const ge = info.allDay || gs.toDateString() !== info.end.toDateString()
                    ? new Date(info.end.getFullYear(), info.end.getMonth(), info.end.getDate() - 1, 18, 0)
                    : new Date(gs.getTime() + 3600000);
                  if (ge <= gs) return true;
                  const gStart = new Date(gs.getFullYear(), gs.getMonth(), gs.getDate(), 9, 0);
                  setCreateGhost(prev => {
                    if (prev && prev.start.getTime() === gStart.getTime() && prev.end.getTime() === ge.getTime()) return prev;
                    return { id: -99, title: '新任务', start: gStart, end: ge, _ghost: true, _create: true };
                  });
                  return true;
                }}
                select={handleSelect}
                unselect={() => setCreateGhost(null)}
                eventClick={handleEventClick}
                eventDrop={handleEventDrop}
                eventResize={handleEventResize}
                eventDidMount={handleEventDidMount}
                eventMouseEnter={handleEventMouseEnter}
                eventMouseLeave={handleEventMouseLeave}
                eventContent={renderEventContent}
                dayCellDidMount={handleDayCellDidMount}
                headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth' }}
                height="100%"
                dayMaxEvents={6}
                eventOrder="start,-duration,title"
              />
            </div>
          )}
        </>
      )}

      {/* ── 悬浮详情 ── */}
      <AnimatePresence>
        {tooltip && (
          <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }} transition={{ duration: 0.15 }}>
            <EventTooltip event={tooltip.event} x={tooltip.x} y={tooltip.y} onMouseEnter={clearHideTooltip} onMouseLeave={hideTooltip} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 弹窗 ── */}
      <AnimatePresence>
        {showModal && (
          <motion.div className="modal-overlay" onClick={() => { setShowModal(false); setEditingEvent(null); setSelectedRange(null); }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            <motion.div onClick={e => e.stopPropagation()} initial={{ scale: 0.9, y: 24, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, y: 24, opacity: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
              <EventModal event={editingEvent} defaultStart={selectedRange?.start} defaultEnd={selectedRange?.end}
                onSave={handleModalSave} onDelete={(id) => removeEvent(id)}
                onClose={() => { setShowModal(false); setEditingEvent(null); setSelectedRange(null); }} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 登录弹窗 ── */}
      <AnimatePresence>
        {showLogin && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <LoginModal onLogin={login} onRegister={register} onClose={() => setShowLogin(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
