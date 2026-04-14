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
const TYPO_SIZE_VARS = {
  '--type-section-size': '40px',
  '--type-title-size': '28px',
  '--type-card-title-size': '21px',
  '--type-body-size': '17px',
  '--type-body-emphasis-size': '17px',
  '--type-link-size': '14px',
  '--type-micro-size': '12px',
}
const TYPO_WEIGHT_VARS = {
  '--type-section-weight': '600',
  '--type-title-weight': '700',
  '--type-card-title-weight': '400',
  '--type-body-weight': '400',
  '--type-body-emphasis-weight': '600',
  '--type-link-weight': '400',
  '--type-micro-weight': '400',
}
const TYPO_LINE_HEIGHT_VARS = {
  '--type-section-line-height': '1.1',
  '--type-title-line-height': '1.14',
  '--type-card-title-line-height': '1.19',
  '--type-body-line-height': '1.47',
  '--type-body-emphasis-line-height': '1.24',
  '--type-link-line-height': '1.43',
  '--type-micro-line-height': '1.33',
}
const TYPO_SYSTEM = [
  {
    role: 'Display Secondary',
    className: 'typo-section-heading',
    sizeVar: '--type-section-size',
    weightVar: '--type-section-weight',
    lineVar: '--type-section-line-height',
    example: '阶段目标总览',
    guidance: '页面级视觉标题（克制使用）',
  },
  {
    role: 'Section Heading',
    className: 'typo-title-heading',
    sizeVar: '--type-title-size',
    weightVar: '--type-title-weight',
    lineVar: '--type-title-line-height',
    example: '本周重点',
    guidance: '主要分区标题',
  },
  {
    role: 'Card Title Strong',
    className: 'typo-card-title-bold',
    sizeVar: '--type-card-title-size',
    weightVar: '--type-card-title-weight',
    lineVar: '--type-card-title-line-height',
    weightOverride: '700',
    example: '还没有可展示的分栏目标',
    guidance: '卡片标题（强调）',
  },
  {
    role: 'Card Title',
    className: 'typo-card-title',
    sizeVar: '--type-card-title-size',
    weightVar: '--type-card-title-weight',
    lineVar: '--type-card-title-line-height',
    example: '愿景记录',
    guidance: '卡片标题（常规）',
  },
  {
    role: 'Body',
    className: 'typo-body',
    sizeVar: '--type-body-size',
    weightVar: '--type-body-weight',
    lineVar: '--type-body-line-height',
    example: '今天完成了 2 项关键任务。',
    guidance: '正文主文案',
  },
  {
    role: 'Body Emphasis',
    className: 'typo-body-emphasis',
    sizeVar: '--type-body-emphasis-size',
    weightVar: '--type-body-emphasis-weight',
    lineVar: '--type-body-emphasis-line-height',
    example: '愿景记录',
    guidance: '强调正文 / 小标题',
  },
  {
    role: 'Link / Secondary',
    className: 'typo-link',
    sizeVar: '--type-link-size',
    weightVar: '--type-link-weight',
    lineVar: '--type-link-line-height',
    example: '查看全部',
    guidance: '次级说明 / 可点击文本',
  },
  {
    role: 'Micro / Meta',
    className: 'typo-micro',
    sizeVar: '--type-micro-size',
    weightVar: '--type-micro-weight',
    lineVar: '--type-micro-line-height',
    example: '最后更新 18:28',
    guidance: '元信息、标签、时间戳',
  },
]

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
  if (arbitrary && isArbitraryTextSizeValue(arbitrary[1])) return arbitrary[1]
  return null
}

