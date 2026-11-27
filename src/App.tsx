import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import {
  CATEGORIES,
  EXAMPLE_CUSTOM_WORDS,
  EXAMPLE_TEXT,
  PLATFORMS,
  getActiveCategories,
  type CategoryId,
  type PlatformId,
  type WordCategory,
} from './data/words'
import {
  countCategoryWords,
  detectWords,
  getCategoryLabel,
  parseCustomWords,
  type DetectResult,
  type Hit,
} from './lib/detector'
import ChecklistPanel from './components/ChecklistPanel'
import TemplatePanel from './components/TemplatePanel'
import { adaptCopy } from './lib/adapter'
import CalendarView from './views/CalendarView'
import AlertsView from './views/AlertsView'
import AnalyticsView from './views/AnalyticsView'
import GrowthView from './views/GrowthView'

type ViewId = 'checker' | 'calendar' | 'alerts' | 'analytics' | 'growth'

const VIEWS: Array<{
  id: ViewId
  label: string
  eyebrow: string
  title: string
  description: string
}> = [
  {
    id: 'checker',
    label: '违禁词检测',
    eyebrow: 'COMPLIANCE CHECK',
    title: '违禁词检测',
    description: '发布前扫一遍文案，筛出极限词、虚假宣传、引流诱导等风险表达。',
  },
  {
    id: 'calendar',
    label: '发布日历',
    eyebrow: 'PUBLISHING SCHEDULE',
    title: '发布日历',
    description: '把多账号、多平台的内容排进日历，提前发现时间冲突。',
  },
  {
    id: 'alerts',
    label: '互动提醒',
    eyebrow: 'AUDIENCE SIGNALS',
    title: '互动提醒',
    description: '集中查看评论和私信，第一时间发现需要跟进的负面反馈。',
  },
  {
    id: 'analytics',
    label: '数据看板',
    eyebrow: 'PERFORMANCE',
    title: '数据看板',
    description: '把各平台的数据汇总到一处，快速看清内容和渠道表现。',
  },
  {
    id: 'growth',
    label: '增长实验室',
    eyebrow: 'GROWTH LAB',
    title: '增长实验室',
    description: '从选题、爆款结构到本地草稿与转化归因，补齐增长链路。',
  },
]

const STORAGE_KEY = 'operations-publishing-hub.custom-words'
const HISTORY_KEY = 'operations-publishing-hub.history'
const MAX_HISTORY = 50

type Mode = 'single' | 'batch'

interface HistoryItem {
  id: string
  at: string
  platform: PlatformId
  text: string
  total: number
  unique: number
  riskLevel: DetectResult['riskLevel']
  riskLabel: string
}

interface BatchItem {
  text: string
  result: DetectResult
}

function readStoredCustomWords(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

function readHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY) : []
  } catch {
    return []
  }
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function firstReplacement(suggestion?: string): string | null {
  if (!suggestion) return null
  const value = suggestion.split(' / ')[0].split('，')[0].trim()
  return value || null
}

