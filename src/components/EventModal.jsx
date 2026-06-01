/**
 * EventModal — 新建/编辑任务弹窗
 * datetime-local + 快捷时长 + 标签 + 视觉优化
 */
import { useState, useMemo } from 'react';
import { X, Save, Trash2, Clock } from 'lucide-react';
import { TAG_OPTIONS } from '../colors';

const pad = (n) => String(n).padStart(2, '0');

function toLocal(date) {
  if (!date) date = new Date();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function fromLocal(str) {
  if (!str) return new Date();
  const [datePart, timePart] = String(str).split('T');
  if (!datePart || !timePart) return new Date(str);
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0);
}

/** 计算时长文本 */
function durationText(startStr, endStr) {
  const s = fromLocal(startStr);
  const e = fromLocal(endStr);
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s) return '';
  const diffMin = Math.round((e - s) / 60000);
  const days = Math.floor(diffMin / 1440);
  const hrs = Math.floor((diffMin % 1440) / 60);
  const mins = diffMin % 60;
  if (days > 0) return `${days}天${hrs > 0 ? hrs + '小时' : ''}`;
  if (hrs > 0 && mins > 0) return `${hrs}小时${mins}分钟`;
  if (hrs > 0) return `${hrs}小时`;
  return `${mins}分钟`;
}

const QUICK_DURATIONS = [
  { label: '30分钟', add: 30 },
  { label: '1小时', add: 60 },
  { label: '2小时', add: 120 },
  { label: '全天', add: -1 },
];

export default function EventModal({ event, defaultStart, defaultEnd, onSave, onDelete, onClose }) {
  const isEdit = !!event;
  const ds = defaultStart || new Date();
  const de = defaultEnd   || new Date(ds.getTime() + 3600000);

  const initStart = event ? toLocal(event.start) : toLocal(new Date(ds.getFullYear(), ds.getMonth(), ds.getDate(), 9, 0));
  const initEnd   = event ? toLocal(event.end)   : toLocal(new Date(de.getFullYear(), de.getMonth(), de.getDate(), 18, 0));

  const [title, setTitle] = useState(event?.title || '');
  const [desc, setDesc]     = useState('');
  const [startStr, setStartStr] = useState(initStart);
  const [endStr, setEndStr]     = useState(initEnd);
  const [tag, setTag]           = useState(event?.extendedProps?.tag || event?.tag || '');

  const durText = useMemo(() => durationText(startStr, endStr), [startStr, endStr]);

  const applyQuickDuration = (addMin) => {
    const s = fromLocal(startStr);
    if (isNaN(s.getTime())) return;
    if (addMin === -1) {
      // 全天：当天 9:00 → 次日 18:00
      const e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 1, 18, 0);
      setEndStr(toLocal(e));
    } else {
      const e = new Date(s.getTime() + addMin * 60000);
      setEndStr(toLocal(e));
    }
  };

  const handleSubmit = () => {
    const start = fromLocal(startStr);
    const end   = fromLocal(endStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return;
    onSave({
      ...(isEdit ? { id: parseInt(event.id) } : {}),
      title: title.trim() || '新任务',
      start,
      end,
      description: desc.trim(),
      tag: tag || null,
    });
    onClose();
  };

  return (
    <div className="modal event-modal" onClick={e => e.stopPropagation()}>
      {/* header */}
      <div className="modal-header">
        <h3>{isEdit ? '编辑任务' : '新任务'}</h3>
        <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
      </div>

      {/* 标题 */}
      <label>名称</label>
      <input
        className="modal-input"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="任务名称"
        autoFocus
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
      />

      {/* 时间 */}
      <label>时间</label>
      <div className="modal-datetime-row">
        <div className="modal-datetime-col">
          <span className="modal-dt-sub">开始</span>
          <input type="datetime-local" className="modal-input"
            value={startStr} onChange={e => setStartStr(e.target.value)} />
        </div>
        <div className="modal-datetime-col">
          <span className="modal-dt-sub">结束</span>
          <input type="datetime-local" className="modal-input"
            value={endStr} onChange={e => setEndStr(e.target.value)} />
        </div>
      </div>

      {/* 快捷时长 + 时长显示 */}
      <div className="modal-quick-row">
        <div className="modal-quick-btns">
          {QUICK_DURATIONS.map(({ label, add }) => (
            <button key={label} type="button" className="modal-quick-btn"
              onClick={() => applyQuickDuration(add)}>{label}</button>
          ))}
        </div>
        {durText && (
          <span className="modal-duration"><Clock size={12} /> {durText}</span>
        )}
      </div>

      {/* 描述 */}
      <label>描述</label>
      <textarea className="modal-input modal-textarea" value={desc}
        onChange={e => setDesc(e.target.value)} placeholder="可选" rows={2} />

      {/* 标签 */}
      <label>标签</label>
      <div className="modal-tags">
        {TAG_OPTIONS.map(({ key, dot, label }) => (
          <button key={key} type="button"
            className={`modal-tag-btn${tag === key ? ' active' : ''}`}
            style={tag === key ? { borderColor: dot, background: dot + '18' } : {}}
            onClick={() => setTag(tag === key ? '' : key)}>
            <span className="tag-dot" style={{ background: dot }} />{label}
          </button>
        ))}
      </div>

      {/* buttons */}
      <div className="modal-buttons">
        {isEdit && (
          <button className="btn-delete" onClick={() => { onDelete(parseInt(event.id)); onClose(); }}>
            <Trash2 size={15} /> 删除
          </button>
        )}
        <button className="btn-cancel" onClick={onClose}>取消</button>
        <button className="btn-confirm" onClick={handleSubmit}>
          <Save size={15} /> {isEdit ? '保存' : '创建'}
        </button>
      </div>
    </div>
  );
}
