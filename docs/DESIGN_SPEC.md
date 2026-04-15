# Aha-OKR 设计规范

## 1. 目标

这份规范不是为了记录历史上出现过的所有颜色和字号，而是为了把当前界面收敛成一套可维护、可复用的设计语言。

当前收敛原则：

- 黑色只保留两种核心语义
- 灰色按用途分层，不再按感觉随意新增
- 文字层级收敛为少量固定等级
- 新界面优先使用语义 token，而不是直接写十六进制颜色

规范源文件：

- [src/index.css](/Users/aha/mine-apps/5.Aha-OKR%202%202/src/index.css)

## 2. 字体规范

### 2.1 字体族

- 主字体：`var(--font-apple)`
- 实际栈：`-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'PingFang SC', 'Hiragino Sans GB', 'Helvetica Neue', sans-serif`

结论：

- 当前产品不需要混入第二套标题字体
- 所有正文、标题、按钮、说明文字统一走这一套系统字体

### 2.2 文字层级

当前建议只保留以下几级：

#### 一级标题

- token / class：`--type-title-size` / `.typo-title-heading`
- 用途：
  - 页面主标题
  - 大型弹层标题
  - 强视觉入口标题

#### 二级标题

- token / class：`--type-card-title-size` / `.typo-card-title` / `.typo-card-title-bold`
- 用途：
  - 卡片标题
  - 分栏标题
  - 内容区主模块标题

#### 三级标题 / 强调正文

- token / class：`--type-body-emphasis-size` / `.typo-body-emphasis`
- 用途：
  - 日期标题
  - 小型模块主文案
  - 需要比正文更醒目的短文本

#### 正文

- token / class：`--type-body-size` / `.typo-body`
- 用途：
  - 长段文本
  - 记录内容
  - 面板主体文案

#### 行内正文 / 控件文字

- token / class：`--type-link-size` / `.typo-link`
- 用途：
  - todo 行文本
  - 按钮说明
  - 次级信息

#### 标签 / 微文案

- token / class：`--type-label-size` / `.typo-label`
- 用途：
  - 周几
  - 小标签
  - 轻量状态说明

#### 辅助信息

- token / class：`--type-micro-size` / `.typo-micro`
- 用途：
  - 时间戳
  - placeholder
  - helper text

### 2.3 不建议继续使用的文字问题

以下情况应尽量避免：

- 同一个区域混用 `14px`、`15px`、`17px` 但语义并不不同
- 用 `font-medium` 和 `font-semibold` 做“假层级”
- placeholder 和正文颜色过于接近
- 标题和正文都直接写黑色 hex，而不走语义 token

## 3. 颜色规范

### 3.1 主黑色

当前产品只保留两种核心黑色：

#### 文本主黑

- token：`--color-ink-primary`
- 色值：`#2e3137`
- 用途：
  - 页面标题
  - 面板标题
  - 主要阅读文本

#### 深色表面黑

- token：`--color-ink-strong`
- 色值：`#272729`
- 用途：
  - KR 卡片头部
  - 黑色悬浮按钮
  - 深色计时器
  - 深色高强调按钮

约束：

- 如果是“字”，优先判断能否用 `--color-ink-primary`
- 如果是“深底色块”，优先判断能否用 `--color-ink-strong`
- 不再随意新增第三种黑色

### 3.2 灰色层级

灰色只按用途分层：

#### 强次级文字

- token：`--color-ink-secondary`
- 色值：`#313744`
- 用途：
  - todo 主文本
  - 输入框已输入文字
  - 需要比说明文字更清晰的次级文案

#### 标准次级文字

- token：`--color-ink-tertiary`
- 色值：`#5f6673`
- 用途：
  - 次级标题
  - 可交互说明
  - 面板次级按钮文字

#### 弱说明文字

- token：`--color-ink-muted`
- 色值：`#7b7f89`
- 用途：
  - 备注预览
  - 次级说明
  - 辅助状态

