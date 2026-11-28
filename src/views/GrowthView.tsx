import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { PLATFORMS, type PlatformId } from '../data/words'
import type { DetectResult } from '../lib/detector'
import { readJson, writeJson } from '../lib/storage'
import { readCalendarPosts } from './CalendarView'

const KEYWORDS_KEY = 'operations-publishing-hub.keywords'

type Tab = 'topics' | 'patterns' | 'draft' | 'attribution'

interface Props {
  onCheck: (text: string) => DetectResult | null
  onSendToChecker: (text: string) => void
}

const IDEA_TEMPLATES = [
  (word: string) => `${word}怎么选：3 个关键点`,
  (word: string) => `${word}实测体验，真实感受分享`,
  (word: string) => `${word}避坑指南，买前先看`,
  (word: string) => `新手入门 ${word}，一篇讲清楚`,
]

const DRAFT_TEMPLATES: Record<PlatformId, (word: string) => string> = {
  general: (word) => `今天聊聊${word}。\n\n从实际使用来看，重点看三点：易用性、耐用性和售后。每个人的需求不同，建议按自己的场景选择。`,
  xhs: (word) => `最近在认真研究${word}，把自己的体验整理出来了。\n\n① 外观和手感\n② 实际使用感受\n③ 适合什么人\n\n欢迎评论区交流，也欢迎补充你们的经验。\n\n#好物分享 #真实体验 #日常记录`,
  douyin: (word) => `三分钟讲清楚${word}怎么选。\n\n第一看配置，第二看口碑，第三看售后。看完记得收藏，下次用得上。\n\n#短视频推荐 #实用分享`,
  xianyu: (word) => `转让${word}，成色如图，功能正常。\n\n价格见标价，可小刀，不包邮。有问题欢迎留言，看到都会回。`,
}

function firstReplacement(suggestion?: string): string | null {
  if (!suggestion) return null
  const value = suggestion.split(' / ')[0].split('，')[0].trim()
  return value || null
}

