// Background service worker：消息路由 + LLM 代理 + 存储协调
// API Key 只在此读取，不下发到 content script。
import type {
  Message,
  StructureResult,
  AnalyzeResult,
  TestLlmResult,
} from '@/shared/messages'
import type { ProfileData } from '@/types/profile'
import { emptyProfile } from '@/types/profile'
import type { Suggestion } from '@/types'
import { getSettings } from '@/lib/storage/settings'
import { loadProfile, saveProfile } from '@/lib/storage/profile'
import { chat, extractJson, supportsJsonMode } from '@/lib/llm'
import { fetchPageText } from '@/lib/resume/fetchPage'
import {
  STRUCTURE_SYSTEM,
  structureUserPrompt,
  jdSystem,
  jdUser,
  professorSystem,
  professorUser,
} from '@/lib/prompts'

// 点击扩展图标时打开 side panel（若支持）
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    ?.setPanelBehavior?.({ openPanelOnActionClick: false })
    .catch(() => {})
})

chrome.runtime.onMessage.addListener((msg: Message, _sender, sendResponse) => {
  handle(msg)
    .then((r) => sendResponse(r))
    .catch((e) => sendResponse({ ok: false, error: String(e?.message ?? e) }))
  return true // 异步响应
})

async function handle(msg: Message): Promise<unknown> {
  switch (msg.type) {
    case 'GET_PROFILE':
      return loadProfile()

    case 'SAVE_PROFILE':
      await saveProfile(msg.profile)
      return { ok: true }

    case 'TEST_LLM':
      return testLlm()

    case 'STRUCTURE_TEXT':
      return structureText(msg.text, msg.mergeInto ?? false)

    case 'STRUCTURE_URL':
      return structureUrl(msg.url, msg.mergeInto ?? false)

    case 'ANALYZE_PAGE':
      return analyzePage(msg.page.kind, msg.page.text)

    default:
      return { ok: false, error: `未知消息: ${(msg as { type: string }).type}` }
  }
}

async function testLlm(): Promise<TestLlmResult> {
  try {
    const settings = await getSettings()
    const r = await chat(settings, {
      messages: [{ role: 'user', content: '回复 OK 两个字符即可。' }],
      maxTokens: 16,
    })
    if (!r.text) return { ok: false, error: '模型无返回' }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String((e as Error).message ?? e) }
  }
}

async function structureText(
  text: string,
  mergeInto: boolean
): Promise<StructureResult> {
  try {
    const settings = await getSettings()
    const r = await chat(settings, {
      system: STRUCTURE_SYSTEM,
      messages: [{ role: 'user', content: structureUserPrompt(text) }],
      json: supportsJsonMode(settings),
      maxTokens: 8192,
    })
    const parsed = extractJson<Partial<ProfileData>>(r.text)
    const base: ProfileData = mergeInto ? await loadProfile() : emptyProfile()
    const merged = mergeProfile(base, parsed)
    return { ok: true, profile: merged }
  } catch (e) {
    return { ok: false, error: String((e as Error).message ?? e) }
  }
}

// 抓取主页 URL -> 提取正文 -> 复用结构化管线
async function structureUrl(
  url: string,
  mergeInto: boolean
): Promise<StructureResult> {
  try {
    const page = await fetchPageText(url)
    return structureText(page.text, mergeInto)
  } catch (e) {
    return { ok: false, error: String((e as Error).message ?? e) }
  }
}

// 合并抽取结果：数组类拼接去空，basic 逐字段覆盖非空值
function mergeProfile(base: ProfileData, add: Partial<ProfileData>): ProfileData {
  const out: ProfileData = JSON.parse(JSON.stringify(base))
  if (add.basic) {
    for (const [k, v] of Object.entries(add.basic)) {
      if (v) (out.basic as Record<string, unknown>)[k] = v
    }
  }
  const arrays: (keyof ProfileData)[] = [
    'education',
    'experiences',
    'publications',
    'skills',
    'languages',
    'summaries',
  ]
  for (const key of arrays) {
    const incoming = (add[key] as unknown[]) ?? []
    if (incoming.length) {
      ;(out[key] as unknown[]) = [...(out[key] as unknown[]), ...incoming]
    }
  }
  out.updatedAt = 0 // 交由 saveProfile 打时间戳
  return out
}

async function analyzePage(
  kind: string,
  text: string
): Promise<AnalyzeResult> {
  try {
    const settings = await getSettings()
    const profile = await loadProfile()
    const isProfessor = kind === 'professor'
    const r = await chat(settings, {
      system: isProfessor ? professorSystem(settings) : jdSystem(settings),
      messages: [
        {
          role: 'user',
          content: isProfessor
            ? professorUser(profile, text)
            : jdUser(profile, text),
        },
      ],
      json: supportsJsonMode(settings),
      maxTokens: 4096,
    })
    const suggestion = extractJson<Suggestion>(r.text)
    return { ok: true, suggestion }
  } catch (e) {
    return { ok: false, error: String((e as Error).message ?? e) }
  }
}