function parseBatch(raw: string): string[] {
  return raw
    .split(/\n\s*\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseCsv(raw: string): string[] {
  const lines = raw.replace(/\r/g, '').split('\n').filter((line) => line.trim())
  if (lines.length === 0) return []

  const header = lines[0].toLowerCase()
  if (header.includes('text') || header.includes('content') || header.includes('文案')) {
    lines.shift()
  }

  return lines
    .map((line) => line.replace(/^"|"$/g, '').replace(/""/g, '"').trim())
    .filter(Boolean)
}

function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16.5 16.5 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15 5H6a2 2 0 0 0-2 2v9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M18.5 15.5 19.2 18l2.3.8-2.3.7-.7 2.5-.7-2.5-2.3-.7 2.3-.8.7-2.5Z" fill="currentColor" />
    </svg>
  )
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 16V4m0 0L7 9m5-5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4v12m0 0 5-5m-5 5-5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function App() {
  const [view, setView] = useState<ViewId>('checker')
  const [mode, setMode] = useState<Mode>('single')
  const [platform, setPlatform] = useState<PlatformId>('general')
  const [text, setText] = useState('')
  const [batchText, setBatchText] = useState('')
  const [customRaw, setCustomRaw] = useState(readStoredCustomWords)
  const [result, setResult] = useState<DetectResult | null>(null)
  const [batchItems, setBatchItems] = useState<BatchItem[]>([])
  const [history, setHistory] = useState<HistoryItem[]>(readHistory)
  const [notice, setNotice] = useState('')
  const [focusedWord, setFocusedWord] = useState('')
  const [showCustom, setShowCustom] = useState(true)
  const dictionaryInputRef = useRef<HTMLInputElement>(null)
  const csvInputRef = useRef<HTMLInputElement>(null)

  const custom = useMemo(() => parseCustomWords(customRaw), [customRaw])
  const availableCategories = useMemo(
    () => getActiveCategories(platform, custom.words.length > 0),
    [platform, custom.words.length],
  )
  const [enabledCategories, setEnabledCategories] = useState<CategoryId[]>(() =>
    getActiveCategories('general', false).map((category) => category.id),
  )

  const platformLabel = PLATFORMS.find((item) => item.id === platform)?.label ?? '通用合规'
  const currentView = VIEWS.find((item) => item.id === view) ?? VIEWS[0]
  const batchCount = parseBatch(batchText).length

  useEffect(() => {
    setEnabledCategories(getActiveCategories(platform, custom.words.length > 0).map((category) => category.id))
    // 平台切换时重置分类勾选；自定义词库变化由下方逻辑单独处理
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform])

  useEffect(() => {
    if (custom.words.length === 0) return
    setEnabledCategories((prev) => (prev.includes('custom') ? prev : [...prev, 'custom']))
  }, [custom.words.length])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, customRaw)
    } catch {
      // 隐私模式下无法写入，忽略即可
    }
  }, [customRaw])

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
    } catch {
      // 超出配额时忽略，不影响检测
    }
  }, [history])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 2600)
    return () => window.clearTimeout(timer)
  }, [notice])

  function detectText(input: string): DetectResult | null {
    const availableIds = new Set(availableCategories.map((category) => category.id))
    const active = enabledCategories.filter((id) => availableIds.has(id))
    if (active.length === 0) return null

    return detectWords({
      text: input,
      platform,
      enabledCategories: active,
      customWords: custom.words,
    })
  }

  function addHistory(entries: Array<{ text: string; result: DetectResult }>) {
    const items: HistoryItem[] = entries.map(({ text: entryText, result: entryResult }) => ({
      id: makeId(),
      at: new Date().toLocaleString('zh-CN', { hour12: false }),
      platform,
      text: entryText,
      total: entryResult.total,
      unique: entryResult.unique,
      riskLevel: entryResult.riskLevel,
      riskLabel: entryResult.riskLabel,
    }))
    setHistory((prev) => [...items, ...prev].slice(0, MAX_HISTORY))
  }

  function runDetect() {
    if (mode === 'single') {
      if (!text.trim()) {
        setNotice('请先输入需要检测的文本')
        return
      }
      const next = detectText(text)
      if (!next) {
        setNotice('请至少启用一个检测分类')
        return
      }
      setResult(next)
      setBatchItems([])
      addHistory([{ text, result: next }])
      setFocusedWord('')
      setNotice('检测完成')
      return
    }

    const items = parseBatch(batchText)
    if (items.length === 0) {
      setNotice('请先输入批量文案，或用空行分隔多段文本')
      return
    }
    if (detectText('测试') === null) {
      setNotice('请至少启用一个检测分类')
      return
    }

    const results = items.map((item) => ({ text: item, result: detectText(item)! }))
    const total = results.reduce((sum, item) => sum + item.result.total, 0)
    const unique = results.reduce((sum, item) => sum + item.result.unique, 0)
    const riskLevel: DetectResult['riskLevel'] = total >= 8 ? 'high' : total >= 3 ? 'medium' : 'low'
    const summary: DetectResult = {
      hits: [],
      segments: [],
      total,
      unique,
      riskLevel,
      riskLabel: riskLevel === 'high' ? '高风险' : riskLevel === 'medium' ? '中风险' : '低风险',
      scannedWords: results[0]?.result.scannedWords ?? 0,
      textLength: items.reduce((sum, item) => sum + item.length, 0),
    }

    setBatchItems(results)
    setResult(null)
    addHistory([{ text: `批量检测（${items.length} 条）`, result: summary }])
    setNotice(`已完成 ${items.length} 条文案检测`)
  }

  function handleTextKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      runDetect()
    }
  }

  function toggleCategory(id: CategoryId) {
    setEnabledCategories((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  function loadExample() {
    if (mode === 'batch') {
      setBatchText(`${EXAMPLE_TEXT}\n\n全网第一，最好用，扫码加微信领取。`)
    } else {
      setText(EXAMPLE_TEXT)
    }
    setCustomRaw(EXAMPLE_CUSTOM_WORDS)
    setResult(null)
    setBatchItems([])
    setNotice('已填入示例内容')
  }

  function clearAll() {
    if (mode === 'batch') {
      setBatchText('')
      setBatchItems([])
    } else {
      setText('')
      setResult(null)
    }
    setFocusedWord('')
    setNotice('已清空文案')
  }

  function applySuggestion(hit: Hit) {
    const replacement = firstReplacement(hit.suggestion)
    if (!replacement) return

    const next = text.split(hit.word).join(replacement)
    if (next === text) {
      setNotice('未找到可替换的文本')
      return
    }

    setText(next)
    const checked = detectText(next)
    if (checked) setResult(checked)
    setNotice(`已将「${hit.word}」替换为「${replacement}」`)
  }

  function adaptCurrent() {
    const source = mode === 'single' ? text : batchText
    if (!source.trim()) {
      setNotice('请先输入需要适配的文案')
      return
    }
    const adapted = adaptCopy(source, platform)
    setMode('single')
    setText(adapted)
    setResult(detectText(adapted))
    setBatchItems([])
    setNotice('已按当前平台适配并完成检测')
  }

  function loadTemplate(content: string) {
    setMode('single')
    setText(content)
    setResult(detectText(content))
    setBatchItems([])
    setNotice('模板已载入')
  }

  function sendToChecker(content: string) {
    setView('checker')
    setMode('single')
    setText(content)
    setResult(detectText(content))
    setBatchItems([])
    setNotice('草稿已送到检测台')
  }

  async function copyReport() {
    if (!result) return
    const lines = buildReport(result)
    try {
      await navigator.clipboard.writeText(lines)
      setNotice('检测报告已复制')
    } catch {
      setNotice('复制失败，请检查浏览器权限')
    }
  }

  function buildReport(entry: DetectResult): string {
    return [
      '【运营发布台 · 违禁词检测报告】',
      `检测平台：${platformLabel}`,
      `风险等级：${entry.riskLabel}`,
      `命中情况：${entry.total} 处，涉及 ${entry.unique} 个词`,
      '',
      ...(entry.hits.length > 0
        ? entry.hits.map(
            (hit, index) =>
              `${index + 1}. ${hit.word}｜${getCategoryLabel(hit.category)}｜出现 ${hit.count} 处` +
              (hit.suggestion ? `｜建议替换为：${hit.suggestion}` : ''),
          )
        : ['未发现命中词汇']),
      '',
      '注：检测结果仅供参考，请以平台最新审核规则为准。',
    ].join('\n')
  }

  function exportDictionary() {
    const payload = JSON.stringify({ version: 1, words: custom.words }, null, 2)
    downloadFile('operations-publishing-hub-dictionary.json', payload, 'application/json')
    setNotice('词库已导出')
  }

  function importDictionary(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const raw = String(reader.result ?? '')
      let words: string[] = []
      try {
        const parsed = JSON.parse(raw)
        words = Array.isArray(parsed)
          ? parsed.map(String)
          : Array.isArray(parsed.words)
            ? parsed.words.map(String)
            : []
      } catch {
        words = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
      }
      if (words.length === 0) {
        setNotice('文件中没有可导入的词')
        return
      }
      setCustomRaw(words.join('\n'))
      setNotice(`已导入 ${words.length} 个自定义词`)
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const items = parseCsv(String(reader.result ?? ''))
      if (items.length === 0) {
        setNotice('CSV 中没有可导入的文案')
        return
      }
      setBatchText(items.join('\n\n'))
      setMode('batch')
      setBatchItems([])
      setNotice(`已导入 ${items.length} 条文案`)
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  function exportHistory() {
    if (history.length === 0) return
    const rows = [
      ['time', 'platform', 'text', 'total', 'unique', 'risk'].join(','),
      ...history.map((item) =>
        [
          item.at,
          item.platform,
          `"${item.text.replace(/"/g, '""')}"`,
          item.total,
          item.unique,
          item.riskLabel,
        ].join(','),
      ),
    ]
    downloadFile('operations-publishing-hub-history.csv', rows.join('\n'), 'text/csv;charset=utf-8')
    setNotice('检测历史已导出')
  }

  function restoreHistory(item: HistoryItem) {
    setMode('single')
    setText(item.text)
    const checked = detectText(item.text)
    setResult(checked)
    setBatchItems([])
    setFocusedWord('')
    setNotice('已载入该条检测记录')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <div className="brand-mark">运</div>
            <div>
              <div className="brand-title">运营发布台</div>
              <div className="brand-subtitle">内容合规 · 发布前自检</div>
            </div>
          </div>
        </div>
      </header>

      <main className="page">
        <section className="hero">
          <div className="hero-left">
            <div className="eyebrow">{currentView.eyebrow}</div>
            <h1>{currentView.title}</h1>
            <p>{currentView.description}</p>
          </div>
          <div className="hero-right">
            <div className="stat-tile">
              <span className="stat-value">{CATEGORIES.length - 1}</span>
              <span className="stat-label">内置分类</span>
            </div>
            <div className="stat-tile">
              <span className="stat-value">{history.length}</span>
              <span className="stat-label">历史记录</span>
            </div>
          </div>
        </section>

        <nav className="view-nav" aria-label="工作台模块">
          {VIEWS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={view === item.id ? 'active' : ''}
              onClick={() => setView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {view === 'checker' && (
        <>
        <section className="panel config-panel">
          <div className="config-row">
            <div className="config-label">检测平台</div>
            <div className="platform-tabs" role="tablist" aria-label="检测平台">
              {PLATFORMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={platform === item.id}
                  className={`platform-tab ${platform === item.id ? 'active' : ''}`}
                  onClick={() => setPlatform(item.id)}
                >
                  <strong>{item.label}</strong>
                  <span>{item.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="config-row categories-row">
            <div className="config-label">检测分类</div>
            <div className="category-list">
              {availableCategories.map((category) => (
                <CategoryChip
                  key={category.id}
                  category={category}
                  active={enabledCategories.includes(category.id)}
                  count={countCategoryWords(category.id, custom.words)}
                  onClick={() => toggleCategory(category.id)}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="workspace">
          <div className="panel editor-panel">
            <div className="panel-heading">
              <div>
                <h2>需要检测的文本</h2>
                <p>支持粘贴长文案；连续按 ⌘/Ctrl + Enter 快速检测</p>
              </div>
              <div className="mode-switch" role="tablist" aria-label="检测模式">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'single'}
                  className={mode === 'single' ? 'active' : ''}
                  onClick={() => setMode('single')}
                >
                  单条
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'batch'}
                  className={mode === 'batch' ? 'active' : ''}
                  onClick={() => setMode('batch')}
                >
                  批量
                </button>
              </div>
            </div>

            {mode === 'single' ? (
              <>
                <textarea
                  className="text-input"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  onKeyDown={handleTextKeyDown}
                  placeholder="在这里粘贴小红书笔记、短视频口播稿、商品描述等文案…"
                  spellCheck={false}
                />
                <div className="editor-actions">
                  <button type="button" className="btn btn-primary" onClick={runDetect}>
                    <SearchIcon />
                    开始检测
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={loadExample}>
                    <SparkleIcon />
                    填入示例
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={clearAll}>
                    清空
                  </button>
                </div>
              </>
            ) : (
              <>
                <textarea
                  className="text-input"
                  value={batchText}
                  onChange={(event) => setBatchText(event.target.value)}
                  onKeyDown={handleTextKeyDown}
                  placeholder={'每段文案之间用空行分隔，或导入 CSV / TXT 文件…\n\n例如：\n第一段文案\n\n第二段文案'}
                  spellCheck={false}
                />
                <div className="editor-actions">
                  <button type="button" className="btn btn-primary" onClick={runDetect}>
                    <SearchIcon />
                    批量检测
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => csvInputRef.current?.click()}>
                    <UploadIcon />
                    导入 CSV / TXT
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={loadExample}>
                    <SparkleIcon />
                    填入示例
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={clearAll}>
                    清空
                  </button>
                  <input
                    ref={csvInputRef}
                    type="file"
                    accept=".csv,.txt,text/csv,text/plain"
                    onChange={importCsv}
                    hidden
                  />
                  <span className="action-hint">已解析 {batchCount} 条</span>
                </div>
              </>
            )}

            <div className="custom-section">
              <button
                type="button"
                className="custom-toggle"
                onClick={() => setShowCustom((value) => !value)}
                aria-expanded={showCustom}
              >
                <span className={`chevron ${showCustom ? 'open' : ''}`}>›</span>
                自定义违禁词库
                <span className="custom-hint">一行一个 · 最多 1000 行 · 自动保存在本机</span>
              </button>

              {showCustom && (
                <div className="custom-body">
                  <textarea
                    className="custom-input"
                    value={customRaw}
                    onChange={(event) => setCustomRaw(event.target.value)}
                    placeholder={'例如：\nABC产品\n不二之选'}
                    spellCheck={false}
                  />
                  <div className="custom-count">
                    已识别 {custom.words.length} 个自定义词
                    {custom.errors.length > 0 && (
                      <span className="custom-error">{custom.errors[0]}</span>
                    )}
                  </div>
                  <div className="custom-actions">
                    <button type="button" className="btn btn-secondary btn-small" onClick={() => dictionaryInputRef.current?.click()}>
                      <UploadIcon />
                      导入词库
                    </button>
                    <button type="button" className="btn btn-secondary btn-small" onClick={exportDictionary}>
                      <DownloadIcon />
                      导出词库
                    </button>
                    <input
                      ref={dictionaryInputRef}
                      type="file"
                      accept=".json,.txt,application/json,text/plain"
                      onChange={importDictionary}
                      hidden
                    />
                  </div>
                </div>
              )}
            </div>

            <ChecklistPanel
              platform={platform}
              text={mode === 'single' ? text : batchText}
              onAdapt={adaptCurrent}
            />
            <TemplatePanel currentText={mode === 'single' ? text : batchText} onLoad={loadTemplate} />
          </div>

          <div className="panel result-panel">
            <div className="panel-heading">
              <div>
                <h2>检测结果</h2>
                <p>命中词会在原文中高亮，点击词条可定位</p>
              </div>
              {result && (
                <button type="button" className="btn btn-secondary btn-small" onClick={copyReport}>
                  <CopyIcon />
                  复制报告
                </button>
              )}
            </div>

            {batchItems.length > 0 ? (
              <BatchSummary items={batchItems} onOpen={(item) => {
                setMode('single')
                setText(item.text)
                setResult(item.result)
                setBatchItems([])
                setNotice('已切换到单条视图')
              }} />
            ) : !result ? (
              <EmptyState />
            ) : (
              <div className="result-content">
                <div className="summary-bar">
                  <div className={`risk-badge risk-${result.riskLevel}`}>{result.riskLabel}</div>
                  <div className="summary-metrics">
                    <div>
                      <strong>{result.total}</strong>
                      <span>命中次数</span>
                    </div>
                    <div>
                      <strong>{result.unique}</strong>
                      <span>命中词数</span>
                    </div>
                    <div>
                      <strong>{result.scannedWords}</strong>
                      <span>扫描词库</span>
                    </div>
                  </div>
                </div>

                {result.hits.length === 0 ? (
                  <div className="safe-state">
                    <div className="safe-icon">✓</div>
                    <strong>未发现风险词</strong>
                    <span>当前词库与分类下，这篇文案没有命中违禁词。</span>
                  </div>
                ) : (
                  <>
                    <div className="result-block">
                      <div className="block-title">
                        <span>高亮预览</span>
                        <span className="block-note">{result.textLength} 字</span>
                      </div>
                      <div className="preview-text">
                        {result.segments.map((segment, index) =>
                          segment.hit ? (
                            <mark
                              key={index}
                              className={`hit-mark ${focusedWord && focusedWord !== segment.hit.word ? 'dimmed' : ''} ${focusedWord === segment.hit.word ? 'focused' : ''}`}
                              title={`${getCategoryLabel(segment.hit.category)}${segment.hit.suggestion ? ` · 建议：${segment.hit.suggestion}` : ''}`}
                            >
                              {segment.text}
                            </mark>
                          ) : (
                            <span key={index}>{segment.text}</span>
                          ),
                        )}
                      </div>
                    </div>

                    <div className="result-block">
                      <div className="block-title">
                        <span>命中词汇</span>
                        <span className="block-note">按出现顺序排列</span>
                      </div>
                      <div className="hit-list">
                        {result.hits.map((hit) => (
                          <HitCard
                            key={`${hit.source}:${hit.word}`}
                            hit={hit}
                            focused={focusedWord === hit.word}
                            onFocus={() => setFocusedWord(hit.word)}
                            onBlur={() => setFocusedWord('')}
                            onReplace={() => applySuggestion(hit)}
                          />
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="panel history-panel">
          <div className="panel-heading">
            <div>
              <h2>检测历史</h2>
              <p>最近 {history.length} 条记录保存在本机，可随时回看</p>
            </div>
            <div className="history-actions">
              <button type="button" className="btn btn-secondary btn-small" onClick={exportHistory} disabled={history.length === 0}>
                <DownloadIcon />
                导出 CSV
              </button>
              <button type="button" className="btn btn-ghost btn-small" onClick={() => setHistory([])} disabled={history.length === 0}>
                清空
              </button>
            </div>
          </div>
          {history.length === 0 ? (
            <div className="history-empty">还没有检测记录。运行一次检测后会自动出现在这里。</div>
          ) : (
            <div className="history-list">
              {history.slice(0, 8).map((item) => (
                <button key={item.id} type="button" className="history-item" onClick={() => restoreHistory(item)}>
                  <span className={`risk-dot risk-${item.riskLevel}`} />
                  <span className="history-text">{item.text}</span>
                  <span className="history-meta">{item.at} · {item.platform}</span>
                  <span className="history-count">{item.total} 处</span>
                </button>
              ))}
            </div>
          )}
        </section>
        </>
        )}

        {view === 'calendar' && <CalendarView />}
        {view === 'alerts' && <AlertsView />}
        {view === 'analytics' && <AnalyticsView />}
        {view === 'growth' && <GrowthView onCheck={detectText} onSendToChecker={sendToChecker} />}

        <footer className="footer">
          检测结果基于内置规则和自定义词库，仅供发布前参考，最终以各平台最新审核规则为准。
        </footer>
      </main>

      {notice && <div className="toast">{notice}</div>}
    </div>
  )
}

function CategoryChip({
  category,
  active,
  count,
  onClick,
}: {
  category: WordCategory
  active: boolean
  count: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`category-chip ${active ? 'active' : ''}`}
      onClick={onClick}
      aria-pressed={active}
    >
      <span className={`chip-dot tone-${category.tone}`} />
      <span>{category.label}</span>
      <span className="chip-count">{count}</span>
    </button>
  )
}

function HitCard({
  hit,
  focused,
  onFocus,
  onBlur,
  onReplace,
}: {
  hit: Hit
  focused: boolean
  onFocus: () => void
  onBlur: () => void
  onReplace: () => void
}) {
  const tone = CATEGORIES.find((category) => category.id === hit.category)?.tone ?? 'slate'
  const firstPosition = hit.positions[0]?.start ?? 0
  const replacement = firstReplacement(hit.suggestion)

  return (
    <div
      className={`hit-card ${focused ? 'focused' : ''}`}
      onMouseEnter={onFocus}
      onMouseLeave={onBlur}
    >
      <div className="hit-card-top">
        <strong className="hit-word">{hit.word}</strong>
        <span className={`tone-label tone-${tone}`}>{getCategoryLabel(hit.category)}</span>
        <span className="hit-count">×{hit.count}</span>
      </div>
      <div className="hit-card-bottom">
        <span>首次出现于第 {firstPosition + 1} 字</span>
        {hit.suggestion && <span className="hit-suggestion">建议：{hit.suggestion}</span>}
        {replacement && (
          <button type="button" className="replace-btn" onClick={onReplace}>
            一键替换
          </button>
        )}
      </div>
    </div>
  )
}

function BatchSummary({ items, onOpen }: { items: BatchItem[]; onOpen: (item: BatchItem) => void }) {
  const total = items.reduce((sum, item) => sum + item.result.total, 0)
  const risky = items.filter((item) => item.result.total > 0).length

  return (
    <div className="result-content">
      <div className="summary-bar">
        <div className="risk-badge risk-medium">批量完成</div>
        <div className="summary-metrics">
          <div>
            <strong>{items.length}</strong>
            <span>检测条数</span>
          </div>
          <div>
            <strong>{risky}</strong>
            <span>风险文案</span>
          </div>
          <div>
            <strong>{total}</strong>
            <span>命中总数</span>
          </div>
        </div>
      </div>
      <div className="result-block">
        <div className="block-title">
          <span>逐条结果</span>
          <span className="block-note">点击查看详情</span>
        </div>
        <div className="batch-list">
          {items.map((item, index) => (
            <button key={index} type="button" className="batch-item" onClick={() => onOpen(item)}>
              <span className={`risk-dot risk-${item.result.riskLevel}`} />
              <span className="batch-index">#{index + 1}</span>
              <span className="batch-text">{item.text}</span>
              <span className={`risk-badge small risk-${item.result.riskLevel}`}>{item.result.riskLabel}</span>
              <span className="batch-count">{item.result.total} 处</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-illustration">
        <span>文</span>
        <div className="empty-scan" />
      </div>
      <strong>等待检测</strong>
      <span>输入文案后点击「开始检测」，<br />风险词会在这里逐条列出。</span>
    </div>
  )
}

export default App
