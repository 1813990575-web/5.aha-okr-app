# 设计规范审计（现状盘点）

这个目录不会参与应用运行，只用于辅助制定设计规范。

## 产物

- `data/design-spec.json`：自动抽取的设计 token 与使用位置。
- `index.html`：可视化审计页（可直接双击打开）。
- `assets/current-ui-reference.png`：当前界面参考截图。

## 更新方式

在项目根目录执行：

```bash
node design-audit/generate.mjs
```

然后打开：

```bash
open design-audit/index.html
```

## 内容范围

- 字体与排版（字号/字重/行高/字距/字体族）
- 颜色（Hex/RGBA/HSL/Tailwind 颜色类）
- 间距（padding/margin/gap/space）
- 圆角（rounded 系列、borderRadius/cornerRadius）
- 阴影（shadow 系列、box-shadow、drop-shadow）
- 图标（lucide-react）

## 定位方式

每个 token 都带有“使用位置 chip”（文件+行号），鼠标悬浮可查看定位卡（代码缩略信息），用于快速回到原文件定位。
