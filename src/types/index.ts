// LLM 设置与字段映射、建议等类型

// 支持的服务商：claude=Anthropic 原生格式；其余均为 OpenAI 兼容格式
export type LlmProvider = 'claude' | 'openai' | 'deepseek' | 'kimi' | 'custom'

// 请求格式：Anthropic Messages API vs OpenAI Chat Completions
export type ApiFormat = 'anthropic' | 'openai'

export interface LlmSettings {
  provider: LlmProvider
  apiKey: string
  baseUrl: string // 允许自定义，兼容中转站/自部署/第三方 OpenAI 兼容端点
  model: string
  // 输出语言偏好
  outputLang: 'zh' | 'en' | 'auto'
}

// 各服务商预设：请求格式 + 默认 baseUrl + 默认模型 + 展示名
export interface ProviderPreset {
  label: string
  format: ApiFormat
  baseUrl: string
  model: string
  hint?: string // UI 提示（如去哪拿 Key）
}

export const PROVIDER_PRESETS: Record<LlmProvider, ProviderPreset> = {
  claude: {
    label: 'Claude (Anthropic)',
    format: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-5',
  },
  openai: {
    label: 'OpenAI',
    format: 'openai',
    baseUrl: 'https://api.openai.com',
    model: 'gpt-4o-mini',
  },
  deepseek: {
    label: 'DeepSeek深度求索',
    format: 'openai',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    hint: '在 platform.deepseek.com 获取 API Key',
  },
  kimi: {
    label: 'Kimi (月之暗面)',
    format: 'openai',
    baseUrl: 'https://api.moonshot.cn',
    model: 'moonshot-v1-8k',
    hint: '在 platform.moonshot.cn 获取 API Key',
  },
  custom: {
    label: '自定义 (中转站 / 自部署)',
    format: 'openai',
    baseUrl: '',
    model: '',
    hint: '填你的 OpenAI 兼容端点 Base URL 与模型名；多数中转站/自部署均兼容',
  },
}

export function defaultLlmSettings(): LlmSettings {
  return {
    provider: 'claude',
    apiKey: '',
    baseUrl: PROVIDER_PRESETS.claude.baseUrl,
    model: PROVIDER_PRESETS.claude.model,
    outputLang: 'auto',
  }
}

// ---- 字段映射学习 ----
// 探测到的表单字段特征
export interface FieldSignature {
  name?: string
  id?: string
  label?: string
  placeholder?: string
  ariaLabel?: string
  type?: string // input type / textarea / select
  autocomplete?: string
}

// 站点级学到的映射：某站点某字段 -> profile 中的路径（如 basic.email）
export interface FieldMapping {
  host: string
  signatureKey: string // 由 FieldSignature 归一化得到的稳定 key
  signature: FieldSignature
  profilePath: string // 例如 "basic.email" 或字面量标记
  confidence: number // 0~1
  hitCount: number // 用户确认次数，越多越可信
  updatedAt: number
}

// ---- 建议类型 ----
export type PageKind = 'jd' | 'professor' | 'form' | 'unknown'

export interface JdSuggestion {
  kind: 'jd'
  summary: string // 岗位理解摘要
  matchPoints: string[] // 你已有的匹配点
  gaps: string[] // 差距
  optimizations: { area: string; advice: string; revisedText?: string }[]
  howToMatch: string[] // 如何更 match：切入方向、可补充研究/项目
}

export interface ProfessorSuggestion {
  kind: 'professor'
  researchFocus: string[] // 教授研究方向/兴趣
  commonGround: string[] // 与你的共同点
  approachAngles: string[] // 切入角度
  collaboration: string[] // 后续可行合作方向
  emailDraft: { subject: string; body: string }
}

export type Suggestion = JdSuggestion | ProfessorSuggestion
