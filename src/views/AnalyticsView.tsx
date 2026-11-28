import { useRef, useState, type ChangeEvent } from 'react'
import { parseCsvRows } from '../lib/csv'

interface AnalyticsRow {
  platform: string
  title: string
  views: number
  likes: number
  comments: number
  conversions: number
}

function number(value: string | undefined): number {
  const parsed = Number((value ?? '0').replace(/[^\d.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function parseAnalyticsCsv(raw: string): AnalyticsRow[] {
  const rows = parseCsvRows(raw)
  if (rows.length < 2) return []

  const header = rows[0].map((cell) => cell.trim().toLowerCase())
  const hasHeader = header.some((cell) =>
    ['platform', '平台', 'title', 'views', '浏览'].some((key) => cell.includes(key)),
  )
  const data = hasHeader ? rows.slice(1) : rows

  const findColumn = (keys: string[], fallback: number): number => {
    if (!hasHeader) return fallback
    const index = header.findIndex((cell) => keys.some((key) => cell.includes(key)))
    return index >= 0 ? index : fallback
  }

  const columns = {
    platform: findColumn(['platform', '平台'], 0),
    title: findColumn(['title', '标题'], 1),
    views: findColumn(['views', '浏览'], 2),
    likes: findColumn(['likes', '点赞'], 3),
    comments: findColumn(['comments', '评论'], 4),
    conversions: findColumn(['conversions', '转化'], 5),
  }

  return data
    .map((cells) => ({
      platform: (cells[columns.platform] ?? '').trim(),
      title: (cells[columns.title] ?? '').trim(),
      views: number(cells[columns.views]),
      likes: number(cells[columns.likes]),
      comments: number(cells[columns.comments]),
      conversions: number(cells[columns.conversions]),
    }))
    .filter((row) => row.title)
}

export default function AnalyticsView() {
  const [rows, setRows] = useState<AnalyticsRow[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const [notice, setNotice] = useState('')

  const totals = rows.reduce(
    (acc, row) => ({
      views: acc.views + row.views,
      likes: acc.likes + row.likes,
      comments: acc.comments + row.comments,
      conversions: acc.conversions + row.conversions,
    }),
    { views: 0, likes: 0, comments: 0, conversions: 0 },
  )

  const byPlatform = Array.from(rows.reduce((map, row) => {
    const current = map.get(row.platform) ?? { views: 0, likes: 0, comments: 0, conversions: 0, count: 0 }
    current.views += row.views
    current.likes += row.likes
    current.comments += row.comments
    current.conversions += row.conversions
    current.count += 1
    map.set(row.platform, current)
    return map
  }, new Map<string, { views: number; likes: number; comments: number; conversions: number; count: number }>()).entries())

  function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const parsed = parseAnalyticsCsv(String(reader.result ?? ''))
      if (parsed.length === 0) {
        setNotice('CSV 中没有可读取的数据')
        return
      }
      setRows(parsed)
      setNotice(`已导入 ${parsed.length} 条数据`)
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  return (
    <div className="view-panel">
      <div className="view-heading">
        <div>
          <h2>数据看板</h2>
          <p>导入各平台导出的 CSV，汇总查看内容表现</p>
        </div>
        <button type="button" className="btn btn-secondary btn-small" onClick={() => fileRef.current?.click()}>导入 CSV</button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={importCsv} hidden />
      </div>

      <div className="metric-grid">
        {[
          ['浏览', totals.views],
          ['点赞', totals.likes],
          ['评论', totals.comments],
          ['转化', totals.conversions],
        ].map(([label, value]) => (
          <div key={String(label)} className="metric-card">
            <span>{label}</span>
            <strong>{Number(value).toLocaleString('zh-CN')}</strong>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="view-empty">还没有数据。CSV 列顺序：platform,title,views,likes,comments,conversions。</div>
      ) : (
        <>
          <div className="data-section">
            <h3>分平台汇总</h3>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>平台</th><th>内容数</th><th>浏览</th><th>点赞</th><th>评论</th><th>转化</th></tr>
                </thead>
                <tbody>
                  {byPlatform.map(([name, value]) => (
                    <tr key={name}>
                      <td>{name || '未标注'}</td>
                      <td>{value.count}</td>
                      <td>{value.views.toLocaleString('zh-CN')}</td>
                      <td>{value.likes.toLocaleString('zh-CN')}</td>
                      <td>{value.comments.toLocaleString('zh-CN')}</td>
                      <td>{value.conversions.toLocaleString('zh-CN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="data-section">
            <h3>内容明细</h3>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>标题</th><th>平台</th><th>浏览</th><th>点赞</th><th>评论</th><th>转化</th></tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`${row.title}-${index}`}>
                      <td>{row.title}</td>
                      <td>{row.platform}</td>
                      <td>{row.views.toLocaleString('zh-CN')}</td>
                      <td>{row.likes.toLocaleString('zh-CN')}</td>
                      <td>{row.comments.toLocaleString('zh-CN')}</td>
                      <td>{row.conversions.toLocaleString('zh-CN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {notice && <div className="toast">{notice}</div>}
    </div>
  )
}
