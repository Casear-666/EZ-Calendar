# 精力感知日历 (Energy-Aware Calendar) — 项目全貌

## 🎯 项目定位

一款**可视化任务时间密度**的智能日历。传统日历只展示"有什么任务"，本日历回答"哪天忙不忙"——通过动态渐变色实时反映每日任务饱和度，重叠越多颜色越深。

---

## 🚨 关键决策：已从 react-big-calendar 迁移到 FullCalendar

### 为什么迁移

react-big-calendar 存在三个不可接受的缺陷：
1. **工具栏导航失效** — RBC 的 toolbar 按钮在 React 19 + Vite 8 环境下点击无响应，根源是 RBC 内部组件在 prop 变化时重置交互状态
2. **交互全靠手写** — 拖拽移动、边缘拉伸、点击创建全部需要 react-dnd + 坐标解析 + 状态机，一个 `DragEventWrapper` 组件就要处理 mousedown/mousemove/contextmenu 四种事件
3. **社区半死不活** — RBC 长期不更新，React 19 兼容性问题无人修复

FullCalendar v6 是成熟商业级日历库，**原生内置**了 RBC 需要手写的全部交互。

### RBC → FullCalendar 功能映射

| 功能 | RBC 实现方式 | FullCalendar 实现方式 |
|---|---|---|
| 月视图 | `Calendar` + `defaultView="month"` | `FullCalendar` + `initialView="dayGridMonth"` |
| 拖拽移动 | react-dnd `useDrag` + `useDrop` + `DragEventWrapper` (~150行) | `editable={true}` + `eventDrop` 回调 (1行) |
| 边缘拉伸 | `modeRef` + `GhostMonitor` + CSS 边缘检测 (~200行) | `eventResizableFromStart={true}` + `eventResize` 回调 (1行) |
| 点击空白创建 | `useCalendarMouse` 状态机 + `getDateFromPoint` 坐标解析 (~100行) | `selectable={true}` + `select` 回调 (2行) |
| 自定义事件外观 | `eventPropGetter` | `eventContent` 自定义渲染函数 |
| 工具栏导航 | RBC 内置 (已失效) | `headerToolbar` 配置 (原生稳定) |
| 中文支持 | moment locale | `locale="zh-cn"` 含中文工具栏 |

### 删除的模块（被 FullCalendar 替代）

```
src/components/DragPreview.jsx      — FullCalendar 自带拖拽预览
src/components/GhostMonitor.jsx     — FullCalendar 自带拉伸预览
src/components/DragEventWrapper.jsx — FullCalendar 自带事件交互
src/components/DropTarget.jsx       — FullCalendar 自带放置处理
src/hooks/useCalendarMouse.js       — FullCalendar select 回调替代
```

---

## ⭐ 保留并强化的创新点

### 1. 动态渐变重叠着色系统
FullCalendar 只负责交互，**重叠着色完全由我们自己的 `colors.js` 引擎驱动**。

**算法**：HSL 连续色谱插值，5 个关键色阶点（绿→黄→橙→红），支持任意重叠数 N。通过 `eventContent` 自定义渲染注入事件条的背景色。

```
n=1 → hsl(120,55%,43%)  绿色 — 无压力
n=2 → hsl(48,80%,48%)   琥珀色
n=3 → hsl(28,85%,48%)   橙色
n=5 → hsl(8,80%,44%)    深橙
n=8+ → hsl(2,78%,38%)   深红 — 高压力
```

**微渐变质感**：每个事件条叠加 `linear-gradient(180deg, top, bottom)` 同色深浅过渡。

### 2. 扫线算法重叠检测 (Sweep-Line O(n log n))
保留 `utils/calendar.js` 中的 `calcOverlap`，用于 `overlapMap` 预计算。每次渲染前批量计算所有事件的重叠等级，`eventContent` 直接查表获取颜色。

### 3. 新建/编辑弹窗
保留 `components/EventModal.jsx`，支持新建和编辑两种模式（标题 + 描述 + 开始/结束时间）。FullCalendar 的 `select` 回调触发新建，`eventClick` 触发编辑。

### 4. Ctrl+Z 撤销
保留 `hooks/useEvents.js` 中的 30 步撤销历史栈。

### 5. API 持久化 + 乐观更新 + 防抖
后端 Express API (`server/`) 和前端 API 服务层 (`src/api.js`) 完整保留。拖拽松手 → 乐观更新 UI → 300ms 防抖 → PATCH 持久化。

---

## 🏗️ 技术栈

```
前端: React 19 + Vite 8
日历: FullCalendar v6 (@fullcalendar/react + daygrid + interaction)
样式: FullCalendar CSS + 自定义 App.css
状态: React Hooks (useState/useCallback/useMemo/useRef)
后端: Express 4 + mysql2
数据库: MySQL 8.0 (Docker)
工具: moment.js (日期处理) + cors (跨域)
```

---

## 📁 文件结构（迁移后）

