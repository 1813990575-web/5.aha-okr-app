import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
const SRC_DIR = path.join(ROOT, 'src')
const OUT_DIR = path.join(ROOT, 'design-audit')
const OUT_DATA_DIR = path.join(OUT_DIR, 'data')
const OUT_JSON = path.join(OUT_DATA_DIR, 'design-spec.json')
const OUT_HTML = path.join(OUT_DIR, 'index.html')

const SOURCE_EXT = new Set(['.ts', '.tsx', '.css'])

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walk(absolute))
      continue
    }
    const ext = path.extname(entry.name)
    if (SOURCE_EXT.has(ext)) {
      files.push(absolute)
    }
  }
  return files
}

function lineNumberAt(text, index) {
  let line = 1
  for (let i = 0; i < index && i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) line += 1
  }
  return line
}

function normalizeToken(token) {
  return token.replace(/\s+/g, ' ').trim()
}

function createBucket() {
  return new Map()
}

function ensureEntry(bucket, token) {
  if (!bucket.has(token)) {
    bucket.set(token, { token, count: 0, usages: [] })
  }
  return bucket.get(token)
}

function addUsage(bucket, token, usage) {
  const normalized = normalizeToken(token)
  if (!normalized) return
  const entry = ensureEntry(bucket, normalized)
  entry.count += 1
  const usageKey = `${usage.file}:${usage.line}`
  const exists = entry.usages.some((item) => `${item.file}:${item.line}` === usageKey)
  if (!exists && entry.usages.length < 8) {
    entry.usages.push(usage)
  }
}

function tailwindClassToShadow(value) {
  if (!value.startsWith('shadow-[') || !value.endsWith(']')) return null
  return value.slice(8, -1).replaceAll('_', ' ')
}

function tailwindClassToRadius(value) {
  const map = {
    rounded: '0.25rem',
    'rounded-none': '0',
    'rounded-sm': '0.125rem',
    'rounded-md': '0.375rem',
    'rounded-lg': '0.5rem',
    'rounded-xl': '0.75rem',
    'rounded-2xl': '1rem',
    'rounded-3xl': '1.5rem',
    'rounded-full': '9999px',
  }
  if (map[value]) return map[value]
  const arbitrary = value.match(/^rounded-\[(.+)\]$/)
  if (arbitrary) return arbitrary[1]
  return null
}

function tailwindClassToFontSize(value) {
  const map = {
    'text-xs': '0.75rem',
    'text-sm': '0.875rem',
    'text-base': '1rem',
    'text-lg': '1.125rem',
    'text-xl': '1.25rem',
    'text-2xl': '1.5rem',
    'text-3xl': '1.875rem',
    'text-4xl': '2.25rem',
    'text-5xl': '3rem',
    'text-6xl': '3.75rem',
    'text-7xl': '4.5rem',
    'text-8xl': '6rem',
    'text-9xl': '8rem',
  }
  if (map[value]) return map[value]
  const arbitrary = value.match(/^text-\[(.+)\]$/)
  if (arbitrary) return arbitrary[1]
  return null
}

const colorNames = '(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)'
const regex = {
  hexColor: /#(?:[\da-fA-F]{3,8})\b/g,
  colorFunc: /\b(?:rgba?|hsla?)\([^\n\r\)]*\)/g,
  twColorArbitrary: /\b(?:text|bg|border|from|to|via|stroke|fill)-\[[^\]]+\]/g,
  twColorScale: new RegExp(`\\b(?:text|bg|border|from|to|via|stroke|fill)-${colorNames}(?:-\\d{1,3})?(?:\\/\\[[^\\]]+\\]|\\/\\d{1,3})?\\b`, 'g'),
  twFontSize: /\btext-(?:\[[^\]]+\]|xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)\b/g,
  twFontWeight: /\bfont-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black|\[[^\]]+\])\b/g,
  twLineHeight: /\bleading-(?:none|tight|snug|normal|relaxed|loose|\d+|\[[^\]]+\])\b/g,
  twTracking: /\btracking-(?:tighter|tight|normal|wide|wider|widest|\[[^\]]+\])\b/g,
  cssFontFamily: /font-family\s*:\s*([^;]+);?/g,
  jsFontFamilySingle: /fontFamily\s*:\s*'([^']+)'/g,
  jsFontFamilyDouble: /fontFamily\s*:\s*"([^"]+)"/g,
  twSpacing: /\b(?:p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|space-x|space-y)-(?:\[[^\]]+\]|-?\d+(?:\.\d+)?|px)\b/g,
  twRadius: /\brounded(?:-(?:none|sm|md|lg|xl|2xl|3xl|full|\[[^\]]+\]|[trblxy]-[^\s"'`]+))?\b/g,
  jsRadius: /\b(?:borderRadius|cornerRadius)\s*:\s*([^,}\n]+)/g,
  twShadow: /\bshadow(?:-(?:sm|md|lg|xl|2xl|inner|none|\[[^\]]+\]))?\b/g,
  cssBoxShadow: /box-shadow\s*:\s*([^;]+);?/g,
  jsBoxShadowSingle: /boxShadow\s*:\s*'([^']+)'/g,
  jsBoxShadowDouble: /boxShadow\s*:\s*"([^"]+)"/g,
  filterDropShadow: /drop-shadow\([^\)]+\)/g,
}

