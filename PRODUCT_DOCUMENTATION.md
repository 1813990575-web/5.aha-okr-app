# Aha OKR 产品技术文档

## 一、产品概述

Aha OKR 是一款 macOS 风格的桌面 OKR 管理应用，采用三栏式布局设计，将目标管理（OKR）与每日待办（Daily Tasks）无缝结合，帮助用户实现从战略目标到日常执行的完整工作流。

---

## 二、界面布局与功能模块

### 2.1 整体布局结构

应用采用经典的三栏式布局：

```
┌─────────────────────────────────────────────────────────────────┐
│  [左侧面板]        │  [中间面板]           │  [右侧面板]        │
│  宽度: 200-500px   │  自适应宽度           │  宽度: 250-500px   │
│  默认: 380px       │  最小: 400px          │  默认: 300px       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  • OKR 目标目录    │  • 日历周历导航       │  (预留扩展区域)    │
│  • 分层级展示      │  • 每日待办列表       │                    │
│  • 拖拽支持        │  • 进度追踪           │                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 左侧面板 - OKR 目标目录

#### 功能概述
左侧面板是 OKR 管理的核心区域，采用树形结构展示目标体系。

#### 层级结构
- **O (Objective) - 目标**: 一级目标，使用圆形图标，支持展开/收起
- **KR (Key Result) - 关键结果**: 二级指标，使用三角形图标
- **TODO - 任务**: 三级执行项，使用圆形勾选图标

#### 顶部控制区
- **分段控制器 (SegmentedControl)**: 提供三个视图模式
  - "目标" - 仅展开所有 O
  - "关键结果" - 展开 O 和 KR
  - "全部" - 展开 O、KR 和 TODO
- **添加目标按钮**: 在目录顶部创建新的 Objective

#### 交互功能
1. **展开/收起**: 点击 O 或 KR 旁的图标可展开/收起子项
2. **选中高亮**: 点击任意项会高亮显示，并触发中间面板联动
3. **双击编辑**: 双击标题进入编辑模式
4. **右键菜单**:
   - Objective: 标记颜色、新建子级、删除
   - KR: 新建子级、删除
   - TODO: 加入今日待办、删除
5. **键盘快捷键**:
   - Enter: 创建同级项
   - Escape: 取消编辑
6. **拖拽功能**: TODO 项可拖拽至中间面板

#### 视觉设计
- **颜色标记**: Objective 支持 5 种主题色（橄榄绿、群青、蓝色、紫色、棕色）+ 默认
- **层级缩进**: 三级缩进体系，视觉层次清晰
- **连接线**: KR 与 TODO 之间显示灰色竖线表示层级关系
- **玻璃质感**: 选中状态使用毛玻璃效果

#### 底部区域
- **主题选择器**: 切换侧边栏背景主题
- **用户信息**: 显示用户头像和邮箱
- **版本号**: 显示应用版本

### 2.3 中间面板 - 每日待办

#### 功能概述
中间面板是日常任务管理的核心区域，以日期为维度展示待办事项。

#### 顶部区域
- **日期标题**: 显示当前选中的日期（如：3月30日 周一）
- **日历按钮**: 打开日期选择器弹窗
- **回到今天**: 当选择非今天日期时显示，快速返回今天

#### 周历导航
- **左右箭头**: 切换周历视图
- **七天日期**: 显示周日到周六的日期卡片
  - 今天日期显示红色
  - 选中日期显示灰色背景
  - 有内容的日期显示黑色指示点
- **时间进度条**: 显示当天时间流逝进度（百分比 + 剩余小时数）

#### 待办列表
- **任务项**: 显示任务内容、完成状态、关联信息
- **任务输入框**: 列表底部，用于添加新任务

#### 任务项结构
```
[勾选框] [关联信息标签] [任务内容]
```

- **勾选框样式**:
  - OKR 派生任务: 正圆形，边框颜色继承 KR 颜色
  - 手动创建任务: 圆角矩形，灰色边框
- **关联信息**: 显示关联的 KR 标题（最多10字），使用主题色
- **任务内容**: 灰色文字，单行显示，过长截断

#### 交互功能
1. **点击勾选**: 切换完成状态
2. **双击编辑**: 编辑任务内容
3. **右键菜单**:
   - 移至今日（仅过去日期显示）
   - 删除
4. **点击联动**: 点击 OKR 派生任务会联动左侧选中对应项并滚动
5. **拖拽接收**: 可接收左侧拖拽过来的 TODO 项

### 2.4 右侧面板 - 时间线（预留）

目前为空白面板，预留用于未来扩展：
- 时间线视图
- 统计分析
- 专注时长记录

---

## 三、面板间联动机制

### 3.1 左侧 → 中间

#### 联动方式 1: 右键"加入今日待办"
1. 在左侧 TODO 项上右键
2. 选择"加入今日待办"
3. 中间面板立即显示新任务（置顶 + 高亮动画）

#### 联动方式 2: 拖拽
1. 在左侧 TODO 项上按住拖拽手柄
2. 拖拽至中间面板区域
3. 释放后创建今日待办任务

### 3.2 中间 → 左侧

#### 联动方式: 点击任务联动
1. 点击中间面板的 OKR 派生任务
2. 左侧自动展开该任务所属的 O 和 KR
3. 左侧自动滚动到对应 TODO 项并高亮
4. 中间面板该任务显示选中状态

### 3.3 状态同步

#### 完成状态双向同步
- 在中间面板勾选 OKR 派生任务 → 同步更新左侧 TODO 状态
- 在左侧勾选 TODO → 中间面板对应任务状态同步更新

---

## 四、数据模型

### 4.1 OKR 数据模型 (Item)

```typescript
interface Item {
  id: string              // 唯一标识
  type: 'O' | 'KR' | 'TODO'  // 类型
  parent_id: string | null   // 父级ID
  title: string           // 标题
  content: string         // 内容
  status: number          // 状态 (0=未完成, 1=已完成)
  sort_order: number      // 排序
  total_focus_time: number   // 专注时长
  color?: string | null   // 主题色
  created_at: string      // 创建时间
  updated_at: string      // 更新时间
}
```

### 4.2 每日待办数据模型 (DailyTask)

```typescript
interface DailyTask {
  id: string              // 唯一标识
  content: string         // 内容
  isDone: boolean         // 是否完成
  date: string            // 日期 (YYYY-MM-DD)
  linkedGoalId: string | null  // 关联的 OKR 项ID
  origin?: string | null  // 来源 ('okr' | 'manual')
  color?: string | null   // 主题色
  created_at: string      // 创建时间
  updated_at: string      // 更新时间
}
```

### 4.3 数据关系

```
Objective (O)
    ├── KeyResult (KR) 1
    │       ├── TODO 1.1
    │       └── TODO 1.2
    └── KeyResult (KR) 2
            └── TODO 2.1