#### 图标 / 弱标签灰

- token：`--color-ink-subtle`
- 色值：`#8a91a0`
- 用途：
  - 小图标
  - 小标签
  - 日期点位

#### 占位 / 禁用灰

- token：`--color-ink-disabled`
- 色值：`#9aa1ad`
- 用途：
  - placeholder
  - 空状态弱提示
  - 禁用态文案

### 3.3 白色与表面色

#### 纯白

- token：`--color-white`
- 色值：`#ffffff`
- 用途：
  - 卡片基础底色
  - 深色底上的文字

#### 主卡片面

- token：`--color-surface-card`
- 色值：`#ffffff`
- 用途：
  - 常规卡片
  - 备注浮窗
  - 下拉菜单

#### 页面底色

- token：`--color-surface-canvas`
- 色值：`#fafbfc`
- 用途：
  - 大面积背景
  - 轻底色容器

#### 柔和填充

- token：`--color-surface-soft`
- 色值：`#f5f5f7`
- 用途：
  - 输入框底
  - 低强调卡片
  - 轻灰块

#### 悬浮 / 选中浅灰

- token：`--color-surface-soft-hover`
- 色值：`#f3f5f7`
- 用途：
  - hover row
  - 轻选中态

#### 按压 / 更实的浅灰

- token：`--color-surface-soft-pressed`
- 色值：`#eceef2`
- 用途：
  - 输入器滑轨
  - 弱按钮禁用底
  - 更明确的浅灰填充

#### 全局 hover 填充

- token：`--color-fill-hover`
- 色值：`rgba(132, 141, 154, 0.14)`
- 用途：
  - 侧栏 hover
  - 今日输入浮窗输入器底

### 3.4 边框

#### 软边框

- token：`--color-border-soft`
- 色值：`#e5e5e5`
- 用途：
  - 菜单
  - 白色卡片边界
  - 浅色输入器边界

#### 控件边框

- token：`--color-border-muted`
- 色值：`#c8cbd2`
- 用途：
  - checkbox
  - 小型输入控件边框

### 3.5 高亮 / 反馈色

#### 关系高亮红

- token：`--color-danger`
- 色值：`#F6465D`
- 用途：
  - 关联闪烁态
  - 警示呼吸点

#### 柔和警示红

- token：`--color-danger-muted`
- 色值：`#c26a64`
- 用途：
  - 到期提醒
  - 危险菜单文案

#### 暖提示色

- token：`--color-warn`
- 色值：`#8b7663`
- 用途：
  - 临近截止日
  - 暖色按钮

## 4. 已执行的收敛

本轮已开始把高频界面收敛到统一语言：

- `TaskChatComposer`
- `TaskInput`
- `TaskItem`
- `TaskBoard`
- `CalendarHeader`
- `TodoThreadPopover`

这几处已优先统一：

- 输入框文字颜色
- placeholder 灰度
- 卡片 hover / selected 浅灰
- 黑色按钮 / 深色状态
- 备注浮窗的中性文字和边框

## 5. 后续约束

以后新增界面时，优先遵守下面几条：

1. 不直接新增黑色 hex
2. 不直接新增灰色 hex，先判断现有 token 能否表达
3. 行内文字优先用 `14px`
4. 小说明优先用 `12px`
5. 标题优先走 `.typo-title-heading`、`.typo-card-title`、`.typo-body-emphasis`
6. placeholder 统一比正文更浅，且使用 `--color-ink-disabled`
7. 白底卡片优先搭配 `--color-border-soft`

## 6. 当前仍待第二轮整理

为了避免一次改动过大，以下区域保留到下一轮再继续收敛：

- `Sidebar`
- `ObjectiveBoard` 中仍然零散的一些旧灰色
- `JournalWorkspace`
- `SettingsWorkspace`
- `DatePicker`

这些区域目前不是不能改，而是应在下一轮按模块继续做，不要混在同一轮里大面积扫掉。
