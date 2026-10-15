// 字段匹配引擎：把探测到的表单字段匹配到 profile 的值
// 优先用已学映射（host 级），未命中用启发式关键词匹配。
import type { ProfileData } from '@/types/profile'
import type { DetectedField } from '@/shared/messages'
import type { FieldMapping } from '@/types'
import { signatureKey } from './signature'

export interface FieldMatch {
  refId: string
  profilePath: string
  value: string
  confidence: number
}

// 从 profile 按路径取值（支持 basic.email 这种一层路径 + 常见派生值）
export function getProfileValue(p: ProfileData, path: string): string | undefined {
  const [head, key] = path.split('.')
  if (head === 'basic' && key) {
    const v = (p.basic as Record<string, unknown>)[key]
    return typeof v === 'string' ? v : undefined
  }
  // 派生：最新教育/经历
  if (head === 'latestSchool') return p.education[0]?.school
  if (head === 'latestMajor') return p.education[0]?.major
  if (head === 'latestDegree') return p.education[0]?.degree
  if (head === 'summary') return p.summaries[0]?.zh || p.summaries[0]?.en
  return undefined
}

// 关键词 -> profilePath 的启发式表（中英同义词）
const HEURISTICS: { path: string; kw: RegExp }[] = [
  { path: 'basic.name', kw: /(姓名|名字|真实姓名|full ?name|your name|^name$)/i },
  { path: 'basic.nameEn', kw: /(英文名|拼音|name.*pinyin|english name)/i },
  { path: 'basic.email', kw: /(邮箱|电子邮件|e-?mail)/i },
  { path: 'basic.phone', kw: /(手机|电话|联系方式|phone|mobile|tel)/i },
  { path: 'basic.gender', kw: /(性别|gender|sex)/i },
  { path: 'basic.birthday', kw: /(生日|出生|birth|dob)/i },
  { path: 'basic.location', kw: /(城市|所在地|现居|地址|city|location|address)/i },
  { path: 'basic.wechat', kw: /(微信|wechat|weixin)/i },
  { path: 'basic.github', kw: /(github)/i },
  { path: 'basic.linkedin', kw: /(linkedin|领英)/i },
  { path: 'basic.homepage', kw: /(个人主页|homepage|personal ?(web)?site|portfolio)/i },
  { path: 'latestSchool', kw: /(学校|毕业院校|院校|university|college|school)/i },
  { path: 'latestMajor', kw: /(专业|major)/i },
  { path: 'latestDegree', kw: /(学历|学位|degree|education level)/i },
  { path: 'summary', kw: /(自我介绍|个人简介|self.?intro|about ?(you|me)|summary|个人陈述)/i },
]

function sigText(d: DetectedField): string {
  const s = d.signature
  return [s.label, s.name, s.id, s.placeholder, s.ariaLabel, s.autocomplete]
    .filter(Boolean)
    .join(' ')
}

// autocomplete 标准值 -> path
const AUTOCOMPLETE_MAP: Record<string, string> = {
  name: 'basic.name',
  email: 'basic.email',
  tel: 'basic.phone',
  'tel-national': 'basic.phone',
}
const UNSAFE_AUTOCOMPLETE = new Set(['given-name', 'family-name', 'street-address', 'organization'])

export function matchFields(
  fields: DetectedField[],
  profile: ProfileData,
  mappings: FieldMapping[]
): FieldMatch[] {
  const mapByKey = new Map(mappings.map((m) => [m.signatureKey, m]))
  const out: FieldMatch[] = []

  for (const f of fields) {
    const key = signatureKey(f.signature)
    let path: string | undefined
    let confidence = 0

    // 1) 已学映射（最高优先）
    const learned = mapByKey.get(key)
    if (learned) {
      path = learned.profilePath
      confidence = Math.max(0.85, learned.confidence)
    }

    // 2) autocomplete 属性
    const autocomplete = f.signature.autocomplete?.toLowerCase().split(/\s+/).pop() ?? ''
    if (!path && UNSAFE_AUTOCOMPLETE.has(autocomplete)) continue
    if (!path && autocomplete) {
      const ac = AUTOCOMPLETE_MAP[autocomplete]
      if (ac) {
        path = ac
        confidence = 0.8
      }
    }

    // 3) 启发式关键词
    if (!path) {
      const text = sigText(f)
      for (const h of HEURISTICS) {
        if (h.kw.test(text)) {
          path = h.path
          confidence = 0.65
          break
        }
      }
    }

    if (!path) continue
    const value = getProfileValue(profile, path)
    if (!value) continue
    out.push({ refId: f.refId, profilePath: path, value, confidence })
  }
  return out
}
