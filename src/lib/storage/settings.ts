// chrome.storage.local 封装：LLM 设置、字段映射规则
import type { LlmSettings, FieldMapping } from '@/types'
import { defaultLlmSettings } from '@/types'

const KEY_SETTINGS = 'llmSettings'
const KEY_MAPPINGS = 'fieldMappings' // Record<host, FieldMapping[]>

export async function getSettings(): Promise<LlmSettings> {
  const r = await chrome.storage.local.get(KEY_SETTINGS)
  return { ...defaultLlmSettings(), ...(r[KEY_SETTINGS] ?? {}) }
}

export async function saveSettings(settings: LlmSettings): Promise<void> {
  await chrome.storage.local.set({ [KEY_SETTINGS]: settings })
}

export async function getMappings(host: string): Promise<FieldMapping[]> {
  const r = await chrome.storage.local.get(KEY_MAPPINGS)
  const all: Record<string, FieldMapping[]> = r[KEY_MAPPINGS] ?? {}
  return all[host] ?? []
}

export async function getAllMappings(): Promise<Record<string, FieldMapping[]>> {
  const r = await chrome.storage.local.get(KEY_MAPPINGS)
  return r[KEY_MAPPINGS] ?? {}
}

// 插入或更新一条映射（按 host + signatureKey 去重，命中则 confidence/hitCount 提升）
export async function upsertMapping(m: FieldMapping): Promise<void> {
  const r = await chrome.storage.local.get(KEY_MAPPINGS)
  const all: Record<string, FieldMapping[]> = r[KEY_MAPPINGS] ?? {}
  const list = all[m.host] ?? []
  const idx = list.findIndex((x) => x.signatureKey === m.signatureKey)
  if (idx >= 0) {
    const prev = list[idx]
    list[idx] = {
      ...m,
      hitCount: prev.hitCount + 1,
      confidence: Math.min(1, Math.max(prev.confidence, m.confidence) + 0.1),
      updatedAt: m.updatedAt,
    }
  } else {
    list.push(m)
  }
  all[m.host] = list
  await chrome.storage.local.set({ [KEY_MAPPINGS]: all })
}

export async function clearMappings(host?: string): Promise<void> {
  if (!host) {
    await chrome.storage.local.set({ [KEY_MAPPINGS]: {} })
    return
  }
  const r = await chrome.storage.local.get(KEY_MAPPINGS)
  const all: Record<string, FieldMapping[]> = r[KEY_MAPPINGS] ?? {}
  delete all[host]
  await chrome.storage.local.set({ [KEY_MAPPINGS]: all })
}
