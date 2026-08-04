// 类型化消息协议：popup/options/sidepanel <-> background <-> content
import type { ProfileData } from '@/types/profile'
import type { PageKind, Suggestion, FieldSignature } from '@/types'

// ---- content -> background/UI：页面抓取结果 ----
export interface ScannedPage {
  url: string
  host: string
  title: string
  kind: PageKind
  text: string // 提取的正文
}

// content 探测到的表单字段（含定位用的临时 refId）
export interface DetectedField {
  refId: string // content 内部用于回填定位
  signature: FieldSignature
  currentValue: string
}

// background/UI -> content：预填指令
export interface FillInstruction {
  refId: string
  value: string
  confidence: number // 低置信将高亮提示
  profilePath?: string
}

// content 回报：用户最终确认/修改后的字段值
export interface FieldOutcome {
  signature: FieldSignature
  profilePath?: string // 若来自某条建议
  finalValue: string
  wasSuggested: boolean
}

// ---- 消息联合类型 ----
export type Message =
  // UI -> content
  | { type: 'SCAN_PAGE' }
  | { type: 'DETECT_FIELDS' }
  | { type: 'APPLY_FILL'; instructions: FillInstruction[] }
  | { type: 'HIGHLIGHT_CLEAR' }
  // content -> UI/background
  | { type: 'PAGE_SCANNED'; page: ScannedPage }
  | { type: 'FIELDS_DETECTED'; fields: DetectedField[]; host: string; url: string }
  | { type: 'FILL_OUTCOMES'; host: string; outcomes: FieldOutcome[] }
  // UI -> background
  | { type: 'GET_PROFILE' }
  | { type: 'SAVE_PROFILE'; profile: ProfileData }
  | { type: 'STRUCTURE_TEXT'; text: string; mergeInto?: boolean }
  | { type: 'STRUCTURE_URL'; url: string; mergeInto?: boolean }
  | { type: 'ANALYZE_PAGE'; page: ScannedPage }
  | { type: 'TEST_LLM' }
  // background -> UI（响应用 sendResponse，这里定义 response 载荷）

export interface StructureResult {
  ok: boolean
  profile?: ProfileData
  error?: string
}

export interface AnalyzeResult {
  ok: boolean
  suggestion?: Suggestion
  error?: string
}

export interface TestLlmResult {
  ok: boolean
  error?: string
}

// 便捷发送封装
export function sendMessage<T = unknown>(msg: Message): Promise<T> {
  return chrome.runtime.sendMessage(msg)
}

export async function sendToActiveTab<T = unknown>(msg: Message): Promise<T> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) throw new Error('未找到活动标签页')
  return chrome.tabs.sendMessage(tab.id, msg)
}