function collectAllMatches(line, matchers) {
  const matches = []
  for (const matcher of matchers) {
    const found = line.match(matcher)
    if (found) matches.push(...found)
  }
  return matches
}

function safeSnippet(line) {
  return line.trim().slice(0, 180)
}

function parseLucideImports(source) {
  const importRegex = /import\s*\{([\s\S]*?)\}\s*from\s*['"]lucide-react['"]/g
  const icons = []
  let match
  while ((match = importRegex.exec(source)) !== null) {
    const block = match[1]
    const line = lineNumberAt(source, match.index)
    const names = block
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const pure = part.replace(/\s+as\s+\w+$/, '').trim()
        return pure
      })
    for (const name of names) {
      icons.push({ name, line })
    }
  }
  return icons
}

function sortEntries(map) {
  return [...map.values()]
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count
      return a.token.localeCompare(b.token)
    })
}

function htmlEscape(str) {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function normalizeRadiusForPreview(token) {
  const map = {
    rounded: '0.25rem',
    'rounded-none': '0',
    'rounded-sm': '0.125rem',
    'rounded-md': '0.375rem',
    'rounded-lg': '0.5rem',
    'rounded-xl': '0.75rem',
    'rounded-2xl': '1rem',
    'rounded-3xl': '1.5rem',
    'rounded-full': '9999px',
  }
  if (map[token]) return map[token]
  const normal = tailwindClassToRadius(token)
  if (normal) return normal
  return '0.5rem'
}

function normalizeFontSizeForPreview(token) {
  const normal = tailwindClassToFontSize(token)
  return normal || '14px'
}

function usageChipsStatic(usages) {
  return usages.map((usage) => {
    const text = `${usage.file}:${usage.line}`
    const tip = `${usage.file}:${usage.line}\n\n${usage.snippet}`
    return `<span class="usage-chip" data-tip="${htmlEscape(tip)}" data-img="./assets/current-ui-reference.png">${htmlEscape(text)}</span>`
  }).join('')
}

function buildCardStatic(item, section) {
  const token = item.token
  let preview = ''
  if (section === 'colors') {
    const isClassColor = token.startsWith('text-') || token.startsWith('bg-') || token.startsWith('border-')
    const color = isClassColor ? '#e2e8f0' : token
    preview = `<div class="swatch" style="background:${htmlEscape(color)}"></div><div>${htmlEscape(isClassColor ? 'Tailwind 颜色类' : token)}</div>`
  } else if (section === 'shadows') {
    const shadow = token.startsWith('css:') || token.startsWith('style:')
      ? token.replace(/^(css:|style:)/, '')
      : (tailwindClassToShadow(token) || token)
    preview = `<div class="shadow-box" style="box-shadow:${htmlEscape(shadow)}"></div><div>阴影预览</div>`
  } else if (section === 'radius') {
    const radiusToken = token.startsWith('style:') ? token.slice('style:'.length) : token
    const radius = normalizeRadiusForPreview(radiusToken)
    preview = `<div class="radius-box" style="border-radius:${htmlEscape(radius)}"></div><div>R = ${htmlEscape(radius)}</div>`
  } else if (section === 'spacing') {
    const hyphenIndex = token.lastIndexOf('-')
    const tail = hyphenIndex >= 0 ? token.slice(hyphenIndex + 1) : ''
    const raw = tail.startsWith('[') && tail.endsWith(']') ? tail.slice(1, -1) : (tail || '8')
    const numeric = Number.parseFloat(raw)
    const width = Number.isFinite(numeric) ? Math.min(220, Math.max(18, numeric * 5)) : 80
    preview = `<div class="spacing-bar" style="width:${width}px"></div><div>${htmlEscape(raw)}</div>`
  } else if (section === 'icons') {
    preview = `<div class="swatch" style="background:linear-gradient(135deg,#eef2ff,#e0e7ff)"></div><div style="font-family:ui-monospace,Menlo,monospace">&lt;${htmlEscape(token)} /&gt;</div>`
  } else {
    const size = token.startsWith('text-') ? normalizeFontSizeForPreview(token) : '14px'
    preview = `<div style="font-size:${htmlEscape(size)};font-weight:600;line-height:1.4">字体示例 The quick fox 你好</div>`
  }

  return `
        <article class="card" data-token="${htmlEscape(token.toLowerCase())}" data-file="${htmlEscape(item.usages.map((u) => u.file.toLowerCase()).join(' '))}">
          <div class="count">${item.count}次</div>
          <div class="token">${htmlEscape(token)}</div>
          <div class="preview">${preview}</div>
          <div class="usages">${usageChipsStatic(item.usages)}</div>
        </article>
      `
}

function renderStaticSection(list, section) {
  return list.map((item) => buildCardStatic(item, section)).join('')
}

function buildHtml(data) {
  const safeJson = JSON.stringify(data).replaceAll('</script>', '<\\/script>')
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Aha OKR 现状设计规范审计</title>
  <style>
    :root {
      --bg: #f4f6fa;
      --panel: #ffffff;
      --text: #1f2937;
      --muted: #667085;
      --line: #e5e7eb;
      --accent: #4f46e5;
      --chip: #f2f4f7;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif;
      background: linear-gradient(180deg,#f8fafc 0%,#eef2f7 100%);
      color: var(--text);
    }
    .wrap {
      max-width: 1440px;
      margin: 0 auto;
      padding: 28px;
    }
    .hero {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 20px 22px;
      box-shadow: 0 12px 34px rgba(15,23,42,0.08);
      margin-bottom: 20px;
    }
    .hero-row {
      display: flex;
      gap: 16px;
      align-items: flex-start;
      justify-content: space-between;
    }
    .hero-main {
      min-width: 0;
      flex: 1;
    }
    .hero-ref {
      width: 240px;
      flex-shrink: 0;
      border: 1px solid #dbe2ea;
      border-radius: 12px;
      overflow: hidden;
      background: #fff;
      box-shadow: 0 8px 24px rgba(15,23,42,0.1);
    }
    .hero-ref img {
      display: block;
      width: 100%;
      height: auto;
    }
    .hero-ref .cap {
      font-size: 11px;
      color: #667085;
      padding: 6px 8px;
      border-top: 1px solid #e5e7eb;
      background: #f8fafc;
    }
    h1 {
      margin: 0;
      font-size: 28px;
      letter-spacing: -0.02em;
    }
    .meta {
      margin-top: 8px;
      color: var(--muted);
      font-size: 13px;
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }
    .section {
      margin-top: 16px;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 16px;
      box-shadow: 0 8px 22px rgba(15,23,42,0.05);
    }
    .section h2 {
      margin: 2px 0 12px;
      font-size: 18px;
      letter-spacing: -0.01em;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill,minmax(290px,1fr));
      gap: 10px;
    }
    .card {
      border: 1px solid #e7ebf0;
      border-radius: 14px;
      padding: 10px;
      background: #fff;
      min-height: 112px;
      position: relative;
    }
    .token {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      background: #f8fafc;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      display: inline-block;
      padding: 2px 8px;
      margin-bottom: 6px;
      word-break: break-all;
    }
    .count {
      float: right;
      font-size: 11px;
      color: #64748b;
    }
    .preview {
      margin: 6px 0 8px;
      min-height: 32px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: #344054;
    }
    .swatch {
      width: 32px;
      height: 32px;
      border-radius: 10px;
      border: 1px solid rgba(15,23,42,0.12);
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.5);
      flex-shrink: 0;
    }
    .shadow-box {
      width: 76px;
      height: 44px;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
      background: white;
      flex-shrink: 0;
    }
    .radius-box {
      width: 56px;
      height: 36px;
      border: 1px dashed #94a3b8;
      background: #f8fafc;
      flex-shrink: 0;
    }
    .spacing-bar {
      height: 10px;
      border-radius: 99px;
      background: linear-gradient(90deg,#c7d2fe,#6366f1);
      min-width: 18px;
      max-width: 220px;
    }
    .usages {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-top: 6px;
    }
    .usage-chip {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      background: var(--chip);
      border: 1px solid #e5e7eb;
      border-radius: 999px;
      color: #475467;
      padding: 2px 7px;
      cursor: help;
      max-width: 100%;
      text-overflow: ellipsis;
      overflow: hidden;
      white-space: nowrap;
    }
    .legend {
      color: #667085;
      font-size: 12px;
      margin: 2px 0 10px;
    }
    .tooltip {
      position: fixed;
      pointer-events: none;
      z-index: 9999;
      max-width: 420px;
      background: rgba(15,23,42,0.96);
      color: #e2e8f0;
      border: 1px solid rgba(148,163,184,0.25);
      border-radius: 12px;
      padding: 10px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      line-height: 1.45;
      white-space: pre-wrap;
      box-shadow: 0 20px 44px rgba(2,6,23,0.48);
      display: none;
    }
    .tooltip img {
      width: 140px;
      border-radius: 8px;
      border: 1px solid rgba(148,163,184,0.28);
      display: block;
      margin-bottom: 8px;
      opacity: 0.95;
    }
    .toolbar {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-top: 10px;
      flex-wrap: wrap;
    }
    .toolbar input {
      flex: 1;
      min-width: 220px;
      border-radius: 10px;
      border: 1px solid #d0d5dd;
      padding: 9px 10px;
      font-size: 13px;
      outline: none;
    }
    .toolbar input:focus {
      border-color: #818cf8;
      box-shadow: 0 0 0 3px rgba(99,102,241,0.18);
    }
    .stats {
      color: #667085;
      font-size: 12px;
      margin-left: auto;
    }
    @media (max-width: 920px) {
      .wrap { padding: 14px; }
      .grid { grid-template-columns: 1fr; }
      .hero-row {
        flex-direction: column;
      }
      .hero-ref {
        width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="hero">
      <div class="hero-row">
        <div class="hero-main">
          <h1>现状设计规范审计页</h1>
          <div class="meta">
            <span>用途: 盘点当前 UI 实际使用的字体/颜色/间距/圆角/阴影/图标</span>
            <span>来源: <code>src/**/*.ts(x), src/**/*.css</code></span>
          </div>
          <div class="toolbar">
            <input id="search" placeholder="搜索 token 或文件路径，例如: text-[14px] / #8a919c / Sidebar.tsx" />
            <div id="stats" class="stats"></div>
          </div>
        </div>
        <aside class="hero-ref">
          <img src="./assets/current-ui-reference.png" alt="当前页面参考截图" />
          <div class="cap">参考图: 你提供的当前页面截图</div>
        </aside>
      </div>
    </header>

    <section class="section" data-section="typography">
      <h2>字体与排版</h2>
      <div class="legend">包括字号、字重、行高、字距、字体族。</div>
      <div id="typographyGrid" class="grid">${renderStaticSection(data.typography, 'typography')}</div>
    </section>

    <section class="section" data-section="colors">
      <h2>颜色</h2>
      <div class="legend">包括十六进制、rgba/hsl、Tailwind 颜色类。</div>
      <div id="colorsGrid" class="grid">${renderStaticSection(data.colors, 'colors')}</div>
    </section>

    <section class="section" data-section="spacing">
      <h2>间距</h2>
      <div class="legend">包括 padding/margin/gap/space-x/space-y。</div>
      <div id="spacingGrid" class="grid">${renderStaticSection(data.spacing, 'spacing')}</div>
    </section>

    <section class="section" data-section="radius">
      <h2>圆角</h2>
      <div class="legend">包括 rounded 系列与 style 中 borderRadius/cornerRadius。</div>
      <div id="radiusGrid" class="grid">${renderStaticSection(data.radius, 'radius')}</div>
    </section>

    <section class="section" data-section="shadows">
      <h2>阴影</h2>
      <div class="legend">包括 shadow 系列、box-shadow、drop-shadow。</div>
      <div id="shadowsGrid" class="grid">${renderStaticSection(data.shadows, 'shadows')}</div>
    </section>

    <section class="section" data-section="icons">
      <h2>图标</h2>
      <div class="legend">当前以 Lucide 图标为主，展示图标名与使用位置。</div>
      <div id="iconsGrid" class="grid">${renderStaticSection(data.icons, 'icons')}</div>
    </section>
  </div>

  <div id="tooltip" class="tooltip"></div>

  <script>
    const DATA = ${safeJson};

    const state = {
      keyword: ''
    }

    const tooltip = document.getElementById('tooltip')

    function normalizeShadow(token) {
      if (token.startsWith('shadow-[') && token.endsWith(']')) {
        return token.slice(8, -1).replaceAll('_', ' ')
      }
      const map = {
        'shadow': '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
        'shadow-sm': '0 1px 2px rgba(0,0,0,0.08)',
        'shadow-md': '0 4px 6px rgba(0,0,0,0.12)',
        'shadow-lg': '0 10px 15px rgba(0,0,0,0.15)',
        'shadow-xl': '0 20px 25px rgba(0,0,0,0.2)',
        'shadow-2xl': '0 25px 50px rgba(0,0,0,0.25)',
        'shadow-inner': 'inset 0 2px 4px rgba(0,0,0,0.08)',
      }
      return map[token] || token
    }

    function normalizeRadius(token) {
      const map = {
        'rounded': '0.25rem',
        'rounded-none': '0',
        'rounded-sm': '0.125rem',
        'rounded-md': '0.375rem',
        'rounded-lg': '0.5rem',
        'rounded-xl': '0.75rem',
        'rounded-2xl': '1rem',
        'rounded-3xl': '1.5rem',
        'rounded-full': '9999px'
      }
      if (map[token]) return map[token]
      if (token.startsWith('rounded-[') && token.endsWith(']')) {
        return token.slice('rounded-['.length, -1)
      }
      if (token.startsWith('rounded-') && token.includes('-[')) {
        return token.slice(token.indexOf('[') + 1, -1)
      }
      return '0.5rem'
    }

    function normalizeFontSize(token) {
      const map = {
        'text-xs': '0.75rem',
        'text-sm': '0.875rem',
        'text-base': '1rem',
        'text-lg': '1.125rem',
        'text-xl': '1.25rem',
        'text-2xl': '1.5rem',
        'text-3xl': '1.875rem',
        'text-4xl': '2.25rem',
      }
      if (map[token]) return map[token]
      if (token.startsWith('text-[') && token.endsWith(']')) {
        return token.slice('text-['.length, -1)
      }
      return '14px'
    }

    function escapeHtml(str) {
      return str
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;')
    }

    function usageChips(usages) {
      return usages.map((usage) => {
        const text = \`\${usage.file}:\${usage.line}\`
        const tip = \`\${usage.file}:\${usage.line}\n\n\${usage.snippet}\`
        return \`<span class="usage-chip" data-tip="\${escapeHtml(tip)}" data-img="./assets/current-ui-reference.png">\${escapeHtml(text)}</span>\`
      }).join('')
    }

    function buildCard(item, section) {
      const token = item.token
      let preview = ''
      if (section === 'colors') {
        const color = token.startsWith('text-') || token.startsWith('bg-') || token.startsWith('border-') ? null : token
        preview = \`<div class="swatch" style="background:\${color || '#e2e8f0'}"></div><div>\${escapeHtml(color || 'Tailwind 颜色类')}</div>\`
      } else if (section === 'shadows') {
        const shadow = normalizeShadow(token)
        preview = \`<div class="shadow-box" style="box-shadow:\${escapeHtml(shadow)}"></div><div>阴影预览</div>\`
      } else if (section === 'radius') {
        const radius = normalizeRadius(token)
        preview = \`<div class="radius-box" style="border-radius:\${escapeHtml(radius)}"></div><div>R = \${escapeHtml(radius)}</div>\`
      } else if (section === 'spacing') {
        const hyphenIndex = token.lastIndexOf('-')
        const tail = hyphenIndex >= 0 ? token.slice(hyphenIndex + 1) : ''
        const raw = tail.startsWith('[') && tail.endsWith(']') ? tail.slice(1, -1) : (tail || '8')
        const numeric = Number.parseFloat(raw)
        const width = Number.isFinite(numeric) ? Math.min(220, Math.max(18, numeric * 5)) : 80
        preview = \`<div class="spacing-bar" style="width:\${width}px"></div><div>\${escapeHtml(raw)}</div>\`
      } else if (section === 'icons') {
        preview = \`<div class="swatch" style="background:linear-gradient(135deg,#eef2ff,#e0e7ff)"></div><div style="font-family:ui-monospace,Menlo,monospace">&lt;\${escapeHtml(token)} /&gt;</div>\`
      } else {
        const size = token.startsWith('text-') ? normalizeFontSize(token) : '14px'
        preview = \`<div style="font-size:\${escapeHtml(size)};font-weight:600;line-height:1.4">字体示例 The quick fox 你好</div>\`
      }

      return \`
        <article class="card" data-token="\${escapeHtml(token.toLowerCase())}" data-file="\${escapeHtml(item.usages.map((u) => u.file.toLowerCase()).join(' '))}">
          <div class="count">\${item.count}次</div>
          <div class="token">\${escapeHtml(token)}</div>
          <div class="preview">\${preview}</div>
          <div class="usages">\${usageChips(item.usages)}</div>
        </article>
      \`
    }

    function renderSection(targetId, list, section) {
      const target = document.getElementById(targetId)
      target.innerHTML = list.map((item) => buildCard(item, section)).join('')
    }

    function render() {
      renderSection('typographyGrid', DATA.typography, 'typography')
      renderSection('colorsGrid', DATA.colors, 'colors')
      renderSection('spacingGrid', DATA.spacing, 'spacing')
      renderSection('radiusGrid', DATA.radius, 'radius')
      renderSection('shadowsGrid', DATA.shadows, 'shadows')
      renderSection('iconsGrid', DATA.icons, 'icons')

      const keyword = state.keyword.trim().toLowerCase()
      let visible = 0
      const allCards = document.querySelectorAll('.card')
      allCards.forEach((card) => {
        const token = card.getAttribute('data-token') || ''
        const file = card.getAttribute('data-file') || ''
        const matched = !keyword || token.includes(keyword) || file.includes(keyword)
        card.style.display = matched ? '' : 'none'
        if (matched) visible += 1
      })
      document.getElementById('stats').textContent = \`总项数 \${DATA.summary.totalTokens} · 当前显示 \${visible}\`

      document.querySelectorAll('.usage-chip').forEach((chip) => {
        chip.addEventListener('mouseenter', (event) => {
          const tip = event.currentTarget.getAttribute('data-tip') || ''
          const img = event.currentTarget.getAttribute('data-img') || ''
          tooltip.innerHTML = (img ? \`<img src="\${img}" alt="参考定位缩略图" />\` : '') + escapeHtml(tip)
          tooltip.style.display = 'block'
        })
        chip.addEventListener('mousemove', (event) => {
          tooltip.style.left = \`\${event.clientX + 14}px\`
          tooltip.style.top = \`\${event.clientY + 14}px\`
        })
        chip.addEventListener('mouseleave', () => {
          tooltip.style.display = 'none'
        })
      })
    }

    document.getElementById('search').addEventListener('input', (event) => {
      state.keyword = event.target.value || ''
      render()
    })

    render()
  </script>
</body>
</html>`
}

function main() {
  const files = walk(SRC_DIR)

  const buckets = {
    colors: createBucket(),
    fontSizes: createBucket(),
    fontWeights: createBucket(),
    lineHeights: createBucket(),
    letterSpacings: createBucket(),
    fontFamilies: createBucket(),
    spacing: createBucket(),
    radius: createBucket(),
    shadows: createBucket(),
    icons: createBucket(),
  }

  for (const absoluteFile of files) {
    const relFile = path.relative(ROOT, absoluteFile)
    const source = fs.readFileSync(absoluteFile, 'utf8')
    const lines = source.split(/\r?\n/)

    const lucideIcons = parseLucideImports(source)
    const importedIconNames = new Set(lucideIcons.map((item) => item.name))
    for (const item of lucideIcons) {
      addUsage(buckets.icons, item.name, {
        file: relFile,
        line: item.line,
        snippet: safeSnippet(lines[item.line - 1] || ''),
      })
    }

    lines.forEach((rawLine, idx) => {
      const line = rawLine
      const lineNo = idx + 1
      const usage = { file: relFile, line: lineNo, snippet: safeSnippet(line) }

      collectAllMatches(line, [regex.hexColor, regex.colorFunc, regex.twColorArbitrary, regex.twColorScale]).forEach((token) => {
        addUsage(buckets.colors, token, usage)
      })

      collectAllMatches(line, [regex.twFontSize]).forEach((token) => addUsage(buckets.fontSizes, token, usage))
      collectAllMatches(line, [regex.twFontWeight]).forEach((token) => addUsage(buckets.fontWeights, token, usage))
      collectAllMatches(line, [regex.twLineHeight]).forEach((token) => addUsage(buckets.lineHeights, token, usage))
      collectAllMatches(line, [regex.twTracking]).forEach((token) => addUsage(buckets.letterSpacings, token, usage))

      const cssFamilies = collectAllMatches(line, [regex.cssFontFamily, regex.jsFontFamilySingle, regex.jsFontFamilyDouble])
      cssFamilies.forEach((match) => {
        const normalized = match
          .replace(/^font-family\s*:\s*/i, '')
          .replace(/^fontFamily\s*:\s*/i, '')
          .replace(/[;"']/g, '')
          .trim()
        if (normalized) addUsage(buckets.fontFamilies, normalized, usage)
      })

      collectAllMatches(line, [regex.twSpacing]).forEach((token) => addUsage(buckets.spacing, token, usage))
      collectAllMatches(line, [regex.twRadius]).forEach((token) => addUsage(buckets.radius, token, usage))

      const jsRadiusMatches = [...line.matchAll(regex.jsRadius)]
      jsRadiusMatches.forEach((match) => {
        const token = `style:${normalizeToken(match[1])}`
        addUsage(buckets.radius, token, usage)
      })

      collectAllMatches(line, [regex.twShadow]).forEach((token) => addUsage(buckets.shadows, token, usage))
      const cssShadowMatches = [...line.matchAll(regex.cssBoxShadow)]
      cssShadowMatches.forEach((match) => addUsage(buckets.shadows, `css:${normalizeToken(match[1])}`, usage))
      const jsShadowSingleMatches = [...line.matchAll(regex.jsBoxShadowSingle)]
      jsShadowSingleMatches.forEach((match) => addUsage(buckets.shadows, `style:${normalizeToken(match[1])}`, usage))
      const jsShadowDoubleMatches = [...line.matchAll(regex.jsBoxShadowDouble)]
      jsShadowDoubleMatches.forEach((match) => addUsage(buckets.shadows, `style:${normalizeToken(match[1])}`, usage))
      collectAllMatches(line, [regex.filterDropShadow]).forEach((token) => addUsage(buckets.shadows, token, usage))

      if (importedIconNames.size > 0) {
        const tagMatches = [...line.matchAll(/<([A-Z][A-Za-z0-9_]*)\b/g)]
        for (const tagMatch of tagMatches) {
          const icon = tagMatch[1]
          if (importedIconNames.has(icon)) {
            addUsage(buckets.icons, icon, usage)
          }
        }
      }
    })
  }

  const typography = [
    ...sortEntries(buckets.fontSizes),
    ...sortEntries(buckets.fontWeights),
    ...sortEntries(buckets.lineHeights),
    ...sortEntries(buckets.letterSpacings),
    ...sortEntries(buckets.fontFamilies),
  ]

  const result = {
    generatedAt: new Date().toISOString(),
    scope: 'src/**/*.ts(x), src/**/*.css',
    summary: {
      filesScanned: files.length,
      totalTokens:
        typography.length +
        buckets.colors.size +
        buckets.spacing.size +
        buckets.radius.size +
        buckets.shadows.size +
        buckets.icons.size,
    },
    typography,
    colors: sortEntries(buckets.colors),
    spacing: sortEntries(buckets.spacing),
    radius: sortEntries(buckets.radius),
    shadows: sortEntries(buckets.shadows),
    icons: sortEntries(buckets.icons),
  }

  fs.mkdirSync(OUT_DATA_DIR, { recursive: true })
  fs.writeFileSync(OUT_JSON, JSON.stringify(result, null, 2), 'utf8')
  fs.writeFileSync(OUT_HTML, buildHtml(result), 'utf8')

  console.log(`[design-audit] done`)
  console.log(`[design-audit] files scanned: ${files.length}`)
  console.log(`[design-audit] output json: ${path.relative(ROOT, OUT_JSON)}`)
  console.log(`[design-audit] output html: ${path.relative(ROOT, OUT_HTML)}`)
}

main()
