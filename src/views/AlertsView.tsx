import { useEffect, useState } from 'react'
import { normalizeText } from '../lib/detector'
import { makeId, readJson, writeJson } from '../lib/storage'

const KEY = 'operations-publishing-hub.alerts'
const NEGATIVE_WORDS = ['差', '垃圾', '投诉', '退款', '骗', '坑', '假货', '不好用', '失望', '举报']

interface AlertItem {
  id: string
  source: string
  author: string
  content: string
  at: string
  negative: boolean
  handled: boolean
}

function isNegative(content: string): boolean {
  const normalized = normalizeText(content)
  return NEGATIVE_WORDS.some((word) => normalized.includes(normalizeText(word)))
}

export default function AlertsView() {
  const [alerts, setAlerts] = useState<AlertItem[]>(() => readJson<AlertItem[]>(KEY, []))
  const [source, setSource] = useState('小红书')
  const [author, setAuthor] = useState('')
  const [content, setContent] = useState('')
  const [filter, setFilter] = useState<'all' | 'negative' | 'open'>('all')

  useEffect(() => {
    writeJson(KEY, alerts)
  }, [alerts])

  const visible = alerts.filter((item) =>
    filter === 'negative' ? item.negative : filter === 'open' ? !item.handled : true,
  )

  function add() {
    if (!content.trim()) return
    setAlerts((prev) => [
      {
        id: makeId('alert'),
        source: source.trim() || '未标注',
        author: author.trim() || '匿名',
        content: content.trim(),
        at: new Date().toLocaleString('zh-CN', { hour12: false }),
        negative: isNegative(content),
        handled: false,
      },
      ...prev,
    ])
    setAuthor('')
    setContent('')
  }

  return (
    <div className="view-panel">
      <div className="view-heading">
        <div>
          <h2>互动提醒</h2>
          <p>汇总评论与私信，自动标出潜在负面反馈</p>
        </div>
        <span className="view-count">{alerts.filter((item) => !item.handled).length} 条待处理</span>
      </div>

      <div className="form-grid">
        <label>
          来源
          <input value={source} onChange={(event) => setSource(event.target.value)} placeholder="小红书 / 抖音 / 闲鱼" />
        </label>
        <label>
          用户
          <input value={author} onChange={(event) => setAuthor(event.target.value)} placeholder="可选" />
        </label>
        <label className="full">
          内容
          <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={3} placeholder="粘贴评论或私信内容" />
        </label>
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn-primary" onClick={add} disabled={!content.trim()}>添加提醒</button>
        <div className="filter-tabs">
          {(['all', 'negative', 'open'] as const).map((item) => (
            <button key={item} type="button" className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>
              {item === 'all' ? '全部' : item === 'negative' ? '负面' : '未处理'}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="view-empty">暂无提醒。添加一条评论后，系统会自动判断是否负面。</div>
      ) : (
        <div className="alert-list">
          {visible.map((item) => (
            <div key={item.id} className={`alert-item ${item.negative ? 'negative' : ''}`}>
              <div className="alert-top">
                <strong>{item.author}</strong>
                <span>{item.source} · {item.at}</span>
                {item.negative && <span className="status-pill danger">负面</span>}
                {item.handled && <span className="status-pill">已处理</span>}
              </div>
              <p>{item.content}</p>
              <div className="alert-actions">
                <button type="button" className="btn btn-ghost btn-small" onClick={() => setAlerts((prev) => prev.map((row) => row.id === item.id ? { ...row, handled: !row.handled } : row))}>
                  {item.handled ? '重新打开' : '标记已处理'}
                </button>
                <button type="button" className="btn btn-ghost btn-small" onClick={() => setAlerts((prev) => prev.filter((row) => row.id !== item.id))}>删除</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
