/**
 * EventModal — 新建/编辑任务弹窗
 * 使用 datetime-local + 标签选择器 + lucide 图标
 */
import { useState } from 'react';
import { X, Save, Trash2 } from 'lucide-react';
import { TAG_OPTIONS } from '../colors';

function toLocal(date) {
  if (!date) date = new Date();
  const pad = (n) => String(n).padStart(2, '0');
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

export default function EventModal({ event, defaultStart, defaultEnd, onSave, onDelete, onClose }) {
  const isEdit = !!event;

  const ds = defaultStart || new Date();
  const de = defaultEnd   || new Date(ds.getTime() + 3600000);

  const initStart = event ? toLocal(event.start) : toLocal(new Date(ds.getFullYear(), ds.getMonth(), ds.getDate(), 9, 0));
  const initEnd   = event ? toLocal(event.end)   : toLocal(new Date(de.getFullYear(), de.getMonth(), de.getDate(), 18, 0));

  const [title, setTitle] = useState(event?.title || '');
  const [desc, setDesc]     = useState(event?.description || event?.extendedProps?.description || '');
  const [startStr, setStartStr] = useState(initStart);
  const [endStr, setEndStr]     = useState(initEnd);
  const [tag, setTag]           = useState(event?.extendedProps?.tag || event?.tag || '');

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
      <div className="modal-header">
        <h3>{isEdit ? '编辑任务' : '添加任务'}</h3>
        <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
      </div>

        <label>任务名称</label>
        <input
          className="modal-input"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="输入任务名称"
          autoFocus
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />

        <label>描述</label>
        <textarea className="modal-input modal-textarea" value={desc}
          onChange={e => setDesc(e.target.value)} placeholder="可选描述" rows={2} />

        <div className="modal-datetime-row">
          <div className="modal-datetime-col">
            <label>开始时间</label>
            <input type="datetime-local" className="modal-input"
              value={startStr} onChange={e => setStartStr(e.target.value)} />
          </div>
          <div className="modal-datetime-col">
            <label>结束时间</label>
            <input type="datetime-local" className="modal-input"
              value={endStr} onChange={e => setEndStr(e.target.value)} />
          </div>
        </div>

        <label>标签</label>
        <div className="modal-tags">
          {TAG_OPTIONS.map(({ key, dot, label }) => (
            <button
              key={key}
              type="button"
              className={`modal-tag-btn${tag === key ? ' active' : ''}`}
              style={tag === key ? { borderColor: dot, background: dot + '18' } : {}}
              onClick={() => setTag(tag === key ? '' : key)}
            >
              <span className="tag-dot" style={{ background: dot }} />
              {label}
            </button>
          ))}
        </div>

        <div className="modal-buttons">
          {isEdit && (
            <button className="btn-delete" onClick={() => { onDelete(parseInt(event.id)); onClose(); }}>
              <Trash2 size={15} /> 删除
            </button>
          )}
          <button className="btn-cancel" onClick={onClose}>取消</button>
          <button className="btn-confirm" onClick={handleSubmit}>
            <Save size={15} /> {isEdit ? '保存' : '添加'}
          </button>
        </div>
      </div>
    );
}
