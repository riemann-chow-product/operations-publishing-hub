import { useEffect, useMemo, useState } from 'react'
import { PLATFORMS, type PlatformId } from '../data/words'
import { makeId, readJson, writeJson } from '../lib/storage'

const KEY = 'operations-publishing-hub.calendar'

interface Post {
  id: string
  contentId?: string
  account: string
  platform: PlatformId
  date: string
  time: string
  title: string
  content: string
  status: 'draft' | 'scheduled' | 'published'
  sourceRisk?: string
}

export interface CalendarPrefill {
  contentId: string
  title: string
  content: string
  platform: PlatformId
  riskLabel: string
}

export function readCalendarPosts(): Post[] {
  return readJson<Post[]>(KEY, [])
}

const STATUS_LABEL: Record<Post['status'], string> = {
  draft: '草稿',
  scheduled: '待发布',
  published: '已发布',
}

function toMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number)
  return (hour || 0) * 60 + (minute || 0)
}

export default function CalendarView({
  prefill,
  onPrefillConsumed,
}: {
  prefill: CalendarPrefill | null
  onPrefillConsumed: () => void
}) {
  const [posts, setPosts] = useState<Post[]>(() => readJson<Post[]>(KEY, []))
  const [linkedCheck, setLinkedCheck] = useState<CalendarPrefill | null>(null)
  const [account, setAccount] = useState('')
  const [platform, setPlatform] = useState<PlatformId>('xhs')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [time, setTime] = useState('12:00')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [status, setStatus] = useState<Post['status']>('scheduled')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    writeJson(KEY, posts)
  }, [posts])

  useEffect(() => {
    if (!prefill) return
    setTitle(prefill.title)
    setContent(prefill.content)
    setPlatform(prefill.platform)
    setLinkedCheck(prefill)
    setNotice('已带入检测结果，补充账号和时间即可排期')
    onPrefillConsumed()
  }, [prefill, onPrefillConsumed])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 2600)
    return () => window.clearTimeout(timer)
  }, [notice])

  const groups = useMemo(() => {
    const map = new Map<string, Post[]>()
    for (const post of posts) {
      const list = map.get(post.date) ?? []
      list.push(post)
      map.set(post.date, list)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [posts])

  const conflict = posts.find(
    (post) =>
      post.account === account.trim() &&
      post.date === date &&
      Math.abs(toMinutes(post.time) - toMinutes(time)) < 30,
  )

  function addPost() {
    if (!date || !time || !account.trim() || !title.trim()) {
      setNotice('请填写账号、日期、时间和标题')
      return
    }
    if (conflict) {
      setNotice('该账号在这个时间段已有安排')
      return
    }
    setPosts((prev) => [
      ...prev,
      {
        id: makeId('post'),
        contentId: linkedCheck?.contentId,
        sourceRisk: linkedCheck?.riskLabel,
        account: account.trim(),
        platform,
        date,
        time,
        title: title.trim(),
        content: content.trim(),
        status,
      },
    ])
    setTitle('')
    setContent('')
    setLinkedCheck(null)
    setNotice('已加入排期')
  }

  return (
    <div className="view-panel">
      <div className="view-heading">
        <div>
          <h2>发布日历</h2>
          <p>多账号排期、状态跟踪与冲突提醒</p>
        </div>
        <span className="view-count">{posts.length} 条安排</span>
      </div>

      <div className="form-grid">
        <label>
          账号
          <input value={account} onChange={(event) => setAccount(event.target.value)} placeholder="例如：品牌主号" />
        </label>
        <label>
          平台
          <select value={platform} onChange={(event) => setPlatform(event.target.value as PlatformId)}>
            {PLATFORMS.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </label>
        <label>
          日期
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label>
          时间
          <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
        </label>
        <label>
          标题
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="这条内容叫什么" />
        </label>
        <label>
          状态
          <select value={status} onChange={(event) => setStatus(event.target.value as Post['status'])}>
            <option value="draft">草稿</option>
            <option value="scheduled">待发布</option>
            <option value="published">已发布</option>
          </select>
        </label>
        <label className="full">
          内容摘要
          <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="可选，记录要点或成品文案" rows={3} />
        </label>
      </div>

      {conflict && <div className="inline-warning">冲突提醒：该账号在 {conflict.date} {conflict.time} 附近已有安排，请调整时间。</div>}

      <div className="form-actions">
        <button type="button" className="btn btn-primary" onClick={addPost}>加入排期</button>
      </div>

      {groups.length === 0 ? (
        <div className="view-empty">还没有排期。填好上面的信息，点「加入排期」就能看到日历视图。</div>
      ) : (
        <div className="calendar-groups">
          {groups.map(([day, items]) => (
            <div key={day} className="calendar-group">
              <div className="calendar-date">{day}</div>
              {items.map((post) => (
                <div key={post.id} className="calendar-item">
                  <span className="calendar-time">{post.time}</span>
                  <div className="calendar-copy">
                    <strong>{post.title}</strong>
                    <span>{post.account} · {PLATFORMS.find((item) => item.id === post.platform)?.label}</span>
                    {post.contentId && (
                      <span className="linked-check">来自检测 · {post.sourceRisk ?? '已关联'}</span>
                    )}
                  </div>
                  <span className="status-pill">{STATUS_LABEL[post.status]}</span>
                  <button type="button" className="btn btn-ghost btn-small" onClick={() => setPosts((prev) => prev.filter((item) => item.id !== post.id))}>删除</button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {notice && <div className="toast">{notice}</div>}
    </div>
  )
}
