import {
  CATEGORY_MAP,
  WORD_BANK,
  getActiveCategories,
  type CategoryId,
  type PlatformId,
} from '../data/words'

export interface WordSource {
  word: string
  category: CategoryId
  suggestion?: string
  source: 'builtin' | 'custom'
}

export interface HitPosition {
  start: number
  end: number
}

export interface Hit extends WordSource {
  count: number
  positions: HitPosition[]
}

export interface TextSegment {
  text: string
  hit?: Hit
}

export type RiskLevel = 'high' | 'medium' | 'low'

export interface DetectResult {
  hits: Hit[]
  segments: TextSegment[]
  total: number
  unique: number
  riskLevel: RiskLevel
  riskLabel: string
  riskScore: number
  scannedWords: number
  textLength: number
}

export interface DetectOptions {
  text: string
  platform: PlatformId
  enabledCategories: CategoryId[]
  customWords: string[]
}

interface NormalizedText {
  value: string
  map: number[]
}

const IGNORED_CHARS = new Set([' ', '\t', '\n', '\r', '\u00a0', '\u200b', '\u200c', '\u200d', '\u2060', '\ufeff', '·', '-', '—', '_', '/', '\\', '|', '~'])

/** 全角转半角、英文转小写、剔除常见干扰字符，并保留原文下标映射。 */
function normalize(input: string): NormalizedText {
  let value = ''
  const map: number[] = []
  let cursor = 0

  for (const char of input) {
    const code = char.codePointAt(0) ?? 0
    let converted = char

    if (code === 0x3000) {
      converted = ' '
    } else if (code >= 0xff01 && code <= 0xff5e) {
      converted = String.fromCharCode(code - 0xfee0)
    } else if (code >= 0xff61 && code <= 0xff9f) {
      converted = String.fromCharCode(code - 0xfec0)
    }

    converted = converted.toLowerCase()

    if (!IGNORED_CHARS.has(converted)) {
      value += converted
      for (let offset = 0; offset < char.length; offset += 1) {
        map.push(cursor + offset)
      }
    }

    cursor += char.length
  }

  return { value, map }
}

/** Category weights: legal/medical/financial/vulgar risks outweigh soft wording. */
const CATEGORY_WEIGHT: Record<CategoryId, number> = {
  extreme: 3,
  exaggerate: 2,
  medical: 3,
  finance: 3,
  induce: 2,
  vulgar: 3,
  xhs: 1.5,
  douyin: 1.5,
  xianyu: 1.5,
  custom: 1,
}

/** Weighted hit density per 1,000 characters, plus a small flat component. */
export function scoreRisk(hits: Hit[], textLength: number): { riskLevel: RiskLevel; riskLabel: string; riskScore: number } {
  const weighted = hits.reduce((sum, hit) => sum + hit.count * (CATEGORY_WEIGHT[hit.category] ?? 1), 0)
  const density = (weighted / Math.max(textLength, 1)) * 1000
  const riskScore = Math.round((weighted + density * 0.5) * 10) / 10
  const riskLevel: RiskLevel = riskScore >= 24 ? 'high' : riskScore >= 8 ? 'medium' : 'low'
  const riskLabel = riskLevel === 'high' ? '高风险' : riskLevel === 'medium' ? '中风险' : '低风险'
  return { riskLevel, riskLabel, riskScore }
}

/** Expose normalization so other modules can match obfuscated text the same way. */
export function normalizeText(input: string): string {
  return normalize(input).value
}

function buildEntries(options: DetectOptions): WordSource[] {
  const entries: WordSource[] = []

  for (const categoryId of options.enabledCategories) {
    if (categoryId === 'custom') {
      for (const word of options.customWords) {
        entries.push({ word, category: 'custom', source: 'custom' })
      }
      continue
    }

    const bank = WORD_BANK[categoryId]
    if (!bank) continue

    for (const item of bank) {
      entries.push({
        word: item.word,
        suggestion: item.suggestion,
        category: categoryId,
        source: 'builtin',
      })
    }
  }

  return entries
}

