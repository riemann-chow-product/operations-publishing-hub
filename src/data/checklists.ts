import type { PlatformId } from './words'

export type ChecklistStatus = 'pass' | 'fail' | 'todo'

export interface ChecklistItem {
  id: string
  label: string
  hint: string
  kind: 'auto' | 'manual'
  check?: (text: string) => boolean
}

const hasExternalLink = (text: string) =>
  /(https?:\/\/|www\.|二维码|扫码|加微信|微信号|QQ群|私信我|私聊)/i.test(text)

const hasContactInfo = (text: string) => /\b1[3-9]\d{9}\b|微信号|VX|QQ[:：]?\s*\d+/i.test(text)

const hasHashtags = (text: string) => (text.match(/#[^\s#]+/g)?.length ?? 0) >= 3

const withinLength = (limit: number) => (text: string) => text.trim().length <= limit

const hasConditionInfo = (text: string) => /(成色|几成新|全新|价格|不包邮|可小刀)/.test(text)

export const CHECKLISTS: Record<PlatformId, ChecklistItem[]> = {
  general: [
    {
      id: 'general-link',
      label: '无站外链接与导流',
      hint: '检查 URL、二维码、微信/QQ 引流',
      kind: 'auto',
      check: (text) => !hasExternalLink(text),
    },
    {
      id: 'general-contact',
      label: '无直接联系方式',
      hint: '手机号、微信号、QQ 号',
      kind: 'auto',
      check: (text) => !hasContactInfo(text),
    },
    {
      id: 'general-image',
      label: '图片文字已复核',
      hint: '封面和配图上的文字也要合规',
      kind: 'manual',
    },
    {
      id: 'general-proof',
      label: '功效与资质凭证齐全',
      hint: '涉及功效、品牌授权时请确认',
      kind: 'manual',
    },
  ],
  xhs: [
    {
      id: 'xhs-link',
      label: '无站外导流',
      hint: '小红书对私信引流较敏感',
      kind: 'auto',
      check: (text) => !hasExternalLink(text),
    },
    {
      id: 'xhs-tags',
      label: 'topic 标签 ≥ 3 个',
      hint: '有助于分发，也便于完稿自检',
      kind: 'auto',
      check: hasHashtags,
    },
    {
      id: 'xhs-image',
      label: '封面与内页文字已复核',
      hint: '图片上的极限词同样会被识别',
      kind: 'manual',
    },
    {
      id: 'xhs-proof',
      label: '合作与资质信息已标注',
      hint: '广告合作、品牌授权需如实说明',
      kind: 'manual',
    },
  ],
  douyin: [
    {
      id: 'douyin-length',
      label: '口播文案 ≤ 300 字',
      hint: '过长会影响完播率',
      kind: 'auto',
      check: withinLength(300),
    },
    {
      id: 'douyin-link',
      label: '无站外链接与联系方式',
      hint: '避免引导到第三方平台',
      kind: 'auto',
      check: (text) => !hasExternalLink(text) && !hasContactInfo(text),
    },
    {
      id: 'douyin-caption',
      label: '字幕与画面文字已复核',
      hint: '视频帧中的文字也要检查',
      kind: 'manual',
    },
  ],
  xianyu: [
    {
      id: 'xianyu-condition',
      label: '已写明成色与价格',
      hint: '减少交易纠纷',
      kind: 'auto',
      check: hasConditionInfo,
    },
    {
      id: 'xianyu-contact',
      label: '无站外联系方式',
      hint: '不要留微信/QQ/手机号',
      kind: 'auto',
      check: (text) => !hasContactInfo(text) && !hasExternalLink(text),
    },
    {
      id: 'xianyu-photos',
      label: '实拍图与描述一致',
      hint: '图片与文案描述需对应',
      kind: 'manual',
    },
  ],
}

export function evaluateChecklist(
  platform: PlatformId,
  text: string,
  manual: Record<string, boolean>,
): Array<ChecklistItem & { status: ChecklistStatus }> {
  return CHECKLISTS[platform].map((item) => {
    if (item.kind === 'manual') {
      return { ...item, status: manual[item.id] ? ('pass' as const) : ('todo' as const) }
    }
    return { ...item, status: item.check?.(text) ? ('pass' as const) : ('fail' as const) }
  })
}