const colorNames = '(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)'
const regex = {
  hexColor: /#(?:[\da-fA-F]{3,8})\b/g,
  colorFunc: /\b(?:rgba?|hsla?)\([^\n\r\)]*\)/g,
  twColorArbitrary: /\b(?:text|bg|border|from|to|via|stroke|fill)-\[[^\]]+\]/g,
  twColorScale: new RegExp(`\\b(?:text|bg|border|from|to|via|stroke|fill)-${colorNames}(?:-\\d{1,3})?(?:\\/\\[[^\\]]+\\]|\\/\\d{1,3})?\\b`, 'g'),
  twFontSize: /\btext-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)\b|\btext-\[[^\]]+\]/g,
  twFontWeight: /\bfont-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black|\[[^\]]+\])\b/g,
  twLineHeight: /\bleading-(?:none|tight|snug|normal|relaxed|loose|\d+|\[[^\]]+\])\b/g,
  twTracking: /\btracking-(?:tighter|tight|normal|wide|wider|widest|\[[^\]]+\])\b/g,
  cssFontFamily: /font-family\s*:\s*([^;]+);?/g,
  cssFontSize: /font-size\s*:\s*([^;]+);?/g,
  jsFontFamilySingle: /fontFamily\s*:\s*'([^']+)'/g,
  jsFontFamilyDouble: /fontFamily\s*:\s*"([^"]+)"/g,
  jsFontSize: /\bfontSize\s*:\s*([^,}\n]+)/g,
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
  const importRegex = /import\s*\{([^}]*)\}\s*from\s*['"]lucide-react['"]/g
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

function isArbitraryColorValue(value) {
  const v = value.trim().toLowerCase()
  if (!v) return false
  if (
    v.startsWith('#') ||
    v.startsWith('rgb(') ||
    v.startsWith('rgba(') ||
    v.startsWith('hsl(') ||
    v.startsWith('hsla(') ||
    v.startsWith('oklch(') ||
    v.startsWith('oklab(') ||
    v.startsWith('lab(') ||
    v.startsWith('lch(') ||
    v.startsWith('color(') ||
    v.startsWith('var(')
  ) {
    return true
  }
  if (v.includes('gradient(')) return true
  if (v === 'transparent' || v === 'currentcolor' || v === 'inherit') return true
  if (/^[a-z]+$/.test(v)) return true
  return false
}

function isArbitraryColorClass(token) {
  const match = token.match(/^(?:text|bg|border|from|to|via|stroke|fill)-\[(.+)\]$/)
  if (!match) return false
  return isArbitraryColorValue(match[1])
}

function isArbitraryTextSizeValue(value) {
  const v = value.trim().toLowerCase()
  if (!v) return false
  const cssVarMatch = v.match(/^var\(--([^)]+)\)$/)
  if (cssVarMatch) {
    return /(size|font-size|type)/.test(cssVarMatch[1])
  }
  if (isArbitraryColorValue(v)) return false
  if (/^-?\d+(\.\d+)?$/.test(v)) return true
  if (/^-?\d+(\.\d+)?(?:px|r?em|%|vw|vh|vmin|vmax|ch|ex|pt|pc|cm|mm|in)$/.test(v)) return true
  if (/^(?:calc|min|max|clamp)\(.+\)$/.test(v)) return true
  return false
}

function parseArbitraryClassValue(token) {
  const match = token.match(/^(?:text|bg|border|from|to|via|stroke|fill)-\[(.+)\]$/)
  return match ? match[1].trim() : null
}

function parseTailwindColorClass(token) {
  const match = token.match(/^(?:text|bg|border|from|to|via|stroke|fill)-([a-z]+)(?:-(\d{1,3}))?(?:\/(\d{1,3}))?$/)
  if (!match) return null
  return {
    colorName: match[1],
    shade: match[2] || null,
    opacity: match[3] ? Number(match[3]) : null,
  }
}