```
energy-calendar/
├── index.html                     ← 含 FullCalendar CDN CSS 兜底
├── src/
│   ├── App.jsx                    ← 主编排层 (~130行)
│   ├── App.css                    ← 自定义样式（覆盖 FullCalendar）
│   ├── main.jsx                   ← React 入口
│   ├── index.css                  ← 全局 reset
│   ├── colors.js                  ← 动态重叠着色引擎
│   ├── api.js                     ← API 服务层 + 防抖队列
│   ├── utils/
│   │   └── calendar.js           ← calcOverlap 扫线算法
│   ├── hooks/
│   │   └── useEvents.js          ← 状态管理 + CRUD + 撤销 + API
│   └── components/
│       └── EventModal.jsx         ← 新建/编辑弹窗
├── server/
│   ├── index.js                   ← Express API (5 端点)
│   ├── db.js                      ← MySQL 连接池 (utf8mb4)
│   └── schema.sql                 ← 建表脚本
├── docker-compose.yml             ← MySQL + Adminer 容器
├── package.json
└── vite.config.js
```

---

## 🎨 FullCalendar 组件交互规范

### 事件数据格式

```js
{
  id: 1,
  title: "团队周会",
  start: "2026-06-01T09:00:00",
  end: "2026-06-01T10:00:00",
  description: "每周一例会",
  backgroundColor: "hsl(120,55%,43%)",  // 由 overlapMap 注入
  textColor: "#fff",
}
```

### Calendar 组件配置

```jsx
<FullCalendar
  plugins={[dayGridPlugin, interactionPlugin]}
  initialView="dayGridMonth"
  locale="zh-cn"
  events={allDisplayEvents}
  editable={true}
  selectable={true}
  select={handleSelect}              // 空白区拖拽/点击 → 新建任务
  eventClick={handleEventClick}      // 点击事件 → 编辑弹窗
  eventDrop={handleEventDrop}        // 拖拽移动 → 更新时间
  eventResize={handleEventResize}    // 边缘拉伸 → 更新时间
  eventContent={renderEventContent}  // 自定义渲染 → 重叠色注入
  headerToolbar={{                   // 自定义工具栏
    left: 'prev,next today',
    center: 'title',
    right: 'dayGridMonth,timeGridWeek,timeGridDay'
  }}
  height="100%"
/>
```

### 交互回调映射

| 用户操作 | FullCalendar 回调 | 处理逻辑 |
|---|---|---|
| 点击空白格 | `select` → `{start, end, allDay}` | 单日=1h任务 / 跨天=9-18任务 |
| 点击事件 | `eventClick` → `{event}` | 打开编辑弹窗 |
| 拖拽事件 | `eventDrop` → `{event, oldEvent}` | 乐观更新 + 防抖持久化 |
| 拉伸事件 | `eventResize` → `{event, oldEvent}` | 乐观更新 + 防抖持久化 |
| 右键事件 | `eventContent` 中绑定 `onContextMenu` | 删除确认 |

---

## ⚡ 性能约束（红线）

1. **拖拽零网络请求** — 拖拽/拉伸过程中不调用 API，纯前端计算
2. **仅在松手时持久化** — `eventDrop` / `eventResize` 回调才发请求
3. **乐观更新** — 先更新 UI → 异步发请求 → 失败回滚
4. **防抖合并** — `debouncedUpdateTime()` 300ms 窗口合并同一任务多次拖拽
5. **overlapMap 缓存** — useMemo 预计算所有重叠等级，eventContent 只查表不计算

---

## 🎨 前端视觉优化计划

### 迁移时同步实施

| 优化项 | 实现方式 |
|---|---|
| 事件条圆角 + 微阴影 | CSS `border-radius: 6px` + `box-shadow` |
| 悬停浮起效果 | `transform: translateY(-1px)` 过渡动画 |
| 动态行高 | CSS Flex 均分行高，适应窗口 |
| 今天高亮 | `::before` 伪元素左边框指示器 |
| 渐变色图例 | 渐变色条取代固定三色圆点 |
| 工具栏中文化 | `zh-cn` locale，显示 "‹ 2026年6月 ›" |

### 后续迭代

| 优化项 | 说明 |
|---|---|
| 暗色模式 | CSS 变量 + `prefers-color-scheme` |
| 事件进场动画 | `@keyframes` 滑动淡入 |
| 周/日视图时间轴 | FullCalendar timeGrid 原生支持 |
| 属性标签系统 | 事件上显示标签色条（如"紧急"红色标记） |
| 搜索筛选栏 | 头部搜索框 + 关键词高亮 |

---

## 🖥️ 后端 API 契约（不变）

| 方法 | 端点 | 请求体 | 用途 |
|---|---|---|---|
| `GET` | `/api/tasks` | — | 获取全部任务 |
| `POST` | `/api/tasks` | `{title, start, end, description}` | 创建 |
| `PATCH` | `/api/tasks/:id` | `{title, start, end, description}` | 全量更新 |
| `PATCH` | `/api/tasks/:id/time` | `{start, end}` | 精准时间更新 |
| `DELETE` | `/api/tasks/:id` | — | 删除 |

---

## 🚀 启动方式

```bash
# 1. Docker
docker compose up -d             # MySQL + Adminer

# 2. 后端
npm run server                   # → localhost:3001

# 3. 前端
npm run dev                      # → localhost:5173
```

---

## 🔑 开发原则

- **库做交互，我做着色** — FullCalendar 管拖拽/选择/导航，我们只管重叠色注入
- **数据层独立** — `useEvents` hook 不感知日历库，只管理 events 数组
- **着色层独立** — `colors.js` 是纯函数引擎，输入 N → 输出颜色
- **乐观优先** — 所有写操作先更新本地状态，再异步持久化
- **善用 useMemo** — `overlapMap`、`allDisplayEvents`、`calendarComponents` 全部缓存
