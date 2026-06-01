/**
 * ShortcutsHelp — 快捷键帮助面板
 * 按 ? 键弹出
 */
import { X, Keyboard } from 'lucide-react';

const SHORTCUTS = [
  { keys: ['N'],         desc: '新建任务' },
  { keys: ['T'],         desc: '回到今天' },
  { keys: ['←', '→'],   desc: '切换月份' },
  { keys: ['Ctrl', 'Z'], desc: '撤销操作' },
  { keys: ['?'],         desc: '显示此帮助' },
];

export default function ShortcutsHelp({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="shortcuts-panel" onClick={e => e.stopPropagation()}>
        <div className="shortcuts-header">
          <div className="shortcuts-title">
            <Keyboard size={18} />
            <h3>快捷键</h3>
          </div>
          <button className="shortcuts-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="shortcuts-list">
          {SHORTCUTS.map((s, i) => (
            <div key={i} className="shortcut-row">
              <div className="shortcut-keys">
                {s.keys.map((k, j) => (
                  <span key={j}>
                    <kbd key={j}>{k}</kbd>
                    {j < s.keys.length - 1 && <span className="shortcut-plus">+</span>}
                  </span>
                ))}
              </div>
              <span className="shortcut-desc">{s.desc}</span>
            </div>
          ))}
        </div>
        <div className="shortcuts-footer">
          提示：在空白区域点击或拖拽即可创建新任务
        </div>
      </div>
    </div>
  );
}
