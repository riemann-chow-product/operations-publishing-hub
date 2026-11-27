import type { PlatformId } from '../data/words'

const HASHTAGS: Record<PlatformId, string> = {
  general: '',
  xhs: '\n\n#好物分享 #真实体验 #日常记录',
  douyin: '\n\n#短视频推荐 #实用分享',
  xianyu: '',
}

function clean(text: string): string {
  return text
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim()
}

/** Local, deterministic draft adaptation. No external model or API is called. */
export function adaptCopy(text: string, platform: PlatformId): string {
  const base = clean(text)
  if (!base) return ''

  if (platform === 'xhs') {
    const withTags = /#[^\s#]+/.test(base) ? base : `${base}${HASHTAGS.xhs}`
    return withTags.slice(0, 1000).trim()
  }

  if (platform === 'douyin') {
    const condensed = base.replace(/\n+/g, ' ').slice(0, 280).trim()
    return `${condensed}${HASHTAGS.douyin}`.trim()
  }

  if (platform === 'xianyu') {
    const withoutEmoji = base.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    return `${withoutEmoji}\n\n成色：如图｜价格：见标价｜可小刀，不包邮`.trim()
  }

  return base.slice(0, 2000).trim()
}
