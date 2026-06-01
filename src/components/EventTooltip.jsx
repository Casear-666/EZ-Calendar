/**
 * EventTooltip — 事件悬浮详情卡片
 * 简单实现：鼠标跟随 + 视口边缘检测，无外部依赖
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TAG_PALETTE } from '../colors';

function formatDate(d) {
  if (!d) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EventTooltip({ event, x, y, onMouseEnter, onMouseLeave }) {
  const elRef = useRef(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  useEffect(() => {
    if (!elRef.current) return;
    const rect = elRef.current.getBoundingClientRect();
    const gap = 12;
    let left = x + gap;
    let top = y - rect.height - gap;

    // 右边界
    if (left + rect.width > window.innerWidth - 8) {
      left = x - rect.width - gap;
    }
    // 上边界
    if (top < 8) {
      top = y + gap;
    }
    // 左边界
    if (left < 8) left = 8;
    // 下边界
    if (top + rect.height > window.innerHeight - 8) {
      top = window.innerHeight - rect.height - 8;
    }

    setPos({ left, top });
  }, [x, y]);

  if (!event) return null;

  const tagInfo = event.extendedProps?.tag ? TAG_PALETTE[event.extendedProps.tag] : null;
  const startStr = formatDate(event.start);
  const endStr = formatDate(event.end);
  const desc = event.extendedProps?.description || '';

  const tooltip = (
    <div
      ref={elRef}
      className="event-tooltip"
      style={{
        position: 'fixed',
        left: pos.left,
        top: pos.top,
        zIndex: 10000,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="tooltip-title">{event.title}</div>
      <div className="tooltip-time">⏰ {startStr} → {endStr}</div>
      {desc && <div className="tooltip-desc">{desc}</div>}
      {tagInfo && (
        <div className="tooltip-tag" style={{ color: tagInfo.text }}>
          <span className="tooltip-tag-dot" style={{ background: tagInfo.dot }} />
          {tagInfo.label}
        </div>
      )}
    </div>
  );

  return createPortal(tooltip, document.body);
}
