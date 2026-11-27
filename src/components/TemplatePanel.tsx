import { useEffect, useState } from 'react'

const TEMPLATE_KEY = 'operations-publishing-hub.templates'

interface Template {
  id: string
  name: string
  content: string
}

function readTemplates(): Template[] {
  try {
    const raw = localStorage.getItem(TEMPLATE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

interface Props {
  currentText: string
  onLoad: (content: string) => void
}

export default function TemplatePanel({ currentText, onLoad }: Props) {
  const [templates, setTemplates] = useState<Template[]>(readTemplates)
  const [name, setName] = useState('')

  useEffect(() => {
    try {
      localStorage.setItem(TEMPLATE_KEY, JSON.stringify(templates))
    } catch {
      // 超出配额时忽略
    }
  }, [templates])

  function save() {
    const trimmed = name.trim()
    if (!trimmed || !currentText.trim()) return
    setTemplates((prev) => [
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: trimmed, content: currentText },
      ...prev,
    ])
    setName('')
  }

  function remove(id: string) {
    setTemplates((prev) => prev.filter((item) => item.id !== id))
  }

  return (
    <div className="p1-panel">
      <div className="p1-heading">
        <div>
          <strong>文案模板</strong>
          <span>把常用结构保存下来，下次直接复用</span>
        </div>
        <span className="p1-progress">{templates.length} 个模板</span>
      </div>

      <div className="template-form">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="模板名称，例如：种草笔记开头"
        />
        <button type="button" className="btn btn-secondary btn-small" onClick={save} disabled={!name.trim() || !currentText.trim()}>
          保存当前文案
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="p1-empty">还没有模板。写好一段文案后，给它起个名字保存。</div>
      ) : (
        <div className="template-list">
          {templates.map((item) => (
            <div key={item.id} className="template-item">
              <span className="template-name">{item.name}</span>
              <span className="template-preview">{item.content.slice(0, 40)}</span>
              <button type="button" className="btn btn-ghost btn-small" onClick={() => onLoad(item.content)}>
                使用
              </button>
              <button type="button" className="btn btn-ghost btn-small" onClick={() => remove(item.id)}>
                删除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