DailyTask ──linkedGoalId──→ TODO (或 KR)
```

---

## 五、技术架构

### 5.1 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 框架 | React 18 | UI 框架 |
| 语言 | TypeScript | 类型安全 |
| 样式 | Tailwind CSS | 原子化 CSS |
| 动画 | Framer Motion | 交互动画 |
| 拖拽 | @dnd-kit | 拖拽交互 |
| 图标 | Lucide React | 图标库 |
| 桌面 | Electron 25 | 桌面应用框架 |
| 存储 | electron-store | 本地数据存储 |
| 构建 | Vite | 构建工具 |

### 5.2 项目结构

```
src/
├── App.tsx                    # 根组件，状态管理中枢
├── main.tsx                   # 入口文件
├── components/
│   ├── Sidebar.tsx            # 左侧面板
│   ├── MainBoard.tsx          # 中间面板
│   ├── Timeline.tsx           # 右侧面板
│   ├── ResizableLayout.tsx    # 三栏布局容器
│   ├── SegmentedControl.tsx   # 分段控制器
│   ├── SidebarThemeSelector.tsx   # 主题选择器
│   ├── VersionDisplay.tsx     # 版本显示
│   ├── daily/                 # 每日待办组件
│   │   ├── CalendarHeader.tsx # 日历头部
│   │   ├── DatePicker.tsx     # 日期选择器
│   │   ├── TaskItem.tsx       # 任务项
│   │   └── TaskInput.tsx      # 任务输入
│   └── dnd/                   # 拖拽相关组件
│       ├── DragProvider.tsx   # 拖拽上下文
│       ├── DroppableMainBoard.tsx # 拖放区域
│       ├── DraggableTodoItem.tsx  # 可拖拽项
│       └── DraggableSidebarItem.tsx
├── contexts/
│   └── SidebarThemeContext.tsx    # 侧边栏主题上下文
├── hooks/
│   └── useDatabase.ts         # 数据库操作 Hook
├── store/
│   └── index.ts               # 数据存储层
└── types/
    └── electron.d.ts          # Electron API 类型定义
```

### 5.3 状态管理

#### 全局状态 (App.tsx)
- `activeObjective`: 当前选中的 OKR 项ID
- `tasks`: 当前日期的待办列表
- `selectedDate`: 当前选中的日期
- `highlightedTaskId`: 高亮显示的任务ID
- `sidebarRefreshTrigger`: 侧边栏刷新触发器
- `shouldScrollToActive`: 是否自动滚动到选中项

#### 局部状态
- **Sidebar**: 展开状态 (expandedIds)、编辑状态 (editingId)
- **MainBoard**: 日期选择器开关、选中任务ID
- **useDatabase Hook**: 所有 OKR 数据、加载状态

### 5.4 数据流

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  用户操作    │────→│  UI 组件    │────→│  App State  │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                               ↓
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  UI 更新    │←────│  状态更新   │←────│  Electron   │
└─────────────┘     └─────────────┘     │    API      │
                                        └─────────────┘
                                               │
                                               ↓
                                        ┌─────────────┐
                                        │  JSON 文件  │
                                        │  (db.json)  │
                                        └─────────────┘
```

