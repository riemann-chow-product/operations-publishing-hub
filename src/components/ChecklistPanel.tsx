import { useMemo, useState } from 'react'
import { evaluateChecklist, type ChecklistStatus } from '../data/checklists'
import type { PlatformId } from '../data/words'

interface Props {
  platform: PlatformId
  text: string
  onAdapt: () => void
}

const STATUS_LABEL: Record<ChecklistStatus, string> = {
  pass: '已通过',
  fail: '待处理',
  todo: '待确认',
}

export default function ChecklistPanel({ platform, text, onAdapt }: Props) {
  const [manual, setManual] = useState<Record<string, boolean>>({})
  const items = useMemo(
    () => evaluateChecklist(platform, text, manual),
    [platform, text, manual],
  )
  const passed = items.filter((item) => item.status === 'pass').length

  return (
    <div className="p1-panel">
      <div className="p1-heading">
        <div>
          <strong>发布前合规清单</strong>
          <span>除违禁词外，再确认这些平台规则</span>
        </div>
        <span className="p1-progress">{passed}/{items.length} 已通过</span>
      </div>

      <div className="checklist">
        {items.map((item) => (
          <div key={item.id} className={`checklist-item status-${item.status}`}>
            <button
              type="button"
              className="checklist-mark"
              disabled={item.kind !== 'manual'}
              onClick={() => setManual((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
              aria-label={`切换 ${item.label} 状态`}
            >
              {item.status === 'pass' ? '✓' : item.status === 'fail' ? '!' : '·'}
            </button>
            <div className="checklist-copy">
              <strong>{item.label}</strong>
              <span>{item.hint}</span>
            </div>
            <span className={`checklist-status status-${item.status}`}>{STATUS_LABEL[item.status]}</span>
          </div>
        ))}
      </div>

      <div className="p1-footer">
        <button type="button" className="btn btn-secondary btn-small" onClick={onAdapt} disabled={!text.trim()}>
          一键适配当前平台文案
        </button>
        <span className="p1-note">适配在本地完成，会自动再过一遍违禁词检测</span>
      </div>
    </div>
  )
}