interface Candidate {
  start: number
  end: number
  entry: WordSource
}

export function detectWords(options: DetectOptions): DetectResult {
  const { text } = options
  const normalized = normalize(text)
  const entries = buildEntries(options)

  const candidates: Candidate[] = []
  const seenWords = new Set<string>()

  for (const entry of entries) {
    const normalizedWord = normalize(entry.word).value
    if (!normalizedWord || seenWords.has(normalizedWord)) continue
    seenWords.add(normalizedWord)

    let from = 0
    while (from <= normalized.value.length - normalizedWord.length) {
      const index = normalized.value.indexOf(normalizedWord, from)
      if (index === -1) break
      candidates.push({ start: index, end: index + normalizedWord.length, entry })
      from = index + 1
    }
  }

  candidates.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start
    const lengthDiff = b.end - b.start - (a.end - a.start)
    if (lengthDiff !== 0) return lengthDiff
    if (a.entry.source !== b.entry.source) return a.entry.source === 'custom' ? -1 : 1
    return 0
  })

  const hitMap = new Map<string, Hit>()

  let cursor = -1
  for (const candidate of candidates) {
    if (candidate.start < cursor) continue
    cursor = candidate.end

    const start = normalized.map[candidate.start]
    const end = normalized.map[candidate.end - 1] + 1
    const key = `${candidate.entry.source}:${candidate.entry.word}`
    let hit = hitMap.get(key)

    if (!hit) {
      hit = { ...candidate.entry, count: 0, positions: [] }
      hitMap.set(key, hit)
    }

    hit.count += 1
    hit.positions.push({ start, end })
  }

  const hits = Array.from(hitMap.values()).sort((a, b) => {
    const aStart = a.positions[0]?.start ?? 0
    const bStart = b.positions[0]?.start ?? 0
    return aStart - bStart
  })

  const segments: TextSegment[] = []
  const marked: Array<HitPosition & { hit: Hit }> = []
  for (const hit of hits) {
    for (const position of hit.positions) {
      marked.push({ ...position, hit })
    }
  }
  marked.sort((a, b) => a.start - b.start)

  let segmentCursor = 0
  for (const mark of marked) {
    if (mark.start < segmentCursor) continue
    if (mark.start > segmentCursor) {
      segments.push({ text: text.slice(segmentCursor, mark.start) })
    }
    segments.push({ text: text.slice(mark.start, mark.end), hit: mark.hit })
    segmentCursor = mark.end
  }
  if (segmentCursor < text.length) {
    segments.push({ text: text.slice(segmentCursor) })
  }

  const total = hits.reduce((sum, hit) => sum + hit.count, 0)
  const { riskLevel, riskLabel, riskScore } = scoreRisk(hits, text.length)

  return {
    hits,
    segments,
    total,
    unique: hits.length,
    riskLevel,
    riskLabel,
    riskScore,
    scannedWords: entries.length,
    textLength: text.length,
  }
}

export function parseCustomWords(raw: string): { words: string[]; errors: string[] } {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const errors: string[] = []
  if (lines.length > 1000) {
    errors.push('自定义违禁词最多 1000 行，超出部分已忽略')
  }

  lines.slice(0, 1000).forEach((line, index) => {
    if (line.length > 100) {
      errors.push(`第 ${index + 1} 行超过 100 个字`)
    }
  })

  const words = Array.from(new Set(lines.slice(0, 1000).filter((line) => line.length <= 100)))
  return { words, errors }
}

export function countCategoryWords(categoryId: CategoryId, customWords: string[]): number {
  if (categoryId === 'custom') return customWords.length
  return WORD_BANK[categoryId]?.length ?? 0
}

export function isCategoryAvailable(categoryId: CategoryId, platform: PlatformId): boolean {
  return getActiveCategories(platform, true).some((category) => category.id === categoryId)
}

export function getCategoryLabel(categoryId: CategoryId): string {
  return CATEGORY_MAP[categoryId]?.label ?? categoryId
}
