export const STORAGE_KEYS = {
  customWords: 'operations-publishing-hub.custom-words',
  history: 'operations-publishing-hub.history',
  calendar: 'operations-publishing-hub.calendar',
  alerts: 'operations-publishing-hub.alerts',
  templates: 'operations-publishing-hub.templates',
  keywords: 'operations-publishing-hub.keywords',
} as const

export const STORAGE_ERROR_EVENT = 'oph-storage-error'

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function notifyStorageError(key: string, error: unknown): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(STORAGE_ERROR_EVENT, { detail: { key, error } }))
  }
}

/** Returns false instead of failing silently, and emits a global event for UI feedback. */
export function writeJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (error) {
    notifyStorageError(key, error)
    return false
  }
}

export function makeId(prefix = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/** Stable ID used to link a check result to a scheduled post and its analytics. */
export function makeContentId(): string {
  return `content-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export interface WorkspaceBackup {
  version: 1
  exportedAt: string
  data: Record<string, unknown>
}

export function exportWorkspace(): WorkspaceBackup {
  const data: Record<string, unknown> = {}
  for (const key of Object.values(STORAGE_KEYS)) {
    try {
      const raw = localStorage.getItem(key)
      if (raw) data[key] = JSON.parse(raw)
    } catch {
      // Skip unreadable keys; they are reported by readJson at the call site.
    }
  }
  return { version: 1, exportedAt: new Date().toISOString(), data }
}

export function importWorkspace(raw: string): { ok: boolean; message: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, message: '备份文件不是有效的 JSON' }
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, message: '备份文件格式不正确' }
  }

  const backup = parsed as Partial<WorkspaceBackup>
  if (backup.version !== 1 || !backup.data || typeof backup.data !== 'object') {
    return { ok: false, message: '备份文件版本不受支持' }
  }

  let restored = 0
  for (const [key, value] of Object.entries(backup.data)) {
    if (!Object.values(STORAGE_KEYS).includes(key as (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS])) {
      continue
    }
    if (writeJson(key, value)) restored += 1
  }

  return { ok: restored > 0, message: restored > 0 ? `已恢复 ${restored} 项数据` : '备份中没有可恢复的数据' }
}
