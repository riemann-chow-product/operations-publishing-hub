import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
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

const STORAGE_KEY = 'operations-publishing-hub.custom-words'

function readStoredCustomWords(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
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

function App() {
  const [platform, setPlatform] = useState<PlatformId>('general')
  const [text, setText] = useState('')
  const [customRaw, setCustomRaw] = useState(readStoredCustomWords)
  const [result, setResult] = useState<DetectResult | null>(null)
  const [notice, setNotice] = useState('')
  const [focusedWord, setFocusedWord] = useState('')
  const [showCustom, setShowCustom] = useState(true)

  const custom = useMemo(() => parseCustomWords(customRaw), [customRaw])
  const availableCategories = useMemo(
    () => getActiveCategories(platform, custom.words.length > 0),
    [platform, custom.words.length],
  )
  const [enabledCategories, setEnabledCategories] = useState<CategoryId[]>(() =>
    getActiveCategories('general', false).map((category) => category.id),
  )

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
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 2600)
    return () => window.clearTimeout(timer)
  }, [notice])

  const platformLabel = PLATFORMS.find((item) => item.id === platform)?.label ?? '通用合规'

  function runDetect() {
    if (!text.trim()) {
      setNotice('请先输入需要检测的文本')
      return
    }

    const availableIds = new Set(availableCategories.map((category) => category.id))
    const active = enabledCategories.filter((id) => availableIds.has(id))

    if (active.length === 0) {
      setNotice('请至少启用一个检测分类')
      return
    }

    setResult(
      detectWords({
        text,
        platform,
        enabledCategories: active,
        customWords: custom.words,
      }),
    )
    setFocusedWord('')
    setNotice('检测完成')
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
    setText(EXAMPLE_TEXT)
    setCustomRaw(EXAMPLE_CUSTOM_WORDS)
    setResult(null)
    setNotice('已填入示例内容')
  }

  function clearAll() {
    setText('')
    setResult(null)
    setFocusedWord('')
    setNotice('已清空文案')
  }

  async function copyReport() {
    if (!result) return

    const lines = [
      '【运营发布台 · 违禁词检测报告】',
      `检测平台：${platformLabel}`,
      `风险等级：${result.riskLabel}`,
      `命中情况：${result.total} 处，涉及 ${result.unique} 个词`,
      '',
      ...(result.hits.length > 0
        ? result.hits.map(
            (hit, index) =>
              `${index + 1}. ${hit.word}｜${getCategoryLabel(hit.category)}｜出现 ${hit.count} 处` +
              (hit.suggestion ? `｜建议替换为：${hit.suggestion}` : ''),
          )
        : ['未发现命中词汇']),
      '',
      '注：检测结果仅供参考，请以平台最新审核规则为准。',
    ]

    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setNotice('检测报告已复制')
    } catch {
      setNotice('复制失败，请检查浏览器权限')
    }
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
          <div className="topbar-meta">
            <span className="privacy-pill">
              <span className="privacy-dot" />
              本地检测 · 文案不上传
            </span>
          </div>
        </div>
      </header>

      <main className="page">
        <section className="hero">
          <div className="hero-left">
            <div className="eyebrow">COMPLIANCE CHECK</div>
            <h1>违禁词检测</h1>
            <p>发布前扫一遍文案，筛出极限词、虚假宣传、引流诱导等风险表达。</p>
          </div>
          <div className="hero-right">
            <div className="stat-tile">
              <span className="stat-value">{CATEGORIES.length - 1}</span>
              <span className="stat-label">内置分类</span>
            </div>
            <div className="stat-tile">
              <span className="stat-value">本地</span>
              <span className="stat-label">检测模式</span>
            </div>
          </div>
        </section>

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
              <span className="counter">{text.length} 字</span>
            </div>

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
                </div>
              )}
            </div>
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

            {!result ? (
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
}: {
  hit: Hit
  focused: boolean
  onFocus: () => void
  onBlur: () => void
}) {
  const tone = CATEGORIES.find((category) => category.id === hit.category)?.tone ?? 'slate'
  const firstPosition = hit.positions[0]?.start ?? 0

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
