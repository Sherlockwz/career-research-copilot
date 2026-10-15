// Background service worker：消息路由 + LLM 代理 + 存储协调
// API Key 只在此读取，不下发到 content script。
import type {
  Message,
  ScannedPage,
  StructureResult,
  AnalyzeResult,
  TestLlmResult,
} from '@/shared/messages'
import { sendToTab } from '@/shared/messages'
import type { ProfileData } from '@/types/profile'
import { emptyProfile } from '@/types/profile'
import type { Suggestion } from '@/types'
import { getSettings } from '@/lib/storage/settings'
import { loadProfile, saveProfile, replaceProfile } from '@/lib/storage/profile'
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
      return profileResult(await saveProfile(msg.profile))

    case 'REPLACE_PROFILE':
      return profileResult(await replaceProfileAndClear(msg.profile, msg.expectedUpdatedAt))

    case 'CLEAR_PERSONAL_DATA':
      return profileResult(await replaceProfileAndClear(emptyProfile(), msg.expectedUpdatedAt))

    case 'TEST_LLM':
      return testLlm()

    case 'STRUCTURE_TEXT':
      return structureText(msg.text)

    case 'STRUCTURE_URL':
      return structureUrl(msg.url)

    case 'ANALYZE_PAGE':
      return analyzePage(msg.page.kind, msg.page.text)

    case 'QUEUE_ANALYSIS':
      await chrome.storage.local.set({
        currentAnalysis: {
          status: 'pending',
          page: msg.page,
          requestId: msg.requestId,
        },
      })
      return { ok: true }

    default:
      return { ok: false, error: `未知消息: ${(msg as { type: string }).type}` }
  }
}

async function profileResult(profile: ProfileData) {
  await chrome.storage.local.set({ profileRevision: profile.updatedAt })
  return { ok: true, profile }
}

async function replaceProfileAndClear(profile: ProfileData, expectedUpdatedAt: number) {
  const saved = await replaceProfile(profile, expectedUpdatedAt)
  await chrome.storage.local.remove(['fieldMappings', 'currentAnalysis'])
  return saved
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

async function structureText(text: string): Promise<StructureResult> {
  try {
    const settings = await getSettings()
    const r = await chat(settings, {
      system: STRUCTURE_SYSTEM,
      messages: [{ role: 'user', content: structureUserPrompt(text) }],
      json: supportsJsonMode(settings),
      maxTokens: 8192,
    })
    const parsed = extractJson<Partial<ProfileData>>(r.text)
    return { ok: true, profile: profileFromExtraction(parsed) }
  } catch (e) {
    return { ok: false, error: String((e as Error).message ?? e) }
  }
}

// 抓取主页 URL -> 提取正文 -> 复用结构化管线
async function structureUrl(url: string): Promise<StructureResult> {
  try {
    let target: URL
    try {
      target = new URL(url)
    } catch {
      throw new Error('链接格式不正确，请填写完整网址（含 http/https）')
    }
    if (target.protocol !== 'http:' && target.protocol !== 'https:') {
      throw new Error('只支持 http/https 链接')
    }
    const tabs = await chrome.tabs.query({})
    const openTab = tabs.find((tab) => {
      try {
        const current = new URL(tab.url ?? '')
        return current.origin === target.origin && current.pathname === target.pathname && current.search === target.search
      } catch {
        return false
      }
    })
    let text: string | undefined
    if (openTab) {
      try {
        text = (await sendToTab<ScannedPage>(openTab, { type: 'SCAN_PAGE' })).text
      } catch {
        // 站点禁止注入时继续尝试网络抓取。
      }
    }
    if (!text) text = (await fetchPageText(url)).text
    return structureText(text)
  } catch (e) {
    return { ok: false, error: String((e as Error).message ?? e) }
  }
}

// 每次导入只从本次抽取结果构造新资料，绝不读取旧人的字段或数组。
function profileFromExtraction(add: Partial<ProfileData>): ProfileData {
  const out = emptyProfile()
  if (add.basic) {
    for (const [k, v] of Object.entries(add.basic)) {
      if (typeof v === 'string' && v.trim()) (out.basic as Record<string, unknown>)[k] = v
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
    const incoming = add[key]
    if (Array.isArray(incoming)) (out[key] as unknown[]) = incoming
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
