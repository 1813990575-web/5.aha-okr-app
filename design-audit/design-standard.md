# Aha OKR Design Standard (Typography v1)

## 1) 全局字体基线

- 字体栈：`var(--font-apple)`
- 值：`-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'PingFang SC', 'Hiragino Sans GB', 'Helvetica Neue', sans-serif`
- 规则：当前阶段不引入特殊装饰字体。

## 2) 规范字号体系（唯一建议）

| Role | Class | Size |
| --- | --- | --- |
| Display Secondary | `typo-section-heading` | 40px (2.5rem) / 600 / 1.10 |
| Section Heading | `typo-title-heading` | 28px (1.75rem) / 700 / 1.14 |
| Card Title Strong | `typo-card-title-bold` | 21px (1.313rem) / 700 / 1.19 |
| Card Title | `typo-card-title` | 21px (1.313rem) / 400 / 1.19 |
| Body | `typo-body` | 17px (1.063rem) / 400 / 1.47 |
| Body Emphasis | `typo-body-emphasis` | 17px (1.063rem) / 600 / 1.24 |
| Link / Secondary | `typo-link` | 14px (0.875rem) / 400 / 1.43 |
| Micro / Meta | `typo-micro` | 12px (0.75rem) / 400 / 1.33 |

## 3) 执行规则

- 新增文本优先使用 `typo-*` 语义类。
- 在组件内尽量避免新增裸 `text-[xxpx]`。
- 设计审计页统一按 `px (rem)` 展示，避免单位混读。
- 审计页中的“待收敛”项，是后续整改清单。

## 4) 当前状态

- 全局字体统一：已完成。
- 语义类落地：部分完成，仍需迁移。

## 5) 迁移优先级

1. MainBoard（正文、二级信息）
2. Sidebar（列表项、时间/标签）
3. Journal（编辑区、工具条）
4. 其余弹窗和浮层

## 6) 核心底色规范（Color v1）

- `Pure White`: `#ffffff`（主背景 / 高亮底）
- `Light Gray`: `#f5f5f5`（次级 section 背景）
- `Warm Stone`: `#f5f2ef`（核心底色 / 局部面板）
- `Near White`: `#f6f6f6`（替代浅色 surface）

辅助色（用于边框与标签）：

- `Card Border`: `#e2ddd7`
- `Card Border Soft`: `#e8e3de`
- `Badge Bg`: `#ebe6e1`
- `Badge Text`: `#6b625b`

## 7) OKR 分栏卡片配色映射

- 旧方案：紫 / 绿 / 黄强色分栏。
- 新方案：三列统一为同一套中性配色（以原中间列为准），不再按列使用不同底色。
- 关键区块使用色值：`shell #f5f5f5`、`top #f5f5f5 -> #f5f2ef`、`body #fbfaf9`、`badge #ebe6e1 / #6b625b`。
- 以上为纯色或纯渐变，不使用透明度。
- 应用位置：`src/components/ObjectiveBoard.tsx` 的 `KR_CARD_THEMES`。

## 8) Sidebar 面板底色

- 左侧 Sidebar 整体面板底色统一使用 `Warm Stone #f5f2ef`。
- 目标/KR/TODO 行的选中与悬浮反馈仍使用原有交互态，不把底色逻辑绑定到单行状态。
- 应用位置：`src/components/Sidebar.tsx` 的根 `aside` 背景样式。