function hexToRgba(hex, opacity) {
  const raw = hex.replace('#', '')
  if (!(raw.length === 3 || raw.length === 6)) return hex
  const normalized = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw
  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return hex
  const a = Math.max(0, Math.min(1, opacity / 100))
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

function tailwindColorToSwatch(token) {
  if (token.startsWith('#') || token.startsWith('rgb') || token.startsWith('hsl') || token.startsWith('okl')) {
    return token
  }

  const arbitraryValue = parseArbitraryClassValue(token)
  if (arbitraryValue) {
    if (isArbitraryColorValue(arbitraryValue)) {
      if (arbitraryValue.includes('gradient(')) {
        const hexMatch = arbitraryValue.match(/#(?:[\da-fA-F]{3,8})/)
        return hexMatch ? hexMatch[0] : '#dbe2ea'
      }
      return arbitraryValue
    }
    return '#dbe2ea'
  }

  const parsed = parseTailwindColorClass(token)
  if (!parsed) return '#dbe2ea'

  const palette = {
    black: '#000000',
    white: '#ffffff',
    gray: '#6b7280',
    slate: '#64748b',
    zinc: '#71717a',
    neutral: '#737373',
    stone: '#78716c',
    red: '#ef4444',
    orange: '#f97316',
    amber: '#f59e0b',
    yellow: '#eab308',
    lime: '#84cc16',
    green: '#22c55e',
    emerald: '#10b981',
    teal: '#14b8a6',
    cyan: '#06b6d4',
    sky: '#0ea5e9',
    blue: '#3b82f6',
    indigo: '#6366f1',
    violet: '#8b5cf6',
    purple: '#a855f7',
    fuchsia: '#d946ef',
    pink: '#ec4899',
    rose: '#f43f5e',
  }
  const base = palette[parsed.colorName] || '#dbe2ea'
  if (parsed.opacity !== null) return hexToRgba(base, parsed.opacity)
  return base
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
  if (token.startsWith('font-size:')) {
    const raw = token.slice('font-size:'.length).trim()
    const cleaned = raw.replace(/^['"]|['"]$/g, '')
    const varMatch = cleaned.match(/^var\((--[^)]+)\)$/)
    if (varMatch && TYPO_SIZE_VARS[varMatch[1]]) return TYPO_SIZE_VARS[varMatch[1]]
    if (/^-?\d+(\.\d+)?$/.test(cleaned)) return `${cleaned}px`
    return cleaned || '14px'
  }
  const normal = tailwindClassToFontSize(token)
  return normal || '14px'
}

function normalizeTypographyTokenMeta(token) {
  const meta = {
    size: null,
    weight: null,
    lineHeight: null,
  }

  const size = normalizeFontSizeForPreview(token)
  if (size && (token.startsWith('text-') || token.startsWith('font-size:'))) {
    meta.size = size
  }

  const weightMap = {
    'font-thin': '100',
    'font-extralight': '200',
    'font-light': '300',
    'font-normal': '400',
    'font-medium': '500',
    'font-semibold': '600',
    'font-bold': '700',
    'font-extrabold': '800',
    'font-black': '900',
  }
  if (weightMap[token]) meta.weight = weightMap[token]

  const lineMap = {
    'leading-none': '1.00',
    'leading-tight': '1.25',
    'leading-snug': '1.375',
    'leading-normal': '1.50',
    'leading-relaxed': '1.625',
    'leading-loose': '2.00',
    'leading-3': '0.75rem',
    'leading-4': '1rem',
    'leading-5': '1.25rem',
    'leading-6': '1.5rem',
    'leading-7': '1.75rem',
    'leading-8': '2rem',
    'leading-9': '2.25rem',
    'leading-10': '2.5rem',
  }
  if (lineMap[token]) meta.lineHeight = lineMap[token]

  const arbitraryLeading = token.match(/^leading-\[(.+)\]$/)
  if (arbitraryLeading) meta.lineHeight = arbitraryLeading[1]

  return meta
}

function sizeToPx(size) {
  if (!size) return null
  const v = String(size).trim().toLowerCase()
  const px = v.match(/^(-?\d+(?:\.\d+)?)px$/)
  if (px) return Number(px[1])
  const rem = v.match(/^(-?\d+(?:\.\d+)?)rem$/)
  if (rem) return Number(rem[1]) * 16
  const em = v.match(/^(-?\d+(?:\.\d+)?)em$/)
  if (em) return Number(em[1]) * 16
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v)
  return null
}

function formatNumber(value, digits = 3) {
  if (!Number.isFinite(value)) return String(value)
  const text = value.toFixed(digits)
  return text.replace(/\.?0+$/, '')
}

function formatPxRemLabel(sizeValue) {
  const px = sizeToPx(sizeValue)
  if (px === null || !Number.isFinite(px)) {
    return {
      px: null,
      pxText: '-',
      remText: '-',
      label: sizeValue || '-',
    }
  }
  const rem = px / 16
  const pxText = `${formatNumber(px, 2)}px`
  const remText = `${formatNumber(rem, 3)}rem`
  return {
    px: Number(px.toFixed(2)),
    pxText,
    remText,
    label: `${pxText} (${remText})`,
  }
}

function buildTypographyStandardEntries(semanticTypeMap) {
  return TYPO_SYSTEM.map((item) => {
    const size = TYPO_SIZE_VARS[item.sizeVar] || '14px'
    const weight = item.weightOverride || TYPO_WEIGHT_VARS[item.weightVar] || '400'
    const lineHeight = TYPO_LINE_HEIGHT_VARS[item.lineVar] || '1.4'
    const sizeLabel = formatPxRemLabel(size)
    const usageEntry = semanticTypeMap.get(item.className)
    return {
      role: item.role,
      className: item.className,
      guidance: item.guidance,
      example: item.example,
      size,
      weight,
      lineHeight,
      sizeLabel: sizeLabel.label,
      sizePx: sizeLabel.px,
      usages: usageEntry ? usageEntry.usages : [],
      usageCount: usageEntry ? usageEntry.count : 0,
    }
  })
}

function enrichTypographySizeEntries(entries, standardPxSet) {
  return entries.map((entry) => {
    const size = normalizeFontSizeForPreview(entry.token)
    const formatted = formatPxRemLabel(size)
    return {
      ...entry,
      normalizedSize: size,
      sizePx: formatted.px,
      sizeLabel: formatted.label,
      inStandard: formatted.px !== null ? standardPxSet.has(formatted.px) : false,
    }
  })
}

function computeTypographyStats(typographyEntries) {
  const values = new Set()
  typographyEntries.forEach((entry) => {
    const meta = normalizeTypographyTokenMeta(entry.token)
    const px = sizeToPx(meta.size)
    if (px !== null && Number.isFinite(px)) {
      values.add(Number(px.toFixed(2)))
    }
  })
  const sorted = [...values].sort((a, b) => a - b)
  return {
    minPx: sorted.length > 0 ? sorted[0] : null,
    maxPx: sorted.length > 0 ? sorted[sorted.length - 1] : null,
    scalePx: sorted,
  }
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
  let tokenMetaHtml = ''
  if (section === 'colors') {
    const isClassColor = /^(?:text|bg|border|from|to|via|stroke|fill)-/.test(token)
    const color = isClassColor ? tailwindColorToSwatch(token) : token
    const desc = isClassColor ? `Tailwind 类: ${token}` : token
    preview = `<div class="swatch" style="background:${htmlEscape(color)}"></div><div>${htmlEscape(desc)}</div>`
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
  } else if (section === 'typographySizes') {
    const tagClass = item.inStandard ? 'spec-tag ok' : 'spec-tag warn'
    const tagText = item.inStandard ? '在规范内' : '待收敛'
    tokenMetaHtml = `<div class="token-meta">字号 ${htmlEscape(item.sizeLabel || '-')} · <span class="${tagClass}">${tagText}</span></div>`
    preview = `<div style="font-size:${htmlEscape(item.normalizedSize || '14px')};font-weight:600;line-height:1.4">字体示例 The quick fox 你好</div>`
  } else if (section === 'fontWeights') {
    const weightMap = {
      'font-thin': '100',
      'font-extralight': '200',
      'font-light': '300',
      'font-normal': '400',
      'font-medium': '500',
      'font-semibold': '600',
      'font-bold': '700',
      'font-extrabold': '800',
      'font-black': '900',
    }
    const weight = weightMap[token] || token.replace(/^font-\[(.+)\]$/, '$1')
    tokenMetaHtml = `<div class="token-meta">字重 ${htmlEscape(weight)}</div>`
    preview = `<div style="font-size:16px;font-weight:${htmlEscape(weight)};line-height:1.4">字体示例 The quick fox 你好</div>`
  } else if (section === 'lineHeights') {
    const lineMap = {
      'leading-none': '1.00',
      'leading-tight': '1.25',
      'leading-snug': '1.375',
      'leading-normal': '1.50',
      'leading-relaxed': '1.625',
      'leading-loose': '2.00',
      'leading-3': '0.75rem',
      'leading-4': '1rem',
      'leading-5': '1.25rem',
      'leading-6': '1.5rem',
      'leading-7': '1.75rem',
      'leading-8': '2rem',
      'leading-9': '2.25rem',
      'leading-10': '2.5rem',
    }
    const lineHeight = lineMap[token] || token.replace(/^leading-\[(.+)\]$/, '$1')
    tokenMetaHtml = `<div class="token-meta">行高 ${htmlEscape(lineHeight)}</div>`
    preview = `<div style="font-size:15px;font-weight:500;line-height:${htmlEscape(lineHeight)}">字体示例 The quick fox 你好</div>`
  } else if (section === 'tracking') {
    const trackingMap = {
      'tracking-tighter': '-0.05em',
      'tracking-tight': '-0.025em',
      'tracking-normal': '0',
      'tracking-wide': '0.025em',
      'tracking-wider': '0.05em',
      'tracking-widest': '0.1em',
    }
    const tracking = trackingMap[token] || token.replace(/^tracking-\[(.+)\]$/, '$1')
    tokenMetaHtml = `<div class="token-meta">字距 ${htmlEscape(tracking)}</div>`
    preview = `<div style="font-size:15px;font-weight:600;line-height:1.4;letter-spacing:${htmlEscape(tracking)}">字体示例 The quick fox 你好</div>`
  } else if (section === 'fontFamilies') {
    tokenMetaHtml = `<div class="token-meta">字体族</div>`
    preview = `<div style="font-size:15px;font-weight:500;line-height:1.4;font-family:${htmlEscape(token)}">字体示例 The quick fox 你好</div>`
  } else {
    const typoMeta = normalizeTypographyTokenMeta(token)
    const size = typoMeta.size || '14px'
    const metaParts = []
    if (typoMeta.size) metaParts.push(`字号 ${typoMeta.size}`)
    if (typoMeta.weight) metaParts.push(`字重 ${typoMeta.weight}`)
    if (typoMeta.lineHeight) metaParts.push(`行高 ${typoMeta.lineHeight}`)
    tokenMetaHtml = `<div class="token-meta">${htmlEscape(metaParts.length > 0 ? metaParts.join(' · ') : '字号 -')}</div>`
    preview = `<div style="font-size:${htmlEscape(size)};font-weight:600;line-height:1.4">字体示例 The quick fox 你好</div>`
  }

  return `
        <article class="card" data-token="${htmlEscape(token.toLowerCase())}" data-file="${htmlEscape(item.usages.map((u) => u.file.toLowerCase()).join(' '))}">
          <div class="count">${item.count}次</div>
          <div class="token">${htmlEscape(token)}</div>
          ${tokenMetaHtml}
          <div class="preview">${preview}</div>
          <div class="usages">${usageChipsStatic(item.usages)}</div>
        </article>
      `
}

function renderStaticSection(list, section) {
  return list.map((item) => buildCardStatic(item, section)).join('')
}

function renderTypographyStandardRows(list) {
  return list.map((item) => {
    const usage = item.usageCount > 0
      ? usageChipsStatic(item.usages)
      : '<span class="usage-chip">当前未落地</span>'
    return `
      <article class="spec-row card" data-token="${htmlEscape((item.className || '').toLowerCase())}" data-file="${htmlEscape(item.usages.map((u) => u.file.toLowerCase()).join(' '))}">
        <div class="spec-top">
          <div class="spec-role">${htmlEscape(item.role)}</div>
          <div class="spec-class">${htmlEscape(item.className)}</div>
        </div>
        <div class="spec-preview" style="font-size:${htmlEscape(item.size)};font-weight:${htmlEscape(item.weight)};line-height:${htmlEscape(item.lineHeight)}">${htmlEscape(item.example)}</div>
        <div class="spec-meta">${htmlEscape(`${item.sizeLabel} / ${item.weight} / ${item.lineHeight} / Apple System`)}</div>
        <div class="spec-guidance">${htmlEscape(item.guidance)}</div>
        <div class="usages">${usage}</div>
      </article>
    `
  }).join('')
}

function buildHtml(data) {
  const safeJson = JSON.stringify(data).replaceAll('</script>', '<\\/script>')
  const minText = data.typographyStats?.minPx === null || data.typographyStats?.minPx === undefined
    ? '-'
    : `${data.typographyStats.minPx}px`
  const maxText = data.typographyStats?.maxPx === null || data.typographyStats?.maxPx === undefined
    ? '-'
    : `${data.typographyStats.maxPx}px`
  const scaleList = (data.typographyStats?.scalePx || []).map((value) => `${value}px`).join(', ')
  const typeSummaryHtml = `
      <div class="type-summary">
        <span class="type-summary-chip">最小字号 ${htmlEscape(minText)}</span>
        <span class="type-summary-chip">最大字号 ${htmlEscape(maxText)}</span>
        <span class="type-summary-chip">字号档位 ${htmlEscape(scaleList || '-')}</span>
      </div>
  `
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
    .token-meta {
      margin-bottom: 6px;
      font-size: 11px;
      color: #667085;
      font-weight: 600;
    }
    .spec-tag {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 1px 8px;
      font-size: 10px;
      border: 1px solid transparent;
      vertical-align: middle;
    }
    .spec-tag.ok {
      color: #0f766e;
      background: #ecfdf5;
      border-color: #a7f3d0;
    }
    .spec-tag.warn {
      color: #92400e;
      background: #fffbeb;
      border-color: #fde68a;
    }
    .spec-row {
      min-height: 180px;
      border-radius: 16px;
    }
    .spec-top {
      display: flex;
      gap: 8px;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .spec-role {
      font-size: 12px;
      color: #667085;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .spec-class {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      color: #475467;
      background: #f8fafc;
      border: 1px solid #e5e7eb;
      border-radius: 999px;
      padding: 2px 8px;
      white-space: nowrap;
    }
    .spec-preview {
      margin: 8px 0 6px;
      color: #334155;
      letter-spacing: -0.01em;
    }
    .spec-meta {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      color: #667085;
      margin-bottom: 6px;
    }
    .spec-guidance {
      font-size: 12px;
      color: #475467;
      margin-bottom: 8px;
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
    .type-summary {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 2px 0 12px;
    }
    .type-summary-chip {
      font-size: 11px;
      color: #475467;
      border: 1px solid #d8dee8;
      border-radius: 999px;
      padding: 3px 9px;
      background: #f8fafc;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
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

    <section class="section" data-section="typography-standard">
      <h2>字体规范（推荐复用）</h2>
      <div class="legend">这部分是规范定义。后续新增/改版优先使用这些语义类，不直接写裸字号。</div>
      <div id="typographyStandardGrid" class="grid">${renderTypographyStandardRows(data.typographyStandard || [])}</div>
    </section>

    <section class="section" data-section="typography">
      <h2>字号现状（与规范对比）</h2>
      <div class="legend">统一显示为 px(rem)；标记“待收敛”的即不在当前规范字号集内。</div>
      ${typeSummaryHtml}
      <div id="typographyGrid" class="grid">${renderStaticSection(data.typographySizes || [], 'typographySizes')}</div>
    </section>

    <section class="section" data-section="typography-weights">
      <h2>字重现状</h2>
      <div class="legend">按 class 统计，帮助清理不必要的粗细档位。</div>
      <div id="fontWeightsGrid" class="grid">${renderStaticSection(data.typographyWeights || [], 'fontWeights')}</div>
    </section>

    <section class="section" data-section="typography-line-heights">
      <h2>行高现状</h2>
      <div class="legend">用于识别正文/标题行高是否过散或过挤。</div>
      <div id="lineHeightsGrid" class="grid">${renderStaticSection(data.typographyLineHeights || [], 'lineHeights')}</div>
    </section>

    <section class="section" data-section="typography-tracking">
      <h2>字距现状</h2>
      <div class="legend">建议减少过多的 tracking 变化，避免风格不一致。</div>
      <div id="trackingGrid" class="grid">${renderStaticSection(data.typographyTracking || [], 'tracking')}</div>
    </section>

    <section class="section" data-section="typography-font-family">
      <h2>字体族现状</h2>
      <div class="legend">当前目标是统一 Apple 字体栈，便于中英文表现一致。</div>
      <div id="fontFamiliesGrid" class="grid">${renderStaticSection(data.typographyFamilies || [], 'fontFamilies')}</div>
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
        const value = token.slice('text-['.length, -1).trim()
        const cssVarMatch = value.match(/^var\(--([^)]+)\)$/)
        if (cssVarMatch && /(size|font-size|type)/.test(cssVarMatch[1])) return value
        const isColorLike =
          value.startsWith('#') ||
          value.startsWith('rgb(') ||
          value.startsWith('rgba(') ||
          value.startsWith('hsl(') ||
          value.startsWith('hsla(') ||
          value.startsWith('oklch(') ||
          value.startsWith('oklab(') ||
          value.startsWith('lab(') ||
          value.startsWith('lch(') ||
          value.startsWith('color(') ||
          value.includes('gradient(') ||
          /^[a-z]+$/.test(value)
        if (isColorLike) return '14px'
        return value
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

    function parseArbitraryClassValue(token) {
      const match = token.match(/^(?:text|bg|border|from|to|via|stroke|fill)-\\[(.+)\\]$/)
      return match ? match[1].trim() : null
    }

    function parseTailwindColorClass(token) {
      const match = token.match(/^(?:text|bg|border|from|to|via|stroke|fill)-([a-z]+)(?:-(\\d{1,3}))?(?:\\/(\\d{1,3}))?$/)
      if (!match) return null
      return {
        colorName: match[1],
        shade: match[2] || null,
        opacity: match[3] ? Number(match[3]) : null,
      }
    }

    function hexToRgba(hex, opacity) {
      const raw = hex.replace('#', '')
      if (!(raw.length === 3 || raw.length === 6)) return hex
      const normalized = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw
      const r = Number.parseInt(normalized.slice(0, 2), 16)
      const g = Number.parseInt(normalized.slice(2, 4), 16)
      const b = Number.parseInt(normalized.slice(4, 6), 16)
      if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return hex
      const a = Math.max(0, Math.min(1, opacity / 100))
      return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + a + ')'
    }

    function tailwindColorToSwatch(token) {
      if (token.startsWith('#') || token.startsWith('rgb') || token.startsWith('hsl') || token.startsWith('okl')) {
        return token
      }

      const arbitraryValue = parseArbitraryClassValue(token)
      if (arbitraryValue) {
        if (arbitraryValue.includes('gradient(')) {
          const hexMatch = arbitraryValue.match(/#(?:[\\da-fA-F]{3,8})/)
          return hexMatch ? hexMatch[0] : '#dbe2ea'
        }
        return arbitraryValue
      }

      const parsed = parseTailwindColorClass(token)
      if (!parsed) return '#dbe2ea'

      const palette = {
        black: '#000000',
        white: '#ffffff',
        gray: '#6b7280',
        slate: '#64748b',
        zinc: '#71717a',
        neutral: '#737373',
        stone: '#78716c',
        red: '#ef4444',
        orange: '#f97316',
        amber: '#f59e0b',
        yellow: '#eab308',
        lime: '#84cc16',
        green: '#22c55e',
        emerald: '#10b981',
        teal: '#14b8a6',
        cyan: '#06b6d4',
        sky: '#0ea5e9',
        blue: '#3b82f6',
        indigo: '#6366f1',
        violet: '#8b5cf6',
        purple: '#a855f7',
        fuchsia: '#d946ef',
        pink: '#ec4899',
        rose: '#f43f5e',
      }
      const base = palette[parsed.colorName] || '#dbe2ea'
      if (parsed.opacity !== null) return hexToRgba(base, parsed.opacity)
      return base
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
        const isClassColor = /^(?:text|bg|border|from|to|via|stroke|fill)-/.test(token)
        const color = isClassColor ? tailwindColorToSwatch(token) : token
        const desc = isClassColor ? \`Tailwind 类: \${token}\` : token
        preview = \`<div class="swatch" style="background:\${escapeHtml(color)}"></div><div>\${escapeHtml(desc)}</div>\`
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
        chip.onmouseenter = (event) => {
          const tip = event.currentTarget.getAttribute('data-tip') || ''
          const img = event.currentTarget.getAttribute('data-img') || ''
          tooltip.innerHTML = (img ? \`<img src="\${img}" alt="参考定位缩略图" />\` : '') + escapeHtml(tip)
          tooltip.style.display = 'block'
        }
        chip.onmousemove = (event) => {
          tooltip.style.left = \`\${event.clientX + 14}px\`
          tooltip.style.top = \`\${event.clientY + 14}px\`
        }
        chip.onmouseleave = () => {
          tooltip.style.display = 'none'
        }
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
    semanticTypography: createBucket(),
    spacing: createBucket(),
    radius: createBucket(),
    shadows: createBucket(),
    icons: createBucket(),
  }

  for (const absoluteFile of files) {
    const relFile = path.relative(ROOT, absoluteFile)
    const isCssFile = relFile.endsWith('.css')
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

      collectAllMatches(line, [regex.hexColor, regex.colorFunc, regex.twColorScale]).forEach((token) => {
        addUsage(buckets.colors, token, usage)
      })
      collectAllMatches(line, [regex.twColorArbitrary]).forEach((token) => {
        if (isArbitraryColorClass(token)) {
          addUsage(buckets.colors, token, usage)
        }
      })

      collectAllMatches(line, [regex.twFontSize]).forEach((token) => {
        if (token.startsWith('text-[') && token.endsWith(']')) {
          const arbitraryValue = token.slice('text-['.length, -1)
          if (!isArbitraryTextSizeValue(arbitraryValue)) return
        }
        addUsage(buckets.fontSizes, token, usage)
      })
      const cssFontSizeMatches = [...line.matchAll(regex.cssFontSize)]
      cssFontSizeMatches.forEach((match) => {
        const value = normalizeToken(match[1]).replace(/^['"]|['"]$/g, '')
        if (!value) return
        const normalized = /^-?\d+(\.\d+)?$/.test(value) ? `${value}px` : value
        addUsage(buckets.fontSizes, `font-size:${normalized}`, usage)
      })
      const jsFontSizeMatches = [...line.matchAll(regex.jsFontSize)]
      jsFontSizeMatches.forEach((match) => {
        const value = normalizeToken(match[1]).replace(/^['"]|['"]$/g, '')
        if (!value) return
        const normalized = /^-?\d+(\.\d+)?$/.test(value) ? `${value}px` : value
        addUsage(buckets.fontSizes, `font-size:${normalized}`, usage)
      })
      collectAllMatches(line, [regex.twFontWeight]).forEach((token) => addUsage(buckets.fontWeights, token, usage))
      collectAllMatches(line, [regex.twLineHeight]).forEach((token) => addUsage(buckets.lineHeights, token, usage))
      collectAllMatches(line, [regex.twTracking]).forEach((token) => addUsage(buckets.letterSpacings, token, usage))
      if (!isCssFile) {
        collectAllMatches(line, [/\btypo-(?:section-heading|title-heading|card-title-bold|card-title|body-emphasis|body|link|micro)\b/g])
          .forEach((token) => addUsage(buckets.semanticTypography, token, usage))
      }

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

  const typographySizesRaw = sortEntries(buckets.fontSizes)
  const typographyWeights = sortEntries(buckets.fontWeights)
  const typographyLineHeights = sortEntries(buckets.lineHeights)
  const typographyTracking = sortEntries(buckets.letterSpacings)
  const typographyFamilies = sortEntries(buckets.fontFamilies)
  const semanticTypeMap = buckets.semanticTypography
  const standardPxSet = new Set(
    Object.values(TYPO_SIZE_VARS)
      .map((size) => formatPxRemLabel(size).px)
      .filter((value) => value !== null)
  )
  const typographySizes = enrichTypographySizeEntries(typographySizesRaw, standardPxSet)
  const typographyStandard = buildTypographyStandardEntries(semanticTypeMap)
  const typographyAll = [
    ...typographySizes,
    ...typographyWeights,
    ...typographyLineHeights,
    ...typographyTracking,
    ...typographyFamilies,
  ]

  const result = {
    generatedAt: new Date().toISOString(),
    scope: 'src/**/*.ts(x), src/**/*.css',
    summary: {
      filesScanned: files.length,
      totalTokens:
        typographyAll.length +
        typographyStandard.length +
        buckets.colors.size +
        buckets.spacing.size +
        buckets.radius.size +
        buckets.shadows.size +
        buckets.icons.size,
    },
    typographyStats: computeTypographyStats(typographySizes),
    typographyStandard,
    typographySizes,
    typographyWeights,
    typographyLineHeights,
    typographyTracking,
    typographyFamilies,
    typography: typographyAll,
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
