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
  | { type: 'QUEUE_ANALYSIS'; page: ScannedPage; requestId: string }
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

export type AnalysisState =
  | { status: 'pending'; page: ScannedPage; requestId: string }
  | { status: 'complete'; page: ScannedPage; requestId: string; suggestion: Suggestion }
  | { status: 'error'; page: ScannedPage; requestId: string; error: string }

// 便捷发送封装
export function sendMessage<T = unknown>(msg: Message): Promise<T> {
  return chrome.runtime.sendMessage(msg)
}

export async function sendToActiveTab<T = unknown>(msg: Message): Promise<T> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab) throw new Error('未找到活动标签页')
  return sendToTab<T>(tab, msg)
}

export async function sendToTab<T = unknown>(tab: chrome.tabs.Tab, msg: Message): Promise<T> {
  if (!tab?.id) throw new Error('未找到活动标签页')
  if (!tab.url || !/^https?:\/\//i.test(tab.url)) {
    throw new Error('此页面不能由扩展读取。请打开普通 http/https 网页；浏览器内置页、扩展页和本地文件页不受支持。')
  }

  try {
    return unwrapResponse<T>(await chrome.tabs.sendMessage(tab.id, msg))
  } catch (error) {
    if (!isMissingReceiver(error)) throw error
  }

  // 扩展安装或刷新前已经打开的标签页不会自动加载内容脚本。
  const files = chrome.runtime.getManifest().content_scripts?.flatMap((script) => script.js ?? []) ?? []
  if (!files.length) throw new Error('扩展缺少页面脚本，请重新构建并加载扩展。')
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files })
  } catch (error) {
    throw new Error(`无法在此网页读取内容：${errorMessage(error)}。请检查扩展的站点访问权限，或刷新网页后重试。`)
  }

  // 打包后的内容脚本可能异步加载模块，注入成功后稍候再发送。
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      return unwrapResponse<T>(await chrome.tabs.sendMessage(tab.id, msg))
    } catch (error) {
      if (!isMissingReceiver(error)) throw error
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
  }
  throw new Error('页面脚本未能启动。请刷新网页并重试；若仍失败，请检查扩展的站点访问权限。')
}

function unwrapResponse<T>(value: unknown): T {
  if (value == null) throw new Error('页面脚本没有返回结果，请刷新网页后重试。')
  if (typeof value === 'object' && 'ok' in value && value.ok === false) {
    throw new Error('error' in value ? String(value.error) : '页面读取失败')
  }
  return value as T
}

function isMissingReceiver(error: unknown): boolean {
  return /Receiving end does not exist|Could not establish connection/i.test(errorMessage(error))
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