function analysePost(text: string) {
  return {
    length: text.trim().length,
    hashtags: (text.match(/#[^\s#]+/g) ?? []).length,
    emoji: (text.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) ?? []).length,
    cta: /(购买|下单|链接|私信|评论|关注|收藏|留言)/.test(text),
    hook: text.trim().slice(0, 18),
  }
}

interface AttributionRow {
  content: string
  conversions: number
  revenue: number
}

export default function GrowthView({ onCheck, onSendToChecker }: Props) {
  const [tab, setTab] = useState<Tab>('topics')
  const [keywords, setKeywords] = useState<string[]>(() => readJson<string[]>(KEYWORDS_KEY, []))
  const [keywordInput, setKeywordInput] = useState('')
  const [sampleText, setSampleText] = useState('')
  const [draftKeyword, setDraftKeyword] = useState('')
  const [draftPlatform, setDraftPlatform] = useState<PlatformId>('xhs')
  const [draft, setDraft] = useState('')
  const [draftCheck, setDraftCheck] = useState<DetectResult | null>(null)
  const [attribution, setAttribution] = useState<AttributionRow[]>([])
  const [notice, setNotice] = useState('')
  const attributionFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    writeJson(KEYWORDS_KEY, keywords)
  }, [keywords])
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 2600)
    return () => window.clearTimeout(timer)
  }, [notice])

  const ideas = useMemo(
    () => keywords.flatMap((word) => IDEA_TEMPLATES.map((template) => template(word))),
    [keywords],
  )

  const analysis = useMemo(() => {
    const posts = sampleText.split(/\n\s*\n+/).map((item) => item.trim()).filter(Boolean)
    if (posts.length === 0) return null
    const rows = posts.map(analysePost)
    const avg = (key: 'length' | 'hashtags' | 'emoji') =>
      Math.round(rows.reduce((sum, row) => sum + row[key], 0) / rows.length)
    const ctaCount = rows.filter((row) => row.cta).length
    return { count: rows.length, length: avg('length'), hashtags: avg('hashtags'), emoji: avg('emoji'), ctaCount, rows }
  }, [sampleText])

  function addKeyword() {
    const value = keywordInput.trim()
    if (!value || keywords.includes(value)) return
    setKeywords((prev) => [value, ...prev])
    setDraftKeyword(value)
    setKeywordInput('')
  }

  function generateDraft() {
    const word = draftKeyword.trim()
    if (!word) {
      setNotice('请先填写草稿关键词')
      return
    }
    let next = DRAFT_TEMPLATES[draftPlatform](word)
    const checked = onCheck(next)
    if (checked) {
      for (const hit of checked.hits) {
        const replacement = firstReplacement(hit.suggestion)
        if (replacement) next = next.split(hit.word).join(replacement)
      }
      setDraftCheck(onCheck(next))
    } else {
      setDraftCheck(null)
    }
    setDraft(next)
    setNotice('草稿已生成并完成合规预检')
  }

  function importAttribution(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const lines = String(reader.result ?? '').replace(/\r/g, '').split('\n').filter((line) => line.trim())
      const hasHeader = lines[0]?.toLowerCase().includes('content')
      const rows = (hasHeader ? lines.slice(1) : lines).map((line) => {
        const [content = '', conversions = '0', revenue = '0'] = line.split(',')
        return {
          content: content.replace(/^"|"$/g, '').trim(),
          conversions: Number(conversions) || 0,
          revenue: Number(revenue.replace(/[^\d.-]/g, '')) || 0,
        }
      }).filter((row) => row.content)
      if (rows.length === 0) {
        setNotice('CSV 中没有可读取的数据')
        return
      }
      setAttribution(rows)
      setNotice(`已导入 ${rows.length} 条归因数据`)
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  return (
    <div className="view-panel">
      <div className="view-heading">
        <div>
          <h2>增长实验室</h2>
          <p>选题、爆款结构拆解、本地草稿生成与转化归因</p>
        </div>
      </div>

      <div className="sub-tabs">
        {([
          ['topics', '选题发现'],
          ['patterns', '爆款拆解'],
          ['draft', '草稿生成'],
          ['attribution', '转化归因'],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === 'topics' && (
        <div className="growth-section">
          <div className="form-grid compact">
            <label>
              关键词
              <input value={keywordInput} onChange={(event) => setKeywordInput(event.target.value)} placeholder="例如：通勤包" />
            </label>
            <div className="form-actions inline">
              <button type="button" className="btn btn-primary" onClick={addKeyword} disabled={!keywordInput.trim()}>添加并生成选题</button>
            </div>
          </div>
          {ideas.length === 0 ? (
            <div className="view-empty">添加关键词后，会自动生成一批可写的选题角度。</div>
          ) : (
            <div className="idea-list">
              {ideas.map((idea, index) => (
                <div key={`${idea}-${index}`} className="idea-item">
                  <span>{idea}</span>
                  <button type="button" className="btn btn-ghost btn-small" onClick={() => { setDraftKeyword(keywords[Math.floor(index / IDEA_TEMPLATES.length)] ?? ''); setTab('draft') }}>用于草稿</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'patterns' && (
        <div className="growth-section">
          <div className="form-grid compact">
            <label className="full">
              粘贴样本文案（用空行分隔）
              <textarea value={sampleText} onChange={(event) => setSampleText(event.target.value)} rows={8} placeholder="把 3-10 条你觉得写得好的文案粘进来…" />
            </label>
          </div>
          {!analysis ? (
            <div className="view-empty">粘贴样本文案后，这里会给出结构化拆解。</div>
          ) : (
            <div className="pattern-report">
              <div className="metric-grid">
                <div className="metric-card"><span>样本数</span><strong>{analysis.count}</strong></div>
                <div className="metric-card"><span>平均字数</span><strong>{analysis.length}</strong></div>
                <div className="metric-card"><span>平均话题</span><strong>{analysis.hashtags}</strong></div>
                <div className="metric-card"><span>含引导</span><strong>{analysis.ctaCount}/{analysis.count}</strong></div>
              </div>
              <ul className="suggestion-list">
                {analysis.hashtags < 3 && <li>平均话题数偏少，可以补充 3 个左右的相关标签。</li>}
                {analysis.ctaCount < analysis.count / 2 && <li>多数样本缺少互动引导，可以在结尾加一句提问或收藏提示。</li>}
                {analysis.length > 300 && <li>样本偏长，短视频场景建议压缩到 300 字以内。</li>}
                {analysis.emoji === 0 && <li>样本几乎没有表情符号，可适当增加视觉节奏。</li>}
                <li>常见开头：{analysis.rows.slice(0, 3).map((row) => `「${row.hook}」`).join('、')}</li>
              </ul>
            </div>
          )}
        </div>
      )}

      {tab === 'draft' && (
        <div className="growth-section">
          <div className="form-grid compact">
            <label>
              关键词
              <input value={draftKeyword} onChange={(event) => setDraftKeyword(event.target.value)} placeholder="例如：通勤包" />
            </label>
            <label>
              目标平台
              <select value={draftPlatform} onChange={(event) => setDraftPlatform(event.target.value as PlatformId)}>
                {PLATFORMS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
            <div className="form-actions inline">
              <button type="button" className="btn btn-primary" onClick={generateDraft}>生成本地草稿</button>
            </div>
          </div>
          <div className="p1-note">草稿由本地模板生成，不调用外部模型；生成后会自动做一次违禁词预检。</div>
          {draft && (
            <>
              <textarea className="draft-text" value={draft} onChange={(event) => setDraft(event.target.value)} rows={10} />
              <div className="draft-result">
                {draftCheck ? (
                  <span className={`risk-badge small risk-${draftCheck.riskLevel}`}>{draftCheck.riskLabel} · {draftCheck.total} 处命中</span>
                ) : (
                  <span className="status-pill">未检测</span>
                )}
                <button type="button" className="btn btn-secondary btn-small" onClick={() => onSendToChecker(draft)}>送到检测台</button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'attribution' && (
        <div className="growth-section">
          <div className="view-heading subheading">
            <p>CSV 列顺序：content,conversions,revenue</p>
            <button type="button" className="btn btn-secondary btn-small" onClick={() => attributionFileRef.current?.click()}>导入 CSV</button>
            <input ref={attributionFileRef} type="file" accept=".csv,text/csv" onChange={importAttribution} hidden />
          </div>
          {attribution.length === 0 ? (
            <div className="view-empty">导入数据后，可以看到每篇内容带来的转化与收入。</div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead><tr><th>内容</th><th>转化</th><th>收入</th><th>排期</th></tr></thead>
                <tbody>
                  {attribution.map((row, index) => {
                    const linked = readCalendarPosts().find((post) => post.title === row.content.trim())
                    return (
                      <tr key={`${row.content}-${index}`}>
                        <td>{row.content}</td>
                        <td>{row.conversions}</td>
                        <td>¥{row.revenue.toLocaleString('zh-CN')}</td>
                        <td>{linked ? `${linked.date} · 已关联` : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {notice && <div className="toast">{notice}</div>}
    </div>
  )
}
