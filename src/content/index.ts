// Content script：页面抓取、表单探测、填入 + 高亮、回收用户最终值
import type {
  Message,
  ScannedPage,
  DetectedField,
  FillInstruction,
} from '@/shared/messages'
import type { FieldSignature } from '@/types'
import { detectPageKind } from '@/lib/forms/signature'

type FormEl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

const HIGHLIGHT_CLASS = 'ccp-highlight'
const HIGHLIGHT_LOW_CLASS = 'ccp-highlight-low'

// refId -> 元素，用于预填回填定位
const fieldRegistry = new Map<string, FormEl>()

injectStyles()

chrome.runtime.onMessage.addListener((msg: Message, _sender, sendResponse) => {
  try {
    switch (msg.type) {
      case 'SCAN_PAGE':
        sendResponse(scanPage())
        return
      case 'DETECT_FIELDS':
        sendResponse(detectFields())
        return
      case 'APPLY_FILL':
        sendResponse(applyFill(msg.instructions))
        return
      case 'HIGHLIGHT_CLEAR':
        clearHighlights()
        sendResponse({ ok: true })
        return
    }
  } catch (e) {
    sendResponse({ ok: false, error: String((e as Error).message ?? e) })
  }
})

// ---- 抓取正文 ----
function scanPage(): ScannedPage {
  const text = extractMainText()
  const url = location.href
  const host = location.host
  const title = document.title
  return { url, host, title, kind: detectPageKind(url, title, text), text }
}

function extractMainText(): string {
  // 优先 main/article，退化到 body。去脚本/样式/导航。
  const root =
    document.querySelector('main') ??
    document.querySelector('article') ??
    document.body
  const clone = root.cloneNode(true) as HTMLElement
  clone
    .querySelectorAll('script,style,noscript,svg,nav,footer,header')
    .forEach((el) => el.remove())
  const raw = clone.innerText || clone.textContent || ''
  return raw.replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim().slice(0, 20000)
}

// ---- 探测表单字段 ----
function detectFields(): { fields: DetectedField[]; host: string; url: string } {
  fieldRegistry.clear()
  const els = Array.from(
    document.querySelectorAll<FormEl>('input, textarea, select')
  ).filter(isFillable)

  const fields: DetectedField[] = els.map((el, i) => {
    const refId = `ccp-${i}`
    fieldRegistry.set(refId, el)
    el.dataset.ccpRef = refId
    return {
      refId,
      signature: signatureOf(el),
      currentValue: 'value' in el ? el.value : '',
    }
  })
  return { fields, host: location.host, url: location.href }
}

function isFillable(el: FormEl): boolean {
  if (el instanceof HTMLInputElement) {
    const skip = ['hidden', 'submit', 'button', 'reset', 'file', 'image', 'password']
    if (skip.includes(el.type)) return false
  }
  if (el.disabled || (el as HTMLInputElement).readOnly) return false
  const rect = el.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) return false // 不可见
  return true
}

function signatureOf(el: FormEl): FieldSignature {
  return {
    name: el.getAttribute('name') ?? undefined,
    id: el.id || undefined,
    label: findLabel(el),
    placeholder: (el as HTMLInputElement).placeholder || undefined,
    ariaLabel: el.getAttribute('aria-label') ?? undefined,
    type: el instanceof HTMLInputElement ? el.type : el.tagName.toLowerCase(),
    autocomplete: el.getAttribute('autocomplete') ?? undefined,
  }
}

function findLabel(el: FormEl): string | undefined {
  // 1) <label for=id>
  if (el.id) {
    const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`)
    if (l?.textContent) return l.textContent.trim().slice(0, 60)
  }
  // 2) 祖先 label
  const wrap = el.closest('label')
  if (wrap?.textContent) return wrap.textContent.trim().slice(0, 60)
  // 3) 前一个兄弟文本
  const prev = el.previousElementSibling
  if (prev && /label|span|div|p/i.test(prev.tagName) && prev.textContent) {
    const t = prev.textContent.trim()
    if (t && t.length < 40) return t
  }
  return undefined
}

// ---- 填入 + 高亮 ----
function applyFill(instructions: FillInstruction[]): { ok: boolean; filled: number } {
  let filled = 0
  for (const ins of instructions) {
    const el = fieldRegistry.get(ins.refId)
    if (!el) continue
    setNativeValue(el, ins.value)
    highlight(el, ins.confidence)
    filled++
  }
  return { ok: true, filled }
}

// 兼容 React 受控组件：走原生 setter 再派发事件
function setNativeValue(el: FormEl, value: string) {
  if (el instanceof HTMLSelectElement) {
    el.value = value
    el.dispatchEvent(new Event('change', { bubbles: true }))
    return
  }
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  setter?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

function highlight(el: FormEl, confidence: number) {
  el.classList.remove(HIGHLIGHT_CLASS, HIGHLIGHT_LOW_CLASS)
  el.classList.add(confidence < 0.6 ? HIGHLIGHT_LOW_CLASS : HIGHLIGHT_CLASS)
}

function clearHighlights() {
  document
    .querySelectorAll(`.${HIGHLIGHT_CLASS}, .${HIGHLIGHT_LOW_CLASS}`)
    .forEach((el) => el.classList.remove(HIGHLIGHT_CLASS, HIGHLIGHT_LOW_CLASS))
}

// 页面卸载前上报用户最终值（供学习）—— 通过 storage 暂存，由 UI 触发读取
// 这里提供一个函数，UI 在“确认学习”时会主动 DETECT 再比对，故此处仅保留高亮清理。
function injectStyles() {
  const style = document.createElement('style')
  style.textContent = `
    .${HIGHLIGHT_CLASS} { outline: 2px solid #3b6ef6 !important; background: #eef4ff !important; transition: outline .2s; }
    .${HIGHLIGHT_LOW_CLASS} { outline: 2px dashed #f59e0b !important; background: #fffbeb !important; }
  `
  document.documentElement.appendChild(style)
}
