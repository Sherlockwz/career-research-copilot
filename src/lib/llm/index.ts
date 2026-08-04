// LLM provider 抽象：统一 chat 接口，屏蔽Anthropic / OpenAI 兼容差异
import type { LlmSettings } from '@/types'
import { PROVIDER_PRESETS } from '@/types'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatOptions {
  system?: string
  messages: ChatMessage[]
  json?: boolean // 期望模型返回 JSON
  maxTokens?: number
}

export interface ChatResult {
  text: string
}

// 统一入口：根据服务商的请求格式分发（anthropic vs openai 兼容）
export async function chat(
  settings: LlmSettings,
  opts: ChatOptions
): Promise<ChatResult> {
  if (!settings.apiKey) throw new Error('未配置 API Key，请在设置中填写')
  if (!settings.baseUrl) throw new Error('未配置 Base URL，请在设置中填写')
  const format = PROVIDER_PRESETS[settings.provider]?.format ?? 'openai'
  if (format === 'anthropic') return chatClaude(settings, opts)
  return chatOpenAI(settings, opts)
}

// ---- Claude (Anthropic Messages API) ----
async function chatClaude(
  settings: LlmSettings,
  opts: ChatOptions
): Promise<ChatResult> {
  const base = settings.baseUrl.replace(/\/$/, '')
  const body: Record<string, unknown> = {
    model: settings.model,
    max_tokens: opts.maxTokens ?? 4096,
    messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
  }
  if (opts.system) body.system = opts.system

  const res = await fetch(`${base}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': settings.apiKey,
      'anthropic-version': '2023-06-01',
      // 允许浏览器扩展直接调用
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Claude API 错误 ${res.status}: ${t.slice(0, 300)}`)
  }
  const data = await res.json()
  const text = (data.content ?? [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('\n')
  return { text }
}

// ---- OpenAI 兼容 (Chat Completions) ----
async function chatOpenAI(
  settings: LlmSettings,
  opts: ChatOptions
): Promise<ChatResult> {
  const base = settings.baseUrl.replace(/\/$/, '')
  const messages: { role: string; content: string }[] = []
  if (opts.system) messages.push({ role: 'system', content: opts.system })
  for (const m of opts.messages) messages.push({ role: m.role, content: m.content })

  const body: Record<string, unknown> = {
    model: settings.model,
    max_tokens: opts.maxTokens ?? 4096,
    messages,
  }
  if (opts.json) body.response_format = { type: 'json_object' }

  const res = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`OpenAI API 错误 ${res.status}: ${t.slice(0, 300)}`)
  }
  const data = await res.json()
  const text = data.choices?.[0]?.message?.content ?? ''
  return { text }
}

// 从模型输出里稳健地抽取 JSON（容忍 ```json 包裹或前后多余文本）
export function extractJson<T = unknown>(text: string): T {
  let s = text.trim()
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) s = fence[1].trim()
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start >= 0 && end > start) s = s.slice(start, end + 1)
  return JSON.parse(s) as T
}

// 该服务商是否支持 OpenAI 的 response_format:json_object
export function supportsJsonMode(settings: LlmSettings): boolean {
  return (PROVIDER_PRESETS[settings.provider]?.format ?? 'openai') === 'openai'
}
