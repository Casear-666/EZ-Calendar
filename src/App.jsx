/**
 * App — 精力感知日历主编排层
 * 集成：FullCalendar + 重叠着色 + 暗色模式 + 搜索 + 快捷键 + 图标 + 悬浮详情 + 动画
 */
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Toaster } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import { useHotkeys } from 'react-hotkeys-hook';
import { Zap, Plus, Undo2, Sun, Moon, Search, X } from 'lucide-react';
import './App.css';
import { colorForOverlap, eventGradient, legendGradient, TAG_PALETTE } from './colors';
import { useEvents } from './hooks/useEvents';
import EventModal from './components/EventModal';
import EventTooltip from './components/EventTooltip';
import ShortcutsHelp from './components/ShortcutsHelp';

export default function App() {
  // ── 数据层（全部从数据库加载，无 demo 数据）──
  const {
    events, filteredEvents, overlapMap, history, searchQuery, setSearchQuery,
    addEvent, editEvent, removeEvent, moveEvent, undo, loading,
  } = useEvents([]);

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

  // ── 悬浮提示（带延迟关闭，防止鼠标移到卡片上就消失）──
  const [tooltip, setTooltip] = useState(null);
  const tooltipTimer = useRef(null);

  const showTooltip = useCallback((info) => {
    clearTimeout(tooltipTimer.current);
    setTooltip({ event: info.event, x: info.jsEvent.clientX, y: info.jsEvent.clientY });
  }, []);
  const hideTooltip = useCallback(() => {
    tooltipTimer.current = setTimeout(() => setTooltip(null), 200);
  }, []);
  const clearHideTooltip = useCallback(() => {
    clearTimeout(tooltipTimer.current);
  }, []);

  // ── 自定义边缘拉伸（参照 energy-calendar 思路：ghost 预览 + 鼠标事件）──
  const resizeRef = useRef(null);       // { eventId, edge, origStart, origEnd }
  const [resizeGhost, setResizeGhost] = useState(null); // 拖拽时的半透明预览事件
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const moveEventRef = useRef(moveEvent);
  moveEventRef.current = moveEvent;

  const getDateFromPoint = useCallback((x, y) => {
    const el = document.elementFromPoint(x, y);
    const cell = el?.closest?.('[data-date]');
    if (cell) {
      const d = new Date(cell.getAttribute('data-date') + 'T00:00:00');
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      const r = resizeRef.current;
      if (!r) return;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      // 实时更新 ghost 预览
      const td = getDateFromPoint(e.clientX, e.clientY);
      if (td) {
        if (r.edge === 'start') {
          const ns = new Date(td);
          ns.setHours(r.origStart.getHours(), r.origStart.getMinutes(), 0, 0);
          if (ns < new Date(r.origEnd)) {
            setResizeGhost({ ...r._event, start: ns, end: new Date(r.origEnd), _ghost: true, _eventId: r.eventId });
          }
        } else {
          const ne = new Date(td);
          ne.setDate(ne.getDate() + 1);
          ne.setHours(r.origEnd.getHours(), r.origEnd.getMinutes(), 0, 0);
          if (ne > new Date(r.origStart)) {
            setResizeGhost({ ...r._event, start: new Date(r.origStart), end: ne, _ghost: true, _eventId: r.eventId });
          }
        }
      }
    };
    const onUp = (e) => {
      const r = resizeRef.current;
      if (!r) return;
      resizeRef.current = null;
      setResizeGhost(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      const td = getDateFromPoint(e.clientX, e.clientY);
      if (!td) return;

      if (r.edge === 'start') {
        const ns = new Date(td);
        ns.setHours(r.origStart.getHours(), r.origStart.getMinutes(), 0, 0);
        if (ns < new Date(r.origEnd)) {
          moveEventRef.current(r.eventId, ns, new Date(r.origEnd));
        }
      } else {
        const ne = new Date(td);
        ne.setDate(ne.getDate() + 1);
        ne.setHours(r.origEnd.getHours(), r.origEnd.getMinutes(), 0, 0);
        if (ne > new Date(r.origStart)) {
          moveEventRef.current(r.eventId, new Date(r.origStart), ne);
        }
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [getDateFromPoint]);

  // ── 快捷键帮助面板 ──
  const [showShortcuts, setShowShortcuts] = useState(false);

  // ── FullCalendar ref ──
  const calRef = useRef(null);

  // ── 快捷键 ──
  useHotkeys('n', (e) => {
    if (e.target.closest('input,textarea')) return;
    e.preventDefault();
    const now = new Date();
    setSelectedRange({ start: now, end: new Date(now.getTime() + 3600000) });
    setEditingEvent(null);
    setShowModal(true);
  }, { enableOnFormTags: false });

  useHotkeys('t', (e) => {
    if (e.target.closest('input,textarea')) return;
    e.preventDefault();
    calRef.current?.getApi().today();
  }, { enableOnFormTags: false });

  useHotkeys('?', (e) => {
    e.preventDefault();
    setShowShortcuts(v => !v);
  });

  // ── FullCalendar 回调 ──
  const handleSelect = useCallback((selectInfo) => {
    const { start, end, allDay } = selectInfo;
    let taskStart, taskEnd;
    if (allDay || start.toDateString() !== end.toDateString()) {
      taskStart = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 9, 0);
      taskEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1, 18, 0);
      if (taskEnd <= taskStart) taskEnd = new Date(taskStart.getTime() + 3600000);
    } else {
      taskStart = new Date(start);
      taskEnd = new Date(start.getTime() + 3600000);
    }
    setSelectedRange({ start: taskStart, end: taskEnd });
    setEditingEvent(null);
    setShowModal(true);
  }, []);

  const handleEventClick = useCallback((clickInfo) => {
    setEditingEvent(clickInfo.event);
    setSelectedRange(null);
    setShowModal(true);
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

  // ── eventDidMount：右键删除 + 边缘检测 → 自定义拉伸 ──
  const handleEventDidMount = useCallback((info) => {
    const el = info.el;
    const eventId = parseInt(info.event.id);

    // --- 右键直接删除 ---
    const onCtx = (e) => {
      e.preventDefault();
      removeEvent(eventId);
    };
    el.addEventListener('contextmenu', onCtx);

    // --- 边缘检测 + 拉伸 ---
    const onMove = (e) => {
      if (resizeRef.current) return; // 拉伸进行中，不改变光标
      const rect = el.getBoundingClientRect();
      const zone = Math.min(rect.width * 0.2, 18);
      const x = e.clientX - rect.left;
      if (x < zone) {
        el.style.cursor = 'w-resize';
      } else if (x > rect.width - zone) {
        el.style.cursor = 'e-resize';
      } else {
        el.style.cursor = 'grab';
      }
    };
    const onDown = (e) => {
      const rect = el.getBoundingClientRect();
      const zone = Math.min(rect.width * 0.2, 18);
      const x = e.clientX - rect.left;
      if (x < zone || x > rect.width - zone) {
        e.preventDefault();
        e.stopPropagation();
        const edge = x < zone ? 'start' : 'end';
        const evData = eventsRef.current.find(ev => ev.id === eventId);
        resizeRef.current = {
          eventId,
          edge,
          origStart: info.event.start,
          origEnd: info.event.end,
          _event: evData ? { ...evData } : { id: eventId, title: info.event.title, start: info.event.start, end: info.event.end },
        };
      }
    };
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mousedown', onDown);

    return () => {
      el.removeEventListener('contextmenu', onCtx);
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mousedown', onDown);
    };
  }, [removeEvent]);

  const handleEventMouseEnter = useCallback((info) => {
    showTooltip(info);
  }, [showTooltip]);

  const handleEventMouseLeave = useCallback(() => {
    hideTooltip();
  }, [hideTooltip]);

  const handleModalSave = useCallback((data) => {
    if (data.id) { editEvent(data.id, data); }
    else { addEvent(data); }
  }, [addEvent, editEvent]);

  // ═══════════════ 自定义事件渲染 ═══════════════
  const renderEventContent = useCallback((eventInfo) => {
    const evId = parseInt(eventInfo.event.id);
    const isGhost = eventInfo.event.extendedProps?._ghost;
    const lv = isGhost ? 1 : (overlapMap.get(evId) || 1);
    const c = colorForOverlap(lv);
    const isMultiDay = eventInfo.event.start.toDateString() !== eventInfo.event.end.toDateString();
    const tagKey = eventInfo.event.extendedProps?.tag;
    const tagInfo = tagKey ? TAG_PALETTE[tagKey] : null;

    return (
      <div
        className={`ec-event-content${isGhost ? ' ec-event-ghost' : ''}`}
        style={{
          background: isGhost
            ? `repeating-linear-gradient(45deg, ${c.bg}44, ${c.bg}44 4px, ${c.bg}22 4px, ${c.bg}22 8px)`
            : eventGradient(c),
          color: c.text,
          borderRadius: '6px',
          padding: isMultiDay ? '3px 8px' : '2px 6px',
          height: '100%', overflow: 'hidden',
          opacity: isGhost ? 0.75 : 1,
          outline: isGhost ? '2px dashed rgba(255,255,255,0.6)' : 'none',
          outlineOffset: '-2px',
        }}
      >
        <div className="ec-event-time">{eventInfo.timeText}</div>
        <div className="ec-event-title-row">
          {tagInfo && (
            <span className="ec-event-tag" style={{ background: tagInfo.dot }} title={tagInfo.label} />
          )}
          <span className="ec-event-title">{eventInfo.event.title}</span>
        </div>
      </div>
    );
  }, [overlapMap, removeEvent]);

  // ── 图例 ──
  const gradient = useMemo(() => legendGradient(), []);

  return (
    <div className="app-container">
      <Toaster position="bottom-center" richColors closeButton
        toastOptions={{ duration: 2500, style: { borderRadius: '10px', fontSize: '14px' } }} />

      {/* ── 顶部栏 ── */}
      <div className="header">
        <div className="header-left">
          <h2><Zap size={22} className="header-icon" /> 精力感知日历</h2>
          <span className="header-subtitle">任务密度可视化</span>
        </div>

        {/* 搜索栏 */}
        <div className="header-search">
          <Search size={15} className="search-icon" />
          <input
            className="search-input"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜索任务..."
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => setSearchQuery('')}><X size={14} /></button>
          )}
        </div>

        <div className="header-btns">
          <button className="add-btn" onClick={() => {
            setEditingEvent(null);
            const now = new Date();
            setSelectedRange({ start: now, end: new Date(now.getTime() + 3600000) });
            setShowModal(true);
          }}>
            <Plus size={16} /> 添加
          </button>
          <button className="undo-btn" onClick={undo} disabled={history.length <= 1}>
            <Undo2 size={15} /> 撤销
          </button>
          <button className="theme-btn" onClick={() => setDark(d => !d)}
            title={dark ? '切换亮色模式' : '切换暗色模式'}>
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </div>

      {/* ── 图例 ── */}
      <div className="legend">
        <div className="legend-item">
          <span className="legend-label">低压力</span>
          <span className="legend-gradient" style={{ background: gradient }} />
          <span className="legend-label">高压力</span>
        </div>
        <div className="legend-info">
          {searchQuery ? (
            <span>找到 {filteredEvents.length}/{events.length} 个任务</span>
          ) : (
            <span>共 {events.length} 个任务</span>
          )}
        </div>
        <div className="legend-hint">
          右键删除 · 拖拽移动 · 边缘拉伸 · 按 <kbd>N</kbd> 新建 · 按 <kbd>?</kbd> 快捷键
        </div>
      </div>

      {/* ── 加载骨架屏 ── */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
          <span>加载任务数据...</span>
        </div>
      )}

      {/* ── 空状态 ── */}
      {!loading && events.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📅</div>
          <h3>还没有任务</h3>
          <p>点击空白格或按 <kbd>N</kbd> 开始创建</p>
          <button className="add-btn" onClick={() => {
            setEditingEvent(null);
            const now = new Date();
            setSelectedRange({ start: now, end: new Date(now.getTime() + 3600000) });
            setShowModal(true);
          }}>
            <Plus size={16} /> 创建第一个任务
          </button>
        </div>
      )}

      {/* ── 日历主体 ── */}
      {!loading && events.length > 0 && (
      <div className="calendar-wrapper">
        <FullCalendar
          ref={calRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locale="zh-cn"
          firstDay={1}
          events={resizeGhost
            ? filteredEvents.map(e => e.id === resizeGhost._eventId ? { ...resizeGhost, id: e.id, _ghost: true } : e)
            : filteredEvents}
          editable={true}
          eventStartEditable={true}
          eventDurationEditable={true}
          eventResizableFromStart={true}
          selectable={true}
          selectMirror={true}
          select={handleSelect}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
          eventDidMount={handleEventDidMount}
          eventMouseEnter={handleEventMouseEnter}
          eventMouseLeave={handleEventMouseLeave}
          eventContent={renderEventContent}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          height="100%"
          dayMaxEvents={6}
          eventOrder="start,-duration,title"
        />
      </div>
      )}

      {/* ── 悬浮详情 ── */}
      <AnimatePresence>
        {tooltip && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.15 }}
          >
            <EventTooltip
              event={tooltip.event}
              x={tooltip.x}
              y={tooltip.y}
              onMouseEnter={clearHideTooltip}
              onMouseLeave={hideTooltip}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 弹窗 ── */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="modal-overlay"
            onClick={() => { setShowModal(false); setEditingEvent(null); setSelectedRange(null); }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <motion.div
              onClick={e => e.stopPropagation()}
              initial={{ scale: 0.9, y: 24, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 24, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <EventModal
                event={editingEvent}
                defaultStart={selectedRange?.start}
                defaultEnd={selectedRange?.end}
                onSave={handleModalSave}
                onDelete={(id) => removeEvent(id)}
                onClose={() => { setShowModal(false); setEditingEvent(null); setSelectedRange(null); }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 快捷键帮助 ── */}
      <AnimatePresence>
        {showShortcuts && (
          <motion.div
            className="modal-overlay"
            style={{ zIndex: 10000 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setShowShortcuts(false)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 12, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.92, y: 12, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <ShortcutsHelp onClose={() => setShowShortcuts(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