### 5.5 核心交互逻辑

#### 展开/收起机制
- 使用 `expandedIds` Set 存储展开状态
- 完全由用户手动控制，不受视图模式限制
- 视图模式仅作为"一键重置"触发器

#### 选中联动机制
```typescript
// 中间面板点击任务
handleTaskClick(task) {
  if (task.linkedGoalId) {
    setActiveObjective(task.linkedGoalId)  // 设置选中
    setShouldScrollToActive(true)          // 标记需要滚动
    expandAncestors(task.linkedGoalId)     // 展开父级
  }
}

// 左侧监听变化并滚动
useEffect(() => {
  if (shouldScrollToActive) {
    element.scrollIntoView({ behavior: 'smooth' })
  }
}, [shouldScrollToActive, activeObjective])
```

#### 拖拽机制
- 使用 @dnd-kit 实现
- TODO 项作为 draggable
- 中间面板作为 droppable
- 释放时创建 DailyTask 并关联 linkedGoalId

---

## 六、存储方案

### 6.1 存储介质
使用 `electron-store` 将数据持久化到本地 JSON 文件：
- **路径**: `~/Library/Application Support/AhaOKR/data/db.json`
- **格式**: JSON，包含 `items` 和 `dailyTasks` 两个数组

### 6.2 数据结构示例

```json
{
  "items": [
    {
      "id": "uuid-1",
      "type": "O",
      "parent_id": null,
      "title": "提升产品用户体验",
      "content": "",
      "status": 0,
      "sort_order": 0,
      "total_focus_time": 0,
      "color": "blue",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "dailyTasks": [
    {
      "id": "uuid-2",
      "content": "设计用户调研问卷",
      "isDone": false,
      "date": "2024-03-30",
      "linkedGoalId": "uuid-xxx",
      "origin": "okr",
      "color": "#2A5FA7",
      "created_at": "2024-03-30T08:00:00Z",
      "updated_at": "2024-03-30T08:00:00Z"
    }
  ]
}
```

### 6.3 数据操作

所有数据操作通过 Electron IPC 暴露的 API 进行：

```typescript
window.electronAPI = {
  database: {
    init(): Promise<{ success: boolean }>
    getAllItems(): Promise<Item[]>
    getObjectives(): Promise<Item[]>
    getChildrenByParentId(parentId: string): Promise<Item[]>
    createItem(data: Partial<Item>): Promise<Item>
    updateItem(id: string, updates: Partial<Item>): Promise<Item>
    deleteItem(id: string): Promise<{ success: boolean; deletedIds: string[] }>
    shiftSortOrders(parentId, fromSortOrder, type): Promise<boolean>
  },
  dailyTasks: {
    getTasksByDate(date: string): Promise<DailyTask[]>
    createTask(data: Partial<DailyTask>): Promise<DailyTask>
    updateTask(id: string, updates: Partial<DailyTask>): Promise<DailyTask>
    deleteTask(id: string): Promise<boolean>
    toggleTaskStatus(id: string): Promise<DailyTask>
  }
}
```

---

## 七、特色功能

### 7.1 大纲式编辑体验
- Enter 创建同级项
- Tab 逻辑（通过右键"新建子级"实现）
- 自动聚焦新创建的项
- 全局排序重排

### 7.2 智能联动
- 点击中间任务自动定位左侧
- 状态变更双向同步
- 颜色继承体系（TODO 继承 KR 颜色，KR 继承 O 颜色）

### 7.3 时间感知
- 实时时间进度条
- 过去日期任务可一键移至今日
- 日历小圆点提示有内容的日期

### 7.4 视觉反馈
- 新任务高亮动画
- 拖拽时的视觉提示
- 选中状态的玻璃质感
- 平滑的展开/收起动画

---

## 八、扩展性设计

### 8.1 右侧面板预留
Timeline 组件已预留，可扩展：
- 甘特图视图
- 时间线统计
- 专注时长分析

### 8.2 主题系统
SidebarThemeContext 提供主题切换能力，支持：
- 多种背景主题
- 毛玻璃效果开关
- 暗黑模式适配

### 8.3 插件化存储
store/index.ts 封装了所有数据操作，便于：
- 切换存储介质（如迁移到 SQLite）
- 添加数据迁移逻辑
- 实现数据导入/导出

---

## 九、总结

Aha OKR 是一个将战略目标管理与日常任务执行深度融合的桌面应用。通过三栏式布局、智能联动机制和大纲式编辑体验，实现了从 O → KR → TODO → Daily Task 的完整工作流闭环。

技术层面采用 React + Electron 的现代化栈，配合精细化的状态管理和流畅的动画交互，提供了接近原生应用的桌面体验。
